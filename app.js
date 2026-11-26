'use strict';
/* Finanzen – Handy-App.
   Läuft komplett lokal: Die Daten kommen als verschlüsselte Datei (.finhandy) vom PC, werden hier auf dem Gerät
   entschlüsselt und bleiben im Speicher dieses Handys. Es gibt keinen Server und keine Übertragung. */

// ====================================================================== Hilfen
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf0 = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
const nf2 = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const mi = s => s.replace('-', '−');
function eur(x, cent = false) {
  if (x == null || Number.isNaN(x)) return '–';
  let v = cent ? Math.round(x * 100) / 100 : Math.round(x);
  if (v === 0) v = 0;
  return mi((cent ? nf2 : nf0).format(v)) + ' €';
}
const vz = x => (x > 0 ? '+' : '') + eur(x);
const pct = (x, st = 0) => x == null ? '–' : mi((x * 100).toFixed(st).replace('.', ',')) + ' %';
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const mKurz = m => MON[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4);
const mLang = m => MONL[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const dDe = d => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '–';
const dKurz = d => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' : '–';
const ton = x => x >= 0 ? 'pos' : 'neg';
const GRUPPEN = {Wohnen: '#0071E3', Lebensmittel: '#34C759', 'Mobilität': '#FF9500', Freizeit: '#5AC8FA', Shopping: '#FF2D55',
  Versicherungen: '#AF52DE', 'Familie & Kinder': '#FFCC00', 'Kredite & Raten': '#FF3B30', Gesundheit: '#A2845E',
  'Finanzen & Behörden': '#8E8E93', Sonstiges: '#C7C7CC', Einkommen: '#34C759'};
const PALETTE = ['#0071E3', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA', '#FFCC00', '#FF2D55', '#8E8E93', '#A2845E'];
const ARTEN = {Mieter: '#0071E3', Frist: '#FF9500', Steuer: '#AF52DE', Kredit: '#FF3B30', Zahlung: '#34C759', Aufgabe: '#8E8E93', Planung: '#5AC8FA'};
const farbeGruppe = (g, i = 0) => GRUPPEN[g] || PALETTE[i % PALETTE.length];

const liste = rows => `<div class="liste">${rows.join('') || '<div class="leer">Nichts vorhanden</div>'}</div>`;
const kv = (a, b) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`;
function zeile({punkt, titel, unter, rechts, akt, fett = true}) {
  const tag = akt ? 'button' : 'div';
  return `<${tag} class="zeile${akt ? ' pfeil' : ''}"${akt ? ` data-a="${esc(akt)}"` : ''}>` +
    (punkt ? `<i class="punkt" style="background:${punkt}"></i>` : '') +
    `<div class="tx"><b>${titel}</b>${unter ? `<small>${unter}</small>` : ''}</div>` +
    (rechts != null ? `<div class="nb${fett ? ' b' : ''}">${rechts}</div>` : '') + `</${tag}>`;
}
const kachel = (akt, titel, wert, info, art = '') =>
  `<button class="kachel" data-a="${esc(akt)}"><span class="mehr">›</span><div class="t">${titel}</div>` +
  `<div class="w">${wert}</div><div class="i ${art}">${info || ''}</div></button>`;
const kopf = (eyebrow, titel, unter = '') =>
  `<div class="kopf"><div class="eyebrow">${eyebrow}</div><h1>${titel}</h1>${unter ? `<div class="unter">${unter}</div>` : ''}</div>` + altHinweis();
function altHinweis() {
  if (!D) return '';
  const tage = Math.floor((Date.now() - new Date(D.stand).getTime()) / 864e5);
  return tage >= 7 ? `<div class="alt">Stand vom ${dDe(D.stand)} – vor ${tage} Tagen. Am PC eine neue Datei erstellen und unter „Mehr“ laden.</div>` : '';
}
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.z); toast.z = setTimeout(() => el.hidden = true, 2200);
}

// ====================================================================== Speicher (IndexedDB, sonst localStorage)
const DB = {
  open: () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('kein IndexedDB'));
    const r = indexedDB.open('finanzen', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }),
  async get(k) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    } catch (e) { try { return JSON.parse(localStorage.getItem('fin_' + k)); } catch (_) { return null; } }
  },
  async set(k, v) {
    try {
      const db = await this.open();
      await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) { localStorage.setItem('fin_' + k, JSON.stringify(v)); }
  },
  async del(k) {
    try {
      const db = await this.open();
      await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) { localStorage.removeItem('fin_' + k); }
  },
};

// ====================================================================== Entschlüsseln (WebCrypto, AES-256-GCM)
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function b64enc(buf) {                                   // Bytes -> Base64 (in Stücken, damit große Dateien nicht abstürzen)
  const a = new Uint8Array(buf); let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
}
// Das Passwort wird nur EINMAL abgefragt: daraus wird ein Schlüssel abgeleitet (nicht auslesbar) und auf dem Gerät gemerkt.
// Neue Dateien vom PC (gleiches Passwort) öffnen sich damit von selbst.
async function schluesselAus(datei, pw) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: b64(datei.salt), iterations: datei.iter, hash: 'SHA-256'},
    km, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function entschluesselnMit(datei, key) {
  const klar = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(datei.iv)}, key, b64(datei.data));
  return JSON.parse(new TextDecoder().decode(klar));
}
async function schluesselMerken(datei, key) {
  S.key = key; S.keySalt = datei.salt; S.keyIter = datei.iter;
  try { await DB.set('schluessel', {salt: datei.salt, iter: datei.iter, key}); } catch (e) { /* Gerät kann es nicht speichern -> Passwort wird dann öfter gefragt */ }
}
async function schluesselLaden() {
  try { const s = await DB.get('schluessel'); if (s && s.key) { S.key = s.key; S.keySalt = s.salt; S.keyIter = s.iter; } } catch (e) { /* ignorieren */ }
}

// ====================================================================== Zustand
let D = null;                                   // entschlüsselte Momentaufnahme
const S = {tab: 'cockpit', vtab: 'mieten', pm: null, q: '', bereich: 'alle', zeit: 'alle', limit: 60, gesp: null, datei: null};

// ====================================================================== Diagramme (SVG, ohne Bibliothek)
// schritte: [Bezeichnung, Betrag, optional Aktion] – mit Aktion ist die Zeile antippbar (Drill-down)
function wasserfall(schritte, endLabel) {
  let cum = 0; const rows = [];
  schritte.forEach(([l, v, akt]) => { rows.push({l, a: cum, b: cum + v, v, akt}); cum += v; });
  rows.push({l: endLabel, a: 0, b: cum, v: cum, total: true});
  const alle = rows.flatMap(r => [r.a, r.b, 0]), mn = Math.min(...alle), mx = Math.max(...alle), span = (mx - mn) || 1;
  const pos = x => (x - mn) / span * 100;
  return `<div class="wf${rows.some(r => r.akt) ? ' wf-klick' : ''}">` + rows.map(r => {
    const l = pos(Math.min(r.a, r.b)), w = Math.max(pos(Math.max(r.a, r.b)) - l, 1);
    const c = r.total ? 'var(--blau)' : (r.v >= 0 ? 'var(--gruen)' : 'var(--rot)'), tag = r.akt ? 'button' : 'div';
    return `<${tag} class="wf-r${r.akt ? ' pfeil' : ''}"${r.akt ? ` data-a="${esc(r.akt)}"` : ''}><div class="wf-l">${esc(r.l)}</div><div class="wf-t"><i style="left:${pos(0)}%"></i>` +
      `<b style="left:${l}%;width:${w}%;background:${c}"></b></div><div class="wf-v ${r.total ? '' : ton(r.v)}">${eur(r.v)}</div></${tag}>`;
  }).join('') + '</div>';
}
function hbalken(items, o = {}) {
  const max = Math.max(...items.map(i => Math.max(i.v, i.avg || 0)), 1);
  return items.map(i => {
    const tag = i.akt ? 'button' : 'div';
    return `<${tag} class="hb"${i.akt ? ` data-a="${esc(i.akt)}"` : ''}><div class="z"><span>${esc(i.l)}</span><span>${i.text ?? eur(i.v)}</span></div>` +
      `<div class="bahn"><b style="width:${Math.max(i.v / max * 100, 0.5)}%;background:${i.c || o.farbe || 'var(--blau)'}"></b>` +
      (i.avg ? `<i style="left:${Math.min(i.avg / max * 100, 99)}%"></i>` : '') + '</div></' + tag + '>';
  }).join('');
}
function donut(items) {
  const total = items.reduce((s, i) => s + i.v, 0) || 1, r = 54, C = 2 * Math.PI * r; let off = 0;
  const kreise = items.map(i => {
    const len = i.v / total * C;
    const s = `<circle r="${r}" cx="75" cy="75" fill="none" stroke="${i.c}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`;
    off += len; return s;
  }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 150 150" role="img"><circle r="${r}" cx="75" cy="75" fill="none" stroke="var(--fuell)" stroke-width="22"/>${kreise}` +
    `<text x="75" y="73" text-anchor="middle" style="font-size:15px;font-weight:650;fill:var(--text)">${eur(total)}</text>` +
    `<text x="75" y="88" text-anchor="middle" style="font-size:8px">gesamt</text></svg>` +
    `<div class="legende">${items.slice(0, 8).map(i => `<div><i style="background:${i.c}"></i><span>${esc(i.l)}</span><em>${Math.round(i.v / total * 100)} %</em></div>`).join('')}</div></div>`;
}
function ring(anteil, farbe, text, unter) {
  const r = 38, C = 2 * Math.PI * r, a = Math.max(0, Math.min(1, anteil));
  return `<svg class="ring" width="112" height="112" viewBox="0 0 100 100" role="img"><circle r="${r}" cx="50" cy="50" fill="none" stroke="var(--fuell)" stroke-width="10"/>` +
    `<circle r="${r}" cx="50" cy="50" fill="none" stroke="${farbe}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${a * C} ${C}" transform="rotate(-90 50 50)"/>` +
    `<text x="50" y="52" text-anchor="middle" style="font-size:17px;font-weight:650;fill:var(--text)">${text}</text>` +
    `<text x="50" y="65" text-anchor="middle" style="font-size:7px">${unter || ''}</text></svg>`;
}
function stapel(items, farben, o = {}) {
  const W = 340, H = o.h || 170, pt = 10, pb = 20;
  let mp = 0, mn = 0;
  items.forEach(it => { let p = 0, n = 0; it.w.forEach(v => v >= 0 ? p += v : n += v); mp = Math.max(mp, p); mn = Math.min(mn, n); });
  (o.linie || []).forEach(v => { mp = Math.max(mp, v); mn = Math.min(mn, v); });
  (o.ziele || []).forEach(z => { mp = Math.max(mp, z.v); });
  const span = (mp - mn) || 1, y = v => pt + (mp - v) / span * (H - pt - pb), bw = W / items.length, b = bw * .58, sch = o.schritt || 2;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--linie)"/>`;
  (o.ziele || []).forEach(z => s += `<line x1="0" x2="${W}" y1="${y(z.v)}" y2="${y(z.v)}" stroke="${z.c}" stroke-dasharray="4 3" opacity=".7"/>`);
  items.forEach((it, i) => {
    const x = i * bw + (bw - b) / 2; let up = 0, dn = 0;
    it.w.forEach((v, k) => {
      if (!v) return;
      const a = v >= 0 ? up : dn, e = a + v, y1 = y(Math.max(a, e)), y2 = y(Math.min(a, e));
      s += `<rect x="${x}" y="${y1}" width="${b}" height="${Math.max(y2 - y1, 1)}" rx="3" fill="${farben[k]}" ${it.sel ? '' : 'opacity=".92"'}/>`;
      if (v >= 0) up = e; else dn = e;
    });
    if (i % sch === (items.length - 1) % sch) s += `<text x="${i * bw + bw / 2}" y="${H - 5}" text-anchor="middle">${it.l}</text>`;
  });
  if (o.linie) {
    s += `<polyline pointer-events="none" fill="none" stroke="var(--blau)" stroke-width="2" stroke-linejoin="round" points="${o.linie.map((v, i) => `${i * bw + bw / 2},${y(v)}`).join(' ')}"/>`;
    s += o.linie.map((v, i) => `<circle pointer-events="none" cx="${i * bw + bw / 2}" cy="${y(v)}" r="2.6" fill="var(--blau)"/>`).join('');
  }
  if (o.akt) items.forEach((it, i) => s += `<rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-a="${esc(o.akt + '|' + it.id)}"/>`);
  return s + '</svg>';
}

