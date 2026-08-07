# Agenda Presidenta 6.0.6 — administración de feriados

## Política

- Los feriados nacionales oficiales de 2026 permanecen incorporados y protegidos.
- 2027 y años siguientes se incorporan cuando exista confirmación oficial.
- Los feriados regionales y electorales no se agregan automáticamente.
- Cualquier feriado extraordinario puede registrarse manualmente desde la aplicación.

## Botón +

El botón central ahora abre:

- Nueva actividad
- Agregar feriado

## Formulario de feriado

Permite registrar:

- Fecha
- Nombre oficial
- Tipo: nacional, regional o electoral
- Alcance
- Fuente oficial o referencia

Los registros se guardan en la pestaña `FERIADOS_CHILE`.

## Editar y eliminar

Los feriados agregados manualmente pueden editarse o eliminarse al seleccionar el día en el calendario.

Los feriados del calendario oficial 2026 muestran `Oficial protegido` y no pueden modificarse desde la app.

## Proceso recomendado cada diciembre

Cuando Gobierno de Chile publique oficialmente los feriados del año siguiente:

1. revisar la publicación oficial;
2. agregar mediante `+ > Agregar feriado` únicamente los feriados nacionales;
3. registrar el nombre oficial y, de ser posible, la fuente;
4. agregar regionales o electorales solo manualmente si corresponden.

## Instalación técnica

### GitHub
Reemplazar:
- index.html
- styles.css
- app.js
- service-worker.js
- manifest.webmanifest
- carpeta icons/

### Apps Script
Reemplazar el código por `Code.gs` y actualizar la implementación existente.

No cambies la URL de Apps Script si actualizas la misma implementación.
