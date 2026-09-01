import { describe, expect, it } from "vitest";
// @ts-expect-error The app intentionally has no production Node type dependency; this is a Node-only integration test.
import { mkdtemp, rm } from "node:fs/promises";
// @ts-expect-error The app intentionally has no production Node type dependency; this is a Node-only integration test.
import { tmpdir } from "node:os";
// @ts-expect-error The app intentionally has no production Node type dependency; this is a Node-only integration test.
import { join } from "node:path";
// @ts-expect-error A4c intentionally verifies the JavaScript-only Studio application boundary.
import { AgentTaskService, DerivedChildTaskService, LevelCandidateApplicationService, StudioService } from "../../tools/numberdroid-studio/packages/application/src/index.js";
// @ts-expect-error A4c intentionally verifies the JavaScript-only Studio domain boundary.
import { listA4cGrantScopes } from "../../tools/numberdroid-studio/packages/domain/src/index.js";
// @ts-expect-error A4c intentionally verifies the JavaScript-only Studio persistence boundary.
import { SqliteAgentTaskStore, SqliteDerivedChildTaskStore, SqliteLevelCandidateStore, SqliteProjectStore, TaskBranchProjectStore } from "../../tools/numberdroid-studio/packages/persistence/src/index.js";
// @ts-expect-error A4c intentionally reuses the Studio's real SQLite test driver.
import { nodeSqliteDatabaseFactory } from "../../tools/numberdroid-studio/tests/persistence-test-helpers.js";
// @ts-expect-error A4c intentionally reuses the Studio's canonical task/project test identities.
import { AGENT, OWNER_CONTEXT, PROJECT_ID, command, createProject } from "../../tools/numberdroid-studio/tests/test-helpers.js";
// @ts-expect-error A4c intentionally verifies the JavaScript-only Studio adapter boundary.
import { NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST } from "../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js";
// @ts-expect-error A4c intentionally checks the JavaScript-only compiler-authority helper.
import { numberdroidLevelCompilerVersion } from "../../tools/numberdroid-studio/tests/helpers/numberdroid-level-compiler-authority.js";
import {
  NUMBERDROID_A4C_CANDIDATE_COMPOSER,
  NUMBERDROID_A4C_COMPILER_PIN,
  NUMBERDROID_A4C_ENGINE_BRIDGE,
  createNumberdroidA4cCandidateApplication,
} from "./numberdroidA4cCandidateComposer";

const CONTEXT = Object.freeze({
  actor: { id: "agent.a4c", kind: "agent", displayName: "A4c agent" },
  taskId: "task.a4c",
  grantId: "grant.task.a4c",
  branchId: "branch.task.a4c",
});

const REQUEST = Object.freeze({
  projectId: "project.a4c",
  taskId: CONTEXT.taskId,
  branchId: CONTEXT.branchId,
  expectedBaseRevision: 10,
  expectedBranchHeadRevision: 10,
  idempotencyKey: "a4c-root-integration",
});

