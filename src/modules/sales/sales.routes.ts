import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, numberToWords, getTodayDateString, isBatchExpired } from "../../utils/helpers.js";

export class SalesController {
  static async listSales(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const invoices = await prisma.salesInvoice.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoiceNumber,
          customer_id: inv.customerId,
          customer_name: inv.customerName,
          customer_business_name: inv.customerBusinessName,
          customer_phone: inv.customerPhone,
          customer_gstin: inv.customerGstin,
          customer_dl: inv.customerDl,
          customer_address: inv.customerAddress,
          customer_state: inv.customerState,
          customer_state_code: inv.customerStateCode,
          invoice_date: inv.invoiceDate,
          due_date: inv.dueDate,
          payment_type: inv.paymentType,
          is_interstate: inv.isInterstate,
          items: inv.items,
          subtotal: inv.subtotal,
          invoice_discount_percent: inv.invoiceDiscountPercent,
          invoice_discount_amount: inv.invoiceDiscountAmount,
          taxable_value: inv.taxableValue,
          cgst_total: inv.cgstTotal,
          sgst_total: inv.sgstTotal,
          igst_total: inv.igstTotal,
          gst_summary: inv.gstSummary,
          round_off: inv.roundOff,
          grand_total: inv.grandTotal,
          amount_in_words: inv.amountInWords,
          total_purchase_cost: inv.totalPurchaseCost,
          gross_profit: inv.grossProfit,
          amount_paid: inv.amountPaid,
          balance_due: inv.balanceDue,
          payment_status: inv.paymentStatus,
          notes: inv.notes,
          created_by: inv.createdBy,
          created_at: inv.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async getSaleById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sale_id } = req.params;
      const inv = await prisma.salesInvoice.findUnique({
        where: { id: sale_id },
      });

      if (!inv) {
        res.status(404).json({ detail: "Sales invoice not found" });
        return;
      }

