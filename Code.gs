/**
 * Backend de Agenda Presidenta 6.0.5.
 * Desplegar como aplicación web ejecutada por el propietario.
 */
const SPREADSHEET_ID = '11rnA29bITAvP9WfydNIhMPBtCDo2ovnJt2SiOfMXI6w';
const SHEET_NAME = 'BOT DE AGENDA';
const HOLIDAY_SHEET_NAME = 'FERIADOS_CHILE';
const FIRST_DATA_ROW = 2;
const COLUMN_COUNT = 8;
const HOLIDAY_COLUMN_COUNT = 6;

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.accion || 'ping').toLowerCase();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
    let result;

    switch (action) {
      case 'feriados':
        result = getHolidays_();
        break;

      case 'feriado_nuevo':
        result = createHoliday_(params);
        break;

      case 'feriado_editar':
        result = updateHoliday_(params);
        break;

      case 'feriado_eliminar':
        result = deleteHoliday_(params);
        break;

      case 'nueva': {
        const sheet = getAgendaSheet_();
        result = createEvent_(sheet, params);
        break;
      }

      case 'estado': {
        const sheet = getAgendaSheet_();
        result = updateStatus_(sheet, params);
        break;
      }

      case 'editar': {
        const sheet = getAgendaSheet_();
        result = updateEvent_(sheet, params);
        break;
      }

      case 'eliminar': {
        const sheet = getAgendaSheet_();
        result = deleteEvent_(sheet, params);
        break;
      }

      case 'ping':
        result = { ok: true, action: 'ping', message: 'Agenda Presidenta API activa' };
        break;

      default:
        throw new Error('Acción no reconocida: ' + action);
    }

    return response_(result, params.callback);
  } catch (error) {
    return response_({ ok: false, action: action, error: error.message }, params.callback);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function createEvent_(sheet, params) {
  validateRequired_(params, ['fecha', 'actividad']);
  const nextRow = Math.max(sheet.getLastRow() + 1, FIRST_DATA_ROW);

  copyPreviousRowFormat_(sheet, nextRow);
  sheet.getRange(nextRow, 1, 1, COLUMN_COUNT).setValues([buildRow_(params)]);
  sheet.getRange(nextRow, 1).setNumberFormat('dd/MM/yyyy');

  SpreadsheetApp.flush();
  return { ok: true, action: 'nueva', row: nextRow };
}

function updateStatus_(sheet, params) {
  validateRequired_(params, ['estado']);
  const row = resolveRow_(sheet, params, true);
  sheet.getRange(row, 8).setValue(normalizeStatus_(params.estado));
  SpreadsheetApp.flush();
  return { ok: true, action: 'estado', row: row, estado: normalizeStatus_(params.estado) };
}

function updateEvent_(sheet, params) {
  validateRequired_(params, ['fecha', 'actividad']);

  const row = resolveRow_(sheet, {
    fila: params.fila,
    fecha: params.fechaOriginal || params.fecha,
    hora: params.horaOriginal || params.hora,
    actividad: params.actividadOriginal || params.actividad
  }, true);

  sheet.getRange(row, 1, 1, COLUMN_COUNT).setValues([buildRow_(params)]);
  sheet.getRange(row, 1).setNumberFormat('dd/MM/yyyy');

  SpreadsheetApp.flush();
  return { ok: true, action: 'editar', row: row };
}

function deleteEvent_(sheet, params) {
  const row = resolveRow_(sheet, params, true);
  sheet.deleteRow(row);
  SpreadsheetApp.flush();
  return { ok: true, action: 'eliminar', row: row };
}

function buildRow_(params) {
  return [
    normalizeDate_(params.fecha),
    clean_(params.dia) || dayName_(params.fecha),
    normalizeTime_(params.hora),
    normalizeModality_(params.modalidad),
    clean_(params.actividad),
    clean_(params.lugar),
    clean_(params.participantes),
    normalizeStatus_(params.estado)
  ];
}

function resolveRow_(sheet, params, verifyIdentity) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) throw new Error('La agenda no contiene actividades.');

  const requestedRow = Number(params.fila);
  if (
    Number.isInteger(requestedRow) &&
    requestedRow >= FIRST_DATA_ROW &&
    requestedRow <= lastRow
  ) {
    if (!verifyIdentity || rowMatches_(sheet, requestedRow, params)) return requestedRow;
  }

  const values = sheet
    .getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, COLUMN_COUNT)
    .getDisplayValues();

  const targetDate = normalizeDate_(params.fecha);
  const targetTime = normalizeTime_(params.hora);
  const targetActivity = normalizeText_(params.actividad);

  for (let index = 0; index < values.length; index++) {
    const rowDate = normalizeDate_(values[index][0]);
    const rowTime = normalizeTime_(values[index][2]);
    const rowActivity = normalizeText_(values[index][4]);

    if (
      rowDate === targetDate &&
      rowTime === targetTime &&
      rowActivity === targetActivity
    ) {
      return FIRST_DATA_ROW + index;
    }
  }

  throw new Error(
    'No fue posible localizar la actividad en la planilla. Actualiza la agenda e intenta nuevamente.'
  );
}

