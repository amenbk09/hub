// Projets vidéo : préparation, checklist matériel, shot list, suivi du montage
import { collection, statusTag } from './collection.js';
import { esc } from '../ui.js';
import { MATERIEL } from '../config.js';
import { fmtRelatif } from '../dates.js';

const STATUTS = { prevu: ['Prévu', 'warn'], tourne: ['Tourné', 'info'], montage: ['En montage', 'accent'], livre: ['Livré', 'ok'] };

export const render = collection({
  kind: 'tournage',
  noun: 'tournage',
  emptyMsg: 'Aucun tournage prévu',
  fields: [
    { name: 'titre', label: 'Projet', required: true, placeholder: 'Ex. Vidéo promo Hôtel …' },
    { name: 'client', label: 'Client / compte', half: true },
    { name: 'statut', label: 'Statut', type: 'select', half: true, options: Object.entries(STATUTS).map(([k, v]) => [k, v[0]]) },
    { name: 'date', label: 'Date de tournage', type: 'date', half: true },
    { name: 'livraison', label: 'Date de livraison', type: 'date', half: true },
    { name: 'lieu', label: 'Lieu' },
    { name: 'materiel', label: 'Checklist matériel (coche ce qui est prêt)', type: 'checks', options: MATERIEL },
    { name: 'shots', label: 'Shot list (un plan par ligne)', type: 'textarea', rows: 5, placeholder: 'Plan large façade\nInterview gérant\nB-roll cuisine…' },
    { name: 'retours', label: 'Retours client / notes montage', type: 'textarea' },
  ],
  defaults: () => ({ statut: 'prevu', materiel: [] }),
  filters: [['actifs', 'En cours'], ...Object.entries(STATUTS).map(([k, v]) => [k, v[0]]), ['tous', 'Tous']],
  filter: (d, f) => f === 'tous' ? true : f === 'actifs' ? d.statut !== 'livre' : d.statut === f,
  sort: (a, b) => (a.data.date || '9999').localeCompare(b.data.date || '9999'),
  search: d => [d.titre, d.client, d.lieu, d.shots].join(' '),
  cardClass: d => d.statut === 'livre' ? 'done' : '',
  card: d => {
    const t = d.date ? new Date(d.date + 'T12:00') : null;
    const ready = (d.materiel || []).length, total = MATERIEL.length;
    const shots = (d.shots || '').split('\n').filter(s => s.trim()).length;
    return `
      <div class="date-badge">${t ? `<b>${t.getDate()}</b><small>${t.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small>` : '<b>–</b><small>date</small>'}</div>
      <div class="grow">
        <h3>${esc(d.titre)}</h3>
        <div class="meta">${t ? `<span>${esc(fmtRelatif(t))}</span>` : ''}${d.client ? `<span>${esc(d.client)}</span>` : ''}${d.lieu ? `<span>📍 ${esc(d.lieu)}</span>` : ''}</div>
        ${d.statut === 'prevu' ? `<div style="margin-top:8px"><div class="progress" aria-label="Matériel prêt"><i style="width:${Math.round(ready / total * 100)}%"></i></div>
          <div class="hint">Matériel prêt : ${ready}/${total}</div></div>` : ''}
        <div class="item-actions">
          ${statusTag(STATUTS, d.statut)}
          ${shots ? `<span class="tag">${shots} plan${shots > 1 ? 's' : ''}</span>` : ''}
          ${d.livraison ? `<span class="tag">Livraison : ${esc(fmtRelatif(d.livraison + 'T12:00'))}</span>` : ''}
        </div>
      </div>`;
  },
  actions: {},
});
