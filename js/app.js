const TMDB_API_KEY = "8e11786c128b8cdf4151cae478d66741";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const POSTER_FALLBACK = "https://via.placeholder.com/500x750/141414/b3b3b3?text=Sin+poster";
const PROFILE_FALLBACK = "https://via.placeholder.com/300x450/141414/b3b3b3?text=Sin+foto";
const LANGUAGE = "es-ES";

const dom = {
  searchInput: document.getElementById("search-input"),
  genresContainer: document.getElementById("genres-container"),
  moviesGrid: document.getElementById("movies-grid"),
  movieModal: document.getElementById("movie-modal") || document.getElementById("movieModal"),
  modalContent: document.getElementById("modal-content"),
  closeModal: document.getElementById("close-modal"),
  resultsCount: document.getElementById("resultsCount"),
  apiStatus: document.getElementById("apiStatus"),
};

const state = {
  activeGenreId: null,
  searchController: null,
  movieCache: new Map(),
};

const hideLoader = () => {
  const loader = document.getElementById("loaderOverlay");
  if (!loader) return;
  loader.classList.add("loader-exit");
  loader.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    loader.style.display = "none";
  }, 450);
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const debounce = (callback, delay = 450) => {
  let timerId;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), delay);
  };
};

const buildImageUrl = (path, size = "w500", fallback = POSTER_FALLBACK) =>
  path ? `${IMAGE_BASE_URL}/${size}${path}` : fallback;

const getYear = (date = "") => (date ? date.slice(0, 4) : "S/F");

const getRatingClass = (rating = 0) => {
  if (rating >= 7.5) return "rating-high";
  if (rating >= 6) return "rating-mid";
  return "rating-low";
};

const setApiStatus = (message) => {
  if (dom.apiStatus) dom.apiStatus.textContent = message;
};

const setResultsCount = (count) => {
  if (dom.resultsCount) dom.resultsCount.textContent = `${count} resultados`;
};

const tmdbFetch = async (endpoint, params = {}, { signal } = {}) => {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`TMDB ${response.status}`);
  }
  return response.json();
};

const renderLoading = () => {
  if (!dom.moviesGrid) return;
  dom.moviesGrid.innerHTML = Array.from({ length: 8 })
    .map(
      () => `
        <article class="tmdb-card tmdb-card-skeleton">
          <div class="tmdb-skeleton-poster"></div>
          <div class="tmdb-skeleton-line"></div>
          <div class="tmdb-skeleton-line short"></div>
        </article>
      `
    )
    .join("");
};

