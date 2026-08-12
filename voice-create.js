/* Agenda Presidenta 6.1.0 · intérprete flexible de creación por voz */
(function(global){
'use strict';

const MONTHS={
  enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
  julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12
};
const WEEKDAYS={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};
const SMALL={
  cero:0,un:1,uno:1,una:1,primero:1,primera:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,
  diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,
  veinte:20,veintiuno:21,veintiun:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,
  veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,treintauno:31
};
const NUMBER_TOKEN = '(?:primero|primera|una|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta(?:\\s+y\\s+(?:uno|un|una))?|\\d{1,2})';
const MINUTE_TOKEN = '(?:media|cuarto|diez|quince|veinte|veinticinco|treinta(?:\\s+y\\s+(?:cinco))?|cuarenta(?:\\s+y\\s+(?:cinco))?|cincuenta(?:\\s+y\\s+(?:cinco))?|'+NUMBER_TOKEN+')';
const YEAR_TOKEN = '(?:20\\d{2}|dos\\s+mil(?:\\s+(?:veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta(?:\\s+y\\s+(?:uno|dos|tres|cuatro|cinco))?))?)';

function foldAligned(value=''){
  return String(value)
    .toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/ñ/g,'n');
}
function fold(value=''){ return foldAligned(value).replace(/\s+/g,' ').trim(); }
function cap(value=''){
  const s=String(value||'').trim();
  return s?s.charAt(0).toUpperCase()+s.slice(1):'';
}
function pad2(n){return String(Number(n)).padStart(2,'0');}
function validDate(y,m,d){
  const x=new Date(y,m-1,d);
  return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null;
}
function dateKey(d){return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;}
function spanResult(raw,match,extra={}){
  if(!match) return {...extra,match:'',span:null};
  return {...extra,match:raw.slice(match.index,match.index+match[0].length),span:[match.index,match.index+match[0].length]};
}
function parseSmallNumber(value){
  const t=fold(value).replace(/\s+/g,' ');
  if(/^\d+$/.test(t)) return Number(t);
  if(SMALL[t]!==undefined) return SMALL[t];
  const m=t.match(/^(treinta|cuarenta|cincuenta)\s+y\s+(uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)$/);
  if(m){const tens={treinta:30,cuarenta:40,cincuenta:50};return tens[m[1]]+(SMALL[m[2]]??0);}
  return NaN;
}
function parseYear(value,currentYear){
  const t=fold(value);
  if(!t) return currentYear;
  if(/^20\d{2}$/.test(t)) return Number(t);
  if(t==='dos mil') return 2000;
  const m=t.match(/^dos mil(?:\s+(.+))?$/);
  if(!m) return currentYear;
  const n=parseSmallNumber(m[1]||'');
  return Number.isFinite(n)?2000+n:currentYear;
}

function parseDate(text,now=new Date()){
  const raw=String(text||''), a=foldAligned(raw), today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let m;

  // Primero fechas explícitas. Así "de la mañana" nunca se interpreta como "mañana".
  m=/(?:\b(?:para\s+)?(?:el\s+)?(?:dia\s+)?)\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(a);
  if(m){
    const d=validDate(Number(m[1]),Number(m[2]),Number(m[3]));
    if(d) return spanResult(raw,m,{date:d});
  }

  m=/(?:\b(?:para\s+)?(?:el\s+)?(?:dia\s+)?)\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](20\d{2}))?\b/.exec(a);
  if(m){
    let y=m[3]?Number(m[3]):today.getFullYear();
    let d=validDate(y,Number(m[2]),Number(m[1]));
    if(d&&d<today&&!m[3]) d=validDate(y+1,Number(m[2]),Number(m[1]));
    if(d) return spanResult(raw,m,{date:d});
  }

  const months=Object.keys(MONTHS).join('|');
  const monthRe=new RegExp(`\\b(?:para\\s+)?(?:el\\s+)?(?:dia\\s+)?(${NUMBER_TOKEN})\\s+(?:de\\s+)?(${months})(?:\\s+(?:(?:de|del)\\s+)?(${YEAR_TOKEN}))?\\b`);
  m=monthRe.exec(a);
  if(m){
    const day=parseSmallNumber(m[1]), month=MONTHS[m[2]];
    let year=parseYear(m[3],today.getFullYear());
    let d=validDate(year,month,day);
    if(d&&d<today&&!m[3]) d=validDate(year+1,month,day);
    if(d) return spanResult(raw,m,{date:d});
  }

  // Fechas relativas.
  m=/\b(?:para\s+)?pasado\s+manana\b/.exec(a);
  if(m){const d=new Date(today);d.setDate(d.getDate()+2);return spanResult(raw,m,{date:d});}
  m=/\b(?:para\s+)?manana\b/.exec(a);
  if(m){
    const prefix=a.slice(Math.max(0,m.index-7),m.index);
    if(!/\b(?:la|de\s+la)\s*$/.test(prefix)){
      const d=new Date(today);d.setDate(d.getDate()+1);return spanResult(raw,m,{date:d});
    }
  }
  m=/\b(?:para\s+)?hoy\b/.exec(a);
  if(m) return spanResult(raw,m,{date:today});

  const weekdayNames=Object.keys(WEEKDAYS).join('|');
  const weekdayRe=new RegExp(`\\b(?:para\\s+)?(?:el\\s+)?(?:(proximo|proxima|este|esta)\\s+)?(${weekdayNames})\\b`);
  m=weekdayRe.exec(a);
  if(m){
    const qualifier=m[1]||'', wd=m[2], target=WEEKDAYS[wd];
    let delta=(target-today.getDay()+7)%7;
    if(/proxim/.test(qualifier)&&delta===0) delta=7;
    if(!qualifier&&delta===0) delta=7;
    const d=new Date(today);d.setDate(d.getDate()+delta);
    return spanResult(raw,m,{date:d});
  }
  return {date:null,match:'',span:null};
}
function parseTime(text){
  const raw=String(text||''), a=foldAligned(raw);
  let m;
  const applyPeriod=(hour,period)=>{
    let h=Number(hour);
    const p=period||'';
    if(/tarde|noche|pm|p\s*m/.test(p)&&h<12) h+=12;
    if(/manana|am|a\s*m/.test(p)&&h===12) h=0;
    return h;
  };

  if(/\bsin\s+hora\b/.test(a)){
    m=/\bsin\s+hora\b/.exec(a);
    return spanResult(raw,m,{time:'',explicitNoTime:true});
  }

  m=/\b(?:a\s+las?|a\s+la|hora\s*)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche|del\s+dia|am|pm|a\s*m|p\s*m))?\b/.exec(a);
  if(m){
    const h=applyPeriod(m[1],m[3]);
    if(h>=0&&h<=23) return spanResult(raw,m,{time:`${pad2(h)}:${pad2(m[2])}`,explicitNoTime:false});
  }

  m=/\b(?:a\s+las?|a\s+la)\s+([01]?\d|2[0-3])\s+([0-5]\d)(?:\s*(?:horas?|hrs?))?(?:\s*(de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche|del\s+dia|am|pm|a\s*m|p\s*m))?\b/.exec(a);
  if(m){
    const h=applyPeriod(m[1],m[3]);
    if(h>=0&&h<=23) return spanResult(raw,m,{time:`${pad2(h)}:${pad2(m[2])}`,explicitNoTime:false});
  }

  m=/\b(?:a\s+las?|a\s+la)?\s*([01]?\d|2[0-3])\s*(?:horas?|hrs?)(?:\s*(?:con|y)?\s*([0-5]?\d)\s*(?:minutos?|min)?)?(?:\s*(de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche|del\s+dia|am|pm|a\s*m|p\s*m))?\b/.exec(a);
  if(m){
    const h=applyPeriod(m[1],m[3]);
    if(h>=0&&h<=23) return spanResult(raw,m,{time:`${pad2(h)}:${pad2(m[2]||0)}`,explicitNoTime:false});
  }

  const wordsRe=new RegExp(`\\b(?:a\\s+las?|a\\s+la)\\s+(${NUMBER_TOKEN})(?:\\s+(?:horas?))?(?:\\s*(?:con|y)?\\s*(${MINUTE_TOKEN})(?:\\s*(?:minutos?|min))?)?(?:\\s+(de\\s+la\\s+manana|de\\s+la\\s+tarde|de\\s+la\\s+noche|del\\s+dia|am|pm|a\\s*m|p\\s*m))?\\b`);
  m=wordsRe.exec(a);
  if(m){
    let h=parseSmallNumber(m[1]), min=0;
    if(m[2]){
      min=m[2]==='media'?30:m[2]==='cuarto'?15:parseSmallNumber(m[2]);
    }
    h=applyPeriod(h,m[3]);
    if(Number.isFinite(h)&&h>=0&&h<=23&&Number.isFinite(min)&&min>=0&&min<=59){
      return spanResult(raw,m,{time:`${pad2(h)}:${pad2(min)}`,explicitNoTime:false});
    }
  }
  // Forma conversacional sin “a las”: “mañana nueve treinta”, “once cuarenta y cinco”.
  const bareWordsRe=new RegExp(`\\b(${NUMBER_TOKEN})\\s+(${MINUTE_TOKEN})\\b`);
  m=bareWordsRe.exec(a);
  if(m){
    let h=parseSmallNumber(m[1]), min=m[2]==='media'?30:m[2]==='cuarto'?15:parseSmallNumber(m[2]);
    if(Number.isFinite(h)&&h>=0&&h<=23&&Number.isFinite(min)&&min>=0&&min<=59){
      return spanResult(raw,m,{time:`${pad2(h)}:${pad2(min)}`,explicitNoTime:false});
    }
  }
  return {time:'',match:'',span:null,explicitNoTime:false};
}
function parseModality(text){
  const raw=String(text||''), a=foldAligned(raw);
  const patterns=[
    ['Telemática',/\b(?:(?:modalidad|modo)\s+)?(?:telematica|virtual|remota|por\s+videoconferencia)\b/],
    ['Híbrida',/\b(?:(?:modalidad|modo)\s+)?(?:hibrida|mixta)\b/],
    ['Presencial',/\b(?:(?:modalidad|modo)\s+)?presencial\b/],
    ['Otro',/\b(?:modalidad|modo)\s+otro\b/]
  ];
  for(const [modality,re] of patterns){
    const m=re.exec(a);if(m)return spanResult(raw,m,{modality});
  }

  // Inferencia segura solo para plataformas de conexión explícitas.
  if(/\b(?:zoom|google\s+meet|microsoft\s+teams|teams|meet)\b/.test(a)){
    return {modality:'Telemática',match:'',span:null,inferred:true};
  }

  return {modality:'Presencial',match:'',span:null,inferred:false};
}
function parseStatus(text){
  const raw=String(text||''), a=foldAligned(raw);
  const patterns=[
    ['Por Confirmar',/\b(?:(?:estado|queda|dejar|dejala|marcar(?:\s+como)?)\s+)?(?:por\s+confirmar|a\s+confirmar)\b/],
    ['Pendiente',/\b(?:estado\s+)?pendiente\b/],
    ['Cancelada',/\b(?:estado\s+)?cancelad[oa]\b/],
    // Regla Presidenta: Ausente únicamente cuando el dictado lo expresa como ESTADO.
    // No se infiere por palabras como curso, permiso, comisión, feriado o viaje.
    ['Ausente',/\b(?:estado\s+ausente|estado\s+de\s+ausencia|marcar(?:\s+como)?\s+ausente|queda\s+ausente)\b/],
    ['Confirmada',/\b(?:(?:estado|queda|dejar|dejala|marcar(?:\s+como)?)\s+)?confirmad[oa]\b/]
  ];
  for(const [status,re] of patterns){
    const m=re.exec(a);if(m)return spanResult(raw,m,{status});
  }
  return {status:'Por Confirmar',match:'',span:null};
}
function parseLocation(text){
  const raw=String(text||''), a=foldAligned(raw);
  const stop='(?=\\s*(?:,|\\.|;|$)|\\s+(?:particip(?:aran|an|a|ara|ar)?|participantes?|asist(?:iran|en|e|ira|entes?)?|van\\s+a\\s+participar|con\\s+participacion|con\\s+asistencia|con\\s+(?:todos?|todas?)\\s+(?:los|las)|junto\\s+a|a\\s+cargo|responsables?|estado|tipo|confirmad[oa]|por\\s+confirmar|pendiente|cancelad[oa]|para\\s+redes|redes\\s+sociales|boletin)\\b)';
  const ordinal='(?:(?:la\\s+)?(?:primera|segunda|tercera|cuarta|quinta|sexta|septima|octava|novena|decima)\\s+)?';
  const placeKind='(?:sala|oficina|salon|auditorio|tribunal|corte|radio|edificio|plaza|dependencias?|ciudad|hall|patio|biblioteca)';
  const patterns=[
    new RegExp(`\\b(?:ubicad[oa]\\s+en|ubicacion\\s*:?|lugar\\s*:?|lugar\\s+en|se\\s+realizara\\s+en|sera\\s+en)\\s+(.+?)${stop}`),
    new RegExp(`\\ben\\s+((?:la\\s+)?${ordinal}${placeKind}\\b.*?)${stop}`),
    /\b((?:por|via)\s+(?:zoom|meet|teams)|zoom|google\s+meet|microsoft\s+teams)\b/
  ];
  for(const re of patterns){
    const m=re.exec(a);
    if(!m) continue;
    const captured=m[1]||m[0];
    const offset=m[0].indexOf(captured);
    let value=raw.slice(m.index+Math.max(0,offset),m.index+Math.max(0,offset)+captured.length).trim();
    value=value.replace(/^(?:en|por|vía|via)\s+/i,'').replace(/[.,;]+$/,'').trim();
    return spanResult(raw,m,{location:cap(value)});
  }
  return {location:'',match:'',span:null};
}

