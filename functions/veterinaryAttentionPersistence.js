"use strict";

const {createHash} = require("node:crypto");
const {isDeepStrictEqual} = require("node:util");
const {getAuth} = require("firebase-admin/auth");
const {importVeterinaryModel} = require("./veterinaryModels");

const CLINICAL_ROLES = ["OWNER", "ADMIN"];
const ORDER_ORIGINS = new Set(["cita", "directa", "emergencia"]);
const ORDER_OPERATIONS = new Set(["crearOrden", "asignarOrden", "iniciar", "borrador", "cerrar", "emitirReceta", "cancelarOrden"]);
const LEGACY_OPERATIONS = new Set(["iniciar", "borrador", "cerrar"]);
const MAX_PRESCRIPTIONS = 5;
const validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(value);

function requireId(value, HttpsError, message = "Selecciona una orden válida.") {
  if (!validId(value)) throw new HttpsError("invalid-argument", message);
  return value;
}

function requireText(value, limit, label, HttpsError, required = true) {
  const text = typeof value === "string" ? value.trim() : "";
  if ((required && !text) || text.length > limit || (value != null && typeof value !== "string")) {
    throw new HttpsError("invalid-argument", label + ": ingresa un texto válido de hasta " + limit + " caracteres.");
  }
  return text;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boxRef(businessRef, value) {
  if (typeof value !== "string" || !value) return null;
  const key = value.normalize("NFKC").toLocaleLowerCase("es").trim().replace(/\s+/g, " ");
  return businessRef.collection("reservasBoxesVeterinarios").doc(digest(key));
}

function appointmentSlotRef(businessRef, appointment) {
  if (!appointment || !/^\d{4}-\d{2}-\d{2}$/.test(appointment.fecha) ||
      !/^\d{2}:\d{2}$/.test(appointment.hora)) return null;
  return businessRef.collection("cuposVeterinarios").doc(appointment.fecha + "_" + appointment.hora.replace(":", ""));
}

function auditStamp(FieldValue, uid) {
  return {actualizadoEn: FieldValue.serverTimestamp(), actualizadoPorUid: uid};
}

function modelError(error, HttpsError) {
  if (!error.fieldErrors) throw error;
  return new HttpsError("invalid-argument", Object.values(error.fieldErrors).flat()[0], error.fieldErrors);
}

async function guardarAtencionVeterinariaHandler(request, {db, HttpsError, FieldValue, requireBusinessAccess}) {
  const context = await requireBusinessAccess(
      request, {db, HttpsError}, {roles: CLINICAL_ROLES, requiredVerticalModule: "veterinaria"},
  );
  const params = request.data ?? {};
  const {operacion, atencionId, citaId} = params;
  const dependencies = {...context, db, HttpsError, FieldValue};
  if (atencionId !== undefined || !LEGACY_OPERATIONS.has(operacion)) {
    requireId(atencionId, HttpsError);
    if (!ORDER_OPERATIONS.has(operacion)) throw new HttpsError("invalid-argument", "Selecciona una operación válida.");
    if (operacion === "crearOrden") return createOrder(params, dependencies);
    return mutateOrder(params, dependencies);
  }
  requireId(citaId, HttpsError, "Selecciona una cita válida.");
  return mutateLegacyAttention(params, dependencies);
}

async function createOrder({atencionId, citaId, atencion}, {db, uid, businessId, businessRef, HttpsError, FieldValue}) {
  const {VETERINARY_TRIAGE_PRIORITIES} = await importVeterinaryModel("receptionTriageModel");
  const origen = atencion?.origen;
  if (!ORDER_ORIGINS.has(origen)) throw new HttpsError("invalid-argument", "Selecciona el tipo de ingreso.");
  if (origen === "cita") {
    requireId(citaId, HttpsError, "Selecciona una cita válida.");
    if (citaId === atencionId) throw new HttpsError("invalid-argument", "La orden necesita su propio identificador.");
  } else if (citaId != null) {
    throw new HttpsError("invalid-argument", "Este ingreso no se vincula con una cita.");
  }

  const appointments = businessRef.collection("citasVeterinarias");
  const attentions = businessRef.collection("atencionesVeterinarias");
  const appointmentRef = origen === "cita" ? appointments.doc(citaId) : null;
  // Esta lectura solo resuelve la referencia; la transacción valida de nuevo la cita.
  const initialAppointment = appointmentRef ? (await appointmentRef.get()).data() : null;
  if (appointmentRef && initialAppointment?.negocioId !== businessId) {
    throw new HttpsError("not-found", "La cita ya no está disponible.");
  }
  const pacienteId = requireId(appointmentRef ? initialAppointment.pacienteId : atencion?.pacienteId,
      HttpsError, "Selecciona un paciente válido.");
  const patientRef = businessRef.collection("pacientesVeterinarios").doc(pacienteId);
  const attentionRef = attentions.doc(atencionId);
  const legacyRef = appointmentRef ? attentions.doc(citaId) : null;
  let intake;
  if (!appointmentRef) {
    const {horaLlegada, prioridad} = atencion;
    if (typeof horaLlegada !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaLlegada) ||
        !VETERINARY_TRIAGE_PRIORITIES.includes(prioridad) || (origen === "emergencia" && prioridad !== "urgente")) {
      throw new HttpsError("invalid-argument", "Registra la hora de llegada y una prioridad válida para el ingreso.");
    }
    const motivoConsulta = requireText(atencion.motivoConsulta, 1000, "Motivo de consulta", HttpsError);
    intake = {horaLlegada, prioridad, motivoConsulta};
  }
  const creationHash = digest({origen, citaId: citaId ?? null, pacienteId, intake});

  return db.runTransaction(async (tx) => {
    const [orderSnapshot, patientSnapshot, appointmentSnapshot, legacySnapshot] = await tx.getAll(
        attentionRef, patientRef, ...(appointmentRef ? [appointmentRef, legacyRef] : []),
    );
    const existing = orderSnapshot.data();
    if (existing) {
      if (existing.creadoPorUid === uid && existing.negocioId === businessId && existing.huellaCreacion === creationHash) {
        return {atencionId};
      }
      throw new HttpsError("already-exists", "Ya existe una orden con ese identificador.");
    }

    const patient = patientSnapshot.data();
    if (patient?.negocioId !== businessId || !["activo", undefined].includes(patient.estado)) {
      throw new HttpsError("failed-precondition", "Selecciona un paciente activo de esta empresa.");
    }
    const appointment = appointmentSnapshot?.data();
    if (appointmentRef) {
      if (appointment?.negocioId !== businessId || appointment.pacienteId !== pacienteId) {
        throw new HttpsError("aborted", "La cita cambió. Vuelve a abrirla.");
      }
      if (appointment.atencionId || legacySnapshot.exists) {
        throw new HttpsError("already-exists", "Esta cita ya tiene una atención registrada.");
      }
      if (appointment.estado !== "en_espera" || !appointment.recepcion?.horaLlegada || !appointment.triage?.prioridad) {
        throw new HttpsError("failed-precondition", "Registra la recepción y el triage antes de crear la orden.");
      }
    }

    const audit = auditStamp(FieldValue, uid);
    const stamp = audit.actualizadoEn;
    const recepcion = appointment?.recepcion ?? {horaLlegada: intake.horaLlegada, recibidaEn: stamp, recibidaPorUid: uid};
    const triage = appointment?.triage ?? {prioridad: intake.prioridad};
    tx.create(attentionRef, {
      ...audit, negocioId: businessId, atencionId, pacienteId, origen, estado: "en_espera",
      ...(appointmentRef ? {citaId} : {}),
      motivoConsulta: appointment ? appointment.motivo ?? "" : intake.motivoConsulta,
      recepcion, triage, recibidoEn: recepcion.recibidaEn ?? stamp,
      creadoEn: stamp, creadoPorUid: uid, huellaCreacion: creationHash,
    });
    if (appointmentRef) tx.update(appointmentRef, {atencionId, ...audit});
    return {atencionId};
  });
}

