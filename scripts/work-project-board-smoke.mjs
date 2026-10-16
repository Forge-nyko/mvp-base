import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";
import {WORK_COST_SCOPE_ORPHAN, filterWorkCostsByTaskScope, getDefaultBoardWorkId} from "../src/domain/workModel.mjs";

// SPEC 028 etapa B: tablero por proyecto. WorkProjectBoard no importa servicios
// ni Firebase, así que se renderiza aquí en el servidor de Vite. La página
// (WorksPage.jsx) no se puede cargar por este camino; sus conexiones se
// comprueban por texto fuente.

// --- Helpers de dominio ---
const tasks = [{id: "t1"}, {id: "t2"}];
const records = [
  {id: "a", tareaId: "t1"},
  {id: "b", tareaId: ""},
  {id: "c"},
  {id: "d", tareaId: "borrada"},
  {id: "e", tareaId: "t2"},
];
assert.deepEqual(filterWorkCostsByTaskScope(records, undefined, tasks).map((entry) => entry.id), ["a", "b", "c", "d", "e"], "sin alcance no se filtra nada");
assert.deepEqual(filterWorkCostsByTaskScope(records, "t1", tasks).map((entry) => entry.id), ["a"]);
assert.deepEqual(filterWorkCostsByTaskScope(records, "", tasks).map((entry) => entry.id), ["b", "c"], "General: costos sin tareaId");
assert.deepEqual(filterWorkCostsByTaskScope(records, WORK_COST_SCOPE_ORPHAN, tasks).map((entry) => entry.id), ["d"], "Sin tarea asignada: tareaId que ya no existe");
assert.deepEqual(filterWorkCostsByTaskScope(null, "t1", tasks), []);
const everyBucket = [...filterWorkCostsByTaskScope(records, "t1", tasks), ...filterWorkCostsByTaskScope(records, "t2", tasks), ...filterWorkCostsByTaskScope(records, "", tasks), ...filterWorkCostsByTaskScope(records, WORK_COST_SCOPE_ORPHAN, tasks)];
assert.equal(everyBucket.length, records.length, "cada costo cae en exactamente una tarjeta");
console.log("OK dominio: cada costo pertenece a una sola tarjeta (tarea, General o Sin tarea asignada)");

assert.equal(getDefaultBoardWorkId([{id: "w1", estado: "completado"}, {id: "w2", estado: "en_progreso"}, {id: "w3", estado: "pendiente"}]), "w2", "el abierto más reciente (la lista llega del más reciente al más antiguo)");
assert.equal(getDefaultBoardWorkId([{id: "w1", estado: "completado"}, {id: "w2", estado: "cancelado"}]), "w1", "si todos están cerrados, el primero");
assert.equal(getDefaultBoardWorkId([]), "");
console.log("OK dominio: proyecto por defecto del tablero");

// --- Render ---
function task(overrides = {}) {
  return {
    id: "t1", titulo: "Tender cableado", descripcion: "", modeloTareaVersion: 2, responsableUid: "", responsableSnapshot: null,
    estado: "pendiente", completada: false, subtareas: [], motivoEspera: "", creadoEn: "2026-08-01T10:00:00.000Z",
    documentacionTotal: 0, documentacion: [], ...overrides,
  };
}

const works = [
  {id: "w1", numero: "TRB-2026-0002", titulo: "Red oficina", estado: "en_progreso", tareasTotal: 2, tareasCompletadas: 1, progresoPct: 50, clienteSnapshot: {nombreRazonSocial: "Cliente SA"}},
  {id: "w0", numero: "TRB-2026-0001", titulo: "Cámaras", estado: "completado", tareasTotal: 1, tareasCompletadas: 1, progresoPct: 100},
];
const baseActions = Object.fromEntries(["createTask", "assignTask", "changeTaskState", "addSubtask", "toggleSubtask", "renameSubtask", "removeSubtask", "addDocumentation", "removeLegacy"].map((name) => [name, async () => true]));

