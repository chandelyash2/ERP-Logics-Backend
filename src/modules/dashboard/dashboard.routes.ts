import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class DashboardController {
  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const [
        totalMedicines,
        totalCustomers,
        totalSuppliers,
        batches,
        sales,
        purchases,
        payments,
        expenses,
      ] = await Promise.all([
        prisma.medicine.count({ where: whereClause }),
        prisma.customer.count({ where: whereClause }),
        prisma.supplier.count({ where: whereClause }),
        prisma.medicineBatch.findMany({ where: whereClause }),
        prisma.salesInvoice.findMany({ where: whereClause }),
        prisma.purchaseInvoice.findMany({ where: whereClause }),
        prisma.payment.findMany({ where: whereClause }),
        prisma.expense.findMany({ where: whereClause }),
      ]);

      const todayStr = getTodayDateString();
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      let expiredBatchesCount = 0;
      let expiringSoonBatchesCount = 0;
      let totalStockUnits = 0;
      let totalInventoryValuation = 0;

      const expiringBatchesList: any[] = [];

      for (const b of batches) {
        if (b.quantity > 0) {
          totalStockUnits += b.quantity;
          totalInventoryValuation += round2(b.quantity * b.purchaseRate);

          if (b.expiryDate < todayStr) {
            expiredBatchesCount++;
          } else if (b.expiryDate <= in30Days) {
            expiringSoonBatchesCount++;
            expiringBatchesList.push({
              id: b.id,
              medicine_name: b.medicineName,
              batch_number: b.batchNumber,
              expiry_date: b.expiryDate,
              quantity: b.quantity,
              mrp: b.mrp,
            });
          }
        }
      }

      let totalRevenue = 0;
      let totalTaxCollected = 0;
      let totalGrossProfit = 0;
      let totalReceivables = 0;

      for (const s of sales) {
        totalRevenue += s.grandTotal;
        totalTaxCollected += s.cgstTotal + s.sgstTotal + s.igstTotal;
        totalGrossProfit += s.grossProfit;
        totalReceivables += s.balanceDue;
      }

      let totalPayables = 0;
      for (const p of purchases) {
        totalPayables += p.balanceDue;
      }

      let totalExpenses = 0;
      for (const e of expenses) {
        totalExpenses += e.amount;
      }

      // Recent 5 sales
      const recentSales = await prisma.salesInvoice.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      // Low stock medicines
      const lowStockMedicines = await prisma.medicine.findMany({
        where: whereClause,
        include: { batches: true },
      });

      const lowStockAlerts = lowStockMedicines
        .map((m) => {
          const stock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
          return {
            id: m.id,
            name: m.name,
            brand: m.brand,
            category: m.category,
            current_stock: stock,
            min_stock_alert: m.minStockAlert,
          };
        })
        .filter((m) => m.current_stock <= m.min_stock_alert)
        .slice(0, 5);

      res.json({
        kpis: {
          total_revenue: round2(totalRevenue),
          total_tax_collected: round2(totalTaxCollected),
          gross_profit: round2(totalGrossProfit),
          net_profit: round2(totalGrossProfit - totalExpenses),
          total_receivables: round2(totalReceivables),
          total_payables: round2(totalPayables),
          inventory_valuation: round2(totalInventoryValuation),
          total_stock_units: totalStockUnits,
          total_medicines: totalMedicines,
          total_customers: totalCustomers,
          total_suppliers: totalSuppliers,
          expired_batches_count: expiredBatchesCount,
          expiring_soon_batches_count: expiringSoonBatchesCount,
        },
        recent_invoices: recentSales.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoiceNumber,
          customer_name: inv.customerName,
          invoice_date: inv.invoiceDate,
          grand_total: inv.grandTotal,
          balance_due: inv.balanceDue,
          payment_status: inv.paymentStatus,
        })),
        low_stock_alerts: lowStockAlerts,
        expiring_batches: expiringBatchesList.slice(0, 5),
      });
    } catch (err) {
      next(err);
    }
  }

  static async globalSearch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        res.json({ medicines: [], batches: [], customers: [], suppliers: [], sales: [] });
        return;
      }

      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const [medicines, batches, customers, suppliers, sales] = await Promise.all([
        prisma.medicine.findMany({
          where: {
            ...whereClause,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { genericName: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
        prisma.medicineBatch.findMany({
          where: {
            ...whereClause,
            OR: [
              { batchNumber: { contains: q, mode: "insensitive" } },
              { medicineName: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
        prisma.customer.findMany({
          where: {
            ...whereClause,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { businessName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
        prisma.supplier.findMany({
          where: {
            ...whereClause,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
        prisma.salesInvoice.findMany({
          where: {
            ...whereClause,
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
      ]);

      res.json({
        medicines: medicines.map((m) => ({ id: m.id, name: m.name, generic: m.genericName, brand: m.brand })),
        batches: batches.map((b) => ({ id: b.id, batch_number: b.batchNumber, medicine_name: b.medicineName, expiry: b.expiryDate, qty: b.quantity })),
        customers: customers.map((c) => ({ id: c.id, name: c.name, business: c.businessName, phone: c.phone })),
        suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, company: s.companyName, phone: s.phone })),
        sales: sales.map((s) => ({ id: s.id, invoice_number: s.invoiceNumber, customer_name: s.customerName, total: s.grandTotal })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async backupExport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const [
        company,
        medicines,
        batches,
        customers,
        suppliers,
        salesInvoices,
        purchaseInvoices,
        payments,
        expenses,
        stockLedger,
      ] = await Promise.all([
        prisma.company.findFirst(),
        prisma.medicine.findMany({ where: whereClause }),
        prisma.medicineBatch.findMany({ where: whereClause }),
        prisma.customer.findMany({ where: whereClause }),
        prisma.supplier.findMany({ where: whereClause }),
        prisma.salesInvoice.findMany({ where: whereClause }),
        prisma.purchaseInvoice.findMany({ where: whereClause }),
        prisma.payment.findMany({ where: whereClause }),
        prisma.expense.findMany({ where: whereClause }),
        prisma.stockLedger.findMany({ where: whereClause }),
      ]);

      res.json({
        export_timestamp: new Date().toISOString(),
        version: "2.0.0",
        company,
        medicines,
        batches,
        customers,
        suppliers,
        sales_invoices: salesInvoices,
        purchase_invoices: purchaseInvoices,
        payments,
        expenses,
        stock_ledger: stockLedger,
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/summary", requireAuth, DashboardController.getSummary);

export default router;