async function professionalDisplayName(db, uid) {
  const userRef = db.doc("usuarios/" + uid);
  const [profileSnapshot, userSnapshot] = await db.getAll(userRef.collection("cuenta").doc("perfil"), userRef);
  const profile = profileSnapshot.data() ?? {};
  const userData = userSnapshot.data() ?? {};
  const name = [profile.nombres ?? userData.nombres, profile.apellidos ?? userData.apellidos].filter((part) => typeof part === "string")
      .map((part) => part.trim()).filter(Boolean).join(" ");
  if (name) return name.slice(0, 240);
  try {
    const user = await getAuth().getUser(uid);
    return user.displayName?.trim().slice(0, 240) || "Profesional " + uid;
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    return "Profesional " + uid;
  }
}

function assignmentPayload(value, HttpsError) {
  return {
    box: requireText(value?.box, 80, "Box", HttpsError).replace(/\s+/g, " "),
    tipoAtencion: requireText(value?.tipoAtencion, 100, "Tipo de atención", HttpsError),
    profesionalUid: requireId(value?.profesionalUid, HttpsError, "Selecciona un profesional válido."),
  };
}

function prescriptionPayload(value, HttpsError) {
  const recetaId = requireId(value?.recetaId, HttpsError, "Selecciona un identificador de receta válido.");
  if (!Array.isArray(value.medicamentos) || value.medicamentos.length < 1 || value.medicamentos.length > 10) {
    throw new HttpsError("invalid-argument", "Registra entre 1 y 10 medicamentos por receta.");
  }
  const medicamentos = value.medicamentos.map((item) => ({
    nombre: requireText(item?.nombre, 120, "Medicamento", HttpsError),
    dosis: requireText(item?.dosis, 80, "Dosis", HttpsError),
    frecuencia: requireText(item?.frecuencia, 80, "Frecuencia", HttpsError),
    duracion: requireText(item?.duracion, 80, "Duración", HttpsError),
    instrucciones: requireText(item?.instrucciones, 300, "Instrucciones", HttpsError, false),
  }));
  return {
    recetaId, medicamentos,
    indicaciones: requireText(value.indicaciones, 1000, "Indicaciones", HttpsError, false),
  };
}

