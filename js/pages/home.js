import {
  buildBackdropUrl,
  buildImageUrl,
  findOfficialTrailer,
  getMovieDetails,
  getYear,
  hideLoader,
  loadGenresData,
  loadMovieRailData,
  PROFILE_FALLBACK,
  setApiStatus,
  state,
  tmdbFetch,
} from "../api.js";
import { bindCarouselControls, restartAllCarousels } from "../features/carousels.js";
import { mountLayout, bindSharedLayout } from "../features/layout.js";
import { userProfile, updateMovieList } from "../features/profile.js";
import { openMovieDetails, openTrailerModal, renderCollectionLoading, renderMovieCollection } from "../features/ui.js";

const renderGenres = async () => {
  const container = document.getElementById("genres-container");
  if (!container) return;
  try {
    const genres = await loadGenresData();
    container.innerHTML = `
      <a class="genre-chip is-active" href="./peliculas.html">Todos</a>
      ${genres.map((genre) => `<a class="genre-chip" href="./peliculas.html?genre=${genre.id}">${genre.name}</a>`).join("")}
    `;
  } catch {
    container.innerHTML = "";
  }
};

const renderHistorySection = () => {
  const section = document.getElementById("historySection");
  const grid = document.getElementById("historyGrid");
  if (!section || !grid) return;
  section.classList.toggle("hidden", userProfile.history.length === 0);
  if (userProfile.history.length) renderMovieCollection(grid, userProfile.history, { carouselId: "historyGrid" });
};

const loadTrailerRail = async (movies = []) => {
  const grid = document.getElementById("trailersGrid");
  renderCollectionLoading(grid);
  const trailerMovies = await Promise.all(
    movies.slice(0, 6).map(async (movie) => {
      try {
        const data = await tmdbFetch(`/movie/${movie.id}/videos`);
        const trailer = findOfficialTrailer(data.results || []);
        return trailer ? { ...movie, _trailerKey: trailer.key } : null;
      } catch {
        return null;
      }
    })
  );
  renderMovieCollection(grid, trailerMovies.filter(Boolean), { carouselId: "trailersGrid" });
};

