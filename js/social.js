import {
  createReview,
  deleteRating,
  deleteReview,
  getMovieRatings,
  getMovieReviews,
  getStoredUser,
  isLoggedIn,
  saveRating,
  updateReview,
} from "./backendApi.js";
import { escapeHtml, getYear } from "./api.js";
import { showToast } from "./profile.js";

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
};

const getInitial = (name = "U") => name.trim().charAt(0).toUpperCase() || "U";

const renderAvatar = (name, avatarUrl) =>
  avatarUrl
    ? `<img class="social-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" />`
    : `<span class="social-avatar">${escapeHtml(getInitial(name))}</span>`;

const renderRatingOptions = (selected) =>
  Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value}</option>`;
  }).join("");

const renderReviews = (container, details, reviews) => {
  const user = getStoredUser();
  const userReview = reviews.find((review) => Number(review.user_id) === Number(user?.id));

  container.innerHTML = `
    <div class="social-section-header">
      <div>
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">Comunidad CineFlick</p>
        <h3>Opiniones de usuarios</h3>
      </div>
      <span>${reviews.length} opiniones</span>
    </div>
    ${
      isLoggedIn()
        ? `
          <form class="social-form" data-review-form>
            <textarea name="content" maxlength="1200" required placeholder="Escribe tu opinion...">${escapeHtml(userReview?.content || "")}</textarea>
            <div class="social-form-actions">
              <button type="submit">${userReview ? "Actualizar opinion" : "Publicar opinion"}</button>
              ${userReview ? `<button type="button" data-delete-review="${userReview.id}">Eliminar</button>` : ""}
            </div>
          </form>
        `
        : `<div class="empty-state">Inicia sesion para escribir una opinion</div>`
    }
    <div class="social-list">
      ${
        reviews.length
          ? reviews
              .map((review) => {
                const mine = Number(review.user_id) === Number(user?.id);
                const name = review.nombre || "Usuario";
                return `
                  <article class="social-item">
                    ${renderAvatar(name, review.avatar_url)}
                    <div>
                      <div class="social-item-meta">
                        <strong>${escapeHtml(name)}</strong>
                        <span>${formatDate(review.updated_at || review.created_at)}</span>
                      </div>
                      <p>${escapeHtml(review.content)}</p>
                      ${
                        mine
                          ? `<div class="social-inline-actions">
                              <button type="button" data-edit-review="${review.id}">Editar</button>
                              <button type="button" data-delete-review="${review.id}">Eliminar</button>
                            </div>`
                          : ""
                      }
                    </div>
                  </article>
                `;
              })
              .join("")
          : `<div class="empty-state">Todavia no hay opiniones para esta pelicula.</div>`
      }
    </div>
  `;

  container.querySelector("[data-review-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = event.currentTarget.elements.content.value.trim();
    if (!content) {
      showToast("La opinion no puede estar vacia", "neutral");
      return;
    }
    try {
      await createReview({ tmdb_id: details.id, title: details.title, content });
      showToast(userReview ? "Opinion actualizada" : "Opinion publicada", "success");
      await loadSocialSections(details, container.closest("[data-social-root]"));
    } catch (error) {
      showToast(error.message || "No se pudo guardar la opinion", "error");
    }
  });

  container.querySelectorAll("[data-edit-review]").forEach((button) => {
    button.addEventListener("click", () => container.querySelector("[data-review-form] textarea")?.focus());
  });
  container.querySelectorAll("[data-delete-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await deleteReview(button.dataset.deleteReview);
        showToast("Opinion eliminada", "neutral");
        await loadSocialSections(details, container.closest("[data-social-root]"));
      } catch (error) {
        showToast(error.message || "No se pudo eliminar la opinion", "error");
      }
    });
  });
};

const renderRatings = (container, details, ratingData) => {
  container.innerHTML = `
    <div class="social-section-header">
      <div>
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">CineFlick rating</p>
        <h3>Tu calificacion</h3>
      </div>
      <span>TMDB ${Number(details.vote_average || 0).toFixed(1)}</span>
    </div>
    <div class="rating-summary">
      <div><strong>${Number(ratingData.average_rating || 0).toFixed(1)}</strong><span>Promedio usuarios</span></div>
      <div><strong>${Number(ratingData.vote_count || 0)}</strong><span>Votos</span></div>
      <div><strong>${ratingData.user_rating ?? "--"}</strong><span>Tu nota</span></div>
    </div>
    ${
      isLoggedIn()
        ? `
          <form class="rating-form" data-rating-form>
            <label>
              <span class="sr-only">Seleccionar calificacion</span>
              <select name="rating">${renderRatingOptions(ratingData.user_rating)}</select>
            </label>
            <button type="submit">${ratingData.user_rating ? "Cambiar rating" : "Guardar rating"}</button>
            ${ratingData.user_rating ? `<button type="button" data-delete-rating>Eliminar rating</button>` : ""}
          </form>
        `
        : `<div class="empty-state">Inicia sesion para calificar esta pelicula</div>`
    }
  `;

  container.querySelector("[data-rating-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveRating({ tmdb_id: details.id, rating: Number(event.currentTarget.elements.rating.value) });
      showToast("Calificacion guardada", "success");
      await loadSocialSections(details, container.closest("[data-social-root]"));
    } catch (error) {
      showToast(error.message || "No se pudo guardar la calificacion", "error");
    }
  });

  container.querySelector("[data-delete-rating]")?.addEventListener("click", async () => {
    try {
      await deleteRating(details.id);
      showToast("Calificacion eliminada", "neutral");
      await loadSocialSections(details, container.closest("[data-social-root]"));
    } catch (error) {
      showToast(error.message || "No se pudo eliminar la calificacion", "error");
    }
  });
};

export const loadSocialSections = async (details, root = document) => {
  const socialRoot = root?.matches?.("[data-social-root]") ? root : root?.querySelector?.("[data-social-root]");
  if (!socialRoot || !details?.id) return;

  const reviewsContainer = socialRoot.querySelector("[data-reviews-root]");
  const ratingsContainer = socialRoot.querySelector("[data-ratings-root]");
  if (reviewsContainer) reviewsContainer.innerHTML = `<div class="social-skeleton">Cargando opiniones...</div>`;
  if (ratingsContainer) ratingsContainer.innerHTML = `<div class="social-skeleton">Cargando calificaciones...</div>`;

  try {
    const [reviewsData, ratingData] = await Promise.all([getMovieReviews(details.id), getMovieRatings(details.id)]);
    if (reviewsContainer) renderReviews(reviewsContainer, details, reviewsData.reviews || []);
    if (ratingsContainer) renderRatings(ratingsContainer, details, ratingData);
  } catch (error) {
    if (reviewsContainer) reviewsContainer.innerHTML = `<div class="empty-state">No se pudieron cargar las opiniones.</div>`;
    if (ratingsContainer) ratingsContainer.innerHTML = `<div class="empty-state">No se pudieron cargar las calificaciones.</div>`;
    showToast(error.message || "Error cargando actividad social", "error");
  }
};
