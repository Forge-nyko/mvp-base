import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";
import {buildNavigationSections, getRouteMeta} from "../src/app/navigation.js";
import {getPrimaryVerticalModules} from "../src/domain/categoryModules.mjs";
import {
  filterNavigationSections,
  getBusinessPathOptions,
  getDefaultBusinessPath,
} from "../src/domain/rbac.mjs";
import {WORK_ORDER_STATUSES} from "../src/domain/workOrderModel.mjs";
import {
  AWAITING_APPROVAL_STATUS,
  PENDING_DELIVERY_STATUS,
  summarizeWorkOrders,
  summarizeWorkshopPlazas,
} from "../src/domain/workOrderSummary.mjs";

// Panel de inicio del Taller (SPEC 037, entrega B): función pura, vista con sus estados de datos, navegación por rol
// y rutas. Sin emuladores. El panel solo lee OT, vehículos y Plazas que ya existen (SPEC 016: Taller pendiente).

const order = (numeroOT, estado, extra = {}) => ({otId: `id-${numeroOT}`, numeroOT, estado, vehiculoId: "v1", plazaId: "", ...extra});

// --- 1. Función pura: conteos por estado ---
const empty = summarizeWorkOrders([]);
assert.equal(empty.total, 0);
assert.equal(empty.unknown, 0);
assert.equal(empty.active, 0);
assert.deepEqual(empty.byStatus.map(({value}) => value), WORK_ORDER_STATUSES.map(({value}) => value), "un renglón por estado conocido, en el orden del modelo");
assert.ok(empty.byStatus.every(({count}) => count === 0), "vacío: todo en cero");
assert.deepEqual(empty.recent, []);
assert.deepEqual(empty.awaitingApproval, []);
assert.deepEqual(empty.pendingDelivery, []);
for (const input of [undefined, null, "texto", 7, {}, [null, undefined, 3, "x"]]) {
  const result = summarizeWorkOrders(input);
  assert.equal(result.total, 0, `entrada inválida: ${JSON.stringify(input)}`);
  assert.deepEqual(result.recent, []);
}
assert.deepEqual(summarizeWorkOrders([null, undefined, order("OT-000001", "cerrada")]).total, 1, "los elementos inválidos se ignoran");

const orders = [
  order("OT-000001", "ingresada"),
  order("OT-000002", "en_cola"),
  order("OT-000003", "esperando_aprobacion"),
  order("OT-000004", "esperando_aprobacion"),
  order("OT-000005", "pendiente_entrega"),
  order("OT-000006", "cerrada"),
  order("OT-000007", "cancelada"),
  order("OT-000008", "en_reparacion"),
  order("OT-000009", "estado_inventado"),
  order("OT-000010", ""),
  order("OT-000011", undefined),
];
const summary = summarizeWorkOrders(orders);
const count = (value) => summary.byStatus.find((item) => item.value === value).count;
assert.equal(summary.total, 11);
assert.equal(count("ingresada"), 1);
assert.equal(count("en_cola"), 1);
assert.equal(count("esperando_aprobacion"), 2);
assert.equal(count("pendiente_entrega"), 1);
assert.equal(count("cerrada"), 1);
assert.equal(count("cancelada"), 1);
assert.equal(count("en_reparacion"), 1);
assert.equal(count("en_diagnostico"), 0);
assert.equal(summary.unknown, 3, "estado desconocido, vacío o ausente: sin estado, sin sumarse a ninguno conocido");
assert.equal(summary.byStatus.reduce((sum, item) => sum + item.count, 0) + summary.unknown, summary.total, "los conteos suman el total");
assert.equal(summary.active, 6, "abiertas: ingresada, en cola, 2 esperando aprobación, pendiente de entrega y en reparación");
assert.equal(AWAITING_APPROVAL_STATUS, "esperando_aprobacion");
assert.equal(PENDING_DELIVERY_STATUS, "pendiente_entrega");
assert.deepEqual(summary.awaitingApproval.map((item) => item.numeroOT), ["OT-000004", "OT-000003"], "alerta de aprobación: las más nuevas primero");
assert.deepEqual(summary.pendingDelivery.map((item) => item.numeroOT), ["OT-000005"]);
// Las etiquetas son las del modelo.
assert.equal(summary.byStatus.find((item) => item.value === "esperando_aprobacion").label, "Esperando aprobación");

