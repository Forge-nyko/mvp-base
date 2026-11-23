import React from "react";
import {X} from "lucide-react";
import Button from "../../components/ui/Button";
import QuantityStepper from "../../components/ui/QuantityStepper";
import {useBusinessMoney} from "../../hooks/useBusinessFormat";

const typeLabel = (value) => ({producto: "Producto", servicio: "Servicio", actividad: "Actividad"})[value] || "Producto";

// Ítems de la compra (borrador). Misma apariencia de fila que el editor de Venta: ítem, cantidad con − y +, y total; la
// compra además edita costo unitario y descuento por línea. Los manejadores y los campos son los de siempre.
export default function PurchaseItemsEditor({
  disabled,
  items,
  onChange,
  onOpenCatalog,
  readOnly,
  referencesLocked = false,
  moneyStep = "any",
}) {
  const money = useBusinessMoney();
  const update = (index, field, value) => onChange(items.map((item, current) =>
    current === index ? {...item, [field]: value} : item
  ));
  const canChangeReferences = !disabled && !referencesLocked;
  const countLabel = items.length === 1 ? "1 ítem" : `${items.length} ítems`;

  return (
    <section className="ui-step-card purchase-items-card" aria-labelledby="purchase-items-title">
      <header className="ui-step-head">
        <div className="ui-step-head__text">
          <h2 id="purchase-items-title" className="ui-step-title">¿Qué compras?</h2>
          <p className="ui-step-head__count">{countLabel}</p>
        </div>
        {canChangeReferences && (
          <div className="ui-step-head__actions">
            <Button type="button" variant="secondary" onClick={onOpenCatalog}>Agregar desde inventario</Button>
          </div>
        )}
      </header>
      {!items.length ? (
        <div className="po-empty">Agrega productos, servicios o actividades.</div>
      ) : (
        <div className="purchase-lines">
          {items.map((item, index) => {
            const total = Number(item.cantidad || 0) * Number(item.costoUnitario || 0) *
              (1 - Number(item.descuentoPct || 0) / 100);
            const description = String(item.descripcion || "").trim();
            const showDescription = description && description.toLowerCase() !== String(item.nombre || "").trim().toLowerCase();
            return (
              <article className="purchase-line" key={item.lineaId}>
                <div className="purchase-line__row">
                  <div className="purchase-line__identity">
                    <strong className="purchase-line__name" title={item.nombre}>{item.nombre}</strong>
                    <small className="purchase-line__meta">{item.codigo || "Sin código"} · {typeLabel(item.tipoItem)}{item.unidad ? ` · ${item.unidad}` : ""}</small>
                  </div>
                  {readOnly ? (
                    <>
                      <span className="purchase-line__static purchase-line__static--qty"><span className="purchase-line__caption">Cantidad</span><span className="purchase-line__amount">{item.cantidad}</span></span>
                      <span className="purchase-line__static purchase-line__static--cost"><span className="purchase-line__caption">Costo unitario</span><span className="purchase-line__amount">{money(item.costoUnitario)}</span></span>
                      <span className="purchase-line__static purchase-line__static--discount"><span className="purchase-line__caption">Descuento</span><span className="purchase-line__amount">{item.descuentoPct}%</span></span>
                    </>
                  ) : (
                    <>
                      <div className="purchase-line__field purchase-line__field--qty">
                        <span className="purchase-line__caption" aria-hidden="true">Cantidad</span>
                        <QuantityStepper disabled={disabled} label={item.nombre} value={item.cantidad} onChange={(value) => update(index, "cantidad", value)} />
                      </div>
                      <label className="purchase-line__field purchase-line__field--cost">
                        <span className="purchase-line__caption" aria-hidden="true">Costo unitario</span>
                        <input className="purchase-line__input" aria-label={`Costo unitario de ${item.nombre}`} disabled={disabled} type="number" min="0" step={moneyStep} value={item.costoUnitario} onChange={(event) => update(index, "costoUnitario", event.target.value)} />
                      </label>
                      <label className="purchase-line__field purchase-line__field--discount">
                        <span className="purchase-line__caption" aria-hidden="true">Desc. %</span>
                        <input className="purchase-line__input" aria-label={`Descuento % de ${item.nombre}`} disabled={disabled} type="number" min="0" max="100" step="any" value={item.descuentoPct} onChange={(event) => update(index, "descuentoPct", event.target.value)} />
                      </label>
                    </>
                  )}
                  <strong className="purchase-line__total"><span className="purchase-line__caption">Total</span><span className="purchase-line__amount">{money(total)}</span></strong>
                  {canChangeReferences && !readOnly && (
                    <Button type="button" variant="ghost-danger" icon={X} className="purchase-line__remove" aria-label={`Quitar ${item.nombre}`} onClick={() => onChange(items.filter((_, current) => current !== index))} />
                  )}
                </div>
                {showDescription && <p className="purchase-line__description">{description}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
