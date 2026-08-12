/* Agenda Presidenta 6.1.0 · sesión de voz móvil robusta sin eco acumulativo */
(function(global){
'use strict';

function compact(text=''){return String(text).replace(/\s+/g,' ').trim();}
function foldToken(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ]+/g,'');
}
function tokens(text=''){
  return compact(text).split(' ').filter(Boolean).map(raw=>({raw,norm:foldToken(raw)})).filter(item=>item.norm);
}
function findSequence(haystack,needle){
  if(!needle.length||needle.length>haystack.length)return -1;
  outer:for(let i=0;i<=haystack.length-needle.length;i++){
    for(let j=0;j<needle.length;j++)if(haystack[i+j]!==needle[j])continue outer;
    return i;
  }
  return -1;
}
function joinTokenObjects(items){return compact(items.map(item=>item.raw).join(' '));}


/**
 * Convierte la lista de resultados de Web Speech en UNA sola hipótesis coherente.
 *
 * Android/Chrome puede devolver algo como:
 *   "Reunión"
 *   "Reunión de pleno"
 *   "Reunión de pleno día quince"
 *
 * Esas entradas NO son frases consecutivas: son versiones crecientes de la
 * misma frase. Por eso se reconcilian con mergeTranscript en vez de unirlas
 * con espacios.
 */
function canonicalizeResultTexts(items){
  let text='';
  for(const item of (items||[])){
    const value=compact(typeof item==='string'?item:item?.text||'');
    if(!value) continue;
    text=mergeTranscript(text,value);
  }
  return compact(text);
}

function transcriptEchoScore(text=''){
  const norms=tokens(text).map(item=>item.norm);
  if(norms.length<24)return 0;
  const grams=[];
  for(let i=0;i<=norms.length-4;i++)grams.push(norms.slice(i,i+4).join('|'));
  if(!grams.length)return 0;
  const unique=new Set(grams);
  return 1-(unique.size/grams.length);
}

function hasPathologicalEcho(text=''){
  const wordCount=tokens(text).length;
  if(wordCount<36)return false;
  return transcriptEchoScore(text)>=0.34;
}

/**
 * Une dos transcripciones evitando el patrón típico de Android/Chrome donde
 * el reconocimiento vuelve a entregar una frase anterior cada vez más larga.
 */
function mergeTranscript(base,incoming){
  const b=compact(base),n=compact(incoming);
  if(!b)return n;if(!n)return b;
  const bt=tokens(b),nt=tokens(n),bn=bt.map(x=>x.norm),nn=nt.map(x=>x.norm);
  if(!bn.length)return n;if(!nn.length)return b;

  const incomingInsideBase=findSequence(bn,nn);
  if(incomingInsideBase>=0)return b;
  const baseInsideIncoming=findSequence(nn,bn);
  if(baseInsideIncoming>=0)return n;

  // El caso acumulativo más común: mismo comienzo, pero la nueva hipótesis crece.
  let commonPrefix=0;
  while(commonPrefix<bn.length&&commonPrefix<nn.length&&bn[commonPrefix]===nn[commonPrefix])commonPrefix++;
  const shorter=Math.min(bn.length,nn.length);
  if(commonPrefix>=2&&commonPrefix/shorter>=0.55){
    return nn.length>=bn.length?n:b;
  }

  // Segundo caso común: el nuevo bloque repite el final del bloque anterior.
  let best=0;
  const max=Math.min(bn.length,nn.length);
  for(let k=max;k>=1;k--){
    let ok=true;
    for(let j=0;j<k;j++)if(bn[bn.length-k+j]!==nn[j]){ok=false;break;}
    if(ok){best=k;break;}
  }
  // Un solo token solo se usa si es suficientemente distintivo.
  if(best===1&&String(bt[bt.length-1]?.norm||'').length<5)best=0;
  if(best>0)return compact(`${b} ${joinTokenObjects(nt.slice(best))}`);

  // Si el bloque entrante es una versión anterior del comienzo, no la repetimos.
  let reverse=0;
  for(let k=max;k>=2;k--){
    let ok=true;
    for(let j=0;j<k;j++)if(nn[nn.length-k+j]!==bn[j]){ok=false;break;}
    if(ok){reverse=k;break;}
  }
  if(reverse>=2)return b;

  return compact(`${b} ${n}`);
}

