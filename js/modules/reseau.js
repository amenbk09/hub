// Boîte à outils réseau : calculateur IPv4, VLSM, aide-mémoire, journal d'interventions
import { $, h, esc, chips, toast, copy, ICON } from '../ui.js';
import { subnetInfo, vlsm } from '../net.js';
import { collection } from './collection.js';
import { fmtShort } from '../dates.js';

const CMDS = [
  // Cisco IOS
  ['Cisco', 'show ip interface brief', 'État et IP de toutes les interfaces'],
  ['Cisco', 'show running-config', 'Configuration active'],
  ['Cisco', 'copy running-config startup-config', 'Sauvegarder la configuration'],
  ['Cisco', 'show vlan brief', 'VLANs et ports associés'],
  ['Cisco', 'interface g0/1\n switchport mode access\n switchport access vlan 10', 'Port d\'accès dans le VLAN 10'],
  ['Cisco', 'interface g0/24\n switchport mode trunk\n switchport trunk allowed vlan 10,20,99', 'Port trunk'],
  ['Cisco', 'interface g0/0.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0', 'Sous-interface router-on-a-stick'],
  ['Cisco', 'ip route 0.0.0.0 0.0.0.0 <passerelle>', 'Route par défaut'],
  ['Cisco', 'router ospf 1\n network 192.168.10.0 0.0.0.255 area 0', 'OSPF zone 0'],
  ['Cisco', 'ip dhcp pool LAN\n network 192.168.10.0 255.255.255.0\n default-router 192.168.10.1\n dns-server 8.8.8.8', 'Serveur DHCP'],
  ['Cisco', 'access-list 100 deny tcp any host 10.0.0.5 eq 23\naccess-list 100 permit ip any any', 'ACL étendue (bloquer Telnet)'],
  ['Cisco', 'ip nat inside source list 1 interface g0/0 overload', 'NAT/PAT vers Internet'],
  ['Cisco', 'crypto key generate rsa modulus 2048\nip ssh version 2\nline vty 0 4\n transport input ssh\n login local', 'Activer SSH'],
  ['Cisco', 'show mac address-table', 'Table MAC du switch'],
  ['Cisco', 'show ip route', 'Table de routage'],
  // MikroTik
  ['MikroTik', '/ip address print', 'Adresses IP'],
  ['MikroTik', '/interface print', 'Interfaces'],
  ['MikroTik', '/ip route add dst-address=0.0.0.0/0 gateway=<passerelle>', 'Route par défaut'],
  ['MikroTik', '/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade', 'NAT Internet'],
  ['MikroTik', '/ip hotspot user print', 'Utilisateurs hotspot'],
  ['MikroTik', '/queue simple add name=client1 target=192.168.88.10/32 max-limit=5M/10M', 'Limiter le débit d\'un client'],
  ['MikroTik', '/interface wireless registration-table print', 'Clients Wi-Fi connectés'],
  ['MikroTik', '/system backup save name=sauvegarde', 'Sauvegarde système'],
  ['MikroTik', '/tool ping 8.8.8.8 count=5', 'Test de connectivité'],
  // pfSense
  ['pfSense', 'pfctl -sr', 'Règles de pare-feu chargées'],
  ['pfSense', 'pfctl -ss | head', 'États (connexions) actifs'],
  ['pfSense', 'pfSsh.php playback svc restart dhcpd', 'Redémarrer le DHCP'],
  ['pfSense', 'Diagnostics > Packet Capture', 'Capturer le trafic d\'une interface'],
  ['pfSense', 'Firewall > Traffic Shaper > Limiters', 'QoS / limitation de bande passante'],
  // Linux
  ['Linux', 'ip a', 'Adresses des interfaces'],
  ['Linux', 'ip r', 'Table de routage'],
  ['Linux', 'ss -tulpn', 'Ports en écoute et processus'],
  ['Linux', 'sudo nmap -sV -p- 192.168.1.10', 'Scan complet des ports et services'],
  ['Linux', 'sudo tcpdump -i eth0 port 53', 'Capturer le trafic DNS'],
  ['Linux', 'dig +short exemple.com', 'Résolution DNS'],
  ['Linux', 'traceroute 8.8.8.8', 'Chemin réseau'],
  ['Linux', 'sudo ufw allow 22/tcp && sudo ufw enable', 'Pare-feu UFW'],
  ['Linux', 'journalctl -u ssh --since "1 hour ago"', 'Journaux SSH récents'],
  ['Linux', 'docker ps --format "table {{.Names}}\\t{{.Status}}"', 'Conteneurs actifs'],
  // Windows
  ['Windows', 'ipconfig /all', 'Configuration IP complète'],
  ['Windows', 'ipconfig /release && ipconfig /renew', 'Renouveler le bail DHCP'],
  ['Windows', 'ipconfig /flushdns', 'Vider le cache DNS'],
  ['Windows', 'netstat -ano | findstr :443', 'Qui utilise le port 443'],
  ['Windows', 'Test-NetConnection 10.0.0.5 -Port 3389', 'Tester un port (PowerShell)'],
  ['Windows', 'gpupdate /force', 'Appliquer les GPO'],
  ['Windows', 'nslookup -type=SRV _ldap._tcp.dc._msdcs.<domaine>', 'Trouver les contrôleurs de domaine'],
];