const renderError = (message) => {
  if (!dom.moviesGrid) return;
  dom.moviesGrid.innerHTML = `
    <article class="error-card snap-start">
      <h3>Contenido no disponible</h3>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  setResultsCount(0);
};

const normalizeMovies = (movies = []) =>
  movies.filter((movie) => movie && movie.id && movie.title && movie.poster_path);

const renderMovies = (movies = []) => {
  if (!dom.moviesGrid) return;
  const cleanMovies = normalizeMovies(movies);
  setResultsCount(cleanMovies.length);

  if (cleanMovies.length === 0) {
    renderError("No encontramos peliculas para esta seleccion.");
    return;
  }

  const fragment = document.createDocumentFragment();

  cleanMovies.forEach((movie) => {
    state.movieCache.set(String(movie.id), movie);

    const rating = Number(movie.vote_average || 0).toFixed(1);
    const card = document.createElement("article");
    card.className = "tmdb-card";
    card.tabIndex = 0;
    card.dataset.movieId = movie.id;
    card.innerHTML = `
      <button type="button" class="tmdb-card-button" aria-label="Ver detalles de ${escapeHtml(movie.title)}">
        <div class="tmdb-poster-wrap">
          <img
            src="${buildImageUrl(movie.poster_path, "w500")}"
            alt="Poster de ${escapeHtml(movie.title)}"
            class="tmdb-poster"
            loading="lazy"
            decoding="async"
          />
          <span class="tmdb-rating ${getRatingClass(movie.vote_average)}">&#11088; ${rating}</span>
        </div>
        <div class="tmdb-card-body">
          <h3>${escapeHtml(movie.title)}</h3>
          <p>(${getYear(movie.release_date)})</p>
        </div>
      </button>
    `;
    fragment.appendChild(card);
  });

  dom.moviesGrid.replaceChildren(fragment);
};

const loadInitialMovies = async () => {
  renderLoading();
  setApiStatus("Estado API TMDB: cargando");

  try {
    const [popular, nowPlaying] = await Promise.all([
      tmdbFetch("/movie/popular", { page: 1, region: "US" }),
      tmdbFetch("/movie/now_playing", { page: 1, region: "US" }),
    ]);

    const moviesById = new Map();
    [...(popular.results || []), ...(nowPlaying.results || [])].forEach((movie) => {
      moviesById.set(movie.id, movie);
    });

    renderMovies([...moviesById.values()]);
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    renderError("No se pudo cargar el catalogo inicial.");
    setApiStatus("Estado API TMDB: error");
  }
};

const loadGenres = async () => {
  if (!dom.genresContainer) return;

  try {
    const data = await tmdbFetch("/genre/movie/list");
    const genres = Array.isArray(data.genres) ? data.genres : [];

    dom.genresContainer.innerHTML = `
      <button type="button" class="genre-chip is-active" data-genre-id="">Todos</button>
      ${genres
        .map(
          (genre) => `
            <button type="button" class="genre-chip" data-genre-id="${genre.id}">
              ${escapeHtml(genre.name)}
            </button>
          `
        )
        .join("")}
    `;
  } catch {
    dom.genresContainer.innerHTML = "";
  }
};

const filterByGenre = async (genreId) => {
  state.activeGenreId = genreId || null;
  renderLoading();
  setApiStatus("Estado API TMDB: filtrando");

  try {
    const data = await tmdbFetch("/discover/movie", {
      page: 1,
      sort_by: "popularity.desc",
      include_adult: "false",
      with_genres: state.activeGenreId,
    });
    renderMovies(data.results || []);
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    renderError("No se pudo filtrar por genero.");
    setApiStatus("Estado API TMDB: error en filtros");
  }
};

const searchMovies = async (query) => {
  const trimmedQuery = query.trim();

  if (state.searchController) {
    state.searchController.abort();
  }

  if (!trimmedQuery) {
    await loadInitialMovies();
    return;
  }

  if (trimmedQuery.length < 3) return;

  state.searchController = new AbortController();
  renderLoading();
  setApiStatus("Estado API TMDB: buscando");

  try {
    const data = await tmdbFetch(
      `/search/movie?query=${encodeURIComponent(trimmedQuery)}`,
      {
        page: 1,
        include_adult: "false",
      },
      { signal: state.searchController.signal }
    );

    renderMovies(data.results || []);
    setApiStatus("Estado API TMDB: conectado");
  } catch (error) {
    if (error.name === "AbortError") return;
    renderError("No se pudo completar la busqueda.");
    setApiStatus("Estado API TMDB: error de busqueda");
  }
};

const formatRuntime = (minutes) => {
  if (!minutes) return "Duracion no disponible";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}min` : `${mins}min`;
};

const renderModalLoading = () => {
  if (!dom.modalContent) return;
  dom.modalContent.innerHTML = `
    <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
    <div class="modal-loading">Cargando detalles...</div>
  `;
};

