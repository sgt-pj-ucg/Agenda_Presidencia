# Agenda Presidenta 6.0.11 — sincronización en vivo y edición robusta

## Corrección definitiva de edición

El caso reportado fue reproducido con la actividad:

- Fecha: 28/08/2026
- Actividad: Cena aniversario 177° Corte
- Fila real: 74
- Hora original: sin hora

Al intentar cambiarla a 15:00, el backend antiguo usaba:

`horaOriginal || horaNueva`

Como la hora original era una cadena vacía, terminaba buscando la fila por la
hora nueva 15:00. Esa hora todavía no existía en Google Sheets y la actividad
no podía localizarse.

La versión 6.0.11 conserva expresamente los valores originales vacíos.

## Lectura y escritura unificadas

Antes:

- lectura: CSV publicado de Google Sheets;
- escritura: Google Apps Script.

Ese diseño podía generar desfases entre móvil, PC, CSV y planilla.

Desde 6.0.11:

- lectura: Apps Script `listar`;
- creación: Apps Script;
- edición: Apps Script;
- cambio de estado: Apps Script;
- eliminación: Apps Script.

`listar` devuelve el número real de fila de Google Sheets (`_row`), por lo que
móvil y PC trabajan sobre la misma fuente en vivo.

## Resolución segura de filas

La edición intenta:

1. fila exacta + identidad original;
2. fecha + hora original + actividad;
3. como rescate, fecha + actividad solo si existe una única coincidencia.

Si hay varias coincidencias, se detiene en lugar de modificar una fila dudosa.

## Estado Ausente

La casilla especial de ausencia ahora depende exclusivamente de:

`ESTADO = Ausente`

No se considera ausencia por palabras en ACTIVIDAD ni por MODALIDAD.

Por tanto:

- un curso Confirmado sigue siendo una actividad normal;
- un feriado escrito como texto no implica ausencia;
- un permiso escrito en el detalle no implica ausencia;
- solo el estado Ausente activa el diseño gris azulado de ausencia.

Los feriados nacionales oficiales continúan con su propio diseño rojo,
independiente del estado de la Presidenta.

## Zona horaria

El backend utiliza explícitamente:

`America/Santiago`

La planilla actualmente tiene una configuración distinta; conviene cambiarla
también a Santiago en Archivo → Configuración.

## Orden de actualización

IMPORTANTE:

1. primero reemplazar Code.gs y actualizar la implementación existente;
2. después subir a GitHub los archivos web 6.0.11.

La URL /exec no cambia.

Archivos web que cambian:

- index.html
- app.js
- service-worker.js

`styles.css` se mantiene, pero el paquete completo puede subirse para evitar
mezclar versiones.
