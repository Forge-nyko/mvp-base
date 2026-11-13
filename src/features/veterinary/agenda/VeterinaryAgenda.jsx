import React, {useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import VeterinaryReceptionForm, {triageLabels} from "./VeterinaryReceptionForm";
import {
  guardarAtencionVeterinaria,
  guardarCitaVeterinaria,
  subscribeToVeterinaryAppointments,
  subscribeToVeterinaryPatients,
} from "../data/veterinaryDataService";

const base = "/clinica-veterinaria";
const appointmentPath = (id) => base + "/citas/" + encodeURIComponent(id);
const statusLabels = {agendada: "Agendada", confirmada: "Confirmada", en_espera: "En espera", en_atencion: "En atención", finalizada: "Finalizada", cancelada: "Cancelada", completada: "Completada"};

function AppointmentForm({appointment, businessId, patients}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => appointment ?? {});
  const [newId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const activePatients = patients.filter((patient) => ["activo", undefined].includes(patient.estado));
  const editable = !appointment || ["agendada", "confirmada"].includes(appointment.estado);

  const attentionPath = appointment && appointmentPath(appointment.id) + "/atencion";
  const canReceive = appointment && ["agendada", "confirmada", "en_espera"].includes(appointment.estado);
  const canCancel = appointment && (editable || appointment.estado === "en_espera");
  const canStart = appointment?.estado === "en_espera" && appointment.recepcion?.horaLlegada && appointment.triage?.prioridad;
  const hasAttention = appointment && ["en_atencion", "finalizada"].includes(appointment.estado);

  async function startAttention() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await guardarAtencionVeterinaria(businessId, appointment.id, "iniciar");
      navigate(attentionPath);
    } catch (failure) {
      setError(String(failure?.code).endsWith("failed-precondition")
        ? failure.message : "No se pudo iniciar la atención. Revisa tus permisos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  const change = ({target: {name, value}}) => setForm((current) => ({...current, [name]: value}));

  async function save(operation) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await guardarCitaVeterinaria(businessId, appointment?.id ?? newId, operation, {
        pacienteId: form.pacienteId,
        fecha: form.fecha,
        hora: form.hora,
        motivo: form.motivo,
        observaciones: form.observaciones ?? "",
      });
      navigate(base + "/agenda", {replace: true});
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setError(["invalid-argument", "already-exists", "failed-precondition", "not-found"].includes(code)
        ? failure.message
        : "No se pudo guardar la cita. Revisa tus permisos o inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="erp-panel">
        <h1>{appointment ? "Cita veterinaria" : "Nueva cita veterinaria"}</h1>
        {appointment && <p>Estado: {statusLabels[appointment.estado] || "Sin estado"}</p>}
        {appointment?.triage?.prioridad && <p>Prioridad: {triageLabels[appointment.triage.prioridad]}</p>}
        {!appointment && !activePatients.length && <p>Registra un paciente activo antes de crear una cita.</p>}
        <form className="erp-form" onSubmit={(event) => {
          event.preventDefault();
          if (editable) save(appointment ? "reprogramar" : "crear");
        }}>
          <label className="erp-field">
            <span>Paciente</span>
            {appointment ? (
              <Link to={base + "/pacientes/" + encodeURIComponent(appointment.pacienteId)}>
                {patients.find((patient) => patient.id === appointment.pacienteId)?.nombre || "Ver paciente"}
              </Link>
            ) : (
              <select name="pacienteId" className="erp-control" required value={form.pacienteId ?? ""} onChange={change}>
                <option value="">Selecciona un paciente</option>
                {activePatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nombre}</option>)}
              </select>
            )}
          </label>
          <div className="erp-form-grid">
            <label className="erp-field"><span>Fecha</span><input className="erp-control" name="fecha" type="date" required readOnly={!editable} value={form.fecha ?? ""} onChange={change} /></label>
            <label className="erp-field"><span>Hora</span><input className="erp-control" name="hora" type="time" required readOnly={!editable} value={form.hora ?? ""} onChange={change} /></label>
            <label className="erp-field"><span>Motivo</span><input className="erp-control" name="motivo" required maxLength={500} readOnly={!editable} value={form.motivo ?? ""} onChange={change} /></label>
            <label className="erp-field"><span>Observaciones</span><textarea className="erp-control" name="observaciones" maxLength={2000} readOnly={!editable} value={form.observaciones ?? ""} onChange={change} /></label>
          </div>
          {error && <p role="alert">{error}</p>}
          {canStart && !confirmCancel && <Button type="button" variant="secondary" disabled={saving} onClick={startAttention}>Iniciar atención</Button>}
          {hasAttention && <Link to={attentionPath}>{appointment.estado === "finalizada" ? "Ver atención" : "Continuar atención"}</Link>}
          {editable && !confirmCancel && (
            <>
              <Button type="submit" loading={saving} disabled={!appointment && !activePatients.length}>
                {appointment ? "Guardar reprogramación" : "Guardar cita"}
              </Button>
            </>
          )}
          {canCancel && !confirmCancel && <Button type="button" variant="secondary" disabled={saving} onClick={() => setConfirmCancel(true)}>Cancelar cita</Button>}
          {confirmCancel && canCancel && (
            <div>
              <p>¿Confirmas que quieres cancelar esta cita?</p>
              <Button type="button" loading={saving} onClick={() => save("cancelar")}>Confirmar cancelación</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setConfirmCancel(false)}>Volver</Button>
            </div>
          )}
        </form>
      </section>
      {canReceive && !confirmCancel && <VeterinaryReceptionForm appointment={appointment} businessId={businessId} />}
    </>
  );
}

