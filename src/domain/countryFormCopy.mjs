import {
  getFiscalIdentifierLabel,
  getFiscalIdentifierPlaceholder,
  normalizeCountryCode,
} from "./fiscalIdentifier.mjs";

// Textos y ejemplos de los formularios que cambian según el país (perfil de empresa, verificación, clientes y
// proveedores). Los componentes piden aquí lo que muestran, sin "si es Bolivia" sueltos. Solo cambia lo que se
// ve: los nombres de los campos internos (giro, rut...) y lo que se guarda no dependen de este archivo.
//
// Texto guía (placeholder) de los campos de texto de cliente y proveedor, en dos capas:
// - Capa 1, LOCAL_FORM_EXAMPLES: países con ejemplos propios (hoy Chile y Bolivia). Empiezan con "Ej." y enseñan el
//   formato local. Son neutros de rubro (nada de "repuestos", "transporte"...).
// - Capa 2, GENERIC_FIELD_HINTS: cualquier otro país, o un campo que un país no define. Es un texto de instrucción
//   en español, sin "Ej.", sin rubro ni país ("Escribe el correo electrónico"). Se define una sola vez y lo heredan
//   cliente y proveedor: un país nuevo solo agrega sus ejemplos a LOCAL_FORM_EXAMPLES, sin tocar componentes.
// - Los selects (tipo de cliente, condiciones de pago, región de Chile y departamento de Bolivia) no llevan texto
//   guía. Donde un país tiene lista (comuna de Chile, departamento de Bolivia) el ejemplo del campo vale null.
// El resto de las claves (perfil de empresa, verificación) conserva lo que ya mostraba: BASE es Chile.

const BASE = Object.freeze({
  // Etiqueta visible del campo interno `giro` (perfil de empresa y cliente tipo Empresa).
  businessActivityLabel: "Giro",
  companyPhoneExample: "+56 9 1234 5678",
  companyEmailExample: "contacto@empresa.cl",
  companyWebsiteExample: "https://www.empresa.cl",
  companyPostalCodeExample: "Ej.: 1100000",
  // Formulario "Completar y verificar empresa": hoy sin ejemplos.
  declaredFiscalIdExample: null,
  requesterEmailExample: null,
  requesterPhoneExample: null,
  // Identificador de un cliente tipo Persona cuando difiere del de la empresa (null = el mismo).
  personFiscalLabel: null,
  personFiscalExample: null,
});

// Capa 2: un solo lugar para los textos de instrucción.
export const GENERIC_FIELD_HINTS = Object.freeze({
  fiscalId: "Escribe el identificador fiscal",
  personName: "Escribe el nombre completo",
  legalName: "Escribe el nombre o razón social",
  tradeName: "Escribe el nombre de fantasía",
  businessActivity: "Escribe la actividad económica",
  email: "Escribe el correo electrónico",
  phone: "Escribe el teléfono de contacto",
  contactPerson: "Escribe el nombre de la persona de contacto",
  address: "Escribe la dirección",
  region: "Escribe el departamento o región",
  municipality: "Escribe el municipio o comuna",
  notes: "Escribe una nota interna",
  creditDays: "Escribe los días de crédito",
});

// Qué instrucción de la capa 2 corresponde a cada clave de texto guía.
const GENERIC_HINT_BY_KEY = Object.freeze({
  clientCompanyNameExample: "legalName",
  clientPersonNameExample: "personName",
  clientBusinessActivityExample: "businessActivity",
  clientContactPersonExample: "contactPerson",
  clientCompanyEmailExample: "email",
  clientPersonEmailExample: "email",
  clientPhoneExample: "phone",
  clientAddressExample: "address",
  clientNotesExample: "notes",
  providerLegalNameExample: "legalName",
  providerTradeNameExample: "tradeName",
  providerBusinessActivityExample: "businessActivity",
  providerEmailExample: "email",
  providerPhoneExample: "phone",
  providerContactPersonExample: "contactPerson",
  providerAddressExample: "address",
  providerCreditDaysExample: "creditDays",
  providerNotesExample: "notes",
  territoryRegionExample: "region",
  territoryMunicipalityExample: "municipality",
});

export const FORM_HINT_KEYS = Object.freeze(Object.keys(GENERIC_HINT_BY_KEY));

const GENERIC_FORM_COPY = Object.freeze(Object.fromEntries(
  Object.entries(GENERIC_HINT_BY_KEY).map(([key, hint]) => [key, GENERIC_FIELD_HINTS[hint]]),
));

