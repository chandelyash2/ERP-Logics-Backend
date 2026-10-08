import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class PaymentsController {
  static async listPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const payments = await prisma.payment.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        payments.map((p) => ({
          id: p.id,
          payment_number: p.paymentNumber,
          party_type: p.partyType,
          party_id: p.partyId,
          party_name: p.partyName,
          party_business_name: p.partyBusinessName,
          payment_date: p.paymentDate,
          amount: p.amount,
          payment_method: p.paymentMethod,
          reference_number: p.referenceNumber,
          notes: p.notes,
          created_by: p.createdBy,
          created_at: p.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const amount = round2(parseFloat(p.amount ?? 0));
      if (amount <= 0) {
        res.status(400).json({ detail: "Payment amount must be greater than 0" });
        return;
      }

      const partyType = p.party_type || "Customer";
      const partyId = p.party_id;
      if (!partyId) {
        res.status(400).json({ detail: "party_id is required" });
        return;
      }

      const count = await prisma.payment.count({ where: { companyId } });
      const paymentNumber = `PAY-${String(count + 1).padStart(5, "0")}`;

      const payment = await prisma.$transaction(async (tx) => {
        let partyName = "";
        let partyBusinessName = "";

        if (partyType === "Customer") {
          const cust = await tx.customer.findUnique({ where: { id: partyId } });
          if (!cust) throw new Error("Customer not found");
          partyName = cust.name;
          partyBusinessName = cust.businessName || "";

          const newBal = round2(cust.currentBalance - amount);
          await tx.customer.update({
            where: { id: partyId },
            data: { currentBalance: newBal },
          });

          await tx.customerLedger.create({
            data: {
              companyId,
              customerId: cust.id,
              customerName: cust.name,
              date: p.payment_date || getTodayDateString(),
              entryType: "Payment",
              referenceNo: paymentNumber,
              debit: 0,
              credit: amount,
              balance: newBal,
              description: `Receipt via ${p.payment_method || "Bank Transfer"} (Ref: ${p.reference_number || "N/A"})`,
            },
          });
        } else {
          const sup = await tx.supplier.findUnique({ where: { id: partyId } });
          if (!sup) throw new Error("Supplier not found");
          partyName = sup.name;
          partyBusinessName = sup.companyName || "";

          const newBal = round2(sup.currentBalance - amount);
          await tx.supplier.update({
            where: { id: partyId },
            data: { currentBalance: newBal },
          });

          await tx.supplierLedger.create({
            data: {
              companyId,
              supplierId: sup.id,
              supplierName: sup.name,
              date: p.payment_date || getTodayDateString(),
              entryType: "Payment",
              referenceNo: paymentNumber,
              debit: amount,
              credit: 0,
              balance: newBal,
              description: `Payout via ${p.payment_method || "Bank Transfer"} (Ref: ${p.reference_number || "N/A"})`,
            },
          });
        }

        return tx.payment.create({
          data: {
            companyId,
            paymentNumber,
            partyType,
            partyId,
            partyName,
            partyBusinessName,
            paymentDate: p.payment_date || getTodayDateString(),
            amount,
            paymentMethod: p.payment_method || "Bank Transfer",
            referenceNumber: p.reference_number || "",
            notes: p.notes || "",
            createdBy: req.user?.name || "Staff",
          },
        });
      });

      res.status(201).json({
        id: payment.id,
        payment_number: payment.paymentNumber,
        amount: payment.amount,
        message: "Payment recorded and ledger updated successfully",
      });
    } catch (err: any) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, PaymentsController.listPayments);
router.post("/", requireAuth, PaymentsController.recordPayment);

export default router;
