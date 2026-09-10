import { cutterEditIssues, cutterHistoryPush, cutterHistoryStep } from './cutter-editor-state.js';
const copy = value => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function animationCutIdentity(binding) { return `${binding.projectId}:${binding.sliceId}@${binding.sliceVersion}`; }
export function createAnimationCutState(initial) {
  if (!initial.binding || initial.binding.projectId !== initial.projectId || !initial.sourceContext || initial.sourceContext.projectId !== initial.projectId
    || !initial.sourceContext.binding || animationCutIdentity(initial.sourceContext.binding) !== animationCutIdentity(initial.binding)) throw new Error('Open the exact saved cut in its original project.');
  const identity = animationCutIdentity(initial.binding), session = initial.session;
  if (session && (session.identity !== identity || session.frameId !== initial.frameId)) throw new Error('This cut draft belongs to another frame or saved cut version.');
  const rectangle = Object.fromEntries(['x','y','width','height'].map(key => [key, initial.binding.rectangle[key]]));
  const model = { name: initial.binding.rectangle.name ?? 'Source cut', rectangle };
  const state = session ? copy(session) : { schemaVersion:1, identity, frameId:initial.frameId, model:copy(model), original:copy(model), lastValidRectangle:copy(rectangle), fieldDrafts:{},
    history:{past:[],future:[]}, scope:'frame', zoom:'fit', scale:1, viewContext:null, operation:{status:'idle',kind:null,intent:null}, job:null, jobDeadline:null,
    ownRevisions:[initial.projectRevision], projectRevision:initial.projectRevision, error:null, conflict:null };
  state.projectId = initial.projectId; state.binding = copy(initial.binding); state.sourceContext = copy(session?.sourceContext ?? initial.sourceContext);
  if (session && (initial.sourceContext.currentHead.sliceVersion !== state.sourceContext.currentHead.sliceVersion || initial.sourceContext.atlas.definitionVersion !== state.sourceContext.atlas.definitionVersion)) state.conflict = 'The saved cut or atlas changed while this draft was closed. Return to the animation to recheck its context.'; state.matchingCount = Math.max(1,initial.matchingCount ?? 1); state.gesture = null;
  if (state.matchingCount === 1) state.scope = 'frame';
  return state;
}
export function animationCutSnapshot(state) { return copy({ model:state.model,fieldDrafts:state.fieldDrafts }); }
export function animationCutRemember(state,before) { state.history=cutterHistoryPush(state.history,before,animationCutSnapshot(state),{limit:50}); }
export function animationCutUndo(state,redo=false) {
  const step=cutterHistoryStep(state.history,animationCutSnapshot(state),redo?'redo':'undo');
  if(step.changed){state.history=step.history;Object.assign(state,step.rectangles);state.error=null;} return step.changed;
}
export function animationCutDirty(state) { return !same(state.model,state.original)||Object.keys(state.fieldDrafts).length>0; }
export function animationCutIssues(state) {
  const issues=[];
  if(typeof state.model.name!=='string'||!state.model.name.trim()||state.model.name.trim().length>160)issues.push('Give the cut a name of 1–160 characters.');
  if(Object.values(state.fieldDrafts).some(value=>value.trim()===''||!Number.isFinite(Number(value))||!Number.isSafeInteger(Number(value))))issues.push('Complete whole-pixel coordinates before using the revised cut.');
  const rectangle={...state.binding.rectangle,...state.model.rectangle,rectangleId:state.binding.rectangleId,name:state.model.name,included:true};
  issues.push(...cutterEditIssues([rectangle],state.sourceContext.source).messages);
  return [...new Set(issues)];
}
export function animationCutContextConflict(state,context) {
  if(context?.projectId!==state.projectId)return 'The selected project changed. Return to the original project; this cut draft is retained.';
  if(!state.ownRevisions.includes(context.projectRevision))return 'The project changed outside this cut edit. Your animation and cut drafts are retained; return to the animation to recheck its saved context.';
  return null;
}
export function animationCutLocked(state) { return ['pending','uncertain'].includes(state.operation.status)||Boolean(state.job&&!['DISCARDED','APPLIED'].includes(state.job.state)); }
export function buildAnimationCutPrepare(state,idempotencyKey,jobId) {
  const issues=animationCutIssues(state);if(issues.length)throw new Error(issues.join(' '));
  const context=state.sourceContext;
  const payload={expectedRevision:state.projectRevision,idempotencyKey,sourceSliceVersion:state.binding.sliceVersion,
    expectedSliceVersion:context.currentHead.sliceVersion,expectedAtlasVersion:context.atlas.definitionVersion,jobId,name:state.model.name.trim(),rectangle:copy(state.model.rectangle)};
  return {projectId:state.projectId,sliceId:state.binding.sliceId,payload,serialized:JSON.stringify(payload)};
}
export function buildAnimationCutCommit(state,idempotencyKey) {
  if(state.job?.state!=='SUCCEEDED')throw new Error('Wait for the exact cut job to succeed before saving its output.');
  const payload={expectedRevision:state.projectRevision,idempotencyKey,sliceId:state.binding.sliceId,
    expectedSliceVersion:state.sourceContext.currentHead.sliceVersion,expectedAtlasVersion:state.sourceContext.atlas.definitionVersion};
  return {projectId:state.projectId,sliceId:state.binding.sliceId,jobId:state.job.jobId,payload,serialized:JSON.stringify(payload)};
}
export function animationCutAcceptRevision(state,receipt,intent) {
  if(receipt?.projectId!==intent.projectId||receipt.revision!==intent.payload.expectedRevision+1)throw new Error('The response did not confirm this exact cut request.');
  state.projectRevision=receipt.revision;if(!state.ownRevisions.includes(receipt.revision))state.ownRevisions.push(receipt.revision);
}
export function animationCutResult(state,{applied=false,binding=null}={}) {
  const session=copy({...state,gesture:null});
  return {applied,...(binding?{binding:copy(binding)}:{}),projectRevision:state.projectRevision,scope:state.matchingCount>1?state.scope:'frame',session};
}
