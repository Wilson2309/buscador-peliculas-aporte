import { Router } from "express";

import { addHistoryItem, clearHistory, getHistory, removeHistoryItem } from "../controllers/history.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/", getHistory);
router.post("/", addHistoryItem);
router.delete("/", clearHistory);
router.delete("/:tmdb_id", removeHistoryItem);

export default router;