// ====================================================================== Sheets (Detail-Fenster)
const stack = [];
function sheet(titel, html) { stack.push({titel, html}); sheetZeigen(); }
// Inhalt des obersten Fensters austauschen (z. B. anderen Monat wählen), ohne den Zurück-Stapel zu verlängern
function sheetErsetzen(titel, html) {
  if (!stack.length || $('#sheet').hidden) return sheet(titel, html);
  const y = $('#sheet-inhalt').scrollTop;
  stack[stack.length - 1] = {titel, html}; sheetZeigen(); $('#sheet-inhalt').scrollTop = y;
}
function sheetZeigen() {
  const s = stack[stack.length - 1];
  $('#sheet-titel').textContent = s.titel;
  $('#sheet-inhalt').innerHTML = s.html; $('#sheet-inhalt').scrollTop = 0;
  $('#sheet-back').hidden = stack.length < 2;
  const neu = $('#sheet').hidden;
  $('#sheet').hidden = false; $('#sheet-bg').hidden = false; document.body.style.overflow = 'hidden';
  if (neu) history.pushState({sheet: 1}, '');
}
function sheetVerstecken() { $('#sheet').hidden = true; $('#sheet-bg').hidden = true; document.body.style.overflow = ''; }
function sheetZu() {
  if ($('#sheet').hidden) return;
  stack.length = 0; sheetVerstecken();
  if (history.state && history.state.sheet) history.back();
}
function sheetZurueck() { stack.pop(); stack.length ? sheetZeigen() : sheetZu(); }
window.addEventListener('popstate', () => { if (stack.length) { stack.length = 0; sheetVerstecken(); } });

// ====================================================================== Datenzugriff Privat
const P = () => D.privat;
const monateListe = () => P().monate.map(m => m.monat);
const privMonat = m => P().monate.find(x => x.monat === m);
const katZeilen = (m, art) => P().kategorien.filter(r => r[0] === m && r[1] === art);
function nachKategorie(m, art) {
  const mp = new Map();
  katZeilen(m, art).forEach(r => { const o = mp.get(r[3]) || {g: r[2], v: 0}; o.v += r[4]; mp.set(r[3], o); });
  return [...mp].map(([k, o]) => ({k, g: o.g, v: o.v})).sort((a, b) => b.v - a.v);
}
function nachGruppe(m, art) {
  const mp = new Map();
  katZeilen(m, art).forEach(r => mp.set(r[2], (mp.get(r[2]) || 0) + r[4]));
  return [...mp].map(([g, v], i) => ({l: g, v})).sort((a, b) => b.v - a.v).map((x, i) => ({...x, c: farbeGruppe(x.l, i)}));
}
function schnittKat(m, art) {
  const ml = monateListe(), i = ml.indexOf(m), vor = ml.slice(Math.max(0, i - 6), i), mp = new Map();
  vor.forEach(x => katZeilen(x, art).forEach(r => mp.set(r[3], (mp.get(r[3]) || 0) + r[4])));
  return new Map([...mp].map(([k, v]) => [k, v / Math.max(vor.length, 1)]));
}
function standardMonat() {
  const ml = monateListe(), aktuell = D.monat;
  const vorher = ml.filter(m => m < aktuell);
  return vorher.length ? vorher[vorher.length - 1] : ml[ml.length - 1];
}
const buchRow = b => zeile({titel: esc(b[3] || '–'), akt: `s_buch|${b[0]}`, rechts: `<span class="${ton(b[2])}">${eur(b[2], true)}</span>`,
  unter: `${dDe(b[1])} · ${esc(b[7])}${b[11] ? ' · Beleg' : ''}${b[4] ? '<br>' + esc(b[4].slice(0, 80)) : ''}`});

