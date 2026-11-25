'use strict';
/* Werkzeuge: Wohnungs-Check, Spielraum, Weg zur Freiheit, Zahlungserinnerung, Monatsbericht. Alles rechnet lokal. */

// ---------------------------------------------------------------- Teilen
function teilen(text, titel) {
  if (navigator.share) return navigator.share({text, title: titel}).catch(() => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}
function kopieren(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Kopiert')).catch(() => toast('Kopieren nicht möglich'));
}
const textBlock = (id, text) => `<textarea class="feld" id="${id}" rows="9" style="line-height:1.45">${esc(text)}</textarea>` +
  `<button class="knopf" data-a="teilen_text|${id}">Teilen …</button><button class="knopf hell" data-a="kopieren_text|${id}">Text kopieren</button>`;

// ---------------------------------------------------------------- Zahlungserinnerung
function erinnerungText(v) {
  const offen = v.konto.filter(r => r.ist - r.soll < -0.5), summe = offen.reduce((s, r) => s + (r.soll - r.ist), 0);
  const frist = new Date(Date.now() + 10 * 864e5), fr = `${String(frist.getDate()).padStart(2, '0')}.${String(frist.getMonth() + 1).padStart(2, '0')}.${frist.getFullYear()}`;
  const monate = offen.map(r => mLang(r.monat)).join(', ') || 'die letzten Monate';
  const verm = D.vermieter || {};
  return `Hallo ${v.mieter.split(' ')[0]},\n\nnach meinen Unterlagen ist die Miete für ${monate} noch nicht vollständig eingegangen. ` +
    `Offen ist derzeit ein Betrag von ${eur(summe, true)}.\n\nBitte überweise den Betrag bis zum ${fr} auf folgendes Konto:\nIBAN: ${verm.iban || '[IBAN]'}\n` +
    `Verwendungszweck: Miete ${v.einheit} ${monate}\n\nFalls du schon gezahlt hast oder es ein Problem gibt, melde dich bitte kurz – dann finden wir eine Lösung.\n\n` +
    `Viele Grüße\n${verm.name || '[Dein Name]'}`;
}
function sheetErinnerung(id) {
  const v = D.vermietung.vertraege.find(x => x.id === id); if (!v) return;
  sheet('Zahlungserinnerung', `<div class="unterz">${esc(v.mieter)} · ${esc(v.einheit)} – Text bearbeiten und per WhatsApp, Nachrichten oder Mail senden.</div>` +
    textBlock('t_erinnerung', erinnerungText(v)) +
    ((D.vermieter && D.vermieter.iban) ? '' : `<div class="klein">Deine IBAN fehlt noch – am PC unter Einstellungen → Ziele, Steuer & Vermieter eintragen, dann steht sie automatisch hier.</div>`));
}
function mieterAktionen(v) {
  const saldo = v.konto.reduce((s, r) => s + r.ist - r.soll, 0);
  return `<h3>Aktionen</h3><div class="liste">` +
    (saldo < -0.5 ? zeile({punkt: 'var(--rot)', titel: 'Zahlungserinnerung schreiben', unter: 'Text zum Teilen', akt: `erinnerung|${v.id}`}) : '') +
    zeile({punkt: 'var(--gruen)', titel: 'Mietzahlung erfassen', unter: 'bar oder anders bezahlt', akt: `f_miete|${v.id}`}) +
    zeile({punkt: 'var(--orange)', titel: 'Übergabe erfassen', unter: 'Zählerstände, Fotos, Unterschrift', akt: `f_uebergabe|${v.id}`}) + `</div>`;
}

// ---------------------------------------------------------------- Monatsbericht
function berichtText() {
  const m = D.cockpit.mieten, V = D.vermietung, p = privMonat(standardMonat()), pm = standardMonat();
  const zeilen = [`Finanzen – Stand ${dDe(D.stand)}`, '', `Mieten ${mLang(D.monat)}: ${eur(m.ist)} von ${eur(m.soll)}` + (m.offen ? ` (${m.offen} offen)` : ' (alles bezahlt)')];
  V.rueckstaende.forEach(r => zeilen.push(`  • ${r.einheit} ${r.mieter}: ${eur(r.offen)} offen`));
  zeilen.push(`Cashflow Vermietung (Plan): ${eur(D.cockpit.frei.vermietung)} / Monat`);
  if (p) zeilen.push('', `Privat ${mLang(pm)}: ${eur(p.einnahmen)} rein, ${eur(p.ausgaben)} raus, ${eur(p.saldo)} übrig`);
  zeilen.push(`Monatlich frei (typisch): ${eur(D.cockpit.frei.wert)}`, `Nettovermögen: ${eur(D.cockpit.vermoegen.netto)}`);
  const t = D.termine.slice(0, 3); if (t.length) { zeilen.push('', 'Als Nächstes:'); t.forEach(x => zeilen.push(`  • ${dKurz(x.datum)} ${x.titel}`)); }
  return zeilen.join('\n');
}
const sheetBericht = () => sheet('Monatsbericht', `<div class="unterz">Zum Teilen oder Speichern – z. B. an dich selbst oder den Steuerberater.</div>` + textBlock('t_bericht', berichtText()));

// ---------------------------------------------------------------- Spielraum diesen Monat
function sheetSpielraum() {
  const typ = P().typisch, z = privMonat(D.monat), heute = new Date(D.heute), tageMonat = new Date(heute.getFullYear(), heute.getMonth() + 1, 0).getDate();
  const rest = Math.max(1, tageMonat - heute.getDate() + 1), bisher = z ? z.ausgaben : 0;
  const nochFix = P().fixkosten.filter(f => !f.diesen_monat && /monat/i.test(f.rhythmus)).reduce((s, f) => s + f.monat, 0);
  const bleibt = typ.ausgaben - bisher, variabel = bleibt - nochFix, proTag = Math.max(0, variabel) / rest;
  const anteil = typ.ausgaben ? Math.min(1, bisher / typ.ausgaben) : 0;
  sheet('Spielraum ' + mLang(D.monat), `<div class="gross ${variabel >= 0 ? '' : 'neg'}">${variabel >= 0 ? eur(proTag) + ' pro Tag' : eur(-variabel) + ' drüber'}</div>` +
    `<div class="unterz">${variabel >= 0 ? `bis Monatsende (${rest} Tage), wenn du so viel ausgibst wie in einem typischen Monat` : 'Du hast schon mehr ausgegeben als in einem typischen Monat'}</div>` +
    `<div class="karte" style="display:flex;gap:16px;align-items:center">${ring(anteil, anteil > 1 ? 'var(--rot)' : anteil > .85 ? 'var(--orange)' : 'var(--blau)', Math.round(anteil * 100) + ' %', 'verbraucht')}` +
    `<div style="flex:1">${kv('Typische Ausgaben', eur(typ.ausgaben))}${kv('Schon ausgegeben', eur(bisher))}${kv('Noch fällige Fixkosten', eur(nochFix))}${kv('Frei zum Ausgeben', `<b class="${ton(variabel)}">${eur(variabel)}</b>`)}</div></div>` +
    `<div class="klein">Schätzung: typische Ausgaben (Median der letzten 6 Monate) minus bisher gebucht minus Fixkosten, die diesen Monat noch kommen. Stand der Kontodaten: ${dDe(D.letzte_buchung)}.</div>`);
}

// ---------------------------------------------------------------- Weg zur finanziellen Freiheit
function sheetFreiheit() {
  const V = D.vermietung, cf = D.cockpit.frei.vermietung, leben = P().typisch.ausgaben, ziel = V.ziel_cashflow;
  const r = (v, f, l) => { const a = f > 0 ? Math.max(0, v / f) : 0; return `<div style="text-align:center;flex:1">${ring(a, v >= f ? 'var(--gruen)' : 'var(--blau)', Math.round(a * 100) + ' %', l)}</div>`; };
  sheet('Weg zur Freiheit', `<div class="gross">${eur(cf)}</div><div class="unterz">Cashflow der Vermietung pro Monat (Plan)</div>` +
    `<div class="karte" style="display:flex;gap:6px">${r(cf, ziel.teilzeit, 'Teilzeit')}${r(cf, ziel.ausstieg, 'Ausstieg')}${r(cf, leben, 'Lebenshaltung')}</div>` +
    `<div class="liste" style="margin-top:12px">` +
    zeile({punkt: 'var(--orange)', titel: 'Ziel Teilzeit', unter: cf >= ziel.teilzeit ? 'erreicht' : `noch ${eur(ziel.teilzeit - cf)} im Monat`, rechts: eur(ziel.teilzeit)}) +
    zeile({punkt: 'var(--lila)', titel: 'Ziel Ausstieg', unter: cf >= ziel.ausstieg ? 'erreicht' : `noch ${eur(ziel.ausstieg - cf)} im Monat`, rechts: eur(ziel.ausstieg)}) +
    zeile({punkt: 'var(--blau)', titel: 'Deine Lebenshaltung', unter: `Vermietung deckt ${pct(leben ? cf / leben : 0, 0)} davon`, rechts: eur(leben)}) + `</div>` +
    `<div class="klein">Ziele stellst du am PC unter Einstellungen → Ziele ein. Lebenshaltung = typische private Ausgaben pro Monat.</div>`);
}

// ---------------------------------------------------------------- Wohnungs-Check (Kaufrechner)
function kaufrechnen(p) {
  const nk = p.kaufpreis * (p.grest_satz + p.notar_satz + p.makler_satz), gesamt = p.kaufpreis + nk + p.renovierung + p.moebel;
  const darlehen = Math.max(0, gesamt - p.eigenkapital), rate = darlehen * (p.zinssatz + p.tilgung) / 12;
  const voll = p.zimmer * p.miete_pro_zimmer + p.sonstige_einnahmen, ein = voll * (1 - p.leerstand), kosten = p.hausgeld + p.nebenkosten_monat + p.grundsteuer;
  const cashflow = ein - kosten - rate, zins = darlehen * p.zinssatz / 12, tilg = rate - zins;
  const afa = ((p.kaufpreis + nk) * p.gebaeudeanteil * p.afa_satz + p.moebel / 13) / 12, ergebnis = ein - kosten - zins - afa;
  return {nk, gesamt, darlehen, rate, ein, kosten, cashflow, tilg, cfNach: cashflow - ergebnis * p.steuersatz,
    brutto: p.kaufpreis ? voll * 12 / p.kaufpreis : 0, netto: gesamt ? (ein - kosten) * 12 / gesamt : 0,
    faktor: voll ? p.kaufpreis / (voll * 12) : 0, ek: p.eigenkapital ? (cashflow + tilg) * 12 / p.eigenkapital : 0};
}
function maxKaufpreis(p, ziel) {
  let lo = 0, hi = 3e6;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (kaufrechnen({...p, kaufpreis: m}).cashflow >= ziel) lo = m; else hi = m; }
  return lo;
}
// Felder: Bereich der Regler, Einheit. pct = Anteil (0,04) wird als Prozent (4) angezeigt und getippt.
const KR_DEF = {
  kaufpreis: {l: 'Kaufpreis', u: '€', min: 50000, max: 600000, step: 5000},
  miete_pro_zimmer: {l: 'Warmmiete pro Zimmer', u: '€', min: 300, max: 1000, step: 10},
  eigenkapital: {l: 'Eigenkapital', u: '€', min: 0, max: 300000, step: 5000},
  zinssatz: {l: 'Zins (Sollzins)', u: '%', pct: 1, min: 1, max: 8, step: 0.05, dez: 2},
  tilgung: {l: 'Tilgung', u: '%', pct: 1, min: 1, max: 5, step: 0.25, dez: 2},
  leerstand: {l: 'Leerstand', u: '%', pct: 1, min: 0, max: 15, step: 1, dez: 0},
  hausgeld: {l: 'Hausgeld', u: '€/Monat', min: 0, max: 800, step: 10},
  nebenkosten_monat: {l: 'Strom + Internet', u: '€/Monat', min: 0, max: 400, step: 10},
  renovierung: {l: 'Renovierung', u: '€', min: 0, max: 100000, step: 1000},
  moebel: {l: 'Möbel', u: '€', min: 0, max: 50000, step: 500},
  makler_satz: {l: 'Makler (Käuferanteil)', u: '%', pct: 1, min: 0, max: 7.14, step: 0.05, dez: 2},
  grest_satz: {l: 'Grunderwerbsteuer', u: '%', pct: 1, min: 3.5, max: 6.5, step: 0.5, dez: 1},
  notar_satz: {l: 'Notar + Grundbuch', u: '%', pct: 1, min: 1, max: 3, step: 0.1, dez: 1},
  grundsteuer: {l: 'Grundsteuer', u: '€/Monat', min: 0, max: 150, step: 5},
  _ziel: {l: 'Ziel-Cashflow', u: '€/Monat', min: -500, max: 1000, step: 50},
};
let KR = null, KRT = 'eingabe';
function krStart(zuruecksetzen) {
  let gespeichert = null;
  if (zuruecksetzen) { try { localStorage.removeItem('fin_kr2'); } catch (e) { /* ok */ } }
  else { try { gespeichert = JSON.parse(localStorage.getItem('fin_kr2')); } catch (e) { /* ok */ } }
  KR = {...D.kauf, _ziel: 300, ...(gespeichert || {})};
}
const krWert = k => KR_DEF[k].pct ? KR[k] * 100 : KR[k];
const krFormat = k => { const d = KR_DEF[k], v = krWert(k); return d.pct ? v.toFixed(d.dez).replace('.', ',') : nf0.format(v); };
const krRoh = k => { const d = KR_DEF[k], v = krWert(k); return String(d.pct ? +v.toFixed(d.dez) : Math.round(v * 100) / 100).replace('.', ','); };

