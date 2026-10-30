// Petits outils d'interface partagés par tous les modules

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const fcfa = n => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)).replace(/ /g, ' ') + ' FCFA';

// Lien WhatsApp ; numéro togolais à 8 chiffres → +228
export function waLink(tel, text = '') {
  let n = String(tel || '').replace(/[^\d+]/g, '');
  if (!n) return null;
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.length === 8) n = '228' + n;
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

// Liens sûrs uniquement (http/https)
export const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null;

let toastTimer;
export function toast(msg, type = '') {
  let el = $('#toast');
  if (!el) { el = h('<div id="toast" role="status" aria-live="polite"></div>'); document.body.append(el); }
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 2800);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copié ✓'); }
  catch { toast('Copie impossible', 'err'); }
}

// ---------- Feuille modale (bottom sheet) ----------
export function sheet(title, body, { wide = false } = {}) {
  const el = h(`<div class="sheet-wrap" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet ${wide ? 'wide' : ''}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">${ICON.x}</button></div>
      <div class="sheet-body"></div>
    </div></div>`);
  const bodyEl = $('.sheet-body', el);
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.append(body);
  const close = () => { el.classList.add('closing'); setTimeout(() => el.remove(), 180); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(el);
  return { el, body: bodyEl, close };
}

export function confirmBox(message, okLabel = 'Supprimer') {
  return new Promise(resolve => {
    const s = sheet('Confirmation', `<p class="muted">${esc(message)}</p>
      <div class="row-btns"><button class="btn ghost" data-no>Annuler</button><button class="btn danger" data-yes>${esc(okLabel)}</button></div>`);
    $('[data-no]', s.el).onclick = () => { s.close(); resolve(false); };
    $('[data-yes]', s.el).onclick = () => { s.close(); resolve(true); };
  });
}

// ---------- Formulaire générique ----------
// fields: [{ name, label, type: text|textarea|select|date|time|number|tel|email|url|checks|datalist, options, placeholder, required, full }]
export function formHtml(fields, values = {}) {
  return fields.map(f => {
    const v = values[f.name] ?? f.default ?? '';
    const id = 'f_' + f.name;
    const req = f.required ? 'required' : '';
    let input;
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(v)}</textarea>`; break;
      case 'select':
        input = `<select id="${id}" name="${f.name}" ${req}>${f.options.map(o => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}</select>`; break;
      case 'datalist':
        input = `<input id="${id}" name="${f.name}" list="${id}_l" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${req} autocomplete="off">
          <datalist id="${id}_l">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`; break;
      case 'checks': {
        const checked = new Set(Array.isArray(v) ? v : []);
        input = `<div class="checks">${f.options.map(o => `<label class="check"><input type="checkbox" name="${f.name}" value="${esc(o)}" ${checked.has(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`; break;
      }
      default:
        input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${req}
          ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''} ${f.type === 'tel' ? 'inputmode="tel"' : ''}>`;
    }
    return `<div class="field ${f.half ? 'half' : ''}"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
  }).join('');
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'checks') out[f.name] = $$(`input[name="${f.name}"]:checked`, form).map(i => i.value);
    else {
      const el = form.elements[f.name];
      let v = el ? el.value.trim() : '';
      if (f.type === 'number') v = v === '' ? '' : Number(v.replace(',', '.'));
      out[f.name] = v;
    }
  }
  return out;
}

/** Ouvre un formulaire dans une feuille. onSave(values) peut être async. */
export function formSheet({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Enregistrer', extraTop = '' }) {
  const form = h(`<form class="form" novalidate>${extraTop}<div class="grid">${formHtml(fields, values)}</div>
    <div class="row-btns">
      ${onDelete ? `<button type="button" class="btn danger ghost" data-del>${ICON.trash} Supprimer</button>` : ''}
      <button type="submit" class="btn primary">${esc(saveLabel)}</button>
    </div></form>`);
  const s = sheet(title, form);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const missing = fields.find(f => f.required && !String(form.elements[f.name]?.value || '').trim());
    if (missing) { toast(`« ${missing.label} » est obligatoire`, 'err'); form.elements[missing.name]?.focus(); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try { await onSave(readForm(form, fields), form); s.close(); }
    catch (err) { toast(err.message || String(err), 'err'); }
    finally { btn.disabled = false; }
  });
  if (onDelete) $('[data-del]', form).onclick = async () => {
    if (await confirmBox('Supprimer définitivement cet élément ?')) {
      try { await onDelete(); s.close(); } catch (err) { toast(err.message, 'err'); }
    }
  };
  setTimeout(() => form.querySelector('input:not([type=checkbox]),textarea')?.focus({ preventScroll: true }), 250);
  return { ...s, form };
}

// Puces de filtre
export function chips(options, current, onChange) {
  const el = h(`<div class="chips" role="tablist">${options.map(([v, l]) =>
    `<button class="chip ${v === current ? 'on' : ''}" data-v="${esc(v)}" role="tab">${esc(l)}</button>`).join('')}</div>`);
  el.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    $$('.chip', el).forEach(c => c.classList.toggle('on', c === b));
    onChange(b.dataset.v);
  });
  return el;
}

export const empty = (msg, sub = '') => `<div class="empty"><p>${esc(msg)}</p>${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}</div>`;
export const loading = () => `<div class="loading"><span></span><span></span><span></span></div>`;

// ---------- Icônes (SVG en ligne) ----------
const svg = p => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICON = {
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
  film: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  grid: svg('<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  camera: svg('<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'),
  net: svg('<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>'),
  book: svg('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  wa: svg('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 2 1-.5 1.7c-3.5.5-7.7-3.7-7.2-7.2l1.7-.5 1 2z"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  print: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  out: svg('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
};
