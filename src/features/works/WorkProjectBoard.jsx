import React, {useState} from "react";
import {ExternalLink, Plus, RefreshCw, Trash2} from "lucide-react";
import AppIcon from "../../components/ui/AppIcon";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import ResponsiveDialog from "../../components/ui/ResponsiveDialog";
import StatusBadge from "../../components/ui/StatusBadge";
import {WORK_COST_SCOPE_ORPHAN, filterWorkCostsByTaskScope, getTaskProgress, getVisibleWorkTasks, getWorkCostSummary, getWorkHistoricalPersonIdentity, getWorkMemberIdentity, getWorkStatusLabel, getWorkTaskProgress} from "../../domain/workModel.mjs";
import {formatDate, formatMoney} from "../../utils/formatters.js";
import useBusinessFormat from "../../hooks/useBusinessFormat";
import WorkTaskBoard from "./WorkTaskBoard.jsx";

// Vista Tablero de /trabajos (SPEC 028 etapa B): se elige UN proyecto y se ven
// solo sus tareas como tarjetas por estado, con subtareas y avance. Desde la
// tarjeta se crean subtareas, se asigna responsable, se documenta, se cambia de
// estado y se abren los costos de esa tarea (gastos, HH y materiales con el
// `tareaId` ya asociado). Dos tarjetas más reciben los costos sin tarea:
// "General" y "Sin tarea asignada".
//
// Presentacional: no importa servicios ni Firebase. Recibe el proyecto, su
// ficha ya cargada y `actions`, un conjunto de callbacks que la página resuelve
// con las mismas Functions y los mismos requestId de siempre (cada una
// devuelve una promesa con true si la acción se aplicó). `renderCosts(scope)`
// devuelve las secciones de costos acotadas a una tarea.

const GENERAL_SCOPE = "";

function projectOptionLabel(work) {
  const closed = ["completado", "cancelado"].includes(work.estado) ? ` (${getWorkStatusLabel(work.estado)})` : "";
  return `${work.numero} · ${work.titulo}${closed}`;
}