function parsePeople(text){
  const raw=String(text||''), a=foldAligned(raw);
  const stop='(?=\\s*(?:,|\\.|;|$)|\\s+(?:estado|tipo|ubicad[oa]|ubicacion|lugar|por\\s+confirmar|confirmad[oa]|pendiente|cancelad[oa]|para\\s+redes|redes\\s+sociales|boletin)\\b)';
  const patterns=[
    new RegExp(`\\b(?:participaran|participan|participa|asistiran|asisten|asiste|asistentes?|van\\s+a\\s+participar|con\\s+participacion\\s+de|con\\s+asistencia\\s+de|junto\\s+a|participantes?\\s*:?|a\\s+cargo\\s+de|responsables?\\s*:?)\\s+(.+?)${stop}`),
    new RegExp(`\\bcon\\s+((?:todos?|todas?)\\s+(?:los|las)\\s+[a-zñ]+(?:\\s+[a-zñ]+){0,5}|mm(?:\\s+y\\s+|,\\s*)ph|ph(?:\\s+y\\s+|,\\s*)mm)${stop}`)
  ];
  for(const re of patterns){
    const m=re.exec(a);if(!m)continue;
    const captured=m[1]||'';const offset=m[0].indexOf(captured);
    const value=raw.slice(m.index+Math.max(0,offset),m.index+Math.max(0,offset)+captured.length).replace(/[.,;]+$/,'').trim();
    return spanResult(raw,m,{people:cap(value)});
  }
  return {people:'',match:'',span:null};
}

