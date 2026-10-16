import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";
import {
  WORK_TASK_STATUSES,
  canOperateWorkTask,
  getVisibleWorkTasks,
  getWorkTaskStatusOptions,
} from "../src/domain/workModel.mjs";

// PROJECTS_V3 ETAPA 2 (SPEC 019 §5): tablero de tareas dentro de la ficha del
// Proyecto abierto. Sin Firebase real: WorkTaskBoard.jsx no importa ningún
// service ni firebaseConfig.js (a diferencia de WorksPage.jsx, que sí lo hace
// transitivamente y por eso no puede cargarse aquí — mismo hallazgo ya
// documentado en Reports V4 y en la ETAPA 1 de este bloque). Las
// transiciones de estado se verifican en dos niveles: (a) la lógica pura de
// qué transiciones se ofrecen (getWorkTaskStatusOptions, ya compartida con
// la vista de lista) y (b) un escaneo de fuente que confirma que el <select>
// del tablero llama a onRequestTaskState(task, valor) sin ninguna
// transformación ni mutación propia — el tablero no reimplementa ni
// intercepta cambiarEstadoTareaTrabajo, sólo reenvía la misma función que ya
// usa la lista.

const COSTS = {expenses: [], labor: [], materials: []};

function task(overrides = {}) {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    titulo: "Instalar switch principal",
    descripcion: "",
    modeloTareaVersion: 2,
    responsableUid: "",
    responsableSnapshot: null,
    estado: "pendiente",
    completada: false,
    subtareas: [],
    motivoEspera: "",
    creadoEn: "2026-08-01T10:00:00.000Z",
    completadaEn: null,
    documentacionTotal: 0,
    documentacion: [],
    ...overrides,
  };
}

const vite = await createServer({appType: "custom", logLevel: "silent", server: {middlewareMode: true}});

