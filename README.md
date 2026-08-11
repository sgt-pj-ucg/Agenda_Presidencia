# Agenda Presidenta 6.0.9 — corrección del resumen ejecutivo

## Error corregido

En móvil podía aparecer a la derecha de la ficha `Próxima actividad` un chip cortado como:

`1 activid…`

Ese chip correspondía al contador de actividades con estado `Pendiente` o `Por Confirmar`.

En el caso observado era redundante, porque la única actividad pendiente era precisamente la próxima actividad y su estado ya aparecía en la tarjeta principal.

## Nuevo comportamiento

- Si la próxima actividad está `Pendiente` o `Por Confirmar`, el estado se muestra dentro de la propia ficha `Próxima actividad`.
- No se crea un contador adicional por esa misma actividad.
- Si existen otras actividades pendientes además de la próxima, se informa únicamente la cantidad adicional.
- Una ausencia no genera un chip redundante cuando toda la jornada corresponde a ausencia.
- Las coincidencias horarias continúan mostrándose porque son una alerta relevante.

## Protección contra textos cortados

En móvil:

- la ficha `Próxima actividad` ocupa el ancho completo;
- los avisos adicionales saltan a una nueva línea;
- se eliminó el desbordamiento horizontal del bloque;
- ningún chip puede quedar parcialmente visible fuera de la tarjeta.

También se revisó el comportamiento para pantallas especialmente angostas y para notebook.

## Sin cambios de backend

No se modificaron:

- Google Sheet
- Code.gs
- Apps Script
- feriados
- voz
- calendario
- edición/eliminación
- selector de hora

Solo debes actualizar los archivos web en GitHub.
