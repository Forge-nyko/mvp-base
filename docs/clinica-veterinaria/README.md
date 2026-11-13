# Clínica Veterinaria

## 1. Descripción

Clínica Veterinaria es un módulo desarrollado para ValoraCloud orientado a la
gestión clínica de pacientes veterinarios dentro de un negocio.

El módulo contempla el manejo de pacientes, agenda de citas, recepción,
triage, consulta clínica, atención, cierre clínico e integración con
Inventario/Farmacia.

El desarrollo se realiza de forma aislada respecto del Core de ValoraCloud,
respetando el contrato de desarrollo de módulos y utilizando `businessId`
como contexto multiempresa.

---

## 2. Alcance

El módulo considera las siguientes áreas funcionales:

- ficha integral del paciente;
- agenda veterinaria;
- recepción;
- triage;
- consulta clínica;
- atención veterinaria;
- cierre clínico;
- integración con Inventario y Farmacia.

Actualmente el módulo cuenta con modelos de dominio, validaciones, rutas
internas React y una capa inicial de lectura de datos.

---

## 3. Arquitectura del módulo

La integración principal sigue la estructura:

```text
VeterinaryPage
      |
      v
VeterinaryRoutes
      |
      v
VeterinaryManager
      |
      +--> Modelo de datos veterinario
      |
      +--> Inventario Core
```

`VeterinaryPage` actúa como punto de entrada del módulo.

`VeterinaryRoutes` contiene la estructura de navegación interna.

`VeterinaryManager` recibe el `businessId` autorizado desde la aplicación y
coordina las lecturas de datos veterinarios y de Inventario.

---

## 4. Estructura principal de archivos

```text
src/
├── pages/
│   └── VeterinaryPage.jsx
│
└── features/
    └── veterinary/
        ├── VeterinaryManager.jsx
        ├── VeterinaryRoutes.jsx
        │
        ├── data/
        │   ├── veterinaryDataService.js
        │   └── veterinaryFirestorePaths.mjs
        │
        └── domain/
            ├── patientModel.mjs
            ├── appointmentModel.mjs
            ├── receptionTriageModel.mjs
            ├── clinicalConsultationModel.mjs
            ├── attentionModel.mjs
            ├── clinicalClosureModel.mjs
            └── inventoryPharmacyIntegrationModel.mjs
```

Los archivos existentes bajo `src/features/veterinary/dev/` corresponden a
previsualizaciones y laboratorios de desarrollo y no forman parte de la
integración productiva actual.

---

## 5. Modelo de datos

El modelo propuesto utiliza las siguientes colecciones:

```text
negocios/{businessId}
├── pacientesVeterinarios/{pacienteId}
├── citasVeterinarias/{citaId}
└── atencionesVeterinarias/{atencionId}
```

También se consumen datos existentes del Core:

```text
negocios/{businessId}/clientes
negocios/{businessId}/inventario
```

El identificador `businessId` siempre debe provenir del contexto autorizado
del negocio activo y no debe obtenerse desde parámetros manipulables por el
usuario.

---

## 6. Flujo clínico

El flujo clínico diseñado es:

```text
Paciente
   |
   v
Agenda / Cita
   |
   v
Recepción
   |
   v
Triage
   |
   v
Consulta clínica
   |
   v
Atención
   |
   v
Cierre clínico
```

Durante una atención se pueden referenciar servicios y productos provenientes
del Inventario Core.

---

## 7. Rutas React

La ruta `/clinica-veterinaria` muestra el resumen clínico. Desde **Ver pacientes**
se puede buscar, registrar, abrir la ficha y editar un paciente.

```text
/clinica-veterinaria/pacientes
/clinica-veterinaria/pacientes/nuevo
/clinica-veterinaria/pacientes/:pacienteId
/clinica-veterinaria/pacientes/:pacienteId/editar
```

Desde **Ver agenda** se pueden listar, agendar, reprogramar y cancelar citas.
La agenda valida que el paciente tenga un tutor activo del mismo negocio y
reserva un solo turno por fecha y hora para cada empresa.

```text
/clinica-veterinaria/agenda
/clinica-veterinaria/agenda/nueva
/clinica-veterinaria/citas/:citaId
/clinica-veterinaria/citas/:citaId/atencion
```

La ruta global `/clinica-veterinaria/*` ya se encuentra integrada en `App.jsx`.

---

## 8. Integración con Inventario Core

El módulo utiliza:

```text
subscribeToInventory(businessId)
```

para consultar el inventario real correspondiente al negocio activo.

La información es adaptada para identificar:

- servicios veterinarios;
- productos de farmacia;
- stock disponible para fines informativos.

La integración actual es únicamente de lectura.

El módulo no modifica:

- stock;
- costo promedio;
- valorización;
- movimientos de inventario;
- adquisiciones;
- ledger de inventario.

El descuento real de stock queda pendiente de un mecanismo único que será
definido por el Core de ValoraCloud.

---

## 9. Seguridad y multiempresa

Todos los datos veterinarios deben permanecer bajo:

```text
negocios/{businessId}/...
```

El frontend no constituye autoridad de autorización.

Las futuras escrituras deberán realizarse mediante Functions y validarse con:

- usuario autenticado;
- negocio activo;
- membresía activa;
- permisos correspondientes;
- aislamiento entre negocios.

No se permiten escrituras directas de stock desde el navegador.