export default function VeterinaryAgenda({businessId, mode}) {
  const {citaId} = useParams();
  const [appointments, setAppointments] = useState(null);
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return undefined;
    const fail = () => setError("No se pudo consultar la agenda de esta empresa.");
    const unsubscribeAppointments = subscribeToVeterinaryAppointments(businessId, setAppointments, fail);
    const unsubscribePatients = subscribeToVeterinaryPatients(businessId, setPatients, fail);
    return () => {
      unsubscribeAppointments();
      unsubscribePatients();
    };
  }, [businessId]);

  if (!businessId) return <p role="alert">Selecciona una empresa activa.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!appointments || !patients) return <LoadingState variant="section" label="Cargando agenda veterinaria..." />;

  const appointment = appointments.find((item) => item.id === citaId);
  const names = new Map(patients.map((patient) => [patient.id, patient.nombre]));
  const sorted = [...appointments].sort((a,b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  return (
    <div className="erp-page">
      <nav aria-label="Clínica Veterinaria"><Link to={base}>Resumen clínico</Link>{" · "}<Link to={base + "/agenda"}>Agenda</Link></nav>
      {mode === "list" && (
        <section className="erp-panel">
          <h1>Agenda veterinaria</h1>
          <Link to={base + "/agenda/nueva"}>Agendar cita</Link>
          {sorted.length ? (
            <ul>
              {sorted.map((item) => (
                <li key={item.id}>
                  <Link to={appointmentPath(item.id)}>{item.fecha} · {item.hora} · {names.get(item.pacienteId) || "Paciente"} · {item.motivo}</Link>
                  {" · "}{statusLabels[item.estado] || "Sin estado"}
                  {item.estado === "en_espera" && item.triage?.prioridad && " · Prioridad: " + triageLabels[item.triage.prioridad]}
                </li>
              ))}
            </ul>
          ) : <p className="erp-empty-state">Todavía no hay citas registradas.</p>}
        </section>
      )}
      {mode === "new" && <AppointmentForm key="nueva" businessId={businessId} patients={patients} />}
      {mode === "detail" && (appointment
        ? <AppointmentForm key={appointment.id} businessId={businessId} appointment={appointment} patients={patients} />
        : <p className="erp-empty-state">Cita no encontrada.</p>)}
    </div>
  );
}
