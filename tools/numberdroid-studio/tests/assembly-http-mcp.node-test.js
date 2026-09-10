import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { SqliteHostBindingStore, SqliteAgentAttemptStore } from '../packages/persistence/src/index.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { createAgentToolCatalog, buildOfficialMcpServer } from '../packages/mcp-server/src/index.js';
import { COMMAND_DEFINITIONS, KNOWN_GRANT_SCOPES } from '../packages/domain/src/command-catalog.js';

test('Assembly owner HTTP enforces CSRF, exact requests, methods and read-only draft resolution', { timeout: 120000 }, async context => {
  const f=await assemblyFixture(context); await f.execute('asset.save', f.payload());
  const base=await f.http(); const csrf=(await (await fetch(`${base}/api/ui-session`)).json()).csrfToken;
  const path=`${base}/api/projects/${projectId}/assemblies/assembly.fixture/save`;
  const { assetId: _id, ...content }=assemblyPayload();
  const body={...content, expectedRevision:(await f.studio.readProjectTrusted(projectId)).revision,idempotencyKey:'http.assembly.save'};
  const headers={'content-type':'application/json',origin:base,'sec-fetch-site':'same-origin','x-numberdroid-studio-csrf':csrf};
  for (const method of ['GET','HEAD','PUT','DELETE','OPTIONS']) { const response=await fetch(path,{method});assert.equal(response.status,405);await response.arrayBuffer(); }
  for(const altered of [{...headers,origin:'https://foreign.invalid'},{...headers,'x-numberdroid-studio-csrf':''}]){const response=await fetch(path,{method:'POST',headers:altered,body:JSON.stringify(body)});assert.equal(response.status,403);await response.arrayBuffer();}
  const bad=await fetch(path,{method:'POST',headers,body:JSON.stringify({...body,actor:owner.actor})});assert.equal(bad.status,400);await bad.arrayBuffer();
  const save=await fetch(path,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(save.status,200,await save.clone().text());const receipt=await save.json();
  const replay=await(await fetch(path,{method:'POST',headers,body:JSON.stringify(body)})).json();assert.equal(replay.replayed,true);assert.equal(replay.revision,receipt.revision);
  const read=await(await fetch(`${base}/api/projects/${projectId}/assemblies/assembly.fixture`)).json();assert.equal(read.assets[0].scene.elements.length,1);
  const draftBody={assetId:'assembly.draft',name:body.name,kind:body.kind,metadata:body.metadata,assembly:body.assembly,expectedRevision:receipt.revision};
  const draft=await fetch(`${base}/api/projects/${projectId}/assemblies/resolve-draft`,{method:'POST',headers,body:JSON.stringify(draftBody)});assert.equal(draft.status,200,await draft.clone().text());await draft.arrayBuffer();
  assert.equal((await f.studio.readProjectTrusted(projectId)).revision,receipt.revision);
});

test('Selected Assembly MCP profile negotiates 21/5, corrects proposals and reads owner feedback with live authority', { timeout: 120000 }, async context => {
  const f=await assemblyFixture(context);await f.execute('asset.save',f.payload());
  assert.equal(COMMAND_DEFINITIONS.length,42);assert.equal(KNOWN_GRANT_SCOPES.length,34);
  await f.execute('grant.issue',{grantId:'grant.assembly',agentId:'agent.assembly',taskId:'task.assembly',branchId:'branch.main',scopes:['project.read','assembly.proposal.submit'],objectScopes:[{kind:'project',id:projectId}],budget:{maxCommands:10,maxJobs:0,maxArtifactBytes:0,maxCostCents:0}});
  const hostBindingStore=new SqliteHostBindingStore({workspace:f.store.workspace});
  const agentAttemptStore=new SqliteAgentAttemptStore({workspace:f.store.workspace});
  const issued=hostBindingStore.issue({projectId,grantId:'grant.assembly',agentId:'agent.assembly',taskId:'task.assembly',branchId:'branch.main',issuedBy:owner.actor.id});
  let taskBound=false;
  const base=await f.http({hostBindingStore,agentAttemptStore,agentTaskService:{hasTask:()=>taskBound}});
  const gateway=new LocalStudioGateway({baseUrl:base,bindingToken:issued.token,agentAttemptAuditReady:true,durableJobStoreReady:true,durableAssetStoreReady:true,durableRoomStoreReady:true});
  const provider=async()=>({projectId});
  assert.equal(createAgentToolCatalog(gateway,{contextProvider:provider}).length,19);
  await assert.rejects(gateway.queryAssemblies({schemaVersion:1,projectId}),{code:'ASSEMBLY_NEGOTIATION_REQUIRED'});
  await assert.rejects(gateway.negotiateAssemblyV1({schemaVersion:1,projectId:'foreign.project',profile:'assembly-v1'}),{code:'CONTEXT_PROJECT_MISMATCH'});
  const negotiation=await gateway.negotiateAssemblyV1({schemaVersion:1,projectId,profile:'assembly-v1'});
  for (const altered of [{...negotiation,sharedHead:false},{...negotiation,storeSchemaVersion:15},{...negotiation,toolCount:30}]) assert.throws(()=>createAgentToolCatalog(gateway,{contextProvider:provider,assemblyV1:{projectId,negotiation:altered}}),{code:'ASSEMBLY_NEGOTIATION_REQUIRED'});
  const selected={projectId,negotiation};
  const catalog=createAgentToolCatalog(gateway,{contextProvider:provider,assemblyV1:selected});assert.equal(catalog.length,21);
  assert.equal(catalog.some(tool=>tool.name==='studio_assembly_save'||tool.name==='studio_assembly_proposal_resolve'),false);
  const server=buildOfficialMcpServer({studioGateway:gateway,contextProvider:provider,assemblyV1:selected});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await server.connect(serverTransport);
  const client=new Client({name:'assembly-contract',version:'1.0.0'});await client.connect(clientTransport);
  try {
    assert.equal((await client.listTools()).tools.length,21);assert.equal((await client.listResourceTemplates()).resourceTemplates.length,5);
    const submit=catalog.find(tool=>tool.name==='studio_assembly_proposal_submit');
    const invalid={...assemblyPayload(),proposalId:'proposal.agent',expectedProposalVersion:0};invalid.assembly.components[0].asset.assetVersion=99;invalid.assembly.components[0].stateIds=['idle'];
    const invalidCommand=await f.request('assembly.proposal.submit',invalid);delete invalidCommand.type;
    const beforeInvalid=await f.studio.readProjectTrusted(projectId);
    const rejected=await client.callTool({name:'studio_assembly_proposal_submit',arguments:invalidCommand});
    assert.equal(rejected.isError,true);assert.equal(rejected.structuredContent.error.code,'ASSEMBLY_ASSET_NOT_FOUND','nonnull role and state membership must pass SDK validation and reach exact pin validation');
    assert.equal((await f.studio.readProjectTrusted(projectId)).revision,beforeInvalid.revision);
    const payload={...assemblyPayload(),proposalId:'proposal.agent',expectedProposalVersion:0};payload.assembly.components[0].stateIds=['idle'];
    const request=await f.request('assembly.proposal.submit',payload);delete request.type;
    const submitted=await client.callTool({name:'studio_assembly_proposal_submit',arguments:request});assert.notEqual(submitted.isError,true);assert.equal(submitted.structuredContent.value.status,'PENDING');
    const replay=await submit.execute(request);assert.equal(replay.replayed,true);
    assert.equal((await f.studio.readProjectTrusted(projectId)).snapshot.grants[0].usage.commands,1);
    await f.execute('assembly.proposal.resolve',{proposalId:payload.proposalId,expectedProposalVersion:1,decision:'REQUEST_CHANGES',feedback:'Name this Assembly Revised.',confirmed:true});
    const feedback=await gateway.queryAssemblies({schemaVersion:1,projectId,proposalId:payload.proposalId});assert.equal(feedback.proposals[0].feedback,'Name this Assembly Revised.');
    const corrected=await f.request('assembly.proposal.submit',{...payload,expectedProposalVersion:2,name:'Revised'});delete corrected.type;await submit.execute(corrected);
    await f.execute('assembly.proposal.resolve',{proposalId:payload.proposalId,expectedProposalVersion:3,decision:'ACCEPT',confirmed:true});
    const saved=await gateway.queryAssemblies({schemaVersion:1,projectId,assetId:'assembly.fixture'});assert.equal(saved.assets[0].name,'Revised');
    const resource=await client.readResource({uri:`studio://projects/${projectId}/assemblies/assembly.fixture`});assert.equal(JSON.parse(resource.contents[0].text).assets[0].assetVersion,1);
    taskBound=true;
    await assert.rejects(gateway.queryAssemblies({schemaVersion:1,projectId}),{code:'ASSEMBLY_TASK_BRANCH_UNSUPPORTED'});
    await assert.rejects(gateway.negotiateAssemblyV1({schemaVersion:1,projectId,profile:'assembly-v1'}),{code:'ASSEMBLY_TASK_BRANCH_UNSUPPORTED'});
    taskBound=false;
    hostBindingStore.revoke(issued.binding.bindingId,{revokedBy:owner.actor.id,reason:'Test complete'});
    await assert.rejects(gateway.queryAssemblies({schemaVersion:1,projectId}));
  } finally { await client.close();await server.close(); }
});
