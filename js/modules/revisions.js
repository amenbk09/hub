// Révisions : flashcards réseau / cybersécurité avec répétition simple
import { listItems, saveItem, errMsg } from '../db.js';
import { $, h, esc, chips, toast, empty, loading } from '../ui.js';
import { collection } from './collection.js';

const DEPART = [
  ['Ports', 'Port de SSH ?', '22/TCP'], ['Ports', 'Port de RDP ?', '3389/TCP'],
  ['Ports', 'Ports DNS ?', '53 (UDP pour les requêtes, TCP pour les transferts de zone et grosses réponses)'],
  ['Ports', 'Ports LDAP et LDAPS ?', 'LDAP 389, LDAPS 636'], ['Ports', 'Port de Kerberos ?', '88'],
  ['Ports', 'Port SMB ?', '445/TCP'], ['Ports', 'Ports DHCP ?', '67 (serveur) et 68 (client), UDP'],
  ['Ports', 'Port SNMP / traps ?', '161 / 162 UDP'], ['Ports', 'Port Syslog ?', '514 UDP'],
  ['Réseau', 'Les 7 couches du modèle OSI ?', 'Physique, Liaison, Réseau, Transport, Session, Présentation, Application'],
  ['Réseau', 'Différence TCP / UDP ?', 'TCP : connecté, fiable (3-way handshake, accusés, retransmission). UDP : sans connexion, rapide, sans garantie.'],
  ['Réseau', 'Plages privées RFC 1918 ?', '10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16'],
  ['Réseau', 'À quoi sert ARP ?', 'Trouver l\'adresse MAC correspondant à une IP sur le réseau local'],
  ['Réseau', 'Distance administrative OSPF / statique / EIGRP ?', 'OSPF 110, statique 1, EIGRP interne 90'],
  ['Réseau', 'Que fait le protocole STP ?', 'Évite les boucles de niveau 2 en bloquant des liens redondants'],
  ['Sécurité', 'Triade CIA ?', 'Confidentialité, Intégrité, Disponibilité'],
  ['Sécurité', 'Chiffrement symétrique vs asymétrique ?', 'Symétrique : une même clé (AES). Asymétrique : paire publique/privée (RSA, ECC), plus lent, sert à l\'échange de clés et aux signatures.'],
  ['Sécurité', 'Qu\'est-ce qu\'un hash ? Exemple ?', 'Empreinte à sens unique de taille fixe (SHA-256). Sert à vérifier l\'intégrité.'],
  ['Sécurité', 'Différence IDS / IPS ?', 'IDS détecte et alerte ; IPS est en coupure et bloque.'],
  ['Sécurité', 'Qu\'est-ce que le principe du moindre privilège ?', 'Donner à chaque compte uniquement les droits nécessaires à sa tâche.'],
  ['Sécurité', 'Qu\'est-ce qu\'une attaque MITM ?', 'L\'attaquant s\'intercale entre deux parties pour lire ou modifier le trafic (ex. ARP spoofing).'],
  ['Sécurité', 'Défense en profondeur ?', 'Plusieurs couches de sécurité indépendantes : si l\'une tombe, les autres protègent.'],
  ['OWASP', 'Citer 3 risques du Top 10 OWASP', 'Contrôle d\'accès défaillant, défaillances cryptographiques, injection (SQL, XSS…)'],
  ['OWASP', 'Comment prévenir l\'injection SQL ?', 'Requêtes paramétrées / préparées, validation des entrées, comptes BDD à privilèges réduits.'],
  ['OWASP', 'Qu\'est-ce qu\'une XSS ?', 'Injection de script dans une page vue par d\'autres utilisateurs. Parade : échapper les sorties, CSP.'],
];

const cartes = collection({
  kind: 'flashcard',
  noun: 'carte',
  emptyMsg: 'Aucune carte',
  fields: [
    { name: 'theme', label: 'Thème', type: 'datalist', options: ['Ports', 'Réseau', 'Sécurité', 'OWASP', 'Crypto', 'Linux', 'Windows'] },
    { name: 'question', label: 'Question', type: 'textarea', rows: 2, required: true },
    { name: 'reponse', label: 'Réponse', type: 'textarea', rows: 3, required: true },
  ],
  defaults: () => ({ theme: 'Sécurité' }),
  search: d => [d.theme, d.question, d.reponse].join(' '),
  sort: (a, b) => (a.data.theme || '').localeCompare(b.data.theme || ''),
  card: d => `<div class="grow"><h3>${esc(d.question)}</h3><div class="clip">${esc(d.reponse)}</div>
    <div class="item-actions"><span class="tag">${esc(d.theme || '')}</span>${d.score ? `<span class="tag ${d.score > 0 ? 'ok' : 'bad'}">score ${d.score > 0 ? '+' : ''}${d.score}</span>` : ''}</div></div>`,
  actions: {},
});