function rowMatches_(sheet, row, params) {
  const values = sheet.getRange(row, 1, 1, COLUMN_COUNT).getDisplayValues()[0];
  const checks = [];

  if (params.fecha) {
    checks.push(normalizeDate_(values[0]) === normalizeDate_(params.fecha));
  }
  if (params.hora !== undefined) {
    checks.push(normalizeTime_(values[2]) === normalizeTime_(params.hora));
  }
  if (params.actividad) {
    checks.push(normalizeText_(values[4]) === normalizeText_(params.actividad));
  }

  return checks.length === 0 || checks.every(function(value) { return value; });
}

function getHolidays_() {
  const sheet = ensureHolidaySheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { ok: true, action: 'feriados', feriados: [] };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HOLIDAY_COLUMN_COUNT).getDisplayValues();
  const holidays = values.map(function(row, index) {
    const source = clean_(row[5]);
    return {
      fila: index + 2,
      fecha: normalizeDate_(row[0]),
      nombre: clean_(row[1]),
      tipo: clean_(row[2]) || 'Feriado nacional',
      alcance: clean_(row[3]) || 'Nacional',
      activo: parseActive_(row[4]),
      fuente: source,
      protegido: isProtectedHolidaySource_(source)
    };
  }).filter(function(item) {
    return item.fecha && item.nombre && item.activo;
  });

  return { ok: true, action: 'feriados', feriados: holidays };
}

function createHoliday_(params) {
  validateRequired_(params, ['fecha', 'nombre']);
  const sheet = ensureHolidaySheet_();
  const date = normalizeDate_(params.fecha);
  const name = clean_(params.nombre);
  const type = normalizeHolidayType_(params.tipo);
  const scope = clean_(params.alcance) || defaultHolidayScope_(type);
  const source = clean_(params.fuente) || 'Registro manual desde Agenda Presidenta';

  if (findHolidayRow_(sheet, { fecha: date, nombre: name })) {
    throw new Error('Ese feriado ya se encuentra registrado.');
  }

  const row = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(row, 1, 1, HOLIDAY_COLUMN_COUNT).setValues([[date, name, type, scope, 'Sí', source]]);
  sheet.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
  SpreadsheetApp.flush();
  return { ok: true, action: 'feriado_nuevo', row: row };
}

