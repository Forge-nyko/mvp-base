# SPEC 036: Montos con decimales por moneda (Bolivia)

Estado: **en curso. Entrega A implementada en la rama `mejora-refresco-avisos` (2026-11-20), sin commit ni despliegue; las entregas B, C y D están pendientes.** Decisión de Mauricio del 20-nov-2026, tomada al ver que Bolivia trabaja con decimales en el día a día (sustituye el redondeo que él mismo había decidido en la SPEC 035). Bruno no aprobó el redondeo y aún no ha sido consultado sobre los decimales. En BOB los montos deben admitir 2 decimales y Bolivia debe funcionar igual de bien que Chile; CLP sigue entero y no cambia de comportamiento. `AGENTS.md` sigue siendo la autoridad en seguridad y arquitectura multiempresa.

## 1. Qué sustituye

- SPEC 035, sección 1 (montos enteros redondeados, `Math.round`), sección 3 punto 7 (el aviso de redondeo al entero) y sección 5 (aviso pendiente): la entrega D los reemplaza. Hasta entonces BOB sigue calculándose entero, tal como dice la 035.
- Todo lo demás de la SPEC 035 (rubros, países, región, textos por país) sigue vigente.

## 2. Decisiones

1. **IVA igual que Chile:** se calcula una sola vez sobre el neto del documento, después de redondear las líneas y restar el descuento general (`round(neto × tasa)`; en compras, sobre `neto − exento`). No hay IVA por línea: cambiaría los totales de Chile.
2. **Decimales de entrada:** BOB admite 2 decimales en importes, precios unitarios y costos. Chile no gana límites nuevos. No hay 4 decimales.
3. **Movimientos financieros (`firestore.rules`):** `amount is number`, `> 0` y con un tope razonable, sin leer el negocio por movimiento (entrega C). El validador del cliente (`financialMovement.mjs`) y el diálogo se ajustan en la misma entrega.
4. **Fuera de alcance** (limitaciones conocidas de Bolivia, sección 6): la importación de documentos con IA y los precios o recomendaciones con IA. No se tocan.
5. **Se guarda en unidad mayor, sin centavos y sin migrar datos.** Cada monto es un número (`10,5`), no un entero en centavos.

## 3. Diseño

### `decimals` y `amountDecimals`

- `decimals` (por moneda, en `functions/businessCatalog.json`) es **formato**: cuántos decimales se muestran. CLP 0, BOB 2.
- `amountDecimals` (por moneda, mismo catálogo) es **cálculo y validación**: con cuántos decimales se redondean y validan los importes de un documento nuevo. Nunca supera a `decimals`. Hoy es **0 en todas las monedas**, BOB incluido: es el interruptor de esta SPEC. BOB pasa a 2 en la entrega D, cuando todos los modelos ya usan el helper; así no hay un estado intermedio en que la cotización admite decimales y la venta que la convierte los rechaza. Volver a 0 es el rollback.
- Lectura: `getCurrencyAmountDecimals(code)` (frontend, `businessCatalog.js`) y `currencyAmountDecimals(code)` (`functions/localization.js`). Una moneda desconocida cuenta 0.
- `schemaVersion` del catálogo pasa de 5 a 6.

### Snapshot `montoDecimales` en cada documento

- `documentLocalizationSnapshot` (Functions) congela `montoDecimales` = `amountDecimals` de la moneda al crear el documento, junto a moneda, locale e IVA.
- `adaptDocumentLocalization` (frontend y Functions) lo lee: **ausente = 0**. Un valor inválido, o mayor que los `decimals` de la moneda del documento, vale 0 (CLP y PYG, siempre 0).
- Un documento anterior sigue calculándose entero y no se recalcula: un documento piloto de BOB guardado como 3 × 3,50 = 11 sigue valiendo 11. Los documentos creados con decimales conservan su snapshot aunque se revierta el interruptor.
- En la entrega A el snapshot se calcula y se lee, pero los modelos todavía no lo escriben ni lo usan (cada `baseStored` guarda sus campos uno a uno).

### Helper de redondeo

