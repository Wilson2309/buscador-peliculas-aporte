import {
  buildBackdropUrl,
  buildImageUrl,
  escapeHtml,
  findOfficialTrailer,
  formatRuntime,
  getGenreNames,
  getMovieBadges,
  getMovieDetails,
  getMovieSnapshot,
  getRatingClass,
  getYear,
  INITIAL_RENDER_LIMIT,
  normalizeMovies,
  PROFILE_FALLBACK,
  RENDER_BATCH_SIZE,
  SEARCH_RENDER_LIMIT,
  setApiStatus,
  state,
} from "./api.js";
import { observeCarousel, restartCarousel } from "./carousels.js";
import { addToHistory, isMovieInList, renderProfile, updateMovieList } from "./profile.js";
import { loadSocialSections } from "./social.js";

const getRenderKey = (container, carouselId) => carouselId || container?.id || `collection-${Date.now()}`;

export const createLoadMoreButton = (renderKey) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "load-more-card snap-start";
  button.dataset.loadMoreTarget = renderKey;
  button.innerHTML = "<strong>Ver mas</strong><span>Cargar mas peliculas</span>";
  return button;
};

export const createMovieCard = (movie) => {
  const snapshot = getMovieSnapshot(movie);
  state.movieCache.set(String(snapshot.id), snapshot);

  const rating = Number(snapshot.vote_average || 0).toFixed(1);
  const genres = getGenreNames(snapshot);
  const badges = getMovieBadges(snapshot);
  const isFavorite = isMovieInList("favorites", snapshot.id);
  const isWatchLater = isMovieInList("watchLater", snapshot.id);
  const card = document.createElement("article");
  card.className = "tmdb-card tmdb-card-enter";
  card.tabIndex = 0;
  card.dataset.movieId = snapshot.id;
  card.innerHTML = `
    <a class="tmdb-card-button tmdb-card-main" href="./detalle.html?id=${snapshot.id}" aria-label="Ver detalles de ${escapeHtml(snapshot.title)}">
      <div class="tmdb-poster-wrap">
        <img
          src="${buildImageUrl(snapshot.poster_path, "w342")}"
          alt="Poster de ${escapeHtml(snapshot.title)}"
          class="tmdb-poster"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />
        <div class="tmdb-card-badges">
          ${badges.map((badge) => `<span class="tmdb-card-badge">${escapeHtml(badge)}</span>`).join("")}
        </div>
        <span class="tmdb-rating-circle ${getRatingClass(snapshot.vote_average)}">${rating}</span>
        <p class="tmdb-card-overview">${escapeHtml(snapshot.overview || "Sinopsis no disponible.")}</p>
      </div>
      <div class="tmdb-card-body">
        <h3>${escapeHtml(snapshot.title)}</h3>
        <div class="tmdb-card-meta">
          <span>${getYear(snapshot.release_date)}</span>
          <span>TMDB ${rating}</span>
        </div>
        <div class="tmdb-card-genres">
          ${genres.map((genre) => `<span class="tmdb-card-genre">${escapeHtml(genre)}</span>`).join("")}
        </div>
      </div>
    </a>
    <div class="tmdb-card-actions">
      <button type="button" class="tmdb-icon-button ${isFavorite ? "is-active" : ""}" data-action="favorite" data-favorite-id="${snapshot.id}" aria-label="Favorito" data-tooltip="Favorito" aria-pressed="${isFavorite}">+</button>
      <button type="button" class="tmdb-icon-button ${isWatchLater ? "is-active" : ""}" data-action="watch-later" data-watchlist-id="${snapshot.id}" aria-label="Ver mas tarde" data-tooltip="Ver mas tarde" aria-pressed="${isWatchLater}">+</button>
      <button type="button" class="tmdb-icon-button" data-action="trailer" aria-label="Ver trailer" data-tooltip="Ver trailer">&#9654;</button>
    </div>
  `;
  return card;
};

