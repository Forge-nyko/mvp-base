import React, {useMemo, useState} from "react";
import ResponsiveDialog from "../../components/ui/ResponsiveDialog";
import {getSaleItemTypeLabel} from "../../domain/saleModel.mjs";
import {useBusinessMoney} from "../../hooks/useBusinessFormat";

const searchable = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function SaleCatalogDialog({items, onAdd, onClose, open}) {
  const money = useBusinessMoney();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  // Cantidad a agregar por ítem (texto del campo). Sin valor es 1; tras agregar vuelve a 1. Acepta los mismos
  // decimales que la cantidad de la línea (step="any"): la pantalla no distingue enteros y decimales por unidad.
  const [quantities, setQuantities] = useState({});
  const filtered = useMemo(() => items.filter((item) => item.estado === "activo" && (type === "todos" || item.tipoItem === type) && searchable(`${item.codigoInterno || item.sku} ${item.nombre}`).includes(searchable(search))).slice(0, 50), [items, search, type]);
  const quantityOf = (id) => quantities[id] ?? "1";
  const isValidQuantity = (id) => Number(quantityOf(id)) > 0 && Number.isFinite(Number(quantityOf(id)));
  const add = (item) => {
    if (!isValidQuantity(item.id)) return;
    onAdd(item, Number(quantityOf(item.id)));
    setQuantities((current) => ({...current, [item.id]: "1"}));
  };
  return <ResponsiveDialog open={open} onClose={onClose} title="Agregar desde inventario" description="Ítems activos del negocio. El precio puede ajustarse en la venta preparada." size="large"><div className="po-catalog"><div className="po-catalog__toolbar"><input aria-label="Buscar en inventario" placeholder="Buscar nombre o código" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={type} onChange={(event) => setType(event.target.value)}><option value="todos">Todos los tipos</option><option value="producto">Productos</option><option value="servicio">Servicios</option><option value="actividad">Actividades</option></select></div><div className="po-catalog__list">{filtered.map((item) => <article className="sale-catalog__row" key={item.id}><div><strong>{item.nombre}</strong><small>{item.codigoInterno || item.sku || "Sin código"} · {getSaleItemTypeLabel(item.tipoItem)}{item.tipoItem === "producto" ? ` · Stock disponible: ${Number(item.stock || 0)}` : ""}</small></div><span>{money(item.precioInterno)}</span><input aria-label={`Cantidad de ${item.nombre}`} type="number" min="0.000001" step="any" inputMode="decimal" value={quantityOf(item.id)} onChange={(event) => setQuantities((current) => ({...current, [item.id]: event.target.value}))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(item); } }} /><button type="button" className="po-button po-button--secondary" disabled={!isValidQuantity(item.id)} onClick={() => add(item)}>Agregar</button></article>)}{!filtered.length && <p>No hay ítems activos coincidentes.</p>}</div></div></ResponsiveDialog>;
}
