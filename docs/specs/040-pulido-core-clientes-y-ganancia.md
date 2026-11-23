# SPEC 040: Pulido Core: ejemplos del formulario de cliente y Ganancia sin proyectos

Estado: **implementada en la rama `mejora-refresco-avisos` (2026-11-22), sin commit ni despliegue.** Solo cliente (Hosting): no cambia Functions, reglas, permisos, rutas ni datos. No toca Taller ni Veterinaria. `AGENTS.md` sigue siendo la autoridad en seguridad y arquitectura multiempresa.

Lecturas previas: `AGENTS.md`, `src/domain/countryFormCopy.mjs`, `ClientFormDialog.jsx`, SPEC 035 (§9, textos por país) y SPEC 038 (reportes sin proyectos).

## 1. Qué sustituye

Reemplaza únicamente estos puntos de la SPEC 038 (solo Taller automotriz y Clínica veterinaria, `showProjects` en falso):

- §4, "Consejo de servicios": la nota `PROFIT_PRODUCTS_ONLY_NOTE` pasa de "Incluye solo el margen de productos; los servicios vendidos fuera de un proyecto no se cuentan." a **"Incluye solo el margen de productos; los servicios no se cuentan en la ganancia."** (el aviso `Hay $X en servicios vendidos. …` y el ícono "i" de "Me quedó" la usan por referencia, así que cambian igual).
- §4, "Ganancia": ya no se oculta solo la tabla "Proyectos"; también se oculta la fila "Resultado de proyectos" de la tabla "Total", y el subtítulo de la sección pasa a "Ganancia de los productos vendidos en el período.".
- §7, "Pestaña Ganancia": la fila "Resultado de proyectos" de "Total" ya no se conserva (la "Evolución mensual" sigue sin tocarse).

Todo lo demás de la SPEC 038 sigue vigente. Los demás rubros, Chile y Bolivia quedan idénticos en Reportes: la clave es `showProjects`, es decir el rubro.

## 2. Formulario de cliente: ejemplos (placeholders)

`ClientFormDialog.jsx` (Nuevo y Editar cliente) agrega un ejemplo a los cuatro campos de texto que no lo tenían. Los que ya lo tenían (identificador fiscal, nombre o razón social, correo, teléfono, y región y comuna) no se tocan. Etiquetas, validaciones y datos guardados no cambian.

| Campo | Chile | Bolivia | Otros países |
|---|---|---|---|
| Dirección | Ej. Av. Arturo Prat 123 | Ej. Av. Banzer 123 | sin ejemplo (como hoy) |
| Giro / Actividad económica (solo Empresa) | Ej. Venta de repuestos automotrices | Ej. Transporte de carga | sin ejemplo (como hoy) |
| Persona de contacto (solo Empresa) | Ej. Nombre Apellido | Ej. Nombre Apellido | Ej. Nombre Apellido |
| Notas internas | Ej. Prefiere contacto por WhatsApp | Ej. Prefiere contacto por WhatsApp | Ej. Prefiere contacto por WhatsApp |

- Los ejemplos salen de `countryFormCopy.mjs` (`clientAddressExample`, `clientBusinessActivityExample`, `clientContactPersonExample`, `clientNotesExample`), sin "si es Bolivia" en el componente. Dirección y giro dependen del país; contacto y notas son iguales en todos.
- Un país distinto de Chile y Bolivia no recibe ejemplos chilenos de dirección ni de giro (`null` = sin placeholder, como hoy). Contacto y notas sí aparecen, porque no dependen del país.
- Este documento no cubre el formulario de proveedores ni otros: ver la sección 4.

## 3. Reportes: Ganancia sin proyectos

Con `showProjects` en falso (`StatisticsPage`):

- `OperationalNetProfitBreakdown`: la tabla "Total" queda con "Ganancia por productos" y "Ganancia" (o "Ganancia (parcial)"); desaparece "Resultado de proyectos". La tabla "Proyectos" ya estaba oculta (SPEC 038).
- `ReportsGananciasView`: subtítulo "Ganancia de los productos vendidos en el período.".
- Las cifras no cambian: la ganancia sigue incluyendo el resultado de proyectos si existiera. **Riesgo:** un negocio de Taller o Veterinaria con proyectos anteriores verá una "Ganancia" que incluye ese resultado sin una fila que lo muestre. Para el piloto no aplica (SPEC 038 §7).
- Con `showProjects` en verdadero (valor por defecto) la pantalla es la de siempre.

## 4. Fuera de alcance (informado)

Campos de texto sin ejemplo en otros formularios Core, detectados y no modificados: proveedores (nombre de fantasía, giro, persona de contacto, dirección, notas), catálogo y carga de inventario (tablas de edición), observaciones de la verificación de empresa y campos de confirmación de borrado. Detalle en `output/informe-pulido-core.txt`.

## 5. Pruebas

- `country-form-copy-smoke` (sin emuladores): valores de los cuatro ejemplos para Chile, Bolivia y otros países; sin ejemplos cruzados entre países; cableado campo por campo en `ClientFormDialog`; los ejemplos y etiquetas que ya existían siguen; render real del formulario en Chile, Bolivia y otro país (con `clientService` reemplazado por un módulo mínimo, porque importa Firebase).
- `report-model-smoke` (`test:reports`): texto de la nota; sin proyectos, "Total" sin "Resultado de proyectos" y 8 filas menos que con proyectos; con proyectos, igual que antes; render de `ReportsGananciasView` con y sin `showProjects` (subtítulo, fila, cifras).

## 6. Despliegue y revisión visual

Solo Hosting. Revisar en el navegador: Clientes → Nuevo cliente (Empresa y Persona) en Chile y en Bolivia, y `/reportes` → Ganancia en un negocio de Taller o Veterinaria (subtítulo y tabla "Total") y en uno de Informática (sin cambios), en claro y oscuro.