function LoadFailure({message, onRetry}) {
  return (
    <div className="works-message works-message--error works-load-error" role="alert">
      <span>{message}</span>
      <Button type="button" variant="secondary" icon={RefreshCw} onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

// Contenido propio de cada tarjeta de tarea, debajo de lo que ya muestra
// WorkTaskBoard (responsable, avance de subtareas, costo, estado).
function TaskCardExtras({actions, canManage, canOperate, members, onOpenCosts, processing, task, terminal}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskTitles, setSubtaskTitles] = useState({});
  const [documentation, setDocumentation] = useState("");
  const progress = getTaskProgress(task);
  const operable = canOperate(task);
  const busy = Boolean(processing);

  const addSubtask = (event) => {
    event.preventDefault();
    const titulo = subtaskTitle.trim();
    if (!titulo) return;
    actions.addSubtask(task, titulo).then((success) => { if (success) setSubtaskTitle(""); });
  };
  const renameSubtask = (subtask) => {
    const titulo = String(subtaskTitles[subtask.id] ?? subtask.titulo).trim();
    if (!titulo || titulo === subtask.titulo) return;
    actions.renameSubtask(task, subtask, titulo).then((success) => { if (success) setSubtaskTitles((current) => ({...current, [subtask.id]: titulo})); });
  };
  const addDocumentation = (event) => {
    event.preventDefault();
    const texto = documentation.trim();
    if (!texto) return;
    actions.addDocumentation(task, texto).then((success) => { if (success) setDocumentation(""); });
  };

  return (
    <div className="works-project-board__extras">
      {task.descripcion && <p className="works-project-board__description">{task.descripcion}</p>}
      {canManage && !terminal && (
        <label className="works-project-board__assign">
          <span className="sr-only">Responsable de {task.titulo}</span>
          <select className="erp-control" disabled={busy} value={task.responsableUid} onChange={(event) => actions.assignTask(task, event.target.value)}>
            <option value="">Sin responsable</option>
            {members.map((member) => <option key={member.uid} value={member.uid}>{getWorkMemberIdentity(member)}</option>)}
          </select>
        </label>
      )}
      {progress.total > 0 && <progress className="works-task-progress" max="100" value={progress.percent} aria-label={`Avance de ${task.titulo}`} />}
      {task.subtareas.length > 0 && (
        <div className="works-subtask-list">
          {task.subtareas.map((subtask) => (
            <div key={subtask.id} className={subtask.completada ? "is-complete" : ""}>
              <input type="checkbox" aria-label={`Completar ${subtask.titulo}`} checked={subtask.completada} disabled={terminal || !operable || busy} onChange={() => actions.toggleSubtask(task, subtask)} />
              <input className="erp-control" maxLength="240" aria-label={`Subtarea: ${subtask.titulo}`} disabled={terminal || !canManage || subtask.completada} value={subtaskTitles[subtask.id] ?? subtask.titulo} onChange={(event) => setSubtaskTitles((current) => ({...current, [subtask.id]: event.target.value}))} />
              <div>
                {canManage && !terminal && !subtask.completada && (
                  <>
                    <Button type="button" variant="secondary" disabled={busy || (subtaskTitles[subtask.id] ?? subtask.titulo).trim() === subtask.titulo} onClick={() => renameSubtask(subtask)}>Guardar</Button>
                    <button type="button" aria-label={`Eliminar ${subtask.titulo}`} disabled={busy} onClick={() => actions.removeSubtask(task, subtask)}><AppIcon icon={Trash2} size={15} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {operable && !terminal && !task.completada && (
        <form className="works-subtask-create" onSubmit={addSubtask}>
          <input className="erp-control" maxLength="240" required aria-label={`Nueva subtarea de ${task.titulo}`} value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Nueva subtarea" />
          <Button type="submit" variant="secondary" disabled={busy}>Agregar</Button>
        </form>
      )}
      <details className="works-task-documentation">
        <summary>Documentación ({task.documentacion.length})</summary>
        {task.documentacion.map((entry) => (
          <div key={entry.id}>
            <p>{entry.texto}</p>
            <small>{getWorkHistoricalPersonIdentity(entry.autorSnapshot, entry.autorUid, members, "Persona del equipo")} · {formatDate(entry.creadoEn)}{entry.tipo === "cierre" ? " · Cierre" : ""}</small>
          </div>
        ))}
        {!terminal && operable && (
          <form className="works-task-document-form" onSubmit={addDocumentation}>
            <textarea className="erp-control" maxLength="8000" rows="2" aria-label={`Documentación de ${task.titulo}`} value={documentation} onChange={(event) => setDocumentation(event.target.value)} placeholder="Comentario o evidencia" />
            <Button type="submit" variant="secondary" disabled={busy}>Agregar</Button>
          </form>
        )}
      </details>
      <Button type="button" variant="secondary" onClick={() => onOpenCosts({scope: task.id, title: task.titulo})}>Gastos, HH y materiales</Button>
    </div>
  );
}

function CostCard({amount, currency, description, label, onOpen, openLabel}) {
  const {locale: businessLocale} = useBusinessFormat();
  return (
    <article className="works-task-board__card works-project-board__cost-card">
      <strong>{label}</strong>
      <p className="works-project-board__description">{description}</p>
      <dl><div><dt>Costo asignado</dt><dd>{formatMoney(amount, currency, businessLocale)}</dd></div></dl>
      <Button type="button" variant="secondary" onClick={onOpen}>{openLabel}</Button>
    </article>
  );
}

export default function WorkProjectBoard({
  actions, canManage, canOperate, costs, currency, currentUserUid, detail, error, loading, members, onOpenFicha, onRetry, onSelectWork,
  processing, projectCost, renderCosts, terminal, work, workId, works,
}) {
  const {locale: businessLocale} = useBusinessFormat();
  const [draft, setDraft] = useState({titulo: "", descripcion: "", responsableUid: ""});
  const [waitingTask, setWaitingTask] = useState(null);
  const [waitReason, setWaitReason] = useState("");
  const [costTarget, setCostTarget] = useState(null);
  const tasks = Array.isArray(detail?.tareas) ? detail.tareas : [];
  const visibleTasks = getVisibleWorkTasks(tasks, {canManage, currentUserUid});
  const emptyTasksCopy = canManage ? "Aún no hay tareas." : "No tienes tareas asignadas.";
  const progress = work ? getWorkTaskProgress(work) : null;

  const createTask = (event) => {
    event.preventDefault();
    if (!draft.titulo.trim()) return;
    actions.createTask(draft).then((success) => { if (success) setDraft({titulo: "", descripcion: "", responsableUid: ""}); });
  };
  const requestTaskState = (task, estado) => {
    if (estado === "en_espera") { setWaitingTask(task); setWaitReason(""); return; }
    actions.changeTaskState(task, estado);
  };

  const orphanRecords = [
    ...filterWorkCostsByTaskScope(costs.expenses, WORK_COST_SCOPE_ORPHAN, tasks),
    ...filterWorkCostsByTaskScope(costs.labor, WORK_COST_SCOPE_ORPHAN, tasks),
    ...filterWorkCostsByTaskScope(costs.materials, WORK_COST_SCOPE_ORPHAN, tasks),
  ];
  const generalCost = getWorkCostSummary({...costs, taskId: GENERAL_SCOPE});
  const orphanCost = getWorkCostSummary({
    expenses: filterWorkCostsByTaskScope(costs.expenses, WORK_COST_SCOPE_ORPHAN, tasks),
    labor: filterWorkCostsByTaskScope(costs.labor, WORK_COST_SCOPE_ORPHAN, tasks),
    materials: filterWorkCostsByTaskScope(costs.materials, WORK_COST_SCOPE_ORPHAN, tasks),
  });
  const costTitle = costTarget?.scope === GENERAL_SCOPE ? "General" : costTarget?.scope === WORK_COST_SCOPE_ORPHAN ? "Sin tarea asignada" : costTarget?.title;

  return (
    <section className="works-project-board" aria-label="Tablero del proyecto">
      <div className="works-project-board__header">
        <label className="erp-field works-project-board__picker">
          <span className="erp-field__label">Proyecto</span>
          <select className="erp-control" value={workId} onChange={(event) => onSelectWork(event.target.value)}>
            {works.map((entry) => <option key={entry.id} value={entry.id}>{projectOptionLabel(entry)}</option>)}
          </select>
        </label>
        {work && (
          <div className="works-project-board__summary">
            <StatusBadge variant={work.estado === "completado" ? "success" : ["cancelado", "en_espera"].includes(work.estado) ? "warning" : "neutral"}>{getWorkStatusLabel(work.estado)}</StatusBadge>
            <span>{work.clienteSnapshot?.nombreRazonSocial || "Sin cliente"}</span>
            <span>Avance {progress.percent}% · {progress.completed}/{progress.total} tareas</span>
            <span>Costo acumulado {formatMoney(projectCost, currency, businessLocale)}</span>
            <Button type="button" variant="secondary" icon={ExternalLink} onClick={onOpenFicha}>Ver ficha</Button>
          </div>
        )}
      </div>

      {terminal && work && <p className="works-message works-message--warning">Este proyecto está {getWorkStatusLabel(work.estado).toLowerCase()}: el tablero es de solo lectura. Reábrelo desde la ficha para operar.</p>}

      {loading ? <LoadingState variant="section" label="Cargando tablero..." /> : error ? <LoadFailure message={error} onRetry={onRetry} /> : (
        <>
          {canManage && !terminal && (
            <form className="works-task-create" onSubmit={createTask}>
              <input className="erp-control" maxLength="240" aria-label="Título de la tarea" value={draft.titulo} onChange={(event) => setDraft((current) => ({...current, titulo: event.target.value}))} placeholder="Título de la tarea" required />
              <select className="erp-control" aria-label="Responsable de la tarea nueva" value={draft.responsableUid} onChange={(event) => setDraft((current) => ({...current, responsableUid: event.target.value}))}>
                <option value="">Sin responsable</option>
                {members.map((member) => <option key={member.uid} value={member.uid}>{getWorkMemberIdentity(member)}</option>)}
              </select>
              <Button type="submit" icon={Plus} disabled={Boolean(processing)}>Crear tarea</Button>
              <textarea className="erp-control" maxLength="4000" rows="2" aria-label="Descripción de la tarea" value={draft.descripcion} onChange={(event) => setDraft((current) => ({...current, descripcion: event.target.value}))} placeholder="Descripción operativa" />
            </form>
          )}

          <WorkTaskBoard
            canManage={canManage}
            canOperate={canOperate}
            costs={costs}
            currency={currency}
            emptyCopy={emptyTasksCopy}
            onRemoveLegacy={actions.removeLegacy}
            onRequestTaskState={requestTaskState}
            processing={processing}
            renderCardExtras={(task) => (
              <TaskCardExtras
                actions={actions}
                canManage={canManage}
                canOperate={canOperate}
                members={members}
                onOpenCosts={setCostTarget}
                processing={processing}
                task={task}
                terminal={terminal}
              />
            )}
            tasks={visibleTasks}
            terminal={terminal}
          />

          <div className="works-project-board__costs" role="group" aria-label="Costos sin tarea">
            <CostCard
              amount={generalCost.total}
              currency={currency}
              description="Costos del proyecto que no pertenecen a una tarea."
              label="General"
              onOpen={() => setCostTarget({scope: GENERAL_SCOPE, title: "General"})}
              openLabel="Gastos, HH y materiales"
            />
            {orphanRecords.length > 0 && (
              <CostCard
                amount={orphanCost.total}
                currency={currency}
                description="Costos de tareas que ya no existen. Solo lectura."
                label="Sin tarea asignada"
                onOpen={() => setCostTarget({scope: WORK_COST_SCOPE_ORPHAN, title: "Sin tarea asignada"})}
                openLabel="Ver costos"
              />
            )}
          </div>
        </>
      )}

      <ResponsiveDialog
        open={Boolean(waitingTask)}
        onClose={() => !processing && setWaitingTask(null)}
        size="small"
        eyebrow="Tarea"
        title="Poner tarea en espera"
        description="El motivo quedará en el historial."
        footer={<><Button type="button" variant="secondary" onClick={() => setWaitingTask(null)}>Volver</Button><Button type="button" disabled={Boolean(processing) || !waitReason.trim()} onClick={() => actions.changeTaskState(waitingTask, "en_espera", waitReason.trim()).then((success) => { if (success) { setWaitingTask(null); setWaitReason(""); } })}>Confirmar espera</Button></>}
      >
        <label className="erp-field">
          <span className="erp-field__label">Motivo *</span>
          <textarea className="erp-control" rows="3" maxLength="1000" value={waitReason} onChange={(event) => setWaitReason(event.target.value)} />
        </label>
      </ResponsiveDialog>

      <ResponsiveDialog
        className="works-cost-dialog"
        open={Boolean(costTarget)}
        onClose={() => setCostTarget(null)}
        size="large"
        eyebrow={work?.numero}
        title={`Costos · ${costTitle || ""}`}
        description={costTarget?.scope === WORK_COST_SCOPE_ORPHAN ? "Registros de tareas que ya no existen. Puedes consultarlos y anularlos." : costTarget?.scope === GENERAL_SCOPE ? "Costos generales del proyecto: no pertenecen a ninguna tarea." : "Los registros quedan asociados a esta tarea."}
      >
        {costTarget && renderCosts(costTarget.scope)}
      </ResponsiveDialog>
    </section>
  );
}