// Capa 1: Chile y Bolivia. Cada entrada lista todas las claves; lo que falte hereda la capa 2.
const LOCAL_FORM_EXAMPLES = Object.freeze({
  CL: Object.freeze({
    clientCompanyNameExample: "Ej. Comercial Andina SpA",
    clientPersonNameExample: "Ej. Nombre Apellido",
    clientBusinessActivityExample: "Ej. Venta de productos y servicios",
    clientContactPersonExample: "Ej. Nombre Apellido",
    clientCompanyEmailExample: "Ej. contacto@empresa.cl",
    clientPersonEmailExample: "Ej. nombre@correo.cl",
    clientPhoneExample: "Ej. +56 9 6123 4587",
    clientAddressExample: "Ej. Av. Arturo Prat 123",
    clientNotesExample: "Ej. Prefiere contacto por WhatsApp",
    providerLegalNameExample: "Ej. Comercial Andina SpA",
    providerTradeNameExample: "Ej. Comercial Andina",
    providerBusinessActivityExample: "Ej. Venta de productos y servicios",
    providerEmailExample: "Ej. contacto@empresa.cl",
    providerPhoneExample: "Ej. +56 9 6123 4587",
    providerContactPersonExample: "Ej. Nombre Apellido",
    providerAddressExample: "Ej. Av. Arturo Prat 123",
    providerCreditDaysExample: "Ej. 30",
    providerNotesExample: "Ej. Prefiere contacto por WhatsApp",
    // Región y comuna de Chile son listas: no llevan texto guía.
    territoryRegionExample: null,
    territoryMunicipalityExample: null,
  }),
  BO: Object.freeze({
    clientCompanyNameExample: "Ej. Comercial Andina S.R.L.",
    clientPersonNameExample: "Ej. Nombre Apellido",
    clientBusinessActivityExample: "Ej. Venta de productos y servicios",
    clientContactPersonExample: "Ej. Nombre Apellido",
    clientCompanyEmailExample: "Ej. contacto@empresa.com.bo",
    clientPersonEmailExample: "Ej. nombre@correo.com.bo",
    clientPhoneExample: "Ej. +591 7xxxxxxx",
    clientAddressExample: "Ej. Av. Banzer 123",
    clientNotesExample: "Ej. Prefiere contacto por WhatsApp",
    providerLegalNameExample: "Ej. Comercial Andina S.R.L.",
    providerTradeNameExample: "Ej. Comercial Andina",
    providerBusinessActivityExample: "Ej. Venta de productos y servicios",
    providerEmailExample: "Ej. contacto@empresa.com.bo",
    providerPhoneExample: "Ej. +591 7xxxxxxx",
    providerContactPersonExample: "Ej. Nombre Apellido",
    providerAddressExample: "Ej. Av. Banzer 123",
    providerCreditDaysExample: "Ej. 30",
    providerNotesExample: "Ej. Prefiere contacto por WhatsApp",
    // El departamento de Bolivia es una lista; el municipio es texto libre.
    territoryRegionExample: null,
    territoryMunicipalityExample: "Ej. Santa Cruz de la Sierra",
  }),
});

// Un país con entrada propia (hoy Bolivia) sobrescribe lo suyo del perfil de empresa y la verificación.
const COUNTRY_COPY = Object.freeze({
  BO: Object.freeze({
    businessActivityLabel: "Actividad económica",
    companyPhoneExample: "+591 7xxxxxxx",
    companyEmailExample: "contacto@empresa.com.bo",
    companyWebsiteExample: "https://www.empresa.com.bo",
    // El código postal chileno no sirve de ejemplo en Bolivia.
    companyPostalCodeExample: null,
    declaredFiscalIdExample: "Ej.: 1023456789",
    requesterEmailExample: "nombre@empresa.com.bo",
    requesterPhoneExample: "+591 7xxxxxxx",
    // En Bolivia la persona natural se identifica habitualmente con su CI, no con un NIT.
    personFiscalLabel: "CI o NIT",
    personFiscalExample: "Ej.: 1234567",
  }),
});

export function getCountryFormCopy(countryCode) {
  const code = normalizeCountryCode(countryCode);
  return Object.freeze({
    ...BASE,
    ...GENERIC_FORM_COPY,
    ...(LOCAL_FORM_EXAMPLES[code] || {}),
    ...(COUNTRY_COPY[code] || {}),
  });
}

// Texto guía del identificador fiscal: el ejemplo del país si lo tiene; si no (país sin ejemplo propio), la
// instrucción neutra de la capa 2.
export function getFiscalIdentifierHint(countryCode) {
  const code = normalizeCountryCode(countryCode);
  const example = getFiscalIdentifierPlaceholder(code);
  return example === getFiscalIdentifierPlaceholder("OTHER") ? GENERIC_FIELD_HINTS.fiscalId : example;
}

// Etiqueta y texto guía del identificador fiscal de un cliente según su tipo ("persona" o "empresa").
export function getClientFiscalCopy(countryCode, clientType) {
  const code = normalizeCountryCode(countryCode);
  const copy = getCountryFormCopy(code);
  const isPerson = String(clientType || "").toLowerCase() === "persona";
  return {
    label: isPerson && copy.personFiscalLabel ? copy.personFiscalLabel : getFiscalIdentifierLabel(code),
    placeholder: isPerson && copy.personFiscalExample ? copy.personFiscalExample : getFiscalIdentifierHint(code),
  };
}

// Etiqueta del identificador fiscal en las listas, buscadores y avisos de clientes, donde conviven Personas y
// Empresas (Bolivia: "CI o NIT"; Chile y el resto: la del país, como siempre).
export function getClientFiscalListLabel(countryCode) {
  return getClientFiscalCopy(countryCode, "persona").label;
}
