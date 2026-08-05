# Agenda Presidenta 6.0 — experiencia ejecutiva

Esta entrega se construyó sobre la versión 5.0.10 y conserva la integración existente con Google Sheets y Google Apps Script.

## Mejoras incorporadas

### 1. Tarjeta ejecutiva inteligente
- Resume la jornada actual.
- Indica la próxima actividad, hora y modalidad.
- Advierte coincidencias horarias.
- Señala actividades pendientes o por confirmar.
- Identifica ausencias registradas.
- Al tocar “Próxima”, abre el calendario en el día actual y lleva a la actividad correspondiente.

### 2. Línea de tiempo diaria
- El panel del día seleccionado utiliza una línea de tiempo vertical.
- Orden cronológico único.
- Marcadores cromáticos por modalidad.
- La próxima actividad se destaca automáticamente.
- Las actividades pasadas permanecen visibles, pero atenuadas.

### 3. Microinteracciones
- Transición direccional al cambiar de mes.
- Respuesta visual al seleccionar un día.
- Entrada progresiva de la línea de tiempo.
- Confirmaciones con vibración breve en Android, cuando el dispositivo lo permite.
- Animaciones respetan “Reducir movimiento”.

### 4. Hoy y próxima actividad
- “Hoy” tiene anillo dorado e identificación textual.
- La próxima actividad muestra “Próxima · en X min”.
- Las actividades ya realizadas se distinguen sin desaparecer.

### 5. Búsqueda inteligente por voz
Ejemplos admitidos:
- “¿Qué tengo mañana?”
- “Muéstrame la agenda del viernes.”
- “Busca actividades telemáticas.”
- “Actividades presenciales esta semana.”
- “¿Cuál es mi próxima actividad?”
- “Abre el calendario del 12 de agosto.”

La voz solo consulta y navega; no elimina ni modifica actividades.

### 6. Experiencia notebook
- Navegación lateral ejecutiva.
- Cabecera y resumen adaptados a pantallas anchas.
- Calendario y línea de tiempo en dos paneles.
- Mayor densidad de información sin perder legibilidad.
- Agenda y vista mensual aprovechan dos columnas.
- Escala adicional para pantallas de 1440 px o más.

## Publicación

Sube todo el contenido del paquete a la raíz del repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla. Si Android mantiene una versión anterior, elimina el acceso directo y vuelve a instalarla desde Chrome.
