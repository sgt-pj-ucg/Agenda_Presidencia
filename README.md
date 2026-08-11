# Agenda Presidenta 6.0.10 — corrección de formato de Google Sheets

## Problema reportado

Al editar una actividad desde PC podía aparecer:

`No puedes configurar el formato de número de las celdas de una columna con texto.`

El problema no estaba en la vista PC. Provenía de `Code.gs`.

## Causa

Después de crear o editar un registro, el backend guardaba correctamente los
datos y luego ejecutaba `setNumberFormat('dd/MM/yyyy')` sobre FECHA.

Si Google Sheets tiene esa columna definida como texto, el dato puede quedar
guardado y, a continuación, la operación de formato falla. La aplicación recibe
entonces un mensaje de error aunque la escritura ya se haya realizado.

Se localizaron 7 operaciones de este tipo en el backend:

- creación de actividad;
- edición de actividad;
- creación de feriado;
- edición de feriado;
- actualización/importación de feriados oficiales;
- creación de nuevas filas de feriados oficiales;
- formato de la columna FECHA al crear `FERIADOS_CHILE`.

## Corrección

Se eliminaron las 7 operaciones de formato forzado.

Las fechas continúan normalizándose como `dd/MM/yyyy`, y la aplicación sigue
interpretándolas y ordenándolas correctamente.

La corrección cubre:

- crear actividades;
- editar actividades;
- crear/editar feriados;
- actualización automática de feriados oficiales.

Esto evita también el riesgo de que una creación se guarde, muestre un falso
error y el usuario vuelva a intentarla generando un duplicado.

## Instalación

Esta corrección es de backend.

1. Abra Google Apps Script de Agenda Presidenta.
2. Reemplace el contenido por el `Code.gs` de esta versión.
3. Actualice la implementación existente.

Mantenga la misma URL `/exec`.

No es necesario cambiar archivos de GitHub para esta corrección.
