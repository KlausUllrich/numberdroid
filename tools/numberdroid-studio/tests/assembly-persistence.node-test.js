import assert from 'node:assert/strict';
import test from 'node:test';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { createSqliteProjectBundle, importSqliteProjectBundle, projectSqlitePortableDocument, validateSqlitePortableProject,
  SqliteProjectStore, ContentAddressedArtifactStore } from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectAssemblyIntegrity } from '../packages/persistence/src/integrity/assembly-integrity.js';
import { loadMigrationDefinitions, SQLITE_MIGRATIONS } from '../packages/persistence/src/sqlite/migration-runner.js';


test('Assembly owner Save preserves exact old leaf closure, versions, replay and restart', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('asset.save', f.payload());
  const request = await f.request('assembly.save', assemblyPayload());
  const saved = await f.studio.execute(request, owner);
  assert.equal(saved.value.assetVersion, 1);
  const replay = await f.studio.execute(request, owner); assert.equal(replay.replayed, true);
  const query = () => f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture' }, owner);
  const first = await query(); assert.equal(first.assets[0].leafAssets[0].assetVersion, 1);
  await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Leaf changed', image: { mode: 'retain' } }));
  assert.deepEqual((await query()).assets[0], first.assets[0]);
  await f.execute('assembly.save', assemblyPayload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Assembly renamed' }));
  assert.equal((await query()).assets[0].metadataVersion, 1);
  await f.restart(); assert.equal((await query()).assets[0].assetVersion, 2);
  f.store.workspace.database.prepare('DELETE FROM assembly_head_tags WHERE project_id=?').run(projectId);
  f.store.workspace.database.prepare('DELETE FROM assembly_heads WHERE project_id=?').run(projectId);
  await f.store.rebuildProjectProjection(projectId);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
  const backupPath=join(f.root,'assembly-backup.sqlite');await f.store.backupTo(backupPath);
  const backup=await SqliteProjectStore.open({filename:backupPath,databaseFactory:nodeSqliteDatabaseFactory});
  try {
    const backed=new StudioService({store:backup});const backedView=await backed.queryAssemblies({schemaVersion:1,projectId,assetId:'assembly.fixture',assetVersion:1},owner);
    assert.equal(backedView.assets[0].leafAssets[0].assetVersion,1);
    assert.equal((await verifyWorkspaceIntegrity({projectStore:backup,artifactStore:f.artifacts})).ok,true);
  } finally {backup.close();}
  const document=await f.store.loadProject(projectId);const last=structuredClone(document.revisions.at(-1));
  const bad={...last,id:'revision.forged',number:last.number+1,parentRevision:last.number,command:{...last.command,commandId:'cmd.nonassembly.rewrite',idempotencyKey:'idem.nonassembly.rewrite',type:'task.merge.revert'}};
  bad.event={...bad.event,id:'activity.nonassembly.rewrite',revision:bad.number,commandId:bad.command.commandId,commandType:bad.command.type};
  delete bad.snapshot.assemblyLibrary;
  await assert.rejects(f.store.appendRevision(projectId,last.number,bad),{code:'ASSEMBLY_REVISION_UNSUPPORTED'});
});

test('Assembly writes reject invalid pins, namespace collisions, authority and roll back at every stage', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload());
  await assert.rejects(f.execute('assembly.save', assemblyPayload({ assetId: 'asset.fixture' })), { code: 'ASSEMBLY_ID_CONFLICT' });
  const invalid = assemblyPayload(); invalid.assembly.components[0].asset.assetVersion = 99;
  await assert.rejects(f.execute('assembly.save', invalid));
  await assert.rejects(f.execute('assembly.save', assemblyPayload(), { ...owner, actor: { id: 'agent.foreign', kind: 'agent' } }), { code: 'FORBIDDEN' });
  const before = await f.studio.readProjectTrusted(projectId);
  for (const point of ['after_assembly_identity','after_assembly_version','after_assembly_pins','after_assembly_findings','after_assembly_references','after_assembly_head','before_transaction_commit']) {
    f.fault(point); await assert.rejects(f.execute('assembly.save', assemblyPayload()), /injected/); f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
    assert.equal(f.store.workspace.database.prepare('SELECT count(*) AS n FROM assembly_versions').get().n, 0);
  }
  await f.execute('assembly.save', assemblyPayload());
  await assert.rejects(f.execute('asset.save', f.payload({ assetId: 'assembly.fixture' })), { code: 'ASSEMBLY_ID_CONFLICT' });
  const db=f.store.workspace.database;
  const native=db.prepare('SELECT * FROM asset_versions WHERE asset_id=?').get('asset.fixture');
  native.asset_id='assembly.fixture';
  assert.throws(()=>db.prepare(`INSERT INTO asset_versions (${Object.keys(native).join(',')}) VALUES (${Object.keys(native).map(()=>'?').join(',')})`).run(...Object.values(native)), /Asset ID belongs to an Assembly/);
  assert.throws(()=>db.prepare('INSERT INTO task_branch_processing_result_adoptions(project_id,asset_id) VALUES (?,?)').run(projectId,'assembly.fixture'), /Asset ID belongs to an Assembly/);
  const frozen=await f.studio.readProjectTrusted(projectId);
  const a=await f.request('assembly.save',assemblyPayload({operation:'update',expectedAssetVersion:1,expectedMetadataVersion:1,name:'First update'}));
  const b=await f.request('assembly.save',assemblyPayload({operation:'update',expectedAssetVersion:1,expectedMetadataVersion:1,name:'Second update'}));
  await f.studio.execute(a,owner);await assert.rejects(f.studio.execute(b,owner),{code:'REVISION_CONFLICT'});
  assert.equal((await f.studio.readProjectTrusted(projectId)).revision,frozen.revision+1);
});

