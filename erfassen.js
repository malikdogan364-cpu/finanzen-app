'use strict';
/* Unterwegs erfassen: Belege/Ausgaben, Barzahlungen von Mietern, Übergabeprotokolle, To-dos.
   Alles bleibt auf dem Handy, bis du die (verschlüsselte) Datei an den PC schickst. */

let ERF = [];                                                  // erfasste Einträge (liegen in IndexedDB)
let FORM = {};                                                 // Zustand des gerade offenen Formulars
const erfassungenLaden = async () => { ERF = (await DB.get('erfassungen')) || []; };
const erfSpeichern = () => DB.set('erfassungen', ERF);
const lokalDatum = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : 'e' + Date.now() + Math.random().toString(16).slice(2));
const wert = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const zahlFeld = id => { const t = wert(id); return t ? zahlAusText(t.replace(/\s/g, '')) : null; };

const ART_NAME = {ausgabe: 'Ausgabe', miete: 'Mietzahlung', uebergabe: 'Übergabe', todo: 'To-do'};
function erfBeschreibung(e) {
  if (e.art === 'ausgabe') return `${e.text || (e.fotos && e.fotos.length ? 'Beleg-Foto' : 'Ausgabe')} · ${{wohnung: 'Wohnung', privat: 'privat', auto: 'automatisch'}[e.bereich] || ''}${e.kategorie ? ': ' + e.kategorie : ''}`;
  if (e.art === 'miete') { const v = D && D.vermietung.vertraege.find(x => x.id === e.vertrag); return `${v ? v.mieter : e.vertrag} · Miete ${e.monat || ''} (${e.wie || 'bar'})`; }
  if (e.art === 'uebergabe') { const v = D && D.vermietung.vertraege.find(x => x.id === e.vertrag); return `${e.uart === 'einzug' ? 'Einzug' : 'Auszug'} ${v ? v.mieter : e.vertrag}`; }
  return e.titel || 'Notiz';
}

// ---------------------------------------------------------------- Fotos & Unterschrift
async function fotoKlein(file, max = 1400, q = 0.72) {
  let bmp;
  try { bmp = await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch (e) { bmp = await createImageBitmap(file); }
  const f = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return {name: `foto-${Date.now()}-${Math.floor(Math.random() * 999)}.jpg`, data};
}
function fotosAnzeigen() {
  const el = $('#f_fotos'); if (!el) return;
  el.innerHTML = (FORM.fotos || []).map((f, i) => `<span class="foto"><img src="data:image/jpeg;base64,${f.data}" alt=""><button data-a="f_foto_weg|${i}" aria-label="Foto entfernen">✕</button></span>`).join('');
}
document.addEventListener('change', async e => {
  if (!['f_foto', 'f_foto2'].includes(e.target.id) || !e.target.files.length) return;
  const gross = FORM.art === 'ausgabe';                      // Belege brauchen mehr Auflösung (lange schmale Bons), Übergabe-Fotos weniger
  for (const file of e.target.files) {
    try { (FORM.fotos = FORM.fotos || []).push(await fotoKlein(file, gross ? 2200 : 1400, gross ? 0.82 : 0.72)); } catch (err) { toast('Foto konnte nicht gelesen werden'); }
  }
  e.target.value = ''; fotosAnzeigen();
  if (gross && $('#f_hinweis_foto')) $('#f_hinweis_foto').hidden = !FORM.fotos.length;
});
function unterschriftInit() {
  const c = $('#f_sig'); if (!c) return;
  const ctx = c.getContext('2d'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  let unten = false;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { unten = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke(); FORM.sig = true; e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!unten) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); });
  const ende = () => { unten = false; };
  c.addEventListener('pointerup', ende); c.addEventListener('pointercancel', ende);
}

// ---------------------------------------------------------------- Formulare
const feld = (label, inhalt) => `<label class="fl"><span>${label}</span>${inhalt}</label>`;
const segF = (grp, optionen, aktiv) => `<div class="seg" data-grp="${grp}">${optionen.map(([k, l]) => `<button type="button" class="${aktiv === k ? 'an' : ''}" data-a="f_set|${grp}|${k}">${l}</button>`).join('')}</div>`;
const optionen = (liste, gewaehlt) => liste.map(x => `<option${x === gewaehlt ? ' selected' : ''}>${esc(x)}</option>`).join('');
const vertragOptionen = (gewaehlt, nurAktiv = true) => D.vermietung.vertraege.filter(v => !nurAktiv || v.status !== 'beendet')
  .map(v => `<option value="${esc(v.id)}"${v.id === gewaehlt ? ' selected' : ''}>${esc(v.einheit)} · ${esc(v.mieter)}</option>`).join('');
