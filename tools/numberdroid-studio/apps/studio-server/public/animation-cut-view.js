import { animationCutIssues, animationCutDirty, animationCutLocked } from './animation-cut-state.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const svg=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));return n;};
const button=(text,action)=>{const n=el('button','secondary',text);n.type='button';n.dataset.animationCutAction=action;n.dataset.animationCutFocus=action;return n;};
const note=text=>el('p','animation-cut-note',text);
function input(key,label,value){const wrap=el('label','animation-cut-field'),n=el('input');n.type=key==='name'?'text':'number';n.value=String(value);if(n.type==='number')n.step='1';else n.maxLength=160;n.dataset.animationCutField=key;n.dataset.animationCutFocus=`field:${key}`;wrap.append(el('span','',label),n);return wrap;}
export function animationCutArtifactUrl(projectId,digest){if(!projectId||!/^[a-f0-9]{64}$/.test(digest??''))throw new Error('The exact original source image is unavailable.');return `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${digest}`;}
export function createAnimationCutView(state){
  const root=el('section','animation-cut-editor');root.dataset.animationCutEditor='';
  const header=el('header','animation-cut-header'),heading=el('div');heading.append(el('p','eyebrow','Animation / Source cut'),el('h2','','Edit source cut'),note('Adjust this cut in its original sheet. Your animation draft stays open, including timing, alignment and Undo.'));
  header.append(heading,button('Back to animation','back'));root.append(header);
  const status=el('div','animation-cut-status');status.dataset.animationCutStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
  const recovery=el('div','animation-cut-recovery');recovery.dataset.animationCutRecovery='';root.append(recovery);
  const layout=el('div','animation-cut-layout'),rail=el('nav','animation-cut-tools');rail.setAttribute('aria-label','Source cut tools');
  for(const [label,action]of [['Select','select'],['Undo','undo'],['Redo','redo']])rail.append(button(label,action));
  const main=el('section','animation-cut-main'),zoom=el('div','animation-cut-zoom');zoom.append(button('Fit','fit'),button('100%','actual-size'));
  const slider=el('input');slider.type='range';slider.min='10';slider.max='400';slider.step='1';slider.dataset.animationCutZoom='';slider.dataset.animationCutFocus='zoom';slider.setAttribute('aria-label','Source image zoom percent');
  const output=el('output');output.dataset.animationCutZoomLabel='';zoom.append(slider,output);main.append(zoom);
  const viewport=el('div','animation-cut-viewport');viewport.dataset.animationCutScroll='canvas';const stage=el('div','animation-cut-stage');
  const canvas=svg('svg',{tabindex:0,role:'group','aria-label':'Original PNG sheet and editable source cut'});canvas.dataset.animationCutCanvas='';canvas.dataset.animationCutFocus='canvas';
  const source=state.sourceContext.source,href=animationCutArtifactUrl(state.projectId,source.digest);
  canvas.append(svg('image',{href,x:0,y:0,width:source.width,height:source.height,'pointer-events':'none'}));
  const box=svg('rect',{class:'animation-cut-box'});box.dataset.animationCutBox='';canvas.append(box);
  for(const edge of ['nw','n','ne','e','se','s','sw','w']){const handle=svg('circle',{class:'animation-cut-handle'});handle.dataset.animationCutHandle=edge;handle.style.cursor=`${edge}-resize`;canvas.append(handle);}
  stage.append(canvas);viewport.append(stage);main.append(viewport,note('Drag the box to move it. Edge handles change one axis; corners change both. Every change uses whole source pixels.'));
  const result=el('div','animation-cut-result'),picture=svg('svg',{role:'img','aria-label':'Revised cut preview',preserveAspectRatio:'xMidYMid meet'});picture.dataset.animationCutPreview='';picture.append(svg('image',{href,x:0,y:0,width:source.width,height:source.height}));
  const caption=el('div');caption.append(el('h3','','Revised cut preview'));const size=el('p','animation-cut-note');size.dataset.animationCutSize='';caption.append(size,note('The original source image stays unchanged.'));result.append(picture,caption);main.append(result);
  const inspector=el('aside','animation-cut-inspector');inspector.dataset.animationCutScroll='inspector';inspector.append(el('h3','','Selected cut'),note(`${state.binding.rectangle.name??'Source cut'} · saved v${state.binding.sliceVersion}`),input('name','Cut name',state.model.name));
  const coords=el('div','animation-cut-coordinates');for(const [key,label]of [['x','Left'],['y','Top'],['width','Width'],['height','Height']])coords.append(input(key,`${label} (px)`,state.model.rectangle[key]));inspector.append(coords,el('h3','','Use the revised cut'));
  if(state.matchingCount>1){const wrap=el('label','animation-cut-field'),scope=el('select');scope.dataset.animationCutScope='';scope.dataset.animationCutFocus='scope';for(const [value,label]of [['frame','This frame only'],['clip',`All ${state.matchingCount} uses in this animation`]]){const option=el('option','',label);option.value=value;scope.append(option);}scope.value=state.scope;wrap.append(el('span','','Update in this animation'),scope);inspector.append(wrap);}else inspector.append(note('Only this frame uses the cut in this animation.'));
  inspector.append(note('Trimming keeps artwork aligned by adjusting each affected frame’s offset. Frame names and timing stay as authored.'),note('Other saved animations keep their exact cut versions.'));
  const apply=button('Use revised cut','use');apply.classList.add('primary');inspector.append(apply,note('Saves a cut revision, then updates your animation draft. Save the animation separately when ready.'));
  layout.append(rail,main,inspector);root.append(layout);
  const footer=el('footer','animation-cut-footer');footer.append(note('Animation edits retained · source image unchanged'),button('Back without applying','back'));root.append(footer);return root;
}
export function syncAnimationCutCanvas(root,state){
  const canvas=root.querySelector('[data-animation-cut-canvas]'),viewport=root.querySelector('[data-animation-cut-scroll="canvas"]'),source=state.sourceContext.source,pad=12;
  const frame={x:-pad,y:-pad,width:source.width+pad*2,height:source.height+pad*2};
  const fit=Math.max(.01,Math.min(Math.max(100,viewport.clientWidth-24)/frame.width,Math.max(100,viewport.clientHeight-24)/frame.height));
  const scale=state.gesture?.scale??(state.zoom==='fit'?fit:Number(state.zoom));state.scale=scale;
  canvas.setAttribute('viewBox',`${frame.x} ${frame.y} ${frame.width} ${frame.height}`);canvas.setAttribute('width',frame.width*scale);canvas.setAttribute('height',frame.height*scale);
  if(!animationCutIssues(state).length)state.lastValidRectangle=structuredClone(state.model.rectangle);
  const r=state.lastValidRectangle,box=canvas.querySelector('[data-animation-cut-box]');for(const [key,value]of Object.entries(r))box.setAttribute(key,value);
  const points={nw:[r.x,r.y],n:[r.x+r.width/2,r.y],ne:[r.x+r.width,r.y],e:[r.x+r.width,r.y+r.height/2],se:[r.x+r.width,r.y+r.height],s:[r.x+r.width/2,r.y+r.height],sw:[r.x,r.y+r.height],w:[r.x,r.y+r.height/2]};
  for(const handle of canvas.querySelectorAll('[data-animation-cut-handle]')){const [x,y]=points[handle.dataset.animationCutHandle];handle.setAttribute('cx',x);handle.setAttribute('cy',y);handle.setAttribute('r',5.5/scale);}
  root.querySelector('[data-animation-cut-preview]').setAttribute('viewBox',`${r.x} ${r.y} ${r.width} ${r.height}`);
  root.querySelector('[data-animation-cut-size]').textContent=`${r.width} × ${r.height} px${animationCutIssues(state).length?' · last valid crop shown':''}`;
  root.querySelector('[data-animation-cut-zoom-label]').textContent=`${state.zoom==='fit'?'Fit · ':''}${Math.round(scale*100)}%`;
  const slider=root.querySelector('[data-animation-cut-zoom]');if(document.activeElement!==slider)slider.value=String(Math.round(scale*100));
}
export function updateAnimationCutView(root,state){
  const issues=animationCutIssues(state),locked=animationCutLocked(state),active=Boolean(state.gesture),status=root.querySelector('[data-animation-cut-status]');
  const progress=state.operation.status==='pending'?state.operation.kind==='commit'?'Saving the exact processed cut…':state.operation.kind==='prepare'?'Preparing your revised cut…':'Updating the cut job…'
    :state.job&&!['DISCARDED','APPLIED'].includes(state.job.state)?`Cut job: ${state.job.state.toLowerCase()}. Your animation draft is retained.`
    :animationCutDirty(state)?'Use revised cut to apply this crop, or return and keep the unfinished cut draft.':'Drag an edge or enter exact pixel bounds. Your animation draft is retained.';
  status.textContent=state.error||state.conflict||issues[0]||progress;status.dataset.error=String(Boolean(state.error||state.conflict||issues.length));
  for(const n of root.querySelectorAll('button,input,select'))n.disabled=locked||active;
  for(const n of root.querySelectorAll('[data-animation-cut-field]')){const key=n.dataset.animationCutField;if(n!==document.activeElement)n.value=state.fieldDrafts[key]??String(key==='name'?state.model.name:state.model.rectangle[key]);}
  const action=key=>root.querySelector(`[data-animation-cut-action="${key}"]`);
  action('use').disabled=locked||active||Boolean(issues.length||state.conflict)||!animationCutDirty(state);
  action('undo').disabled=locked||active||!state.history.past.length;action('redo').disabled=locked||active||!state.history.future.length;
  const recovery=root.querySelector('[data-animation-cut-recovery]');recovery.replaceChildren();
  if(state.operation.status==='uncertain')recovery.append(button('Retry exact request','retry-request'),button('Recheck current state','recheck'));
  else if(state.job&&!['DISCARDED','APPLIED'].includes(state.job.state)){
    recovery.append(button('Recheck job','recheck-job'));
    if(['QUEUED','RUNNING','CANCEL_REQUESTED'].includes(state.job.state))recovery.append(button('Cancel cut job','cancel-job'));
    if(['FAILED','CANCELLED'].includes(state.job.state))recovery.append(button('Retry cut job','retry-job'));
    if(['SUCCEEDED','FAILED','CANCELLED'].includes(state.job.state))recovery.append(button('Discard cut job','discard-job'));
  }else if(state.conflict)recovery.append(button('Recheck current state','recheck'));
  if(state.operation.status==='pending')for(const n of recovery.querySelectorAll('button'))n.disabled=true;
  syncAnimationCutCanvas(root,state);
}
