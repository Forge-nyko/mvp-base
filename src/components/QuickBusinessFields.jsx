import React from "react";
import {
  NEW_BUSINESS_COUNTRIES,
  getRegionLabel,
  getRegionsForCountry,
  hasRegionCatalog,
} from "../domain/businessCatalog";
import { getCountryFiscalNote } from "../domain/countryFiscalNote.mjs";
import { resolveFormCountryCode } from "../domain/businessForm";
import BusinessCategoryPicker from "./BusinessCategoryPicker";
import Notice from "./ui/Notice";

function FieldMessage({ error, help = null, id }) {
  return (
    <div className="quick-business-field__message">
      {error ? (
        <p id={id} className="quick-business-field__error" role="alert">
          {error}
        </p>
      ) : help ? <p id={id} className="quick-business-field__hint">{help}</p> : null}
    </div>
  );
}

function QuickBusinessFields({
  countryHint = "",
  disabled = false,
  errors,
  idPrefix,
  onBlur,
  onChange,
  setFieldRef,
  showCountry = false,
  showRegion = true,
  values,
}) {
  // La región depende del país (se limpia al cambiarlo). Sin país en los valores
  // (negocio adicional) es Chile. Un país sin catálogo no pide región de lista.
  const regionCountryCode = resolveFormCountryCode(values);
  const regionLabel = getRegionLabel(regionCountryCode);
  const showRegionField = showRegion && hasRegionCatalog(regionCountryCode);

  // Bajo el país queda solo la línea corta ("Bolivia · BOB"). La nota fiscal va en un aviso a
  // todo el ancho debajo de la grilla.
  const fiscalNote = getCountryFiscalNote(values.paisCodigo);
  const hasCountryNotes = Boolean(fiscalNote);
  const countryNotesId = `${idPrefix}-country-notes`;
  const getCountryHelp = () => (countryHint ? <span>{countryHint}</span> : "");

  return (
    <>
    <div className="quick-business-fields">
      {[
        {
          field: "nombreComercial",
          label: "Nombre del negocio",
          control: (
            <input
              type="text"
              autoComplete="organization"
              maxLength="120"
              placeholder="Escribe el nombre de tu negocio"
            />
          ),
        },
        {
          field: "rubroCodigo",
          label: "Rubro principal",
          category: true,
        },
        {
          field: "paisCodigo",
          label: "País",
          control: (
            <select>
              <option value="">Selecciona el país de tu negocio</option>
              {NEW_BUSINESS_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
            </select>
          ),
        },
        {
          field: "regionCodigo",
          label: regionLabel,
          control: (
            <select>
              <option value="">
                {regionCountryCode === "CL" ? "Selecciona una región" : `Selecciona un ${regionLabel.toLowerCase()}`}
              </option>
              {getRegionsForCountry(regionCountryCode).map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
          ),
        },
      ]
        .filter(({ field }) => showCountry || field !== "paisCodigo")
        .filter(({ field }) => showRegionField || field !== "regionCodigo")
        .map(({ category, field, label, control }) => {
          const controlId = `${idPrefix}-${field}`;
          const messageId = `${controlId}-message`;
          if (category) {
            return (
            <div className="quick-business-field" key={field}>
              <label htmlFor={controlId}>
                {label}<span aria-hidden="true"> *</span>
              </label>
              <BusinessCategoryPicker
                ref={(node) => setFieldRef?.(field, node)}
                id={controlId}
                value={values.rubroCodigo}
                customValue={values.rubroOtro}
                placeholder="Selecciona un rubro"
                disabled={disabled}
                error={errors.rubroCodigo}
                errorId={messageId}
                onChange={({ code, customName }) =>
                  onChange({ rubroCodigo: code, rubroOtro: customName })
                }
                onTouched={(patch) => onBlur(field, patch)}
              />
              <FieldMessage
                id={messageId}
                error={errors.rubroCodigo}
                help="Elige la actividad que mejor representa tu servicio principal."
              />
            </div>
            );
          }
          return (
          <div className="quick-business-field" key={field}>
            <label htmlFor={controlId}>
              {label}<span aria-hidden="true"> *</span>
            </label>
            {React.cloneElement(control, {
              ref: (node) => setFieldRef?.(field, node),
              id: controlId,
              name: field,
              value: values[field],
              onChange: (event) => onChange(field, event.target.value),
              onBlur: () => onBlur(field),
              disabled,
              required: true,
              "aria-invalid": Boolean(errors[field]),
              "aria-describedby":
                field === "paisCodigo" && hasCountryNotes
                  ? `${messageId} ${countryNotesId}`
                  : messageId,
            })}
            <FieldMessage
              id={messageId}
              error={errors[field]}
              help={field === "paisCodigo" ? getCountryHelp() : ""}
            />
          </div>
          );
        })}
    </div>
    {hasCountryNotes && (
      <Notice variant="info" id={countryNotesId} className="quick-business-notes">
        {fiscalNote && <p>{fiscalNote}</p>}
      </Notice>
    )}
    </>
  );
}

export default QuickBusinessFields;