// Zwei getrennte Felder: „capture“ öffnet auf dem iPhone direkt die Kamera; mit „multiple“ würde iOS nur die Mediathek anbieten.
const fotoKnopf = `<div class="foto-knoepfe"><label class="knopf hell">Foto aufnehmen<input type="file" class="versteckt" id="f_foto" accept="image/*" capture="environment"></label>` +
  `<label class="knopf hell">Aus Mediathek<input type="file" class="versteckt" id="f_foto2" accept="image/*" multiple></label></div><div class="fotos" id="f_fotos"></div>`;
const AUTO_KAT = '<option value="">Automatisch (Vorschlag am PC)</option>';
const katOptionen = bereich => bereich === 'auto' ? AUTO_KAT : AUTO_KAT + optionen(bereich === 'wohnung' ? D.listen.wohnung_kat : D.listen.privat_kat);

function formAuswahl() {
  sheet('Erfassen', `<div class="liste">` +
    zeile({punkt: 'var(--blau)', titel: 'Ausgabe / Beleg', unter: 'Baumarkt, IKEA … – Foto, Betrag, Wohnung oder privat', akt: 'f_ausgabe'}) +
    zeile({punkt: 'var(--gruen)', titel: 'Mietzahlung', unter: 'Mieter hat bar oder anders bezahlt', akt: 'f_miete'}) +
    zeile({punkt: 'var(--orange)', titel: 'Übergabe', unter: 'Einzug/Auszug: Zählerstände, Mängel, Fotos, Unterschrift', akt: 'f_uebergabe'}) +
    zeile({punkt: 'var(--grau)', titel: 'To-do / Notiz', unter: 'Erinnerung für den PC', akt: 'f_todo'}) + `</div>` +
    `<div class="klein">Alles bleibt auf dem Handy, bis du unter <b>Mehr → An PC senden</b> die verschlüsselte Datei schickst.</div>`);
}
function formAusgabe() {
  FORM = {art: 'ausgabe', fotos: [], bereich: 'auto', bezahlt: 'karte'};
  sheet('Ausgabe erfassen', `<div class="form">` +
    fotoKnopf + `<div class="klein" id="f_hinweis_foto" hidden>Foto gespeichert – Betrag unten ist jetzt optional, du kannst ihn am PC ergänzen.</div>` +
    `<div class="klein">Tipp: den ganzen Bon fotografieren, flach hingelegt und gut beleuchtet.</div>` +
    feld('Betrag (€) – optional, wenn ein Foto dabei ist', `<input class="feld" id="f_betrag" inputmode="decimal" placeholder="z. B. 39,90" autocomplete="off">`) +
    feld('Wo gekauft (optional)', `<input class="feld" id="f_text" placeholder="z. B. Bauhaus, IKEA" autocomplete="off">`) +
    feld('Gehört zu', segF('bereich', [['auto', 'Automatisch'], ['wohnung', 'Wohnung'], ['privat', 'Privat']], 'auto')) +
    feld('Kategorie', `<select class="feld" id="f_kat">${katOptionen('auto')}</select>`) +
    feld('Bezahlt mit', segF('bezahlt', [['karte', 'Karte / Konto'], ['bar', 'Bar']], 'karte')) +
    `<div class="klein" id="f_hinweis">Karte/Konto: Der PC ordnet den Beleg beim nächsten Import automatisch der Kontobuchung zu – ohne doppelte Buchung.</div>` +
    feld('Datum', `<input class="feld" id="f_datum" type="date" value="${lokalDatum()}">`) +
    feld('Notiz (optional)', `<input class="feld" id="f_notiz" autocomplete="off">`) +
    `<button class="knopf" data-a="f_save">Speichern</button></div>`);
}
function formMiete(vertrag) {
  FORM = {art: 'miete', wie: 'bar'};
  const v0 = vertrag || (D.vermietung.rueckstaende[0] || {}).vertrag || (D.vermietung.vertraege.find(v => v.status === 'aktiv') || {}).id;
  const v = D.vermietung.vertraege.find(x => x.id === v0);
  sheet('Mietzahlung erfassen', `<div class="form">` +
    feld('Mieter', `<select class="feld" id="f_vertrag">${vertragOptionen(v0)}</select>`) +
    feld('Betrag (€)', `<input class="feld" id="f_betrag" inputmode="decimal" value="${v ? String(v.warm).replace('.', ',') : ''}" autocomplete="off">`) +
    feld('Für Monat', `<input class="feld" id="f_monat" type="month" value="${D.monat}">`) +
    feld('Erhalten am', `<input class="feld" id="f_datum" type="date" value="${lokalDatum()}">`) +
    feld('Wie bezahlt', segF('wie', [['bar', 'Bar'], ['PayPal', 'PayPal'], ['anderes Konto', 'Anderes Konto']], 'bar')) +
    feld('Notiz (optional)', `<input class="feld" id="f_notiz" autocomplete="off">`) +
    `<button class="knopf" data-a="f_save">Speichern</button></div>`);
}
function formUebergabe(vertrag) {
  FORM = {art: 'uebergabe', fotos: [], uart: 'einzug', sig: false};
  const v0 = vertrag || (D.vermietung.vertraege.find(v => v.status === 'aktiv') || D.vermietung.vertraege[0] || {}).id;
  sheet('Übergabe erfassen', `<div class="form">` +
    feld('Mieter', `<select class="feld" id="f_vertrag">${vertragOptionen(v0, false)}</select>`) +
    feld('Art', segF('uart', [['einzug', 'Einzug'], ['auszug', 'Auszug']], 'einzug')) +
    feld('Datum', `<input class="feld" id="f_datum" type="date" value="${lokalDatum()}">`) +
    `<div class="fl"><span>Zählerstände</span><div class="drei"><input class="feld" id="f_strom" inputmode="decimal" placeholder="Strom kWh"><input class="feld" id="f_wasser" inputmode="decimal" placeholder="Wasser m³"><input class="feld" id="f_heizung" inputmode="decimal" placeholder="Heizung"></div></div>` +
    feld('Schlüssel (Anzahl)', `<input class="feld" id="f_schluessel" inputmode="numeric" placeholder="z. B. 2">`) +
    feld('Zustand', `<select class="feld" id="f_zustand">${optionen(['sehr gut', 'gut', 'normal', 'renovierungsbedürftig'], 'gut')}</select>`) +
    feld('Mängel / Schäden', `<textarea class="feld" id="f_maengel" rows="3" placeholder="leer = keine Mängel"></textarea>`) +
    feld('Anwesend', `<input class="feld" id="f_anwesend" placeholder="z. B. Mieter, Vermieter">`) +
    fotoKnopf +
    `<div class="fl"><span>Unterschrift Mieter <button type="button" class="lnk" data-a="f_sig_leer">löschen</button></span><canvas id="f_sig" width="640" height="240"></canvas></div>` +
    feld('Notiz (optional)', `<input class="feld" id="f_notiz" autocomplete="off">`) +
    `<button class="knopf" data-a="f_save">Speichern</button></div>`);
  unterschriftInit();
}
function formTodo() {
  FORM = {art: 'todo'};
  sheet('To-do / Notiz', `<div class="form">` + feld('Titel', `<input class="feld" id="f_titel" placeholder="z. B. Kaution Cecile abrechnen" autocomplete="off">`) +
    feld('Wichtigkeit', `<select class="feld" id="f_prio">${optionen(['hoch', 'mittel', 'niedrig'], 'mittel')}</select>`) +
    feld('Fällig am (optional)', `<input class="feld" id="f_faellig" type="date">`) +
    feld('Notiz (optional)', `<input class="feld" id="f_notiz" autocomplete="off">`) + `<button class="knopf" data-a="f_save">Speichern</button></div>`);
}

