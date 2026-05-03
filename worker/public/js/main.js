import { fetchPhotoIndex, fetchPhoto } from './api.js';
import {
  initUI, showLoading, showError, showPhoto, updatePhotoCount,
  onExploreClick, setDescriptionExpanded, isDescriptionExpanded,
  onToggleDescription, isInsideDescription,
} from './ui.js';

const MAX_RETRIES = 3;
const WHEEL_DEBOUNCE_MS = 400;
const WHEEL_THRESHOLD = 20;
const SWIPE_THRESHOLD = 50;

let totalFetched = 0;
let isLoading = false;
let lastWheelAt = 0;

let touchStartX = 0;
let touchStartY = 0;
let touchTracking = false;

let order = [];
let position = -1;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadAt(newPosition, retries = MAX_RETRIES, { updateUrl = true } = {}) {
  if (isLoading) return;
  if (!order.length) {
    showError('No photographs available.');
    return;
  }
  isLoading = true;

  showLoading('MARS ARCHIVE');

  try {
    const id = order[newPosition];
    const photo = await fetchPhoto(id);
    await showPhoto(photo);
    position = newPosition;

    if (updateUrl) {
      const target = `/photo/${encodeURIComponent(id)}`;
      if (window.location.pathname !== target) {
        history.pushState({ id }, '', target);
      }
    }

    totalFetched++;
    updatePhotoCount(totalFetched);
  } catch (err) {
    if (retries > 0) {
      isLoading = false;
      return loadAt(newPosition, retries - 1, { updateUrl });
    }
    showError('Transmission interrupted. Check connection and retry.');
  }

  isLoading = false;
}

function loadNextPhoto() {
  let next = position + 1;
  if (next >= order.length) {
    shuffleInPlace(order);
    next = 0;
    position = -1;
  }
  return loadAt(next);
}

function loadPreviousPhoto() {
  if (position <= 0) return;
  return loadAt(position - 1);
}

function handleTouchStart(e) {
  if (e.touches.length !== 1) {
    touchTracking = false;
    return;
  }
  if (isInsideDescription(e.target)) {
    touchTracking = false;
    return;
  }
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchTracking = true;
}

function handleTouchEnd(e) {
  if (!touchTracking) return;
  touchTracking = false;
  if (isLoading) return;
  if (e.changedTouches.length !== 1) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

  if (absDx > absDy) {
    if (dx < 0) loadNextPhoto();
    else loadPreviousPhoto();
  } else {
    setDescriptionExpanded(dy < 0);
  }
}

function handleWheel(e) {
  if (isLoading) return;
  if (isInsideDescription(e.target)) return;

  const now = Date.now();
  if (now - lastWheelAt < WHEEL_DEBOUNCE_MS) return;

  if (e.deltaY > WHEEL_THRESHOLD) {
    lastWheelAt = now;
    setDescriptionExpanded(true);
  } else if (e.deltaY < -WHEEL_THRESHOLD) {
    lastWheelAt = now;
    setDescriptionExpanded(false);
  }
}

async function init() {
  initUI();
  onExploreClick(() => loadNextPhoto());
  onToggleDescription(() => setDescriptionExpanded(!isDescriptionExpanded()));

  document.addEventListener('keydown', (e) => {
    if (isLoading) return;
    if (e.code === 'Space' || e.code === 'ArrowRight') {
      e.preventDefault();
      loadNextPhoto();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      loadPreviousPhoto();
    }
  });

  document.addEventListener('wheel', handleWheel, { passive: true });
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });

  document.addEventListener('click', (e) => {
    if (!isDescriptionExpanded()) return;
    if (e.target.closest('#descriptionPanel')) return;
    if (e.target.closest('#overlayToggle')) return;
    setDescriptionExpanded(false);
  });

  window.addEventListener('popstate', () => {
    const id = idFromPath(window.location.pathname);
    if (id) {
      const idx = order.indexOf(id);
      if (idx !== -1) loadAt(idx, MAX_RETRIES, { updateUrl: false });
    }
  });

  showLoading('MARS ARCHIVE');
  try {
    const ids = await fetchPhotoIndex();
    order = shuffleInPlace(ids.slice());
    position = -1;
  } catch (err) {
    showError('Transmission interrupted. Check connection and retry.');
    return;
  }

  const initialId = idFromPath(window.location.pathname);
  if (initialId) {
    const idx = order.indexOf(initialId);
    if (idx !== -1) {
      return loadAt(idx, MAX_RETRIES, { updateUrl: false });
    }
  }

  loadNextPhoto();
}

function idFromPath(pathname) {
  if (!pathname.startsWith('/photo/')) return null;
  try {
    return decodeURIComponent(pathname.slice('/photo/'.length));
  } catch {
    return null;
  }
}

init();
