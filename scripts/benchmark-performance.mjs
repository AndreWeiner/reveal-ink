// Run from the repository root: node scripts/benchmark-performance.mjs
// Synthetic CPU checks only; excludes browser paint and IndexedDB serialization.
import assert from 'node:assert/strict';
import { cpus } from 'node:os';
import { hitStroke } from '../src/renderer.js';
const make = (i) => ({id:`s${i}`,tool:'pen',width:4,color:'#000000',aspect:1.5,
  options:{thinning:.2,smoothing:.7,streamline:.65,simulatePressure:false},
  points:Array.from({length:120},(_,j)=>[.1+.7*j/119,.2+.04*Math.sin(j/7+i),.5])});
const results = [];
function measure(name, run) {
  run(); run();
  const ms = [];
  for (let i=0;i<7;i++) { const start=performance.now(); run(); ms.push(performance.now()-start); }
  results.push({name,ms,medianMs:[...ms].sort((a,b)=>a-b)[3]});
}
const strokes = Array.from({length:1000},(_,i)=>make(i));
assert(hitStroke(strokes[0],[.5,0],[.5,.5],1.5,12));
measure('cached distant eraser scan: 1000 strokes, 120 points each', () => {
  assert.equal(strokes.filter(s=>!hitStroke(s,[.5,.8],[.5,.9],1.5,12)).length,1000);
});
const data = {version:2,presentation:'benchmark',slides:{}};
for(let i=0;i<50;i++) data.slides[`id:${i}`]=Array.from({length:100},(_,j)=>make(i*100+j));
measure('previous synchronous full-deck copy: 600000 points',()=>{
  assert.equal(Object.keys(structuredClone(data).slides).length,50);
});
measure('new immutable snapshot capture: same 600000 points',()=>{
  const snapshot={...data,slides:{...data.slides}};
  assert.notEqual(snapshot.slides,data.slides);
  assert.equal(snapshot.slides['id:0'],data.slides['id:0']);
});
console.log(JSON.stringify({node:process.version,cpu:cpus()[0].model,
  scope:'Synthetic CPU-only; two warmups, seven repeats. Copy comparison excludes actual saving. Warm eraser cache excludes initial outline construction.',results},null,2));
