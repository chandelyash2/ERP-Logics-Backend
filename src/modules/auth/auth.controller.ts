import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../../db/prisma.js";
import { AuthService } from "./auth.service.js";
import { AuthenticatedRequest } from "../../types/index.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "BUSINESS_OWNER", "STAFF", "ACCOUNTANT", "admin", "staff"]).optional(),
  companyName: z.string().optional(),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = LoginSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { company: true },
      });

      if (!user || !user.passwordHash) {
        res.status(401).json({ detail: "Invalid email or password" });
        return;
      }

      const isValid = await AuthService.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ detail: "Invalid email or password" });
        return;
      }

      const token = AuthService.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      });

      res.cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2 * 24 * 60 * 60 * 1000,
      });

      const permissions = {
        can_create_invoices: user.canCreateInvoices,
        can_view_inventory: user.canViewInventory,
        can_add_customers: user.canAddCustomers,
        can_add_suppliers: user.canAddSuppliers,
        can_record_payments: user.canRecordPayments,
        can_view_reports: user.canViewReports,
        can_edit_delete_records: user.canEditDeleteRecords,
        can_manage_settings: user.canManageSettings,
      };

      res.json({
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          companyId: user.companyId,
          company: user.company,
          permissions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = RegisterSchema.parse(req.body);
      const normalizedEmail = body.email.toLowerCase().trim();

      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        res.status(400).json({ detail: "Email already registered" });
        return;
      }

      // Map legacy role strings
      let userRole: "SUPER_ADMIN" | "BUSINESS_OWNER" | "STAFF" | "ACCOUNTANT" = "STAFF";
      if (body.role === "admin" || body.role === "BUSINESS_OWNER") {
        userRole = "BUSINESS_OWNER";
      } else if (body.role === "SUPER_ADMIN") {
        userRole = "SUPER_ADMIN";
      }

      // If business owner, create company if provided
      let companyId: string | null = null;
      if (body.companyName) {
        const company = await prisma.company.create({
          data: {
            name: body.companyName,
          },
        });
        companyId = company.id;
      }

      const passwordHash = await AuthService.hashPassword(body.password);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: body.name,
          passwordHash,
          role: userRole,
          companyId,
          canCreateInvoices: true,
          canViewInventory: true,
          canAddCustomers: true,
          canAddSuppliers: userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN",
          canRecordPayments: userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN",
          canViewReports: userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN",
          canEditDeleteRecords: userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN",
          canManageSettings: userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN",
        },
      });

      const token = AuthService.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      });

      res.status(201).json({
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          companyId: user.companyId,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ detail: "Authentication required" });
      return;
    }
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role.toLowerCase(),
      companyId: req.user.companyId,
      permissions: req.user.permissions,
    });
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie("access_token");
    res.json({ message: "Successfully logged out" });
  }

  static async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential } = req.body;
      if (!credential) {
        res.status(400).json({ detail: "Missing Google credential token" });
        return;
      }

      const payload = await AuthService.verifyGoogleIdToken(credential);
      if (!payload || !payload.email) {
        res.status(400).json({ detail: "Invalid Google token payload" });
        return;
      }

      const email = payload.email.toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: payload.name || "Google User",
            authProvider: "GOOGLE",
            role: "STAFF",
            canCreateInvoices: true,
            canViewInventory: true,
            canAddCustomers: true,
          },
          include: { company: true },
        });
      }

      const token = AuthService.createToken({
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      });

      res.json({
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.toLowerCase(),
          companyId: user.companyId,
          company: user.company,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
