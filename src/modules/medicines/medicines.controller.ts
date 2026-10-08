import { Response, NextFunction } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class MedicinesController {
  static async listMedicines(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search).trim() : "";
      const category = req.query.category ? String(req.query.category).trim() : "";
      const companyId = req.user?.companyId;

      const whereClause: any = companyId ? { companyId } : {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { genericName: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { hsnCode: { contains: search, mode: "insensitive" } },
        ];
      }

      if (category) {
        whereClause.category = category;
      }

      const medicines = await prisma.medicine.findMany({
        where: whereClause,
        include: { batches: true },
        orderBy: { name: "asc" },
      });

      const todayStr = getTodayDateString();

      const result = medicines.map((m) => {
        let totalQty = 0;
        let activeBatchesCount = 0;
        let expiredBatchesCount = 0;

        m.batches.forEach((b) => {
          totalQty += b.quantity;
          if (b.quantity > 0) {
            if (b.expiryDate < todayStr) {
              expiredBatchesCount++;
            } else {
              activeBatchesCount++;
            }
          }
        });

        return {
          id: m.id,
          name: m.name,
          generic_name: m.genericName,
          brand: m.brand,
          category: m.category,
          hsn_code: m.hsnCode,
          gst_rate: m.gstRate,
          unit: m.unit,
          pack_size: m.packSize,
          rack_location: m.rackLocation,
          min_stock_alert: m.minStockAlert,
          purchase_rate: m.purchaseRate,
          sale_rate: m.saleRate,
          wholesale_rate: m.wholesaleRate,
          mrp: m.mrp,
          discount_percent: m.discountPercent,
          total_stock: totalQty,
          active_batches_count: activeBatchesCount,
          expired_batches_count: expiredBatchesCount,
          is_low_stock: totalQty <= m.minStockAlert,
          batches: m.batches.map((b) => ({
            id: b.id,
            medicine_id: b.medicineId,
            medicine_name: b.medicineName,
            generic_name: b.genericName,
            hsn_code: b.hsnCode,
            batch_number: b.batchNumber,
            mfg_date: b.mfgDate,
            expiry_date: b.expiryDate,
            purchase_rate: b.purchaseRate,
            mrp: b.mrp,
            sale_rate: b.saleRate,
            gst_rate: b.gstRate,
            quantity: b.quantity,
            free_quantity: b.freeQuantity,
            supplier_id: b.supplierId,
            supplier_name: b.supplierName,
          })),
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createMedicine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let companyId = req.user?.companyId;
      if (!companyId) {
        const company = await prisma.company.findFirst();
        companyId = company ? company.id : undefined;
      }

      if (!companyId) {
        res.status(400).json({ detail: "No company associated with user" });
        return;
      }

      const p = req.body;
      const medicine = await prisma.medicine.create({
        data: {
          companyId,
          name: p.name,
          genericName: p.generic_name || "",
          brand: p.brand || "",
          category: p.category || "General",
          hsnCode: p.hsn_code || "30049060",
          gstRate: parseFloat(p.gst_rate ?? 12),
          unit: p.unit || "Box",
          packSize: p.pack_size || "10x10",
          rackLocation: p.rack_location || "",
          minStockAlert: parseInt(p.min_stock_alert ?? 10, 10),
          purchaseRate: parseFloat(p.purchase_rate ?? 0),
          saleRate: parseFloat(p.sale_rate ?? 0),
          wholesaleRate: parseFloat(p.wholesale_rate ?? 0),
          mrp: parseFloat(p.mrp ?? 0),
          discountPercent: parseFloat(p.discount_percent ?? 0),
        },
      });

      res.status(201).json({
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.genericName,
        brand: medicine.brand,
        category: medicine.category,
        hsn_code: medicine.hsnCode,
        gst_rate: medicine.gstRate,
        unit: medicine.unit,
        pack_size: medicine.packSize,
        rack_location: medicine.rackLocation,
        min_stock_alert: medicine.minStockAlert,
        purchase_rate: medicine.purchaseRate,
        sale_rate: medicine.saleRate,
        wholesale_rate: medicine.wholesaleRate,
        mrp: medicine.mrp,
        discount_percent: medicine.discountPercent,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateMedicine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { med_id } = req.params;
      const p = req.body;

      const medicine = await prisma.medicine.update({
        where: { id: med_id },
        data: {
          name: p.name,
          genericName: p.generic_name,
          brand: p.brand,
          category: p.category,
          hsnCode: p.hsn_code,
          gstRate: p.gst_rate !== undefined ? parseFloat(p.gst_rate) : undefined,
          unit: p.unit,
          packSize: p.pack_size,
          rackLocation: p.rack_location,
          minStockAlert: p.min_stock_alert !== undefined ? parseInt(p.min_stock_alert, 10) : undefined,
          purchaseRate: p.purchase_rate !== undefined ? parseFloat(p.purchase_rate) : undefined,
          saleRate: p.sale_rate !== undefined ? parseFloat(p.sale_rate) : undefined,
          wholesaleRate: p.wholesale_rate !== undefined ? parseFloat(p.wholesale_rate) : undefined,
          mrp: p.mrp !== undefined ? parseFloat(p.mrp) : undefined,
          discountPercent: p.discount_percent !== undefined ? parseFloat(p.discount_percent) : undefined,
        },
      });

      res.json({
        id: medicine.id,
        name: medicine.name,
        generic_name: medicine.genericName,
        brand: medicine.brand,
        category: medicine.category,
        hsn_code: medicine.hsnCode,
        gst_rate: medicine.gstRate,
        unit: medicine.unit,
        pack_size: medicine.packSize,
        rack_location: medicine.rackLocation,
        min_stock_alert: medicine.minStockAlert,
        purchase_rate: medicine.purchaseRate,
        sale_rate: medicine.saleRate,
        wholesale_rate: medicine.wholesaleRate,
        mrp: medicine.mrp,
        discount_percent: medicine.discountPercent,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteMedicine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { med_id } = req.params;
      await prisma.medicine.delete({
        where: { id: med_id },
      });
      res.json({ message: "Medicine and related batches deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async listBatches(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search ? String(req.query.search).trim() : "";
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      if (search) {
        whereClause.OR = [
          { batchNumber: { contains: search, mode: "insensitive" } },
          { medicineName: { contains: search, mode: "insensitive" } },
        ];
      }

      const batches = await prisma.medicineBatch.findMany({
        where: whereClause,
        orderBy: [{ expiryDate: "asc" }, { batchNumber: "asc" }],
      });

      const todayStr = getTodayDateString();

      res.json(
        batches.map((b) => ({
          id: b.id,
          medicine_id: b.medicineId,
          medicine_name: b.medicineName,
          generic_name: b.genericName,
          hsn_code: b.hsnCode,
          batch_number: b.batchNumber,
          mfg_date: b.mfgDate,
          expiry_date: b.expiryDate,
          purchase_rate: b.purchaseRate,
          mrp: b.mrp,
          sale_rate: b.saleRate,
          gst_rate: b.gstRate,
          quantity: b.quantity,
          free_quantity: b.freeQuantity,
          supplier_id: b.supplierId,
          supplier_name: b.supplierName,
          is_expired: b.expiryDate < todayStr,
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async getFefoBatches(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { med_id } = req.params;
      const todayStr = getTodayDateString();

      const batches = await prisma.medicineBatch.findMany({
        where: {
          medicineId: med_id,
          quantity: { gt: 0 },
        },
        orderBy: { expiryDate: "asc" },
      });

      res.json(
        batches.map((b) => ({
          id: b.id,
          medicine_id: b.medicineId,
          medicine_name: b.medicineName,
          generic_name: b.genericName,
          hsn_code: b.hsnCode,
          batch_number: b.batchNumber,
          mfg_date: b.mfgDate,
          expiry_date: b.expiryDate,
          purchase_rate: b.purchaseRate,
          mrp: b.mrp,
          sale_rate: b.saleRate,
          gst_rate: b.gstRate,
          quantity: b.quantity,
          free_quantity: b.freeQuantity,
          supplier_id: b.supplierId,
          supplier_name: b.supplierName,
          is_expired: b.expiryDate < todayStr,
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async adjustBatchStock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batch_id, new_quantity, reason } = req.body;

      if (!batch_id || new_quantity === undefined) {
        res.status(400).json({ detail: "batch_id and new_quantity are required" });
        return;
      }

      const targetQty = round2(parseFloat(new_quantity));
      if (targetQty < 0) {
        res.status(400).json({ detail: "Quantity cannot be negative" });
        return;
      }

      const batch = await prisma.medicineBatch.findUnique({
        where: { id: batch_id },
      });

      if (!batch) {
        res.status(404).json({ detail: "Batch not found" });
        return;
      }

      const oldQty = round2(batch.quantity);
      const diff = round2(targetQty - oldQty);

      if (diff === 0) {
        res.json({ message: "Stock is already at requested level", batch_id, quantity: targetQty });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.medicineBatch.update({
          where: { id: batch_id },
          data: { quantity: targetQty },
        });

        await tx.stockLedger.create({
          data: {
            companyId: batch.companyId,
            date: getTodayDateString(),
            movementType: "Stock Adjustment",
            referenceId: batch_id,
            referenceInvoiceNo: "ADJUSTMENT",
            medicineId: batch.medicineId,
            medicineName: batch.medicineName,
            batchId: batch_id,
            batchNumber: batch.batchNumber,
            qtyIn: diff > 0 ? diff : 0,
            qtyOut: diff < 0 ? Math.abs(diff) : 0,
            balanceAfter: targetQty,
            notes: reason || `Manual stock adjustment from ${oldQty} to ${targetQty}`,
          },
        });
      });

      res.json({
        message: `Batch stock successfully adjusted to ${targetQty}`,
        batch_id,
        old_quantity: oldQty,
        new_quantity: targetQty,
        difference: diff,
      });
    } catch (err) {
      next(err);
    }
  }
}
