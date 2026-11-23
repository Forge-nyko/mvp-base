import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Activity, PawPrint, Plus, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import ModuleHeader from "../../components/ui/ModuleHeader";
import "./veterinary-lists.css";

import {
  subscribeToInventory,
} from "../../services/inventoryService";

import {
  subscribeToVeterinaryAppointments,
  subscribeToVeterinaryAttentions,
  subscribeToVeterinaryPatients,
} from "./data/veterinaryDataService";

import {
  getVeterinaryPharmacyProducts,
  getVeterinaryServicesFromInventory,
} from "./domain/inventoryPharmacyIntegrationModel.mjs";


function VeterinaryManager({
  businessId,
}) {
  const navigate = useNavigate();
  const [
    inventoryItems,
    setInventoryItems,
  ] = useState([]);

  const [
    loadingInventory,
    setLoadingInventory,
  ] = useState(true);

  const [
    inventoryError,
    setInventoryError,
  ] = useState("");


  const [
    patients,
    setPatients,
  ] = useState([]);

  const [
    appointments,
    setAppointments,
  ] = useState([]);

  const [
    attentions,
    setAttentions,
  ] = useState([]);

  const [
    loadingVeterinaryData,
    setLoadingVeterinaryData,
  ] = useState(true);

  const [
    veterinaryDataError,
    setVeterinaryDataError,
  ] = useState("");


  useEffect(() => {
    if (!businessId) {
      setInventoryItems([]);
      setLoadingInventory(false);
      setInventoryError("");

      return undefined;
    }

    setLoadingInventory(true);
    setInventoryError("");

    return subscribeToInventory(
      businessId,

      (items) => {
        setInventoryItems(items);
        setLoadingInventory(false);
        setInventoryError("");
      },

      (error) => {
        console.error(
          "Error al cargar inventario para Clínica Veterinaria:",
          error?.code,
          error?.message
        );

        setInventoryItems([]);
        setLoadingInventory(false);
        setInventoryError(
          "No se pudo cargar el inventario del negocio."
        );
      }
    );
  }, [businessId]);


  useEffect(() => {
    if (!businessId) {
      setPatients([]);
      setAppointments([]);
      setAttentions([]);
      setLoadingVeterinaryData(false);
      setVeterinaryDataError("");

      return undefined;
    }

    setPatients([]);
    setAppointments([]);
    setAttentions([]);
    setLoadingVeterinaryData(true);
    setVeterinaryDataError("");

    const pending =
      new Set([
        "patients",
        "appointments",
        "attentions",
      ]);

    const markLoaded = (key) => {
      pending.delete(key);

      if (pending.size === 0) {
        setLoadingVeterinaryData(false);
      }
    };

    const handleError = (
      label,
      error
    ) => {
      console.error(
        `Error al cargar ${label} de Clínica Veterinaria:`,
        error?.code,
        error?.message
      );

      const errorCode =
        String(error?.code || "");

      if (
        errorCode.includes(
          "permission-denied"
        )
      ) {
        setVeterinaryDataError(
          "No tienes permisos para acceder a los datos clínicos de este negocio."
        );
      } else {
        setVeterinaryDataError(
          "No se pudieron cargar los datos clínicos. Revisa tu conexión e inténtalo nuevamente."
        );
      }

      setLoadingVeterinaryData(false);
    };

    const unsubscribePatients =
      subscribeToVeterinaryPatients(
        businessId,

        (items) => {
          setPatients(items);
          markLoaded("patients");
        },

        (error) => {
          handleError(
            "pacientes",
            error
          );
        }
      );

    const unsubscribeAppointments =
      subscribeToVeterinaryAppointments(
        businessId,

        (items) => {
          setAppointments(items);
          markLoaded("appointments");
        },

        (error) => {
          handleError(
            "citas",
            error
          );
        }
      );

    const unsubscribeAttentions =
      subscribeToVeterinaryAttentions(
        businessId,

        (items) => {
          setAttentions(items);
          markLoaded("attentions");
        },

        (error) => {
          handleError(
            "atenciones",
            error
          );
        }
      );

    return () => {
      unsubscribePatients();
      unsubscribeAppointments();
      unsubscribeAttentions();
    };
  }, [businessId]);


  const veterinaryServices =
    useMemo(
      () =>
        getVeterinaryServicesFromInventory(
          inventoryItems
        ),
      [inventoryItems]
    );


  const pharmacyProducts =
    useMemo(
      () =>
        getVeterinaryPharmacyProducts(
          inventoryItems
        ),
      [inventoryItems]
    );


  if (!businessId) {
    return (
      <section className="erp-page">
        <div
          className="erp-empty-state"
          role="alert"
        >
          Selecciona un negocio activo para utilizar
          Clínica Veterinaria.
        </div>
      </section>
    );
  }


  return (
    <section className="erp-page">
      <ModuleHeader
        className="veterinary-module-header"
        icon={Activity}
        title="Resumen clínico"
        description="Consulta los pacientes, las citas y las atenciones de tu clínica."
        actions={
          <>
            <Button type="button" icon={PawPrint} onClick={() => navigate("/clinica-veterinaria/pacientes")}>Ver pacientes</Button>
            <Button type="button" icon={CalendarDays} variant="secondary" onClick={() => navigate("/clinica-veterinaria/agenda")}>Ver agenda</Button>
          </>
        }
      />


      {loadingVeterinaryData || loadingInventory ? (
        <LoadingState variant="section" label="Cargando Clínica Veterinaria..." />
      ) : (
        <>
          {veterinaryDataError ? (
            <div className="erp-empty-state" role="alert">
              {veterinaryDataError}
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              action={{ label: "Registrar paciente", icon: Plus, onClick: () => navigate("/clinica-veterinaria/pacientes/nuevo") }}
              description="Registra al primer paciente de la clínica para comenzar su atención."
              icon={PawPrint}
              title="Aún no hay pacientes"
            />
          ) : (
            <VeterinaryCounts label="Actividad clínica" counts={[
              ["Pacientes", patients.length],
              ["Citas", appointments.length],
              ["Atenciones", attentions.length],
            ]} />
          )}

          {inventoryError ? (
            <div className="erp-empty-state" role="alert">
              {inventoryError}
            </div>
          ) : (
            <section className="erp-panel">
              <h2 className="erp-panel-title">Servicios y farmacia</h2>
              <VeterinaryCounts label="Disponibilidad en el inventario" counts={[
                ["Servicios disponibles", veterinaryServices.length],
                ["Productos de farmacia", pharmacyProducts.length],
              ]} />
            </section>
          )}
        </>
      )}
    </section>
  );
}

function VeterinaryCounts({ label, counts }) {
  return (
    <div className="erp-metric-grid" role="group" aria-label={label}>
      {counts.map(([name, value]) => (
        <div className="erp-metric-card" key={name}>
          <span className="erp-metric-card__label">{name}</span>
          <strong className="erp-metric-card__value">{value}</strong>
        </div>
      ))}
    </div>
  );
}

export default VeterinaryManager;