const appendMovieCards = (fragment, movies = []) => {
  movies.forEach((movie) => fragment.appendChild(createMovieCard(movie)));
};

export const renderMovieBatch = (container, renderKey, startIndex = 0) => {
  const collection = state.renderedCollections.get(renderKey);
  if (!container || !collection) return;
  const nextMovies = collection.movies.slice(startIndex, startIndex + collection.batchSize);
  const fragment = document.createDocumentFragment();
  appendMovieCards(fragment, nextMovies);
  collection.renderedCount = startIndex + nextMovies.length;

  container.querySelector(`[data-load-more-target="${renderKey}"]`)?.remove();
  if (collection.renderedCount < collection.movies.length) fragment.appendChild(createLoadMoreButton(renderKey));
  container.appendChild(fragment);
  if (collection.carouselId) restartCarousel(collection.carouselId);
};

export const renderMovieCollection = (
  container,
  movies = [],
  { countElement, carouselId, initialLimit = INITIAL_RENDER_LIMIT, batchSize = RENDER_BATCH_SIZE, emptyText } = {}
) => {
  if (!container) return;
  const cleanMovies = normalizeMovies(movies);
  if (countElement) countElement.textContent = `${cleanMovies.length} resultados`;

  if (!cleanMovies.length) {
    container.innerHTML = `
      <article class="error-card snap-start">
        <h3>Sin resultados</h3>
        <p>${escapeHtml(emptyText || "No hay peliculas disponibles para esta seccion.")}</p>
      </article>
    `;
    return;
  }

  const renderKey = getRenderKey(container, carouselId);
  const firstCount = Math.min(initialLimit, cleanMovies.length);
  const fragment = document.createDocumentFragment();
  appendMovieCards(fragment, cleanMovies.slice(0, firstCount));
  if (firstCount < cleanMovies.length) fragment.appendChild(createLoadMoreButton(renderKey));

  state.renderedCollections.set(renderKey, {
    movies: cleanMovies,
    renderedCount: firstCount,
    batchSize,
    carouselId,
  });

  container.replaceChildren(fragment);
  if (carouselId) {
    observeCarousel(carouselId);
    restartCarousel(carouselId);
  }
};