async function erfSpeichernAusFormular() {
  const e = {id: neueId(), art: FORM.art, erstellt: new Date().toISOString(), datum: wert('f_datum') || lokalDatum(), notiz: wert('f_notiz')};
  if (FORM.art === 'ausgabe') {
    const b = zahlFeld('f_betrag'), fotos = FORM.fotos || [];
    if ((!b || b <= 0) && !fotos.length) return toast('Bitte ein Foto machen oder einen Betrag eingeben');
    Object.assign(e, {betrag: b && b > 0 ? Math.abs(b) : null, text: wert('f_text'), bereich: FORM.bereich, kategorie: wert('f_kat'), bezahlt: FORM.bezahlt, fotos});
  } else if (FORM.art === 'miete') {
    const b = zahlFeld('f_betrag'); if (!b || b <= 0) return toast('Bitte einen Betrag eingeben');
    Object.assign(e, {betrag: Math.abs(b), vertrag: wert('f_vertrag'), monat: wert('f_monat') || D.monat, wie: FORM.wie});
  } else if (FORM.art === 'uebergabe') {
    const sig = FORM.sig ? $('#f_sig').toDataURL('image/png').split(',')[1] : null;
    Object.assign(e, {vertrag: wert('f_vertrag'), uart: FORM.uart, zaehler: {strom: wert('f_strom'), wasser: wert('f_wasser'), heizung: wert('f_heizung')},
      schluessel: wert('f_schluessel'), zustand: wert('f_zustand'), maengel: wert('f_maengel'), anwesend: wert('f_anwesend'),
      fotos: FORM.fotos || [], unterschrift: sig});
  } else {
    if (!wert('f_titel')) return toast('Bitte einen Titel eingeben');
    Object.assign(e, {titel: wert('f_titel'), prioritaet: wert('f_prio'), faellig: wert('f_faellig') || null});
  }
  ERF.push(e); await erfSpeichern();
  sheetZu(); toast('Gespeichert – liegt zum Senden bereit'); if (S.tab === 'mehr') render();
  if (e.art === 'ausgabe' && e.fotos && e.fotos.length) belegLesen(e);
}

