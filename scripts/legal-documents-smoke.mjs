import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {
  LEGAL_DOCUMENT_KEYS,
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_VERSION,
  isCurrentLegalVersion,
} from "../src/domain/legalDocuments.mjs";

const require = createRequire(import.meta.url);
const backend = require("../functions/legalDocuments.js");

assert.match(LEGAL_DOCUMENTS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(backend.LEGAL_DOCUMENTS_VERSION, LEGAL_DOCUMENTS_VERSION);
assert.deepEqual(backend.LEGAL_DOCUMENT_KEYS, LEGAL_DOCUMENT_KEYS);
assert.deepEqual(backend.LEGAL_DOCUMENTS, LEGAL_DOCUMENTS);
console.log("OK Legal: versión y metadatos idénticos entre src/ y functions/");

assert.deepEqual(Object.keys(LEGAL_DOCUMENTS).sort(), ["privacidad", "terminos"]);
assert.equal(LEGAL_DOCUMENTS.privacidad.path, "/privacidad");
assert.equal(LEGAL_DOCUMENTS.terminos.path, "/terminos");
for (const [key, document] of Object.entries(LEGAL_DOCUMENTS)) {
  assert.equal(document.key, key);
  assert.ok(document.title.length > 0);
}
assert.ok(Object.isFrozen(LEGAL_DOCUMENTS));
assert.ok(Object.isFrozen(LEGAL_DOCUMENT_KEYS));
console.log("OK Legal: dos documentos con clave, ruta pública y título");

for (const check of [isCurrentLegalVersion, backend.isCurrentLegalVersion]) {
  assert.equal(check(LEGAL_DOCUMENTS_VERSION), true);
  assert.equal(check("2000-01-01"), false);
  assert.equal(check(` ${LEGAL_DOCUMENTS_VERSION}`), false);
  for (const invalid of [undefined, null, "", 0, {}, [LEGAL_DOCUMENTS_VERSION]]) {
    assert.equal(check(invalid), false);
  }
}
console.log("OK Legal: solo la versión vigente exacta es válida");