// ====================================================================== Bildschirme
function cockpit() {
  const c = D.cockpit, v = c.vermoegen, f = c.frei, m = c.mieten, ck = c.check, h = new Date().getHours();
  const gruss = h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  const d = new Date(D.heute), tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const anteil = m.soll ? m.ist / m.soll : 1;
  const verl = D.privat.monate.slice(-12);
  return kopf('Überblick', gruss, `${tage[d.getDay()]}, ${d.getDate()}. ${MONL[d.getMonth()]} ${d.getFullYear()}`) +
    `<div class="raster">` +
    kachel('s_verm', 'Nettovermögen', eur(v.netto), v.konten_fehlen ? 'ohne Kontostände' : 'Immobilie + Konten − Kredite') +
    kachel('s_frei', 'Monatlich frei', eur(f.wert), `privat ${eur(f.privat)} · Vermietung ${eur(f.vermietung)}`, f.wert > 0 ? 'gut' : 'schlecht') +
    kachel('s_mieten', `Mieten ${D.monat.slice(5)}/${D.monat.slice(0, 4)}`, eur(m.ist), `von ${eur(m.soll)} Soll · ${m.offen ? m.offen + ' offen' : 'alles da'}`, m.offen ? 'schlecht' : 'gut') +
    kachel('s_check', 'Monats-Check', `${ck.erledigt} / ${ck.gesamt}`, ck.erledigt === ck.gesamt ? 'erledigt' : `${ck.gesamt - ck.erledigt} Punkte offen`, ck.erledigt === ck.gesamt ? 'gut' : '') +
    `</div>` +
    `<div class="werkzeuge">${[['spielraum', 'Spielraum'], ['freiheit', 'Freiheit'], ['kauf', 'Wohnungs-Check'], ['bericht', 'Bericht']].map(([a, l]) => `<button data-a="${a}">${l}</button>`).join('')}</div>` +
    `<h3>Wichtig</h3>` + kurzListe(wichtigListe().map((w, i) => zeile({
      punkt: w.stufe === 'fehler' ? 'var(--rot)' : w.stufe === 'warnung' ? 'var(--orange)' : 'var(--blau)', akt: `s_wichtig|${i}`,
      titel: esc(w.titel), unter: esc((w.text || '').slice(0, 90)), rechts: w.betrag ? eur(w.betrag) : null})).concat(
      wichtigListe().length ? [] : [zeile({punkt: 'var(--gruen)', titel: 'Alles im grünen Bereich'})]), 5, 'Alle') +
    `<h3>Als Nächstes</h3>` + liste(c.termine.slice(0, 5).map(t => zeile({punkt: ARTEN[t.art] || 'var(--grau)', titel: esc(t.titel),
      unter: esc(t.detail), rechts: dKurz(t.datum), fett: false})).concat(todosKurz())) +
    `<h3>Was übrig bleibt <small>auf einen Monat tippen</small></h3><div class="karte">` +
    stapel(verl.map(x => ({id: x.monat, l: MON[+x.monat.slice(5, 7) - 1], w: [x.saldo, x.vermietung]})), ['var(--blau)', 'var(--gruen)'], {akt: 's_monat'}) +
    `<div class="klein"><span style="color:var(--blau)">●</span> privat &nbsp; <span style="color:var(--gruen)">●</span> Vermietung</div></div>`;
}

