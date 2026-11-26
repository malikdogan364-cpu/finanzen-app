'use strict';
/* Nachvollziehen: Jede Zahl lässt sich antippen – von der Summe über die Bestandteile bis zur einzelnen Buchung.
   Aufbau jedes Detail-Fensters: große Zahl → woraus sie besteht → Verlauf → Buchungen. Die Rechenerklärung steht
   eingeklappt unter „So wird gerechnet“, damit nichts überladen wirkt. */

// ====================================================================== Hilfen
let BMAP = null, BMAP_D = null;
function buchung(id) {
  if (BMAP_D !== D) { BMAP = new Map(D.buchungen.map(b => [b[0], b])); BMAP_D = D; }
  return BMAP.get(+id);
}
const erkl = (inhalt, titel = 'So wird gerechnet') => `<details class="erkl"><summary>${titel}</summary><div>${inhalt}</div></details>`;
const monatPlus = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const letzteMonate = (n, bis = D.monat) => Array.from({length: n}, (_, i) => monatPlus(bis, i - n + 1));
const monateZwischen = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const summeAbs = bs => bs.reduce((s, b) => s + Math.abs(b[2]), 0);
const hinweisNeueDatei = '<div class="klein">Für die einzelnen Zahlungen am PC eine neue Datei erstellen und hier laden.</div>';

