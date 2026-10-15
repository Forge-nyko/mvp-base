# SPEC 025: Reportes simplificado (ventas, compras y ganancia)

Estado: **borrador v0**. Diseño basado en la Parte A de investigación (2026-10-15) y en la maqueta "Reportes ValoraCloud". Las decisiones de la sección 4 se confirman con Bruno y Mauricio antes de construir.

## 1. Objetivo

Que Reportes responda de un vistazo cómo va el negocio en el mes, con tres cifras: **ventas, compras y ganancia**, todas sin IVA, calculadas automáticamente, con comparación contra el mes anterior. Bruno pidió expresamente que todo lo demás se considere adorno.

## 2. Hechos verificados

- `/reportes` (`StatisticsPage.jsx`) tiene cuatro pestañas: Rentabilidad y estado, Ventas, Compras y Ganancias.
- Las tres cifras ya existen, con dos desvíos de lo que se pide:
  - Ventas y Compras suman `total` (con IVA) en `reportModel.mjs:85-103`, `:147-164` y `:187-206`. Los documentos ya traen `neto` e `iva`.
  - La ganancia (`operationalNetProfit.mjs:312-340`) usa neto y no tiene términos de Compras, por diseño: la SPEC 016 §E y §7 y la SPEC 022 §4.3 prohíben definirla como ventas menos compras.
- Estados que cuentan: ventas `confirmada` (más los alias `confirmado`, `activa`, `activo`); compras `confirmada`. Canceladas y borradores no entran. No existen notas de crédito.
- Las órdenes de compra y las recepciones no se suman, así que no hay doble conteo: confirmar una recepción crea una sola Compra.
- En una boleta, `neto` es igual a `total` (`iva = 0`), porque el IVA pagado es costo (SPEC 023 §5.2).
- La ganancia suma dos universos separados: el margen bruto de las ventas sin proyecto y el resultado mensual de los proyectos (`workBalance.js`). Una venta con proyecto nunca pasa por el margen, y los materiales de inventario no se duplican.
- El mes de una venta o compra sale de los primeros 7 caracteres de `fechaVenta` o `fechaCompra` (texto `AAAA-MM-DD`), sin desfase de zona horaria. No hay cierre de mes.
- Permisos: la ganancia exige `PROFITABILITY_READ` (backend: OWNER, ADMIN o FINANZAS); Ventas y Compras las ven OWNER, ADMIN, FINANZAS y MEMBER.
- Rendimiento: `listarVentas` y `listarCompras` leen todo el historial sin filtro de fecha; `obtenerBalanceTrabajo` se llama 2N veces, y el primer juego de N balances parece redundante (`reportService.js:82-85`).
- Riesgo de permisos: el margen de ventas sin proyecto se calcula en el navegador con documentos que traen costos congelados. Las reglas dejan leer `ventas` a VENTAS y MEMBER, y solo la interfaz lo oculta.
- Con cero datos no hay divisiones por cero. El "Ticket promedio $0" se ve raro (revisar en navegador).
- Hay tres vistas sin uso (`ReportsResumenView`, `ReportsInventarioView`, `ReportsProyectosView`) y dos funciones de inventario que solo usa su smoke. Q5 de la SPEC 022 (eliminarlas o trasladarlas) sigue abierta.
- El smoke de reportes fija sumas con `total` (`report-model-smoke.mjs:60`, `:92`) y el texto "ambos montos incluyen IVA".

## 3. Pantalla

Una vista de resumen con:
- Selector de mes (anterior y siguiente).
- Tres tarjetas: Ventas, Compras y Ganancia, con la cifra grande, la comparación frente al mes anterior y una línea de explicación. La de Ganancia aclara que no es ventas menos compras.
- Una línea de cobertura de datos, que avisa cuando la ganancia es parcial.
- Estados:
  - **Carga:** indicador del sistema, no texto plano.
  - **Error:** mensaje propio, separado del vacío. Un fallo de carga nunca se muestra como "no hay datos".
  - **Vacío (primer día):** ceros sin gráficos, texto "Aún no hay ventas confirmadas este mes" y accesos para registrar la primera venta o compra.
  - **Sin mes anterior:** "Sin datos del mes anterior para comparar", sin porcentaje.
