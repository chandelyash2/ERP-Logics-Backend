import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/login", AuthController.login);
router.post("/register", AuthController.register);
router.get("/me", requireAuth, AuthController.me);
router.post("/logout", AuthController.logout);
router.post("/google", AuthController.googleLogin);

export default router;
