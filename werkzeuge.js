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
// Felder: pct = Anteil (0,04) wird als Prozent (4) angezeigt und getippt.
// min/max sind harte Grenzen (Regler UND getippte Zahl); ueb = üblicher Bereich als Hinweis; std = Standardwert
const KR_DEF = {
  kaufpreis: {l: 'Kaufpreis', u: '€', min: 30000, max: 800000, step: 5000, ueb: '100.000–400.000 €'},
  miete_pro_zimmer: {l: 'Warmmiete pro Zimmer', u: '€', min: 250, max: 900, step: 10, ueb: '350–650 €'},
  eigenkapital: {l: 'Eigenkapital', u: '€', min: 0, max: k => Math.round(k.kaufpreis * 1.2 / 5000) * 5000, step: 5000, ueb: 'mind. die Kaufnebenkosten'},
  zinssatz: {l: 'Zins (Sollzins)', u: '%', pct: 1, min: 1, max: 7, step: 0.05, dez: 2, ueb: '3,0–4,5 %'},
  tilgung: {l: 'Tilgung', u: '%', pct: 1, min: 1, max: 4, step: 0.25, dez: 2, ueb: '1,5–3 %'},
  leerstand: {l: 'Leerstand', u: '%', pct: 1, min: 0, max: 15, step: 1, dez: 0, ueb: '3–8 %'},
  hausgeld: {l: 'Hausgeld', u: '€/Monat', min: 0, max: 600, step: 10, ueb: '150–350 €'},
  nebenkosten_monat: {l: 'Strom, Internet & Co.', u: '€/Monat', min: 0, max: 300, step: 10, ueb: '40–150 € (zahlst du bei WG-Zimmern)'},
  renovierung: {l: 'Renovierung', u: '€', min: 0, max: 80000, step: 1000, ueb: '0–30.000 €'},
  moebel: {l: 'Möbel', u: '€', min: 0, max: 30000, step: 500, ueb: '1.000–2.000 € je Zimmer'},
  makler_satz: {l: 'Makler (Käuferanteil)', u: '%', pct: 1, min: 0, max: 4, step: 0.01, dez: 2, std: 3.57, ueb: '0 % ohne Makler, sonst 3,57 %'},
  grest_satz: {l: 'Grunderwerbsteuer', u: '%', pct: 1, min: 3.5, max: 6.5, step: 0.5, dez: 1, std: 6, ueb: 'je nach Bundesland'},
  notar_satz: {l: 'Notar + Grundbuch', u: '%', pct: 1, min: 1, max: 2.5, step: 0.1, dez: 1, std: 2, ueb: 'ca. 1,5–2 %'},
  grundsteuer: {l: 'Grundsteuer', u: '€/Monat', min: 0, max: 100, step: 5, std: 20, ueb: '10–40 €'},
  sonstige_einnahmen: {l: 'Sonstige Einnahmen', u: '€/Monat', min: 0, max: 300, step: 10, std: 0, ueb: 'z. B. Stellplatz, Keller'},
  steuersatz: {l: 'Dein Steuersatz', u: '%', pct: 1, min: 0, max: 45, step: 1, dez: 0, std: 30, ueb: 'Grenzsteuersatz, meist 25–42 %'},
  gebaeudeanteil: {l: 'Gebäudeanteil', u: '%', pct: 1, min: 50, max: 90, step: 5, dez: 0, std: 75, ueb: '70–80 % (Rest ist Grundstück)'},
  afa_satz: {l: 'Abschreibung (AfA)', u: '%', pct: 1, min: 2, max: 3, step: 0.5, dez: 1, std: 2, ueb: '2 %, Neubau ab 2023: 3 %'},
  _ziel: {l: 'Dein Ziel', u: '€/Monat', min: 0, max: 800, step: 25, std: 300, ueb: 'so viel soll nach der Rate übrig bleiben'},
};
const BUNDESLAENDER = {'Baden-Württemberg': 5, 'Bayern': 3.5, 'Berlin': 6, 'Brandenburg': 6.5, 'Bremen': 5.5, 'Hamburg': 5.5, 'Hessen': 6, 'Mecklenburg-Vorpommern': 6,
  'Niedersachsen': 5, 'Nordrhein-Westfalen': 6.5, 'Rheinland-Pfalz': 5, 'Saarland': 6.5, 'Sachsen': 5.5, 'Sachsen-Anhalt': 5, 'Schleswig-Holstein': 6.5, 'Thüringen': 5};
