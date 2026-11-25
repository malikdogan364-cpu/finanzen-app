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
const KR_FELDER = [['kaufpreis', 'Kaufpreis (€)', 0], ['zimmer', 'Zimmer', 0], ['miete_pro_zimmer', 'Warmmiete pro Zimmer (€)', 0], ['eigenkapital', 'Eigenkapital (€)', 0],
  ['zinssatz', 'Sollzins (%)', 1], ['tilgung', 'Tilgung (%)', 1], ['hausgeld', 'Hausgeld (€/Monat)', 0], ['renovierung', 'Renovierung (€)', 0], ['moebel', 'Möbel (€)', 0],
  ['leerstand', 'Leerstand (%)', 1], ['nebenkosten_monat', 'Strom + Internet (€/Monat)', 0], ['grundsteuer', 'Grundsteuer (€/Monat)', 0], ['makler_satz', 'Makler (%)', 1],
  ['grest_satz', 'Grunderwerbsteuer (%)', 1], ['notar_satz', 'Notar + Grundbuch (%)', 1]];
function krWerte() {
  let gespeichert = null; try { gespeichert = JSON.parse(localStorage.getItem('fin_kr')); } catch (e) { /* ok */ }
  return {...D.kauf, ...(gespeichert || {})};
}
function krLesen() {
  const p = {...krWerte()};
  KR_FELDER.forEach(([k, , pr]) => { const t = wert('kr_' + k); const n = t === '' ? null : zahlAusText(t.replace(/\s/g, '')); if (n != null) p[k] = pr ? n / 100 : n; });
  const z = wert('kr_ziel'); p._ziel = z === '' ? 300 : (zahlAusText(z) ?? 300);
  return p;
}
function krErgebnis() {
  const p = krLesen(), r = kaufrechnen(p);
  try { localStorage.setItem('fin_kr', JSON.stringify(Object.fromEntries(KR_FELDER.map(([k]) => [k, p[k]])))); } catch (e) { /* ok */ }
  const max = maxKaufpreis(p, p._ziel), ok = r.cashflow >= p._ziel;
  $('#kr_erg').innerHTML = `<div class="gross ${ton(r.cashflow)}">${eur(r.cashflow)}</div><div class="unterz">Cashflow pro Monat vor Steuern${p._ziel ? ` · Ziel ${eur(p._ziel)}` : ''}</div>` +
    `<div class="karte" style="margin-bottom:10px"><span class="chip" style="background:${ok ? 'color-mix(in srgb,var(--gruen) 20%,transparent)' : 'color-mix(in srgb,var(--rot) 18%,transparent)'};color:${ok ? 'var(--gut)' : 'var(--schlecht)'}">${ok ? 'Rechnet sich' : 'Zu teuer'}</span> ` +
    `<span style="font-size:.9rem">Höchster Kaufpreis für dein Ziel: <b>${eur(max)}</b></span></div>` +
    `<div class="karte">${kv('Nach Steuern (ca.)', eur(r.cfNach))}${kv('Gesamtinvestition', eur(r.gesamt))}${kv('Kaufnebenkosten', eur(r.nk))}${kv('Darlehen', eur(r.darlehen))}${kv('Rate pro Monat', eur(r.rate))}` +
    `${kv('Miete nach Leerstand', eur(r.ein))}${kv('Bruttorendite', pct(r.brutto, 1))}${kv('Nettorendite', pct(r.netto, 1))}${kv('Kaufpreisfaktor', r.faktor.toFixed(1).replace('.', ','))}${kv('EK-Rendite inkl. Tilgung', pct(r.ek, 1))}</div>`;
}
function sheetKauf() {
  const p = krWerte(), name = p.name || 'Neue Wohnung';
  const feldHtml = KR_FELDER.map(([k, l, pr]) => `<label class="fl kr"><span>${l}</span><input class="feld" id="kr_${k}" data-kr="1" inputmode="decimal" value="${String(pr ? +(p[k] * 100).toFixed(3) : p[k]).replace('.', ',')}"></label>`).join('');
  sheet('Wohnungs-Check', `<div class="unterz">Rechne beim Besichtigen schnell durch, ob sich eine Wohnung rechnet. Startwerte: ${esc(name)} aus deinen Einstellungen.</div>` +
    `<div id="kr_erg"></div><h3>Annahmen</h3><div class="form kr-grid">${feldHtml}${feld('Ziel-Cashflow (€/Monat)', `<input class="feld" id="kr_ziel" data-kr="1" inputmode="decimal" value="300">`)}</div>` +
    `<button class="knopf hell" data-a="kr_zurueck">Auf Startwerte zurücksetzen</button>`);
  krErgebnis();
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.kr) krErgebnis(); });

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
  kr_zurueck: () => { try { localStorage.removeItem('fin_kr'); } catch (e) { /* ok */ } stack.pop(); sheetKauf(); },
});
