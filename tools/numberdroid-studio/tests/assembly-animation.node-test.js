import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSqliteProjectBundle, importSqliteProjectBundle, projectSqlitePortableDocument, validateSqlitePortableProject, SqliteProjectStore, ContentAddressedArtifactStore } from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblyFixture, assemblyPayload, projectId, owner } from './assembly-test-helpers.js';
import { ASSEMBLY_DECLARATION_SCHEMA, ASSEMBLY_DECLARATION_V2_SCHEMA, upgradeAssemblyDeclaration, normalizeAssemblyDeclaration, resolveAssemblyScene, assemblySelectedContent } from '../packages/domain/src/assembly-geometry.js';
import { inspectAssemblyIntegrity } from '../packages/persistence/src/integrity/assembly-integrity.js';
import { createAssemblyEditorState, assemblyEditorSetContent, assemblyEditorSnapshot, assemblyEditorRemember, assemblyEditorUndo, assemblyEditorRemoveChoice, assemblyEditorAddComponent } from '../apps/studio-server/public/assembly-editor-state.js';
import { assemblyReviewChanges } from '../apps/studio-server/public/assembly-review-summary.js';

const pin = (assetId = 'clip.fixture', assetVersion = 1, metadataVersion = 1) => ({ assetId, assetVersion, metadataVersion });
const declaration = slice => ({ schemaVersion: 1, coordinateSpace: 'clip-pixels', fps: 10, playbackMode: 'pingpong', unitsPerPixel: 1/64, canvas: { width: 32, height: 16 }, anchor: { x: 8, y: 8 }, frames: [
  { frameId: 'frame.one', name: 'First', slice: { sliceId: slice.sliceId, sliceVersion: slice.version }, durationMs: null, offset: { x: 0, y: 0 } },
  { frameId: 'frame.two', name: 'Second', slice: { sliceId: slice.sliceId, sliceVersion: slice.version }, durationMs: 250, offset: { x: 16, y: 0 } },
] });
const clipPayload = slice => ({ assetId: 'clip.fixture', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Brewing display', kind: 'prop', metadata: { role: 'display', tags: [] }, clip: declaration(slice) });
function v2() {
  const assembly = upgradeAssemblyDeclaration(assemblyPayload().assembly);
  assembly.states.push({ stateId: 'brewing', name: 'Brewing' }); assembly.variants.push({ variantId: 'copper', name: 'Copper' });
  assembly.components[0].stateOverrides.push({ stateId: 'brewing', content: { kind: 'animation', asset: pin() } });
  return assembly;
}

test('Assembly v2 is explicit, strict, and retains v1 normalized bytes until a new content feature is authored', () => {
  const original = assemblyPayload().assembly, bytes = JSON.stringify(normalizeAssemblyDeclaration(original));
  assert.equal(ASSEMBLY_DECLARATION_SCHEMA.properties.schemaVersion.const, 1); assert.equal(ASSEMBLY_DECLARATION_V2_SCHEMA.properties.schemaVersion.const, 2);
  const extended = v2(); assert.equal(JSON.stringify(normalizeAssemblyDeclaration(original)), bytes);
  assert.deepEqual(normalizeAssemblyDeclaration(extended), extended);
  for (const mutate of [a => a.components[0].asset = pin(), a => a.components[0].stateOverrides.push(a.components[0].stateOverrides[0]), a => a.components[0].content = {kind:'none', asset:pin()}, a => a.components[0].stateOverrides[0].stateId = 'absent']) {
    const invalid = structuredClone(extended); mutate(invalid); assert.throws(() => normalizeAssemblyDeclaration(invalid));
  }
  const c = extended.components[0]; c.variantOverrides.push({ variantId: 'copper', content: { kind: 'none' } });
  assert.equal(assemblySelectedContent(c, { stateId: 'brewing', variantId: 'copper' }).kind, 'animation');
  assert.equal(assemblySelectedContent(c, { stateId: 'idle', variantId: 'copper' }).kind, 'none');
  c.stateIds = []; assert.equal(assemblySelectedContent(c, { stateId: 'brewing', variantId: 'copper' }).kind, 'none');
});

test('Assembly state presentation edits upgrade once and undo without changing other variants or states', () => {
  const payload = assemblyPayload(), state = createAssemblyEditorState({projectId,projectRevision:10,asset:{...payload,assetVersion:1,metadataVersion:1},assets:[]});
  state.model.assembly.states.push({stateId:'brewing',name:'Brewing'});
  const before = assemblyEditorSnapshot(state); assemblyEditorSetContent(state,'body','state:brewing',{kind:'animation',asset:pin()}); assemblyEditorRemember(state,before);
  assert.equal(state.model.assembly.schemaVersion,2); assert.equal(state.model.assembly.components[0].content.kind,'image');
  assemblyEditorUndo(state); assert.equal(state.model.assembly.schemaVersion,1); assemblyEditorUndo(state,true);
  assemblyEditorRemoveChoice(state,'state','brewing'); assert.deepEqual(state.model.assembly.components[0].stateOverrides,[]);
  const fresh = createAssemblyEditorState({projectId,projectRevision:10});
  assemblyEditorAddComponent(fresh,{assetId:'clip.saved',assetVersion:1,metadataVersion:1,name:'Clip',contentKind:'animation',clip:declaration({sliceId:'slice.saved',version:1})});
  assert.equal(fresh.model.assembly.schemaVersion,2); assert.equal(fresh.assets.length,0,'An unresolved picker record must still fetch exact frame bindings.');
});

test('Assembly animation resolves every exact frame, persists typed slots, pins old clips after update and proves integrity', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t); await f.execute('asset.save',f.payload()); await f.execute('clip.save',clipPayload(f.slice));
  const assembly = v2(); const saved = await f.execute('assembly.save',assemblyPayload({assembly}));
  const query = () => f.studio.queryAssemblies({schemaVersion:1,projectId,assetId:'assembly.fixture',selection:{stateId:'brewing',variantId:'copper'}},owner);
  const first = (await query()).assets[0], draw = first.scene.elements[0];
  assert.equal(draw.contentKind,'animation'); assert.equal(draw.artifact,undefined); assert.equal(draw.clip.frames.length,2); assert.deepEqual(first.scene.regions,[]);
  assert.deepEqual(draw.clip.frames.map(frame=>frame.imageMatrix),[[1,0,0,1,-8,-8],[1,0,0,1,8,-8]]);
  assert.deepEqual(draw.imageBounds,{x:-8,y:-8,width:32,height:16});
  const rows=f.store.workspace.database.prepare('SELECT slot_kind,slot_id,content_kind FROM assembly_content_pins ORDER BY pin_order').all().map(row=>({...row}));
  assert.deepEqual(rows,[{slot_kind:'base',slot_id:null,content_kind:'image'},{slot_kind:'state',slot_id:'brewing',content_kind:'animation'}]);
  await f.execute('clip.save',{...clipPayload(f.slice),operation:'update',expectedAssetVersion:1,expectedMetadataVersion:1,name:'New clip name',clip:{...declaration(f.slice),fps:20}});
  assert.deepEqual((await query()).assets[0],first); await f.restart(); assert.deepEqual((await query()).assets[0],first);
  const integrity=inspectAssemblyIntegrity(f.store.workspace.database); assert.equal(integrity.ok,true,JSON.stringify(integrity));
  const bad = structuredClone(first); bad.leafAssets.find(asset=>asset.contentKind==='animation').frameBindings[1].sliceBinding.sliceVersion=999;
  assert.throws(()=>resolveAssemblyScene({assembly,assets:bad.leafAssets,projectId,selection:{stateId:'brewing',variantId:'copper'}}),/historical cut/);
  const changed = structuredClone(assembly); changed.components[0].stateOverrides[0].content.asset.assetVersion=2; changed.components[0].stateOverrides[0].content.asset.metadataVersion=2;
  const summary=assemblyReviewChanges({content:{...assemblyPayload(),assembly:changed},leafAssets:first.leafAssets},first);
  assert.ok(summary.changes.some(change=>change.label==='Body in Brewing presentation changes')); assert.equal(saved.value.assetVersion,1);
  f.store.workspace.database.prepare('DELETE FROM assembly_content_pins WHERE slot_kind=?').run('state');
  assert.equal(inspectAssemblyIntegrity(f.store.workspace.database).ok,false);
});