// --- Últimas OT: orden y límite ---
assert.deepEqual(summary.recent.map((item) => item.numeroOT), ["OT-000011", "OT-000010", "OT-000009", "OT-000008", "OT-000007"], "las 5 más nuevas, de mayor a menor número");
assert.deepEqual(summarizeWorkOrders(orders, {recentLimit: 2}).recent.map((item) => item.numeroOT), ["OT-000011", "OT-000010"]);
assert.deepEqual(summarizeWorkOrders(orders, {recentLimit: 0}).recent, []);
assert.equal(summarizeWorkOrders(orders, {recentLimit: -1}).recent.length, 5, "un límite inválido usa el de siempre");
assert.equal(summarizeWorkOrders(orders, {recentLimit: 99}).recent.length, 11, "un límite mayor trae todas");
// Orden numérico (OT-000100 antes que OT-000099) y estable con el mismo número.
const mixed = [order("OT-000099", "cerrada"), order("OT-000100", "cerrada"), order("OT-000002", "cerrada"), order("OT-000100", "en_cola", {otId: "z-otra"})];
assert.deepEqual(summarizeWorkOrders(mixed).recent.map((item) => `${item.numeroOT}:${item.otId}`), ["OT-000100:z-otra", "OT-000100:id-OT-000100", "OT-000099:id-OT-000099", "OT-000002:id-OT-000002"]);
// No modifica la lista recibida.
const original = [order("OT-000002", "en_cola"), order("OT-000001", "ingresada")];
const snapshot = JSON.stringify(original);
summarizeWorkOrders(original);
assert.equal(JSON.stringify(original), snapshot, "no muta la entrada");

// --- Plazas ---
const plazas = [
  {plazaId: "p1", nombre: "Plaza 1", estado: "activa"},
  {plazaId: "p2", nombre: "Plaza 2", estado: "activa"},
  {plazaId: "p3", nombre: "Plaza 3", estado: "inactiva"},
  {plazaId: "p4", nombre: "Plaza 4", estado: "activa"},
];
const plazaOrders = [
  order("OT-000001", "en_reparacion", {plazaId: "p1"}),
  order("OT-000002", "cerrada", {plazaId: "p2"}), // cerrada: no ocupa
  order("OT-000003", "en_cola", {plazaId: "p4"}),
  order("OT-000004", "ingresada", {plazaId: "p4"}), // segunda OT abierta en la misma Plaza: conflicto
  order("OT-000005", "ingresada", {plazaId: "no-existe"}), // Plaza que no existe: se ignora
];
const plazaSummary = summarizeWorkshopPlazas(plazas, plazaOrders);
assert.equal(plazaSummary.total, 4);
assert.equal(plazaSummary.active, 3);
assert.equal(plazaSummary.inactive, 1);
assert.equal(plazaSummary.occupied, 2, "p1 y p4");
assert.equal(plazaSummary.free, 1, "p2: activa y sin OT abierta; la inactiva no cuenta como libre");
assert.equal(plazaSummary.conflicts, 1);
assert.equal(plazaSummary.occupied + plazaSummary.free, plazaSummary.active);
assert.deepEqual(plazaSummary.items.map((item) => item.plaza.plazaId), ["p1", "p2", "p3", "p4"], "orden recibido");
assert.equal(plazaSummary.items[0].order.numeroOT, "OT-000001");
assert.equal(plazaSummary.items[1].order, null);
assert.deepEqual(summarizeWorkshopPlazas([], []), {total: 0, active: 0, inactive: 0, occupied: 0, free: 0, conflicts: 0, items: []});
assert.equal(summarizeWorkshopPlazas(undefined, undefined).total, 0);
assert.equal(summarizeWorkshopPlazas(plazas, undefined).free, 3, "sin OT: todas las activas libres");

