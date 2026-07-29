const DATA_URL = 'assets/data/events-2026-08.json';
const IMAGE_BASE = 'assets/images/events/';
const FALLBACK_IMAGE = 'assets/images/sefem-gradient.png';
const AUTO_REFRESH_AFTER = 15 * 60 * 1000;

const state = {
  data: null,
  events: [],
  search: '',
  quick: 'upcoming',
  category: 'all',
  lastFetchAt: 0
};

const els = {
  updatedAt: document.querySelector('#updatedAt'),
  featuredSection: document.querySelector('#featuredSection'),
  featured: document.querySelector('#featuredEvents'),
  list: document.querySelector('#eventList'),
  count: document.querySelector('#resultCount'),
  search: document.querySelector('#searchInput'),
  category: document.querySelector('#categoryFilter'),
  quick: document.querySelector('#quickFilters'),
  dialog: document.querySelector('#eventDialog'),
  dialogContent: document.querySelector('#dialogContent'),
  refreshButton: document.querySelector('#refreshEvents'),
  refreshStatus: document.querySelector('#refreshStatus')
};

const categoryLabels = {
  musica: 'Musica',
  concerti: 'Concerti',
  serate: 'Serate',
  festival: 'Festival',
  experience: 'Experience',
  'food-drink': 'Food & Drink',
  famiglie: 'Famiglie',
  cultura: 'Cultura e spettacoli',
  teatro: 'Teatro',
  cinema: 'Cinema',
  danza: 'Danza',
  tradizione: 'Tradizione',
  mercatini: 'Mercatini',
  natura: 'Natura',
  montagna: 'Montagna',
  sport: 'Sport',
  ciclismo: 'Ciclismo'
};

const dayFmt = new Intl.DateTimeFormat('it-CH', {
  weekday: 'short', day: 'numeric', month: 'short'
});
const dateFmt = new Intl.DateTimeFormat('it-CH', {
  weekday: 'long', day: 'numeric', month: 'long'
});
const updatedFmt = new Intl.DateTimeFormat('it-CH', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[char]));

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseLocalDate(date, time = '00:00') {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  return new Date(`${date}T${safeTime}:00`);
}

function normalizeEvent(event, index) {
  const date = event.date || '';
  const time = event.time || '';
  const endDate = event.endDate || date;
  const endTime = event.endTime || time || '23:59';

  return {
    ...event,
    key: `${slugify(event.title)}-${date || index}`,
    date,
    time,
    endDate,
    endTime,
    place: event.place || '',
    city: event.city || '',
    text: event.text || '',
    image: event.image || '',
    url: event.url || '',
    cta: event.cta || 'Scopri di più',
    categories: Array.isArray(event.categories) ? event.categories : [],
    free: Boolean(event.free),
    featured: Boolean(event.featured),
    start: parseLocalDate(date, time || '00:00'),
    end: parseLocalDate(endDate, endTime)
  };
}

function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase('it')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isPastEvent(event, now = new Date()) {
  return Number.isFinite(event.end.getTime()) && event.end < now;
}

function dateKey(event) {
  return event.date;
}

function imageSrc(event) {
  if (!event.image) return FALLBACK_IMAGE;
  return /^(https?:|\/|assets\/)/.test(event.image)
    ? event.image
    : `${IMAGE_BASE}${event.image}`;
}

function imageMarkup(event, eager = false) {
  const loading = eager ? 'eager' : 'lazy';
  const priority = eager ? ' fetchpriority="high"' : '';
  return `<img src="${escapeHtml(imageSrc(event))}" alt="${escapeHtml(event.title)}" loading="${loading}" decoding="async" width="640" height="800"${priority}>`;
}

