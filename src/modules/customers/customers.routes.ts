import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class CustomersController {
  static async listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search).trim() : "";
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { businessName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { gstin: { contains: search, mode: "insensitive" } },
          { dlNumber: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { district: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where: whereClause,
        orderBy: { name: "asc" },
      });

      res.json(
        customers.map((c) => ({
          id: c.id,
          customer_id_code: c.customerIdCode,
          name: c.name,
          business_name: c.businessName,
          phone: c.phone,
          email: c.email,
          address: c.address,
          city: c.city,
          district: c.district,
          state: c.state,
          state_code: c.stateCode,
          pincode: c.pincode,
          gstin: c.gstin,
          dl_number: c.dlNumber,
          credit_limit: c.creditLimit,
          opening_balance: c.openingBalance,
          current_balance: c.currentBalance,
          payment_terms: c.paymentTerms,
          status: c.status,
          is_interstate: c.isInterstate,
          sale_nature: c.saleNature,
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const count = await prisma.customer.count({ where: { companyId } });
      const customerIdCode = `CUST-${String(count + 1).padStart(4, "0")}`;

      const custStateCode = String(p.state_code || "27").trim();
      const isInterstate = custStateCode !== company.stateCode;
      const saleNature = isInterstate ? "interstate" : "intrastate";

      const openBal = round2(parseFloat(p.opening_balance ?? 0));

      const customer = await prisma.customer.create({
        data: {
          companyId,
          customerIdCode,
          name: p.name,
          businessName: p.business_name || "",
          phone: p.phone || "",
          email: p.email || "",
          address: p.address || "",
          city: p.city || "",
          district: p.district || "",
          state: p.state || "Maharashtra",
          stateCode: custStateCode,
          pincode: p.pincode || "",
          gstin: p.gstin ? String(p.gstin).toUpperCase().trim() : "",
          dlNumber: p.dl_number || "",
          creditLimit: parseFloat(p.credit_limit ?? 100000),
          openingBalance: openBal,
          currentBalance: openBal,
          paymentTerms: p.payment_terms || "30 Days",
          status: p.status || "active",
          isInterstate,
          saleNature,
        },
      });

      if (openBal > 0) {
        await prisma.customerLedger.create({
          data: {
            companyId,
            customerId: customer.id,
            customerName: customer.name,
            date: getTodayDateString(),
            entryType: "Opening Balance",
            referenceNo: "OPENING",
            debit: openBal,
            credit: 0,
            balance: openBal,
            description: "Initial opening balance ledger entry",
          },
        });
      }

      res.status(201).json({
        id: customer.id,
        customer_id_code: customer.customerIdCode,
        name: customer.name,
        business_name: customer.businessName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        district: customer.district,
        state: customer.state,
        state_code: customer.stateCode,
        pincode: customer.pincode,
        gstin: customer.gstin,
        dl_number: customer.dlNumber,
        credit_limit: customer.creditLimit,
        opening_balance: customer.openingBalance,
        current_balance: customer.currentBalance,
        payment_terms: customer.paymentTerms,
        status: customer.status,
        is_interstate: customer.isInterstate,
        sale_nature: customer.saleNature,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cust_id } = req.params;
      const p = req.body;

      const existing = await prisma.customer.findUnique({
        where: { id: cust_id },
        include: { company: true },
      });

      if (!existing) {
        res.status(404).json({ detail: "Customer not found" });
        return;
      }

      const custStateCode = p.state_code ? String(p.state_code).trim() : existing.stateCode;
      const companyStateCode = existing.company.stateCode;
      const isInterstate = custStateCode !== companyStateCode;
      const saleNature = isInterstate ? "interstate" : "intrastate";

      const updated = await prisma.customer.update({
        where: { id: cust_id },
        data: {
          name: p.name ?? existing.name,
          businessName: p.business_name ?? existing.businessName,
          phone: p.phone ?? existing.phone,
          email: p.email ?? existing.email,
          address: p.address ?? existing.address,
          city: p.city ?? existing.city,
          district: p.district ?? existing.district,
          state: p.state ?? existing.state,
          stateCode: custStateCode,
          pincode: p.pincode ?? existing.pincode,
          gstin: p.gstin ? String(p.gstin).toUpperCase().trim() : existing.gstin,
          dlNumber: p.dl_number ?? existing.dlNumber,
          creditLimit: p.credit_limit !== undefined ? parseFloat(p.credit_limit) : existing.creditLimit,
          paymentTerms: p.payment_terms ?? existing.paymentTerms,
          status: p.status ?? existing.status,
          isInterstate,
          saleNature,
        },
      });

      res.json({
        id: updated.id,
        customer_id_code: updated.customerIdCode,
        name: updated.name,
        business_name: updated.businessName,
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
        credit_limit: updated.creditLimit,
        opening_balance: updated.openingBalance,
        current_balance: updated.currentBalance,
        payment_terms: updated.paymentTerms,
        status: updated.status,
        is_interstate: updated.isInterstate,
        sale_nature: updated.saleNature,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cust_id } = req.params;
      await prisma.customer.delete({
        where: { id: cust_id },
      });
      res.json({ message: "Customer and related ledger entries deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cust_id } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id: cust_id },
      });

      if (!customer) {
        res.status(404).json({ detail: "Customer not found" });
        return;
      }

      const entries = await prisma.customerLedger.findMany({
        where: { customerId: cust_id },
        orderBy: { createdAt: "asc" },
      });

      res.json(
        entries.map((e) => ({
          id: e.id,
          customer_id: e.customerId,
          customer_name: e.customerName,
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
router.get("/", requireAuth, CustomersController.listCustomers);
router.post("/", requireAuth, CustomersController.createCustomer);
router.put("/:cust_id", requireAuth, CustomersController.updateCustomer);
router.delete("/:cust_id", requireAuth, CustomersController.deleteCustomer);
router.get("/:cust_id/ledger", requireAuth, CustomersController.getCustomerLedger);

export default router;