export const renderCollectionLoading = (container, count = 8) => {
  if (!container) return;
  container.innerHTML = Array.from({ length: count })
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

export const renderSearchResults = (movies = []) => {
  const grid = document.getElementById("search-results-grid");
  const count = document.getElementById("searchResultsCount");
  const cleanMovies = normalizeMovies(movies);
  if (!grid) return;
  if (!cleanMovies.length) {
    grid.innerHTML = `
      <article class="search-empty-card">
        <h3>No se encontraron resultados para tu busqueda</h3>
        <p>Prueba con otro titulo o con el nombre de un actor.</p>
      </article>
    `;
    if (count) count.textContent = "0 resultados";
    return;
  }
  if (count) count.textContent = `${cleanMovies.length} resultados`;
  renderMovieCollection(grid, cleanMovies, { carouselId: "search-results-grid", initialLimit: SEARCH_RENDER_LIMIT });
};

export const renderSearchLoading = () => {
  const grid = document.getElementById("search-results-grid");
  const count = document.getElementById("searchResultsCount");
  renderCollectionLoading(grid, 6);
  if (count) count.textContent = "Buscando...";
};

export const renderSearchSuggestions = (results = []) => {
  const html = results
    .slice(0, 5)
    .map(
      (movie) => `
        <a class="search-suggestion" href="./detalle.html?id=${movie.id}" data-suggestion-id="${movie.id}">
          <img src="${buildImageUrl(movie.poster_path, "w185")}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" />
          <span>
            <strong>${escapeHtml(movie.title)}</strong>
            <span>${getYear(movie.release_date)} - ${Number(movie.vote_average || 0).toFixed(1)}</span>
          </span>
        </a>
      `
    )
    .join("");
  [document.getElementById("searchSuggestions"), document.getElementById("mobileSearchSuggestions")].forEach((container) => {
    if (!container) return;
    container.innerHTML = html;
    container.classList.toggle("hidden", !html);
  });
};

export const hideSearchSuggestions = () => {
  [document.getElementById("searchSuggestions"), document.getElementById("mobileSearchSuggestions")].forEach((container) => {
    if (!container) return;
    container.classList.add("hidden");
    container.innerHTML = "";
  });
};

export const openModal = () => {
  const modal = document.getElementById("movie-modal");
  const modalContent = document.getElementById("modal-content");
  if (!modal || !modalContent) return;
  modal.classList.remove("pointer-events-none", "opacity-0");
  modal.classList.add("modal-open");
  modal.setAttribute("aria-hidden", "false");
  modalContent.classList.remove("scale-95");
  modalContent.classList.add("scale-100");
  document.body.classList.add("modal-open-body");
};

export const closeModal = () => {
  const modal = document.getElementById("movie-modal");
  const modalContent = document.getElementById("modal-content");
  if (!modal || !modalContent) return;
  modal.classList.add("pointer-events-none", "opacity-0");
  modal.classList.remove("modal-open");
  modal.setAttribute("aria-hidden", "true");
  modalContent.classList.add("scale-95");
  modalContent.classList.remove("scale-100");
  document.body.classList.remove("modal-open-body");
};

export const renderModalLoading = () => {
  const modalContent = document.getElementById("modal-content");
  if (!modalContent) return;
  modalContent.innerHTML = `
    <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
    <div class="modal-loading">Cargando detalles...</div>
  `;
};

export const createSmallMovieLink = (movie) => `
  <a class="tmdb-card-button" href="./detalle.html?id=${movie.id}">
    <img class="tmdb-still" src="${buildImageUrl(movie.backdrop_path || movie.poster_path, "w342")}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" />
    <strong>${escapeHtml(movie.title)}</strong>
  </a>
`;

export const renderMovieDetailMarkup = (details) => {
  const cast = Array.isArray(details.credits?.cast) ? details.credits.cast.slice(0, 8) : [];
  const crew = Array.isArray(details.credits?.crew) ? details.credits.crew : [];
  const director = crew.find((person) => person.job === "Director")?.name || "No disponible";
  const writers =
    crew
      .filter((person) => ["Writer", "Screenplay", "Story"].includes(person.job))
      .map((person) => person.name)
      .filter((name, index, list) => list.indexOf(name) === index)
      .slice(0, 3)
      .join(", ") || "No disponible";
  const trailer = findOfficialTrailer(details.videos?.results || []);
  const stills = (details.images?.backdrops || []).slice(0, 6);
  const similar = normalizeMovies(details.similar?.results || []).slice(0, 6);
  const recommendations = normalizeMovies(details.recommendations?.results || []).slice(0, 6);
  const review = details.reviews?.results?.[0];
  const providers = details["watch/providers"]?.results?.US || details["watch/providers"]?.results?.EC;
  const imdbUrl = details.external_ids?.imdb_id ? `https://www.imdb.com/title/${details.external_ids.imdb_id}` : "";
  const year = getYear(details.release_date);
  const rating = Number(details.vote_average || 0).toFixed(1);
  const genres = Array.isArray(details.genres) ? details.genres.map((genre) => genre.name).join(", ") : "Sin generos";

  return `
    <div class="tmdb-modal-hero">
      <div class="tmdb-modal-backdrop" style="background-image:url('${buildBackdropUrl(details.backdrop_path)}')"></div>
      <div class="tmdb-modal-rich">
        <img src="${buildImageUrl(details.poster_path, "w500")}" alt="Poster de ${escapeHtml(details.title)}" class="tmdb-modal-poster" loading="lazy" decoding="async" />
        <div class="tmdb-modal-info">
          <div>
            <span class="tmdb-rating ${getRatingClass(details.vote_average)}">&#11088; ${rating}</span>
            <p class="tmdb-modal-meta">${year} - ${formatRuntime(details.runtime)} - ${escapeHtml(genres)}</p>
          </div>
          <h2>${escapeHtml(details.title)}</h2>
          <p class="tmdb-modal-overview">${escapeHtml(details.overview || "Sinopsis no disponible en espanol.")}</p>
          <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p><span class="text-cineGray">Director:</span> ${escapeHtml(director)}</p>
            <p><span class="text-cineGray">Guion:</span> ${escapeHtml(writers)}</p>
            <p><span class="text-cineGray">Plataformas:</span> ${escapeHtml((providers?.flatrate || providers?.rent || []).map((item) => item.provider_name).slice(0, 4).join(", ") || "Sin datos")}</p>
            <p>${imdbUrl ? `<a href="${imdbUrl}" target="_blank" rel="noreferrer" class="text-cineRed font-bold">Ver en IMDb</a>` : "<span class=\"text-cineGray\">IMDb no disponible</span>"}</p>
          </div>
          <div class="featured-actions">
            <button type="button" class="featured-play-button" data-action="favorite" data-favorite-id="${details.id}">${isMovieInList("favorites", details.id) ? "En favoritos" : "Agregar a favoritos"}</button>
            <button type="button" class="featured-secondary-button ${isMovieInList("watchLater", details.id) ? "is-active" : ""}" data-action="watch-later" data-watchlist-id="${details.id}" data-movie-id="${details.id}">${isMovieInList("watchLater", details.id) ? "En ver mas tarde" : "Ver mas tarde"}</button>
          </div>
        </div>
      </div>
    </div>
    ${trailer ? `<section class="tmdb-modal-section"><h3>Trailer oficial</h3><iframe class="tmdb-video-frame" src="https://www.youtube.com/embed/${trailer.key}" title="Trailer de ${escapeHtml(details.title)}" loading="lazy" allowfullscreen></iframe></section>` : ""}
    <section class="tmdb-modal-section">
      <h3>Reparto principal</h3>
      <div class="tmdb-cast-grid">
        ${cast
          .map(
            (actor) => `
              <article class="tmdb-cast-card">
                <img src="${buildImageUrl(actor.profile_path, "w185", PROFILE_FALLBACK)}" alt="Foto de ${escapeHtml(actor.name)}" loading="lazy" decoding="async" />
                <strong>${escapeHtml(actor.name)}</strong>
                <span>${escapeHtml(actor.character || "Personaje no disponible")}</span>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
    ${stills.length ? `<section class="tmdb-modal-section"><h3>Galeria</h3><div class="tmdb-inline-grid">${stills.map((image) => `<img class="tmdb-still" src="${buildImageUrl(image.file_path, "w780")}" alt="Imagen de ${escapeHtml(details.title)}" loading="lazy" decoding="async" />`).join("")}</div></section>` : ""}
    ${similar.length ? `<section class="tmdb-modal-section"><h3>Peliculas similares</h3><div class="tmdb-inline-grid">${similar.map((movie) => createSmallMovieLink(movie)).join("")}</div></section>` : ""}
    ${recommendations.length ? `<section class="tmdb-modal-section"><h3>Recomendaciones</h3><div class="tmdb-inline-grid">${recommendations.map((movie) => createSmallMovieLink(movie)).join("")}</div></section>` : ""}
    ${review ? `<section class="tmdb-modal-section"><h3>Review destacada</h3><article class="tmdb-review"><strong>${escapeHtml(review.author)}</strong><p>${escapeHtml((review.content || "").slice(0, 420))}${review.content?.length > 420 ? "..." : ""}</p></article></section>` : ""}
    <section class="tmdb-modal-section social-section" data-social-root data-movie-id="${details.id}">
      <div data-ratings-root><div class="social-skeleton">Cargando calificaciones...</div></div>
      <div data-reviews-root><div class="social-skeleton">Cargando opiniones...</div></div>
    </section>
  `;
};

export const renderMovieModal = (details) => {
  const modalContent = document.getElementById("modal-content");
  if (!modalContent) return;
  state.currentModalMovie = details;
  modalContent.innerHTML = `
    <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
    ${renderMovieDetailMarkup(details)}
  `;
  loadSocialSections(details, modalContent);
};

export const openMovieDetails = async (movieId) => {
  openModal();
  renderModalLoading();
  try {
    const details = await getMovieDetails(movieId);
    addToHistory(details);
    renderMovieModal(details);
  } catch {
    const modalContent = document.getElementById("modal-content");
    if (modalContent) modalContent.innerHTML = `<div class="modal-loading">No se pudieron cargar los detalles.</div>`;
    setApiStatus("Estado API TMDB: error de detalle");
  }
};

export const openTrailerModal = (movie, trailer) => {
  openModal();
  const modalContent = document.getElementById("modal-content");
  if (!modalContent) return;
  modalContent.innerHTML = `
    <button id="close-modal" type="button" class="modal-close-button" aria-label="Cerrar modal">&times;</button>
    <div class="tmdb-modal-section pt-12">
      <h2>${escapeHtml(movie.title || "Trailer")}</h2>
      <iframe class="tmdb-video-frame" src="https://www.youtube.com/embed/${trailer.key}" title="Trailer de ${escapeHtml(movie.title || "pelicula")}" loading="lazy" allowfullscreen></iframe>
    </div>
  `;
};

export const handleMovieInteraction = async (event) => {
  const actionButton = event.target.closest("[data-action]");
  const card = event.target.closest(".tmdb-card[data-movie-id]");
  const detailActionMovie = state.currentModalMovie || state.movieCache.get(String(actionButton?.dataset.favoriteId));

  if (actionButton && !card && detailActionMovie) {
    if (actionButton.dataset.action === "favorite") {
      const active = updateMovieList("favorites", detailActionMovie);
      actionButton.textContent = active ? "En favoritos" : "Agregar a favoritos";
      actionButton.classList.toggle("is-active", active);
    }
    if (actionButton.dataset.action === "watch-later") updateMovieList("watchLater", detailActionMovie);
    if (actionButton.dataset.action === "watch-later") {
      const active = isMovieInList("watchLater", detailActionMovie.id);
      actionButton.textContent = active ? "En ver mas tarde" : "Ver mas tarde";
      actionButton.classList.toggle("is-active", active);
    }
    renderProfile();
    return;
  }

  if (actionButton && card) {
    event.preventDefault();
    event.stopPropagation();
    const movie = state.movieCache.get(String(card.dataset.movieId));
    if (!movie) return;
    if (actionButton.dataset.action === "favorite") updateMovieList("favorites", movie);
    if (actionButton.dataset.action === "watch-later") updateMovieList("watchLater", movie);
    if (actionButton.dataset.action === "trailer") {
      const details = await getMovieDetails(movie.id);
      const trailer = findOfficialTrailer(details.videos?.results || []);
      if (trailer) openTrailerModal(details, trailer);
      else location.href = `./detalle.html?id=${movie.id}`;
    }
  }
};

export const bindMovieGridInteractions = () => {
  document.addEventListener("click", (event) => {
    const loadMoreButton = event.target.closest("[data-load-more-target]");
    if (loadMoreButton) {
      const collection = state.renderedCollections.get(loadMoreButton.dataset.loadMoreTarget);
      if (!collection) return;
      renderMovieBatch(loadMoreButton.parentElement, loadMoreButton.dataset.loadMoreTarget, collection.renderedCount);
      return;
    }
    if (event.target.closest("[data-action]")) handleMovieInteraction(event);
    if (event.target === document.getElementById("movie-modal") || event.target.closest("#close-modal")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
};