function krFeld(k) {
  const d = KR_DEF[k], v = krWert(k), mx = Math.max(d.max, v * 1.25), mn = Math.min(d.min, v);
  return `<div class="kr-f"><div class="kr-z"><span>${d.l}</span><label class="kr-i"><input class="kr-n" data-kr="${k}" inputmode="decimal" value="${krFormat(k)}" autocomplete="off" aria-label="${d.l}"><em>${d.u}</em></label></div>` +
    `<input class="kr-r" type="range" data-kr="${k}" min="${mn}" max="${mx}" step="${d.step}" value="${v}" aria-label="${d.l} Regler"></div>`;
}
const krZimmer = () => `<div class="kr-f"><div class="kr-z"><span>Zimmer</span><div class="kr-st"><button type="button" data-a="kr_step|zimmer|-1" aria-label="weniger">−</button><b id="kr_zimmer">${KR.zimmer}</b><button type="button" data-a="kr_step|zimmer|1" aria-label="mehr">+</button></div></div></div>`;

function kurve(p) {
  const W = 340, H = 196, pl = 8, pr = 8, pt = 22, pb = 24, pts = [], max = maxKaufpreis(p, p._ziel);
  let lo = Math.max(30000, p.kaufpreis * 0.55), hi = p.kaufpreis * 1.45;
  if (max > 0) { lo = Math.max(30000, Math.min(lo, max * 0.8)); hi = Math.max(hi, Math.min(max * 1.15, p.kaufpreis * 3)); }   // Schnittpunkt mit dem Ziel soll sichtbar sein
  for (let i = 0; i <= 30; i++) { const x = lo + (hi - lo) * i / 30; pts.push([x, kaufrechnen({...p, kaufpreis: x}).cashflow]); }
  const ys = pts.map(q => q[1]).concat([0, p._ziel]), mn = Math.min(...ys), mx = Math.max(...ys), span = (mx - mn) || 1;
  const X = x => pl + (x - lo) / (hi - lo) * (W - pl - pr), Y = y => pt + (mx - y) / span * (H - pt - pb);
  const cur = kaufrechnen(p).cashflow, k = x => Math.round(x / 1000) + 'k';
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--text2)" opacity=".45"/><text x="${W - pr}" y="${Y(0) - 3}" text-anchor="end">0 €</text>`;
  s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(p._ziel)}" y2="${Y(p._ziel)}" stroke="var(--orange)" stroke-dasharray="4 3"/><text x="${pl + 2}" y="${Y(p._ziel) - 3}" style="fill:var(--orange)">Ziel ${eur(p._ziel)}</text>`;
  s += `<polyline fill="none" stroke="var(--blau)" stroke-width="2.6" stroke-linejoin="round" points="${pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}"/>`;
  if (max > lo && max < hi) s += `<line x1="${X(max)}" x2="${X(max)}" y1="${pt}" y2="${H - pb}" stroke="var(--gruen)" stroke-dasharray="3 3"/><text x="${X(max)}" y="${pt - 7}" text-anchor="middle" style="fill:var(--gut)">max. ${k(max)}</text>`;
  s += `<circle cx="${X(p.kaufpreis)}" cy="${Y(cur)}" r="5.5" fill="var(--blau)" stroke="var(--karte)" stroke-width="2"/>`;
  s += `<text x="${X(p.kaufpreis)}" y="${Y(cur) + (cur > (mx + mn) / 2 ? 15 : -9)}" text-anchor="middle" style="fill:var(--text);font-weight:600">Du: ${eur(cur)}</text>`;
  s += `<text x="${pl}" y="${H - 6}">${k(lo)} €</text><text x="${W / 2}" y="${H - 6}" text-anchor="middle">Kaufpreis</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${k(hi)} €</text>`;
  return s + '</svg>';
}
function investition(p, r) {
  const teile = [['Kaufpreis', p.kaufpreis, 'var(--blau)'], ['Nebenkosten', r.nk, 'var(--orange)'], ['Renovierung', p.renovierung, 'var(--lila)'], ['Möbel', p.moebel, 'var(--gruen)']].filter(t => t[1] > 0);
  const ek = Math.min(p.eigenkapital, r.gesamt), leg = (farbe, text, wert) => `<div><i style="background:${farbe}"></i><span>${text}</span><em>${eur(wert)}</em></div>`;
  return `<div class="klein" style="margin:0 0 6px">Das kostet dich insgesamt ${eur(r.gesamt)}</div><div class="stack">${teile.map(t => `<i style="width:${t[1] / r.gesamt * 100}%;background:${t[2]}"></i>`).join('')}</div>` +
    `<div class="legende" style="margin:8px 0 14px">${teile.map(t => leg(t[2], t[0], t[1])).join('')}</div>` +
    `<div class="klein" style="margin:0 0 6px">So bezahlst du es</div><div class="stack"><i style="width:${ek / r.gesamt * 100}%;background:var(--gruen)"></i><i style="width:${r.darlehen / r.gesamt * 100}%;background:var(--grau)"></i></div>` +
    `<div class="legende" style="margin-top:8px">${leg('var(--gruen)', 'Eigenkapital', ek)}${leg('var(--grau)', 'Darlehen', r.darlehen)}</div>`;
}
function krKopf() {
  const r = kaufrechnen(KR), max = maxKaufpreis(KR, KR._ziel), ok = r.cashflow >= KR._ziel, knapp = !ok && r.cashflow >= 0;
  const farbe = ok ? 'gruen' : knapp ? 'orange' : 'rot', text = ok ? 'Rechnet sich' : knapp ? 'Knapp' : 'Zu teuer';
  $('#kr_kopf').innerHTML = `<div class="kr-zeile"><div><div class="kr-gross ${ton(r.cashflow)}">${eur(r.cashflow)}</div><div class="kr-sub">Cashflow pro Monat vor Steuern</div></div>` +
    `<div class="kr-urteil"><span class="chip" style="background:color-mix(in srgb,var(--${farbe}) 20%,transparent);color:var(--${farbe === 'gruen' ? 'gut' : farbe === 'rot' ? 'schlecht' : 'orange'})">${text}</span>` +
    `<div class="kr-sub">fürs Ziel max. ${eur(max)}</div></div></div>`;
  if (KRT === 'ergebnis') krBody();
}
function krBody() {
  const p = KR, el = $('#kr_body'); if (!el) return;
  if (KRT === 'eingabe') {
    el.innerHTML = `<h3>Wohnung</h3><div class="karte">${krFeld('kaufpreis')}${krZimmer()}${krFeld('miete_pro_zimmer')}</div>` +
      `<h3>Finanzierung</h3><div class="karte">${krFeld('eigenkapital')}${krFeld('zinssatz')}${krFeld('tilgung')}</div>` +
      `<h3>Kosten & Risiko</h3><div class="karte">${krFeld('hausgeld')}${krFeld('nebenkosten_monat')}${krFeld('renovierung')}${krFeld('moebel')}${krFeld('leerstand')}</div>` +
      `<details class="karte kr-mehr"><summary>Weitere Annahmen</summary>${['makler_satz', 'grest_satz', 'notar_satz', 'grundsteuer', '_ziel'].map(krFeld).join('')}</details>` +
      `<div class="klein">Tipp: Zahl antippen und direkt tippen, oder den Regler ziehen. Oben siehst du sofort, was es bewirkt.</div>` +
      `<button class="knopf hell" data-a="kr_zurueck">Auf meine Startwerte zurücksetzen</button>`;
    return;
  }
  const r = kaufrechnen(p), zins = r.rate - r.tilg;
  const stress = [['Zins +1 Prozentpunkt', {...p, zinssatz: p.zinssatz + 0.01}], ['Miete −10 %', {...p, miete_pro_zimmer: p.miete_pro_zimmer * 0.9, sonstige_einnahmen: p.sonstige_einnahmen * 0.9}],
    ['Leerstand 15 %', {...p, leerstand: Math.max(p.leerstand, 0.15)}]];
  el.innerHTML = `<h3>Wohin geht die Miete? <small>pro Monat</small></h3><div class="karte">${wasserfall([['Miete (nach Leerstand)', r.ein], ['Laufende Kosten', -r.kosten], ['Zinsen', -zins], ['Tilgung', -r.tilg]], 'Cashflow')}` +
    `<div class="klein">Die Tilgung ist kein Verlust: Damit baust du Eigenkapital in der Wohnung auf (${eur(r.tilg)} im Monat).</div></div>` +
    `<h3>Kaufpreis und Cashflow</h3><div class="karte">${kurve(p)}<div class="klein">Die Linie zeigt, wie sich der Cashflow mit dem Kaufpreis ändert. Alles über der gestrichelten Zielgeraden erreicht dein Ziel.</div></div>` +
    `<h3>Wie viel Geld brauchst du?</h3><div class="karte">${investition(p, r)}</div>` +
    `<h3>Stresstest</h3>` + liste(stress.map(([t, q]) => { const c = kaufrechnen(q).cashflow; return zeile({punkt: c >= 0 ? 'var(--gruen)' : 'var(--rot)', titel: t, unter: 'Cashflow pro Monat', rechts: `<span class="${ton(c)}">${eur(c)}</span>`}); })) +
    `<h3>Kennzahlen</h3><div class="karte">${kv('Nach Steuern (ca.)', eur(r.cfNach))}${kv('Rate pro Monat', eur(r.rate))}${kv('Kaufnebenkosten', eur(r.nk))}${kv('Bruttorendite', pct(r.brutto, 1))}${kv('Nettorendite', pct(r.netto, 1))}` +
    `${kv('Kaufpreisfaktor', r.faktor.toFixed(1).replace('.', ','))}${kv('EK-Rendite inkl. Tilgung', pct(r.ek, 1))}</div>`;
}
function sheetKauf() {
  krStart(false); KRT = 'eingabe';
  sheet('Wohnungs-Check', `<div class="kr-sticky"><div id="kr_kopf"></div><div class="seg" id="kr_seg"><button class="an" data-a="kr_tab|eingabe">Eingabe</button><button data-a="kr_tab|ergebnis">Ergebnis</button></div></div><div id="kr_body"></div>`);
  krKopf(); krBody();
}
// Eingabe: Regler und Zahlfeld bleiben synchron; beim Antippen wird die Zahl markiert (sofort überschreibbar)
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.kr; if (!k || !KR) return;
  const d = KR_DEF[k], el = e.target; let v;
  if (el.type === 'range') v = parseFloat(el.value);
  else { const n = zahlAusText(el.value.replace(/\s/g, '')); if (n == null) return; v = n; }
  KR[k] = d.pct ? v / 100 : v;
  document.querySelectorAll(`[data-kr="${k}"]`).forEach(o => { if (o !== el) o.value = o.type === 'range' ? v : krFormat(k); });
  try { localStorage.setItem('fin_kr2', JSON.stringify(KR)); } catch (err) { /* ok */ }
  krKopf();
});
document.addEventListener('focusin', e => {
  if (!(e.target.classList && e.target.classList.contains('kr-n'))) return;
  const el = e.target; setTimeout(() => { el.value = krRoh(el.dataset.kr); el.select(); }, 0);
});
document.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('kr-n') && KR) e.target.value = krFormat(e.target.dataset.kr); });

