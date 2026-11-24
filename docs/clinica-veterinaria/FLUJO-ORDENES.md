# Flujo de órdenes de Clínica Veterinaria

## Entradas al flujo

- Con cita. Registra la llegada y el triage en Agenda. Desde la cita en espera, crea una orden. La Agenda sigue mostrando la cita vinculada.
- Sin cita. Abre **Órdenes de atención** desde Resumen clínico y selecciona **Recibir sin cita**. Selecciona un paciente registrado e indica hora, prioridad y motivo.
- Emergencia. Selecciona **Nueva emergencia** en Órdenes de atención. Usa un paciente registrado y confirma la prioridad de recepción. El sistema la presenta primero en la cola, según la prioridad registrada y la hora de llegada.
- Solo compra. Desde Órdenes de atención, selecciona **Venta directa**. Se abre el flujo comercial de ValoraCloud. Una venta de mostrador no crea cita ni orden clínica.

## Desde la recepción hasta el cierre

1. La cola de órdenes muestra las recepciones en espera y las consultas en atención.
2. Abre la orden. Asigna box, tipo de atención y profesional a cargo antes de iniciar.
3. El profesional asignado inicia la consulta con su cuenta. La pantalla muestra los datos de la orden y hasta tres atenciones anteriores finalizadas del paciente. La ficha conserva el historial completo y las fotos.
4. Completa el registro clínico y guarda el borrador cuando corresponda. También puedes registrar fotos y marcas.
5. Desde **Recetas veterinarias**, el profesional asignado puede ingresar los medicamentos, dosis, frecuencia, duración e indicaciones que él determine. La aplicación guarda la receta emitida, su autor y su fecha en el historial. El flujo registra una receta dentro de ValoraCloud y no genera un documento firmado.
6. Cierra la atención. Al cerrar se libera el box y, cuando existe una cita vinculada, esta refleja el cierre. La orden finalizada aparece en el historial del mismo paciente.

## Compatibilidad y permisos de revisión

Se conservan las atenciones anteriores y sus fotos. Las nuevas órdenes usan un identificador de atención propio y la cita es opcional. Las operaciones nuevas se agregan a la Function veterinaria existente. Las ventas continúan usando el módulo comercial. Los productos utilizados en la atención siguen siendo un registro clínico.

Este avance usa las cuentas activas de Propietario y Administrador para la revisión. Asignar un profesional no concede acceso a su cuenta. Para una orden nueva, el profesional asignado es quien inicia, trabaja, emite recetas y cierra. Los datos fiscales y permisos de otros perfiles se conservan bajo las reglas actuales.

Validar con el equipo los nombres y la configuración de los boxes y tipos de atención, el acceso futuro del profesional con otro perfil y el formato de receta que la clínica quiera entregar. El ingreso de emergencia actual parte de un paciente registrado.
