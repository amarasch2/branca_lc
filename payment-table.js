// Home "Il Branco": lista dei lupetti + scheda unica (pagamenti, documenti, eventi, PDF, WhatsApp).
let paymentData = null; // null finché Firebase non ha risposto: nessun salvataggio prima di allora
let schedeData  = null;
let foto = {};     // nome -> JPEG in base64; vuoto se non ci sono foto o non si riesce a leggerle
let fotoPer = null;
let flushRich = null; // salva subito il testo formattato in corso di scrittura (se c'è)
let payNome = ''; // lupetto scelto nel modulo del pagamento (vuoto finché non lo si sceglie dalla lista)
let tab = 'dati'; // sezione aperta nella scheda: 'dati' (pagamenti e documenti) o 'prog' (progressione personale)
let aperto = null; // nome del lupetto con la scheda aperta

const $ = (id) => document.getElementById(id);
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const avatar = (nome) => `<span class="av" aria-hidden="true">${foto[nome] ? `<img src="${foto[nome]}" alt="">` : nome[0]}</span>`;
const PAW = '<svg class="paw" aria-hidden="true"><use href="#paw"/></svg>';

document.addEventListener('DOMContentLoaded', () => {
    // I popup non devono mai superare l'altezza davvero visibile: su iPhone 100vh include la barra di Safari e il fondo resta nascosto.
    const altezza = () => document.documentElement.style.setProperty('--vh', (window.visualViewport?.height || window.innerHeight) + 'px');
    altezza();
    window.addEventListener('resize', altezza);
    window.visualViewport?.addEventListener('resize', altezza);
    $('lupDlg').addEventListener('close', () => { if (flushRich) flushRich(); });
    renderHeadMesi();
    $('search').addEventListener('input', renderRighe);
    $('righe').addEventListener('click', e => {
        const sw = e.target.closest('.sw');
        if (sw) return impostaEventi(sw.dataset.nome, sw.getAttribute('aria-checked') !== 'true'); // l'interruttore non apre la scheda
        const tr = e.target.closest('tr[data-nome]');
        if (tr) apriScheda(tr.dataset.nome);
    });
    // easter egg: un tocco sul titolo
    document.querySelector('h1').addEventListener('click', () => $('eggDlg').showModal());
    $('eggDlg').querySelector('[data-close]').addEventListener('click', () => $('eggDlg').close());
    $('openPay').addEventListener('click', () => apriPagamento());
    $('resetEventi').addEventListener('click', resetEventi);
    $('fotoIn').addEventListener('change', e => { const file = e.target.files[0]; if (file && fotoPer) mettiFoto(fotoPer, file); });
    setupPayDialog();
    document.querySelectorAll('.dlg').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
    load();
});

async function load() {
    try {
        const [pag, sch, fo] = await Promise.all([docPagamenti.get(), docSchede.get(), caricaFoto().catch(e => { console.warn('Foto non lette:', e); return {}; })]);
        paymentData = pag.exists ? pag.data().data : {};
        schedeData  = sch.exists ? sch.data() : {};
        foto = fo;
        render();
    } catch (e) {
        console.error('Errore caricamento:', e);
        $('righe').innerHTML = '<tr><td colspan="4" class="loading">Non riesco a caricare i dati. Ricarica la pagina.</td></tr>';
    }
}

function pronto() {
    if (!paymentData || !schedeData) alert('Sto ancora caricando i dati: riprova tra un momento.');
    return !!(paymentData && schedeData);
}

// ─── Calcoli ───────────────────────────────────────────────────────────────
function stato(nome) {
    const mens = paymentData.mensili?.[nome] || {};
    const vdb  = paymentData.vdb?.[nome] || {};
    const m = somma(mens), v = somma(vdb);
    return {
        mens, vdb, m, v,
        dovuto: round2(rimanenza(MAX_MENSILI, m) + rimanenza(MAX_VDB, v)),
        docs: CAMPI.filter(c => schedeData[nome]?.[c.field]).length,
        eventi: !!paymentData.principale?.[nome]?.eventi
    };
}