function werkzeugeHtml() {
  return `<h3>Werkzeuge</h3>` + liste([
    zeile({punkt: 'var(--blau)', titel: 'Wohnungs-Check', unter: 'Rechnet sich diese Wohnung? Höchster Kaufpreis fürs Ziel', akt: 'kauf'}),
    zeile({punkt: 'var(--gruen)', titel: 'Spielraum diesen Monat', unter: 'Was du pro Tag noch ausgeben kannst', akt: 'spielraum'}),
    zeile({punkt: 'var(--lila)', titel: 'Weg zur Freiheit', unter: 'Teilzeit- und Ausstiegsziel im Blick', akt: 'freiheit'}),
    zeile({punkt: 'var(--orange)', titel: 'Monatsbericht teilen', unter: 'Zusammenfassung per WhatsApp oder Mail', akt: 'bericht'})]);
}

// ---------------------------------------------------------------- Aktionen
Object.assign(AKT, {
  kauf: sheetKauf, spielraum: sheetSpielraum, freiheit: sheetFreiheit, bericht: sheetBericht, erinnerung: sheetErinnerung,
  teilen_text: id => teilen(wert(id), 'Finanzen'), kopieren_text: id => kopieren(wert(id)),
  kr_zurueck: () => { krStart(true); krBody(); krKopf(); toast('Startwerte wiederhergestellt'); },
  kr_tab: k => { KRT = k; document.querySelectorAll('#kr_seg button').forEach(b => b.classList.toggle('an', b.dataset.a === 'kr_tab|' + k)); krBody(); $('#sheet-inhalt').scrollTop = 0; },
  kr_step: (k, d) => { KR[k] = Math.max(1, Math.min(12, KR[k] + (+d))); const z = $('#kr_zimmer'); if (z) z.textContent = KR[k]; try { localStorage.setItem('fin_kr2', JSON.stringify(KR)); } catch (e) { /* ok */ } krKopf(); },
});
