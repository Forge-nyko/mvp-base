import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";

// Formulario de proveedor (nuevo y edición): secciones visibles como Nuevo cliente, sin el acordeón "Más datos del
// proveedor (opcional)", y un texto guía en cada campo de texto: ejemplo local ("Ej. ...") en Chile y Bolivia e
// instrucción neutra ("Escribe ...") en cualquier otro país. Sin emuladores ni red.

const source = readFileSync(new URL("../src/features/providers/ProviderFormDialog.jsx", import.meta.url), "utf8");
assert.doesNotMatch(source, /Disclosure|Más datos del proveedor/, "el formulario no importa el plegable");

Object.assign(process.env, {
  VITE_FIREBASE_MODE: "emulator",
  VITE_USE_FIREBASE_CORE_EMULATORS: "true",
  VITE_USE_FIREBASE_FUNCTIONS_EMULATOR: "true",
  VITE_USE_FIREBASE_STORAGE_EMULATOR: "true",
});
const vite = await createServer({appType: "custom", logLevel: "silent", server: {middlewareMode: true}});
try {
  const {default: ProviderFormDialog} = await vite.ssrLoadModule("/src/features/providers/ProviderFormDialog.jsx");
  const render = (countryCode, props = {}) => renderToStaticMarkup(
    React.createElement(ProviderFormDialog, {countryCode, open: true, onClose() {}, onSubmit() {}, ...props}),
  ).replace(/<!-- -->/g, "");
  // Campos de texto (input que no es casilla ni botón, y textarea) con su placeholder, en orden de aparición.
  const textFields = (html) => [...html.matchAll(/<(input|textarea)\b([^>]*)>/g)]
    .filter((m) => !/type="(checkbox|radio|hidden|submit|button)"/.test(m[2]))
    .map((m) => (m[2].match(/placeholder="([^"]*)"/) || [])[1]);

  // Textos esperados, en el orden en que aparecen los campos de texto.
  const countries = {
    BO: {
      label: "Actividad económica",
      territory: ["Departamento", "Municipio"],
      placeholders: [
        "Ej.: 1234567", // NIT
        "Ej. Comercial Andina S.R.L.", // Razón social
        "Ej. Comercial Andina", // Nombre de fantasía
        "Ej. Venta de productos y servicios", // Actividad económica
        "Ej. contacto@empresa.com.bo", // Correo
        "Ej. +591 7xxxxxxx", // Teléfono
        "Ej. Nombre Apellido", // Persona de contacto
        "Ej. Av. Banzer 123", // Dirección
        "Ej. Santa Cruz de la Sierra", // Municipio (el departamento es una lista)
        "Ej. Prefiere contacto por WhatsApp", // Notas internas
      ],
      credit: "Ej. 30",
    },
    CL: {
      label: "Giro",
      territory: ["Región", "Comuna"],
      placeholders: [
        "Ej.: 12.345.678-5", // RUT
        "Ej. Comercial Andina SpA",
        "Ej. Comercial Andina",
        "Ej. Venta de productos y servicios",
        "Ej. contacto@empresa.cl",
        "Ej. +56 9 6123 4587",
        "Ej. Nombre Apellido",
        "Ej. Av. Arturo Prat 123", // Dirección (región y comuna son listas)
        "Ej. Prefiere contacto por WhatsApp",
      ],
      credit: "Ej. 30",
    },
    MX: { // país sin ejemplos propios: capa 2
      label: "Giro",
      territory: ["Estado", "Municipio"],
      placeholders: [
        "Escribe el identificador fiscal",
        "Escribe el nombre o razón social",
        "Escribe el nombre de fantasía",
        "Escribe la actividad económica",
        "Escribe el correo electrónico",
        "Escribe el teléfono de contacto",
        "Escribe el nombre de la persona de contacto",
        "Escribe la dirección",
        "Escribe el departamento o región",
        "Escribe el municipio o comuna",
        "Escribe una nota interna",
      ],
      credit: "Escribe los días de crédito",
    },
  };

  for (const [country, want] of Object.entries(countries)) {
    for (const [mode, props] of [["nuevo", {}], ["edición", {provider: {proveedorId: "p1", rut: "1234567", razonSocial: "Comercial", paisCodigo: country}}]]) {
      const label = `${country} · ${mode}`;
      const html = render(country, props);

      // Sin acordeón; secciones visibles con el patrón del formulario de cliente.
      assert.doesNotMatch(html, /Más datos del proveedor|ui-disclosure|aria-expanded/, `${label}: sin acordeón`);
      assert.match(html, /<legend>Datos del proveedor<\/legend>/, `${label}: sección Datos del proveedor`);
      for (const title of ["Contacto", "Ubicación", "Condiciones comerciales", "Notas"]) {
        assert.match(html, new RegExp(`<legend>${title} <span>\\(opcional\\)</span></legend>`), `${label}: sección ${title} (opcional)`);
      }
      assert.equal((html.match(/class="client-form-section"/g) || []).length, 5, `${label}: cinco secciones`);
      const order = ["Datos del proveedor", "Contacto", "Ubicación", "Condiciones comerciales", "Notas"].map((t) => html.indexOf(`<legend>${t}`));
      assert.deepEqual([...order].sort((a, b) => a - b), order, `${label}: secciones en orden`);

      // Todos los campos siguen presentes.
      for (const text of ["Razón social", "Nombre de fantasía", want.label, "Correo", "Teléfono", "Persona de contacto", "Dirección", ...want.territory, "Condiciones de pago", "Notas internas"]) {
        assert.ok(html.includes(`>${text}`), `${label}: campo "${text}"`);
      }
      assert.ok(html.includes("Sin especificar"), `${label}: la lista de condiciones de pago sigue`);

      // Texto guía en cada campo de texto, con el valor de la capa que corresponde.
      assert.deepEqual(textFields(html), want.placeholders, `${label}: texto guía por campo, en orden`);
      assert.ok(textFields(html).every((value) => typeof value === "string" && value.trim() !== ""), `${label}: ningún campo de texto sin texto guía`);
      assert.ok(!html.includes("¿"), `${label}: sin signo de apertura de interrogación`);
      assert.ok(!html.includes("Escribe municipio") && !html.includes("Escribe departamento"), `${label}: sin el "Escribe ..." antiguo`);
      assert.ok(!html.includes("+1 202 555 0100") && !html.includes("Servicios técnicos"), `${label}: sin los ejemplos fijos anteriores`);
      if (country !== "CL") assert.ok(!html.includes("@empresa.cl"), `${label}: sin el dominio chileno`);
      if (country === "BO") assert.ok(!html.includes("Arturo Prat") && !html.includes("SpA"), `${label}: sin ejemplos chilenos`);
      if (country === "MX") assert.ok(!/placeholder="Ej\./.test(html.replace(/placeholder="Ej\.: [^"]*"/g, "")), `${label}: capa 2 sin "Ej."`);

      // Los selects no llevan texto guía; el botón principal sigue.
      assert.ok(!/<select[^>]*placeholder/.test(html), `${label}: los selects sin texto guía`);
      assert.match(html, mode === "nuevo" ? /Crear proveedor/ : /Guardar cambios/, `${label}: botón principal`);
    }

    // Con "Crédito" aparece Días de crédito, también con texto guía.
    const credit = render(country, {provider: {proveedorId: "p1", rut: "1234567", razonSocial: "Comercial", condicionesPago: "credito", diasCredito: 15, paisCodigo: country}});
    assert.ok(credit.includes(">Días de crédito"), `${country}: con crédito aparece Días de crédito`);
    assert.ok(credit.includes(`placeholder="${want.credit}"`), `${country}: Días de crédito con texto guía`);
    assert.equal(textFields(credit).length, want.placeholders.length + 1, `${country}: con crédito hay un campo más`);
  }
} finally {
  await vite.close();
}

console.log("PROVIDER_FORM_SECTIONS_SMOKE_OK");
