import { fetchRandomPhoto } from './api.js';
import {
  initUI, showLoading, showError, showPhoto, updatePhotoCount,
  onExploreClick, setDescriptionExpanded, isDescriptionExpanded,
  onToggleDescription, isInsideDescription,
} from './ui.js';

const MAX_RETRIES = 3;
const WHEEL_DEBOUNCE_MS = 400;
const WHEEL_THRESHOLD = 20;

let totalFetched = 0;
let isLoading = false;
let lastWheelAt = 0;

async function loadRandomPhoto(retries = MAX_RETRIES) {
  if (isLoading) return;
  isLoading = true;

  showLoading('MARS ARCHIVE');

  try {
    const photo = await fetchRandomPhoto();

    if (!photo) {
      if (retries > 0) {
        isLoading = false;
        return loadRandomPhoto(retries - 1);
      }
      showError('No photographs found at this location. Try again.');
      isLoading = false;
      return;
    }

    await showPhoto(photo);

    totalFetched++;
    updatePhotoCount(totalFetched);
  } catch (err) {
    if (retries > 0) {
      isLoading = false;
      return loadRandomPhoto(retries - 1);
    }
    showError('Transmission interrupted. Check connection and retry.');
  }

  isLoading = false;
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

function init() {
  initUI();
  onExploreClick(() => loadRandomPhoto());
  onToggleDescription(() => setDescriptionExpanded(!isDescriptionExpanded()));

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isLoading) {
      e.preventDefault();
      loadRandomPhoto();
    }
  });

  document.addEventListener('wheel', handleWheel, { passive: true });

  document.addEventListener('click', (e) => {
    if (!isDescriptionExpanded()) return;
    if (e.target.closest('#descriptionPanel')) return;
    if (e.target.closest('#overlayToggle')) return;
    setDescriptionExpanded(false);
  });

  loadRandomPhoto();
}

init();