const journal = collection({
  kind: 'intervention',
  noun: 'intervention',
  emptyMsg: 'Aucune intervention notée',
  fields: [
    { name: 'titre', label: 'Intervention', required: true, placeholder: 'Ex. Antenne client sans signal' },
    { name: 'date', label: 'Date', type: 'date', half: true },
    { name: 'site', label: 'Site / client', half: true },
    { name: 'type', label: 'Type', type: 'select', half: true, options: ['Dépannage', 'Installation', 'Configuration', 'Maintenance', 'Sécurité', 'Lab / test'] },
    { name: 'duree', label: 'Durée (h)', type: 'number', half: true },
    { name: 'probleme', label: 'Problème constaté', type: 'textarea' },
    { name: 'solution', label: 'Solution appliquée', type: 'textarea' },
    { name: 'materiel', label: 'Équipements concernés', placeholder: 'MikroTik hAP, Ubiquiti, Cisco 2960…' },
  ],
  defaults: () => ({ date: new Date().toISOString().slice(0, 10), type: 'Dépannage' }),
  sort: (a, b) => (b.data.date || '').localeCompare(a.data.date || ''),
  search: d => [d.titre, d.site, d.probleme, d.solution, d.materiel, d.type].join(' '),
  mountTop: (top, rows) => {
    const n = rows.length, h_ = rows.reduce((s, r) => s + (Number(r.data.duree) || 0), 0);
    const sites = new Set(rows.map(r => (r.data.site || '').trim().toLowerCase()).filter(Boolean)).size;
    top.innerHTML = `<div class="stats" style="margin-bottom:12px"><div class="stat"><b>${n}</b><span>Interventions</span></div>
      <div class="stat"><b>${sites}</b><span>Sites</span></div><div class="stat"><b>${Math.round(h_)}</b><span>Heures</span></div></div>
      <p class="hint" style="margin:-4px 2px 12px">Chaque intervention notée ici, c'est une ligne concrète pour ton CV et tes entretiens.</p>`;
  },
  card: d => `<div class="grow">
      <h3>${esc(d.titre)}</h3>
      <div class="meta"><span>${esc(d.date ? fmtShort(d.date + 'T12:00') : '')}</span>${d.site ? `<span>${esc(d.site)}</span>` : ''}${d.duree ? `<span>${esc(d.duree)} h</span>` : ''}</div>
      ${d.solution ? `<div class="clip">✔ ${esc(d.solution)}</div>` : ''}
      <div class="item-actions"><span class="tag">${esc(d.type || '')}</span></div></div>`,
  actions: {},
});

export async function render(view) {
  let tab = 'calc';
  view.innerHTML = '';
  view.append(chips([['calc', 'Calcul IP'], ['vlsm', 'VLSM'], ['cmd', 'Commandes'], ['journal', 'Journal']], tab, v => { tab = v; show(); }));
  const body = h('<div></div>');
  view.append(body);

  function show() {
    body.innerHTML = '';
    if (tab === 'calc') calc(body);
    else if (tab === 'vlsm') vlsmTab(body);
    else if (tab === 'cmd') cmds(body);
    else journal(body);
  }
  show();
}