// ---------------------------------------------------------------- Texterkennung auf dem Handy (Tesseract.js, läuft offline)
let OCR_LAEUFT = Promise.resolve();
// Graustufen + Kontrast strecken: Kassenbons (Thermopapier) werden damit deutlich besser erkannt
async function belegVorbereiten(b64) {
  const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
  const m = bmp.width < 1600 ? 2 : 1, c = document.createElement('canvas'); c.width = bmp.width * m; c.height = bmp.height * m;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
  const im = x.getImageData(0, 0, c.width, c.height), p = im.data, h = new Array(256).fill(0);
  for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; p[i] = g; h[g]++; }
  const n = c.width * c.height; let s = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { s += h[i]; if (s > n * 0.01) { lo = i; break; } }
  s = 0; for (let i = 255; i >= 0; i--) { s += h[i]; if (s > n * 0.2) { hi = i; break; } }   // Papierweiß = helle 20 %
  const f = 255 / Math.max(40, hi - lo);
  for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - lo) * f)) | 0; p[i] = p[i + 1] = p[i + 2] = g; }
  x.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}
function skriptLaden(src) {
  return new Promise((ok, fehler) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fehler(new Error('ocr-laden')); document.head.appendChild(s); });
}
async function belegLesen(e) {
  OCR_LAEUFT = OCR_LAEUFT.then(async () => {
    let worker;
    try {
      toast('Beleg wird gelesen …');
      if (!window.Tesseract) await skriptLaden('ocr/tesseract.min.js');
      const basis = new URL('ocr/', location.href).href;
      worker = await Tesseract.createWorker('deu', 1, {workerPath: basis + 'worker.min.js', corePath: basis, langPath: basis,
        cacheMethod: 'none', workerBlobURL: false});
      await worker.setParameters({tessedit_pageseg_mode: '6', preserve_interword_spaces: '1'});
      const texte = [];
      for (const f of e.fotos) { const r = await worker.recognize(await belegVorbereiten(f.data)); texte.push(r.data.text || ''); }
      e.ocr_text = texte.join('\n\n').trim().slice(0, 8000);
      await erfSpeichern();
      toast(e.ocr_text ? 'Beleg gelesen ✓' : 'Kein Text erkannt – Betrag wird am PC ergänzt');
      if (S.tab === 'mehr') render();
    } catch (err) {
      toast('Beleg konnte hier nicht gelesen werden – der PC liest ihn nicht, bitte Betrag ergänzen');
    } finally { try { worker && await worker.terminate(); } catch (x) {} }
  });
}

