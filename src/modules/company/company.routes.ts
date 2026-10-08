import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";

export class CompanyController {
  static async getSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;

      let company = companyId
        ? await prisma.company.findUnique({ where: { id: companyId } })
        : await prisma.company.findFirst();

      if (!company) {
        // Create default initial company if none exists
        company = await prisma.company.create({
          data: {
            name: "PharmaVanguard Wholesale Agency",
            legalName: "PharmaVanguard Healthcare & Distribution LLP",
            gstin: "27AAACC1206D1ZG",
            dlNumber: "MH-TZ1-20B-11920",
            phone: "+91 98200 99881",
            email: "contact@pharmavanguard.com",
            address: "Plot 42, Pharma Industrial Corridor, Andheri East",
            city: "Mumbai",
            state: "Maharashtra",
            stateCode: "27",
            pincode: "400093",
            invoicePrefix: "INV-2026-",
            purchasePrefix: "PUR-2026-",
          },
        });
      }

      res.json({
        id: company.id,
        business_name: company.name,
        legal_name: company.legalName,
        gstin: company.gstin,
        dl_number: company.dlNumber,
        phone: company.phone,
        email: company.email,
        address: company.address,
        city: company.city,
        state: company.state,
        state_code: company.stateCode,
        pincode: company.pincode,
        invoice_prefix: company.invoicePrefix,
        purchase_prefix: company.purchasePrefix,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const data = req.body;

      let company = companyId
        ? await prisma.company.findUnique({ where: { id: companyId } })
        : await prisma.company.findFirst();

      if (!company) {
        company = await prisma.company.create({
          data: {
            name: data.business_name || "PharmaVanguard Wholesale Agency",
            legalName: data.legal_name,
            gstin: data.gstin,
            dlNumber: data.dl_number,
            phone: data.phone,
            email: data.email,
            address: data.address,
            city: data.city || "Mumbai",
            state: data.state || "Maharashtra",
            stateCode: data.state_code || "27",
            pincode: data.pincode,
            invoicePrefix: data.invoice_prefix || "INV-2026-",
            purchasePrefix: data.purchase_prefix || "PUR-2026-",
          },
        });
      } else {
        company = await prisma.company.update({
          where: { id: company.id },
          data: {
            name: data.business_name ?? company.name,
            legalName: data.legal_name ?? company.legalName,
            gstin: data.gstin ?? company.gstin,
            dlNumber: data.dl_number ?? company.dlNumber,
            phone: data.phone ?? company.phone,
            email: data.email ?? company.email,
            address: data.address ?? company.address,
            city: data.city ?? company.city,
            state: data.state ?? company.state,
            stateCode: data.state_code ?? company.stateCode,
            pincode: data.pincode ?? company.pincode,
            invoicePrefix: data.invoice_prefix ?? company.invoicePrefix,
            purchasePrefix: data.purchase_prefix ?? company.purchasePrefix,
          },
        });
      }

      res.json({
        message: "Settings updated successfully",
        settings: {
          id: company.id,
          business_name: company.name,
          legal_name: company.legalName,
          gstin: company.gstin,
          dl_number: company.dlNumber,
          phone: company.phone,
          email: company.email,
          address: company.address,
          city: company.city,
          state: company.state,
          state_code: company.stateCode,
          pincode: company.pincode,
          invoice_prefix: company.invoicePrefix,
          purchase_prefix: company.purchasePrefix,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, CompanyController.getSettings);
router.put("/", requireAuth, CompanyController.updateSettings);

export default router;
