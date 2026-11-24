import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {deleteApp, initializeApp} from "firebase/app";
import {connectAuthEmulator, getAuth, signInAnonymously} from "firebase/auth";
import {connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc} from "firebase/firestore";

const {GCLOUD_PROJECT: projectId, FIREBASE_AUTH_EMULATOR_HOST: authHost, FIRESTORE_EMULATOR_HOST: firestoreHost} = process.env;
if (!projectId?.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(authHost) || !/^127\.0\.0\.1:\d+$/.test(firestoreHost)) {
  throw new Error("Ejecuta el smoke en emuladores locales con un proyecto demo.");
}
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const {requireOperationalBusinessAccess} = require("../functions/businessOnboarding");
const {guardarRecepcionVeterinariaHandler} = require("../functions/veterinaryReceptionPersistence");
const {guardarAtencionVeterinariaHandler} = require("../functions/veterinaryAttentionPersistence");

const adminApp = admin.initializeApp({projectId});
const app = initializeApp({projectId, apiKey: "demo-key"});
const auth = getAuth(app);
const clientDb = getFirestore(app);
connectAuthEmulator(auth, "http://" + authHost, {disableWarnings: true});
connectFirestoreEmulator(clientDb, "127.0.0.1", Number(firestoreHost.split(":")[1]));
const db = admin.firestore();
const dependencies = {
  db, HttpsError, FieldValue: admin.firestore.FieldValue, requireBusinessAccess: requireOperationalBusinessAccess,
};

