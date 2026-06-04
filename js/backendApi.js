const TOKEN_KEY = "cineflick.authToken";
const USER_KEY = "cineflick.authUser";
const LOCAL_API_BASE_URL = "http://localhost:3000/api";
const PRODUCTION_API_BASE_URL = "https://cineflick-wilson2309-api.onrender.com/api";

const getDefaultApiBaseUrl = () => {
  if (window.CINEFLICK_API_URL) return window.CINEFLICK_API_URL;

  const localHosts = new Set(["localhost", "127.0.0.1", ""]);
  return localHosts.has(window.location.hostname) ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL;
};

export const API_BASE_URL = getDefaultApiBaseUrl();

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.dispatchEvent(new CustomEvent("cineflick:auth-changed", { detail: { user: null } }));
};

export const isLoggedIn = () => Boolean(getToken());
export const hasAuthToken = isLoggedIn;

const setSession = ({ token, user } = {}) => {
  if (token) setToken(token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.dispatchEvent(new CustomEvent("cineflick:auth-changed", { detail: { user: user || getStoredUser() } }));
};

const buildUrl = (endpoint, params = {}) => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return url;
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const apiRequest = async (endpoint, { method = "GET", body, params, auth = true, signal } = {}) => {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(endpoint, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && auth) removeToken();
    const error = new Error(data.message || "Error conectando con CineFlick API");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

export const register = async ({ nombre, email, password }) => {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: { nombre, email, password },
    auth: false,
  });
  setSession(data);
  return data;
};
export const registerUser = (name, email, password) => register({ nombre: name, email, password });

export const login = async ({ email, password }) => {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setSession(data);
  return data;
};
export const loginUser = (email, password) => login({ email, password });

export const logout = () => removeToken();
export const logoutUser = logout;

export const me = () => apiRequest("/auth/me");
export const getCurrentUser = me;
export const getProfile = () => apiRequest("/user/profile");
export const updateProfile = (profile) => apiRequest("/user/profile", { method: "PUT", body: profile });

export const toBackendMoviePayload = (movie = {}) => ({
  tmdb_id: Number(movie.tmdb_id || movie.id),
  title: movie.title || movie.name || "Pelicula",
  poster_path: movie.poster_path || "",
  backdrop_path: movie.backdrop_path || "",
  vote_average: Number(movie.vote_average || 0),
  release_date: movie.release_date || movie.first_air_date || null,
  media_type: movie.media_type || "movie",
});

export const toLocalMovie = (movie = {}) => ({
  id: Number(movie.tmdb_id || movie.id),
  title: movie.title || movie.name || "Pelicula",
  poster_path: movie.poster_path || "",
  backdrop_path: movie.backdrop_path || "",
  vote_average: Number(movie.vote_average || 0),
  release_date: movie.release_date || movie.first_air_date || "",
  media_type: movie.media_type || "movie",
  savedAt: movie.viewed_at || movie.created_at || movie.updated_at || new Date().toISOString(),
});

export const getFavorites = () => apiRequest("/favorites");
export const addFavorite = (movie) => apiRequest("/favorites", { method: "POST", body: toBackendMoviePayload(movie) });
export const removeFavorite = (tmdbId) => apiRequest(`/favorites/${tmdbId}`, { method: "DELETE" });

export const getWatchlist = () => apiRequest("/watchlist");
export const addWatchlistItem = (movie) =>
  apiRequest("/watchlist", { method: "POST", body: toBackendMoviePayload(movie) });
export const removeWatchlistItem = (tmdbId) => apiRequest(`/watchlist/${tmdbId}`, { method: "DELETE" });

export const getHistory = () => apiRequest("/history");
export const addHistoryItem = (movie) => apiRequest("/history", { method: "POST", body: toBackendMoviePayload(movie) });
export const clearHistory = () => apiRequest("/history", { method: "DELETE" });
export const removeHistoryItem = (tmdbId) => apiRequest(`/history/${tmdbId}`, { method: "DELETE" });

export const getReviews = (tmdbId) => apiRequest(`/reviews/${tmdbId}`, { auth: false });
export const getMovieReviews = getReviews;
export const getMyReviews = () => apiRequest("/reviews");
export const createReview = (data) => apiRequest("/reviews", { method: "POST", body: data });
export const updateReview = (reviewId, data) => apiRequest(`/reviews/${reviewId}`, { method: "PUT", body: data });
export const deleteReview = (id) => apiRequest(`/reviews/${id}`, { method: "DELETE" });

export const getRatings = () => apiRequest("/ratings");
export const getMyRatings = getRatings;
export const getMovieRatings = (tmdbId) => apiRequest(`/ratings/${tmdbId}`);
export const saveRating = (data) => apiRequest("/ratings", { method: "POST", body: data });
export const deleteRating = (tmdbId) => apiRequest(`/ratings/${tmdbId}`, { method: "DELETE" });

export const tmdbMovie = (id, params = {}) => apiRequest(`/tmdb/movie/${id}`, { params, auth: false });
export const tmdbSearchMovie = (query, params = {}) =>
  apiRequest("/tmdb/search/movie", { params: { ...params, query }, auth: false });
export const tmdbSearchPerson = (query, params = {}) =>
  apiRequest("/tmdb/search/person", { params: { ...params, query }, auth: false });
export const tmdbTrending = (params = {}) => apiRequest("/tmdb/trending", { params, auth: false });
export const tmdbPopular = (params = {}) => apiRequest("/tmdb/popular", { params, auth: false });
export const tmdbNowPlaying = (params = {}) => apiRequest("/tmdb/now-playing", { params, auth: false });
export const tmdbUpcoming = (params = {}) => apiRequest("/tmdb/upcoming", { params, auth: false });
export const tmdbTopRated = (params = {}) => apiRequest("/tmdb/top-rated", { params, auth: false });
export const tmdbGenres = (params = {}) => apiRequest("/tmdb/genres", { params, auth: false });
export const tmdbProxy = (endpoint, params = {}) => apiRequest("/tmdb/proxy", { params: { ...params, endpoint }, auth: false });

export const getTmdbPopular = (page = 1) => tmdbPopular({ page });
export const getTmdbMovieDetails = (id) => tmdbMovie(id);
export const searchTmdbMovies = (query, page = 1) => tmdbSearchMovie(query, { page });
export const addWatchlist = addWatchlistItem;
export const removeWatchlist = removeWatchlistItem;
export const addHistory = addHistoryItem;

window.CineFlickBackend = {
  API_BASE_URL,
  apiRequest,
  getToken,
  setToken,
  removeToken,
  isLoggedIn,
  register,
  registerUser,
  login,
  loginUser,
  logout,
  logoutUser,
  me,
  getCurrentUser,
  getProfile,
  updateProfile,
  getFavorites,
  addFavorite,
  removeFavorite,
  getWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  getHistory,
  addHistoryItem,
  clearHistory,
  removeHistoryItem,
  getReviews,
  getMovieReviews,
  getMyReviews,
  createReview,
  updateReview,
  deleteReview,
  getRatings,
  getMovieRatings,
  getMyRatings,
  saveRating,
  deleteRating,
  toLocalMovie,
  getTmdbPopular,
  getTmdbMovieDetails,
  searchTmdbMovies,
  tmdbMovie,
  tmdbSearchMovie,
  tmdbSearchPerson,
  tmdbTrending,
  tmdbPopular,
  tmdbNowPlaying,
  tmdbUpcoming,
  tmdbTopRated,
  tmdbGenres,
  tmdbProxy,
  addWatchlist,
  removeWatchlist,
  addHistory,
};
