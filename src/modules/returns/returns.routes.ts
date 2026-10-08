import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class ReturnsController {
  static async listSalesReturns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const returns = await prisma.salesReturn.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        returns.map((r) => ({
          id: r.id,
          return_number: r.returnNumber,
          return_date: r.returnDate,
          original_invoice_no: r.originalInvoiceNo,
          customer_id: r.customerId,
          customer_name: r.customerName,
          items: r.items,
          return_subtotal: r.returnSubtotal,
          return_tax_amount: r.returnTaxAmount,
          return_total: r.returnTotal,
          refund_mode: r.refundMode,
          ledger_action: r.ledgerAction,
          reason: r.reason,
          notes: r.notes,
          created_by: r.createdBy,
          created_at: r.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async createSalesReturn(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const customer = await prisma.customer.findUnique({
        where: { id: p.customer_id },
      });

      if (!customer) {
        res.status(404).json({ detail: "Customer not found" });
        return;
      }

      const count = await prisma.salesReturn.count({ where: { companyId } });
      const returnNumber = `RET-S-2026-${String(count + 1).padStart(5, "0")}`;

      const items = p.items || [];
      const totalAmount = round2(parseFloat(p.return_total ?? 0));
      const subtotal = round2(parseFloat(p.return_subtotal ?? totalAmount));
      const taxAmount = round2(parseFloat(p.return_tax_amount ?? 0));

      const ret = await prisma.$transaction(async (tx) => {
        const salesRetDoc = await tx.salesReturn.create({
          data: {
            companyId,
            returnNumber,
            returnDate: p.return_date || getTodayDateString(),
            originalInvoiceNo: p.original_invoice_no || "",
            customerId: customer.id,
            customerName: customer.name,
            items,
            returnSubtotal: subtotal,
            returnTaxAmount: taxAmount,
            returnTotal: totalAmount,
            refundMode: p.refund_mode || "Credit Note (Adjust in Ledger)",
            ledgerAction: p.ledger_action || "Credit Note (Deduct from Customer Balance)",
            reason: p.reason || "Damaged / Expired Return",
            notes: p.notes || "",
            createdBy: req.user?.name || "Staff",
          },
        });

        // Restock returned items
        for (const it of items) {
          const qty = parseFloat(it.quantity || 0);
          if (it.batch_id && qty > 0) {
            const batch = await tx.medicineBatch.findUnique({ where: { id: it.batch_id } });
            if (batch) {
              const newQty = round2(batch.quantity + qty);
              await tx.medicineBatch.update({
                where: { id: it.batch_id },
                data: { quantity: newQty },
              });

              await tx.stockLedger.create({
                data: {
                  companyId,
                  date: p.return_date || getTodayDateString(),
                  movementType: "Sales Return",
                  referenceId: salesRetDoc.id,
                  referenceInvoiceNo: returnNumber,
                  medicineId: batch.medicineId,
                  medicineName: batch.medicineName,
                  batchId: batch.id,
                  batchNumber: batch.batchNumber,
                  qtyIn: qty,
                  qtyOut: 0,
                  balanceAfter: newQty,
                  notes: `Sales return inward from ${customer.name} (${returnNumber})`,
                },
              });
            }
          }
        }

        // Adjust customer balance
        const newBal = round2(customer.currentBalance - totalAmount);
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newBal },
        });

        await tx.customerLedger.create({
          data: {
            companyId,
            customerId: customer.id,
            customerName: customer.name,
            date: p.return_date || getTodayDateString(),
            entryType: "Sales Return",
            referenceNo: returnNumber,
            debit: 0,
            credit: totalAmount,
            balance: newBal,
            description: `Sales Return Credit Note ${returnNumber} (Ref Inv: ${p.original_invoice_no || "N/A"})`,
          },
        });

        return salesRetDoc;
      });

      res.status(201).json({
        id: ret.id,
        return_number: ret.returnNumber,
        return_total: ret.returnTotal,
        message: "Sales return recorded, stock restocked, and customer ledger credited successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  static async listPurchaseReturns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const returns = await prisma.purchaseReturn.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        returns.map((r) => ({
          id: r.id,
          return_number: r.returnNumber,
          return_date: r.returnDate,
          original_invoice_no: r.originalInvoiceNo,
          supplier_id: r.supplierId,
          supplier_name: r.supplierName,
          items: r.items,
          return_subtotal: r.returnSubtotal,
          return_tax_amount: r.returnTaxAmount,
          return_total: r.returnTotal,
          refund_mode: r.refundMode,
          ledger_action: r.ledgerAction,
          reason: r.reason,
          notes: r.notes,
          created_by: r.createdBy,
          created_at: r.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async createPurchaseReturn(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const supplier = await prisma.supplier.findUnique({
        where: { id: p.supplier_id },
      });

      if (!supplier) {
        res.status(404).json({ detail: "Supplier not found" });
        return;
      }

      const count = await prisma.purchaseReturn.count({ where: { companyId } });
      const returnNumber = `RET-P-2026-${String(count + 1).padStart(5, "0")}`;

      const items = p.items || [];
      const totalAmount = round2(parseFloat(p.return_total ?? 0));
      const subtotal = round2(parseFloat(p.return_subtotal ?? totalAmount));
      const taxAmount = round2(parseFloat(p.return_tax_amount ?? 0));

      const ret = await prisma.$transaction(async (tx) => {
        const purRetDoc = await tx.purchaseReturn.create({
          data: {
            companyId,
            returnNumber,
            returnDate: p.return_date || getTodayDateString(),
            originalInvoiceNo: p.original_invoice_no || "",
            supplierId: supplier.id,
            supplierName: supplier.name,
            items,
            returnSubtotal: subtotal,
            returnTaxAmount: taxAmount,
            returnTotal: totalAmount,
            refundMode: p.refund_mode || "Debit Note (Adjust in Ledger)",
            ledgerAction: p.ledger_action || "Debit Note (Deduct from Supplier Balance)",
            reason: p.reason || "Expiry / Breakage / Near Expiry Return",
            notes: p.notes || "",
            createdBy: req.user?.name || "Staff",
          },
        });

        // Deduct returned items from inventory
        for (const it of items) {
          const qty = parseFloat(it.quantity || 0);
          if (it.batch_id && qty > 0) {
            const batch = await tx.medicineBatch.findUnique({ where: { id: it.batch_id } });
            if (batch) {
              const newQty = round2(Math.max(0, batch.quantity - qty));
              await tx.medicineBatch.update({
                where: { id: it.batch_id },
                data: { quantity: newQty },
              });

              await tx.stockLedger.create({
                data: {
                  companyId,
                  date: p.return_date || getTodayDateString(),
                  movementType: "Purchase Return",
                  referenceId: purRetDoc.id,
                  referenceInvoiceNo: returnNumber,
                  medicineId: batch.medicineId,
                  medicineName: batch.medicineName,
                  batchId: batch.id,
                  batchNumber: batch.batchNumber,
                  qtyIn: 0,
                  qtyOut: qty,
                  balanceAfter: newQty,
                  notes: `Purchase return outward to ${supplier.name} (${returnNumber})`,
                },
              });
            }
          }
        }

        // Adjust supplier balance
        const newBal = round2(supplier.currentBalance - totalAmount);
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { currentBalance: newBal },
        });

        await tx.supplierLedger.create({
          data: {
            companyId,
            supplierId: supplier.id,
            supplierName: supplier.name,
            date: p.return_date || getTodayDateString(),
            entryType: "Purchase Return",
            referenceNo: returnNumber,
            debit: totalAmount,
            credit: 0,
            balance: newBal,
            description: `Purchase Return Debit Note ${returnNumber} (Ref Inv: ${p.original_invoice_no || "N/A"})`,
          },
        });

        return purRetDoc;
      });

      res.status(201).json({
        id: ret.id,
        return_number: ret.returnNumber,
        return_total: ret.returnTotal,
        message: "Purchase return recorded, stock deducted, and supplier ledger debited successfully",
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/sales-returns", requireAuth, ReturnsController.listSalesReturns);
router.post("/sales-returns", requireAuth, ReturnsController.createSalesReturn);
router.get("/purchase-returns", requireAuth, ReturnsController.listPurchaseReturns);
router.post("/purchase-returns", requireAuth, ReturnsController.createPurchaseReturn);

export default router;
