// Esegui con: node test.js
const assert = require('assert');
const { round2, eur, somma, rimanenza, LUPETTI } = require('./common.js');

assert.strictEqual(round2(0.1 + 0.2), 0.3);
assert.strictEqual(eur(12.5), '€12,50');
assert.strictEqual(somma({ Gennaio: '20', Febbraio: 10.1, Marzo: '' }), 30.1);
assert.strictEqual(somma(undefined), 0);
assert.strictEqual(rimanenza(155, 100) + rimanenza(30, 10), 75);
assert.strictEqual(rimanenza(30, 40), 0); // pagato più del dovuto: mai negativo
assert.strictEqual(new Set(LUPETTI.map(l => l.nome)).size, LUPETTI.length); // nomi unici (sono la chiave su Firebase)
console.log('OK');
