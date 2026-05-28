const API_KEY = "8e11786c128b8cdf4151cae478d66741";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const PLACEHOLDER_POSTER = "https://via.placeholder.com/500x750/141414/b3b3b3?text=Sin+poster";

const debounce = (fn, delay = 350) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (dateString) => {
  if (!dateString) return "Fecha desconocida";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
};

const getPosterUrl = (path) => (path ? `${IMAGE_BASE_URL}${path}` : PLACEHOLDER_POSTER);

const initCinematicAnimations = () => {
  const heroSection = document.getElementById("heroSection");
  const heroContent = heroSection?.querySelector(".max-w-2xl");
  const mainNavbar = document.getElementById("mainNavbar");
  const loaderOverlay = document.getElementById("loaderOverlay");
  const loaderSpinner = loaderOverlay?.querySelector(".h-14");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (heroContent) heroContent.classList.add("hero-content");
  if (heroSection) heroSection.classList.add("hero-loaded");

  document.querySelectorAll("main > section, footer").forEach((section, index) => {
    section.classList.add("page-section", "section-anchor", "reveal", "is-visible");
    if (index % 3 === 1) section.classList.add("reveal-left");
    if (index % 3 === 2) section.classList.add("reveal-right");
    if (reducedMotion) return;
  });

  if (!reducedMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal, .page-section").forEach((el) => revealObserver.observe(el));
  }

  let scrollTicking = false;
  const onScroll = () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        if (heroSection && !reducedMotion) {
          const offset = Math.min(window.scrollY * 0.35, 160);
          heroSection.style.setProperty("--hero-parallax", `${offset}px`);
          heroSection.style.setProperty("--hero-scale", `${1.08 + offset * 0.00015}`);
        }
        mainNavbar?.classList.toggle("navbar-scrolled", window.scrollY > 20);
        scrollTicking = false;
      });
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document
    .querySelectorAll("button, a.rounded-full, .carousel-arrow, #searchButton, #heroExploreButton, #heroTrendingButton")
    .forEach((btn) => btn.classList.add("btn-cinematic"));

  if (loaderSpinner) {
    loaderSpinner.classList.remove(
      "h-14",
      "w-14",
      "rounded-full",
      "border-4",
      "border-cineGray/20",
      "border-t-cineRed",
      "animate-spinSlow"
    );
    loaderSpinner.classList.add("loader-ring");
  }

  let loaderHidden = false;
  const hideLoader = () => {
    if (!loaderOverlay || loaderHidden) return;
    loaderHidden = true;
    loaderOverlay.classList.add("loader-exit");
    loaderOverlay.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      loaderOverlay.style.display = "none";
    }, 600);
  };

  setTimeout(hideLoader, 800);
  window.addEventListener("load", () => hideLoader(), { once: true });
};

