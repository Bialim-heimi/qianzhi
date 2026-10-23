'use strict';
const $=id=>document.getElementById(id);
const lots=window.QianLots.all;
let state='writing', hingeStatus='unknown', source='none', shakes=0, busy=false, generation=0, chosen=null;
let sealedDraft=null;
let sound=false, audio=null, motionOn=false;
const rocking=new window.QianRockingDetector();
const nativeHost=window.__QIAN_NATIVE__===true;
function tone(freq=520){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.8);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.8);}catch{}}
function stage(n,label){[...$('steps').children].forEach((e,i)=>e.classList.toggle('active',i===n));$('stageName').textContent=label;}
function hint(text){$('hint').textContent=text;}
function beads(){$('shakeProgress').textContent='已摇 '+shakes+' / 3 次';[...$('beads').children].forEach((e,i)=>e.classList.toggle('on',i<shakes));}
function hideEntryScreens(){$('startup').hidden=true;$('coverGuide').hidden=true;}
function showWriting(){
  hideEntryScreens();
  state='writing';generation++;busy=false;shakes=0;rocking.reset();$('folded').classList.remove('shake-confirm');beads();
  document.body.classList.remove('reveal-scene');
  $('ritualPage').hidden=false;$('interpretationPage').hidden=true;
  $('writing').hidden=false;$('folded').hidden=true;$('result').hidden=true;$('resultActions').hidden=true;
  $('paper').classList.remove('folded','shake');$('question').readOnly=false;window.QianWriting.setLocked(false);
  stage(0,'展开 · 落笔');hint('写好，轻轻合上。');
}
function showCover(){
  if(state==='writing'||state==='boot'){showCoverGuide();return;}
  hideEntryScreens();
  document.body.classList.remove('reveal-scene');$('ritualPage').hidden=false;$('interpretationPage').hidden=true;
  $('writing').hidden=true;$('result').hidden=true;$('resultActions').hidden=true;$('folded').hidden=false;
  $('paper').classList.add('folded');
  $('shakeGuide').hidden=state!=='sealed';$('folded').classList.toggle('is-complete',state!=='sealed');
  $('foldTitle').textContent=state==='sealed'?'合掌寄愿':'一签已成';
  $('foldText').textContent=state==='sealed'?'合掌夹持，前后轻摇三回。':'缓缓展开，静候回响。';
  $('shake').hidden=state!=='sealed'||nativeHost;$('motion').hidden=state!=='sealed'||nativeHost;
  $('beads').hidden=false;stage(1,'合纸 · 寄愿');
  hint(state==='sealed'?'双手稳稳夹持，轻摇即可，无需用力。':'展开手机，答案自会显现。');
}
function showResult(){
  hideEntryScreens();
  state='result';$('interpretationPage').hidden=true;$('ritualPage').hidden=false;
  $('writing').hidden=true;$('folded').hidden=true;$('result').hidden=false;
  $('paper').classList.remove('folded');$('resultActions').hidden=false;
  document.body.classList.add('reveal-scene');stage(3,'展签 · 见诗');hint('');
  $('resultTitle').focus({preventScroll:true});
}
function showMeaning(){hideEntryScreens();state='meaning';$('ritualPage').hidden=true;$('interpretationPage').hidden=false;document.body.classList.remove('reveal-scene');$('meaningHeading').focus({preventScroll:true});}
function showCoverGuide(){
  state='writing';document.body.classList.remove('reveal-scene');
  $('ritualPage').hidden=false;$('interpretationPage').hidden=true;
  $('writing').hidden=true;$('folded').hidden=true;$('result').hidden=true;$('resultActions').hidden=true;
  $('startup').hidden=true;$('coverGuide').hidden=false;$('paper').classList.remove('folded');
  window.QianWriting.setLocked(true);
  stage(0,'展纸 · 问心');hint('缓缓展开手机，让心愿落在内屏。');
  $('deviceCaption').textContent='外屏 · 展开后，在完整的签纸上落笔';
}
function showStartup(partial=false){
  state='boot';document.body.classList.remove('reveal-scene');
  $('ritualPage').hidden=false;$('interpretationPage').hidden=true;
  $('writing').hidden=true;$('folded').hidden=true;$('result').hidden=true;$('resultActions').hidden=true;$('coverGuide').hidden=true;$('startup').hidden=false;
  window.QianWriting.setLocked(true);
  $('startupTitle').textContent=partial?'请完全展开手机':'感应纸的开合';
  $('startupText').textContent=partial?'让一张完整的纸，承接此刻心意。':'稍候，让心意落在对的纸面。';
  hint(partial?'展开内屏后，即可落笔问心。':'等待设备提供当前的屏幕状态。');
}
function restartPreview(status){
  if(nativeHost)return;
  chosen=null;sealedDraft=null;generation++;busy=false;shakes=0;window.QianWriting.reset();$('question').value='';$('count').textContent='0';
  $('save').disabled=false;$('save').textContent='收藏此签';$('askedInk').hidden=true;
  state='boot';hingeStatus='unknown';$('previewAngle').value=status==='closed'?'0':'180';$('angleValue').textContent=$('previewAngle').value+'°';
  onHinge(status,'preview');
}
$('previewLaunchOuter').onclick=()=>restartPreview('closed');
$('previewLaunchInner').onclick=()=>restartPreview('fullyOpen');
function onHinge(status,eventSource){
  if(!['closed','partiallyOpen','fullyOpen','unknown'].includes(status))return;
  source=eventSource;
  $('sensorStatus').textContent=eventSource==='native'?(status==='unknown'?'原生容器已连接，当前未提供铰链状态。':'原生铰链已连接 · '+{closed:'已合拢',partiallyOpen:'部分展开',fullyOpen:'已展开'}[status]):'桌面姿态模拟 · 非硬件传感器';
  if(status===hingeStatus)return;
  hingeStatus=status;
  if(status==='unknown')return;
  if(status==='partiallyOpen'){if(state==='boot'){showStartup(true);return;}hint('顺着折痕，缓缓合拢或展开。');return;}
  window.QianDevice.setMode(status==='closed'?'outer':'inner');
  if(status==='closed'){
    $('question').blur();
    if(state==='writing'&&window.QianWriting.hasContent()){
      sealedDraft=window.QianWriting.snapshot();window.QianWriting.setLocked(true);
      state='sealed';$('question').readOnly=true;shakes=0;beads();tone(320);
    }
    showCover();
  }else{
    if(state==='ready'||state==='result'){showResult();tone(660);}
    else if(state==='meaning')showMeaning();
    else {const interrupted=state==='sealed';showWriting();if(interrupted)hint('此念仍在纸上。准备好后，再合上手机。');}
  }
}
function draw(){
  const idx=window.QianLots.next().index;
  chosen={index:idx,question:sealedDraft.text,questionInk:sealedDraft.ink,inputMode:sealedDraft.mode,date:new Date().toISOString(),lot:lots[idx]};
  $('resultNo').textContent='第 '+String(idx+1).padStart(2,'0')+' 签 · 问心签';$('resultTitle').textContent=chosen.lot[0];
  $('poem').replaceChildren(...chosen.lot[1].split(/[，。]/).filter(Boolean).map(line=>{const span=document.createElement('span');span.className='poem-line';span.textContent=line;return span;}));
  $('meaning').textContent=chosen.lot[2];$('asked').textContent=chosen.question;$('askedInk').hidden=!chosen.questionInk;if(chosen.questionInk)$('askedInk').src=chosen.questionInk;else $('askedInk').removeAttribute('src');$('readingLot').textContent='第 '+String(idx+1).padStart(2,'0')+' 签 · '+chosen.lot[0];
}
function shake(){
  if(state!=='sealed'||hingeStatus!=='closed'||busy)return;
  busy=true;const ticket=generation;stage(2,'摇签 · 静候');
  $('paper').classList.remove('shake');$('folded').classList.remove('shake-confirm');void $('paper').offsetWidth;$('folded').classList.add('shake-confirm');tone(280+shakes*110);
  navigator.vibrate?.(35);shakes++;beads();hint(['','一摇，放下纷扰。','二摇，专注此念。','三摇，静候回响。'][shakes]);
  setTimeout(()=>{
    if(ticket!==generation)return;
    busy=false;$('paper').classList.remove('shake');$('folded').classList.remove('shake-confirm');
    if(shakes===3&&state==='sealed'){
      draw();state='ready';showCover();
      if(hingeStatus==='fullyOpen')showResult();
    }
  },650);
}
window.QianNative={
  receive(payload){if(!nativeHost||!payload||typeof payload.status!=='string')return;onHinge(payload.status,'native');},
  shake(){if(nativeHost)shake();}
};
$('previewTools').hidden=nativeHost;
$('previewAngle').addEventListener('input',()=>{
  if(nativeHost)return;
  const value=Number($('previewAngle').value);$('angleValue').textContent=value+'°';
  onHinge(value<=8?'closed':value>=172?'fullyOpen':'partiallyOpen','preview');
});
$('question').addEventListener('input',()=>{$('count').textContent=$('question').value.length;});
$('shake').onclick=shake;
$('motion').onclick=async()=>{try{if(motionOn)return;if(!window.DeviceMotionEvent)throw Error();if(typeof DeviceMotionEvent.requestPermission==='function'&&await DeviceMotionEvent.requestPermission()!=='granted')throw Error();window.addEventListener('devicemotion',e=>{const a=e.acceleration;if(!a||a.z===null)return;if(state!=='sealed'||hingeStatus!=='closed'||busy){rocking.reset();return;}if(rocking.feed(a.z,e.timeStamp||Date.now()))shake();});motionOn=true;$('motion').textContent='摇动已启用';}catch{hint('未获得摇动权限，桌面调试可点击轻摇一次。');}};
$('readMeaning').onclick=()=>{if(state==='result'&&hingeStatus==='fullyOpen')showMeaning();};
$('backToLot').onclick=()=>{if(state==='meaning'&&hingeStatus==='fullyOpen')showResult();};
$('save').onclick=()=>{
  if(state!=='meaning'||!chosen||$('save').disabled)return;
  const content=`签纸 · ${chosen.lot[0]}\n${chosen.lot[1]}\n\n签意：${chosen.lot[2]}\n所问：${chosen.question}\n\n签文仅作自我观照。`;
  try{let history=JSON.parse(localStorage.getItem('qianzhi-history')||'[]');if(!Array.isArray(history))history=[];history.push(chosen);localStorage.setItem('qianzhi-history',JSON.stringify(history.slice(-10)));$('save').disabled=true;$('save').textContent='已收藏 ✓';$('finalHint').textContent='此签已收藏在当前设备。';
    if(nativeHost&&window.webkit?.messageHandlers?.qianShare){window.webkit.messageHandlers.qianShare.postMessage({text:content,ink:chosen.questionInk});}
    else{
      const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const output=chosen.questionInk?'<!doctype html><meta charset="utf-8"><title>签纸 · '+escape(chosen.lot[0])+'</title><body style="max-width:700px;margin:40px auto;padding:28px;background:#eee4ce;color:#343c2d;font-family:serif;line-height:2"><h1>'+escape(chosen.lot[0])+'</h1><p>'+escape(chosen.lot[1])+'</p><p>'+escape(chosen.lot[2])+'</p><h2>回望所问</h2><img style="width:100%" alt="手写心愿原迹" src="'+chosen.questionInk+'"><small>签文仅作自我观照。</small></body>':content;
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([output],{type:chosen.questionInk?'text/html;charset=utf-8':'text/plain;charset=utf-8'}));a.download='签纸-'+chosen.lot[0]+(chosen.questionInk?'.html':'.txt');a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    }
  }catch{$('finalHint').textContent='当前环境无法收藏，请复制签文留存。';}
};
$('again').onclick=()=>{chosen=null;sealedDraft=null;window.QianWriting.reset();$('question').value='';$('count').textContent='0';$('save').disabled=false;$('save').textContent='收藏此签';$('finalHint').textContent='签文仅作自我观照，答案仍由你书写。';showWriting();$('inkCanvas').focus();};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'◌ 声音开启':'◌ 声音关闭';$('sound').setAttribute('aria-pressed',String(sound));tone();};
$('about').onclick=()=>$('help').showModal();$('closeHelp').onclick=()=>$('help').close();
if(nativeHost){showStartup();$('sensorStatus').textContent='等待原生铰链状态…';}
else showWriting();
