import { Router } from "express";

import { createReview, deleteReview, getMyReviews, getReviewsByMovie, updateReview } from "../controllers/reviews.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, getMyReviews);
router.get("/:tmdb_id", getReviewsByMovie);
router.post("/", protect, createReview);
router.put("/:id", protect, updateReview);
router.delete("/:id", protect, deleteReview);

export default router;
