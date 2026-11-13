"use strict";

const {buildVeterinaryPatientMutationPayload} = require("./veterinaryPatientModel.mjs");

function documentId(value, HttpsError) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Identificador de paciente o tutor inválido.");
  }
  return value;
}

async function guardarPacienteVeterinarioHandler(request, {db, HttpsError, FieldValue, requireBusinessAccess}) {
  const {uid, businessId, businessRef} = await requireBusinessAccess(
      request, {db, HttpsError}, {roles: ["OWNER", "ADMIN"], requiredVerticalModule: "veterinaria"},
  );
  const {operacion, pacienteId, paciente} = request.data;
  if (!["crear", "editar"].includes(operacion) || !paciente || typeof paciente !== "object" || Array.isArray(paciente)) {
    throw new HttpsError("invalid-argument", "Selecciona una operación y completa los datos del paciente.");
  }

  let payload;
  try {
    payload = buildVeterinaryPatientMutationPayload(paciente);
  } catch (error) {
    if (error.code !== "veterinary-patient/invalid-data") throw error;
    throw new HttpsError("invalid-argument", error.message, error.fieldErrors);
  }
  const id = documentId(pacienteId, HttpsError);
  const tutorId = documentId(payload.tutorClienteId, HttpsError);
  const patientRef = businessRef.collection("pacientesVeterinarios").doc(id);
  const tutorRef = businessRef.collection("clientes").doc(tutorId);

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(patientRef);
    if (operacion === "crear" && existing.exists) {
      if (existing.get("negocioId") === businessId && existing.get("creadoPorUid") === uid) return {pacienteId: id};
      throw new HttpsError("already-exists", "Ya existe un paciente con este identificador.");
    }
    if (operacion === "editar" && (!existing.exists || existing.get("negocioId") !== businessId)) {
      throw new HttpsError("not-found", "El paciente ya no está disponible.");
    }

    const tutor = await transaction.get(tutorRef);
    if (!tutor.exists || tutor.get("negocioId") !== businessId || tutor.get("estado") === "archivado") {
      throw new HttpsError("failed-precondition", "Selecciona un tutor activo de esta empresa.");
    }
    const timestamp = FieldValue.serverTimestamp();
    const update = {...payload, actualizadoEn: timestamp, actualizadoPorUid: uid};
    if (operacion === "crear") {
      transaction.create(patientRef, {
        ...update, negocioId: businessId, estado: "activo", creadoEn: timestamp, creadoPorUid: uid,
      });
    } else {
      transaction.update(patientRef, update);
    }
    return {pacienteId: id};
  });
}

module.exports = {guardarPacienteVeterinarioHandler};
