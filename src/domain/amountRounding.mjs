import { getCurrencyByCode } from "./businessCatalog.js";

// SPEC 035: el dinero se guarda entero. En una moneda con decimales (por ejemplo, BOB) los montos
// se redondean al entero; este texto se lo avisa a quien opera. Una moneda sin decimales (CLP,
// PYG) o desconocida no lleva aviso.
export function currencyHasDecimals(currencyCode) {
  const decimals = getCurrencyByCode(String(currencyCode || "").toUpperCase())?.decimals;
  return Number.isInteger(decimals) && decimals > 0;
}

export function getAmountRoundingNote(currencyCode) {
  if (!currencyHasDecimals(currencyCode)) return "";
  const symbol = getCurrencyByCode(String(currencyCode).toUpperCase()).symbol;
  return `Los montos en ${symbol} se redondean al entero (por ejemplo, ${symbol} 10,50 se guarda como ${symbol} 11).`;
}
