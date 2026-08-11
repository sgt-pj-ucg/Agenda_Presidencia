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
const HOLIDAY_REVIEW_HANDLER = 'revisionAutomaticaFeriados';
const HOLIDAY_REVIEW_START_MONTH = 12;
const HOLIDAY_REVIEW_END_DAY_JANUARY = 15;
const HOLIDAY_REVIEW_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const HOLIDAY_NEWS_PAGES_TO_SCAN = 8;
const HOLIDAY_OFFICIAL_SOURCE_BASE = 'https://www.gob.cl';

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
  try { ensureHolidayReviewTrigger_(); } catch (_) {}
  try { reviewOfficialHolidaysIfDue_(); } catch (_) {}

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
  return /^Gobierno de Chile ·/i.test(clean_(source));
}

function normalizeHolidayType_(value) {
  const type = clean_(value);
  if (['Feriado nacional', 'Feriado regional', 'Feriado electoral'].indexOf(type) > -1) return type;
  return 'Feriado nacional';
}

function defaultHolidayScope_(type) {
  return type === 'Feriado regional' ? 'Región de Coquimbo' : 'Nacional';
}


/**
 * Revisión automática de feriados nacionales.
 *
 * Seguridad:
 * - Solo consulta gob.cl.
 * - Solo trabaja en diciembre y hasta el 15 de enero.
 * - Excluye expresamente feriados electorales.
 * - Corta la lectura antes de las secciones regionales/comunales.
 * - Exige una nómina completa y varios feriados nacionales "ancla"
 *   antes de escribir en la planilla.
 */
function revisionAutomaticaFeriados() {
  return reviewOfficialHolidaysIfDue_(true);
}

function instalarRevisionAutomaticaFeriados() {
  ensureHolidayReviewTrigger_(true);
  return reviewOfficialHolidaysIfDue_(true);
}

function probarRevisionFeriados() {
  return reviewOfficialHolidaysIfDue_(true, true);
}

function ensureHolidayReviewTrigger_(force) {
  const props = PropertiesService.getScriptProperties();
  const lastAudit = Number(props.getProperty('HOLIDAY_TRIGGER_LAST_AUDIT') || 0);
  if (!force && lastAudit && Date.now() - lastAudit < 30 * 24 * 60 * 60 * 1000) return;

  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === HOLIDAY_REVIEW_HANDLER;
  });

  if (!exists) {
    ScriptApp.newTrigger(HOLIDAY_REVIEW_HANDLER)
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
  }

  props.setProperty('HOLIDAY_TRIGGER_LAST_AUDIT', String(Date.now()));
}

function reviewOfficialHolidaysIfDue_(force, allowOutsideWindow) {
  const now = new Date();
  const targetYear = holidayReviewTargetYear_(now, allowOutsideWindow);
  if (!targetYear) {
    return { ok: true, action: 'revision_feriados', estado: 'fuera_de_ventana' };
  }

  const props = PropertiesService.getScriptProperties();
  const lastCheckKey = 'HOLIDAY_LAST_CHECK_' + targetYear;
  const lastCheck = Number(props.getProperty(lastCheckKey) || 0);

  if (!force && lastCheck && Date.now() - lastCheck < HOLIDAY_REVIEW_MIN_INTERVAL_MS) {
    return {
      ok: true,
      action: 'revision_feriados',
      estado: 'espera',
      year: targetYear
    };
  }

  props.setProperty(lastCheckKey, String(Date.now()));

  const sheet = ensureHolidaySheet_();
  if (hasCompleteProtectedHolidayYear_(sheet, targetYear)) {
    props.setProperty('HOLIDAY_LAST_SUCCESS_' + targetYear, String(Date.now()));
    return {
      ok: true,
      action: 'revision_feriados',
      estado: 'ya_actualizado',
      year: targetYear
    };
  }

  const articleUrl = findOfficialHolidayArticleUrl_(targetYear);
  if (!articleUrl) {
    return {
      ok: true,
      action: 'revision_feriados',
      estado: 'sin_publicacion_oficial',
      year: targetYear
    };
  }

  const articleHtml = fetchOfficialGobCl_(articleUrl);
  const holidays = parseOfficialHolidayArticle_(articleHtml, targetYear);

  validateOfficialHolidaySet_(holidays, targetYear);

  upsertOfficialNationalHolidays_(sheet, holidays, targetYear, articleUrl);

  props.setProperty('HOLIDAY_LAST_SUCCESS_' + targetYear, String(Date.now()));
  props.setProperty('HOLIDAY_LAST_SOURCE_' + targetYear, articleUrl);

  return {
    ok: true,
    action: 'revision_feriados',
    estado: 'actualizado',
    year: targetYear,
    cantidad: holidays.length,
    fuente: articleUrl
  };
}