test('Migration 0016 rolls back before and after DDL, resumes, and preserves all earlier checksums', { timeout: 120000 }, async context => {
  const root=await mkdtemp(join(tmpdir(),'studio-assembly-migration-'));context.after(()=>rm(root,{recursive:true,force:true}));
  const migrations=await loadMigrationDefinitions();assert.equal(migrations.at(-1).version,18);
  for(const point of ['before_migration_16','after_migration_16']) {
    const filename=join(root,`${point}.sqlite`);
    await assert.rejects(SqliteProjectStore.open({filename,databaseFactory:nodeSqliteDatabaseFactory,faultInjector(actual){if(actual===point)throw new Error(`fault:${point}`);}}),new RegExp(point));
    const interrupted=nodeSqliteDatabaseFactory(filename);
    try {assert.equal(interrupted.prepare('PRAGMA user_version').get().user_version,15);assert.equal(interrupted.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='assembly_versions'").get().n,0);
      assert.deepEqual(interrupted.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all().map(row=>({...row})),SQLITE_MIGRATIONS.slice(0,15).map(({version,checksum})=>({version,checksum})));}
    finally{interrupted.close();}
    const resumed=await SqliteProjectStore.open({filename,databaseFactory:nodeSqliteDatabaseFactory});
    try{assert.equal(resumed.integrityCheck().userVersion,18);assert.equal(resumed.workspace.database.prepare("SELECT strict FROM pragma_table_list WHERE name='assembly_versions'").get().strict,1);}
    finally{resumed.close();}
  }
});

test('Assembly proposal request changes, exact resubmission and atomic owner acceptance', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload());
  const submit = { ...assemblyPayload(), proposalId: 'proposal.assembly', expectedProposalVersion: 0 };
  await f.execute('assembly.proposal.submit', submit);
  assert.equal((await f.studio.readProjectTrusted(projectId)).snapshot.assemblyLibrary.assets.length, 0);
  await f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback: 'Rename the fixture.', confirmed: true });
  await assert.rejects(f.execute('assembly.proposal.submit', submit), { code: 'ASSEMBLY_PROPOSAL_CONFLICT' });
  await f.execute('assembly.proposal.submit', { ...submit, expectedProposalVersion: 2, name: 'Revised assembly' });
  f.fault('after_assembly_version');
  await assert.rejects(f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true }), /injected/);
  f.fault(null);
  await f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true });
  const query = await f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture', proposalId: submit.proposalId }, owner);
  assert.equal(query.assets[0].name, 'Revised assembly'); assert.equal(query.proposals[0].status, 'ACCEPTED');
  assert.deepEqual(query.assets[0].proposal, { proposalId: submit.proposalId, proposalVersion: 4 });
});

