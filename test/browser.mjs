import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
const server=await createServer({server:{host:'127.0.0.1',port:8019},logLevel:'error'});
await server.listen();
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage(), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8019/demo/index.html';
const data=()=>page.evaluate(()=>JSON.parse(Reveal.getPlugin('ink').exportJSON()));
const ready=async()=>{await page.waitForFunction(()=>window.Reveal?.isReady() && document.querySelector('.reveal-ink-surface'));assert.equal(await page.$eval('[data-tool=\"navigate\"]', el=>el.getAttribute('aria-pressed')), 'true');await page.click('[data-tool=\"pen\"]');};
async function pen(type='pen', cancel=false) {
  await page.evaluate((type,cancel)=>{
    const svg=document.querySelector('.present .reveal-ink-surface'), r=svg.getBoundingClientRect();
    const target=Reveal.getCurrentSlide();
    const event=(name,x,y,p)=>new PointerEvent(name,{bubbles:true,cancelable:true,pointerType:type,pointerId:32,button:0,buttons:1,
      clientX:r.left+r.width*x,clientY:r.top+r.height*y,pressure:p});
    target.dispatchEvent(event('pointerdown',.2,.65,.2));
    const move=event('pointermove',.6,.65,.8);
    Object.defineProperty(move,'getCoalescedEvents',{value:()=>[event('pointermove',.3,.6,.4),event('pointermove',.45,.7,.6),move]});
    target.dispatchEvent(move);
    target.dispatchEvent(event(cancel?'pointercancel':'pointerup',.6,.65,0));
  },type,cancel);
}
try {
  await page.goto(url);await ready();
  await pen();
  assert.ok(await page.$eval('.reveal-ink-toolbar', e => e.hidden));
  assert.ok(await page.$eval('.reveal-ink-toggle', e => !e.hidden));
  assert.ok(await page.$eval('.reveal-ink-palette', e => !e.hidden));
  await page.click('[data-color="#81b1d2"]');
  assert.equal(await page.$eval('.reveal-ink-swatch[aria-pressed=true]', e => e.dataset.color), '#81b1d2');
  assert.ok(await page.$eval('.reveal-ink-toolbar', e => e.hidden));
  await page.click('.reveal-ink-toggle');
  assert.ok(await page.$eval('.reveal-ink-toolbar', e => !e.hidden));
  assert.equal(await page.$eval('.reveal-ink-status', e => e.textContent), '');
  let d=await data();assert.equal(d.slides['id:ink-text'].length,1);
  assert.ok(d.slides['id:ink-text'][0].points.some(p=>Math.abs(p[2]-.8)<1e-6));
  assert.ok(d.slides['id:ink-text'][0].points.length>=4);
  await pen('touch');assert.equal((await data()).slides['id:ink-text'].length,1);
  await page.evaluate(()=>Reveal.getPlugin('ink').flush());await page.reload();await ready();
  assert.equal((await data()).slides['id:ink-text'].length,1);
  // IndexedDB schema and presentation separation.
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('reveal-ink');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('presentations');const q=tx.objectStore('presentations').get('not-this-deck');q.onsuccess=()=>{resolve(q.result===undefined);db.close()}}})),true);
  await page.evaluate(()=>Reveal.getPlugin('ink').undo()); // History is intentionally session-local after reload.
  assert.equal((await data()).slides['id:ink-text'].length,1);
  await pen('pen',true);assert.equal((await data()).slides['id:ink-text'].length,2);
  await page.evaluate(()=>Reveal.getPlugin('ink').undo());assert.equal((await data()).slides['id:ink-text'].length,1);
  await page.evaluate(()=>Reveal.getPlugin('ink').redo());assert.equal((await data()).slides['id:ink-text'].length,2);
  const exported=await page.evaluate(()=>Reveal.getPlugin('ink').exportJSON());
  await page.evaluate(()=>Reveal.getPlugin('ink').clear());assert.equal((await data()).slides['id:ink-text'].length,0);
  await page.evaluate(()=>Reveal.getPlugin('ink').undo());assert.equal((await data()).slides['id:ink-text'].length,2);
  await page.evaluate(()=>Reveal.getPlugin('ink').setTool('eraser'));await pen();
  assert.equal((await data()).slides['id:ink-text'].length,0);
  await page.evaluate(()=>Reveal.getPlugin('ink').undo());assert.equal((await data()).slides['id:ink-text'].length,2);
  await page.evaluate(s=>Reveal.getPlugin('ink').importJSON(s),exported);
  assert.equal((await data()).slides['id:ink-text'].length,2);
  assert.equal(await page.evaluate(async()=>{try{await Reveal.getPlugin('ink').importJSON('{"version":99}');return false}catch{return true}}),true);
  assert.equal((await data()).slides['id:ink-text'].length,2);
  await page.evaluate(()=>{Reveal.getPlugin('ink').setTool('highlighter');Reveal.slide(2,1)});
  await new Promise(r=>setTimeout(r,500));await pen();
  assert.equal((await data()).slides['id:ink-vertical-2'][0].tool,'highlighter');
  await page.evaluate(()=>Reveal.getPlugin('ink').undo());assert.equal((await data()).slides['id:ink-text'].length,2);
  await page.evaluate(()=>Reveal.slide(0));await new Promise(r=>setTimeout(r,500));
  for(const [width,height] of [[768,1024],[1024,768]]) {
    await page.setViewport({width,height});await new Promise(r=>setTimeout(r,300));
    const dimensions=await page.evaluate(()=>{const r=Reveal.getCurrentSlide().querySelector('svg').getBoundingClientRect();return [r.width,r.height]});
    assert.ok(dimensions.every(n=>n>0));
    assert.deepEqual((await data()).slides['id:ink-text'],JSON.parse(exported).slides['id:ink-text']);
  }
  await page.evaluate(()=>Reveal.toggleOverview(true));
  assert.ok(await page.$eval('.reveal-ink-toolbar',e=>e.hidden));
  await page.evaluate(()=>Reveal.toggleOverview(false));await new Promise(r=>setTimeout(r,500));
  await page.evaluate(()=>Reveal.getPlugin('ink').setTool('navigate'));
  assert.ok(await page.$eval('.reveal-ink-palette', e => e.hidden));
  await page.click('#demo-link');assert.equal(await page.evaluate(()=>Reveal.getCurrentSlide().id),'ink-equation');
  await page.evaluate(()=>Reveal.getPlugin('ink').setTool('pen'));
  assert.ok(await page.$eval('.reveal-ink-palette', e => !e.hidden));
  await new Promise(r=>setTimeout(r,500));
  // Real mouse events, including native pointer capture.
  const r=await page.$eval('.present .reveal-ink-surface',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
  await page.mouse.move(r.x+r.w*.2,r.y+r.h*.6);await page.mouse.down();
  await page.mouse.move(r.x+r.w*.5,r.y+r.h*.7,{steps:20});await page.mouse.up();
  assert.equal((await data()).slides['id:ink-equation'].length,1);
  // Full-viewport writing: both side margins accept pen input.
  await page.evaluate(() => {
    const root=Reveal.getRevealElement(), r=root.getBoundingClientRect();
    for (const x of [r.left+3,r.right-3]) {
      for (const type of ['pointerdown','pointerup']) root.dispatchEvent(new PointerEvent(type,{
        bubbles:true,cancelable:true,pointerType:'pen',pointerId:45,button:0,buttons:1,
        clientX:x,clientY:r.top+70,pressure:.5}));
    }
  });
  const edgeStrokes=(await data()).slides['id:ink-equation'];
  assert.equal(edgeStrokes.length,3);
  assert.ok(edgeStrokes[1].points[0][0]<0);
  assert.ok(edgeStrokes[2].points[0][0]>1);
  assert.ok(await page.$eval('.present svg path', e=>e.getAttribute('d').includes('Q')));
  const slideBefore=await page.evaluate(()=>Reveal.getCurrentSlide().id);
  await page.evaluate(()=>document.querySelector('.navigate-right').click());
  assert.equal(await page.evaluate(()=>Reveal.getCurrentSlide().id),slideBefore);
  await page.evaluate(()=>Reveal.getPlugin('ink').toggleCanvas());
  assert.ok(await page.$('.ink-extra-canvas'));
  await pen();
  assert.equal((await data()).slides['canvas:id:ink-equation'].length,1);
  await page.evaluate(()=>Reveal.getPlugin('ink').undo());
  assert.equal((await data()).slides['canvas:id:ink-equation'].length,0);
  assert.equal((await data()).slides['id:ink-equation'].length,3);
  await page.evaluate(()=>Reveal.getPlugin('ink').redo());
  await page.screenshot({path:'/tmp/reveal-ink-canvas.png'});
  await page.evaluate(()=>Reveal.getPlugin('ink').flush());
  await page.reload();await ready();
  await page.evaluate(()=>Reveal.getPlugin('ink').toggleCanvas());
  assert.equal((await data()).slides['canvas:id:ink-equation'].length,1);
  await page.evaluate(()=>Reveal.getPlugin('ink').toggleCanvas());
  assert.equal((await data()).slides['id:ink-equation'].length,3);
  const permanent = await data();
  await page.evaluate(() => Reveal.getPlugin('ink').setTool('laser'));
  await pen();
  assert.deepEqual(await data(), permanent, 'Laser strokes never enter annotation export');
  assert.equal(await page.$$eval('.reveal-ink-laser', nodes => nodes.length), 1);
  await pen();
  assert.equal(await page.$$eval('.reveal-ink-laser', nodes => nodes.length), 2);
  await page.evaluate(() => Reveal.getPlugin('ink').setTool('pen'));
  await page.evaluate(() => Reveal.getPlugin('ink').setTool('laser'));
  assert.equal(await page.$$eval('.reveal-ink-laser', nodes => nodes.length), 2);
  await page.waitForFunction(() => !document.querySelector('.reveal-ink-laser'));
  assert.deepEqual(await data(), permanent);
  await pen();
  await page.evaluate(() => Reveal.getPlugin('ink').toggleCanvas());
  assert.equal(await page.$('.reveal-ink-laser'), null);
  await page.screenshot({path:'/tmp/reveal-ink-demo.png'});
  await page.evaluate(()=>Reveal.getPlugin('ink').destroy());
  assert.equal(await page.$('.reveal-ink-toolbar'),null);assert.equal(await page.$('.reveal-ink-surface'),null);
  assert.deepEqual(errors,[]);
  const context = await browser.createBrowserContext();
  const scrollPage = await context.newPage();
  await scrollPage.goto(url); await scrollPage.waitForFunction(()=>window.Reveal?.isReady());
  await scrollPage.click('[data-tool=pen]');
  await scrollPage.click('.reveal-ink-canvas-toggle');
  assert.ok(await scrollPage.$('.ink-extra-canvas'));
  await scrollPage.click('.reveal-ink-toolbar summary');
  await scrollPage.$eval('[aria-label="Smoothing"]', e=>{e.value='0.2';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await scrollPage.$eval('[aria-label="Stabilizer"]', e=>{e.value='0.05';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await scrollPage.click('.reveal-ink-toolbar summary');
  await scrollPage.evaluate(()=>Reveal.getRevealElement().dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:1400})));
  const scrollPosition=await scrollPage.$eval('[aria-label="Canvas vertical position"]',e=>Number(e.value));
  assert.ok(scrollPosition>1);
  const draw = async()=>scrollPage.evaluate(()=>{
    const root=Reveal.getRevealElement(), r=root.getBoundingClientRect();
    for(const [type,x] of [['pointerdown',.3],['pointermove',.5],['pointerup',.6]]) root.dispatchEvent(new PointerEvent(type,{
      bubbles:true,cancelable:true,pointerType:'pen',pointerId:72,button:0,buttons:1,pressure:.5,
      clientX:r.left+r.width*x,clientY:r.top+r.height*.5}));
  });
  await draw();
  let notes=await scrollPage.evaluate(()=>JSON.parse(Reveal.getPlugin('ink').exportJSON()));
  const ink=notes.slides['canvas:id:ink-text'][0];
  assert.ok(ink.points[0][1]>1);assert.equal(ink.options.smoothing,.2);assert.equal(ink.options.streamline,.05);
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').undo());
  assert.equal(await scrollPage.evaluate(()=>JSON.parse(Reveal.getPlugin('ink').exportJSON()).slides['canvas:id:ink-text'].length),0);
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').redo());
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').setTool('eraser'));
  await draw();
  assert.equal(await scrollPage.evaluate(()=>JSON.parse(Reveal.getPlugin('ink').exportJSON()).slides['canvas:id:ink-text'].length),0);
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').undo());
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').flush());
  await scrollPage.reload();await scrollPage.waitForFunction(()=>window.Reveal?.isReady());
  await scrollPage.click('[data-tool=pen]');
  await scrollPage.click('.reveal-ink-canvas-toggle');
  await scrollPage.evaluate(position=>Reveal.getPlugin('ink').scrollCanvas(position),scrollPosition);
  notes=await scrollPage.evaluate(()=>JSON.parse(Reveal.getPlugin('ink').exportJSON()));
  assert.deepEqual(notes.slides['canvas:id:ink-text'][0],ink);
  // Scrolling changes the viewport, not the stored coordinates.
  await scrollPage.evaluate(()=>Reveal.getPlugin('ink').scrollCanvas(0));
  assert.equal(await scrollPage.$eval('[aria-label="Canvas vertical position"]',e=>Number(e.value)),0);
  await scrollPage.evaluate(position=>Reveal.getPlugin('ink').scrollCanvas(position),scrollPosition);
  await scrollPage.screenshot({path:'/tmp/ink-scroll-canvas.png'});
  await context.close();
  // A blocked storage backend must leave drawing/export available and show a warning.
  const offline = await browser.newPage();
  await offline.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('Storage disabled for test'); } } });
  });
  await offline.goto(url);
  await offline.waitForFunction(() => window.Reveal?.isReady());
  assert.match(await offline.$eval('.reveal-ink-status', e => e.textContent), /Storage unavailable/);
  assert.ok(await offline.$('.reveal-ink-surface'));
  assert.equal(await offline.evaluate(() => JSON.parse(Reveal.getPlugin('ink').exportJSON()).version), 2);
  await offline.close();
  const pointerPage = await browser.newPage();
  await pointerPage.goto(url); await pointerPage.waitForFunction(() => window.Reveal?.isReady() && document.querySelector('.present > .reveal-ink-surface'));
  assert.equal(await pointerPage.$eval('[data-tool=\"navigate\"]', el=>el.getAttribute('aria-pressed')), 'true');
  await pointerPage.click('[data-tool=\"pen\"]');
  const pointer = (type, pointerType = 'pen', x = 400, y = 300) => pointerPage.evaluate(({type,pointerType,x,y}) => {
    document.elementFromPoint(x,y).dispatchEvent(new PointerEvent(type, {
      bubbles:true, pointerType, pointerId:pointerType === 'touch' ? 88 : 77,
      clientX:x,clientY:y,button:0,buttons:type === 'pointerdown' ? 1 : 0,pressure:.5
    }));
  },{type,pointerType,x,y});
  const dot = () => pointerPage.$eval('.reveal-ink-pen-cursor', e => {
    const r=e.getBoundingClientRect(); return {hidden:e.hidden,x:r.x+r.width/2,y:r.y+r.height/2,width:r.width};
  });
  const initial = await pointerPage.evaluate(() => Reveal.getPlugin('ink').exportJSON());
  await pointer('pointermove');
  let marker = await dot(); assert.equal(marker.hidden,false); assert.ok(Math.abs(marker.x-400)<1 && Math.abs(marker.y-300)<1); assert.equal(marker.width,6);
  await pointer('pointermove','touch',410,310); assert.deepEqual(await dot(),marker);
  assert.equal(await pointerPage.evaluate(() => Reveal.getPlugin('ink').exportJSON()), initial);
  await pointer('pointerdown'); await pointer('pointermove','pen',430,320);
  assert.equal((await dot()).hidden,false);
  await pointer('pointerup','pen',430,320); assert.equal((await dot()).hidden,true);
  await pointer('pointermove'); await pointer('pointercancel'); assert.equal((await dot()).hidden,true);
  await pointer('pointermove'); await pointer('pointermove','mouse'); assert.equal((await dot()).hidden,true);
  assert.equal(await pointerPage.$eval('.slides',e=>getComputedStyle(e).cursor),'crosshair');
  await pointer('pointermove');
  await pointerPage.evaluate(()=>Reveal.getPlugin('ink').setTool('navigate')); assert.equal((await dot()).hidden,true);
  await pointer('pointermove'); assert.equal((await dot()).hidden,true);
  await pointerPage.evaluate(()=>{Reveal.getPlugin('ink').setTool('pen');Reveal.getPlugin('ink').toggleCanvas();Reveal.getPlugin('ink').scrollCanvas(2);});
  await pointer('pointermove'); assert.equal((await dot()).y,300);
  await pointerPage.evaluate(()=>Reveal.toggleOverview(true)); assert.equal((await dot()).hidden,true);
  await pointerPage.evaluate(()=>Reveal.getPlugin('ink').destroy()); assert.equal(await pointerPage.$('.reveal-ink-pen-cursor'),null);
  await pointerPage.close();
  console.log('PASS: pen position dot, hover/contact, palm exclusion, mouse crosshair, navigation, canvas scrolling, overview and cleanup');
  console.log('PASS: pressure/coalesced input, touch exclusion, pointer cancellation, IndexedDB restore, history, eraser, import/export, nested slides, portrait/landscape, overview, links, mouse, cleanup');
} finally {await browser.close();await server.close();}
