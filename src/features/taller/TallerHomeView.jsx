import React, {useMemo} from "react";
import {Car, FilePlus2, RefreshCw, Warehouse, Wrench} from "lucide-react";
import {Link, useNavigate} from "react-router-dom";
import AppIcon from "../../components/ui/AppIcon";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import Notice from "../../components/ui/Notice";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  getWorkOrderStatusLabel,
  getWorkOrderStatusVariant,
} from "../../domain/workOrderModel.mjs";
import {summarizeWorkOrders, summarizeWorkshopPlazas} from "../../domain/workOrderSummary.mjs";
import {formatDate} from "../../utils/formatters";

const RECENT_LIMIT = 5;
const ALERT_LINKS_LIMIT = 5;

function vehicleLabel(vehicle) {
  return vehicle ? `${vehicle.patente} · ${vehicle.marca} ${vehicle.modelo}` : "Vehículo no disponible";
}

function OrderLinks({orders}) {
  const shown = orders.slice(0, ALERT_LINKS_LIMIT);
  const hidden = orders.length - shown.length;
  return <span className="taller-home__alert-links">
    {shown.map((order) => <Link key={order.otId} className="vehicle-link" to={`/taller/ordenes/${order.otId}`}>{order.numeroOT}</Link>)}
    {hidden > 0 && <span className="erp-secondary-text">y {hidden} más</span>}
  </span>;
}

