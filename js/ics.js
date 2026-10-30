// Création d'un fichier .ics (iPhone Calendrier, Google Agenda, Outlook)
// avec une alarme (VALARM) : c'est le calendrier du téléphone qui
// déclenchera la notification de rappel, même appli fermée.

const pad = n => String(n).padStart(2, '0');
export const icsDate = d =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

const escText = s => String(s || '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

// Lignes de 75 octets max (RFC 5545), en coupant sur des caractères entiers
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * @param {object} ev { id, title, start: Date, durationMin, location, notes, remindMinutes }
 *   remindMinutes : nombre de minutes avant le début (0 = au début, null = pas de rappel)
 */
export function buildIcs(ev, now = new Date()) {
  const start = new Date(ev.start);
  const end = new Date(start.getTime() + (ev.durationMin || 60) * 60000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AmenHub//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.id || Date.now()}@amenhub`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escText(ev.title || 'Rendez-vous')}`,
  ];
  if (ev.location) lines.push(`LOCATION:${escText(ev.location)}`);
  if (ev.notes) lines.push(`DESCRIPTION:${escText(ev.notes)}`);
  if (ev.remindMinutes !== null && ev.remindMinutes !== undefined && ev.remindMinutes !== '') {
    const mins = Number(ev.remindMinutes);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(ev.title || 'Rappel')}`,
      mins > 0 ? `TRIGGER:-PT${mins}M` : 'TRIGGER:PT0M', 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Lien "Ajouter à Google Agenda" (le rappel y suit les réglages du compte)
export function googleCalendarUrl(ev) {
  const start = new Date(ev.start);
  const end = new Date(start.getTime() + (ev.durationMin || 60) * 60000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title || 'Rendez-vous',
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: ev.notes || '',
    location: ev.location || '',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