// --- 2. Vista: estados de datos y permisos (render real, sin Firebase) ---
const vite = await createServer({appType: "custom", logLevel: "silent", server: {middlewareMode: true}});
let TallerHomeView;
let MemoryRouter;
try {
  TallerHomeView = (await vite.ssrLoadModule("/src/features/taller/TallerHomeView.jsx")).default;
  ({MemoryRouter} = await import("react-router-dom"));
} finally {
  await vite.close();
}
const view = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(TallerHomeView, props)));
const count1 = (markup, pattern) => (markup.match(pattern) || []).length;
const vehicles = [{vehiculoId: "v1", patente: "ABCD12", marca: "Toyota", modelo: "Yaris"}];
const fullData = {orders: [...orders, order("OT-000012", "en_reparacion", {plazaId: "p1"})], vehicles, plazas};

// Cargando: un solo role="status", sin datos, sin accesos y sin error.
const loadingMarkup = view({loading: true, canCreate: true, canManage: true});
assert.equal(count1(loadingMarkup, /role="status"/g), 1, "un solo role=status al cargar");
assert.equal(count1(loadingMarkup, /role="alert"/g), 0);
assert.doesNotMatch(loadingMarkup, /Nueva OT|Órdenes por estado|Plazas|aria-live/);
assert.match(loadingMarkup, /Cargando el panel del taller/);
// Cargando manda sobre un error o datos viejos.
assert.equal(count1(view({loading: true, error: "x", data: fullData}), /role="status"/g), 1);
assert.doesNotMatch(view({loading: true, error: "x", data: fullData}), /role="alert"/);

// Error: alerta con reintento; sin skeleton/estado de carga ni datos.
const errorMarkup = view({error: "No pudimos completar la operación con órdenes de trabajo.", canCreate: true});
assert.equal(count1(errorMarkup, /role="alert"/g), 1);
assert.equal(count1(errorMarkup, /role="status"/g), 0, "un error no deja un estado de carga colgado");
assert.match(errorMarkup, /Reintentar/);
assert.doesNotMatch(errorMarkup, /Órdenes por estado/);

// Vacío real (sin OT ni vehículos): mensaje y, solo con taller.create, los accesos; nunca skeleton.
const emptyData = {orders: [], vehicles: [], plazas: []};
const emptyCreate = view({data: emptyData, canCreate: true, canManage: true});
assert.match(emptyCreate, /Aún no hay actividad en el taller/);
assert.match(emptyCreate, /Nueva OT/);
assert.match(emptyCreate, /Nuevo vehículo/);
assert.equal(count1(emptyCreate, /role="status"/g), 0);
assert.doesNotMatch(emptyCreate, /Órdenes por estado/);
const emptyReadOnly = view({data: emptyData, canCreate: false, canManage: false});
assert.match(emptyReadOnly, /Todavía no hay vehículos ni órdenes de trabajo para consultar/);
assert.doesNotMatch(emptyReadOnly, /Nueva OT|Nuevo vehículo/);
// Con vehículos pero sin OT ya no es "vacío": hay datos que mostrar.
assert.doesNotMatch(view({data: {orders: [], vehicles, plazas: []}, canCreate: true}), /Aún no hay actividad en el taller/);

