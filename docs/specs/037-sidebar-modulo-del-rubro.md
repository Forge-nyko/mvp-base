# SPEC 037: El módulo del rubro como sección principal del menú

Estado: **entrega A implementada en la rama `mejora-refresco-avisos` (2026-11-21), sin commit ni despliegue.** Complementa la SPEC 031 (interruptor de módulos) y la 033 (módulos por rubro). No cambia permisos, rutas, reglas ni Functions. `AGENTS.md` sigue siendo la autoridad en seguridad y arquitectura multiempresa.

Lecturas previas: `AGENTS.md`, SPEC 016 (visión post-demo), SPEC 031 y SPEC 033. La SPEC 016 marca la vertical Taller como `CONFIRMADO PENDIENTE` y no autoriza fijar esquema, estados ni documentos nuevos; esta SPEC solo reubica entradas de menú que ya existen y no introduce ninguna pantalla ni dato.

## 1. Qué sustituye

Esta SPEC reemplaza únicamente la **ubicación en el menú** del módulo vertical que corresponde al rubro del negocio:

- SPEC 031, sección 2, punto "Menú": los módulos verticales "agrupados bajo 'Módulos', antes de 'Cuenta'". Para el módulo del rubro ya no es así (sección 2). Los demás módulos habilitados siguen agrupados bajo "Módulos".
- SPEC 033 no decía dónde se mostraba el módulo habilitado por rubro; heredaba la ubicación de la 031. Hereda ahora la de esta SPEC.

Todo lo demás de las SPEC 031 y 033 sigue vigente: habilitación, `modulosHabilitados`, módulo deshabilitado = oculto y bloqueado, sin refresco en vivo, autoridad en backend.

## 2. Decisiones

1. **Espejo cliente del mapa.** `src/domain/categoryModules.mjs` copia `CATEGORY_MODULES` y `modulesForCategory` de `functions/categoryModules.js`, con prueba de paridad en `category-modules-smoke` (mapa, congelado y resultado de `modulesForCategory` sobre todos los códigos del catálogo y entradas inválidas). Un cambio del mapa en Functions obliga a copiarlo aquí.
2. **`getPrimaryVerticalModules(sesión | negocio, registro)`** devuelve los ids de los módulos que son del rubro del negocio (`rubroCodigo` según el mapa) **y** están habilitados (`modulosHabilitados`). Un módulo activado a mano en un negocio de otro rubro, un módulo del rubro que ya no está habilitado, un rubro sin mapeo y cualquier entrada inválida devuelven `[]`.
3. **Sección del rubro.** `buildNavigationSections(registro, {primaryModules})` recibe esos ids. Cada módulo principal sale de "Módulos" y pasa a ser la **primera** sección del menú, con el nombre del módulo como título y sus ítems **planos** (sin el nivel anidado). "Módulos" se omite si queda vacío. La sección lleva `accent: true` y `moduleId`.
4. **Opt-in.** Sin `primaryModules` (o con una lista vacía o con ids que no estén en el registro) la salida es la de siempre, y la firma de `getBusinessPathOptions` no cambia. Solo `AppLayout` pasa `primaryModules`. El menú de escritorio y el del cajón móvil comparten `PrimaryNavigation`, así que ambos muestran la sección.
5. **Acento visual.** La sección lleva la clase `nav-section--primary` (`src/styles/layout.css`): fondo `--color-surface-brand`, radio `--radius-md` y título con `--color-text-brand-accent`. Solo tokens existentes; no se agregó ninguno.
6. **Los permisos no cambian.** La sección pasa por el mismo `filterNavigationSections`: un rol sin lectura del módulo no la ve y un negocio sin verificar sigue viendo solo Empresa y Cuenta (la sección no figura en `UNVERIFIED_BUSINESS_PATHS`). Un miembro con perfil personalizado (`modules`) queda como hoy, sin la sección: los perfiles no incluyen verticales (SPEC 031). Roles que ven la sección de Taller: OWNER, ADMIN, TECNICO y MEMBER (este último sin "Plazas", que exige `taller.manage`); la de Veterinaria: OWNER y ADMIN. VENTAS, COMPRAS y FINANZAS no ven ninguna. Es exactamente lo que ya veían bajo "Módulos".
7. **No cambia el aterrizaje.** `getDefaultBusinessPath` no se toca: el inicio por defecto de cada rol es el de hoy (ver pregunta abierta de la sección 4). Tampoco cambian `platformAdmin`, el título de la barra superior (`getRouteMeta` usa el árbol por defecto) ni las rutas.

