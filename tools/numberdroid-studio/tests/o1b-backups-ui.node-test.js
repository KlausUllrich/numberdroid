import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  BACKUP_CANDIDATE_STATUS,
  backupAllowedActions,
  backupHealthPresentation,
  backupOperationPresentation,
  currentBackupOperation,
  normalizeAcceptedBackupOperation,
  normalizeBackupOverview,
  unavailableBackupOverview,
} from '../apps/studio-server/public/o1b-backups-state.js';

const NOW = '2026-08-30T12:00:00.000Z';

function operation(overrides = {}) {
  const kind = overrides.kind ?? 'CREATE';
  return {
    schemaVersion: 1,
    operationId: 'operation.ui.1',
    kind,
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: { current: 0, total: { CREATE: 8, VERIFY: 3, RECOVERY_TEST: 7, RESTORE_AS_COPY: 7 }[kind] },
    destinationId: kind === 'CREATE' ? 'backup.local'
      : kind === 'RESTORE_AS_COPY' ? 'restore.local' : null,
    destinationLabel: kind === 'CREATE' ? 'Local backups'
      : kind === 'RESTORE_AS_COPY' ? 'Restored copies' : null,
    backupId: 'backup.ui.1',
    restoredCopyId: kind === 'RESTORE_AS_COPY' ? 'restored-copy.ui.1' : null,
    result: null,
    failure: null,
    createdAt: NOW,
    startedAt: null,
    finishedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function completedResult(kind = 'CREATE') {
  return {
    manifestIdentity: 'a'.repeat(64),
    itemCount: 4,
    byteCount: 4096,
    verifiedAt: NOW,
    recoveryTestedAt: kind === 'RECOVERY_TEST' ? NOW : null,
    backupHealth: kind === 'RESTORE_AS_COPY' ? null : 'VERIFIED',
    restoredCopyLifecycle: kind === 'RESTORE_AS_COPY' ? 'QUARANTINED_VERIFIED' : null,
  };
}

function backup(overrides = {}) {
  return {
    schemaVersion: 1,
    backupId: 'backup.ui.1',
    destinationId: 'backup.local',
    destinationLabel: 'Local backups',
    provenance: 'CREATED',
    health: 'VERIFIED',
    manifestIdentity: 'a'.repeat(64),
    itemCount: 4,
    byteCount: 4096,
    createdAt: NOW,
    registeredAt: NOW,
    lastVerifiedAt: NOW,
    lastRecoveryTestedAt: null,
    databaseSha256: 'must-not-survive',
    path: '/must-not-survive',
    ...overrides,
  };
}

function overview(overrides = {}) {
  return {
    schemaVersion: 1,
    state: 'READY',
    candidateStatus: BACKUP_CANDIDATE_STATUS,
    backupDestinations: [{ destinationId: 'backup.local', label: 'Local backups', root: '/hidden' }],
    restoreDestinations: [{ destinationId: 'restore.local', label: 'Restored copies', root: '/hidden' }],
    operations: [],
    backupWindow: { limit: 100, truncated: false },
    backups: [backup()],
    ...overrides,
  };
}

test('O1b UI projection is allowlisted and exposes no metadata while locked or unavailable', { timeout: 5_000 }, () => {
  for (const state of ['OPERATOR_LOCKED', 'OPERATIONS_UNAVAILABLE']) {
    const projection = unavailableBackupOverview(state);
    assert.equal(projection.state, state);
    assert.equal(projection.candidateStatus, BACKUP_CANDIDATE_STATUS);
    assert.deepEqual(projection.operations, []);
    assert.deepEqual(projection.backups, []);
  }
  const projection = normalizeBackupOverview(overview());
  assert.equal(projection.state, 'READY');
  assert.deepEqual(projection.backupDestinations, [{ destinationId: 'backup.local', label: 'Local backups' }]);
  assert.deepEqual(projection.restoreDestinations, [{ destinationId: 'restore.local', label: 'Restored copies' }]);
  assert.equal(projection.backups[0].manifestIdentity, 'a'.repeat(64));
  assert.doesNotMatch(JSON.stringify(projection), /databaseSha256|must-not-survive|\/hidden|\broot\b/);
  assert.equal(normalizeBackupOverview(overview({ state: 'NO_BACKUPS', backups: [] })).state, 'NO_BACKUPS');
  const unverified = normalizeBackupOverview(overview({
    backups: [backup({
      health: 'UNVERIFIED', manifestIdentity: null, itemCount: null, byteCount: null,
      createdAt: null, lastVerifiedAt: null,
    })],
  }));
  assert.equal(unverified.state, 'READY');
  assert.equal(unverified.backups[0].manifestIdentity, null);
  assert.equal(normalizeBackupOverview(overview({
    backups: [backup({ health: 'VERIFIED', manifestIdentity: null, itemCount: null })],
  })).state, 'OPERATIONS_UNAVAILABLE');
  assert.equal(normalizeBackupOverview(overview({
    backupWindow: { limit: 100, truncated: true },
  })).state, 'OPERATIONS_UNAVAILABLE');
  assert.equal(normalizeBackupOverview(overview({
    operations: [operation({ schemaVersion: 2 })],
  })).state, 'OPERATIONS_UNAVAILABLE');
  assert.equal(normalizeBackupOverview(overview({
    backups: [backup({ schemaVersion: 2 })],
  })).state, 'OPERATIONS_UNAVAILABLE');
  assert.equal(normalizeBackupOverview(overview({
    operations: [operation({ failure: { code: 'UNKNOWN', message: 'x' } })],
  })).state, 'OPERATIONS_UNAVAILABLE');
  assert.equal(normalizeBackupOverview(overview({
    operations: [operation({
      status: 'SUCCEEDED', phase: 'COMPLETED', progress: { current: 8, total: 8 },
      result: completedResult(), failure: { code: 'UNKNOWN', message: 'x' },
      startedAt: NOW, finishedAt: NOW,
    })],
  })).state, 'OPERATIONS_UNAVAILABLE');
});

test('O1b presentation covers queued, running, success, failure, interruption, and inactive restore truthfully', { timeout: 5_000 }, () => {
  assert.deepEqual(backupOperationPresentation(operation()), {
    tone: 'pending',
    title: 'Backup request saved. Waiting to start.',
    consequence: 'Navigation or disconnect does not cancel this durable request.',
  });
  assert.match(backupOperationPresentation(operation({
    status: 'RUNNING', phase: 'DB_SNAPSHOTTED', progress: { current: 2, total: 8 }, startedAt: NOW,
  })).title, /Copying protected files/);
  assert.match(backupOperationPresentation(operation({
    kind: 'RECOVERY_TEST', status: 'SUCCEEDED', phase: 'COMPLETED',
    progress: { current: 7, total: 7 }, startedAt: NOW, finishedAt: NOW,
  })).title, /Recovery test passed/);
  const restored = backupOperationPresentation(operation({
    kind: 'RESTORE_AS_COPY', status: 'SUCCEEDED', phase: 'COMPLETED',
    progress: { current: 8, total: 8 }, startedAt: NOW, finishedAt: NOW,
  }));
  assert.match(restored.title, /ready for inspection/);
  assert.match(restored.consequence, /not active/);
  assert.match(backupOperationPresentation(operation({
    status: 'FAILED', startedAt: NOW, finishedAt: NOW,
    failure: { code: 'BACKUP_PUBLISH_FAILED', message: 'safe' },
  })).consequence, /active work and earlier backups were not changed/);
  assert.match(backupOperationPresentation(operation({
    status: 'INTERRUPTED', startedAt: NOW, finishedAt: NOW,
    failure: { code: 'OPERATION_INTERRUPTED', message: 'safe' },
  })).title, /could not be resumed safely/);
  const projection = normalizeBackupOverview(overview({
    operations: [operation({
      operationId: 'operation.ui.completed',
      status: 'SUCCEEDED', phase: 'COMPLETED', progress: { current: 8, total: 8 },
      result: completedResult(), startedAt: NOW, finishedAt: NOW,
    }), operation()],
  }));
  assert.equal(currentBackupOperation(projection).status, 'QUEUED');
  const runningBeforeQueued = normalizeBackupOverview(overview({
    operations: [
      operation(),
      operation({
        operationId: 'operation.ui.running', status: 'RUNNING', phase: 'DB_SNAPSHOTTED',
        progress: { current: 2, total: 8 }, startedAt: NOW,
      }),
    ],
  }));
  assert.equal(currentBackupOperation(runningBeforeQueued).operationId, 'operation.ui.running');
  const queuedOrder = normalizeBackupOverview(overview({
    operations: [
      operation({ operationId: 'operation.ui.newer' }),
      operation({ operationId: 'operation.ui.older' }),
    ],
  }));
  assert.equal(currentBackupOperation(queuedOrder).operationId, 'operation.ui.older');
});

test('O1b damaged health is textual and gates recovery/restore without blocking verification', { timeout: 5_000 }, () => {
  for (const health of ['SUSPECT', 'MISSING']) {
    const damaged = normalizeBackupOverview(overview({ backups: [backup({ health })] })).backups[0];
    const presentation = backupHealthPresentation(damaged);
    assert.equal(presentation.tone, 'problem');
    assert.match(presentation.title, /needs attention/);
    assert.match(presentation.consequence, /Recovery and restore remain disabled/);
    assert.deepEqual(backupAllowedActions(damaged), {
      verify: true,
      recoveryTest: false,
      restoreAsCopy: false,
    });
  }
  const tested = normalizeBackupOverview(overview({
    backups: [backup({ lastRecoveryTestedAt: NOW })],
  })).backups[0];
  assert.match(backupHealthPresentation(tested).title, /Recovery test passed/);
  assert.deepEqual(backupAllowedActions(tested), {
    verify: true,
    recoveryTest: true,
    restoreAsCopy: true,
  });
});

test('O1b lost-response replay accepts the same operation after queue progress or completion', { timeout: 5_000 }, () => {
  const states = {
    QUEUED: operation(),
    RUNNING: operation({ status: 'RUNNING', startedAt: NOW }),
    SUCCEEDED: operation({
      status: 'SUCCEEDED', phase: 'COMPLETED', progress: { current: 8, total: 8 },
      result: completedResult(), startedAt: NOW, finishedAt: NOW,
    }),
    FAILED: operation({
      status: 'FAILED', startedAt: NOW, finishedAt: NOW,
      failure: { code: 'BACKUP_SNAPSHOT_FAILED', message: 'A complete backup snapshot could not be created.' },
    }),
    INTERRUPTED: operation({
      status: 'INTERRUPTED', startedAt: NOW, finishedAt: NOW,
      failure: { code: 'OPERATION_INTERRUPTED', message: 'The interrupted backup operation could not be resumed safely.' },
    }),
  };
  for (const [status, operationValue] of Object.entries(states)) {
    const accepted = normalizeAcceptedBackupOperation({
      schemaVersion: 1,
      candidateStatus: BACKUP_CANDIDATE_STATUS,
      operation: operationValue,
    }, 'CREATE');
    assert.equal(accepted.status, status);
  }
  assert.equal(normalizeAcceptedBackupOperation({
    schemaVersion: 1,
    candidateStatus: BACKUP_CANDIDATE_STATUS,
    operation: operation({ kind: 'VERIFY' }),
  }, 'CREATE'), null);
  assert.equal(normalizeAcceptedBackupOperation({
    schemaVersion: 1,
    candidateStatus: 'accepted',
    operation: operation(),
  }, 'CREATE'), null);
  assert.equal(normalizeBackupOverview(overview({
    operations: [operation({ status: 'SUCCEEDED' })],
  })).state, 'OPERATIONS_UNAVAILABLE');
});

test('O1b shell preserves the frozen hierarchy, secret hygiene, list-detail context, and action allowlist', { timeout: 5_000 }, async () => {
  const [html, app, styles, evidenceScript, workflow] = await Promise.all([
    readFile(new URL('../apps/studio-server/public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/capture-o1b-backups-browser-evidence.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../.github/workflows/build.yml', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-workspace="activity"><span>07<\/span>Activity<\/a>\s*<a href="#backups" data-workspace="backups"><span>08<\/span>Backups/);
  assert.match(html, /rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
  const renderStart = app.indexOf('function renderBackups()');
  const renderEnd = app.indexOf('function renderActivityWorkspace()', renderStart);
  const renderer = app.slice(renderStart, renderEnd);
  const safety = renderer.indexOf('backupSafetyCard');
  const create = renderer.indexOf('renderBackupCreateAction');
  const current = renderer.indexOf('currentBackupOperation');
  const result = renderer.indexOf('renderBackupDetail');
  assert.ok(safety >= 0 && create > safety && current > create && result > current);
  assert.match(renderer, /backupCandidateNote\(\)/);
  assert.match(renderer, /input\.type = 'password'/);
  assert.match(renderer, /input\.autocomplete = 'off'/);
  assert.match(renderer, /No backup details are shown before unlock/);
  assert.match(app, /Showing the 100 most recently registered backups/);
  assert.match(app, /backupNode\('span', 'status-pill', presentation\.label\)/);
  assert.match(app, /value\.failure\.message/);
  assert.match(app, /retry the same action from the available backup controls/);
  assert.match(app, /No cleanup control is available here/);
  assert.doesNotMatch(renderer, /path editor|directory picker/i);

  const actionStart = app.indexOf('async function executeBackupOperation');
  const actionEnd = app.indexOf("elements['workspace-content'].addEventListener('input'", actionStart);
  const actions = app.slice(actionStart, actionEnd);
  for (const label of ['Create backup now', 'Verify again', 'Test recovery', 'Restore as a new working copy']) {
    assert.match(app, new RegExp(label));
  }
  assert.doesNotMatch(renderer, />Delete<|>Activate<|>Switch<|data-backup-operation-kind = '(?:DELETE|ACTIVATE|REMOTE)'/i);
  assert.match(actions, /const serialized = JSON\.stringify\([\s\S]*input\.value = ''[\s\S]*body: serialized/);
  assert.doesNotMatch(actions, /localStorage|sessionStorage|telemetry/);
  assert.match(actions, /normalizeAcceptedBackupOperation\(response, kind\)/);
  assert.doesNotMatch(actions, /accepted\.operation\?\.status !== 'QUEUED'/);

  assert.match(app, /captureBackupDomState\(\)/);
  assert.match(app, /restoreBackupDomState\(\)/);
  assert.match(app, /backupNode\('ul', 'backup-list-items'\)/);
  assert.match(app, /const item = document\.createElement\('li'\)/);
  assert.match(app, /if \(state\.workspace === 'backups'\) \{[\s\S]*backupOverview: state\.backupOverview/);
  assert.match(app, /preserveWorkspace: preserveWorkspaceIfUnchanged[\s\S]*state\.workspace === 'backups'/);
  assert.match(app, /data-backup-disclosure-key/);
  assert.match(app, /\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /setTimeout\(\(\) => abortController\.abort\(\), 5_000\)/);
  assert.match(styles, /\.backup-list-items[\s\S]*overflow: auto/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.backup-section-heading/);

  for (const state of [
    'unavailable', 'locked', 'empty', 'queued', 'running', 'completed-list', 'verified',
    'recovery-passed', 'failed', 'interrupted', 'verification-required',
    'damaged-suspect', 'damaged-missing', 'restored-copy',
  ]) {
    assert.match(evidenceScript, new RegExp(`capture\\('${state}', 1440`));
    assert.match(evidenceScript, new RegExp(`capture\\('${state}', 1060`));
  }
  assert.doesNotMatch(evidenceScript, /Network\.enable/);
  assert.ok(evidenceScript.indexOf("devtools.send('Fetch.enable'")
    > evidenceScript.indexOf('const secretCleared'));
  assert.match(evidenceScript, /lostResponseReplay = \{ requestAttempts: 2, durableOperations: 1 \}/);
  assert.match(evidenceScript, /\.backup-detail \.status-pill/);
  assert.match(evidenceScript, /Failed to load resource: net::ERR_ABORTED/);
  assert.match(evidenceScript, /url: `\$\{unavailableBase\}\/api\/backups`[\s\S]*status of 404/);
  assert.match(evidenceScript, /url: `\$\{base\}\/api\/backups`[\s\S]*status of 401/);
  assert.match(evidenceScript, /url: `\$\{base\}\/api\/backups\/operations`[\s\S]*ERR_ABORTED/);
  assert.match(evidenceScript, /disarmExpectedNetworkError\('accepted-operation-abort'\)/);
  assert.match(evidenceScript, /devtools\.errors\.length === 0/);
  assert.match(evidenceScript, /observations\.keyboard = \{ boundedFocusTarget: true, focusVisible: true \}/);
  assert.match(evidenceScript, /scrollRetained: true/);
  assert.match(evidenceScript, /outerHTML\.includes\([\s\S]*bootstrapSecret/);
  assert.match(evidenceScript, /compatibleRefresh = \{ focusRetained: true, disclosureRetained: true, selectionRetained: true \}/);
  assert.match(workflow, /timeout 180s node tools\/numberdroid-studio\/scripts\/capture-o1b-backups-browser-evidence\.js/);
  assert.match(workflow, /numberdroid-studio-o1b-backups-evidence/);
});