test('Real artwork renderer keeps clip phase and image nodes across unrelated variant changes, pause and resume', async t => {
  const { updateAssemblyArtwork, assemblyArtworkPlayback } = await import('../apps/studio-server/public/assembly-artwork-view.js');
  class Node {
    constructor(tag) { this.tag = tag; this.children=[]; this.dataset={}; this.attributes=new Map(); this.style={}; this.classList={toggle(){}}; }
    setAttribute(key,value){this.attributes.set(key,String(value));} getAttribute(key){return this.attributes.get(key)??null;}
    append(child){child.remove();child.parent=this;this.children.push(child);}
    insertBefore(child,before){child.remove();child.parent=this;const index=this.children.indexOf(before);if(index<0)this.children.push(child);else this.children.splice(index,0,child);}
    remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
    querySelector(tag){return this.children.find(child=>child.tag===tag)??null;}
  }
  const priorDocument=globalThis.document;globalThis.document={createElementNS:(_,tag)=>new Node(tag)};
  t.after(()=>{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;});
  const root=new Node('g'), frame=(frameId,digest,durationMs)=>({frameId,durationMs,imageMatrix:[1,0,0,1,0,0],artifact:{digest:digest.repeat(64),pixelSize:{width:16,height:16}}});
  const scene={elements:[{componentId:'display',contentKind:'animation',asset:pin(),clip:{fps:10,playbackMode:'pingpong',frames:[frame('first','a',null),frame('second','b',250)]}}]};
  const original=structuredClone(scene);
  updateAssemblyArtwork(root,scene,{projectId,playing:true,now:0});const group=root.children[0],image=group.querySelector('image');
  updateAssemblyArtwork(root,scene,{projectId,playing:true,now:125});assert.equal(group.dataset.assemblyFrame,'second');assert.equal(assemblyArtworkPlayback(root)[0].elapsedMs,125);
  const copper=structuredClone(scene);copper.elements.push({...frame('body','c',null),componentId:'body',contentKind:'image',asset:pin('asset.copper')});
  updateAssemblyArtwork(root,copper,{projectId,playing:true,now:175});assert.equal(assemblyArtworkPlayback(root)[0].elapsedMs,175);assert.equal(group.querySelector('image'),image);
  updateAssemblyArtwork(root,copper,{projectId,playing:false,now:200});updateAssemblyArtwork(root,copper,{projectId,playing:true,now:1000});
  updateAssemblyArtwork(root,copper,{projectId,playing:true,now:1020});assert.equal(assemblyArtworkPlayback(root)[0].elapsedMs,195);assert.equal(group.dataset.assemblyFrame,'second');
  copper.elements[0].asset=pin('clip.fixture',2,2);updateAssemblyArtwork(root,copper,{projectId,playing:true,now:1030});assert.equal(assemblyArtworkPlayback(root)[0].elapsedMs,0);
  updateAssemblyArtwork(root,{elements:[]},{projectId,playing:true,now:1050});assert.deepEqual(assemblyArtworkPlayback(root),[]);
  assert.deepEqual(scene,original,'Playback must not mutate authored scene records.');
});