function create(options={}){
  const Recognition=options.Recognition;
  const lang=options.lang||'es-CL';
  const maxMs=Math.max(15000,Number(options.maxMs)||120000);
  const restartDelay=Math.max(120,Number(options.restartDelay)||220);
  const finishGraceMs=Math.max(220,Number(options.finishGraceMs)||700);
  const onState=typeof options.onState==='function'?options.onState:()=>{};
  const onTranscript=typeof options.onTranscript==='function'?options.onTranscript:()=>{};
  const onTick=typeof options.onTick==='function'?options.onTick:()=>{};
  const onDone=typeof options.onDone==='function'?options.onDone:()=>{};
  const onError=typeof options.onError==='function'?options.onError:()=>{};

  let recognition=null,active=false,finishing=false,startedAt=0,lastState='idle',finishReason='manual';
  let maxTimer=0,tickTimer=0,restartTimer=0,finishTimer=0;
  let committed='',currentSnapshot='',currentSlots=[];

  const setState=(state,detail='')=>{lastState=state;onState(state,detail);};
  const clearTimeoutSafe=id=>{if(id)clearTimeout(id);};
  const clearAll=()=>{clearTimeoutSafe(maxTimer);clearTimeoutSafe(restartTimer);clearTimeoutSafe(finishTimer);if(tickTimer)clearInterval(tickTimer);maxTimer=restartTimer=finishTimer=tickTimer=0;};
  const liveText=()=>mergeTranscript(committed,currentSnapshot);
  const emit=()=>onTranscript(liveText(),{committedText:committed,currentText:currentSnapshot});
  const commitCurrent=()=>{if(currentSnapshot)committed=mergeTranscript(committed,currentSnapshot);currentSnapshot='';currentSlots=[];};
  const errorMessage=code=>({
    'not-allowed':'Permiso de voz bloqueado. Autorice el micrófono y vuelva a intentarlo.',
    'service-not-allowed':'El servicio de reconocimiento de voz no está disponible en este navegador.',
    'audio-capture':'No fue posible acceder al micrófono.',
    'network':'El reconocimiento de voz perdió la conexión.',
    'language-not-supported':'El reconocimiento de voz no admite español en este dispositivo.'
  }[code]||'No fue posible continuar con el reconocimiento de voz.');

  const fatal=(message,code='error')=>{
    active=false;finishing=false;clearAll();
    try{recognition?.abort?.();}catch(_){ }
    recognition=null;setState('error',code);onError(message,code);
  };

  const completeFinish=()=>{
    clearTimeoutSafe(finishTimer);finishTimer=0;
    if(!finishing)return false;
    commitCurrent();
    const text=compact(committed);
    finishing=false;active=false;recognition=null;
    if(!text){setState('error','empty');onError('No alcancé a registrar palabras. Mantenga pulsado e intente nuevamente.','empty');return false;}

    // Barrera de seguridad: nunca abrir el formulario con una transcripción
    // claramente dañada por un eco repetitivo del motor de voz.
    if(hasPathologicalEcho(text)){
      setState('error','echo');
      onError('El reconocimiento repitió parte del dictado. No se creó ninguna actividad. Mantenga pulsado y vuelva a intentarlo.','echo');
      return false;
    }

    emit();setState('idle',finishReason);onDone(text,finishReason);return true;
  };

  const scheduleRestart=()=>{
    if(!active||finishing)return;
    clearTimeoutSafe(restartTimer);setState('restarting');
    restartTimer=setTimeout(()=>startRecognizer(),restartDelay);
  };

  const rebuildSnapshot=results=>{
    const len=Number(results?.length)||0;
    const slots=[];
    for(let i=0;i<len;i++){
      const result=results[i];
      const text=compact(result?.[0]?.transcript||'');
      if(text)slots.push({index:i,text,isFinal:Boolean(result?.isFinal)});
    }
    currentSlots=slots;

    // NO usar slots.map(...).join(' '): Android puede exponer hipótesis
    // acumulativas como resultados separados y eso crea el eco observado.
    currentSnapshot=canonicalizeResultTexts(slots);
    emit();
  };

  const startRecognizer=()=>{
    if(!active||finishing)return;
    if(!Recognition){fatal('El reconocimiento de voz no está disponible en este navegador.','unsupported');return;}
    try{
      currentSnapshot='';currentSlots=[];
      const current=new Recognition();recognition=current;
      current.lang=lang;current.continuous=true;current.interimResults=true;current.maxAlternatives=1;
      current.onstart=()=>{if(current!==recognition||(!active&&!finishing))return;setState('listening');};
      current.onresult=event=>{
        if(current!==recognition||(!active&&!finishing))return;
        // Se reconstruye la hipótesis COMPLETA de este recognizer. Nunca se
        // anexan resultados parciales uno detrás de otro.
        rebuildSnapshot(event.results);
      };
      current.onerror=event=>{
        if(current!==recognition)return;
        const code=event?.error||'error';
        if(finishing&&(code==='aborted'||code==='no-speech'))return;
        if(!active)return;
        if(code==='aborted')return;
        if(code==='no-speech'){setState('waiting','no-speech');return;}
        fatal(errorMessage(code),code);
      };
      current.onend=()=>{
        if(current!==recognition)return;
        // Android puede cerrar una sesión después de una pausa. Conservamos
        // una sola versión del bloque y la reconciliamos con lo anterior.
        commitCurrent();
        recognition=null;
        if(finishing){completeFinish();return;}
        if(active)scheduleRestart();
      };
      current.start();
    }catch(error){
      recognition=null;
      if(finishing){completeFinish();return;}
      if(active)scheduleRestart();
    }
  };

  const start=()=>{
    if(active||finishing)return false;
    if(!Recognition){onError('El reconocimiento de voz no está disponible en este navegador.','unsupported');return false;}
    clearAll();committed='';currentSnapshot='';currentSlots=[];finishing=false;active=true;startedAt=Date.now();finishReason='manual';
    setState('starting');emit();onTick(0,maxMs);
    tickTimer=setInterval(()=>{if(active)onTick(Math.min(Date.now()-startedAt,maxMs),maxMs);},250);
    maxTimer=setTimeout(()=>finish('timeout'),maxMs);startRecognizer();return true;
  };

  const finish=(reason='manual')=>{
    if(finishing)return false;
    if(!active&&lastState!=='error')return false;
    finishing=true;active=false;finishReason=reason;
    clearTimeoutSafe(maxTimer);maxTimer=0;clearTimeoutSafe(restartTimer);restartTimer=0;if(tickTimer){clearInterval(tickTimer);tickTimer=0;}
    setState('processing',reason);
    const current=recognition;
    if(current){
      try{current.stop();}catch(_){try{current.abort();}catch(__){ }}
      finishTimer=setTimeout(completeFinish,finishGraceMs);
    }else finishTimer=setTimeout(completeFinish,80);
    return true;
  };

  const cancel=()=>{
    if(!active&&!finishing&&lastState==='idle')return;
    active=false;finishing=false;clearAll();
    try{recognition?.abort?.();}catch(_){ }
    recognition=null;committed='';currentSnapshot='';currentSlots=[];setState('idle','cancel');
  };

  return {start,finish,cancel,isActive:()=>active,isFinishing:()=>finishing,getTranscript:()=>liveText(),getState:()=>lastState,getElapsed:()=>startedAt?Math.max(0,Date.now()-startedAt):0};
}

global.AgendaLongVoiceSession={create,mergeTranscript,_test:{mergeTranscript,tokens,canonicalizeResultTexts,transcriptEchoScore,hasPathologicalEcho}};
})(typeof window!=='undefined'?window:globalThis);
