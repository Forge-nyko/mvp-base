import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  subscribeToInventory,
} from "../../services/inventoryService";

import {
  getVeterinaryPharmacyProducts,
  getVeterinaryServicesFromInventory,
} from "./domain/inventoryPharmacyIntegrationModel.mjs";


function VeterinaryManager({
  businessId,
}) {
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
          error
        );

        setInventoryItems([]);
        setLoadingInventory(false);
        setInventoryError(
          "No se pudo cargar el inventario del negocio."
        );
      }
    );
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
      <div className="erp-module-intro">
        <div className="erp-page-intro">
          <h1>
            Clínica Veterinaria
          </h1>

          <p>
            Gestión clínica de pacientes, agenda,
            atenciones y farmacia veterinaria.
          </p>
        </div>
      </div>


      {loadingInventory && (
        <div className="erp-empty-state">
          Cargando inventario...
        </div>
      )}


      {inventoryError && (
        <div
          className="erp-empty-state"
          role="alert"
        >
          {inventoryError}
        </div>
      )}


      {!loadingInventory &&
        !inventoryError && (
          <div className="erp-panel">
            <h2>
              Integración con Inventario
            </h2>

            <p>
              Servicios disponibles:{" "}
              <strong>
                {veterinaryServices.length}
              </strong>
            </p>

            <p>
              Productos de farmacia:{" "}
              <strong>
                {pharmacyProducts.length}
              </strong>
            </p>
          </div>
        )}
    </section>
  );
}


export default VeterinaryManager;