try {
  const {default: WorkTaskBoard} = await vite.ssrLoadModule("/src/features/works/WorkTaskBoard.jsx");

  const render = (tasks, props = {}) => renderToStaticMarkup(React.createElement(WorkTaskBoard, {
    canManage: true,
    canOperate: () => true,
    costs: COSTS,
    currency: "CLP",
    emptyCopy: "Aún no hay tareas.",
    onRemoveLegacy: () => {},
    onRequestTaskState: () => {},
    processing: "",
    tasks,
    terminal: false,
    ...props,
  }));

  // --- Casos 1/2: cuatro columnas, distribución correcta por estado ---
  const mixed = [
    task({id: "t1", estado: "pendiente", titulo: "Levantar cotización"}),
    task({id: "t2", estado: "pendiente", titulo: "Coordinar visita"}),
    task({id: "t3", estado: "en_progreso", titulo: "Tender cableado"}),
    task({id: "t4", estado: "en_espera", motivoEspera: "Esperando aprobación del cliente", titulo: "Instalar rack"}),
    task({id: "t5", estado: "completada", completada: true, titulo: "Diagnóstico inicial"}),
  ];
  const mixedMarkup = render(mixed);
  assert.equal((mixedMarkup.match(/works-task-board__column"/g) || []).length, 4, "el tablero siempre tiene 4 columnas, use o no cada estado");
  for (const column of WORK_TASK_STATUSES) assert.match(mixedMarkup, new RegExp(`<h4>${column.label}</h4>`));
  assert.match(mixedMarkup, /Levantar cotización/);
  assert.match(mixedMarkup, /Coordinar visita/);
  assert.match(mixedMarkup, /Tender cableado/);
  assert.match(mixedMarkup, /Instalar rack/);
  assert.match(mixedMarkup, /Diagnóstico inicial/);
  console.log("OK casos 1/2: cuatro columnas canónicas con la distribución correcta por estado");

  // --- Caso 3: Proyecto sin tareas ---
  const emptyMarkup = render([]);
  assert.match(emptyMarkup, /Aún no hay tareas\./);
  assert.doesNotMatch(emptyMarkup, /works-task-board__column"/);
  console.log("OK caso 3: Proyecto sin tareas muestra un único mensaje, no columnas vacías");

  // --- Estado vacío por columna cuando el Proyecto sí tiene tareas pero no en esa columna ---
  const onlyPending = [task({id: "p1", estado: "pendiente"})];
  const onlyPendingMarkup = render(onlyPending);
  assert.equal((onlyPendingMarkup.match(/Sin tareas en este estado\./g) || []).length, 3, "las 3 columnas sin tareas muestran su propio mensaje vacío");
  console.log("OK: sólo tareas pendientes deja las otras 3 columnas con su mensaje vacío, sin ocultar el tablero");

  // --- Caso: todas completadas ---
  const allDone = [task({id: "d1", estado: "completada", completada: true}), task({id: "d2", estado: "completada", completada: true})];
  const allDoneMarkup = render(allDone);
  assert.equal((allDoneMarkup.match(/works-task-board__card"/g) || []).length, 2);
  console.log("OK: todas las tareas completadas se agrupan en la columna Completada");

  // --- Caso 4: sólo tareas del Proyecto actual (contrato estructural) ---
  const boardSource = await readFile(new URL("../src/features/works/WorkTaskBoard.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(boardSource, /businessId|trabajoId|workId/, "el componente no debe recibir ni usar ningún identificador de Proyecto: sólo debe operar sobre `tasks`, ya acotadas por el padre");
  assert.doesNotMatch(boardSource, /firebase|firestore|getDocs|httpsCallable|onSnapshot|listarTrabajos|cargarFichaTrabajo/i, "sin ninguna consulta remota propia");
  console.log("OK caso 4: el tablero no tiene forma de referenciar otro Proyecto; sólo renderiza `tasks` recibidas por props");

  // --- Casos 5/6/7: transiciones ofrecidas para cada estado (misma lógica que la lista) ---
  assert.deepEqual(
    getWorkTaskStatusOptions({estado: "pendiente"}, {canManage: true}).map((entry) => entry.value),
    ["pendiente", "en_progreso", "en_espera", "completada"]
  );
  assert.ok(getWorkTaskStatusOptions({estado: "pendiente"}, {canManage: true}).some((entry) => entry.value === "en_progreso"));
  console.log("OK caso 5: pendiente -> en_progreso está entre las transiciones ofrecidas");

  assert.ok(getWorkTaskStatusOptions({estado: "en_progreso"}, {canManage: true}).some((entry) => entry.value === "en_espera"));
  console.log("OK caso 6: en_progreso -> en_espera está entre las transiciones ofrecidas");

  assert.ok(getWorkTaskStatusOptions({estado: "en_progreso"}, {canManage: true}).some((entry) => entry.value === "completada"));
  console.log("OK caso 7: cualquier estado activo -> completada está entre las transiciones ofrecidas");

  // --- Caso 8: la mutación reutilizada es la misma, sin transformación ni reinterpretación ---
  assert.match(
    boardSource,
    /onChange=\{\(event\) => onRequestTaskState\(task, event\.target\.value\)\}/,
    "el <select> del tablero debe reenviar (task, valor) sin transformarlo, a la misma función ya usada por la lista"
  );
  assert.doesNotMatch(boardSource, /cambiarEstadoTareaTrabajo\(|eliminarTareaTrabajo\(|from ["'].*workService/, "el tablero no debe importar ni llamar directamente las mutaciones: sólo recibe callbacks ya resueltos por el padre");
  console.log("OK caso 8: el cambio de estado se reenvía intacto a la misma función que ya usa la lista, sin reimplementarla");

  // SPEC 028 etapa B: el tablero de tareas lo monta WorkProjectBoard (tablero por proyecto) y ya no
  // TaskSection. El select de estado sigue reenviando a una única función, requestTaskState, y la página
  // la resuelve con la misma Function y el mismo requestId de antes.
  const worksPageSource = await readFile(new URL("../src/pages/WorksPage.jsx", import.meta.url), "utf8");
  const projectBoardSource = await readFile(new URL("../src/features/works/WorkProjectBoard.jsx", import.meta.url), "utf8");
  assert.match(
    projectBoardSource,
    /<WorkTaskBoard[\s\S]{0,700}onRequestTaskState=\{requestTaskState\}/,
    "WorkProjectBoard debe cablear WorkTaskBoard a requestTaskState"
  );
  assert.match(
    projectBoardSource,
    /const requestTaskState = \(task, estado\) => \{\s*if \(estado === "en_espera"\) \{[^}]*\}\s*actions\.changeTaskState\(task, estado\);/,
    "requestTaskState pide motivo para en_espera y para el resto llama a actions.changeTaskState sin transformar el estado"
  );
  assert.match(
    worksPageSource,
    /changeTaskState: \(task, estado, motivoEspera = ""\) => runBoardAction\(`task-state-\$\{task\.id\}`, \(\) => cambiarEstadoTareaTrabajo\(businessId, boardWorkId, task\.id, estado, \{motivoEspera, requestId: createWorkTaskRequestId\(`task-\$\{estado\}`\)\}\)\)/,
    "la página resuelve changeTaskState con cambiarEstadoTareaTrabajo y el mismo requestId de siempre"
  );
  assert.doesNotMatch(projectBoardSource, /from ["'].*(workService|firebase)|httpsCallable|getDocs/, "WorkProjectBoard sigue siendo presentacional: no importa servicios ni Firebase");
  console.log("OK: WorkProjectBoard conecta el tablero a requestTaskState y la página lo resuelve con la misma Function y requestId");

  // --- Casos 9/10: permisos — sólo lectura no puede mutar, autorizado sí ---
  const readOnlyTask = task({id: "ro1", estado: "pendiente", responsableUid: "otro-uid"});
  const readOnlyMarkup = render([readOnlyTask], {canOperate: () => false});
  assert.match(readOnlyMarkup, /Sólo lectura/);
  assert.doesNotMatch(readOnlyMarkup, /<select/);
  console.log("OK caso 9: un usuario sin permiso sobre la tarea ve el tablero pero no el control de mutación");

  const authorizedMarkup = render([task({id: "au1", estado: "pendiente"})], {canOperate: () => true});
  assert.match(authorizedMarkup, /<select/);
  assert.doesNotMatch(authorizedMarkup, /Sólo lectura/);
  console.log("OK caso 10: un usuario autorizado sí ve el control de cambio de estado");

  // --- Casos 11/12: tareas v1 (legacy) vs v2 (append-only) ---
  const legacyTask = task({id: "v1", modeloTareaVersion: 1, estado: "pendiente"});
  const legacyMarkup = render([legacyTask], {canManage: true});
  assert.match(legacyMarkup, /Tarea legacy/);
  assert.match(legacyMarkup, new RegExp(`Eliminar ${legacyTask.titulo}`));
  console.log("OK caso 11: una tarea v1 muestra su badge legacy y conserva la acción Eliminar");

  const v2Task = task({id: "v2", modeloTareaVersion: 2, estado: "pendiente"});
  const v2Markup = render([v2Task], {canManage: true});
  assert.doesNotMatch(v2Markup, /Tarea legacy/);
  assert.doesNotMatch(v2Markup, new RegExp(`Eliminar ${v2Task.titulo}`));
  console.log("OK caso 12: una tarea v2 nunca ofrece eliminarla (append-only), igual que en la lista");

  const legacyCompleted = render([task({id: "v1c", modeloTareaVersion: 1, estado: "completada", completada: true})], {canManage: true});
  assert.doesNotMatch(legacyCompleted, /Eliminar/, "una tarea v1 ya completada tampoco se puede eliminar, igual que en la lista");
  console.log("OK: tarea v1 completada pierde la acción Eliminar, igual que en la vista de lista");

  // --- Caso 13 (reescrito, SPEC 028 etapa B): ni las columnas ni el contenedor interceptan errores ---
  // WorkTaskBoard (columnas y tarjetas base) sigue sin estado ni manejo de errores. El estado de borradores
  // (subtarea, documentación, tarea nueva, diálogos) vive en WorkProjectBoard, que tampoco captura errores:
  // cada acción devuelve la promesa de runBoardAction (WorksPage), el mismo camino de error que usaba la lista.
  assert.doesNotMatch(boardSource, /catch|try\s*\{|setError|useState/i, "WorkTaskBoard sigue sin estado propio ni manejo de errores");
  const projectBoardForErrors = await readFile(new URL("../src/features/works/WorkProjectBoard.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(projectBoardForErrors, /catch|try\s*\{|setError/i, "WorkProjectBoard no captura errores de mutación: se propagan a runBoardAction/setError en WorksPage");
  assert.match(projectBoardForErrors, /useState/, "el estado de borradores vive en WorkProjectBoard, no en WorkTaskBoard");
  console.log("OK caso 13: ni WorkTaskBoard ni WorkProjectBoard interceptan errores; el fallo sigue el camino de runBoardAction");

  // --- Caso 14: sin drag-and-drop ---
  assert.doesNotMatch(boardSource, /draggable|onDrag|onDrop|dnd-kit|react-beautiful-dnd|react-dnd/i);
  console.log("OK caso 14: no existe ningún rastro de drag-and-drop en el tablero");

  // --- Caso 15: no se agregan estados nuevos ---
  assert.doesNotMatch(boardSource, /["'](bloqueada|archivada|revisión|en_revision|descartada)["']/i, "el tablero no debe inventar estados de tarea que no existan en WORK_TASK_STATUSES");
  assert.match(boardSource, /WORK_TASK_STATUSES/);
  console.log("OK caso 15: las columnas provienen únicamente de WORK_TASK_STATUSES; no se definió ningún estado nuevo");

  // --- Caso: sin NaN/undefined/null visibles con datos mínimos ---
  const bareTask = task({id: "bare", estado: "pendiente", responsableUid: "", subtareas: [], creadoEn: ""});
  const bareMarkup = render([bareTask]);
  assert.doesNotMatch(bareMarkup, /\bNaN\b|\bundefined\b|\bnull\b/);
  assert.match(bareMarkup, /Sin responsable/);
  console.log("OK: tarea sin responsable/fecha/subtareas no muestra NaN/undefined/null, usa los mismos textos de respaldo que la lista");

  // --- Título largo no rompe el layout (overflow-wrap ya declarado en CSS; aquí sólo probamos que no trunca el texto de forma silenciosa/errónea) ---
  const longTitleTask = task({id: "long", titulo: "Reemplazar el gabinete de comunicaciones completo del tercer piso incluyendo UPS y regletas de energía redundante"});
  const longTitleMarkup = render([longTitleTask]);
  assert.match(longTitleMarkup, new RegExp(longTitleTask.titulo));
  console.log("OK: un título largo se conserva íntegro en la tarjeta (el ajuste visual queda a cargo del CSS, sin truncar el dato)");

  console.log("WORK_TASK_BOARD_SMOKE_OK");
} finally {
  await vite.close();
}

// --- Caso 16 (SPEC 028 etapa B): el tablero de /trabajos ya NO muestra tarjetas de Proyectos ---
// Antes se fijaba que WorkBoard (una tarjeta por Proyecto) siguiera definido y montado. Ahora la vista
// Tablero elige un Proyecto y muestra solo sus tareas (WorkProjectBoard); WorkBoard se retiró a propósito.
const pageSource = await readFile(new URL("../src/pages/WorksPage.jsx", import.meta.url), "utf8");
assert.doesNotMatch(pageSource, /function WorkBoard\(|<WorkBoard /, "el tablero de tarjetas por Proyecto se retiró");
assert.match(pageSource, /<WorkProjectBoard actions=\{boardActions\}/, "la vista Tablero monta el tablero por proyecto");
assert.match(pageSource, /searchParams\.get\("vista"\) === "tablero"/, "la vista se lee de la URL (?vista=tablero)");
assert.match(pageSource, /searchParams\.get\("proyecto"\)/, "el proyecto del tablero se lee de la URL (?proyecto=<id>)");
assert.match(pageSource, /getDefaultBoardWorkId\(works\)/, "sin ?proyecto se elige el abierto más reciente");
console.log("OK caso 16: el tablero de tarjetas por Proyecto se retiró y la vista Tablero monta el tablero por proyecto");

// --- Confirmación cruzada: los helpers RBAC de tareas siguen siendo los mismos usados por la lista ---
assert.equal(canOperateWorkTask({responsableUid: "u1"}, {canManage: false, role: "TECNICO", currentUserUid: "u1"}), true);
assert.equal(canOperateWorkTask({responsableUid: "u2"}, {canManage: false, role: "TECNICO", currentUserUid: "u1"}), false);
assert.equal(canOperateWorkTask({responsableUid: "u2"}, {canManage: false, role: "MEMBER", currentUserUid: "u1"}), false);
assert.equal(canOperateWorkTask({responsableUid: "u2"}, {canManage: true, role: "ADMIN", currentUserUid: "u1"}), true);
assert.deepEqual(
  getVisibleWorkTasks(
    [{id: "legacy", modeloTareaVersion: 1, responsableUid: "otro"}, {id: "v2-mine", modeloTareaVersion: 2, responsableUid: "yo"}, {id: "v2-otro", modeloTareaVersion: 2, responsableUid: "otro"}],
    {canManage: false, currentUserUid: "yo"}
  ).map((entry) => entry.id),
  ["legacy", "v2-mine"],
  "una tarea v1 es visible para todos; una v2 sólo para su responsable, igual que en la lista"
);
console.log("OK: los helpers compartidos (canOperateWorkTask/getVisibleWorkTasks) preservan exactamente la semántica v1/v2 ya existente");

console.log("PROJECTS_V3_STAGE2_SMOKE_OK");
