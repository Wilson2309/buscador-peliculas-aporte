import { hideLoader, setApiStatus } from "../core/api.js";
import { getStoredUser, isLoggedIn, logoutUser } from "../core/backendApi.js";
import { initProfile } from "./profile.js";
import { bindGlobalSearch } from "./search.js";
import { bindMovieGridInteractions, openMovieDetails } from "./ui.js";

const profilePanelMarkup = `
  <div
    id="profilePanel"
    class="pointer-events-none fixed inset-0 z-[95] flex items-center justify-end bg-black/70 opacity-0 backdrop-blur-sm transition duration-300"
    aria-hidden="true"
  >
    <div
      id="profilePanelSheet"
      class="mr-0 h-full w-full max-w-md translate-x-full border-l border-white/10 bg-cineDark shadow-2xl transition duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profilePanelTitle"
    >
      <div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-cineGray">Perfil</p>
          <h3 id="profilePanelTitle" class="text-xl font-bold">Tu espacio CineFlick</h3>
        </div>
        <button id="closeProfileButton" type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-cineRed hover:bg-white/5" aria-label="Cerrar perfil">&times;</button>
      </div>
      <div class="profile-dashboard space-y-5 px-5 py-5">
        ${profileDashboardMarkup()}
      </div>
    </div>
  </div>
`;

export function profileDashboardMarkup() {
  return `
    <div class="flex items-center gap-4">
      <div id="profileAvatar" class="profile-avatar flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cineRed to-red-900 text-2xl font-bold">U</div>
      <div class="min-w-0 flex-1">
        <input id="profileNameInput" class="profile-input" type="text" value="Invitado" aria-label="Nombre de usuario" />
        <p id="profileEmailText" class="text-sm text-cineGray">Inicia sesion para sincronizar</p>
        <label class="profile-file-label">
          Cambiar avatar
          <input id="profileAvatarInput" type="file" accept="image/*" hidden />
        </label>
      </div>
    </div>
    <textarea id="profileBioInput" class="profile-input min-h-20 resize-none" placeholder="Bio" aria-label="Bio"></textarea>
    <div class="profile-stats-grid grid grid-cols-2 gap-3">
      <div class="profile-stat-card rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">Favoritos</p>
        <p id="favoritesCount" class="mt-2 text-2xl font-bold">0</p>
      </div>
      <div class="profile-stat-card rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">Pendientes</p>
        <p id="watchLaterCount" class="mt-2 text-2xl font-bold">0</p>
      </div>
      <div class="profile-stat-card rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">Vistas</p>
        <p id="historyCount" class="mt-2 text-2xl font-bold">0</p>
      </div>
      <div class="profile-stat-card rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.16em] text-cineGray">Promedio fav</p>
        <p id="avgRatingStat" class="mt-2 text-sm font-semibold text-white">Sin datos</p>
      </div>
    </div>
    <div class="profile-actions">
      <button id="clearHistoryButton" type="button">Limpiar historial</button>
      <button id="exportFavoritesButton" type="button">Exportar JSON</button>
      <button id="importFavoritesButton" type="button">Importar JSON</button>
      <input id="importFavoritesInput" type="file" accept="application/json" hidden />
    </div>
    <div>
      <h4 class="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-cineGray">Favoritos recientes</h4>
      <div id="favoriteList" class="space-y-3"></div>
    </div>
    <div>
      <h4 class="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-cineGray">Ver mas tarde</h4>
      <div id="watchLaterList" class="space-y-3"></div>
    </div>
    <div>
      <h4 class="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-cineGray">Historial reciente</h4>
      <div id="historyList" class="space-y-3"></div>
    </div>
  `;
}

const loaderMarkup = `
  <div id="loaderOverlay" class="fixed inset-0 z-[100] flex items-center justify-center bg-cineBlack/95 backdrop-blur-sm transition-opacity duration-500" role="status" aria-live="polite" aria-label="Cargando aplicacion">
    <div class="flex flex-col items-center gap-4">
      <div class="h-14 w-14 rounded-full border-4 border-cineGray/20 border-t-cineRed animate-spinSlow"></div>
      <p class="text-sm tracking-[0.28em] text-cineGray uppercase animate-pulseSoft">Cargando CineFlick</p>
    </div>
  </div>
`;

