const DATA_URL = 'assets/data/events-2026-08.json';
const AUTO_REFRESH_AFTER = 15 * 60 * 1000;

const state = {
  data: null,
  search: '',
  quick: 'upcoming',
  category: 'all',
  region: 'all',
  lastFetchAt: 0
};
const els = {
  updatedAt: document.querySelector('#updatedAt'),
  featured: document.querySelector('#featuredEvents'),
  list: document.querySelector('#eventList'),
  count: document.querySelector('#resultCount'),
  search: document.querySelector('#searchInput'),
  category: document.querySelector('#categoryFilter'),
  region: document.querySelector('#regionFilter'),
  quick: document.querySelector('#quickFilters'),
  dialog: document.querySelector('#eventDialog'),
  dialogContent: document.querySelector('#dialogContent'),
  refreshButton: document.querySelector('#refreshEvents'),
  refreshStatus: document.querySelector('#refreshStatus')
};
const categoryLabels = { musica: 'Musica', concerti: 'Concerti', serate: 'Serate', 'food-drink': 'Food & Drink', famiglie: 'Famiglie', 'cultura-spettacoli': 'Cultura e spettacoli', experience: 'Experience' };
const monthFmt = new Intl.DateTimeFormat('it-CH', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('it-CH', { weekday: 'short', day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('it-CH', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('it-CH', { hour: '2-digit', minute: '2-digit' });
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
function editorialBadges(event, compact = false) {
  const cls = compact ? 'mini-badge' : 'badge';
  return [event.editorial?.meseXMese ? `<span class="${cls} mese">MESE X MESE</span>` : '', event.editorial?.selecta ? `<span class="${cls} selecta">SELECTA</span>` : ''].join('');
}
function dateKey(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function normalize(value) { return String(value ?? '').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function eventEndDate(event) {
  return new Date(event.endDate || event.startDate);
}
function isPastEvent(event, now = new Date()) {
  const end = eventEndDate(event);
  return Number.isFinite(end.getTime()) && end < now;
}
function isLiveEvent(event, now = new Date()) {
  const start = new Date(event.startDate);
  const end = eventEndDate(event);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start <= now && end >= now;
}
function lifecycleBadge(event, compact = false) {
  if (!isPastEvent(event)) return '';
  const cls = compact ? 'mini-badge status-ended' : 'badge status-ended';
  return `<span class="${cls}">CONCLUSO</span>`;
}
function updateInterface() {
  const updated = new Date(state.data.lastUpdated);

  els.updatedAt.textContent =
      `Aggiornato il ${
          new Intl.DateTimeFormat('it-CH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(updated)
      }`;

  const events = state.data.events.filter(event => event.published);

  populateFilters(events);

  const featured = events
      .filter(event =>
          !isPastEvent(event) &&
          (event.editorial?.meseXMese || event.editorial?.selecta)
      )
      .sort(
          (a, b) =>
              (b.editorial?.priority || 0) -
              (a.editorial?.priority || 0)
      );

  els.featured.innerHTML = featured
      .map(featuredCard)
      .join('');

  render();
}
async function loadEvents({
                            force = false,
                            silent = false
                          } = {}) {
  if (!silent) {
    els.refreshButton.disabled = true;
    els.refreshButton.classList.add('is-loading');
    els.refreshStatus.textContent = 'Aggiornamento in corso…';
  }

  try {
    const separator = DATA_URL.includes('?') ? '&' : '?';
    const url = force
        ? `${DATA_URL}${separator}v=${Date.now()}`
        : DATA_URL;

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const newData = await response.json();
    const previousVersion =
        state.data?.version ||
        state.data?.lastUpdated;

    const newVersion =
        newData.version ||
        newData.lastUpdated;

    state.lastFetchAt = Date.now();

    if (state.data && previousVersion === newVersion) {
      if (!silent) {
        els.refreshStatus.textContent =
            'La lista è già aggiornata.';
      }

      return false;
    }

    state.data = newData;
    updateInterface();

    const currentSlug = new URL(location.href)
        .searchParams
        .get('evento');

    if (currentSlug && els.dialog.open) {
      openEvent(currentSlug, false);
    }

    if (!silent) {
      els.refreshStatus.textContent =
          previousVersion
              ? 'La lista degli eventi è stata aggiornata.'
              : '';
    }

    return true;
  } catch (error) {
    console.error(error);

    if (!silent) {
      els.refreshStatus.textContent =
          'Non è stato possibile aggiornare la lista.';
    }

    if (!state.data) {
      els.list.innerHTML = `
        <div class="empty-state">
          <h3>Impossibile caricare gli eventi.</h3>
          <p>Controlla la connessione e riprova.</p>
        </div>
      `;
    }

    return false;
  } finally {
    if (!silent) {
      els.refreshButton.disabled = false;
      els.refreshButton.classList.remove('is-loading');
    }
  }
}
function populateFilters(events) {
  const selectedCategory = state.category;
  const selectedRegion = state.region;

  els.category.innerHTML = '<option value="all">Tutte</option>';
  els.region.innerHTML = '<option value="all">Tutto il Ticino</option>';

  [...new Set(events.flatMap(event => event.categories))]
      .sort()
      .forEach(category => {
        els.category.insertAdjacentHTML(
            'beforeend',
            `<option value="${escapeHtml(category)}">
          ${escapeHtml(categoryLabels[category] || category)}
        </option>`
        );
      });

  [...new Set(events.map(event => event.location.region))]
      .sort()
      .forEach(region => {
        els.region.insertAdjacentHTML(
            'beforeend',
            `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`
        );
      });

  const categoryExists = [...els.category.options]
      .some(option => option.value === selectedCategory);

  const regionExists = [...els.region.options]
      .some(option => option.value === selectedRegion);

  state.category = categoryExists ? selectedCategory : 'all';
  state.region = regionExists ? selectedRegion : 'all';

  els.category.value = state.category;
  els.region.value = state.region;
}
function imageMarkup(event, className = '') {
  const src = escapeHtml(event.image?.src || 'assets/images/sefem-gradient.png');
  const alt = escapeHtml(event.image?.alt || event.title);
  return `<img class="${className}" src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
}
function dateParts(value) {
  const date = new Date(value);
  return {
    month: new Intl.DateTimeFormat('it-CH', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    day: new Intl.DateTimeFormat('it-CH', { day: '2-digit' }).format(date)
  };
}
function categoryChips(event) {
  return event.categories.slice(0, 2).map(c => `<span>${escapeHtml(categoryLabels[c] || c)}</span>`).join('');
}
function featuredCard(event) {
  const date = dateParts(event.startDate);
  return `<button class="event-card" data-event="${escapeHtml(event.slug)}" type="button">
    <div class="event-image">
      <div class="badges">${editorialBadges(event)}${lifecycleBadge(event)}</div>
      ${imageMarkup(event)}
      <div class="event-date"><span class="month">${date.month}</span><span class="day">${date.day}</span></div>
      <div class="event-categories">${categoryChips(event)}</div>
    </div>
    <div class="card-content">
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(event.location.name)}, ${escapeHtml(event.location.city)}</p>
    </div>
  </button>`;
}
function listCard(event) {
  const categories = event.categories.map(c => categoryLabels[c] || c).join(' · ');
  return `<button class="list-card" data-event="${escapeHtml(event.slug)}" type="button">
    <span class="thumb">${imageMarkup(event)}</span>
    <span class="list-main">
      <span class="mini-badges">${editorialBadges(event, true)}${lifecycleBadge(event, true)}</span>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(timeFmt.format(new Date(event.startDate)))} · ${escapeHtml(event.location.name)}, ${escapeHtml(event.location.city)}</p>
      <p>${escapeHtml(categories)} · ${escapeHtml(event.pricing.label)}</p>
    </span>
  </button>`;
}
function matches(event) {
  const haystack = normalize([
    event.title,
    event.summary,
    event.location.name,
    event.location.city,
    event.location.region,
    event.categories.join(' ')
  ].join(' '));

  const past = isPastEvent(event);
  const quickMatch =
    (state.quick === 'upcoming' && !past) ||
    (state.quick === 'past' && past) ||
    (state.quick === 'meseXMese' && !past && event.editorial?.meseXMese) ||
    (state.quick === 'selecta' && !past && event.editorial?.selecta) ||
    (state.quick === 'free' && !past && event.pricing?.type === 'free');

  return haystack.includes(normalize(state.search)) &&
    quickMatch &&
    (state.category === 'all' || event.categories.includes(state.category)) &&
    (state.region === 'all' || event.location.region === state.region);
}
function render() {
  const events = state.data.events
    .filter(event => event.published)
    .sort((a, b) => {
      const direction = state.quick === 'past' ? -1 : 1;
      return direction * (new Date(a.startDate) - new Date(b.startDate));
    });
  const filtered = events.filter(matches);
  els.count.textContent = `${filtered.length} ${filtered.length === 1 ? 'evento' : 'eventi'}`;
  if (!filtered.length) { els.list.innerHTML = '<div class="empty-state"><h3>Nessun evento trovato.</h3><p>Prova a modificare ricerca o filtri.</p></div>'; return; }
  const groups = Object.groupBy ? Object.groupBy(filtered, e => dateKey(e.startDate)) : filtered.reduce((acc,e) => ((acc[dateKey(e.startDate)] ||= []).push(e), acc), {});
  els.list.innerHTML = Object.entries(groups).map(([, items]) => `<section class="date-group"><h3 class="date-heading">${escapeHtml(dayFmt.format(new Date(items[0].startDate)))}</h3>${items.map(listCard).join('')}</section>`).join('');
}
function openEvent(slug, updateUrl = true) {
  const event = state.data.events.find(e => e.slug === slug); if (!event) return;
  const categories = event.categories.map(c => categoryLabels[c] || c).join(' · ');
  const action = event.links.tickets || event.links.official;
  const imageSrc = escapeHtml(event.image?.src || 'assets/images/sefem-gradient.png');
  const imageAlt = escapeHtml(event.image?.alt || event.title);
  els.dialogContent.innerHTML = `<article class="dialog-shell">
    <button class="close-dialog" type="button" aria-label="Torna agli eventi">←</button>
    <section class="dialog-hero">
      <img class="dialog-hero-bg" src="${imageSrc}" alt="" aria-hidden="true">
      <img class="dialog-hero-image" src="${imageSrc}" alt="${imageAlt}">
      <div class="dialog-hero-content">
        <div class="badges">${editorialBadges(event)}${lifecycleBadge(event)}</div>
        <h2 id="dialogTitle">${escapeHtml(event.title)}</h2>
        <p class="dialog-hero-meta">${escapeHtml(fullFmt.format(new Date(event.startDate)))} · ${escapeHtml(event.location.name)}, ${escapeHtml(event.location.city)}</p>
      </div>
    </section>
    <div class="dialog-body">
      <p class="dialog-lead">${escapeHtml(event.summary)}</p>
      <div class="detail-grid">
        <div class="detail-item"><span>Quando</span>${escapeHtml(fullFmt.format(new Date(event.startDate)))}</div>
        <div class="detail-item"><span>Dove</span>${escapeHtml(event.location.name)}<br>${escapeHtml(event.location.city)} · ${escapeHtml(event.location.region)}</div>
        <div class="detail-item"><span>Categoria</span>${escapeHtml(categories)}</div>
        <div class="detail-item"><span>Ingresso</span>${escapeHtml(event.pricing.label)}</div>
      </div>
      <p class="dialog-description">${escapeHtml(event.description)}</p>
    </div>
    ${action ? `<div class="dialog-actions"><a class="primary-action" href="${escapeHtml(action)}" target="_blank" rel="noopener">Vai al sito dell’evento ↗</a></div>` : ''}
  </article>`;
  els.dialog.showModal(); document.body.style.overflow = 'hidden';
  if (updateUrl) { const url = new URL(location.href); url.searchParams.set('evento', slug); history.pushState({event: slug}, '', url); }
}
function closeEvent(updateUrl = true) {
  if (els.dialog.open) els.dialog.close(); document.body.style.overflow = '';
  if (updateUrl) { const url = new URL(location.href); url.searchParams.delete('evento'); history.pushState({}, '', url); }
}

function bindEvents() {
  document.addEventListener('click', e => { const card = e.target.closest('[data-event]'); if (card) openEvent(card.dataset.event); if (e.target.closest('.close-dialog')) closeEvent(); });
  els.dialog.addEventListener('click', e => { if (e.target === els.dialog) closeEvent(); });
  els.dialog.addEventListener('cancel', e => { e.preventDefault(); closeEvent(); });
  els.search.addEventListener('input', e => { state.search = e.target.value; render(); });
  els.category.addEventListener('change', e => { state.category = e.target.value; render(); });
  els.region.addEventListener('change', e => { state.region = e.target.value; render(); });
  els.quick.addEventListener('click', e => { const chip = e.target.closest('.chip'); if (!chip) return; state.quick = chip.dataset.filter; [...els.quick.querySelectorAll('.chip')].forEach(c => c.classList.toggle('active', c === chip)); render(); });
  addEventListener('popstate', () => { const slug = new URL(location.href).searchParams.get('evento'); slug ? openEvent(slug, false) : closeEvent(false); });
  els.refreshButton.addEventListener('click', () => {
    loadEvents({ force: true });
  });

  document.addEventListener('visibilitychange', () => {
    const pageIsVisible =
        document.visibilityState === 'visible';

    const dataIsOld =
        Date.now() - state.lastFetchAt > AUTO_REFRESH_AFTER;

    if (pageIsVisible && dataIsOld) {
      loadEvents({
        force: true,
        silent: true
      });
    }
  });

  window.addEventListener('online', () => {
    loadEvents({
      force: true,
      silent: true
    });
  });
}
async function init() {
  bindEvents();

  const loaded = await loadEvents({
    force: true,
    silent: true
  });

  if (!loaded && !state.data) {
    return;
  }

  const slug = new URL(location.href)
      .searchParams
      .get('evento');

  if (slug) {
    openEvent(slug, false);
  }
}

init();
