# Cómo agregar o habilitar un rubro

Guía corta. La decisión de fondo está en `docs/specs/030-rubros-y-paises.md`.

## Dónde está el catálogo

Solo en `functions/businessCatalog.json` (clave `businessCategories`). El servidor lo lee desde `functions/businessOnboarding.js` y el cliente lo importa por Vite desde `src/domain/businessCatalog`. No hay una segunda copia.

## Qué significan los campos

- `active`: el rubro existe y se reconoce. Un negocio que ya lo tiene lo conserva.
- `selectable: false`: el rubro **no** se ofrece a negocios nuevos ni se acepta en `createFirstBusiness`. Si falta el campo, cuenta como seleccionable.
- `legacy: true`: rubro heredado de catálogos anteriores. Solo se conserva en negocios que ya lo tenían.
- `catalogVersion`: versión del catálogo vigente (hoy `1`, ver `businessCategoryCatalogVersion`). Solo los rubros de la versión vigente pueden ser seleccionables.

Un negocio conserva su `rubroCodigo` y `rubroNombre` aunque el rubro deje de ser seleccionable: el servidor lo acepta si el código es igual al que ya tiene guardado.

## Rubros seleccionables hoy (7)

`TECNOLOGIA_INFORMATICA`, `SEGURIDAD_TELECOMUNICACIONES`, `ELECTRICIDAD_ENERGIA_CLIMATIZACION`, `AUTOMATIZACION_CONTROL`, `MANTENIMIENTO_INSTALACIONES`, `INGENIERIA_CONSULTORIA` y `OTRO_SERVICIO_PROYECTOS`.

Existen pero no son seleccionables: `AUTOMOTRIZ_MOVILIDAD`, `CONSTRUCCION_OBRAS`, `SOFTWARE_SOLUCIONES_DIGITALES` y `SERVICIOS_DIGITALES_CREATIVOS`. El picker los muestra, con "Taller automotriz" y "Clínica veterinaria", en el grupo "Próximamente".

## Cómo habilitar un rubro

1. En `businessCatalog.json`, deja `active: true`, `catalogVersion` igual al vigente y quita `selectable: false` (o no lo pongas).
2. Si es nuevo, agrega `code` (mayúsculas y guion bajo), `name`, `sectorCode` y `searchTerms`.
3. Si aparece en la lista "Próximamente" del picker (`BusinessCategoryPicker.jsx`), quita su fila de `COMING_SOON_CATEGORIES`.
4. Ajusta los smokes: la lista y el recuento de seleccionables en `business-catalog-smoke.mjs` y `business-category-selector-smoke.mjs`, y la lista `RETIRED_CATEGORIES` de `business-onboarding-integrated.mjs`.

## Cómo se activaría un módulo para un rubro

**PENDIENTE: hoy no existe el interruptor de módulos por negocio.** Nada del sistema decide menús o módulos según el rubro; el rubro es solo un dato descriptivo. Habilitar un rubro no activa ningún módulo. Cuando exista ese interruptor, se documentará aquí cómo asociar un módulo (por ejemplo Taller o Clínica Veterinaria) a un rubro.

## Pruebas

```bash
npm run test:business-catalog
npm run test:business-category-selector
npm run test:business-quick-flow
npm run test:business-onboarding   # integrado, requiere emuladores
npm run test:business-multi        # integrado, requiere emuladores
npm run test:design
npm run test:contrast
npm run build
git diff --check
```

## Deploy

Cada cambio al catálogo exige deploy de **Functions** (validación en el servidor) y de **Hosting** (el cliente empaqueta el mismo JSON). Si se despliega solo uno, cliente y servidor discrepan sobre qué rubros son seleccionables.
