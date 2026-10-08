import { Request, Response, NextFunction, Router } from "express";
import { clearAllDemoData, seedComprehensiveData } from "./demoSeed.js";

export class DemoController {
  static async clear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clearAllDemoData();
      res.json({ message: "All transactional & inventory demo data cleared successfully. System is now pristine." });
    } catch (err) {
      next(err);
    }
  }

  static async seed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await seedComprehensiveData();
      res.json({ message: "Comprehensive pharmaceutical demo data seeded successfully with realistic batches, multi-GST rates, suppliers, chemist customers, and ledgers!" });
    } catch (err) {
      next(err);
    }
  }
}

const router = Router();
router.post("/clear", DemoController.clear);
router.post("/seed", DemoController.seed);

export default router;
