import "dotenv/config";

import cors from "cors";
import express from "express";

import authRoutes from "./src/routes/auth.routes.js";
import favoritesRoutes from "./src/routes/favorites.routes.js";
import historyRoutes from "./src/routes/history.routes.js";
import ratingsRoutes from "./src/routes/ratings.routes.js";
import reviewsRoutes from "./src/routes/reviews.routes.js";
import tmdbRoutes from "./src/routes/tmdb.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import watchlistRoutes from "./src/routes/watchlist.routes.js";
import { errorHandler, notFoundHandler } from "./src/middleware/errorHandler.js";

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevelopment = process.env.NODE_ENV !== "production";
const isAllowedDevelopmentOrigin = (origin) => {
  if (!isDevelopment) return false;
  if (origin === "null") return true;

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      ["http:", "https:"].includes(protocol) &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        isAllowedDevelopmentOrigin(origin)
      ) {
        callback(null, true);
        return;
      }

      const error = new Error(`Origen no permitido por CORS: ${origin}`);
      error.status = 403;
      callback(error);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "CineFlick API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/tmdb", tmdbRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/ratings", ratingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`CineFlick backend running on http://localhost:${port}`);
});