## 3. Pruebas

- `category-modules-smoke` (sin emuladores): paridad del espejo con Functions y casos de `getPrimaryVerticalModules`: Taller y Veterinaria habilitados, módulo no habilitado, módulo del otro rubro, módulos activados a mano en Tecnología, Electricidad, Ingeniería, Otro servicio, `TALLER_MECANICO` y `AUTOMOTRIZ_MOVILIDAD`, sesión vs. negocio, registro inyectado y entradas inválidas.
- `business-quick-flow-smoke` (sin emuladores), todo con `deepEqual` sobre un árbol comparable (las `activeWhen` se sondean con rutas de ejemplo):
  - La salida por defecto no cambia con ninguna forma de "sin módulo principal", y conserva "Módulos" anidado antes de "Cuenta".
  - Tecnología, Electricidad, Ingeniería, Otro servicio y negocios sin `modulosHabilitados` (o con Taller/Veterinaria sin habilitar): el menú es idéntico al de hoy para OWNER, ADMIN, TECNICO y VENTAS.
  - Taller y Veterinaria por rol (OWNER, ADMIN, TECNICO, MEMBER, VENTAS, COMPRAS, FINANZAS): lo que muestra la sección es exactamente lo que mostraba "Módulos", la sección va primera y "Módulos" no queda vacío.
  - Perfil personalizado, negocio sin verificar, módulo activado a mano en otro rubro (sigue anidado bajo "Módulos"), Veterinaria con Taller a mano, registro inyectado sin ítems.
  - `AppLayout` usa el helper y la clase; las reglas CSS del acento no tienen colores literales ni colores de marca fija.
- Las pruebas que fijaban la estructura anterior de "Módulos" siguen válidas sin cambios, porque la salida por defecto no cambió.

## 4. Pregunta abierta para Bruno

**¿Dónde debe aterrizar un usuario de Taller o Veterinaria al entrar?** Hoy aterriza como cualquier otro negocio: OWNER, ADMIN y FINANZAS en `/reportes`, TECNICO en `/trabajos`, VENTAS en `/cotizaciones`, COMPRAS en `/ordenes-compra`. Si el rubro es el centro de su día, tal vez deba aterrizar en su módulo (órdenes de trabajo para Taller, resumen clínico para Veterinaria), quizá solo para algunos roles. No se implementó: cambiar `getDefaultBusinessPath` toca el inicio de la sesión, el cambio de negocio y la activación inicial, y es decisión de producto.

## 5. Fuera de alcance

- El distintivo "Incluido en tu rubro".
- El panel de inicio del taller (entrega B).
- `platformAdmin` y el aterrizaje por rubro (sección 4).

## 6. Notas y riesgos

- **Rubros con nombre parecido.** El mapa solo conoce `TALLER_AUTOMOTRIZ` ("Taller automotriz", el que ofrece el selector) y `CLINICA_VETERINARIA`. `TALLER_MECANICO` ("Taller mecánico") es un rubro heredado que no es seleccionable en el selector, no habilita módulos y por eso no tiene sección principal; si un negocio existente lo tiene y el superadmin le activó Taller, sigue bajo "Módulos". Decidir si se agrega al mapa es cambio de la SPEC 033, no de esta.
- **Cambio de rubro después de crear.** Como la SPEC 033 no recalcula `modulosHabilitados`, un negocio que cambia de Taller a otro rubro conserva el módulo habilitado pero lo ve de nuevo bajo "Módulos". Se calcula al cargar la sesión y no se refresca en vivo.
- **Despliegue.** Solo Hosting (cliente). Sin Functions ni reglas.
- **Visual.** Cambia el menú de los negocios de Taller y Veterinaria, en escritorio y en el cajón móvil, claro y oscuro. Revisar en el navegador: la sección primera con fondo de marca, el estado activo y el foco de sus enlaces, el contraste del título en oscuro y la sidebar de pantallas bajas (la sección agrega unos 16 px de padding).