const headerMarkup = `
  <header id="mainNavbar" class="fixed top-0 z-50 w-full border-b border-white/10 bg-cineBlack/70 backdrop-blur-md transition-all duration-300">
    <nav class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <a href="/index.html" class="shrink-0 text-xl font-bold tracking-wide md:text-2xl">
        <span class="text-cineRed">&#127916;</span> CineFlick
      </a>
      <div class="search-shell hidden flex-1 items-center gap-3 md:flex">
        <label for="search-input" class="sr-only">Buscar</label>
        <input id="search-input" type="text" placeholder="Busca peliculas, series o actores..." class="w-full rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm outline-none transition focus:border-cineRed focus:ring-2 focus:ring-cineRed/30" />
        <button id="searchButton" class="rounded-full bg-cineRed px-5 py-2.5 text-sm font-semibold transition hover:scale-105 hover:bg-red-600 hover:shadow-glow" type="button">Buscar</button>
        <div id="searchSuggestions" class="search-suggestions hidden"></div>
      </div>
      <button id="mobileMenuButton" type="button" class="inline-flex items-center justify-center rounded-md p-2 text-cineGray transition hover:bg-white/10 hover:text-white md:hidden" aria-label="Abrir menu" aria-expanded="false" aria-controls="mobileMenu">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div class="hidden items-center gap-5 md:flex">
        <a href="/index.html" class="text-sm text-cineGray transition hover:text-white">Inicio</a>
        <a href="/pages/peliculas.html" class="text-sm text-cineGray transition hover:text-white">Peliculas</a>
        <a href="/pages/tendencias.html" class="text-sm text-cineGray transition hover:text-white">Tendencias</a>
        <a href="/pages/proximamente.html" class="text-sm text-cineGray transition hover:text-white">Proximamente</a>
        <a href="/pages/top-rated.html" class="text-sm text-cineGray transition hover:text-white">Top Rated</a>
        <a href="/pages/perfil.html" class="text-sm text-cineGray transition hover:text-white">Perfil</a>
        <div id="navbarAuthActions" class="flex items-center gap-2">
          <a id="navbarLoginLink" href="/pages/perfil.html" class="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-cineGray transition hover:border-cineRed hover:text-white">Login</a>
          <a id="navbarRegisterLink" href="/pages/perfil.html?auth=register" class="rounded-full bg-cineRed px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">Registro</a>
        </div>
        <button id="userAvatarButton" class="hidden h-9 w-9 rounded-full border border-white/20 bg-gradient-to-br from-zinc-700 to-zinc-900 text-sm font-semibold transition hover:scale-105 hover:border-cineRed" type="button" aria-haspopup="dialog" aria-controls="profilePanel">U</button>
        <button id="navbarLogoutButton" class="hidden rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-cineGray transition hover:border-cineRed hover:text-white" type="button">Salir</button>
      </div>
    </nav>
    <div id="mobileMenu" class="hidden border-t border-white/10 bg-cineDark/95 px-4 py-4 md:hidden" role="navigation" aria-label="Menu movil">
      <div class="mb-4 flex items-center gap-2">
        <div class="search-shell flex-1">
          <input id="mobileSearchInput" type="text" placeholder="Buscar contenido..." class="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm outline-none transition focus:border-cineRed" />
          <div id="mobileSearchSuggestions" class="search-suggestions hidden"></div>
        </div>
        <button id="mobileSearchButton" type="button" class="rounded-full bg-cineRed px-4 py-2 text-sm font-semibold transition hover:bg-red-600">Ir</button>
      </div>
      <div class="flex flex-col gap-3 text-sm">
        <a href="/index.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Inicio</a>
        <a href="/pages/peliculas.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Peliculas</a>
        <a href="/pages/tendencias.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Tendencias</a>
        <a href="/pages/proximamente.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Proximamente</a>
        <a href="/pages/top-rated.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Top Rated</a>
        <a href="/pages/perfil.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Perfil</a>
        <a id="mobileLoginLink" href="/pages/perfil.html" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Login</a>
        <a id="mobileRegisterLink" href="/pages/perfil.html?auth=register" class="rounded-md px-2 py-1.5 text-cineGray transition hover:bg-white/5 hover:text-white">Registro</a>
        <button id="mobileLogoutButton" type="button" class="hidden rounded-md px-2 py-1.5 text-left text-cineGray transition hover:bg-white/5 hover:text-white">Salir</button>
      </div>
    </div>
  </header>
`;

const searchResultsMarkup = `
  <section id="search-results-section" class="search-results-section hidden" aria-live="polite">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-cineGray">Busqueda global</p>
          <h2 class="text-2xl font-bold md:text-3xl">Resultados de busqueda</h2>
        </div>
        <p id="searchResultsCount" class="text-sm text-cineGray">0 resultados</p>
      </div>
      <div id="search-results-grid" class="search-results-grid"></div>
    </div>
  </section>
`;

