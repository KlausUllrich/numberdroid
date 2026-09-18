// In-memory interaction mockup only. No production API, file access or persistence.
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initialCuts = () => [
  { id:'machine', name:'Coffee machine', art:'machine', use:'Prop', included:true, target:'new', changed:false, saved:null },
  { id:'cup', name:'Coffee cup', art:'cup', use:'Item', included:true, target:'new', changed:false, saved:null },
  { id:'display', name:'Machine display', art:'display', use:'Prop', included:true, target:'new', changed:false, saved:null },
];
const initialLibrary = () => [
  {id:'machine',name:'Coffee machine',art:'machine',use:'Prop',version:1,changed:false,archived:false,uses:['Kitchen room · image v1','Coffee station Assembly · image v1']},
  {id:'cup',name:'Coffee cup',art:'cup',use:'Item',version:1,changed:false,archived:false,uses:[]},
  {id:'display',name:'Machine display',art:'display',use:'Prop',version:1,changed:false,archived:false,uses:['Brewing animation · image v1']},
].map(item=>({...item,source:'Coffee station sheet'}));
let state, toastTimer, pendingConfirmation;
function reset(scenario='new') {
  clearTimeout(toastTimer);$('#toast').hidden=true;$('#toast').textContent='';
  if($('#confirmation').open)$('#confirmation').close();pendingConfirmation=null;
  state={scenario,page:scenario==='cleanup'?'library':'workbench',tab:'edit',cuts:initialCuts(),library:scenario==='new'?[]:initialLibrary(),serial:1,receipt:null,filter:'active'};
  if(scenario==='update') for(const cut of state.cuts){cut.target=cut.id;cut.changed=cut.id!=='cup';}
  if(scenario==='unlinked') for(const cut of state.cuts)cut.changed=true;
  $('#scenario').value=scenario; render();
}
function art(kind, changed=false){
  const fill=changed?'#b58e56':'#67897a';
  const body=kind==='machine'?`<rect x="40" y="10" width="100" height="160" rx="8" fill="${fill}"/><rect x="50" y="24" width="80" height="60" fill="#172c23"/><rect x="63" y="45" width="54" height="12" fill="#9edeaf"/><rect x="72" y="99" width="36" height="48" fill="#263b30"/><rect x="52" y="157" width="76" height="7" fill="#344b3c"/>`:kind==='cup'?`<path d="M45 45h80v80q-40 27-80 0z" fill="${changed?'#d6bf83':'#e1dab2'}"/><path d="M125 59h16q23 20 0 40h-16" fill="none" stroke="#e1dab2" stroke-width="10"/><rect x="53" y="49" width="63" height="9" fill="#6a4c2e"/>`:`<rect x="15" y="45" width="150" height="90" rx="7" fill="#1c382a"/><rect x="32" y="70" width="${changed?112:83}" height="36" fill="${changed?'#e3c45b':'#8dd5aa'}"/>`;
  return `<svg viewBox="0 0 180 180" role="img" aria-label="${esc(kind)} sample${changed?' revised':''}">${body}</svg>`;
}
const picture=(kind,changed=false)=>`<div class="picture">${art(kind,changed)}</div>`;
const button=(action,label,attrs='',cls='')=>`<button type="button" data-action="${action}" ${attrs} class="${cls}">${label}</button>`;
function disabled(label,reason){return `<span class="disabled-reason" tabindex="0" title="${esc(reason)}" aria-label="${esc(label+'. Unavailable: '+reason)}"><button disabled title="${esc(reason)}">${label}</button></span>`;}
const heading=(title,copy)=>`<div class="heading"><div><p class="eyebrow">Sources / Image Workbench</p><h1 tabindex="-1">${title}</h1><p>${copy}</p></div><span class="badge">Sample original approved</span></div>`;
const fingerprint=cut=>JSON.stringify([cut.name,cut.art,cut.use,cut.changed,cut.target]);
function pending(){return state.cuts.filter(cut=>cut.included&&cut.target!=='skip'&&cut.saved!==fingerprint(cut)&&!unchanged(cut));}
function unchanged(cut){const item=state.library.find(item=>item.id===cut.target);return item&&item.art===cut.art&&item.name===cut.name&&item.use===cut.use&&item.changed===cut.changed;}
function notify(message){clearTimeout(toastTimer);$('#toast').hidden=false;$('#toast').textContent=message;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000);}
function sourceName(){return state.scenario==='update'?'Coffee station sheet · updated original':state.scenario==='unlinked'?'New café sheet · no previous relationship':'Coffee station sheet';}
function sources(){return heading('Source Images','Originals stay available. Cutting and Library updates never overwrite them.')+`<div class="source-options">${button('start-new','New source image<small>Use a separate original. Choose which images to add to Library.</small>')}${button('start-update','Update an existing source<small>Keep the previous original, start from its cut layout and inspect every destination.</small>')}</div><p class="summary">Prototype uses already-approved samples. Import and source-review rules are not being simulated or changed.</p>`;}
function workbench(){
  const copy=state.scenario==='update'?'Previous cut areas are carried forward for inspection. Each update below names the exact Library item it will change.':state.scenario==='unlinked'?'No matching Library items are assumed. Add new images, or choose an existing item yourself.':'Choose the images you want. Add them directly to Library; there is no separate saved-cut collection to manage.';
  return heading(sourceName(),copy)+`<nav class="tabs" aria-label="Image work views">${button('edit','Cut images',`aria-pressed="${state.tab==='edit'}"`)}${button('outputs','View Output',`aria-pressed="${state.tab==='outputs'}"`)}</nav>`+(state.tab==='edit'?editor():outputs());
}
function editor(){return `<div class="canvas" aria-label="Sample cut layout">${state.cuts.map(cut=>`<section class="cut" data-included="${cut.included}">${picture(cut.art,cut.changed)}<label class="keep"><input type="checkbox" data-include="${cut.id}" ${cut.included?'checked':''}>Keep ${esc(cut.name)}</label></section>`).join('')}</div><p class="layout-help">This prototype focuses on where images go. The production editor keeps its precise cutting tools. Nothing in Library changes until you save there.</p><div class="footer"><p>${state.cuts.filter(c=>c.included).length} images selected · original unchanged</p>${button('outputs','View Output →','','primary')}</div>`;}
function targetOptions(cut){return [['new','Add as new Library image'],...state.library.filter(item=>!item.archived).map(item=>[item.id,`Update “${item.name}” · v${item.version}`]),['skip','Skip this image']].map(([id,name])=>`<option value="${esc(id)}" ${cut.target===id?'selected':''}>${esc(name)}</option>`).join('');}
function outputCard(cut){
  const item=state.library.find(item=>item.id===cut.target), saved=cut.saved===fingerprint(cut), same=unchanged(cut);
  const consequence=saved?'Saved in Library. Editing this image again prepares another change.':cut.target==='skip'?'This image will not be added or changed.':item?(same?'Already matches this Library image. Nothing to save.':`Will update ${esc(item.name)} from v${item.version} to v${item.version+1}. Existing Room and Assembly uses stay on their chosen versions.`):'Creates a Library Image draft. Set its use here; placement settings can be edited in Library.';
  return `<article class="card" data-cut="${cut.id}">${picture(cut.art,cut.changed)}<div class="card-body"><div class="row-heading"><h2>${esc(cut.name)}</h2><span class="badge ${!saved&&!same?'amber':''}">${saved?'In Library':same?'Unchanged':'Not saved'}</span></div><label>Name<input data-name="${cut.id}" value="${esc(cut.name)}" maxlength="80"></label><label>Use<select data-use="${cut.id}">${['Prop','Item','Surface'].map(use=>`<option ${use===cut.use?'selected':''}>${use}</option>`).join('')}</select></label><label>Library destination<select data-target="${cut.id}">${targetOptions(cut)}</select></label><p class="target">${consequence}</p>${item&&!same?`<div class="comparison"><figure>${picture(item.art,item.changed)}<figcaption>In Library · v${item.version}</figcaption></figure><figure>${picture(cut.art,cut.changed)}<figcaption>Your proposed image</figcaption></figure></div>`:''}<div class="actions">${button('adjust','Try another sample crop',`data-id="${cut.id}"`)}${saved||same?button('open-item','Open in Library',`data-id="${cut.target}"`):''}</div></div></article>`;
}
function outputs(){
  const cuts=state.cuts.filter(c=>c.included), changes=pending(), adds=changes.filter(c=>c.target==='new').length, updates=changes.length-adds;
  const targets=changes.filter(c=>c.target!=='new').map(c=>c.target), duplicate=new Set(targets).size!==targets.length;
  const action=updates?`Save ${updates} update${updates===1?'':'s'}${adds?` + ${adds} addition${adds===1?'':'s'}`:''}`:`Add ${adds} image${adds===1?'':'s'} to Library`;
  return `<p class="summary">${cuts.length} selected images · choose a destination for each. Your own edits need no second approval.</p>${cuts.length?`<div class="grid">${cuts.map(outputCard).join('')}</div>`:'<div class="empty"><h2>No images selected</h2><p>Return to Cut images and select an area to keep.</p></div>'}${state.receipt?`<section class="notice" role="status"><strong>${esc(state.receipt)}</strong><p>Originals and previous Library versions remain intact. No game files were published.</p></section>`:''}<div class="footer"><div><strong>${duplicate?'Choose a different target':changes.length?`${adds} new · ${updates} updated · ${cuts.length-changes.length} unchanged or skipped`:'No changes to save'}</strong><p>${duplicate?'Two images cannot replace the same Library item in one save.':'The save affects only these destinations. Existing placements do not switch versions automatically.'}</p></div><div class="actions">${changes.length&&!duplicate?button('save',action,'','primary'):disabled(changes.length?'Save to Library':'All changes saved',duplicate?'Choose a different target for each update.':'There are no new changes to save. Repeating a save never adds duplicates.')}${button('library','Open Library')}</div></div>${state.receipt?`<div class="try-repeat">Prototype check: ${button('repeat','Repeat the same save')} <small>Should return the same result, without another item or version.</small></div>`:''}`;
}
function save(){
  const changes=pending(); if(!changes.length){notify('Already saved. No duplicate items or versions created.');return;}
  const targets=changes.filter(c=>c.target!=='new').map(c=>c.target);if(new Set(targets).size!==targets.length)return;
  let added=0,updated=0;
  for(const cut of changes){let item=state.library.find(i=>i.id===cut.target);if(!item){item={id:`new-${state.serial++}`,version:0,uses:[],archived:false};state.library.push(item);added++;}else updated++;
    Object.assign(item,{name:cut.name,use:cut.use,art:cut.art,changed:cut.changed,source:sourceName(),version:item.version+1});cut.target=item.id;cut.saved=fingerprint(cut);
  }
  state.receipt=`Saved to Library: ${added} added, ${updated} updated.`;render();notify(state.receipt);
}
function library(){
  const visible=state.library.filter(item=>state.filter==='all'||item.archived===(state.filter==='archived'));
  return `<div class="heading"><div><p class="eyebrow">Library</p><h1>Reusable images</h1><p>This is the collection you manage. Images remain linked to their original source.</p></div>${button('workbench','Back to Image Workbench')}</div><div class="filter">${[['active','Active'],['archived','Archived'],['all','All']].map(([id,label])=>button('filter',label,`data-filter="${id}" aria-pressed="${state.filter===id}"`)).join('')}</div><div class="list">${visible.map(item=>`<article class="library-row ${item.archived?'archived':''}" data-library-id="${item.id}">${picture(item.art,item.changed)}<div><h2>${esc(item.name)}</h2><small>${item.use} · Image draft · v${item.version} ${item.archived?'· Archived':''}</small><p>${item.uses.length?`Used by ${item.uses.map(esc).join('; ')}.`:'No uses or retained references in this sample.'}</p></div><div class="actions">${button('open-item','Details',`data-id="${item.id}"`)}${button(item.archived?'restore':'archive',item.archived?'Restore':'Archive',`data-id="${item.id}"`)}${item.uses.length?disabled('Delete',`Cannot delete: ${item.uses.join('; ')} still use this image. Archive it to hide it from new selections.`):button('delete','Delete',`data-id="${item.id}"`,'danger')}</div></article>`).join('')||'<div class="empty"><h2>No images here</h2><p>Add images from Image Workbench, or change the filter.</p></div>'}</div><p class="summary">Archive hides an image from new selections and is reversible. Deletion requires that no saved content, history or active work still needs it. It never deletes the original source automatically.</p>`;
}
function itemDetail(){const item=state.library.find(i=>i.id===state.itemId);if(!item)return library();return `${button('library','← Back to Library','','back')}<section class="detail">${picture(item.art,item.changed)}<h1>${esc(item.name)}</h1><p class="summary">${item.use} · Image draft · v${item.version}. Library settings and placement remain separate from the image crop.</p><div class="notice"><strong>Existing uses do not change silently</strong><p>${item.uses.length?item.uses.map(esc).join('<br>'):'Not used by a Room, Assembly or Animation in this sample.'}</p></div><p>Source: ${esc(item.source)}. Previous originals and used image versions stay available.</p></section>`;}
function render(){
  $('#view').innerHTML=state.page==='sources'?sources():state.page==='library'?library():state.page==='item'?itemDetail():workbench();
  for(const node of document.querySelectorAll('aside nav button'))node.setAttribute('aria-current',node.dataset.action===(state.page==='item'?'library':state.page)?'page':'false');
}
function confirmAction(action,item){
  const archive=action==='archive';pendingConfirmation={action,id:item.id};
  $('#confirmation').innerHTML=`<h2 id="dialog-title">${archive?'Archive':'Delete'} “${esc(item.name)}”?</h2><p>${archive?'Hide it from new Library selections. Existing uses and saved versions remain intact; you can restore it later.':'Permanently remove this unused sample item. The original source stays. A production implementation must check all references again before deletion.'}</p><div class="actions">${button('cancel','Cancel')}${button('confirm',archive?'Archive image':'Delete unused image','','danger')}</div>`;$('#confirmation').showModal();
}
document.addEventListener('click',event=>{
  const node=event.target.closest('button[data-action]');if(!node||node.disabled)return;
  const action=node.dataset.action,id=node.dataset.id;
  if(action==='reset'){reset(state.scenario);return;}
  if(action==='start-new'){reset('new');return;}if(action==='start-update'){reset('update');return;}
  if(['sources','workbench','library'].includes(action)){state.page=action;render();return;}
  if(action==='edit'||action==='outputs'){state.tab=action;render();return;}
  if(action==='save'||action==='repeat'){save();return;}
  if(action==='adjust'){const cut=state.cuts.find(c=>c.id===id);cut.changed=!cut.changed;state.receipt=null;render();return;}
  if(action==='open-item'){state.itemId=id;state.page='item';render();return;}
  if(action==='filter'){state.filter=node.dataset.filter;render();return;}
  if(action==='archive'||action==='delete'){const item=state.library.find(i=>i.id===id);if(item&&(action!=='delete'||!item.uses.length))confirmAction(action,item);return;}
  if(action==='restore'){state.library.find(i=>i.id===id).archived=false;render();notify('Image restored to active Library.');return;}
  if(action==='cancel'){$('#confirmation').close();pendingConfirmation=null;return;}
  if(action==='confirm'&&pendingConfirmation){const {action:kind,id:key}=pendingConfirmation,item=state.library.find(i=>i.id===key);if(item){if(kind==='archive')item.archived=true;else if(!item.uses.length)state.library=state.library.filter(i=>i.id!==key);}$('#confirmation').close();pendingConfirmation=null;render();notify(kind==='archive'?'Archived. Existing uses stay intact.':'Unused sample image deleted. Original retained.');}
});
document.addEventListener('change',event=>{
  const node=event.target;if(node.id==='scenario'){reset(node.value);return;}
  for(const [key,field]of [['include','included'],['name','name'],['use','use'],['target','target']])if(node.dataset[key]){const cut=state.cuts.find(c=>c.id===node.dataset[key]);cut[field]=key==='include'?node.checked:node.value;state.receipt=null;render();return;}
});
$('#confirmation').addEventListener('close',()=>{pendingConfirmation=null;});
reset();
