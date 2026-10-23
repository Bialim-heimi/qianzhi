'use strict';
(function(){
  const el=id=>document.getElementById(id), canvas=el('inkCanvas'), ctx=canvas.getContext('2d');
  const W=1000,H=480, MAX_POINTS=16000;
  let mode='ink', strokes=[], active=null, pointer=null, locked=false;
  ctx.setTransform(2,0,0,2,0,0);
  function total(){return strokes.reduce((n,s)=>n+s.length,0);}
  function mark(p, previous){
    if(previous){
      const dx=p.x-previous.x,dy=p.y-previous.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.2));
      for(let i=1;i<=steps;i++)dab({x:previous.x+dx*i/steps,y:previous.y+dy*i/steps,w:previous.w+(p.w-previous.w)*i/steps});
    }else dab(p);
  }
  function dab(p){
    // A soft water edge surrounds a denser, slightly flattened ink core.
    ctx.fillStyle='rgba(48,45,34,.035)';ctx.beginPath();ctx.ellipse(p.x,p.y,p.w*.78,p.w*.6,-.35,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(37,38,30,.7)';ctx.beginPath();ctx.ellipse(p.x,p.y,p.w*.52,p.w*.40,-.35,0,Math.PI*2);ctx.fill();
    // Fine dry-brush grain is deterministic, so undo/redraw preserves the same mark.
    if(Math.floor(p.x+p.y)%4===0){ctx.fillStyle='rgba(237,227,200,.12)';ctx.fillRect(p.x+p.w*.12,p.y,Math.max(.4,p.w*.07),.6);}
  }
  function redraw(){ctx.clearRect(0,0,W,H);for(const stroke of strokes)stroke.forEach((p,i)=>mark(p,stroke[i-1]));}
  function sync(){
    const has=strokes.length>0;el('inkPlaceholder').hidden=has;
    el('undoInk').disabled=!has||locked;el('clearInk').disabled=!has||locked;
    el('inputMode').disabled=locked;
    el('inkStatus').textContent=has?'写好，轻轻合上。':'一笔一念。';
  }
  function point(e,previous){
    const r=canvas.getBoundingClientRect();const x=Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W));const y=Math.max(0,Math.min(H,(e.clientY-r.top)/r.height*H));
    const t=e.timeStamp||0,speed=previous?Math.hypot(x-previous.x,y-previous.y)/Math.max(1,t-previous.t):0;
    const pressure=e.pointerType==='pen'&&e.pressure>0?e.pressure:.52;
    const target=Math.max(1.4,Math.min(10,2+pressure*9-speed*.65));
    return {x,y,t,w:previous?previous.w*.65+target*.35:target*.65};
  }
  function finish(){
    if(pointer!==null&&canvas.hasPointerCapture?.(pointer))canvas.releasePointerCapture(pointer);
    active=null;pointer=null;sync();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(locked||mode!=='ink'||pointer!==null||e.button>0)return;
    if(total()>=MAX_POINTS){el('inkStatus').textContent='这页墨迹已满，可撤回或清空后继续。';return;}
    e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);
    active=[point(e)];strokes.push(active);mark(active[0]);sync();
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer||!active||locked)return;e.preventDefault();
    const points=e.getCoalescedEvents?.()||[e];
    for(const event of points.length?points:[e]){
      if(total()>=MAX_POINTS){finish();el('inkStatus').textContent='这页墨迹已满，可撤回或清空后继续。';break;}
      const prev=active[active.length-1],p=point(event,prev);if(Math.hypot(p.x-prev.x,p.y-prev.y)<.3)continue;
      active.push(p);mark(p,prev);
    }
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(e.pointerId===pointer)finish();});
  el('undoInk').onclick=()=>{if(locked)return;finish();strokes.pop();redraw();sync();};
  el('clearInk').onclick=()=>{if(locked)return;finish();strokes=[];redraw();sync();};
  function setMode(next,focus=false){
    if(locked)return;finish();mode=next;
    el('inkInput').hidden=mode!=='ink';el('keyboardInput').hidden=mode!=='keyboard';
    el('inputMode').textContent=mode==='ink'?'键盘输入':'返回手写';el('inputMode').setAttribute('aria-pressed',String(mode==='keyboard'));
    if(focus)(mode==='keyboard'?el('question'):canvas).focus();
  }
  el('inputMode').onclick=()=>setMode(mode==='ink'?'keyboard':'ink',true);
  window.QianWriting={
    hasContent:()=>mode==='ink'?strokes.length>0:!!el('question').value.trim(),
    snapshot:()=>mode==='ink'?{mode:'ink',text:'手写心愿',ink:canvas.toDataURL('image/png')}:{mode:'keyboard',text:el('question').value.trim(),ink:null},
    setLocked(value){if(value)finish();locked=value;sync();},
    reset(){locked=false;finish();strokes=[];redraw();setMode('ink');sync();},
    getMode:()=>mode
  };
  sync();
})();
