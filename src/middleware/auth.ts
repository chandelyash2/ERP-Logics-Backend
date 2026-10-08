import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import prisma from "../db/prisma.js";
import { AuthenticatedRequest, AuthenticatedUser } from "../types/index.js";

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = req.cookies?.access_token;
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      res.status(401).json({ detail: "Authentication required" });
      return;
    }

    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      role: string;
      companyId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });

    if (!user) {
      res.status(401).json({ detail: "User not found" });
      return;
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      companyId: user.companyId,
      permissions: {
        can_create_invoices: user.canCreateInvoices,
        can_view_inventory: user.canViewInventory,
        can_add_customers: user.canAddCustomers,
        can_add_suppliers: user.canAddSuppliers,
        can_record_payments: user.canRecordPayments,
        can_view_reports: user.canViewReports,
        can_edit_delete_records: user.canEditDeleteRecords,
        can_manage_settings: user.canManageSettings,
      },
    };

    req.user = authUser;
    // Default companyId if available (or for standalone default setup)
    req.companyId = user.companyId || undefined;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ detail: "Session expired. Please log in again." });
      return;
    }
    res.status(401).json({ detail: "Invalid authorization token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ detail: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ detail: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}

export function requirePermission(permissionKey: keyof NonNullable<AuthenticatedUser["permissions"]>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ detail: "Authentication required" });
      return;
    }
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "BUSINESS_OWNER") {
      next();
      return;
    }
    if (!req.user.permissions?.[permissionKey]) {
      res.status(403).json({ detail: `Forbidden: permission ${permissionKey} required` });
      return;
    }
    next();
  };
}
