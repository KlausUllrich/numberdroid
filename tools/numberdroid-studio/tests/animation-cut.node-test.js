import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as stateHelpers from '../apps/studio-server/public/animation-cut-state.js';
import { cutterDragRectangle } from '../apps/studio-server/public/cutter-editor-state.js';
const copy=value=>structuredClone(value);
function initial(){const binding={projectId:'project.cut',sliceId:'slice.display',sliceVersion:2,atlasId:'atlas.display',sourceId:'source.display',sourceDigest:'a'.repeat(64),processorId:'processor.fixture',digest:'b'.repeat(64),width:20,height:16,rectangleId:'rect.display',rectangle:{x:10,y:12,width:20,height:16,name:'Display',included:true,pivot:null,transparentPaddingPolicy:'preserve_exact_rect'}};
return {projectId:binding.projectId,projectRevision:10,frameId:'frame.one',binding,matchingCount:2,sourceContext:{projectId:binding.projectId,revision:10,binding:copy(binding),currentHead:{sliceId:binding.sliceId,sliceVersion:4},atlas:{atlasId:binding.atlasId,definitionVersion:5},source:{sourceId:binding.sourceId,digest:binding.sourceDigest,width:256,height:128}}};}
function revised(binding,request){return {...copy(binding),sliceVersion:5,width:request.payload.rectangle.width,height:request.payload.rectangle.height,rectangle:{...binding.rectangle,...request.payload.rectangle,name:request.payload.name},digest:'c'.repeat(64)};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(t,overrides={}){
 const raw=await readFile(new URL('../apps/studio-server/public/animation-cut-controller.js',import.meta.url),'utf8');
 const body=raw.slice(raw.indexOf('const copy=')).replace('export function createAnimationCutController','function createAnimationCutController').replace('return {element,getState:', 'return {use,request,pollJob,jobAction,click,testState:state,element,getState:');
 const setup=initial(),requests=[],returns=[],pending=[],context={projectId:setup.projectId,projectRevision:10};
 const element={isConnected:false,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>({})};let prepareIntent;
 const host={getContext:()=>context,readCutContext:async()=>setup.sourceContext,prepareCut:async intent=>{prepareIntent=copy(intent);requests.push(copy(intent));return {projectId:setup.projectId,revision:11,value:{status:'ACCEPTED',jobId:intent.payload.jobId}};},
 readJob:async jobId=>({projectId:setup.projectId,job:{jobId,atlasId:setup.binding.atlasId,sourceId:setup.binding.sourceId,state:'SUCCEEDED',attempt:1}}),
 commitCut:async intent=>{requests.push(copy(intent));return {projectId:setup.projectId,revision:12,value:{status:'COMMITTED',jobId:intent.jobId,sliceBinding:revised(setup.binding,prepareIntent)}};},
 onBack:value=>returns.push(value),setMutationPending:value=>pending.push(value),announce(){},...overrides};
 const create=runInNewContext(`${body};createAnimationCutController;`,{...stateHelpers,cutterDragRectangle,structuredClone,crypto,AbortController,setTimeout,clearTimeout,Date,Number,JSON,Error,
 createAnimationCutView:()=>element,updateAnimationCutView(){},syncAnimationCutCanvas(){},document:{activeElement:null},window:{scrollX:4,scrollY:20,addEventListener(){}},requestAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},DOMPoint:class{}});
 const controller=create({initial:setup,host});t.after(()=>controller.dispose());return {controller,setup,requests,returns,pending,context};
}
test('Contextual cut retains raw invalid fields, scope, history and view without changing the pinned cut',()=>{
 const setup=initial(),state=stateHelpers.createAnimationCutState(setup),before=stateHelpers.animationCutSnapshot(state);
 state.model.rectangle.x=NaN;state.fieldDrafts.x='';state.scope='clip';state.zoom='1';state.viewContext={page:{x:12,y:77},scroll:{canvas:{x:55,y:66}}};stateHelpers.animationCutRemember(state,before);
 assert.match(stateHelpers.animationCutIssues(state).join(' '),/whole-pixel/);const result=stateHelpers.animationCutResult(state);assert.equal(result.applied,false);assert.equal(result.binding,undefined);
 const resumed=stateHelpers.createAnimationCutState({...setup,session:result.session});assert.equal(resumed.fieldDrafts.x,'');assert.equal(resumed.scope,'clip');assert.equal(resumed.zoom,'1');assert.deepEqual(resumed.viewContext,state.viewContext);
 stateHelpers.animationCutUndo(resumed);assert.equal(resumed.model.rectangle.x,10);assert.deepEqual(resumed.binding,setup.binding);assert.throws(()=>stateHelpers.createAnimationCutState({...setup,frameId:'frame.other',session:result.session}),/another frame/);
});
test('Cut requests retain original pin while checking current cut/atlas heads, preserve pivots and freeze numeric drafts',()=>{
 const state=stateHelpers.createAnimationCutState(initial());state.model.rectangle.x=13;const intent=stateHelpers.buildAnimationCutPrepare(state,'idem.cut','job.cut');
 assert.equal(intent.payload.sourceSliceVersion,2);assert.equal(intent.payload.expectedSliceVersion,4);assert.equal(intent.payload.expectedAtlasVersion,5);assert.equal(intent.payload.rectangle.x,13);
 state.model.rectangle.x=15;assert.equal(JSON.parse(intent.serialized).rectangle.x,13);assert.equal(stateHelpers.animationCutContextConflict(state,{projectId:state.projectId,projectRevision:11})!==null,true);
 stateHelpers.animationCutAcceptRevision(state,{projectId:state.projectId,revision:11},intent);assert.equal(stateHelpers.animationCutContextConflict(state,{projectId:state.projectId,projectRevision:11}),null);
 state.binding.rectangle.pivot={x:19,y:15};state.model.rectangle.width=10;assert.match(stateHelpers.animationCutIssues(state).join(' '),/pivot/);
});
test('Each accepted edge handle changes only its axis under source-pixel dragging',()=>{
 const rectangle={x:10,y:12,width:20,height:16},source={width:256,height:128};
 for(const edge of ['n','s']){const result=cutterDragRectangle(rectangle,{x:0,y:0},{x:7,y:3},{mode:edge,source});assert.equal(result.x,10);assert.equal(result.width,20);}
 for(const edge of ['e','w']){const result=cutterDragRectangle(rectangle,{x:0,y:0},{x:3,y:7},{mode:edge,source});assert.equal(result.y,12);assert.equal(result.height,16);}
});
test('Use revised cut waits for its actual job and exact commit receipt before updating the parent',async t=>{
 const h=await harness(t);h.controller.testState.model.rectangle.x=12;h.controller.testState.scope='clip';await h.controller.use();await flush();await flush();
 assert.equal(h.requests.length,2);assert.equal(h.returns.length,1);assert.equal(h.returns[0].applied,true);assert.equal(h.returns[0].projectRevision,12);assert.equal(h.returns[0].scope,'clip');assert.equal(h.returns[0].binding.rectangle.x,12);
 assert.equal(h.requests[0].payload.expectedRevision,10);assert.equal(h.requests[1].payload.expectedRevision,11);assert.equal(h.pending.at(-1),false);
});
test('Lost preparation response retains exact bytes/key and blocks Back until receipt replay succeeds',async t=>{
 let lose=true,seen=[];const h=await harness(t,{prepareCut:async intent=>{seen.push(copy(intent));if(lose)throw new Error('response lost');return {projectId:intent.projectId,revision:11,value:{status:'REUSED',sliceBinding:revised(initial().binding,intent),jobId:null}};}});
 h.controller.testState.model.rectangle.x=14;await h.controller.use();assert.equal(h.controller.getState().operation.status,'uncertain');assert.equal(h.controller.requestLeave(),false);assert.equal(h.returns.length,0);
 const op=h.controller.getState().operation;lose=false;await h.controller.request(op.kind,op.intent,true);assert.deepEqual(seen[0],seen[1]);assert.equal(h.returns[0].projectRevision,11);assert.equal(h.returns[0].applied,true);
});
test('Wrong commit receipt stays uncertain and cannot apply a different crop or waive a project conflict',async t=>{
 const h=await harness(t,{commitCut:async intent=>({projectId:intent.projectId,revision:12,value:{status:'COMMITTED',jobId:intent.jobId,sliceBinding:{...initial().binding,sliceVersion:5}}})});
 h.controller.testState.model.rectangle.x=15;await h.controller.use();await flush();await flush();assert.equal(h.controller.getState().operation.status,'uncertain');assert.equal(h.returns.length,0);assert.equal(h.controller.getState().projectRevision,11);
 h.context.projectRevision=12;assert.equal(h.controller.reconcileContext(),false);assert.equal(h.controller.requestLeave(),false);
});

