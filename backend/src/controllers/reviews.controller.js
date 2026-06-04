import { query } from "../config/db.js";
import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";

export const getReviewsByMovie = asyncHandler(async (req, res) => {
  const tmdbId = Number(req.params.tmdb_id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");

  const reviews = await query(
    `SELECT reviews.id, reviews.user_id, reviews.tmdb_id, reviews.title, reviews.content, reviews.created_at, reviews.updated_at,
      users.nombre, users.avatar_url
     FROM reviews
     INNER JOIN users ON users.id = reviews.user_id
     WHERE reviews.tmdb_id = ?
     ORDER BY reviews.created_at DESC`,
    [tmdbId]
  );
  res.json({ reviews });
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await query(
    `SELECT reviews.id, reviews.user_id, reviews.tmdb_id, reviews.title, reviews.content, reviews.created_at, reviews.updated_at,
      users.nombre, users.avatar_url
     FROM reviews
     INNER JOIN users ON users.id = reviews.user_id
     WHERE reviews.user_id = ?
     ORDER BY reviews.updated_at DESC`,
    [req.user.id]
  );
  res.json({ reviews });
});

export const createReview = asyncHandler(async (req, res) => {
  const tmdbId = Number(req.body.tmdb_id);
  const title = String(req.body.title || "").trim() || null;
  const content = String(req.body.content || "").trim();
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");
  if (!content) throw createHttpError(400, "content es obligatorio");

  await query(
    `INSERT INTO reviews (user_id, tmdb_id, title, content)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
    [req.user.id, tmdbId, title, content]
  );
  res.status(201).json({ message: "Review guardada" });
});

export const updateReview = asyncHandler(async (req, res) => {
  const content = String(req.body.content || "").trim();
  const title = req.body.title === undefined ? undefined : String(req.body.title || "").trim() || null;
  if (!content) throw createHttpError(400, "content es obligatorio");

  const result =
    title === undefined
      ? await query("UPDATE reviews SET content = ? WHERE id = ? AND user_id = ?", [content, req.params.id, req.user.id])
      : await query("UPDATE reviews SET title = ?, content = ? WHERE id = ? AND user_id = ?", [
          title,
          content,
          req.params.id,
          req.user.id,
        ]);
  if (result.affectedRows === 0) throw createHttpError(404, "Review no encontrada");

  res.json({ message: "Review actualizada" });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const result = await query("DELETE FROM reviews WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (result.affectedRows === 0) throw createHttpError(404, "Review no encontrada");
  res.json({ message: "Review eliminada" });
});
