// Dati e funzioni condivise da tutte le pagine (nessuna dipendenza da Firebase: testabile con `node test.js`).
const MESI        = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno'];
const MAX_VDB     = 155;
const MAX_MENSILI = 30;
const SCADENZA    = '21/06/2026'; // data stampata nel PDF: aggiornare ogni anno

// I 6 documenti da consegnare (field = chiave su Firebase)
const CAMPI = [
    { field: 'schedaMedica',   label: 'Scheda Medica', sigla: 'Scheda med.' },
    { field: 'ecg',            label: 'ECG', sigla: 'ECG' },
    { field: 'cf',             label: 'CF', sigla: 'CF' },
    { field: 'autorizzazione', label: 'Autorizzazione', sigla: 'Autoriz.' },
    { field: 'librettoMedico', label: 'Libretto Medico', sigla: 'Libretto' },
    { field: 'iscrizione',     label: 'Iscrizione', sigla: 'Iscrizione' }
];

// Unico elenco dei lupetti: per aggiungerne uno basta una riga qui.
const LUPETTI = [
    { nome: "FRANCESCA BALDUCCI", genitore: "Angelica", telefono: "+393407398443" },
    { nome: "GAIA CORRADO", genitore: "ALICE", telefono: "+393478912001" },
    { nome: "CARLO DI FILIPPO", genitore: "Federica", telefono: "+393403983266" },
    { nome: "JACOPO DI LERNIA", genitore: "ELVIRA", telefono: "+393471077487" },
    { nome: "VINCENZO DI PERNA", genitore: "Cristina", telefono: "+393405001342" },
    { nome: "SARA LOPS", genitore: "KATIA", telefono: "+393451556933" },
    { nome: "CARLOTTA MANCINI", genitore: "Concetta", telefono: "+393475977747" },
    { nome: "INES MANNATRIZIO", genitore: "GIULIANA", telefono: "+393927505853" },
    { nome: "CLAUDIA MASTRAPASQUA", genitore: "TERESA", telefono: "+393493299068" },
    { nome: "FRANCESCA MERAFINA", genitore: "Carmela", telefono: "+393454528847" },
    { nome: "LARA PALUMBO", genitore: "Francesca", telefono: "+393420209330" },
    { nome: "TOMMASO PARISI", genitore: "Donata", telefono: "+393491206131" },
    { nome: "SIMONA PELLEGRINO", genitore: "Marianna", telefono: "+393498757207" },
    { nome: "VITO PETRIZZELLI", genitore: "Valentina", telefono: "+393476603088" },
    { nome: "LUCA SCARINGELLA", genitore: "MARIKA", telefono: "+393888283298" },
    { nome: "JACOPO SERAFINO", genitore: "Antonia", telefono: "+393494258858" },
    { nome: "ALICE VANIA", genitore: "Anna", telefono: "+393402359716" },
    { nome: "GAIA VINGI", genitore: "CINZIA", telefono: "+393478729833" }
];

const round2 = (n) => Math.round(n * 100) / 100;
const eur    = (n) => `€${round2(n).toFixed(2).replace('.', ',')}`;
const somma  = (pagamenti) => round2(Object.values(pagamenti || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0));
const rimanenza = (max, pagato) => Math.max(0, round2(max - pagato));

if (typeof module !== 'undefined') module.exports = { round2, eur, somma, rimanenza, LUPETTI, MESI };