function holidayReviewTargetYear_(date, allowOutsideWindow) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  if (allowOutsideWindow) return year + 1;
  if (month === 12) return year + 1;
  if (month === 1 && day <= HOLIDAY_REVIEW_END_DAY_JANUARY) return year;
  return 0;
}

function findOfficialHolidayArticleUrl_(targetYear) {
  for (let page = 1; page <= HOLIDAY_NEWS_PAGES_TO_SCAN; page++) {
    const html = fetchOfficialGobCl_(HOLIDAY_OFFICIAL_SOURCE_BASE + '/noticias/?p=' + page);
    const links = extractGobClNewsLinks_(html);

    for (let index = 0; index < links.length; index++) {
      const url = links[index];
      const slug = decodeURIComponent(url).toLowerCase();
      const mentionsYear = slug.indexOf(String(targetYear)) > -1;
      const looksHolidayRelated =
        slug.indexOf('feriad') > -1 ||
        slug.indexOf('festiv') > -1 ||
        slug.indexOf('calendario') > -1;

      if (mentionsYear && looksHolidayRelated) {
        const candidateHtml = fetchOfficialGobCl_(url);
        const text = normalizeArticleText_(candidateHtml).toLowerCase();

        if (
          text.indexOf(String(targetYear)) > -1 &&
          text.indexOf('feriad') > -1 &&
          (
            text.indexOf('calendario') > -1 ||
            text.indexOf('días festivos') > -1 ||
            text.indexOf('dias festivos') > -1
          )
        ) {
          try {
            const parsed = parseOfficialHolidayArticle_(candidateHtml, targetYear);
            validateOfficialHolidaySet_(parsed, targetYear);
            return url;
          } catch (_) {
            // No es la nómina anual completa; se continúa buscando.
          }
        }
      }
    }
  }

  return '';
}

function extractGobClNewsLinks_(html) {
  const links = [];
  const seen = {};
  const regex = /href=["']([^"']*\/noticias\/[^"'?#]+\/?)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = decodeHtmlEntities_(match[1]);
    if (url.indexOf('http') !== 0) {
      if (url.charAt(0) !== '/') url = '/' + url;
      url = HOLIDAY_OFFICIAL_SOURCE_BASE + url;
    }

    if (url.indexOf(HOLIDAY_OFFICIAL_SOURCE_BASE + '/noticias/') !== 0) continue;
    if (seen[url]) continue;

    seen[url] = true;
    links.push(url);
  }

  return links;
}

function fetchOfficialGobCl_(url) {
  if (url.indexOf(HOLIDAY_OFFICIAL_SOURCE_BASE) !== 0) {
    throw new Error('Fuente no autorizada para feriados.');
  }

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Agenda-Presidenta-Feriados/1.0'
    }
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Gob.cl respondió con código ' + status + '.');
  }

  return response.getContentText('UTF-8');
}

function parseOfficialHolidayArticle_(html, targetYear) {
  const nationalEnd = firstArticleBoundary_(html);
  const nationalHtml = nationalEnd > -1 ? html.substring(0, nationalEnd) : html;
  const items = [];
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liRegex.exec(nationalHtml)) !== null) {
    const text = normalizeArticleText_(match[1]);
    const item = parseHolidayListItem_(text, targetYear);
    if (item) items.push(item);
  }

  // Algunos cambios de plantilla pueden convertir la lista en párrafos.
  if (items.length < 10) {
    const text = normalizeArticleText_(nationalHtml);
    const lines = text.split(/\n+/);
    lines.forEach(function(line) {
      const item = parseHolidayListItem_(line, targetYear);
      if (item) items.push(item);
    });
  }

  const unique = {};
  items.forEach(function(item) {
    unique[item.fecha] = item;
  });

  return Object.keys(unique)
    .sort(function(a, b) {
      const da = normalizeDateToComparable_(a);
      const db = normalizeDateToComparable_(b);
      return da - db;
    })
    .map(function(key) { return unique[key]; });
}

function firstArticleBoundary_(html) {
  const lower = html.toLowerCase();
  const markers = [
    'feriados regionales',
    'feriados especiales',
    'feriados comunales',
    'festivos regionales',
    'días festivos regionales',
    'dias festivos regionales'
  ];

  let found = -1;
  markers.forEach(function(marker) {
    const index = lower.indexOf(marker);
    if (index > -1 && (found === -1 || index < found)) found = index;
  });

  return found;
}

