import { createAnimationCutState, animationCutSnapshot, animationCutRemember, animationCutUndo, animationCutDirty, animationCutIssues,
  animationCutContextConflict, animationCutLocked, buildAnimationCutPrepare, buildAnimationCutCommit, animationCutAcceptRevision, animationCutResult } from './animation-cut-state.js';
import { cutterDragRectangle } from './cutter-editor-state.js';
import { createAnimationCutView, updateAnimationCutView, syncAnimationCutCanvas } from './animation-cut-view.js';
const copy=value=>structuredClone(value);
export function createAnimationCutController({initial,host}) {
  const state=createAnimationCutState(initial),element=createAnimationCutView(state),listeners=new AbortController();
  let disposed=false,returned=false,requestController=null,readController=null,pollTimer=null,generation=0,readGeneration=0,fieldBefore=state.fieldBefore??null;
  const context=()=>host.getContext();
  const capture=()=>({focus:document.activeElement?.closest?.('[data-animation-cut-focus]')?.dataset.animationCutFocus??null,page:{x:window.scrollX,y:window.scrollY},
    scroll:Object.fromEntries([...element.querySelectorAll('[data-animation-cut-scroll]')].map(n=>[n.dataset.animationCutScroll,{x:n.scrollLeft,y:n.scrollTop}]))});
  function restore(saved){if(!saved)return;requestAnimationFrame(()=>{if(disposed||!element.isConnected)return;for(const n of element.querySelectorAll('[data-animation-cut-scroll]')){const p=saved.scroll?.[n.dataset.animationCutScroll];if(p){n.scrollLeft=p.x;n.scrollTop=p.y;}}
    [...element.querySelectorAll('[data-animation-cut-focus]')].find(n=>n.dataset.animationCutFocus===saved.focus)?.focus({preventScroll:true});window.scrollTo(saved.page?.x??window.scrollX,saved.page?.y??window.scrollY);});}
  function render(){if(!disposed&&!returned)updateAnimationCutView(element,state);}
  function reconcileContext(current=context()){state.conflict=animationCutContextConflict(state,current);render();return !state.conflict;}
  function stopPolling(){readGeneration+=1;clearTimeout(pollTimer);pollTimer=null;readController?.abort();readController=null;}
  function finish(binding=null){if(disposed||returned)return;state.viewContext=capture();returned=true;stopPolling();host.onBack(animationCutResult(state,{applied:Boolean(binding),binding}));}
  function validateBinding(binding,intent){
    if(!binding||binding.projectId!==state.projectId||binding.sliceId!==state.binding.sliceId||binding.sourceId!==state.binding.sourceId||binding.sourceDigest!==state.binding.sourceDigest
      ||binding.atlasId!==state.binding.atlasId||binding.processorId!==state.binding.processorId||!Number.isSafeInteger(binding.sliceVersion)||binding.sliceVersion<1
      ||!/^[a-f0-9]{64}$/.test(binding.digest??''))throw new Error('The receipt did not identify this exact source cut.');
    const expected=state.preparedIntent?.payload??intent.payload;
    for(const key of ['x','y','width','height'])if(binding.rectangle?.[key]!==expected.rectangle[key])throw new Error('The saved crop differs from this exact request.');
    if(binding.rectangle.name!==expected.name)throw new Error('The saved cut name differs from this exact request.');
    if(JSON.stringify(binding.rectangle.pivot)!==JSON.stringify(state.binding.rectangle.pivot)||binding.rectangle.transparentPaddingPolicy!==state.binding.rectangle.transparentPaddingPolicy)throw new Error('The saved cut changed its retained pivot or padding policy.');
    if(intent.jobId&&(binding.sliceVersion!==intent.payload.expectedSliceVersion+1||binding.definitionVersion!==intent.payload.expectedAtlasVersion+1))throw new Error('The saved cut or atlas version does not match this exact commit.');
  }
  function acceptJob(response,jobId){const job=response?.job??response;
    if((response.projectId!==undefined&&response.projectId!==state.projectId)||job?.jobId!==jobId||job.atlasId!==state.binding.atlasId||job.sourceId!==state.binding.sourceId)
      throw new Error('The job response belongs to another cut context.');
    if(job.input&&(job.input.operation!=='slice.revision'||job.input.revision?.sliceId!==state.binding.sliceId||job.input.revision?.sourceSliceVersion!==state.binding.sliceVersion))throw new Error('The job is not this exact single-cut revision.');
    state.job=copy(job);return job;
  }
  async function request(kind,intent,retry=false){
    if(disposed||returned||state.operation.status==='pending')return;
    const uncertain=retry&&state.operation.status==='uncertain';stopPolling();const controller=new AbortController(),own=++generation;requestController=controller;
    const timer=setTimeout(()=>controller.abort(),15000);state.operation={status:'pending',kind,intent};state.error=null;host.setMutationPending(true);render();
    let poll=false,applied=null;
    try {
      const method={prepare:'prepareCut',commit:'commitCut',cancel:'cancelJob',retry:'retryJob',discard:'discardJob'}[kind];
      if(typeof host[method]!=='function')throw Object.assign(new Error('This job action is unavailable in the current context.'),{status:400});
      const receipt=await host[method](intent,{signal:controller.signal});if(disposed||own!==generation)return;
      if(kind==='prepare'||kind==='commit'){
        const value=receipt?.value;
        if(kind==='prepare'){
          if(value?.status==='REUSED'){validateBinding(value.sliceBinding,intent);animationCutAcceptRevision(state,receipt,intent);applied=value.sliceBinding;}
          else if(value?.status==='ACCEPTED'&&value.jobId===intent.payload.jobId){animationCutAcceptRevision(state,receipt,intent);state.job={jobId:value.jobId,state:'QUEUED',atlasId:state.binding.atlasId,sourceId:state.binding.sourceId};state.jobDeadline=Date.now()+120000;poll=true;}
          else throw new Error('The response did not confirm this exact cut preparation.');
        }else{
          if(value?.status!=='COMMITTED'||value.jobId!==intent.jobId)throw new Error('The response did not confirm this exact cut commit.');
          validateBinding(value.sliceBinding,intent);animationCutAcceptRevision(state,receipt,intent);applied=value.sliceBinding;if(state.job)state.job.state='APPLIED';
        }
      }else{
        const job=acceptJob(receipt,intent.jobId);
        if(kind==='retry'&&job.attempt<=intent.payload.expectedAttempt)throw new Error('The response did not confirm the requested retry attempt.');
        if(kind==='discard'&&job.state!=='DISCARDED')throw new Error('The response did not confirm discard.');
        if(kind==='cancel'&&!job.cancelRequested&&!['CANCELLED','DISCARDED'].includes(job.state))throw new Error('The response did not confirm cancellation.');
        if(kind==='retry'){state.jobDeadline=Date.now()+120000;state.cancelRequested=false;}
        poll=!['FAILED','CANCELLED','DISCARDED','APPLIED'].includes(job.state);
      }
      state.operation={status:'idle',kind:null,intent:null};state.conflict=animationCutContextConflict(state,context());
    }catch(error){if(disposed||own!==generation)return;const rejected=!uncertain&&Number.isInteger(error.status)&&error.status>=400&&error.status<500&&error.status!==408;
      state.operation={status:rejected?'idle':'uncertain',kind,intent:rejected?null:intent};state.error=rejected?`${error.message} Your drafts are retained.`:'The request outcome is unconfirmed. Its exact bytes and key are retained. Retry that request before leaving.';
      if(rejected&&error.status===409)state.conflict='The project, cut or atlas changed. Return to the animation to recheck its saved context; this cut draft is retained.';
    }finally{clearTimeout(timer);if(requestController===controller)requestController=null;host.setMutationPending(false);if(!disposed){render();if(applied)finish(applied);else if(poll)void pollJob();}}
  }
  async function use(){if(animationCutLocked(state)||state.gesture||!reconcileContext())return;try{const intent=buildAnimationCutPrepare(state,`cut.prepare.${crypto.randomUUID()}`,`cut.job.${crypto.randomUUID()}`);state.preparedIntent=copy(intent);state.cancelRequested=false;await request('prepare',intent);}catch(error){state.error=error.message;render();}}
  async function commitJob(){if(disposed||returned||state.operation.status!=='idle'||state.cancelRequested||!reconcileContext())return;
    try{await request('commit',buildAnimationCutCommit(state,`cut.commit.${crypto.randomUUID()}`));}catch(error){state.error=error.message;render();}}
  async function pollJob(){
    if(disposed||returned||readController||!state.job||state.operation.status!=='idle')return;
    const jobId=state.job.jobId,own=++readGeneration,controller=new AbortController();readController=controller;const timer=setTimeout(()=>controller.abort(),8000);let next=false,commit=false;
    try{const response=await host.readJob(jobId,{signal:controller.signal});if(disposed||returned||own!==readGeneration||state.job?.jobId!==jobId)return;const job=acceptJob(response,jobId);
      state.error=null;
      if(job.state==='SUCCEEDED'&&!state.cancelRequested)commit=true;
      else if(['FAILED','CANCELLED'].includes(job.state))state.error=job.state==='FAILED'?'Cut processing failed. Retry or discard this job; your animation draft is retained.':'The cut job was cancelled. Discard it to edit a new crop, or retry the same crop.';
      else if(!['DISCARDED','APPLIED'].includes(job.state))next=true;
    }catch(error){if(!disposed&&!returned&&own===readGeneration){state.error=`The job could not be read: ${error.message}. Recheck or cancel it; your drafts are retained.`;next=true;}}
    finally{clearTimeout(timer);if(readController===controller)readController=null;if(!disposed&&!returned&&own===readGeneration){if(next&&Date.now()>=state.jobDeadline){next=false;state.error='The cut job has not completed within two minutes. Recheck its current state or cancel it; your drafts are retained.';}render();if(commit)void commitJob();else if(next)pollTimer=setTimeout(()=>{pollTimer=null;void pollJob();},1000);}}
  }
  async function jobAction(kind){if(!state.job||state.operation.status!=='idle')return;const payload={operationIdempotencyKey:`cut.job.${kind}.${crypto.randomUUID()}`};if(kind==='retry')payload.expectedAttempt=state.job.attempt;
    if(kind==='cancel'||kind==='discard')state.cancelRequested=true;
    const intent={projectId:state.projectId,jobId:state.job.jobId,payload,serialized:JSON.stringify(payload)};await request(kind,intent);}
  async function recheck(){if(disposed||state.operation.status==='pending')return;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const result=await host.readCutContext({sliceId:state.binding.sliceId,sliceVersion:state.binding.sliceVersion},{signal:controller.signal});if(disposed||returned)return;
      if(result?.projectId!==state.projectId||result.binding?.sliceId!==state.binding.sliceId||result.binding?.sliceVersion!==state.binding.sliceVersion)throw new Error('The read did not match the exact saved cut.');
      state.error=state.operation.status==='uncertain'?'Current state was read. Retry the original request to obtain its exact receipt; matching visible content alone cannot confirm delivery.'
        :result.currentHead.sliceVersion!==state.sourceContext.currentHead.sliceVersion||result.atlas.definitionVersion!==state.sourceContext.atlas.definitionVersion?'The cut or atlas changed. Return to the animation and reopen its current context. This draft is retained.':'The cut and atlas versions still match. Your animation context must also remain current.';
      state.conflict=animationCutContextConflict(state,context());
    }catch(error){if(!disposed)state.error=error.message;}finally{clearTimeout(timer);render();}}
  function cancelGesture(){const g=state.gesture;if(!g)return false;state.gesture=null;Object.assign(state,copy(g.before));if(g.canvas.hasPointerCapture?.(g.pointerId))g.canvas.releasePointerCapture(g.pointerId);render();return true;}
  const point=(event,inverse)=>new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);
  function pointerDown(event){if(event.button!==0||animationCutLocked(state)||state.gesture||animationCutIssues(state).length)return;const handle=event.target.closest('[data-animation-cut-handle]'),box=event.target.closest('[data-animation-cut-box]');if(!handle&&!box)return;
    const canvas=element.querySelector('[data-animation-cut-canvas]'),inverse=canvas.getScreenCTM()?.inverse();if(!inverse)return;event.preventDefault();canvas.focus({preventScroll:true});state.gesture={canvas,inverse,pointerId:event.pointerId,mode:handle?.dataset.animationCutHandle??'move',start:point(event,inverse),before:animationCutSnapshot(state),scale:state.scale};canvas.setPointerCapture(event.pointerId);render();}
  function pointerMove(event){const g=state.gesture;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();state.model.rectangle=cutterDragRectangle(g.before.model.rectangle,g.start,point(event,g.inverse),{mode:g.mode,source:state.sourceContext.source});state.fieldDrafts={};render();}
  function pointerEnd(event){const g=state.gesture;if(!g||event.pointerId!==g.pointerId)return;if(event.type!=='pointerup'){cancelGesture();return;}state.gesture=null;if(g.canvas.hasPointerCapture?.(g.pointerId))g.canvas.releasePointerCapture(g.pointerId);animationCutRemember(state,g.before);render();}
  function input(event){if(animationCutLocked(state)||state.gesture)return;const target=event.target;
    if(target.matches('[data-animation-cut-zoom]')){state.zoom=String(Number(target.value)/100);syncAnimationCutCanvas(element,state);return;}
    const key=target.dataset.animationCutField;if(!key)return;fieldBefore??=animationCutSnapshot(state);state.fieldBefore=copy(fieldBefore);state.error=null;
    if(key==='name')state.model.name=target.value;else{state.fieldDrafts[key]=target.value;state.model.rectangle[key]=target.value.trim()===''?NaN:Number(target.value);}render();}
  function change(event){if(animationCutLocked(state)||state.gesture)return;const target=event.target;if(target.matches('[data-animation-cut-scope]')){state.scope=target.value==='clip'?'clip':'frame';return;}
    if(!target.dataset.animationCutField)return;input(event);const key=target.dataset.animationCutField;if(target.value.trim()!==''&&Number.isSafeInteger(Number(target.value)))delete state.fieldDrafts[key];if(fieldBefore)animationCutRemember(state,fieldBefore);fieldBefore=null;delete state.fieldBefore;render();}
  function requestLeave(){if(animationCutLocked(state)){host.announce?.('Resolve the pending cut request or discard its job before returning. Your drafts are retained.');return false;}cancelGesture();return true;}
  async function click(event){const target=event.target.closest('[data-animation-cut-action]');if(!target||target.disabled)return;const action=target.dataset.animationCutAction;
    if(action==='retry-request'){const op=state.operation;if(op.status==='uncertain'&&op.intent)await request(op.kind,op.intent,true);return;}
    if(action==='recheck'){await recheck();return;}if(action==='recheck-job'){await pollJob();return;}
    if(['cancel-job','retry-job','discard-job'].includes(action)){await jobAction(action.split('-')[0]);return;}
    if(action==='back'){if(requestLeave())finish();return;}if(animationCutLocked(state)||state.gesture)return;
    if(action==='use')await use();else if(action==='undo'||action==='redo'){animationCutUndo(state,action==='redo');fieldBefore=null;delete state.fieldBefore;render();}
    else if(action==='fit'||action==='actual-size'){state.zoom=action==='fit'?'fit':'1';render();}else if(action==='select')element.querySelector('[data-animation-cut-canvas]').focus({preventScroll:true});}
  const on=(node,name,fn)=>node.addEventListener(name,fn,{signal:listeners.signal});
  on(element,'click',event=>void click(event));on(element,'input',input);on(element,'change',change);on(element,'focusin',event=>{if(event.target.matches('[data-animation-cut-field]')){fieldBefore??=animationCutSnapshot(state);state.fieldBefore=copy(fieldBefore);}});
  on(element,'pointerdown',pointerDown);on(element,'pointermove',pointerMove);for(const name of ['pointerup','pointercancel','lostpointercapture'])on(element,name,pointerEnd);
  on(element,'keydown',event=>{if(event.key==='Escape'){if(cancelGesture())event.preventDefault();return;}if(animationCutLocked(state)||event.target.matches('input,textarea,select'))return;
    if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();animationCutUndo(state,event.shiftKey||event.key.toLowerCase()==='y');render();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta||animationCutIssues(state).length)return;event.preventDefault();const before=animationCutSnapshot(state),step=event.shiftKey?10:1;state.model.rectangle=cutterDragRectangle(state.model.rectangle,{x:0,y:0},{x:delta[0]*step,y:delta[1]*step},{source:state.sourceContext.source});animationCutRemember(state,before);render();});
  on(window,'beforeunload',event=>{if(animationCutDirty(state)||animationCutLocked(state)){event.preventDefault();event.returnValue='';}});
  const observer=new ResizeObserver(()=>{if(!disposed&&!state.gesture&&element.isConnected)syncAnimationCutCanvas(element,state);});observer.observe(element.querySelector('[data-animation-cut-scroll="canvas"]'));
  return {element,getState:()=>copy({...state,gesture:state.gesture?{pointerId:state.gesture.pointerId,mode:state.gesture.mode,scale:state.gesture.scale}:null}),afterMount(){render();restore(state.viewContext);if(state.job&&state.operation.status==='idle'&&!['FAILED','CANCELLED','DISCARDED','APPLIED'].includes(state.job.state))void pollJob();},reconcileContext,requestLeave,
    dispose(){disposed=true;generation+=1;stopPolling();requestController?.abort();listeners.abort();observer.disconnect();}};
}
