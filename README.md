# Agenda Presidenta 6.0.2 — notebook y PC renovados

Esta entrega modifica únicamente la experiencia de escritorio. La composición móvil de la versión 6.0.1 se conserva.

## Diseño de calendario para notebook y PC

- Calendario compacto y proporcionado en el sector izquierdo.
- Actividades del día seleccionado en un panel amplio a la derecha.
- Al hacer clic en cualquier fecha, el detalle se actualiza en el panel derecho.
- Se eliminó el desplazamiento interno del panel de actividades: la lectura sigue el desplazamiento natural de la página.
- El calendario permanece visible al recorrer una jornada extensa.
- Días de 48 px, seis semanas estables y leyenda compacta.
- Horas, títulos, modalidades, lugares y estados mantienen tamaños amplios.
- Transición breve al cambiar de día, sin animaciones invasivas.

## Refinamiento visual de escritorio

- Navegación lateral más delgada.
- Cabecera más horizontal y equilibrada.
- Escudo institucional optimizado para pantallas grandes mediante un isotipo nítido.
- Sombras más suaves y superficies con mejor jerarquía.
- Adaptación progresiva para notebook, monitor estándar y pantallas amplias.

## Archivos que deben subirse

Reemplaza todo el contenido del repositorio con:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para renovar la caché.
