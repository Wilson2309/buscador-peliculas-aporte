import {
  buildImageUrl,
  escapeHtml,
  getGenreNames,
  getMovieSnapshot,
  getYear,
  POSTER_FALLBACK,
  setApiStatus,
  state,
} from "./api.js";
import {
  addFavorite as addBackendFavorite,
  addHistoryItem as addBackendHistoryItem,
  addWatchlistItem as addBackendWatchlistItem,
  clearHistory as clearBackendHistory,
  getFavorites as getBackendFavorites,
  getHistory as getBackendHistory,
  getProfile as getBackendProfile,
  getStoredUser,
  getWatchlist as getBackendWatchlist,
  hasAuthToken,
  removeToken,
  removeFavorite as removeBackendFavorite,
  removeHistoryItem as removeBackendHistoryItem,
  removeWatchlistItem as removeBackendWatchlistItem,
  toLocalMovie,
  updateProfile as updateBackendProfile,
} from "./backendApi.js";

const PROFILE_STORAGE_KEY = "cineflick.profile.v2";

export const createDefaultUserProfile = () => ({
  name: "Invitado",
  avatar: "",
  favorites: [],
  watchLater: [],
  history: [],
  email: "",
  bio: "",
});

let profileSyncTimerId;

export let userProfile = window.userProfile || createDefaultUserProfile();
window.userProfile = userProfile;
globalThis.userProfile = userProfile;

export const syncUserProfile = (profile) => {
  userProfile = profile;
  window.userProfile = userProfile;
  globalThis.userProfile = userProfile;
  state.profile = userProfile;
};

export const saveProfile = () => {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
};

export const loadProfile = () => {
  if (!hasAuthToken()) {
    syncUserProfile(createDefaultUserProfile());
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
    syncUserProfile({
      ...createDefaultUserProfile(),
      ...saved,
      favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
      watchLater: Array.isArray(saved.watchLater) ? saved.watchLater : [],
      history: Array.isArray(saved.history) ? saved.history : [],
    });
  } catch {
    syncUserProfile(createDefaultUserProfile());
    saveProfile();
  }
};

export const isMovieInList = (listName, movieId) =>
  (userProfile[listName] || []).some((movie) => Number(movie.id) === Number(movieId));

