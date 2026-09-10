import React from "react";
//ESTO ES UNA SIMULACIÓN EN UN ENTORNO CERRADO
import PatientDetail from "../patients/PatientDetail.jsx";

export default function PatientDetailLabPreview({
  record,
  onBack,
}) {
  if (!record || !record.patient) {
    return (
      <main className="veterinary-lab-page">

        <section className="erp-panel veterinary-lab-empty">

          <h2>
            No se encontró el paciente
          </h2>

          <p>
            Selecciona un paciente desde el listado
            del laboratorio.
          </p>

          <button
            type="button"
            className="veterinary-lab-button veterinary-lab-button--secondary"
            onClick={onBack}
          >
            ← Volver a pacientes
          </button>

        </section>

      </main>
    );
  }

  return (
    <div>

      <div className="veterinary-lab-topbar">

        <button
          type="button"
          className="veterinary-lab-button veterinary-lab-button--secondary"
          onClick={onBack}
        >
          ← Volver a pacientes
        </button>

        <span>
          Entorno aislado · Patient Lab
        </span>

      </div>

      <PatientDetail
        patient={record.patient}
        tutor={record.tutor || null}
        appointments={record.appointments || []}
        history={record.history || []}

        loading={false}
        error=""

        canMutate={false}
      />

    </div>
  );
}