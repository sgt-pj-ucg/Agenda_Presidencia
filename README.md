# Agenda Presidenta 6.0.8 — Premium Cards

Actualización exclusivamente visual sobre la versión 6.0.7.

## Qué cambia

### Modalidades
Se reemplazan los símbolos circulares por iconografía SVG moderna:

- Presencial: edificio institucional
- Telemática: videoconferencia
- Híbrida: dos entornos conectados

Los íconos se muestran tanto en la banda superior como en el badge de modalidad.

### Tarjetas
Las tarjetas ahora tienen:

- borde completo teñido según modalidad;
- franja lateral de 5 px;
- sombra suave de dos niveles;
- ligero brillo interior;
- fondos tintados muy sutiles;
- mayor separación vertical;
- interacción de presión/hover discreta.

La modalidad Híbrida mantiene su franja degradada violeta/teal.

### Legibilidad
Se aumentó el tamaño de:

- Presencial / Telemática / Híbrida
- badges
- estado
- hora
- título de actividad
- etiqueta Próxima / Finalizada
- señales del resumen ejecutivo
- textos pequeños de encabezado
- textos auxiliares de feriados

Las actividades finalizadas siguen atenuadas, pero mucho menos que antes.

## Sin cambios funcionales

No se modificaron:

- Google Sheet
- Code.gs
- Apps Script
- feriados
- voz
- selector de hora
- calendario
- eliminación y edición
- navegación móvil
- vista notebook

## Publicación

Reemplaza en GitHub:

- index.html
- styles.css
- app.js
- service-worker.js

También puedes subir el paquete completo para mantener todos los archivos sincronizados.

No es necesario volver a desplegar Code.gs.

Después de publicar, cierra completamente la PWA y vuelve a abrirla para renovar la caché.