function parseHolidayListItem_(text, targetYear) {
  const normalized = clean_(text)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');

  const match = normalized.match(
    /^(?:(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*:\s*(.+)$/i
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = chileMonthNumber_(match[2]);
  if (!month) return null;

  let name = clean_(match[3]);

  // Si una fecha combina un feriado tradicional con una elección,
  // se conserva solo la parte nacional tradicional.
  name = name.replace(/\s+(?:y|\/|-)\s+Elecciones.*$/i, '').trim();

  // Elecciones puras jamás se importan automáticamente.
  if (/^elecci[oó]n|^elecciones|primarias|segunda vuelta/i.test(name)) return null;

  // Indicadores jurídicos/comerciales no forman parte del nombre.
  name = name
    .replace(/\s*\((?:irrenunciable|feriado legal|obligatorio(?: e irrenunciable)?)\)\s*$/i, '')
    .trim();

  if (!name) return null;

  const date = pad2_(day) + '/' + pad2_(month) + '/' + targetYear;

  return {
    fecha: date,
    nombre: name
  };
}

function validateOfficialHolidaySet_(holidays, targetYear) {
  if (!Array.isArray(holidays) || holidays.length < 12) {
    throw new Error('La publicación encontrada no contiene una nómina nacional completa.');
  }

  const dates = {};
  holidays.forEach(function(item) {
    if (!item.fecha || !item.nombre) throw new Error('Feriado oficial incompleto.');
    if (Number(item.fecha.slice(-4)) !== Number(targetYear)) {
      throw new Error('El calendario oficial no corresponde al año esperado.');
    }
    dates[item.fecha.substring(0, 5)] = true;
  });

  const anchors = [
    '01/01',
    '01/05',
    '21/05',
    '16/07',
    '15/08',
    '18/09',
    '19/09',
    '01/11',
    '08/12',
    '25/12'
  ];

  const anchorCount = anchors.filter(function(key) { return dates[key]; }).length;
  if (anchorCount < 8) {
    throw new Error('La publicación no supera la validación de feriados nacionales.');
  }
}

function hasCompleteProtectedHolidayYear_(sheet, year) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, HOLIDAY_COLUMN_COUNT).getDisplayValues();
  const protectedNational = values.filter(function(row) {
    return normalizeDate_(row[0]).slice(-4) === String(year) &&
      normalizeHolidayType_(row[2]) === 'Feriado nacional' &&
      isProtectedHolidaySource_(row[5]) &&
      parseActive_(row[4]);
  });

  return protectedNational.length >= 12;
}

function upsertOfficialNationalHolidays_(sheet, holidays, year, sourceUrl) {
  const source = 'Gobierno de Chile · calendario oficial ' + year + ' · ' + sourceUrl;
  const lastRow = sheet.getLastRow();
  const existing = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, HOLIDAY_COLUMN_COUNT).getDisplayValues()
    : [];

  const dateToRow = {};
  existing.forEach(function(row, index) {
    const date = normalizeDate_(row[0]);
    const type = normalizeHolidayType_(row[2]);
    if (date && type === 'Feriado nacional') {
      dateToRow[date] = index + 2;
    }
  });

  holidays.forEach(function(item) {
    const date = normalizeDate_(item.fecha);
    const rowNumber = dateToRow[date];

    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, HOLIDAY_COLUMN_COUNT).setValues([[
        date,
        item.nombre,
        'Feriado nacional',
        'Nacional',
        'Sí',
        source
      ]]);
      sheet.getRange(rowNumber, 1).setNumberFormat('dd/MM/yyyy');
    } else {
      const newRow = Math.max(sheet.getLastRow() + 1, 2);
      sheet.getRange(newRow, 1, 1, HOLIDAY_COLUMN_COUNT).setValues([[
        date,
        item.nombre,
        'Feriado nacional',
        'Nacional',
        'Sí',
        source
      ]]);
      sheet.getRange(newRow, 1).setNumberFormat('dd/MM/yyyy');
      dateToRow[date] = newRow;
    }
  });

  SpreadsheetApp.flush();
}

function normalizeArticleText_(html) {
  return decodeHtmlEntities_(
    String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function decodeHtmlEntities_(text) {
  return String(text || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ');
}

function chileMonthNumber_(name) {
  const key = clean_(name).toLowerCase();
  const months = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12
  };
  return months[key] || 0;
}

function pad2_(value) {
  return ('0' + Number(value)).slice(-2);
}

function normalizeDateToComparable_(value) {
  const parts = normalizeDate_(value).split('/').map(Number);
  return parts.length === 3
    ? new Date(parts[2], parts[1] - 1, parts[0]).getTime()
    : 0;
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
