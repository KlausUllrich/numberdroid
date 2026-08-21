import test from 'node:test';
import assert from 'node:assert/strict';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { createAgentToolCatalog, findAgentTool } from '../packages/mcp-server/src/index.js';
import {
  AGENT, AGENT_CONTEXT, OWNER, OWNER_CONTEXT, PROJECT_ID,
  agentSourceCommand, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';

test('MCP-shaped catalog exposes no owner-only tools and receives authority only from its host', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);
  const trustedContext = { projectId: PROJECT_ID, ...AGENT_CONTEXT };
  const tools = createAgentToolCatalog(studio, { contextProvider: async () => trustedContext });
  const names = tools.map((tool) => tool.name);
  assert.ok(!names.includes('studio_project_create'));
  assert.ok(!names.includes('studio_grant_issue'));
  assert.ok(!names.includes('studio_grant_revoke'));

  const sourceTool = findAgentTool(tools, 'studio_source_register');
  assert.equal(sourceTool.inputSchema.properties.actor, undefined);
  assert.equal(sourceTool.inputSchema.properties.grantId, undefined);
  assert.ok(sourceTool.inputSchema.required.includes('baseRevision'));
  assert.ok(sourceTool.inputSchema.required.includes('expectedVersion'));
  assert.ok(sourceTool.inputSchema.required.includes('schemaVersion'));

  const source = agentSourceCommand();
  const result = await sourceTool.execute({
    schemaVersion: 1,
    commandId: source.commandId,
    idempotencyKey: source.idempotencyKey,
    projectId: source.projectId,
    baseRevision: source.baseRevision,
    expectedVersion: source.expectedVersion,
    dryRun: false,
    payload: source.payload,
    actor: OWNER,
    grantId: 'forged.grant',
  }, { sessionId: 'mcp-session' });
  assert.equal(result.event.actor.id, AGENT.id);
  assert.equal(result.event.taskId, 'task.atlas');
});

test('MCP-shaped catalog fails closed when the trusted host omits grant context', async () => {
  const { studio } = createHarness();
  const tools = createAgentToolCatalog(studio, { contextProvider: async () => ({ actor: AGENT }) });
  const read = findAgentTool(tools, 'studio_project_read');
  await assert.rejects(read.execute({ schemaVersion: 1, projectId: PROJECT_ID }, {}), (error) => error.code === 'UNTRUSTED_AGENT_CONTEXT');
});

test('MCP host project context prevents cross-project confused deputy even with duplicate grant IDs', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);

  const otherProjectId = 'project.other-hygiene';
  await studio.execute(command({
    commandId: 'cmd.other-create',
    idempotencyKey: 'idem.other-create',
    projectId: otherProjectId,
    payload: { name: 'Other project', ownerId: OWNER.id },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.other-grant',
    idempotencyKey: 'idem.other-grant',
    type: 'grant.issue',
    projectId: otherProjectId,
    expectedVersion: 1,
    payload: {
      grantId: 'grant.atlas',
      agentId: AGENT.id,
      taskId: 'task.atlas',
      branchId: 'branch.task.atlas',
      scopes: ['project.read', 'source.write'],
      objectScopes: [{ kind: 'project', id: otherProjectId }],
      budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0 },
    },
  }), OWNER_CONTEXT);

  const tools = createAgentToolCatalog(studio, {
    contextProvider: async () => ({
      projectId: PROJECT_ID,
      actor: AGENT,
      taskId: 'task.atlas',
      grantId: 'grant.atlas',
      branchId: 'branch.task.atlas',
    }),
  });
  const sourceTool = findAgentTool(tools, 'studio_source_register');
  const source = agentSourceCommand();
  await assert.rejects(
    sourceTool.execute({
      schemaVersion: 1,
      commandId: 'cmd.cross-project-source',
      idempotencyKey: 'idem.cross-project-source',
      projectId: otherProjectId,
      baseRevision: 2,
      expectedVersion: 2,
      dryRun: false,
      payload: source.payload,
    }, {}),
    (error) => error.code === 'CONTEXT_PROJECT_MISMATCH',
  );
  assert.equal((await studio.readProjectTrusted(otherProjectId)).snapshot.sources.length, 0);
});

test('direct application and agent adapter produce identical semantics for the same authorized command', async () => {
  const directHarness = createHarness();
  const adapterHarness = createHarness();
  await createProject(directHarness.studio);
  await issueGrant(directHarness.studio);
  await createProject(adapterHarness.studio);
  await issueGrant(adapterHarness.studio);

  const source = agentSourceCommand();
  const directResult = await directHarness.studio.execute(source, AGENT_CONTEXT);
  const tools = createAgentToolCatalog(adapterHarness.studio, {
    contextProvider: async () => ({
      projectId: PROJECT_ID,
      actor: AGENT,
      taskId: 'task.atlas',
      grantId: 'grant.atlas',
      branchId: 'branch.task.atlas',
    }),
  });
  const toolResult = await findAgentTool(tools, 'studio_source_register').execute({
    schemaVersion: source.schemaVersion,
    commandId: source.commandId,
    idempotencyKey: source.idempotencyKey,
    projectId: source.projectId,
    baseRevision: source.baseRevision,
    expectedVersion: source.expectedVersion,
    dryRun: source.dryRun,
    payload: source.payload,
  }, {});

  assert.deepEqual(toolResult, directResult);
  assert.deepEqual(
    await adapterHarness.studio.readProjectTrusted(PROJECT_ID),
    await directHarness.studio.readProjectTrusted(PROJECT_ID),
  );
});

test('agent project reads expose only a redacted effective policy, never grant IDs or foreign grants', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);
  await studio.execute(command({
    commandId: 'cmd.foreign-grant',
    idempotencyKey: 'idem.foreign-grant',
    type: 'grant.issue',
    expectedVersion: 2,
    payload: {
      grantId: 'grant.foreign-secret',
      agentId: 'other.agent',
      taskId: 'task.foreign',
      branchId: 'branch.task.foreign',
      scopes: ['project.read'],
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0 },
    },
  }), OWNER_CONTEXT);
  const tools = createAgentToolCatalog(studio, {
    contextProvider: async () => ({
      projectId: PROJECT_ID,
      actor: AGENT,
      taskId: 'task.atlas',
      grantId: 'grant.atlas',
      branchId: 'branch.task.atlas',
    }),
  });
  const result = await findAgentTool(tools, 'studio_project_read').execute({
    schemaVersion: 1,
    projectId: PROJECT_ID,
  }, {});

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.snapshot.grants, undefined);
  assert.deepEqual(result.effectivePolicy, {
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    scopes: ['asset.write', 'project.read', 'source.write'],
    objectScopes: [{ kind: 'project', id: PROJECT_ID }],
    budget: { maxCommands: 100, maxJobs: 10, maxArtifactBytes: 536870912, maxCostCents: 0 },
    usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
    status: 'active',
    expiresAt: null,
  });
  assert.doesNotMatch(JSON.stringify(result), /grant\.atlas|grant\.foreign-secret|task\.foreign|other\.agent/);
});
