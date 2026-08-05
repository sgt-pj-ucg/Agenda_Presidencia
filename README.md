# Agenda Presidenta — resumen equilibrado y calendario estable

Proyecto de prueba independiente de la versión estable.

## Cambios de esta entrega

- El bloque de fecha, saludo y resumen diario aumenta moderadamente su tamaño.
- Conserva el comportamiento adaptativo: se repliega al bajar en Calendario y reaparece al volver arriba.
- El calendario usa siempre seis filas, por lo que mantiene exactamente la misma altura al cambiar de mes.
- Seis filas son necesarias: algunos meses no caben completos en cinco.
- La navegación rápida conserva únicamente:
  - Hoy
  - Mañana
  - Semana
- Se elimina el botón manual de actualización.
- La agenda se sincroniza:
  - al abrir;
  - al volver a la aplicación después de dos minutos;
  - al recuperar la conexión.
- El gesto de actualizar del navegador sigue disponible.
- El selector claro/oscuro es más grande, limpio y moderno.
- Se conserva la normalización de fechas y el orden cronológico de la entrega anterior.

## Archivos que deben subirse

Reemplaza todo el contenido del repositorio de prueba con:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para activar la nueva caché.