let KR = null, KRT = 'eingabe';
const krGrenzen = k => { const d = KR_DEF[k], mx = typeof d.max === 'function' ? d.max(KR) : d.max; return [d.min, mx]; };
const krBegrenzen = (k, v) => { const [mn, mx] = krGrenzen(k), d = KR_DEF[k], skala = d.pct ? 100 : 1; return Math.max(mn / skala, Math.min(mx / skala, v)); };
function krStart(zuruecksetzen) {
  let gespeichert = null;
  if (zuruecksetzen) { try { localStorage.removeItem('fin_kr3'); } catch (e) { /* ok */ } }
  else { try { gespeichert = JSON.parse(localStorage.getItem('fin_kr3')); } catch (e) { /* ok */ } }
  KR = {...D.kauf, ...(gespeichert || {})};
  for (const [k, d] of Object.entries(KR_DEF)) {           // fehlende Werte mit Standardwerten füllen
    if (typeof KR[k] !== 'number' || isNaN(KR[k])) KR[k] = d.std != null ? (d.pct ? d.std / 100 : d.std) : 0;
  }
  if (!gespeichert && !KR.makler_satz) KR.makler_satz = KR_DEF.makler_satz.std / 100;
  if (!KR.bl) KR.bl = Object.keys(BUNDESLAENDER).find(b => BUNDESLAENDER[b] / 100 === KR.grest_satz && b === 'Berlin') || '';   // deine Wohnungen liegen in Berlin
  KR.zimmer = Math.max(1, Math.min(10, Math.round(+KR.zimmer || 1)));
  for (const k of Object.keys(KR_DEF)) KR[k] = krBegrenzen(k, KR[k]);   // alte oder fremde Werte in den sinnvollen Bereich holen
}
const krWert = k => KR_DEF[k].pct ? KR[k] * 100 : KR[k];
const krFormat = k => { const d = KR_DEF[k], v = krWert(k); return d.pct ? v.toFixed(d.dez).replace('.', ',') : nf0.format(v); };
const krRoh = k => { const d = KR_DEF[k], v = krWert(k); return String(d.pct ? +v.toFixed(d.dez) : Math.round(v * 100) / 100).replace('.', ','); };
const tsd = x => nf0.format(Math.round(x / 1000)) + ' T€';

function krFeld(k) {
  const d = KR_DEF[k], v = krWert(k), [mn, mx] = krGrenzen(k);
  return `<div class="kr-f"><div class="kr-z"><span>${d.l}${d.ueb ? `<small class="kr-ueb">${d.ueb}</small>` : ''}</span><label class="kr-i"><input class="kr-n" data-kr="${k}" inputmode="decimal" value="${krFormat(k)}" autocomplete="off" aria-label="${d.l}"><em>${d.u}</em></label></div>` +
    `<input class="kr-r" type="range" data-kr="${k}" min="${mn}" max="${mx}" step="${d.step}" value="${v}" aria-label="${d.l} Regler"></div>`;
}
const krZimmer = () => `<div class="kr-f"><div class="kr-z"><span>Zimmer<small class="kr-ueb">vermietbare Zimmer</small></span><div class="kr-st"><button type="button" data-kr-step="-1" aria-label="weniger"${KR.zimmer <= 1 ? ' disabled' : ''}>−</button><b id="kr_zimmer">${KR.zimmer}</b><button type="button" data-kr-step="1" aria-label="mehr"${KR.zimmer >= 10 ? ' disabled' : ''}>+</button></div></div></div>`;

// Urteil: grün = Ziel erreicht, orange = trägt sich, aber unter dem Ziel, rot = du zahlst drauf
function krUrteil(cf, ziel) {
  if (cf >= ziel) return {k: 'gut', farbe: 'var(--gut)', grund: 'var(--gruen)', text: 'Rechnet sich'};
  if (cf >= 0) return {k: 'knapp', farbe: 'var(--orange)', grund: 'var(--orange)', text: 'Unter deinem Ziel'};
  return {k: 'schlecht', farbe: 'var(--schlecht)', grund: 'var(--rot)', text: 'Du zahlst drauf'};
}