try {
  const {user: owner} = await signInAnonymously(auth);
  const professional = await admin.auth().createUser({displayName: "Profesional de prueba"});
  const outsider = await admin.auth().createUser({displayName: "Profesional de otra clínica"});
  const technician = await admin.auth().createUser({displayName: "Técnico de prueba"});
  const businessId = "ordenes-" + randomUUID();
  const otherBusinessId = "otra-" + randomUUID();
  const business = db.doc("negocios/" + businessId);
  const otherBusiness = db.doc("negocios/" + otherBusinessId);
  const businessData = {
    estado: "activo", paisCodigo: "CL", verificacionEmpresa: {estado: "VERIFICADA"}, modulosHabilitados: ["veterinaria"],
  };
  const membership = (member, rol, company = businessId) =>
    db.doc("membresias/" + company + "__" + member.uid).set({uid: member.uid, negocioId: company, estado: "activo", rol});
  const patients = business.collection("pacientesVeterinarios");
  const appointments = business.collection("citasVeterinarias");
  const orders = business.collection("atencionesVeterinarias");
  const pacienteId = "paciente-ficticio";
  const citaId = "cita-programada";
  const legacyCitaId = "cita-anterior";
  const cancelCitaId = "cita-por-cancelar";
  const cancelOrderId = "orden-por-cancelar";
  const cancelSlot = business.collection("cuposVeterinarios").doc("2026-11-29_1130");
  const orderId = "orden-programada";
  const emergencyId = "orden-emergencia";
  const directId = "orden-directa";
  await Promise.all([
    business.set(businessData),
    otherBusiness.set(businessData),
    membership(owner, "OWNER"),
    membership(professional, "ADMIN"),
    membership(technician, "TECNICO"),
    membership(outsider, "OWNER", otherBusinessId),
    db.doc("usuarios/" + professional.uid + "/cuenta/perfil").set({nombres: "Profesional", apellidos: "de prueba"}),
    business.collection("clientes").doc("tutor-ficticio").set({negocioId: businessId, estado: "activo"}),
    patients.doc(pacienteId).set({negocioId: businessId, estado: "activo", tutorClienteId: "tutor-ficticio"}),
    otherBusiness.collection("pacientesVeterinarios").doc("paciente-ajeno").set({negocioId: otherBusinessId, estado: "activo"}),
    appointments.doc(cancelCitaId).set({
      negocioId: businessId, pacienteId, estado: "agendada", motivo: "Cita para cancelar", fecha: "2026-11-29", hora: "11:30",
    }),
    cancelSlot.set({citaId: cancelCitaId}),
    ...[citaId, legacyCitaId].map((id) =>
      appointments.doc(id).set({negocioId: businessId, pacienteId, estado: "agendada", motivo: "Control ficticio"})),
  ]);

  const handle = (operacion, data, uid = owner.uid) =>
    guardarAtencionVeterinariaHandler({auth: {uid}, data: {businessId, operacion, ...data}}, dependencies);
  const receive = (id, prioridad) => guardarRecepcionVeterinariaHandler({
    auth: {uid: owner.uid}, data: {businessId, citaId: id, recepcion: {horaLlegada: "09:15", prioridad, pesoKg: 5}},
  }, dependencies);
  const create = (atencionId, atencion, cita = {}) => handle("crearOrden", {atencionId, atencion, ...cita});
  const directData = {origen: "directa", pacienteId, horaLlegada: "09:20", prioridad: "normal", motivoConsulta: "Llegada sin cita"};
  const emergencyData = {...directData, origen: "emergencia", horaLlegada: "09:25", prioridad: "urgente", motivoConsulta: "Urgencia ficticia"};
  const fromCalendar = {atencionId: orderId, citaId, atencion: {origen: "cita"}};

  await assert.rejects(handle("crearOrden", fromCalendar), {code: "failed-precondition"});
  await assert.rejects(handle("crearOrden", fromCalendar, outsider.uid), {code: "permission-denied"});
  await assert.rejects(handle("crearOrden", fromCalendar, technician.uid), {code: "permission-denied"});
  await assert.rejects(create("paciente-fuera", {...directData, pacienteId: "paciente-ajeno"}), {code: "failed-precondition"});
  await receive(citaId, "prioritaria");
  assert.equal((await appointments.doc(citaId).get()).get("estado"), "en_espera");
  assert.deepEqual(await handle("crearOrden", fromCalendar), {atencionId: orderId});
  const waiting = (await orders.doc(orderId).get()).data();
  assert.equal(waiting.estado, "en_espera");
  assert.equal(waiting.origen, "cita");
  assert.equal(waiting.pacienteId, pacienteId);
  assert.equal(waiting.citaId, citaId);
  assert.equal(waiting.recepcion.horaLlegada, "09:15");
  assert.equal(waiting.triage.prioridad, "prioritaria");
  assert.equal(waiting.triage.pesoKg, 5);
  assert.equal((await appointments.doc(citaId).get()).get("atencionId"), orderId);
  assert.equal((await orders.doc(citaId).get()).exists, false, "la orden no adopta el id de la cita");
  assert.deepEqual(await handle("crearOrden", fromCalendar), {atencionId: orderId});
  await assert.rejects(create("otra-orden", {origen: "cita"}, {citaId}), {code: "already-exists"});
  assert.equal((await orders.doc("otra-orden").get()).exists, false);
  await assert.rejects(handle("iniciar", {atencionId: orderId}), {code: "failed-precondition"});

  const appointmentCount = (await appointments.get()).size;
  assert.deepEqual(await create(directId, directData), {atencionId: directId});
  assert.deepEqual(await create(directId, directData), {atencionId: directId});
  await assert.rejects(create(emergencyId, {...emergencyData, prioridad: "normal"}), {code: "invalid-argument"});
  await assert.rejects(create(emergencyId, emergencyData, {citaId}), {code: "invalid-argument"});
  assert.deepEqual(await create(emergencyId, emergencyData), {atencionId: emergencyId});
  for (const [id, data] of [[directId, directData], [emergencyId, emergencyData]]) {
    const order = (await orders.doc(id).get()).data();
    assert.equal(order.estado, "en_espera");
    assert.equal(order.origen, data.origen);
    assert.equal(order.triage.prioridad, data.prioridad);
    assert.equal(order.recepcion.horaLlegada, data.horaLlegada);
    assert.ok(!order.citaId, "una orden sin cita no conserva vínculos de agenda");
  }
  assert.equal((await appointments.get()).size, appointmentCount, "recepción directa y emergencia no crean citas");

  const assignment = {box: "Box 1", tipoAtencion: "Consulta", profesionalUid: professional.uid};
  await assert.rejects(handle("asignarOrden", {
    atencionId: orderId, atencion: {...assignment, profesionalUid: outsider.uid},
  }), {code: "failed-precondition"});
  await assert.rejects(handle("asignarOrden", {
    atencionId: orderId, atencion: {...assignment, profesionalUid: technician.uid},
  }), {code: "failed-precondition"});
  assert.deepEqual(await handle("asignarOrden", {atencionId: orderId, atencion: assignment}), {atencionId: orderId});
  const assigned = (await orders.doc(orderId).get()).data();
  assert.equal(assigned.box, assignment.box);
  assert.equal(assigned.tipoAtencion, assignment.tipoAtencion);
  assert.equal(assigned.profesionalUid, professional.uid);
  assert.equal(assigned.profesionalNombre, "Profesional de prueba");
  await assert.rejects(handle("asignarOrden", {
    atencionId: directId, atencion: {...assignment, box: "  box 1  "},
  }), {code: "already-exists"});
  await assert.rejects(handle("iniciar", {atencionId: orderId}), {code: "permission-denied"});
  const waitingRecipe = {
    recetaId: "receta-antes-de-iniciar",
    medicamentos: [{nombre: "Ficticio", dosis: "Prueba", frecuencia: "Prueba", duracion: "Prueba"}],
  };
  await assert.rejects(handle("emitirReceta", {atencionId: orderId, atencion: waitingRecipe}, professional.uid),
    {code: "failed-precondition"});
  assert.deepEqual(await handle("iniciar", {atencionId: orderId}, professional.uid), {atencionId: orderId});
  assert.deepEqual(await handle("iniciar", {atencionId: orderId}, professional.uid), {atencionId: orderId});
  assert.equal((await appointments.doc(citaId).get()).get("estado"), "en_atencion");
  assert.equal((await orders.doc(orderId).get()).get("iniciadoPorUid"), professional.uid);

  const clinical = {
    motivoConsulta: "Control ficticio", diagnostico: "Diagnóstico de prueba", tratamiento: "Observación",
    indicaciones: "Seguimiento", resultadoClinico: "control",
  };
  const recipe = {
    recetaId: "receta-ficticia",
    medicamentos: [{
      nombre: "Medicamento ficticio", dosis: "Dosis de prueba", frecuencia: "Frecuencia de prueba", duracion: "Duración de prueba",
      instrucciones: "Instrucciones de prueba",
    }],
    indicaciones: "Receta de prueba",
  };
  const issue = (atencion = recipe, uid = professional.uid) => handle("emitirReceta", {atencionId: orderId, atencion}, uid);
  await assert.rejects(issue(recipe, owner.uid), {code: "permission-denied"});
  await assert.rejects(issue({...recipe, medicamentos: []}), {code: "invalid-argument"});
  const recipeResult = {atencionId: orderId, recetaId: recipe.recetaId};
  assert.deepEqual(await issue(), recipeResult);
  const [issued] = (await orders.doc(orderId).get()).get("recetas");
  assert.equal(issued.recetaId, recipe.recetaId);
  assert.deepEqual(issued.medicamentos, recipe.medicamentos);
  assert.equal(issued.indicaciones, recipe.indicaciones);
  assert.equal(issued.profesionalUid, professional.uid);
  assert.equal(issued.profesionalNombre, "Profesional de prueba");
  assert.ok(issued.emitidaEn?.toMillis() > 0);
  assert.deepEqual(await issue(), recipeResult);
  assert.equal((await orders.doc(orderId).get()).get("recetas").length, 1);
  await assert.rejects(issue({...recipe, indicaciones: "Intento de reemplazo"}), {code: "already-exists"});

  await handle("borrador", {atencionId: orderId, atencion: {diagnostico: "Borrador ficticio"}}, professional.uid);
  assert.equal((await orders.doc(orderId).get()).get("borrador.diagnostico"), "Borrador ficticio");
  await assert.rejects(handle("cerrar", {atencionId: orderId, atencion: clinical}), {code: "permission-denied"});
  assert.deepEqual(await handle("cerrar", {atencionId: orderId, atencion: clinical}, professional.uid), {atencionId: orderId});
  const closed = (await orders.doc(orderId).get()).data();
  assert.equal(closed.estado, "finalizada");
  assert.equal(closed.finalizadoPorUid, professional.uid);
  assert.equal(closed.borrador, undefined);
  assert.deepEqual(closed.recetas, [issued], "el cierre conserva la receta original y su auditoría");
  assert.equal((await appointments.doc(citaId).get()).get("estado"), "finalizada");
  assert.deepEqual(await issue(), recipeResult);
  await assert.rejects(issue({...recipe, recetaId: "receta-posterior"}), {code: "failed-precondition"});

  await handle("asignarOrden", {atencionId: directId, atencion: assignment});
  await handle("iniciar", {atencionId: directId}, professional.uid);
  await handle("borrador", {atencionId: directId, atencion: {diagnostico: "Borrador directo"}}, professional.uid);
  await handle("cerrar", {atencionId: directId, atencion: clinical}, professional.uid);
  const directClosed = (await orders.doc(directId).get()).data();
  assert.equal(directClosed.estado, "finalizada");
  assert.equal(directClosed.diagnostico, clinical.diagnostico);
  assert.ok(!directClosed.citaId, "cerrar una orden directa no fabrica un id de cita");

  // Cerrar la primera orden liberó el box para la directa. Cancelar otra orden
  // libera sus reservas, conservando la orden y su vínculo con la cita.
  await receive(cancelCitaId, "normal");
  await create(cancelOrderId, {origen: "cita"}, {citaId: cancelCitaId});
  const cancelAssignment = {...assignment, box: "Box cancelable"};
  await handle("asignarOrden", {atencionId: cancelOrderId, atencion: cancelAssignment});
  assert.deepEqual(await handle("cancelarOrden", {atencionId: cancelOrderId}), {atencionId: cancelOrderId});
  assert.equal((await orders.doc(cancelOrderId).get()).get("estado"), "cancelada");
  assert.equal((await orders.doc(cancelOrderId).get()).get("citaId"), cancelCitaId);
  assert.equal((await appointments.doc(cancelCitaId).get()).get("estado"), "cancelada");
  assert.equal((await appointments.doc(cancelCitaId).get()).get("atencionId"), cancelOrderId);
  assert.equal((await cancelSlot.get()).exists, false);
  await handle("asignarOrden", {atencionId: emergencyId, atencion: cancelAssignment});
  await handle("iniciar", {atencionId: emergencyId}, professional.uid);
  await handle("cerrar", {atencionId: emergencyId, atencion: clinical}, professional.uid);
  assert.equal((await orders.doc(emergencyId).get()).get("estado"), "finalizada");

  await receive(legacyCitaId, "normal");
  assert.deepEqual(await handle("iniciar", {citaId: legacyCitaId}), {atencionId: legacyCitaId});
  assert.deepEqual(await handle("cerrar", {citaId: legacyCitaId, atencion: clinical}), {atencionId: legacyCitaId});
  assert.equal((await orders.doc(legacyCitaId).get()).get("estado"), "finalizada");
  assert.equal((await appointments.get()).size, appointmentCount);

  const clientOrder = doc(clientDb, "negocios", businessId, "atencionesVeterinarias", orderId);
  assert.equal((await getDoc(clientOrder)).get("estado"), "finalizada");
  await assert.rejects(setDoc(clientOrder, {recetas: []}, {merge: true}), {code: "permission-denied"});
  console.log("VETERINARY_ORDER_PERSISTENCE_SMOKE_OK");
} finally {
  await deleteApp(app);
  await adminApp.delete();
}
