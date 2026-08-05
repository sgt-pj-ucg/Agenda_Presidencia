# Agenda Presidenta — bienvenida premium

Proyecto de prueba independiente de la versión estable.

## Nueva experiencia de inicio

Al abrir la aplicación aparece una bienvenida institucional breve:

- fondo adaptado al modo claro u oscuro;
- ícono de la aplicación con aparición suave;
- Agenda Presidenta Gloria Negroni;
- identificación de la Corte de Apelaciones de La Serena;
- línea de progreso dorada discreta;
- salida automática cuando la agenda está lista.

La animación dura aproximadamente 0,8 segundos y nunca bloquea la interfaz por más de 1,6 segundos. La agenda comienza a cargar inmediatamente detrás de la bienvenida.

El sistema respeta la preferencia del teléfono de reducir movimiento.

## Archivos que deben subirse

Reemplaza todo el contenido del repositorio de prueba con:

- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

No es necesario modificar `Code.gs`.

Después de publicar, cierra completamente la aplicación instalada y vuelve a abrirla para que el nuevo service worker active la experiencia de inicio.
