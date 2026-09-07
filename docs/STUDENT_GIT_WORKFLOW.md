# Workflow Git para estudiantes

## Modelo de ramas

Trabajas sobre tu propio fork de https://github.com/bazzvkngo/mvp-base, no
sobre el repositorio original. No tienes acceso de colaborador sobre
`bazzvkngo/mvp-base` — es intencional, no un error de configuración.

En tu fork:

```text
tu-usuario/mvp-base
  └─ feature/nombre-de-tu-modulo
```

`student-baseline-20260901` es una base congelada para crear ramas, no una
rama de trabajo. `mvp-base-profesor` tampoco debe recibir cambios
estudiantiles.

## Crear tu rama

1. Haz fork de https://github.com/bazzvkngo/mvp-base a tu propia cuenta de
   GitHub (botón "Fork").
2. Clona TU fork, no el repositorio original:
   ```bash
   git clone https://github.com/TU-USUARIO/mvp-base.git
   cd mvp-base
   ```
3. Agrega el repositorio original como remoto adicional, para traer
   actualizaciones de la baseline más adelante:
   ```bash
   git remote add upstream https://github.com/bazzvkngo/mvp-base.git
   ```
4. Parte de una copia limpia de la baseline:
   ```bash
   git status --short
   git switch -c feature/nombre-del-modulo upstream/student-baseline-20260901
   ```

## Trabajo diario

Antes de editar:

```bash
git branch --show-current
git status --short
```

Durante el desarrollo:

- mantén el cambio dentro de la SPEC y del contrato del módulo;
- revisa `git diff` con frecuencia;
- no incluyas archivos de otros módulos;
- no agregues `.env.local`, secretos, logs, `dist/`, `output/`, `tmp/`, datos de
  emuladores ni `node_modules/`;
- no uses datos o servicios Firebase reales.

## Commits

Agrupa una decisión verificable por commit:

```bash
git add ruta/al/archivo
git diff --cached
git commit -m "feat(modulo): describe el cambio"
```

Evita `git add .` cuando pueda incluir archivos ajenos. Los mensajes deben
explicar el resultado, no sólo indicar “cambios” o “avance”. No mezcles módulos,
refactors generales y correcciones no relacionadas.

## Ramas compartidas

- No hagas rebase ni force push sobre ramas compartidas.
- No hagas merge a `student-baseline-20260901`.
- No hagas merge a `mvp-base-profesor`.
- No integres ramas de otros equipos por tu cuenta.
- Si necesitas actualizar la base, pide al mantenedor que indique la estrategia
  y el punto exacto de integración.

## Validar antes de entregar

Ejecuta las pruebas del módulo y, como mínimo cuando correspondan:

```bash
npm run build
npm --prefix functions run lint
git diff --check
git status --short
```

Usa emuladores para toda integración Firebase. El estado final debe contener
sólo archivos del alcance acordado.

## Entrega mediante branch o PR

Sube tu feature branch a TU fork (`origin`, no `upstream`):

```bash
git push origin feature/nombre-del-modulo
```

Luego abre un Pull Request desde tu fork hacia la rama que indique el
mantenedor (`student-baseline-20260901`, salvo que se indique otra). No
completes el merge — eso lo decide el mantenedor.
