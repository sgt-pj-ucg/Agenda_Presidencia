
// Agenda Presidencia · legibilidad móvil y compatibilidad de voz en iPhone
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS475HlSXSv9KO7xSo8MnDd8fMBbz93oLJAXKRJGpIWjG88nNF2RX1dJwBq3Evw47kmxeGnKJgRQIk/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzTAbGCdAkQdQ1hd5C8lx3lS1ONOMZIRWsVIF9mJCweWPBjNt2VEiPM_4GUmr4qQx7riA/exec';

let allEvents = [];
let currentTab = 'hoy';
let currentView = 'agenda';
document.body.dataset.view = currentView;
let calendarDate = new Date();
let selectedCalDate = null;
let activeDropdown = null;
let editingEvent = null;
let pendingDeleteEvent = null;
let refreshTimer = null;
let lastSuccessfulLoadAt = 0;
let calendarMotion = '';

const CATEGORIES = [
  { id:'reuniones', label:'Reuniones', icon:'🤝', keywords:['reunión','reunion','reuniones'] },
  { id:'visitas', label:'Visitas', icon:'👋', keywords:['visita','visitas'] },
  { id:'audiencias', label:'Audiencias', icon:'⚖️', keywords:['audiencia','audiencias'] },
  { id:'pleno', label:'Pleno', icon:'🏛', keywords:['pleno'] },
  { id:'seminarios', label:'Cursos', icon:'🎓', keywords:['seminario','seminarios','capacitación','capacitacion','curso','cursos','diplomado'] },
];

const FIXED_TABS = [
  { id:'hoy', label:'Hoy', icon:'📅' },
  { id:'manana', label:'Mañana', icon:'⏭' },
  { id:'semana', label:'Semana', icon:'📆' },
];

const SPECIAL_KEYWORDS = [
  'permiso','permisos','vacación','vacacion','vacaciones','feriado legal',
  'curso','cursos','capacitación','capacitacion','diplomado','academia judicial'
];

const STATUS_OPTIONS = [
  {s:'Confirmada', color:'#78bba3', dot:'#4f9c83', icon:'✓'},
  {s:'Por Confirmar', color:'#a99dc5', dot:'#7d72a7', icon:'?'},
  {s:'Pendiente', color:'#d1aa70', dot:'#b98135', icon:'⏳'},
  {s:'Ausente', color:'#a4b1c5', dot:'#7186a8', icon:'⊘'},
  {s:'Cancelada', color:'#d99a9f', dot:'#b75d65', icon:'✕'},
];

function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function parseCSV(text) {
  const rows=[];
  let row=[], cell='', quoted=false;
  const source=String(text||'').replace(/^\uFEFF/, '');
  for (let i=0;i<source.length;i++) {
    const char=source[i];
    if (char==='"') {
      if (quoted && source[i+1]==='"') { cell+='"'; i++; }
      else quoted=!quoted;
    } else if (char===',' && !quoted) {
      row.push(cell.trim()); cell='';
    } else if ((char==='\n' || char==='\r') && !quoted) {
      if (char==='\r' && source[i+1]==='\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row=[]; cell='';
    } else cell+=char;
  }
  if (cell!=='' || row.length) { row.push(cell.trim()); rows.push(row); }
  while (rows.length && rows[rows.length-1].every(value=>value==='')) rows.pop();
  if (!rows.length) return [];
  const headers=rows[0].map(h=>h.trim().toUpperCase());
  return rows.slice(1).map((cols,idx)=>{
    const obj={_row:idx+2};
    headers.forEach((header,i)=>obj[header]=(cols[i]||'').trim());
    obj.FECHA=normalizeDateKey(obj.FECHA);
    obj.HORA=normalizeTimeValue(obj.HORA);
    obj.MODALIDAD=normalizeModality(obj.MODALIDAD);
    obj.ESTADO=normalizeStatus(obj.ESTADO);
    return obj;
  }).filter(e=>e.FECHA&&e.ACTIVIDAD);
}

function normalizeDateKey(value) {
  if (!value) return '';
  const raw=String(value).trim();
  let day,month,year;
  const iso=raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  const local=raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\D|$)/);
  if (iso) [,year,month,day]=iso;
  else if (local) [,day,month,year]=local;
  else return '';
  day=Number(day); month=Number(month); year=Number(year);
  const date=new Date(year,month-1,day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear()!==year ||
    date.getMonth()!==month-1 ||
    date.getDate()!==day
  ) return '';
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

function parseDate(value) {
  const canonical=normalizeDateKey(value);
  if (!canonical) return null;
  const [day,month,year]=canonical.split('/').map(Number);
  return new Date(year,month-1,day);
}

function normalizeTimeValue(value) {
  if (!value) return '';
  const match=String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour=Number(match[1]);
  const minute=Number(match[2]);
  if (hour<0||hour>23||minute<0||minute>59) return '';
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function dateToInput(str) {
  const date=parseDate(str);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function inputToDate(value) {
  const [y,m,d]=String(value).split('-');
  return y&&m&&d?`${d}/${m}/${y}`:'';
}

function dayNameFromInput(value) {
  const [y,m,d]=String(value).split('-').map(Number);
  const name=new Date(y,m-1,d).toLocaleDateString('es-CL',{weekday:'long'});
  return name.charAt(0).toUpperCase()+name.slice(1);
}

function sameDay(a,b) {
  return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}

function normalizeModality(value) {
  const raw=String(value||'').trim();
  const lower=raw.toLowerCase();
  if (lower.includes('zoom') || lower.includes('telem') || lower.includes('virtual')) return 'Telemática';
  if (lower.includes('híbr') || lower.includes('hibr')) return 'Híbrida';
  if (lower.includes('presencial')) return 'Presencial';
  return raw || 'Otro';
}

function normalizeStatus(value) {
  const raw=String(value||'').trim();
  const lower=raw.toLowerCase();
  if (lower==='por confirmar' || lower==='por confirmar.') return 'Por Confirmar';
  if (lower==='pendiente') return 'Pendiente';
  if (lower==='ausente' || lower==='ausencia') return 'Ausente';
  if (lower==='cancelada' || lower==='cancelado') return 'Cancelada';
  return raw || 'Confirmada';
}

function eventKey(event) {
  return `${event._row||''}|${normalizeDateKey(event.FECHA)}|${normalizeTimeValue(event.HORA)}|${event.ACTIVIDAD||''}`;
}

function getStatus(event) { return normalizeStatus(event.ESTADO); }

function isSpecialActivity(event) {
  const text=[event.TIPO,event.CATEGORIA,event.ACTIVIDAD].filter(Boolean).join(' ').toLowerCase();
  return SPECIAL_KEYWORDS.some(keyword=>text.includes(keyword));
}

function formatTime(value) {
  return normalizeTimeValue(value);
}

function timeToMin(value) {
  const normalized=normalizeTimeValue(value);
  if (!normalized) return null;
  const [hour,minute]=normalized.split(':').map(Number);
  return hour*60+minute;
}

function compareEventsChronologically(a,b) {
  const aMinutes=timeToMin(a.HORA);
  const bMinutes=timeToMin(b.HORA);
  if (aMinutes===null&&bMinutes!==null) return 1;
  if (aMinutes!==null&&bMinutes===null) return -1;
  if (aMinutes!==null&&bMinutes!==null&&aMinutes!==bMinutes) return aMinutes-bMinutes;
  const rowDifference=(Number(a._row)||Number.MAX_SAFE_INTEGER)-(Number(b._row)||Number.MAX_SAFE_INTEGER);
  if (rowDifference) return rowDifference;
  return String(a.ACTIVIDAD||'').localeCompare(String(b.ACTIVIDAD||''),'es',{sensitivity:'base'});
}

function todayAtMidnight(){
  const date=new Date(); date.setHours(0,0,0,0); return date;
}

function minutesNow(){
  const now=new Date(); return now.getHours()*60+now.getMinutes();
}

function activeEventsForDate(date){
  return allEvents
    .filter(event=>sameDay(parseDate(event.FECHA),date)&&getStatus(event)!=='Cancelada')
    .slice().sort(compareEventsChronologically);
}

function nextTimedEventForToday(){
  const nowMinutes=minutesNow();
  return activeEventsForDate(todayAtMidnight())
    .find(event=>{
      const value=timeToMin(event.HORA);
      return value!==null&&value>=nowMinutes;
    })||null;
}

function eventTemporalMeta(event){
  const eventDate=parseDate(event.FECHA);
  if(!eventDate||!sameDay(eventDate,todayAtMidnight())||getStatus(event)==='Cancelada') return {state:'',label:'',minutes:null};
  const value=timeToMin(event.HORA);
  if(value===null) return {state:'',label:'',minutes:null};
  const now=minutesNow();
  const next=nextTimedEventForToday();
  if(next&&eventKey(next)===eventKey(event)){
    const difference=Math.max(0,value-now);
    return {state:'next',label:difference===0?'Ahora':difference<60?`En ${difference} min`:`En ${Math.floor(difference/60)} h ${difference%60?`${difference%60} min`:''}`.trim(),minutes:difference};
  }
  if(value<now) return {state:'past',label:'Finalizada',minutes:value-now};
  return {state:'future',label:'',minutes:value-now};
}

function sameTimeConflicts(events){
  const counts=new Map();
  events.forEach(event=>{
    const time=normalizeTimeValue(event.HORA);
    if(time) counts.set(time,(counts.get(time)||0)+1);
  });
  return [...counts.entries()].filter(([,count])=>count>1).map(([time,count])=>({time,count}));
}

function haptic(pattern=18){
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(_){ }
}

function modalityMeta(value) {
  const modality=normalizeModality(value);
  if (modality==='Presencial') return {className:'presencial',badge:'b-presencial',icon:'●',label:'Presencial'};
  if (modality==='Telemática') return {className:'telematica',badge:'b-telematica',icon:'◉',label:'Telemática'};
  if (modality==='Híbrida') return {className:'hibrida',badge:'b-hibrida',icon:'◐',label:'Híbrida'};
  return {className:'otro',badge:'b-otro',icon:'•',label:'Otra modalidad'};
}

function statusEmoji(status) {
  return status==='Confirmada'?'✓':status==='Por Confirmar'?'?':status==='Pendiente'?'⏳':status==='Ausente'?'⊘':'✕';
}

function statusPillClass(status) {
  if (status==='Por Confirmar') return 's-por-confirmar';
  if (status==='Pendiente') return 's-pendiente';
  if (status==='Ausente') return 's-ausente';
  if (status==='Cancelada') return 's-cancelada';
  return 's-confirmada';
}

function filterEvents(tab) {
  const today=new Date(); today.setHours(0,0,0,0);
  const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
  let events=[...allEvents];
  if (tab==='hoy') events=events.filter(e=>sameDay(parseDate(e.FECHA),today));
  else if (tab==='manana') events=events.filter(e=>sameDay(parseDate(e.FECHA),tomorrow));
  else if (tab==='semana') {
    const dow=today.getDay();
    const monday=new Date(today); monday.setDate(today.getDate()+(dow===0?-6:1-dow));
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999);
    events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&date<=sunday;});
  } else if (tab==='mes') {
    events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&date.getMonth()===today.getMonth()&&date.getFullYear()===today.getFullYear();});
  } else {
    const category=CATEGORIES.find(c=>c.id===tab);
    if (category) events=events.filter(e=>{const date=parseDate(e.FECHA);return date&&date>=today&&category.keywords.some(k=>(e.ACTIVIDAD||'').toLowerCase().includes(k));});
  }
  return events;
}