// Diagramm: Cashflow je Kaufpreis, Zielzone grün, Marker für deinen Preis und den Höchstpreis
function kurve(p, max) {
  const W = 340, H = 250, pl = 46, pr = 12, pt = 16, pb = 58, pts = [];
  const anker = [p.kaufpreis].concat(max > 0 ? [max] : []);
  const lo = Math.max(30000, Math.min(...anker) * 0.7), hi = Math.max(...anker) * 1.3;
  for (let i = 0; i <= 40; i++) { const x = lo + (hi - lo) * i / 40; pts.push([x, kaufrechnen({...p, kaufpreis: x}).cashflow]); }
  const ys = pts.map(q => q[1]).concat([0, p._ziel]);
  let mn = Math.min(...ys), mx = Math.max(...ys); const pad = (mx - mn) * 0.08 || 50; mn -= pad; mx += pad;
  const schritt = [50, 100, 200, 250, 500, 1000, 2000].find(s => (mx - mn) / s <= 5) || 5000;
  const X = x => pl + (x - lo) / (hi - lo) * (W - pl - pr), Y = y => pt + (mx - y) / (mx - mn) * (H - pt - pb);
  const cur = kaufrechnen(p).cashflow, unten = H - pb, clampX = x => Math.max(pl + 34, Math.min(W - pr - 34, x));
  let s = `<svg class="chart kr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cashflow je nach Kaufpreis">`;
  s += `<rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${Math.max(0, Y(p._ziel) - pt)}" fill="var(--gruen)" opacity=".1"/>`;
  for (let v = Math.ceil(mn / schritt) * schritt; v <= mx; v += schritt) {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--linie)" ${v === 0 ? 'stroke-width="1.5" style="stroke:var(--text2);opacity:.5"' : ''}/>`;
    s += `<text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${nf0.format(v)} €</text>`;
  }
  s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(p._ziel)}" y2="${Y(p._ziel)}" stroke="var(--gut)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<text x="${W - pr - 2}" y="${Y(p._ziel) - 5}" text-anchor="end" class="kr-c-ziel">Ziel ${eur(p._ziel)}</text>`;
  s += `<polyline fill="none" stroke="var(--blau)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}"/>`;
  // Höchstpreis (Zeile 2 unter der Achse)
  if (max > lo && max < hi) {
    s += `<line x1="${X(max)}" x2="${X(max)}" y1="${Y(p._ziel)}" y2="${unten + 30}" stroke="var(--gut)" stroke-dasharray="3 3"/>`;
    s += `<circle cx="${X(max)}" cy="${Y(p._ziel)}" r="5" fill="var(--gruen)" stroke="var(--karte)" stroke-width="2"/>`;
    s += `<rect x="${clampX(X(max)) - 34}" y="${unten + 30}" width="68" height="22" rx="11" fill="var(--gruen)"/><text x="${clampX(X(max))}" y="${unten + 45}" text-anchor="middle" class="kr-c-lab" style="fill:#fff">max. ${tsd(max)}</text>`;
  }
  // Dein Preis (Zeile 1 unter der Achse)
  s += `<line x1="${X(p.kaufpreis)}" x2="${X(p.kaufpreis)}" y1="${Y(cur)}" y2="${unten + 4}" stroke="var(--blau)" opacity=".5"/>`;
  s += `<circle cx="${X(p.kaufpreis)}" cy="${Y(cur)}" r="6.5" fill="var(--blau)" stroke="var(--karte)" stroke-width="2.5"/>`;
  s += `<rect x="${clampX(X(p.kaufpreis)) - 34}" y="${unten + 4}" width="68" height="22" rx="11" fill="var(--blau)"/><text x="${clampX(X(p.kaufpreis))}" y="${unten + 19}" text-anchor="middle" class="kr-c-lab" style="fill:#fff">du ${tsd(p.kaufpreis)}</text>`;
  s += `<text x="${X(p.kaufpreis) + (X(p.kaufpreis) > W / 2 ? -10 : 10)}" y="${Y(cur) - 10}" text-anchor="${X(p.kaufpreis) > W / 2 ? 'end' : 'start'}" class="kr-c-wert">${eur(cur)}</text>`;
  s += `<text x="${pl}" y="${H - 1}" class="kr-c-achse">← günstiger</text><text x="${W - pr}" y="${H - 1}" text-anchor="end" class="kr-c-achse">teurer →</text>`;
  return s + '</svg>';
}
function investition(p, r) {
  const teile = [['Kaufpreis', p.kaufpreis, 'var(--blau)'], ['Kaufnebenkosten', r.nk, 'var(--orange)'], ['Renovierung', p.renovierung, 'var(--lila)'], ['Möbel', p.moebel, 'var(--gruen)']].filter(t => t[1] > 0);
  const ek = Math.min(p.eigenkapital, r.gesamt), leg = (farbe, text, wert) => `<div><i style="background:${farbe}"></i><span>${text}</span><em>${eur(wert)}</em></div>`;
  return `<div class="kr-summe"><span>Gesamtkosten</span><b>${eur(r.gesamt)}</b></div><div class="stack">${teile.map(t => `<i style="width:${t[1] / r.gesamt * 100}%;background:${t[2]}"></i>`).join('')}</div>` +
    `<div class="legende" style="margin:8px 0 16px">${teile.map(t => leg(t[2], t[0], t[1])).join('')}</div>` +
    `<div class="kr-summe"><span>So bezahlst du es</span><b>${Math.round(ek / r.gesamt * 100)} % Eigenkapital</b></div><div class="stack"><i style="width:${ek / r.gesamt * 100}%;background:var(--gruen)"></i><i style="width:${r.darlehen / r.gesamt * 100}%;background:var(--grau)"></i></div>` +
    `<div class="legende" style="margin-top:8px">${leg('var(--gruen)', 'Eigenkapital', ek)}${leg('var(--grau)', 'Darlehen von der Bank', r.darlehen)}</div>`;
}
function krKopf() {
  const r = kaufrechnen(KR), max = maxKaufpreis(KR, KR._ziel), u = krUrteil(r.cashflow, KR._ziel);
  const warn = krHinweise(KR, r).filter(h => h[0] === 'warn').length;
  $('#kr_kopf').innerHTML = `<div class="kr-zeile"><div><div class="kr-sub">Bleibt pro Monat</div><div class="kr-gross" style="color:${u.farbe}">${eur(r.cashflow)}</div>` +
    `<span class="kr-chip" style="background:color-mix(in srgb,${u.grund} 18%,transparent);color:${u.farbe}">${u.text}</span></div>` +
    `<div class="kr-max"><div class="kr-sub">Höchstpreis fürs Ziel</div><div class="kr-max-w">${max > 0 ? eur(max) : '–'}</div>` +
    `<div class="kr-sub">${max <= 0 ? 'Ziel nicht erreichbar' : max >= KR.kaufpreis ? `${eur(max - KR.kaufpreis)} Luft` : `${eur(KR.kaufpreis - max)} zu teuer`}</div></div></div>` +
    (warn && KRT === 'eingabe' ? `<button class="kr-warnlink" data-a="kr_tab|ergebnis">⚠︎ ${warn === 1 ? '1 Hinweis' : warn + ' Hinweise'} zur Finanzierung ›</button>` : '');
  if (KRT === 'ergebnis') krBody();
}
// Kennzahl mit Ampel und Erklärung
function kz(titel, wert, ampel, erkl) {
  const f = {gut: 'var(--gruen)', mittel: 'var(--orange)', schlecht: 'var(--rot)', '': 'var(--grau)'}[ampel];
  return `<div class="kr-kz"><i style="background:${f}"></i><div><b>${titel}</b><small>${erkl}</small></div><em>${wert}</em></div>`;
}
function krBody() {
  const p = KR, el = $('#kr_body'); if (!el) return;
  if (KRT === 'eingabe') {
    el.innerHTML = `<h3>Dein Ziel</h3><div class="karte">${krFeld('_ziel')}</div>` +
      `<h3>Wohnung</h3><div class="karte">${krFeld('kaufpreis')}${krZimmer()}${krFeld('miete_pro_zimmer')}</div>` +
      `<h3>Finanzierung</h3><div class="karte">${krFeld('eigenkapital')}${krFeld('zinssatz')}${krFeld('tilgung')}</div>` +
      `<h3>Laufende Kosten</h3><div class="karte">${krFeld('hausgeld')}${krFeld('nebenkosten_monat')}${krFeld('leerstand')}</div>` +
      `<h3>Einmalig</h3><div class="karte">${krFeld('renovierung')}${krFeld('moebel')}</div>` +
      `<h3>Kaufnebenkosten <small>voreingestellt</small></h3><div class="karte"><div class="kr-f"><div class="kr-z"><span>Bundesland<small class="kr-ueb">setzt die Grunderwerbsteuer</small></span>` +
      `<select class="feld kr-bl" id="kr_bl" aria-label="Bundesland"><option value="">wählen …</option>${Object.keys(BUNDESLAENDER).map(b => `<option${p.bl === b ? ' selected' : ''}>${b}</option>`).join('')}</select></div></div>` +
      `${krFeld('grest_satz')}${krFeld('makler_satz')}${krFeld('notar_satz')}<div class="kr-summe kr-nk" id="kr_nk"></div></div>` +
      `<details class="karte kr-mehr"><summary>Weitere Annahmen<small class="kr-ueb">Grundsteuer, Steuern, Abschreibung – voreingestellt</small></summary>` +
      `${['grundsteuer', 'sonstige_einnahmen', 'steuersatz', 'gebaeudeanteil', 'afa_satz'].map(krFeld).join('')}</details>` +
      `<button class="knopf hell" data-a="kr_zurueck">Auf meine Startwerte zurücksetzen</button>`;
    krNebenInfo();
    return;
  }
  const r = kaufrechnen(p), zins = r.rate - r.tilg, max = maxKaufpreis(p, p._ziel), u = krUrteil(r.cashflow, p._ziel), h = krHinweise(p, r);
  const diff = max - p.kaufpreis;
  const satz = max <= 0 ? `Dein Ziel von ${eur(p._ziel)} ist mit diesen Annahmen bei keinem Kaufpreis erreichbar – dafür braucht es mehr Miete oder mehr Eigenkapital.`
    : diff >= 0 ? `Für dein Ziel von ${eur(p._ziel)} im Monat darfst du bis <b>${eur(max)}</b> zahlen – du hast <b>${eur(diff)}</b> Luft.`
      : `Für dein Ziel von ${eur(p._ziel)} im Monat dürfte die Wohnung höchstens <b>${eur(max)}</b> kosten – also <b>${eur(-diff)}</b> weniger. Das ist dein Verhandlungsziel.`;
  const stress = [['Zins steigt um 1 %-Punkt', {...p, zinssatz: p.zinssatz + 0.01}], ['Miete 10 % niedriger', {...p, miete_pro_zimmer: p.miete_pro_zimmer * 0.9, sonstige_einnahmen: p.sonstige_einnahmen * 0.9}],
    ['Leerstand 15 %', {...p, leerstand: Math.max(p.leerstand, 0.15)}], ['Ein Zimmer dauerhaft leer', {...p, zimmer: Math.max(0, p.zimmer - 1)}]];
  const a = (v, g, m) => v >= g ? 'gut' : v >= m ? 'mittel' : 'schlecht';
  el.innerHTML = `<div class="karte kr-fazit" style="border-left:4px solid ${u.grund}"><div class="kr-fazit-t" style="color:${u.farbe}">${u.text}</div>` +
    `<p>Bei ${eur(p.kaufpreis)} bleiben dir <b>${eur(r.cashflow)}</b> im Monat (nach Steuern ca. ${eur(r.cfNach)}).</p><p>${satz}</p>` +
    `<div class="kr-zwei"><div><small>Dein Preis</small><b>${eur(p.kaufpreis)}</b></div><div><small>Höchstpreis fürs Ziel</small><b style="color:var(--gut)">${max > 0 ? eur(max) : '–'}</b></div></div>` +
    (h.length ? `<div style="margin-top:10px">${krHinweisHtml(h)}</div>` : '') + `</div>` +
    `<h3>Bis zu welchem Preis lohnt es sich?</h3><div class="karte">${kurve(p, max)}<div class="klein">Blaue Linie = was dir im Monat bleibt. Im grünen Bereich erreichst du dein Ziel. Je teurer die Wohnung, desto weniger bleibt.</div></div>` +
    `<h3>Wohin geht die Miete? <small>pro Monat</small></h3><div class="karte">${wasserfall([['Miete', r.ein], ['Kosten', -r.kosten], ['Zinsen', -zins], ['Tilgung', -r.tilg]], 'Bleibt')}` +
    `<div class="klein">Miete nach ${Math.round(p.leerstand * 100)} % Leerstand. Die Tilgung ist kein Verlust: Damit zahlst du ${eur(r.tilg)} im Monat in deine eigene Wohnung ein.</div></div>` +
    `<h3>Wie viel Geld brauchst du?</h3><div class="karte">${investition(p, r)}</div>` +
    `<h3>Was wäre, wenn …</h3>` + liste(stress.map(([t, q]) => {
      const c = kaufrechnen(q).cashflow, d = c - r.cashflow;
      return zeile({punkt: c >= p._ziel ? 'var(--gruen)' : c >= 0 ? 'var(--orange)' : 'var(--rot)', titel: t, unter: `${d >= 0 ? '+' : '−'}${eur(Math.abs(d))} gegenüber jetzt`, rechts: `<span class="${ton(c)}">${eur(c)}</span>`});
    })) +
    `<h3>Kennzahlen</h3><div class="karte">` +
    kz('Bruttorendite', pct(r.brutto, 1), a(r.brutto, 0.055, 0.045), 'Jahresmiete ÷ Kaufpreis · gut ab 5,5 %') +
    kz('Kaufpreisfaktor', r.faktor.toFixed(1).replace('.', ','), r.faktor <= 18 ? 'gut' : r.faktor <= 22 ? 'mittel' : 'schlecht', 'So viele Jahresmieten kostet sie · gut bis 18') +
    kz('Nettorendite', pct(r.netto, 1), a(r.netto, 0.04, 0.03), 'nach laufenden Kosten, auf alles, was du investierst') +
    kz('Eigenkapital-Rendite', pct(r.ek, 1), a(r.ek, 0.08, 0.04), 'inkl. Tilgung · was dein Geld pro Jahr bringt') +
    kz('Rate an die Bank', eur(r.rate), '', `Zins ${pct(p.zinssatz, 2)} + Tilgung ${pct(p.tilgung, 2)} auf ${eur(r.darlehen)}`) +
    kz('Kaufnebenkosten', eur(r.nk), '', `${pct(p.grest_satz + p.makler_satz + p.notar_satz, 2)} vom Kaufpreis`) + `</div>`;
}
// Zimmer +/−: reagiert schon beim Antippen (pointerdown) und lässt Tastatur/Fokus in Ruhe – sonst verschluckt iOS den ersten Tipp
function krZimmerAendern(d) {
  if (!KR) return;
  KR.zimmer = Math.max(1, Math.min(10, Math.round(+KR.zimmer || 1) + d));
  const z = $('#kr_zimmer'); if (z) z.textContent = KR.zimmer;
  document.querySelectorAll('[data-kr-step]').forEach(b => { b.disabled = (+b.dataset.krStep < 0 && KR.zimmer <= 1) || (+b.dataset.krStep > 0 && KR.zimmer >= 10); });
  try { localStorage.setItem('fin_kr3', JSON.stringify(KR)); } catch (e) { /* ok */ }
  krKopf();
}
let KR_ZEIT = 0;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('[data-kr-step]'); if (!b || b.disabled) return;
  e.preventDefault(); KR_ZEIT = Date.now(); krZimmerAendern(+b.dataset.krStep);
});
document.addEventListener('click', e => {                                  // Tastatur/Screenreader (kein pointerdown davor)
  const b = e.target.closest && e.target.closest('[data-kr-step]'); if (!b || b.disabled || Date.now() - KR_ZEIT < 700) return;
  krZimmerAendern(+b.dataset.krStep);
});

// Plausibilitäts-Hinweise zur Finanzierung
function krHinweise(p, r) {
  const h = [], beleih = p.kaufpreis ? r.darlehen / (p.kaufpreis + p.renovierung) : 0;
  if (p.eigenkapital < r.nk) h.push(['warn', `Dein Eigenkapital (${eur(p.eigenkapital)}) deckt nicht mal die Kaufnebenkosten (${eur(r.nk)}). Banken verlangen meist mindestens diese als Eigenkapital.`]);
  if (beleih > 1) h.push(['warn', `Das Darlehen liegt über dem Kaufpreis (${Math.round(beleih * 100)} %). Das finanzieren Banken kaum.`]);
  else if (beleih > 0.9) h.push(['info', `Fast 100 % finanziert (${Math.round(beleih * 100)} %): Die Bank verlangt dann oft einen höheren Zins.`]);
  if (r.rate > 0 && r.ein - r.kosten < r.rate * 1.1) h.push(['warn', `Die Mieteinnahmen nach Kosten (${eur(r.ein - r.kosten)}) tragen die Kreditrate (${eur(r.rate)}) nur knapp oder gar nicht.`]);
  if (p.eigenkapital > r.gesamt) h.push(['info', 'Mit diesem Eigenkapital brauchst du gar kein Darlehen.']);
  if (r.brutto > 0 && r.brutto < 0.04) h.push(['info', `Bruttorendite nur ${pct(r.brutto, 1)} – üblich sind 4–7 %.`]);
  return h;
}
const krHinweisHtml = h => h.map(([t, x]) => `<div class="kr-hint ${t}">${t === 'warn' ? '⚠︎' : 'ℹ︎'} ${esc(x)}</div>`).join('');
function sheetKauf() {
  krStart(false); KRT = 'eingabe';
  sheet('Wohnungs-Check', `<div class="kr-sticky"><div id="kr_kopf"></div><div class="seg" id="kr_seg"><button class="an" data-a="kr_tab|eingabe">Eingabe</button><button data-a="kr_tab|ergebnis">Ergebnis</button></div></div><div id="kr_body"></div>`);
  krKopf(); krBody(); krNebenInfo();
}
// Eingabe: Regler und Zahlfeld bleiben synchron; beim Antippen wird die Zahl markiert (sofort überschreibbar)
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.kr; if (!k || !KR) return;
  const d = KR_DEF[k], el = e.target; let v;
  if (el.type === 'range') v = parseFloat(el.value);
  else { const n = zahlAusText(el.value.replace(/\s/g, '')); if (n == null) return; v = n; }
  KR[k] = krBegrenzen(k, d.pct ? v / 100 : v);                      // nie außerhalb des sinnvollen Bereichs rechnen
  document.querySelectorAll(`[data-kr="${k}"]`).forEach(o => { if (o !== el) o.value = o.type === 'range' ? krWert(k) : krFormat(k); });
  if (k === 'kaufpreis') { const r = document.querySelector('input[type=range][data-kr="eigenkapital"]'); if (r) { r.max = krGrenzen('eigenkapital')[1]; if (KR.eigenkapital > +r.max) KR.eigenkapital = +r.max; } }
  krNebenInfo();
  try { localStorage.setItem('fin_kr3', JSON.stringify(KR)); } catch (err) { /* ok */ }
  krKopf();
});
document.addEventListener('focusin', e => {
  if (!(e.target.classList && e.target.classList.contains('kr-n'))) return;
  const el = e.target; setTimeout(() => { el.value = krRoh(el.dataset.kr); el.select(); }, 0);
});
document.addEventListener('focusout', e => {
  if (!(e.target.classList && e.target.classList.contains('kr-n') && KR)) return;
  const k = e.target.dataset.kr, d = KR_DEF[k], roh = zahlAusText(e.target.value.replace(/\s/g, ''));
  if (roh != null) { const [mn, mx] = krGrenzen(k); if (roh < mn || roh > mx) toast(`${d.l}: erlaubt sind ${nf0.format(mn)}–${nf0.format(mx)} ${d.u.replace('€/Monat', '€')}`); }
  e.target.value = krFormat(k);
});
document.addEventListener('change', e => {
  if (!(e.target.id === 'kr_bl' && KR)) return;
  KR.bl = e.target.value;
  if (BUNDESLAENDER[KR.bl] != null) {
    KR.grest_satz = BUNDESLAENDER[KR.bl] / 100;
    document.querySelectorAll('[data-kr="grest_satz"]').forEach(o => { o.value = o.type === 'range' ? krWert('grest_satz') : krFormat('grest_satz'); });
  }
  try { localStorage.setItem('fin_kr3', JSON.stringify(KR)); } catch (err) { /* ok */ }
  krNebenInfo(); krKopf();
});
function krNebenInfo() {
  const el = $('#kr_nk'); if (!el || !KR) return;
  const s = KR.grest_satz + KR.makler_satz + KR.notar_satz;
  el.innerHTML = `<span>Zusammen ${(s * 100).toFixed(2).replace('.', ',')} % vom Kaufpreis</span><b>${eur(KR.kaufpreis * s)}</b>`;
}

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
  kr_zurueck: () => { krStart(true); krBody(); krNebenInfo(); krKopf(); toast('Startwerte wiederhergestellt'); },
  kr_tab: k => { KRT = k; document.querySelectorAll('#kr_seg button').forEach(b => b.classList.toggle('an', b.dataset.a === 'kr_tab|' + k)); krKopf(); krBody(); $('#sheet-inhalt').scrollTop = 0; },
  kr_step: (k, d) => krZimmerAendern(+d),
});
