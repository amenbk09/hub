// Devis & factures Ctrl+S Media → PDF via l'impression du téléphone
import { listItems, saveItem, deleteItem, errMsg } from '../db.js';
import { $, $$, h, esc, toast, sheet, chips, empty, loading, confirmBox, fcfa, waLink, ICON } from '../ui.js';
import { COMPANY, PRESTATIONS } from '../config.js';
import { toDateInput } from '../dates.js';

const STATUTS = {
  brouillon: ['Brouillon', ''], envoye: ['Envoyé', 'info'], accepte: ['Accepté', 'accent'],
  refuse: ['Refusé', 'bad'], paye: ['Payé', 'ok'],
};

export const totals = d => {
  const sous = (d.lignes || []).reduce((s, l) => s + (Number(l.qte) || 0) * (Number(l.pu) || 0), 0);
  const remise = Math.round(sous * (Number(d.remise) || 0) / 100);
  return { sous, remise, total: sous - remise };
};

function nextNumero(rows, type) {
  const y = new Date().getFullYear();
  const prefix = `${type === 'facture' ? 'FAC' : 'DEV'}-${y}-`;
  const max = rows.map(r => r.data.numero || '').filter(n => n.startsWith(prefix))
    .map(n => parseInt(n.slice(prefix.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

export async function render(view) {
  let rows = [], filter = 'tous';
  view.innerHTML = '';
  const summary = h('<div class="stats" style="margin-bottom:14px"></div>');
  view.append(summary);
  view.append(chips([['tous', 'Tous'], ['devis', 'Devis'], ['facture', 'Factures'], ...Object.entries(STATUTS).map(([k, v]) => [k, v[0]])], filter, v => { filter = v; draw(); }));
  const list = h(`<div class="list">${loading()}</div>`);
  view.append(list);
  const fab = h(`<button class="fab" aria-label="Nouveau devis">${ICON.plus}</button>`);
  fab.onclick = () => editor();
  view.append(fab);

  async function refresh() {
    try { rows = await listItems('devis'); } catch (e) { list.innerHTML = empty('Chargement impossible', errMsg(e)); return; }
    draw();
  }

  function draw() {
    const y = new Date().getFullYear();
    const factYear = rows.filter(r => r.data.type === 'facture' && (r.data.date || '').startsWith(String(y)));
    const encaisse = factYear.filter(r => r.data.statut === 'paye').reduce((s, r) => s + totals(r.data).total, 0);
    const attente = rows.filter(r => r.data.type === 'facture' && r.data.statut !== 'paye').reduce((s, r) => s + totals(r.data).total, 0);
    const ouverts = rows.filter(r => r.data.type === 'devis' && ['brouillon', 'envoye'].includes(r.data.statut)).length;
    const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' k' : String(n);
    summary.innerHTML = `
      <div class="stat"><b>${short(encaisse)}</b><span>Encaissé ${y}</span></div>
      <div class="stat ${attente ? 'hot' : ''}"><b>${short(attente)}</b><span>À encaisser</span></div>
      <div class="stat"><b>${ouverts}</b><span>Devis ouverts</span></div>`;

    let r = rows.slice().sort((a, b) => (b.data.date || '').localeCompare(a.data.date || '') || (b.data.numero || '').localeCompare(a.data.numero || ''));
    if (filter === 'devis' || filter === 'facture') r = r.filter(x => x.data.type === filter);
    else if (filter !== 'tous') r = r.filter(x => x.data.statut === filter);
    if (!r.length) { list.innerHTML = empty('Aucun document', 'Appuie sur + pour créer un devis'); return; }
    list.innerHTML = '';
    for (const row of r) {
      const d = row.data, t = totals(d), st = STATUTS[d.statut] || ['', ''];
      const el = h(`<div class="item" role="button" tabindex="0">
        <div class="grow">
          <div class="meta"><span class="mono">${esc(d.numero)}</span><span>${esc(d.date ? new Date(d.date + 'T12:00').toLocaleDateString('fr-FR') : '')}</span></div>
          <h3>${esc(d.client || 'Client')}</h3>
          ${d.objet ? `<div class="clip">${esc(d.objet)}</div>` : ''}
          <div class="item-actions"><span class="tag ${d.type === 'facture' ? 'accent' : ''}">${d.type === 'facture' ? 'Facture' : 'Devis'}</span><span class="tag ${st[1]}">${esc(st[0])}</span></div>
        </div>
        <div style="text-align:right; font-weight:700; white-space:nowrap">${esc(fcfa(t.total))}</div>
      </div>`);
      el.onclick = () => editor(row);
      list.append(el);
    }
  }

  function editor(row) {
    const d = row ? structuredClone(row.data) : {
      type: 'devis', numero: nextNumero(rows, 'devis'), date: toDateInput(new Date()), statut: 'brouillon',
      client: '', clientInfo: '', clientTel: '', objet: '', lignes: [], remise: 0, notes: 'Devis valable 30 jours. Acompte de 50 % à la commande.',
    };
    const s = sheet(row ? `${d.type === 'facture' ? 'Facture' : 'Devis'} ${d.numero}` : 'Nouveau devis', `
      <form class="form" novalidate><div class="grid">
        <div class="field half"><label for="dtype">Type</label><select id="dtype" name="type"><option value="devis">Devis</option><option value="facture">Facture</option></select></div>
        <div class="field half"><label for="dnum">Numéro</label><input id="dnum" name="numero" class="mono"></div>
        <div class="field half"><label for="ddate">Date</label><input id="ddate" name="date" type="date"></div>
        <div class="field half"><label for="dst">Statut</label><select id="dst" name="statut">${Object.entries(STATUTS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="field half"><label for="dcl">Client</label><input id="dcl" name="client" placeholder="Nom du client" required></div>
        <div class="field half"><label for="dtel">WhatsApp client</label><input id="dtel" name="clientTel" type="tel" inputmode="tel" placeholder="Optionnel"></div>
        <div class="field"><label for="dci">Coordonnées client</label><input id="dci" name="clientInfo" placeholder="Adresse, e-mail… (optionnel)"></div>
        <div class="field"><label for="dob">Objet</label><input id="dob" name="objet" placeholder="Ex. Vidéo promotionnelle de l'hôtel"></div>
      </div>
      <div class="section-title" style="margin-top:18px"><h2>Prestations</h2></div>
      <div class="lines" id="lines"></div>
      <div class="row-btns" style="justify-content:flex-start; margin-top:10px">
        <select id="preset" aria-label="Ajouter une prestation" style="flex:1"><option value="">+ Ajouter une prestation…</option>
          ${PRESTATIONS.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('')}<option value="libre">Ligne libre</option></select>
      </div>
      <div class="grid" style="margin-top:12px">
        <div class="field half"><label for="drem">Remise (%)</label><input id="drem" name="remise" type="number" inputmode="decimal" min="0" max="100"></div>
        <div class="field"><label for="dno">Conditions / notes</label><textarea id="dno" name="notes" rows="2"></textarea></div>
      </div>
      <div id="tot"></div>
      <div class="row-btns">
        ${row ? `<button type="button" class="btn danger ghost" id="del">${ICON.trash}</button>` : ''}
        <button type="button" class="btn" id="pdf">${ICON.print} PDF</button>
        ${row && d.type === 'devis' ? `<button type="button" class="btn" id="tofact">→ Facture</button>` : ''}
        <button type="submit" class="btn primary">Enregistrer</button>
      </div>
      <button type="button" class="btn ok block" id="wa" style="margin-top:10px">${ICON.wa} Envoyer le récapitulatif sur WhatsApp</button>
      </form>`, { wide: true });
    const f = $('form', s.el);
    for (const k of ['type', 'numero', 'date', 'statut', 'client', 'clientTel', 'clientInfo', 'objet', 'remise', 'notes']) f.elements[k].value = d[k] ?? '';

    const linesEl = $('#lines', f);
    const drawLines = () => {
      linesEl.innerHTML = d.lignes.length ? '' : '<p class="muted small">Aucune prestation : ajoute-en une ci-dessous.</p>';
      d.lignes.forEach((l, i) => {
        const el = h(`<div class="line">
          <input aria-label="Désignation" value="${esc(l.label)}" data-k="label" placeholder="Désignation">
          <input aria-label="Quantité" value="${esc(l.qte)}" data-k="qte" inputmode="decimal" placeholder="Qté">
          <input aria-label="Prix unitaire" value="${esc(l.pu)}" data-k="pu" inputmode="numeric" placeholder="Prix unit.">
          <button type="button" class="icon-btn" aria-label="Retirer">${ICON.x}</button></div>`);
        $$('input', el).forEach(inp => inp.oninput = () => {
          d.lignes[i][inp.dataset.k] = inp.dataset.k === 'label' ? inp.value : Number(inp.value.replace(/\s/g, '').replace(',', '.')) || 0;
          drawTot();
        });
        $('button', el).onclick = () => { d.lignes.splice(i, 1); drawLines(); };
        linesEl.append(el);
      });
      drawTot();
    };
    const drawTot = () => {
      d.remise = Number(f.elements.remise.value) || 0;
      const t = totals(d);
      $('#tot', f).innerHTML = `${t.remise ? `<div class="subtot"><span>Sous-total</span><span>${esc(fcfa(t.sous))}</span></div><div class="subtot" style="margin-top:4px"><span>Remise (${esc(d.remise)} %)</span><span>−${esc(fcfa(t.remise))}</span></div>` : ''}
        <div class="total-row"><span>Total</span><span>${esc(fcfa(t.total))}</span></div>`;
    };
    $('#preset', f).onchange = e => {
      const v = e.target.value; if (v === '') return;
      d.lignes.push(v === 'libre' ? { label: '', qte: 1, pu: 0 } : { label: PRESTATIONS[v].label, qte: 1, pu: PRESTATIONS[v].price });
      e.target.value = ''; drawLines();
      $$('.line', linesEl).at(-1)?.querySelector(v === 'libre' ? '[data-k=label]' : '[data-k=pu]')?.focus();
    };
    f.elements.remise.oninput = drawTot;
    f.elements.type.onchange = () => {
      if (!row) f.elements.numero.value = nextNumero(rows, f.elements.type.value);
    };
    drawLines();

    const collect = () => {
      for (const k of ['type', 'numero', 'date', 'statut', 'client', 'clientTel', 'clientInfo', 'objet', 'notes']) d[k] = f.elements[k].value.trim();
      d.remise = Number(f.elements.remise.value) || 0;
      d.lignes = d.lignes.filter(l => l.label || l.pu);
      return d;
    };
    f.onsubmit = async e => {
      e.preventDefault();
      collect();
      if (!d.client) { toast('Indique le client', 'err'); return; }
      try { await saveItem('devis', d, row?.id); toast('Enregistré ✓'); s.close(); refresh(); }
      catch (err) { toast(errMsg(err), 'err'); }
    };
    $('#pdf', f).onclick = () => printDoc(collect());
    $('#wa', f).onclick = () => {
      const x = collect(), t = totals(x);
      const txt = `Bonjour${x.client ? ' ' + x.client : ''},\n\nVoici le récapitulatif de ${x.type === 'facture' ? 'la facture' : 'notre devis'} ${x.numero}${x.objet ? ` — ${x.objet}` : ''} :\n\n` +
        x.lignes.map(l => `• ${l.label} : ${l.qte} × ${fcfa(l.pu)}`).join('\n') +
        `${t.remise ? `\nRemise : −${fcfa(t.remise)}` : ''}\n\nTotal : ${fcfa(t.total)}\n\n${COMPANY.name}`;
      const link = waLink(x.clientTel, txt) || `https://wa.me/?text=${encodeURIComponent(txt)}`;
      window.open(link, '_blank', 'noopener');
    };
    $('#tofact', f)?.addEventListener('click', async () => {
      const x = collect();
      const fact = { ...structuredClone(x), type: 'facture', numero: nextNumero(rows, 'facture'), date: toDateInput(new Date()), statut: 'envoye', devisSource: x.numero, notes: 'Paiement à réception de la facture.' };
      try {
        await saveItem('devis', { ...x, statut: 'accepte' }, row.id);
        await saveItem('devis', fact);
        toast(`Facture ${fact.numero} créée ✓`); s.close(); refresh();
      } catch (err) { toast(errMsg(err), 'err'); }
    });
    $('#del', f)?.addEventListener('click', async () => {
      if (await confirmBox(`Supprimer ${d.numero} ?`)) {
        try { await deleteItem(row.id); toast('Supprimé'); s.close(); refresh(); } catch (err) { toast(errMsg(err), 'err'); }
      }
    });
  }

  await refresh();
}

function printDoc(d) {
  const t = totals(d);
  const title = d.type === 'facture' ? 'FACTURE' : 'DEVIS';
  const area = document.getElementById('print-area') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-area' }));
  area.innerHTML = `
    <div class="pa-head">
      <div><h1>${esc(COMPANY.name)}</h1><div>${esc(COMPANY.tagline)}</div><div>${esc(COMPANY.address)}</div>
        ${COMPANY.phone ? `<div>${esc(COMPANY.phone)}</div>` : ''}${COMPANY.email ? `<div>${esc(COMPANY.email)}</div>` : ''}</div>
      <div class="r"><div class="pa-doc">${title}</div><div><b>N° ${esc(d.numero)}</b></div>
        <div>Date : ${esc(d.date ? new Date(d.date + 'T12:00').toLocaleDateString('fr-FR') : '')}</div>
        ${d.devisSource ? `<div>Réf. devis : ${esc(d.devisSource)}</div>` : ''}</div>
    </div>
    <div><b>Client :</b> ${esc(d.client)}${d.clientInfo ? `<br>${esc(d.clientInfo)}` : ''}</div>
    ${d.objet ? `<div style="margin-top:8px"><b>Objet :</b> ${esc(d.objet)}</div>` : ''}
    <table class="pa-tbl"><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unitaire</th><th class="n">Montant</th></tr></thead>
      <tbody>${d.lignes.map(l => `<tr><td>${esc(l.label)}</td><td class="n">${esc(l.qte)}</td><td class="n">${esc(fcfa(l.pu))}</td><td class="n">${esc(fcfa((Number(l.qte) || 0) * (Number(l.pu) || 0)))}</td></tr>`).join('')}</tbody></table>
    <div class="pa-total">
      ${t.remise ? `<div><span>Sous-total</span><span>${esc(fcfa(t.sous))}</span></div><div><span>Remise (${esc(d.remise)} %)</span><span>−${esc(fcfa(t.remise))}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${esc(fcfa(t.total))}</span></div>
    </div>
    ${d.notes ? `<p style="margin-top:24px; white-space:pre-wrap">${esc(d.notes)}</p>` : ''}
    <div class="pa-foot">${esc(COMPANY.footer)}</div>`;
  toast('Sur iPhone : Imprimer → Partager → Enregistrer dans Fichiers (PDF)');
  const prevTitle = document.title;
  document.title = `${title} ${d.numero} - ${d.client}`;
  setTimeout(() => { window.print(); document.title = prevTitle; }, 50);
}
