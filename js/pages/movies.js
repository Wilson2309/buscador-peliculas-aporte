import {
  filterMoviesByYear,
  hideLoader,
  isValidYear,
  loadGenresData,
  loadMovieRailData,
  setApiStatus,
  sortMovies,
  tmdbFetch,
} from "../api.js";
import { bindCarouselControls, restartAllCarousels } from "../carousels.js";
import { bindSharedLayout, mountLayout } from "../layout.js";
import { renderCollectionLoading, renderMovieCollection } from "../ui.js";

const pageConfigs = {
  peliculas: {
    title: "Catalogo de peliculas",
    kicker: "Explora CineFlick",
    endpoint: "/movie/popular",
    grid: "movies-grid",
    count: "resultsCount",
  },
  tendencias: {
    title: "Tendencias de la semana",
    kicker: "Top semanal",
    endpoint: "/trending/movie/week",
    grid: "movies-grid",
    count: "resultsCount",
  },
  proximamente: {
    title: "Proximos estrenos",
    kicker: "Muy pronto",
    endpoint: "/movie/upcoming",
    grid: "movies-grid",
    count: "resultsCount",
  },
  "top-rated": {
    title: "Mejor calificadas",
    kicker: "Top Rated",
    endpoint: "/movie/top_rated",
    grid: "movies-grid",
    count: "resultsCount",
  },
};

const getPageType = () => document.body.dataset.page || "peliculas";
const getConfig = () => pageConfigs[getPageType()] || pageConfigs.peliculas;

const populateYearOptions = () => {
  const yearOptions = document.getElementById("yearOptions");
  if (!yearOptions) return;
  const currentYear = new Date().getFullYear() + 1;
  const years = [];
  for (let year = currentYear; year >= 1900; year -= 1) {
    years.push(`<option value="${year}"></option>`);
  }
  yearOptions.innerHTML = years.join("");
};

const getFilters = () => ({
  query: document.getElementById("filterSearchInput")?.value.trim() || "",
  genreId: document.getElementById("genreFilter")?.value || new URLSearchParams(location.search).get("genre") || "",
  year: document.getElementById("yearFilter")?.value.trim() || "",
  sortBy: document.getElementById("sortByFilter")?.value || "popularity.desc",
  rating: document.getElementById("ratingFilter")?.value || "",
});

const hasUsableFilters = () => {
  const filters = getFilters();
  return Boolean(filters.query || filters.genreId || filters.year || filters.rating || filters.sortBy !== "popularity.desc");
};

const updateFiltersAction = () => {
  const row = document.getElementById("filtersActionRow");
  if (!row) return;
  row.classList.toggle("hidden", !hasUsableFilters());
  row.classList.toggle("flex", hasUsableFilters());
};

const renderGenres = async () => {
  const genres = await loadGenresData();
  const chips = document.getElementById("genres-container");
  const select = document.getElementById("genreFilter");
  const activeGenre = new URLSearchParams(location.search).get("genre") || "";
  if (chips) {
    chips.innerHTML = `
      <button type="button" class="genre-chip ${!activeGenre ? "is-active" : ""}" data-genre-id="">Todos</button>
      ${genres
        .map(
          (genre) => `
            <button type="button" class="genre-chip ${String(genre.id) === activeGenre ? "is-active" : ""}" data-genre-id="${genre.id}">
              ${genre.name}
            </button>
          `
        )
        .join("")}
    `;
  }
  if (select) {
    select.innerHTML = `
      <option value="">Todos</option>
      ${genres.map((genre) => `<option value="${genre.id}">${genre.name}</option>`).join("")}
    `;
    select.value = activeGenre;
  }
};

const renderMovies = (movies = []) => {
  renderMovieCollection(document.getElementById("movies-grid"), movies, {
    countElement: document.getElementById("resultsCount"),
    carouselId: "movies-grid",
    emptyText: "No se encontraron peliculas con esos filtros",
  });
  restartAllCarousels();
};

