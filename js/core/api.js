import {
  tmdbGenres,
  tmdbMovie,
  tmdbNowPlaying,
  tmdbPopular,
  tmdbProxy,
  tmdbSearchMovie,
  tmdbSearchPerson,
  tmdbTopRated,
  tmdbTrending,
  tmdbUpcoming,
} from "./backendApi.js";

export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
export const POSTER_FALLBACK = "https://via.placeholder.com/500x750/141414/b3b3b3?text=Sin+poster";
export const PROFILE_FALLBACK = "https://via.placeholder.com/300x450/141414/b3b3b3?text=Sin+foto";
export const LANGUAGE = "es-ES";
export const INITIAL_RENDER_LIMIT = 14;
export const SEARCH_RENDER_LIMIT = 16;
export const RENDER_BATCH_SIZE = 10;

export const state = {
  genresById: new Map(),
  movieCache: new Map(),
  detailCache: new Map(),
  apiCache: new Map(),
  inFlightRequests: new Map(),
  renderedCollections: new Map(),
  searchController: null,
  featuredMovies: [],
  featuredIndex: 0,
  featuredTimerId: null,
  currentFeaturedDetails: null,
  currentModalMovie: null,
};

export const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const debounce = (callback, delay = 450) => {
  let timerId;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), delay);
  };
};

export const buildImageUrl = (path, size = "w342", fallback = POSTER_FALLBACK) =>
  path ? `${IMAGE_BASE_URL}/${size}${path}` : fallback;

export const buildBackdropUrl = (path, size = "w1280") => buildImageUrl(path, size, POSTER_FALLBACK);

export const getYear = (date = "") => (date ? date.slice(0, 4) : "S/F");

export const getRatingClass = (rating = 0) => {
  if (rating >= 7.5) return "rating-high";
  if (rating >= 6) return "rating-mid";
  return "rating-low";
};

export const getMovieSnapshot = (movie = {}) => ({
  id: movie.id,
  title: movie.title || movie.name || "Pelicula",
  poster_path: movie.poster_path || "",
  backdrop_path: movie.backdrop_path || "",
  release_date: movie.release_date || movie.first_air_date || "",
  vote_average: movie.vote_average || 0,
  genre_ids: movie.genre_ids || (movie.genres || []).map((genre) => genre.id).filter(Boolean),
  overview: movie.overview || "",
  popularity: movie.popularity || 0,
  _trailerKey: movie._trailerKey || "",
});

export const normalizeMovies = (movies = []) =>
  movies.filter((movie) => movie && movie.id && (movie.title || movie.name) && movie.poster_path);

export const getGenreNames = (movie = {}, limit = 2) => {
  const genreIds = movie.genre_ids || (movie.genres || []).map((genre) => genre.id);
  return (genreIds || [])
    .map((genreId) => state.genresById.get(Number(genreId)))
    .filter(Boolean)
    .slice(0, limit);
};

export const getMovieBadges = (movie = {}) => {
  const badges = ["Pelicula"];
  const year = Number(getYear(movie.release_date));
  const currentYear = new Date().getFullYear();
  if ((movie.popularity || 0) > 400) badges.push("Popular");
  if ((movie.vote_average || 0) >= 8) badges.push("Top Rated");
  if (year >= currentYear) badges.push("Estreno");
  return badges.slice(0, 3);
};

export const findOfficialTrailer = (videos = []) =>
  videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official) ||
  videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ||
  videos.find((video) => video.site === "YouTube");

