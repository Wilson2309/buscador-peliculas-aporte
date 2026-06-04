import { debounce, findMoviesByActor, mergeMovieResults, setApiStatus, state, tmdbFetch } from "./api.js";
import { hideSearchSuggestions, renderSearchLoading, renderSearchResults, renderSearchSuggestions } from "./ui.js";

const showSearchResultsSection = () => {
  document.getElementById("search-results-section")?.classList.remove("hidden");
};

export const hideSearchResultsSection = () => {
  if (state.searchController) state.searchController.abort();
  document.getElementById("search-results-section")?.classList.add("hidden");
  const grid = document.getElementById("search-results-grid");
  const count = document.getElementById("searchResultsCount");
  if (grid) grid.innerHTML = "";
  if (count) count.textContent = "0 resultados";
};

const syncQuickSearchInputs = (value, source) => {
  [document.getElementById("search-input"), document.getElementById("mobileSearchInput")].forEach((input) => {
    if (input && input !== source) input.value = value;
  });
};

export const runGlobalSearch = async (rawQuery, { scrollToResults = false } = {}) => {
  const query = String(rawQuery || "").trim();
  if (state.searchController) state.searchController.abort();

  if (!query) {
    hideSearchResultsSection();
    hideSearchSuggestions();
    return;
  }

  showSearchResultsSection();
  if (query.length < 3) {
    const grid = document.getElementById("search-results-grid");
    const count = document.getElementById("searchResultsCount");
    if (grid) {
      grid.innerHTML = `
        <article class="search-empty-card">
          <h3>Escribe al menos 3 caracteres</h3>
          <p>Busca por titulo de pelicula o por actor.</p>
        </article>
      `;
    }
    if (count) count.textContent = "Busqueda pendiente";
    return;
  }

  state.searchController = new AbortController();
  renderSearchLoading();
  setApiStatus("Estado API TMDB: buscando");
  if (scrollToResults) document.getElementById("search-results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const [movieData, actorMovies] = await Promise.all([
      tmdbFetch(
        `/search/movie?query=${encodeURIComponent(query)}`,
        { page: 1, include_adult: "false" },
        { signal: state.searchController.signal }
      ),
      findMoviesByActor(query, state.searchController.signal),
    ]);
    const results = mergeMovieResults(movieData.results || [], actorMovies);
    renderSearchResults(results);
    renderSearchSuggestions(results);
    setApiStatus("Estado API TMDB: conectado");
  } catch (error) {
    if (error.name === "AbortError") return;
    renderSearchResults([]);
    setApiStatus("Estado API TMDB: error de busqueda");
  }
};

export const bindGlobalSearch = () => {
  const debouncedGlobalSearch = debounce((value) => runGlobalSearch(value), 420);

  [document.getElementById("search-input"), document.getElementById("mobileSearchInput")].forEach((input) => {
    input?.addEventListener("input", (event) => {
      syncQuickSearchInputs(event.target.value, event.target);
      debouncedGlobalSearch(event.target.value);
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      runGlobalSearch(event.target.value, { scrollToResults: true });
    });
  });

  document.getElementById("searchButton")?.addEventListener("click", () => {
    const input = document.getElementById("search-input");
    syncQuickSearchInputs(input?.value || "", input);
    runGlobalSearch(input?.value || "", { scrollToResults: true });
  });

  document.getElementById("mobileSearchButton")?.addEventListener("click", () => {
    const input = document.getElementById("mobileSearchInput");
    syncQuickSearchInputs(input?.value || "", input);
    runGlobalSearch(input?.value || "", { scrollToResults: true });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-shell")) hideSearchSuggestions();
  });
};
