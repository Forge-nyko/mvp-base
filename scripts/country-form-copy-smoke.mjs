import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { getClientFieldErrors } from "../src/domain/clientModel.mjs";
import { buildPurchaseOrderPdfDocument } from "../src/domain/purchaseOrderDocument.mjs";
import { buildQuotePdfDocument } from "../src/domain/quoteDocument.mjs";
import { getCompanyDocumentSuggestions } from "../src/domain/companyDocumentSuggestions.mjs";
import { getClientFiscalCopy, getCountryFormCopy } from "../src/domain/countryFormCopy.mjs";
import { isValidFiscalIdentifier } from "../src/domain/fiscalIdentifier.mjs";

// Textos y ejemplos por país (Bolivia piloto): perfil de empresa, verificación y clientes. Salen de
// countryFormCopy.mjs, sin "si es Bolivia" en los componentes. Chile y el resto de los países no cambian.
const require = createRequire(import.meta.url);

// --- Chile: exactamente lo que se mostraba antes ---
const cl = getCountryFormCopy("CL");
assert.equal(cl.businessActivityLabel, "Giro");
assert.equal(cl.companyPhoneExample, "+56 9 1234 5678");
assert.equal(cl.companyEmailExample, "contacto@empresa.cl");
assert.equal(cl.companyWebsiteExample, "https://www.empresa.cl");
assert.equal(cl.companyPostalCodeExample, "Ej.: 1100000");
assert.equal(cl.clientPhoneExample, "Ej. +56 9 6123 4587");
assert.equal(cl.clientCompanyEmailExample, "Ej. contacto@empresa.cl");
assert.equal(cl.clientPersonEmailExample, "Ej. nombre@correo.cl");
for (const key of ["declaredFiscalIdExample", "requesterEmailExample", "requesterPhoneExample", "personFiscalLabel", "personFiscalExample"]) {
  assert.equal(cl[key], null, `Chile sin ${key}`);
}
assert.deepEqual(getClientFiscalCopy("CL", "persona"), { label: "RUT", placeholder: "Ej.: 12.345.678-5" });
assert.deepEqual(getClientFiscalCopy("CL", "empresa"), { label: "RUT", placeholder: "Ej.: 12.345.678-5" });

// --- Otros países: lo de siempre (solo el ejemplo de teléfono del cliente distinguía a Chile) ---
for (const code of ["MX", "PE", "PY", "OTHER", "ZZ"]) {
  const copy = getCountryFormCopy(code);
  assert.equal(copy.businessActivityLabel, "Giro", code);
  assert.equal(copy.clientPhoneExample, "Ej. +1 202 555 0100", code);
  assert.equal(copy.companyEmailExample, "contacto@empresa.cl", code);
  assert.equal(copy.companyPostalCodeExample, "Ej.: 1100000", code);
  assert.equal(copy.personFiscalLabel, null, code);
}

// --- Bolivia ---
const bo = getCountryFormCopy("BO");
assert.equal(bo.businessActivityLabel, "Actividad económica");
assert.equal(bo.companyPhoneExample, "+591 7xxxxxxx");
assert.equal(bo.companyEmailExample, "contacto@empresa.com.bo");
assert.equal(bo.companyWebsiteExample, "https://www.empresa.com.bo");
assert.equal(bo.companyPostalCodeExample, null, "sin ejemplo de código postal chileno");
assert.equal(bo.clientPhoneExample, "Ej. +591 7xxxxxxx");
assert.equal(bo.clientCompanyEmailExample, "Ej. contacto@empresa.com.bo");
assert.equal(bo.clientPersonEmailExample, "Ej. nombre@correo.com.bo");
assert.equal(bo.requesterPhoneExample, "+591 7xxxxxxx");
assert.equal(bo.requesterEmailExample, "nombre@empresa.com.bo");
assert.ok(bo.declaredFiscalIdExample);
for (const [key, value] of Object.entries(bo)) {
  if (typeof value === "string") assert.doesNotMatch(value, /\.cl\b|\+56|1100000/, `Bolivia sin ejemplos chilenos: ${key}`);
}
assert.ok(Object.isFrozen(bo));
// Cliente: Persona = "CI o NIT"; Empresa = NIT.
assert.deepEqual(getClientFiscalCopy("BO", "persona"), { label: "CI o NIT", placeholder: "Ej.: 1234567" });
assert.deepEqual(getClientFiscalCopy("BO", "empresa"), { label: "NIT", placeholder: "Ej.: 1234567" });
assert.equal(getClientFiscalCopy("BO", "PERSONA").label, "CI o NIT");

