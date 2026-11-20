import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { currencyHasDecimals, getAmountRoundingNote } from "../src/domain/amountRounding.mjs";
import { buildQuoteEmailPreview } from "../src/domain/quoteEmailTemplate.mjs";
import { formatBusinessMoney } from "../src/utils/formatters.js";

// Moneda en textos (acta 7.6.1, opción (a)): los textos que muestran montos usan la moneda de la
// empresa. Esta prueba congela las fórmulas ANTERIORES (fijas en CLP / es-CL) y exige que con CLP el
// resultado sea idéntico, y que con BOB el texto use Bs y no el formato chileno.
const require = createRequire(import.meta.url);
const { formatMoneyText } = require("../functions/localization.js");

// --- Fórmulas anteriores, copiadas tal cual (no tocar: son la referencia de "CLP no cambia") ---
const oldServerFormat = (value) =>
  Number(value || 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  });
const oldEditorMoney = (value) => `$${Math.round(Number(value || 0)).toLocaleString("es-CL")}`;
const oldCatalogMoney = (value) => `$${Number(value || 0).toLocaleString("es-CL")}`;
const oldApprovalAmount = (value, currency) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(value);
const oldPriceLabel = (value, currency) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: currency || "CLP", maximumFractionDigits: 0 }).format(value);

const clpValues = [0, 1, 9, 10, 99, 100, 999, 1000, 1234, 12345, 123456, 1190000, 99999999, null, undefined, "", "5000"];

for (const value of clpValues) {
  // Servidor: correo de cotización.
  assert.equal(formatMoneyText(value, "CLP", "es-CL"), oldServerFormat(value), `servidor CLP ${value}`);
  assert.equal(formatMoneyText(value), oldServerFormat(value), `servidor sin moneda ni locale ${value}`);
  assert.equal(formatMoneyText(value, "", ""), oldServerFormat(value), `servidor con textos vacíos ${value}`);
  // Frontend: editores, catálogos y paneles de Taller.
  assert.equal(formatBusinessMoney(value, "CLP", "es-CL"), oldEditorMoney(value), `editor CLP ${value}`);
  assert.equal(formatBusinessMoney(value, "CLP", "es-CL"), oldCatalogMoney(value), `catálogo CLP ${value}`);
  assert.equal(formatBusinessMoney(Number(value || 0), "CLP", "es-CL"), oldApprovalAmount(Number(value || 0), "CLP"), `aprobación CLP ${value}`);
  assert.equal(formatBusinessMoney(Number(value || 0), "CLP", "es-CL"), oldPriceLabel(Number(value || 0), "CLP"), `precio Taller CLP ${value}`);
}
// Redondeo del editor anterior (Math.round) con decimales positivos.
for (const value of [0.4, 0.5, 1.5, 1234.4, 1234.5, 1234.6]) {
  assert.equal(formatBusinessMoney(value, "CLP", "es-CL"), oldEditorMoney(value), `redondeo CLP ${value}`);
}

// --- Bolivia: moneda de la empresa (BOB, es-BO), enteros, sin ",00" y sin símbolo chileno ---
const bob = formatMoneyText(11, "BOB", "es-BO");
assert.match(bob, /^Bs\s?11$/);
assert.match(formatMoneyText(1234567, "BOB", "es-BO"), /^Bs\s?1\.234\.567$/);
assert.notEqual(bob, oldServerFormat(11));
assert.equal(formatBusinessMoney(11, "BOB", "es-BO"), bob, "el correo del servidor y la pantalla muestran el mismo monto");
assert.equal(formatBusinessMoney(1234567, "BOB", "es-BO"), formatMoneyText(1234567, "BOB", "es-BO"));
for (const text of [bob, formatBusinessMoney(11, "BOB", "es-BO")]) {
  assert.doesNotMatch(text, /CLP|,00/);
}
// Moneda desconocida o código inválido: cae en CLP/es-CL, como antes.
assert.equal(formatMoneyText(5000, "no", "zz_ZZ"), formatMoneyText(5000, "no", "es-CL"));

// --- Vista previa del correo (frontend) con la moneda de la cotización ---
const previewFor = (quote) =>
  buildQuoteEmailPreview({
    quote,
    companyProfile: { nombreComercial: "Taller Andino", email: "taller@example.com" },
    quoteNumber: "COT-1",
    emailCliente: "cliente@example.com",
    asunto: "Cotización",
    mensaje: "Hola",
    formatMoney: formatBusinessMoney,
    formatDate: (value) => String(value),
  }).summary.total;
