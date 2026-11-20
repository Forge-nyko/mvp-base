# SPEC 035: Bolivia como piloto con montos enteros redondeados

Estado: **sustituida por la [SPEC 036](036-bolivia-montos-con-decimales.md) en lo que decide sobre los montos enteros (sección 1, el aviso de redondeo del punto 7 de la sección 3 y la sección 5); el resto (rubros, países, región, textos por país) sigue vigente.** Hasta que la entrega D de la SPEC 036 active los decimales en BOB, Bolivia se sigue calculando entero como dice esta SPEC. Estaba implementada en la rama `ajuste-onboarding-bolivia` (2026-11-20), sin commit ni despliegue. Decisión verbal de Bruno del 20-nov-2026: opción (a) del acta de entrega, 7.6.1. `AGENTS.md` sigue siendo la autoridad en seguridad y arquitectura multiempresa.

## 1. Qué decide

- Bolivia (BOB, 2 decimales) se abre a empresas nuevas **sin** modelo de dinero decimal: los montos se siguen guardando enteros y se redondean (`Math.round`) en ventas, cotizaciones, compras y órdenes de trabajo. 3 unidades a Bs 3,50 son Bs 10,50 y se guardan como Bs 11. No se migra nada.
- Fuera de alcance: normativa tributaria boliviana (IT), facturación, la SPEC de dinero decimal (opción (b) del acta) y la migración de datos.

## 2. Qué sustituye

- SPEC 030/033, rubros: pasan de 9 a **6 seleccionables** para empresas nuevas: `TECNOLOGIA_INFORMATICA`, `ELECTRICIDAD_ENERGIA_CLIMATIZACION`, `INGENIERIA_CONSULTORIA`, `TALLER_AUTOMOTRIZ`, `CLINICA_VETERINARIA` y `OTRO_SERVICIO_PROYECTOS` (este último visible como "Otro servicio técnico o profesional"). Quedan ocultos `SEGURIDAD_TELECOMUNICACIONES`, `AUTOMATIZACION_CONTROL` y `MANTENIMIENTO_INSTALACIONES`: siguen en el catálogo y activos, con `selectable: false`; `modulesForCategory` no cambia. Un negocio existente conserva su rubro.
- El protector temporal "solo países cuya moneda no tiene decimales" (commit `a264180`): Bolivia se abre como excepción declarada. Paraguay pasa a `selectableForNewBusiness: false`; las empresas paraguayas existentes no cambian.
- SPEC 030, decisión 3 (nota del país en el onboarding): el texto "Las reglas fiscales (facturas, boletas, IVA) están pensadas para Chile y están en revisión" se reemplaza por el del punto 7 de la sección 3.
- Todo lo demás de las SPEC 030 y 033 sigue vigente.

## 3. Decisiones

1. **Países para altas nuevas:** Chile y Bolivia. Es el "Cambio técnico de apertura" del acta: el flag de `functions/businessCatalog.json` manda en el cliente y en el servidor (`validateRequiredBusinessFields` rechaza un país con `selectableForNewBusiness: false`, salvo que el negocio ya lo tenga).
2. **Región por país:** nueva clave `territoriesByCountry` (hoy `BO`: 9 departamentos `LP, CB, SC, OR, PO, CH, TJ, BE, PD`, con `regionLabel: "Departamento"`). Chile sigue en `regions` (con comunas). Sin lista de municipios. `schemaVersion` pasa de 4 a 5.
3. **Onboarding:** el formulario muestra la región (obligatoria) según el país y la limpia al cambiar de país. Chile solo gana ese campo.
4. **Backend:** `createFirstBusiness` sigue tolerando que falte la región; si llega, un país con catálogo la valida contra él (código, o nombre sin tildes). `createAdditionalBusiness` y las actualizaciones de perfil la exigen. Un perfil antiguo de Bolivia con región en texto libre la conserva mientras no la cambie.
5. **Perfil de empresa:** los países con catálogo muestran un selector (Chile: región y comuna; Bolivia: departamento y ciudad libre).
6. **Moneda en textos:** el correo de cotización (`formatMoneyText` en `functions/localization.js`) y los textos que mostraban "$" o "CLP" fijos (editores de ventas, compras y órdenes de compra, paneles del Taller, rótulo y CSV de Finanzas) usan la moneda y el formato de la empresa. Con CLP el texto es idéntico (prueba `test:currency-text`).

7. **Nota fiscal y aviso de redondeo en el onboarding.** Bajo País solo queda la línea corta ("Bolivia · BOB"); lo demás va en un aviso informativo a todo el ancho bajo la grilla, en dos párrafos. Nota fiscal (verificada en el código; `getCountryFiscalNote`, generada desde el catálogo): "ValoraCloud calcula el IVA con la tasa de Bolivia (13 %). La facturación y los impuestos propios de Bolivia, como el IT, no están incluidos." Es cierta porque cotizaciones, ventas, compras y órdenes de compra aplican la tasa base del país (13 % en Bolivia), ValoraCloud no emite facturas ni documentos tributarios (README) y no existe ningún cálculo del IT. Chile no lleva nota.
8. **Selector de rubros.** Con 6 rubros, "Otro servicio técnico o profesional" entra en la grilla de 2 columnas como los demás (se eliminó `business-category-option--wide`); el orden no cambia.
9. **Textos y campos por país.** `src/domain/countryFormCopy.mjs` concentra lo que cambia por país en el perfil de empresa, la verificación y los clientes (sin "si es Bolivia" en los componentes; Chile y el resto no cambian). Bolivia: cliente Persona con "CI o NIT" (Empresa sigue en NIT; una CI numérica de 5 a 15 dígitos ya pasa la validación, en cliente y servidor); "Actividad económica" en lugar de "Giro" (solo la etiqueta visible; el campo interno sigue siendo `giro`; también en los PDF y vistas de impresión de cotización, orden de compra y compra, en el detalle de compra y en el formulario de proveedores, según el país del documento o, si no lo trae, el de la empresa; los correos no mencionan el giro); ejemplos de teléfono (+591 7xxxxxxx), correo y sitio web (.com.bo) y sin ejemplo de código postal; y la región del cliente y del proveedor como lista de los 9 departamentos del catálogo (el municipio sigue siendo texto libre; una región guardada antes como texto se conserva).

## 4. Pruebas

`business-catalog`, `business-category-selector`, `business-quick-flow`, `business-settings` (validadores por país y región), `currency-text` (paridad CLP contra las fórmulas anteriores congeladas) y los integrados `business-onboarding` y `business-multi` (requieren emuladores).

## 5. Pendiente

- Aviso en la interfaz de que los montos se redondean al entero.
- Despliegue dirigido de Functions (`createFirstBusiness`, `createAdditionalBusiness`, `updateBusinessProfile`, `updateBusinessInformation`, `sendQuoteEmail`) y de Hosting.
- Revisión en emulador con una empresa BOB.