window.addEventListener("DOMContentLoaded", () => {
  try {
    initCinematicAnimations();
  } catch (error) {
    console.error("Error en animaciones:", error);
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = "none";
  }

  const state = {
    movieCache: new Map(),
    apiCache: new Map(),
    detailsCache: new Map(),
    searchAbort: null,
  };

  const els = {
    loaderOverlay: document.getElementById("loaderOverlay"),
    mainNavbar: document.getElementById("mainNavbar"),
    mobileMenuButton: document.getElementById("mobileMenuButton"),
    mobileMenu: document.getElementById("mobileMenu"),
    movieModal: document.getElementById("movieModal"),
    movieModalPanel: document.getElementById("movieModalPanel"),
    closeModalButton: document.getElementById("closeModalButton"),
    searchInput: document.getElementById("searchInput"),
    mobileSearchInput: document.getElementById("mobileSearchInput"),
    searchButton: document.getElementById("searchButton"),
    mobileSearchButton: document.getElementById("mobileSearchButton"),
    trendingGrid: document.getElementById("trendingGrid"),
    moviesGrid: document.getElementById("moviesGrid"),
    upcomingGrid: document.getElementById("upcomingGrid"),
    topRatedGrid: document.getElementById("topRatedGrid"),
    resultsCount: document.getElementById("resultsCount"),
    apiStatus: document.getElementById("apiStatus"),
    modal: {
      poster: document.getElementById("modalPoster"),
      title: document.getElementById("modalTitle"),
      rating: document.getElementById("modalRating"),
      releaseDate: document.getElementById("modalReleaseDate"),
      genres: document.getElementById("modalGenres"),
      language: document.getElementById("modalLanguage"),
      popularity: document.getElementById("modalPopularity"),
      overview: document.getElementById("modalOverview"),
    },
  };

  const grids = [els.trendingGrid, els.moviesGrid, els.upcomingGrid, els.topRatedGrid].filter(Boolean);

  const setApiStatus = (text) => {
    if (els.apiStatus) els.apiStatus.textContent = text;
  };

  const createSkeletonCards = (count = 6) => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("article");
      card.className =
        "skeleton-card min-w-[72%] shrink-0 snap-start rounded-2xl border border-white/10 bg-cineDark p-3 sm:min-w-[42%] md:min-w-[32%] lg:min-w-[24%]";
      card.innerHTML = `
        <div class="skeleton-shimmer mb-3 h-56 rounded-xl sm:h-64"></div>
        <div class="skeleton-shimmer mb-2 h-4 w-4/5 rounded"></div>
        <div class="skeleton-shimmer h-3 w-2/5 rounded"></div>
      `;
      fragment.appendChild(card);
    }
    return fragment;
  };

  const setGridLoadingState = (gridElement) => {
    if (!gridElement) return;
    gridElement.replaceChildren(createSkeletonCards());
    gridElement.setAttribute("aria-busy", "true");
  };

  const createMovieCard = (movie) => {
    const title = escapeHtml(movie.title || "Sin titulo");
    const overview = escapeHtml(movie.overview || "Sinopsis no disponible por el momento.");
    const year = (movie.release_date || "").slice(0, 4) || "----";
    const rating = (movie.vote_average || 0).toFixed(1);

    const card = document.createElement("article");
    card.className =
      "movie-card group relative min-w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-cineDark shadow-lg sm:min-w-[42%] md:min-w-[32%] lg:min-w-[24%]";
    card.setAttribute("role", "listitem");

    card.innerHTML = `
      <img
        src="${getPosterUrl(movie.poster_path)}"
        alt="Poster de ${title}"
        class="h-56 w-full object-cover sm:h-64"
        loading="lazy"
        decoding="async"
        width="500"
        height="750"
      />
      <div class="movie-card-overlay absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/10"></div>
      <div class="movie-card-info absolute inset-x-0 bottom-0 p-3">
        <h3 class="line-clamp-1 text-base font-semibold sm:text-lg">${title}</h3>
        <div class="mt-2 flex items-center justify-between text-xs text-cineGray sm:text-sm">
          <span aria-label="Calificacion ${rating}">⭐ ${rating}</span>
          <span>${year}</span>
        </div>
        <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-cineGray/90">${overview}</p>
        <div class="mt-3 flex items-center gap-2">
          <button type="button" class="btn-cinematic inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/15 text-sm text-white" aria-label="Reproducir ${title}">▶</button>
          <button type="button" class="movie-detail-btn btn-cinematic flex-1 rounded-lg bg-cineRed px-3 py-2 text-sm font-semibold" data-movie-id="${movie.id}" aria-label="Ver detalles de ${title}">Ver detalles</button>
          <button type="button" class="btn-cinematic inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/50 text-base text-white" aria-label="Agregar ${title} a favoritos">♥</button>
        </div>
      </div>
    `;

    return card;
  };

  const renderMoviesInGrid = (gridElement, movies = [], { updateCount = false } = {}) => {
    if (!gridElement) return;

    const fragment = document.createDocumentFragment();
    movies.forEach((movie) => {
      state.movieCache.set(String(movie.id), movie);
      fragment.appendChild(createMovieCard(movie));
    });

    gridElement.replaceChildren(fragment);
    gridElement.removeAttribute("aria-busy");
    gridElement.classList.add("grid-loaded");

    if (updateCount && els.resultsCount) {
      els.resultsCount.textContent = `${movies.length} resultados`;
    }

    requestAnimationFrame(() => {
      gridElement.querySelectorAll(".movie-card").forEach((card, index) => {
        card.classList.add("reveal", index % 2 ? "reveal-right" : "reveal-left", "is-visible");
      });
    });
  };

  const renderErrorState = (gridElement, message, onRetry = null) => {
    if (!gridElement) return;

    const article = document.createElement("article");
    article.className = "error-card snap-start";
    article.innerHTML = `
      <h3>Contenido no disponible</h3>
      <p>${escapeHtml(message)}</p>
      ${onRetry ? '<button type="button" class="retry-btn">Reintentar</button>' : ""}
    `;

    if (onRetry) article.querySelector(".retry-btn")?.addEventListener("click", onRetry, { once: true });
    gridElement.replaceChildren(article);
    gridElement.removeAttribute("aria-busy");

    if (gridElement === els.moviesGrid && els.resultsCount) {
      els.resultsCount.textContent = "0 resultados";
    }
  };

  const fetchTMDB = async (path, { useCache = true, signal } = {}) => {
    if (API_KEY === "YOUR_TMDB_API_KEY" || !API_KEY) {
      throw new Error("API_KEY no configurada");
    }

    const cacheKey = path;
    if (useCache && state.apiCache.has(cacheKey)) {
      return state.apiCache.get(cacheKey);
    }

    const endpoint = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}api_key=${API_KEY}&language=es-ES&page=1`;
    let response;

    try {
      response = await fetch(endpoint, { signal, mode: "cors" });
    } catch {
      throw new Error(
        window.location.protocol === "file:"
          ? "Abre el proyecto con Live Server (no como archivo local)."
          : "Sin conexion a internet."
      );
    }

    if (!response.ok) {
      throw new Error(`TMDB respondio con estado ${response.status}`);
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : data;
    if (useCache) state.apiCache.set(cacheKey, results);
    return results;
  };

  const fetchMovieDetails = async (movieId) => {
    const cacheKey = String(movieId);
    if (state.detailsCache.has(cacheKey)) return state.detailsCache.get(cacheKey);

    const details = await fetchTMDB(`/movie/${movieId}`, { useCache: false });
    state.detailsCache.set(cacheKey, details);
    return details;
  };

  const loadCarousel = async (gridElement, path, errorMessage) => {
    setGridLoadingState(gridElement);
    try {
      const movies = await fetchTMDB(path);
      if (!Array.isArray(movies) || movies.length === 0) {
        throw new Error("Sin resultados");
      }
      renderMoviesInGrid(gridElement, movies, { updateCount: gridElement === els.moviesGrid });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : errorMessage;
      renderErrorState(gridElement, `${errorMessage} ${detail}`, () => loadCarousel(gridElement, path, errorMessage));
      return false;
    }
  };

  const loadAllCarousels = async () => {
    setApiStatus("Estado API TMDB: cargando");

    const results = await Promise.all([
      loadCarousel(els.trendingGrid, "/trending/movie/week", "No se pudo cargar Trending Movies."),
      loadCarousel(els.moviesGrid, "/movie/popular", "No se pudo cargar el catalogo recomendado."),
      loadCarousel(els.upcomingGrid, "/movie/upcoming", "No se pudo cargar Proximamente."),
      loadCarousel(els.topRatedGrid, "/movie/top_rated", "No se pudo cargar Top Rated."),
    ]);

    const successCount = results.filter(Boolean).length;
    if (successCount === 0) setApiStatus("Estado API TMDB: sin conexion");
    else if (successCount < results.length) setApiStatus("Estado API TMDB: conexion parcial");
    else setApiStatus("Estado API TMDB: conectado");
  };

  const setModalVisibility = (isOpen) => {
    if (!els.movieModal || !els.movieModalPanel) return;

    if (isOpen) {
      els.movieModal.classList.remove("modal-closed", "opacity-0", "pointer-events-none");
      els.movieModal.classList.add("modal-open");
      els.movieModalPanel.classList.remove("modal-panel-closed", "scale-95");
      els.movieModalPanel.classList.add("modal-panel-open", "scale-100");
      els.movieModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open-body");
      els.closeModalButton?.focus();
      return;
    }

    els.movieModal.classList.remove("modal-open");
    els.movieModal.classList.add("modal-closed", "opacity-0", "pointer-events-none");
    els.movieModalPanel.classList.remove("modal-panel-open", "scale-100");
    els.movieModalPanel.classList.add("modal-panel-closed", "scale-95");
    els.movieModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open-body");
  };

  if (els.movieModal) {
    els.movieModal.classList.add("modal-closed");
    els.movieModalPanel?.classList.add("modal-panel-closed");
  }

  const setModalLoading = () => {
    const { modal } = els;
    if (modal.title) modal.title.textContent = "Cargando titulo...";
    if (modal.rating) modal.rating.textContent = "...";
    if (modal.releaseDate) modal.releaseDate.textContent = "...";
    if (modal.genres) modal.genres.textContent = "...";
    if (modal.language) modal.language.textContent = "...";
    if (modal.popularity) modal.popularity.textContent = "...";
    if (modal.overview) modal.overview.textContent = "Cargando informacion...";
    if (modal.poster) {
      modal.poster.src = PLACEHOLDER_POSTER;
      modal.poster.alt = "Poster cargando";
    }
  };

  const fillModalContent = (movie) => {
    const { modal } = els;
    const title = movie.title || "Sin titulo";

    if (modal.poster) {
      modal.poster.src = getPosterUrl(movie.poster_path);
      modal.poster.alt = `Poster de ${title}`;
    }
    if (modal.title) modal.title.textContent = title;
    if (modal.rating) modal.rating.textContent = (movie.vote_average || 0).toFixed(1);
    if (modal.releaseDate) modal.releaseDate.textContent = formatDate(movie.release_date);
    if (modal.genres) {
      const genres = Array.isArray(movie.genres) ? movie.genres.map((g) => g.name).join(", ") : "";
      modal.genres.textContent = genres || "Sin generos";
    }
    if (modal.language) modal.language.textContent = (movie.original_language || "N/A").toUpperCase();
    if (modal.popularity) modal.popularity.textContent = `${Math.round(movie.popularity || 0)}`;
    if (modal.overview) modal.overview.textContent = movie.overview || "Sinopsis no disponible por el momento.";
  };

  const openMovieModal = async (movieId) => {
    const cachedMovie = state.movieCache.get(String(movieId));
    if (!cachedMovie || !els.movieModal) return;

    setModalLoading();
    setModalVisibility(true);

    try {
      const movieDetails = await fetchMovieDetails(movieId);
      const mergedMovie = { ...cachedMovie, ...movieDetails };
      state.movieCache.set(String(movieId), mergedMovie);
      fillModalContent(mergedMovie);
    } catch {
      fillModalContent(cachedMovie);
      if (els.modal.overview) {
        els.modal.overview.textContent = "No se pudieron cargar todos los detalles en este momento.";
      }
    }
  };

  const runSearch = async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      loadCarousel(els.moviesGrid, "/movie/popular", "No se pudo cargar el catalogo.");
      return;
    }

    state.searchAbort?.abort();
    state.searchAbort = new AbortController();

    setGridLoadingState(els.moviesGrid);
    setApiStatus("Estado API TMDB: buscando...");

    try {
      const movies = await fetchTMDB(`/search/movie?query=${encodeURIComponent(trimmed)}`, {
        useCache: false,
        signal: state.searchAbort.signal,
      });
      renderMoviesInGrid(els.moviesGrid, movies, { updateCount: true });
      setApiStatus("Estado API TMDB: conectado");
    } catch (error) {
      if (error.name === "AbortError") return;
      renderErrorState(els.moviesGrid, "No encontramos resultados. Intenta con otro termino.", () => runSearch(trimmed));
      setApiStatus("Estado API TMDB: error de busqueda");
    }
  };

  const debouncedSearch = debounce((value) => runSearch(value), 400);

  const scrollCarouselByStep = (gridId, direction = 1) => {
    const gridElement = document.getElementById(gridId);
    if (!gridElement) return;
    const step = Math.max(gridElement.clientWidth * 0.82, 240);
    gridElement.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  const startAutoScroll = (gridElement) => {
    if (!gridElement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timerId;
    const tick = () => {
      const endReached = gridElement.scrollLeft + gridElement.clientWidth >= gridElement.scrollWidth - 6;
      if (endReached) gridElement.scrollTo({ left: 0, behavior: "smooth" });
      else gridElement.scrollBy({ left: Math.max(gridElement.clientWidth * 0.62, 200), behavior: "smooth" });
    };

    const start = () => {
      clearInterval(timerId);
      timerId = setInterval(tick, 6500);
    };

    const stop = () => clearInterval(timerId);

    gridElement.addEventListener("mouseenter", stop, { passive: true });
    gridElement.addEventListener("mouseleave", start, { passive: true });
    gridElement.addEventListener("touchstart", stop, { passive: true });
    gridElement.addEventListener("touchend", start, { passive: true });
    start();
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const detailButton = target.closest(".movie-detail-btn");
    if (detailButton?.dataset.movieId) {
      openMovieModal(detailButton.dataset.movieId);
      return;
    }

    const prevBtn = target.closest("[data-carousel-prev]");
    if (prevBtn) {
      scrollCarouselByStep(prevBtn.getAttribute("data-carousel-prev"), -1);
      return;
    }

    const nextBtn = target.closest("[data-carousel-next]");
    if (nextBtn) {
      scrollCarouselByStep(nextBtn.getAttribute("data-carousel-next"), 1);
    }
  });

  els.mobileMenuButton?.addEventListener("click", () => {
    const isHidden = els.mobileMenu.classList.toggle("hidden");
    els.mobileMenuButton.setAttribute("aria-expanded", String(!isHidden));
    els.mobileMenuButton.setAttribute("aria-label", isHidden ? "Abrir menu" : "Cerrar menu");
  });

  els.closeModalButton?.addEventListener("click", () => setModalVisibility(false));

  els.movieModal?.addEventListener("click", (event) => {
    if (event.target === els.movieModal) setModalVisibility(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.movieModal?.classList.contains("modal-open")) {
      setModalVisibility(false);
    }
  });

  const handleSearchSubmit = () => {
    const query = els.searchInput?.value || els.mobileSearchInput?.value || "";
    runSearch(query);
  };

  els.searchInput?.addEventListener("input", (event) => debouncedSearch(event.target.value));
  els.mobileSearchInput?.addEventListener("input", (event) => debouncedSearch(event.target.value));
  els.searchButton?.addEventListener("click", handleSearchSubmit);
  els.mobileSearchButton?.addEventListener("click", handleSearchSubmit);

  const scrollToSection = (selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    els.mobileMenu?.classList.add("hidden");
    els.mobileMenuButton?.setAttribute("aria-expanded", "false");
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      event.preventDefault();
      scrollToSection(href);
    });
  });

  document.getElementById("heroExploreButton")?.addEventListener("click", () => scrollToSection("#peliculas"));
  document.getElementById("heroTrendingButton")?.addEventListener("click", () => scrollToSection("#tendencias"));

  document.getElementById("userAvatarButton")?.addEventListener("click", () => {
    alert("Perfil de usuario - funcion disponible proximamente.");
  });

  if (window.location.protocol === "file:") {
    const warning = document.createElement("div");
    warning.className = "file-warning";
    warning.textContent =
      "Para que TMDB funcione, abre con Live Server: clic derecho en index.html > Open with Live Server";
    document.body.appendChild(warning);
  }

  document.querySelectorAll(".carousel-arrow").forEach((arrow) => {
    arrow.classList.add(
      "h-10",
      "w-10",
      "items-center",
      "justify-center",
      "rounded-full",
      "border",
      "border-white/20",
      "bg-black/55",
      "text-xl",
      "text-white",
      "backdrop-blur-sm",
      "sm:h-11",
      "sm:w-11",
      "sm:text-2xl"
    );
    arrow.setAttribute("aria-label", arrow.hasAttribute("data-carousel-prev") ? "Desplazar izquierda" : "Desplazar derecha");
  });

  grids.forEach(startAutoScroll);
  loadAllCarousels().catch((error) => {
    console.error("Error al cargar peliculas:", error);
    setApiStatus("Estado API TMDB: revisa tu API KEY en app.js");
  });
});
