# Agenda Presidenta — encabezado adaptativo y calendario protagonista

Proyecto de prueba independiente de la versión estable.

## Cambios de esta entrega

- Identidad superior recuperada: escudo, Agenda y Presidenta Gloria Negroni vuelven a tener presencia.
- Saludo y resumen ejecutivo más legibles.
- En Calendario, el encabezado se repliega al desplazarse hacia abajo.
- Al desplazarse hacia arriba o volver al inicio, el encabezado reaparece.
- El encabezado compacto conserva el nombre, el tema y el botón de actualización.
- Calendario más grande: días de 44 px, título mensual mayor y más aire visual.
- Se mantienen:
  - deslizamiento horizontal para cambiar de mes;
  - deslizamiento del panel para cambiar de día;
  - identificación fina de ausencias;
  - instalación PWA;
  - conexión operativa con Google Sheets.

## Archivos que deben reemplazarse

Sube todo el contenido de esta carpeta a la raíz del repositorio de prueba:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para que el service worker cargue la nueva interfaz.
