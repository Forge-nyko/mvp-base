import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {
  ASSIGNABLE_BUSINESS_ROLES,
  BUSINESS_PERMISSIONS,
  BUSINESS_MODULES,
  BUSINESS_ROLES,
  canAccessBusinessPath,
  getDefaultBusinessPath,
  hasBusinessPermission,
} from "../src/domain/rbac.mjs";

const require = createRequire(import.meta.url);
const backendRbac = require("../functions/rbac.js");
const {crearVentaHandler} = require("../functions/salePersistence.js");
const {crearCompraHandler} = require("../functions/purchasePersistence.js");
const {obtenerBalanceTrabajoHandler} = require("../functions/workBalance.js");

assert.deepEqual(ASSIGNABLE_BUSINESS_ROLES, ["ADMIN", "VENTAS", "COMPRAS", "TECNICO", "FINANZAS", "MEMBER"]);
assert.ok(BUSINESS_ROLES.includes("MEMBER"));
assert.ok(ASSIGNABLE_BUSINESS_ROLES.includes("MEMBER"));
assert.ok(!BUSINESS_ROLES.includes("PLATFORM_SUPERADMIN"));
assert.deepEqual(backendRbac.BUSINESS_ROLES, BUSINESS_ROLES);
console.log("OK RBAC: perfiles predefinidos compatibles y Colaborador asignable");

