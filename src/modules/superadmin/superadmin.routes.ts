import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";
import { round2 } from "../../utils/helpers.js";

export class SuperAdminController {
  static async getPlatformStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalCompanies,
        totalUsers,
        totalSalesInvoices,
        totalMedicines,
        sales,
        companies,
      ] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.salesInvoice.count(),
        prisma.medicine.count(),
        prisma.salesInvoice.findMany({ select: { grandTotal: true, grossProfit: true } }),
        prisma.company.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { users: { where: { role: "BUSINESS_OWNER" } } },
        }),
      ]);

      let totalPlatformGmv = 0;
      let totalPlatformProfit = 0;
      for (const s of sales) {
        totalPlatformGmv += s.grandTotal;
        totalPlatformProfit += s.grossProfit;
      }

      res.json({
        total_tenants: totalCompanies,
        total_users: totalUsers,
        total_invoices_generated: totalSalesInvoices,
        total_medicines_catalog: totalMedicines,
        total_platform_gmv: round2(totalPlatformGmv),
        total_platform_profit: round2(totalPlatformProfit),
        recent_companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          state: c.state,
          plan: c.plan,
          is_active: c.isActive,
          owner_name: c.users[0]?.name || "N/A",
          owner_email: c.users[0]?.email || "N/A",
          created_at: c.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async listCompanies(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          users: true,
          _count: {
            select: {
              medicines: true,
              salesInvoices: true,
              customers: true,
              suppliers: true,
            },
          },
        },
      });

      res.json(
        companies.map((c) => {
          const owner = c.users.find((u) => u.role === "BUSINESS_OWNER") || c.users[0];
          return {
            id: c.id,
            name: c.name,
            legal_name: c.legalName,
            gstin: c.gstin,
            dl_number: c.dlNumber,
            phone: c.phone,
            email: c.email,
            state: c.state,
            state_code: c.stateCode,
            city: c.city,
            plan: c.plan,
            is_active: c.isActive,
            created_at: c.createdAt.toISOString(),
            owner: owner
              ? { id: owner.id, name: owner.name, email: owner.email }
              : null,
            stats: {
              users_count: c.users.length,
              medicines_count: c._count.medicines,
              sales_count: c._count.salesInvoices,
              customers_count: c._count.customers,
              suppliers_count: c._count.suppliers,
            },
          };
        })
      );
    } catch (err) {
      next(err);
    }
  }

  static async toggleCompanyStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const company = await prisma.company.update({
        where: { id },
        data: { isActive: Boolean(is_active) },
      });

      res.json({
        message: `Company ${company.name} has been ${company.isActive ? "activated" : "suspended"}`,
        company: { id: company.id, name: company.name, is_active: company.isActive },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCompanyPlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { plan } = req.body;

      const company = await prisma.company.update({
        where: { id },
        data: { plan: String(plan).toUpperCase() },
      });

      res.json({
        message: `Company plan updated to ${company.plan}`,
        company: { id: company.id, name: company.name, plan: company.plan },
      });
    } catch (err) {
      next(err);
    }
  }

  static async impersonateTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const company = await prisma.company.findUnique({
        where: { id },
        include: { users: true },
      });

      if (!company) {
        res.status(404).json({ detail: "Company not found" });
        return;
      }

      const owner = company.users.find((u) => u.role === "BUSINESS_OWNER") || company.users[0];
      if (!owner) {
        res.status(404).json({ detail: "No user found for this company to impersonate" });
        return;
      }

      const token = AuthService.createToken({
        id: owner.id,
        email: owner.email,
        role: owner.role,
        companyId: company.id,
      });

      res.json({
        access_token: token,
        token_type: "bearer",
        impersonating_as: {
          user_id: owner.id,
          user_name: owner.name,
          company_name: company.name,
          company_id: company.id,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.use(requireAuth, requireRole("SUPER_ADMIN"));

router.get("/stats", SuperAdminController.getPlatformStats);
router.get("/companies", SuperAdminController.listCompanies);
router.put("/companies/:id/status", SuperAdminController.toggleCompanyStatus);
router.put("/companies/:id/plan", SuperAdminController.updateCompanyPlan);
router.post("/companies/:id/impersonate", SuperAdminController.impersonateTenant);

export default router;
