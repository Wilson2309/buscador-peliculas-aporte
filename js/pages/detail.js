import { getMovieDetails, hideLoader, loadGenresData, setApiStatus, state } from "../api.js";
import { bindCarouselControls } from "../carousels.js";
import { bindSharedLayout, mountLayout } from "../layout.js";
import { addToHistory } from "../profile.js";
import { loadSocialSections } from "../social.js";
import { renderMovieDetailMarkup } from "../ui.js";

const getMovieId = () => new URLSearchParams(location.search).get("id");

const renderDetail = async () => {
  const root = document.getElementById("detailRoot");
  const movieId = getMovieId();
  if (!root) return;

  if (!movieId) {
    root.innerHTML = `
      <article class="search-empty-card">
        <h3>No se encontro la pelicula</h3>
        <p>Abre una pelicula desde el catalogo para ver sus detalles.</p>
      </article>
    `;
    return;
  }

  root.innerHTML = `<div class="modal-loading">Cargando detalles...</div>`;
  setApiStatus("Estado API TMDB: cargando detalle");

  try {
    await loadGenresData();
    const details = await getMovieDetails(movieId);
    state.currentModalMovie = details;
    addToHistory(details);
    document.title = `CineFlick | ${details.title}`;
    root.innerHTML = renderMovieDetailMarkup(details);
    await loadSocialSections(details, root);
    setApiStatus("Estado API TMDB: conectado");
  } catch {
    root.innerHTML = `
      <article class="search-empty-card">
        <h3>No se pudieron cargar los detalles</h3>
        <p>Intenta abrir otra pelicula o revisar tu conexion.</p>
      </article>
    `;
    setApiStatus("Estado API TMDB: error de detalle");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  mountLayout();
  bindSharedLayout();
  bindCarouselControls();
  try {
    await renderDetail();
  } finally {
    hideLoader();
  }
});