export const showToast = (message, type = "success") => {
  let toast = document.getElementById("cineToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cineToast";
    toast.className = "cine-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timerId);
  showToast.timerId = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
};

const getListLabel = (listName) => {
  if (listName === "favorites") return "favoritos";
  if (listName === "watchLater") return "ver mas tarde";
  if (listName === "history") return "historial";
  return "lista";
};

const requireLoginForList = (listName) => {
  if (hasAuthToken()) return true;
  if (listName === "favorites") showToast("Inicia sesion para guardar favoritos", "neutral");
  if (listName === "watchLater") showToast("Inicia sesion para guardar en ver mas tarde", "neutral");
  return false;
};

const syncBackendMovieList = (listName, movie, shouldAdd) => {
  const actions = {
    favorites: shouldAdd ? addBackendFavorite : removeBackendFavorite,
    watchLater: shouldAdd ? addBackendWatchlistItem : removeBackendWatchlistItem,
    history: shouldAdd ? addBackendHistoryItem : removeBackendHistoryItem,
  };
  const action = actions[listName];
  if (!action) return;

  Promise.resolve(action(shouldAdd ? movie : movie.id)).catch(() => {
    showToast("No se pudo sincronizar con el servidor", "error");
  });
};

export const syncProfileToBackend = () => {
  if (!hasAuthToken()) return;
  window.clearTimeout(profileSyncTimerId);
  profileSyncTimerId = window.setTimeout(() => {
    updateBackendProfile({
      nombre: userProfile.name || "Invitado",
      avatar_url: userProfile.avatar || "",
      bio: userProfile.bio || "",
  }).catch(() => showToast("No se pudo actualizar el perfil", "error"));
  }, 500);
};

export const loadBackendProfile = async () => {
  if (!hasAuthToken()) return false;

  let user;
  let favoritesData;
  let watchlistData;
  let historyData;
  try {
    [{ user }, favoritesData, watchlistData, historyData] = await Promise.all([
      getBackendProfile(),
      getBackendFavorites(),
      getBackendWatchlist(),
      getBackendHistory(),
    ]);
  } catch (error) {
    if (error.status === 401) {
      removeToken();
      showToast("Tu sesion expiro. Inicia sesion nuevamente.", "neutral");
      syncUserProfile(createDefaultUserProfile());
      renderProfile();
      return false;
    }
    throw error;
  }

  syncUserProfile({
    ...userProfile,
    name: user?.nombre || userProfile.name || "Invitado",
    email: user?.email || userProfile.email || "",
    avatar: user?.avatar_url || userProfile.avatar || "",
    bio: user?.bio || userProfile.bio || "",
    favorites: (favoritesData.favorites || []).map(toLocalMovie),
    watchLater: (watchlistData.watchlist || []).map(toLocalMovie),
    history: (historyData.history || []).map(toLocalMovie),
  });
  saveProfile();
  renderProfile();
  return true;
};

export const updateMovieList = (listName, movie, forceState, { silent = false } = {}) => {
  const snapshot = getMovieSnapshot(movie);
  if (["favorites", "watchLater"].includes(listName) && !requireLoginForList(listName)) return false;
  if (listName === "history" && !hasAuthToken()) return false;
  const exists = isMovieInList(listName, snapshot.id);
  const shouldAdd = typeof forceState === "boolean" ? forceState : !exists;

  userProfile[listName] = (userProfile[listName] || []).filter((item) => Number(item.id) !== Number(snapshot.id));
  if (shouldAdd) userProfile[listName].unshift({ ...snapshot, savedAt: new Date().toISOString() });
  userProfile[listName] = userProfile[listName].slice(0, listName === "history" ? 30 : 80);
  saveProfile();
  syncBackendMovieList(listName, snapshot, shouldAdd);
  renderProfile();
  if (!silent && listName !== "history") {
    showToast(
      shouldAdd
        ? `${snapshot.title} se agrego a ${getListLabel(listName)}`
        : `${snapshot.title} se elimino de ${getListLabel(listName)}`,
      shouldAdd ? "success" : "neutral"
    );
  }
  document.dispatchEvent(new CustomEvent("cineflick:profile-updated", { detail: { listName, movie: snapshot } }));
  return shouldAdd;
};

export const removeFromMovieList = (listName, movieId, { silent = false } = {}) => {
  if (["favorites", "watchLater", "history"].includes(listName) && !hasAuthToken()) return;
  const movie = (userProfile[listName] || []).find((item) => Number(item.id) === Number(movieId));
  userProfile[listName] = (userProfile[listName] || []).filter((item) => Number(item.id) !== Number(movieId));
  saveProfile();
  syncBackendMovieList(listName, movie || { id: movieId }, false);
  renderProfile();
  if (!silent && movie) showToast(`${movie.title} se elimino de ${getListLabel(listName)}`, "neutral");
};

export const moveFavoriteToWatchLater = (movieId) => {
  const movie = userProfile.favorites.find((item) => Number(item.id) === Number(movieId));
  if (!movie) return;
  removeFromMovieList("favorites", movieId, { silent: true });
  updateMovieList("watchLater", movie, true);
};

export const addToHistory = (movie) => updateMovieList("history", movie, true, { silent: true });

const getTopSavedGenre = () => {
  const counts = new Map();
  [...userProfile.favorites, ...userProfile.watchLater].forEach((movie) => {
    getGenreNames(movie, 4).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin datos";
};

const getFavoriteAverageRating = () => {
  if (!userProfile.favorites.length) return "Sin datos";
  const total = userProfile.favorites.reduce((sum, movie) => sum + Number(movie.vote_average || 0), 0);
  return (total / userProfile.favorites.length).toFixed(1);
};

const getProfileActions = (listName, movieId) => {
  const open = `<button type="button" data-profile-action="open" data-profile-movie-id="${movieId}">Abrir</button>`;
  const remove = `<button type="button" data-profile-action="remove" data-profile-list="${listName}" data-profile-movie-id="${movieId}">Eliminar</button>`;
  const move =
    listName === "favorites"
      ? `<button type="button" data-profile-action="move-watch-later" data-profile-movie-id="${movieId}">Ver mas tarde</button>`
      : "";
  const favorite =
    listName === "watchLater"
      ? `<button type="button" data-profile-action="favorite" data-profile-movie-id="${movieId}">Favorito</button>`
      : "";
  return `${open}${move}${favorite}${remove}`;
};

export const renderProfileList = (container, movies = [], emptyText = "Sin peliculas guardadas", listName = "history") => {
  if (!container) return;
  if (!movies.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = movies
    .slice(0, 6)
    .map(
      (movie) => `
        <article class="profile-list-item">
          <img src="${buildImageUrl(movie.poster_path, "w185", POSTER_FALLBACK)}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" />
          <div>
            <strong>${escapeHtml(movie.title)}</strong>
            <span>${getYear(movie.release_date)} - TMDB ${Number(movie.vote_average || 0).toFixed(1)}</span>
          </div>
          <div class="profile-list-actions">${getProfileActions(listName, movie.id)}</div>
        </article>
      `
    )
    .join("");
};

export const renderProfile = () => {
  const avatar = document.getElementById("profileAvatar");
  const avatarButton = document.getElementById("userAvatarButton");
  const nameInput = document.getElementById("profileNameInput");
  const favoritesCount = document.getElementById("favoritesCount");
  const watchLaterCount = document.getElementById("watchLaterCount");
  const historyCount = document.getElementById("historyCount");
  const topGenreStat = document.getElementById("topGenreStat");
  const emailText = document.getElementById("profileEmailText");
  const bioInput = document.getElementById("profileBioInput");
  const avatarUrlInput = document.getElementById("profileAvatarUrlInput");
  const avgRatingStat = document.getElementById("avgRatingStat");
  const storedUser = getStoredUser();

  if (nameInput && document.activeElement !== nameInput) nameInput.value = userProfile.name;
  if (bioInput && document.activeElement !== bioInput) bioInput.value = userProfile.bio || "";
  if (avatarUrlInput && document.activeElement !== avatarUrlInput) avatarUrlInput.value = userProfile.avatar || "";
  const initial = (userProfile.name || "U").trim().charAt(0).toUpperCase() || "U";
  if (avatar) {
    avatar.textContent = userProfile.avatar ? "" : initial;
    avatar.style.backgroundImage = userProfile.avatar ? `url("${userProfile.avatar}")` : "";
  }
  if (avatarButton) {
    avatarButton.textContent = userProfile.avatar ? "" : initial;
    avatarButton.style.backgroundImage = userProfile.avatar ? `url("${userProfile.avatar}")` : "";
    avatarButton.style.backgroundSize = "cover";
    avatarButton.style.backgroundPosition = "center";
  }
  if (favoritesCount) favoritesCount.textContent = userProfile.favorites.length;
  if (watchLaterCount) watchLaterCount.textContent = userProfile.watchLater.length;
  if (historyCount) historyCount.textContent = userProfile.history.length;
  if (topGenreStat) topGenreStat.textContent = getTopSavedGenre();
  if (avgRatingStat) avgRatingStat.textContent = getFavoriteAverageRating();
  if (emailText) emailText.textContent = userProfile.email || storedUser?.email || "Inicia sesion para sincronizar";

  renderProfileList(document.getElementById("favoriteList"), userProfile.favorites, "Todavia no tienes favoritos.", "favorites");
  renderProfileList(document.getElementById("watchLaterList"), userProfile.watchLater, "Sin pendientes por ahora.", "watchLater");
  renderProfileList(document.getElementById("historyList"), userProfile.history, "Abre peliculas para crear historial.", "history");

  document.querySelectorAll("[data-favorite-id]").forEach((button) => {
    const active = isMovieInList("favorites", button.dataset.favoriteId);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-watchlist-id]").forEach((button) => {
    const active = isMovieInList("watchLater", button.dataset.watchlistId);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
};

export const bindProfilePanel = ({ openMovieDetails } = {}) => {
  const profilePanel = document.getElementById("profilePanel");
  const profilePanelSheet = document.getElementById("profilePanelSheet");
  const closeProfileButton = document.getElementById("closeProfileButton");
  const userAvatarButton = document.getElementById("userAvatarButton");
  const profileNameInput = document.getElementById("profileNameInput");
  const profileBioInput = document.getElementById("profileBioInput");
  const profileAvatarUrlInput = document.getElementById("profileAvatarUrlInput");
  const profileAvatarInput = document.getElementById("profileAvatarInput");
  const editProfileButton = document.getElementById("editProfileButton");
  const saveProfileButton = document.getElementById("saveProfileButton");
  const cancelProfileEditButton = document.getElementById("cancelProfileEditButton");
  const clearHistoryButton = document.getElementById("clearHistoryButton");
  const exportFavoritesButton = document.getElementById("exportFavoritesButton");
  const importFavoritesButton = document.getElementById("importFavoritesButton");
  const importFavoritesInput = document.getElementById("importFavoritesInput");
  let profileEditDraft = null;

  const setProfileEditing = (editing) => {
    [profileNameInput, profileBioInput, profileAvatarUrlInput, profileAvatarInput].forEach((input) => {
      if (input) input.disabled = !editing;
    });
    if (editProfileButton) editProfileButton.hidden = editing;
    if (saveProfileButton) saveProfileButton.hidden = !editing;
    if (cancelProfileEditButton) cancelProfileEditButton.hidden = !editing;
  };

  if (editProfileButton) setProfileEditing(false);

  const openProfilePanel = () => {
    if (!profilePanel || !profilePanelSheet) {
      location.href = "./perfil.html";
      return;
    }
    profilePanel.classList.add("profile-open");
    profilePanel.classList.remove("pointer-events-none", "opacity-0");
    profilePanelSheet.classList.add("profile-open-sheet");
    profilePanel.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open-body");
  };

  const closeProfilePanel = () => {
    if (!profilePanel || !profilePanelSheet) return;
    profilePanel.classList.remove("profile-open");
    profilePanel.classList.add("pointer-events-none", "opacity-0");
    profilePanelSheet.classList.remove("profile-open-sheet");
    profilePanel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open-body");
  };

  userAvatarButton?.addEventListener("click", openProfilePanel);
  closeProfileButton?.addEventListener("click", closeProfilePanel);
  profilePanel?.addEventListener("click", (event) => {
    if (event.target === profilePanel) closeProfilePanel();
  });

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-profile-action]");
    if (!actionButton) return;
    const movieId = actionButton.dataset.profileMovieId;
    const listName = actionButton.dataset.profileList;
    const movie =
      userProfile.favorites.find((item) => Number(item.id) === Number(movieId)) ||
      userProfile.watchLater.find((item) => Number(item.id) === Number(movieId)) ||
      userProfile.history.find((item) => Number(item.id) === Number(movieId));

    if (actionButton.dataset.profileAction === "open") {
      if (openMovieDetails) openMovieDetails(movieId);
      else location.href = `./detalle.html?id=${movieId}`;
    }
    if (actionButton.dataset.profileAction === "remove" && listName) removeFromMovieList(listName, movieId);
    if (actionButton.dataset.profileAction === "move-watch-later") moveFavoriteToWatchLater(movieId);
    if (actionButton.dataset.profileAction === "favorite" && movie) updateMovieList("favorites", movie, true);
  });

  profileNameInput?.addEventListener("input", (event) => {
    userProfile.name = event.target.value.trim() || "Invitado";
    saveProfile();
    if (!editProfileButton) syncProfileToBackend();
    renderProfile();
  });

  profileBioInput?.addEventListener("input", (event) => {
    userProfile.bio = event.target.value.trim();
    saveProfile();
    if (!editProfileButton) syncProfileToBackend();
  });

  profileAvatarUrlInput?.addEventListener("input", (event) => {
    userProfile.avatar = event.target.value.trim();
    saveProfile();
    renderProfile();
  });

  editProfileButton?.addEventListener("click", () => {
    profileEditDraft = { name: userProfile.name, bio: userProfile.bio || "", avatar: userProfile.avatar || "" };
    setProfileEditing(true);
  });

  cancelProfileEditButton?.addEventListener("click", () => {
    if (profileEditDraft) {
      userProfile.name = profileEditDraft.name;
      userProfile.bio = profileEditDraft.bio;
      userProfile.avatar = profileEditDraft.avatar;
      saveProfile();
      renderProfile();
    }
    setProfileEditing(false);
  });

  saveProfileButton?.addEventListener("click", async () => {
    if (!userProfile.name.trim()) {
      showToast("El nombre no puede estar vacio", "neutral");
      return;
    }
    if ((userProfile.bio || "").length > 300) {
      showToast("La bio no puede superar 300 caracteres", "neutral");
      return;
    }
    try {
      await updateBackendProfile({
        name: userProfile.name,
        bio: userProfile.bio || "",
        avatar_url: userProfile.avatar || "",
      });
      await loadBackendProfile();
      setProfileEditing(false);
      showToast("Perfil actualizado", "success");
    } catch (error) {
      showToast(error.message || "No se pudo actualizar el perfil", "error");
    }
  });

  profileAvatarInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      userProfile.avatar = String(reader.result || "");
      saveProfile();
      if (!editProfileButton) syncProfileToBackend();
      renderProfile();
    });
    reader.readAsDataURL(file);
  });

  clearHistoryButton?.addEventListener("click", () => {
    userProfile.history = [];
    saveProfile();
    if (hasAuthToken()) clearBackendHistory().catch(() => showToast("No se pudo limpiar historial remoto", "error"));
    renderProfile();
    showToast("Historial limpiado", "neutral");
  });

  exportFavoritesButton?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(userProfile.favorites, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cineflick-favoritos.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  importFavoritesButton?.addEventListener("click", () => importFavoritesInput?.click());
  importFavoritesInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (Array.isArray(imported)) {
        userProfile.favorites = imported.map(getMovieSnapshot).filter((movie) => movie.id);
        saveProfile();
        renderProfile();
        showToast("Favoritos importados correctamente", "success");
      }
    } catch {
      setApiStatus("Estado perfil: JSON invalido");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfilePanel();
  });
};

export const initProfile = ({ openMovieDetails } = {}) => {
  loadProfile();
  bindProfilePanel({ openMovieDetails });
  renderProfile();
  loadBackendProfile().catch(() => {
    if (hasAuthToken()) showToast("No se pudo cargar tu perfil remoto", "error");
  });
};