// Datos: conteos, alertas, últimas OT con enlace al detalle y estado de cada una.
const dataMarkup = view({data: fullData, canCreate: true, canManage: true});
assert.equal(count1(dataMarkup, /role="status"/g), 0);
assert.equal(count1(dataMarkup, /role="alert"/g), 0);
assert.match(dataMarkup, /Órdenes por estado/);
assert.match(dataMarkup, /12 órdenes en total · 7 abiertas/);
assert.match(dataMarkup, /<dt>Esperando aprobación<\/dt><dd>2<\/dd>/);
assert.match(dataMarkup, /<dt>En reparación<\/dt><dd>2<\/dd>/);
assert.match(dataMarkup, /<dt>Sin estado<\/dt><dd>3<\/dd>/);
assert.match(dataMarkup, /2 OT esperan la aprobación del cliente/);
assert.match(dataMarkup, /1 OT pendiente de entrega/);
assert.match(dataMarkup, /href="\/taller\/ordenes\/id-OT-000004"/);
assert.match(dataMarkup, /href="\/taller\/ordenes\/id-OT-000012"/, "las últimas OT enlazan al detalle");
assert.ok(dataMarkup.indexOf("OT-000012") < dataMarkup.indexOf("OT-000011"), "la más nueva va primero");
assert.match(dataMarkup, /ABCD12 · Toyota Yaris/);
assert.match(dataMarkup, /href="\/taller\/ordenes"/);
assert.match(dataMarkup, /Nueva OT/);
assert.match(dataMarkup, /Nuevo vehículo/);
// Sin alertas no hay bloque de alertas.
const calm = view({data: {orders: [order("OT-000001", "cerrada")], vehicles, plazas: []}, canCreate: false});
assert.doesNotMatch(calm, /Alertas del taller|esperan? la aprobación del cliente|OT pendientes? de entrega/);

// Permisos: sin taller.create no hay accesos de creación (los enlaces de lectura siguen).
const readOnly = view({data: fullData, canCreate: false, canManage: false});
assert.doesNotMatch(readOnly, /Nueva OT|Nuevo vehículo/);
assert.match(readOnly, /Órdenes por estado/);
// Plazas: solo con taller.manage (incluye el enlace para administrarlas y las ocupadas/libres).
assert.doesNotMatch(readOnly, /Plazas|Administrar/, "sin taller.manage no se dibuja el bloque de Plazas");
const managed = view({data: fullData, canCreate: false, canManage: true});
assert.match(managed, /Plazas/);
assert.match(managed, /1 en uso · 2 libres · 1 inactiva/);
assert.match(managed, /href="\/taller\/plazas"/);
assert.match(managed, /Plaza 1/);
assert.doesNotMatch(managed, /Nueva OT|Nuevo vehículo/, "manage no implica los accesos de creación");
assert.match(view({data: {...fullData, plazas: []}, canManage: true}), /Aún no hay Plazas registradas/);

// --- 3. Navegación por rol: "Inicio" es el primer ítem de la sección de Taller ---
const tallerBusiness = {rubroCodigo: "TALLER_AUTOMOTRIZ", modulosHabilitados: ["taller"]};
const tallerMenu = (role) => filterNavigationSections(
  buildNavigationSections(undefined, {primaryModules: getPrimaryVerticalModules(tallerBusiness)}),
  {role},
  getBusinessPathOptions(tallerBusiness)
).find((section) => section.moduleId === "taller");
const expectedByRole = {
  OWNER: ["/taller", "/taller/ordenes", "/taller/vehiculos", "/taller/plazas"],
  ADMIN: ["/taller", "/taller/ordenes", "/taller/vehiculos", "/taller/plazas"],
  TECNICO: ["/taller", "/taller/ordenes", "/taller/vehiculos"],
  MEMBER: ["/taller", "/taller/ordenes", "/taller/vehiculos"],
};
for (const [role, expected] of Object.entries(expectedByRole)) {
  const section = tallerMenu(role);
  assert.deepEqual(section.items.map((item) => item.to), expected, `${role}: ítems del Taller`);
  assert.equal(section.items[0].label, "Inicio", `${role}: Inicio va primero`);
  assert.equal(section.items[0].activeWhen("/taller"), true);
  assert.equal(section.items[0].activeWhen("/taller/"), true);
  assert.equal(section.items[0].activeWhen("/taller/ordenes"), false, "coincidencia exacta");
}
for (const role of ["VENTAS", "COMPRAS", "FINANZAS"]) {
  assert.equal(tallerMenu(role), undefined, `${role}: ninguna sección de Taller`);
}
// "Plazas" sigue exigiendo taller.manage; "Inicio" no pide nada más que taller.read.
const navSource = fs.readFileSync("src/app/navigation.js", "utf8");
assert.match(navSource, /\{path: "", label: "Inicio", title: "Inicio", icon: LayoutDashboard\}/);
assert.ok(navSource.indexOf('path: ""') < navSource.indexOf('path: "ordenes"'), "Inicio es el primer hijo");
assert.match(navSource, /requiredPermission: BUSINESS_PERMISSIONS\.TALLER_MANAGE/);
// El aterrizaje por defecto no cambia: ningún rol aterriza en /taller.
const landing = (role) => getDefaultBusinessPath({...tallerBusiness, role}, getBusinessPathOptions(tallerBusiness));
assert.deepEqual(
  Object.fromEntries(["OWNER", "ADMIN", "TECNICO", "VENTAS", "COMPRAS", "FINANZAS"].map((role) => [role, landing(role)])),
  {OWNER: "/reportes", ADMIN: "/reportes", TECNICO: "/trabajos", VENTAS: "/cotizaciones", COMPRAS: "/ordenes-compra", FINANZAS: "/reportes"}
);

