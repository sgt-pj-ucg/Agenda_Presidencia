# Agenda Presidenta 6.0.4 — Feriados nacionales de Chile

Esta entrega incorpora identificación visual y consulta de feriados nacionales.

## Comportamiento visual

En el calendario, cada feriado se muestra con:

- fondo rojo arcilla suave;
- borde fino;
- número del día destacado;
- etiqueta `FERIADO`;
- convivencia con las líneas de actividades cuando existen.

Al seleccionar el día aparece una ficha con:

- `Feriado legal en Chile`;
- nombre del feriado;
- alcance `Nacional`;
- indicación de actividades excepcionales o ausencia de actividades.

Ejemplo:

- 15 de agosto
- Asunción de la Virgen
- Feriado nacional
- Sin actividades agendadas

## Actualización

La aplicación utiliza un sistema híbrido:

1. calendario legal calculado localmente para seguir funcionando sin conexión;
2. consulta automática de un catálogo público de feriados nacionales;
3. caché local durante 24 horas;
4. actualización al abrir años nuevos en el calendario.

Los feriados regionales o comunales no se muestran en esta entrega.

## Voz

Cuando se consulta una fecha sin actividades y corresponde a un feriado, la aplicación responde, por ejemplo:

`Feriado nacional: Asunción de la Virgen. Sin actividad agendada para el sábado 15 de agosto.`

## Archivos que deben subirse

Reemplaza todo el contenido del repositorio con:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para actualizar la caché.