// --- Una CI numérica pasa la validación (cliente y servidor comparten la regla de Bolivia) ---
const serverFiscal = require("../functions/fiscalIdentifier.js");
for (const ci of ["1234567", "12345678", "1.234.567", "1 234 567", "9876543210"]) {
  assert.equal(isValidFiscalIdentifier("BO", ci), true, `CI ${ci} en el cliente`);
  assert.equal(serverFiscal.isValidFiscalIdentifier("BO", ci), true, `CI ${ci} en el servidor`);
}
assert.equal(isValidFiscalIdentifier("BO", "123"), false, "demasiado corta");
const clientBase = { nombreRazonSocial: "Ana Rojas", email: "", telefono: "", direccion: "", notas: "" };
assert.deepEqual(
  Object.keys(getClientFieldErrors({ ...clientBase, tipoCliente: "persona", rut: "1234567" }, "BO")),
  [],
  "una CI numérica no da error en un cliente Persona de Bolivia"
);
assert.equal(
  getClientFieldErrors({ ...clientBase, tipoCliente: "persona", rut: "" }, "BO").rut,
  "Ingresa el CI o NIT del cliente."
);
assert.equal(
  getClientFieldErrors({ ...clientBase, tipoCliente: "persona", rut: "12" }, "BO").rut,
  "Ingresa un CI o NIT válido."
);
assert.equal(
  getClientFieldErrors({ ...clientBase, tipoCliente: "empresa", rut: "12" }, "BO").rut,
  "Ingresa un NIT válido.",
  "Empresa se mantiene en NIT"
);
assert.equal(getClientFieldErrors({ ...clientBase, tipoCliente: "persona", rut: "1-9" }, "CL").rut, "Ingresa un RUT válido.", "Chile sigue con RUT");

// --- "Giro": solo cambia la etiqueta visible (la sugerencia de documentos usa la del país) ---
const suggestionLabel = (countryCode) =>
  getCompanyDocumentSuggestions({}, { canEdit: true, countryCode }).find((item) => item.id === "giro").label;
assert.equal(suggestionLabel("BO"), "Actividad económica");
assert.equal(suggestionLabel("CL"), "Giro");
assert.equal(getCompanyDocumentSuggestions({}, { canEdit: true }).find((item) => item.id === "giro").label, "Giro", "sin país: como antes");

// --- Render real de la región del cliente/proveedor (Bolivia: lista; Chile y otros: sin cambios) ---
const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let ContactTerritoryFields, QuotePrintView, PurchaseOrderPrintView, PurchasePrintView;
try {
  ContactTerritoryFields = (await vite.ssrLoadModule("/src/components/contacts/ContactTerritoryFields.jsx")).default;
  QuotePrintView = (await vite.ssrLoadModule("/src/features/quotes/QuotePrintView.jsx")).default;
  PurchaseOrderPrintView = (await vite.ssrLoadModule("/src/features/purchaseOrders/PurchaseOrderPrintView.jsx")).default;
  PurchasePrintView = (await vite.ssrLoadModule("/src/features/purchases/PurchasePrintView.jsx")).default;
} finally {
  await vite.close();
}
const Field = ({ children, label }) => React.createElement("div", { "data-field": label }, children);
const render = (countryCode, values = {}) =>
  renderToStaticMarkup(
    React.createElement(ContactTerritoryFields, {
      Field,
      countryCode,
      errors: {},
      onChange() {},
      saving: false,
      setFieldRef() {},
      values: { regionCodigo: "", regionNombre: "", comunaCodigo: "", comunaNombre: "", ...values },
    })
  );
const bolivia = render("BO", { regionCodigo: "SC", regionNombre: "Santa Cruz" });
assert.match(bolivia, /data-field="Departamento"><select/);
for (const name of ["La Paz", "Cochabamba", "Santa Cruz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando"]) {
  assert.ok(bolivia.includes(`>${name}</option>`), name);
}
assert.match(bolivia, /<option value="SC" selected="">Santa Cruz<\/option>/, "el departamento guardado queda elegido");
assert.match(bolivia, /data-field="Municipio"><input/, "el municipio sigue siendo texto libre");
assert.doesNotMatch(bolivia, /Metropolitana|texto anterior/);
// Texto libre anterior que no está en el catálogo: se conserva visible, sin perderlo.
const legacy = render("BO", { regionCodigo: "", regionNombre: "Santa Cruz de la Sierra" });
assert.match(legacy, /<option value="__texto_anterior__" selected="">Santa Cruz de la Sierra \(texto anterior\)<\/option>/);
// País con catálogo sin región elegida: "Sin especificar".
assert.match(render("BO"), /<option value="" selected="">Sin especificar<\/option>/);
// Chile: regiones y comunas como siempre. Otros países: texto libre como siempre.
const chile = render("CL", { regionCodigo: "13", regionNombre: "Metropolitana de Santiago" });
assert.match(chile, /data-field="Región"><select/);
assert.match(chile, /data-field="Comuna"><select/);
assert.ok(chile.includes(">Metropolitana de Santiago</option>"));
const mexico = render("MX");
assert.match(mexico, /data-field="Estado"><input/);
assert.match(mexico, /data-field="Municipio"><input/);
assert.doesNotMatch(mexico, /<select/);

