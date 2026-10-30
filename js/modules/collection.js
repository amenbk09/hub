// Fabrique de modules "liste + formulaire" (contenus, clients, tournages, journal…)
import { listItems, saveItem, deleteItem, errMsg } from '../db.js';
import { $, h, esc, toast, formSheet, chips, empty, loading, ICON } from '../ui.js';

/**
 * opts: {
 *   kind, noun ('contenu'), fields, card(data, row) → html,
 *   filters: [[value, label]], filter(data, value) → bool,
 *   sort(a, b) on rows, search(data) → string, defaults() → object,
 *   actions: { name: async (row, refresh) => {} }  // boutons [data-act=name] dans la carte
 *   intro: html affiché en haut, mountTop(view, rows, refresh)
 * }
 */
export function collection(opts) {
  return async function render(view) {
    let rows = [], filter = opts.filters ? opts.filters[0][0] : null, q = '';
    view.innerHTML = '';
    if (opts.intro) view.append(h(`<div>${opts.intro}</div>`));
    const top = h('<div></div>');
    view.append(top);
    if (opts.filters) view.append(chips(opts.filters, filter, v => { filter = v; draw(); }));
    if (opts.search) {
      const s = h(`<div class="search">${ICON.search}<input type="search" placeholder="Rechercher…" aria-label="Rechercher"></div>`);
      $('input', s).addEventListener('input', e => { q = e.target.value.toLowerCase(); draw(); });
      view.append(s);
    }
    const list = h(`<div class="list">${loading()}</div>`);
    view.append(list);
    const fab = h(`<button class="fab" aria-label="Ajouter">${ICON.plus}</button>`);
    fab.onclick = () => open();
    view.append(fab);

    async function refresh() {
      try { rows = await listItems(opts.kind); }
      catch (e) { list.innerHTML = empty('Chargement impossible', errMsg(e)); return; }
      if (opts.mountTop) { top.innerHTML = ''; opts.mountTop(top, rows, refresh); }
      draw();
    }

    function draw() {
      let r = rows.slice();
      if (opts.filters && opts.filter) r = r.filter(x => opts.filter(x.data, filter));
      if (q && opts.search) r = r.filter(x => opts.search(x.data).toLowerCase().includes(q));
      if (opts.sort) r.sort(opts.sort);
      if (!r.length) { list.innerHTML = empty(opts.emptyMsg || 'Rien ici pour le moment', 'Appuie sur + pour ajouter'); return; }
      list.innerHTML = '';
      for (const row of r) {
        const el = h(`<div class="item ${opts.cardClass ? opts.cardClass(row.data) : ''}" role="button" tabindex="0">${opts.card(row.data, row)}</div>`);
        el.addEventListener('click', async e => {
          const act = e.target.closest('[data-act]');
          if (act) {
            e.stopPropagation();
            if (act.tagName === 'A') return;          // liens (WhatsApp, appel…)
            e.preventDefault();
            try { await opts.actions[act.dataset.act](row, refresh, act); } catch (err) { toast(errMsg(err), 'err'); }
            return;
          }
          open(row);
        });
        el.addEventListener('keydown', e => { if (e.key === 'Enter') open(row); });
        list.append(el);
      }
    }

    function open(row) {
      formSheet({
        title: row ? `Modifier ${opts.noun}` : `Nouveau ${opts.noun}`,
        fields: opts.fields,
        values: row ? row.data : (opts.defaults ? opts.defaults() : {}),
        onSave: async values => {
          const data = row ? { ...row.data, ...values } : values;
          await saveItem(opts.kind, data, row?.id);
          toast(row ? 'Modifié ✓' : 'Ajouté ✓');
          refresh();
        },
        onDelete: row ? async () => { await deleteItem(row.id); toast('Supprimé'); refresh(); } : null,
      });
    }

    view._open = open;
    await refresh();
  };
}

export const statusTag = (map, v) => {
  const s = map[v] || ['—', ''];
  return `<span class="tag ${s[1]}">${esc(s[0])}</span>`;
};
