// Planificateur de contenus (tous comptes : Ctrl+S Media, Maison des Maillots, Miadome, clients…)
import { collection, statusTag } from './collection.js';
import { saveItem } from '../db.js';
import { esc, copy, toast, ICON } from '../ui.js';
import { COMPTES } from '../config.js';
import { fmtRelatif, toDateInput } from '../dates.js';

const STATUTS = {
  idee: ['Idée', ''], tournage: ['À tourner', 'warn'], montage: ['En montage', 'info'],
  valide: ['Prêt', 'accent'], publie: ['Publié', 'ok'],
};
const ORDRE = Object.keys(STATUTS);

export const render = collection({
  kind: 'contenu',
  noun: 'contenu',
  emptyMsg: 'Aucun contenu planifié',
  fields: [
    { name: 'titre', label: 'Titre / concept', required: true },
    { name: 'compte', label: 'Compte / client', type: 'datalist', options: COMPTES, half: true },
    { name: 'plateforme', label: 'Plateforme', type: 'select', half: true, options: ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'WhatsApp', 'Multi'] },
    { name: 'date', label: 'Date de publication', type: 'date', half: true },
    { name: 'statut', label: 'Statut', type: 'select', half: true, options: ORDRE.map(k => [k, STATUTS[k][0]]) },
    { name: 'legende', label: 'Légende', type: 'textarea', rows: 4 },
    { name: 'hashtags', label: 'Hashtags', placeholder: '#lome #togo …' },
  ],
  defaults: () => ({ statut: 'idee', plateforme: 'TikTok', date: toDateInput(new Date()) }),
  filters: [['actifs', 'En cours'], ['semaine', 'Cette semaine'], ...ORDRE.map(k => [k, STATUTS[k][0]]), ['tous', 'Tous']],
  filter: (d, f) => {
    if (f === 'tous') return true;
    if (f === 'actifs') return d.statut !== 'publie';
    if (f === 'semaine') {
      if (!d.date) return false;
      const t = new Date(d.date + 'T12:00'), n = new Date(); n.setHours(0, 0, 0, 0);
      return t >= n && t < new Date(n.getTime() + 7 * 86400000);
    }
    return d.statut === f;
  },
  sort: (a, b) => (a.data.date || '9999').localeCompare(b.data.date || '9999'),
  search: d => [d.titre, d.compte, d.legende, d.hashtags].join(' '),
  cardClass: d => d.statut === 'publie' ? 'done' : '',
  card: d => {
    const t = d.date ? new Date(d.date + 'T12:00') : null;
    return `
      <div class="date-badge">${t ? `<b>${t.getDate()}</b><small>${t.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small>` : '<b>–</b><small>date</small>'}</div>
      <div class="grow">
        <h3>${esc(d.titre)}</h3>
        <div class="meta">${t ? `<span>${esc(fmtRelatif(t))}</span>` : ''}${d.compte ? `<span>${esc(d.compte)}</span>` : ''}${d.plateforme ? `<span>${esc(d.plateforme)}</span>` : ''}</div>
        ${d.legende ? `<div class="clip">${esc(d.legende)}</div>` : ''}
        <div class="item-actions">
          ${statusTag(STATUTS, d.statut)}
          ${d.statut !== 'publie' ? `<button class="btn sm ghost" data-act="next">Étape suivante →</button>` : ''}
          ${d.legende || d.hashtags ? `<button class="btn sm ghost" data-act="copy">${ICON.copy} Copier légende</button>` : ''}
        </div>
      </div>`;
  },
  actions: {
    copy: row => copy([row.data.legende, row.data.hashtags].filter(Boolean).join('\n\n')),
    next: async (row, refresh) => {
      const i = ORDRE.indexOf(row.data.statut);
      const statut = ORDRE[Math.min(ORDRE.length - 1, i + 1)];
      await saveItem('contenu', { ...row.data, statut }, row.id);
      toast(`→ ${STATUTS[statut][0]}`);
      refresh();
    },
  },
});
