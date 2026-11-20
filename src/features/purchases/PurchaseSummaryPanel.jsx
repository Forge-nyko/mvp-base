import React from "react";
import AmountRoundingNotice from "../../components/AmountRoundingNotice";
import Button from "../../components/ui/Button";
import {formatMoney} from "../../utils/formatters";
export default function PurchaseSummaryPanel({currency, disabled, isNew, locale, onCancel, onConfirm, onSave, processing, taxName = "IVA", taxRate = 19, totals}) {
  const money = (value) => formatMoney(value, currency, locale);
  const discounts = Number(totals.descuentoTotal || 0);
  return <aside className="po-panel po-summary"><header className="po-summary__header"><span className="po-kicker">Resumen</span><h2>Totales</h2></header><div className="po-summary__amounts"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>Descuentos</span><strong>{discounts > 0 ? `-${money(discounts)}` : money(0)}</strong></div><div><span>Neto</span><strong>{money(totals.neto)}</strong></div><div><span>{taxName} {taxRate}%</span><strong>{money(totals.iva)}</strong></div><div className="po-summary__total"><span>Total</span><strong>{money(totals.total)}</strong></div></div><AmountRoundingNotice currency={currency} />{!disabled && <div className="po-summary__actions"><button type="button" className="po-button po-button--primary" disabled={processing} onClick={isNew ? onSave : onConfirm}>{processing ? "Procesando..." : isNew ? "Preparar compra" : "Confirmar compra"}</button>{!isNew && <button type="button" className="po-button po-button--secondary" disabled={processing} onClick={onSave}>Guardar cambios</button>}{onCancel && <div className="po-summary__danger"><Button type="button" variant="ghost-danger" disabled={processing} onClick={onCancel}>Cancelar compra</Button></div>}</div>}</aside>;
}
