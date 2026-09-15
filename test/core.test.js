import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoint, denormalizePoint, slideKey, distanceToSegment } from '../src/coordinates.js';
import { History } from '../src/strokes.js';
import { emptyDocument, parseDocument, serialize } from '../src/export.js';
import { hitStroke } from '../src/renderer.js';
const stroke = { id: 's1', tool: 'pen', width: 4, color: '#fa8174', aspect: 1.5,
  options: { thinning: .2, smoothing: .7, streamline: .65, simulatePressure: false }, points: [[.1,.2,.3],[.9,.2,.8]] };
test('coordinates normalize translation, scaling and pressure; clamp boundaries', () => {
  assert.deepEqual(normalizePoint({clientX:300,clientY:150,pressure:.7},{left:100,top:50,width:400,height:200}),[.5,.5,.7]);
  assert.deepEqual(denormalizePoint([.5,.5,.7],960,700),[480,350,.7]);
  assert.deepEqual(normalizePoint({clientX:-1,clientY:500,pressure:0},{left:0,top:0,width:100,height:100}),[0,1,.5]);
  assert.throws(()=>normalizePoint({}, {width:0,height:10}));
});
test('stable IDs survive index changes; nested index fallback is distinct', () => {
  assert.equal(slideKey({id:'math'},{h:1}),slideKey({id:'math'},{h:4,v:2}));
  assert.notEqual(slideKey({id:''},{h:1,v:0}),slideKey({id:''},{h:1,v:1}));
});
test('add, erase, clear undo/redo are isolated per slide and branch correctly', () => {
  const h=new History(), a=[stroke], b=[stroke,{...stroke,id:'s2'}];
  h.record('a',[],a);h.record('a',a,b);h.record('a',b,[]);
  assert.deepEqual(h.undo('a'),b);assert.deepEqual(h.undo('a'),a);
  assert.equal(h.undo('b'),null);assert.deepEqual(h.redo('a'),b);
  h.record('a',b,a);assert.equal(h.redo('a'),null);
  h.clear();assert.equal(h.undo('a'),null);
});
test('versioned serialization round trips without sharing mutable input', () => {
  const data=emptyDocument('deck');data.slides['id:math']=[stroke];
  const copy=parseDocument(serialize(data));assert.deepEqual(copy,data);
  copy.slides['id:math'][0].points[0][0]=0;assert.equal(stroke.points[0][0],.1);
  assert.equal(parseDocument(data,'another-deck').presentation,'another-deck');
});
test('reject corrupt schemas, nonfinite/out-of-range points, bad styles, duplicate strokes', () => {
  const data=emptyDocument('deck');data.slides.a=[stroke];
  for(const mutate of [d=>d.version=2,d=>d.slides.a[0].points[0][0]=NaN,d=>d.slides.a[0].points[0][1]=2,
    d=>d.slides.a[0].color='url(https://example.com)',d=>d.slides.a.push(d.slides.a[0]),d=>d.slides.a[0].width=-1]) {
    const copy=structuredClone(data);mutate(copy);assert.throws(()=>parseDocument(copy));
  }
});
test('eraser catches sweeps across a stroke between samples, but not distant strokes', () => {
  assert.equal(distanceToSegment([5,2],[0,0],[10,0]),2);
  assert.ok(hitStroke(stroke,[.5,0],[.5,.5],1.5,5));
  assert.ok(!hitStroke(stroke,[.5,.8],[.5,.9],1.5,5));
});
