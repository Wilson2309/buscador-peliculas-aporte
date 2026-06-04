import { Router } from "express";

import { getProfile, updateProfile } from "../controllers/user.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

export default router;