---

## 10. Manejo de errores

Las suscripciones de datos veterinarios distinguen actualmente entre:

```text
permission-denied
```

y otros errores de carga.

Un error de permisos informa que el usuario no tiene autorización para acceder
a los datos clínicos.

Los errores de red, índices u otros problemas utilizan un mensaje general de
carga.

---

## 11. Pruebas ejecutadas

La validación realizada sobre la baseline actual incluye:

```text
npm run build
npm run test:veterinary
npm run test:rules
npm run test:rbac
npm run test:inventory-service
npm run test:inventory-model
git diff --check
```

Resultados:

- compilación general correcta;
- 7/7 smoke tests veterinarios correctos;
- Firestore Rules correctas;
- RBAC correcto;
- servicio de Inventario correcto;
- modelo y MVP de Inventario correctos;
- validación de diferencias Git sin errores.

---

## 12. Estado actual

Actualmente se encuentran implementados:

- modelos de dominio veterinarios;
- validaciones principales;
- integración mediante `businessId`;
- paths Firestore veterinarios;
- capa de lectura de pacientes;
- capa de lectura de citas;
- capa de lectura de atenciones;
- integración de lectura con Inventario Core;
- `VeterinaryManager`;
- `VeterinaryPage`;
- rutas internas React;
- smoke tests del módulo.

---

## 13. Integración con student-baseline

Actualmente el módulo ya se encuentra integrado con `student-baseline`.

La integración incluye:

- registro de `veterinaria` en `VERTICAL_MODULES`;
- ruta base `/clinica-veterinaria`;
- montaje de `VeterinaryPage` en `App.jsx`;
- entrada de menú obtenida desde el registro de módulos verticales;
- permiso `veterinaria.read` en RBAC;
- Firestore Rules para las colecciones veterinarias;
- bloqueo de escrituras directas desde el navegador.

Para el MVP, la lectura de datos clínicos queda limitada a `OWNER` y `ADMIN`.

Los roles `TECNICO` y `MEMBER` no tienen acceso a datos clínicos veterinarios en
esta etapa.

Quedan pendientes para una etapa posterior:

- alta asistida por IA y descuento de stock mediante el futuro mecanismo autorizado del Core.

---

## 14. Alta, edición y ficha del paciente

El formulario usa tutores activos de Clientes. Con **Registrar tutor** se abre
el formulario de Clientes dentro de Veterinaria. El tutor se guarda en
Clientes de la empresa activa y queda seleccionado para el paciente. Si
indicas la fecha de nacimiento, el formulario y la ficha calculan la edad
a la fecha de registro. Si la desconoces, puedes escribir una edad estimada. El alta y la edición llaman a
`guardarPacienteVeterinario`, que verifica la membresía, el rol, el módulo
habilitado, la habilitación operativa de la empresa y el tutor del mismo
negocio. La ficha muestra los datos del paciente y de su tutor. El historial clínico
muestra las atenciones finalizadas en orden cronológico inverso.

## Atención desde la agenda

Abre una cita pendiente, registra la hora de llegada y selecciona la prioridad.
Puedes anotar observaciones y signos vitales. Guarda la recepción y el triage
para dejar la cita en espera. Luego selecciona **Iniciar atención**. Completa el motivo,
diagnóstico, tratamiento, indicaciones y resultado clínico. Puedes asociar
servicios y productos activos del inventario con sus cantidades. Al cerrar,
la cita y la atención quedan finalizadas en una sola transacción y el
registro aparece en la ficha del paciente. Las referencias de inventario
se conservan en la atención como registro informativo, sin movimientos de stock.

### Fotos clínicas y mapa corporal

Durante la atención, abre **Fotos y mapa corporal de la mascota** y agrega
hasta 12 fotos opcionales en formato JPEG, PNG o WebP. Cada archivo
seleccionado se agrega a la lista pendiente y el formulario avanza a la
siguiente vista. Revisa la lista y pulsa **Subir todas las fotos**. Si
una foto falla, queda pendiente para volver a intentar. **Detalle (opcional)**
se selecciona manualmente. En el visor,
**Frente**, **Izquierda**, **Derecha**, **Atrás**, **Arriba** y **Abajo** cambian
a la foto tomada desde ese ángulo. Los botones se habilitan al agregar una
foto de la vista correspondiente. La transición simula un cambio de
perspectiva entre fotos reales de la mascota.

Pulsa **Marcar lesión**, señala el punto y guarda el nombre de la zona y una
observación. **Enfocar** acerca la imagen a esa marca. Guarda el mapa antes
de cerrar la atención. En **Historial clínico**, abre **Ver fotos clínicas**
en la atención correspondiente para revisar las fotos y sus marcas.

---

## 15. Restricciones actuales

Por indicación del mantenedor, actualmente no se debe:

- modificar Functions centrales;
- implementar un mecanismo propio de descuento de stock;
- modificar la economía del Inventario Core;
- desplegar cambios a producción;
- modificar secretos o configuración productiva.

La activación de Veterinaria no depende del rubro del negocio. El acceso se
controla mediante el registro de módulos verticales y los módulos habilitados
para cada negocio.

---

## 16. Documentación relacionada

La especificación técnica principal se encuentra actualmente en:

```text
docs/specs/027-clinica-veterinaria-mvp.md
```

El número oficial de esta especificación es `027`.