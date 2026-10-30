// Calculateur IPv4 (pur, fonctionne hors ligne)

export const ipToInt = ip => {
  const p = ip.trim().split('.');
  if (p.length !== 4) throw new Error('Adresse IPv4 invalide');
  return p.reduce((acc, o) => {
    if (!/^\d{1,3}$/.test(o) || +o > 255) throw new Error('Adresse IPv4 invalide');
    return (acc * 256) + +o;
  }, 0);
};
export const intToIp = n => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join('.');

export function maskToPrefix(mask) {
  const n = ipToInt(mask);
  const bin = n.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bin)) throw new Error('Masque invalide');
  return bin.indexOf('0') === -1 ? 32 : bin.indexOf('0');
}

// Accepte "192.168.1.10/26", "192.168.1.10 255.255.255.192" ou "192.168.1.10/255.255.255.192"
export function parseCidr(input) {
  const s = String(input).trim();
  const m = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*(?:\/\s*|\s+)(\d{1,3}(?:\.\d{1,3}){3}|\d{1,2})$/);
  if (!m) throw new Error('Format attendu : 192.168.1.10/24 ou 192.168.1.10 255.255.255.0');
  const prefix = m[2].includes('.') ? maskToPrefix(m[2]) : +m[2];
  if (prefix < 0 || prefix > 32) throw new Error('Préfixe entre /0 et /32');
  return { ip: m[1], prefix };
}

export function subnetInfo(input) {
  const { ip, prefix } = parseCidr(input);
  const ipN = ipToInt(ip);
  const size = 2 ** (32 - prefix);
  const network = Math.floor(ipN / size) * size;
  const broadcast = network + size - 1;
  const maskN = 2 ** 32 - size;
  const first = o => o.split('.')[0];
  const f = +first(ip);
  const classe = f < 128 ? 'A' : f < 192 ? 'B' : f < 224 ? 'C' : f < 240 ? 'D (multicast)' : 'E';
  const prive = (f === 10) || (f === 172 && ipN >= ipToInt('172.16.0.0') && ipN <= ipToInt('172.31.255.255'))
    || (ipN >= ipToInt('192.168.0.0') && ipN <= ipToInt('192.168.255.255'));
  let hosts, firstHost, lastHost;
  if (prefix === 32) { hosts = 1; firstHost = lastHost = network; }
  else if (prefix === 31) { hosts = 2; firstHost = network; lastHost = broadcast; }
  else { hosts = size - 2; firstHost = network + 1; lastHost = broadcast - 1; }
  return {
    ip, prefix,
    masque: intToIp(maskN),
    wildcard: intToIp(size - 1),
    reseau: intToIp(network),
    broadcast: intToIp(broadcast),
    premiere: intToIp(firstHost),
    derniere: intToIp(lastHost),
    hotes: hosts,
    classe,
    type: prive ? 'Privée (RFC 1918)' : (f === 127 ? 'Loopback' : (f === 169 && ip.startsWith('169.254') ? 'APIPA / link-local' : 'Publique')),
    binaire: ipN.toString(2).padStart(32, '0').replace(/(.{8})(?!$)/g, '$1.'),
  };
}

// VLSM : découpe un réseau en sous-réseaux selon des besoins en hôtes
export function vlsm(baseCidr, besoins) {
  const { ip, prefix } = parseCidr(baseCidr);
  const size = 2 ** (32 - prefix);
  let cursor = Math.floor(ipToInt(ip) / size) * size;
  const end = cursor + size;
  const tries = besoins.map((b, i) => ({ ...b, i })).sort((a, b) => b.hotes - a.hotes);
  const out = [];
  for (const b of tries) {
    let p = 32;
    while (p > 0 && 2 ** (32 - p) - 2 < b.hotes) p--;
    const blk = 2 ** (32 - p);
    cursor = Math.ceil(cursor / blk) * blk;
    if (cursor + blk > end) throw new Error(`Plus de place pour « ${b.nom} » (${b.hotes} hôtes)`);
    out.push({ nom: b.nom, demandes: b.hotes, ...subnetInfo(`${intToIp(cursor)}/${p}`) });
    cursor += blk;
  }
  return out;
}