export const formatRuntime = (minutes) => {
  if (!minutes) return "Duracion no disponible";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}min` : `${mins}min`;
};

export const setApiStatus = (message) => {
  const status = document.getElementById("apiStatus");
  if (status) status.textContent = message;
};

export const hideLoader = () => {
  const loader = document.getElementById("loaderOverlay");
  if (!loader) return;
  loader.classList.add("loader-exit");
  loader.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    loader.style.display = "none";
  }, 450);
};

export const tmdbFetch = async (endpoint, params = {}, { signal, cache = true } = {}) => {
  const [cleanEndpoint, inlineQuery = ""] = endpoint.split("?");
  const inlineParams = Object.fromEntries(new URLSearchParams(inlineQuery).entries());
  const requestParams = { ...inlineParams, ...params };
  const cacheKey = JSON.stringify({ endpoint: cleanEndpoint, params: requestParams });
  if (cache && state.apiCache.has(cacheKey)) return state.apiCache.get(cacheKey);
  if (cache && state.inFlightRequests.has(cacheKey)) return state.inFlightRequests.get(cacheKey);

  const request = fetchFromBackendTmdb(cleanEndpoint, requestParams, signal)
    .then((data) => {
      if (cache) state.apiCache.set(cacheKey, data);
      return data;
    })
    .finally(() => state.inFlightRequests.delete(cacheKey));

  if (cache) state.inFlightRequests.set(cacheKey, request);
  return request;
};

const fetchFromBackendTmdb = (endpoint, params = {}, signal) => {
  if (endpoint === "/genre/movie/list") return tmdbGenres(params);
  if (endpoint === "/movie/popular") return tmdbPopular(params);
  if (endpoint === "/movie/now_playing") return tmdbNowPlaying(params);
  if (endpoint === "/movie/upcoming") return tmdbUpcoming(params);
  if (endpoint === "/movie/top_rated") return tmdbTopRated(params);
  if (endpoint === "/trending/movie/week") return tmdbTrending(params);
  if (endpoint === "/search/movie") return tmdbSearchMovie(params.query, params);
  if (endpoint === "/search/person") return tmdbSearchPerson(params.query, params);

  const movieMatch = endpoint.match(/^\/movie\/(\d+)$/);
  if (movieMatch) return tmdbMovie(movieMatch[1], params);

  return tmdbProxy(endpoint, params);
};

export const getMovieDetails = async (movieId) => {
  const cacheKey = String(movieId);
  if (state.detailCache.has(cacheKey)) return state.detailCache.get(cacheKey);
  const details = await tmdbFetch(`/movie/${movieId}`, {
  });
  state.detailCache.set(cacheKey, details);
  return details;
};

export const loadGenresData = async () => {
  const data = await tmdbFetch("/genre/movie/list");
  const genres = Array.isArray(data.genres) ? data.genres : [];
  state.genresById = new Map(genres.map((genre) => [Number(genre.id), genre.name]));
  return genres;
};

export const loadMovieRailData = async (endpoint, params = {}) => {
  const data = await tmdbFetch(endpoint, { page: 1, ...params });
  return data.results || [];
};

export const mergeMovieResults = (...movieLists) => {
  const moviesById = new Map();
  movieLists.flat().forEach((movie) => {
    if (!movie?.id || movie.media_type === "tv") return;
    moviesById.set(movie.id, movie);
  });
  return [...moviesById.values()].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
};

export const findMoviesByActor = async (query, signal) => {
  const peopleData = await tmdbFetch(
    `/search/person?query=${encodeURIComponent(query)}`,
    { page: 1, include_adult: "false" },
    { signal }
  );
  const actors = (peopleData.results || [])
    .filter((person) => person.known_for_department === "Acting" || Array.isArray(person.known_for))
    .slice(0, 3);

  if (!actors.length) return [];

  const credits = await Promise.all(
    actors.map((actor) =>
      tmdbFetch(`/person/${actor.id}/movie_credits`, {}, { signal }).catch(() => ({
        cast: [],
      }))
    )
  );
  return credits.flatMap((credit) => credit.cast || []);
};

export const sortMovies = (movies, sortBy) => {
  const sorted = [...movies];
  const getDateTime = (movie) => new Date(movie.release_date || "1900-01-01").getTime();
  if (sortBy === "popularity.asc") return sorted.sort((a, b) => (a.popularity || 0) - (b.popularity || 0));
  if (sortBy === "release_date.desc") return sorted.sort((a, b) => getDateTime(b) - getDateTime(a));
  if (sortBy === "release_date.asc") return sorted.sort((a, b) => getDateTime(a) - getDateTime(b));
  return sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
};

export const isValidYear = (year) => /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2026;

export const filterMoviesByYear = (movies, year) => {
  if (!isValidYear(year)) return movies;
  return movies.filter((movie) => (movie.release_date || "").startsWith(year));
};