function vermietung() {
  const t = [['mieten', 'Mieten'], ['zimmer', 'Zimmer'], ['geld', 'Geld'], ['steuer', 'Steuer']];
  const seg = `<div class="seg">${t.map(([k, l]) => `<button class="${S.vtab === k ? 'an' : ''}" data-a="vtab|${k}">${l}</button>`).join('')}</div>`;
  const inhalt = {mieten: vMieten, zimmer: vZimmer, geld: vGeld, steuer: vSteuer}[S.vtab]();
  return kopf('Vermietung', {mieten: 'Mieten', zimmer: 'Zimmer & Mieter', geld: 'Cashflow & Kredit', steuer: 'Steuer'}[S.vtab]) + seg + inhalt;
}
function vMieten() {
  const V = D.vermietung, c = D.cockpit.mieten, anteil = c.soll ? c.ist / c.soll : 1;
  let h = `<div class="karte" style="display:flex;gap:16px;align-items:center">${ring(anteil, anteil >= .999 ? 'var(--gruen)' : 'var(--blau)', Math.round(anteil * 100) + ' %', 'eingegangen')}` +
    `<div><div class="gross">${eur(c.ist)}</div><div class="unterz">von ${eur(c.soll)} Soll · ${mLang(D.monat)}</div>` +
    `<span class="chip">${c.offen ? c.offen + ' Rückstand' + (c.offen > 1 ? 'e' : '') : 'alles bezahlt'}</span></div></div>`;
  if (V.rueckstaende.length) {
    h += `<h3>Rückstände <small>insgesamt ${eur(V.rueckstaende.reduce((s, r) => s + r.offen, 0))}</small></h3>` + liste(V.rueckstaende.map(r => zeile({
      punkt: 'var(--rot)', akt: `s_mieter|${r.vertrag}`, titel: esc(r.einheit + ' · ' + r.mieter),
      unter: esc(r.zahler) + (r.monate.length ? ' · ' + r.monate.length + ' Monat' + (r.monate.length > 1 ? 'e' : '') : ''), rechts: `<span class="neg">${eur(r.offen)}</span>`})));
  }
  h += `<h3>Mieten ${mLang(D.monat)}</h3>` + liste(V.monat.map(r => zeile({
    punkt: r.differenz >= -0.5 ? 'var(--gruen)' : r.ist > 0 ? 'var(--orange)' : 'var(--rot)', akt: `s_mieter|${r.vertrag}`,
    titel: esc(r.einheit + ' · ' + r.mieter), unter: `Soll ${eur(r.soll, true)} · bezahlt ${eur(r.ist, true)}`,
    rechts: r.differenz >= -0.5 ? '<span class="pos">bezahlt</span>' : `<span class="neg">offen ${eur(-r.differenz)}</span>`})));
  return h;
}
function vertragFinden(einheit, mieter) { return D.vermietung.vertraege.find(v => v.einheit === einheit && v.mieter === mieter); }
function vZimmer() {
  const V = D.vermietung, gruppen = {};
  V.belegung.forEach(b => (gruppen[b.objekt] = gruppen[b.objekt] || []).push(b));
  let h = '';
  Object.entries(gruppen).forEach(([obj, zs]) => {
    h += `<h3>${esc(obj)} <small>${zs.filter(z => z.mieter).length} von ${zs.length} belegt</small></h3>` + liste(zs.map(z => {
      const vt = z.mieter ? vertragFinden(z.einheit, z.mieter) : null;
      return zeile({punkt: z.mieter ? 'var(--gruen)' : z.danach ? 'var(--orange)' : 'var(--rot)', akt: vt ? `s_mieter|${vt.id}` : null,
        titel: esc(z.einheit + ' · ' + (z.mieter || 'frei')),
        unter: (z.mieter ? (z.bis ? 'bis ' + dDe(z.bis) : 'unbefristet') : '') + (z.danach ? (z.mieter ? ' · ' : '') + 'danach ' + esc(z.danach.mieter) + ' ab ' + dKurz(z.danach.von) : ''),
        rechts: z.miete ? eur(z.miete) : null});
    }));
  });
  h += `<h3>Alle Verträge</h3>` + liste(V.vertraege.map(v => zeile({
    punkt: v.status === 'aktiv' ? 'var(--gruen)' : v.status === 'geplant' ? 'var(--orange)' : 'var(--grau)', akt: `s_mieter|${v.id}`,
    titel: esc(v.einheit + ' · ' + v.mieter), unter: `${v.status} · ${dKurz(v.von)}${v.bis ? ' – ' + dDe(v.bis) : ' – unbefristet'}`, rechts: eur(v.warm)})));
  h += `<h3>Kautionen <small>${eur(V.kautionen_summe)} gehalten</small></h3>` + liste(V.kautionen.filter(k => k.erhalten > 0).map(k => zeile({
    titel: esc(k.einheit + ' · ' + k.mieter), unter: esc(k.pruefung), rechts: eur(k.erhalten)})));
  return h;
}
function vGeld() {
  const V = D.vermietung, cf = V.cashflow, jetzt = cf[0], ek = V.ek_rendite;
  let h = `<div class="raster">` +
    kachel('s_cf', 'Cashflow ' + mKurz(D.monat), eur(jetzt ? jetzt.cashflow : 0), 'Plan: Mieten − Kosten − Rate', (jetzt && jetzt.cashflow > 0) ? 'gut' : 'schlecht') +
    kachel('s_ek', 'EK-Rendite', pct(ek, 1), 'pro Jahr inkl. Tilgung') + `</div>`;
  if (cf.length) {
    h += `<h3>Plan-Cashflow <small>auf einen Monat tippen</small></h3><div class="karte">` +
      stapel(cf.slice(0, 13).map(x => ({id: x.monat, l: MON[+x.monat.slice(5, 7) - 1], w: [x.cashflow]})), ['var(--blau)'],
        {akt: 's_cfm', ziele: [{v: V.ziel_cashflow.teilzeit, c: 'var(--orange)'}, {v: V.ziel_cashflow.ausstieg, c: 'var(--lila)'}]}) +
      `<div class="klein"><span style="color:var(--orange)">- - -</span> Ziel Teilzeit ${eur(V.ziel_cashflow.teilzeit)} &nbsp; <span style="color:var(--lila)">- - -</span> Ziel Ausstieg ${eur(V.ziel_cashflow.ausstieg)}</div></div>`;
  }
  h += `<h3>Kredite</h3>` + liste(V.kredite.map((k, j) => zeile({titel: esc(k.name), akt: `s_kredit|${j}`, unter: `${pct(k.zins, 2)} · Rate ${eur(k.rate, true)} · Zinsbindung bis ${dDe(k.zinsbindung_bis)}`,
    rechts: `${eur(k.restschuld)}<br><span style="font-weight:400;font-size:.75rem;color:var(--text2)">Restschuld</span>`})));
  (V.kennzahlen || []).forEach(k => {
    h += `<h3>Kennzahlen <small>${esc(k.objekt)}</small></h3><div class="karte">` +
      kv('Marktwert (geschätzt)', eur(k.marktwert)) + kv('Restschuld', eur(k.restschuld)) + kv('Beleihungsauslauf', pct(k.ltv, 0)) +
      kv('Bruttomietrendite', pct(k.bruttorendite, 1)) + kv('Nettomietrendite', pct(k.nettorendite, 1)) +
      kv('Schuldendienstdeckung (DSCR)', k.dscr == null ? '–' : String(k.dscr.toFixed(2)).replace('.', ',')) +
      kv('Cashflow vor Steuer / Jahr', eur(k.cf_vor_steuer)) + kv('Cashflow nach Steuer / Jahr', eur(k.cf_nach_steuer)) + `</div>`;
  });
  return h;
}
function vSteuer() {
  const s = D.vermietung.steuer, eff = -s.ergebnis * s.satz, gruppen = {};
  s.positionen.forEach(p => (gruppen[p.objekt] = gruppen[p.objekt] || []).push(p));
  let h = `<div class="raster">` + kachel('s_steuer', 'Ergebnis V+V ' + s.jahr, eur(s.ergebnis), 'Einnahmen − Werbungskosten', s.ergebnis > 0 ? '' : 'gut') +
    kachel('s_steuer', 'Steuereffekt (ca.)', eur(eff), `bei ${pct(s.satz, 0)} Grenzsteuersatz`, eff >= 0 ? 'gut' : 'schlecht') + `</div>` +
    `<div class="raster" style="margin-top:10px">` + kachel('s_steuer', 'Einnahmen', eur(s.einnahmen), 'Mieten & Sonstiges') +
    kachel('s_steuer', 'Werbungskosten', eur(s.werbungskosten), 'Zinsen, AfA, Kosten') + `</div>`;
  Object.entries(gruppen).forEach(([obj, ps]) => {
    h += `<h3>${esc(obj)} <small>Ergebnis ${eur(ps.reduce((a, p) => a + p.betrag, 0))}</small></h3>` + liste(ps.map(p => zeile({
      titel: esc(p.position), unter: p.bereich, akt: steuerZiel(p.position) ? `s_stpos|${s.positionen.indexOf(p)}` : null,
      rechts: `<span class="${ton(p.betrag)}">${eur(p.betrag)}</span>`})));
  });
  return h + `<div class="klein">Grobe Schätzung aus Planwerten und gebuchten Kosten – keine Steuerberatung. Das Steuerpaket gibt es am PC.</div>`;
}

function privat() {
  const ml = monateListe(); if (!S.pm || !ml.includes(S.pm)) S.pm = standardMonat();
  const m = S.pm, z = privMonat(m), i = ml.indexOf(m), typ = P().typisch;
  const dE = z.einnahmen - typ.einnahmen, dA = z.ausgaben - typ.ausgaben;
  const gr = nachGruppe(m, 'a'), kat = nachKategorie(m, 'a'), schn = schnittKat(m, 'a');
  let h = kopf('Privat', 'Private Finanzen') +
    `<div class="monat-nav"><button data-a="pm|-1" ${i <= 0 ? 'disabled' : ''}>‹</button><b>${mLang(m)}${m === D.monat ? ' <span class="chip">läuft</span>' : ''}</b>` +
    `<button data-a="pm|1" ${i >= ml.length - 1 ? 'disabled' : ''}>›</button></div>` +
    `<div class="raster">` +
    kachel('p_ein', 'Einnahmen', eur(z.einnahmen), `${vz(dE)} ggü. typisch`, dE >= 0 ? 'gut' : '') +
    kachel('p_aus', 'Ausgaben', eur(z.ausgaben), `${vz(dA)} ggü. typisch`, dA > 0 ? 'schlecht' : 'gut') +
    kachel('p_saldo', 'Übrig', eur(z.saldo), 'Einnahmen − Ausgaben', z.saldo >= 0 ? 'gut' : 'schlecht') +
    kachel('p_quote', 'Sparquote', z.sparquote == null ? '–' : pct(z.sparquote, 0), 'übrig ÷ Einnahmen') + `</div>`;
  if (gr.length) h += `<h3>Wofür das Geld ausgegeben wird</h3><div class="karte">${donut(gr)}</div>`;
  if (kat.length) h += `<h3>Kategorien <small>antippen für Details · Strich = Ø 6 Monate</small></h3>` +
    kurzBalken(kat.map((k, j) => ({l: k.k, v: k.v, avg: schn.get(k.k), c: farbeGruppe(k.g, j), akt: `s_kat|${m}|a|${k.k}`})), 6);
  h += `<h3>Verlauf <small>auf einen Monat tippen</small></h3><div class="karte">` +
    stapel(P().monate.slice(-12).map(x => ({id: x.monat, l: MON[+x.monat.slice(5, 7) - 1], w: [x.einnahmen, -x.ausgaben]})), ['var(--gruen)', 'var(--rot)'],
      {akt: 's_pmonat', linie: P().monate.slice(-12).map(x => x.saldo)}) +
    `<div class="klein"><span style="color:var(--gruen)">●</span> Einnahmen &nbsp; <span style="color:var(--rot)">●</span> Ausgaben &nbsp; <span style="color:var(--blau)">●</span> übrig</div></div>`;
  const fix = P().fixkosten;
  if (fix.length) h += `<h3>Fixkosten & Abos <small>${eur(fix.reduce((s, f) => s + f.monat, 0))} / Monat</small></h3>` +
    kurzListe(fix.map((f, j) => zeile({titel: esc(f.name), akt: `s_fix|${j}`,
      unter: `${esc(f.kategorie)} · ${esc(f.rhythmus)}${f.aenderung ? ` · <span class="${f.aenderung > 0 ? 'neg' : 'pos'}">${f.aenderung > 0 ? 'teurer' : 'günstiger'} ${pct(Math.abs(f.aenderung), 0)}</span>` : ''}`,
      rechts: eur(f.monat, true)})), 5);
  const rat = P().raten.map((r, j) => ({...r, j})).filter(r => r.aktiv);
  if (rat.length) h += `<h3>Raten & Kredite <small>${eur(P().raten_summe)} / Monat</small></h3>` +
    liste(rat.map(r => zeile({titel: esc(r.name), akt: `s_rate|${r.j}`, unter: `${esc(r.art)} · zuletzt ${dDe(r.letzte)}`, rechts: eur(r.monat, true)})));
  const kontoSumme = P().konten.reduce((s, k) => s + (k.stand || 0), 0);
  if (P().konten.length && P().konten.some(k => k.stand)) h += `<h3>Konten <small>${eur(kontoSumme)}</small></h3>` +
    liste(P().konten.map(k => zeile({titel: esc(k.konto), rechts: eur(k.stand, true)})));
  h += sparzieleHtml();
  const bud = Object.entries(P().budgets);
  if (bud.length) {
    const ist = new Map(nachKategorie(m, 'a').map(k => [k.k, k.v]));
    h += `<h3>Budgets <small>${mLang(m)}</small></h3><div class="karte">` + hbalken(bud.map(([k, b]) => ({l: k, v: ist.get(k) || 0, avg: b, text: `${eur(ist.get(k) || 0)} von ${eur(b)}`,
      c: (ist.get(k) || 0) > b ? 'var(--rot)' : 'var(--blau)', akt: `s_kat|${m}|a|${k}`}))) + `</div>`;
  }
  return h;
}

