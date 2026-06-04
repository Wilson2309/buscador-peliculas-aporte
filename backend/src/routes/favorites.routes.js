import { Router } from "express";

import { addFavorite, getFavorites, removeFavorite } from "../controllers/favorites.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/", getFavorites);
router.post("/", addFavorite);
router.delete("/:tmdb_id", removeFavorite);

export default router;
