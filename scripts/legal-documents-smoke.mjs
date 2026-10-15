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

// Etapa 3: textos y páginas públicas (aserciones estáticas).
const {readFile} = await import("node:fs/promises");
const {
  LEGAL_DOCUMENTS_CONTENT,
  LEGAL_NOTICE,
  LEGAL_PROVIDER,
} = await import("../src/domain/legalDocumentsContent.mjs");

const [appSource, pageSource, cssSource] = await Promise.all([
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/legal/LegalDocumentPage.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/legal/legal-page.css", import.meta.url), "utf8"),
]);

function documentText(documentKey) {
  return LEGAL_DOCUMENTS_CONTENT[documentKey].sections
    .flatMap((section) => section.blocks)
    .flatMap((block) =>
      block.type === "list" ?
        block.items.map((item) => `${item.label || ""} ${item.text}`) :
        [block.text]
    )
    .join("\n");
}

assert.equal(
  LEGAL_NOTICE,
  "Versión inicial. Este texto está pendiente de revisión legal por parte de Bagner."
);
assert.deepEqual(Object.keys(LEGAL_DOCUMENTS_CONTENT).sort(), Object.keys(LEGAL_DOCUMENTS).sort());
for (const documentKey of Object.keys(LEGAL_DOCUMENTS)) {
  const {sections} = LEGAL_DOCUMENTS_CONTENT[documentKey];
  assert.equal(sections.length, 12, `${documentKey}: 12 secciones`);
  sections.forEach((section, index) => {
    assert.match(section.title, new RegExp(`^${index + 1}\\. \\S`));
    assert.ok(section.blocks.length > 0);
    for (const block of section.blocks) {
      assert.ok(["paragraph", "list"].includes(block.type));
      if (block.type === "paragraph") assert.ok(block.text.trim().length > 0);
      else assert.ok(block.items.length > 0 && block.items.every((item) => item.text.trim()));
    }
  });
  assert.ok(Object.isFrozen(LEGAL_DOCUMENTS_CONTENT[documentKey]));
  assert.doesNotMatch(documentText(documentKey), /\\|\*\*|`|undefined|\[object/);
}
console.log("OK Legal: cada documento tiene 12 secciones con contenido");

assert.deepEqual(LEGAL_PROVIDER, {
  razonSocial: "[RAZON_SOCIAL_BAGNER]",
  rut: "[RUT_BAGNER]",
  domicilio: "[DOMICILIO_BAGNER]",
  correoPrivacidad: "[CORREO_PRIVACIDAD]",
  sitio: "https://valoracloud.bagner.cl",
});
const privacyText = documentText("privacidad");
const termsText = documentText("terminos");
for (const marker of [
  LEGAL_PROVIDER.razonSocial,
  LEGAL_PROVIDER.rut,
  LEGAL_PROVIDER.domicilio,
  LEGAL_PROVIDER.correoPrivacidad,
]) {
  assert.ok(privacyText.includes(marker), `privacidad usa ${marker}`);
}
for (const marker of [
  LEGAL_PROVIDER.razonSocial,
  LEGAL_PROVIDER.rut,
  LEGAL_PROVIDER.correoPrivacidad,
]) {
  assert.ok(termsText.includes(marker), `términos usa ${marker}`);
}
assert.equal(privacyText.match(/\[CONFIRMAR/g).length, 4);
assert.equal(termsText.match(/\[A DEFINIR/g).length, 4);
assert.equal(termsText.includes("[CONFIRMAR"), false);
console.log("OK Legal: marcadores del proveedor, [CONFIRMAR] y [A DEFINIR] conservados");

const publicBlockStart = appSource.indexOf("/^\\/propuesta\\/");
const legalRoutesBlock = appSource.indexOf("(privacidad|terminos)");
const loadingGate = appSource.indexOf("if (loading) return <LoadingScreen />;");
assert.ok(publicBlockStart > -1 && legalRoutesBlock > publicBlockStart);
assert.ok(loadingGate > legalRoutesBlock, "rutas legales antes de loading");
for (const document of Object.values(LEGAL_DOCUMENTS)) {
  const routeIndex = appSource.indexOf(`path="${document.path}"`);
  assert.ok(routeIndex > legalRoutesBlock && routeIndex < loadingGate, document.path);
  assert.ok(appSource.includes(`documentKey="${document.key}"`));
}
console.log("OK Legal: /privacidad y /terminos en el bloque superior de App.jsx");

assert.ok(pageSource.includes("LEGAL_NOTICE"));
assert.match(pageSource, /<BrandLogo\b/);
assert.match(pageSource, /<SkipLink\b/);
assert.match(pageSource, /<Button variant="ghost"/);
assert.doesNotMatch(cssSource, /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/);
assert.doesNotMatch(cssSource, /(?:border-radius|box-shadow|transition|animation)\s*:[^;]*\d(?:px|ms|s)\b/);
console.log("OK Legal: página con aviso, logo, SkipLink y volver; CSS sin literales");
