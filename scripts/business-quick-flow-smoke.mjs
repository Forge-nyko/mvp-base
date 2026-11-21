import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { normalizeQuickBusinessPayload } from "../src/domain/businessQuickPayload.mjs";
import { resolveInitialActivationRoute } from "../src/domain/initialActivationNavigation.mjs";
import { filterNavigationSections } from "../src/domain/rbac.mjs";
import { buildNavigationSections, navigationSections } from "../src/app/navigation.js";

const [
  onboarding,
  drawer,
  fields,
  formModel,
  app,
  companyConfig,
  businessService,
  appLayout,
  navigation,
  activation,
  componentStyles,
] = await Promise.all([
  readFile(new URL("../src/pages/OnboardingPage.jsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/components/AdditionalBusinessDrawer.jsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../src/components/QuickBusinessFields.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../src/domain/businessForm.js", import.meta.url), "utf8"),
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/company/CompanyConfig.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../src/services/businessService.js", import.meta.url), "utf8"),
  readFile(new URL("../src/layout/AppLayout.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/navigation.js", import.meta.url), "utf8"),
  readFile(
    new URL("../src/pages/InitialBusinessActivationPage.jsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../src/styles/components.css", import.meta.url), "utf8"),
]);

for (const field of [
  "nombreComercial",
  "rubroCodigo",
  "paisCodigo",
  "regionCodigo",
]) {
  assert.match(fields, new RegExp(`field: ["']${field}["']`));
  assert.match(formModel, new RegExp(`["']${field}["']`));
}

for (const forbidden of [
  "rut",
  "comunaCodigo",
  "direccion",
  "telefono",
  "email",
  "razonSocial",
]) {
  assert.doesNotMatch(fields, new RegExp(`field: ["']${forbidden}["']`));
}

