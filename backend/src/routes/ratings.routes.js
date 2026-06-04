import { Router } from "express";

import { deleteRating, getMovieRatings, getRatings, saveRating } from "../controllers/ratings.controller.js";
import { optionalAuth, protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/:tmdb_id", optionalAuth, getMovieRatings);
router.get("/", protect, getRatings);
router.post("/", protect, saveRating);
router.delete("/:tmdb_id", protect, deleteRating);

export default router;