function zahlAusText(t) {
  if (!/^[\d.,]+$/.test(t)) return null;
  let s = t;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return Number.isNaN(n) ? null : n;
}
function sucheFilter() {
  const toks = S.q.toLowerCase().split(/\s+/).filter(Boolean), nums = toks.map(zahlAusText), jetzt = new Date(D.heute).getTime();
  return D.buchungen.filter(b => {
    if (S.bereich !== 'alle' && b[6] !== (S.bereich === 'vermietung' ? 'V' : 'P')) return false;
    if (S.zeit === 'monat' && b[1].slice(0, 7) !== D.monat) return false;
    if (S.zeit === '30' && (jetzt - new Date(b[1]).getTime()) / 864e5 > 30) return false;
    if (S.zeit === 'jahr' && b[1].slice(0, 4) !== D.heute.slice(0, 4)) return false;
    if (!toks.length) return true;
    const text = (b[3] + ' ' + b[4] + ' ' + b[7] + ' ' + b[5] + ' ' + dDe(b[1])).toLowerCase();
    return toks.every((t, i) => text.includes(t) || (nums[i] != null && Math.abs(Math.abs(b[2]) - nums[i]) < 0.005));
  });
}
function sucheErgebnis() {
  const r = sucheFilter(), rein = r.filter(b => b[2] > 0 && b[8] !== 'neutral').reduce((s, b) => s + b[2], 0),
    raus = r.filter(b => b[2] < 0 && b[8] !== 'neutral').reduce((s, b) => s + b[2], 0);
  return `<div class="summe">${nf0.format(r.length)} Buchungen · rein ${eur(rein)} · raus ${eur(raus)}</div>` +
    liste(r.slice(0, S.limit).map(buchRow)) +
    (r.length > S.limit ? `<button class="knopf hell" data-a="mehr_treffer">Weitere ${Math.min(60, r.length - S.limit)} anzeigen</button>` : '');
}
function suche() {
  const chip = (k, l, w, an) => `<button class="${an ? 'an' : ''}" data-a="sf|${k}|${w}">${l}</button>`;
  return kopf('Suche', 'Buchungen', `${nf0.format(D.buchungen.length)} Buchungen auf allen Konten`) +
    `<div class="suche"><span>⌕</span><input id="q" type="search" placeholder="Name, Zweck oder Betrag …" value="${esc(S.q)}" autocomplete="off" autocapitalize="none" enterkeyhint="search"></div>` +
    `<div class="filter">${[['alle', 'Alle'], ['vermietung', 'Vermietung'], ['privat', 'Privat']].map(([k, l]) => chip('bereich', l, k, S.bereich === k)).join('')}` +
    `${[['alle', 'Alle Zeit'], ['monat', 'Dieser Monat'], ['30', '30 Tage'], ['jahr', 'Dieses Jahr']].map(([k, l]) => chip('zeit', l, k, S.zeit === k)).join('')}</div>` +
    `<div id="erg">${sucheErgebnis()}</div>`;
}

function mehr() {
  const gesp = S.gesp && S.gesp.modus === 'gesperrt', t = D.termine;
  const bald = new Date(new Date(D.heute).getTime() + 42 * 864e5).toISOString().slice(0, 10), naechste = t.filter(x => x.datum <= bald);
  return kopf('Mehr', 'Mehr') + werkzeugeHtml() + todosHtml() + erfassungenHtml() +
    `<h3>Termine & Fristen <small>nächste 6 Wochen</small></h3>` + liste((naechste.length ? naechste : t.slice(0, 3)).map(terminZeile)) +
    (t.length > naechste.length ? `<button class="mehr-knopf" data-a="s_termine">Alle ${t.length} Termine anzeigen</button>` : '') +
    `<h3>Daten auf diesem Handy</h3><div class="karte">${kv('Stand', dDe(D.stand) + ' ' + D.stand.slice(11))}${kv('Buchungen', nf0.format(D.buchungen.length))}` +
    `${kv('Verträge', D.vermietung.vertraege.length)}${kv('Passwort beim Öffnen', gesp ? 'ja' : 'nein')}</div>` +
    `<label class="knopf">Neue Daten laden<input type="file" id="datei2" hidden></label>` +
    `<button class="knopf hell" data-a="${gesp ? 'schutz_aus' : 'schutz_an'}">${gesp ? 'Passwortabfrage ausschalten' : 'Passwort bei jedem Öffnen verlangen'}</button>` +
    `<button class="knopf hell" data-a="app_update">App aktualisieren <small id="app_version" style="opacity:.6"></small></button>` +
    `<button class="knopf rot" data-a="loeschen">Daten von diesem Handy löschen</button>` +
    `<div class="klein">Die Daten liegen nur in diesem Handy und wurden nie über das Internet übertragen. Änderungen machst du am PC – danach eine neue Datei erstellen und hier laden.<br><br>` +
    `Tipp: In Safari auf „Teilen“ → „Zum Home-Bildschirm“, dann startet die App wie eine normale App – auch ohne Internet.</div>`;
}

const terminZeile = x => zeile({punkt: ARTEN[x.art] || 'var(--grau)', titel: esc(x.titel), unter: esc(x.detail), rechts: dKurz(x.datum), fett: false});
function sheetTermine() {
  const gr = {}; D.termine.forEach(x => (gr[x.datum.slice(0, 7)] = gr[x.datum.slice(0, 7)] || []).push(x));
  sheet('Termine & Fristen', Object.entries(gr).map(([m, ts]) => `<h3>${mLang(m)}</h3>` + liste(ts.map(terminZeile))).join('') +
    `<div class="klein">Farben: <span style="color:${ARTEN.Mieter}">●</span> Mieter · <span style="color:${ARTEN.Zahlung}">●</span> Zahlung · <span style="color:${ARTEN.Frist}">●</span> Frist · <span style="color:${ARTEN.Steuer}">●</span> Steuer</div>`);
}