assert.match(onboarding, /<QuickBusinessFields/);
assert.match(onboarding, /showCountry/);
// La región es obligatoria en el onboarding y depende del país (Chile: regiones; Bolivia: departamentos).
assert.match(onboarding, /<QuickBusinessFields[\s\S]*?\bshowRegion\b(?!=\{false\})/);
assert.doesNotMatch(onboarding, /showRegion=\{false\}/);
assert.doesNotMatch(onboarding, /requireRegion: false/);
assert.match(onboarding, /applyQuickBusinessChange\(/);
// El paso 1 nombra el identificador fiscal del país elegido (RUT en Chile, NIT en Bolivia), no "RUT" fijo.
assert.match(onboarding, /const fiscalIdentifierLabel = getDefaultFiscalIdentifierLabel\(values\.paisCodigo\);/);
assert.ok(onboarding.includes("razón social, ${fiscalIdentifierLabel}, domicilio"), "el paso 1 usa la etiqueta del país");
assert.doesNotMatch(onboarding, />Completa los datos de tu empresa \(razón social, RUT, domicilio\)</, "sin RUT fijo en el paso 1");
assert.doesNotMatch(onboarding.replace(/\/\/.*$/gm, ""), /\bRUT\b/, "ningún otro RUT fijo visible en el onboarding");
// El panel "Tu negocio ya está creado" no nombra el RUT y el formulario de verificación toma la etiqueta del perfil.
assert.doesNotMatch(activation, /RUT/);
assert.match(companyConfig, /label="Tipo de identificación fiscal"\s+value=\{form\.identificadorFiscalTipo\}/);
assert.match(companyConfig, /Ingresa el \$\{\s*form\.identificadorFiscalTipo \|\| "identificador"\s*\} que será revisado\./);
assert.match(fields, /getRegionsForCountry\(regionCountryCode\)/);

// Diseño del alta (2 columnas en escritorio, 1 hasta 640px) y notas del país en un aviso aparte.
const cssText = componentStyles.replace(/\r\n/g, "\n");
assert.match(cssText, /\.onboarding-card--quick \.quick-business-fields \{\s*align-items: start;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\s*\}/);
assert.match(cssText, /@media \(max-width: 640px\) \{\s*\.onboarding-card--quick \.quick-business-fields \{\s*grid-template-columns: minmax\(0, 1fr\);/);
assert.doesNotMatch(cssText, /\.onboarding-card--quick \.quick-business-fields \{[^}]*repeat\(3/);
assert.match(cssText, /\.quick-business-notes p \{\s*margin: 0;/, "la nota fiscal es un solo párrafo");
assert.doesNotMatch(cssText, /\.quick-business-notes p \+ p/, "sin regla para una segunda frase: el aviso de redondeo se retiró");
// El cajón de negocio adicional no tiene país ni departamento: sin aviso de país y sin grilla de 2 columnas propia.
assert.doesNotMatch(cssText, /\.business-create-drawer[^{]*\.quick-business-fields[^{]*\{[^}]*repeat\(2/);
// Bajo el país solo la línea corta; las notas van en un <Notice> debajo de la grilla, con sus dos frases en párrafos.
assert.match(fields, /const getCountryHelp = \(\) => \(countryHint \? <span>\{countryHint\}<\/span> : ""\);/);
assert.match(fields, /<Notice variant="info" id=\{countryNotesId\} className="quick-business-notes">/);
assert.match(fields, /\{fiscalNote && <p>\{fiscalNote\}<\/p>\}/);
assert.doesNotMatch(fields, /roundingNote|getAmountRoundingNote|amountRounding/, "el aviso de redondeo se retiró (SPEC 036, entrega D)");
assert.ok(fields.indexOf('className="quick-business-fields"') < fields.indexOf("<Notice variant="), "el aviso va debajo de la grilla");
assert.doesNotMatch(fields, /<span>\{fiscalNote\}<\/span>|NON_CHILE_FISCAL_NOTE/);
// Cambiar el país reinicia lo "editado", lo "tocado" y el error de la región.
assert.match(onboarding, /const regionReset =\s*Object\.hasOwn\(patch, "paisCodigo"\) && patch\.paisCodigo !== values\.paisCodigo;/);
assert.match(onboarding, /if \(regionReset\) delete nextErrors\.regionCodigo;/);
assert.match(onboarding, /if \(regionReset\) next\.regionCodigo = false;/);
assert.match(onboarding, /setTouched\(\(current\) => \(\{ \.\.\.current, regionCodigo: false \}\)\);/);
assert.match(onboarding, /if \(regionReset\) next\.regionCodigo = undefined;/);
assert.match(onboarding, /onBlur=\{handleBlur\}/);
assert.doesNotMatch(fields, /CHILE_REGIONS/);
assert.match(fields, /NEW_BUSINESS_COUNTRIES/);
assert.doesNotMatch(fields, /COUNTRIES\.filter/);
assert.match(onboarding, /ONBOARDING_BUSINESS_FIELD_ORDER/);
assert.match(onboarding, /Ingresa lo esencial/);
assert.match(onboarding, /selectedCountry\.name/);
assert.match(onboarding, /selectedCurrency\.code/);
assert.doesNotMatch(onboarding, /más adelante/);
assert.doesNotMatch(onboarding, /onboarding-form__footnote/);
assert.match(drawer, /<QuickBusinessFields/);
assert.match(onboarding, /Crear mi negocio/);
assert.match(fields, /placeholder="Escribe el nombre de tu negocio"/);
assert.match(drawer, /Crear negocio/);
assert.deepEqual(
  normalizeQuickBusinessPayload({
    nombreComercial: "  Bagner   Servicios Integrales ",
    rubroCodigo: "INGENIERIA_CONSULTORIA",
    rubroOtro: "",
    regionCodigo: "",
    paisCodigo: "BO",
  }),
  {
    nombreComercial: "Bagner Servicios Integrales",
    rubroCodigo: "INGENIERIA_CONSULTORIA",
    paisCodigo: "BO",
  }
);
assert.deepEqual(
  normalizeQuickBusinessPayload({
    nombreComercial: "  Mauricio   SPA ",
    rubroCodigo: "TECNOLOGIA_INFORMATICA",
    rubroOtro: "",
    regionCodigo: "01",
    comunaCodigo: "",
    ciudad: "",
    rut: "",
    direccion: "",
    telefono: "",
  }),
  {
    nombreComercial: "Mauricio SPA",
    rubroCodigo: "TECNOLOGIA_INFORMATICA",
    regionCodigo: "01",
  }
);
assert.deepEqual(
  normalizeQuickBusinessPayload({
    nombreComercial: "Otro negocio",
    rubroCodigo: "OTRO_SERVICIO_PROYECTOS",
    rubroOtro: "",
    regionCodigo: "01",
  }),
  {
    nombreComercial: "Otro negocio",
    rubroCodigo: "OTRO_SERVICIO_PROYECTOS",
    regionCodigo: "01",
  }
);
assert.match(onboarding, /setSubmitError\(getBusinessCreationErrorMessage\(error\)\)/);
assert.doesNotMatch(onboarding, /catch[\s\S]*setValues\(INITIAL_QUICK_BUSINESS_VALUES\)/);
assert.doesNotMatch(drawer, /catch[\s\S]*setValues\(INITIAL_QUICK_BUSINESS_VALUES\)/);
assert.match(app, /businessSession\?\.needsOnboarding/);
assert.match(app, /resolveInitialActivationRoute/);
assert.match(app, /onFirstBusinessCreated=\{handleFirstBusinessCreated\}/);
assert.match(activation, /Tu negocio ya está creado/);
assert.match(activation, /Completar y verificar empresa/);
assert.doesNotMatch(activation, /Hacerlo después/);
assert.match(activation, /useBusinessCompletionStatus/);
assert.match(activation, /BusinessCompletionCard/);
assert.match(activation, /finish\("\/empresa\?seccion=verificacion"\)/);
assert.match(activation, /onFinish\?\.\(path\)/);
assert.doesNotMatch(activation, /useNavigate|navigate\(/);
assert.deepEqual(
  resolveInitialActivationRoute({
    activeBusinessId: "business-1",
    destination: "",
    initialBusinessId: "business-1",
    pathname: "/onboarding",
  }),
  { status: "prompt", destination: "" }
);
assert.deepEqual(
  resolveInitialActivationRoute({
    activeBusinessId: "business-1",
    destination: "/empresa",
    initialBusinessId: "business-1",
    pathname: "/onboarding",
  }),
  { status: "redirect", destination: "/empresa" }
);
assert.deepEqual(
  resolveInitialActivationRoute({
    activeBusinessId: "business-1",
    destination: "/empresa",
    initialBusinessId: "business-1",
    pathname: "/empresa",
  }),
  { status: "settled", destination: "/empresa" }
);
assert.deepEqual(
  resolveInitialActivationRoute({
    activeBusinessId: "business-1",
    destination: "/reportes",
    initialBusinessId: "business-1",
    pathname: "/onboarding",
  }),
  { status: "redirect", destination: "/reportes" }
);
assert.deepEqual(
  resolveInitialActivationRoute({
    activeBusinessId: "business-1",
    destination: "",
    initialBusinessId: "",
    pathname: "/empresa",
  }),
  { status: "inactive", destination: "" }
);
assert.match(
  app,
  /initialActivationRoute\.status === "redirect"[\s\S]*?<Navigate to=\{initialActivationRoute\.destination\} replace \/>[\s\S]*?!canAccessBusinessPath/
);
assert.match(app, /path="\/login"[\s\S]*?Navigate to=\{safeLanding\} replace/);
assert.match(app, /path="\/onboarding" element=\{<Navigate to=\{safeLanding\} replace \/>\}/);
assert.match(app, /path="\/" element=\{<Navigate to=\{safeLanding\} replace \/>\}/);
assert.match(app, /path="\/dashboard" element=\{<Navigate to=\{safeLanding\} replace \/>\}/);
assert.match(app, /path="\/resumen" element=\{<Navigate to=\{safeLanding\} replace \/>\}/);
assert.match(
  appLayout,
  /navigate\(canBusinessOperate\(nextBusiness\)[\s\S]*?getDefaultBusinessPath\(nextBusiness, getBusinessPathOptions\(nextBusiness\)\)[\s\S]*?"\/empresa\?seccion=verificacion"/
);
assert.match(componentStyles, /\.activation-checklist li:last-child:nth-child\(odd\)[\s\S]*?grid-column: 1 \/ -1/);
assert.match(componentStyles, /@media \(max-width: 640px\)[\s\S]*?\.activation-checklist li:last-child:nth-child\(odd\)[\s\S]*?grid-column: auto/);
assert.doesNotMatch(navigation, /to: "\/dashboard"/);
const sidebarRoutes = [...navigation.matchAll(/\bto: "(\/[^\"]+)"/g)].map(
  ([, route]) => route
);
assert.deepEqual(sidebarRoutes, [
  "/reportes",
  "/clientes",
  "/cotizaciones",
  "/ventas",
  "/trabajos",
  "/inventario",
  "/proveedores",
  "/ordenes-compra",
  "/recepciones",
  "/compras",
  "/empresa",
  "/empleados",
  "/cuenta",
]);
assert.doesNotMatch(navigation, /label: "Análisis"/);
assert.deepEqual(
  [...navigation.matchAll(/\blabel: "(Inicio|Operación|Comercial|Abastecimiento|Gestión|Cuenta)"/g)]
    .map(([, label]) => label),
  ["Inicio", "Comercial", "Operación", "Abastecimiento", "Gestión", "Cuenta"]
);
const sidebarSections = [{ items: sidebarRoutes.map((to) => ({ to })) }];
const visibleRoutesFor = (role) =>
  filterNavigationSections(sidebarSections, role).flatMap((section) =>
    section.items.map((item) => item.to)
  );
assert.deepEqual(visibleRoutesFor("OWNER"), sidebarRoutes);
assert.deepEqual(visibleRoutesFor("VENTAS"), [
  "/clientes",
  "/cotizaciones",
  "/ventas",
  "/inventario",
  "/cuenta",
]);
assert.deepEqual(visibleRoutesFor("COMPRAS"), [
  "/inventario",
  "/proveedores",
  "/ordenes-compra",
  "/recepciones",
  "/compras",
  "/cuenta",
]);
assert.deepEqual(visibleRoutesFor("TECNICO"), [
  "/trabajos",
  "/inventario",
  "/cuenta",
]);
assert.deepEqual(visibleRoutesFor("FINANZAS"), [
  "/reportes",
  "/ventas",
  "/inventario",
  "/ordenes-compra",
  "/recepciones",
  "/compras",
  "/cuenta",
]);
// Módulos verticales: el registro integrado agrega la sección, pero el filtro
// solo la expone cuando el negocio tiene el vertical habilitado.
const registeredVerticalSections = buildNavigationSections();
assert.equal(navigationSections.some((section) => section.label === "Módulos"), false);
assert.deepEqual(
  registeredVerticalSections.map((section) => section.label).slice(-2),
  ["Módulos", "Cuenta"]
);
assert.deepEqual(
  filterNavigationSections(registeredVerticalSections, "OWNER").map((section) => section.label),
  ["Inicio", "Comercial", "Operación", "Abastecimiento", "Gestión", "Cuenta"]
);
assert.deepEqual(
  filterNavigationSections(
    registeredVerticalSections,
    {role: "OWNER"},
    {enabledModules: ["taller"]}
  ).map((section) => section.label),
  ["Inicio", "Comercial", "Operación", "Abastecimiento", "Gestión", "Módulos", "Cuenta"]
);
// Veterinaria: el ítem del menú lleva sus hijos; con hijos vacíos el filtro lo descartaba.
const verticalModulesFor = (access, enabledModules) =>
  filterNavigationSections(registeredVerticalSections, access, {enabledModules})
    .find((section) => section.label === "Módulos")?.items ?? [];
const bothVerticalItems = verticalModulesFor({role: "OWNER"}, ["taller", "veterinaria"]);
assert.deepEqual(bothVerticalItems.map((item) => item.to), ["/taller", "/clinica-veterinaria"]);
const veterinaryNavItem = bothVerticalItems[1];
assert.deepEqual(
  veterinaryNavItem.children.map((item) => item.to),
  ["/clinica-veterinaria", "/clinica-veterinaria/pacientes", "/clinica-veterinaria/agenda"]
);
assert.deepEqual(
  veterinaryNavItem.children.map((item) => item.label),
  ["Resumen clínico", "Pacientes", "Agenda"]
);
const veterinarySummary = veterinaryNavItem.children[0];
assert.equal(veterinarySummary.activeWhen("/clinica-veterinaria"), true);
assert.equal(veterinarySummary.activeWhen("/clinica-veterinaria/pacientes"), false, "el resumen no queda activo en las pantallas hijas");
assert.equal(veterinaryNavItem.children[1].activeWhen("/clinica-veterinaria/pacientes/abc"), true);
assert.deepEqual(
  verticalModulesFor({role: "OWNER"}, ["veterinaria"]).map((item) => item.to),
  ["/clinica-veterinaria"]
);
assert.deepEqual(
  verticalModulesFor({role: "ADMIN"}, ["veterinaria"]).map((item) => item.to),
  ["/clinica-veterinaria"]
);
assert.deepEqual(verticalModulesFor({role: "OWNER"}, ["taller"]).map((item) => item.to), ["/taller"]);
for (const role of ["VENTAS", "TECNICO", "MEMBER"]) {
  assert.deepEqual(verticalModulesFor({role}, ["veterinaria"]), [], `${role} no ve la Clínica veterinaria`);
}
const testVerticalRegistry = [{ id: "prueba", label: "Módulo de prueba", basePath: "/modulo-prueba" }];
const verticalSections = buildNavigationSections(testVerticalRegistry);
assert.deepEqual(verticalSections.map((section) => section.label).slice(-2), ["Módulos", "Cuenta"]);
const verticalMenuFor = (options) =>
  filterNavigationSections(verticalSections, { role: "OWNER" }, { registry: testVerticalRegistry, ...options })
    .flatMap((section) => section.items.map((item) => item.to));
assert.equal(verticalMenuFor({}).includes("/modulo-prueba"), false, "sin enabledModules el vertical no se ve");
assert.equal(verticalMenuFor({ enabledModules: [] }).includes("/modulo-prueba"), false);
assert.match(app, /key=\{businessId\}/);
assert.match(companyConfig, /ownerOnly: true/);
assert.match(companyConfig, /<CompanyFact\s+label="País"/);
assert.match(companyConfig, /confirmation\.trim\(\) === expectedName/);
assert.match(companyConfig, /Desactivar para todos/);
assert.doesNotMatch(companyConfig, /Eliminar definitivamente/);
// "Empresa verificada" sale de la etiqueta de estado (EM2: es la única mención de "verificada" en Información empresa).
assert.match(await readFile(new URL("../src/services/businessVerificationService.js", import.meta.url), "utf8"), /VERIFICADA: "Empresa verificada"/);
assert.match(companyConfig, /<dt>Estado<\/dt>\s*<dd className=\{form\.verificacionEmpresa\?\.estado === BUSINESS_VERIFICATION_STATES\.VERIFIED \? "is-verified" : ""\}>[\s\S]*?BUSINESS_VERIFICATION_STATUS_LABELS\[/);
assert.match(companyConfig, /aria-label="Resumen de la empresa"/);
assert.match(companyConfig, /<dt>Estado<\/dt>[\s\S]*<dt>Rubro<\/dt>/);
assert.match(companyConfig, /Estos datos forman parte de la verificación\. Si cambian, ValoraCloud solicitará una nueva revisión\./);
// A2: sin aviso amarillo de "invalidará la verificación" (la pantalla no ofrece editar la razón social);
// EM2: la advertencia es una sola nota para toda la franja fiscal, en PENDIENTE y en VERIFICADA.
assert.doesNotMatch(companyConfig, /Cambiar la razón social invalidará/);
assert.doesNotMatch(companyConfig, /Pendiente por completar|recommendedPending/);
assert.match(companyConfig, /\[BUSINESS_VERIFICATION_STATES\.PENDING, BUSINESS_VERIFICATION_STATES\.VERIFIED\]\.includes\(form\.verificacionEmpresa\?\.estado\) && \(\s*<p className="company-verification-strip__note">\s*Estos datos forman parte de la verificación/);
assert.doesNotMatch(companyConfig, /name="razonSocial"/, "la razón social sigue bloqueada: no hay campo para editarla");
assert.doesNotMatch(companyConfig, new RegExp(String.fromCharCode(92) + "u00a0"), "sin secuencias de escape en la fuente");
assert.match(companyConfig, /Resumen tributario protegido/);
assert.match(companyConfig, /Pago y validez/);
assert.match(companyConfig, /Entrega y garantía/);
assert.match(companyConfig, /Condiciones generales/);
assert.match(companyConfig, /Notas finales/);

// Empresa EM2: franja fiscal de solo lectura (un candado, una nota, una sola mención de "verificada").
{
  const count = (text, pattern) => (text.match(pattern) || []).length;
  const infoSection = companyConfig.slice(companyConfig.indexOf("function BusinessInformationSection"), companyConfig.indexOf("function BusinessVerificationSection"));
  const summaryDl = infoSection.slice(infoSection.indexOf('<dl className="company-profile-summary'), infoSection.indexOf("</dl>"));
  const strip = infoSection.slice(infoSection.indexOf("company-verification-strip__header"), infoSection.indexOf("<h3>Datos comerciales</h3>"));
  // 1. Seis datos en una franja, con un solo candado y una sola nota.
  for (const label of ['label="País"', 'label="Moneda nacional"', 'label="Formato regional"', 'label="Identificación fiscal"', 'label="Razón social oficial"']) {
    assert.ok(strip.includes(label), `la franja muestra ${label}`);
  }
  assert.match(strip, /`Estado del \$\{form\.identificadorFiscalTipo \|\| "identificador fiscal"\}`[\s\S]*?targetId="empresa-fiscal"[\s\S]*?value=\{form\.identificadorFiscalValor\}/, "el RUT (o su estado) sigue en la franja y conserva el objetivo de foco");
  assert.match(strip, /targetId="empresa-configuracion"/, "el objetivo de foco de País se conserva");
  assert.equal(count(strip, /<AppIcon icon=\{Lock\}/g), 1, "un solo candado en la franja");
  assert.doesNotMatch(infoSection, /<LockedSetting|settings-locked-field/, "ya no hay seis campos grises con un candado cada uno");
  assert.equal(count(infoSection, /forman parte de la verificación/g), 1, "una sola nota");
  assert.doesNotMatch(infoSection, /Este dato forma parte/, "sin la nota por campo");
  // 2. Una sola mención de "verificada" en la sección: el Estado del resumen.
  assert.doesNotMatch(infoSection, /Verificación vigente|company-verified-status|✓ Verificado|"Empresa verificada"|company-authoritative-card|(?<!no) verificado`/, "sin insignia, título ni etiquetas que repitan 'verificada'");
  assert.equal(count(summaryDl, /BUSINESS_VERIFICATION_STATUS_LABELS\[/g), 1, "el Estado del resumen es la única mención");
  assert.match(strip, /<h3>Datos fiscales<\/h3>/, "título neutro de la franja");
  // 3. El resumen no repite lo de la franja: solo Estado y Rubro.
  assert.equal(count(summaryDl, /<dt>/g), 2);
  assert.doesNotMatch(summaryDl, /<dt>(País|Razón social)<\/dt>|identificadorFiscal|razonSocial|paisNombre/, "el resumen no repite país, RUT ni razón social");
  assert.match(summaryDl, /getBusinessCategoryVisibleName\(form\.rubroCodigo, form\.rubroOtro, form\.rubroNombre\)/, "el rubro conserva su nombre visible");
  // 4. Todos los estados de verificación conservan sus textos y acciones.
  assert.match(strip, /BUSINESS_VERIFICATION_STATES\.VERIFIED && \(|!== BUSINESS_VERIFICATION_STATES\.VERIFIED && \(/, "pendiente, rechazada y sin verificar siguen en la franja");
  assert.match(strip, /settings-verification-pill is-\$\{/, "la insignia por estado se conserva");
  assert.match(strip, /\$\{form\.identificadorFiscalTipo \|\| "Identificador fiscal"\} no verificado/, "texto de sin verificar");
  assert.match(strip, /BUSINESS_VERIFICATION_STATUS_LABELS\[\s*form\.verificacionEmpresa\?\.estado \|\| BUSINESS_VERIFICATION_STATES\.NOT_VERIFIED\s*\]/, "textos de pendiente y rechazada (etiquetas del servicio)");
  assert.match(strip, /navigate\("\/empresa\?seccion=verificacion"\)[\s\S]*?Ir a verificación/, "la acción Ir a verificación se conserva");
  const serviceLabels = await readFile(new URL("../src/services/businessVerificationService.js", import.meta.url), "utf8");
  for (const text of ["Empresa no verificada", "Verificación en revisión", "Empresa verificada", "Verificación empresarial rechazada"]) {
    assert.ok(serviceLabels.includes(`"${text}"`), `etiqueta de estado: ${text}`);
  }
  // 5. Estilos nuevos: solo tokens.
  const interiorCss = (await readFile(new URL("../src/styles/interior.css", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const cssStart = interiorCss.indexOf("/* Resumen compacto (Estado y Rubro)");
  const stripCss = interiorCss.slice(cssStart, interiorCss.indexOf("\n}\n", interiorCss.indexOf("@media (max-width: 640px)", cssStart)) + 3).replace(/@media[^{]*\{/g, "");
  assert.ok(cssStart > 0 && stripCss.includes(".company-verification-strip__facts"), "se encontró el bloque de estilos nuevos");
  assert.doesNotMatch(stripCss, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|(?<![\d.])(?!1px\b)\d+px|var\(--color-(brand|dark)-/, "los estilos nuevos usan solo tokens semánticos");
}

// Empresa EM2b: recuadros suaves, dos filas, acento verde solo en el RUT verificado y toque de marca en la tarjeta.
{
  const count = (text, pattern) => (text.match(pattern) || []).length;
  const infoSection = companyConfig.slice(companyConfig.indexOf("function BusinessInformationSection"), companyConfig.indexOf("function BusinessVerificationSection"));
  const strip = infoSection.slice(infoSection.indexOf("company-verification-strip__header"), infoSection.indexOf("<h3>Datos comerciales</h3>"));
  const factComponent = companyConfig.slice(companyConfig.indexOf("function CompanyFact("), companyConfig.indexOf("function SectionFrame("));
  const interiorCss = (await readFile(new URL("../src/styles/interior.css", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const rule = (selector) => {
    const at = interiorCss.indexOf(`${selector} {`);
    assert.ok(at >= 0, `existe la regla ${selector}`);
    return interiorCss.slice(at, interiorCss.indexOf("\n}\n", at) + 3);
  };
  // 1. Cada dato en su recuadro suave: fondo y borde fino con tokens, etiqueta arriba y valor abajo.
  const factRule = rule(".company-verification-strip__fact");
  assert.match(factRule, /background: var\(--color-surface-subtle\);/);
  assert.match(factRule, /border: 1px solid var\(--color-border-subtle\);/);
  assert.match(factRule, /border-radius: var\(--radius-sm\);/);
  assert.match(factRule, /padding: var\(--space-2\) var\(--space-3\);/);
  assert.match(factComponent, /<dt>\{label\}<\/dt>\s*<dd>/, "etiqueta arriba y valor abajo");
  assert.match(rule(".company-verification-strip__fact dt"), /font-size: var\(--font-size-xs\);/, "etiqueta pequeña");
  assert.match(rule(".company-verification-strip__fact dd"), /font-weight: var\(--font-weight-semibold\);/, "valor en negrita");
  // 2. Distribución: 4 en la primera fila; RUT y razón social, de 2 columnas cada uno, en la segunda.
  assert.match(rule(".company-verification-strip__facts"), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(rule(".company-verification-strip__fact--wide"), /grid-column: span 2;/);
  const facts = strip.split("<CompanyFact").slice(1);
  assert.equal(facts.length, 6, "seis datos");
  facts.slice(0, 4).forEach((fact, index) => assert.doesNotMatch(fact, /\bwide\b/, `el dato ${index + 1} ocupa una columna`));
  assert.match(facts[4], /^\s+wide$/m, "el RUT ocupa dos columnas aunque no esté verificado");
  assert.match(facts[5], /\bwide\s*\/>/, "la razón social ocupa dos columnas");
  assert.match(interiorCss, /@media \(max-width: 900px\) \{\s*\.company-verification-strip__facts \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, "dos columnas en pantallas medianas");
  assert.match(interiorCss, /@media \(max-width: 640px\) \{[\s\S]*?\.company-verification-strip__fact--wide \{\s*grid-column: auto;/, "una columna en móvil, sin columna implícita");
  // 3. Acento verde sobrio solo en el RUT verificado, con check de texto accesible y sin textos visibles nuevos.
  assert.equal(count(strip, /accent=\{/g), 1, "un solo recuadro con acento");
  assert.match(facts[4], /accent=\{isVerified\}/, "el acento es del RUT y solo cuando está verificada");
  assert.equal(count(infoSection, /aria-label="Verificado"/g), 1, "un solo check con texto accesible");
  assert.match(facts[4], /trailing=\{isVerified \? \(\s*<span className="company-verification-strip__check" role="img" aria-label="Verificado">\s*<AppIcon icon=\{Check\} size=\{15\} \/>/, "el check solo aparece verificada");
  assert.doesNotMatch(infoSection, />\s*Verificado\s*<|Verificación vigente|✓ Verificado|"Empresa verificada"/, "ningún texto visible nuevo de verificada");
  const accent = rule(".company-verification-strip__fact--verified");
  assert.match(accent, /background: var\(--color-success-50\);/);
  assert.match(accent, /border-color: var\(--color-success-200\);/);
  assert.match(interiorCss, /\.company-verification-strip__fact--verified dt,\s*\.company-verification-strip__fact--verified dd \{\s*color: var\(--color-success-700\);/, "texto verde con el mismo par ya usado por el estado verificado");
  // 4. Tarjeta con toque de marca solo verificada; neutra en pendiente, rechazada y sin verificar; un candado y la nota.
  assert.match(infoSection, /const isVerified = form\.verificacionEmpresa\?\.estado === BUSINESS_VERIFICATION_STATES\.VERIFIED;/);
  assert.match(infoSection, /company-verification-strip\$\{isVerified \? " company-verification-strip--verified" : ""\}/, "el modificador solo con isVerified");
  assert.match(rule(".company-verification-strip.company-verification-strip--verified"), /border-color: var\(--color-text-brand-accent\);/, "borde con el color de marca");
  assert.equal(count(strip, /<AppIcon icon=\{Lock\}/g), 1, "se conserva un solo candado");
  assert.equal(count(infoSection, /Estos datos forman parte de la verificación\. Si cambian, ValoraCloud solicitará una nueva revisión\./g), 1, "se conserva la nota");
  assert.match(strip, /targetId="empresa-fiscal"/, "se conserva el objetivo de foco empresa-fiscal");
}
assert.match(businessService, /httpsCallable\(functions, "deleteBusiness"\)/);
assert.doesNotMatch(drawer, /onLimitReached|resource-exhausted/);
assert.doesNotMatch(
  appLayout,
  /businessLimitOpen|canCreateBusiness === false|Alcanzaste el límite/
);
assert.match(appLayout, /shouldRefreshBusinessSessionForVerification/);
assert.match(appLayout, /verificationToastTitle: "Empresa verificada"/);
assert.match(appLayout, /verificationToastDescription: "Los módulos operativos ya están disponibles\."/);
assert.doesNotMatch(appLayout, /window\.location\.reload|setInterval/);

// --- Salir de un campo (blur): el error no aparece antes de que el usuario edite ---
// businessForm.js importa sin extensión, así que se carga con Vite (mismo patrón que disclosure-smoke).
const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let shouldValidateOnBlur;
let validateQuickBusiness;
let INITIAL_ONBOARDING_BUSINESS_VALUES;
let applyQuickBusinessChange;
let ONBOARDING_BUSINESS_FIELD_ORDER;
let QuickBusinessFields;
try {
  QuickBusinessFields = (await vite.ssrLoadModule("/src/components/QuickBusinessFields.jsx")).default;
  ({ INITIAL_ONBOARDING_BUSINESS_VALUES, ONBOARDING_BUSINESS_FIELD_ORDER, applyQuickBusinessChange, shouldValidateOnBlur, validateQuickBusiness } = await vite.ssrLoadModule(
    "/src/domain/businessForm.js"
  ));
} finally {
  await vite.close();
}
const picker = await readFile(new URL("../src/components/BusinessCategoryPicker.jsx", import.meta.url), "utf8");

// Render real del formulario: Chile, Bolivia y el cajón de negocio adicional (sin país ni departamento).
const renderFields = (props) =>
  renderToStaticMarkup(
    React.createElement(QuickBusinessFields, {
      errors: {},
      idPrefix: "t",
      onBlur() {},
      onChange() {},
      values: { nombreComercial: "", rubroCodigo: "", rubroOtro: "", regionCodigo: "" },
      ...props,
    })
  );
const FISCAL = "ValoraCloud calcula el IVA con la tasa de Bolivia (13 %). La facturación y los impuestos propios de Bolivia, como el IT, no están incluidos.";
const boliviaHtml = renderFields({
  showCountry: true,
  countryHint: "Bolivia · BOB",
  values: { ...INITIAL_ONBOARDING_BUSINESS_VALUES, paisCodigo: "BO" },
});
// Departamento (no Región), con los 9 departamentos y la etiqueta de la lista.
assert.match(boliviaHtml, /<label for="t-regionCodigo">Departamento/);
assert.match(boliviaHtml, /Selecciona un departamento/);
for (const name of ["La Paz", "Cochabamba", "Santa Cruz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando"]) {
  assert.ok(boliviaHtml.includes(`>${name}</option>`), name);
}
assert.doesNotMatch(boliviaHtml, /Metropolitana de Santiago/, "la lista de Chile no aparece en Bolivia");
// Bajo el país solo la línea corta.
assert.match(boliviaHtml, /<p id="t-paisCodigo-message" class="quick-business-field__hint"><span>Bolivia · BOB<\/span><\/p>/);
const countryHint = boliviaHtml.match(/<p id="t-paisCodigo-message"[^>]*>(.*?)<\/p>/)?.[1] || "";
assert.ok(!countryHint.includes("fiscales") && !countryHint.includes("redondean"), "las notas ya no van bajo el país");
// Aviso informativo debajo de la grilla: solo la nota fiscal (el aviso de redondeo se retiró al activar los decimales).
const gridEnd = boliviaHtml.indexOf("quick-business-notes");
assert.ok(gridEnd > boliviaHtml.lastIndexOf("t-regionCodigo"), "el aviso va después de la región");
assert.ok(boliviaHtml.includes(`<p>${FISCAL}</p>`), "la nota fiscal va en su párrafo");
assert.doesNotMatch(boliviaHtml, /redondean|se guarda como/, "Bolivia ya no avisa de redondeo al entero");
assert.doesNotMatch(boliviaHtml, /pensadas para Chile|están en revisión/);
assert.match(boliviaHtml, /class="ui-notice ui-notice--info quick-business-notes"/);
assert.match(boliviaHtml, /aria-describedby="t-paisCodigo-message t-country-notes"/);
// Chile: región de la lista y ningún aviso.
const chileHtml = renderFields({
  showCountry: true,
  countryHint: "Chile · CLP",
  values: { ...INITIAL_ONBOARDING_BUSINESS_VALUES, paisCodigo: "CL" },
});
assert.match(chileHtml, /<label for="t-regionCodigo">Región/);
assert.ok(chileHtml.includes(">Metropolitana de Santiago</option>"));
assert.doesNotMatch(chileHtml, /quick-business-notes|redondean|fiscales/);
assert.match(chileHtml, /<span>Chile · CLP<\/span>/);
// Cajón de negocio adicional: sin país ni departamento nuevo, región de Chile como siempre y sin avisos de país.
const drawerHtml = renderFields({});
assert.doesNotMatch(drawerHtml, /t-paisCodigo/);
assert.match(drawerHtml, /<label for="t-regionCodigo">Región/);
assert.doesNotMatch(drawerHtml, /quick-business-notes|Departamento/);
// Orden de los campos: Nombre, Rubro, País, Región.
const order = ["t-nombreComercial", "t-rubroCodigo", "t-paisCodigo", "t-regionCodigo"].map((id) => boliviaHtml.indexOf(`for="${id}"`));
assert.deepEqual([...order].sort((a, b) => a - b), order, "Nombre | Rubro y País | Región en ese orden");

assert.equal(typeof shouldValidateOnBlur, "function");
// Salir sin editar (ni intentar enviar): sin error.
assert.equal(shouldValidateOnBlur({ submitted: false, dirty: false, hasPatch: false }), false, "salir sin editar no valida");
assert.equal(shouldValidateOnBlur({}), false, "sin datos no valida");
assert.equal(shouldValidateOnBlur(), false, "sin argumento no valida");
// Editar y salir: con error (el validador lo da: nombre de 1 letra).
assert.equal(shouldValidateOnBlur({ submitted: false, dirty: true, hasPatch: false }), true, "editar y salir valida");
assert.equal(
  validateQuickBusiness({ ...INITIAL_ONBOARDING_BUSINESS_VALUES, nombreComercial: "a" }, { requireCountry: true, requireRegion: false })
    .nombreComercial,
  "El nombre debe tener al menos 2 caracteres."
);
// El formulario valida el país con el mismo flag que decide qué países se ofrecen (Chile y Bolivia).
const countryError = (paisCodigo) =>
  validateQuickBusiness({ ...INITIAL_ONBOARDING_BUSINESS_VALUES, paisCodigo }, { requireCountry: true, requireRegion: false }).paisCodigo;
for (const paisCodigo of ["PY", "BR", "PE", "AR", "CO", "EC", "UY", "MX", "OTHER"]) {
  assert.equal(countryError(paisCodigo), "Selecciona un país válido.", paisCodigo + " no es válido al crear una empresa");
}
for (const paisCodigo of ["CL", "BO"]) {
  assert.equal(countryError(paisCodigo), undefined, paisCodigo + " sí es válido al crear una empresa");
}

// Región obligatoria en el onboarding, de la lista del país elegido.
assert.deepEqual(ONBOARDING_BUSINESS_FIELD_ORDER, ["nombreComercial", "rubroCodigo", "paisCodigo", "regionCodigo"]);
const regionError = (values) =>
  validateQuickBusiness(
    { ...INITIAL_ONBOARDING_BUSINESS_VALUES, nombreComercial: "Taller", rubroCodigo: "TALLER_AUTOMOTRIZ", ...values },
    { requireCountry: true, requireRegion: true }
  ).regionCodigo;
assert.equal(regionError({ paisCodigo: "CL", regionCodigo: "" }), "Selecciona una región.");
assert.equal(regionError({ paisCodigo: "CL", regionCodigo: "13" }), undefined);
assert.equal(regionError({ paisCodigo: "CL", regionCodigo: "LP" }), "Selecciona una región.", "un departamento de Bolivia no vale en Chile");
assert.equal(regionError({ paisCodigo: "BO", regionCodigo: "" }), "Selecciona un departamento.");
assert.equal(regionError({ paisCodigo: "BO", regionCodigo: "SC" }), undefined);
assert.equal(regionError({ paisCodigo: "BO", regionCodigo: "13" }), "Selecciona un departamento.", "una región de Chile no vale en Bolivia");
// Sin país en los valores (negocio adicional) cuenta como Chile: el cajón no cambia.
assert.equal(validateQuickBusiness({ nombreComercial: "Taller", rubroCodigo: "TALLER_AUTOMOTRIZ", regionCodigo: "" }).regionCodigo, "Selecciona una región.");
assert.equal(validateQuickBusiness({ nombreComercial: "Taller", rubroCodigo: "TALLER_AUTOMOTRIZ", regionCodigo: "13" }).regionCodigo, undefined);
// Cambiar el país limpia la región; cambiar otro campo no.
assert.deepEqual(applyQuickBusinessChange({ paisCodigo: "CL", regionCodigo: "13" }, { paisCodigo: "BO" }), { paisCodigo: "BO", regionCodigo: "" });
assert.deepEqual(applyQuickBusinessChange({ paisCodigo: "CL", regionCodigo: "13" }, { paisCodigo: "CL" }), { paisCodigo: "CL" }, "mismo país: la región se conserva");
assert.deepEqual(applyQuickBusinessChange({ paisCodigo: "BO", regionCodigo: "SC" }, { nombreComercial: "X" }), { nombreComercial: "X" });
assert.deepEqual(applyQuickBusinessChange({ paisCodigo: "BO", regionCodigo: "SC" }, { paisCodigo: "" }), { paisCodigo: "", regionCodigo: "" });
// Escribir y borrar: el campo sigue editado aunque el valor vuelva a vacío, y entonces sí hay error.
for (const [name, source, stateName] of [
  ["OnboardingPage", onboarding, "dirty"],
  ["AdditionalBusinessDrawer", drawer, "editedFields"],
]) {
  const setter = stateName === "dirty" ? "setDirty" : "setEditedFields";
  assert.match(
    source,
    new RegExp(String.raw`${setter}\(\(current\) => \{\s*const next = \{ \.\.\.current \};\s*for \(const changedField of Object\.keys\(patch\)\) next\[changedField\] = true;`),
    `${name}: editar marca el campo sin mirar el valor (escribir y borrar sigue editado)`
  );
}
assert.equal(shouldValidateOnBlur({ submitted: false, dirty: true, hasPatch: false }), true, "escribir y borrar valida");
assert.equal(
  validateQuickBusiness({ ...INITIAL_ONBOARDING_BUSINESS_VALUES, nombreComercial: "" }, { requireCountry: true, requireRegion: false })
    .nombreComercial,
  "Ingresa el nombre del negocio."
);
// Cerrar el selector de rubro sin elegir: onTouched() sin parche, y el campo no está editado: sin error.
assert.match(picker, /const closePicker = \(\) => \{\s*setOpen\(false\);\s*onTouched\?\.\(\);\s*\};/, "cerrar el selector no manda parche");
assert.match(fields, /onTouched=\{\(patch\) => onBlur\(field, patch\)\}/, "el parche del selector llega a onBlur tal cual");
assert.equal(shouldValidateOnBlur({ submitted: false, dirty: false, hasPatch: false }), false, "cerrar el rubro sin elegir no valida");
// Confirmar un rubro (con parche): valida aunque el campo no figure como editado.
assert.match(picker, /onTouched\?\.\(\{\s*rubroCodigo: draftCode,/, "confirmar manda el parche con el rubro elegido");
assert.equal(shouldValidateOnBlur({ submitted: false, dirty: false, hasPatch: true }), true, "confirmar con parche valida");
const withCategory = (rubroCodigo) =>
  validateQuickBusiness(
    { ...INITIAL_ONBOARDING_BUSINESS_VALUES, rubroCodigo, rubroOtro: "" },
    { requireCountry: true, requireRegion: false }
  ).rubroCodigo;
assert.equal(withCategory("TALLER_AUTOMOTRIZ"), undefined, "el rubro confirmado no da error");
assert.equal(withCategory("INGENIERIA_CONSULTORIA"), undefined, "Ingeniería y consultoría sigue siendo seleccionable");
for (const hiddenCode of ["SEGURIDAD_TELECOMUNICACIONES", "AUTOMATIZACION_CONTROL", "MANTENIMIENTO_INSTALACIONES"]) {
  assert.equal(withCategory(hiddenCode), "Selecciona el rubro principal.", `${hiddenCode} oculto ya no se acepta al crear`);
}
assert.equal(withCategory(""), "Selecciona el rubro principal.", "sin rubro elegido el validador sí da error");
// Después de intentar enviar: siempre valida.
for (const state of [
  { submitted: true, dirty: false, hasPatch: false },
  { submitted: true, dirty: true, hasPatch: true },
  { submitted: true },
]) {
  assert.equal(shouldValidateOnBlur(state), true, `submitted siempre valida: ${JSON.stringify(state)}`);
}
// Las dos pantallas usan la función antes de marcar el campo como tocado.
for (const [name, source, stateName] of [
  ["OnboardingPage", onboarding, "dirty"],
  ["AdditionalBusinessDrawer", drawer, "editedFields"],
]) {
  assert.match(source, /shouldValidateOnBlur,\s*validateQuickBusiness,\s*\} from "\.\.\/domain\/businessForm";/, `${name}: importa shouldValidateOnBlur`);
  const body = source.slice(source.indexOf("const validateField = "));
  assert.match(
    body,
    new RegExp(String.raw`if \(\s*!shouldValidateOnBlur\(\{\s*submitted,\s*dirty: Boolean\(${stateName}\[field\]\),\s*hasPatch: Object\.keys\(patch\)\.length > 0,\s*\}\)\s*\) \{\s*return;\s*\}`),
    `${name}: validateField sale temprano sin editar`
  );
  assert.ok(
    body.indexOf("shouldValidateOnBlur") < body.indexOf("setTouched((current) => ({ ...current, [field]: true }))"),
    `${name}: el guard va antes de marcar el campo como tocado`
  );
}
assert.match(drawer, /setErrors\(\{\}\);\s*setTouched\(\{\}\);\s*setEditedFields\(\{\}\);\s*setSubmitted\(false\);/, "el drawer reinicia lo editado al abrirse");
console.log("OK: blur — sin error al salir sin editar, con error tras editar o borrar, selector sin elegir sin error, parche y submitted validan");

console.log("BUSINESS_QUICK_FLOW_SMOKE_OK");
