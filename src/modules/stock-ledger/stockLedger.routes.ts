import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";

export class StockLedgerController {
  static async listStockLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { medicine_id, batch_number, movement_type, from_date, to_date } = req.query;

      const whereClause: any = companyId ? { companyId } : {};

      if (medicine_id) whereClause.medicineId = String(medicine_id);
      if (batch_number) whereClause.batchNumber = { contains: String(batch_number), mode: "insensitive" };
      if (movement_type) whereClause.movementType = String(movement_type);
      if (from_date || to_date) {
        whereClause.date = {};
        if (from_date) whereClause.date.gte = String(from_date);
        if (to_date) whereClause.date.lte = String(to_date);
      }

      const entries = await prisma.stockLedger.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      res.json(
        entries.map((e) => ({
          id: e.id,
          date: e.date,
          movement_type: e.movementType,
          reference_id: e.referenceId,
          reference_invoice_no: e.referenceInvoiceNo,
          medicine_id: e.medicineId,
          medicine_name: e.medicineName,
          batch_id: e.batchId,
          batch_number: e.batchNumber,
          qty_in: e.qtyIn,
          qty_out: e.qtyOut,
          balance_after: e.balanceAfter,
          notes: e.notes,
          created_at: e.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, StockLedgerController.listStockLedger);

export default router;