// Vista del panel de inicio del Taller (SPEC 037, entrega B), sin acceso a datos: recibe lo ya cargado.
// Orden de los estados de datos: cargando, error, vacío, datos. Un solo role="status" (el de LoadingState).
// Permisos: sin `canCreate` no hay accesos de creación; el bloque de Plazas solo se dibuja con `canManage`.
export default function TallerHomeView({canCreate = false, canManage = false, data = null, error = "", loading = false, onRetry}) {
  const navigate = useNavigate();
  const orderSummary = useMemo(() => summarizeWorkOrders(data?.orders, {recentLimit: RECENT_LIMIT}), [data]);
  const plazaSummary = useMemo(() => summarizeWorkshopPlazas(data?.plazas, data?.orders), [data]);
  const vehiclesById = useMemo(() => new Map((data?.vehicles || []).map((vehicle) => [vehicle.vehiculoId, vehicle])), [data]);

  const quickActions = canCreate && <div className="taller-home__actions">
    <Button type="button" icon={FilePlus2} onClick={() => navigate("/taller/ordenes/nueva")}>Nueva OT</Button>
    <Button type="button" variant="secondary" icon={Car} onClick={() => navigate("/taller/vehiculos/nuevo")}>Nuevo vehículo</Button>
  </div>;

  const isEmpty = Boolean(data) && orderSummary.total === 0 && data.vehicles.length === 0;

  return <main className="erp-page taller-home">
    <div className="erp-module-intro">
      <div className="erp-page-intro"><p>Un vistazo al taller: órdenes de trabajo por estado, alertas y últimas órdenes.</p></div>
    </div>
    {/* Orden de los estados de datos: cargando, error, vacío, datos. */}
    {loading ? <LoadingState variant="section" label="Cargando el panel del taller..." />
      : error ? <div className="vehicle-message vehicle-message--error" role="alert"><span>{error}</span><Button type="button" variant="secondary" icon={RefreshCw} onClick={onRetry}>Reintentar</Button></div>
      : isEmpty ? <div className="erp-empty-state"><AppIcon icon={Wrench} size={28} /><h3>Aún no hay actividad en el taller</h3><p>{canCreate ? "Registra un vehículo y crea la primera orden de trabajo para ver aquí el estado del taller." : "Todavía no hay vehículos ni órdenes de trabajo para consultar."}</p>{quickActions}</div>
      : data && <>
        {quickActions}
        {(orderSummary.awaitingApproval.length > 0 || orderSummary.pendingDelivery.length > 0) && <section className="taller-home__alerts" aria-label="Alertas del taller">
          {orderSummary.awaitingApproval.length > 0 && <Notice variant="warning" role={null} title={`${orderSummary.awaitingApproval.length} ${orderSummary.awaitingApproval.length === 1 ? "OT espera" : "OT esperan"} la aprobación del cliente`}><OrderLinks orders={orderSummary.awaitingApproval} /></Notice>}
          {orderSummary.pendingDelivery.length > 0 && <Notice variant="info" role={null} title={`${orderSummary.pendingDelivery.length} ${orderSummary.pendingDelivery.length === 1 ? "OT pendiente" : "OT pendientes"} de entrega`}><OrderLinks orders={orderSummary.pendingDelivery} /></Notice>}
        </section>}

        <section className="erp-panel" aria-labelledby="taller-home-status-title">
          <div className="erp-panel-header"><div><h2 id="taller-home-status-title" className="erp-panel-title">Órdenes por estado</h2><p className="erp-secondary-text">{orderSummary.total} {orderSummary.total === 1 ? "orden" : "órdenes"} en total · {orderSummary.active} {orderSummary.active === 1 ? "abierta" : "abiertas"}</p></div><Link className="vehicle-link" to="/taller/ordenes">Ver todas las órdenes</Link></div>
          <dl className="taller-home__stats">
            {orderSummary.byStatus.map((status) => <div className="taller-home__stat" key={status.value}><dt>{status.label}</dt><dd>{status.count}</dd></div>)}
            {orderSummary.unknown > 0 && <div className="taller-home__stat" key="sin-estado"><dt>Sin estado</dt><dd>{orderSummary.unknown}</dd></div>}
          </dl>
        </section>

        {canManage && <section className="erp-panel" aria-labelledby="taller-home-plazas-title">
          <div className="erp-panel-header"><div><h2 id="taller-home-plazas-title" className="erp-panel-title">Plazas</h2><p className="erp-secondary-text">{plazaSummary.total === 0 ? "Aún no hay Plazas registradas." : `${plazaSummary.occupied} en uso · ${plazaSummary.free} ${plazaSummary.free === 1 ? "libre" : "libres"}${plazaSummary.inactive ? ` · ${plazaSummary.inactive} ${plazaSummary.inactive === 1 ? "inactiva" : "inactivas"}` : ""}`}</p></div><Link className="vehicle-link" to="/taller/plazas">Administrar Plazas</Link></div>
          {plazaSummary.total > 0 && <ul className="taller-home__plazas">
            {plazaSummary.items.map(({plaza, active, order}) => <li className="taller-home__plaza" key={plaza.plazaId}>
              <span className="taller-home__plaza-name"><AppIcon icon={Warehouse} size={16} />{plaza.nombre}</span>
              {order ? <><StatusBadge variant="warning">En uso</StatusBadge><Link className="vehicle-link" to={`/taller/ordenes/${order.otId}`}>{order.numeroOT}</Link></>
                : active ? <StatusBadge variant="success">Disponible</StatusBadge> : <StatusBadge variant="neutral">Inactiva</StatusBadge>}
            </li>)}
          </ul>}
        </section>}

        <section className="erp-panel" aria-labelledby="taller-home-recent-title">
          <div className="erp-panel-header"><div><h2 id="taller-home-recent-title" className="erp-panel-title">Últimas órdenes</h2></div></div>
          {orderSummary.recent.length === 0 ? <p className="erp-secondary-text">Todavía no hay órdenes de trabajo.</p> : <ul className="taller-home__recent">
            {orderSummary.recent.map((order) => <li className="taller-home__recent-item" key={order.otId}>
              <div className="taller-home__recent-main"><Link className="vehicle-link" to={`/taller/ordenes/${order.otId}`}>{order.numeroOT}</Link><span className="erp-secondary-text">{vehicleLabel(vehiclesById.get(order.vehiculoId))}</span></div>
              <StatusBadge variant={getWorkOrderStatusVariant(order.estado)}>{getWorkOrderStatusLabel(order.estado)}</StatusBadge>
              <span className="erp-secondary-text">{formatDate(order.actualizadoEn)}</span>
            </li>)}
          </ul>}
        </section>
      </>}
  </main>;
}
