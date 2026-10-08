import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class SuppliersController {
  static async listSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search).trim() : "";
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { gstin: { contains: search, mode: "insensitive" } },
          { dlNumber: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
        ];
      }

      const suppliers = await prisma.supplier.findMany({
        where: whereClause,
        orderBy: { name: "asc" },
      });

      res.json(
        suppliers.map((s) => ({
          id: s.id,
          supplier_id_code: s.supplierIdCode,
          name: s.name,
          company: s.companyName,
          phone: s.phone,
          email: s.email,
          address: s.address,
          city: s.city,
          district: s.district,
          state: s.state,
          state_code: s.stateCode,
          pincode: s.pincode,
          gstin: s.gstin,
          dl_number: s.dlNumber,
          opening_balance: s.openingBalance,
          current_balance: s.currentBalance,
          payment_terms: s.paymentTerms,
          is_interstate: s.isInterstate,
          sale_nature: s.saleNature,
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const count = await prisma.supplier.count({ where: { companyId } });
      const supplierIdCode = `SUP-${String(count + 1).padStart(4, "0")}`;

      const supStateCode = String(p.state_code || "27").trim();
      const isInterstate = supStateCode !== company.stateCode;
      const saleNature = isInterstate ? "interstate" : "intrastate";

      const openBal = round2(parseFloat(p.opening_balance ?? 0));

      const supplier = await prisma.supplier.create({
        data: {
          companyId,
          supplierIdCode,
          name: p.name,
          companyName: p.company || p.company_name || "",
          phone: p.phone || "",
          email: p.email || "",
          address: p.address || "",
          city: p.city || "",
          district: p.district || "",
          state: p.state || "Maharashtra",
          stateCode: supStateCode,
          pincode: p.pincode || "",
          gstin: p.gstin ? String(p.gstin).toUpperCase().trim() : "",
          dlNumber: p.dl_number || "",
          openingBalance: openBal,
          currentBalance: openBal,
          paymentTerms: p.payment_terms || "Net 30",
          isInterstate,
          saleNature,
        },
      });

      if (openBal > 0) {
        await prisma.supplierLedger.create({
          data: {
            companyId,
            supplierId: supplier.id,
            supplierName: supplier.name,
            date: getTodayDateString(),
            entryType: "Opening Balance",
            referenceNo: "OPENING",
            debit: 0,
            credit: openBal,
            balance: openBal,
            description: "Initial opening balance ledger entry",
          },
        });
      }

      res.status(201).json({
        id: supplier.id,
        supplier_id_code: supplier.supplierIdCode,
        name: supplier.name,
        company: supplier.companyName,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        city: supplier.city,
        district: supplier.district,
        state: supplier.state,
        state_code: supplier.stateCode,
        pincode: supplier.pincode,
        gstin: supplier.gstin,
        dl_number: supplier.dlNumber,
        opening_balance: supplier.openingBalance,
        current_balance: supplier.currentBalance,
        payment_terms: supplier.paymentTerms,
        is_interstate: supplier.isInterstate,
        sale_nature: supplier.saleNature,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sup_id } = req.params;
      const p = req.body;

      const existing = await prisma.supplier.findUnique({
        where: { id: sup_id },
        include: { company: true },
      });

      if (!existing) {
        res.status(404).json({ detail: "Supplier not found" });
        return;
      }

      const supStateCode = p.state_code ? String(p.state_code).trim() : existing.stateCode;
      const companyStateCode = existing.company.stateCode;
      const isInterstate = supStateCode !== companyStateCode;
      const saleNature = isInterstate ? "interstate" : "intrastate";

      const updated = await prisma.supplier.update({
        where: { id: sup_id },
        data: {
          name: p.name ?? existing.name,
          companyName: p.company ?? p.company_name ?? existing.companyName,
          phone: p.phone ?? existing.phone,
          email: p.email ?? existing.email,
          address: p.address ?? existing.address,
          city: p.city ?? existing.city,
          district: p.district ?? existing.district,
          state: p.state ?? existing.state,
          stateCode: supStateCode,
          pincode: p.pincode ?? existing.pincode,
          gstin: p.gstin ? String(p.gstin).toUpperCase().trim() : existing.gstin,
          dlNumber: p.dl_number ?? existing.dlNumber,
          paymentTerms: p.payment_terms ?? existing.paymentTerms,
          isInterstate,
          saleNature,
        },
      });

      res.json({
        id: updated.id,
        supplier_id_code: updated.supplierIdCode,
        name: updated.name,
        company: updated.companyName,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        city: updated.city,
        district: updated.district,
        state: updated.state,
        state_code: updated.stateCode,
        pincode: updated.pincode,
        gstin: updated.gstin,
        dl_number: updated.dlNumber,
        opening_balance: updated.openingBalance,
        current_balance: updated.currentBalance,
        payment_terms: updated.paymentTerms,
        is_interstate: updated.isInterstate,
        sale_nature: updated.saleNature,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sup_id } = req.params;
      await prisma.supplier.delete({
        where: { id: sup_id },
      });
      res.json({ message: "Supplier deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sup_id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id: sup_id },
      });

      if (!supplier) {
        res.status(404).json({ detail: "Supplier not found" });
        return;
      }

      const entries = await prisma.supplierLedger.findMany({
        where: { supplierId: sup_id },
        orderBy: { createdAt: "asc" },
      });

      res.json(
        entries.map((e) => ({
          id: e.id,
          supplier_id: e.supplierId,
          supplier_name: e.supplierName,
          date: e.date,
          entry_type: e.entryType,
          reference_no: e.referenceNo,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
          description: e.description,
          created_at: e.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, SuppliersController.listSuppliers);
router.post("/", requireAuth, SuppliersController.createSupplier);
router.put("/:sup_id", requireAuth, SuppliersController.updateSupplier);
router.delete("/:sup_id", requireAuth, SuppliersController.deleteSupplier);
router.get("/:sup_id/ledger", requireAuth, SuppliersController.getSupplierLedger);

export default router;
