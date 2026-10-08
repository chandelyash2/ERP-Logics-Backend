import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import prisma from "./db/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import authRouter from "./modules/auth/auth.routes.js";
import usersRouter from "./modules/users/users.routes.js";
import companyRouter from "./modules/company/company.routes.js";
import medicinesRouter from "./modules/medicines/medicines.routes.js";
import batchesRouter from "./modules/medicines/batches.routes.js";
import customersRouter from "./modules/customers/customers.routes.js";
import suppliersRouter from "./modules/suppliers/suppliers.routes.js";
import purchasesRouter from "./modules/purchases/purchases.routes.js";
import salesRouter from "./modules/sales/sales.routes.js";
import paymentsRouter from "./modules/payments/payments.routes.js";
import returnsRouter from "./modules/returns/returns.routes.js";
import expensesRouter from "./modules/expenses/expenses.routes.js";
import stockLedgerRouter from "./modules/stock-ledger/stockLedger.routes.js";
import reportsRouter from "./modules/reports/reports.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";
import { DashboardController } from "./modules/dashboard/dashboard.routes.js";
import superadminRouter from "./modules/superadmin/superadmin.routes.js";
import demoRouter from "./modules/demo/demo.routes.js";
import { seedComprehensiveData } from "./modules/demo/demoSeed.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

// CORS configuration (allow all local dev origins)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or any localhost origin
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple cookie parsing helper
app.use((req: any, _res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie: string) => {
      const parts = cookie.split("=");
      const name = parts[0]?.trim();
      const val = parts[1]?.trim();
      if (name && val) {
        req.cookies[name] = decodeURIComponent(val);
      }
    });
  }
  next();
});

// API Routes mounting matching the frontend REST contract
const api = express.Router();

api.use("/auth", authRouter);
api.use("/users", usersRouter);
api.use("/settings", companyRouter);
api.use("/medicines", medicinesRouter);
api.use("/batches", batchesRouter);
api.use("/customers", customersRouter);
api.use("/suppliers", suppliersRouter);
api.use("/purchases", purchasesRouter);
api.use("/sales", salesRouter);
api.use("/payments", paymentsRouter);
api.use("/", returnsRouter); // Mounts /sales-returns and /purchase-returns
api.use("/expenses", expensesRouter);
api.use("/stock-ledger", stockLedgerRouter);
api.use("/reports", reportsRouter);
api.use("/dashboard", dashboardRouter);
api.get("/global-search", requireAuth, DashboardController.globalSearch);
api.get("/backup/export", requireAuth, DashboardController.backupExport);
api.use("/superadmin", superadminRouter);
api.use("/demo", demoRouter);

app.use("/api", api);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString(), service: "PharmaVanguard ERP Node API" });
});

// Centralized error handler
app.use(errorHandler);

// Startup logic
async function bootstrap() {
  try {
    const userCount = await prisma.user.count().catch(() => 0);
    if (userCount === 0) {
      console.log("Database empty. Seeding initial admin and demo data...");
      await seedComprehensiveData().catch((e) => console.warn("Auto-seed notice:", e.message));
    }

    app.listen(config.port, () => {
      console.log(`🚀 PharmaVanguard Node.js TypeScript ERP API running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();

export default app;
