// Analyse d'un rendez-vous écrit ou dicté en français.
// "RDV mardi 15h à l'hôtel Sarakawa pour le devis"
//   → { date: Date(mardi prochain 15:00), hasDate: true, hasTime: true,
//       title: "RDV à l'hôtel Sarakawa pour le devis" }

const MOIS = {
  janvier: 0, janv: 0, fevrier: 1, fevr: 1, fev: 1, mars: 2, avril: 3, avr: 3,
  mai: 4, juin: 5, juillet: 6, juil: 6, aout: 7, septembre: 8, sept: 8,
  octobre: 9, oct: 9, novembre: 10, nov: 10, decembre: 11, dec: 11,
};
const JOURS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const NOMBRES = {
  une: 1, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  seize: 16, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19, vingt: 20,
  'vingt et une': 21, 'vingt-deux': 22, 'vingt-trois': 23,
};

// Même longueur que l'original (NFC → minuscules sans accents) pour
// pouvoir retirer les morceaux reconnus du texte d'origine.
function normalise(s) {
  return s.normalize('NFC').replace(/[’`]/g, "'").toLowerCase()
    .split('').map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '') || c).join('');
}

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function parseRdv(input, now = new Date()) {
  const original = String(input || '').normalize('NFC').replace(/[’`]/g, "'");
  let work = normalise(original);
  const spans = [];
  const take = (m) => {
    spans.push([m.index, m.index + m[0].length]);
    work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
  };

  const today = startOfDay(now);
  let day = null;     // Date (minuit)
  let hour = null, minute = 0;
  let m;

  // 1) "12 novembre", "le 1er décembre 2026"
  const moisRe = Object.keys(MOIS).sort((a, b) => b.length - a.length).join('|');
  m = new RegExp(`\\b(?:le\\s+)?(\\d{1,2})(?:er)?\\s+(${moisRe})\\.?(?:\\s+(\\d{4}))?\\b`).exec(work);
  if (m) {
    const d = +m[1], mo = MOIS[m[2]];
    let y = m[3] ? +m[3] : today.getFullYear();
    let cand = new Date(y, mo, d);
    if (!m[3] && cand < today) cand = new Date(y + 1, mo, d);
    if (cand.getDate() === d) { day = cand; take(m); }
  }

  // 2) "12/11", "le 12/11/2026"
  if (!day) {
    m = /\b(?:le\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/.exec(work);
    if (m && +m[2] >= 1 && +m[2] <= 12) {
      const d = +m[1], mo = +m[2] - 1;
      let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
      let cand = new Date(y, mo, d);
      if (!m[3] && cand < today) cand = new Date(y + 1, mo, d);
      if (cand.getDate() === d) { day = cand; take(m); }
    }
  }

  // 3) aujourd'hui / ce soir / demain / après-demain / dans N jours
  if (!day) {
    m = /\b(apres[\s-]demain|aujourd'hui|aujourdhui|ce soir|ce matin|cet apres[\s-]midi|demain)\b/.exec(work);
    if (m) {
      const w = m[1];
      if (w.startsWith('apres')) day = addDays(today, 2);
      else if (w === 'demain') day = addDays(today, 1);
      else day = today;
      if (w === 'ce soir') hour = 19;
      take(m);
    }
  }
  if (!day) {
    m = /\bdans\s+(\d{1,2}|une?|deux|trois|quatre|cinq|six|sept)\s+(jours?|semaines?)\b/.exec(work);
    if (m) {
      const n = /^\d+$/.test(m[1]) ? +m[1] : NOMBRES[m[1]];
      day = addDays(today, m[2].startsWith('semaine') ? n * 7 : n);
      take(m);
    }
  }

  // 4) "mardi", "mardi prochain", "ce vendredi"
  if (!day) {
    m = /\b(?:(?:ce|cette)\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?\b/.exec(work);
    if (m) {
      let diff = (JOURS[m[1]] - today.getDay() + 7) % 7;
      if (diff === 0 && m[2]) diff = 7;
      day = addDays(today, diff);
      take(m);
    }
  }

  // 5) "le 12" (jour du mois en cours, sinon du mois suivant)
  if (!day) {
    m = /\ble\s+(\d{1,2})(?:er)?\b(?!\s*(?:h\b|h\d|heures?|:))/.exec(work);
    if (m && +m[1] >= 1 && +m[1] <= 31) {
      const d = +m[1];
      let cand = new Date(today.getFullYear(), today.getMonth(), d);
      if (cand < today) cand = new Date(today.getFullYear(), today.getMonth() + 1, d);
      if (cand.getDate() === d) { day = cand; take(m); }
    }
  }

  // 6) Heure : "15h", "15h30", "15 h 30", "15:30", "à 9 heures", "midi", "minuit"
  m = /\b(?:a\s+|vers\s+)?(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?(?:\s*(?:du\s+|de\s+l'|de\s+la\s+)?(matin|soir|soiree|nuit|aprem|apres[\s-]midi))?(?![\w])/.exec(work);
  if (m && +m[1] <= 23 && (!m[2] || +m[2] <= 59)) {
    hour = +m[1]; minute = m[2] ? +m[2] : 0;
    if (m[3] && !['matin', 'nuit'].includes(m[3]) && hour < 12) hour += 12;
    take(m);
  } else {
    m = /\b(?:a\s+|vers\s+)?(midi|minuit)(?:\s+et\s+demie)?\b/.exec(work);
    if (m) {
      hour = m[1] === 'midi' ? 12 : 0;
      minute = /demie/.test(m[0]) ? 30 : 0;
      take(m);
    }
  }

  const hasDate = !!day, hasTime = hour !== null;
  if (!day && hasTime) {
    day = today;
    const t = new Date(today); t.setHours(hour, minute);
    if (t < now) day = addDays(today, 1);
  }
  let date = null;
  if (day) {
    date = new Date(day);
    date.setHours(hasTime ? hour : 9, hasTime ? minute : 0, 0, 0);
  }

  // Titre = texte d'origine sans les morceaux de date/heure
  spans.sort((a, b) => b[0] - a[0]);
  let title = original;
  for (const [s, e] of spans) title = title.slice(0, s) + ' ' + title.slice(e);
  title = title
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(à|a|le|pour|vers|de)\s*$/i, '')
    .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);

  return { date, hasDate, hasTime, title };
}

// Format pour <input type="date"> et <input type="time"> (heure locale)
export const pad = n => String(n).padStart(2, '0');
export const toDateInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function fromInputs(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (timeStr || '09:00').split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

export function fmtLong(d) {
  if (!d) return '';
  d = new Date(d);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
export function fmtShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
export function fmtRelatif(d, now = new Date()) {
  const a = startOfDay(new Date(d)), b = startOfDay(now);
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff < 7) return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^./, c => c.toUpperCase());
  return fmtShort(d);
}
