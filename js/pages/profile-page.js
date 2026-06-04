import { escapeHtml, getMovieDetails, hideLoader, loadGenresData, setApiStatus } from "../api.js";
import { getMyRatings, getMyReviews, getStoredUser, isLoggedIn, loginUser, logoutUser, registerUser } from "../backendApi.js";
import { bindSharedLayout, mountLayout, updateNavbarAuth } from "../layout.js";
import { bindProfilePanel, createDefaultUserProfile, loadBackendProfile, loadProfile, renderProfile, showToast, syncUserProfile } from "../profile.js";
import { openMovieDetails } from "../ui.js";

let authMode = new URLSearchParams(location.search).get("auth") === "register" ? "register" : "login";

const setAuthStatus = (message, type = "neutral") => {
  const status = document.getElementById("authStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
};

const updateAuthUi = () => {
  const isRegister = authMode === "register";
  const loggedIn = isLoggedIn();
  const storedUser = getStoredUser();
  const nameInput = document.getElementById("authNameInput");
  const form = document.getElementById("authForm");
  const title = document.getElementById("authTitle");
  const submit = document.getElementById("authSubmitButton");
  const logoutButton = document.getElementById("logoutButton");

  if (nameInput) {
    nameInput.hidden = !isRegister;
    nameInput.required = isRegister;
  }
  if (form) form.hidden = loggedIn;
  if (logoutButton) logoutButton.hidden = !loggedIn;
  if (title) title.textContent = loggedIn ? "Sesion activa" : isRegister ? "Crear cuenta" : "Iniciar sesion";
  if (submit) submit.textContent = isRegister ? "Registrarme" : "Entrar";

  if (loggedIn) setAuthStatus(`Conectado como ${storedUser?.email || "usuario CineFlick"}.`, "success");
};

const renderProfileActivity = async () => {
  const reviewsList = document.getElementById("myReviewsList");
  const ratingsList = document.getElementById("myRatingsList");
  if (!reviewsList && !ratingsList) return;

  if (!isLoggedIn()) {
    if (reviewsList) reviewsList.innerHTML = `<div class="empty-state">Inicia sesion para ver tus opiniones.</div>`;
    if (ratingsList) ratingsList.innerHTML = `<div class="empty-state">Inicia sesion para ver tus calificaciones.</div>`;
    return;
  }

  if (reviewsList) reviewsList.innerHTML = `<div class="empty-state">Cargando opiniones...</div>`;
  if (ratingsList) ratingsList.innerHTML = `<div class="empty-state">Cargando calificaciones...</div>`;

  try {
    const [reviewsData, ratingsData] = await Promise.all([getMyReviews(), getMyRatings()]);
    const reviews = reviewsData.reviews || [];
    const ratings = ratingsData.ratings || [];

    if (reviewsList) {
      reviewsList.innerHTML = reviews.length
        ? reviews
            .slice(0, 6)
            .map(
              (review) => `
                <article class="profile-list-item">
                  <div>
                    <strong>${escapeHtml(review.title || `TMDB ${review.tmdb_id}`)}</strong>
                    <span>${escapeHtml((review.content || "").slice(0, 120))}${review.content?.length > 120 ? "..." : ""}</span>
                  </div>
                  <div class="profile-list-actions"><button type="button" data-profile-action="open" data-profile-movie-id="${review.tmdb_id}">Abrir</button></div>
                </article>
              `
            )
            .join("")
        : `<div class="empty-state">Todavia no escribes opiniones.</div>`;
    }

    if (ratingsList) {
      const ratingDetails = await Promise.all(
        ratings.slice(0, 6).map((rating) => getMovieDetails(rating.tmdb_id).catch(() => ({ title: `TMDB ${rating.tmdb_id}`, id: rating.tmdb_id })))
      );
      ratingsList.innerHTML = ratings.length
        ? ratings
            .slice(0, 6)
            .map((rating, index) => {
              const details = ratingDetails[index];
              return `
                <article class="profile-list-item">
                  <div>
                    <strong>${escapeHtml(details.title || `TMDB ${rating.tmdb_id}`)}</strong>
                    <span>Tu calificacion: ${Number(rating.rating).toFixed(1)}</span>
                  </div>
                  <div class="profile-list-actions"><button type="button" data-profile-action="open" data-profile-movie-id="${rating.tmdb_id}">Abrir</button></div>
                </article>
              `;
            })
            .join("")
        : `<div class="empty-state">Todavia no calificas peliculas.</div>`;
    }
  } catch (error) {
    if (reviewsList) reviewsList.innerHTML = `<div class="empty-state">No se pudieron cargar tus opiniones.</div>`;
    if (ratingsList) ratingsList.innerHTML = `<div class="empty-state">No se pudieron cargar tus calificaciones.</div>`;
    showToast(error.message || "No se pudo cargar tu actividad", "error");
  }
};

const bindAuth = () => {
  document.addEventListener("cineflick:auth-changed", updateAuthUi);

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      authMode = button.dataset.authMode || "login";
      updateAuthUi();
    });
  });

  document.getElementById("authForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nombre = document.getElementById("authNameInput")?.value.trim();
    const email = document.getElementById("authEmailInput")?.value.trim();
    const password = document.getElementById("authPasswordInput")?.value;

    try {
      setAuthStatus("Conectando...");
      if (authMode === "register") {
        await registerUser(nombre, email, password);
        showToast("Registro exitoso", "success");
      } else {
        await loginUser(email, password);
        showToast("Login exitoso", "success");
      }
      await loadBackendProfile();
      await renderProfileActivity();
      updateAuthUi();
      updateNavbarAuth();
      setApiStatus("Estado backend: conectado");
    } catch (error) {
      setAuthStatus(error.message || "No se pudo iniciar sesion", "error");
      showToast(error.message || "Error de servidor", "error");
      setApiStatus("Estado backend: error de autenticacion");
    }
  });

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    logoutUser();
    syncUserProfile(createDefaultUserProfile());
    renderProfile();
    renderProfileActivity();
    updateAuthUi();
    updateNavbarAuth();
    setAuthStatus("Sesion cerrada. Inicia sesion para sincronizar.", "neutral");
    showToast("Sesion cerrada", "neutral");
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  mountLayout({ profilePanel: false });
  bindSharedLayout({ profilePanel: false });
  loadProfile();
  bindProfilePanel({ openMovieDetails });
  renderProfile();
  bindAuth();
  updateAuthUi();
  try {
    await loadBackendProfile();
    await renderProfileActivity();
    await loadGenresData();
    setApiStatus("Estado API/backend: conectado");
  } catch {
    setApiStatus("Estado API/backend: perfil local");
  } finally {
    hideLoader();
  }
});