describe("A4c real Numberdroid candidate composition", () => {
  it("runs the production composer, validate-only bridge, application, and SQLite ledger end to end across restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numberdroid-a4c-vertical-"));
    const filename = join(directory, "studio.sqlite");
    const clock = () => "2026-09-01T12:00:00.000Z";
    let projectStore: InstanceType<typeof SqliteProjectStore> | null = null;
    try {
      projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      const grantScopes = listA4cGrantScopes();
      const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
      await createProject(studio);
      const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
      const tasks = new AgentTaskService({
        studioService: studio,
        projectStore,
        taskStore,
        createBranchStore: ({ projectId, taskId }: { projectId: string; taskId: string }) => (
          new TaskBranchProjectStore({ taskStore, projectId, taskId })
        ),
        clock,
        grantScopes,
      });
      const createdTask = await tasks.createTask({
        projectId: PROJECT_ID,
        task: {
          taskId: CONTEXT.taskId,
          branchId: CONTEXT.branchId,
          agentId: AGENT.id,
          title: "A4c exact Candidate",
          objective: "Create one exact immutable A4b Level Candidate.",
          capabilities: ["project.read", "source.write", "level.candidate.create"],
          objectScopes: [{ kind: "project", id: PROJECT_ID }],
          budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
          expiresAt: "2026-09-01T13:00:00.000Z",
          autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
        },
      }, OWNER_CONTEXT);
      const request = {
        projectId: PROJECT_ID,
        taskId: createdTask.task.taskId,
        branchId: createdTask.task.branchId,
        expectedBaseRevision: createdTask.task.baseRevision,
        expectedBranchHeadRevision: createdTask.task.baseRevision,
        idempotencyKey: "a4c-production-vertical",
      };
      const trustedContext = {
        actor: AGENT,
        taskId: createdTask.task.taskId,
        branchId: createdTask.task.branchId,
        grantId: createdTask.task.grantId,
      };
      const service = createNumberdroidA4cCandidateApplication({ workspace: projectStore.workspace, clock });
      const [result, concurrentReplay] = await Promise.all([
        service.create(request, trustedContext),
        service.create(request, trustedContext),
      ]);
      expect(result.result).toMatchObject({ status: "WAITING_FOR_HUMAN_REVIEW", message: "Waiting for your review" });
      expect([result.replayed, concurrentReplay.replayed].filter(Boolean)).toHaveLength(1);
      expect(concurrentReplay.submission).toEqual(result.submission);
      expect(taskStore.getTask(PROJECT_ID, createdTask.task.taskId)).toMatchObject({
        state: "IN_REVIEW",
        usage: { commands: 1 },
        headRevision: createdTask.task.baseRevision + 1,
      });
      expect(Number(projectStore.workspace.database.prepare(
        "SELECT COUNT(*) AS count FROM task_branch_revisions WHERE command_type = 'level.candidate.create'",
      ).get().count)).toBe(1);
      expect(Number(projectStore.workspace.database.prepare(
        "SELECT COUNT(*) AS count FROM task_level_candidate_submissions",
      ).get().count)).toBe(1);

      const racedTask = await tasks.createTask({
        projectId: PROJECT_ID,
        task: {
          taskId: "task.a4c.replay-race",
          branchId: "branch.task.a4c.replay-race",
          agentId: AGENT.id,
          title: "A4c replay race",
          objective: "Force an identical commit between replay lookup and admission.",
          capabilities: ["project.read", "source.write", "level.candidate.create"],
          objectScopes: [{ kind: "project", id: PROJECT_ID }],
          budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
          expiresAt: "2026-09-01T13:00:00.000Z",
          autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
        },
      }, OWNER_CONTEXT);
      const racedRequest = {
        projectId: PROJECT_ID,
        taskId: racedTask.task.taskId,
        branchId: racedTask.task.branchId,
        expectedBaseRevision: racedTask.task.baseRevision,
        expectedBranchHeadRevision: racedTask.task.baseRevision,
        idempotencyKey: "a4c-replay-race",
      };
      const racedContext = {
        actor: AGENT,
        taskId: racedTask.task.taskId,
        branchId: racedTask.task.branchId,
        grantId: racedTask.task.grantId,
      };
      const producer = createNumberdroidA4cCandidateApplication({ workspace: projectStore.workspace, clock });
      const configuredBinding = {
        composer: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding,
        capabilityManifestFingerprint: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding.profileFingerprint,
        engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE.bridge,
      };
      const realStore = new SqliteLevelCandidateStore({ workspace: projectStore.workspace, configuredBinding });
      let replayLookups = 0;
      let outerCompilerRuns = 0;
      let outerBridgeRuns = 0;
      const raceStore = {
        isLive: true,
        lookupReplay(identity: any) {
          replayLookups += 1;
          return replayLookups === 1 ? null : realStore.lookupReplay(identity);
        },
        async authorizeCreate(args: any) {
          await producer.create(racedRequest, racedContext);
          return realStore.authorizeCreate(args);
        },
        submitCandidate(args: any) {
          return realStore.submitCandidate(args);
        },
      };
      const racedConsumer = new LevelCandidateApplicationService({
        candidateComposer: {
          ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
          project() {
            outerCompilerRuns += 1;
            return NUMBERDROID_A4C_CANDIDATE_COMPOSER.project();
          },
        },
        capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
        engineBridge: {
          ...NUMBERDROID_A4C_ENGINE_BRIDGE,
          validateCandidate(selection: Parameters<typeof NUMBERDROID_A4C_ENGINE_BRIDGE.validateCandidate>[0]) {
            outerBridgeRuns += 1;
            return NUMBERDROID_A4C_ENGINE_BRIDGE.validateCandidate(selection);
          },
        },
        store: raceStore,
        clock,
      });
      const racedReplay = await racedConsumer.create(racedRequest, racedContext);
      expect(racedReplay.replayed).toBe(true);
      expect(replayLookups).toBe(2);
      expect(outerCompilerRuns).toBe(0);
      expect(outerBridgeRuns).toBe(0);
      expect(taskStore.listBranchRevisions(PROJECT_ID, racedTask.task.taskId)).toHaveLength(1);
      expect(Number(projectStore.workspace.database.prepare(
        "SELECT COUNT(*) AS count FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?",
      ).get(PROJECT_ID, racedTask.task.taskId).count)).toBe(1);

      projectStore.close();
      projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      const restarted = createNumberdroidA4cCandidateApplication({ workspace: projectStore.workspace, clock });
      const replay = await restarted.create(request, trustedContext);
      expect(replay.replayed).toBe(true);
      expect(Number(projectStore.workspace.database.prepare(
        "SELECT COUNT(*) AS count FROM task_branch_revisions WHERE command_type = 'level.candidate.create'",
      ).get().count)).toBe(2);
    } finally {
      projectStore?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("derives an exact-head candidate child and runs the unchanged production A4c closure under ancestor authority", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numberdroid-a4c-derived-child-"));
    const filename = join(directory, "studio.sqlite");
    const clock = () => "2026-09-01T12:00:00.000Z";
    let projectStore: InstanceType<typeof SqliteProjectStore> | null = null;
    try {
      projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      const grantScopes = listA4cGrantScopes();
      const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
      await createProject(studio);
      const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
      const childService = new DerivedChildTaskService({
        store: new SqliteDerivedChildTaskStore({ workspace: projectStore.workspace }),
        clock,
        policy: {
          budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
          ttlSeconds: 1800,
        },
      });
      const tasks = new AgentTaskService({
        studioService: studio,
        projectStore,
        taskStore,
        createBranchStore: ({ projectId, taskId }: { projectId: string; taskId: string }) => (
          new TaskBranchProjectStore({ taskStore, projectId, taskId })
        ),
        clock,
        grantScopes,
        derivedChildService: childService,
      });
      const parent = await tasks.createTask({
        projectId: PROJECT_ID,
        task: {
          taskId: "task.a4c.derived-parent",
          branchId: "branch.task.a4c.derived-parent",
          agentId: AGENT.id,
          title: "Human-rooted Candidate parent",
          objective: "Delegate one exact Candidate child.",
          capabilities: ["level.candidate.create", "project.read", "task.child.derive"],
          objectScopes: [{ kind: "project", id: PROJECT_ID }],
          budget: { maxCommands: 2, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
          expiresAt: "2026-09-01T13:00:00.000Z",
          autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
        },
      }, OWNER_CONTEXT);
      const parentContext = {
        actor: AGENT,
        taskId: parent.task.taskId,
        branchId: parent.task.branchId,
        grantId: parent.task.grantId,
      };
      const derived = tasks.deriveCandidateChild(PROJECT_ID, {
        schemaVersion: 1,
        idempotencyKey: "derive.a4c.production-child",
        title: "Restricted Candidate child",
        objective: "Create one Candidate and stop at owner review.",
        expectedParentHeadRevision: parent.task.headRevision,
      }, parentContext);
      const childContext = {
        actor: AGENT,
        taskId: derived.task.taskId,
        branchId: derived.task.branchId,
        grantId: derived.task.grantId,
      };
      const request = {
        projectId: PROJECT_ID,
        taskId: derived.task.taskId,
        branchId: derived.task.branchId,
        expectedBaseRevision: derived.task.baseRevision,
        expectedBranchHeadRevision: derived.task.baseRevision,
        idempotencyKey: "a4c-derived-production-vertical",
      };
      const mainBefore = (await projectStore.loadProject(PROJECT_ID)).revisions.at(-1).number;
      const result = await createNumberdroidA4cCandidateApplication({ workspace: projectStore.workspace, clock })
        .create(request, childContext);
      expect(result.result).toMatchObject({ status: "WAITING_FOR_HUMAN_REVIEW", message: "Waiting for your review" });
      expect(taskStore.getTask(PROJECT_ID, derived.task.taskId)).toMatchObject({
        state: "IN_REVIEW",
        usage: { commands: 1 },
        headRevision: derived.task.baseRevision + 1,
      });
      expect((await projectStore.loadProject(PROJECT_ID)).revisions.at(-1).number).toBe(mainBefore);
      expect(NUMBERDROID_A4C_ENGINE_BRIDGE.mode).toBe("VALIDATE_ONLY");
      taskStore.transition(PROJECT_ID, parent.task.taskId, "pause", {
        actorId: OWNER_CONTEXT.actor.id,
        now: clock(),
        reason: "Prove ancestor blocking.",
      });
      const replay = await createNumberdroidA4cCandidateApplication({ workspace: projectStore.workspace, clock })
        .create(request, childContext);
      expect(replay.replayed).toBe(true);
    } finally {
      projectStore?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps real SQLite head, budget, timeline, and review unchanged for every pre-commit failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numberdroid-a4c-atomic-failures-"));
    const filename = join(directory, "studio.sqlite");
    const clock = () => "2026-09-01T12:00:00.000Z";
    let projectStore: InstanceType<typeof SqliteProjectStore> | null = null;
    try {
      projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      const grantScopes = listA4cGrantScopes();
      const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
      await createProject(studio);
      const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
      const tasks = new AgentTaskService({
        studioService: studio,
        projectStore,
        taskStore,
        createBranchStore: ({ projectId, taskId }: { projectId: string; taskId: string }) => (
          new TaskBranchProjectStore({ taskStore, projectId, taskId })
        ),
        clock,
        grantScopes,
      });
      const configuredBinding = {
        composer: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding,
        capabilityManifestFingerprint: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding.profileFingerprint,
        engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE.bridge,
      };
      const runFailure = async ({
        suffix,
        composer = NUMBERDROID_A4C_CANDIDATE_COMPOSER,
        bridge = NUMBERDROID_A4C_ENGINE_BRIDGE,
        signal,
      }: {
        suffix: string;
        composer?: typeof NUMBERDROID_A4C_CANDIDATE_COMPOSER;
        bridge?: typeof NUMBERDROID_A4C_ENGINE_BRIDGE;
        signal?: AbortSignal;
      }) => {
        const taskId = `task.a4c.failure.${suffix}`;
        const branchId = `branch.task.a4c.failure.${suffix}`;
        const created = await tasks.createTask({
          projectId: PROJECT_ID,
          task: {
            taskId,
            branchId,
            agentId: AGENT.id,
            title: `A4c ${suffix} failure`,
            objective: "Prove the complete Candidate application has no partial effects.",
            capabilities: ["project.read", "source.write", "level.candidate.create"],
            objectScopes: [{ kind: "project", id: PROJECT_ID }],
            budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
            expiresAt: "2026-09-01T13:00:00.000Z",
            autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
          },
        }, OWNER_CONTEXT);
        const request = {
          projectId: PROJECT_ID,
          taskId,
          branchId,
          expectedBaseRevision: created.task.baseRevision,
          expectedBranchHeadRevision: created.task.baseRevision,
          idempotencyKey: `a4c-atomic-failure-${suffix}`,
        };
        const trustedContext = {
          actor: AGENT,
          taskId,
          branchId,
          grantId: created.task.grantId,
        };
        const before = {
          task: taskStore.getTask(PROJECT_ID, taskId),
          branch: taskStore.loadBranchDocument(PROJECT_ID, taskId),
          timeline: taskStore.listTimeline(PROJECT_ID, taskId),
          main: await projectStore!.loadProject(PROJECT_ID),
        };
        const service = new LevelCandidateApplicationService({
          candidateComposer: composer,
          capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
          engineBridge: bridge,
          store: new SqliteLevelCandidateStore({ workspace: projectStore!.workspace, configuredBinding }),
          clock,
        });
        await expect(service.create(request, trustedContext, { signal })).rejects.toBeTruthy();
        expect(taskStore.getTask(PROJECT_ID, taskId)).toEqual(before.task);
        expect(taskStore.loadBranchDocument(PROJECT_ID, taskId)).toEqual(before.branch);
        expect(taskStore.listTimeline(PROJECT_ID, taskId)).toEqual(before.timeline);
        expect(await projectStore!.loadProject(PROJECT_ID)).toEqual(before.main);
        expect(taskStore.getReview(PROJECT_ID, taskId)).toBeNull();
        expect(Number(projectStore!.workspace.database.prepare(
          "SELECT COUNT(*) AS count FROM task_branch_revisions WHERE project_id = ? AND task_id = ?",
        ).get(PROJECT_ID, taskId).count)).toBe(0);
        expect(Number(projectStore!.workspace.database.prepare(
          "SELECT COUNT(*) AS count FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?",
        ).get(PROJECT_ID, taskId).count)).toBe(0);
      };

      await runFailure({
        suffix: "compiler",
        composer: { ...NUMBERDROID_A4C_CANDIDATE_COMPOSER, project() { throw new Error("compiler blocked"); } },
      });
      await runFailure({
        suffix: "validation",
        composer: {
          ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
          async project() {
            const projection = await NUMBERDROID_A4C_CANDIDATE_COMPOSER.project();
            return { ...projection, a3a: { ...projection.a3a, requirementSet: {} } };
          },
        },
      });
      await runFailure({
        suffix: "preview",
        composer: { ...NUMBERDROID_A4C_CANDIDATE_COMPOSER, compose() { throw new Error("preview blocked"); } },
      });
      await runFailure({
        suffix: "diff",
        composer: {
          ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
          async compose(input: Parameters<typeof NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose>[0]) {
            const closure = structuredClone(await NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose(input));
            closure.diff.projectId = "project.other";
            return closure;
          },
        },
      });
      await runFailure({
        suffix: "bridge",
        bridge: { ...NUMBERDROID_A4C_ENGINE_BRIDGE, validateCandidate() { throw new Error("bridge blocked"); } },
      });
      const abortController = new AbortController();
      await runFailure({
        suffix: "abort",
        signal: abortController.signal,
        composer: {
          ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
          async compose(input: Parameters<typeof NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose>[0]) {
            const closure = await NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose(input);
            abortController.abort();
            return closure;
          },
        },
      });

      const changed = await tasks.createTask({
        projectId: PROJECT_ID,
        task: {
          taskId: "task.a4c.failure.head-change",
          branchId: "branch.task.a4c.failure.head-change",
          agentId: AGENT.id,
          title: "A4c head-change failure",
          objective: "Prove freshness is rechecked after all read-only preparation.",
          capabilities: ["project.read", "source.write", "level.candidate.create"],
          objectScopes: [{ kind: "project", id: PROJECT_ID }],
          budget: { maxCommands: 2, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
          expiresAt: "2026-09-01T13:00:00.000Z",
          autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
        },
      }, OWNER_CONTEXT);
      const changedContext = {
        actor: AGENT,
        taskId: changed.task.taskId,
        branchId: changed.task.branchId,
        grantId: changed.task.grantId,
      };
      const mainBeforeHeadChange = await projectStore.loadProject(PROJECT_ID);
      const headChangingComposer = {
        ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
        async compose(input: Parameters<typeof NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose>[0]) {
          const closure = await NUMBERDROID_A4C_CANDIDATE_COMPOSER.compose(input);
          await tasks.execute(command({
            commandId: "cmd.a4c.concurrent-source",
            idempotencyKey: "idem.a4c.concurrent-source",
            type: "source.register",
            expectedVersion: changed.task.baseRevision,
            payload: {
              sourceId: "source.a4c.concurrent",
              name: "Concurrent source",
              artifactUri: "studio://project.family-hygiene/artifacts/a4c-concurrent.png",
              mediaType: "image/png",
              width: 64,
              height: 64,
              provenance: { prompt: "Freshness test.", seed: 4 },
            },
          }), changedContext);
          return closure;
        },
      };
      const headChangeService = new LevelCandidateApplicationService({
        candidateComposer: headChangingComposer,
        capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
        engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
        store: new SqliteLevelCandidateStore({ workspace: projectStore.workspace, configuredBinding }),
        clock,
      });
      await expect(headChangeService.create({
        projectId: PROJECT_ID,
        taskId: changed.task.taskId,
        branchId: changed.task.branchId,
        expectedBaseRevision: changed.task.baseRevision,
        expectedBranchHeadRevision: changed.task.baseRevision,
        idempotencyKey: "a4c-head-change",
      }, changedContext)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
      expect(taskStore.listBranchRevisions(PROJECT_ID, changed.task.taskId)).toHaveLength(1);
      expect(taskStore.listBranchRevisions(PROJECT_ID, changed.task.taskId)[0].command.type).toBe("source.register");
      expect(taskStore.getReview(PROJECT_ID, changed.task.taskId)).toBeNull();
      expect(Number(projectStore.workspace.database.prepare(
        "SELECT COUNT(*) AS count FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?",
      ).get(PROJECT_ID, changed.task.taskId).count)).toBe(0);
      expect(await projectStore.loadProject(PROJECT_ID)).toEqual(mainBeforeHeadChange);
    } finally {
      projectStore?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("denies stale or invalid authority before invoking the real compiler or EngineBridge", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numberdroid-a4c-admission-"));
    const filename = join(directory, "studio.sqlite");
    const clock = () => "2026-09-01T12:00:00.000Z";
    let projectStore: InstanceType<typeof SqliteProjectStore> | null = null;
    try {
      projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      const grantScopes = listA4cGrantScopes();
      const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
      await createProject(studio);
      const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
      const tasks = new AgentTaskService({
        studioService: studio,
        projectStore,
        taskStore,
        createBranchStore: ({ projectId, taskId }: { projectId: string; taskId: string }) => (
          new TaskBranchProjectStore({ taskStore, projectId, taskId })
        ),
        clock,
        grantScopes,
      });
      const configuredBinding = {
        composer: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding,
        capabilityManifestFingerprint: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding.profileFingerprint,
        engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE.bridge,
      };
      const runDenied = async ({
        suffix,
        capabilities = ["project.read", "source.write", "level.candidate.create"],
        prepare = async () => {},
        contextPatch = {},
        expectedBranchCount = 0,
      }: {
        suffix: string;
        capabilities?: string[];
        prepare?: (created: any, trustedContext: any) => Promise<void>;
        contextPatch?: Record<string, unknown>;
        expectedBranchCount?: number;
      }) => {
        const taskId = `task.a4c.denied.${suffix}`;
        const branchId = `branch.task.a4c.denied.${suffix}`;
        const created = await tasks.createTask({
          projectId: PROJECT_ID,
          task: {
            taskId,
            branchId,
            agentId: AGENT.id,
            title: `A4c denied ${suffix}`,
            objective: "Prove fresh authorization precedes compiler and bridge work.",
            capabilities,
            objectScopes: [{ kind: "project", id: PROJECT_ID }],
            budget: { maxCommands: suffix === "stale-head" ? 2 : 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
            expiresAt: "2026-09-01T13:00:00.000Z",
            autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
          },
        }, OWNER_CONTEXT);
        const trustedContext = {
          actor: AGENT,
          taskId,
          branchId,
          grantId: created.task.grantId,
        };
        await prepare(created, trustedContext);
        const before = {
          task: taskStore.getTask(PROJECT_ID, taskId),
          branch: taskStore.loadBranchDocument(PROJECT_ID, taskId),
          timeline: taskStore.listTimeline(PROJECT_ID, taskId),
          main: await projectStore!.loadProject(PROJECT_ID),
        };
        let compilerRuns = 0;
        let bridgeRuns = 0;
        const observedComposer = {
          ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
          project() {
            compilerRuns += 1;
            return NUMBERDROID_A4C_CANDIDATE_COMPOSER.project();
          },
        };
        const observedBridge = {
          ...NUMBERDROID_A4C_ENGINE_BRIDGE,
          validateCandidate(selection: Parameters<typeof NUMBERDROID_A4C_ENGINE_BRIDGE.validateCandidate>[0]) {
            bridgeRuns += 1;
            return NUMBERDROID_A4C_ENGINE_BRIDGE.validateCandidate(selection);
          },
        };
        const service = new LevelCandidateApplicationService({
          candidateComposer: observedComposer,
          capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
          engineBridge: observedBridge,
          store: new SqliteLevelCandidateStore({ workspace: projectStore!.workspace, configuredBinding }),
          clock,
        });
        await expect(service.create({
          projectId: PROJECT_ID,
          taskId,
          branchId,
          expectedBaseRevision: created.task.baseRevision,
          expectedBranchHeadRevision: created.task.baseRevision,
          idempotencyKey: `a4c-denied-${suffix}`,
        }, { ...trustedContext, ...contextPatch })).rejects.toBeTruthy();
        expect(compilerRuns).toBe(0);
        expect(bridgeRuns).toBe(0);
        expect(taskStore.getTask(PROJECT_ID, taskId)).toEqual(before.task);
        expect(taskStore.loadBranchDocument(PROJECT_ID, taskId)).toEqual(before.branch);
        expect(taskStore.listTimeline(PROJECT_ID, taskId)).toEqual(before.timeline);
        expect(await projectStore!.loadProject(PROJECT_ID)).toEqual(before.main);
        expect(taskStore.getReview(PROJECT_ID, taskId)).toBeNull();
        expect(taskStore.listBranchRevisions(PROJECT_ID, taskId)).toHaveLength(expectedBranchCount);
        expect(Number(projectStore!.workspace.database.prepare(
          "SELECT COUNT(*) AS count FROM task_branch_revisions WHERE project_id = ? AND task_id = ? AND command_type = 'level.candidate.create'",
        ).get(PROJECT_ID, taskId).count)).toBe(0);
        expect(Number(projectStore!.workspace.database.prepare(
          "SELECT COUNT(*) AS count FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?",
        ).get(PROJECT_ID, taskId).count)).toBe(0);
      };

      await runDenied({
        suffix: "actor",
        contextPatch: { actor: { id: "agent.other", kind: "agent", displayName: "Other agent" } },
      });
      await runDenied({ suffix: "grant", contextPatch: { grantId: "grant.other" } });
      await runDenied({ suffix: "scope", capabilities: ["project.read", "source.write"] });
      await runDenied({
        suffix: "paused",
        prepare: async (created) => {
          await tasks.control(PROJECT_ID, created.task.taskId, "pause", {
            actorId: OWNER_CONTEXT.actor.id,
            reason: "Admission-order test.",
          });
        },
      });
      await runDenied({
        suffix: "expired-task",
        prepare: async (created) => {
          const row = projectStore!.workspace.database.prepare(
            "SELECT task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?",
          ).get(PROJECT_ID, created.task.taskId);
          const task = JSON.parse(row.task_json);
          task.expiresAt = clock();
          projectStore!.workspace.database.prepare(`
            UPDATE agent_tasks SET expires_at = ?, task_json = ? WHERE project_id = ? AND task_id = ?
          `).run(clock(), JSON.stringify(task), PROJECT_ID, created.task.taskId);
        },
      });
      await runDenied({
        suffix: "revoked-grant",
        prepare: async (created) => {
          projectStore!.workspace.database.prepare(`
            UPDATE grants SET status = 'REVOKED', authorization_status = 'REVOKED', revoked_at = ?
            WHERE project_id = ? AND grant_id = ?
          `).run(clock(), PROJECT_ID, created.task.grantId);
        },
      });
      await runDenied({
        suffix: "budget",
        prepare: async (created) => {
          const database = projectStore!.workspace.database;
          const row = database.prepare(`
            SELECT task_json, head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
          `).get(PROJECT_ID, created.task.taskId);
          const task = JSON.parse(row.task_json);
          const document = JSON.parse(row.head_document_json);
          task.usage.commands = 1;
          document.revisions.at(-1).snapshot.grants
            .find(({ id }: { id: string }) => id === created.task.grantId).usage.commands = 1;
          database.prepare("UPDATE grants SET usage_json = ? WHERE project_id = ? AND grant_id = ?")
            .run(JSON.stringify(task.usage), PROJECT_ID, created.task.grantId);
          database.prepare(`
            UPDATE agent_tasks SET task_json = ?, head_document_json = ? WHERE project_id = ? AND task_id = ?
          `).run(JSON.stringify(task), JSON.stringify(document), PROJECT_ID, created.task.taskId);
        },
      });
      await runDenied({
        suffix: "stale-head",
        expectedBranchCount: 1,
        prepare: async (created, trustedContext) => {
          await tasks.execute(command({
            commandId: "cmd.a4c.stale-head",
            idempotencyKey: "idem.a4c.stale-head",
            type: "source.register",
            expectedVersion: created.task.baseRevision,
            payload: {
              sourceId: "source.a4c.stale-head",
              name: "Stale head source",
              artifactUri: "studio://project.family-hygiene/artifacts/a4c-stale-head.png",
              mediaType: "image/png",
              width: 64,
              height: 64,
              provenance: { prompt: "Admission-order stale-head test.", seed: 5 },
            },
          }), trustedContext);
        },
      });
    } finally {
      projectStore?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("runs the actual A4b source through A4a, A3a, compiler, portable preview and validate-only EngineBridge", async () => {
    expect(numberdroidLevelCompilerVersion(new URL("../../", import.meta.url))).toBe(NUMBERDROID_A4C_COMPILER_PIN);
    let stored: unknown = null;
    let compilerRuns = 0;
    const composer = {
      ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
      project() {
        compilerRuns += 1;
        return NUMBERDROID_A4C_CANDIDATE_COMPOSER.project();
      },
    };
    const store = {
      isLive: true,
      lookupReplay() { return stored; },
      authorizeCreate() { return { schemaVersion: 1, baseRevision: 10, branchHeadRevision: 10 }; },
      submitCandidate({ source, submission }: { source: Record<string, unknown>; submission: Record<string, unknown> }) {
        expect(source).toMatchObject({ kind: "numberdroid.a4c-level-candidate-source" });
        stored = {
          schemaVersion: 1,
          result: {
            status: "WAITING_FOR_HUMAN_REVIEW",
            message: "Waiting for your review",
            branchHeadRevision: 11,
          },
          submission,
        };
        return stored;
      },
    };
    const service = new LevelCandidateApplicationService({
      candidateComposer: composer,
      capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
      engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
      store,
      clock: () => "2026-09-01T12:00:00.000Z",
    });
    const created = await service.create(REQUEST, CONTEXT);
    expect(created.result).toMatchObject({
      status: "WAITING_FOR_HUMAN_REVIEW",
      message: "Waiting for your review",
      branchHeadRevision: 11,
    });
    expect(created.submission).toMatchObject({
      projectionFingerprint: "12609f0972c242cece2d751bace8f85f62f66e49f38358d3a87160b273cd8142",
      candidate: {
        candidateManifest: {
          status: "VERIFIED",
          artifacts: [],
          capabilityProfile: {
            profileVersion: 3,
            fingerprint: "6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074",
          },
          compiler: {
            version: NUMBERDROID_A4C_COMPILER_PIN,
            status: "SUCCEEDED",
            evidenceHash: "21f9e5c1fe5f584176c7429244359ba2693ed0197b26841b43b556481d7b0c6b",
          },
        },
      },
      diff: {
        branchHeadRevision: 11,
        changes: [{ operation: "ADD" }],
        outputs: [{ operation: "ADD", beforeSha256: null }, { operation: "ADD", beforeSha256: null }],
      },
      status: "WAITING_FOR_HUMAN_REVIEW",
      authority: {
        reviewDecision: "NOT_AUTHORIZED",
        merge: "NOT_AUTHORIZED",
        materialize: "NOT_AUTHORIZED",
        commit: "NOT_AUTHORIZED",
        publish: "NOT_AUTHORIZED",
        release: "NOT_AUTHORIZED",
      },
    });
    expect(created.submission.preview.steps.map((step: { actionKind: string }) => step.actionKind)).toEqual([
      "drop-item", "set-variable", "show-text",
    ]);
    expect(compilerRuns).toBe(1);

    const replayed = await service.create(REQUEST, CONTEXT);
    expect(replayed.replayed).toBe(true);
    expect(replayed.submission).toEqual(created.submission);
    expect(compilerRuns).toBe(1);
  });

  it("fails closed for a changed profile, blocked compiler, or mismatched validate-only bridge receipt", async () => {
    const createStore = () => {
      let submitCount = 0;
      return {
        isLive: true,
        lookupReplay() { return null; },
        authorizeCreate() { return { schemaVersion: 1, baseRevision: 10, branchHeadRevision: 10 }; },
        submitCandidate() { submitCount += 1; throw new Error("unexpected submit"); },
        get submitCount() { return submitCount; },
      };
    };
    const nonEmptyBranchStore = createStore();
    const nonEmptyBranchService = new LevelCandidateApplicationService({
      candidateComposer: NUMBERDROID_A4C_CANDIDATE_COMPOSER,
      capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
      engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
      store: nonEmptyBranchStore,
    });
    await expect(nonEmptyBranchService.create({
      ...REQUEST,
      expectedBranchHeadRevision: REQUEST.expectedBaseRevision + 1,
    }, CONTEXT)).rejects.toMatchObject({ code: "LEVEL_CANDIDATE_BRANCH_NOT_EMPTY" });
    expect(nonEmptyBranchStore.submitCount).toBe(0);

    const changedProfile = structuredClone(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST);
    changedProfile.profileVersion = 2;
    expect(() => new LevelCandidateApplicationService({
      candidateComposer: NUMBERDROID_A4C_CANDIDATE_COMPOSER,
      capabilityManifest: changedProfile,
      engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
      store: createStore(),
    })).toThrowError(/capability profile does not match/i);

    const compilerStore = createStore();
    const blockedCompiler = {
      ...NUMBERDROID_A4C_CANDIDATE_COMPOSER,
      project() { throw new Error("compiler blocked"); },
    };
    const compilerService = new LevelCandidateApplicationService({
      candidateComposer: blockedCompiler,
      capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
      engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
      store: compilerStore,
      clock: () => "2026-09-01T12:00:00.000Z",
    });
    await expect(compilerService.create(REQUEST, CONTEXT)).rejects.toThrowError("compiler blocked");
    expect(compilerStore.submitCount).toBe(0);

    const bridgeStore = createStore();
    const mismatchedBridge = {
      ...NUMBERDROID_A4C_ENGINE_BRIDGE,
      validateCandidate() {
        return {
          schemaVersion: 1,
          kind: "studio.engine-bridge.validation-receipt",
          status: "VALIDATED",
          bridge: NUMBERDROID_A4C_ENGINE_BRIDGE.bridge,
          candidateFingerprint: "0".repeat(64),
          evidenceHash: "0".repeat(64),
        };
      },
    };
    const bridgeService = new LevelCandidateApplicationService({
      candidateComposer: NUMBERDROID_A4C_CANDIDATE_COMPOSER,
      capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
      engineBridge: mismatchedBridge,
      store: bridgeStore,
      clock: () => "2026-09-01T12:00:00.000Z",
    });
    await expect(bridgeService.create(REQUEST, CONTEXT)).rejects.toMatchObject({ code: "ENGINE_BRIDGE_RECEIPT_MISMATCH" });
    expect(bridgeStore.submitCount).toBe(0);
  });
});