function getActiveCats() {
  return CATEGORIES.filter(category=>allEvents.some(event=>category.keywords.some(k=>(event.ACTIVIDAD||'').toLowerCase().includes(k))));
}

function buildTabs() {
  const tabs=[...FIXED_TABS];
  const row=document.getElementById('tabsRow');
  row.innerHTML=tabs.map(tab=>{
    const count=filterEvents(tab.id).length;
    return `<button class="tab ${tab.id===currentTab?'active':''}" data-tab="${tab.id}" type="button">${tab.icon} ${tab.label} <span class="tab-count">${count}</span></button>`;
  }).join('');
  row.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
    currentTab=tab.dataset.tab; setView('agenda'); buildTabs(); render();
  }));
}

function updateHeaderStats() {
  const today=new Date(); today.setHours(0,0,0,0);
  const todayEvents=allEvents.filter(event=>sameDay(parseDate(event.FECHA),today));
  const confirmed=todayEvents.filter(event=>getStatus(event)==='Confirmada').length;
  const toConfirm=todayEvents.filter(event=>getStatus(event)==='Por Confirmar').length;
  const pending=todayEvents.filter(event=>getStatus(event)==='Pendiente').length;
  const absent=todayEvents.filter(event=>getStatus(event)==='Ausente'||isSpecialActivity(event)).length;
  document.getElementById('headerStats').innerHTML=`
    <div class="stat-chip primary"><span class="dot" style="background:#4f9c83"></span>${todayEvents.length} hoy</div>
    ${confirmed?`<div class="stat-chip"><span class="dot" style="background:#4f9c83"></span>${confirmed} confirmada${confirmed===1?'':'s'}</div>`:''}
    ${toConfirm?`<div class="stat-chip"><span class="dot" style="background:#7d72a7"></span>${toConfirm} por confirmar</div>`:''}
    ${pending?`<div class="stat-chip"><span class="dot" style="background:#b98135"></span>${pending} pendiente${pending===1?'':'s'}</div>`:''}
    ${absent?`<div class="stat-chip"><span class="dot" style="background:#7186a8"></span>${absent} ausencia${absent===1?'':'s'}</div>`:''}`;
  updateExecutiveBrief(today,todayEvents);
}

function updateExecutiveBrief(today,todayEvents) {
  const hour=new Date().getHours();
  const greeting=hour<12?'Buenos días':hour<20?'Buenas tardes':'Buenas noches';
  const active=todayEvents.filter(event=>getStatus(event)!=='Cancelada').slice().sort(compareEventsChronologically);
  const timed=active.filter(event=>timeToMin(event.HORA)!==null);
  const absences=active.filter(event=>getStatus(event)==='Ausente'||isSpecialActivity(event));
  const next=nextTimedEventForToday();
  const conflicts=sameTimeConflicts(active);
  const pending=active.filter(event=>['Por Confirmar','Pendiente'].includes(getStatus(event))).length;
  const kicker=today.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});

  document.getElementById('briefKicker').textContent=kicker.charAt(0).toUpperCase()+kicker.slice(1);
  document.getElementById('briefTitle').textContent=`${greeting}, Presidenta.`;

  let subtitle='No hay actividades registradas para hoy.';
  if(active.length===absences.length&&absences.length){
    subtitle='La jornada está registrada como ausencia, permiso, curso o feriado legal.';
  }else if(active.length){
    const count=`${active.length} ${active.length===1?'actividad':'actividades'}`;
    if(next){
      subtitle=`Hoy tiene ${count}. La próxima actividad comienza a las ${formatTime(next.HORA)}.`;
    }else if(timed.length){
      subtitle=`Hoy tuvo ${count}. Las actividades con hora programada ya finalizaron.`;
    }else{
      subtitle=`Hoy tiene ${count}, sin hora definida.`;
    }
  }
  document.getElementById('briefSubtitle').textContent=subtitle;

  const signals=[];
  if(next){
    const temporal=eventTemporalMeta(next);
    signals.push(`<button class="brief-signal next" type="button" data-brief-action="next"><span class="signal-dot"></span><span class="brief-signal-copy"><strong>Próxima actividad</strong><span class="brief-signal-detail"><b>${formatTime(next.HORA)}</b><span>${escapeHTML(next.ACTIVIDAD)}</span></span></span><em>${temporal.label}</em></button>`);
  }
  if(conflicts.length) signals.push(`<span class="brief-signal warning"><strong>Atención</strong><span>${conflicts.length===1?'Coincidencia horaria':'Coincidencias horarias'}</span></span>`);
  if(pending) signals.push(`<span class="brief-signal pending"><strong>${pending}</strong><span>${pending===1?'actividad por revisar':'actividades por revisar'}</span></span>`);
  if(absences.length) signals.push(`<span class="brief-signal absence"><strong>${absences.length}</strong><span>${absences.length===1?'ausencia registrada':'ausencias registradas'}</span></span>`);
  document.getElementById('briefSignals').innerHTML=signals.join('');
}