const renderMovieModal = (details, credits) => {
  if (!dom.modalContent) return;

  const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 5) : [];
  const year = getYear(details.release_date);
  const rating = Number(details.vote_average || 0).toFixed(1);
  const genres = Array.isArray(details.genres) ? details.genres.map((genre) => genre.name).join(", ") : "Sin generos";

  dom.modalContent.innerHTML = `
    <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
    <div class="tmdb-modal-layout">
      <img
        src="${buildImageUrl(details.poster_path, "w500")}"
        alt="Poster de ${escapeHtml(details.title)}"
        class="tmdb-modal-poster"
      />
      <div class="tmdb-modal-info">
        <div>
          <span class="tmdb-rating ${getRatingClass(details.vote_average)}">&#11088; ${rating}</span>
          <p class="tmdb-modal-meta">${year} · ${formatRuntime(details.runtime)} · ${escapeHtml(genres)}</p>
        </div>
        <h2>${escapeHtml(details.title)}</h2>
        <p class="tmdb-modal-overview">
          ${escapeHtml(details.overview || "Sinopsis no disponible en español.")}
        </p>
        <section>
          <h3>Reparto principal</h3>
          <div class="tmdb-cast-grid">
            ${cast
              .map(
                (actor) => `
                  <article class="tmdb-cast-card">
                    <img
                      src="${buildImageUrl(actor.profile_path, "w185", PROFILE_FALLBACK)}"
                      alt="Foto de ${escapeHtml(actor.name)}"
                      loading="lazy"
                    />
                    <strong>${escapeHtml(actor.name)}</strong>
                    <span>${escapeHtml(actor.character || "Personaje no disponible")}</span>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      </div>
    </div>
  `;
};

const openModal = () => {
  if (!dom.movieModal) return;
  dom.movieModal.classList.remove("modal-closed", "opacity-0", "pointer-events-none");
  dom.movieModal.classList.add("modal-open");
  dom.modalContent?.classList.remove("modal-panel-closed", "scale-95");
  dom.modalContent?.classList.add("modal-panel-open", "scale-100");
  dom.movieModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open-body");
};

const closeModal = () => {
  if (!dom.movieModal) return;
  dom.movieModal.classList.remove("modal-open");
  dom.movieModal.classList.add("modal-closed", "opacity-0", "pointer-events-none");
  dom.modalContent?.classList.remove("modal-panel-open", "scale-100");
  dom.modalContent?.classList.add("modal-panel-closed", "scale-95");
  dom.movieModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open-body");
};

const openMovieDetails = async (movieId) => {
  openModal();
  renderModalLoading();

  try {
    const [details, credits] = await Promise.all([
      tmdbFetch(`/movie/${movieId}`),
      tmdbFetch(`/movie/${movieId}/credits`),
    ]);
    renderMovieModal(details, credits);
  } catch {
    if (!dom.modalContent) return;
    dom.modalContent.innerHTML = `
      <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
      <div class="modal-loading">No se pudieron cargar los detalles.</div>
    `;
  }
};

const bindEvents = () => {
  dom.searchInput?.addEventListener(
    "input",
    debounce((event) => searchMovies(event.target.value), 400)
  );

  dom.genresContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-genre-id]");
    if (!button) return;

    dom.genresContainer.querySelectorAll(".genre-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip === button);
    });

    if (dom.searchInput) dom.searchInput.value = "";
    filterByGenre(button.dataset.genreId);
  });

  dom.moviesGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-movie-id]");
    if (!card) return;
    openMovieDetails(card.dataset.movieId);
  });

  dom.moviesGrid?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const card = event.target.closest("[data-movie-id]");
    if (!card) return;
    openMovieDetails(card.dataset.movieId);
  });

  dom.movieModal?.addEventListener("click", (event) => {
    if (event.target === dom.movieModal || event.target.closest("#close-modal")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
};

const initApp = async () => {
  try {
    if (!dom.moviesGrid) return;
    bindEvents();
    await Promise.all([loadGenres(), loadInitialMovies()]);
  } finally {
    hideLoader();
  }
};

document.addEventListener("DOMContentLoaded", initApp);
window.addEventListener("load", () => window.setTimeout(hideLoader, 900), { once: true });
