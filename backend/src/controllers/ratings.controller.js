import { query } from "../config/db.js";
import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";

export const getRatings = asyncHandler(async (req, res) => {
  const ratings = await query("SELECT * FROM ratings WHERE user_id = ? ORDER BY updated_at DESC", [req.user.id]);
  res.json({ ratings });
});

export const getMovieRatings = asyncHandler(async (req, res) => {
  const tmdbId = Number(req.params.tmdb_id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");

  const summaryRows = await query(
    "SELECT ROUND(AVG(rating), 1) AS average_rating, COUNT(*) AS vote_count FROM ratings WHERE tmdb_id = ?",
    [tmdbId]
  );
  let userRating = null;
  if (req.user?.id) {
    const userRows = await query("SELECT rating FROM ratings WHERE user_id = ? AND tmdb_id = ?", [req.user.id, tmdbId]);
    userRating = userRows[0]?.rating ?? null;
  }

  res.json({
    tmdb_id: tmdbId,
    average_rating: summaryRows[0]?.average_rating ? Number(summaryRows[0].average_rating) : 0,
    vote_count: Number(summaryRows[0]?.vote_count || 0),
    user_rating: userRating === null ? null : Number(userRating),
  });
});

export const saveRating = asyncHandler(async (req, res) => {
  const tmdbId = Number(req.body.tmdb_id);
  const rating = Number(req.body.rating);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw createHttpError(400, "rating debe ser un numero entre 1 y 10");
  }

  await query(
    `INSERT INTO ratings (user_id, tmdb_id, rating)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
    [req.user.id, tmdbId, rating]
  );
  res.status(201).json({ message: "Calificacion guardada" });
});

export const deleteRating = asyncHandler(async (req, res) => {
  const tmdbId = Number(req.params.tmdb_id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");
  await query("DELETE FROM ratings WHERE user_id = ? AND tmdb_id = ?", [req.user.id, tmdbId]);
  res.json({ message: "Calificacion eliminada" });
});
