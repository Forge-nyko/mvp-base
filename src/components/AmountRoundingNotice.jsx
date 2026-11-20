import React from "react";
import { getAmountRoundingNote } from "../domain/amountRounding.mjs";
import Notice from "./ui/Notice";

// Aviso estático (existe al montar la pantalla, por eso `role={null}`) de que los montos de una
// moneda con decimales se redondean al entero. No muestra nada para CLP ni monedas sin decimales.
function AmountRoundingNotice({ currency }) {
  const note = getAmountRoundingNote(currency);
  if (!note) return null;
  return (
    <Notice variant="info" role={null} className="ui-amount-rounding-notice">
      {note}
    </Notice>
  );
}

export default AmountRoundingNotice;
