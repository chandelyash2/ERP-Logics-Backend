import { Response, NextFunction, Router } from "express";
import prisma from "../../db/prisma.js";
import { AuthenticatedRequest } from "../../types/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { round2, getTodayDateString } from "../../utils/helpers.js";

export class ExpensesController {
  static async listExpenses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      const whereClause: any = companyId ? { companyId } : {};

      const expenses = await prisma.expense.findMany({
        where: whereClause,
        orderBy: { expenseDate: "desc" },
      });

      res.json(
        expenses.map((e) => ({
          id: e.id,
          expense_date: e.expenseDate,
          category: e.category,
          description: e.description,
          amount: e.amount,
          payment_method: e.paymentMethod,
          notes: e.notes,
          created_by: e.createdBy,
          created_at: e.createdAt.toISOString(),
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  static async createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
      const amount = round2(parseFloat(p.amount ?? 0));
      if (amount <= 0) {
        res.status(400).json({ detail: "Expense amount must be greater than 0" });
        return;
      }

      const expense = await prisma.expense.create({
        data: {
          companyId,
          expenseDate: p.expense_date || getTodayDateString(),
          category: p.category || "General",
          description: p.description || "",
          amount,
          paymentMethod: p.payment_method || "Cash",
          notes: p.notes || "",
          createdBy: req.user?.name || "Staff",
        },
      });

      res.status(201).json({
        id: expense.id,
        expense_date: expense.expenseDate,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        payment_method: expense.paymentMethod,
        notes: expense.notes,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exp_id } = req.params;
      await prisma.expense.delete({
        where: { id: exp_id },
      });
      res.json({ message: "Expense deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.get("/", requireAuth, ExpensesController.listExpenses);
router.post("/", requireAuth, ExpensesController.createExpense);
router.delete("/:exp_id", requireAuth, ExpensesController.deleteExpense);

export default router;
