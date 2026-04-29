import { fetchPhotoIndex, fetchPhoto } from './api.js';
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

let order = [];
let position = -1;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadAt(newPosition, retries = MAX_RETRIES) {
  if (isLoading) return;
  if (!order.length) {
    showError('No photographs available.');
    return;
  }
  isLoading = true;

  showLoading('MARS ARCHIVE');

  try {
    const photo = await fetchPhoto(order[newPosition]);
    await showPhoto(photo);
    position = newPosition;

    totalFetched++;
    updatePhotoCount(totalFetched);
  } catch (err) {
    if (retries > 0) {
      isLoading = false;
      return loadAt(newPosition, retries - 1);
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

  document.addEventListener('click', (e) => {
    if (!isDescriptionExpanded()) return;
    if (e.target.closest('#descriptionPanel')) return;
    if (e.target.closest('#overlayToggle')) return;
    setDescriptionExpanded(false);
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

  loadNextPhoto();
}

init();