assert.equal(previewFor({ total: 1190000 }), oldServerFormat(1190000), "cotización sin moneda: CLP como siempre");
assert.equal(previewFor({ total: 1190000, moneda: "CLP", locale: "es-CL" }), oldServerFormat(1190000));
assert.equal(previewFor({ total: 11, moneda: "BOB", locale: "es-BO" }), formatMoneyText(11, "BOB", "es-BO"), "la vista previa coincide con el correo real");

// --- Fuentes: no queda el formato fijo en los textos que muestran montos ---
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const indexSource = await read("functions/index.js");
assert.doesNotMatch(indexSource, /formatCurrencyClp/);
assert.match(indexSource, /formatMoneyText\(quote\.total, quote\.moneda, quote\.locale\)/);
for (const path of [
  "src/features/sales/SaleItemsEditor.jsx",
  "src/features/sales/SaleCatalogDialog.jsx",
  "src/features/purchases/PurchaseItemsEditor.jsx",
  "src/features/purchases/PurchaseCatalogDialog.jsx",
  "src/features/purchaseOrders/PurchaseOrderItemsEditor.jsx",
  "src/features/purchaseOrders/PurchaseOrderCatalogDialog.jsx",
  "src/pages/PurchaseOrdersPage.jsx",
]) {
  const source = await read(path);
  assert.doesNotMatch(source, /\$\$\{Math\.round\(Number\(value \|\| 0\)\)\.toLocaleString\("es-CL"\)\}/, `${path}: sin "$" fijo`);
  assert.doesNotMatch(source, /<span>\$\{Number\(item\.costoBase/, `${path}: sin "$" fijo en el catálogo`);
  assert.match(source, /useBusinessMoney\(\)/, `${path}: usa la moneda de la empresa`);
}
for (const path of ["src/features/workOrders/ApprovalPanel.jsx", "src/features/workOrders/ServicePlanningPanel.jsx"]) {
  const source = await read(path);
  assert.doesNotMatch(source, /new Intl\.NumberFormat\("es-CL"/, `${path}: sin es-CL fijo`);
  assert.match(source, /formatBusinessMoney/, `${path}: usa el formato de la empresa`);
}
const financeDialog = await read("src/components/finance/FinancialMovementDialog.jsx");
assert.doesNotMatch(financeDialog, /Monto CLP/);
assert.match(financeDialog, /Monto \{currency\}/);

// --- Aviso de redondeo al entero: solo para monedas con decimales ---
assert.equal(currencyHasDecimals("BOB"), true);
assert.equal(currencyHasDecimals("bob"), true);
for (const code of ["CLP", "PYG", "", null, undefined, "XXX"]) {
  assert.equal(currencyHasDecimals(code), false, `sin decimales o desconocida: ${code}`);
  assert.equal(getAmountRoundingNote(code), "", `sin aviso para ${code}`);
}
assert.equal(
  getAmountRoundingNote("BOB"),
  "Los montos en Bs se redondean al entero (por ejemplo, Bs 10,50 se guarda como Bs 11)."
);
const noticeSource = await read("src/components/AmountRoundingNotice.jsx");
assert.ok(noticeSource.includes("if (!note) return null;"), "sin nota no dibuja nada");
for (const [path, currencyProp] of [
  ["src/features/sales/SaleSummaryPanel.jsx", "currency={currency}"],
  ["src/features/quotes/QuoteSummaryPanel.jsx", "currency={currency}"],
  ["src/features/purchases/PurchaseSummaryPanel.jsx", "currency={currency}"],
]) {
  const source = await read(path);
  assert.ok(source.includes('import AmountRoundingNotice from "../../components/AmountRoundingNotice";'), `${path}: importa el aviso`);
  assert.ok(source.includes(`<AmountRoundingNotice ${currencyProp} />`), `${path}: muestra el aviso con la moneda del documento`);
}
const quickFields = await read("src/components/QuickBusinessFields.jsx");
assert.ok(quickFields.includes("getAmountRoundingNote(") && quickFields.includes("getCountryByCode(values.paisCodigo)?.defaultCurrencyCode"), "el alta de empresa avisa bajo el país");

console.log("CURRENCY_TEXT_SMOKE_OK", JSON.stringify({ clpValues: clpValues.length, bob }));
