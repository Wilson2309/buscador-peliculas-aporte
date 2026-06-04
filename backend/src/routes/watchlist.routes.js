import { Router } from "express";

import { addWatchlistItem, getWatchlist, removeWatchlistItem } from "../controllers/watchlist.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/", getWatchlist);
router.post("/", addWatchlistItem);
router.delete("/:tmdb_id", removeWatchlistItem);

export default router;