function requireExistingOrder(order, businessId, HttpsError) {
  if (order?.negocioId !== businessId || !ORDER_ORIGINS.has(order.origen)) {
    throw new HttpsError("not-found", "La orden de atención ya no está disponible.");
  }
}

function requireAssignedProfessional(order, uid, HttpsError) {
  if (order.profesionalUid !== uid) {
    throw new HttpsError("permission-denied", "Solo el profesional asignado puede registrar esta atención.");
  }
}

function requireAssignableProfessional(membership, professionalUid, businessId, HttpsError) {
  if (membership?.negocioId !== businessId || membership.uid !== professionalUid ||
      membership.estado !== "activo" || !CLINICAL_ROLES.includes(membership.rol)) {
    throw new HttpsError("failed-precondition", "Selecciona un profesional activo con acceso a Veterinaria.");
  }
}

function assignOrder(tx, orderRef, order, assignment, {nextBox, currentLock, nextLock, membership, displayName}, context) {
  const {uid, businessId, HttpsError, audit} = context;
  if (order.estado !== "en_espera") throw new HttpsError("failed-precondition", "Solo puedes asignar una orden en espera.");
  requireAssignableProfessional(membership, assignment.profesionalUid, businessId, HttpsError);
  if (nextLock.exists && nextLock.get("atencionId") !== orderRef.id) {
    throw new HttpsError("already-exists", "El box ya está asignado a otra orden en espera o en atención.");
  }
  if (currentLock?.ref.path !== nextBox.path && currentLock?.get("atencionId") === orderRef.id) tx.delete(currentLock.ref);
  if (nextLock.get("atencionId") === orderRef.id && order.box === assignment.box &&
      order.tipoAtencion === assignment.tipoAtencion && order.profesionalUid === assignment.profesionalUid) return;
  tx.set(nextBox, {atencionId: orderRef.id});
  tx.update(orderRef, {
    ...assignment, profesionalNombre: displayName, ...audit, asignadoEn: audit.actualizadoEn, asignadoPorUid: uid,
  });
}