test('Assembly v5 exchange preserves historical leaf closure and rejects tampered history', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload());
  const legacy = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(legacy.schemaVersion, 4);
  await f.execute('assembly.save', assemblyPayload());
  await f.cut(f.slice);
  await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1,
    image: { mode: 'saved-slice', sliceId: f.slice.sliceId, expectedSliceVersion: 2 } }));
  await f.execute('assembly.proposal.submit', { ...assemblyPayload({ assetId: 'assembly.second' }), proposalId: 'proposal.second', expectedProposalVersion: 0 });
  assert.throws(() => projectSqlitePortableDocument({ projectStore: f.store, projectId }), { code: 'BUNDLE_NOT_QUIESCENT' });
  await f.execute('assembly.proposal.resolve', { proposalId: 'proposal.second', expectedProposalVersion: 1, decision: 'ACCEPT', confirmed: true });
  const portable = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(portable.schemaVersion, 5); assert.equal(portable.assemblyLibrary.leafAssets.length, 1);
  for (const mutate of [p => { p.assemblyLibrary.versions[0].metadataVersion += 1; }, p => { p.assemblyLibrary.leafAssets[0].sliceBinding.artifactDigest = 'a'.repeat(64); },
    p => { p.assemblyLibrary.versions[0].assembly.components[0].position.x += 1; }, p => { p.assemblyLibrary.proposals[1].feedback = ''; },
    p => { p.assemblyLibrary.heads[0].assetVersion = 99; },
    p => { p.assemblyLibrary.versions=[];p.assemblyLibrary.heads=[]; },
    p => { p.assemblyLibrary.versions=p.assemblyLibrary.versions.filter(record=>!record.proposal);p.assemblyLibrary.heads=p.assemblyLibrary.heads.filter(head=>head.assetId!=='assembly.second'); }, p => { p.assemblyLibrary.versions[0].extra = true; }]) {
    const altered = structuredClone(portable); mutate(altered); assert.throws(() => validateSqlitePortableProject(altered));
  }
  const bundleDirectory = join(f.root, 'assembly-bundle');
  await createSqliteProjectBundle({ destinationDirectory: bundleDirectory, projectStore: f.store, artifactStore: f.artifacts, projectId });
  const importedDirectory = join(f.root, 'assembly-import');
  await importSqliteProjectBundle({ bundleDirectory, destinationDirectory: importedDirectory, databaseFactory: nodeSqliteDatabaseFactory });
  const imported = await SqliteProjectStore.open({ filename: join(importedDirectory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const service = new StudioService({ store: imported });
    const view = await service.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture' }, owner);
    assert.equal(view.assets[0].leafAssets[0].assetVersion, 1); assert.equal(view.assets[0].leafAssets[0].sliceBinding.sliceVersion, 1);
    const secondDirectory = join(f.root, 'assembly-reexport');
    await createSqliteProjectBundle({ destinationDirectory: secondDirectory, projectStore: imported,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(importedDirectory, 'artifacts') }), projectId });
    for (const file of ['manifest.json','project.json']) assert.deepEqual(await readFile(join(secondDirectory,file)), await readFile(join(bundleDirectory,file)));
    for (const store of [f.store, imported]) {
      const db=store.workspace.database; db.exec('BEGIN');
      try {
        for (const table of ['assembly_head_tags','assembly_heads','assembly_component_pins','assembly_version_findings','assembly_versions','assembly_identities']) db.prepare(`DELETE FROM ${table} WHERE project_id=? AND asset_id=?`).run(projectId,'assembly.second');
        const checked=inspectAssemblyIntegrity(db);assert.equal(checked.ok,false);assert.match(checked.findings[0].message,/accepted Assembly proposal must create exactly one/);
      } finally {db.exec('ROLLBACK');}
    }
  } finally { imported.close(); }
});

test('Assembly integrity rejects corrupted projections, component pins and command provenance', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload()); await f.execute('assembly.save', assemblyPayload());
  const db = f.store.workspace.database;
  for (const tamper of [
    () => {const row=db.prepare("SELECT revision_number,revision_json FROM revisions WHERE command_type='assembly.save'").get();const revision=JSON.parse(row.revision_json);revision.command.type='task.create';db.prepare('UPDATE revisions SET revision_json=? WHERE project_id=? AND revision_number=?').run(JSON.stringify(revision),projectId,row.revision_number);},
    () => {const row=db.prepare("SELECT revision_number,revision_json FROM revisions WHERE command_type='assembly.save'").get();const revision=JSON.parse(row.revision_json);revision.command.type='task.create';db.prepare("UPDATE revisions SET command_type='task.create',revision_json=? WHERE project_id=? AND revision_number=?").run(JSON.stringify(revision),projectId,row.revision_number);},
    () => db.prepare('DELETE FROM assembly_head_tags WHERE project_id=?').run(projectId),
    () => db.prepare('DELETE FROM assembly_component_pins WHERE project_id=?').run(projectId),
    () => { const row=db.prepare("SELECT revision_number,revision_json FROM revisions WHERE command_type='assembly.save'").get(); const revision=JSON.parse(row.revision_json); revision.command.payload.name='Tampered'; db.prepare('UPDATE revisions SET revision_json=? WHERE project_id=? AND revision_number=?').run(JSON.stringify(revision),projectId,row.revision_number); },
  ]) {
    db.exec('BEGIN');
    try { tamper(); const integrity=await verifyWorkspaceIntegrity({ projectStore:f.store, artifactStore:f.artifacts }); assert.equal(integrity.assemblies.ok,false,JSON.stringify(integrity)); }
    finally { db.exec('ROLLBACK'); }
  }
});