- Textos de las explicaciones:
  - Ventas: "Ventas confirmadas del mes, sin IVA."
  - Compras: "Compras confirmadas del mes, sin IVA. Incluye mercadería que todavía no vendes."
  - Ganancia: "Lo vendido menos lo que costó esa mercadería, más lo que dejaron los proyectos. No es ventas menos compras: lo que compraste para el stock aún no se vende."

## 4. Decisiones pendientes

1. **Neto de IVA en las tres cifras** (cierra la Q8 de la SPEC 022). Recomendado: sí, coherente con "el IVA nunca es de Bagner". Las compras con boleta mostrarán el total pagado, porque el IVA es costo (SPEC 023).
2. **Definición de ganancia.** Recomendado: mantener la de la SPEC 022 §4.3 (margen de lo vendido más resultado de proyectos). Confirmar con Bruno que la entiende así y que no espera ventas menos compras.
3. **Comparación con el mes anterior.** Recomendado: sí.
4. **Enlaces "Ver detalle".** Opción A: se quedan y llevan a las pestañas actuales. Opción B: se esconden, porque "todo lo demás es adorno". Pendiente de Bruno.
5. **Vistas huérfanas** (Q5). Recomendado: eliminarlas y sus funciones sin uso, en una etapa aparte.
6. **Quién ve qué.** Recomendado: Ventas y Compras como hoy (OWNER, ADMIN, FINANZAS y MEMBER); Ganancia solo con `PROFITABILITY_READ`. Si el rol no la puede ver, la tarjeta no se muestra.
7. **Consulta en el backend** (etapa 5). Recomendado diferirla: con pocos proyectos al inicio, el rendimiento no es un problema, y mover el cálculo exige duplicar el dominio en `functions/` con un smoke de paridad. Se retoma si el volumen o el riesgo de permisos lo justifican.

## 5. Etapas de construcción

1. **Modelo.** Ventas y Compras en neto en `reportModel.mjs`, sin tocar la ganancia. Actualizar `report-model-smoke.mjs` y quitar el texto "incluyen IVA" donde corresponda.
2. **Servicio.** Filtrar ventas y compras por rango de fechas en vez de leer todo el historial, y eliminar la segunda carga de balances por proyecto. Sin cambios de comportamiento visible.
3. **Pantalla.** Vista de resumen según la sección 3, con estados de carga, error, vacío y sin mes anterior. Verificar en navegador con cero datos, pocos datos, modo oscuro y móvil.
4. **Limpieza.** Eliminar las vistas huérfanas y las funciones sin uso, y ajustar el smoke que comprueba que no se renderizan (decisión 5).
5. **Opcional:** consulta única en el backend (decisión 7).

Cada etapa en una sesión nueva, sin commit automático. Antes de construir, revisar la línea de "Margen comercial y evolución de Reportes" de la SPEC 016 §6, que puede estar desactualizada.

## 6. Pruebas

- Smokes de reportes y de ganancia: `test:reports`, `test:reports-profitability-v4` (y variantes), `test:operational-net-profit`, `test:works-model`, `test:sales-margin`, `test:sales-line-margin`, `test:rbac`, `test:finance`.
- Ampliar `report-model-smoke` con los casos de neto, boleta y mes sin datos.
- Aserciones estáticas de que el error de carga no cae en el estado vacío.
- `test:design`, `test:contrast`, `build` y `git diff --check`.
- Los smokes con emuladores se corren solo si están disponibles.

## 7. Fuera de alcance

Gráficos, rankings de clientes, proveedores e ítems, alertas A1 a A9 (siguen en el detalle si se conserva), exportaciones, cierre de mes y zona horaria por negocio.

## 8. Criterios de aceptación

- Con datos de prueba, Ventas, Compras y Ganancia muestran el mes elegido, sin IVA, y su comparación con el mes anterior.
- Con cero datos, la pantalla muestra ceros y acciones, sin errores ni valores raros.
- Un fallo de carga muestra un error, no "Aún no hay datos".
- Un rol sin permiso de ganancia no ve esa tarjeta.
- La ganancia no cambia respecto a la definición vigente de la SPEC 022.
- Todas las pruebas de la sección 6 pasan con código de salida real 0.