// --- "Giro" en documentos: PDF y vistas de impresión de cotización, orden de compra y compra ---
// Solo cambia la etiqueta visible según el país del documento; el dato (`giro`) es el mismo.
const documentCompany = {
  nombreComercial: "Andes Servicios",
  razonSocial: "Andes Servicios SRL",
  identificadorFiscalTipo: "NIT",
  identificadorFiscalValor: "1023456789",
  giro: "Servicios técnicos",
};
// Las líneas de texto del PDF salen del flujo sin comprimir de jsPDF: cada texto va como `(texto) Tj`.
// Las tildes salen escapadas en octal, por eso se normalizan antes de comparar.
const pdfLines = (build) => {
  const content = build().doc.output();
  return [...content.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)]
    .map(([, text]) => text.replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))))
    .filter((line) => /Giro|Actividad econ/.test(line));
};
const quoteFor = (paisCodigo) => ({
  paisCodigo,
  empresaSnapshot: documentCompany,
  cliente: { nombre: "Cliente Prueba" },
  items: [{ descripcion: "Servicio", cantidad: 1, precioUnitario: 1000, tipo: "servicio" }],
});
const orderFor = (paisCodigo) => ({
  paisCodigo,
  empresaSnapshot: documentCompany,
  items: [{ descripcion: "Insumo", cantidad: 1, costoUnitario: 1000 }],
});
assert.deepEqual(pdfLines(() => buildQuotePdfDocument({ quote: quoteFor("BO") })), ["Actividad económica: Servicios técnicos"], "PDF de cotización, Bolivia");
assert.deepEqual(pdfLines(() => buildQuotePdfDocument({ quote: quoteFor("CL") })), ["Giro: Servicios técnicos"], "PDF de cotización, Chile");
assert.deepEqual(pdfLines(() => buildQuotePdfDocument({ quote: quoteFor("PY") })), ["Giro: Servicios técnicos"], "PDF de cotización, otro país");
assert.deepEqual(pdfLines(() => buildQuotePdfDocument({ quote: quoteFor(undefined) })), ["Giro: Servicios técnicos"], "PDF de cotización antigua sin país");
assert.deepEqual(pdfLines(() => buildPurchaseOrderPdfDocument({ order: orderFor("BO") })), ["NIT 1023456789 · Actividad económica: Servicios técnicos"], "PDF de orden de compra, Bolivia");
assert.deepEqual(pdfLines(() => buildPurchaseOrderPdfDocument({ order: orderFor("CL") })), ["NIT 1023456789 · Giro: Servicios técnicos"], "PDF de orden de compra, Chile");
assert.deepEqual(pdfLines(() => buildPurchaseOrderPdfDocument({ order: orderFor(undefined) })), ["NIT 1023456789 · Giro: Servicios técnicos"], "PDF de orden antigua sin país");
const html = (element) => renderToStaticMarkup(element);
const quoteBo = html(React.createElement(QuotePrintView, { quote: quoteFor("BO") }));
const quoteCl = html(React.createElement(QuotePrintView, { quote: quoteFor("CL") }));
assert.match(quoteBo, /<strong>Actividad económica: <\/strong>Servicios técnicos/);
assert.doesNotMatch(quoteBo, /Giro/);
assert.match(quoteCl, /<strong>Giro: <\/strong>Servicios técnicos/);
const orderBo = html(React.createElement(PurchaseOrderPrintView, { order: orderFor("BO") }));
const orderCl = html(React.createElement(PurchaseOrderPrintView, { order: orderFor("CL") }));
assert.match(orderBo, /<strong>Actividad económica: <\/strong>Servicios técnicos/);
assert.doesNotMatch(orderBo, /Giro/);
assert.match(orderCl, /<strong>Giro: <\/strong>Servicios técnicos/);
// Sin país en el documento (histórico) se usa el de la empresa actual.
assert.match(html(React.createElement(PurchaseOrderPrintView, { company: { paisCodigo: "BO" }, order: orderFor(undefined) })), /Actividad económica: /);
const purchaseFor = (paisCodigo) => ({ paisCodigo, empresaSnapshot: documentCompany, items: [], proveedorSnapshot: {} });
const purchaseBo = html(React.createElement(PurchasePrintView, { purchase: purchaseFor("BO") }));
const purchaseCl = html(React.createElement(PurchasePrintView, { purchase: purchaseFor("CL") }));
assert.match(purchaseBo, /<strong>Actividad económica: <\/strong>Servicios técnicos/);
assert.doesNotMatch(purchaseBo, /Giro/);
assert.match(purchaseCl, /<strong>Giro: <\/strong>Servicios técnicos/);