// ─── Lista ───────────────────────────────────────────────────────────────
function render() {
    renderHeadMesi();
    renderRighe();
    if (aperto && $('lupDlg').open) renderScheda(aperto);
}

// Le sigle dei mesi stanno sopra le impronte; il mese in corso è evidenziato.
function renderHeadMesi() {
    const adesso = new Date().getMonth(); // dopo giugno nessun mese è evidenziato
    $('mesiHead').innerHTML = MESI.map((m, i) => `<span${i === adesso ? ' class="adesso"' : ''}>${m.slice(0, 3)}</span>`).join('');
}

function renderRighe() {
    const meseOggi = new Date().getMonth(); // dopo giugno nessun mese è evidenziato
    const q = $('search').value.trim().toLowerCase();
    const lista = LUPETTI.filter(l => l.nome.toLowerCase().includes(q));
    $('righe').innerHTML = lista.length ? lista.map(l => {
        const s = stato(l.nome);
        const mancano = CAMPI.filter(c => !schedeData[l.nome]?.[c.field]).map(c => c.label);
        return `<tr data-nome="${l.nome}">
            <th scope="row"><span class="nome">${avatar(l.nome)}<button class="apri" type="button" data-nome="${l.nome}">${l.nome}</button></span></th>
            <td class="c-mens" data-l="Mensilità"><span class="paws" role="img" aria-label="Mensilità pagate: ${MESI.filter(m => parseFloat(s.mens[m]) > 0).join(', ') || 'nessuna'}">${MESI.map((m, i) => `<span class="zampa">${PAW.replace('class="paw"', `class="paw${parseFloat(s.mens[m]) > 0 ? ' on' : ''}"`)}<span class="mi${i === meseOggi ? ' adesso' : ''}" aria-hidden="true">${m.slice(0, 3)}</span></span>`).join('')}</span></td>
            <td data-l="Documenti"><span class="bol" role="img" aria-label="${mancano.length ? 'Documenti mancanti: ' + mancano.join(', ') : 'Documenti completi'}">${CAMPI.map(c => `<span class="${schedeData[l.nome]?.[c.field] ? 'on' : ''}" title="${c.label}">${c.sigla}</span>`).join('')}</span></td>
            <td data-l="Pagamento eventi"><button class="sw" type="button" role="switch" aria-checked="${s.eventi}" aria-label="Pagamento eventi di ${l.nome}" data-nome="${l.nome}"><span class="knob"></span><span class="sw-t">${s.eventi ? 'Sì' : 'No'}</span></button></td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="loading">Nessun lupetto con questo nome.</td></tr>';
}

async function impostaEventi(nome, nuovo) {
    try {
        await salvaEventi({ [nome]: nuovo });
    } catch (e) {
        console.error('Errore salvataggio eventi:', e);
        alert('Modifica NON salvata (errore di rete o permessi). Riprova.');
    }
    render();
    const b = $('righe').querySelector(`.sw[data-nome="${nome}"]`);
    if (b) b.focus();
}

// ─── Scheda lupetto ──────────────────────────────────────────────────────
function apriScheda(nome) {
    if (!pronto()) return;
    aperto = nome;
    tab = 'dati';
    renderScheda(nome);
    if (!$('lupDlg').open) $('lupDlg').showModal();
}

function renderScheda(nome) {
    const l = LUPETTI.find(x => x.nome === nome), s = stato(nome);
    const dlg = $('lupDlg');
    dlg.innerHTML = `<div class="pp" tabindex="-1" autofocus>
        <header class="pp-h"><div class="pp-id"><button class="foto" type="button" data-foto aria-label="${foto[nome] ? 'Cambia' : 'Aggiungi'} la foto di ${l.nome}">${avatar(nome)}<span class="cam">${foto[nome] ? 'Cambia' : 'Foto'}</span></button><div><h2>${l.nome}</h2><p>Genitore: ${l.genitore} · ${l.telefono}</p>${foto[nome] ? '<button class="link" type="button" data-nofoto>Togli la foto</button>' : ''}</div></div><button class="pp-x" type="button" data-close aria-label="Chiudi">×</button></header>
        <div class="tabs" role="tablist" aria-label="Sezioni della scheda">
            <button type="button" role="tab" id="tab-dati" data-tab="dati" aria-controls="pan-dati" aria-selected="${tab === 'dati'}" tabindex="${tab === 'dati' ? 0 : -1}">Pagamenti e documenti</button>
            <button type="button" role="tab" id="tab-prog" data-tab="prog" aria-controls="pan-prog" aria-selected="${tab === 'prog'}" tabindex="${tab === 'prog' ? 0 : -1}">Progressione personale</button>
        </div>
        <div class="pan" id="pan-dati" role="tabpanel" aria-labelledby="tab-dati"${tab === 'dati' ? '' : ' hidden'}>
        <section>
            <div class="pp-meters">
                <div class="pp-meter"><span>Mensilità</span><div class="pp-bar"><i style="width:${Math.min(100, s.m / MAX_MENSILI * 100)}%"></i></div><span>${eur(s.m)}/€${MAX_MENSILI}</span></div>
                <div class="pp-meter"><span>VDB</span><div class="pp-bar"><i style="width:${Math.min(100, s.v / MAX_VDB * 100)}%"></i></div><span>${eur(s.v)}/€${MAX_VDB}</span></div>
            </div>
        </section>
        <section><h3>Le tracce dei mesi</h3><div class="pp-months">${MESI.map(m => {
            const v = round2((parseFloat(s.mens[m]) || 0) + (parseFloat(s.vdb[m]) || 0));
            return v > 0 ? `<button type="button" data-del="${m}" aria-label="Cancella il pagamento di ${m} (${eur(v)})"><small>${m}</small>${eur(v)}</button>` : `<div><small>${m}</small>–</div>`;
        }).join('')}</div><p class="hint">Tocca un mese pagato per cancellarlo.</p></section>
        <section><h3><span>Documenti</span><span>${s.docs}/${CAMPI.length}</span></h3><div class="pp-docs">${CAMPI.map(c => `<button type="button" data-doc="${c.field}" aria-pressed="${!!schedeData[nome]?.[c.field]}">${c.label}</button>`).join('')}</div></section>
        <footer class="pp-acts"><button class="btn btn-cream" type="button" data-pdf>Manda il PDF di riepilogo</button></footer>
        </div>
        <div class="pan" id="pan-prog" role="tabpanel" aria-labelledby="tab-prog"${tab === 'prog' ? '' : ' hidden'}>
${progHTML(nome)}
        </div>
    </div>`;
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => toggleDoc(nome, b.dataset.doc)));
    dlg.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => cancellaMese(nome, b.dataset.del)));
    dlg.querySelector('[data-foto]').addEventListener('click', () => { fotoPer = nome; $('fotoIn').value = ''; $('fotoIn').click(); });
    const nf = dlg.querySelector('[data-nofoto]');
    if (nf) nf.addEventListener('click', () => togliFoto(nome));
    dlg.querySelectorAll('[role="tab"]').forEach(b => {
        b.addEventListener('click', () => selezionaTab(b.dataset.tab));
        b.addEventListener('keydown', e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            selezionaTab(tab === 'dati' ? 'prog' : 'dati', true);
        });
    });
    collegaProgressione(nome);
    dlg.querySelector('[data-pdf]').addEventListener('click', () => shareOrDownloadPDF(generatePDF(nome, paymentData, schedeData), nome));
}

function selezionaTab(t, focus = false) {
    tab = t;
    const dlg = $('lupDlg');
    dlg.querySelectorAll('[role="tab"]').forEach(b => {
        const on = b.dataset.tab === t;
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
    });
    dlg.querySelectorAll('.pan').forEach(p => { p.hidden = p.id !== 'pan-' + t; });
}

// Ogni azione salva solo il campo toccato; se fallisce lo dice e non cambia nulla.
async function conFocus(selettore, fn) {
    await fn();
    const el = $('lupDlg').querySelector(selettore);
    if (el) el.focus();
}

function toggleDoc(nome, campo) {
    return conFocus(`[data-doc="${campo}"]`, async () => {
        const nuovo = !schedeData[nome]?.[campo];
        try {
            await docSchede.set({ [nome]: { [campo]: nuovo } }, { merge: true });
            (schedeData[nome] ??= {})[campo] = nuovo;
        } catch (e) {
            console.error('Errore salvataggio documento:', e);
            alert('Modifica NON salvata (errore di rete o permessi). Riprova.');
        }
        render();
    });
}

async function salvaEventi(valori) { // valori: { nome: bool }
    const principale = {};
    Object.entries(valori).forEach(([nome, eventi]) => { principale[nome] = { eventi }; });
    await docPagamenti.set({ data: { principale }, lastUpdate: stamp() }, { merge: true });
    Object.entries(valori).forEach(([nome, eventi]) => { ((paymentData.principale ??= {})[nome] ??= {}).eventi = eventi; });
}

async function resetEventi() {
    if (!pronto()) return;
    if (!confirm("Azzerare gli eventi pagati per TUTTI i lupetti?\n\nL'operazione è immediata e online.")) return;
    try {
        await salvaEventi(Object.fromEntries(LUPETTI.map(l => [l.nome, false])));
    } catch (e) {
        console.error('Errore reset eventi:', e);
        alert('Reset NON salvato (errore di rete o permessi). Riprova.');
    }
    render();
}

async function cancellaMese(nome, mese) {
    if (!confirm(`Cancellare il pagamento di ${nome} per ${mese}?\n\nSarà cancellato ONLINE immediatamente.`)) return;
    try {
        await salvaPagamenti([{ tipo: 'mensili', nome, mese, valore: null }, { tipo: 'vdb', nome, mese, valore: null }]);
    } catch (e) {
        console.error('Errore cancellazione:', e);
        alert('Pagamento NON cancellato (errore di rete o permessi). Riprova.');
        return;
    }
    delete paymentData.mensili?.[nome]?.[mese];
    delete paymentData.vdb?.[nome]?.[mese];
    render();
}

// ─── Aggiungi pagamento ──────────────────────────────────────────────────────
function setupPayDialog() {
    const dlg = $('payDlg');
    $('payMese').innerHTML = MESI.map(m => `<option>${m}</option>`).join('');
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    $('payForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvaPagamento();
    });
    // mostra cosa c'è già nel mese scelto, così nessuno sovrascrive per sbaglio
    const aggiorna = () => {
        const nome = payNome, mese = $('payMese').value;
        const gia = nome && paymentData ? round2((parseFloat(paymentData.mensili?.[nome]?.[mese]) || 0) + (parseFloat(paymentData.vdb?.[nome]?.[mese]) || 0)) : 0;
        $('payHint').textContent = gia > 0 ? `Per ${mese} risultano già ${eur(gia)}: quello che scrivi si somma.` : '';
    };
    // ricerca per nome o cognome: ogni parola scritta deve comparire nel nome
    const mostra = () => {
        const parole = $('payCerca').value.toLowerCase().split(' ').filter(Boolean);
        if (payNome || !parole.length) { $('payRisultati').innerHTML = ''; return; } // nessuna lista finché non scrivi
        const trovati = LUPETTI.filter(l => parole.every(p => l.nome.toLowerCase().includes(p)));
        $('payRisultati').innerHTML = trovati.length
            ? trovati.map(l => `<li><button type="button" data-nome="${l.nome}">${l.nome}</button></li>`).join('')
            : '<li class="nessuno">Nessun lupetto con questo nome.</li>';
    };
    const scegli = (nome) => { payNome = nome; $('payCerca').value = nome; mostra(); aggiorna(); $('payCanc').focus(); };
    $('payCerca').addEventListener('input', () => { payNome = ''; mostra(); aggiorna(); });
    $('payCerca').addEventListener('keydown', e => {
        if (e.key !== 'Enter' || payNome) return;
        e.preventDefault(); // Invio sceglie il primo della lista invece di inviare il modulo
        const primo = $('payRisultati').querySelector('button');
        if (primo) scegli(primo.dataset.nome);
    });
    $('payRisultati').addEventListener('click', e => { const b = e.target.closest('button'); if (b) scegli(b.dataset.nome); });
    $('payDlg').mostraRicerca = mostra;
    $('payMese').addEventListener('change', aggiorna);
}

function apriPagamento() {
    if (!pronto()) return;
    $('payForm').reset();
    $('payHint').textContent = '';
    $('payForm').hidden = false;
    $('payDone').hidden = true;
    $('paySubmit').disabled = false;
    payNome = '';
    $('payDlg').mostraRicerca();
    $('payMese').dispatchEvent(new Event('change'));
    $('payDlg').showModal();
}

async function salvaPagamento() {
    const nome = payNome, mese = $('payMese').value;
    const canc = round2(parseFloat($('payCanc').value)), vdb = round2(parseFloat($('payVdb').value));
    if (!nome || !(canc >= 0) || !(vdb >= 0)) { alert('Controlla i campi: scegli un lupetto dalla lista e metti importi da 0 in su.'); return; }
    const totale = round2(canc + vdb);
    if (!confirm(`Confermi?\n\n${nome} · ${mese}\nCancelleria: ${eur(canc)}\nVDB: ${eur(vdb)}\nTotale: ${eur(totale)}\n\nSarà salvato ONLINE subito.`)) return;

    $('paySubmit').disabled = true;
    try {
        const nuovo = await aggiungiPagamento(nome, mese, canc, vdb);
        ((paymentData.mensili ??= {})[nome] ??= {})[mese] = nuovo.mensili;
        ((paymentData.vdb ??= {})[nome] ??= {})[mese] = nuovo.vdb;
    } catch (e) {
        console.error('Errore salvataggio:', e);
        alert('Pagamento NON salvato (errore di rete o permessi). Non è partito nessun messaggio. Riprova.');
        $('paySubmit').disabled = false;
        return;
    }
    render();

    const l = LUPETTI.find(x => x.nome === nome);
    const msg = `*Conferma Pagamento*\nQuota Totale: ${eur(totale)}\n- Cancelleria: ${eur(canc)}\n- VDB: ${eur(vdb)}\nper ${nome} per il mese di ${mese}. Grazie!`;
    $('payWa').href = `https://wa.me/${l.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    $('payDoneText').textContent = `Pagamento di ${nome} salvato (${eur(totale)} per ${mese}).`;
    $('payForm').hidden = true;
    $('payDone').hidden = false;
}

// ─── Foto ──────────────────────────────────────────────────────────────────
// Ritaglia al centro in un quadrato 256x256 e comprime: resta sotto i ~30 KB, quindi sta comodo in Firestore.
async function ridimensiona(file, lato = 256) {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode(); // il browser applica da solo l'orientamento EXIF delle foto scattate col telefono
        const l = Math.min(img.naturalWidth, img.naturalHeight);
        const cv = document.createElement('canvas');
        cv.width = cv.height = lato;
        cv.getContext('2d').drawImage(img, (img.naturalWidth - l) / 2, (img.naturalHeight - l) / 2, l, l, 0, 0, lato, lato);
        return cv.toDataURL('image/jpeg', 0.8);
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function mettiFoto(nome, file) {
    try {
        const img = await ridimensiona(file);
        await salvaFoto(nome, img);
        foto[nome] = img;
    } catch (e) {
        console.error('Errore foto:', e);
        alert('Foto NON salvata (file non valido, rete o permessi). Riprova.');
        return;
    }
    render();
    const b = $('lupDlg').querySelector('[data-foto]');
    if (b) b.focus();
}

async function togliFoto(nome) {
    if (!confirm(`Togliere la foto di ${nome}?`)) return;
    try {
        await eliminaFoto(nome);
        delete foto[nome];
    } catch (e) {
        console.error('Errore foto:', e);
        alert('Foto NON tolta (rete o permessi). Riprova.');
        return;
    }
    render();
    const b = $('lupDlg').querySelector('[data-foto]');
    if (b) b.focus();
}

// ─── Progressione personale ──────────────────────────────────────────────
// Dati in schedeData[nome].progressione = { sestiglia, pista, forza, criticita, note, migliorati,
//   preda, predaDistintivo, specialita: [{ nome, distintivo }] }. Vecchio formato: una sola stringa (diventa "note").
const BARRA = () => `<div class="rtbar" role="toolbar" aria-label="Formattazione del testo"><button type="button" data-cmd="bold" aria-label="Grassetto"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Corsivo"><i>I</i></button><button type="button" data-cmd="underline" aria-label="Sottolineato"><u>S</u></button><button type="button" data-cmd="insertUnorderedList" aria-label="Elenco puntato">• Elenco</button><button type="button" data-cmd="insertOrderedList" aria-label="Elenco numerato">1. Elenco</button><span class="colori" role="group" aria-label="Colore del testo">${COLORI.map(([n, c]) => `<button type="button" class="col" data-color="${c}" style="--c:${c}" aria-label="Testo ${n}"></button>`).join('')}</span><button type="button" data-cmd="removeFormat" aria-label="Togli la formattazione">Pulisci</button></div>
`;
const COLORI = [['rosso', '#B3261E'], ['arancione', '#B45309'], ['verde', '#1B7A3E'], ['blu', '#1F5FBF'], ['viola', '#7B3FA0'], ['verde bosco (normale)', '#123F2E']];
const TAG_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN']);
const COLORE_OK = /^(#[0-9a-f]{3,8}|rgb\(\d{1,3}, ?\d{1,3}, ?\d{1,3}\))$/i;
function pulisci(html) {
    const src = new DOMParser().parseFromString(html, 'text/html').body; // documento inerte: niente script né immagini caricate
    const out = document.createElement('div');
    const copia = (da, a) => {
        for (const n of da.childNodes) {
            if (n.nodeType === 3) { a.append(n.textContent); continue; }
            if (n.nodeType !== 1) continue;
            let tag = n.tagName, colore = n.tagName === 'SPAN' ? n.style.color : '';
            if (tag === 'FONT') { tag = 'SPAN'; colore = n.getAttribute('color') || ''; }
            if (!TAG_OK.has(tag)) { if (tag !== 'SCRIPT' && tag !== 'STYLE') copia(n, a); continue; } // tag sconosciuto: resta solo il testo
            const e = document.createElement(tag);
            if (tag === 'SPAN' && COLORE_OK.test(colore)) e.style.color = colore;
            copia(n, e);
            a.append(e);
        }
    };
    copia(src, out);
    return out.innerHTML;
}
// il vecchio testo semplice (con a capo) si mostra come HTML sicuro
const perEditor = (v) => /<[a-z]/i.test(v) ? pulisci(v) : esc(v).split('\n').join('<br>');

const progDi = (nome) => { const p = schedeData[nome]?.progressione; return typeof p === 'string' ? { note: p } : (p || {}); };

function progHTML(nome) {
    const p = progDi(nome), spec = p.specialita || [];
    const testo = (k, label) => `<div class="field"><label for="p-${k}">${label}</label><input id="p-${k}" data-p="${k}" type="text" maxlength="100" value="${esc(p[k] || '')}"></div>`;
    const area  = (k, label) => `<div class="field"><span class="lbl" id="l-${k}">${label}</span>${BARRA()}<div class="rt" id="p-${k}" data-rt="${k}" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="l-${k}" data-ph="Scrivi qui…">${perEditor(p[k] || '')}</div></div>`;
    return `            <div class="two">${testo('sestiglia', 'Sestiglia')}${testo('pista', 'Stato della pista')}</div>
            <div class="two">${area('forza', 'Punti di forza')}${area('criticita', 'Punti di criticità')}</div>
            ${area('note', 'Eventuali annotazioni')}
            ${area('migliorati', 'Aspetti migliorati')}
            <section><h3>Preda</h3><div class="pp-docs">
                <button type="button" data-pflag="preda" aria-pressed="${!!p.preda}">Preda cacciata</button>
                <button type="button" data-pflag="predaDistintivo" aria-pressed="${!!p.predaDistintivo}">Distintivo consegnato</button></div></section>
            <section><h3><span>Specialità cacciate</span><span>${spec.filter(s => s.nome).length}</span></h3>
                ${spec.map((s, i) => `<div class="spec"><input type="text" data-spec-nome="${i}" maxlength="80" value="${esc(s.nome || '')}" placeholder="Nome della specialità" aria-label="Nome della specialità"><button class="dbtn" type="button" data-spec-flag="${i}" aria-pressed="${!!s.distintivo}">Distintivo consegnato</button><button class="pp-x" type="button" data-spec-del="${i}" aria-label="Togli la specialità ${esc(s.nome || '')}">×</button></div>`).join('') || '<p class="hint">Nessuna specialità ancora.</p>'}
                <div><button class="btn btn-cream" type="button" data-spec-add>+ Aggiungi specialità</button></div></section>
            <div class="pp-acts"><button class="btn btn-sun" type="button" data-salva>Salva</button></div>`;
}

// Scrive in Firebase tutta la progressione del lupetto (le righe di specialità senza nome si saltano);
// la copia locale si aggiorna subito, così un clic altrove non fa perdere quello che si è appena scritto.
async function salvaProg(nome, patch) {
    const prima = schedeData[nome]?.progressione;
    const nuova = { ...progDi(nome), ...patch };
    (schedeData[nome] ??= {}).progressione = nuova;
    try {
        await docSchede.set({ [nome]: { progressione: { ...nuova, specialita: (nuova.specialita || []).filter(s => s.nome) } } }, { merge: true });
    } catch (e) {
        console.error('Errore salvataggio progressione:', e);
        schedeData[nome].progressione = prima;
        alert('Modifica NON salvata (errore di rete o permessi). Riprova.');
        render();
    }
}

function collegaProgressione(nome) {
    const pan = $('pan-prog');
    const rifocus = (sel) => { const el = $('pan-prog').querySelector(sel); if (el) el.focus(); };
    const specs = () => [...(progDi(nome).specialita || [])].map(s => ({ ...s }));
    // Barre del formato: il pulsante non deve togliere il cursore dal campo, altrimenti la selezione si perde (anche su iOS)
    const nonRubareFocus = e => { if (e.target.closest('.rtbar')) e.preventDefault(); };
    pan.addEventListener('pointerdown', nonRubareFocus);
    pan.addEventListener('mousedown', nonRubareFocus);
    pan.addEventListener('click', e => {
        const b = e.target.closest('.rtbar button');
        if (!b) return;
        const ed = b.closest('.field').querySelector('.rt');
        if (document.activeElement !== ed) return; // serve il cursore dentro il campo
        document.execCommand('styleWithCSS', false, true);
        if (b.dataset.color) document.execCommand('foreColor', false, b.dataset.color);
        else document.execCommand(b.dataset.cmd, false, null);
        salvaEditor(ed);
    });
    // Salvataggio del testo formattato: all'uscita dal campo, o dopo una pausa nella scrittura
    let timer = null;
    const salvaEditor = (ed) => {
        clearTimeout(timer); flushRich = null;
        const k = ed.dataset.rt;
        let html = pulisci(ed.innerHTML);
        if (!ed.textContent.trim() && !ed.querySelector('li')) html = '';
        if (html === (progDi(nome)[k] || '')) return;
        if (ed.textContent.length > 3000) { alert('Testo troppo lungo (massimo 3000 caratteri): non salvato.'); return; }
        salvaProg(nome, { [k]: html });
    };
    pan.addEventListener('input', e => {
        const ed = e.target.closest('.rt');
        if (!ed) return;
        clearTimeout(timer);
        flushRich = () => salvaEditor(ed);
        timer = setTimeout(flushRich, 1200);
    });
    pan.addEventListener('focusout', e => { const ed = e.target.closest?.('.rt'); if (ed) salvaEditor(ed); });
    pan.addEventListener('paste', e => { // incolla sempre testo semplice: niente stili portati da altre pagine
        if (!e.target.closest?.('.rt')) return;
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    pan.addEventListener('click', async e => {
        const btn = e.target.closest('[data-salva]');
        if (!btn) return;
        const patch = {};
        pan.querySelectorAll('input[data-p]').forEach(i => { patch[i.dataset.p] = i.value.trim(); });
        for (const ed of pan.querySelectorAll('.rt')) {
            if (ed.textContent.length > 3000) { alert('Testo troppo lungo (massimo 3000 caratteri): non salvato.'); return; }
            patch[ed.dataset.rt] = !ed.textContent.trim() && !ed.querySelector('li') ? '' : pulisci(ed.innerHTML);
        }
        const arr = specs();
        pan.querySelectorAll('[data-spec-nome]').forEach(i => { if (arr[+i.dataset.specNome]) arr[+i.dataset.specNome].nome = i.value.trim(); });
        patch.specialita = arr;
        clearTimeout(timer); flushRich = null;
        btn.disabled = true;
        await salvaProg(nome, patch);
        btn.disabled = false;
    });
    pan.addEventListener('change', async e => {
        const t = e.target;
        if (t.dataset.p) return salvaProg(nome, { [t.dataset.p]: t.value.trim() });
        if (t.dataset.specNome !== undefined) {
            const arr = specs();
            arr[+t.dataset.specNome].nome = t.value.trim();
            await salvaProg(nome, { specialita: arr });
            render();
        }
    });
    pan.addEventListener('click', async e => {
        const b = e.target.closest('button');
        if (!b) return;
        const p = progDi(nome);
        if (b.dataset.pflag) {
            await salvaProg(nome, { [b.dataset.pflag]: !p[b.dataset.pflag] });
            render(); rifocus(`[data-pflag="${b.dataset.pflag}"]`);
        } else if (b.dataset.specAdd !== undefined) {
            const arr = specs(); arr.push({ nome: '', distintivo: false });
            (schedeData[nome] ??= {}).progressione = { ...p, specialita: arr }; // solo locale finché non ha un nome
            render(); rifocus(`[data-spec-nome="${arr.length - 1}"]`);
        } else if (b.dataset.specFlag !== undefined) {
            const arr = specs(); const i = +b.dataset.specFlag;
            arr[i].distintivo = !arr[i].distintivo;
            await salvaProg(nome, { specialita: arr });
            render(); rifocus(`[data-spec-flag="${i}"]`);
        } else if (b.dataset.specDel !== undefined) {
            const arr = specs(); const i = +b.dataset.specDel;
            if (arr[i].nome && !confirm(`Togliere la specialità "${arr[i].nome}"?`)) return;
            arr.splice(i, 1);
            await salvaProg(nome, { specialita: arr });
            render(); rifocus('[data-spec-add]');
        }
    });
}
