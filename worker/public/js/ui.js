const elements = {};

const IDS = [
  'photo', 'overlay', 'scanEffect', 'loadingState',
  'errorState', 'loadingRover', 'exploreBtn', 'photoCount',
  'roverName', 'cameraName', 'solValue', 'dateValue',
  'idValue', 'errorMsg', 'description', 'fullImageLink',
  'overlayToggle', 'descriptionPanel',
];

export function initUI() {
  for (const id of IDS) {
    elements[id] = document.getElementById(id);
  }
  elements.app = document.querySelector('.app');
}

export function showLoading(query) {
  elements.loadingRover.textContent = query.toUpperCase();
  elements.loadingState.classList.add('active');
  elements.scanEffect.classList.add('active');
  elements.overlay.classList.remove('visible');
  elements.photo.classList.remove('revealed');
  elements.errorState.classList.remove('active');
  elements.exploreBtn.disabled = true;
  setDescriptionExpanded(false);
}

export function showError(message) {
  elements.errorMsg.textContent = message;
  elements.errorState.classList.add('active');
  elements.loadingState.classList.remove('active');
  elements.scanEffect.classList.remove('active');
  elements.exploreBtn.disabled = false;
}

export function showPhoto(photoData) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      elements.photo.src = photoData.imageUrl;

      requestAnimationFrame(() => {
        elements.photo.classList.add('revealed');
        elements.scanEffect.classList.remove('active');
        elements.loadingState.classList.remove('active');

        elements.roverName.textContent = photoData.title;
        elements.cameraName.textContent = photoData.query;
        elements.solValue.textContent = photoData.center;
        elements.dateValue.textContent = photoData.date;
        elements.idValue.textContent = photoData.nasaId;
        elements.description.textContent =
          stripHtml(photoData.description).trim() || 'No description available.';
        elements.fullImageLink.href = photoData.imageUrl;

        setDescriptionExpanded(false);
        elements.overlay.classList.add('visible');
        elements.exploreBtn.disabled = false;

        resolve();
      });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = photoData.imageUrl;
  });
}

export function updatePhotoCount(count) {
  elements.photoCount.textContent =
    `${count} transmission${count !== 1 ? 's' : ''} received`;
}

export function onExploreClick(handler) {
  elements.exploreBtn.addEventListener('click', handler);
}

export function setDescriptionExpanded(expanded) {
  elements.app.classList.toggle('expanded', expanded);
  elements.descriptionPanel.setAttribute('aria-hidden', String(!expanded));
  elements.overlayToggle.setAttribute('aria-expanded', String(expanded));
  elements.overlayToggle.setAttribute(
    'aria-label',
    expanded ? 'Hide description' : 'Show description'
  );
}

export function isDescriptionExpanded() {
  return elements.app.classList.contains('expanded');
}

export function onToggleDescription(handler) {
  elements.overlayToggle.addEventListener('click', handler);
}

export function isInsideDescription(target) {
  return !!target.closest('#descriptionPanel');
}

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
