import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export class UsersController {
  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause = req.user?.role === "SUPER_ADMIN" ? {} : companyId ? { companyId } : {};

      const users = await prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      res.json(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role.toLowerCase(),
          permissions: {
            can_create_invoices: u.canCreateInvoices,
            can_view_inventory: u.canViewInventory,
            can_add_customers: u.canAddCustomers,
            can_add_suppliers: u.canAddSuppliers,
            can_record_payments: u.canRecordPayments,
            can_view_reports: u.canViewReports,
            can_edit_delete_records: u.canEditDeleteRecords,
            can_manage_settings: u.canManageSettings,
          },
          created_at: u.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async updatePermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id } = req.params;
      const { permissions } = req.body;

      if (!permissions || typeof permissions !== "object") {
        res.status(400).json({ detail: "Invalid permissions payload" });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: user_id },
        data: {
          canCreateInvoices: permissions.can_create_invoices ?? true,
          canViewInventory: permissions.can_view_inventory ?? true,
          canAddCustomers: permissions.can_add_customers ?? true,
          canAddSuppliers: permissions.can_add_suppliers ?? false,
          canRecordPayments: permissions.can_record_payments ?? false,
          canViewReports: permissions.can_view_reports ?? false,
          canEditDeleteRecords: permissions.can_edit_delete_records ?? false,
          canManageSettings: permissions.can_manage_settings ?? false,
        },
      });

      res.json({
        message: "User permissions updated successfully",
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role.toLowerCase(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, requireRole("SUPER_ADMIN", "BUSINESS_OWNER"), UsersController.listUsers);
router.put("/:user_id/permissions", requireAuth, requireRole("SUPER_ADMIN", "BUSINESS_OWNER"), UsersController.updatePermissions);

export default router;
