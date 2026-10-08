import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class ReportsController {
  static async getPnlReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { from_date, to_date } = req.query;

      const whereClause: any = companyId ? { companyId } : {};
      if (from_date || to_date) {
        whereClause.invoiceDate = {};
        if (from_date) whereClause.invoiceDate.gte = String(from_date);
        if (to_date) whereClause.invoiceDate.lte = String(to_date);
      }

      const sales = await prisma.salesInvoice.findMany({ where: whereClause });

      let totalSalesGross = 0;
      let totalSalesDiscount = 0;
      let totalTaxableSales = 0;
      let totalCgstCollected = 0;
      let totalSgstCollected = 0;
      let totalIgstCollected = 0;
      let totalCogs = 0;
      let totalGrossProfit = 0;

      for (const s of sales) {
        totalSalesGross += s.subtotal;
        totalSalesDiscount += s.invoiceDiscountAmount;
        totalTaxableSales += s.taxableValue;
        totalCgstCollected += s.cgstTotal;
        totalSgstCollected += s.sgstTotal;
        totalIgstCollected += s.igstTotal;
        totalCogs += s.totalPurchaseCost;
        totalGrossProfit += s.grossProfit;
      }

      const expenseWhere: any = companyId ? { companyId } : {};
      if (from_date || to_date) {
        expenseWhere.expenseDate = {};
        if (from_date) expenseWhere.expenseDate.gte = String(from_date);
        if (to_date) expenseWhere.expenseDate.lte = String(to_date);
      }

      const expenses = await prisma.expense.findMany({ where: expenseWhere });
      let totalExpenses = 0;
      const categoryBreakdown: Record<string, number> = {};

      for (const e of expenses) {
        totalExpenses += e.amount;
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      }

      const netProfit = round2(totalGrossProfit - totalExpenses);
      const grossMarginPercent = totalTaxableSales > 0 ? round2((totalGrossProfit / totalTaxableSales) * 100) : 0;
      const netMarginPercent = totalTaxableSales > 0 ? round2((netProfit / totalTaxableSales) * 100) : 0;

      res.json({
        period: {
          from_date: from_date || "All time",
          to_date: to_date || getTodayDateString(),
        },
        revenue: {
          gross_sales: round2(totalSalesGross),
          discounts_given: round2(totalSalesDiscount),
          taxable_sales_revenue: round2(totalTaxableSales),
          cgst_collected: round2(totalCgstCollected),
          sgst_collected: round2(totalSgstCollected),
          igst_collected: round2(totalIgstCollected),
          total_gst_collected: round2(totalCgstCollected + totalSgstCollected + totalIgstCollected),
          total_invoices_count: sales.length,
        },
        cost_of_goods_sold: {
          total_cogs: round2(totalCogs),
          gross_profit: round2(totalGrossProfit),
          gross_margin_percent: grossMarginPercent,
        },
        operating_expenses: {
          total_expenses: round2(totalExpenses),
          category_breakdown: Object.entries(categoryBreakdown).map(([cat, amt]) => ({
            category: cat,
            amount: round2(amt),
          })),
        },
        net_financials: {
          net_profit_before_tax: netProfit,
          net_profit_margin_percent: netMarginPercent,
          status: netProfit >= 0 ? "Profitable" : "Loss",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getGstSalesReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const { from_date, to_date } = req.query;

      const whereClause: any = companyId ? { companyId } : {};
      if (from_date || to_date) {
        whereClause.invoiceDate = {};
        if (from_date) whereClause.invoiceDate.gte = String(from_date);
        if (to_date) whereClause.invoiceDate.lte = String(to_date);
      }

      const sales = await prisma.salesInvoice.findMany({
        where: whereClause,
        orderBy: { invoiceDate: "desc" },
      });

      const rateBuckets: Record<string, any> = {
        "5%": { rate: 5.0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 },
        "12%": { rate: 12.0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 },
        "18%": { rate: 18.0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 },
        "28%": { rate: 28.0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 },
      };

      let grandTaxable = 0;
      let grandCgst = 0;
      let grandSgst = 0;
      let grandIgst = 0;
      let grandTotalTax = 0;

      const invoiceRows = sales.map((inv) => {
        grandTaxable += inv.taxableValue;
        grandCgst += inv.cgstTotal;
        grandSgst += inv.sgstTotal;
        grandIgst += inv.igstTotal;
        const totalTax = round2(inv.cgstTotal + inv.sgstTotal + inv.igstTotal);
        grandTotalTax += totalTax;

        const summary = Array.isArray(inv.gstSummary) ? inv.gstSummary : [];
        summary.forEach((s: any) => {
          const key = `${s.gst_rate}%`;
          if (!rateBuckets[key]) {
            rateBuckets[key] = { rate: s.gst_rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 };
          }
          rateBuckets[key].taxable = round2(rateBuckets[key].taxable + (s.taxable_value || 0));
          rateBuckets[key].cgst = round2(rateBuckets[key].cgst + (s.cgst || 0));
          rateBuckets[key].sgst = round2(rateBuckets[key].sgst + (s.sgst || 0));
          rateBuckets[key].igst = round2(rateBuckets[key].igst + (s.igst || 0));
          rateBuckets[key].total_tax = round2(rateBuckets[key].total_tax + (s.total_tax || 0));
        });

        return {
          invoice_number: inv.invoiceNumber,
          invoice_date: inv.invoiceDate,
          customer_name: inv.customerName,
          customer_gstin: inv.customerGstin || "Unregistered",
          place_of_supply: `${inv.customerState} (${inv.customerStateCode})`,
          is_interstate: inv.isInterstate,
          taxable_value: inv.taxableValue,
          cgst: inv.cgstTotal,
          sgst: inv.sgstTotal,
          igst: inv.igstTotal,
          total_tax: totalTax,
          invoice_total: inv.grandTotal,
        };
      });

      res.json({
        summary: {
          total_taxable: round2(grandTaxable),
          total_cgst: round2(grandCgst),
          total_sgst: round2(grandSgst),
          total_igst: round2(grandIgst),
          total_tax: round2(grandTotalTax),
          total_invoices: sales.length,
        },
        rate_wise_breakdown: Object.values(rateBuckets),
        invoices: invoiceRows,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStockValuation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const batches = await prisma.medicineBatch.findMany({
        where: {
          ...whereClause,
          quantity: { gt: 0 },
        },
        orderBy: [{ medicineName: "asc" }, { expiryDate: "asc" }],
      });

      let totalValuationCost = 0;
      let totalValuationMrp = 0;
      let totalValuationSale = 0;
      let totalUnits = 0;

      const items = batches.map((b) => {
        const costVal = round2(b.quantity * b.purchaseRate);
        const mrpVal = round2(b.quantity * b.mrp);
        const saleVal = round2(b.quantity * b.saleRate);

        totalValuationCost += costVal;
        totalValuationMrp += mrpVal;
        totalValuationSale += saleVal;
        totalUnits += b.quantity;

        return {
          batch_id: b.id,
          medicine_name: b.medicineName,
          generic_name: b.genericName,
          batch_number: b.batchNumber,
          expiry_date: b.expiryDate,
          quantity: b.quantity,
          purchase_rate: b.purchaseRate,
          mrp: b.mrp,
          sale_rate: b.saleRate,
          gst_rate: b.gstRate,
          cost_valuation: costVal,
          mrp_valuation: mrpVal,
          sale_valuation: saleVal,
        };
      });

      res.json({
        summary: {
          total_batches_count: batches.length,
          total_units_in_stock: totalUnits,
          total_purchase_cost_value: round2(totalValuationCost),
          total_mrp_value: round2(totalValuationMrp),
          total_sale_potential_value: round2(totalValuationSale),
          estimated_unrealized_profit: round2(totalValuationSale - totalValuationCost),
        },
        items,
      });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/pnl", requireAuth, ReportsController.getPnlReport);
router.get("/gst-sales", requireAuth, ReportsController.getGstSalesReport);
router.get("/stock-valuation", requireAuth, ReportsController.getStockValuation);

export default router;