// --- Los componentes toman los textos del helper (sin literales de país) ---
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [clientForm, company, territoryFields] = await Promise.all([
  read("src/features/clients/ClientFormDialog.jsx"),
  read("src/features/company/CompanyConfig.jsx"),
  read("src/components/contacts/ContactTerritoryFields.jsx"),
]);
for (const [name, source] of [["ClientFormDialog", clientForm], ["CompanyConfig", company], ["ContactTerritoryFields", territoryFields]]) {
  assert.doesNotMatch(source.replace(/\/\/.*$/gm, ""), /Bolivia|===?\s*["']BO["']/, `${name}: sin "si es Bolivia" suelto`);
}
assert.ok(clientForm.includes("getClientFiscalCopy(country, values.tipoCliente)"));
assert.ok(clientForm.includes("label={countryCopy.businessActivityLabel}"));
assert.doesNotMatch(clientForm, /contacto@empresa\.cl|nombre@correo\.cl|\+56 9 6123 4587|\+1 202 555 0100/, "ejemplos del cliente salen del helper");
assert.doesNotMatch(company, /placeholder="\+56 9 1234 5678"|placeholder="contacto@empresa\.cl"|placeholder="https:\/\/www\.empresa\.cl"|placeholder="Ej\.: 1100000"/, "ejemplos del perfil salen del helper");
assert.doesNotMatch(company, /label="Giro"/);
assert.ok(company.includes("label={countryCopy.businessActivityLabel}"));
for (const expression of ["countryCopy.declaredFiscalIdExample", "countryCopy.requesterEmailExample", "countryCopy.requesterPhoneExample"]) {
  assert.ok(company.includes(expression), `verificación: ${expression}`);
}
assert.ok(territoryFields.includes("getContactRegionOptions(countryCode)"));

// "Giro": ningún documento, detalle ni formulario de proveedor lo escribe fijo; todos piden la etiqueta al helper.
const giroFiles = [
  "src/domain/quoteDocument.mjs",
  "src/domain/purchaseOrderDocument.mjs",
  "src/features/quotes/QuotePrintView.jsx",
  "src/features/purchaseOrders/PurchaseOrderPrintView.jsx",
  "src/features/purchases/PurchasePrintView.jsx",
  "src/features/purchases/PurchaseDetailView.jsx",
  "src/pages/NewPurchasePage.jsx",
  "src/features/providers/ProviderFormDialog.jsx",
];
for (const path of giroFiles) {
  const source = (await read(path)).replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /label="Giro"|["'`]Giro[:"'`]|\bGiro:/, `${path}: sin "Giro" fijo`);
  assert.doesNotMatch(source, /Bolivia|===?\s*["']BO["']/, `${path}: sin "si es Bolivia" suelto`);
  assert.ok(source.includes("getCountryFormCopy(") && source.includes("businessActivityLabel"), `${path}: usa el helper`);
}
// El campo interno no cambia: se sigue leyendo `giro` en documentos, detalles y proveedor.
for (const [path, needle] of [
  ["src/features/purchases/PurchaseDetailView.jsx", "provider.giro"],
  ["src/pages/NewPurchasePage.jsx", "provider.giro"],
  ["src/features/providers/ProviderFormDialog.jsx", 'field="giro"'],
  ["src/domain/quoteDocument.mjs", "company.giro"],
  ["src/domain/purchaseOrderDocument.mjs", "company.giro"],
]) {
  assert.ok((await read(path)).includes(needle), `${path}: conserva ${needle}`);
}

console.log("COUNTRY_FORM_COPY_SMOKE_OK");