function calc(el) {
  el.innerHTML = `<div class="card">
    <div class="field"><label for="cidr">Adresse IP / masque</label>
      <input id="cidr" class="mono" placeholder="192.168.1.10/26" value="192.168.1.10/26" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="decimal"></div>
    <p class="hint">Accepte aussi « 192.168.1.10 255.255.255.192 ».</p>
    <div id="res" style="margin-top:14px"></div></div>`;
  const inp = $('#cidr', el), res = $('#res', el);
  const go = () => {
    try {
      const r = subnetInfo(inp.value);
      res.innerHTML = `<dl class="kv">
        <dt>Réseau</dt><dd>${r.reseau}/${r.prefix}</dd>
        <dt>Masque</dt><dd>${r.masque}</dd>
        <dt>Wildcard</dt><dd>${r.wildcard}</dd>
        <dt>1ʳᵉ adresse</dt><dd>${r.premiere}</dd>
        <dt>Dernière</dt><dd>${r.derniere}</dd>
        <dt>Broadcast</dt><dd>${r.broadcast}</dd>
        <dt>Hôtes utiles</dt><dd>${r.hotes.toLocaleString('fr-FR')}</dd>
        <dt>Classe</dt><dd>${r.classe}</dd>
        <dt>Type</dt><dd>${r.type}</dd>
        <dt>Binaire</dt><dd style="font-size:.78rem">${r.binaire}</dd></dl>`;
    } catch (e) { res.innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
  };
  inp.oninput = go; go();
}

function vlsmTab(el) {
  el.innerHTML = `<div class="card">
    <div class="field"><label for="base">Réseau de départ</label><input id="base" class="mono" value="192.168.10.0/24" autocapitalize="off" spellcheck="false"></div>
    <div class="field" style="margin-top:12px"><label for="needs">Besoins (un par ligne : nom hôtes)</label>
      <textarea id="needs" class="mono" rows="4">LAN 100\nWiFi 50\nCaméras 20\nLiaison 2</textarea></div>
    <button class="btn primary block" id="go" style="margin-top:12px">Calculer</button>
    <div id="out" style="margin-top:14px"></div></div>`;
  $('#go', el).onclick = () => {
    try {
      const besoins = $('#needs', el).value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const m = l.match(/^(.*?)[\s:;,]+(\d+)$/);
        if (!m) throw new Error(`Ligne invalide : « ${l} »`);
        return { nom: m[1].trim(), hotes: +m[2] };
      });
      const r = vlsm($('#base', el).value, besoins);
      $('#out', el).innerHTML = `<div class="scroll-x"><table class="tbl"><thead><tr><th>Nom</th><th>Réseau</th><th>Plage</th><th>Broadcast</th><th>Hôtes</th></tr></thead><tbody>
        ${r.map(x => `<tr><td style="font-family:var(--font);font-weight:600">${esc(x.nom)}</td><td>${x.reseau}/${x.prefix}</td><td>${x.premiere} – ${x.derniere}</td><td>${x.broadcast}</td><td>${x.hotes} (${x.demandes})</td></tr>`).join('')}
        </tbody></table></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };
}

function cmds(el) {
  let cat = 'Cisco', q = '';
  const cats = [...new Set(CMDS.map(c => c[0]))];
  el.append(h(`<div class="search">${ICON.search}<input type="search" placeholder="Rechercher une commande…" aria-label="Rechercher"></div>`));
  el.append(chips(cats.map(c => [c, c]), cat, v => { cat = v; draw(); }));
  const list = h('<div class="list"></div>');
  el.append(list);
  $('input', el).oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  function draw() {
    const r = CMDS.filter(c => q ? (c[1] + ' ' + c[2] + ' ' + c[0]).toLowerCase().includes(q) : c[0] === cat);
    list.innerHTML = r.length ? '' : '<div class="empty"><p>Aucune commande</p></div>';
    r.forEach(([c, cmd, desc]) => {
      const it = h(`<div class="cmd" role="button" tabindex="0" title="Copier"><code>${esc(cmd)}</code><p>${q ? `<b>${esc(c)}</b> · ` : ''}${esc(desc)}</p></div>`);
      it.onclick = () => copy(cmd);
      list.append(it);
    });
  }
  draw();
}