export async function render(view) {
  let tab = 'reviser';
  view.innerHTML = '';
  view.append(chips([['reviser', 'Réviser'], ['cartes', 'Mes cartes']], tab, v => { tab = v; show(); }));
  const body = h('<div></div>');
  view.append(body);
  const show = () => { body.innerHTML = ''; tab === 'reviser' ? study(body) : cartes(body); };
  show();
}

async function study(el) {
  el.innerHTML = loading();
  let rows;
  try { rows = await listItems('flashcard'); } catch (e) { el.innerHTML = empty('Chargement impossible', errMsg(e)); return; }

  if (!rows.length) {
    el.innerHTML = `${empty('Pas encore de cartes', 'Ajoute un paquet de départ (ports, OSI, sécurité, OWASP) puis complète-le avec tes cours.')}
      <button class="btn primary block" id="seed">Ajouter ${DEPART.length} cartes de départ</button>`;
    $('#seed', el).onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Ajout…';
      try { for (const [theme, question, reponse] of DEPART) await saveItem('flashcard', { theme, question, reponse, score: 0 }); toast('Cartes ajoutées ✓'); study(el); }
      catch (err) { toast(errMsg(err), 'err'); e.target.disabled = false; }
    };
    return;
  }

  const themes = ['Tous', ...new Set(rows.map(r => r.data.theme || 'Divers'))];
  let theme = 'Tous', deck = [], i = 0, ok = 0;
  el.innerHTML = '';
  el.append(chips(themes.map(t => [t, t]), theme, v => { theme = v; start(); }));
  const stage = h('<div></div>');
  el.append(stage);

  function start() {
    // Les cartes les moins maîtrisées d'abord, puis un peu de hasard
    deck = rows.filter(r => theme === 'Tous' || (r.data.theme || 'Divers') === theme)
      .map(r => ({ r, k: (r.data.score || 0) + Math.random() * 1.5 })).sort((a, b) => a.k - b.k).map(x => x.r).slice(0, 15);
    i = 0; ok = 0; card();
  }
  function card() {
    if (i >= deck.length) {
      stage.innerHTML = `<div class="card center" style="padding:32px 16px">
        <h2 style="font-family:var(--serif); font-size:1.6rem; font-weight:500">${ok}/${deck.length}</h2>
        <p class="muted">${ok === deck.length ? 'Parfait, tout est acquis.' : ok >= deck.length / 2 ? 'Bien joué, continue comme ça.' : 'Les cartes ratées reviendront en priorité.'}</p>
        <button class="btn primary" id="again">Nouvelle série</button></div>`;
      $('#again', stage).onclick = start;
      return;
    }
    const c = deck[i].data;
    stage.innerHTML = `
      <div class="progress" aria-label="Progression"><i style="width:${Math.round(i / deck.length * 100)}%"></i></div>
      <p class="hint">${i + 1} / ${deck.length} · touche la carte pour la retourner</p>
      <div class="flash" role="button" tabindex="0" aria-label="Retourner la carte">
        <div class="flash-inner">
          <div class="flash-face"><small>${esc(c.theme || '')}</small>${esc(c.question)}</div>
          <div class="flash-face back"><small>Réponse</small>${esc(c.reponse)}</div>
        </div></div>
      <div class="row-btns" id="grade" style="visibility:hidden">
        <button class="btn danger ghost" data-g="-1">À revoir</button>
        <button class="btn ok" data-g="1">Je savais</button></div>`;
    const f = $('.flash', stage);
    const flip = () => { f.classList.toggle('flipped'); $('#grade', stage).style.visibility = 'visible'; };
    f.onclick = flip; f.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } };
    stage.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
      const g = +b.dataset.g, row = deck[i];
      if (g > 0) ok++;
      row.data.score = Math.max(-3, Math.min(5, (row.data.score || 0) + g));
      i++; card();
      saveItem('flashcard', row.data, row.id).catch(() => { });
    });
  }
  start();
}
