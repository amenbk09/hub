// Agenda : rendez-vous écrits ou dictés → rappel → calendrier du téléphone
import { listItems, saveItem, deleteItem, errMsg } from '../db.js';
import { $, $$, h, esc, toast, sheet, formSheet, chips, empty, loading, confirmBox, ICON } from '../ui.js';
import { parseRdv, toDateInput, toTimeInput, fromInputs, fmtLong, fmtRelatif } from '../dates.js';
import { buildIcs, googleCalendarUrl } from '../ics.js';

const RAPPELS = [
  ['0', 'Au moment'], ['15', '15 min avant'], ['30', '30 min avant'], ['60', '1 h avant'],
  ['120', '2 h avant'], ['1440', 'La veille'], ['custom', 'Autre…'], ['none', 'Pas de rappel'],
];
const rappelLabel = m => {
  if (m === null || m === undefined || m === '') return null;
  const f = RAPPELS.find(r => r[0] === String(m));
  if (f) return f[1];
  const n = Number(m);
  if (n >= 1440 && n % 1440 === 0) return `${n / 1440} j avant`;
  if (n >= 60) return `${Math.floor(n / 60)} h ${n % 60 ? (n % 60) + ' min ' : ''}avant`;
  return `${n} min avant`;
};

// ---------- Ajout au calendrier ----------
function icsFile(ev) {
  return new File([buildIcs(ev)], `${(ev.title || 'rdv').replace(/[^\w\- ]+/g, '').slice(0, 40) || 'rdv'}.ics`, { type: 'text/calendar' });
}
export function calendarSheet(ev) {
  const s = sheet('Ajouter au calendrier', `
    <p class="muted small">${esc(ev.title)} — ${esc(fmtLong(ev.start))}${ev.remindMinutes != null && ev.remindMinutes !== '' ? `<br>Rappel : ${esc(rappelLabel(ev.remindMinutes))}` : ''}</p>
    <div class="list">
      <button class="btn primary block" data-ios>${ICON.cal} Calendrier de l'iPhone</button>
      <a class="btn block" target="_blank" rel="noopener" href="${esc(googleCalendarUrl(ev))}">Google Agenda</a>
      <button class="btn ghost block sm" data-dl>Télécharger le fichier .ics</button>
    </div>
    <p class="hint">Le rappel est enregistré dans l'événement : c'est ton calendrier qui t'enverra la notification, même si l'appli est fermée.</p>`);
  $('[data-ios]', s.el).onclick = async () => {
    const file = icsFile(ev);
    // 1) Partage natif (iOS propose « Calendrier » / ouverture du fichier)
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: ev.title }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    // 2) Ouverture directe du .ics (Safari affiche « Ajouter au calendrier »)
    const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildIcs(ev));
    a.target = '_blank'; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
  };
  $('[data-dl]', s.el).onclick = () => {
    const url = URL.createObjectURL(icsFile(ev));
    const a = document.createElement('a'); a.href = url; a.download = icsFile(ev).name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
}

// ---------- Reconnaissance vocale ----------
function setupMic(btn, textarea, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, base = '';
  btn.onclick = () => {
    if (!SR) {
      toast('Dictée non dispo ici : utilise le micro 🎤 du clavier iPhone');
      textarea.focus();
      return;
    }
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    base = textarea.value ? textarea.value.trim() + ' ' : '';
    rec.onresult = e => {
      const t = [...e.results].map(r => r[0].transcript).join('');
      textarea.value = base + t;
      onText();
    };
    rec.onerror = e => {
      toast(e.error === 'not-allowed' ? 'Autorise le micro dans Réglages > Safari' : 'Je n\'ai pas bien entendu, réessaie', 'err');
    };
    rec.onend = () => { btn.classList.remove('listening'); btn.setAttribute('aria-label', 'Dicter'); rec = null; onText(); };
    try { rec.start(); btn.classList.add('listening'); btn.setAttribute('aria-label', 'Arrêter la dictée'); }
    catch { rec = null; toast('Micro indisponible', 'err'); }
  };
}

