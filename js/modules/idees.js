// Idées de vidéos Miadome — note partagée avec les collègues, validation par l'admin
import { listIdeas, addIdea, updateIdea, deleteIdea, onIdeasChange, errMsg, sb } from '../db.js';
import { $, $$, h, esc, toast, sheet, formSheet, chips, empty, loading, safeUrl, ICON } from '../ui.js';
import { fmtShort } from '../dates.js';

export const STATUTS = {
  en_attente: ['En attente', 'warn'],
  validee: ['Validée', 'ok'],
  a_retravailler: ['À retravailler', 'info'],
  refusee: ['Refusée', 'bad'],
};
const FIELDS = [
  { name: 'title', label: 'Idée (titre court)', required: true, placeholder: 'Ex. Micro-trottoir au Grand Marché' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Le concept, le déroulé, qui apparaît…' },
  { name: 'lieu', label: 'Lieu de tournage', half: true, placeholder: 'Optionnel' },
  { name: 'reference_url', label: 'Lien de référence', type: 'url', half: true, placeholder: 'TikTok, Instagram…' },
];

export async function render(view, ctx) {
  const me = (await sb.auth.getUser()).data.user?.id;
  const isAdmin = ctx.isAdmin;
  let rows = [], filter = isAdmin ? 'en_attente' : 'tous';

  view.innerHTML = '';
  if (!isAdmin) view.append(h(`<div class="hello"><h1>Salut <em>${esc(ctx.profile.display_name || '')}</em></h1>
    <p class="muted">Propose tes idées de vidéos pour Miadome. Amen les valide avant le tournage.</p></div>`));
  const counts = h('<div class="stats" style="margin-bottom:14px"></div>');
  view.append(counts);
  view.append(chips([['tous', 'Toutes'], ['en_attente', 'En attente'], ['validee', 'Validées'], ['a_retravailler', 'À retravailler'], ['refusee', 'Refusées']],
    filter, v => { filter = v; draw(); }));
  const list = h(`<div class="list">${loading()}</div>`);
  view.append(list);
  const fab = h(`<button class="fab" aria-label="Proposer une idée">${ICON.plus}</button>`);
  fab.onclick = () => propose();
  view.append(fab);

  async function refresh() {
    try { rows = await listIdeas(); } catch (e) { list.innerHTML = empty('Chargement impossible', errMsg(e)); return; }
    draw();
  }

  function draw() {
    const c = k => rows.filter(r => r.status === k).length;
    counts.innerHTML = `
      <div class="stat ${c('en_attente') ? 'hot' : ''}"><b>${c('en_attente')}</b><span>En attente</span></div>
      <div class="stat"><b>${c('validee')}</b><span>Validées</span></div>
      <div class="stat"><b>${rows.length}</b><span>Au total</span></div>`;
    const r = filter === 'tous' ? rows : rows.filter(x => x.status === filter);
    if (!r.length) {
      list.innerHTML = empty(filter === 'en_attente' ? 'Aucune idée en attente' : 'Aucune idée ici', 'Appuie sur + pour proposer une idée');
      return;
    }
    list.innerHTML = '';
    for (const idea of r) {
      const mine = idea.author_id === me;
      const canEdit = isAdmin || (mine && ['en_attente', 'a_retravailler'].includes(idea.status));
      const st = STATUTS[idea.status] || ['?', ''];
      const url = safeUrl(idea.reference_url);
      const el = h(`<article class="item" style="cursor:default; flex-direction:column; gap:0">
        <div style="display:flex; gap:10px; align-items:flex-start; width:100%">
          <div class="grow">
            <h3>${esc(idea.title)}</h3>
            <div class="meta"><span>${esc(idea.author_name || 'Anonyme')}${mine ? ' (moi)' : ''}</span><span>${esc(fmtShort(idea.created_at))}</span>${idea.lieu ? `<span>📍 ${esc(idea.lieu)}</span>` : ''}</div>
          </div>
          <span class="tag ${st[1]} idea-status">${esc(st[0])}</span>
        </div>
        ${idea.description ? `<p style="margin:8px 0 0; white-space:pre-wrap; overflow-wrap:anywhere">${esc(idea.description)}</p>` : ''}
        ${url ? `<a class="small" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="margin-top:6px; display:inline-flex; gap:4px; align-items:center">${ICON.link.replace('width="22" height="22"', 'width="14" height="14"')} Voir la référence</a>` : ''}
        ${idea.admin_comment ? `<div class="admin-note"><b>Amen :</b> ${esc(idea.admin_comment)}</div>` : ''}
        <div class="item-actions">
          ${isAdmin ? `
            <button class="btn sm ok" data-s="validee">${ICON.check} Valider</button>
            <button class="btn sm" data-s="a_retravailler">À retravailler</button>
            <button class="btn sm danger ghost" data-s="refusee">Refuser</button>` : ''}
          ${canEdit ? `<button class="btn sm ghost" data-edit>${ICON.edit} Modifier</button>` : ''}
        </div>
      </article>`);
      $$('[data-s]', el).forEach(b => b.onclick = () => decide(idea, b.dataset.s));
      $('[data-edit]', el)?.addEventListener('click', () => edit(idea));
      list.append(el);
    }
  }

  function propose() {
    formSheet({
      title: 'Proposer une idée', fields: FIELDS, saveLabel: 'Envoyer',
      onSave: async v => { await addIdea(v); toast('Idée envoyée ✓'); refresh(); },
    });
  }

  function edit(idea) {
    const mine = idea.author_id === me;
    formSheet({
      title: 'Modifier l\'idée', fields: FIELDS, values: idea,
      onSave: async v => {
        await updateIdea(idea.id, v);
        toast(!isAdmin && idea.status === 'a_retravailler' ? 'Idée renvoyée pour validation ✓' : 'Modifié ✓');
        refresh();
      },
      onDelete: (isAdmin || (mine && idea.status === 'en_attente')) ? async () => { await deleteIdea(idea.id); toast('Idée supprimée'); refresh(); } : null,
    });
  }

  function decide(idea, status) {
    const s = sheet(STATUTS[status][0], `
      <p class="muted small">« ${esc(idea.title)} »</p>
      <div class="field"><label for="cm">Commentaire pour l'équipe ${status === 'validee' ? '(optionnel)' : ''}</label>
        <textarea id="cm" rows="3" placeholder="${status === 'validee' ? 'Ex. Tournage samedi, prévoir 2 intervenants' : 'Explique ce qu\'il faut changer'}">${esc(idea.admin_comment || '')}</textarea></div>
      <div class="row-btns"><button class="btn ghost" data-close>Annuler</button><button class="btn primary" id="ok">Confirmer</button></div>`);
    $('#ok', s.el).onclick = async () => {
      try {
        await updateIdea(idea.id, { status, admin_comment: $('#cm', s.el).value.trim() || null });
        s.close(); toast(STATUTS[status][0] + ' ✓'); refresh();
      } catch (e) { toast(errMsg(e), 'err'); }
    };
  }

  await refresh();
  // Mise à jour en direct quand un collègue ajoute ou modifie une idée
  let t;
  const stop = onIdeasChange(() => { clearTimeout(t); t = setTimeout(refresh, 300); });
  return stop;
}
