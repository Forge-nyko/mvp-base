import React, {useCallback, useEffect, useRef, useState} from "react";
import TallerHomeView from "../features/taller/TallerHomeView";
import {BUSINESS_PERMISSIONS, hasBusinessPermission} from "../domain/rbac.mjs";
import {listarVehiculos} from "../services/vehicleService";
import {getWorkOrderErrorMessage, listarOrdenesTrabajo} from "../services/workOrderService";
import {listarPlazasTaller} from "../services/workshopPlazaService";

// Panel de inicio del Taller (SPEC 037, entrega B). Solo lee OT, vehículos y Plazas que ya existen, con los servicios
// de siempre (sin Function nueva). Las tres consultas traen todo el historial del negocio (los servicios no aceptan
// límite) y las "últimas OT" se recortan aquí; con muchas OT conviene paginar en una entrega futura.
// Permisos: sin taller.create no hay accesos de creación; sin taller.manage no hay bloque de Plazas ni se consultan.
export default function TallerHomePage({businessId, role}) {
  const canCreate = hasBusinessPermission(role, BUSINESS_PERMISSIONS.TALLER_CREATE);
  const canManage = hasBusinessPermission(role, BUSINESS_PERMISSIONS.TALLER_MANAGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Un número de carga descarta la respuesta tardía de un negocio anterior o de un reintento superado.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    if (!businessId) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError("");
    try {
      const [orders, vehicles, plazas] = await Promise.all([
        listarOrdenesTrabajo(businessId),
        listarVehiculos(businessId),
        canManage ? listarPlazasTaller(businessId) : Promise.resolve([]),
      ]);
      if (seq === loadSeqRef.current) setData({orders, vehicles, plazas});
    } catch (loadError) {
      if (seq === loadSeqRef.current) setError(getWorkOrderErrorMessage(loadError));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [businessId, canManage]);

  useEffect(() => {
    load();
    return () => { loadSeqRef.current += 1; };
  }, [load]);

  return <TallerHomeView canCreate={canCreate} canManage={canManage} data={data} error={error} loading={loading} onRetry={() => load()} />;
}
