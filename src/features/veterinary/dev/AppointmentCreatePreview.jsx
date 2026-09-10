import React, {
  useMemo,
  useState,
} from "react";

import {
  buildVeterinaryAppointmentMutationPayload,
  getVeterinaryAppointmentFieldErrors,
  hasVeterinaryAppointmentSlotConflict,
} from "../domain/appointmentModel.mjs";


const EMPTY_FORM = {
  pacienteId: "",
  fecha: "",
  hora: "",
  motivo: "",
  observaciones: "",
};


function createPreviewId(prefix) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}


function getTodayIsoDate() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


function FieldError({
  message,
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="veterinary-agenda-field-error"
      role="alert"
    >
      {message}
    </p>
  );
}


export default function AppointmentCreatePreview({
  patientRecords = [],
  appointments = [],
  onCancel,
  onCreated,
}) {
  const [form, setForm] =
    useState({
      ...EMPTY_FORM,
      fecha: getTodayIsoDate(),
    });

  const [errors, setErrors] =
    useState({});


  const selectedRecord =
    useMemo(() => {
      return (
        patientRecords.find(
          (record) =>
            record.patient
              ?.pacienteId ===
            form.pacienteId
        ) || null
      );
    }, [
      patientRecords,
      form.pacienteId,
    ]);


  const updateField = (
    field,
    value
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    setErrors(
      (current) => ({
        ...current,
        [field]: "",
        horario: "",
      })
    );
  };


  const handleSubmit = (
    event
  ) => {
    event.preventDefault();


    if (!selectedRecord) {
      setErrors({
        pacienteId:
          "Selecciona un paciente válido.",
      });

      return;
    }


    const patient =
      selectedRecord.patient;

    const tutor =
      selectedRecord.tutor || {};


    const rawAppointment = {
      pacienteId:
        patient.pacienteId,

      tutorClienteId:
        patient.tutorClienteId ||
        tutor.clienteId ||
        "",

      fecha:
        form.fecha,

      hora:
        form.hora,

      motivo:
        form.motivo,

      observaciones:
        form.observaciones,
    };


    const nextErrors = {
      ...getVeterinaryAppointmentFieldErrors(
        rawAppointment
      ),
    };


    const hasConflict =
      hasVeterinaryAppointmentSlotConflict(
        appointments,
        rawAppointment
      );


    if (hasConflict) {
      nextErrors.horario =
        "Ya existe una reserva activa para esa fecha y hora.";
    }


    setErrors(
      nextErrors
    );


    if (
      Object.keys(
        nextErrors
      ).length > 0
    ) {
      return;
    }


    const payload =
      buildVeterinaryAppointmentMutationPayload(
        rawAppointment
      );


    const citaId =
      createPreviewId(
        "cita"
      );


    const record = {
      ...payload,

      citaId,

      /*
       * Datos adicionales SOLO
       * para mostrar información
       * dentro del entorno aislado.
       */

      pacienteNombre:
        patient.nombre ||
        "Paciente",

      pacienteEspecie:
        patient.especie ||
        "",

      tutorNombre:
        tutor.nombreRazonSocial ||
        tutor.nombre ||
        "Sin tutor",

      /*
       * En la integración real,
       * el estado será controlado
       * por el backend.
       */

      estado:
        "agendada",

      previewCreatedAt:
        new Date().toISOString(),
    };


    onCreated?.(
      record
    );
  };


  return (
    <main className="veterinary-agenda-page">

      <header className="veterinary-agenda-header">

        <div>

          <p className="veterinary-agenda-eyebrow">
            ValoraCloud
          </p>

          <h1>
            Nueva reserva
          </h1>

          <p>
            Agenda una cita para un paciente
            registrado en el Patient Lab.
          </p>

        </div>

      </header>


      <form
        className="erp-panel veterinary-agenda-form"
        onSubmit={
          handleSubmit
        }
      >

        <section>

          <div>

            <h2>
              Paciente
            </h2>

            <p className="veterinary-agenda-help">
              Selecciona un paciente creado
              previamente en el entorno aislado.
            </p>

          </div>


          {patientRecords.length === 0 ? (

            <div className="veterinary-agenda-warning">

              <strong>
                No existen pacientes disponibles.
              </strong>

              <p>
                Primero debes crear al menos un
                paciente desde el Patient Lab.
              </p>

            </div>

          ) : (

            <div className="veterinary-agenda-form-grid">

              <label>

                <span>
                  Paciente *
                </span>

                <select
                  value={
                    form.pacienteId
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "pacienteId",
                        event.target.value
                      )
                  }
                >

                  <option value="">
                    Selecciona un paciente
                  </option>

                  {patientRecords.map(
                    (record) => {

                      const patient =
                        record.patient || {};

                      const tutor =
                        record.tutor || {};

                      return (
                        <option
                          key={
                            patient.pacienteId
                          }
                          value={
                            patient.pacienteId
                          }
                        >
                          {
                            patient.nombre ||
                            "Paciente sin nombre"
                          }
                          {" - "}
                          {
                            patient.especie ||
                            "Sin especie"
                          }
                          {" - Tutor: "}
                          {
                            tutor.nombreRazonSocial ||
                            tutor.nombre ||
                            "Sin tutor"
                          }
                        </option>
                      );
                    }
                  )}

                </select>

                <FieldError
                  message={
                    errors.pacienteId
                  }
                />

              </label>

            </div>

          )}

        </section>


        {selectedRecord && (

          <section className="veterinary-agenda-selected-patient">

            <div>

              <span>
                Paciente seleccionado
              </span>

              <strong>
                {
                  selectedRecord
                    .patient
                    ?.nombre
                }
              </strong>

            </div>


            <div>

              <span>
                Especie
              </span>

              <strong>
                {
                  selectedRecord
                    .patient
                    ?.especie ||
                  "No registrada"
                }
              </strong>

            </div>


            <div>

              <span>
                Tutor
              </span>

              <strong>
                {
                  selectedRecord
                    .tutor
                    ?.nombreRazonSocial ||
                  selectedRecord
                    .tutor
                    ?.nombre ||
                  "Sin tutor"
                }
              </strong>

            </div>

          </section>

        )}


        <section>

          <h2>
            Fecha y horario
          </h2>


          <div className="veterinary-agenda-form-grid">

            <label>

              <span>
                Fecha *
              </span>

              <input
                type="date"
                min={
                  getTodayIsoDate()
                }
                value={
                  form.fecha
                }
                onChange={
                  (event) =>
                    updateField(
                      "fecha",
                      event.target.value
                    )
                }
              />

              <FieldError
                message={
                  errors.fecha
                }
              />

            </label>


            <label>

              <span>
                Hora *
              </span>

              <input
                type="time"
                value={
                  form.hora
                }
                onChange={
                  (event) =>
                    updateField(
                      "hora",
                      event.target.value
                    )
                }
              />

              <FieldError
                message={
                  errors.hora
                }
              />

            </label>

          </div>


          <FieldError
            message={
              errors.horario
            }
          />

        </section>


        <section>

          <h2>
            Motivo de la reserva
          </h2>


          <div className="veterinary-agenda-form-stack">

            <label>

              <span>
                Motivo *
              </span>

              <input
                type="text"
                maxLength="500"
                placeholder="Ej.: Control general"
                value={
                  form.motivo
                }
                onChange={
                  (event) =>
                    updateField(
                      "motivo",
                      event.target.value
                    )
                }
              />

              <FieldError
                message={
                  errors.motivo
                }
              />

            </label>


            <label>

              <span>
                Observaciones
              </span>

              <textarea
                rows="4"
                maxLength="2000"
                placeholder="Información adicional para la reserva..."
                value={
                  form.observaciones
                }
                onChange={
                  (event) =>
                    updateField(
                      "observaciones",
                      event.target.value
                    )
                }
              />

              <FieldError
                message={
                  errors.observaciones
                }
              />

            </label>

          </div>

        </section>


        <div className="veterinary-agenda-form-actions">

          <button
            type="button"
            className="veterinary-agenda-button veterinary-agenda-button--secondary"
            onClick={
              onCancel
            }
          >
            Cancelar
          </button>


          <button
            type="submit"
            className="veterinary-agenda-button"
            disabled={
              patientRecords.length === 0
            }
          >
            Guardar reserva
          </button>

        </div>

      </form>

    </main>
  );
}