// ====================================================================== Detail-Fenster
function sheetVerm() {
  const v = D.cockpit.vermoegen;
  sheet('Nettovermögen', `<div class="gross">${eur(v.netto)}</div><div class="unterz">Was dir gehört minus was du schuldest</div>` +
    `<h3 style="margin-top:6px">Besitz <small>${eur(v.aktiva.reduce((s, a) => s + a[1], 0))}</small></h3>` + liste(v.aktiva.map(a => zeile({punkt: 'var(--gruen)', titel: esc(a[0]), rechts: eur(a[1])}))) +
    `<h3>Schulden <small>${eur(v.passiva.reduce((s, a) => s + a[1], 0))}</small></h3>` + liste(v.passiva.map(a => zeile({punkt: 'var(--rot)', titel: esc(a[0]), rechts: eur(a[1])}))) +
    `<h3>Zusammensetzung</h3><div class="karte">${wasserfall(v.aktiva.map(a => [a[0], a[1]]).concat(v.passiva.map(a => [a[0], -a[1]])), 'Netto')}</div>` +
    (v.ltv != null ? `<div class="klein">Beleihungsauslauf ${pct(v.ltv, 0)} – je niedriger, desto besser die Konditionen bei der Anschlussfinanzierung.</div>` : '') +
    (v.konten_fehlen ? `<div class="klein">Kontostände fehlen noch – am PC eintragen.</div>` : ''));
}
function sheetFrei() {
  const f = D.cockpit.frei, ziel = ['s_typisch', 's_soll', 's_cf', D.vermietung.kredite.length ? 's_kredit|0' : null];
  const k = D.vermietung.kredite[0], tilg = k && k.restschuld ? k.rate - k.restschuld * k.zins / 12 : 0;
  sheet('Monatlich frei', `<div class="gross ${ton(f.wert)}">${eur(f.wert)}</div><div class="unterz">Was dir in einem normalen Monat übrig bleibt · Zeile antippen = Details</div>` +
    `<div class="karte">${wasserfall(f.schritte.map((s, i) => [s[0], s[1], ziel[i]]), 'frei')}</div>` +
    (tilg > 0 ? `<div class="karte tipp">Von der Kreditrate sind gerade <b>${eur(tilg)}</b> Tilgung – das Geld ist nicht weg, es wird zu Eigentum an der Wohnung.</div>` : '') +
    erkl(`<b>Privat übrig</b> ist der mittlere Wert (Median) der letzten 6 abgeschlossenen Monate – ein einzelner teurer Monat verzerrt ihn nicht.<br>` +
      `<b>Mieten</b> und <b>Kosten</b> sind Planwerte laut Verträgen und Einstellungen, nicht die tatsächlichen Kontobewegungen.<br>` +
      `<b>frei</b> = Privat übrig + Mieten − Kosten − Kreditrate.`));
}
function sheetMieten() {
  const c = D.cockpit.mieten;
  sheet('Mieten ' + mLang(D.monat), `<div class="gross">${eur(c.ist)} <span style="font-size:1rem;color:var(--text2);font-weight:500">von ${eur(c.soll)}</span></div>` +
    `<div class="unterz">${c.soll ? Math.round(c.ist / c.soll * 100) : 100} % eingegangen</div>` + vMieten().replace(/^[\s\S]*?(<h3>Rückstände|<h3>Mieten)/, '$1'));
}
function sheetCheck() {
  const ck = D.cockpit.check;
  sheet('Monats-Check', `<div class="gross">${ck.erledigt} von ${ck.gesamt}</div><div class="unterz">Was diesen Monat zu tun ist (am PC erledigen)</div>` +
    liste(ck.punkte.map(p => zeile({punkt: p.ok ? 'var(--gruen)' : 'var(--orange)', titel: esc(p.text), fett: false}))));
}
function sheetWichtig(i) {
  const w = wichtigListe()[i]; if (!w) return;
  if (w.akt) { const [n, ...p] = w.akt.split('|'); return AKT[n](...p); }    // Budget-Hinweise öffnen direkt die Kategorie
  const r = w.vertrag ? D.vermietung.rueckstaende.find(x => x.vertrag === w.vertrag) : null;
  sheet(w.titel, (w.betrag ? `<div class="gross neg">${eur(w.betrag)}</div><div class="unterz">offen</div>` : '') +
    (w.text ? `<div class="karte" style="line-height:1.5">${esc(w.text)}</div>` : '') +
    (r && r.monate.length ? `<h3>Offene Monate</h3>` + liste(r.monate.map(x => zeile({punkt: x.ist > 0 ? 'var(--orange)' : 'var(--rot)', titel: mLang(x.monat),
      unter: `Soll ${eur(x.soll, true)} · bezahlt ${eur(x.ist, true)}`, rechts: `<span class="neg">${eur(x.ist - x.soll)}</span>`, akt: `s_mmonat|${w.vertrag}|${x.monat}`}))) : '') +
    (w.vertrag ? `<button class="knopf" data-a="s_mieter|${esc(w.vertrag)}">Mieterkonto öffnen</button>` : ''));
}
function sheetMonat(m) {
  const x = P().monate.find(a => a.monat === m); if (!x) return;
  const gesamt = x.saldo + x.vermietung;
  sheet(mLang(m), `<div class="gross ${ton(gesamt)}">${eur(gesamt)}</div><div class="unterz">privat + Vermietung (laut Konto) · Zeile antippen</div>` +
    `<div class="karte">${wasserfall([['Privat rein', x.einnahmen, `p_ein_m|${m}`], ['Privat raus', -x.ausgaben, `p_aus_m|${m}`], ['Vermietung (netto)', x.vermietung, `s_vmonat|${m}`]], 'übrig')}</div>` +
    erkl('Anders als „Monatlich frei“ zeigt das hier, was in diesem Monat <b>tatsächlich</b> auf den Konten passiert ist – einmalige Ausgaben eingeschlossen. Umbuchungen zwischen deinen eigenen Konten zählen nicht.'));
}
function sheetMieter(id) {
  const v = D.vermietung.vertraege.find(x => x.id === id); if (!v) return;
  const saldo = v.konto.reduce((s, r) => s + r.ist - r.soll, 0), offen = saldo < -0.5;
  sheet(v.mieter, `<div class="gross ${offen ? 'neg' : ''}">${offen ? eur(-saldo) + ' offen' : saldo > 0.5 ? eur(saldo) + ' Guthaben' : 'ausgeglichen'}</div>` +
    `<div class="unterz">${esc(v.einheit)} · ${esc(v.objekt)} · <span class="chip">${esc(v.status)}</span></div>` +
    (v.konto.length ? `<h3 style="margin-top:6px">Mieterkonto <small>Monat antippen = Zahlungen</small></h3>` + kurzListe(v.konto.slice().reverse().map(r => {
      const d = r.ist - r.soll;
      return zeile({punkt: d >= -0.5 ? 'var(--gruen)' : r.ist > 0 ? 'var(--orange)' : 'var(--rot)', titel: mLang(r.monat), unter: `Soll ${eur(r.soll, true)} · bezahlt ${eur(r.ist, true)}`,
        rechts: d >= -0.5 ? '<span class="pos">ok</span>' : `<span class="neg">${eur(d)}</span>`, akt: `s_mmonat|${v.id}|${r.monat}`});
    }), 6) : '') +
    `<h3>Vertrag</h3><div class="karte">${kv('Warmmiete', eur(v.warm, true))}${v.kalt ? kv('davon kalt', eur(v.kalt, true)) : ''}` +
    `${kv('Mietbeginn', dDe(v.von))}${kv('Mietende', v.bis ? dDe(v.bis) : 'unbefristet')}` +
    `${kv('Zahler', v.zahler.map(z => esc(z.name) + ' ' + eur(z.betrag)).join('<br>') || '–')}` +
    `${kv('Kaution', eur(v.kaution_erhalten) + ' erhalten' + (v.kaution && v.kaution !== v.kaution_erhalten ? ' (vereinbart ' + eur(v.kaution) + ')' : ''))}` +
    `${v.kanal ? kv('Kanal', esc(v.kanal)) : ''}${v.notiz ? kv('Notiz', esc(v.notiz)) : ''}</div>` + mieterAktionen(v));
}
function sheetCf() {
  const V = D.vermietung, j = V.cashflow[0];
  sheet('Cashflow ' + mLang(D.monat), `<div class="gross ${ton(j ? j.cashflow : 0)}">${eur(j ? j.cashflow : 0)}</div><div class="unterz">Mieten − laufende Kosten − Kreditrate (Plan) · Zeile antippen</div>` +
    `<div class="karte">${wasserfall(V.cashflow_schritte.map(s => [s[0], s[1], cfZiel(s[0])]), 'Cashflow')}</div>` +
    (j && j.tilgung ? `<div class="karte tipp">Davon Tilgung <b>${eur(j.tilgung)}</b>: Damit zahlst du den Kredit ab – das Geld wird zu Eigenkapital in der Wohnung.</div>` : '') +
    erkl('Planwerte: Mieten laut Verträgen, Kosten laut Einstellungen (Objekt), Kreditrate laut Kreditvertrag. Tippe auf eine Kostenzeile, um sie mit den tatsächlich gebuchten Beträgen zu vergleichen.'));
}
function sheetEk() {
  const V = D.vermietung, k = V.kennzahlen || [];
  const sum = f => k.reduce((s, x) => s + (x[f] || 0), 0);
  sheet('Eigenkapital-Rendite', `<div class="gross">${pct(V.ek_rendite, 1)}</div><div class="unterz">pro Jahr auf das eingesetzte Eigenkapital</div>` +
    `<div class="karte">${wasserfall([['Mieten / Jahr', sum('miete_jahr')], ['Leerstand', -sum('leerstand')], ['Bewirtschaftung', -sum('bewirtschaftung')],
      ['Rücklagen', -(sum('ruecklage_weg') + sum('instandhaltung'))], ['Zinsen', -sum('zins')], ['Steuer', -sum('steuer')]], 'Cashflow n. St.')}</div>` +
    `<div class="karte" style="margin-top:10px">${kv('Cashflow nach Steuer / Jahr', eur(sum('cf_nach_steuer')))}${kv('Tilgung / Jahr', eur(sum('tilgung')))}</div>` +
    `<div class="klein">Wertsteigerung der Wohnung ist nicht eingerechnet – das wäre zusätzlicher Ertrag.</div>`);
}
function sheetPriv(art, m) {
  const z = privMonat(m), e = art === 'e', daten = nachKategorie(m, art), schn = schnittKat(m, art);
  sheet((e ? 'Einnahmen ' : 'Ausgaben ') + mKurz(m), `<div class="gross">${eur(e ? z.einnahmen : z.ausgaben)}</div><div class="unterz">${mLang(m)}${e ? '' : ' · Strich = Ø der letzten 6 Monate'}</div>` +
    `<div class="karte">${hbalken(daten.map((k, j) => ({l: k.k, v: k.v, avg: e ? 0 : schn.get(k.k), c: e ? 'var(--gruen)' : farbeGruppe(k.g, j), akt: `s_kat|${m}|${art}|${k.k}`})))}</div>`);
}
function sheetSaldo(m) {
  const z = privMonat(m);
  sheet('Übrig ' + mKurz(m), `<div class="gross ${ton(z.saldo)}">${eur(z.saldo)}</div><div class="unterz">${mLang(m)}</div>` +
    `<div class="karte">${wasserfall([['Einnahmen', z.einnahmen], ['Ausgaben', -z.ausgaben]], 'übrig')}</div>` +
    `<h3>Die letzten 12 Monate</h3><div class="karte">${stapel(P().monate.slice(-12).map(x => ({id: x.monat, l: MON[+x.monat.slice(5, 7) - 1], w: [x.saldo]})), ['var(--blau)'])}</div>`);
}
function sheetQuote(m) {
  const z = privMonat(m);
  sheet('Sparquote ' + mKurz(m), `<div class="gross">${z.sparquote == null ? '–' : pct(z.sparquote, 0)}</div><div class="unterz">${eur(z.saldo)} von ${eur(z.einnahmen)} übrig</div>` +
    liste(P().monate.slice(-12).reverse().map(x => zeile({titel: mLang(x.monat), rechts: x.sparquote == null ? '–' : `<span class="${ton(x.sparquote)}">${pct(x.sparquote, 0)}</span>`}))) +
    `<div class="klein">Sparquote = übrig ÷ Einnahmen. 10–20 % gelten als solide, mehr als 20 % als sehr gut.</div>`);
}
function sheetBuchung(id) {
  const b = D.buchungen.find(x => x[0] === +id); if (!b) return;
  sheet('Buchung', `<div class="gross ${ton(b[2])}">${eur(b[2], true)}</div><div class="unterz">${esc(b[3] || '–')}</div><div class="karte">` +
    kv('Datum', dDe(b[1])) + kv('Verwendungszweck', esc(b[4] || '–')) + kv('Konto', esc(b[5] || '–')) +
    kv('Bereich', b[6] === 'V' ? 'Vermietung' : 'Privat') + kv('Kategorie', esc(b[7])) + (b[9] ? kv('Objekt', esc(b[9])) : '') +
    (b[10] ? kv('Vertrag', esc(b[10])) : '') + kv('Beleg', b[11] ? 'abgelegt (am PC)' : 'keiner') + `</div>` + gleicherEmpfaenger(b));
}