function issuePrescription(tx, orderRef, order, prescription, {uid, HttpsError, audit}) {
  requireAssignedProfessional(order, uid, HttpsError);
  const prescriptions = order.recetas ?? [];
  const existing = prescriptions.find((entry) => entry.recetaId === prescription.recetaId);
  const result = {atencionId: orderRef.id, recetaId: prescription.recetaId};
  if (existing) {
    if (existing.profesionalUid === uid && existing.indicaciones === prescription.indicaciones &&
        isDeepStrictEqual(existing.medicamentos, prescription.medicamentos)) return result;
    throw new HttpsError("already-exists", "La receta ya fue emitida con otros datos.");
  }
  if (order.estado !== "en_atencion") throw new HttpsError("failed-precondition", "La orden debe estar en atención para emitir una receta.");
  if (prescriptions.length >= MAX_PRESCRIPTIONS) {
    throw new HttpsError("failed-precondition", "Puedes emitir hasta cinco recetas por atención.");
  }
  // Firestore no permite serverTimestamp dentro de un arreglo. La fecha la fija el servidor.
  const entry = {
    ...prescription, emitidaEn: new Date(), profesionalUid: uid, profesionalNombre: order.profesionalNombre,
  };
  tx.update(orderRef, {...audit, recetas: [...prescriptions, entry]});
  return result;
}

async function mutateOrder({atencionId, operacion, atencion}, {db, uid, businessId, businessRef, HttpsError, FieldValue}) {
  const orderRef = businessRef.collection("atencionesVeterinarias").doc(atencionId);
  // Estas lecturas determinan las referencias de la transacción, que revalida el estado y sus vínculos.
  const initial = (await orderRef.get()).data();
  requireExistingOrder(initial, businessId, HttpsError);
  const appointmentRef = initial.citaId
    ? businessRef.collection("citasVeterinarias").doc(requireId(initial.citaId, HttpsError))
    : null;
  const assignment = operacion === "asignarOrden" ? assignmentPayload(atencion, HttpsError) : null;
  const prescription = operacion === "emitirReceta" ? prescriptionPayload(atencion, HttpsError) : null;
  const memberRef = assignment ? db.doc("membresias/" + businessId + "__" + assignment.profesionalUid) : null;
  let displayName = "";
  if (memberRef) {
    const membership = (await memberRef.get()).data();
    requireAssignableProfessional(membership, assignment.profesionalUid, businessId, HttpsError);
    displayName = await professionalDisplayName(db, assignment.profesionalUid);
  }
  const currentBox = boxRef(businessRef, initial.box);
  const nextBox = assignment ? boxRef(businessRef, assignment.box) : null;
  const slot = appointmentRef && operacion === "cancelarOrden"
    ? appointmentSlotRef(businessRef, (await appointmentRef.get()).data())
    : null;
  const readRefs = [...new Map([orderRef, appointmentRef, currentBox, nextBox, memberRef, slot]
      .filter(Boolean).map((ref) => [ref.path, ref])).values()];

  return db.runTransaction(async (tx) => {
    const snapshots = new Map((await tx.getAll(...readRefs)).map((snapshot) => [snapshot.ref.path, snapshot]));
    const order = snapshots.get(orderRef.path).data();
    requireExistingOrder(order, businessId, HttpsError);
    if (order.citaId !== initial.citaId || order.box !== initial.box) {
      throw new HttpsError("aborted", "La orden cambió. Vuelve a abrirla.");
    }
    const appointment = appointmentRef ? snapshots.get(appointmentRef.path).data() : null;
    if (appointmentRef && (appointment?.negocioId !== businessId || appointment.atencionId !== atencionId ||
        appointment.pacienteId !== order.pacienteId)) {
      throw new HttpsError("failed-precondition", "La cita ya no coincide con esta orden.");
    }

    const audit = auditStamp(FieldValue, uid);
    const actor = {uid, businessId, HttpsError, audit};
    const currentLock = currentBox ? snapshots.get(currentBox.path) : null;
    if (assignment) {
      assignOrder(tx, orderRef, order, assignment, {
        nextBox, currentLock, nextLock: snapshots.get(nextBox.path),
        membership: snapshots.get(memberRef.path).data(), displayName,
      }, actor);
      return {atencionId};
    }
    if (operacion === "cancelarOrden") {
      if (order.estado === "cancelada") return {atencionId};
      if (order.estado !== "en_espera") throw new HttpsError("failed-precondition", "Solo puedes cancelar una orden en espera.");
      if (appointmentRef) {
        if (appointment.estado !== "en_espera" || appointmentSlotRef(businessRef, appointment)?.path !== slot?.path) {
          throw new HttpsError("aborted", "La cita cambió. Vuelve a abrir la orden.");
        }
        tx.update(appointmentRef, {...audit, estado: "cancelada"});
        if (slot && snapshots.get(slot.path).get("citaId") === order.citaId) tx.delete(slot);
      }
      if (currentLock?.get("atencionId") === atencionId) tx.delete(currentBox);
      tx.update(orderRef, {...audit, estado: "cancelada", canceladaEn: audit.actualizadoEn, canceladaPorUid: uid});
      return {atencionId};
    }
    if (prescription) return issuePrescription(tx, orderRef, order, prescription, actor);

    if (operacion === "iniciar" && !order.profesionalUid) {
      throw new HttpsError("failed-precondition", "Asigna el box, el tipo de atención y el profesional antes de iniciar.");
    }
    requireAssignedProfessional(order, uid, HttpsError);
    if (operacion === "iniciar") {
      if (order.estado === "en_atencion") return {atencionId};
      if (order.estado !== "en_espera" || (appointmentRef && appointment.estado !== "en_espera") ||
          !order.box || !order.tipoAtencion || currentLock?.get("atencionId") !== atencionId) {
        throw new HttpsError("failed-precondition", "La orden no está en espera o no tiene asignación completa.");
      }
      tx.update(orderRef, {
        ...audit, estado: "en_atencion", iniciadaEn: audit.actualizadoEn, iniciadoPorUid: uid,
      });
      if (appointmentRef) tx.update(appointmentRef, {...audit, estado: "en_atencion"});
      return {atencionId};
    }

    if (operacion === "cerrar" && order.estado === "finalizada") return {atencionId};
    if (order.estado !== "en_atencion" || (appointmentRef && appointment.estado !== "en_atencion")) {
      throw new HttpsError("failed-precondition", "La orden debe estar en atención.");
    }
    if (operacion === "borrador") {
      await saveDraft(tx, orderRef, order, atencion, {audit, HttpsError});
      return {atencionId};
    }

    const clinicalContext = {atencionId, citaId: order.citaId || undefined, pacienteId: order.pacienteId};
    await closeAttention(tx, orderRef, atencion, clinicalContext, {businessRef, businessId, uid, audit, HttpsError, FieldValue});
    if (appointmentRef) tx.update(appointmentRef, {...audit, estado: "finalizada"});
    if (currentLock?.get("atencionId") === atencionId) tx.delete(currentBox);
    return {atencionId};
  });
}

