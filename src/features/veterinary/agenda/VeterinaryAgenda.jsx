import React, {useEffect, useState} from "react";
import {CalendarDays, ClipboardList, Plus} from "lucide-react";
import {Link, useNavigate, useParams} from "react-router-dom";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import LoadingState from "../../../components/ui/LoadingState";
import ModuleHeader from "../../../components/ui/ModuleHeader";
import VeterinaryReceptionForm, {triageLabels} from "./VeterinaryReceptionForm";
import VeterinaryField from "../VeterinaryField";
import useBusinessFormat from "../../../hooks/useBusinessFormat";
import {formatDate} from "../../../utils/formatters";
import {getVeterinaryAppointmentFieldErrors} from "../domain/appointmentModel.mjs";
import {
  guardarCitaVeterinaria,
  operarOrdenVeterinaria,
  subscribeToVeterinaryAppointments,
  subscribeToVeterinaryPatients,
} from "../data/veterinaryDataService";
import "../veterinary-lists.css";

const base = "/clinica-veterinaria";
const appointmentPath = (id) => base + "/citas/" + encodeURIComponent(id);
const statusLabels = {agendada: "Agendada", confirmada: "Confirmada", en_espera: "En espera", en_atencion: "En atención", finalizada: "Finalizada", cancelada: "Cancelada", completada: "Completada"};