// ---------------------------------------------------------------- An den PC senden (verschlüsselt)
async function erfDatei() {
  if (!S.key) throw new Error('kein-schluessel');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const klar = new TextEncoder().encode(JSON.stringify({typ: 'erfassungen', erstellt: new Date().toISOString(), eintraege: ERF}));
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, S.key, klar);
  const obj = {fin: 1, typ: 'erfassungen', kdf: 'PBKDF2-SHA256', salt: S.keySalt, iter: S.keyIter, iv: b64enc(iv), data: b64enc(ct), stand: new Date().toISOString().slice(0, 16)};
  return new File([JSON.stringify(obj)], `Erfassungen-${lokalDatum()}.finnotiz`, {type: 'application/json'});
}
async function erfSenden() {
  if (!ERF.length) return toast('Nichts zu senden');
  let datei;
  try { datei = await erfDatei(); }
  catch (e) { return toast(e.message === 'kein-schluessel' ? 'Bitte zuerst eine Datei vom PC laden (Mehr → Neue Daten laden)' : 'Datei konnte nicht erstellt werden'); }
  let geteilt = false;
  try {
    for (const typ of ['application/json', 'text/plain', 'application/octet-stream']) {
      const f = new File([datei], datei.name, {type: typ});
      if (navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: 'Finanzen – Erfassungen'}); geteilt = true; break; }
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  if (!geteilt) {                                                   // Fallback: Datei speichern, dann aus „Dateien“ teilen
    const a = document.createElement('a'); a.href = URL.createObjectURL(datei); a.download = datei.name; document.body.appendChild(a); a.click(); a.remove();
    toast('Datei gespeichert – aus „Dateien“ an den PC schicken');
  }
  const jetzt = new Date().toISOString(); ERF.forEach(e => { if (!e.gesendet) e.gesendet = jetzt; });
  await erfSpeichern(); render();
}

// ---------------------------------------------------------------- Aktionen
Object.assign(AKT, {
  erfassen: formAuswahl, f_ausgabe: formAusgabe, f_miete: v => formMiete(v), f_uebergabe: v => formUebergabe(v), f_todo: formTodo,
  f_set: (grp, k, el) => {
    FORM[grp] = k;
    document.querySelectorAll(`[data-grp="${grp}"] button`).forEach(b => b.classList.toggle('an', b.dataset.a === `f_set|${grp}|${k}`));
    if (grp === 'bereich' && $('#f_kat')) $('#f_kat').innerHTML = katOptionen(k);
    if (grp === 'bezahlt' && $('#f_hinweis')) $('#f_hinweis').textContent = k === 'bar' ? 'Bar: Wird als Barzahlung direkt gebucht (keine Kontobuchung dazu).' : 'Karte/Konto: Der PC ordnet den Beleg beim nächsten Import automatisch der Kontobuchung zu – ohne doppelte Buchung.';
  },
  f_save: erfSpeichernAusFormular,
  f_foto_weg: i => { FORM.fotos.splice(+i, 1); fotosAnzeigen(); },
  f_sig_leer: () => { const c = $('#f_sig'); c.getContext('2d').clearRect(0, 0, c.width, c.height); FORM.sig = false; },
  erf_senden: erfSenden,
  erf_weg: async id => { if (!confirm('Diesen Eintrag löschen?')) return; ERF = ERF.filter(e => e.id !== id); await erfSpeichern(); render(); },
  erf_gesendete_weg: async () => { ERF = ERF.filter(e => !e.gesendet); await erfSpeichern(); render(); toast('Gesendete entfernt'); },
});

function erfassungenHtml() {
  if (!ERF.length) return `<h3>Unterwegs erfasst</h3><div class="liste"><div class="leer">Noch nichts. Tippe unten rechts auf <b>+</b>.</div></div>`;
  const offen = ERF.filter(e => !e.gesendet).length;
  return `<h3>Unterwegs erfasst <small>${offen} noch nicht gesendet</small></h3>` + liste(ERF.map(e => zeile({
    punkt: e.gesendet ? 'var(--gruen)' : 'var(--orange)', akt: `erf_weg|${e.id}`,
    titel: esc(erfBeschreibung(e)), unter: `${ART_NAME[e.art]} · ${dDe(e.datum)}${(e.fotos && e.fotos.length) ? ' · ' + e.fotos.length + ' Foto' + (e.fotos.length > 1 ? 's' : '') : ''}${e.gesendet ? ' · gesendet' : ''}`,
    rechts: e.betrag ? eur(e.betrag, true) : (e.art === 'ausgabe' ? 'Betrag am PC' : null)}))) +
    `<button class="knopf" data-a="erf_senden">An PC senden</button>` +
    (ERF.some(e => e.gesendet) ? `<button class="knopf hell" data-a="erf_gesendete_weg">Gesendete entfernen</button>` : '') +
    `<div class="klein">Die Datei ist verschlüsselt. Am PC: Import → Vom Handy. Doppelt gesendete Einträge werden dort erkannt.</div>`;
}