const P = BUSINESS_PERMISSIONS;
assert.equal(hasBusinessPermission("VENTAS", P.SALES_WRITE), true);
assert.equal(hasBusinessPermission("VENTAS", P.PURCHASES_READ), false);
assert.equal(hasBusinessPermission("COMPRAS", P.PURCHASES_WRITE), true);
assert.equal(hasBusinessPermission("COMPRAS", P.SALES_READ), false);
assert.equal(hasBusinessPermission("TECNICO", P.WORKS_OPERATE), true);
assert.equal(hasBusinessPermission("TECNICO", P.PROFITABILITY_READ), false);
// Decisión de Bruno: el técnico ve costos de inventario, y nada más que eso.
assert.equal(hasBusinessPermission("TECNICO", P.INVENTORY_COSTS_READ), true);
for (const permission of [P.INVENTORY_WRITE, P.PURCHASES_READ, P.PURCHASES_WRITE, P.SALES_READ, P.FINANCE_READ, P.REPORTS_READ, P.PRICING_READ]) {
  assert.equal(hasBusinessPermission("TECNICO", permission), false, `TECNICO no debe tener ${permission}`);
}
assert.equal(hasBusinessPermission("VENTAS", P.INVENTORY_COSTS_READ), false, "VENTAS sigue sin costos de inventario");
assert.equal(canAccessBusinessPath("TECNICO", "/inventario"), true);
assert.equal(canAccessBusinessPath("TECNICO", "/compras"), false);
assert.equal(canAccessBusinessPath("TECNICO", "/ordenes-compra"), false);
assert.equal(canAccessBusinessPath("TECNICO", "/ventas"), false);
// Un perfil por módulos no hereda el permiso del rol.
assert.equal(hasBusinessPermission({role: "TECNICO", profileId: "p", modules: ["inventario"]}, P.INVENTORY_COSTS_READ), false);
// El historial de adquisiciones de la ficha de Inventario sigue la regla de
// adquisicionesInventario: la lista de roles se lee de firestore.rules y debe
// coincidir con quienes tienen PURCHASES_READ, que es lo que usa la interfaz.
const rulesSource = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const acquisitionRead = rulesSource.match(/match \/adquisicionesInventario\/\{adquisicionId\} \{\s*allow read: if hasBusinessModuleAccess\(businessId, \[([^\]]*)\]/);
assert.ok(acquisitionRead, "no se encontró la regla de lectura de adquisicionesInventario");
const acquisitionRoles = [...acquisitionRead[1].matchAll(/"([A-Z]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(BUSINESS_ROLES.filter((role) => hasBusinessPermission(role, P.PURCHASES_READ)).sort(), acquisitionRoles);
assert.equal(acquisitionRoles.includes("TECNICO"), false);
const inventorySource = readFileSync(new URL("../src/features/inventory/InventoryManager.jsx", import.meta.url), "utf8");
assert.match(inventorySource, /const canReadAcquisitions = canReadCosts && hasBusinessPermission\(role, BUSINESS_PERMISSIONS\.PURCHASES_READ\)/);
assert.match(inventorySource, /if \(!businessId \|\| !canReadAcquisitions \|\|/, "sin permiso no se consulta adquisiciones");
assert.match(inventorySource, /showCosts=\{canReadCosts\} showAcquisitions=\{canReadAcquisitions\}/);
assert.match(inventorySource, /\{showAcquisitions && adapted\.tipoItem === "producto" && <AcquisitionHistory/);
assert.match(inventorySource, /\{showCosts && <Detail label="Costo promedio neto"/, "el técnico sigue viendo los costos de la ficha");
assert.equal(/\{showCosts && adapted\.tipoItem === "producto" && <AcquisitionHistory/.test(inventorySource), false);
assert.equal(hasBusinessPermission("TECNICO", P.INVENTORY_COSTS_READ) && !hasBusinessPermission("TECNICO", P.PURCHASES_READ), true, "TECNICO ve costos pero no el historial");
assert.equal(hasBusinessPermission("FINANZAS", P.PROFITABILITY_READ), true);
assert.equal(hasBusinessPermission("FINANZAS", P.COMPANY_WRITE), false);
assert.equal(hasBusinessPermission("MEMBER", P.CLIENTS_READ), true);
assert.equal(hasBusinessPermission("MEMBER", P.CLIENTS_WRITE), false);
console.log("OK RBAC: matriz mínima por dominio y compatibilidad MEMBER");

assert.equal(canAccessBusinessPath("VENTAS", "/ventas/nueva"), true);
assert.equal(canAccessBusinessPath("VENTAS", "/compras"), false);
assert.equal(canAccessBusinessPath("COMPRAS", "/ordenes-compra/nueva"), true);
assert.equal(canAccessBusinessPath("COMPRAS", "/ventas"), false);
assert.equal(canAccessBusinessPath("TECNICO", "/trabajos"), true);
assert.equal(canAccessBusinessPath("TECNICO", "/reportes"), false);
assert.equal(canAccessBusinessPath("FINANZAS", "/reportes"), true);
assert.equal(canAccessBusinessPath("FINANZAS", "/empresa"), false);
assert.equal(getDefaultBusinessPath("OWNER"), "/reportes");
assert.equal(getDefaultBusinessPath("ADMIN"), "/reportes");
assert.equal(getDefaultBusinessPath("FINANZAS"), "/reportes");
assert.equal(getDefaultBusinessPath("VENTAS"), "/cotizaciones");
assert.equal(getDefaultBusinessPath("COMPRAS"), "/ordenes-compra");
assert.equal(getDefaultBusinessPath("TECNICO"), "/trabajos");
assert.equal(getDefaultBusinessPath("MEMBER"), "/cotizaciones");
for (const role of BUSINESS_ROLES) {
  assert.equal(canAccessBusinessPath(role, getDefaultBusinessPath(role)), true);
}
console.log("OK RBAC: rutas y redirecciones seguras por rol");

const customAccess = {role: "MEMBER", profileId: "profile-1", modules: ["clientes", "ventas"]};
assert.deepEqual(BUSINESS_MODULES.slice(0, 3), ["reportes", "trabajos", "inventario"]);
assert.equal(canAccessBusinessPath(customAccess, "/clientes"), true);
assert.equal(canAccessBusinessPath(customAccess, "/ventas/venta-1"), true);
assert.equal(canAccessBusinessPath(customAccess, "/cotizaciones"), false);
assert.equal(canAccessBusinessPath(customAccess, "/cuenta"), true);
assert.equal(hasBusinessPermission(customAccess, P.CLIENTS_READ), true);
assert.equal(hasBusinessPermission(customAccess, P.CLIENTS_WRITE), false);
assert.equal(getDefaultBusinessPath(customAccess), "/clientes");
assert.equal(getDefaultBusinessPath({role: "MEMBER", profileId: "empty", modules: []}), "/cuenta");
console.log("OK RBAC: perfil personalizado limita módulos y resuelve landing determinista");

function rejectingDependencies(role) {
  return {
    db: {},
    HttpsError: class HttpsError extends Error {},
    requireBusinessAccess: async (_request, _dependencies, {roles = []} = {}) => {
      if (!roles.includes(role)) {
        const error = new Error("denied");
        error.code = "permission-denied";
        throw error;
      }
      throw new Error("La prueba esperaba rechazo antes de validar payload.");
    },
  };
}

await assert.rejects(
  crearCompraHandler({data: {businessId: "business"}}, rejectingDependencies("VENTAS")),
  (error) => error.code === "permission-denied"
);
await assert.rejects(
  crearVentaHandler({data: {businessId: "business"}}, rejectingDependencies("COMPRAS")),
  (error) => error.code === "permission-denied"
);
await assert.rejects(
  obtenerBalanceTrabajoHandler({data: {businessId: "business"}}, rejectingDependencies("TECNICO")),
  (error) => error.code === "permission-denied"
);
console.log("OK RBAC: Functions rechazan cruces VENTAS/COMPRAS y margen para TECNICO");

console.log("RBAC_SMOKE_OK");