function commandSpan(text){
  const raw=String(text||''), a=foldAligned(raw);
  const re=/^\s*(?:por\s+favor\s+)?(?:(?:quiero|necesito|puedes|podrias|favor\s+de)\s+)?(?:agendame|agenda(?:r)?|crea(?:r)?|programa(?:r)?|registra(?:r)?|anota(?:r)?|incorpora(?:r)?|nueva\s+actividad)\b\s*/;
  const m=re.exec(a);
  return m?[m.index,m.index+m[0].length]:null;
}

function isCreateIntent(text){
  const l=fold(text);
  if(/^(?:por favor\s+)?(?:agendame|crear?|crea|programa(?:r)?|registra(?:r)?|anota(?:r)?|incorpora(?:r)?|nueva actividad)\b/.test(l)) return true;
  if(!/^(?:por favor\s+)?agenda\b/.test(l)) return false;
  if(/^(?:por favor\s+)?agenda\s+(?:de|del)\b/.test(l)) return false;
  const object=/\b(?:actividad|reunion|entrevista|pleno|audiencia|visita|ceremonia|cuenta\s+publica|saludo|recepcion|comision|videoconferencia|reunion)\b/.test(l);
  const temporal=/\b(?:hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{1,2}[/.-]\d{1,2}|a\s+las?|a\s+la)\b/.test(l);
  return object&&temporal;
}

