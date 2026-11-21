import {WORK_ORDER_STATUSES} from "./workOrderModel.mjs";
import {deriveWorkshopPlazaOccupancy, isActiveWorkOrder} from "./workshopPlazaModel.mjs";

// Resumen del panel de inicio del Taller (SPEC 037, entrega B). Solo lee OT y Plazas que ya existen: no define
// estados, documentos ni campos nuevos (la SPEC 016 marca el Taller como CONFIRMADO PENDIENTE). Puro: sin React,
// sin Firebase y sin reloj.

export const AWAITING_APPROVAL_STATUS = "esperando_aprobacion";
export const PENDING_DELIVERY_STATUS = "pendiente_entrega";
export const DEFAULT_RECENT_ORDERS_LIMIT = 5;

const KNOWN_STATUSES = new Set(WORK_ORDER_STATUSES.map(({value}) => value));

function text(value) {
  return String(value ?? "").trim();
}

function validOrders(orders) {
  return (Array.isArray(orders) ? orders : []).filter((order) => order && typeof order === "object");
}

// Las más nuevas primero: número de OT descendente con orden numérico ("OT-000010" antes que "OT-000009" y que
// "OT-000002"). A igual número, el id mantiene un orden estable.
function compareNewestFirst(left, right) {
  return text(right.numeroOT).localeCompare(text(left.numeroOT), "es-CL", {numeric: true})
    || text(right.otId).localeCompare(text(left.otId), "es-CL", {numeric: true});
}

// - `byStatus`: un renglón por cada estado conocido, en el orden del modelo y también los que están en cero.
// - `unknown`: OT sin estado o con un estado que el modelo no conoce. No se suman a ningún estado conocido.
// - `active`: OT abiertas (las mismas que ocupan una Plaza).
// - `awaitingApproval` y `pendingDelivery`: las OT de cada alerta, las más nuevas primero.
// - `recent`: las últimas `recentLimit` OT (todas las del negocio, sin filtrar por estado).
export function summarizeWorkOrders(orders, {recentLimit = DEFAULT_RECENT_ORDERS_LIMIT} = {}) {
  const list = validOrders(orders);
  const counts = new Map(WORK_ORDER_STATUSES.map(({value}) => [value, 0]));
  let unknown = 0;
  for (const order of list) {
    const status = text(order.estado);
    if (KNOWN_STATUSES.has(status)) counts.set(status, counts.get(status) + 1);
    else unknown += 1;
  }
  const newestFirst = [...list].sort(compareNewestFirst);
  const limit = Number.isInteger(recentLimit) && recentLimit >= 0 ? recentLimit : DEFAULT_RECENT_ORDERS_LIMIT;
  return {
    total: list.length,
    byStatus: WORK_ORDER_STATUSES.map(({value, label}) => ({value, label, count: counts.get(value)})),
    unknown,
    active: list.filter(isActiveWorkOrder).length,
    awaitingApproval: newestFirst.filter((order) => text(order.estado) === AWAITING_APPROVAL_STATUS),
    pendingDelivery: newestFirst.filter((order) => text(order.estado) === PENDING_DELIVERY_STATUS),
    recent: newestFirst.slice(0, limit),
  };
}

// Plazas: `active` son las Plazas activas; `occupied` las que tienen una OT abierta y `free` el resto de las
// activas. Una Plaza inactiva no cuenta como libre (no se puede asignar). `conflicts` son Plazas con más de una OT
// abierta (dato inconsistente que el panel solo informa). `items` trae cada Plaza con su OT abierta, en el orden recibido.
export function summarizeWorkshopPlazas(plazas, orders) {
  const list = (Array.isArray(plazas) ? plazas : []).filter((plaza) => plaza && typeof plaza === "object");
  const occupancy = deriveWorkshopPlazaOccupancy(list, validOrders(orders));
  const items = list.map((plaza) => {
    const entry = occupancy.get(text(plaza.plazaId));
    return {
      plaza,
      active: text(plaza.estado) === "activa",
      order: entry?.order || null,
      conflict: Boolean(entry?.conflict),
    };
  });
  const active = items.filter((item) => item.active);
  const occupied = active.filter((item) => item.order).length;
  return {
    total: items.length,
    active: active.length,
    inactive: items.length - active.length,
    occupied,
    free: active.length - occupied,
    conflicts: items.filter((item) => item.conflict).length,
    items,
  };
}
