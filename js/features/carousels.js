const carouselTimers = new Map();
const carouselResumeTimers = new Map();
const carouselAnimations = new Map();
const visibleCarousels = new Set();
let carouselObserver = null;
let scrollStopTimer = null;

const getCarousel = (carouselId = "movies-grid") => document.getElementById(carouselId);

export const getCarouselIds = () => {
  const ids = new Set();
  document.querySelectorAll("[data-carousel-prev], [data-carousel-next]").forEach((button) => {
    const targetId = button.dataset.carouselPrev || button.dataset.carouselNext;
    if (targetId) ids.add(targetId);
  });
  document.querySelectorAll(".no-scrollbar[id]").forEach((carousel) => ids.add(carousel.id));
  return [...ids];
};

const getCarouselStep = (carousel) => {
  const firstCard = carousel.querySelector(".tmdb-card");
  if (!firstCard) return Math.max(carousel.clientWidth * 0.74, 260);
  const styles = window.getComputedStyle(carousel);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || "16") || 16;
  return firstCard.getBoundingClientRect().width + gap;
};

const animateCarouselTo = (carousel, targetLeft, duration = 950) => {
  const carouselId = carousel.id || "movies-grid";
  const currentAnimation = carouselAnimations.get(carouselId);
  if (currentAnimation) window.cancelAnimationFrame(currentAnimation);

  const startLeft = carousel.scrollLeft;
  const maxLeft = Math.max(carousel.scrollWidth - carousel.clientWidth, 0);
  const finalLeft = Math.max(0, Math.min(targetLeft, maxLeft));
  const distance = finalLeft - startLeft;
  if (Math.abs(distance) < 1) return;

  const startedAt = performance.now();
  carousel.classList.add("carousel-gliding");

  const tick = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    carousel.scrollLeft = startLeft + distance * eased;
    if (progress < 1) {
      carouselAnimations.set(carouselId, window.requestAnimationFrame(tick));
      return;
    }
    carousel.scrollLeft = finalLeft;
    carousel.classList.remove("carousel-gliding");
    carouselAnimations.delete(carouselId);
  };

  carouselAnimations.set(carouselId, window.requestAnimationFrame(tick));
};

export const scrollCarousel = (carouselId = "movies-grid", direction = 1) => {
  const carousel = getCarousel(carouselId);
  if (!carousel) return;
  const step = getCarouselStep(carousel);
  const maxLeft = Math.max(carousel.scrollWidth - carousel.clientWidth, 0);
  const isAtEnd = carousel.scrollLeft >= maxLeft - 8;
  const isAtStart = carousel.scrollLeft <= 8;
  const shouldLoopForward = direction > 0 && isAtEnd;
  const shouldLoopBackward = direction < 0 && isAtStart;
  const targetLeft = shouldLoopForward ? 0 : shouldLoopBackward ? maxLeft : carousel.scrollLeft + step * direction;
  animateCarouselTo(carousel, targetLeft, shouldLoopForward || shouldLoopBackward ? 1250 : 950);
};

export const stopCarousel = (carouselId = "movies-grid") => {
  window.clearInterval(carouselTimers.get(carouselId));
  window.clearTimeout(carouselResumeTimers.get(carouselId));
  carouselTimers.delete(carouselId);
  carouselResumeTimers.delete(carouselId);
};

export const startCarousel = (carouselId = "movies-grid") => {
  const carousel = getCarousel(carouselId);
  if (!carousel) return;
  stopCarousel(carouselId);
  if (carousel.scrollWidth <= carousel.clientWidth + 8) return;
  if (carouselObserver && !visibleCarousels.has(carouselId)) return;

  carousel.classList.add("cinematic-carousel");
  carouselTimers.set(
    carouselId,
    window.setInterval(() => {
      if (document.hidden || !visibleCarousels.has(carouselId)) return;
      if (carousel.matches(":hover") || carousel.contains(document.activeElement)) return;
      scrollCarousel(carouselId, 1);
    }, 4000)
  );
};

export const restartCarousel = (carouselId = "movies-grid", delay = 500) => {
  stopCarousel(carouselId);
  carouselResumeTimers.set(carouselId, window.setTimeout(() => startCarousel(carouselId), delay));
};

export const observeCarousel = (carouselId = "movies-grid") => {
  const carousel = getCarousel(carouselId);
  if (!carousel) return;

  if (!carouselObserver && "IntersectionObserver" in window) {
    carouselObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (!id) return;
          if (entry.isIntersecting) {
            visibleCarousels.add(id);
            restartCarousel(id, 350);
            return;
          }
          visibleCarousels.delete(id);
          stopCarousel(id);
        });
      },
      { threshold: 0.18, rootMargin: "120px 0px" }
    );
  }

  if (!carouselObserver) {
    visibleCarousels.add(carouselId);
    return;
  }
  if (carousel.dataset.carouselObserved === "true") return;
  carousel.dataset.carouselObserved = "true";
  carouselObserver.observe(carousel);
};

export const restartAllCarousels = () => {
  getCarouselIds().forEach((carouselId) => {
    observeCarousel(carouselId);
    restartCarousel(carouselId);
  });
};

export const bindCarouselControls = () => {
  document.addEventListener("click", (event) => {
    const previous = event.target.closest("[data-carousel-prev]");
    const next = event.target.closest("[data-carousel-next]");
    if (!previous && !next) return;
    const carouselId = previous?.dataset.carouselPrev || next?.dataset.carouselNext || "movies-grid";
    scrollCarousel(carouselId, previous ? -1 : 1);
    restartCarousel(carouselId, 2400);
  });

  getCarouselIds().forEach((carouselId) => {
    const carousel = getCarousel(carouselId);
    if (!carousel || carousel.dataset.carouselBound === "true") return;
    carousel.dataset.carouselBound = "true";
    ["mouseenter", "focusin", "touchstart"].forEach((eventName) => {
      carousel.addEventListener(eventName, () => stopCarousel(carouselId), { passive: true });
    });
    ["mouseleave", "focusout", "touchend"].forEach((eventName) => {
      carousel.addEventListener(eventName, () => restartCarousel(carouselId, 1800), { passive: true });
    });
  });

  window.addEventListener(
    "scroll",
    () => {
      document.body.classList.add("is-scrolling");
      window.clearTimeout(scrollStopTimer);
      scrollStopTimer = window.setTimeout(() => document.body.classList.remove("is-scrolling"), 160);
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      getCarouselIds().forEach(stopCarousel);
      return;
    }
    restartAllCarousels();
  });
};