const loadPopularActors = async () => {
  const grid = document.getElementById("actorsGrid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 8 })
    .map(() => `<article class="person-card skeleton-card"><div class="tmdb-skeleton-poster"></div></article>`)
    .join("");
  try {
    const data = await tmdbFetch("/person/popular", { page: 1 });
    grid.innerHTML = (data.results || [])
      .slice(0, 12)
      .map(
        (actor) => `
          <article class="person-card">
            <img src="${buildImageUrl(actor.profile_path, "w185", PROFILE_FALLBACK)}" alt="${actor.name}" loading="lazy" decoding="async" />
            <strong>${actor.name}</strong>
            <span>${(actor.known_for || []).map((item) => item.title || item.name).filter(Boolean).slice(0, 2).join(", ") || "Actor"}</span>
          </article>
        `
      )
      .join("");
  } catch {
    grid.innerHTML = `<div class="empty-state">No se pudieron cargar actores populares.</div>`;
  }
};

const renderFeaturedDots = () => {
  const dots = document.getElementById("featuredDots");
  if (!dots || !state.featuredMovies.length) return;
  dots.innerHTML = state.featuredMovies
    .map(
      (_, index) => `
        <button type="button" class="featured-dot ${index === state.featuredIndex ? "is-active" : ""}" data-featured-index="${index}" aria-label="Ver pelicula destacada ${index + 1}"></button>
      `
    )
    .join("");
};

const renderFeaturedMovie = async (index = state.featuredIndex) => {
  const backdrop = document.getElementById("featuredBackdrop");
  if (!backdrop || !state.featuredMovies.length) return;
  state.featuredIndex = (index + state.featuredMovies.length) % state.featuredMovies.length;
  const movie = state.featuredMovies[state.featuredIndex];
  document.getElementById("featuredInfo")?.classList.add("is-changing");

  try {
    const details = await getMovieDetails(movie.id);
    state.currentFeaturedDetails = details;
    const genres = Array.isArray(details.genres) ? details.genres.map((genre) => genre.name).slice(0, 3).join(", ") : "Cine";
    const rating = Number(details.vote_average || movie.vote_average || 0).toFixed(1);
    window.setTimeout(() => {
      backdrop.style.backgroundImage = `url("${buildBackdropUrl(details.backdrop_path || movie.backdrop_path)}")`;
      document.getElementById("featuredTitle").textContent = details.title || movie.title || "Pelicula destacada";
      document.getElementById("featuredYear").textContent = getYear(details.release_date || movie.release_date);
      document.getElementById("featuredRuntime").textContent = details.runtime ? `${details.runtime} min` : "-- min";
      document.getElementById("featuredGenres").textContent = genres || "Cine";
      document.getElementById("featuredRating").innerHTML = `&#11088; ${rating}`;
      document.getElementById("featuredOverview").textContent = details.overview || movie.overview || "Una seleccion destacada para descubrir en CineFlick.";
      document.getElementById("featuredPlayButton").dataset.movieId = movie.id;
      document.getElementById("featuredTrailerButton").dataset.movieId = movie.id;
      const favorite = document.getElementById("featuredFavoriteButton");
      if (favorite) favorite.dataset.movieId = movie.id;
      renderFeaturedDots();
      backdrop.classList.remove("is-changing");
      document.getElementById("featuredInfo")?.classList.remove("is-changing");
    }, 180);
  } catch {
    document.getElementById("featuredInfo")?.classList.remove("is-changing");
  }
};

const startFeaturedRotation = () => {
  if (!state.featuredMovies.length) return;
  window.clearInterval(state.featuredTimerId);
  state.featuredTimerId = window.setInterval(() => {
    if (!document.hidden) renderFeaturedMovie(state.featuredIndex + 1);
  }, 6000);
};

const loadFeaturedMovies = async () => {
  try {
    const [nowPlaying, popular] = await Promise.all([
      tmdbFetch("/movie/now_playing", { page: 1, region: "US" }),
      tmdbFetch("/movie/popular", { page: 1, region: "US" }),
    ]);
    const moviesById = new Map();
    [...(nowPlaying.results || []), ...(popular.results || [])]
      .filter((movie) => movie.backdrop_path && movie.title)
      .sort((a, b) => new Date(b.release_date || "1900-01-01") - new Date(a.release_date || "1900-01-01") || (b.popularity || 0) - (a.popularity || 0))
      .forEach((movie) => moviesById.set(movie.id, movie));
    state.featuredMovies = [...moviesById.values()].slice(0, 8);
    await renderFeaturedMovie(0);
    startFeaturedRotation();
  } catch {
    document.getElementById("featuredTitle").textContent = "CineFlick";
  }
};

const loadHomeSections = async () => {
  const grids = ["popularGrid", "trendingGrid", "upcomingGrid", "topRatedGrid"].map((id) => document.getElementById(id));
  grids.forEach((grid) => renderCollectionLoading(grid));
  const [popular, trending, upcoming, topRated] = await Promise.all([
    loadMovieRailData("/movie/popular"),
    loadMovieRailData("/trending/movie/week"),
    loadMovieRailData("/movie/upcoming"),
    loadMovieRailData("/movie/top_rated"),
  ]);

  renderMovieCollection(document.getElementById("popularGrid"), popular, { carouselId: "popularGrid" });
  renderMovieCollection(document.getElementById("trendingGrid"), trending, { carouselId: "trendingGrid" });
  renderMovieCollection(document.getElementById("upcomingGrid"), upcoming, { carouselId: "upcomingGrid" });
  renderMovieCollection(document.getElementById("topRatedGrid"), topRated, { carouselId: "topRatedGrid" });
  renderMovieCollection(document.getElementById("movies-grid"), trending, {
    countElement: document.getElementById("resultsCount"),
    carouselId: "movies-grid",
  });

  const recommendationSeed = userProfile.favorites[0]?.id || popular[0]?.id || trending[0]?.id;
  if (recommendationSeed) {
    const recommendations = await loadMovieRailData(`/movie/${recommendationSeed}/recommendations`);
    renderMovieCollection(document.getElementById("recommendedGrid"), recommendations, { carouselId: "recommendedGrid" });
  }
  const genreSeed = userProfile.favorites[0]?.genre_ids?.[0] || popular[0]?.genre_ids?.[0];
  if (genreSeed) {
    const genreMovies = await loadMovieRailData("/discover/movie", { with_genres: genreSeed, sort_by: "popularity.desc" });
    renderMovieCollection(document.getElementById("genreMoviesGrid"), genreMovies, { carouselId: "genreMoviesGrid" });
  }
  await Promise.all([loadTrailerRail(popular), loadPopularActors()]);
  renderHistorySection();
  restartAllCarousels();
};

const bindHero = () => {
  document.getElementById("featuredPrevButton")?.addEventListener("click", () => {
    renderFeaturedMovie(state.featuredIndex - 1);
    startFeaturedRotation();
  });
  document.getElementById("featuredNextButton")?.addEventListener("click", () => {
    renderFeaturedMovie(state.featuredIndex + 1);
    startFeaturedRotation();
  });
  document.getElementById("featuredDots")?.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-featured-index]");
    if (!dot) return;
    renderFeaturedMovie(Number(dot.dataset.featuredIndex));
    startFeaturedRotation();
  });
  document.getElementById("featuredPlayButton")?.addEventListener("click", () => {
    const movieId = document.getElementById("featuredPlayButton").dataset.movieId;
    if (movieId) location.href = `./detalle.html?id=${movieId}`;
  });
  document.getElementById("featuredTrailerButton")?.addEventListener("click", () => {
    const trailer = findOfficialTrailer(state.currentFeaturedDetails?.videos?.results || []);
    if (trailer) openTrailerModal(state.currentFeaturedDetails, trailer);
    else if (state.currentFeaturedDetails?.id) openMovieDetails(state.currentFeaturedDetails.id);
  });
  document.getElementById("featuredFavoriteButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.currentFeaturedDetails) updateMovieList("favorites", state.currentFeaturedDetails);
  });
  document.getElementById("heroTrendingButton")?.addEventListener("click", () => {
    location.href = "./tendencias.html";
  });
  document.getElementById("heroSection")?.addEventListener("mouseenter", () => window.clearInterval(state.featuredTimerId));
  document.getElementById("heroSection")?.addEventListener("mouseleave", startFeaturedRotation);
};

document.addEventListener("DOMContentLoaded", async () => {
  mountLayout();
  bindSharedLayout();
  bindCarouselControls();
  bindHero();
  try {
    await renderGenres();
    await Promise.all([loadFeaturedMovies(), loadHomeSections()]);
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    setApiStatus("Estado API TMDB: error");
  } finally {
    hideLoader();
  }
});