// ---------- Page ----------
export async function render(view) {
  let rows = [], mode = 'avenir';

  view.innerHTML = `
    <div class="card">
      <h2>Nouveau rendez-vous</h2>
      <p class="muted small">Écris-le ou dicte-le, par exemple : « RDV mardi 15h à l'hôtel pour le devis ».</p>
      <div class="composer">
        <textarea id="rdvText" rows="2" placeholder="Écris ou dicte ton rendez-vous…" aria-label="Rendez-vous"></textarea>
        <button class="mic" id="mic" aria-label="Dicter">${ICON.mic}</button>
      </div>
      <div class="preview" id="preview"></div>
    </div>
    <div class="section-title"><h2>Mes rendez-vous</h2></div>`;
  const ta = $('#rdvText', view), preview = $('#preview', view);
  view.append(chips([['avenir', 'À venir'], ['passes', 'Passés'], ['tous', 'Tous']], mode, v => { mode = v; draw(); }));
  const list = h(`<div class="list">${loading()}</div>`);
  view.append(list);

  // Aperçu modifiable après analyse
  let reminder = '30', customAt = null;
  function showPreview() {
    const txt = ta.value.trim();
    if (!txt) { preview.innerHTML = ''; return; }
    const p = parseRdv(txt);
    const d = p.date || (() => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 0, 0, 0); return x; })();
    preview.innerHTML = `
      <hr class="divider">
      <form class="form" id="rdvForm"><div class="grid">
        <div class="field"><label for="pt">Titre</label><input id="pt" name="title" value="${esc(p.title || txt)}"></div>
        <div class="field half"><label for="pd">Date</label><input id="pd" name="date" type="date" value="${toDateInput(d)}"></div>
        <div class="field half"><label for="ph">Heure</label><input id="ph" name="time" type="time" value="${toTimeInput(d)}"></div>
        <div class="field half"><label for="pl">Lieu</label><input id="pl" name="location" placeholder="Optionnel"></div>
        <div class="field half"><label for="pdu">Durée</label><select id="pdu" name="duration">
          ${[[15, '15 min'], [30, '30 min'], [60, '1 h'], [90, '1 h 30'], [120, '2 h'], [180, '3 h'], [240, '4 h'], [480, 'Journée']].map(([v, l]) => `<option value="${v}" ${v === 60 ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>${ICON.bell.replace('width="22" height="22"', 'width="14" height="14"')} Quand veux-tu être rappelé ?</label>
          <div class="remind-opts chips" style="margin:0;padding:0">${RAPPELS.map(([v, l]) => `<button type="button" class="chip ${v === reminder ? 'on' : ''}" data-r="${v}">${l}</button>`).join('')}</div>
          <div id="customWrap" class="${reminder === 'custom' ? '' : 'hidden'}" style="margin-top:8px"><input type="datetime-local" id="customAt" aria-label="Date et heure du rappel"></div>
        </div>
      </div>
      ${!p.hasDate || !p.hasTime ? `<p class="hint">${!p.hasDate ? 'Je n\'ai pas trouvé de date' : 'Je n\'ai pas trouvé d\'heure'} : vérifie ci-dessus.</p>` : ''}
      <div class="row-btns"><button type="button" class="btn ghost" id="cancel">Effacer</button><button class="btn primary" type="submit">Enregistrer</button></div></form>`;
    $$('[data-r]', preview).forEach(b => b.onclick = () => {
      reminder = b.dataset.r;
      $$('[data-r]', preview).forEach(x => x.classList.toggle('on', x === b));
      $('#customWrap', preview).classList.toggle('hidden', reminder !== 'custom');
      if (reminder === 'custom') {
        const start = fromInputs($('#pd', preview).value, $('#ph', preview).value) || new Date();
        const def = new Date(start.getTime() - 3 * 3600000);
        $('#customAt', preview).value = `${toDateInput(def)}T${toTimeInput(def)}`;
      }
    });
    $('#cancel', preview).onclick = () => { ta.value = ''; preview.innerHTML = ''; };
    $('#rdvForm', preview).onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      const start = fromInputs(f.date.value, f.time.value);
      if (!start) { toast('Choisis une date', 'err'); return; }
      let remindMinutes = null;
      if (reminder === 'custom') {
        const at = new Date($('#customAt', preview).value);
        if (isNaN(at)) { toast('Choisis l\'heure du rappel', 'err'); return; }
        remindMinutes = Math.max(0, Math.round((start - at) / 60000));
      } else if (reminder !== 'none') remindMinutes = Number(reminder);
      const data = {
        title: f.title.value.trim() || 'Rendez-vous', start: start.toISOString(),
        durationMin: Number(f.duration.value), location: f.location.value.trim(),
        notes: '', remindMinutes, source: txt, done: false,
      };
      const btn = $('button[type=submit]', f); btn.disabled = true;
      try {
        const row = await saveItem('rdv', data);
        ta.value = ''; preview.innerHTML = '';
        toast('Rendez-vous enregistré ✓');
        await refresh();
        calendarSheet({ id: row.id, ...data });
      } catch (err) { toast(errMsg(err), 'err'); btn.disabled = false; }
    };
  }
  let t;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(showPreview, 450); });
  setupMic($('#mic', view), ta, () => { clearTimeout(t); t = setTimeout(showPreview, 250); });

  async function refresh() {
    try { rows = await listItems('rdv'); } catch (e) { list.innerHTML = empty('Chargement impossible', errMsg(e)); return; }
    draw();
  }
  function draw() {
    const now = Date.now();
    let r = rows.filter(x => x.data.start);
    if (mode === 'avenir') r = r.filter(x => new Date(x.data.start).getTime() + (x.data.durationMin || 60) * 60000 >= now).sort((a, b) => new Date(a.data.start) - new Date(b.data.start));
    else if (mode === 'passes') r = r.filter(x => new Date(x.data.start).getTime() + (x.data.durationMin || 60) * 60000 < now).sort((a, b) => new Date(b.data.start) - new Date(a.data.start));
    else r.sort((a, b) => new Date(b.data.start) - new Date(a.data.start));
    if (!r.length) { list.innerHTML = empty(mode === 'avenir' ? 'Aucun rendez-vous à venir' : 'Rien ici', mode === 'avenir' ? 'Ajoute ton premier rendez-vous ci-dessus' : ''); return; }
    list.innerHTML = '';
    for (const row of r) {
      const d = row.data, s = new Date(d.start);
      const el = h(`<div class="item ${d.done ? 'done' : ''}" role="button" tabindex="0">
        <div class="date-badge"><b>${s.getDate()}</b><small>${s.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>
        <div class="grow">
          <h3>${esc(d.title)}</h3>
          <div class="meta"><span>${esc(fmtRelatif(s))} · ${s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>${d.location ? `<span>${esc(d.location)}</span>` : ''}</div>
          <div class="item-actions">
            ${rappelLabel(d.remindMinutes) ? `<span class="tag accent">${ICON.bell.replace('width="22" height="22"', 'width="12" height="12"')}&nbsp;${esc(rappelLabel(d.remindMinutes))}</span>` : ''}
            <button class="btn sm" data-cal>${ICON.cal} Calendrier</button>
            <button class="btn sm ghost" data-done>${ICON.check} ${d.done ? 'Rouvrir' : 'Fait'}</button>
          </div>
        </div></div>`);
      el.onclick = async e => {
        if (e.target.closest('[data-cal]')) { e.stopPropagation(); calendarSheet({ id: row.id, ...d }); return; }
        if (e.target.closest('[data-done]')) {
          e.stopPropagation();
          try { await saveItem('rdv', { ...d, done: !d.done }, row.id); refresh(); } catch (err) { toast(errMsg(err), 'err'); }
          return;
        }
        edit(row);
      };
      list.append(el);
    }
  }
  function edit(row) {
    const d = row.data, s = new Date(d.start);
    formSheet({
      title: 'Modifier le rendez-vous',
      fields: [
        { name: 'title', label: 'Titre', required: true },
        { name: 'date', label: 'Date', type: 'date', half: true },
        { name: 'time', label: 'Heure', type: 'time', half: true },
        { name: 'location', label: 'Lieu', half: true },
        { name: 'durationMin', label: 'Durée (min)', type: 'number', half: true },
        { name: 'remindMinutes', label: 'Rappel', type: 'select', options: [['', 'Pas de rappel'], ['0', 'Au moment'], ['15', '15 min avant'], ['30', '30 min avant'], ['60', '1 h avant'], ['120', '2 h avant'], ['1440', 'La veille'], ...(RAPPELS.some(r => r[0] === String(d.remindMinutes)) || d.remindMinutes == null ? [] : [[String(d.remindMinutes), rappelLabel(d.remindMinutes)]])] },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
      values: { ...d, date: toDateInput(s), time: toTimeInput(s), remindMinutes: d.remindMinutes ?? '' },
      onSave: async v => {
        const start = fromInputs(v.date, v.time);
        const data = { ...d, title: v.title, location: v.location, notes: v.notes, durationMin: Number(v.durationMin) || 60,
          start: start.toISOString(), remindMinutes: v.remindMinutes === '' ? null : Number(v.remindMinutes) };
        await saveItem('rdv', data, row.id);
        toast('Modifié ✓');
        await refresh();
        if (+start !== +s || data.remindMinutes !== d.remindMinutes) calendarSheet({ id: row.id, ...data });
      },
      onDelete: async () => { await deleteItem(row.id); toast('Supprimé'); refresh(); },
    });
  }
  await refresh();
}
