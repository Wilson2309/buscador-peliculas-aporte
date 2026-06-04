import { query } from "../config/db.js";
import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";

const normalizeMoviePayload = (body) => {
  const tmdbId = Number(body.tmdb_id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw createHttpError(400, "tmdb_id valido es obligatorio");
  if (!body.title) throw createHttpError(400, "title es obligatorio");

  return {
    tmdb_id: tmdbId,
    title: String(body.title).trim(),
    poster_path: body.poster_path || null,
    backdrop_path: body.backdrop_path || null,
    vote_average: Number(body.vote_average || 0),
    release_date: body.release_date || null,
    media_type: body.media_type || "movie",
  };
};

export const getHistory = asyncHandler(async (req, res) => {
  const history = await query("SELECT * FROM history WHERE user_id = ? ORDER BY viewed_at DESC", [req.user.id]);
  res.json({ history });
});

export const addHistoryItem = asyncHandler(async (req, res) => {
  const movie = normalizeMoviePayload(req.body);
  await query(
    `INSERT INTO history
      (user_id, tmdb_id, title, poster_path, backdrop_path, vote_average, release_date, media_type, viewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      poster_path = VALUES(poster_path),
      backdrop_path = VALUES(backdrop_path),
      vote_average = VALUES(vote_average),
      release_date = VALUES(release_date),
      media_type = VALUES(media_type),
      viewed_at = CURRENT_TIMESTAMP`,
    [
      req.user.id,
      movie.tmdb_id,
      movie.title,
      movie.poster_path,
      movie.backdrop_path,
      movie.vote_average,
      movie.release_date,
      movie.media_type,
    ]
  );
  res.status(201).json({ message: "Historial actualizado" });
});

export const clearHistory = asyncHandler(async (req, res) => {
  await query("DELETE FROM history WHERE user_id = ?", [req.user.id]);
  res.json({ message: "Historial limpiado" });
});

export const removeHistoryItem = asyncHandler(async (req, res) => {
  await query("DELETE FROM history WHERE user_id = ? AND tmdb_id = ?", [req.user.id, req.params.tmdb_id]);
  res.json({ message: "Elemento eliminado del historial" });
});