// Lange Listen: erst die wichtigsten n Einträge, der Rest per Knopf „Alle … anzeigen“
let KURZ_NR = 0;
function kurzMarkieren(rows, n) { return rows.map((r, i) => i < n ? r : r.replace(/^<(\w+) class="/, '<$1 class="zu ')); }
function kurzListe(rows, n = 5, text = 'Alle') {
  if (rows.length <= n + 1) return liste(rows);
  const id = 'kurz' + (++KURZ_NR);
  return `<div class="liste kurz" id="${id}">${kurzMarkieren(rows, n).join('')}</div>` +
    `<button class="mehr-knopf" data-a="aufklappen|${id}">${text} ${rows.length} anzeigen</button>`;
}
function kurzBalken(items, n = 6) {
  const html = hbalken(items);
  if (items.length <= n + 1) return `<div class="karte">${html}</div>`;
  const id = 'kurz' + (++KURZ_NR), teile = html.split(/(?=<(?:button|div) class="hb")/);
  return `<div class="karte kurz" id="${id}">${kurzMarkieren(teile, n).join('')}</div>` +
    `<button class="mehr-knopf" data-a="aufklappen|${id}">Alle ${items.length} anzeigen</button>`;
}
// Kleines Monats-Diagramm, gewählter Monat farbig, die anderen grau
function monatsBalken(monate, wertVon, gewaehlt, farbe, akt) {
  return stapel(monate.map(x => { const v = wertVon(x); return {id: x, l: MON[+x.slice(5, 7) - 1], w: [x === gewaehlt ? v : 0, x === gewaehlt ? 0 : v]}; }),
    [farbe, '#C7C7CC'], {akt, h: 130});
}

// ====================================================================== Cockpit: Wichtig, To-dos
function wichtigListe() {
  const w = D.cockpit.wichtig.slice(), bud = Object.entries(P().budgets || {});
  if (bud.length && privMonat(D.monat)) {
    const ist = new Map(nachKategorie(D.monat, 'a').map(k => [k.k, k.v]));
    bud.forEach(([k, b]) => {
      const v = ist.get(k) || 0;
      if (b > 0 && v >= b * 0.9) w.push({stufe: v > b ? 'fehler' : 'warnung', titel: `Budget ${k}`, akt: `s_kat|${D.monat}|a|${k}`,
        text: `${eur(v)} von ${eur(b)} im ${MONL[+D.monat.slice(5, 7) - 1]} – ${v > b ? 'überschritten' : 'fast aufgebraucht'}`});
    });
  }
  return w;
}
function offeneTodos() {
  const erledigt = new Set(ERF.filter(e => e.art === 'todo_erledigt').map(e => (e.titel || '').trim().toLowerCase())), gesehen = new Set();
  return (D.todos || []).filter(t => {
    const k = t.titel.trim().toLowerCase();
    if (erledigt.has(k) || gesehen.has(k)) return false;
    gesehen.add(k); return true;
  });
}
const PRIO = {hoch: 'var(--rot)', mittel: 'var(--orange)', niedrig: 'var(--grau)'};
const todoZeile = t => zeile({punkt: PRIO[t.prio] || 'var(--grau)', titel: esc(t.titel), akt: `s_todo|${t.id}`, fett: false,
  unter: [t.faellig ? 'fällig ' + dDe(t.faellig) : '', t.prio ? 'Wichtigkeit ' + t.prio : ''].filter(Boolean).join(' · ')});
function todosKurz() {
  const t = offeneTodos(); if (!t.length) return [];
  return [zeile({punkt: 'var(--grau)', titel: 'To-dos', unter: esc(t[0].titel.slice(0, 70)), rechts: `${t.length} offen`, akt: 's_todos', fett: false})];
}
function todosHtml() {
  const t = offeneTodos();
  if (!D.todos) return '';
  return `<h3>To-dos <small>${t.length} offen · antippen zum Abhaken</small></h3>` +
    (t.length ? kurzListe(t.map(todoZeile), 4) : liste([zeile({punkt: 'var(--gruen)', titel: 'Alles erledigt'})]));
}
function sheetTodos() {
  const t = offeneTodos();
  sheet('To-dos', `<div class="gross">${t.length}</div><div class="unterz">offene Aufgaben vom PC</div>` + liste(t.map(todoZeile)) +
    `<div class="klein">Neue Aufgabe: unten rechts auf <b>+</b> → To-do. Abgehakte Aufgaben gehen mit „An PC senden“ an den PC.</div>`);
}
function sheetTodo(id) {
  const t = (D.todos || []).find(x => x.id === +id); if (!t) return;
  sheet('To-do', `<div class="karte" style="font-size:1.05rem;font-weight:600;line-height:1.4">${esc(t.titel)}</div>` +
    `<div class="karte" style="margin-top:10px">${kv('Wichtigkeit', esc(t.prio || '–'))}${kv('Fällig', t.faellig ? dDe(t.faellig) : 'ohne Datum')}` +
    `${t.objekt ? kv('Objekt', esc(t.objekt)) : ''}${t.notiz ? kv('Notiz', esc(t.notiz)) : ''}</div>` +
    `<button class="knopf" data-a="todo_erledigt|${t.id}">Als erledigt abhaken</button>` +
    `<div class="klein">Wird beim nächsten „An PC senden“ (Mehr) am PC abgehakt.</div>`);
}
async function todoErledigt(id) {
  const t = (D.todos || []).find(x => x.id === +id); if (!t) return;
  ERF.push({id: neueId(), art: 'todo_erledigt', erstellt: new Date().toISOString(), datum: lokalDatum(), titel: t.titel, todo_id: t.id});
  await erfSpeichern();
  sheetZu(); render(); toast('Abgehakt ✓ – mit „An PC senden“ übertragen');
}

// ====================================================================== Monatlich frei & Vermietung
function sheetTypisch() {
  const typ = P().typisch, ms = (P().typ_monate || []).map(privMonat).filter(Boolean);
  if (!ms.length) return sheetSaldo(standardMonat());
  const schnitt = ms.reduce((s, x) => s + x.saldo, 0) / ms.length;
  sheet('Privat übrig (typisch)', `<div class="gross ${ton(typ.saldo)}">${eur(typ.saldo)}</div><div class="unterz">typischer Monat aus den letzten ${ms.length} abgeschlossenen Monaten</div>` +
    `<div class="karte">${stapel(ms.map(x => ({id: x.monat, l: MON[+x.monat.slice(5, 7) - 1], w: [x.saldo]})), ['var(--blau)'], {akt: 's_saldo', h: 140, ziele: [{v: typ.saldo, c: 'var(--gruen)'}]})}` +
    `<div class="klein"><span style="color:var(--gruen)">- - -</span> typischer Wert · Balken antippen = Monat ansehen</div></div>` +
    `<h3>Die Monate <small>vom schwächsten zum besten</small></h3>` +
    liste(ms.slice().sort((a, b) => a.saldo - b.saldo).map(x => zeile({titel: mLang(x.monat), akt: `s_saldo|${x.monat}`,
      unter: `${eur(x.einnahmen)} rein · ${eur(x.ausgaben)} raus`, rechts: `<span class="${ton(x.saldo)}">${eur(x.saldo)}</span>`}))) +
    erkl(`Der typische Wert ist der <b>Median</b>: Die Monate werden der Größe nach sortiert, der mittlere zählt (bei 6 Monaten der Schnitt der beiden mittleren). ` +
      `So verzerrt ein einzelner teurer Monat – Urlaub, Umzug, Anschaffung – das Ergebnis nicht. Zum Vergleich: Der normale Durchschnitt wäre ${eur(schnitt)}.`));
}
function sheetSoll() {
  const r = D.vermietung.monat, s = r.reduce((a, x) => a + x.soll, 0);
  sheet('Mieten laut Verträgen', `<div class="gross">${eur(s)}</div><div class="unterz">Soll im ${mLang(D.monat)} · Zeile antippen = Mieterkonto</div>` +
    liste(r.map(x => zeile({punkt: x.differenz >= -0.5 ? 'var(--gruen)' : x.ist > 0 ? 'var(--orange)' : 'var(--rot)', titel: esc(x.einheit + ' · ' + x.mieter),
      unter: `bezahlt ${eur(x.ist, true)}`, rechts: eur(x.soll, true), akt: `s_mieter|${x.vertrag}`}))) +
    erkl('Das ist die Summe der Warmmieten aller Verträge, die in diesem Monat laufen – so wie sie im Vertrag stehen. ' +
      'Was tatsächlich eingegangen ist, steht unter Vermietung → Mieten. Zahlt jemand mehrere Monate zusammen, gleicht das Mieterkonto das aus.'));
}
const VKAT = {Hausgeld: ['Hausgeld', 'Hausgeld (absetzbar)'], Strom: ['Strom'], Internet: ['Internet'], Grundsteuer: ['Grundsteuer'],
  Versicherung: ['Versicherung', 'Versicherungen'], 'Reparatur-Rücklage': ['Erhaltungsaufwand', 'Erhaltungsrücklage']};
function cfZiel(label) {
  if (label === 'Mieten') return 's_soll';
  if (label === 'Kreditrate') return D.vermietung.kredite.length ? 's_kredit|0' : null;
  return `s_vkat|${label}`;
}
// Vermietungs-Buchungen einer oder mehrerer Kategorien, optional mit Planwert zum Vergleich
function sheetVBuchungen(titel, kats, {plan = null, jahr = null, wert = null} = {}) {
  const bs = D.buchungen.filter(b => b[6] === 'V' && kats.includes(b[7]) && (!jahr || b[1].slice(0, 4) === String(jahr)));
  const ms = letzteMonate(12), proMonat = m => summeAbs(bs.filter(b => b[1].slice(0, 7) === m));
  // Schnitt nur über die Monate seit der ersten Buchung (sonst wirkt eine neue Wohnung „billig“)
  const s12 = ms.reduce((s, m) => s + proMonat(m), 0), erster = ms.findIndex(m => proMonat(m) > 0);
  const mitBuchung = erster < 0 ? 0 : ms.length - erster;
  let kopfHtml;
  if (wert != null) kopfHtml = `<div class="gross ${ton(wert)}">${eur(wert)}</div><div class="unterz">${jahr ? 'Steuerjahr ' + jahr : ''}</div>`;
  else if (plan != null) kopfHtml = `<div class="gross">${eur(Math.abs(plan))} <span style="font-size:1rem;color:var(--text2);font-weight:500">/ Monat geplant</span></div>` +
    `<div class="unterz">${mitBuchung ? `tatsächlich gebucht: Ø ${eur(s12 / mitBuchung)} / Monat (${mitBuchung === 12 ? 'letzte 12 Monate' : 'seit ' + mLang(ms[erster])})` : 'noch nichts gebucht'}</div>`;
  else kopfHtml = `<div class="gross">${eur(summeAbs(bs))}</div><div class="unterz">${bs.length} Buchungen</div>`;
  sheet(titel, kopfHtml +
    (bs.length ? `<div class="karte">${stapel(ms.map(m => ({id: m, l: MON[+m.slice(5, 7) - 1], w: [proMonat(m)]})), ['var(--orange)'], {h: 130, ziele: plan ? [{v: Math.abs(plan), c: 'var(--blau)'}] : []})}` +
      `<div class="klein">gebucht je Monat${plan ? ' · <span style="color:var(--blau)">- - -</span> Plan' : ''}</div></div>` +
      `<h3>Buchungen</h3>` + kurzListe(bs.map(buchRow), 6)
      : `<div class="karte leer">Noch keine Buchungen mit der Kategorie „${esc(kats.join('“ / „'))}“.</div>`) +
    erkl(plan != null
      ? `Der Planwert kommt aus den Einstellungen am PC (Objekt → laufende Kosten) und fließt in Cashflow und „Monatlich frei“. Die Balken zeigen, was tatsächlich gebucht wurde. Weichen beide dauerhaft ab, lohnt es sich, den Planwert am PC anzupassen.`
      : 'Alle Buchungen der Vermietung mit dieser Kategorie. Die Kategorie vergibst du am PC unter Buchungen.'));
}
function sheetVkat(label) {
  const s = D.vermietung.cashflow_schritte.find(x => x[0] === label);
  sheetVBuchungen(label, VKAT[label] || [label], {plan: s ? s[1] : null});
}
function sheetKredit(i) {
  const k = D.vermietung.kredite[+i]; if (!k) return;
  const rest = k.restschuld != null ? k.restschuld : k.darlehen, r = (k.zins || 0) / 12, zins0 = rest * r, tilg0 = k.rate - zins0;
  const bisZB = k.zinsbindung_bis ? Math.max(0, monateZwischen(D.heute, k.zinsbindung_bis)) : 0, jahr0 = +D.heute.slice(0, 4);
  let s = rest, m = 0, zinsZB = 0, restZB = null; const reihe = [];
  while (s > 0.5 && m < 720) {
    const z = s * r, t = Math.min(k.rate - z, s); if (t <= 0) break;
    if (m < bisZB) zinsZB += z;
    s -= t; m++;
    if (m === bisZB) restZB = s;
    if (m % 12 === 0) reihe.push({j: jahr0 + m / 12, s});
  }
  const frei = s <= 0.5 ? jahr0 + Math.ceil(m / 12) : null;
  const bs = D.buchungen.filter(b => b[6] === 'V' && b[7] === 'Kreditrate');
  sheet(k.name, `<div class="gross">${eur(rest)}</div><div class="unterz">Restschuld heute · Darlehen ${eur(k.darlehen)}</div>` +
    `<h3 style="margin-top:4px">Deine Rate: ${eur(k.rate, true)} im Monat</h3><div class="karte">` +
    `<div class="stack"><i style="width:${Math.max(0, zins0 / k.rate * 100)}%;background:var(--rot)"></i><i style="width:${Math.max(0, tilg0 / k.rate * 100)}%;background:var(--gruen)"></i></div>` +
    `<div class="legende" style="margin-top:8px"><div><i style="background:var(--rot)"></i><span>Zinsen (an die Bank)</span><em>${eur(zins0)}</em></div>` +
    `<div><i style="background:var(--gruen)"></i><span>Tilgung (wird zu deinem Eigentum)</span><em>${eur(tilg0)}</em></div></div></div>` +
    `<div class="karte" style="margin-top:10px">${kv('Zinssatz', pct(k.zins, 2))}${k.zinsbindung_bis ? kv('Zinsbindung bis', dDe(k.zinsbindung_bis)) : ''}` +
    (restZB != null ? kv('Restschuld dann', eur(restZB)) + kv('Zinsen bis dahin', eur(zinsZB)) : '') +
    kv('Schuldenfrei (gleiche Rate)', frei ? 'ca. ' + frei : 'nicht absehbar') + `</div>` +
    (reihe.length ? `<h3>So sinkt die Restschuld</h3><div class="karte">` +
      stapel(reihe.slice(0, 40).map(x => ({id: x.j, l: "'" + String(x.j).slice(2), w: [x.j <= jahr0 + Math.ceil(bisZB / 12) ? x.s : 0, x.j > jahr0 + Math.ceil(bisZB / 12) ? x.s : 0]})),
        ['var(--blau)', '#C7C7CC'], {h: 140, schritt: 5}) +
      `<div class="klein"><span style="color:var(--blau)">●</span> während der Zinsbindung &nbsp; <span style="color:#C7C7CC">●</span> danach (Zins dann unbekannt)</div></div>` : '') +
    erkl(`Zinsen diesen Monat = Restschuld ${eur(rest)} × ${pct(k.zins, 2)} ÷ 12 = <b>${eur(zins0)}</b>.<br>Tilgung = Rate ${eur(k.rate, true)} − Zinsen = <b>${eur(tilg0)}</b>.<br>` +
      'Jeden Monat sinkt die Restschuld um die Tilgung. Dadurch werden die Zinsen kleiner und die Tilgung größer – bei gleicher Rate. ' +
      'Nach der Zinsbindung brauchst du eine Anschlussfinanzierung; der Zins dafür ist heute noch unbekannt.') +
    (bs.length ? `<h3>Gebuchte Raten</h3>` + kurzListe(bs.map(buchRow), 4) : ''));
}
function sheetCfMonat(monat) {
  const x = D.vermietung.cashflow.find(c => c.monat === monat), jetzt = D.vermietung.cashflow[0]; if (!x) return;
  const dE = jetzt ? x.einnahmen - jetzt.einnahmen : 0;
  sheet('Cashflow ' + mLang(monat), `<div class="gross ${ton(x.cashflow)}">${eur(x.cashflow)}</div><div class="unterz">Plan für ${mLang(monat)}</div>` +
    `<div class="karte">${wasserfall([['Mieten', x.einnahmen, monat === D.monat ? 's_soll' : null], ['Kosten', -x.kosten, 's_cf'], ['Kreditrate', -x.kredit, D.vermietung.kredite.length ? 's_kredit|0' : null]], 'Cashflow')}</div>` +
    (Math.abs(dE) > 1 ? `<div class="karte tipp">Mieten ${dE > 0 ? 'höher' : 'niedriger'} als jetzt (${vz(dE)}): In diesem Monat beginnen oder enden Verträge.</div>` : '') +
    (x.tilgung ? `<div class="klein">In der Kreditrate stecken ${eur(x.tilgung)} Tilgung.</div>` : ''));
}
function steuerZiel(pos) {
  const p = pos.replace(/ \(gebucht\)$/, '');
  if (/^Mieten/.test(p)) return {akt: 's_soll'};
  if (/^Schuldzinsen/.test(p)) return D.vermietung.kredite.length ? {akt: 's_kredit|0'} : null;
  if (/^AfA/.test(p)) return {text: 'Abschreibung (AfA): Der Gebäudeanteil des Kaufpreises (inkl. Kaufnebenkosten) wird über die Nutzungsdauer verteilt – meist 2 % pro Jahr, im Kaufjahr anteilig. Es fließt dabei kein Geld, aber es senkt die Steuer. Den Gebäudeanteil stellst du am PC unter Einstellungen ein.'};
  if (/^Möbl|^Möbel/.test(p)) return {kats: ['Möbel/Ausstattung']};
  if (/^Hausgeld/.test(p)) return {kats: ['Hausgeld', 'Hausgeld (absetzbar)']};
  if (/^Strom \+ Internet/.test(p)) return {kats: ['Strom', 'Internet']};
  if (/^Grundsteuer \+ Versicherung/.test(p)) return {kats: ['Grundsteuer', 'Versicherung']};
  if (/^Erhaltungsaufwand/.test(p)) return {kats: ['Erhaltungsaufwand']};
  if (/^Sonstige Werbungskosten/.test(p)) return {kats: ['Sonstige Werbungskosten']};
  if (/Kaution/.test(p)) return {kats: ['Kaution', 'Kaution-Rückzahlung', 'Miete + Kaution']};
  return null;
}
function sheetStpos(i) {
  const s = D.vermietung.steuer, p = s.positionen[+i], z = p && steuerZiel(p.position); if (!z) return;
  if (z.akt) { const [n, ...a] = z.akt.split('|'); return AKT[n](...a); }
  if (z.text) return sheet(p.position, `<div class="gross ${ton(p.betrag)}">${eur(p.betrag)}</div><div class="unterz">${esc(p.objekt)} · ${s.jahr}</div><div class="karte" style="line-height:1.5">${z.text}</div>`);
  sheetVBuchungen(p.position, z.kats, {jahr: s.jahr, wert: p.betrag});
}

// ====================================================================== Mieter
function sheetMmonat(vid, monat) {
  const v = D.vermietung.vertraege.find(x => x.id === vid); if (!v) return;
  const k = v.konto.find(r => r.monat === monat) || {soll: 0, ist: 0}, d = k.ist - k.soll;
  const z = (v.zahlungen || []).filter(x => x[0] === monat);
  sheet(`${v.mieter} · ${mKurz(monat)}`, `<div class="gross ${d < -0.5 ? 'neg' : ''}">${d < -0.5 ? eur(-d) + ' fehlen' : d > 0.5 ? eur(d) + ' zu viel' : 'vollständig bezahlt'}</div>` +
    `<div class="unterz">Soll ${eur(k.soll, true)} · bezahlt ${eur(k.ist, true)} · ${mLang(monat)}</div>` +
    (v.zahlungen ? (z.length ? `<h3>Zahlungen für diesen Monat</h3>` + liste(z.map(x => zeile({punkt: x[4] === 'Mieteinnahme' ? 'var(--gruen)' : 'var(--blau)',
      titel: x[4] === 'Mieteinnahme' ? 'Miete' : esc(x[4]), unter: `eingegangen am ${dDe(x[1])}${x[1].slice(0, 7) !== monat ? ' · für ' + mLang(monat) : ''}`,
      rechts: eur(x[2], true), akt: `s_buch|${x[3]}`})))
      : `<div class="karte leer">Für diesen Monat ist keine Zahlung zugeordnet.</div>`) : hinweisNeueDatei) +
    erkl('Zahlungen zählen für den Monat, für den sie gedacht sind (Leistungsmonat) – nicht nach dem Überweisungsdatum. ' +
      'Eine Überweisung vom 28.10. kann also die November-Miete sein. Zahlt jemand zu viel, wird es mit dem nächsten Monat verrechnet.'));
}

// ====================================================================== Privat
function sheetKat(m, art, k, ersetzen) {
  const wertIn = x => katZeilen(x, art).filter(q => q[3] === k).reduce((s, q) => s + q[4], 0);
  const ml = monateListe(), i = ml.indexOf(m), zeit = i >= 11 ? ml.slice(i - 11, i + 1) : ml.slice(0, 12);   // 12 Monate bis zum gewählten
  const v = wertIn(m), schn = art === 'a' ? (schnittKat(m, art).get(k) || 0) : 0;
  const r = D.buchungen.filter(b => b[6] === 'P' && b[7] === k && b[1].slice(0, 7) === m);
  const emp = new Map(); r.forEach(b => emp.set(b[3] || '–', (emp.get(b[3] || '–') || 0) + Math.abs(b[2])));
  const top = [...emp].sort((a, b) => b[1] - a[1]).slice(0, 3), g = (katZeilen(m, art).find(q => q[3] === k) || [])[2];
  const farbe = art === 'e' ? 'var(--gruen)' : farbeGruppe(g, 0);
  const html = `<div class="gross">${eur(v)}</div><div class="unterz">${mLang(m)} · ${r.length} Buchung${r.length === 1 ? '' : 'en'}` +
    (schn ? ` · <span class="${v > schn ? 'neg' : 'pos'}">${v > schn ? '+' : '−'}${eur(Math.abs(v - schn))} ggü. Ø ${eur(schn)}</span>` : '') + `</div>` +
    `<div class="karte">${monatsBalken(zeit, wertIn, m, farbe, `s_kat2|${art}|${k}`)}<div class="klein">Monat antippen, um ihn anzusehen</div></div>` +
    (top.length > 1 && r.length >= 4 ? `<h3>Wohin das meiste ging</h3>` + liste(top.map(([n, s]) => zeile({titel: esc(n), rechts: eur(s), fett: false}))) : '') +
    `<h3>Buchungen</h3>` + (r.length ? kurzListe(r.map(buchRow), 8) : `<div class="karte leer">Keine Buchungen in diesem Monat.</div>`) +
    erkl(`Die Kategorie vergeben am PC deine Regeln (Privat → Regeln). ${art === 'a' ? 'Der Vergleichswert ist der Durchschnitt der 6 Monate davor. ' : ''}` +
      'Ist eine Buchung falsch einsortiert, änderst du sie am PC unter Privat → Buchungen – mit der nächsten Datei stimmt es auch hier.');
  (ersetzen ? sheetErsetzen : sheet)(k, html);
}
function sheetFix(i) {
  const f = P().fixkosten[+i]; if (!f) return;
  const bs = (f.ids || []).map(buchung).filter(Boolean), tage = new Map();
  bs.forEach(b => { const t = tage.get(b[1]) || {d: b[1], v: 0, ids: []}; t.v += Math.abs(b[2]); t.ids.push(b[0]); tage.set(b[1], t); });   // wie die Erkennung: je Abbuchungstag
  const chrono = [...tage.values()].sort((a, b) => a.d < b.d ? -1 : 1).slice(-12).map(t => [t.ids.length === 1 ? t.ids[0] : 'x' + t.d, t.d, -t.v]);
  sheet(f.name, `<div class="gross">${eur(f.monat, true)} <span style="font-size:1rem;color:var(--text2);font-weight:500">/ Monat</span></div>` +
    `<div class="unterz">${esc(f.kategorie)} · ${esc(f.rhythmus)}${f.jahr ? ' · ' + eur(f.jahr) + ' im Jahr' : ''}</div>` +
    (f.aenderung ? `<div class="karte tipp ${f.aenderung > 0 ? 'warn' : ''}">Zuletzt ${eur(f.zuletzt, true)} – ${f.aenderung > 0 ? 'teurer' : 'günstiger'} als vorher (${f.aenderung > 0 ? '+' : '−'}${pct(Math.abs(f.aenderung), 0)}).</div>` : '') +
    (chrono.length > 1 ? `<div class="karte" style="margin-top:10px">${stapel(chrono.map(b => ({id: b[0], l: MON[+b[1].slice(5, 7) - 1], w: [Math.abs(b[2])]})), ['var(--lila)'], {akt: 's_buch', h: 120, schritt: Math.ceil(chrono.length / 6)})}` +
      `<div class="klein">die letzten ${chrono.length} Abbuchungen${bs.length > chrono.length && tage.size < bs.length ? ' (mehrere am selben Tag zusammengefasst)' : ''} · gleich hohe Balken = fester Betrag</div></div>` : '') +
    `<div class="karte" style="margin-top:10px">${f.typisch != null ? kv('Betrag je Abbuchung', eur(f.typisch, true) + (f.art_betrag ? ` <span class="chip">${esc(f.art_betrag)}</span>` : '')) : ''}` +
    `${kv('Zuletzt abgebucht', eur(f.zuletzt, true))}${f.naechste ? kv('Nächste erwartet', dDe(f.naechste)) : ''}${f.seit ? kv('Läuft seit', dDe(f.seit)) : ''}</div>` +
    (bs.length ? `<h3>Alle Abbuchungen</h3>` + kurzListe(bs.map(buchRow), 5) : (f.ids ? '' : hinweisNeueDatei)) +
    erkl(`Automatisch erkannt: Seit ${f.seit ? dDe(f.seit) : 'einiger Zeit'} wurde regelmäßig (${esc(f.rhythmus)}) ein ähnlicher Betrag an „${esc(f.name)}“ abgebucht. ` +
      '„Pro Monat“ rechnet den Betrag auf einen Monat um – z. B. vierteljährlich ÷ 3, jährlich ÷ 12. Kündigen oder ausblenden kannst du am PC unter Fixkosten & Abos.'));
}
function sheetRate(i) {
  const r = P().raten[+i]; if (!r) return;
  const bs = (r.ids || []).map(buchung).filter(Boolean), ms = letzteMonate(12);
  const proMonat = m => summeAbs(bs.filter(b => b[1].slice(0, 7) === m && b[2] < 0)) - bs.filter(b => b[1].slice(0, 7) === m && b[2] > 0).reduce((s, b) => s + b[2], 0);
  sheet(r.name, `<div class="gross">${eur(r.monat, true)} <span style="font-size:1rem;color:var(--text2);font-weight:500">/ Monat</span></div>` +
    `<div class="unterz">${esc(r.art)} · Ø der letzten 3 Monate</div>` +
    (bs.length ? `<div class="karte">${stapel(ms.map(m => ({id: m, l: MON[+m.slice(5, 7) - 1], w: [proMonat(m)]})), ['var(--orange)'], {h: 120})}<div class="klein">gezahlt je Monat</div></div>` : '') +
    `<div class="karte" style="margin-top:10px">${r.jahr12 != null ? kv('Gezahlt in 12 Monaten', eur(r.jahr12)) : ''}${kv('Letzte Zahlung', dDe(r.letzte) + (r.letzter_betrag ? ' · ' + eur(r.letzter_betrag, true) : ''))}</div>` +
    (bs.length ? `<h3>Zahlungen</h3>` + kurzListe(bs.map(buchRow), 5) : (r.ids ? '' : hinweisNeueDatei)) +
    erkl('Alle Buchungen an diesen Gläubiger (Kredit, Finanzierung, Kreditkarte oder Ratenkauf). „Pro Monat“ ist der Durchschnitt der letzten 3 abgeschlossenen Monate – so fallen Sondertilgungen oder ausgelassene Raten nicht zu stark ins Gewicht.'));
}
function sheetVmonat(m) {
  const bs = D.buchungen.filter(b => b[6] === 'V' && b[1].slice(0, 7) === m && !/^Kaution/.test(b[7]));
  const gr = new Map(); bs.forEach(b => gr.set(b[7], (gr.get(b[7]) || 0) + b[2]));
  const x = P().monate.find(a => a.monat === m);
  sheet('Vermietung ' + mKurz(m), `<div class="gross ${ton(x ? x.vermietung : 0)}">${eur(x ? x.vermietung : 0)}</div><div class="unterz">${mLang(m)} · netto (Mieten minus Kosten und Rate)</div>` +
    (gr.size ? `<div class="karte">${wasserfall([...gr].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), 'Summe Buchungen')}</div>` : '') +
    `<h3>Buchungen</h3>` + (bs.length ? kurzListe(bs.map(buchRow), 6) : `<div class="karte leer">Keine Vermietungs-Buchungen in diesem Monat.</div>`) +
    erkl('Die Summe oben zählt nach dem Monat, für den eine Zahlung gedacht ist (z. B. Miete für November, die Ende Oktober kam). Die Buchungen unten sind nach Buchungsdatum sortiert – deshalb können beide leicht abweichen. Kautionen zählen nicht.'));
}
function sparzieleHtml() {
  const sz = P().sparziele || []; if (!sz.length) return '';
  return `<h3>Sparziele</h3><div class="karte">` + hbalken(sz.map(z => ({l: z.name, v: z.gespart || 0, avg: z.ziel || 0,
    text: `${eur(z.gespart)} von ${eur(z.ziel)}`, c: (z.gespart || 0) >= (z.ziel || 0) ? 'var(--gruen)' : 'var(--blau)'}))) + `</div>`;
}

// ====================================================================== Buchung: alles vom selben Empfänger
// Bei PayPal/Klarna/Amazon zählt der eigentliche Händler („Ihr Einkauf bei Netflix.com“), nicht der Zahlungsdienst
const haendler = b => { const m = /(?:paypal|klarna|amazon)/i.test(b[3] || '') && /Einkauf bei\s+([^,/]+)/i.exec(b[4] || ''); return m ? m[1].trim() : null; };
function gleicherEmpfaenger(b) {
  if (!b[3]) return '';
  const h = haendler(b), name = h || b[3];
  const alle = D.buchungen.filter(x => h ? haendler(x) === h : x[3] === b[3]); if (alle.length < 2) return '';
  const grenze = new Date(new Date(D.heute).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const jahr = alle.filter(x => x[1] >= grenze), sum = jahr.reduce((s, x) => s + x[2], 0), ms = letzteMonate(12);
  return `<h3>Alle Buchungen ${h ? 'bei' : 'mit'} „${esc(name.slice(0, 40))}“</h3>` +
    `<div class="karte">${kv('In den letzten 12 Monaten', `${jahr.length}× · ${eur(sum)}`)}` +
    (jahr.length > 2 ? stapel(ms.map(m => ({id: m, l: MON[+m.slice(5, 7) - 1], w: [Math.abs(jahr.filter(x => x[1].slice(0, 7) === m).reduce((s, x) => s + x[2], 0))]})), [sum < 0 ? 'var(--rot)' : 'var(--gruen)'], {h: 110}) : '') +
    `</div>` + kurzListe(alle.filter(x => x[0] !== b[0]).slice(0, 60).map(buchRow), 4, 'Alle');
}

// ====================================================================== Aktionen
Object.assign(AKT, {
  aufklappen: id => { const el = document.getElementById(id); if (el) el.classList.add('offen'); const k = document.querySelector(`[data-a="aufklappen|${id}"]`); if (k) k.remove(); },
  s_typisch: sheetTypisch, s_soll: sheetSoll, s_kredit: i => sheetKredit(i), s_cfm: m => sheetCfMonat(m), s_vkat: l => sheetVkat(l),
  s_stpos: i => sheetStpos(i), s_mmonat: (v, m) => sheetMmonat(v, m), s_fix: i => sheetFix(i), s_rate: i => sheetRate(i),
  s_kat2: (art, k, m) => sheetKat(m, art, k, true), s_vmonat: m => sheetVmonat(m), s_saldo: m => sheetSaldo(m),
  p_ein_m: m => sheetPriv('e', m), p_aus_m: m => sheetPriv('a', m),
  s_termine: sheetTermine, s_todos: sheetTodos, s_todo: id => sheetTodo(id), todo_erledigt: id => todoErledigt(id),
});
