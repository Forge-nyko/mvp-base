import React, {useState} from "react";
import Button from "../../../components/ui/Button";
import {guardarRecepcionVeterinaria} from "../data/veterinaryDataService";
import {VETERINARY_TRIAGE_PRIORITIES} from "../domain/receptionTriageModel.mjs";

export const triageLabels = {normal: "Normal", prioritaria: "Prioritaria", urgente: "Urgente"};

const vitalFields = [
  ["pesoKg", "Peso (kg)", "any"],
  ["temperaturaC", "Temperatura (°C)", "any"],
  ["frecuenciaCardiaca", "Frecuencia cardíaca (lat/min)", "1"],
  ["frecuenciaRespiratoria", "Frecuencia respiratoria (resp/min)", "1"],
];

export default function VeterinaryReceptionForm({appointment, businessId}) {
  const [form, setForm] = useState(() => ({...appointment.recepcion, ...appointment.triage}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const change = ({target: {name, value}}) => {
    setSaved(false);
    setForm((current) => ({...current, [name]: value}));
  };
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const names = ["horaLlegada", "prioridad", "observacionesRecepcion", "observacionesTriage", ...vitalFields.map(([name]) => name)];
      const reception = Object.fromEntries(names.map((name) => [name, form[name] ?? ""]));
      await guardarRecepcionVeterinaria(businessId, appointment.id, reception);
      setSaved(true);
    } catch (failure) {
      const code = String(failure?.code || "").replace(/^functions\//, "");
      setError(["invalid-argument", "failed-precondition", "not-found"].includes(code) ? failure.message : "No se pudo guardar la recepción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="erp-panel">
      <h2>Recepción y triage</h2>
      <form className="erp-form" onSubmit={save}>
        <div className="erp-form-grid">
          <label className="erp-field"><span>Hora de llegada</span>
            <input className="erp-control" type="time" name="horaLlegada" required value={form.horaLlegada ?? ""} onChange={change} />
          </label>
          <label className="erp-field"><span>Prioridad</span>
            <select className="erp-control" name="prioridad" required value={form.prioridad ?? ""} onChange={change}>
              <option value="">Selecciona la prioridad</option>
              {VETERINARY_TRIAGE_PRIORITIES.map((priority) => <option value={priority} key={priority}>{triageLabels[priority]}</option>)}
            </select>
          </label>
          {vitalFields.map(([name, label, step]) => (
            <label className="erp-field" key={name}><span>{label}</span>
              <input className="erp-control" type="number" min="0" step={step} name={name} value={form[name] ?? ""} onChange={change} />
            </label>
          ))}
          <label className="erp-field"><span>Observaciones de recepción</span>
            <textarea className="erp-control" name="observacionesRecepcion" maxLength={1000} value={form.observacionesRecepcion ?? ""} onChange={change} />
          </label>
          <label className="erp-field"><span>Observaciones de triage</span>
            <textarea className="erp-control" name="observacionesTriage" maxLength={2000} value={form.observacionesTriage ?? ""} onChange={change} />
          </label>
        </div>
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Recepción y triage guardados.</p>}
        <Button type="submit" loading={saving}>Guardar recepción y triage</Button>
      </form>
    </section>
  );
}