const vite = await createServer({appType: "custom", logLevel: "silent", server: {middlewareMode: true}});
try {
  const {default: WorkProjectBoard} = await vite.ssrLoadModule("/src/features/works/WorkProjectBoard.jsx");
  const render = (props = {}) => renderToStaticMarkup(React.createElement(WorkProjectBoard, {
    actions: baseActions, canManage: true, canOperate: () => true, costs: {expenses: [], labor: [], materials: []}, currency: "CLP",
    currentUserUid: "u1", detail: {tareas: []}, error: "", loading: false, members: [{uid: "u1", nombre: "Nombre no informado", correo: "owner@example.cl"}],
    onOpenFicha: () => {}, onRetry: () => {}, onSelectWork: () => {}, processing: "", projectCost: 0, renderCosts: () => null, terminal: false,
    work: works[0], workId: "w1", works, ...props,
  }));

  // Selector de proyecto con el elegido seleccionado; el cerrado se rotula.
  const picker = render();
  assert.match(picker, /<select[^>]*>[\s\S]*TRB-2026-0002 · Red oficina[\s\S]*TRB-2026-0001 · Cámaras \(Completado\)/);
  assert.match(picker, /<option value="w1" selected="">|<option selected="" value="w1">/);
  assert.match(picker, /Ver ficha/);
  console.log("OK selector de proyecto, estado del elegido y acceso a la ficha");

  // Solo las tareas del proyecto elegido, por estado, con subtareas y avance.
  const withTasks = render({detail: {tareas: [
    task({id: "t1", titulo: "Tender cableado", estado: "en_progreso", subtareas: [{id: "s1", titulo: "Canalizar", completada: true}, {id: "s2", titulo: "Pasar cable", completada: false}]}),
    task({id: "t2", titulo: "Coordinar visita", estado: "pendiente"}),
    task({id: "t3", titulo: "Entrega", estado: "completada", completada: true}),
  ]}});
  assert.equal((withTasks.match(/works-task-board__column"/g) || []).length, 4, "cuatro columnas por estado");
  assert.equal((withTasks.match(/works-task-board__card"/g) || []).length, 3);
  assert.match(withTasks, /Canalizar/); assert.match(withTasks, /Pasar cable/); assert.match(withTasks, /1\/2 · 50%/);
  assert.match(withTasks, /<progress[^>]*value="50"/);
  assert.equal((withTasks.match(/Gastos, HH y materiales/g) || []).length, 4, "un botón de costos por tarea (3) y uno en General");
  assert.doesNotMatch(withTasks, /works-board-card|Cerrar proyecto|Confirmar subtareas pendientes/, "ni tarjetas de proyectos ni funciones de la etapa C");
  console.log("OK tareas por estado con subtareas, avance y costos por tarea");

  // Crear tarea y operar: solo canManage en proyecto abierto.
  assert.match(withTasks, /Crear tarea/); assert.match(withTasks, /Nueva subtarea de Tender cableado/); assert.match(withTasks, /Responsable de Tender cableado/);
  assert.match(withTasks, /owner@example\.cl/, "el responsable usa la identidad (correo) y no 'Nombre no informado'");
  assert.doesNotMatch(withTasks, />Nombre no informado</);
  const nonManager = render({canManage: false, canOperate: (item) => item.id === "t1", detail: {tareas: [task({id: "t1"}), task({id: "t2", titulo: "Ajena"})]}});
  assert.doesNotMatch(nonManager, /Crear tarea/);
  assert.doesNotMatch(nonManager, /Ajena/, "una persona sin permiso de gestión solo ve sus tareas");
  console.log("OK permisos: crear tarea solo para gestión; tareas ajenas ocultas");

  // Tarjetas General y Sin tarea asignada.
  assert.match(withTasks, /works-project-board__cost-card/);
  assert.match(withTasks, /<strong>General<\/strong>/);
  assert.doesNotMatch(withTasks, /Sin tarea asignada/, "sin costos huérfanos no se muestra la tarjeta");
  const orphan = render({detail: {tareas: [task({id: "t1"})]}, costs: {expenses: [{id: "g1", tareaId: "borrada", estado: "vigente", monto: 5000, categoria: "OTRO"}], labor: [], materials: []}});
  assert.match(orphan, /<strong>Sin tarea asignada<\/strong>/); assert.match(orphan, /Ver costos/);
  assert.match(orphan, /\$\s?5\.000/);
  console.log("OK tarjetas General y Sin tarea asignada (solo con costos huérfanos)");

  // Solo lectura: proyecto terminado.
  const readOnly = render({terminal: true, work: works[1], workId: "w0", detail: {tareas: [task({id: "t1", estado: "completada", completada: true})]}});
  assert.match(readOnly, /solo lectura/);
  assert.doesNotMatch(readOnly, /Crear tarea|Nueva subtarea|Responsable de/);
  console.log("OK proyecto terminado: tablero en solo lectura");

  // Estados de datos: cargando, error y vacío.
  const loading = render({loading: true});
  assert.match(loading, /Cargando tablero/); assert.doesNotMatch(loading, /works-task-board__column/);
  assert.equal((loading.match(/role="status"/g) || []).length, 1, "un solo role=status");
  const failed = render({error: "No se pudo cargar el tablero del proyecto."});
  assert.match(failed, /role="alert"/); assert.match(failed, /Reintentar/); assert.doesNotMatch(failed, /Aún no hay tareas|works-task-board__column|<strong>General<\/strong>/, "un fallo nunca se muestra como vacío");
  const empty = render();
  assert.match(empty, /Aún no hay tareas\./); assert.match(empty, /<strong>General<\/strong>/);
  console.log("OK estados: cargando, error (nunca vacío) y vacío");
} finally {
  await vite.close();
}

// --- Conexiones de la página (texto fuente) ---
const page = await readFile(new URL("../src/pages/WorksPage.jsx", import.meta.url), "utf8");
const board = await readFile(new URL("../src/features/works/WorkProjectBoard.jsx", import.meta.url), "utf8");
for (const [fn, name] of [["agregarTareaTrabajo", "task-create"], ["asignarTareaTrabajo", "task-assign"], ["agregarSubtareaTrabajo", "subtask-create"], ["actualizarSubtareaTrabajo", "subtask-toggle"], ["actualizarSubtareaTrabajo", "subtask-title"], ["eliminarSubtareaTrabajo", "subtask-delete"], ["documentarTareaTrabajo", "task-document"], ["eliminarTareaTrabajo", "task-delete"]]) {
  assert.match(page, new RegExp(`${fn}\\(businessId, boardWorkId,[^\\n]*createWorkTaskRequestId\\("${name}"\\)`), `${fn} con requestId ${name}`);
}
assert.match(page, /cambiarEstadoTareaTrabajo\(businessId, boardWorkId, task\.id, estado,/);
assert.match(page, /const runBoardAction = \(key, action\) => runWorkAction\(boardWorkId, key, action\);/);
// Costos: los mismos formularios, acotados a la tarea (tareaId ya asociado).
assert.match(page, /<MaterialsSection key=\{`materials-\$\{boardWorkId\}-\$\{scope\}`\}[^>]*taskId=\{scope\}/);
assert.match(page, /<FinancialSection key=\{`costs-\$\{boardWorkId\}-\$\{scope\}`\}[^>]*taskId=\{scope\}/);
assert.match(page, /const fixedTaskId = scoped && !orphanScope \? taskId : "";/);
assert.match(page, /canRegister = \(canManage \|\| \["TECNICO", "MEMBER"\]\.includes\(role\)\) && !orphanScope/, "Sin tarea asignada es solo lectura");
assert.match(page, /\{!scoped && <TaskCostSelect/);
assert.match(page, /registrarGastoTrabajo\(businessId, workId, payload, createWorkCostRequestId\("expense-create"\)\)/);
assert.match(page, /registrarHorasHombreTrabajo\(businessId, workId, payload, createWorkCostRequestId\("labor-create"\)\)/);
assert.match(page, /registrarSalidaMaterialTrabajo\(businessId, workId, draft, createWorkCostRequestId\("material-exit"\)\)/);
// Ficha: botón al tablero y deep link de la ficha intacto.
assert.match(page, /onClick=\{\(\) => openWorkBoard\(selectedWork\)\}>Trabajar en el tablero</);
assert.match(page, /const openWorkBoard = \(work\) => \{ setSelectedWork\(null\); selectBoardWork\(work\.id\); \};/);
assert.match(page, /location\.state\?\.openWorkId/); assert.match(page, /navigate\(\{pathname: "\/trabajos", search: location\.search\}, \{replace: true, state: \{\}\}\)/);
// Etapa C fuera de alcance.
for (const source of [page, board]) assert.doesNotMatch(source, /Cerrar proyecto|cerrarProyecto/);
assert.doesNotMatch(board, /eliminarTareaTrabajo|Eliminar tarea/);
console.log("OK conexiones: mismas Functions y requestId, costos acotados a la tarea, ficha→tablero y deep link");

console.log("WORK_PROJECT_BOARD_SMOKE_OK");
