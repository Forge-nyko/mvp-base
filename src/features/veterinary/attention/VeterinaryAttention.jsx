import React, {useEffect, useId, useState} from "react";
import {Link, useParams} from "react-router-dom";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import {auth} from "../../../firebase/firebaseConfig";
import useBusinessFormat from "../../../hooks/useBusinessFormat";
import {formatDate} from "../../../utils/formatters";
import VeterinaryPhotoMap from "./VeterinaryPhotoMap";
import VeterinaryPrescriptions from "./VeterinaryPrescriptions";
import {triageLabels} from "../agenda/VeterinaryReceptionForm";
import {subscribeToInventory} from "../../../services/inventoryService";
import {guardarAtencionVeterinaria, operarOrdenVeterinaria, subscribeToVeterinaryAttentions} from "../data/veterinaryDataService";
import VeterinaryField from "../VeterinaryField";
import {getVeterinaryAttentionFieldErrors} from "../domain/attentionModel.mjs";
import {getVeterinaryClinicalClosureFieldErrors, VETERINARY_CLINICAL_OUTCOME_LABELS} from "../domain/clinicalClosureModel.mjs";
import {buildVeterinaryInventoryCatalog} from "../domain/inventoryPharmacyIntegrationModel.mjs";
import "../veterinary-lists.css";

const PENDING_ITEM_MESSAGE = "Tienes un ítem seleccionado sin añadir. Pulsa «Añadir ítem» o quita la selección antes de cerrar la atención.";

const fields = [
  ["motivoConsulta", "Motivo de consulta", 1000, true, "Describe por qué se atiende al paciente"],
  ["diagnostico", "Diagnóstico", 4000, true, "Registra el diagnóstico y los hallazgos relevantes"],
  ["tratamiento", "Tratamiento", 4000, true, "Describe el tratamiento realizado o indicado"],
  ["indicaciones", "Indicaciones", 4000, false, "Anota los cuidados y controles para el tutor"],
];

// Ítems del borrador guardado: solo itemId y cantidad; nombre, tipo y unidad vuelven a leerse de Inventario.
// Un ítem que ya no está activo en Inventario se omite y se avisa.
function restoreDraftItems(draftItems, catalog) {
  const items = [];
  let missing = 0;
  for (const {itemId, cantidad} of draftItems ?? []) {
    const entry = catalog.find((candidate) => candidate.itemId === itemId);
    if (entry) items.push({...entry, cantidad});
    else missing += 1;
  }
  return {items, missing};
}

