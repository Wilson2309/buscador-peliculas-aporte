import { createHttpError, asyncHandler } from "../middleware/errorHandler.js";
import {
  getGenres,
  getMovieDetails,
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getUpcomingMovies,
  proxyTmdbEndpoint,
  searchMovies,
  searchPeople,
} from "../services/tmdb.service.js";

export const getMovie = asyncHandler(async (req, res) => {
  const data = await getMovieDetails(req.params.id, req.query);
  res.json(data);
});

export const searchMovie = asyncHandler(async (req, res) => {
  if (!req.query.query) throw createHttpError(400, "query es obligatorio");
  const data = await searchMovies(req.query);
  res.json(data);
});

export const searchPerson = asyncHandler(async (req, res) => {
  if (!req.query.query) throw createHttpError(400, "query es obligatorio");
  const data = await searchPeople(req.query);
  res.json(data);
});

export const trending = asyncHandler(async (req, res) => {
  const data = await getTrendingMovies(req.query);
  res.json(data);
});

export const popular = asyncHandler(async (req, res) => {
  const data = await getPopularMovies(req.query);
  res.json(data);
});

export const nowPlaying = asyncHandler(async (req, res) => {
  const data = await getNowPlayingMovies(req.query);
  res.json(data);
});

export const upcoming = asyncHandler(async (req, res) => {
  const data = await getUpcomingMovies(req.query);
  res.json(data);
});

export const topRated = asyncHandler(async (req, res) => {
  const data = await getTopRatedMovies(req.query);
  res.json(data);
});

export const genres = asyncHandler(async (req, res) => {
  const data = await getGenres(req.query);
  res.json(data);
});

export const proxy = asyncHandler(async (req, res) => {
  const data = await proxyTmdbEndpoint(String(req.query.endpoint || ""), req.query);
  res.json(data);
});
