import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { getClientFieldErrors } from "../src/domain/clientModel.mjs";
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
let ContactTerritoryFields;
try {
  ContactTerritoryFields = (await vite.ssrLoadModule("/src/components/contacts/ContactTerritoryFields.jsx")).default;
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

console.log("COUNTRY_FORM_COPY_SMOKE_OK");
