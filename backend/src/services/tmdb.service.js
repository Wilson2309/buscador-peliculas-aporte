import { createHttpError } from "../middleware/errorHandler.js";

const tmdbBaseUrl = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const language = process.env.TMDB_LANGUAGE || "es-ES";
const region = process.env.TMDB_REGION || "US";

const allowedProxyPatterns = [
  /^\/discover\/movie$/,
  /^\/genre\/movie\/list$/,
  /^\/movie\/now_playing$/,
  /^\/movie\/popular$/,
  /^\/movie\/top_rated$/,
  /^\/movie\/upcoming$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/(videos|recommendations|similar|credits|reviews|watch\/providers)$/,
  /^\/person\/popular$/,
  /^\/person\/\d+\/movie_credits$/,
  /^\/search\/movie$/,
  /^\/search\/person$/,
  /^\/trending\/movie\/(day|week)$/,
];

const buildParams = (query = {}, defaults = {}) => {
  const params = new URLSearchParams({
    language,
    ...defaults,
  });

  Object.entries(query).forEach(([key, value]) => {
    if (key !== "api_key" && value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  params.set("api_key", process.env.TMDB_API_KEY || "");
  return params;
};

export const tmdbRequest = async (path, query = {}, defaults = {}) => {
  if (!process.env.TMDB_API_KEY) throw createHttpError(500, "TMDB_API_KEY no esta configurada");

  const url = `${tmdbBaseUrl}${path}?${buildParams(query, defaults).toString()}`;
  let response;

  try {
    response = await fetch(url);
  } catch {
    throw createHttpError(502, "No se pudo conectar con TMDB");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createHttpError(response.status, data.status_message || "Error consultando TMDB");
  }

  return data;
};

export const getGenres = (query) => tmdbRequest("/genre/movie/list", query);

export const getPopularMovies = (query) => tmdbRequest("/movie/popular", query, { page: "1", region });

export const getNowPlayingMovies = (query) => tmdbRequest("/movie/now_playing", query, { page: "1", region });

export const getUpcomingMovies = (query) => tmdbRequest("/movie/upcoming", query, { page: "1", region });

export const getTopRatedMovies = (query) => tmdbRequest("/movie/top_rated", query, { page: "1", region });

export const getTrendingMovies = (query) => tmdbRequest("/trending/movie/week", query, { page: "1", region });

export const getMovieDetails = (movieId, query) =>
  tmdbRequest(`/movie/${movieId}`, query, {
    append_to_response: "credits,videos,images,recommendations,similar,watch/providers,reviews,external_ids",
    include_image_language: "es,null,en",
  });

export const searchMovies = (query) => tmdbRequest("/search/movie", query, { page: "1", include_adult: "false" });

export const searchPeople = (query) => tmdbRequest("/search/person", query, { page: "1", include_adult: "false" });

export const proxyTmdbEndpoint = (rawEndpoint, requestQuery = {}) => {
  if (!rawEndpoint?.startsWith("/")) throw createHttpError(400, "endpoint valido es obligatorio");

  const parsed = new URL(rawEndpoint, tmdbBaseUrl);
  if (!allowedProxyPatterns.some((pattern) => pattern.test(parsed.pathname))) {
    throw createHttpError(403, "Endpoint TMDB no permitido");
  }

  const query = { ...Object.fromEntries(parsed.searchParams.entries()), ...requestQuery };
  delete query.endpoint;

  return tmdbRequest(parsed.pathname, query);
};
