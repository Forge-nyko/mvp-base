## Clínica Veterinaria · Ajustes de integración

La rama incluye control de versión y reintentos de pacientes, reserva transaccional de microchip, cupo único y hora local en citas, y validación de fotos clínicas. El navegador reduce la calidad del JPEG si supera 2 MiB y avisa si la imagen no cabe.

## Cambios fuera de Veterinaria

- `firebase.json` agrega el predeploy `node scripts/package-veterinary-models.cjs` antes del lint para incluir los modelos compartidos en el paquete de Functions.
- `.gitignore` excluye `functions/veterinary-models/`, generado a partir de `src`.
- `functions/package.json` incorpora los archivos nuevos de Veterinaria a la lista de lint.
- `package.json` registra los smokes e incorpora las cuatro pruebas en emuladores y el smoke de empaquetado al comando `test:veterinary`.
- `README.md` documenta el comportamiento, las pruebas y el predeploy.

## Correcciones de concurrencia y migración

Se elimina la consulta por microchip dentro de la transacción: las reservas son la única fuente de unicidad. Se incorpora una migración local de pacientes antiguos, simulada por defecto, idempotente y sin borrados, que informa duplicados y conflictos sin sobrescribirlos. Requiere pausar las escrituras y resolver conflictos antes de habilitar la nueva versión.

Las pruebas incluyen veinte ejecuciones consecutivas del smoke de pacientes y rechazo de creación/reprogramación de citas con país ausente u OTHER a nivel del handler de la Function. El manual del módulo se actualiza y los errores de conversión JPEG se distinguen del exceso de 2 MiB.

Rama para revisión en el fork; sin despliegue ni cambios de stock, retención o perfil del trabajador. La integración debe hacerse mediante Squash and merge. No se crea un PR adicional por esta entrega.
