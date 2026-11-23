import {
  getFiscalIdentifierLabel,
  getFiscalIdentifierPlaceholder,
  normalizeCountryCode,
} from "./fiscalIdentifier.mjs";

// Textos y ejemplos de los formularios que cambian según el país (perfil de empresa, verificación y
// clientes). Los componentes piden aquí lo que muestran, sin "si es Bolivia" sueltos. Solo cambia lo que se
// ve: los nombres de los campos internos (giro, rut...) y lo que se guarda no dependen de este archivo.
//
// - BASE es lo que se mostraba antes de esta SPEC (Chile). Chile no cambia.
// - NON_CHILE conserva lo que ya se mostraba en el resto de los países (hoy solo cambia el ejemplo de teléfono
//   del cliente).
// - Un país con entrada propia (hoy Bolivia) sobrescribe lo suyo. `null` = sin ejemplo (no se pone placeholder).

const BASE = Object.freeze({
  // Etiqueta visible del campo interno `giro` (perfil de empresa y cliente tipo Empresa).
  businessActivityLabel: "Giro",
  companyPhoneExample: "+56 9 1234 5678",
  companyEmailExample: "contacto@empresa.cl",
  companyWebsiteExample: "https://www.empresa.cl",
  companyPostalCodeExample: "Ej.: 1100000",
  clientPhoneExample: "Ej. +56 9 6123 4587",
  clientCompanyEmailExample: "Ej. contacto@empresa.cl",
  clientPersonEmailExample: "Ej. nombre@correo.cl",
  // Formulario de cliente: dirección y giro dependen del país; contacto y notas son iguales en todos.
  clientAddressExample: "Ej. Av. Arturo Prat 123",
  clientBusinessActivityExample: "Ej. Venta de repuestos automotrices",
  clientContactPersonExample: "Ej. Nombre Apellido",
  clientNotesExample: "Ej. Prefiere contacto por WhatsApp",
  // Formulario "Completar y verificar empresa": hoy sin ejemplos.
  declaredFiscalIdExample: null,
  requesterEmailExample: null,
  requesterPhoneExample: null,
  // Identificador de un cliente tipo Persona cuando difiere del de la empresa (null = el mismo).
  personFiscalLabel: null,
  personFiscalExample: null,
});

const NON_CHILE = Object.freeze({
  clientPhoneExample: "Ej. +1 202 555 0100",
  // Los ejemplos de dirección y giro son de Chile: en otros países el campo sigue sin ejemplo, como hoy.
  clientAddressExample: null,
  clientBusinessActivityExample: null,
});

const COUNTRY_COPY = Object.freeze({
  BO: Object.freeze({
    businessActivityLabel: "Actividad económica",
    companyPhoneExample: "+591 7xxxxxxx",
    companyEmailExample: "contacto@empresa.com.bo",
    companyWebsiteExample: "https://www.empresa.com.bo",
    // El código postal chileno no sirve de ejemplo en Bolivia.
    companyPostalCodeExample: null,
    clientPhoneExample: "Ej. +591 7xxxxxxx",
    clientCompanyEmailExample: "Ej. contacto@empresa.com.bo",
    clientPersonEmailExample: "Ej. nombre@correo.com.bo",
    clientAddressExample: "Ej. Av. Banzer 123",
    clientBusinessActivityExample: "Ej. Transporte de carga",
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
    ...(code === "CL" ? {} : NON_CHILE),
    ...(COUNTRY_COPY[code] || {}),
  });
}

// Etiqueta y ejemplo del identificador fiscal de un cliente según su tipo ("persona" o "empresa").
export function getClientFiscalCopy(countryCode, clientType) {
  const code = normalizeCountryCode(countryCode);
  const copy = getCountryFormCopy(code);
  const isPerson = String(clientType || "").toLowerCase() === "persona";
  return {
    label: isPerson && copy.personFiscalLabel ? copy.personFiscalLabel : getFiscalIdentifierLabel(code),
    placeholder: isPerson && copy.personFiscalExample ? copy.personFiscalExample : getFiscalIdentifierPlaceholder(code),
  };
}

// Etiqueta del identificador fiscal en las listas, buscadores y avisos de clientes, donde conviven Personas y
// Empresas (Bolivia: "CI o NIT"; Chile y el resto: la del país, como siempre).
export function getClientFiscalListLabel(countryCode) {
  return getClientFiscalCopy(countryCode, "persona").label;
}
