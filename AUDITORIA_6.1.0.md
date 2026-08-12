# Auditoría Agenda Presidenta 6.1.0 — voz asistida + recordatorios locales

## Base preservada

La versión parte de **Agenda Presidenta 6.0.11 Live Sync**.

`Code.gs` permanece byte por byte idéntico a 6.0.11.

- SHA-256 Code.gs 6.0.11: `1a8aa771086043f48647ce9c45e5c2a23de67f087ab61fdd8aaadfae666d274a`
- SHA-256 Code.gs 6.1.0: `1a8aa771086043f48647ce9c45e5c2a23de67f087ab61fdd8aaadfae666d274a`

No se modifica el esquema de Google Sheets ni la sincronización en vivo.

## Creación por voz

Se incorporó como **alternativa adicional** en `+ → Crear por voz`.
No reemplaza:

- Nueva actividad manual;
- micrófono del campo Actividad;
- micrófono de Buscar;
- feriados;
- edición/eliminación/cambio de estado.

### Campos interpretados

- Actividad
- Fecha
- Hora
- Modalidad
- Lugar
- Participantes
- Estado

El flujo no guarda automáticamente. Al soltar el botón abre el formulario normal
con los campos preparados para revisión.

## Pruebas de lenguaje

Se ejecutaron **30 frases positivas diferentes** cubriendo:

- fechas habladas, numéricas e ISO;
- hoy/mañana/pasado mañana/días de semana;
- horas numéricas y habladas;
- sin hora;
- Presencial, Telemática, Híbrida;
- Zoom, Teams y Google Meet;
- salas, oficinas, salón pleno, auditorio, tribunal y Corte;
- distintas formas de participantes;
- Confirmada, Por Confirmar, Pendiente, Cancelada y Ausente.

Resultado: **30/30 PASS**.

## Repetición Android/Chrome

Se reutilizó la capa anti-eco probada en Comunicaciones y se volvió a probar una
secuencia de hipótesis acumulativas crecientes.

Resultado final:

- Actividad: Reunión de pleno
- Fecha: 15/12/2026
- Hora: 15:00
- Modalidad: Presencial
- Lugar: Primera sala de la Corte
- Participantes: Todos los ministros
- Estado: Por Confirmar

Resultado: **PASS**.

La barrera anti-eco detectó correctamente el patrón antiguo repetitivo.

## Regla especial de ausencia

Se verificó expresamente que:

- `Curso de formación` → **NO** genera Ausente;
- `Permiso administrativo` → **NO** genera Ausente;
- `Feriado legal` → **NO** genera Ausente;
- `Viaje institucional` → **NO** genera Ausente;
- `Estado ausente` / `marcar como ausente` → sí genera **Ausente**.

Esto mantiene la regla de Presidenta: la visual de ausencia depende únicamente
de `ESTADO = Ausente`.

## Recordatorio local 15 minutos

Se incorporó la misma arquitectura local probada en Comunicaciones:

- Notification API;
- Service Worker;
- campana opt-in;
- no avisa actividades Canceladas;
- no avisa actividades sin hora;
- clave estable por fecha/hora/modalidad/actividad/lugar;
- deduplicación de avisos;
- reapertura al tocar la notificación.

Prueba de navegador:

- primer aviso: enviado;
- segundo barrido del mismo evento: no duplica;
- notificaciones registradas: 1;
- resultado: **PASS**.

### Limitación

Es un recordatorio local. No se garantiza si iOS o Android cierran/suspenden
completamente la PWA. **OneSignal no se incorpora en esta versión**, conforme a
la decisión de mantener por ahora el sistema ya probado.

## Regresión de interfaz y funciones

Prueba móvil Chromium 390×844:

- eventos demo cargados: 5;
- campana visible: PASS;
- `Nueva actividad`: PASS;
- `Crear por voz`: PASS;
- `Agregar feriado`: PASS;
- formulario por voz llenó correctamente todos los campos: PASS;
- calendario: PASS;
- buscar: PASS;
- tema claro/oscuro: PASS;
- errores JavaScript de página: 0.

También se verificó:

- IDs HTML duplicados: 0;
- sintaxis `app.js`: PASS;
- sintaxis `voice-create.js`: PASS;
- sintaxis `voice-session.js`: PASS;
- sintaxis `voice-press.js`: PASS;
- sintaxis `service-worker.js`: PASS;
- sintaxis `Code.gs`: PASS;
- todos los recursos del shell PWA existen: PASS.

## Compatibilidad móvil

El diseño es multiplataforma. La capa de voz mantiene las protecciones de iPhone
ya existentes y el gesto Push-to-Talk no depende de Android. La prueba física
definitiva de reconocimiento sigue dependiendo del motor de voz que entregue
cada navegador/dispositivo.