// ====================================================================== Aktionen
const AKT = {
  tab: t => { S.tab = t; render(); scrollTo(0, 0); },
  vtab: t => { S.vtab = t; render(); scrollTo(0, 0); },
  pm: d => { const ml = monateListe(), i = ml.indexOf(S.pm) + (+d); if (i >= 0 && i < ml.length) { S.pm = ml[i]; render(); } },
  sf: (k, w) => { S[k] = w; S.limit = 60; render(); },
  mehr_treffer: () => { S.limit += 60; $('#erg').innerHTML = sucheErgebnis(); },
  s_verm: sheetVerm, s_frei: sheetFrei, s_mieten: sheetMieten, s_check: sheetCheck, s_wichtig: sheetWichtig,
  s_monat: sheetMonat, s_mieter: sheetMieter, s_cf: sheetCf, s_ek: sheetEk, s_buch: sheetBuchung,
  s_steuer: () => {
    const s = D.vermietung.steuer;
    sheet('Steuer ' + s.jahr + ' – Schätzung', `<div class="gross">${eur(s.ergebnis)}</div><div class="unterz">Ergebnis aus Vermietung und Verpachtung</div>` +
      liste(s.positionen.map(p => zeile({titel: esc(p.position), unter: esc(p.objekt) + ' · ' + p.bereich, rechts: `<span class="${ton(p.betrag)}">${eur(p.betrag)}</span>`}))) +
      `<div class="klein">Grobe Schätzung – keine Steuerberatung.</div>`);
  },
  p_ein: () => sheetPriv('e', S.pm), p_aus: () => sheetPriv('a', S.pm), p_saldo: () => sheetSaldo(S.pm), p_quote: () => sheetQuote(S.pm),
  s_pmonat: m => { S.pm = m; render(); sheetSaldo(m); },
  s_kat: (m, art, k) => sheetKat(m, art, k),
  schutz_an: async () => { S.gesp = {modus: 'gesperrt', datei: S.datei}; await DB.set('daten', S.gesp); await DB.del('schluessel'); toast('Ab jetzt mit Passwort'); render(); },
  schutz_aus: () => zeigePasswort(S.datei, '', 'offen'),
  loeschen: async () => {
    const offen = (typeof ERF !== 'undefined' ? ERF : []).filter(e => !e.gesendet).length;
    if (!confirm((offen ? `ACHTUNG: ${offen} erfasste Einträge sind noch nicht an den PC gesendet und gehen verloren.\n\n` : '') + 'Alle Daten von diesem Handy löschen? Du kannst sie jederzeit mit der Datei neu laden.')) return;
    await DB.del('daten'); await DB.del('schluessel'); await DB.del('erfassungen');
    D = null; S.gesp = null; S.datei = null; S.key = null; if (typeof ERF !== 'undefined') ERF = []; zeigeWillkommen(); },
};
// App-Version anzeigen und auf Wunsch frisch laden (Daten bleiben erhalten)
async function versionZeigen() {
  const el = document.getElementById('app_version'); if (!el || !('caches' in window)) return;
  try { const k = (await caches.keys()).find(n => n.startsWith('finanzen-')), txt = k ? '· ' + k.replace('finanzen-', '') : ''; if (el.textContent !== txt) el.textContent = txt; } catch (e) { /* ok */ }
}
new MutationObserver(versionZeigen).observe(document.documentElement, {childList: true, subtree: true});
AKT.app_update = async () => {
  toast('App wird aktualisiert …');
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { /* ok */ }
  location.reload();
};
// Statt still nichts zu tun: kurze Meldung, damit man den Fehler sieht und melden kann
function fehlerZeigen(err) { console.error(err); toast('Fehler: ' + ((err && err.message) || err) + ' – bitte melden'); }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const [name, ...p] = el.dataset.a.split('|');
  if (AKT[name]) {
    e.preventDefault();
    try { const r = AKT[name](...p); if (r && r.catch) r.catch(fehlerZeigen); } catch (err) { fehlerZeigen(err); }
  }
});
$('#sheet-zu').onclick = sheetZu; $('#sheet-bg').onclick = sheetZu; $('#sheet-back').onclick = sheetZurueck;
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; S.limit = 60; $('#erg').innerHTML = sucheErgebnis(); } });
document.addEventListener('change', e => {
  if (e.target.type === 'file' && ['datei', 'datei2'].includes(e.target.id) && e.target.files[0]) { dateiGewaehlt(e.target.files[0]); e.target.value = ''; }
});