test('Cancel and discard use exact job-operation keys, do not advance project revision, and retain drafts for Back',async t=>{
 const operations=[];const job=(jobId,state)=>({projectId:'project.cut',job:{jobId,atlasId:'atlas.display',sourceId:'source.display',state,attempt:1}});
 const h=await harness(t,{readJob:async jobId=>job(jobId,'RUNNING'),cancelJob:async intent=>{operations.push(copy(intent));return job(intent.jobId,'CANCELLED');},discardJob:async intent=>{operations.push(copy(intent));return job(intent.jobId,'DISCARDED');}});
 h.controller.testState.model.rectangle.x=14;await h.controller.use();await flush();await h.controller.jobAction('cancel');assert.equal(h.controller.getState().projectRevision,11);assert.equal(h.controller.requestLeave(),false);
 await h.controller.jobAction('discard');assert.equal(h.controller.getState().projectRevision,11);assert.equal(h.controller.requestLeave(),true);assert.deepEqual(Object.keys(operations[0].payload),['operationIdempotencyKey']);
 await h.controller.click({target:{closest:()=>({disabled:false,dataset:{animationCutAction:'back'}})}});assert.equal(h.returns[0].applied,false);assert.equal(h.returns[0].session.model.rectangle.x,14);assert.equal(h.returns[0].projectRevision,11);
});
test('A late job read cannot overwrite a newer cancellation or commit automatically',async t=>{
 let release;const h=await harness(t,{readJob:jobId=>new Promise(resolve=>{release=()=>resolve({projectId:'project.cut',job:{jobId,atlasId:'atlas.display',sourceId:'source.display',state:'SUCCEEDED',attempt:1}});}),cancelJob:async intent=>({projectId:'project.cut',job:{jobId:intent.jobId,atlasId:'atlas.display',sourceId:'source.display',state:'CANCELLED',attempt:1}})});
 h.controller.testState.model.rectangle.x=12;await h.controller.use();assert.equal(typeof release,'function');await h.controller.jobAction('cancel');release();await flush();
 assert.equal(h.controller.getState().job.state,'CANCELLED');assert.equal(h.returns.length,0);assert.equal(h.requests.length,1);
});