function PriorAttentions({history}) {
  const headingId = useId();
  const {locale} = useBusinessFormat();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Antecedentes clínicos</h2>
      {history.length === 0 ? (
        <p className="erp-secondary-text">El paciente aún no tiene atenciones anteriores finalizadas.</p>
      ) : (
        <>
          <p className="erp-secondary-text">
            Hasta tres atenciones finalizadas, de la más reciente a la más antigua.
          </p>
          <ul className="veterinary-record-list">
            {history.map((record) => (
              <li key={record.id}>
                <p><strong>{record.motivoConsulta || "Atención veterinaria"}</strong>
                  {" · "}{formatDate(record.finalizadaEn || record.iniciadaEn, locale)}
                </p>
                {record.diagnostico && <p><strong>Diagnóstico:</strong> {record.diagnostico}</p>}
                {record.tratamiento && <p><strong>Tratamiento:</strong> {record.tratamiento}</p>}
                {record.indicaciones && <p><strong>Indicaciones:</strong> {record.indicaciones}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ClinicalForm({attention, businessId, inventory, history}) {
  const formId = useId();
  const [pendingPhotos, setPendingPhotos] = useState(false);
  const closed = attention.estado === "finalizada";
  const managedOrder = Boolean(attention.origen);
  const canEdit = attention.estado === "en_atencion" &&
    (!managedOrder || attention.profesionalUid === auth.currentUser?.uid);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const persist = (operation, payload) => managedOrder
    ? operarOrdenVeterinaria(businessId, attention.id, operation, payload)
    : guardarAtencionVeterinaria(businessId, attention.citaId, operation, payload);
  const catalog = buildVeterinaryInventoryCatalog(inventory);
  const [restored] = useState(() => {
    if (closed || !attention.borrador) return null;
    // Sin inventario no se puede restaurar ni juzgar qué ítems faltan: se conservan en el borrador guardado.
    return inventory ? restoreDraftItems(attention.borrador.items, catalog) : {items: [], missing: 0};
  });
  const [form, setForm] = useState(() => {
    const draft = closed ? null : attention.borrador;
    return {
      ...attention,
      ...(draft ? Object.fromEntries([...fields.map(([name]) => name), "resultadoClinico"]
        .filter((name) => typeof draft[name] === "string").map((name) => [name, draft[name]])) : {}),
      items: closed
        ? [...(attention.servicios ?? []), ...(attention.productos ?? [])]
        : restored?.items ?? [],
    };
  });
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [draftError, setDraftError] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingItemError, setPendingItemError] = useState(false);
  const add = () => {
    const item = catalog.find((entry) => entry.itemId === itemId);
    if (!item || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return;
    setForm((current) => ({...current, items: [...current.items, {...item, cantidad: Number(quantity)}]}));
    setItemId("");
    setQuantity("1");
    setPendingItemError(false);
    setDraftNotice("");
  };
  const setValue = (name, value) => {
    setForm((current) => ({...current, [name]: value}));
    setFieldErrors((current) => ({...current, [name]: undefined}));
    setDraftNotice("");
  };

  // Guarda lo escrito sin exigir los obligatorios; cerrar la atención sigue exigiéndolos.
  async function saveDraft() {
    if (saving || draftSaving || !canEdit) return;
    setDraftSaving(true);
    setDraftNotice("");
    setDraftError("");
    try {
      await persist("borrador", {
        ...Object.fromEntries(fields.map(([name]) => [name, form[name] ?? ""])),
        resultadoClinico: form.resultadoClinico ?? "",
        // Sin inventario cargado no se envía la lista: el borrador conserva los ítems ya guardados.
        ...(inventory ? {items: form.items.map(({itemId, cantidad}) => ({itemId, cantidad}))} : {}),
      });
      setDraftNotice("Borrador guardado. Puedes cerrar esta pantalla y continuar después.");
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setDraftError(["invalid-argument", "failed-precondition", "not-found", "permission-denied"].includes(code)
        ? failure.message : "No se pudo guardar el borrador. Intenta nuevamente.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function close(event) {
    event.preventDefault();
    if (saving || draftSaving || !canEdit || pendingPhotos || savingPrescription) return;
    const context = {
      citaId: attention.citaId,
      atencionId: managedOrder ? attention.id : undefined,
      pacienteId: attention.pacienteId,
    };
    const attentionErrors = getVeterinaryAttentionFieldErrors({...form, ...context});
    const nextErrors = Object.fromEntries(
      [...fields.map(([name]) => name), "resultadoClinico"].flatMap((name) => {
        const message = name === "resultadoClinico"
          ? getVeterinaryClinicalClosureFieldErrors({...context, resultadoClinico: form.resultadoClinico}).resultadoClinico
          : attentionErrors[name];
        return message ? [[name, message]] : [];
      })
    );
    setFieldErrors(nextErrors);
    // Un ítem elegido sin pulsar "Añadir ítem" no se registraría: se avisa y no se cierra.
    const hasPendingItem = itemId !== "";
    setPendingItemError(hasPendingItem);
    if (hasPendingItem || Object.keys(nextErrors).length) return;
    setSaving(true);
    setError("");
    try {
      await persist("cerrar", {
        ...Object.fromEntries(fields.map(([name]) => [name, form[name] ?? ""])),
        resultadoClinico: form.resultadoClinico,
        items: form.items.map(({itemId, cantidad}) => ({itemId, cantidad})),
      });
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setError(["invalid-argument", "failed-precondition", "not-found", "permission-denied"].includes(code)
        ? failure.message : "No se pudo cerrar la atención. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  const values = closed ? attention : form;
  const items = closed ? [...(attention.servicios ?? []), ...(attention.productos ?? [])] : form.items;
  return (
    <>
      <form id={formId} className="erp-panel erp-form" onSubmit={close} noValidate>
        <h1>{closed ? "Atención finalizada" : "Atención clínica"}</h1>
        <Link to={"/clinica-veterinaria/pacientes/" + encodeURIComponent(attention.pacienteId)}>Ver ficha del paciente</Link>
        {managedOrder && (
          <section>
            <h2>Datos de la orden</h2>
            <dl>
              <dt>Profesional a cargo</dt>
              <dd>{attention.profesionalNombre || "Sin asignar"}</dd>
              <dt>Box de atención</dt>
              <dd>{attention.box || "Sin asignar"}</dd>
              <dt>Tipo de atención</dt>
              <dd>{attention.tipoAtencion || "Sin asignar"}</dd>
            </dl>
            {!closed && !canEdit && <p>Solo el profesional asignado puede registrar la atención.</p>}
          </section>
        )}
        {!closed && <PriorAttentions history={history} />}
        {attention.recepcion && attention.triage && (
          <section>
            <h2>Recepción y triage</h2>
            <p>Llegada: {attention.recepcion.horaLlegada} · Prioridad: {triageLabels[attention.triage.prioridad]}</p>
            {attention.recepcion.observacionesRecepcion && <p>{attention.recepcion.observacionesRecepcion}</p>}
            {attention.triage.observacionesTriage && <p>{attention.triage.observacionesTriage}</p>}
            <ul>
              {attention.triage.pesoKg != null && <li>Peso: {attention.triage.pesoKg} kg</li>}
              {attention.triage.temperaturaC != null && <li>Temperatura: {attention.triage.temperaturaC} °C</li>}
              {attention.triage.frecuenciaCardiaca != null && <li>Frecuencia cardíaca: {attention.triage.frecuenciaCardiaca} lat/min</li>}
              {attention.triage.frecuenciaRespiratoria != null && <li>Frecuencia respiratoria: {attention.triage.frecuenciaRespiratoria} resp/min</li>}
            </ul>
          </section>
        )}
        <div className="erp-form-grid">
          {fields.map(([name, label, maxLength, required, placeholder]) => (
            <VeterinaryField key={name} label={label} required={required && canEdit} error={fieldErrors[name]}>
              <textarea className="erp-control" name={name} maxLength={maxLength} readOnly={!canEdit}
                placeholder={canEdit ? placeholder : undefined}
                value={values[name] ?? ""} onChange={({target}) => setValue(name, target.value)} />
            </VeterinaryField>
          ))}
          <VeterinaryField label="Resultado clínico" required={canEdit} error={fieldErrors.resultadoClinico}>
            <select className="erp-control" name="resultadoClinico" disabled={!canEdit} value={values.resultadoClinico ?? ""}
              onChange={({target}) => setValue("resultadoClinico", target.value)}>
              <option value="">Selecciona un resultado</option>
              {Object.entries(VETERINARY_CLINICAL_OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </VeterinaryField>
        </div>
        {restored?.missing > 0 && <p role="status">{restored.missing === 1
          ? "1 ítem del borrador ya no está disponible en Inventario y se omitió."
          : restored.missing + " ítems del borrador ya no están disponibles en Inventario y se omitieron."}</p>}
        <h2>Servicios y productos utilizados</h2>
        <p>Este registro clínico no descuenta stock.</p>
        {canEdit && inventory && (
          <div className="erp-form-grid">
            <label className="erp-field"><span>Ítem de inventario</span>
              <select className="erp-control" value={itemId} aria-invalid={pendingItemError} onChange={({target}) => {
                setItemId(target.value);
                setPendingItemError(false);
              }}>
                <option value="">Selecciona un ítem</option>
                {catalog.filter((item) => !items.some((selected) => selected.itemId === item.itemId)).map((item) =>
                  <option key={item.itemId} value={item.itemId}>{item.nombre} ({item.tipoItem})</option>
                )}
              </select>
            </label>
            <label className="erp-field"><span>Cantidad</span>
              <input className="erp-control" type="number" step="any" min="0" value={quantity} onChange={({target}) => setQuantity(target.value)} />
            </label>
            <Button type="button" disabled={!itemId || !(Number(quantity) > 0)} onClick={add}>Añadir ítem</Button>
          </div>
        )}
        {canEdit && !inventory && <p>No se pudo consultar el inventario. Puedes cerrar la atención sin ítems.</p>}
        {items.length > 0 && <ul>{items.map((item) => (
          <li key={item.itemId}>{item.nombre} · {item.cantidad} {item.unidad}
            {canEdit && <Button type="button" variant="secondary" aria-label={"Quitar " + item.nombre}
              onClick={() => { setForm((current) => ({...current, items: current.items.filter((entry) => entry.itemId !== item.itemId)})); setDraftNotice(""); }}>Quitar</Button>}
          </li>
        ))}</ul>}
      </form>
      {managedOrder && <VeterinaryPrescriptions attention={attention} businessId={businessId}
        canIssue={canEdit && !saving} onSavingChange={setSavingPrescription} />}
      <VeterinaryPhotoMap businessId={businessId} attention={attention} readOnly={!canEdit} onPendingChange={setPendingPhotos} />
      {canEdit && (
        <div className="erp-panel">
          {error && <p role="alert">{error}</p>}
          {draftError && <p role="alert">{draftError}</p>}
          {draftNotice && <p role="status">{draftNotice}</p>}
          {pendingItemError && <p className="veterinary-field-error" role="alert">{PENDING_ITEM_MESSAGE}</p>}
          {pendingPhotos && <p>Sube o quita las fotos pendientes antes de cerrar la atención.</p>}
          <Button type="button" variant="secondary" loading={draftSaving} disabled={saving} onClick={saveDraft}>Guardar borrador</Button>
          <Button type="submit" form={formId} loading={saving} disabled={pendingPhotos || draftSaving || savingPrescription}>Cerrar atención</Button>
        </div>
      )}
    </>
  );
}

export default function VeterinaryAttention({businessId}) {
  const {citaId, atencionId} = useParams();
  const [attentions, setAttentions] = useState(null);
  // undefined = cargando, null = no se pudo consultar. El borrador necesita el catálogo para restaurar sus ítems.
  const [inventory, setInventory] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!businessId) return undefined;
    const stopAttention = subscribeToVeterinaryAttentions(businessId, setAttentions, () => setError("No se pudo consultar la atención."));
    const stopInventory = subscribeToInventory(businessId, setInventory, () => setInventory(null));
    return () => {
      stopAttention();
      stopInventory();
    };
  }, [businessId]);

  if (!businessId || error) return <p role="alert">{error || "Selecciona una empresa activa."}</p>;
  if (!attentions || inventory === undefined) return <LoadingState variant="section" label="Cargando atención clínica..." />;
  const attention = attentions.find((item) => item.id === (atencionId || citaId));
  const previousAttentions = attention?.pacienteId
    ? attentions.filter((item) => (
        item.id !== attention.id &&
        item.negocioId === businessId &&
        item.pacienteId === attention.pacienteId &&
        item.estado === "finalizada"
      )).sort((a, b) => (b.finalizadaEn?.toMillis?.() ?? b.iniciadaEn?.toMillis?.() ?? 0) -
        (a.finalizadaEn?.toMillis?.() ?? a.iniciadaEn?.toMillis?.() ?? 0)).slice(0, 3)
    : [];

  const ordersPath = "/clinica-veterinaria/ordenes";
  const returnPath = atencionId ? ordersPath : "/clinica-veterinaria/citas/" + encodeURIComponent(citaId);
  return (
    <section className="erp-page">
      <Link to={returnPath}>{atencionId ? "Volver a órdenes" : "Volver a la cita"}</Link>
      {attention && ["en_atencion", "finalizada"].includes(attention.estado)
        ? <ClinicalForm key={attention.id} attention={attention} businessId={businessId} inventory={inventory} history={previousAttentions} />
        : <div className="erp-empty-state">
          <p>{attention?.estado === "en_espera" ? "La atención todavía no ha comenzado."
            : attention?.estado === "cancelada" ? "La orden está cancelada." : "No se encontró la atención."}</p>
          {atencionId && attention?.estado === "en_espera" && (
            <Link to={ordersPath + "/" + encodeURIComponent(atencionId)}>Ver la orden</Link>
          )}
        </div>}
    </section>
  );
}
