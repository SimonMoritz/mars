const els = {
    photo: document.getElementById('photo'),
    overlay: document.getElementById('overlay'),
    title: document.getElementById('title'),
    subtitle: document.getElementById('subtitle'),
    center: document.getElementById('center'),
    date: document.getElementById('date'),
    nasaId: document.getElementById('nasaId'),
    count: document.getElementById('count'),
    keepBtn: document.getElementById('keepBtn'),
    rejectBtn: document.getElementById('rejectBtn'),
    undoBtn: document.getElementById('undoBtn'),
    finalizeBtn: document.getElementById('finalizeBtn'),
    finalizeBtn2: document.getElementById('finalizeBtn2'),
    loading: document.getElementById('loadingState'),
    error: document.getElementById('errorState'),
    errorMsg: document.getElementById('errorMsg'),
    done: document.getElementById('doneState'),
    doneSub: document.getElementById('doneSub'),
};

let current = null;
let busy = false;

function setLoading(on) { els.loading.classList.toggle('active', on); }
function setError(msg) {
    els.errorMsg.textContent = msg;
    els.error.classList.add('active');
}
function clearError() { els.error.classList.remove('active'); }

function renderCounts(c) {
    if (!c) return;
    els.count.textContent = `${c.reviewed}/${c.total} · ${c.kept} kept · ${c.rejected} rejected`;
}

function renderPhoto(data) {
    current = data;
    const { photo, filename } = data;
    els.title.textContent = photo.title || 'Untitled';
    els.subtitle.textContent = photo.query || '';
    els.center.textContent = photo.center || '';
    els.date.textContent = photo.date || '';
    els.nasaId.textContent = photo.nasaId;

    els.photo.classList.remove('revealed');
    els.overlay.classList.remove('visible');
    els.photo.src = `/img/${encodeURIComponent(filename)}`;
    els.photo.onload = () => {
        els.photo.classList.add('revealed');
        els.overlay.classList.add('visible');
    };
    els.photo.onerror = () => setError(`Failed to load image: ${filename}`);

    renderCounts(data);
}

function renderDone(c) {
    els.photo.classList.remove('revealed');
    els.overlay.classList.remove('visible');
    els.done.classList.add('active');
    els.doneSub.textContent = `${c.kept} kept · ${c.rejected} rejected out of ${c.total}`;
    renderCounts(c);
}

async function loadNext() {
    if (busy) return;
    busy = true;
    clearError();
    setLoading(true);
    try {
        const res = await fetch('/api/next');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (data.stale) {
            busy = false;
            setLoading(false);
            return loadNext();
        }
        if (data.done) {
            renderDone(data);
        } else {
            renderPhoto(data);
        }
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
        busy = false;
    }
}

async function decide(keep) {
    if (!current || busy) return;
    busy = true;
    try {
        const res = await fetch('/api/decide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nasaId: current.photo.nasaId, keep }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        renderCounts(data);
    } catch (err) {
        setError(err.message);
        busy = false;
        return;
    }
    busy = false;
    loadNext();
}

async function undo() {
    if (busy) return;
    busy = true;
    try {
        els.done.classList.remove('active');
        const res = await fetch('/api/undo', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        renderCounts(data);
    } catch (err) {
        setError(err.message);
    } finally {
        busy = false;
    }
    loadNext();
}

async function finalize() {
    if (busy) return;
    busy = true;
    try {
        const res = await fetch('/api/finalize', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        alert(`Wrote ${data.kept} photos to output.reviewed.json`);
    } catch (err) {
        setError(err.message);
    } finally {
        busy = false;
    }
}

els.keepBtn.addEventListener('click', () => decide(true));
els.rejectBtn.addEventListener('click', () => decide(false));
els.undoBtn.addEventListener('click', undo);
els.finalizeBtn.addEventListener('click', finalize);
els.finalizeBtn2.addEventListener('click', finalize);

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'k') { e.preventDefault(); decide(true); }
    else if (k === 'arrowleft' || k === 'r') { e.preventDefault(); decide(false); }
    else if (k === 'u') { e.preventDefault(); undo(); }
});

loadNext();
