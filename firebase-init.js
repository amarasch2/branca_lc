firebase.initializeApp({
    apiKey: "AIzaSyCsuYkD8dd5Lg47x_vkUV0jQ6-1GGZsGcQ",
    authDomain: "tabella-pagamenti.firebaseapp.com",
    projectId: "tabella-pagamenti",
    storageBucket: "tabella-pagamenti.firebasestorage.app",
    messagingSenderId: "348674708908",
    appId: "1:348674708908:web:a4d477d3db2ca844681609"
});
const db = firebase.firestore();
const docPagamenti = db.collection('pagamenti').doc('tableData');
const docSchede    = db.collection('pagamenti').doc('schedeData');
const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
const elimina = () => firebase.firestore.FieldValue.delete();

// Salva solo le celle indicate (merge), mai l'intero documento: due persone non si sovrascrivono.
// cambi: [{ tipo: 'mensili'|'vdb', nome, mese, valore }]  (valore null = cancella la cella)
function salvaPagamenti(cambi) {
    const data = {};
    cambi.forEach(({ tipo, nome, mese, valore }) => {
        ((data[tipo] ??= {})[nome] ??= {})[mese] = valore === null ? elimina() : valore;
    });
    return docPagamenti.set({ data, lastUpdate: stamp() }, { merge: true });
}

// Somma al pagamento già presente (letto nella stessa transazione, quindi mai dati vecchi).
function aggiungiPagamento(nome, mese, cancelleria, vdb) {
    return db.runTransaction(async (tx) => {
        const d = (await tx.get(docPagamenti)).data()?.data || {};
        const nuovo = {
            mensili: round2((parseFloat(d.mensili?.[nome]?.[mese]) || 0) + cancelleria),
            vdb:     round2((parseFloat(d.vdb?.[nome]?.[mese]) || 0) + vdb)
        };
        tx.set(docPagamenti, {
            data: { mensili: { [nome]: { [mese]: nuovo.mensili } }, vdb: { [nome]: { [mese]: nuovo.vdb } } },
            lastUpdate: stamp()
        }, { merge: true });
        return nuovo;
    });
}

// Foto dei lupetti: un documento "foto_NOME" per ciascuno (JPEG quadrato piccolo in base64, ~20 KB).
const idFoto = (nome) => 'foto_' + nome;
async function caricaFoto() {
    const id = firebase.firestore.FieldPath.documentId();
    const q = await db.collection('pagamenti').where(id, '>=', 'foto_').where(id, '<', 'foto`').get(); // '`' viene subito dopo '_'
    return Object.fromEntries(q.docs.map(d => [d.id.slice(5), d.data().img]));
}
const salvaFoto = (nome, img) => db.collection('pagamenti').doc(idFoto(nome)).set({ img, lastUpdate: stamp() });
const eliminaFoto = (nome) => db.collection('pagamenti').doc(idFoto(nome)).delete();