const modalMarkup = `
  <div id="movie-modal" class="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 opacity-0 backdrop-blur-sm transition duration-300" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div id="modal-content" class="relative w-full max-w-4xl scale-95 overflow-hidden rounded-2xl border border-white/10 bg-cineDark shadow-2xl transition duration-300" role="document">
      <button id="close-modal" type="button" class="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-cineGray transition hover:border-cineRed hover:text-white" aria-label="Cerrar modal">&times;</button>
    </div>
  </div>
`;

const footerMarkup = `
  <footer class="border-t border-white/10 bg-cineDark/80">
    <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-cineGray sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <p>&copy; 2026 CineFlick. Inspirado en plataformas de streaming premium.</p>
      <p id="apiStatus" class="text-xs uppercase tracking-[0.16em]">Estado API TMDB: pendiente de conexion</p>
    </div>
  </footer>
`;

export const mountLayout = ({ profilePanel = true } = {}) => {
  if (!document.getElementById("loaderOverlay")) document.body.insertAdjacentHTML("afterbegin", loaderMarkup);
  if (!document.getElementById("mainNavbar")) document.body.insertAdjacentHTML("afterbegin", headerMarkup);
  const main = document.querySelector("main");
  if (main && !document.getElementById("search-results-section")) main.insertAdjacentHTML("afterbegin", searchResultsMarkup);
  if (!document.querySelector("footer")) document.body.insertAdjacentHTML("beforeend", footerMarkup);
  if (!document.getElementById("movie-modal")) document.body.insertAdjacentHTML("beforeend", modalMarkup);
  if (profilePanel && !document.getElementById("profilePanel")) document.body.insertAdjacentHTML("beforeend", profilePanelMarkup);
};

export const updateNavbarAuth = () => {
  const loggedIn = isLoggedIn();
  const user = getStoredUser();
  const authActions = document.getElementById("navbarAuthActions");
  const avatarButton = document.getElementById("userAvatarButton");
  const logoutButton = document.getElementById("navbarLogoutButton");
  const mobileLogin = document.getElementById("mobileLoginLink");
  const mobileRegister = document.getElementById("mobileRegisterLink");
  const mobileLogout = document.getElementById("mobileLogoutButton");

  authActions?.classList.toggle("hidden", loggedIn);
  avatarButton?.classList.toggle("hidden", !loggedIn);
  logoutButton?.classList.toggle("hidden", !loggedIn);
  mobileLogin?.classList.toggle("hidden", loggedIn);
  mobileRegister?.classList.toggle("hidden", loggedIn);
  mobileLogout?.classList.toggle("hidden", !loggedIn);

  if (avatarButton && loggedIn) {
    const name = user?.nombre || user?.name || user?.email || "U";
    avatarButton.textContent = name.trim().charAt(0).toUpperCase() || "U";
    avatarButton.title = name;
  }
};

export const bindSharedLayout = ({ profilePanel = true } = {}) => {
  const mobileMenuButton = document.getElementById("mobileMenuButton");
  const mobileMenu = document.getElementById("mobileMenu");
  const navbar = document.getElementById("mainNavbar");
  mobileMenuButton?.addEventListener("click", () => {
    const isOpen = !mobileMenu?.classList.contains("hidden");
    mobileMenu?.classList.toggle("hidden", isOpen);
    mobileMenuButton.setAttribute("aria-expanded", String(!isOpen));
  });
  const updateNavbarScroll = () => {
    navbar?.classList.toggle("navbar-scrolled", window.scrollY > 12);
  };
  updateNavbarScroll();
  window.addEventListener("scroll", updateNavbarScroll, { passive: true });
  document.getElementById("navbarLogoutButton")?.addEventListener("click", () => {
    logoutUser();
    location.href = "/pages/perfil.html";
  });
  document.getElementById("mobileLogoutButton")?.addEventListener("click", () => {
    logoutUser();
    location.href = "/pages/perfil.html";
  });

  bindGlobalSearch();
  bindMovieGridInteractions();
  if (profilePanel) initProfile({ openMovieDetails });
  else document.getElementById("userAvatarButton")?.addEventListener("click", () => (location.href = "/pages/perfil.html"));
  updateNavbarAuth();
  document.addEventListener("cineflick:auth-changed", updateNavbarAuth);
  setApiStatus("Estado API/backend: conectado");
  window.addEventListener("load", () => window.setTimeout(hideLoader, 900), { once: true });
};
