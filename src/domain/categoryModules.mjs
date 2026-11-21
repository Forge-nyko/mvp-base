// Espejo cliente del mapa rubro -> módulos verticales de functions/categoryModules.js
// (SPEC 033). El servidor lo usa solo al crear el negocio; el cliente lo usa para
// saber qué módulo habilitado es "el del rubro" y mostrarlo como sección principal
// del menú (SPEC 037). La paridad con el de Functions la cubre
// scripts/category-modules-smoke.mjs.
import {
  VERTICAL_MODULES,
  getEnabledVerticalModules,
  normalizeEnabledModules,
} from "./verticalModules.mjs";

export const CATEGORY_MODULES = Object.freeze({
  TALLER_AUTOMOTRIZ: Object.freeze(["taller"]),
  CLINICA_VETERINARIA: Object.freeze(["veterinaria"]),
});

export function modulesForCategory(categoryCode, registry = VERTICAL_MODULES) {
  const ids = typeof categoryCode === "string" &&
    Object.prototype.hasOwnProperty.call(CATEGORY_MODULES, categoryCode) ?
    CATEGORY_MODULES[categoryCode] :
    [];
  return normalizeEnabledModules(ids, registry);
}

// --- Solo frontend: sin copia en functions/categoryModules.js ---

// Módulos verticales del rubro del negocio que además están habilitados: los que
// el menú muestra como sección principal. Acepta la sesión ({activeBusiness}) o el
// negocio activo directo, igual que getEnabledVerticalModules. Un módulo activado
// a mano en un negocio de otro rubro no entra aquí (sigue bajo "Módulos"), y un
// rubro sin mapeo devuelve [].
export function getPrimaryVerticalModules(session, registry = VERTICAL_MODULES) {
  const business = session?.activeBusiness ?? session;
  const ofCategory = modulesForCategory(business?.rubroCodigo, registry);
  if (!ofCategory.length) return [];
  const enabled = getEnabledVerticalModules(business, registry);
  return ofCategory.filter((id) => enabled.includes(id));
}