function updateHoliday_(params) {
  validateRequired_(params, ['fecha', 'nombre']);
  const sheet = ensureHolidaySheet_();
  const row = resolveHolidayRow_(sheet, {
    fila: params.fila,
    fecha: params.fechaOriginal || params.fecha,
    nombre: params.nombreOriginal || params.nombre
  });

  assertHolidayEditable_(sheet, row);

  const date = normalizeDate_(params.fecha);
  const name = clean_(params.nombre);
  const type = normalizeHolidayType_(params.tipo);
  const scope = clean_(params.alcance) || defaultHolidayScope_(type);
  const source = clean_(params.fuente) || 'Registro manual desde Agenda Presidenta';

  sheet.getRange(row, 1, 1, HOLIDAY_COLUMN_COUNT).setValues([[date, name, type, scope, 'Sí', source]]);
  sheet.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
  SpreadsheetApp.flush();
  return { ok: true, action: 'feriado_editar', row: row };
}

function deleteHoliday_(params) {
  const sheet = ensureHolidaySheet_();
  const row = resolveHolidayRow_(sheet, params);
  assertHolidayEditable_(sheet, row);
  sheet.deleteRow(row);
  SpreadsheetApp.flush();
  return { ok: true, action: 'feriado_eliminar', row: row };
}

function resolveHolidayRow_(sheet, params) {
  const requested = Number(params.fila);
  const lastRow = sheet.getLastRow();

  if (Number.isInteger(requested) && requested >= 2 && requested <= lastRow && holidayRowMatches_(sheet, requested, params)) {
    return requested;
  }

  const found = findHolidayRow_(sheet, params);
  if (found) return found;
  throw new Error('No fue posible localizar el feriado en la planilla.');
}

function findHolidayRow_(sheet, params) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const targetDate = normalizeDate_(params.fecha);
  const targetName = normalizeText_(params.nombre);
  const values = sheet.getRange(2, 1, lastRow - 1, HOLIDAY_COLUMN_COUNT).getDisplayValues();

  for (let index = 0; index < values.length; index++) {
    const date = normalizeDate_(values[index][0]);
    const name = normalizeText_(values[index][1]);
    if (date === targetDate && (!targetName || name === targetName)) return index + 2;
  }

  return 0;
}

function holidayRowMatches_(sheet, row, params) {
  const values = sheet.getRange(row, 1, 1, HOLIDAY_COLUMN_COUNT).getDisplayValues()[0];
  if (params.fecha && normalizeDate_(values[0]) !== normalizeDate_(params.fecha)) return false;
  if (params.nombre && normalizeText_(values[1]) !== normalizeText_(params.nombre)) return false;
  return true;
}

function assertHolidayEditable_(sheet, row) {
  const source = clean_(sheet.getRange(row, 6).getDisplayValue());
  if (isProtectedHolidaySource_(source)) {
    throw new Error('Este feriado pertenece al calendario oficial protegido y no puede modificarse desde la aplicación.');
  }
}

function isProtectedHolidaySource_(source) {
  return /^Gobierno de Chile · calendario oficial 2026$/i.test(clean_(source));
}

function normalizeHolidayType_(value) {
  const type = clean_(value);
  if (['Feriado nacional', 'Feriado regional', 'Feriado electoral'].indexOf(type) > -1) return type;
  return 'Feriado nacional';
}

function defaultHolidayScope_(type) {
  return type === 'Feriado regional' ? 'Región de Coquimbo' : 'Nacional';
}

function ensureHolidaySheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(HOLIDAY_SHEET_NAME);
  if (sheet) return sheet;

  sheet = spreadsheet.insertSheet(HOLIDAY_SHEET_NAME);

  const headers = [['FECHA', 'NOMBRE', 'TIPO', 'ALCANCE', 'ACTIVO', 'FUENTE']];
  const official2026 = [
    ['01/01/2026', 'Año Nuevo', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['03/04/2026', 'Viernes Santo', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['04/04/2026', 'Sábado Santo', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['01/05/2026', 'Día del Trabajo', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['21/05/2026', 'Día de las Glorias Navales', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['21/06/2026', 'Día Nacional de los Pueblos Indígenas', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['29/06/2026', 'San Pedro y San Pablo', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['16/07/2026', 'Día de la Virgen del Carmen', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['15/08/2026', 'Asunción de la Virgen', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['18/09/2026', 'Independencia Nacional', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['19/09/2026', 'Día de las Glorias del Ejército', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['12/10/2026', 'Encuentro de Dos Mundos', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['31/10/2026', 'Día Nacional de las Iglesias Evangélicas', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['01/11/2026', 'Día de Todos los Santos', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['08/12/2026', 'Inmaculada Concepción', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026'],
    ['25/12/2026', 'Navidad', 'Feriado nacional', 'Nacional', 'Sí', 'Gobierno de Chile · calendario oficial 2026']
  ];

  sheet.getRange(1, 1, 1, HOLIDAY_COLUMN_COUNT).setValues(headers);
  sheet.getRange(2, 1, official2026.length, HOLIDAY_COLUMN_COUNT).setValues(official2026);
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy');
  sheet.autoResizeColumns(1, HOLIDAY_COLUMN_COUNT);

  return sheet;
}

function getAgendaSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('No existe la pestaña "' + SHEET_NAME + '".');
  }

  return sheet;
}

function copyPreviousRowFormat_(sheet, targetRow) {
  if (targetRow <= FIRST_DATA_ROW) return;

  sheet.getRange(targetRow - 1, 1, 1, COLUMN_COUNT)
    .copyFormatToRange(sheet, 1, COLUMN_COUNT, targetRow, targetRow);
}

function validateRequired_(params, fields) {
  fields.forEach(function(field) {
    if (!clean_(params[field])) {
      throw new Error('Falta el parámetro obligatorio: ' + field);
    }
  });
}

function normalizeDate_(value) {
  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || 'America/Santiago',
      'dd/MM/yyyy'
    );
  }

  const text = clean_(value);
  if (!text) return '';

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  let day;
  let month;
  let year;

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\D|$)/);
    if (!match) return text.toLowerCase().replace(/\s+/g, ' ');

    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(year, month - 1, day);

  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return ('0' + day).slice(-2) + '/' +
    ('0' + month).slice(-2) + '/' +
    year;
}

function normalizeTime_(value) {
  const match = clean_(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';

  return ('0' + hour).slice(-2) + ':' + ('0' + minute).slice(-2);
}

function normalizeText_(value) {
  return clean_(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeModality_(value) {
  const text = clean_(value);
  const lower = text.toLowerCase();

  if (
    lower.indexOf('zoom') > -1 ||
    lower.indexOf('telem') > -1 ||
    lower.indexOf('virtual') > -1
  ) return 'Telemática';

  if (lower.indexOf('híbr') > -1 || lower.indexOf('hibr') > -1) {
    return 'Híbrida';
  }

  if (lower.indexOf('presencial') > -1) return 'Presencial';
  return text || 'Otro';
}

function normalizeStatus_(value) {
  const text = clean_(value);
  const lower = text.toLowerCase();

  if (lower === 'por confirmar') return 'Por Confirmar';
  if (lower === 'pendiente') return 'Pendiente';
  if (lower === 'ausente' || lower === 'ausencia') return 'Ausente';
  if (lower === 'cancelada' || lower === 'cancelado') return 'Cancelada';

  return text || 'Confirmada';
}

function dayName_(dateText) {
  const normalized = normalizeDate_(dateText);
  const parts = normalized.split('/').map(Number);

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return '';

  const days = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
  ];

  return days[new Date(parts[2], parts[1] - 1, parts[0]).getDay()];
}

function parseActive_(value) {
  const normalized = clean_(value).toLowerCase();
  return ['no', 'false', '0', 'inactivo'].indexOf(normalized) === -1;
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function response_(payload, callback) {
  const json = JSON.stringify(payload);
  const callbackName = clean_(callback);

  if (
    callbackName &&
    /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callbackName)
  ) {
    return ContentService
      .createTextOutput(callbackName + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
