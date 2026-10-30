// Mini-CRM : prospects et clients (hôtels, entreprises…) avec relances
import { collection, statusTag } from './collection.js';
import { esc, waLink, ICON } from '../ui.js';
import { fmtRelatif } from '../dates.js';

const STATUTS = {
  a_contacter: ['À contacter', ''], contacte: ['Contacté', 'info'], interesse: ['Intéressé', 'warn'],
  devis_envoye: ['Devis envoyé', 'accent'], signe: ['Signé', 'ok'], perdu: ['Perdu', 'bad'],
};
const isDue = d => d.relance && new Date(d.relance + 'T23:59') <= new Date(Date.now() + 0) && !['signe', 'perdu'].includes(d.statut);

export const render = collection({
  kind: 'client',
  noun: 'contact',
  emptyMsg: 'Aucun prospect pour le moment',
  fields: [
    { name: 'nom', label: 'Structure / nom', required: true, placeholder: 'Ex. Hôtel …' },
    { name: 'type', label: 'Type', type: 'select', half: true, options: ['Hôtel', 'Restaurant', 'Entreprise', 'Boutique', 'Particulier', 'Autre'] },
    { name: 'statut', label: 'Statut', type: 'select', half: true, options: Object.entries(STATUTS).map(([k, v]) => [k, v[0]]) },
    { name: 'contact', label: 'Personne à contacter', half: true },
    { name: 'tel', label: 'Téléphone / WhatsApp', type: 'tel', half: true, placeholder: '90 00 00 00' },
    { name: 'email', label: 'E-mail', type: 'email', half: true },
    { name: 'relance', label: 'Date de relance', type: 'date', half: true },
    { name: 'service', label: 'Service proposé', type: 'datalist', options: ['Community management', 'Vidéo promotionnelle', 'Couverture événement', 'Montage', 'Pack complet'] },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ type: 'Hôtel', statut: 'a_contacter' }),
  filters: [['actifs', 'En cours'], ['relance', 'À relancer'], ...Object.entries(STATUTS).map(([k, v]) => [k, v[0]]), ['tous', 'Tous']],
  filter: (d, f) => f === 'tous' ? true : f === 'actifs' ? !['signe', 'perdu'].includes(d.statut) : f === 'relance' ? isDue(d) : d.statut === f,
  sort: (a, b) => (a.data.relance || '9999').localeCompare(b.data.relance || '9999') || (a.data.nom || '').localeCompare(b.data.nom || ''),
  search: d => [d.nom, d.contact, d.type, d.notes, d.tel].join(' '),
  card: d => {
    const wa = waLink(d.tel, d.contact ? `Bonjour ${d.contact}, ` : 'Bonjour, ');
    const initials = (d.nom || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="date-badge" style="display:grid;place-items:center;height:52px"><b style="font-size:1.05rem">${esc(initials)}</b></div>
      <div class="grow">
        <h3>${esc(d.nom)}</h3>
        <div class="meta"><span>${esc(d.type || '')}</span>${d.contact ? `<span>${esc(d.contact)}</span>` : ''}${d.service ? `<span>${esc(d.service)}</span>` : ''}</div>
        <div class="item-actions">
          ${statusTag(STATUTS, d.statut)}
          ${d.relance ? `<span class="tag ${isDue(d) ? 'bad' : ''}">Relance : ${esc(fmtRelatif(d.relance + 'T12:00'))}</span>` : ''}
          ${wa ? `<a class="btn sm ok" data-act="wa" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.wa} WhatsApp</a>` : ''}
          ${d.tel ? `<a class="btn sm ghost" data-act="tel" href="tel:${esc(String(d.tel).replace(/[^\d+]/g, ''))}">${ICON.phone}</a>` : ''}
        </div>
      </div>`;
  },
  actions: {},
});
