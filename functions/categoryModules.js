"use strict";

// Módulos verticales que se habilitan al crear un negocio con cierto rubro
// (SPEC 033). Archivo aparte de verticalModules.js: ese archivo tiene una copia
// espejo en src/domain y una prueba de paridad textual, y este mapa es solo de
// Functions. Solo se evalúa al crear el negocio; cambiar el rubro después no
// recalcula modulosHabilitados.
const {VERTICAL_MODULES, normalizeEnabledModules} = require("./verticalModules");

const CATEGORY_MODULES = Object.freeze({
  TALLER_AUTOMOTRIZ: Object.freeze(["taller"]),
  CLINICA_VETERINARIA: Object.freeze(["veterinaria"]),
});

function modulesForCategory(categoryCode, registry = VERTICAL_MODULES) {
  const ids = typeof categoryCode === "string" &&
    Object.prototype.hasOwnProperty.call(CATEGORY_MODULES, categoryCode) ?
    CATEGORY_MODULES[categoryCode] :
    [];
  return normalizeEnabledModules(ids, registry);
}

module.exports = {
  CATEGORY_MODULES,
  modulesForCategory,
};
