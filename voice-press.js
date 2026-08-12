/* Agenda Presidenta 6.1.0 · control pulsar para hablar */
(function(global){
'use strict';
function bind(button,handlers={}){
  if(!button)throw new Error('Se requiere el botón de pulsar para hablar.');
  const onPress=typeof handlers.onPress==='function'?handlers.onPress:()=>{};
  const onRelease=typeof handlers.onRelease==='function'?handlers.onRelease:()=>{};
  const onCancel=typeof handlers.onCancel==='function'?handlers.onCancel:()=>{};
  let pressed=false,pointerId=null,key='';
  const start=(source,event)=>{if(pressed)return false;pressed=true;onPress(source,event);return true;};
  const release=(source,event)=>{if(!pressed)return false;pressed=false;pointerId=null;key='';onRelease(source,event);return true;};
  const cancel=(source,event)=>{if(!pressed)return false;pressed=false;pointerId=null;key='';onCancel(source,event);return true;};
  const pointerdown=e=>{if(e.isPrimary===false||e.button!==undefined&&e.button!==0)return;e.preventDefault?.();pointerId=e.pointerId??1;try{button.setPointerCapture?.(pointerId);}catch(_){}start('pointer',e);};
  const pointerup=e=>{if(!pressed||pointerId!==null&&e.pointerId!==undefined&&e.pointerId!==pointerId)return;e.preventDefault?.();try{button.releasePointerCapture?.(pointerId);}catch(_){}release('pointer',e);};
  const pointercancel=e=>{if(!pressed)return;e.preventDefault?.();cancel('pointercancel',e);};
  const keydown=e=>{if(![' ','Enter'].includes(e.key)||e.repeat)return;e.preventDefault?.();key=e.key;start('keyboard',e);};
  const keyup=e=>{if(!pressed||![' ','Enter'].includes(e.key)||key&&e.key!==key)return;e.preventDefault?.();release('keyboard',e);};
  const contextmenu=e=>e.preventDefault?.();
  const click=e=>e.preventDefault?.();
  button.addEventListener('pointerdown',pointerdown);button.addEventListener('pointerup',pointerup);button.addEventListener('pointercancel',pointercancel);
  button.addEventListener('keydown',keydown);button.addEventListener('keyup',keyup);button.addEventListener('contextmenu',contextmenu);button.addEventListener('click',click);
  return {isPressed:()=>pressed,cancel:()=>cancel('programmatic'),destroy(){button.removeEventListener('pointerdown',pointerdown);button.removeEventListener('pointerup',pointerup);button.removeEventListener('pointercancel',pointercancel);button.removeEventListener('keydown',keydown);button.removeEventListener('keyup',keyup);button.removeEventListener('contextmenu',contextmenu);button.removeEventListener('click',click);pressed=false;}};
}
global.AgendaPressToTalk={bind};
})(typeof window!=='undefined'?window:globalThis);
