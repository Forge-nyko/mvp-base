import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {isSelectableBusinessCategory} from "../src/domain/businessCategorySearch.mjs";

const require = createRequire(import.meta.url);
const {CATEGORY_MODULES, modulesForCategory} = require("../functions/categoryModules.js");
const {VERTICAL_MODULES, normalizeEnabledModules} = require("../functions/verticalModules.js");
const catalog = require("../functions/businessCatalog.json");

// Mapa exacto de la SPEC 033.
assert.deepEqual(
  Object.fromEntries(Object.entries(CATEGORY_MODULES).map(([code, ids]) => [code, [...ids]])),
  {TALLER_AUTOMOTRIZ: ["taller"], CLINICA_VETERINARIA: ["veterinaria"]}
);
assert.equal(Object.isFrozen(CATEGORY_MODULES), true);
for (const ids of Object.values(CATEGORY_MODULES)) {
  assert.equal(Object.isFrozen(ids), true, "las listas del mapa no se pueden mutar");
}

// Todos los ids del mapa existen en el registro real.
const registryIds = VERTICAL_MODULES.map((module) => module.id);
for (const [code, ids] of Object.entries(CATEGORY_MODULES)) {
  assert.ok(ids.length > 0, `${code} mapea al menos un módulo`);
  for (const id of ids) {
    assert.ok(registryIds.includes(id), `${code}: el módulo ${id} existe en VERTICAL_MODULES`);
  }
}

// Todos los códigos del mapa existen en el catálogo y son seleccionables.
for (const code of Object.keys(CATEGORY_MODULES)) {
  const category = catalog.businessCategories.find((item) => item.code === code);
  assert.ok(category, `${code} existe en el catálogo`);
  assert.equal(category.sectorCode, "SERVICIOS_PROYECTOS", code);
  assert.equal(category.catalogVersion, 1, code);
  assert.equal(
    isSelectableBusinessCategory(category, catalog.businessCategoryCatalogVersion),
    true,
    `${code} es seleccionable`
  );
}
// El rubro antiguo sigue retirado y no activa ningún módulo.
const retiredAutomotive = catalog.businessCategories.find((item) => item.code === "AUTOMOTRIZ_MOVILIDAD");
assert.equal(retiredAutomotive.selectable, false);
assert.deepEqual(modulesForCategory("AUTOMOTRIZ_MOVILIDAD"), []);

// Resultado por rubro.
assert.deepEqual(modulesForCategory("TALLER_AUTOMOTRIZ"), ["taller"]);
assert.deepEqual(modulesForCategory("CLINICA_VETERINARIA"), ["veterinaria"]);

// Un rubro sin mapeo (o un valor inválido) devuelve [].
for (const code of [
  "TECNOLOGIA_INFORMATICA", "OTRO_SERVICIO_PROYECTOS", "OTRO", "", "taller_automotriz",
  "CATEGORIA_INEXISTENTE", undefined, null, 7, {}, [], ["TALLER_AUTOMOTRIZ"],
  "__proto__", "constructor", "toString", "hasOwnProperty",
]) {
  assert.deepEqual(modulesForCategory(code), [], `sin mapeo: ${String(code)}`);
}

// El resultado es siempre un arreglo nuevo (no se puede mutar el mapa por fuera).
const first = modulesForCategory("TALLER_AUTOMOTRIZ");
first.push("veterinaria");
assert.deepEqual(modulesForCategory("TALLER_AUTOMOTRIZ"), ["taller"]);
assert.deepEqual([...CATEGORY_MODULES.TALLER_AUTOMOTRIZ], ["taller"]);

// Pasa por normalizeEnabledModules: los ids que el registro no conoce se descartan.
const onlyTaller = [{id: "taller", label: "Taller", basePath: "/taller"}];
const onlyVeterinaria = [{id: "veterinaria", label: "Veterinaria", basePath: "/clinica-veterinaria"}];
assert.deepEqual(modulesForCategory("TALLER_AUTOMOTRIZ", onlyTaller), ["taller"]);
assert.deepEqual(modulesForCategory("CLINICA_VETERINARIA", onlyTaller), []);
assert.deepEqual(modulesForCategory("TALLER_AUTOMOTRIZ", onlyVeterinaria), []);
assert.deepEqual(modulesForCategory("CLINICA_VETERINARIA", onlyVeterinaria), ["veterinaria"]);
assert.deepEqual(modulesForCategory("TALLER_AUTOMOTRIZ", []), []);
assert.deepEqual(
  modulesForCategory("TALLER_AUTOMOTRIZ"),
  normalizeEnabledModules(CATEGORY_MODULES.TALLER_AUTOMOTRIZ)
);

console.log("OK mapa rubro a módulos: ids en el registro, códigos seleccionables, sin mapeo devuelve [] e ids desconocidos se descartan");
