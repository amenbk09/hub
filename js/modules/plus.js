// Menu "Plus"
import { ICON } from '../ui.js';

const TILES = [
  ['clients', 'users', 'Clients', 'Prospection & relances'],
  ['devis', 'doc', 'Devis', 'Devis et factures PDF'],
  ['tournages', 'camera', 'Tournages', 'Matériel, plans, livraison'],
  ['reseau', 'net', 'Réseau', 'Calculs, commandes, journal'],
  ['revisions', 'book', 'Révisions', 'Flashcards cybersécurité'],
  ['idees', 'bulb', 'Idées Miadome', 'Note partagée'],
];

export function render(view) {
  view.innerHTML = `<div class="menu-grid">${TILES.map(([r, i, t, s]) =>
    `<a class="menu-tile" href="#/${r}">${ICON[i]}<b>${t}</b><span>${s}</span></a>`).join('')}</div>
    <p class="hint center" style="margin-top:24px">Astuce : sur iPhone, ouvre l'appli dans Safari → Partager → « Sur l'écran d'accueil ».</p>`;
}