const loadPageMovies = async () => {
  const config = getConfig();
  renderCollectionLoading(document.getElementById(config.grid));
  setApiStatus("Estado API TMDB: cargando");
  try {
    const params = {};
    const genre = new URLSearchParams(location.search).get("genre");
    const endpoint = genre ? "/discover/movie" : config.endpoint;
    if (genre) {
      params.with_genres = genre;
      params.sort_by = "popularity.desc";
    }
    const movies = await loadMovieRailData(endpoint, params);
    renderMovies(movies);
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    renderMovies([]);
    setApiStatus("Estado API TMDB: error");
  }
};

const applyAdvancedFilters = async () => {
  const filters = getFilters();
  const hint = document.getElementById("filtersHint");
  if (filters.query && filters.query.length < 3) {
    if (hint) hint.textContent = "Escribe al menos 3 caracteres para buscar por texto.";
    return;
  }
  if (filters.year && !isValidYear(filters.year)) {
    if (hint) hint.textContent = "Escribe un ano valido entre 1900 y 2026.";
    return;
  }

  renderCollectionLoading(document.getElementById("movies-grid"));
  setApiStatus("Estado API TMDB: buscando");

  try {
    let movies = [];
    if (filters.query) {
      const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(filters.query)}`, {
        page: 1,
        include_adult: "false",
        year: filters.year,
        primary_release_year: filters.year,
      });
      movies = data.results || [];
    } else {
      const data = await tmdbFetch("/discover/movie", {
        page: 1,
        include_adult: "false",
        sort_by: filters.sortBy,
        with_genres: filters.genreId,
        primary_release_year: filters.year,
        "primary_release_date.gte": isValidYear(filters.year) ? `${filters.year}-01-01` : "",
        "primary_release_date.lte": isValidYear(filters.year) ? `${filters.year}-12-31` : "",
        "vote_average.gte": filters.rating,
      });
      movies = data.results || [];
    }

    movies = filterMoviesByYear(movies, filters.year);
    if (filters.query && filters.genreId) {
      movies = movies.filter((movie) => Array.isArray(movie.genre_ids) && movie.genre_ids.includes(Number(filters.genreId)));
    }
    if (filters.query && filters.rating) {
      movies = movies.filter((movie) => Number(movie.vote_average || 0) >= Number(filters.rating));
    }
    renderMovies(sortMovies(movies, filters.sortBy));
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    renderMovies([]);
    setApiStatus("Estado API TMDB: error de busqueda");
  }
};

const bindFilters = () => {
  document.getElementById("filtersForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyAdvancedFilters();
  });
  document.getElementById("advancedSearchButton")?.addEventListener("click", applyAdvancedFilters);
  document.getElementById("filterSearchInput")?.addEventListener("input", updateFiltersAction);
  [document.getElementById("genreFilter"), document.getElementById("sortByFilter"), document.getElementById("ratingFilter")].forEach((control) => {
    control?.addEventListener("change", updateFiltersAction);
  });
  document.getElementById("yearFilter")?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    updateFiltersAction();
  });
  document.getElementById("clearFiltersButton")?.addEventListener("click", () => {
    ["filterSearchInput", "genreFilter", "yearFilter", "ratingFilter"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });
    const sort = document.getElementById("sortByFilter");
    if (sort) sort.value = "popularity.desc";
    updateFiltersAction();
    loadPageMovies();
  });
  document.getElementById("genres-container")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-genre-id]");
    if (!button) return;
    document.querySelectorAll(".genre-chip").forEach((chip) => chip.classList.toggle("is-active", chip === button));
    const select = document.getElementById("genreFilter");
    if (select) select.value = button.dataset.genreId || "";
    updateFiltersAction();
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  mountLayout();
  bindSharedLayout();
  bindCarouselControls();
  bindFilters();
  populateYearOptions();

  const config = getConfig();
  document.getElementById("pageKicker").textContent = config.kicker;
  document.getElementById("pageTitle").textContent = config.title;
  document.title = `CineFlick | ${config.title}`;

  try {
    await renderGenres();
    updateFiltersAction();
    await loadPageMovies();
  } finally {
    hideLoader();
  }
});
