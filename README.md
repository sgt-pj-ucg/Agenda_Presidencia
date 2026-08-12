# Agenda Presidenta 6.1.0 — voz asistida + recordatorios

Base: Presidenta 6.0.11 Live Sync.

## Se incorpora
- Crear por voz como alternativa adicional al ingreso manual.
- Push-to-Talk: mantener pulsado, hablar y soltar.
- Modo manos libres alternativo.
- Transcripción en vivo y detección visual de Actividad, Fecha, Hora, Modalidad,
  Lugar, Participantes y Estado.
- Revisión obligatoria en el formulario normal antes de guardar.
- Recordatorio local 15 minutos antes mediante Notification + Service Worker.

## Se conserva
- lectura y escritura por el mismo Apps Script 6.0.11;
- fila real `_row`;
- edición robusta cuando la hora original está vacía;
- feriados Chile;
- calendario y resumen ejecutivo;
- búsqueda y micrófono de búsqueda;
- dictado corto del campo Actividad;
- regla de ausencia: solo ESTADO = Ausente.

## Apps Script
`Code.gs` no cambia respecto de 6.0.11. Si ya está desplegado correctamente, esta
actualización es solo de GitHub.

## Importante sobre avisos
El recordatorio de 15 minutos es local, igual al que se probó en Comunicaciones.
No se garantiza si el sistema operativo cierra o suspende completamente la PWA.
No se incorpora OneSignal en esta versión.
