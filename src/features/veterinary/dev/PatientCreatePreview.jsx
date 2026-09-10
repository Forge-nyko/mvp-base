import React, { useState } from "react";
//ESTO ES UNA SIMULACIÓN EN UN ENTORNO CERRADO
import {
  buildVeterinaryPatientMutationPayload,
  getVeterinaryPatientFieldErrors,
} from "../domain/patientModel.mjs";

const EMPTY_FORM = {
  tutorNombre: "",
  tutorTelefono: "",
  tutorEmail: "",

  nombre: "",
  especie: "",
  raza: "",
  sexo: "",
  fechaNacimiento: "",
  edadEstimada: "",
  peso: "",
  color: "",
  microchip: "",

  alergias: "",
  antecedentes: "",
  observaciones: "",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function createPreviewId(prefix) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p
      className="veterinary-lab-field-error"
      role="alert"
    >
      {message}
    </p>
  );
}

export default function PatientCreatePreview({
  onCancel,
  onCreated,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: "",
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const tutorNombre = normalizeText(
      form.tutorNombre
    );

    const tutorClienteId = tutorNombre
      ? createPreviewId("tutor")
      : "";

    const rawPatient = {
      tutorClienteId,

      nombre: form.nombre,
      especie: form.especie,
      raza: form.raza,
      sexo: form.sexo,

      fechaNacimiento:
        form.fechaNacimiento,

      edadEstimada:
        form.edadEstimada,

      peso: form.peso,

      color: form.color,
      microchip: form.microchip,

      alergias: form.alergias,

      antecedentes:
        form.antecedentes,

      observaciones:
        form.observaciones,
    };

    const nextErrors = {
      ...getVeterinaryPatientFieldErrors(
        rawPatient
      ),
    };

    if (!tutorNombre) {
      nextErrors.tutorNombre =
        "Ingresa el nombre del tutor.";
    }

    const tutorEmail = normalizeText(
      form.tutorEmail
    );

    if (
      tutorEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        tutorEmail
      )
    ) {
      nextErrors.tutorEmail =
        "Ingresa un correo válido.";
    }

    setErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0
    ) {
      return;
    }

    const patientPayload =
      buildVeterinaryPatientMutationPayload(
        rawPatient
      );

    const pacienteId =
      createPreviewId("paciente");

    const record = {
      patient: {
        ...patientPayload,

        pacienteId,

        // Solo para este laboratorio.
        // En producción será controlado
        // por el backend.
        estado: "activo",
      },

      tutor: {
        clienteId: tutorClienteId,

        nombreRazonSocial:
          tutorNombre,

        telefono: normalizeText(
          form.tutorTelefono
        ),

        email: tutorEmail,

        direccion: "",
      },

      appointments: [],

      history: [],

      previewCreatedAt:
        new Date().toISOString(),
    };

    onCreated?.(record);
  };

  return (
    <main className="veterinary-lab-page">

      <header className="veterinary-lab-header">
        <div>

          <p className="veterinary-lab-eyebrow">
            ValoraCloud
          </p>

          <h1>Nuevo paciente</h1>

          <p>
            Este registro será guardado
            solamente en este navegador.
          </p>

        </div>
      </header>

      <form
        className="erp-panel veterinary-lab-form"
        onSubmit={handleSubmit}
      >

        <section>

          <div>
            <h2>Tutor responsable</h2>

            <p className="veterinary-lab-help">
              En la integración definitiva
              el tutor será seleccionado
              desde Clientes Core.
            </p>
          </div>

          <div className="veterinary-lab-form-grid">

            <label>

              <span>Nombre del tutor *</span>

              <input
                type="text"
                value={form.tutorNombre}
                onChange={(event) =>
                  updateField(
                    "tutorNombre",
                    event.target.value
                  )
                }
              />

              <FieldError
                message={
                  errors.tutorNombre
                }
              />

            </label>

            <label>

              <span>Teléfono</span>

              <input
                type="text"
                value={form.tutorTelefono}
                onChange={(event) =>
                  updateField(
                    "tutorTelefono",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Correo</span>

              <input
                type="email"
                value={form.tutorEmail}
                onChange={(event) =>
                  updateField(
                    "tutorEmail",
                    event.target.value
                  )
                }
              />

              <FieldError
                message={
                  errors.tutorEmail
                }
              />

            </label>

          </div>

        </section>

        <section>

          <h2>
            Información del paciente
          </h2>

          <div className="veterinary-lab-form-grid">

            <label>

              <span>Nombre *</span>

              <input
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  updateField(
                    "nombre",
                    event.target.value
                  )
                }
              />

              <FieldError
                message={errors.nombre}
              />

            </label>

            <label>

              <span>Especie *</span>

              <select
                value={form.especie}
                onChange={(event) =>
                  updateField(
                    "especie",
                    event.target.value
                  )
                }
              >

                <option value="">
                  Selecciona una especie
                </option>

                <option value="Canino">
                  Canino
                </option>

                <option value="Felino">
                  Felino
                </option>

                <option value="Ave">
                  Ave
                </option>

                <option value="Conejo">
                  Conejo
                </option>

                <option value="Otro">
                  Otro
                </option>

              </select>

              <FieldError
                message={errors.especie}
              />

            </label>

            <label>

              <span>Raza</span>

              <input
                type="text"
                value={form.raza}
                onChange={(event) =>
                  updateField(
                    "raza",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Sexo</span>

              <select
                value={form.sexo}
                onChange={(event) =>
                  updateField(
                    "sexo",
                    event.target.value
                  )
                }
              >

                <option value="">
                  No especificado
                </option>

                <option value="Macho">
                  Macho
                </option>

                <option value="Hembra">
                  Hembra
                </option>

              </select>

            </label>

            <label>

              <span>
                Fecha de nacimiento
              </span>

              <input
                type="date"
                value={
                  form.fechaNacimiento
                }
                onChange={(event) =>
                  updateField(
                    "fechaNacimiento",
                    event.target.value
                  )
                }
              />

              <FieldError
                message={
                  errors.fechaNacimiento
                }
              />

            </label>

            <label>

              <span>
                Edad estimada
              </span>

              <input
                type="text"
                placeholder="Ej.: 3 años"
                value={
                  form.edadEstimada
                }
                onChange={(event) =>
                  updateField(
                    "edadEstimada",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Peso (kg)</span>

              <input
                type="number"
                min="0"
                step="0.1"
                value={form.peso}
                onChange={(event) =>
                  updateField(
                    "peso",
                    event.target.value
                  )
                }
              />

              <FieldError
                message={errors.peso}
              />

            </label>

            <label>

              <span>Color</span>

              <input
                type="text"
                value={form.color}
                onChange={(event) =>
                  updateField(
                    "color",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Microchip</span>

              <input
                type="text"
                value={form.microchip}
                onChange={(event) =>
                  updateField(
                    "microchip",
                    event.target.value
                  )
                }
              />

            </label>

          </div>

        </section>

        <section>

          <h2>
            Antecedentes clínicos
          </h2>

          <div className="veterinary-lab-form-stack">

            <label>

              <span>Alergias</span>

              <textarea
                rows="3"
                value={form.alergias}
                onChange={(event) =>
                  updateField(
                    "alergias",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Antecedentes</span>

              <textarea
                rows="4"
                value={
                  form.antecedentes
                }
                onChange={(event) =>
                  updateField(
                    "antecedentes",
                    event.target.value
                  )
                }
              />

            </label>

            <label>

              <span>Observaciones</span>

              <textarea
                rows="4"
                value={
                  form.observaciones
                }
                onChange={(event) =>
                  updateField(
                    "observaciones",
                    event.target.value
                  )
                }
              />

            </label>

          </div>

        </section>

        <div className="veterinary-lab-form-actions">

          <button
            type="button"
            className="veterinary-lab-button veterinary-lab-button--secondary"
            onClick={onCancel}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="veterinary-lab-button"
          >
            Guardar paciente
          </button>

        </div>

      </form>

    </main>
  );
}