- `src/domain/money.mjs` y `functions/money.js` (mismo cuerpo; las Functions no pueden importar `src/`): `mulRound(a, b, decimals = 0, divisor = 1)` calcula `round((a × b) / divisor)`, `roundMoney(value, decimals)` y `sumMoney(values, decimals)`.
- **Con 0 decimales ejecutan literalmente la fórmula actual** (`Math.round((a * b) / divisor)` y la suma con `reduce`), sin ruta exacta. El resultado es bit a bit el de antes, incluidos los empates que hoy dependen del punto flotante. Así Chile queda idéntico por construcción.
- **Con decimales > 0 el cálculo es decimal exacto** (BigInt sobre la representación decimal corta de cada número, que es la que tipeó el usuario): 1,005 redondea a 1,01, 0,7 × 0,05 da 0,04 y 1.000 líneas de 0,07 suman 70. El empate se resuelve hacia +∞, como `Math.round`.
- Unos `decimals` inválidos (negativos, fraccionarios, mayores que 6) lanzan `RangeError`: es un error de programación, no un redondeo silencioso.

### Formato

`formatBusinessMoney`, `useBusinessMoney` (que lo usa) y `formatMoneyText` (correos) muestran siempre los `decimals` de la moneda (mínimo = máximo). CLP y PYG no cambian. BOB se ve "Bs 11,00" y "Bs 10,50" en pantalla, correo y PDF, aunque los montos se sigan calculando enteros hasta la entrega D. `formatMoney` (PDF, vistas de impresión) ya funcionaba así.

## 4. Entregas

- **A (hecha):** helper, `amountDecimals` y snapshot, formato. Con `amountDecimals` en 0 todo se comporta como antes, salvo el formato de BOB (",00").
- **B:** cotizaciones, ventas, compras, órdenes de compra y recepciones: modelos del frontend, Functions y los inputs con `step="1"` de [NewQuotePage.jsx](../../src/pages/NewQuotePage.jsx) (3).
- **C:** inventario (precio de venta, IVA de compra, costo promedio), órdenes de trabajo del taller, margen comercial y movimientos financieros (modelo, diálogo, CSV y regla de Firestore). Sin tocar IA.
- **D:** verificación de reportes y finanzas con datos en BOB, BOB con `amountDecimals` 2, retiro del aviso de redondeo (`amountRounding.mjs`, `AmountRoundingNotice`, onboarding y los 3 paneles de resumen), actualización de esta SPEC y de la 035, y un integrado nuevo de Bolivia.

## 5. Pruebas

- Entrega A: `money` (paridad del texto entre frontend y Functions; diferencial contra las fórmulas actuales con más de un millón de entradas aleatorias, empates incluidos; oráculo de centavos enteros con 2 decimales; casos de punto flotante), `localization` (snapshot y adaptación, ausente = 0, tope por moneda), `business-catalog` (`amountDecimals` por moneda) y `currency-text` (formato mínimo = máximo, CLP idéntico a las fórmulas anteriores congeladas).
- Pendientes: modelos BOB con decimales en cada entrega, paridad frontend/servidor de cada modelo, regla de movimientos y un integrado de Bolivia (cotización → venta → compra → orden → recepción, inventario y movimiento) con emuladores.

## 6. Limitaciones conocidas de Bolivia (fuera de alcance)

Siguen enteros y asumen formato chileno, aunque la empresa tenga `amountDecimals` 2:

- **Importación de documentos con IA:** `normalizeInventoryDocument` y `confirmInventoryImportV2` (`functions/inventoryDocumentImport.js`) y `parseChileanMoney`/`parseIntegerFromText` en `functions/index.js` redondean los montos al entero y leen "1.234" como mil doscientos treinta y cuatro. Los diálogos de importación de compras y recepciones usan ese resultado.
- **Precios y recomendaciones con IA:** `suggestQuoteItems` y los cálculos de precio recomendado, mínimo y máximo de `functions/index.js` (`Math.round`), y las recomendaciones de `src/domain/pricing.js`.
- **Precios de referencia de mercado:** asumen CLP.
- **Normativa tributaria boliviana (IT) y facturación:** siguen fuera de alcance (SPEC 035). Los precios en Bolivia suelen fijarse con IVA incluido y el débito fiscal se calcula sobre el importe del documento; el modelo neto + IVA de ValoraCloud no calzará al centavo con una factura emitida fuera del sistema.

## 7. Despliegue

La entrega A no cambia ningún cálculo, pero el formato de BOB sí cambia en el correo de cotización: `sendQuoteEmail` (Functions, único consumidor de `formatMoneyText`) y Hosting. Como las Functions comparten módulos, las que no se redespliegan siguen con el comportamiento anterior sin riesgo mientras `amountDecimals` valga 0. El despliegue de Functions es dirigido por la cuota 429, en tandas pequeñas.
