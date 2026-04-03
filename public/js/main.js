import { pickRandomQuery, fetchRandomPhoto } from './api.js';
import { initUI, showLoading, showError, showPhoto, updatePhotoCount, onExploreClick } from './ui.js';

const MAX_RETRIES = 3;
let totalFetched = 0;
let isLoading = false;

async function loadRandomPhoto(retries = MAX_RETRIES) {
  if (isLoading) return;
  isLoading = true;

  const query = pickRandomQuery();
  showLoading(query);

  try {
    const photo = await fetchRandomPhoto(query);

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

function init() {
  initUI();
  onExploreClick(() => loadRandomPhoto());

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isLoading) {
      e.preventDefault();
      loadRandomPhoto();
    }
  });

  loadRandomPhoto();
}

init();
