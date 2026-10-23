const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname,'../dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const lotSource=fs.readFileSync(path.join(root,'lots.js'),'utf8');
const motionSource=fs.readFileSync(path.join(root,'motion.js'),'utf8');
const writingSource=fs.readFileSync(path.join(root,'handwriting.js'),'utf8');
const deviceSource = fs.readFileSync(path.join(root, 'device.js'), 'utf8');

function harness(lotIndex, native=false) {
  const ids = new Map(), stack = [], timers = [], saved = new Map();
  let draws = 0, downloads = 0; const inkMarks=[];
  function element(tagName, attrs = '') {
    const classes = new Set((attrs.match(/class="([^"]*)"/)?.[1] || '').split(/\s+/).filter(Boolean));
    return {
      tagName: tagName.toUpperCase(), children: [], parentElement: null, style: {}, clientWidth: 900,
      hidden: /(?:^|\s)hidden(?:\s|$)/.test(attrs), textContent: '', value: '', disabled: false,
      classList: {add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle: (n,on) => on ? classes.add(n) : classes.delete(n)},
      getContext(){return {setTransform(){},clearRect(){inkMarks.length=0;},beginPath(){},ellipse(...args){inkMarks.push(args);},fill(){},fillRect(){}};},
      getBoundingClientRect(){return {left:10,top:20,width:500,height:170};},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){},toDataURL(){return 'data:image/png;base64,dGVzdA==';},removeAttribute(name){delete this[name];},
      listeners: {}, addEventListener(name,fn) {this.listeners[name]=fn;}, setAttribute() {}, focus() {}, blur() {}, showModal() {}, close() {},
      replaceChildren(...children) { this.children = children; children.forEach(child => child.parentElement = this); },
      click() { downloads++; }
    };
  }
  for (const match of html.matchAll(/<(\/?)([\w-]+)\b([^>]*)>/g)) {
    const [,closing,tag,attrs] = match;
    if (closing) { stack.pop(); continue; }
    const node = element(tag, attrs), parent = stack.at(-1);
    if (parent) { parent.children.push(node); node.parentElement = parent; }
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (id) { assert(!ids.has(id), 'duplicate id: '+id); ids.set(id,node); }
    if (tag === 'body') ids.set('body',node);
    if (!['meta','link','br','input','hr','img'].includes(tag) && !attrs.endsWith('/')) stack.push(node);
  }
  const el = id => { assert(ids.has(id), 'Missing element: '+id); return ids.get(id); };
  const context = {
    document: {getElementById: el, body:el('body'), createElement:tag=>element(tag), addEventListener(){}},
    window: {__QIAN_NATIVE__:native, scrollTo(){}, addEventListener(){}, innerHeight:900}, navigator: {},
    crypto: {getRandomValues(array) { array[0] = lotIndex; return array; }},
    setTimeout: fn => timers.push(fn), Uint32Array, Date, Blob,
    URL: {createObjectURL: ()=>'blob:test', revokeObjectURL(){}},
    localStorage: {getItem: key=>saved.get(key)||null, setItem:(key,value)=>saved.set(key,value)}
  };
  vm.createContext(context);
  vm.runInContext(deviceSource,context);
  vm.runInContext(writingSource,context);
  vm.runInContext(lotSource,context);
  const nextLot=context.window.QianLots.next;context.window.QianLots.next=()=>{draws++;return nextLot();};
  vm.runInContext(motionSource,context);
  vm.runInContext(source,context);
  return {el, saved, inkMarks, writing:context.window.QianWriting, sensor(status) {if(native)context.window.QianNative.receive({status});else {el('previewAngle').value=String({closed:0,partiallyOpen:90,fullyOpen:180}[status]);el('previewAngle').listeners.input();}}, nativeBridge:context.window.QianNative, device:context.window.QianDevice, draws:()=>draws, downloads:()=>downloads, flush:()=>timers.splice(0).forEach(fn=>fn()), visible(id) { for(let e=el(id);e;e=e.parentElement)if(e.hidden)return false;return true; }};
}
for (const match of source.matchAll(/\$\('([^']+)'\)/g)) assert(html.includes('id="'+match[1]+'"'), 'Unknown JS element '+match[1]);
for (const match of html.matchAll(/(?:href|src)="([^"#]+\.(?:css|js))"/g)) assert(fs.existsSync(path.join(root,match[1])), 'Missing asset '+match[1]);
for (let i=0;i<8;i++) {
  const t=harness(i), e=t.el;
  assert(!t.visible('meaning'));
  assert(!t.visible('result'));
  t.sensor('closed');
  assert(t.visible('coverGuide'));assert(!t.visible('writing'));assert(!t.visible('folded'));assert.equal(t.draws(),0);
  t.sensor('fullyOpen');
  e('inputMode').onclick();
  e('question').value='关于下一步，如何听见自己的心意？';
  t.sensor('closed');
  assert(t.visible('folded'));
  assert.equal(t.device.getMode(),'outer');
  assert(e('deviceFrame').classList.contains('cover-screen'));
  assert.equal(e('displaySpecs').textContent,'5.4 英寸 · 1398 × 2034');
  for(let shake=0;shake<3;shake++) {
    e('shake').onclick();
    e('shake').onclick(); // Rapid duplicate input must not count twice.
    t.flush();
    assert(!t.visible('meaning'));
    assert(!t.visible('result'));
    assert.equal(t.draws(),shake===2?1:0);
    assert.equal(e('shakeProgress').textContent,'已摇 '+(shake+1)+' / 3 次');
  }
  t.sensor('fullyOpen');
  assert(t.visible('result'));
  assert.equal(t.device.getMode(),'inner');
  assert.equal(e('deviceFrame').classList.contains('cover-screen'),false);
  assert(!t.visible('meaning'), 'Interpretation leaked onto unveiling screen');
  assert(!t.visible('save'), 'Save belongs on final page');
  assert(e('body').classList.contains('reveal-scene'));
  assert.equal(e('poem').children.length,2);
  const poem=e('poem').children.map(n=>n.textContent).join('');
  const title=e('resultTitle').textContent;
  e('readMeaning').onclick();
  assert(t.visible('meaning'));
  assert.equal(t.device.getMode(),'inner');
  assert(!t.visible('result'), 'Unveiling still displayed on final page');
  assert(!e('body').classList.contains('reveal-scene'));
  assert(e('meaning').textContent.length>20);
  assert(e('readingLot').textContent.includes(title));
  e('backToLot').onclick();
  assert(t.visible('result'));
  assert(!t.visible('meaning'));
  assert.equal(t.draws(),1, 'Going back must not redraw');
  assert.equal(e('poem').children.map(n=>n.textContent).join(''),poem);
  e('readMeaning').onclick();
  e('save').onclick();
  assert.equal(t.downloads(),1);
  assert.equal(JSON.parse(t.saved.get('qianzhi-history'))[0].lot[0],title);
  assert(e('finalHint').textContent.includes('已收藏'));
  e('again').onclick();
  assert(t.visible('writing'));
  assert(!t.visible('result'));
  assert(!t.visible('meaning'));
  assert(!e('body').classList.contains('reveal-scene'));
  assert.equal(e('question').value,'');
  assert.equal(e('save').disabled,false);
}
console.log('PASS: all 8 lots; hidden interpretation; 3-shake debounce; separate final page; back preserves draw; save/download; reset; HTML IDs and assets.');

const panelTest=harness(0);
for(const [width,height] of [[320,420],[390,624],[768,700],[1024,548],[1440,860]]) {
  panelTest.el('deviceMount').clientWidth=width;
  const g=panelTest.device.geometry('inner',width,height);
  const cover=panelTest.device.geometry('outer',width,height);
  assert(Math.abs(g.width/g.height-2670/1878)<1e-10);
  assert(Math.abs(cover.width/cover.height-1398/2034)<1e-10);
  assert(Math.abs(g.height/cover.height-1)<.02, 'Physical screen heights should stay similar');
  for(const mode of ['inner','outer']) {
    panelTest.device.setMode(mode);
    const f=panelTest.el('deviceFrame');
    const scale=Number(f.style.transform.match(/scale\(([^)]+)\)/)[1]);
    assert(parseFloat(f.style.width)*scale<=width+.001, 'Device must fit available width');
  }
}
console.log('PASS: inner/outer ratios, ppi-normalized physical sizes, 5 viewport widths, and state-driven display switching.');

assert(!html.includes('id="primary"'));
assert(!html.includes('9:41'));
assert(!html.includes('screen-status'));
assert(!html.includes('home-indicator'));
for (const native of [false,true]) {
  const t=harness(2,native), e=t.el;
  t.sensor('fullyOpen');e('inputMode').onclick();e('question').value='保留这一念';
  t.sensor('partiallyOpen');assert(t.visible('writing'));assert.equal(t.draws(),0);
  t.sensor('closed');assert(t.visible('folded'));
  const shake=()=>native?t.nativeBridge.shake():e('shake').onclick();
  shake();t.sensor('fullyOpen');t.flush();
  assert(t.visible('writing'));assert.equal(e('question').value,'保留这一念');assert.equal(t.draws(),0);
  t.sensor('closed');
  for(let i=0;i<3;i++){shake();t.flush();}
  assert.equal(t.draws(),1);assert(!t.visible('result'));
  t.sensor('partiallyOpen');assert(!t.visible('result'));
  t.sensor('fullyOpen');assert(t.visible('result'));
  t.sensor('closed');assert(!t.visible('result'));shake();t.flush();assert.equal(t.draws(),1);
  t.sensor('fullyOpen');assert(t.visible('result'));assert.equal(t.draws(),1);
  if(native){assert.equal(e('previewTools').hidden,true);t.nativeBridge.receive({status:'unknown'});t.nativeBridge.shake();assert.equal(t.draws(),1);}
}
console.log('PASS: native and preview hinge routing; partial-fold ignored; early-open cancels pending shake; sealed result privacy; no manual fold buttons or fake system UI.');

const ink=harness(0), ie=ink.el;
assert.equal(ink.writing.getMode(),'ink');assert(ink.visible('inkInput'));assert(!ink.visible('keyboardInput'));
assert.equal(ink.writing.hasContent(),false);
const pointer=(type,x,y,id=1)=>ie('inkCanvas').listeners[type]({pointerId:id,pointerType:'pen',pressure:.7,button:0,clientX:x,clientY:y,timeStamp:type==='pointerdown'?100:120,preventDefault(){}});
pointer('pointerdown',260,105);
assert.equal(ink.inkMarks[0][0],500);assert.equal(ink.inkMarks[0][1],240); // Correct even under preview scaling.
pointer('pointermove',280,110);pointer('pointerup',280,110);
assert(ink.writing.hasContent());assert(!ink.visible('inkPlaceholder'));
ie('inputMode').onclick();assert(ink.visible('keyboardInput'));assert(!ink.visible('inkInput'));
ie('question').value='键盘草稿';ie('inputMode').onclick();assert(ink.writing.hasContent());assert.equal(ie('question').value,'键盘草稿');
ink.sensor('closed');assert(ink.visible('folded'));
for(let i=0;i<3;i++){ie('shake').onclick();ink.flush();}
ink.sensor('fullyOpen');ie('readMeaning').onclick();assert(ink.visible('askedInk'));assert.equal(ie('askedInk').src,'data:image/png;base64,dGVzdA==');
ie('save').onclick();const record=JSON.parse(ink.saved.get('qianzhi-history'))[0];assert.equal(record.inputMode,'ink');assert(record.questionInk);assert.equal(record.question,'手写心愿');
ie('again').onclick();assert.equal(ink.writing.getMode(),'ink');assert(!ink.writing.hasContent());assert.equal(ie('question').value,'');
pointer('pointerdown',30,40);pointer('pointerup',30,40);ie('undoInk').onclick();assert(!ink.writing.hasContent());
pointer('pointerdown',30,40);pointer('pointercancel',30,40);ie('clearInk').onclick();assert(!ink.writing.hasContent());
console.log('PASS: default handwriting, scaled pointer mapping, keyboard fallback, retained drafts, ink-based sealing, original-ink recall/save, undo/clear/reset.');

for(const native of [false,true]){
 const t=harness(1,native),e=t.el;
 if(native){assert(t.visible('startup'));assert(!t.visible('writing'));assert(!t.visible('coverGuide'));}
 t.sensor('closed');assert(t.visible('coverGuide'));assert(!t.visible('writing'));assert(!t.visible('folded'));assert.equal(t.device.getMode(),'outer');
 const shake=()=>native?t.nativeBridge.shake():e('shake').onclick();shake();t.flush();assert.equal(t.draws(),0);
 t.sensor('fullyOpen');assert(t.visible('writing'));assert(!t.visible('coverGuide'));assert.equal(t.writing.getMode(),'ink');
 t.sensor('closed');assert(t.visible('coverGuide')); // Empty close stays an invitation, never a sealed wish.
}
const partialBoot=harness(1,true);partialBoot.sensor('partiallyOpen');assert(partialBoot.visible('startup'));assert(!partialBoot.visible('writing'));partialBoot.sensor('fullyOpen');assert(partialBoot.visible('writing'));
const innerBoot=harness(1,true);innerBoot.sensor('fullyOpen');assert(innerBoot.visible('writing'));assert(!innerBoot.visible('startup'));assert(!innerBoot.visible('coverGuide'));
const demoBoot=harness(1);demoBoot.el('previewLaunchOuter').onclick();assert(demoBoot.visible('coverGuide'));demoBoot.el('previewLaunchInner').onclick();assert(demoBoot.visible('writing'));
const font=fs.readFileSync(path.join(root,'fonts/MaShanZheng-Regular.ttf'));assert.equal(font.readUInt32BE(0),0x10000);assert(font.length>1000000);assert(fs.readFileSync(path.join(root,'fonts/OFL.txt'),'utf8').includes('SIL OPEN FONT LICENSE'));
console.log('PASS: native startup waits for posture; outer/inner/partial cold starts; empty cover cannot draw; preview launch routes; local font and license.');

function deck(store=new Map(),deny=false){const context={window:{},crypto:require('crypto').webcrypto,Uint32Array,localStorage:{getItem:k=>{if(deny)throw Error('blocked');return store.get(k)||null;},setItem:(k,v)=>{if(deny)throw Error('blocked');store.set(k,v);}}};vm.createContext(context);vm.runInContext(lotSource,context);return context.window.QianLots;}
const persisted=new Map();let pack=deck(persisted);assert.equal(pack.all.length,48);assert.equal(new Set(pack.all.map(l=>l[0])).size,48);assert.equal(new Set(pack.all.map(l=>l[1])).size,48);assert.equal(new Set(pack.all.map(l=>l[2])).size,48);
const sequence=[];
for(let i=0;i<144;i++){
 if(i%7===0)pack=deck(persisted); // Reload during rounds, not just at boundaries.
 const picked=pack.next();assert(!sequence.slice(-8).includes(picked.index),'Recent lot repeated');sequence.push(picked.index);
}
for(let r=0;r<3;r++)assert.equal(new Set(sequence.slice(r*48,(r+1)*48)).size,48,'A round repeated a lot');
const blocked=deck(new Map(),true);assert.equal(new Set(Array.from({length:48},()=>blocked.next().index)).size,48);
const corrupt=deck(new Map([['qianzhi-draw-deck-v1','{invalid']]));assert(corrupt.next().index>=0);
const motionContext={window:{}};vm.createContext(motionContext);vm.runInContext(motionSource,motionContext);const detector=new motionContext.window.QianRockingDetector();let motions=0;
for(let c=0;c<3;c++)for(const [dt,z] of [[0,2],[150,-2],[320,2],[460,0],[580,0]])if(detector.feed(z,c*1200+dt))motions++;
assert.equal(motions,3);detector.reset();let single=0;for(const [time,z] of [[0,3],[500,0],[700,0],[1000,0]])if(detector.feed(z,time))single++;assert.equal(single,0);
detector.reset();for(const [time,z] of [[0,3],[20,-3],[40,3],[600,0],[800,0]])assert(!detector.feed(z,time));
console.log('PASS: 48 unique lots; 3 no-repeat rounds across reloads; last-8 exclusion; unavailable/corrupt storage; three front/back cycles count 3; single impulses/jitter rejected.');