async function mutateLegacyAttention({citaId, operacion, atencion}, {db, uid, businessId, businessRef, HttpsError, FieldValue}) {
  const appointmentRef = businessRef.collection("citasVeterinarias").doc(citaId);
  const attentionRef = businessRef.collection("atencionesVeterinarias").doc(citaId);

  return db.runTransaction(async (tx) => {
    const [appointmentSnapshot, attentionSnapshot] = await tx.getAll(appointmentRef, attentionRef);
    const appointment = appointmentSnapshot.data();
    const existing = attentionSnapshot.data();
    if (!appointment || appointment.negocioId !== businessId) {
      throw new HttpsError("not-found", "La cita ya no está disponible.");
    }
    if (appointment.atencionId) throw new HttpsError("failed-precondition", "Abre la orden de atención vinculada a esta cita.");
    const {pacienteId} = appointment;
    if (existing && (existing.negocioId !== businessId || existing.pacienteId !== pacienteId || existing.citaId !== citaId)) {
      throw new HttpsError("failed-precondition", "La atención no coincide con la cita.");
    }
    if (existing && (
      (operacion !== "borrador" && existing.estado === "finalizada" && appointment.estado === "finalizada") ||
      (operacion === "iniciar" && existing.estado === "en_atencion" && appointment.estado === "en_atencion")
    )) return {atencionId: citaId};

    const audit = auditStamp(FieldValue, uid);
    const stamp = audit.actualizadoEn;
    if (operacion === "iniciar") {
      if (existing || appointment.estado !== "en_espera" || !appointment.recepcion?.horaLlegada || !appointment.triage?.prioridad) {
        throw new HttpsError("failed-precondition", "Registra la recepción y el triage antes de iniciar la atención.");
      }
      if (!validId(pacienteId)) throw new HttpsError("failed-precondition", "La cita no tiene un paciente válido.");
      const patient = (await tx.get(businessRef.collection("pacientesVeterinarios").doc(pacienteId))).data();
      if (!patient || patient.negocioId !== businessId) {
        throw new HttpsError("failed-precondition", "El paciente no está disponible en esta empresa.");
      }
      tx.create(attentionRef, {
        ...audit, negocioId: businessId, citaId, pacienteId, estado: "en_atencion",
        iniciadaEn: stamp, iniciadoPorUid: uid, motivoConsulta: appointment.motivo ?? "",
        recepcion: appointment.recepcion, triage: appointment.triage,
      });
      tx.update(appointmentRef, {...audit, estado: "en_atencion"});
      return {atencionId: citaId};
    }
    if (operacion === "borrador") {
      if (existing?.estado !== "en_atencion" || appointment.estado !== "en_atencion") {
        throw new HttpsError("failed-precondition", "Solo puedes guardar el borrador de una atención abierta.");
      }
      await saveDraft(tx, attentionRef, existing, atencion, {audit, HttpsError});
      return {atencionId: citaId};
    }
    if (existing?.estado !== "en_atencion" || appointment.estado !== "en_atencion") {
      throw new HttpsError("failed-precondition", "Inicia la atención antes de cerrarla.");
    }

    await closeAttention(tx, attentionRef, atencion, {citaId, pacienteId},
        {businessRef, businessId, uid, audit, HttpsError, FieldValue});
    tx.update(appointmentRef, {...audit, estado: "finalizada"});
    return {atencionId: citaId};
  });
}