function renderCard(event) {
  const status=getStatus(event);
  const modality=modalityMeta(event.MODALIDAD);
  const special=isSpecialActivity(event);
  const temporal=eventTemporalMeta(event);
  const key=escapeHTML(eventKey(event));
  const temporalBadge=temporal.state==='next'
    ? `<span class="temporal-badge next"><span class="temporal-dot"></span><strong>Próxima</strong><em>${escapeHTML(temporal.label)}</em></span>`
    : temporal.state==='past'?`<span class="temporal-badge past">Finalizada</span>`:'';
  const banner=special
    ? `<div class="mode-banner mode-special"><span>AUSENCIA · PERMISO · CURSO · FERIADO LEGAL</span>${temporalBadge}</div>`
    : `<div class="mode-banner mode-${modality.className}"><span class="mode-copy"><span class="mode-icon">${modality.icon}</span> ${modality.label}</span>${temporalBadge}</div>`;
  return `
    <article class="event-card ${modality.className} ${special?'special':''} ${status==='Cancelada'?'cancelada':''} ${temporal.state?`temporal-${temporal.state}`:''}" data-key="${key}" data-row="${event._row||''}">
      ${banner}
      <div class="card-top">
        <div class="time-bubble ${event.HORA?'':'no-time'}"><div class="t-hour">${event.HORA?escapeHTML(formatTime(event.HORA)):'S/H'}</div></div>
        <div class="card-body">
          <div class="card-title">${escapeHTML(event.ACTIVIDAD)}</div>
          <div class="card-badges">
            <span class="badge ${modality.badge}">${modality.icon} ${escapeHTML(normalizeModality(event.MODALIDAD))}</span>
            ${event.LUGAR?`<span class="badge b-lugar">🏛 ${escapeHTML(event.LUGAR)}</span>`:''}
            ${event.PARTICIPANTES?`<span class="badge b-personas">👥 ${escapeHTML(event.PARTICIPANTES)}</span>`:''}
          </div>
        </div>
      </div>
      <div class="status-row">
        <button class="status-pill ${statusPillClass(status)}" data-key="${key}" type="button" aria-label="Cambiar estado de ${escapeHTML(event.ACTIVIDAD)}">
          ${statusEmoji(status)} ${escapeHTML(status)} <span class="chevron">▾</span>
        </button>
        <div class="event-actions">
          <button class="card-action edit" data-key="${key}" type="button" title="Editar actividad" aria-label="Editar ${escapeHTML(event.ACTIVIDAD)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
          </button>
          <button class="card-action delete" data-key="${key}" type="button" title="Eliminar actividad" aria-label="Eliminar ${escapeHTML(event.ACTIVIDAD)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderGroups(events) {
  if (!events.length) return `<div class="empty"><div class="icon">📭</div><p>No hay actividades<br>para este período</p></div>`;
  const grouped={};
  events.forEach(event=>{
    const key=normalizeDateKey(event.FECHA);
    if(!key) return;
    if(!grouped[key]) grouped[key]=[];
    grouped[key].push(event);
  });
  return Object.keys(grouped).sort((a,b)=>parseDate(a)-parseDate(b)).map(key=>{
    const date=parseDate(key);
    const sorted=grouped[key].slice().sort(compareEventsChronologically);
    const dayName=date?date.toLocaleDateString('es-CL',{weekday:'long'}):'';
    const dayNum=date?date.getDate():'';
    const month=date?date.toLocaleDateString('es-CL',{month:'short'}):'';
    return `<section class="date-group">
      <div class="date-header">
        <div class="date-circle"><div class="day-num">${dayNum}</div><div class="day-mon">${month}</div></div>
        <div class="date-info"><div class="day-name">${dayName}</div><div class="day-count">${sorted.length} ${sorted.length===1?'actividad':'actividades'}</div></div>
        <div class="date-divider"></div>
      </div>
      ${sorted.map(renderCard).join('')}
    </section>`;
  }).join('');
}

function formatDateKey(date){
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
}

function isCalendarAbsenceEvent(event){
  const status=getStatus(event);
  return status==='Ausente'||(status!=='Cancelada'&&isSpecialActivity(event));
}

function dayStatusSegments(dayEvents){
  const segments=[];
  const add=(name,label)=>{if(!segments.some(item=>item.name===name))segments.push({name,label});};
  const absenceEvents=dayEvents.filter(isCalendarAbsenceEvent);
  const taskEvents=dayEvents.filter(event=>!isCalendarAbsenceEvent(event));

  // Una ausencia sola se reconoce mediante el cajón gris azulado, sin una segunda raya inferior.
  // La raya de ausencia aparece únicamente cuando el mismo día también contiene tareas reales.
  if(absenceEvents.length&&taskEvents.length) add('absence','Ausencia');
  if(taskEvents.some(event=>getStatus(event)==='Por Confirmar')) add('confirm','Por confirmar');
  if(taskEvents.some(event=>getStatus(event)==='Pendiente')) add('pending','Pendiente');
  if(taskEvents.some(event=>getStatus(event)==='Confirmada')) add('confirmed','Confirmada');
  if(taskEvents.some(event=>getStatus(event)==='Cancelada')) add('cancelled','Cancelada');
  return segments.slice(0,4);
}

function selectedDayEvents(){
  if(!selectedCalDate) return [];
  const key=formatDateKey(selectedCalDate);
  return allEvents.filter(event=>normalizeDateKey(event.FECHA)===key).slice().sort(compareEventsChronologically);
}

function moveSelectedDay(delta){
  const base=selectedCalDate?new Date(selectedCalDate):new Date();
  base.setDate(base.getDate()+delta);
  base.setHours(0,0,0,0);
  selectedCalDate=base;
  calendarDate=new Date(base.getFullYear(),base.getMonth(),1);
  render();
}

function moveCalendarMonth(delta){
  calendarMotion=delta>0?'next':'prev';
  const nextMonth=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+delta,1);
  calendarDate=nextMonth;
  selectedCalDate=new Date(nextMonth);
  render();
}

function renderSelectedDayPanel(){
  const selected=selectedCalDate||new Date();
  const events=selectedDayEvents();
  const label=selected.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  const isToday=sameDay(selected,new Date());
  const summary=events.length
    ? `${events.length} ${events.length===1?'actividad registrada':'actividades registradas'}`
    : 'Sin actividades registradas';
  const activeEvents=events.filter(event=>getStatus(event)!=='Cancelada');
  const first=activeEvents.find(event=>event.HORA);
  const next=isToday?nextTimedEventForToday():null;
  return `<aside class="day-panel" id="dayPanel" aria-label="Detalle del día seleccionado">
    <div class="day-panel-handle" aria-hidden="true"></div>
    <div class="day-panel-head">
      <button class="day-step" id="dayPrev" type="button" aria-label="Día anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="day-panel-copy">
        <span class="day-panel-eyebrow">${isToday?'Hoy':'Día seleccionado'}</span>
        <h3>${label.charAt(0).toUpperCase()+label.slice(1)}</h3>
        <p>${summary}${next?` · Próxima a las ${formatTime(next.HORA)}`:first?` · Primera a las ${formatTime(first.HORA)}`:''}</p>
      </div>
      <button class="day-step" id="dayNext" type="button" aria-label="Día siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
    </div>
    <div class="day-panel-events">
      ${events.length?events.map(renderCard).join(''):`<div class="calendar-empty-day"><div class="empty-orbit">✓</div><strong>Jornada disponible</strong><span>No hay actividades registradas para este día.</span><button type="button" id="emptyAddButton">Agregar actividad</button></div>`}
    </div>
    <div class="swipe-hint">Deslice horizontalmente para cambiar de día</div>
  </aside>`;
}

function renderCalendar() {
  const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
  const today=new Date(); today.setHours(0,0,0,0);
  if(!selectedCalDate){
    selectedCalDate=(today.getMonth()===month&&today.getFullYear()===year)?new Date(today):new Date(year,month,1);
  }
  const monthName=calendarDate.toLocaleDateString('es-CL',{month:'long',year:'numeric'});
  const firstDay=new Date(year,month,1);
  let startDow=firstDay.getDay(); if(startDow===0) startDow=7;
  const lastDay=new Date(year,month+1,0);
  const monthEvents=allEvents.filter(event=>{
    const date=parseDate(event.FECHA);
    return date&&date.getMonth()===month&&date.getFullYear()===year;
  });
  const eventsByDate=new Map();
  allEvents.forEach(event=>{
    const key=normalizeDateKey(event.FECHA);
    if(!key) return;
    if(!eventsByDate.has(key)) eventsByDate.set(key,[]);
    eventsByDate.get(key).push(event);
  });
  const cells=[];
  for(let i=1;i<startDow;i++) cells.push({date:new Date(year,month,1-(startDow-i)),current:false});
  for(let day=1;day<=lastDay.getDate();day++) cells.push({date:new Date(year,month,day),current:true});
  // Seis semanas fijas: todos los meses conservan exactamente la misma altura.
  // Cinco filas no bastan para meses que comienzan al final de la semana y tienen 31 días.
  while(cells.length<42){
    const last=cells[cells.length-1].date;
    cells.push({date:new Date(last.getFullYear(),last.getMonth(),last.getDate()+1),current:false});
  }
  const cellsHTML=cells.map(cell=>{
    const key=formatDateKey(cell.date);
    const dayEvents=(eventsByDate.get(key)||[]).slice().sort(compareEventsChronologically);
    const segments=dayStatusSegments(dayEvents);
    const hasAbsence=dayEvents.some(isCalendarAbsenceEvent);
    const isToday=sameDay(cell.date,today);
    const isSelected=selectedCalDate&&sameDay(cell.date,selectedCalDate);
    const line=segments.length?`<span class="activity-line" aria-hidden="true">${segments.map(segment=>`<i class="${segment.name}"></i>`).join('')}</span>`:'';
    const labels=[hasAbsence?'Ausencia':'',...segments.map(segment=>segment.label)].filter(Boolean).join(', ');
    return `<button class="cal-cell ${!cell.current?'other-month':''} ${isToday?'today':''} ${isSelected?'selected':''} ${hasAbsence?'has-absence':''}" data-date="${key}" type="button" aria-label="${key}${dayEvents.length?`, ${dayEvents.length} actividades, ${labels}`:''}" aria-pressed="${Boolean(isSelected)}"><span class="cal-day-number">${cell.date.getDate()}</span>${line}</button>`;
  }).join('');
  const selectedPanel=renderSelectedDayPanel();
  return `<section class="calendar-workspace ${calendarMotion?`calendar-motion-${calendarMotion}`:''}">
    <div class="calendar-card">
      <div class="cal-header">
        <div class="cal-heading">
          <span class="cal-eyebrow">Agenda mensual</span>
          <h2 class="cal-title">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</h2>
          <span class="cal-subtitle">${monthEvents.length} ${monthEvents.length===1?'actividad':'actividades'} este mes</span>
        </div>
        <div class="cal-controls">
          <button class="cal-today-btn" id="calToday" type="button">Hoy</button>
          <div class="cal-nav-group">
            <button class="cal-nav" id="calPrev" type="button" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
            <button class="cal-nav" id="calNext" type="button" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
          </div>
        </div>
      </div>
      <div class="cal-days-header">${['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(day=>`<span>${day}</span>`).join('')}</div>
      <div class="cal-grid" id="calGrid">${cellsHTML}</div>
      <div class="calendar-legend">
        <span><i class="legend-ring"></i>Hoy</span>
        <span><i class="legend-selected"></i>Seleccionado</span>
        <span><i class="legend-line confirmed"></i>Confirmada</span>
        <span><i class="legend-line confirm"></i>Por confirmar</span>
        <span><i class="legend-absence-cell"></i>Ausencia</span>
      </div>
    </div>
    ${selectedPanel}
  </section>`;
}

function bindCalendarInteractions(){
  document.getElementById('calPrev')?.addEventListener('click',()=>moveCalendarMonth(-1));
  document.getElementById('calNext')?.addEventListener('click',()=>moveCalendarMonth(1));
  document.getElementById('calToday')?.addEventListener('click',()=>{
    const today=new Date(); today.setHours(0,0,0,0);
    selectedCalDate=today;
    calendarDate=new Date(today.getFullYear(),today.getMonth(),1);
    render();
  });

  const grid=document.getElementById('calGrid');
  let calendarSwipeUntil=0;
  if(grid){
    let startX=0,startY=0;
    grid.addEventListener('touchstart',event=>{
      startX=event.changedTouches[0]?.clientX||0;
      startY=event.changedTouches[0]?.clientY||0;
    },{passive:true});
    grid.addEventListener('touchend',event=>{
      const endX=event.changedTouches[0]?.clientX||0;
      const endY=event.changedTouches[0]?.clientY||0;
      const dx=endX-startX,dy=endY-startY;
      if(Math.abs(dx)>58&&Math.abs(dx)>Math.abs(dy)*1.2){
        calendarSwipeUntil=Date.now()+420;
        moveCalendarMonth(dx<0?1:-1);
      }
    },{passive:true});
    grid.addEventListener('click',event=>{
      if(Date.now()<calendarSwipeUntil) return;
      const cell=event.target.closest('.cal-cell'); if(!cell?.dataset.date) return;
      const [d,m,y]=cell.dataset.date.split('/').map(Number);
      selectedCalDate=new Date(y,m-1,d);
      calendarDate=new Date(y,m-1,1);
      render();
    });
  }

  document.getElementById('dayPrev')?.addEventListener('click',()=>moveSelectedDay(-1));
  document.getElementById('dayNext')?.addEventListener('click',()=>moveSelectedDay(1));
  document.getElementById('emptyAddButton')?.addEventListener('click',()=>{
    openActivityModal('add');
    if(selectedCalDate) document.getElementById('fFecha').value=dateToInput(formatDateKey(selectedCalDate));
  });

  const panel=document.getElementById('dayPanel');
  if(panel){
    let startX=0,startY=0;
    panel.addEventListener('touchstart',event=>{
      startX=event.changedTouches[0]?.clientX||0;
      startY=event.changedTouches[0]?.clientY||0;
    },{passive:true});
    panel.addEventListener('touchend',event=>{
      const endX=event.changedTouches[0]?.clientX||0;
      const endY=event.changedTouches[0]?.clientY||0;
      const dx=endX-startX,dy=endY-startY;
      if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.25) moveSelectedDay(dx<0?1:-1);
    },{passive:true});
  }
}


function bindBriefActions(){
  document.querySelector('[data-brief-action="next"]')?.addEventListener('click',()=>{
    const next=nextTimedEventForToday();
    if(!next) return;
    selectedCalDate=todayAtMidnight();
    calendarDate=new Date(selectedCalDate.getFullYear(),selectedCalDate.getMonth(),1);
    setView('calendario');
    render();
    window.setTimeout(()=>document.querySelector('.day-panel-events .event-card.temporal-next')?.scrollIntoView({behavior:'smooth',block:'center'}),120);
  });
}

function render() {
  const content=document.getElementById('content');
  const timestamp=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  let html=`<div class="updated-bar"><span class="live-dot"></span>Sincronizado a las ${timestamp}</div>`;
  if(currentView==='calendario') html+=renderCalendar();
  else if(currentView==='mes') html+=renderGroups(filterEvents('mes'));
  else html+=renderGroups(filterEvents(currentTab));
  content.innerHTML=html;
  bindCardActions();
  if(currentView==='calendario') {
    bindCalendarInteractions();
    if(calendarMotion) window.setTimeout(()=>{calendarMotion='';},360);
  }
  bindBriefActions();
}

function findEventByKey(key) { return allEvents.find(event=>eventKey(event)===key); }

function closeDropdown() {
  if (activeDropdown) { activeDropdown.remove(); activeDropdown=null; }
}

document.addEventListener('click',closeDropdown);

function openStatusDropdown(pill,event) {
  closeDropdown();
  const current=getStatus(event);
  const dropdown=document.createElement('div');
  dropdown.className='status-dropdown';
  dropdown.innerHTML=STATUS_OPTIONS.map(option=>`<button class="status-option" data-status="${option.s}" type="button" style="color:${option.color}"><span class="opt-dot" style="background:${option.dot}"></span>${option.icon} ${option.s}${current===option.s?' ✔':''}</button>`).join('');
  document.body.appendChild(dropdown);
  const rect=pill.getBoundingClientRect();
  const width=Math.min(248,window.innerWidth-20);
  dropdown.style.width=`${width}px`;
  const height=dropdown.offsetHeight;
  dropdown.style.top=(rect.bottom+6+height>window.innerHeight?Math.max(10,rect.top-height-6):rect.bottom+6)+'px';
  dropdown.style.left=Math.max(10,Math.min(rect.left,window.innerWidth-width-10))+'px';
  activeDropdown=dropdown;
  dropdown.querySelectorAll('.status-option').forEach(option=>option.addEventListener('click',async click=>{
    click.stopPropagation();
    const newStatus=option.dataset.status;
    closeDropdown();
    showToast('Guardando estado…');
    try {
      await sendScriptAction('estado',{fila:event._row,fecha:event.FECHA,hora:event.HORA,actividad:event.ACTIVIDAD,estado:newStatus});
      event.ESTADO=newStatus;
      updateHeaderStats(); buildTabs(); render();
      haptic(18); showToast(`✓ Estado actualizado: ${newStatus}`);
      scheduleRefresh();
    } catch (error) {
      showToast(`⚠️ ${error.message||'No fue posible sincronizar el estado'}`);
    }
  }));
}

function bindCardActions() {
  document.querySelectorAll('.status-pill').forEach(pill=>pill.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(pill.dataset.key); if(item) openStatusDropdown(pill,item);
  }));
  document.querySelectorAll('.card-action.edit').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(button.dataset.key); if(item) openActivityModal('edit',item);
  }));
  document.querySelectorAll('.card-action.delete').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation(); const item=findEventByKey(button.dataset.key); if(item) openDeleteModal(item);
  }));
}

function setView(view) {
  currentView=view;
  document.body.dataset.view=view;
  document.body.classList.remove('header-collapsed');
  adaptiveHeaderPinnedOpenAt=null;
  document.querySelectorAll('.nav-btn:not(.nav-add)').forEach(button=>button.classList.remove('active'));
  const map={agenda:'navAgenda',calendario:'navCalendar',buscar:'navSearch',mes:'navMes'};
  document.getElementById(map[view])?.classList.add('active');
  const searchInfo=document.getElementById('searchInfo');
  const searchBar=document.querySelector('.search-bar');
  if (view==='buscar') { searchBar.style.display='flex'; setTimeout(()=>searchInput.focus(),50); }
  else searchBar.style.display='';
  searchInfo.style.display='none';
  searchInput.value='';
  if (view==='calendario') {
    requestAnimationFrame(() => {
      window.scrollTo({top:0,behavior:'smooth'});
      updateAdaptiveHeader({forceExpanded:true});
    });
  } else {
    updateAdaptiveHeader({forceExpanded:true});
  }
}

document.getElementById('navAgenda').addEventListener('click',()=>{currentTab='hoy';setView('agenda');buildTabs();render();});
document.getElementById('navCalendar').addEventListener('click',()=>{setView('calendario');render();});
document.getElementById('navMes').addEventListener('click',()=>{setView('mes');render();});
document.getElementById('navSearch').addEventListener('click',()=>setView('buscar'));
document.getElementById('briefCalendarButton')?.addEventListener('click',()=>{setView('calendario');render();});

const activityModal=document.getElementById('activityModal');
const timePickerModal=document.getElementById('timePickerModal');
const deleteModal=document.getElementById('deleteModal');
const hiddenTimeInput=document.getElementById('fHora');
const timeFieldValue=document.getElementById('timeFieldValue');
const timePickerHour=document.getElementById('timePickerHour');
const timePickerMinute=document.getElementById('timePickerMinute');
let timePickerTotalMinutes=9*60;

function setActivityTime(value=''){
  const normalized=/^\d{2}:\d{2}$/.test(value)?value:'';
  hiddenTimeInput.value=normalized;
  timeFieldValue.textContent=normalized||'Sin hora';
  document.querySelectorAll('.time-shortcuts button').forEach(button=>{
    button.classList.toggle('active',button.dataset.time===normalized);
  });
}

function resetActivityForm() {
  ['fActividad','fLugar','fParticipantes'].forEach(id=>document.getElementById(id).value='');
  setActivityTime('');
  document.getElementById('fModalidad').value='Presencial';
  document.getElementById('fEstado').value='Confirmada';
  document.getElementById('formMsg').textContent='';
}

function openActivityModal(mode,event=null) {
  editingEvent=mode==='edit'?event:null;
  resetActivityForm();
  const title=document.getElementById('activityModalTitle');
  const subtitle=document.getElementById('activityModalSubtitle');
  const save=document.getElementById('btnGuardar');
  if (editingEvent) {
    title.textContent='✏️ Editar actividad';
    subtitle.textContent='Modifica la fecha, actividad, modalidad, estado y demás antecedentes.';
    save.textContent='Guardar cambios';
    document.getElementById('fFecha').value=dateToInput(editingEvent.FECHA);
    setActivityTime(formatTime(editingEvent.HORA));
    document.getElementById('fActividad').value=editingEvent.ACTIVIDAD||'';
    document.getElementById('fModalidad').value=normalizeModality(editingEvent.MODALIDAD);
    document.getElementById('fEstado').value=getStatus(editingEvent);
    document.getElementById('fLugar').value=editingEvent.LUGAR||'';
    document.getElementById('fParticipantes').value=editingEvent.PARTICIPANTES||'';
  } else {
    title.textContent='➕ Nueva actividad'; subtitle.textContent='Registra la actividad y sus antecedentes principales.'; save.textContent='Guardar actividad';
    document.getElementById('fFecha').value=new Date().toISOString().split('T')[0];
  }
  activityModal.classList.add('open');
  setTimeout(()=>document.getElementById('fActividad').focus(),280);
}

function closeActivityModal() {
  activityModal.classList.remove('open');
  timePickerModal.classList.remove('open');
  editingEvent=null;
  if(activityDictationRecognition?.isActive?.()) activityDictationRecognition.stop();
}

document.getElementById('navAdd').addEventListener('click',()=>openActivityModal('add'));
document.getElementById('btnCancelarModal').addEventListener('click',closeActivityModal);
document.getElementById('btnCloseActivityModal').addEventListener('click',closeActivityModal);

activityModal.addEventListener('click',event=>{if(event.target===activityModal)closeActivityModal();});

function clampTimePart(value,min,max){
  const number=Number.parseInt(value,10);
  return Number.isFinite(number)?Math.min(max,Math.max(min,number)):min;
}

function roundToFive(value){
  return Math.min(55,Math.max(0,Math.round(value/5)*5));
}

function syncTimePickerFields(){
  const total=((timePickerTotalMinutes%(24*60))+(24*60))%(24*60);
  const hour=Math.floor(total/60);
  const minute=total%60;
  timePickerHour.value=String(hour).padStart(2,'0');
  timePickerMinute.value=String(minute).padStart(2,'0');
}

function readTimePickerFields(){
  const hour=clampTimePart(timePickerHour.value,0,23);
  const minute=roundToFive(clampTimePart(timePickerMinute.value,0,59));
  timePickerTotalMinutes=hour*60+minute;
  syncTimePickerFields();
}

function defaultPickerTime(){
  const current=new Date();
  const rounded=Math.ceil((current.getHours()*60+current.getMinutes())/15)*15;
  return rounded%(24*60);
}

function openTimePicker(){
  if(hiddenTimeInput.value){
    const [hour,minute]=hiddenTimeInput.value.split(':').map(Number);
    timePickerTotalMinutes=hour*60+minute;
  }else{
    timePickerTotalMinutes=defaultPickerTime();
  }
  document.activeElement?.blur?.();
  syncTimePickerFields();
  timePickerModal.classList.add('open');
  requestAnimationFrame(()=>{
    const modal=timePickerModal.querySelector('.time-picker-modal');
    if(modal) modal.scrollTop=0;
  });
}

function closeTimePicker(){
  timePickerHour.blur();
  timePickerMinute.blur();
  timePickerModal.classList.remove('open');
}

document.getElementById('timeFieldButton').addEventListener('click',openTimePicker);
document.getElementById('btnCloseTimePicker').addEventListener('click',closeTimePicker);
document.getElementById('btnCancelTimePicker').addEventListener('click',closeTimePicker);
timePickerModal.addEventListener('click',event=>{if(event.target===timePickerModal)closeTimePicker();});

document.getElementById('timeMinus15').addEventListener('click',()=>{
  readTimePickerFields();
  timePickerTotalMinutes=(timePickerTotalMinutes-15+24*60)%(24*60);
  syncTimePickerFields();
});
document.getElementById('timePlus15').addEventListener('click',()=>{
  readTimePickerFields();
  timePickerTotalMinutes=(timePickerTotalMinutes+15)%(24*60);
  syncTimePickerFields();
});
timePickerHour.addEventListener('change',readTimePickerFields);
timePickerMinute.addEventListener('change',readTimePickerFields);
[timePickerHour,timePickerMinute].forEach(input=>input.addEventListener('focus',()=>{
  window.setTimeout(()=>input.scrollIntoView({block:'center',behavior:'smooth'}),180);
}));

document.querySelectorAll('[data-picker-time]').forEach(button=>button.addEventListener('click',()=>{
  const [hour,minute]=button.dataset.pickerTime.split(':').map(Number);
  timePickerTotalMinutes=hour*60+minute;
  syncTimePickerFields();
}));

document.getElementById('btnClearTime').addEventListener('click',()=>{
  setActivityTime('');
  closeTimePicker();
});
document.getElementById('btnConfirmTime').addEventListener('click',()=>{
  readTimePickerFields();
  const hour=Math.floor(timePickerTotalMinutes/60);
  const minute=timePickerTotalMinutes%60;
  setActivityTime(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
  closeTimePicker();
});
document.querySelectorAll('.time-shortcuts button').forEach(button=>button.addEventListener('click',()=>{
  setActivityTime(button.dataset.time||'');
}));


function getFormEvent() {
  const inputDate=document.getElementById('fFecha').value;
  return {
    FECHA:normalizeDateKey(inputToDate(inputDate)),
    'DÍA':dayNameFromInput(inputDate),
    HORA:normalizeTimeValue(document.getElementById('fHora').value),
    MODALIDAD:normalizeModality(document.getElementById('fModalidad').value),
    ACTIVIDAD:document.getElementById('fActividad').value.trim(),
    LUGAR:document.getElementById('fLugar').value.trim(),
    PARTICIPANTES:document.getElementById('fParticipantes').value.trim(),
    ESTADO:normalizeStatus(document.getElementById('fEstado').value),
  };
}

document.getElementById('btnGuardar').addEventListener('click',async()=>{
  const data=getFormEvent();
  const message=document.getElementById('formMsg');
  const button=document.getElementById('btnGuardar');
  if (!data.FECHA||!data.ACTIVIDAD) { message.textContent='⚠️ Completa la fecha y la actividad.'; return; }
  button.disabled=true; button.textContent=editingEvent?'Guardando cambios…':'Guardando…'; message.textContent='';
  try {
    if (editingEvent) {
      const original={...editingEvent};
      await sendScriptAction('editar',{
        fila:original._row,fechaOriginal:original.FECHA,horaOriginal:original.HORA,actividadOriginal:original.ACTIVIDAD,
        fecha:data.FECHA,dia:data['DÍA'],hora:data.HORA,modalidad:data.MODALIDAD,actividad:data.ACTIVIDAD,
        lugar:data.LUGAR,participantes:data.PARTICIPANTES,estado:data.ESTADO
      });
      Object.assign(editingEvent,data);
      haptic([18,35,18]); showToast('✓ Actividad actualizada');
    } else {
      const result=await sendScriptAction('nueva',{
        fecha:data.FECHA,dia:data['DÍA'],hora:data.HORA,modalidad:data.MODALIDAD,actividad:data.ACTIVIDAD,
        lugar:data.LUGAR,participantes:data.PARTICIPANTES,estado:data.ESTADO
      });
      const tempRow=Math.max(1,...allEvents.map(e=>Number(e._row)||1))+1;
      allEvents.push({...data,_row:Number(result.row)||tempRow});
      haptic([18,35,18]); showToast('✓ Actividad creada');
    }
    closeActivityModal(); updateHeaderStats(); buildTabs(); render(); scheduleRefresh();
  } catch (error) {
    message.textContent=`⚠️ ${error.message||'No fue posible sincronizar con la planilla.'}`;
  } finally {
    button.disabled=false; button.textContent=editingEvent?'Guardar cambios':'Guardar actividad';
  }
});

function openDeleteModal(event) {
  pendingDeleteEvent=event;
  document.getElementById('deleteActivityName').textContent=`“${event.ACTIVIDAD}”`;
  document.getElementById('deleteMsg').textContent='';
  deleteModal.classList.add('open');
}

function closeDeleteModal() { deleteModal.classList.remove('open'); pendingDeleteEvent=null; }

document.getElementById('btnCloseDeleteModal').addEventListener('click',closeDeleteModal);
document.getElementById('btnCancelDelete').addEventListener('click',closeDeleteModal);
deleteModal.addEventListener('click',event=>{if(event.target===deleteModal)closeDeleteModal();});

document.getElementById('btnConfirmDelete').addEventListener('click',async()=>{
  if(!pendingDeleteEvent) return;
  const item=pendingDeleteEvent;
  const button=document.getElementById('btnConfirmDelete');
  const message=document.getElementById('deleteMsg');
  button.disabled=true; button.textContent='Eliminando…'; message.textContent='';
  try {
    await sendScriptAction('eliminar',{fila:item._row,fecha:item.FECHA,hora:item.HORA,actividad:item.ACTIVIDAD});
    allEvents=allEvents.filter(event=>event!==item);
    closeDeleteModal(); updateHeaderStats(); buildTabs(); render(); haptic(28); showToast('✓ Actividad eliminada'); scheduleRefresh();
  } catch (error) { message.textContent=`⚠️ ${error.message||'No fue posible eliminar la actividad.'}`; }
  finally { button.disabled=false; button.textContent='Sí, eliminar actividad'; }
});

function sendScriptAction(action,params={}) {
  if (!SCRIPT_URL) return Promise.reject(new Error('SCRIPT_URL no configurada'));
  return new Promise((resolve,reject)=>{
    const callbackName=`__agenda_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
    const query=new URLSearchParams({
      accion:action,
      requestId:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      callback:callbackName
    });
    Object.entries(params).forEach(([key,value])=>query.set(key,value??''));

    const script=document.createElement('script');
    let finished=false;
    const cleanup=()=>{
      if(finished) return;
      finished=true;
      clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName]=undefined; }
    };
    const fail=message=>{ cleanup(); reject(new Error(message)); };
    const timer=setTimeout(()=>fail('La planilla no respondió. Revisa la conexión o la implementación de Apps Script.'),15000);

    window[callbackName]=payload=>{
      if(payload&&payload.ok){ cleanup(); resolve(payload); }
      else fail(payload?.error||'Google Sheets rechazó la operación.');
    };
    script.onerror=()=>fail('No fue posible conectar con Google Apps Script.');
    script.src=`${SCRIPT_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>loadData({silent:true}),2200);
}

const MESES={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
const NUMEROS={uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciséis:16,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,'veintidós':22,veintidos:22,'veintitrés':23,veintitres:23,veinticuatro:24,veinticinco:25,'veintiséis':26,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,'treinta y uno':31};
const WEEKDAYS={domingo:0,lunes:1,martes:2,miércoles:3,miercoles:3,jueves:4,viernes:5,sábado:6,sabado:6};

function nextWeekdayDate(dayIndex){
  const today=todayAtMidnight();
  let delta=(dayIndex-today.getDay()+7)%7;
  if(delta===0) delta=7;
  const date=new Date(today); date.setDate(today.getDate()+delta); return date;
}

function parseSpanishQuery(query) {
  const lower=query.toLowerCase().trim(); let targetDate=null;
  const today=todayAtMidnight();
  if(/\bpasado mañana\b/.test(lower)){ targetDate=new Date(today); targetDate.setDate(today.getDate()+2); }
  else if(/\bmañana\b/.test(lower)){ targetDate=new Date(today); targetDate.setDate(today.getDate()+1); }
  else if(/\bhoy\b/.test(lower)){ targetDate=today; }
  for (const [word,number] of Object.entries(NUMEROS)) {
    for (const [monthName,monthNumber] of Object.entries(MESES)) {
      if (lower.includes(`${word} de ${monthName}`)||lower.includes(`${word} ${monthName}`)) { targetDate=new Date(new Date().getFullYear(),monthNumber,number); break; }
    }
    if (targetDate) break;
  }
  if (!targetDate) { const match=lower.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)/); if(match&&MESES[match[2]]!==undefined)targetDate=new Date(new Date().getFullYear(),MESES[match[2]],Number(match[1])); }
  if (!targetDate) { const match=lower.match(/(\d{1,2})[\/-](\d{1,2})/); if(match)targetDate=new Date(new Date().getFullYear(),Number(match[2])-1,Number(match[1])); }
  if (!targetDate) {
    const weekday=Object.keys(WEEKDAYS).find(name=>new RegExp(`\\b${name}\\b`).test(lower));
    if(weekday) targetDate=nextWeekdayDate(WEEKDAYS[weekday]);
  }
  return {targetDate,rawQuery:lower};
}

function hasExplicitDateExpression(query){
  const lower=String(query||'').toLowerCase();
  const monthNames=Object.keys(MESES).join('|');
  const numberWords=Object.keys(NUMEROS).sort((a,b)=>b.length-a.length).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  return new RegExp(`(?:\\b\\d{1,2}\\s*(?:de\\s+)?(?:${monthNames})\\b)|(?:\\b(?:${numberWords})\\s+(?:de\\s+)?(?:${monthNames})\\b)|(?:\\b\\d{1,2}[/-]\\d{1,2}\\b)`).test(lower);
}

function formatVoiceDate(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime())) return '';
  const text=date.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});
  return text.charAt(0).toUpperCase()+text.slice(1);
}

function searchEvents(query) {
  if (!query.trim()) return null;
  const {targetDate,rawQuery}=parseSpanishQuery(query);
  let base=[...allEvents];
  if (/\b(esta semana|semana)\b/.test(rawQuery)&&!targetDate) base=filterEvents('semana');
  else if (targetDate) base=base.filter(event=>sameDay(parseDate(event.FECHA),targetDate));

  const modality=rawQuery.includes('telem')||rawQuery.includes('virtual')?'Telemática':rawQuery.includes('híbr')||rawQuery.includes('hibr')?'Híbrida':rawQuery.includes('presencial')?'Presencial':null;
  if(modality) base=base.filter(event=>normalizeModality(event.MODALIDAD)===modality);

  const status=rawQuery.includes('por confirmar')?'Por Confirmar':rawQuery.includes('pendiente')?'Pendiente':rawQuery.includes('ausente')||rawQuery.includes('permiso')?'Ausente':rawQuery.includes('cancelad')?'Cancelada':rawQuery.includes('confirmad')?'Confirmada':null;
  if(status) base=base.filter(event=>status==='Ausente'?isCalendarAbsenceEvent(event):getStatus(event)===status);

  const commandWords=['muéstrame','muestrame','mostrar','muestra','qué','que','tengo','agenda','actividad','actividades','para','del','de','el','la','las','los','esta','este','buscar','busca','ver'];
  const words=rawQuery.split(/\s+/).map(word=>word.replace(/[^a-záéíóúñ0-9]/g,'')).filter(word=>word.length>2&&!commandWords.includes(word)&&!Object.keys(WEEKDAYS).includes(word)&&!Object.keys(MESES).includes(word)&&!['mañana','hoy','semana','presencial','presenciales','telemática','telematicas','telemáticas','híbrida','hibrida','híbridas','hibridas','confirmada','confirmadas','pendiente','pendientes','ausente','cancelada'].includes(word));
  if(targetDate||modality||status||/\b(esta semana|semana)\b/.test(rawQuery)){
    if(!words.length) return base.slice().sort((a,b)=>parseDate(a.FECHA)-parseDate(b.FECHA)||compareEventsChronologically(a,b));
  }
  const getText=event=>[event.ACTIVIDAD,event.LUGAR,event.PARTICIPANTES,normalizeModality(event.MODALIDAD),getStatus(event)].join(' ').toLowerCase();
  if(!words.length) return base.slice().sort((a,b)=>parseDate(a.FECHA)-parseDate(b.FECHA)||compareEventsChronologically(a,b));
  let results=base.filter(event=>words.every(word=>getText(event).includes(word)));
  if(results.length) return results;
  return base.filter(event=>words.some(word=>getText(event).includes(word)));
}

const searchInput=document.getElementById('searchInput');
function showSearchResults(query,results,voice=false){
  const info=document.getElementById('searchInfo');
  const parsed=parseSpanishQuery(query);
  const exactDateEmpty=!results.length&&parsed.targetDate&&hasExplicitDateExpression(query);
  const dateLabel=exactDateEmpty?formatVoiceDate(parsed.targetDate):'';
  info.style.display='block';
  info.classList.toggle('voice-date-feedback',exactDateEmpty);
  info.textContent=results.length
    ? `${voice?'Orden comprendida · ':''}${results.length} resultado${results.length!==1?'s':''} para “${query}”`
    : exactDateEmpty
      ? `Sin actividad agendada para ${dateLabel}.`
      : `Sin resultados para “${query}”`;
  document.getElementById('content').innerHTML=results.length
    ? renderGroups(results)
    : exactDateEmpty
      ? `<div class="empty empty-date"><div class="icon">✓</div><p><strong>Sin actividad agendada</strong><br>${escapeHTML(dateLabel)}</p></div>`
      : `<div class="empty"><div class="icon">🔍</div><p>Sin resultados para<br><strong>${escapeHTML(query)}</strong></p></div>`;
  bindCardActions();
}

function handleSearch(query) {
  document.getElementById('clearSearch').style.display=query?'block':'none';
  const info=document.getElementById('searchInfo');
  if (!query.trim()) { info.style.display='none'; render(); return; }
  showSearchResults(query,searchEvents(query)||[],false);
}

function executeVoiceCommand(text){
  const normalized=text.toLowerCase().trim();
  const parsedCommand=parseSpanishQuery(normalized);
  if(parsedCommand.targetDate&&hasExplicitDateExpression(normalized)&&/\b(actividad|actividades|agenda|tengo|hay|programad|qué|que)\b/.test(normalized)){
    const dateEvents=allEvents.filter(event=>sameDay(parseDate(event.FECHA),parsedCommand.targetDate)).sort(compareEventsChronologically);
    selectedCalDate=new Date(parsedCommand.targetDate);
    calendarDate=new Date(parsedCommand.targetDate.getFullYear(),parsedCommand.targetDate.getMonth(),1);
    setView('calendario');
    render();
    const dateLabel=formatVoiceDate(parsedCommand.targetDate);
    const info=document.getElementById('searchInfo');
    info.style.display='block';
    info.classList.add('voice-date-feedback');
    if(dateEvents.length){
      info.textContent=`${dateEvents.length} ${dateEvents.length===1?'actividad agendada':'actividades agendadas'} para ${dateLabel}.`;
      showToast(`${dateEvents.length} ${dateEvents.length===1?'actividad':'actividades'} · ${dateLabel}`);
    }else{
      info.textContent=`Sin actividad agendada para ${dateLabel}.`;
      showToast('Sin actividad agendada');
    }
    haptic(12);
    return;
  }
  if(/\b(calendario|mes)\b/.test(normalized)&&!/(actividad|tengo|buscar|busca)/.test(normalized)){
    const parsed=parseSpanishQuery(normalized);
    if(parsed.targetDate){ selectedCalDate=parsed.targetDate; calendarDate=new Date(parsed.targetDate.getFullYear(),parsed.targetDate.getMonth(),1); }
    setView('calendario'); render(); showToast('Calendario abierto'); return;
  }
  if(/\b(próxima actividad|proxima actividad|qué sigue|que sigue)\b/.test(normalized)){
    const next=nextTimedEventForToday();
    if(next){
      setView('buscar'); searchInput.value=text; showSearchResults(text,[next],true); showToast(`Próxima: ${formatTime(next.HORA)}`);
    }else showToast('No quedan actividades con hora para hoy');
    return;
  }
  setView('buscar');
  searchInput.value=text;
  document.getElementById('clearSearch').style.display='block';
  const results=searchEvents(text)||[];
  showSearchResults(text,results,true);
  haptic(12);
}

searchInput.addEventListener('input',event=>handleSearch(event.target.value));
document.getElementById('clearSearch').addEventListener('click',()=>{searchInput.value='';handleSearch('');searchInput.focus();});


const activityVoiceBtn=document.getElementById('activityVoiceBtn');
const activityVoiceHint=document.getElementById('activityVoiceHint');
const voiceBtn=document.getElementById('voiceBtn');
const SpeechRecognitionAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
const speechUA=navigator.userAgent||'';
const speechIsIOS=/iPad|iPhone|iPod/.test(speechUA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const speechIsIOSAlternative=speechIsIOS&&/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/.test(speechUA);
const speechIsStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

function speechErrorMessage(code=''){
  const messages={
    'not-allowed':'Permiso de voz bloqueado. En iPhone, revise el micrófono y que Siri esté activada.',
    'service-not-allowed':'La voz no está disponible aquí. En iPhone, use Safari o la aplicación instalada y active Siri.',
    'audio-capture':'No fue posible acceder al micrófono.',
    'no-speech':'No se detectó voz. Toque el micrófono e intente nuevamente.',
    'network':'El reconocimiento de voz necesita conexión en este dispositivo.',
    'language-not-supported':'El reconocimiento no admite español en este dispositivo.'
  };
  return messages[code]||'No fue posible reconocer la voz. Intente nuevamente.';
}

function createSpeechController({button,onPending,onListening,onTranscript,onError,onIdle}){
  let recognition=null;
  let state='idle';
  let startTimer=0;
  let listenTimer=0;
  let finalized=true;
  let manualStop=false;
  let gotResult=false;

  const clearTimers=()=>{
    window.clearTimeout(startTimer);
    window.clearTimeout(listenTimer);
    startTimer=0;
    listenTimer=0;
  };

  const setVisualState=next=>{
    state=next;
    button.classList.toggle('starting',next==='starting');
    button.classList.toggle('listening',next==='listening');
    button.setAttribute('aria-busy',next==='idle'?'false':'true');
  };

  const finalize=(reason='end')=>{
    if(finalized) return;
    finalized=true;
    clearTimers();
    recognition=null;
    setVisualState('idle');
    onIdle?.(reason,gotResult);
  };

  const stop=()=>{
    if(state==='idle') return;
    manualStop=true;
    const current=recognition;
    try{ current?.abort(); }catch(_){ }
    finalize('cancel');
  };

  const start=()=>{
    if(!SpeechRecognitionAPI){
      onError?.('El reconocimiento de voz no está disponible en este navegador.');
      return;
    }
    if(speechIsIOSAlternative&&!speechIsStandalone){
      onError?.('En iPhone, abra la agenda desde Safari o desde el ícono instalado para usar la voz.');
      return;
    }
    if(state!=='idle'){
      stop();
      return;
    }

    manualStop=false;
    gotResult=false;
    finalized=false;
    recognition=new SpeechRecognitionAPI();
    const current=recognition;
    current.lang='es-CL';
    current.continuous=false;
    current.interimResults=false;
    current.maxAlternatives=1;
    setVisualState('starting');
    onPending?.();

    current.onstart=()=>{
      if(finalized) return;
      window.clearTimeout(startTimer);
      setVisualState('listening');
      onListening?.();
      listenTimer=window.setTimeout(()=>{
        if(finalized) return;
        try{ current.stop(); }catch(_){ finalize('timeout'); }
      },9000);
    };

    current.onresult=event=>{
      if(finalized) return;
      const transcript=event.results?.[0]?.[0]?.transcript?.trim()||'';
      if(transcript){
        gotResult=true;
        onTranscript?.(transcript);
      }
      try{ current.stop(); }catch(_){ finalize('result'); }
    };

    current.onerror=event=>{
      if(finalized) return;
      const code=event.error||'';
      if(!(manualStop&&code==='aborted')) onError?.(speechErrorMessage(code));
      finalize(code||'error');
    };

    current.onend=()=>{
      if(finalized) return;
      if(!manualStop&&!gotResult) onError?.('No se detectó una instrucción. Toque el micrófono e intente nuevamente.');
      finalize(gotResult?'result':'end');
    };

    try{
      current.start();
      startTimer=window.setTimeout(()=>{
        if(finalized||state!=='starting') return;
        onError?.(speechIsIOS
          ? 'El micrófono no respondió. Verifique Siri y el permiso de micrófono; luego intente nuevamente.'
          : 'El micrófono no respondió. Intente nuevamente.');
        try{ current.abort(); }catch(_){ }
        finalize('start-timeout');
      },2800);
    }catch(error){
      onError?.('No fue posible iniciar el micrófono. Espere un momento e intente nuevamente.');
      finalize('start-error');
    }
  };

  return {start,stop,isActive:()=>state!=='idle'};
}

let activityDictationRecognition=null;
let searchSpeechController=null;

if(!SpeechRecognitionAPI){
  activityVoiceBtn.disabled=true;
  activityVoiceBtn.classList.add('unavailable');
  activityVoiceHint.textContent='El dictado no está disponible en este navegador; puede escribir normalmente.';
  voiceBtn.disabled=true;
  voiceBtn.classList.add('unavailable');
  voiceBtn.title='Voz no disponible en este navegador';
}else{
  activityDictationRecognition=createSpeechController({
    button:activityVoiceBtn,
    onPending:()=>{activityVoiceHint.textContent='Preparando micrófono…';},
    onListening:()=>{activityVoiceHint.textContent='Escuchando… hable con naturalidad.';},
    onTranscript:transcript=>{
      const field=document.getElementById('fActividad');
      field.value=[field.value.trim(),transcript].filter(Boolean).join(' ');
      field.focus();
      field.setSelectionRange(field.value.length,field.value.length);
      activityVoiceHint.textContent='Dictado incorporado. Puede corregirlo antes de guardar.';
    },
    onError:message=>{activityVoiceHint.textContent=message;},
    onIdle:(reason,gotResult)=>{
      if(!gotResult&&['cancel'].includes(reason)) activityVoiceHint.textContent='Puede escribir o usar el micrófono.';
    }
  });

  searchSpeechController=createSpeechController({
    button:voiceBtn,
    onPending:()=>showToast('Preparando micrófono…'),
    onListening:()=>showToast('🎙️ Escuchando: diga una fecha o actividad'),
    onTranscript:text=>executeVoiceCommand(text),
    onError:message=>showToast(message)
  });

  activityVoiceBtn.addEventListener('click',()=>activityDictationRecognition.start());
  voiceBtn.addEventListener('click',()=>searchSpeechController.start());
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='hidden') return;
  activityDictationRecognition?.stop?.();
  searchSpeechController?.stop?.();
});

function showToast(message) {
  const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2800);
}

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;
  closeDropdown();
  if(timePickerModal.classList.contains('open')) { closeTimePicker(); return; }
  if(activityModal.classList.contains('open')) closeActivityModal();
  if(deleteModal.classList.contains('open')) closeDeleteModal();
});




// Encabezado adaptativo móvil estable: usa umbrales separados para impedir parpadeos.
let adaptiveHeaderFrame=0;
let adaptiveHeaderPinnedOpenAt=null;

function expandAdaptiveHeader(){
  document.body.classList.remove('header-collapsed');
}

function collapseAdaptiveHeader(){
  document.body.classList.add('header-collapsed');
}

function updateAdaptiveHeader({forceExpanded=false}={}){
  const mobile=window.matchMedia('(max-width: 759px)').matches;
  const calendarView=currentView==='calendario';
  const y=Math.max(0,window.scrollY);

  if(forceExpanded||!mobile||!calendarView){
    adaptiveHeaderPinnedOpenAt=null;
    expandAdaptiveHeader();
    return;
  }

  if(y<=24){
    adaptiveHeaderPinnedOpenAt=null;
    expandAdaptiveHeader();
    return;
  }

  if(adaptiveHeaderPinnedOpenAt!==null){
    if(y>adaptiveHeaderPinnedOpenAt+48){
      adaptiveHeaderPinnedOpenAt=null;
      collapseAdaptiveHeader();
    }else{
      expandAdaptiveHeader();
    }
    return;
  }

  if(y>=112) collapseAdaptiveHeader();
}

window.addEventListener('scroll',()=>{
  if(adaptiveHeaderFrame) return;
  adaptiveHeaderFrame=requestAnimationFrame(()=>{
    adaptiveHeaderFrame=0;
    updateAdaptiveHeader();
  });
},{passive:true});

window.addEventListener('resize',()=>updateAdaptiveHeader({forceExpanded:true}));

document.getElementById('appHeader')?.addEventListener('click',event=>{
  if(
    currentView==='calendario'&&
    document.body.classList.contains('header-collapsed')&&
    !event.target.closest('button')
  ){
    adaptiveHeaderPinnedOpenAt=window.scrollY;
    expandAdaptiveHeader();
  }
});


const themeToggle = document.getElementById('themeToggle');
const themeColorMeta = document.getElementById('themeColorMeta');

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function syncThemeControls() {
  const theme = currentTheme();
  const nextThemeName = theme === 'dark' ? 'claro' : 'oscuro';
  themeToggle.setAttribute('aria-label', `Cambiar a modo ${nextThemeName}`);
  themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  themeToggle.title = `Modo ${theme === 'dark' ? 'oscuro' : 'claro'} · Cambiar a ${nextThemeName}`;
  if (themeColorMeta) themeColorMeta.content = theme === 'dark' ? '#101d49' : '#f4f7fb';
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  if (persist) {
    try { localStorage.setItem('agenda-theme', currentTheme()); } catch (_) {}
  }
  syncThemeControls();
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(next === 'light' ? '☀ Modo claro activado' : '☾ Modo oscuro activado');
});

syncThemeControls();


// Bienvenida de inicio. La agenda carga detrás y la animación nunca bloquea más de 1,6 s.
const launchScreen=document.getElementById('launchScreen');
const launchStartedAt=performance.now();
let launchDismissRequested=false;

function dismissLaunchScreen(){
  if(!launchScreen||launchDismissRequested) return;
  launchDismissRequested=true;

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minimumVisibleTime=reduceMotion?900:2400;
  const elapsed=performance.now()-launchStartedAt;
  const delay=Math.max(0,minimumVisibleTime-elapsed);

  window.setTimeout(()=>{
    launchScreen.classList.add('leaving');
    window.setTimeout(()=>launchScreen.remove(),reduceMotion?160:460);
  },delay);
}

// Respaldo: incluso con una red lenta, la interfaz queda disponible rápidamente.
window.setTimeout(dismissLaunchScreen,3200);


async function loadData({silent=false}={}) {
  if(!silent) document.getElementById('content').innerHTML='<div class="loading"><div class="spinner"></div>Cargando agenda…</div>';
  try {
    const demoMode=new URLSearchParams(window.location.search).has('demo');
    if(demoMode){
      const today=new Date();
      const key=offset=>formatDateKey(new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset));
      allEvents=[
        {FECHA:key(0),'DÍA':'Hoy',HORA:'09:00',MODALIDAD:'Presencial',ACTIVIDAD:'Reunión de coordinación de Presidencia',LUGAR:'Sala de reuniones',PARTICIPANTES:'Equipo de Presidencia',ESTADO:'Confirmada',_row:2},
        {FECHA:key(0),'DÍA':'Hoy',HORA:'12:30',MODALIDAD:'Híbrida',ACTIVIDAD:'Pleno extraordinario',LUGAR:'Salón de Pleno',PARTICIPANTES:'Ministras y ministros',ESTADO:'Por Confirmar',_row:3},
        {FECHA:key(0),'DÍA':'Hoy',HORA:'16:00',MODALIDAD:'Telemática',ACTIVIDAD:'Reunión con administración zonal',LUGAR:'Enlace institucional',PARTICIPANTES:'Administración',ESTADO:'Confirmada',_row:4},
        {FECHA:key(1),'DÍA':'Mañana',HORA:'10:00',MODALIDAD:'Telemática',ACTIVIDAD:'Audiencia protocolar',LUGAR:'Enlace institucional',PARTICIPANTES:'Autoridades regionales',ESTADO:'Pendiente',_row:5},
        {FECHA:key(2),'DÍA':'',HORA:'',MODALIDAD:'Otro',ACTIVIDAD:'Feriado legal de la Presidenta',LUGAR:'',PARTICIPANTES:'',ESTADO:'Ausente',_row:5},
        {FECHA:key(4),'DÍA':'',HORA:'15:30',MODALIDAD:'Presencial',ACTIVIDAD:'Ceremonia de juramento',LUGAR:'Tercera Sala',PARTICIPANTES:'Invitados',ESTADO:'Confirmada',_row:6}
      ];
      lastSuccessfulLoadAt=Date.now();
      updateHeaderStats();buildTabs();render();dismissLaunchScreen();return;
    }
    const response=await fetch(`${CSV_URL}&t=${Date.now()}`,{cache:'no-store'});
    if(!response.ok) throw new Error('No fue posible cargar la planilla');
    const text=await response.text();
    allEvents=parseCSV(text);
    lastSuccessfulLoadAt=Date.now();
    updateHeaderStats();buildTabs();render();dismissLaunchScreen();
    if(silent) showToast('↻ Agenda sincronizada');
  } catch(error) {
    dismissLaunchScreen();
    if(!silent) document.getElementById('content').innerHTML='<div class="empty"><div class="icon">⚠️</div><p>Error al cargar.<br>Verifica la conexión.</p></div>';
  }
}


// Sincronización automática: no requiere un botón permanente en la cabecera.
function refreshAgendaIfStale() {
  const twoMinutes = 2 * 60 * 1000;
  if (!lastSuccessfulLoadAt || Date.now() - lastSuccessfulLoadAt >= twoMinutes) {
    loadData({silent:true});
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshAgendaIfStale();
});

window.addEventListener('online', () => loadData({silent:true}));

loadData();


// Habilita instalación como aplicación y actualizaciones seguras del shell visual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {
      // La agenda sigue funcionando aunque el navegador no admita el service worker.
    });
  });
}
