import React, {useEffect, useId, useState} from "react";
import {Link, useParams} from "react-router-dom";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import VeterinaryPhotoMap from "./VeterinaryPhotoMap";
import {triageLabels} from "../agenda/VeterinaryReceptionForm";
import {subscribeToInventory} from "../../../services/inventoryService";
import {guardarAtencionVeterinaria, subscribeToVeterinaryAttentions} from "../data/veterinaryDataService";
import {buildVeterinaryInventoryCatalog} from "../domain/inventoryPharmacyIntegrationModel.mjs";

const fields = [
  ["motivoConsulta", "Motivo de consulta", 1000, true],
  ["diagnostico", "Diagnóstico", 4000, true],
  ["tratamiento", "Tratamiento", 4000, true],
  ["indicaciones", "Indicaciones", 4000, false],
];
const outcomes = {alta: "Alta", control: "Control", derivacion: "Derivación"};

function ClinicalForm({attention, businessId, inventory}) {
  const formId = useId();
  const [pendingPhotos, setPendingPhotos] = useState(false);
  const [form, setForm] = useState(() => ({
    ...attention, items: [...(attention.servicios ?? []), ...(attention.productos ?? [])],
  }));
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const closed = attention.estado === "finalizada";
  const catalog = buildVeterinaryInventoryCatalog(inventory);
  const add = () => {
    const item = catalog.find((entry) => entry.itemId === itemId);
    if (!item || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return;
    setForm((current) => ({...current, items: [...current.items, {...item, cantidad: Number(quantity)}]}));
    setItemId("");
    setQuantity("1");
  };

  async function close(event) {
    event.preventDefault();
    if (saving || closed || pendingPhotos) return;
    setSaving(true);
    setError("");
    try {
      await guardarAtencionVeterinaria(businessId, attention.citaId, "cerrar", {
        ...Object.fromEntries(fields.map(([name]) => [name, form[name] ?? ""])),
        resultadoClinico: form.resultadoClinico,
        items: form.items.map(({itemId, cantidad}) => ({itemId, cantidad})),
      });
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setError(["invalid-argument", "failed-precondition", "not-found"].includes(code)
        ? failure.message : "No se pudo cerrar la atención. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  const values = closed ? attention : form;
  const items = closed ? [...(attention.servicios ?? []), ...(attention.productos ?? [])] : form.items;
  return (
    <>
      <form id={formId} className="erp-panel erp-form" onSubmit={close}>
        <h1>{closed ? "Atención finalizada" : "Atención clínica"}</h1>
        <Link to={"/clinica-veterinaria/pacientes/" + encodeURIComponent(attention.pacienteId)}>Ver ficha del paciente</Link>
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
          {fields.map(([name, label, maxLength, required]) => (
            <label className="erp-field" key={name}><span>{label}</span>
              <textarea className="erp-control" name={name} maxLength={maxLength} required={required} readOnly={closed}
                value={values[name] ?? ""} onChange={({target}) => setForm((current) => ({...current, [name]: target.value}))} />
            </label>
          ))}
          <label className="erp-field"><span>Resultado clínico</span>
            <select className="erp-control" name="resultadoClinico" required disabled={closed} value={values.resultadoClinico ?? ""}
              onChange={({target}) => setForm((current) => ({...current, resultadoClinico: target.value}))}>
              <option value="">Selecciona un resultado</option>
              {Object.entries(outcomes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <h2>Servicios y productos utilizados</h2>
        <p>Este registro clínico no descuenta stock.</p>
        {!closed && inventory && (
          <div className="erp-form-grid">
            <label className="erp-field"><span>Ítem de inventario</span>
              <select className="erp-control" value={itemId} onChange={({target}) => setItemId(target.value)}>
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
        {!closed && !inventory && <p>No se pudo consultar el inventario. Puedes cerrar la atención sin ítems.</p>}
        {items.length > 0 && <ul>{items.map((item) => (
          <li key={item.itemId}>{item.nombre} · {item.cantidad} {item.unidad}
            {!closed && <Button type="button" variant="secondary" aria-label={"Quitar " + item.nombre}
              onClick={() => setForm((current) => ({...current, items: current.items.filter((entry) => entry.itemId !== item.itemId)}))}>Quitar</Button>}
          </li>
        ))}</ul>}
      </form>
      <VeterinaryPhotoMap businessId={businessId} attention={attention} onPendingChange={setPendingPhotos} />
      {!closed && (
        <div className="erp-panel">
          {error && <p role="alert">{error}</p>}
          {pendingPhotos && <p>Sube o quita las fotos pendientes antes de cerrar la atención.</p>}
          <Button type="submit" form={formId} loading={saving} disabled={pendingPhotos}>Cerrar atención</Button>
        </div>
      )}
    </>
  );
}

export default function VeterinaryAttention({businessId}) {
  const {citaId} = useParams();
  const [attentions, setAttentions] = useState(null);
  const [inventory, setInventory] = useState([]);
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
  if (!attentions) return <LoadingState variant="section" label="Cargando atención clínica..." />;
  const attention = attentions.find((item) => item.id === citaId);

  return (
    <section className="erp-page">
      <Link to={"/clinica-veterinaria/citas/" + encodeURIComponent(citaId)}>Volver a la cita</Link>
      {attention ? <ClinicalForm key={attention.id} attention={attention} businessId={businessId} inventory={inventory} />
        : <p className="erp-empty-state">Aún no hay una atención asociada a esta cita.</p>}
    </section>
  );
}