async function saveDraft(tx, attentionRef, existing, atencion, {audit, HttpsError}) {
  const {buildVeterinaryAttentionDraftPayload} = await importVeterinaryModel("attentionModel");
  let draft;
  try {
    draft = buildVeterinaryAttentionDraftPayload(atencion);
  } catch (error) {
    throw modelError(error, HttpsError);
  }
  // Sin lista de ítems en la solicitud se conserva la del borrador anterior.
  tx.update(attentionRef, {borrador: {...draft, items: draft.items ?? existing.borrador?.items ?? []}, ...audit});
}

async function closeAttention(tx, attentionRef, atencion, identity, {businessRef, businessId, uid, audit, HttpsError, FieldValue}) {
  const {buildVeterinaryAttentionMutationPayload} = await importVeterinaryModel("attentionModel");
  const {buildVeterinaryClinicalClosureMutationPayload} = await importVeterinaryModel("clinicalClosureModel");
  const references = await loadReferences(tx, businessRef, businessId, atencion?.items ?? [], HttpsError);
  let clinical;
  let closure;
  try {
    clinical = buildVeterinaryAttentionMutationPayload({
      ...atencion, ...identity,
      servicios: references.filter((item) => item.tipoItem === "servicio"),
      productos: references.filter((item) => item.tipoItem === "producto"),
    });
    closure = buildVeterinaryClinicalClosureMutationPayload({...identity, resultadoClinico: atencion?.resultadoClinico});
  } catch (error) {
    throw modelError(error, HttpsError);
  }
  tx.update(attentionRef, {
    ...clinical, ...audit, resultadoClinico: closure.resultadoClinico,
    estado: "finalizada", finalizadaEn: audit.actualizadoEn, finalizadoPorUid: uid,
    borrador: FieldValue.delete(),
  });
}

async function loadReferences(tx, business, businessId, items, HttpsError) {
  const {buildVeterinaryInventoryReference} = await importVeterinaryModel("inventoryPharmacyIntegrationModel");
  if (!Array.isArray(items) || items.length > 100) {
    throw new HttpsError("invalid-argument", "Registra hasta 50 servicios y 50 productos.");
  }
  const ids = new Set();
  for (const item of items) {
    if (typeof item?.itemId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(item.itemId) || ids.has(item.itemId)) {
      throw new HttpsError("invalid-argument", "Selecciona ítems de inventario válidos y sin duplicados.");
    }
    ids.add(item.itemId);
  }
  if (!items.length) return [];
  const snapshots = await tx.getAll(...items.map((item) => business.collection("inventario").doc(item.itemId)));
  return snapshots.map((snapshot, index) => {
    if (!snapshot.exists || snapshot.get("negocioId") !== businessId) {
      throw new HttpsError("failed-precondition", "El ítem no está disponible en el inventario de esta empresa.");
    }
    try {
      return buildVeterinaryInventoryReference({...snapshot.data(), id: snapshot.id}, items[index].cantidad);
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
  });
}

module.exports = {guardarAtencionVeterinariaHandler};
