import { Router } from "express";
import { MedicinesController } from "./medicines.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, MedicinesController.listBatches);
router.post("/adjust", requireAuth, MedicinesController.adjustBatchStock);

export default router;