function dateParts(event) {
  const date = event.start;
  return {
    month: new Intl.DateTimeFormat('it-CH', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    day: new Intl.DateTimeFormat('it-CH', { day: '2-digit' }).format(date)
  };
}

function eventBadges(event, compact = false) {
  const cls = compact ? 'mini-badge' : 'badge';
  return [
    event.featured ? `<span class="${cls} featured-badge">IN EVIDENZA</span>` : '',
    event.free ? `<span class="${cls} free-badge">GRATIS</span>` : '',
    isPastEvent(event) ? `<span class="${cls} status-ended">CONCLUSO</span>` : ''
  ].join('');
}

function categoryChips(event) {
  return event.categories.slice(0, 2)
    .map(category => `<span>${escapeHtml(categoryLabels[category] || category)}</span>`)
    .join('');
}

function featuredCard(event, index) {
  const date = dateParts(event);
  return `<button class="event-card" data-event="${escapeHtml(event.key)}" type="button">
    <div class="event-image">
      <div class="badges">${eventBadges(event)}</div>
      ${imageMarkup(event, index === 0)}
      <div class="event-date"><span class="month">${date.month}</span><span class="day">${date.day}</span></div>
      <div class="event-categories">${categoryChips(event)}</div>
    </div>
    <div class="card-content">
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(event.place)}${event.city ? `, ${escapeHtml(event.city)}` : ''}</p>
    </div>
  </button>`;
}

function listCard(event) {
  const categories = event.categories.map(category => categoryLabels[category] || category).join(' · ');
  const meta = [event.time, event.place, event.city].filter(Boolean).join(' · ');
  const secondary = [categories, event.free ? 'Ingresso gratuito' : 'Evento a pagamento'].filter(Boolean).join(' · ');

  return `<button class="list-card" data-event="${escapeHtml(event.key)}" type="button">
    <span class="thumb">${imageMarkup(event)}</span>
    <span class="list-main">
      <span class="mini-badges">${eventBadges(event, true)}</span>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(meta)}</p>
      <p>${escapeHtml(secondary)}</p>
    </span>
  </button>`;
}

function populateFilters(events) {
  const selected = state.category;
  const categories = [...new Set(events.flatMap(event => event.categories))].sort();

  els.category.innerHTML = '<option value="all">Tutte</option>' + categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(categoryLabels[category] || category)}</option>`)
    .join('');

  state.category = categories.includes(selected) ? selected : 'all';
  els.category.value = state.category;
}

function matches(event) {
  const haystack = normalize([
    event.title,
    event.text,
    event.place,
    event.city,
    event.categories.join(' ')
  ].join(' '));

  const past = isPastEvent(event);
  const quickMatch =
    (state.quick === 'upcoming' && !past) ||
    (state.quick === 'featured' && !past && event.featured) ||
    (state.quick === 'free' && !past && event.free) ||
    (state.quick === 'past' && past);

  return haystack.includes(normalize(state.search)) &&
    quickMatch &&
    (state.category === 'all' || event.categories.includes(state.category));
}

function render() {
  const direction = state.quick === 'past' ? -1 : 1;
  const filtered = state.events
    .filter(matches)
    .sort((a, b) => direction * (a.start - b.start));

  els.count.textContent = `${filtered.length} ${filtered.length === 1 ? 'evento' : 'eventi'}`;

  if (!filtered.length) {
    els.list.innerHTML = '<div class="empty-state"><h3>Nessun evento trovato.</h3><p>Prova a modificare ricerca o filtri.</p></div>';
    return;
  }

  const groups = filtered.reduce((acc, event) => {
    (acc[dateKey(event)] ||= []).push(event);
    return acc;
  }, {});

  els.list.innerHTML = Object.values(groups).map(items => `
    <section class="date-group">
      <h3 class="date-heading">${escapeHtml(dayFmt.format(items[0].start))}</h3>
      ${items.map(listCard).join('')}
    </section>
  `).join('');
}

function updateInterface() {
  const updated = new Date(state.data.updatedAt);
  els.updatedAt.textContent = Number.isFinite(updated.getTime())
    ? `Aggiornato il ${updatedFmt.format(updated)}`
    : 'Lista aggiornata';

  populateFilters(state.events);

  const featured = state.events
    .filter(event => event.featured && !isPastEvent(event))
    .sort((a, b) => a.start - b.start)
    .slice(0, 6);

  els.featuredSection.hidden = featured.length === 0;
  els.featured.innerHTML = featured.map(featuredCard).join('');
  render();
}

async function loadEvents({ force = false, silent = false } = {}) {
  if (!silent) {
    els.refreshButton.disabled = true;
    els.refreshButton.classList.add('is-loading');
    els.refreshStatus.textContent = 'Aggiornamento in corso…';
  }

  try {
    const separator = DATA_URL.includes('?') ? '&' : '?';
    const url = force ? `${DATA_URL}${separator}v=${Date.now()}` : DATA_URL;
    const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const newData = await response.json();
    const previousVersion = state.data?.updatedAt;
    state.lastFetchAt = Date.now();

    if (state.data && previousVersion === newData.updatedAt) {
      if (!silent) els.refreshStatus.textContent = 'La lista è già aggiornata.';
      return false;
    }

    state.data = newData;
    state.events = (newData.events || []).map(normalizeEvent).filter(event => event.title && event.date);
    updateInterface();

    const currentKey = new URL(location.href).searchParams.get('evento');
    if (currentKey && els.dialog.open) openEvent(currentKey, false);

    if (!silent) els.refreshStatus.textContent = previousVersion ? 'Eventi aggiornati.' : '';
    return true;
  } catch (error) {
    console.error(error);
    if (!silent) els.refreshStatus.textContent = 'Non è stato possibile aggiornare la lista.';
    if (!state.data) {
      els.list.innerHTML = '<div class="empty-state"><h3>Impossibile caricare gli eventi.</h3><p>Controlla la connessione e riprova.</p></div>';
    }
    return false;
  } finally {
    if (!silent) {
      els.refreshButton.disabled = false;
      els.refreshButton.classList.remove('is-loading');
    }
  }
}

function eventDateLabel(event) {
  const date = dateFmt.format(event.start);
  const time = event.time ? ` alle ${event.time}` : '';
  const end = event.endDate !== event.date
    ? ` – ${dateFmt.format(parseLocalDate(event.endDate))}`
    : '';
  return `${date}${time}${end}`;
}

function openEvent(key, updateUrl = true) {
  const event = state.events.find(item => item.key === key);
  if (!event) return;

  const categories = event.categories.map(category => categoryLabels[category] || category).join(' · ');
  const image = escapeHtml(imageSrc(event));

  els.dialogContent.innerHTML = `<article class="dialog-shell">
    <button class="close-dialog" type="button" aria-label="Torna agli eventi">←</button>
    <section class="dialog-hero">
      <img class="dialog-hero-bg" src="${image}" alt="" aria-hidden="true">
      <img class="dialog-hero-image" src="${image}" alt="${escapeHtml(event.title)}" width="960" height="1200">
      <div class="dialog-hero-content">
        <div class="badges">${eventBadges(event)}</div>
        <h2 id="dialogTitle">${escapeHtml(event.title)}</h2>
        <p class="dialog-hero-meta">${escapeHtml(eventDateLabel(event))} · ${escapeHtml(event.place)}${event.city ? `, ${escapeHtml(event.city)}` : ''}</p>
      </div>
    </section>
    <div class="dialog-body">
      ${event.text ? `<p class="dialog-lead">${escapeHtml(event.text)}</p>` : ''}
      <div class="detail-grid">
        <div class="detail-item"><span>Quando</span>${escapeHtml(eventDateLabel(event))}</div>
        <div class="detail-item"><span>Dove</span>${escapeHtml(event.place)}${event.city ? `<br>${escapeHtml(event.city)}` : ''}</div>
        ${categories ? `<div class="detail-item"><span>Categoria</span>${escapeHtml(categories)}</div>` : ''}
        <div class="detail-item"><span>Ingresso</span>${event.free ? 'Ingresso gratuito' : 'Evento a pagamento'}</div>
      </div>
    </div>
    ${event.url ? `<div class="dialog-actions"><a class="primary-action" href="${escapeHtml(event.url)}" target="_blank" rel="noopener">${escapeHtml(event.cta)} ↗</a></div>` : ''}
  </article>`;

  els.dialog.showModal();
  document.body.style.overflow = 'hidden';

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('evento', event.key);
    history.pushState({ event: event.key }, '', url);
  }
}

function closeEvent(updateUrl = true) {
  if (els.dialog.open) els.dialog.close();
  document.body.style.overflow = '';

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.delete('evento');
    history.pushState({}, '', url);
  }
}

function bindEvents() {
  document.addEventListener('click', event => {
    const card = event.target.closest('[data-event]');
    if (card) openEvent(card.dataset.event);
    if (event.target.closest('.close-dialog')) closeEvent();
  });

  els.dialog.addEventListener('click', event => {
    if (event.target === els.dialog) closeEvent();
  });
  els.dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeEvent();
  });
  els.search.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });
  els.category.addEventListener('change', event => {
    state.category = event.target.value;
    render();
  });
  els.quick.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    state.quick = chip.dataset.filter;
    [...els.quick.querySelectorAll('.chip')].forEach(item => item.classList.toggle('active', item === chip));
    render();
  });
  els.refreshButton.addEventListener('click', () => loadEvents({ force: true }));

  addEventListener('popstate', () => {
    const key = new URL(location.href).searchParams.get('evento');
    key ? openEvent(key, false) : closeEvent(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.lastFetchAt > AUTO_REFRESH_AFTER) {
      loadEvents({ force: true, silent: true });
    }
  });

  window.addEventListener('online', () => loadEvents({ force: true, silent: true }));
}

async function init() {
  bindEvents();
  await loadEvents({ force: true, silent: true });
  const key = new URL(location.href).searchParams.get('evento');
  if (key) openEvent(key, false);
}

init();
