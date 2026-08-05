# Agenda Presidenta — entrega móvil 5.0.5

Proyecto de prueba independiente de la versión estable.

## Mejoras incluidas

- Encabezado adaptativo sin parpadeo:
  - se compacta al superar un umbral claro;
  - permanece compacto mientras se revisan actividades;
  - vuelve a expandirse al regresar al inicio o al tocarlo.
- Selector propio de hora:
  - evita el cuadro nativo con textos recortados;
  - accesos rápidos;
  - ajuste de 15 minutos;
  - hora y minutos editables;
  - opciones completas: Sin hora, Cancelar y Usar hora.
- Dictado de voz dentro del campo Actividad.
- Lugar o enlace continúa siendo texto libre.
- Menú de estados y botones con ancho táctil y textos completos.
- Ausencia sola sin raya inferior duplicada:
  - el cajón gris azulado identifica la ausencia;
  - las líneas inferiores aparecen solo si ese día también tiene tareas.
- Se mantiene la instalación PWA y la sincronización con Google Sheets.

## Archivos que deben reemplazarse

Sube todo el contenido de esta carpeta a la raíz del repositorio de prueba:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para actualizar el service worker.