function cleanupDetail(raw,spans){
  const chars=Array.from(String(raw||''));
  for(const span of spans.filter(Boolean)){
    const [start,end]=span;
    for(let i=Math.max(0,start);i<Math.min(chars.length,end);i++) chars[i]=' ';
  }
  let s=chars.join('');
  s=s
    .replace(/\b(?:una|un|la|el)\s+actividad\b/ig,' ')
    .replace(/\bactividad\b/ig,' ')
    .replace(/\b(?:para\s+el\s+dia|para\s+el|el\s+dia|dia)\b/ig,' ')
    .replace(/\b(?:el\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/ig,' ')
    .replace(/\b(?:modalidad|modo)\b/ig,' ')
    .replace(/\s*[,.;:]\s*/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/^(?:una|un|la|el)\s+/i,'')
    .replace(/\s+(?:para|el|la|de|del|en)\s*$/i,'')
    .trim();
  return cap(s);
}

function parse(text,options={}){
  const raw=String(text||'').trim(), now=options.now instanceof Date?options.now:new Date();
  const date=parseDate(raw,now), time=parseTime(raw), modality=parseModality(raw), status=parseStatus(raw), location=parseLocation(raw), people=parsePeople(raw);
  const spans=[commandSpan(raw),date.span,time.span,modality.span,status.span,location.span,people.span];
  const detail=cleanupDetail(raw,spans);

  const missing=[];
  if(!date.date) missing.push('fecha');
  if(!detail) missing.push('detalle');

  const warnings=[];
  const l=fold(raw);
  const mentionedTime=/\b(?:hora|horas|a\s+las?|a\s+la|\d{1,2}[:.]\d{2})\b/.test(l);
  if(mentionedTime&&!time.time&&!time.explicitNoTime) warnings.push('Se mencionó una hora, pero no pude interpretarla.');
  const mentionedLocation=/\b(?:ubicad[oa]\s+en|ubicacion|lugar|en\s+(?:la\s+)?(?:(?:primera|segunda|tercera|cuarta|quinta)\s+)?(?:sala|oficina|salon|auditorio|tribunal|corte|radio|edificio|plaza)|por\s+zoom|via\s+zoom|zoom|meet|teams)\b/.test(l);
  if(mentionedLocation&&!location.location) warnings.push('Se mencionó un lugar, pero no pude separarlo con seguridad.');
  const mentionedPeople=/\b(?:particip|asist|participantes|responsable|junto\s+a|a\s+cargo)\b/.test(l);
  if(mentionedPeople&&!people.people) warnings.push('Se mencionaron participantes, pero no pude separarlos con seguridad.');

  return {
    intent:(options.forceCreate||isCreateIntent(raw))?'create':'unknown',
    raw,
    data:{
      FECHA:date.date?dateKey(date.date):'',
      HORA:time.time,
      MODALIDAD:modality.modality,
      ACTIVIDAD:detail,
      LUGAR:location.location,
      PARTICIPANTES:people.people||'',
      ESTADO:status.status
    },
    detected:{
      date:Boolean(date.date),
      time:Boolean(time.time),
      explicitNoTime:Boolean(time.explicitNoTime),
      modality:Boolean(modality.span),
      status:Boolean(status.span),
      location:Boolean(location.location),
      people:Boolean(people.people)
    },
    meta:{
      people:people.people||'',
      inferredModality:Boolean(modality.inferred),
      explicitNoTime:Boolean(time.explicitNoTime)
    },
    missing,
    warnings
  };
}

global.AgendaVoiceCreate={parse,isCreateIntent,fold};
})(typeof window!=='undefined'?window:globalThis);