test('Assembly v2 owner acceptance and portable v6 retain old clip/cut closure after source revisions', {timeout:120000}, async t=>{
  const f=await assemblyFixture(t);await f.execute('asset.save',f.payload());await f.execute('clip.save',clipPayload(f.slice));
  const proposed={...assemblyPayload({assembly:v2()}),proposalId:'proposal.animated',expectedProposalVersion:0};
  await f.execute('assembly.proposal.submit',proposed);
  await f.execute('assembly.proposal.resolve',{proposalId:proposed.proposalId,expectedProposalVersion:1,decision:'ACCEPT',feedback:null,confirmed:true});
  const newerCut=await f.cut(f.slice); await f.execute('clip.save',{...clipPayload(newerCut),operation:'update',expectedAssetVersion:1,expectedMetadataVersion:1});
  const portable=projectSqlitePortableDocument({projectStore:f.store,projectId}).project;
  assert.equal(portable.schemaVersion,6);assert.equal(portable.assemblyLibrary.leafAssets.length,1);assert.equal(portable.clipLibrary.versions.length,2);
  assert.deepEqual(portable.clipLibrary.sliceBindings.map(binding=>binding.sliceVersion),[1,2]);
  const corrupt=structuredClone(portable);corrupt.clipLibrary.versions=corrupt.clipLibrary.versions.filter(record=>record.assetVersion!==1);
  assert.throws(()=>validateSqlitePortableProject(corrupt));
  const bundleDirectory=join(f.root,'animation-bundle'),destinationDirectory=join(f.root,'animation-import');
  await createSqliteProjectBundle({destinationDirectory:bundleDirectory,projectStore:f.store,artifactStore:f.artifacts,projectId});
  await importSqliteProjectBundle({bundleDirectory,destinationDirectory,databaseFactory:nodeSqliteDatabaseFactory});
  const imported=await SqliteProjectStore.open({filename:join(destinationDirectory,'studio.sqlite'),databaseFactory:nodeSqliteDatabaseFactory});
  try {
    const service=new StudioService({store:imported});const result=await service.queryAssemblies({schemaVersion:1,projectId,assetId:'assembly.fixture',selection:{stateId:'brewing',variantId:'default'}},owner);
    assert.equal(result.assets[0].scene.elements[0].asset.assetVersion,1);assert.equal(result.assets[0].leafAssets.find(asset=>asset.contentKind==='animation').frameBindings[0].sliceBinding.sliceVersion,1);
    const inspected=inspectAssemblyIntegrity(imported.workspace.database);assert.equal(inspected.ok,true,JSON.stringify(inspected));
    const second=join(f.root,'animation-reexport');await createSqliteProjectBundle({destinationDirectory:second,projectStore:imported,artifactStore:new ContentAddressedArtifactStore({rootDirectory:join(destinationDirectory,'artifacts')}),projectId});
    for(const file of ['manifest.json','project.json'])assert.deepEqual(await readFile(join(second,file)),await readFile(join(bundleDirectory,file)));
  } finally {imported.close();}
});


test('Assembly preserves a saved Clip scale below one millionth without clamping', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t); await f.execute('asset.save', f.payload());
  const payload = clipPayload(f.slice); payload.clip.unitsPerPixel = 1e-7;
  await f.execute('clip.save', payload); await f.execute('assembly.save', assemblyPayload({ assembly: v2() }));
  const value = await f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture', selection: { stateId: 'brewing', variantId: 'copper' } }, owner);
  const element = value.assets[0].scene.elements[0];
  assert.equal(element.contentKind, 'animation');
  assert.equal(element.clip.frames[0].imageMatrix[0], 1e-7 / (1 / 64));
});