function AppointmentForm({appointment, businessId, patients}) {
  const {locale} = useBusinessFormat();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => appointment ?? {});
  const [newId] = useState(() => crypto.randomUUID());
  const [newOrderId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const activePatients = patients.filter((patient) => ["activo", undefined].includes(patient.estado));
  const editable = !appointment || ["agendada", "confirmada"].includes(appointment.estado);

  const orderPath = appointment?.atencionId && base + "/ordenes/" + encodeURIComponent(appointment.atencionId);
  const hasAttention = appointment && ["en_atencion", "finalizada"].includes(appointment.estado);
  const attentionPath = hasAttention && (orderPath ? orderPath + "/atencion" : appointmentPath(appointment.id) + "/atencion");
  const canReceive = appointment && !orderPath && ["agendada", "confirmada", "en_espera"].includes(appointment.estado);
  const canCancel = appointment && !orderPath && (editable || appointment.estado === "en_espera");
  const canCreateOrder = !orderPath && appointment?.estado === "en_espera" &&
    appointment.recepcion?.horaLlegada && appointment.triage?.prioridad;

  async function createOrder() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const attentionId = await operarOrdenVeterinaria(businessId, newOrderId, "crearOrden", {origen: "cita"}, appointment.id);
      navigate(base + "/ordenes/" + encodeURIComponent(attentionId));
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setError(["invalid-argument", "already-exists", "failed-precondition", "not-found", "aborted"].includes(code)
        ? failure.message : "No se pudo crear la orden de atención.");
    } finally {
      setSaving(false);
    }
  }

  const change = ({target: {name, value}}) => {
    setForm((current) => ({...current, [name]: value}));
    setFieldErrors((current) => ({...current, [name]: undefined}));
  };

  async function save(operation) {
    if (saving) return;
    if (operation !== "cancelar") {
      // El tutor lo deriva la Function desde el paciente; aquí solo se validan los campos del formulario.
      const nextErrors = getVeterinaryAppointmentFieldErrors({...form, tutorClienteId: "derivado-por-backend"});
      delete nextErrors.tutorClienteId;
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
    }
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
      setError(["invalid-argument", "already-exists", "failed-precondition", "not-found", "aborted"].includes(code)
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
        {appointment && <p>Fecha y hora: {formatDate(appointment.fecha, locale)} · {appointment.hora || "—"}</p>}
        {appointment && <p>Estado: {statusLabels[appointment.estado] || "Sin estado"}</p>}
        {appointment?.triage?.prioridad && <p>Prioridad: {triageLabels[appointment.triage.prioridad]}</p>}
        {!appointment && !activePatients.length && <p>Registra un paciente activo antes de crear una cita.</p>}
        <form className="erp-form" noValidate onSubmit={(event) => {
          event.preventDefault();
          if (editable) save(appointment ? "reprogramar" : "crear");
        }}>
          {appointment ? (
            <div className="erp-field">
              <span className="erp-field__label">Paciente</span>
              <Link to={base + "/pacientes/" + encodeURIComponent(appointment.pacienteId)}>
                {patients.find((patient) => patient.id === appointment.pacienteId)?.nombre || "Ver paciente"}
              </Link>
            </div>
          ) : (
            <VeterinaryField label="Paciente" required error={fieldErrors.pacienteId}>
              <select name="pacienteId" className="erp-control" value={form.pacienteId ?? ""} onChange={change}>
                <option value="">Selecciona un paciente</option>
                {activePatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nombre}</option>)}
              </select>
            </VeterinaryField>
          )}
          <div className="erp-form-grid">
            {editable && (
              <>
                <VeterinaryField label="Fecha" required error={fieldErrors.fecha}><input className="erp-control" name="fecha" type="date" value={form.fecha ?? ""} onChange={change} /></VeterinaryField>
                <VeterinaryField label="Hora" required error={fieldErrors.hora}><input className="erp-control" name="hora" type="time" value={form.hora ?? ""} onChange={change} /></VeterinaryField>
              </>
            )}
            <VeterinaryField label="Motivo" required={editable} error={fieldErrors.motivo}>
              <input className="erp-control" name="motivo" maxLength={500} readOnly={!editable}
                placeholder={editable ? "Ej. Control de vacunación" : undefined}
                value={form.motivo ?? ""} onChange={change} />
            </VeterinaryField>
            <VeterinaryField label="Observaciones" error={fieldErrors.observaciones}>
              <textarea className="erp-control" name="observaciones" maxLength={2000} readOnly={!editable}
                placeholder={editable ? "Anota indicaciones para la cita" : undefined}
                value={form.observaciones ?? ""} onChange={change} />
            </VeterinaryField>
          </div>
          {error && <p role="alert">{error}</p>}
          {canCreateOrder && !confirmCancel && (
            <Button type="button" icon={ClipboardList} loading={saving} onClick={createOrder}>Crear orden de atención</Button>
          )}
          {orderPath && appointment.estado === "en_espera" && (
            <Button type="button" icon={ClipboardList} onClick={() => navigate(orderPath)}>Ver orden de atención</Button>
          )}
          {attentionPath && (
            <Button type="button" variant="secondary" onClick={() => navigate(attentionPath)}>
              {appointment.estado === "finalizada" ? "Ver atención" : "Continuar atención"}
            </Button>
          )}
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
  const {locale} = useBusinessFormat();
  const {citaId} = useParams();
  const navigate = useNavigate();
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
  const scheduleAppointment = () => navigate(base + "/agenda/nueva");

  return (
    <div className="erp-page">
      {mode !== "list" && <nav aria-label="Clínica Veterinaria"><Link to={base + "/agenda"}>Volver a la agenda</Link></nav>}
      {mode === "list" && (
        <>
          <ModuleHeader
            className="veterinary-module-header"
            actions={<Button type="button" icon={Plus} onClick={scheduleAppointment}>Agendar cita</Button>}
            description="Agenda consultas y revisa las citas de tu clínica."
            hasData={appointments.length > 0}
            icon={CalendarDays}
            title="Agenda"
          />
          {sorted.length === 0 ? (
            <EmptyState
              action={{label: "Agendar cita", icon: Plus, onClick: scheduleAppointment}}
              description="Agenda la primera cita para un paciente registrado."
              icon={CalendarDays}
              title="Aún no hay citas"
            />
          ) : (
            <section className="erp-panel">
              <ul className="veterinary-record-list">
                {sorted.map((item) => (
                  <li key={item.id}>
                    <Link to={appointmentPath(item.id)}>{formatDate(item.fecha, locale)} · {item.hora} · {names.get(item.pacienteId) || "Paciente"} · {item.motivo}</Link>
                    <span className="erp-secondary-text">
                      {statusLabels[item.estado] || "Sin estado"}
                      {item.estado === "en_espera" && item.triage?.prioridad && " · Prioridad: " + triageLabels[item.triage.prioridad]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {mode === "new" && <AppointmentForm key="nueva" businessId={businessId} patients={patients} />}
      {mode === "detail" && (appointment
        ? <AppointmentForm key={appointment.id} businessId={businessId} appointment={appointment} patients={patients} />
        : <p className="erp-empty-state">Cita no encontrada.</p>)}
    </div>
  );
}