// --- 4. Rutas y título de la barra superior ---
assert.equal(getRouteMeta("/taller").title, "Taller automotriz", "la ruta base muestra el módulo, como Veterinaria");
assert.equal(getRouteMeta("/taller/ordenes").title, "Órdenes de trabajo");
assert.equal(getRouteMeta("/taller/vehiculos").title, "Vehículos");
assert.equal(getRouteMeta("/taller/plazas").title, "Plazas");
const app = fs.readFileSync("src/app/App.jsx", "utf8");
assert.doesNotMatch(app, /path="\/taller" element=\{<Navigate/, "/taller ya no redirige a /taller/ordenes");
assert.match(app, /path="\/taller"\s+element=\{\s*<TallerHomePage[\s\S]*?role=\{activeBusiness\}/);
assert.match(app, /import TallerHomePage from "\.\.\/pages\/TallerHomePage";/);
for (const path of ["/taller/ordenes", "/taller/ordenes/nueva", "/taller/ordenes/:otId", "/taller/vehiculos", "/taller/vehiculos/nuevo", "/taller/plazas"]) {
  assert.ok(app.includes(`path="${path}"`), `${path} sigue registrada`);
}

// --- 5. La página solo usa servicios existentes y respeta el rol al consultar ---
const page = fs.readFileSync("src/pages/TallerHomePage.jsx", "utf8");
for (const service of ["listarOrdenesTrabajo", "listarVehiculos", "listarPlazasTaller"]) assert.ok(page.includes(service), service);
assert.ok(page.includes("canManage ? listarPlazasTaller(businessId) : Promise.resolve([])"), "sin taller.manage no se consultan las Plazas");
assert.doesNotMatch(page, /httpsCallable|crear|actualizar|eliminar/, "solo lectura: sin Functions ni escrituras");
assert.ok(page.includes("seq === loadSeqRef.current"), "una respuesta tardía se descarta");

// --- 6. Solo tokens en el CSS del panel ---
const css = fs.readFileSync("src/features/taller/taller.css", "utf8");
const homeCss = css.slice(css.indexOf("/* Panel de inicio del Taller"));
assert.ok(homeCss.includes(".taller-home__stats"));
assert.doesNotMatch(homeCss, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, "sin colores literales");
assert.doesNotMatch(homeCss, /--color-(brand|dark)-/, "sin colores de marca fija ni del sidebar");
assert.doesNotMatch(homeCss, /\d+(?:\.\d+)?(?:ms|s)\b(?!\))/, "sin duraciones literales");
assert.doesNotMatch(homeCss, /border-radius:\s*\d|box-shadow:\s*\d/, "sin radios ni sombras literales");

console.log("WORK_ORDER_SUMMARY_SMOKE_OK");