// ====================================================================== Start, Laden, Entsperren
const ICONS = {
  cockpit: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  vermietung: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5h2a2 2 0 0 1 2 2v9h-2v-9h-2v9H4zm4-14v2h2V7H8zm0 4v2h2v-2H8zm0 4v2h2v-2H8z"/></svg>',
  privat: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  suche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  mehr: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};
const TABS = [['cockpit', 'Cockpit'], ['vermietung', 'Vermietung'], ['privat', 'Privat'], ['suche', 'Suche'], ['mehr', 'Mehr']];
function render() {
  const seiten = {cockpit, vermietung, privat, suche, mehr};
  try { $('#app').innerHTML = seiten[S.tab](); }
  catch (e) { $('#app').innerHTML = `<div class="karte"><b>Anzeige-Fehler</b><div class="klein">${esc(e.message)}<br>Bitte die Datei neu laden (Mehr → Neue Daten laden).</div></div>`; console.error(e); }
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="${S.tab === k ? 'an' : ''}" data-a="tab|${k}">${ICONS[k]}${l}</button>`).join('');
}
function zeigeApp() { $('#tabs').hidden = false; $('#fab').hidden = false; render(); }
function zeigeWillkommen(hinweis = '') {
  $('#tabs').hidden = true; $('#fab').hidden = true;
  $('#app').innerHTML = `<div class="willkommen"><img class="logo" src="icons/icon-192.png" alt=""><h1>Finanzen</h1>` +
    `<p>Deine Vermietung und privaten Finanzen – offline und nur auf diesem Handy.<br>Lade die Datei, die du am PC unter <b>Einstellungen → Handy</b> erstellt hast.</p>` +
    `<label class="knopf">Datei auswählen<input type="file" id="datei" hidden></label><div class="hinweis-fehler">${esc(hinweis)}</div>` +
    `<p class="klein">Die Datei ist verschlüsselt und wird nur hier auf dem Gerät geöffnet. Es werden keine Daten ins Internet gesendet.</p></div>`;
}
async function dateiGewaehlt(file) {
  let datei;
  try {
    datei = JSON.parse(await file.text());
    if (!datei.fin || !datei.salt || !datei.data) throw new Error('keine Finanzen-Datei');
  } catch (e) { toast('Das ist keine gültige Finanzen-Datei'); if (!D) zeigeWillkommen('Das ist keine gültige Finanzen-Datei.'); return; }
  if (datei.typ === 'erfassungen') { toast('Das ist eine Erfassungs-Datei – die gehört an den PC'); return; }
  if (S.key && S.keySalt === datei.salt) {              // gleiches Passwort wie beim ersten Mal -> ohne Eingabe öffnen
    try {
      const daten = await entschluesselnMit(datei, S.key);
      await datenUebernehmen(datei, daten, S.gesp && S.gesp.modus === 'gesperrt');
      toast('Daten aktualisiert'); return;
    } catch (e) { /* Schlüssel passt nicht -> Passwort abfragen */ }
  }
  zeigePasswort(datei, '', 'neu');
}
async function datenUebernehmen(datei, daten, immer) {
  S.datei = datei; D = daten;
  S.gesp = immer ? {modus: 'gesperrt', datei} : {modus: 'offen', daten, datei};
  await DB.set('daten', S.gesp);
  if (immer) { try { await DB.del('schluessel'); } catch (e) { /* ok */ } }
  S.pm = null; zeigeApp();
}
function zeigePasswort(datei, fehler = '', modus = 'neu') {
  $('#tabs').hidden = true; $('#fab').hidden = true;
  const entsperren = modus === 'entsperren';
  $('#app').innerHTML = `<div class="willkommen"><img class="logo" src="icons/icon-192.png" alt=""><h1>${entsperren ? 'Entsperren' : 'Passwort'}</h1>` +
    `<p>${entsperren ? 'Gib dein Passwort ein, um die Finanzen zu öffnen.' : `Datei vom ${dDe(datei.stand || '')}. Gib das Passwort ein, das du am PC vergeben hast.`}</p>` +
    `<form id="pwform"><input class="feld" id="pw" type="password" placeholder="Passwort" autocomplete="current-password" enterkeyhint="go" autofocus>` +
    (modus === 'neu' ? `<label class="schalter"><input type="checkbox" id="immer"> Beim Öffnen der App immer nach dem Passwort fragen</label>` : '') +
    `<button class="knopf" type="submit">Öffnen</button></form><div class="hinweis-fehler" id="pwfehler">${esc(fehler)}</div>` +
    (D || modus === 'offen' ? `<button class="knopf hell" id="abbr">Abbrechen</button>` : (entsperren ? '' : `<button class="knopf hell" id="abbr">Andere Datei</button>`)) + `</div>`;
  const ab = $('#abbr'); if (ab) ab.onclick = () => D ? zeigeApp() : (S.gesp ? zeigePasswort(S.gesp.datei, '', 'entsperren') : zeigeWillkommen());
  $('#pwform').onsubmit = async ev => {
    ev.preventDefault(); const pw = $('#pw').value; if (!pw) return;
    $('#pwfehler').textContent = 'Wird geöffnet …';
    try {
      const key = await schluesselAus(datei, pw);
      const daten = await entschluesselnMit(datei, key);
      const immer = modus === 'entsperren' ? true : modus === 'offen' ? false : !!($('#immer') && $('#immer').checked);
      if (immer) { S.key = key; S.keySalt = datei.salt; S.keyIter = datei.iter; } else await schluesselMerken(datei, key);
      S.datei = datei; D = daten;
      S.gesp = immer ? {modus: 'gesperrt', datei} : {modus: 'offen', daten, datei};
      await DB.set('daten', S.gesp);
      if (modus === 'neu') { S.pm = null; S.tab = 'cockpit'; }
      zeigeApp(); toast(modus === 'neu' ? 'Daten geladen' : 'Entsperrt');
    } catch (err) { $('#pwfehler').textContent = 'Passwort falsch oder Datei beschädigt.'; }
  };
}
async function start() {
  if ('serviceWorker' in navigator) {
    if (navigator.serviceWorker.controller)          // neue App-Version aktiv geworden -> einmal neu laden (Daten bleiben)
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => r.update()).catch(() => {});
  }
  const gesp = await DB.get('daten'); S.gesp = gesp || null;
  if (gesp) S.datei = gesp.datei || null;
  await schluesselLaden();
  if (typeof erfassungenLaden === 'function') await erfassungenLaden();
  if (gesp && gesp.modus === 'offen' && gesp.daten) { D = gesp.daten; zeigeApp(); }
  else if (gesp && gesp.datei) zeigePasswort(gesp.datei, '', 'entsperren');
  else zeigeWillkommen();
}
window.addEventListener('DOMContentLoaded', start);       // erst starten, wenn alle Skripte geladen sind
