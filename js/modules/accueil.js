// Tableau de bord du jour
import { listItems, listIdeas } from '../db.js';
import { h, esc, empty, ICON } from '../ui.js';
import { fmtRelatif } from '../dates.js';

export async function render(view, ctx) {
  const now = new Date();
  const hr = now.getHours();
  const salut = hr < 12 ? 'Bonjour' : hr < 18 ? 'Bon après-midi' : 'Bonsoir';
  const jour = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  view.innerHTML = `
    <div class="hello">
      <p class="muted small" style="text-transform:capitalize; margin:0 0 4px">${esc(jour)}</p>
      <h1>${salut}, <em>${esc(ctx.profile.display_name || 'Amen')}</em></h1>
    </div>
    <div class="stats" id="stats"><div class="stat"><b>·</b><span>…</span></div><div class="stat"><b>·</b><span>…</span></div><div class="stat"><b>·</b><span>…</span></div></div>
    <div class="section-title"><h2>Prochains rendez-vous</h2><a href="#/agenda">Agenda</a></div>
    <div class="list" id="rdv"></div>
    <div class="section-title"><h2>Publications de la semaine</h2><a href="#/contenus">Contenus</a></div>
    <div class="list" id="posts"></div>
    <div class="section-title"><h2>Accès rapide</h2></div>
    <div class="menu-grid">
      <a class="menu-tile" href="#/agenda">${ICON.mic}<b>Dicter un RDV</b><span>Voix ou texte</span></a>
      <a class="menu-tile" href="#/devis">${ICON.doc}<b>Nouveau devis</b><span>PDF prêt à envoyer</span></a>
    </div>`;

  const safe = p => p.catch(() => []);
  const [rdv, ideas, clients, contenus] = await Promise.all([
    safe(listItems('rdv')), safe(listIdeas()), safe(listItems('client')), safe(listItems('contenu')),
  ]);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(today.getTime() + 86400000);
  const upcoming = rdv.filter(r => !r.data.done && new Date(r.data.start) >= new Date(now.getTime() - 3600000))
    .sort((a, b) => new Date(a.data.start) - new Date(b.data.start));
  const rdvToday = upcoming.filter(r => new Date(r.data.start) < endToday).length;
  const pending = ideas.filter(i => i.status === 'en_attente').length;
  const relances = clients.filter(c => c.data.relance && new Date(c.data.relance) < endToday && !['signe', 'perdu'].includes(c.data.statut)).length;

  view.querySelector('#stats').innerHTML = `
    <a class="stat ${rdvToday ? 'hot' : ''}" href="#/agenda"><b>${rdvToday}</b><span>RDV aujourd'hui</span></a>
    <a class="stat ${pending ? 'hot' : ''}" href="#/idees"><b>${pending}</b><span>Idées à valider</span></a>
    <a class="stat ${relances ? 'hot' : ''}" href="#/clients"><b>${relances}</b><span>Relances dues</span></a>`;

  const rdvEl = view.querySelector('#rdv');
  if (!upcoming.length) rdvEl.innerHTML = empty('Rien de prévu', 'Profite pour avancer sur un montage');
  else upcoming.slice(0, 3).forEach(r => {
    const s = new Date(r.data.start);
    rdvEl.append(h(`<a class="item" href="#/agenda" style="text-decoration:none">
      <div class="date-badge"><b>${s.getDate()}</b><small>${s.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>
      <div class="grow"><h3>${esc(r.data.title)}</h3>
      <div class="meta"><span>${esc(fmtRelatif(s))} · ${s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>${r.data.location ? `<span>${esc(r.data.location)}</span>` : ''}</div></div></a>`));
  });

  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  const posts = contenus.filter(c => c.data.date && new Date(c.data.date) >= today && new Date(c.data.date) < weekEnd && c.data.statut !== 'publie')
    .sort((a, b) => new Date(a.data.date) - new Date(b.data.date));
  const postsEl = view.querySelector('#posts');
  if (!posts.length) postsEl.innerHTML = empty('Aucune publication prévue cette semaine');
  else posts.slice(0, 4).forEach(p => postsEl.append(h(`<a class="item" href="#/contenus" style="text-decoration:none">
    <div class="grow"><h3>${esc(p.data.titre)}</h3><div class="meta"><span>${esc(fmtRelatif(p.data.date + 'T12:00'))}</span><span>${esc(p.data.compte || '')}</span><span>${esc(p.data.plateforme || '')}</span></div></div></a>`)));
}