      res.json({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        customer_id: inv.customerId,
        customer_name: inv.customerName,
        customer_business_name: inv.customerBusinessName,
        customer_phone: inv.customerPhone,
        customer_gstin: inv.customerGstin,
        customer_dl: inv.customerDl,
        customer_address: inv.customerAddress,
        customer_state: inv.customerState,
        customer_state_code: inv.customerStateCode,
        invoice_date: inv.invoiceDate,
        due_date: inv.dueDate,
        payment_type: inv.paymentType,
        is_interstate: inv.isInterstate,
        items: inv.items,
        subtotal: inv.subtotal,
        invoice_discount_percent: inv.invoiceDiscountPercent,
        invoice_discount_amount: inv.invoiceDiscountAmount,
        taxable_value: inv.taxableValue,
        cgst_total: inv.cgstTotal,
        sgst_total: inv.sgstTotal,
        igst_total: inv.igstTotal,
        gst_summary: inv.gstSummary,
        round_off: inv.roundOff,
        grand_total: inv.grandTotal,
        amount_in_words: inv.amountInWords,
        total_purchase_cost: inv.totalPurchaseCost,
        gross_profit: inv.grossProfit,
        amount_paid: inv.amountPaid,
        balance_due: inv.balanceDue,
        payment_status: inv.paymentStatus,
        notes: inv.notes,
        created_by: inv.createdBy,
        created_at: inv.createdAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  static async createSale(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let companyId = req.user?.companyId;
      let company = companyId
        ? await prisma.company.findUnique({ where: { id: companyId } })
        : await prisma.company.findFirst();

      if (!company) {
        company = await prisma.company.create({
          data: { name: "Default Pharma Agency" },
        });
      }
      companyId = company.id;

      const p = req.body;
      const items = p.items || [];
      if (!items.length) {
        res.status(400).json({ detail: "Invoice must contain at least one medicine item" });
        return;
      }

      const customer = await prisma.customer.findUnique({
        where: { id: p.customer_id },
      });
      if (!customer) {
        res.status(404).json({ detail: "Customer not found" });
        return;
      }

      const count = await prisma.salesInvoice.count({ where: { companyId } });
      const prefix = company.invoicePrefix || "INV-2026-";
      const invoiceNumber = `${prefix}${String(count + 1).padStart(5, "0")}`;

      const isInterstate = customer.stateCode !== company.stateCode;

      let subtotal = 0;
      let taxableTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      let totalPurchaseCost = 0;
      const gstRateMap: Record<string, any> = {};
      const calculatedItems: any[] = [];

      // Validate batches and stock
      for (const it of items) {
        const batchId = it.batch_id;
        if (!batchId) {
          res.status(400).json({ detail: `Batch required for item ${it.medicine_name}` });
          return;
        }

        const batch = await prisma.medicineBatch.findUnique({
          where: { id: batchId },
        });

        if (!batch) {
          res.status(400).json({ detail: `Batch ${it.batch_number || ""} not found in inventory` });
          return;
        }

        const availQty = batch.quantity;
        const requestedQty = parseFloat(it.quantity || 0);
        const freeQty = parseFloat(it.free_quantity || 0);
        const totalDeductQty = requestedQty + freeQty;

        if (requestedQty <= 0) {
          res.status(400).json({ detail: `Quantity must be greater than 0 for ${it.medicine_name}` });
          return;
        }

        if (availQty < totalDeductQty) {
          res.status(400).json({
            detail: `Insufficient stock for ${it.medicine_name} (Batch: ${batch.batchNumber}). Available: ${availQty}, Requested: ${totalDeductQty}`,
          });
          return;
        }

        if (isBatchExpired(batch.expiryDate)) {
          res.status(400).json({
            detail: `Batch ${batch.batchNumber} for ${it.medicine_name} has expired (${batch.expiryDate}). Selling expired batches is blocked.`,
          });
          return;
        }

        const rate = parseFloat(it.sale_rate || batch.saleRate);
        const mrp = parseFloat(it.mrp || batch.mrp);
        const discPct = parseFloat(it.discount_percent || 0);
        const gstPct = parseFloat(it.gst_rate || batch.gstRate);
        const batchPurRate = batch.purchaseRate;

        const gross = round2(requestedQty * rate);
        const discAmt = round2(gross * (discPct / 100));
        const taxable = round2(gross - discAmt);
        const taxAmt = round2(taxable * (gstPct / 100));

        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        if (isInterstate) {
          igst = taxAmt;
        } else {
          cgst = round2(taxAmt / 2);
          sgst = round2(taxAmt / 2);
        }

        const lineTotal = round2(taxable + taxAmt);
        const lineCost = round2(requestedQty * batchPurRate);
        const lineMargin = round2(taxable - lineCost);

        subtotal += gross;
        taxableTotal += taxable;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;
        totalPurchaseCost += lineCost;

        const rateKey = `${gstPct}%`;
        if (!gstRateMap[rateKey]) {
          gstRateMap[rateKey] = {
            gst_rate: gstPct,
            gst_label: rateKey,
            taxable_value: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total_tax: 0,
          };
        }
        gstRateMap[rateKey].taxable_value = round2(gstRateMap[rateKey].taxable_value + taxable);
        gstRateMap[rateKey].cgst = round2(gstRateMap[rateKey].cgst + cgst);
        gstRateMap[rateKey].sgst = round2(gstRateMap[rateKey].sgst + sgst);
        gstRateMap[rateKey].igst = round2(gstRateMap[rateKey].igst + igst);
        gstRateMap[rateKey].total_tax = round2(gstRateMap[rateKey].total_tax + taxAmt);

        calculatedItems.push({
          medicine_id: batch.medicineId,
          medicine_name: it.medicine_name || batch.medicineName,
          generic_name: batch.genericName || "",
          hsn_code: it.hsn_code || batch.hsnCode,
          batch_id: batch.id,
          batch_number: batch.batchNumber,
          expiry_date: batch.expiryDate,
          pack_size: it.pack_size || "10x10",
          quantity: requestedQty,
          free_quantity: freeQty,
          mrp,
          sale_rate: rate,
          discount_percent: discPct,
          gst_rate: gstPct,
          taxable_amount: taxable,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          total_amount: lineTotal,
          purchase_rate_cost: batchPurRate,
          gross_margin: lineMargin,
        });
      }

      const invDiscPct = parseFloat(p.invoice_discount_percent ?? 0);
      const invDiscAmt = invDiscPct > 0 ? round2(taxableTotal * (invDiscPct / 100)) : 0;

      const calculatedTotal = round2(taxableTotal - invDiscAmt + cgstTotal + sgstTotal + igstTotal);
      const roundOff = round2(Math.round(calculatedTotal) - calculatedTotal);
      const grandTotal = round2(calculatedTotal + roundOff);
      const grossProfit = round2(taxableTotal - invDiscAmt - totalPurchaseCost);

      const amountPaid = round2(parseFloat(p.amount_paid ?? 0));
      const balanceDue = round2(grandTotal - amountPaid);
      const paymentStatus = balanceDue <= 0.01 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid";
      const amountInWords = numberToWords(grandTotal);
      const gstSummaryList = Object.values(gstRateMap).sort((a: any, b: any) => a.gst_rate - b.gst_rate);

      // Execute in atomic Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        const salesDoc = await tx.salesInvoice.create({
          data: {
            companyId,
            invoiceNumber,
            customerId: customer.id,
            customerName: customer.name,
            customerBusinessName: customer.businessName,
            customerPhone: customer.phone,
            customerGstin: customer.gstin,
            customerDl: customer.dlNumber,
            customerAddress: customer.address,
            customerState: customer.state,
            customerStateCode: customer.stateCode,
            invoiceDate: p.invoice_date || getTodayDateString(),
            dueDate: p.due_date || getTodayDateString(),
            paymentType: p.payment_type || "Credit",
            isInterstate,
            items: calculatedItems,
            subtotal: round2(subtotal),
            invoiceDiscountPercent: invDiscPct,
            invoiceDiscountAmount: invDiscAmt,
            taxableValue: round2(taxableTotal),
            cgstTotal: round2(cgstTotal),
            sgstTotal: round2(sgstTotal),
            igstTotal: round2(igstTotal),
            gstSummary: gstSummaryList,
            roundOff,
            grandTotal,
            amountInWords,
            totalPurchaseCost: round2(totalPurchaseCost),
            grossProfit,
            amountPaid,
            balanceDue,
            paymentStatus,
            notes: p.notes || "",
            createdBy: req.user?.name || "Staff",
          },
        });

        // Batch deductions & Stock ledger entries
        for (const it of calculatedItems) {
          const deductQty = it.quantity + it.free_quantity;
          const currentBatch = await tx.medicineBatch.findUnique({
            where: { id: it.batch_id },
          });

          if (!currentBatch) continue;
          const newQty = round2(Math.max(0, currentBatch.quantity - deductQty));

          await tx.medicineBatch.update({
            where: { id: it.batch_id },
            data: { quantity: newQty },
          });

          await tx.stockLedger.create({
            data: {
              companyId,
              date: p.invoice_date || getTodayDateString(),
              movementType: "Sales Dispatch",
              referenceId: salesDoc.id,
              referenceInvoiceNo: invoiceNumber,
              medicineId: it.medicine_id,
              medicineName: it.medicine_name,
              batchId: it.batch_id,
              batchNumber: it.batch_number,
              qtyIn: 0,
              qtyOut: deductQty,
              balanceAfter: newQty,
              notes: `Dispatched to ${customer.name} (${invoiceNumber})`,
            },
          });
        }

        // Customer balance update & ledger entry
        const newCustBal = round2(customer.currentBalance + balanceDue);
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newCustBal },
        });

        await tx.customerLedger.create({
          data: {
            companyId,
            customerId: customer.id,
            customerName: customer.name,
            date: p.invoice_date || getTodayDateString(),
            entryType: "Invoice",
            referenceNo: invoiceNumber,
            debit: grandTotal,
            credit: amountPaid,
            balance: newCustBal,
            description: `Sales Tax Invoice ${invoiceNumber}`,
          },
        });

        return salesDoc;
      });

      res.status(201).json({
        id: result.id,
        invoice_number: result.invoiceNumber,
        grand_total: result.grandTotal,
        balance_due: result.balanceDue,
        message: "Sales invoice generated and stock deducted successfully",
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, SalesController.listSales);
router.get("/:sale_id", requireAuth, SalesController.getSaleById);
router.post("/", requireAuth, SalesController.createSale);

export default router;
