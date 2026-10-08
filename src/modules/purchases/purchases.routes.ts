import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, numberToWords, getTodayDateString } from "../../utils/helpers.js";

export class PurchasesController {
  static async listPurchases(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const invoices = await prisma.purchaseInvoice.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoiceNumber,
          supplier_invoice_no: inv.supplierInvoiceNo,
          supplier_id: inv.supplierId,
          supplier_name: inv.supplierName,
          supplier_gstin: inv.supplierGstin,
          supplier_state: inv.supplierState,
          supplier_state_code: inv.supplierStateCode,
          invoice_date: inv.invoiceDate,
          payment_type: inv.paymentType,
          is_interstate: inv.isInterstate,
          items: inv.items,
          subtotal: inv.subtotal,
          taxable_value: inv.taxableValue,
          cgst_total: inv.cgstTotal,
          sgst_total: inv.sgstTotal,
          igst_total: inv.igstTotal,
          gst_summary: inv.gstSummary,
          round_off: inv.roundOff,
          grand_total: inv.grandTotal,
          amount_in_words: inv.amountInWords,
          total_purchase_cost: inv.totalPurchaseCost,
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

  static async createPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        res.status(400).json({ detail: "Purchase invoice must contain at least one medicine item" });
        return;
      }

      const supplier = await prisma.supplier.findUnique({
        where: { id: p.supplier_id },
      });
      if (!supplier) {
        res.status(404).json({ detail: "Supplier not found" });
        return;
      }

      const count = await prisma.purchaseInvoice.count({ where: { companyId } });
      const prefix = company.purchasePrefix || "PUR-2026-";
      const invoiceNumber = `${prefix}${String(count + 1).padStart(5, "0")}`;

      const isInterstate = supplier.stateCode !== company.stateCode;

      let subtotal = 0;
      let taxableTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      const gstRateMap: Record<string, any> = {};
      const calculatedItems: any[] = [];

      for (const it of items) {
        const qty = parseFloat(it.quantity || 0);
        const freeQty = parseFloat(it.free_quantity || 0);
        const rate = parseFloat(it.purchase_rate || 0);
        const discPct = parseFloat(it.discount_percent || 0);
        const gstPct = parseFloat(it.gst_rate || 12);
        const mrp = parseFloat(it.mrp || rate * 1.25);
        const saleRate = parseFloat(it.sale_rate || rate * 1.15);

        const gross = round2(qty * rate);
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

        subtotal += gross;
        taxableTotal += taxable;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

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
          medicine_id: it.medicine_id,
          medicine_name: it.medicine_name,
          generic_name: it.generic_name || "",
          hsn_code: it.hsn_code || "30049060",
          batch_number: it.batch_number,
          mfg_date: it.mfg_date,
          expiry_date: it.expiry_date,
          pack_size: it.pack_size || "10x10",
          quantity: qty,
          free_quantity: freeQty,
          mrp,
          purchase_rate: rate,
          sale_rate: saleRate,
          discount_percent: discPct,
          gst_rate: gstPct,
          taxable_amount: taxable,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          total_amount: lineTotal,
        });
      }

      const calculatedTotal = round2(taxableTotal + cgstTotal + sgstTotal + igstTotal);
      const roundOff = round2(Math.round(calculatedTotal) - calculatedTotal);
      const grandTotal = round2(calculatedTotal + roundOff);

      const amountPaid = round2(parseFloat(p.amount_paid ?? 0));
      const balanceDue = round2(grandTotal - amountPaid);
      const paymentStatus = balanceDue <= 0.01 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid";
      const amountInWords = numberToWords(grandTotal);
      const gstSummaryList = Object.values(gstRateMap).sort((a: any, b: any) => a.gst_rate - b.gst_rate);

      // Execute in atomic Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        const purchaseDoc = await tx.purchaseInvoice.create({
          data: {
            companyId,
            invoiceNumber,
            supplierInvoiceNo: p.supplier_invoice_no || "",
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierGstin: supplier.gstin,
            supplierState: supplier.state,
            supplierStateCode: supplier.stateCode,
            invoiceDate: p.invoice_date || getTodayDateString(),
            paymentType: p.payment_type || "Credit",
            isInterstate,
            items: calculatedItems,
            subtotal: round2(subtotal),
            taxableValue: round2(taxableTotal),
            cgstTotal: round2(cgstTotal),
            sgstTotal: round2(sgstTotal),
            igstTotal: round2(igstTotal),
            gstSummary: gstSummaryList,
            roundOff,
            grandTotal,
            amountInWords,
            totalPurchaseCost: round2(taxableTotal),
            amountPaid,
            balanceDue,
            paymentStatus,
            notes: p.notes || "",
            createdBy: req.user?.name || "Staff",
          },
        });

        // Stock ingestion & batch creation
        for (const it of calculatedItems) {
          const totalInwardQty = it.quantity + it.free_quantity;

          let batch = await tx.medicineBatch.findFirst({
            where: {
              medicineId: it.medicine_id,
              batchNumber: it.batch_number,
            },
          });

          if (batch) {
            batch = await tx.medicineBatch.update({
              where: { id: batch.id },
              data: {
                quantity: round2(batch.quantity + totalInwardQty),
                purchaseRate: it.purchase_rate,
                saleRate: it.sale_rate,
                mrp: it.mrp,
                expiryDate: it.expiry_date || batch.expiryDate,
              },
            });
          } else {
            batch = await tx.medicineBatch.create({
              data: {
                companyId,
                medicineId: it.medicine_id,
                medicineName: it.medicine_name,
                genericName: it.generic_name,
                hsnCode: it.hsn_code,
                batchNumber: it.batch_number,
                mfgDate: it.mfg_date,
                expiryDate: it.expiry_date,
                purchaseRate: it.purchase_rate,
                mrp: it.mrp,
                saleRate: it.sale_rate,
                gstRate: it.gst_rate,
                quantity: totalInwardQty,
                freeQuantity: it.free_quantity,
                supplierId: supplier.id,
                supplierName: supplier.name,
              },
            });
          }

          // Stock ledger entry
          await tx.stockLedger.create({
            data: {
              companyId,
              date: p.invoice_date || getTodayDateString(),
              movementType: "Purchase Inward",
              referenceId: purchaseDoc.id,
              referenceInvoiceNo: invoiceNumber,
              medicineId: it.medicine_id,
              medicineName: it.medicine_name,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              qtyIn: totalInwardQty,
              qtyOut: 0,
              balanceAfter: round2(batch.quantity),
              notes: `Inward purchase from ${supplier.name} (${invoiceNumber})`,
            },
          });
        }

        // Supplier balance update & ledger entry
        const newSupBal = round2(supplier.currentBalance + balanceDue);
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { currentBalance: newSupBal },
        });

        await tx.supplierLedger.create({
          data: {
            companyId,
            supplierId: supplier.id,
            supplierName: supplier.name,
            date: p.invoice_date || getTodayDateString(),
            entryType: "Purchase",
            referenceNo: invoiceNumber,
            debit: amountPaid,
            credit: grandTotal,
            balance: newSupBal,
            description: `Purchase Invoice ${invoiceNumber} (Supplier Inv: ${p.supplier_invoice_no || "N/A"})`,
          },
        });

        return purchaseDoc;
      });

      res.status(201).json({
        id: result.id,
        invoice_number: result.invoiceNumber,
        grand_total: result.grandTotal,
        balance_due: result.balanceDue,
        message: "Purchase invoice recorded and stock batches updated successfully",
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, PurchasesController.listPurchases);
router.post("/", requireAuth, PurchasesController.createPurchase);

export default router;
