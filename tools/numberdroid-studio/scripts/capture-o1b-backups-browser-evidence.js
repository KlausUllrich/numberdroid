import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { BackupOperationsController } from '../apps/studio-server/src/backup-operations-controller.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { generateWorkspaceOperatorBootstrapSecret } from '../apps/studio-server/src/workspace-operator-session.js';
import { closeBrowserAndRemoveProfile, finishCapture, trackProcessClose } from './browser-process-teardown.js';

const [chromePath, outputArgument] = process.argv.slice(2);
if (!chromePath || !outputArgument) {
  throw new Error('Usage: capture-o1b-backups-browser-evidence.js CHROME OUTPUT_DIRECTORY');
}
const outputDirectory = resolve(outputArgument);
const profileDirectory = await mkdtemp(`${tmpdir()}/numberdroid-o1b-chrome-`);
await mkdir(outputDirectory, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function operation(request, sequence) {
  return {
    schemaVersion: 1,
    operationId: `operation.visual.${sequence}`,
    kind: request.kind,
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: { current: 0, total: 8 },
    destinationId: request.destinationId ?? null,
    destinationLabel: request.destinationId === 'restore.local' ? 'Restored copies'
      : request.destinationId === 'backup.local' ? 'Local backups' : null,
    backupId: request.backupId ?? 'backup.visual.1',
    restoredCopyId: request.kind === 'RESTORE_AS_COPY' ? 'restored-copy.visual.1' : null,
    result: null,
    failure: null,
    createdAt: '2026-08-30T12:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    updatedAt: '2026-08-30T12:00:00.000Z',
  };
}

function visualRuntimeHarness() {
  let recent = [];
  let backups = [];
  const operationByIdempotencyKey = new Map();
  let requestAttempts = 0;
  let queued = null;
  let releaseQueued = null;
  let releaseRunning = null;
  let closed = false;

  function terminalOperation(kind, status, sequence, {
    failure = null,
    result = null,
    progressTotal = 3,
  } = {}) {
    const value = operation({ kind, backupId: 'backup.visual.1' }, sequence);
    Object.assign(value, {
      status,
      phase: status === 'SUCCEEDED' ? 'COMPLETED' : 'RESERVED',
      progress: { current: status === 'SUCCEEDED' ? progressTotal : 0, total: progressTotal },
      failure,
      result,
      startedAt: '2026-08-30T12:00:06.000Z',
      finishedAt: '2026-08-30T12:00:07.000Z',
      updatedAt: '2026-08-30T12:00:07.000Z',
    });
    return value;
  }

  return {
    runtime: {
      async requestOperation(request) {
        requestAttempts += 1;
        const replay = operationByIdempotencyKey.get(request.idempotencyKey);
        if (replay) return structuredClone(replay);
        const accepted = operation(request, operationByIdempotencyKey.size + 1);
        operationByIdempotencyKey.set(request.idempotencyKey, accepted);
        recent = [accepted, ...recent];
        queued = accepted;
        return structuredClone(accepted);
      },
      async readOperation({ operationId }) {
        return structuredClone(recent.find((entry) => entry.operationId === operationId) ?? null);
      },
      async listRecentOperations() { return structuredClone(recent); },
      listBackups() { return structuredClone(backups); },
      listDestinations(kind) {
        return kind === 'CREATE'
          ? [{ destinationId: 'backup.local', label: 'Local backups' }]
          : [{ destinationId: 'restore.local', label: 'Restored copies' }];
      },
      async runNext() {
        if (queued === null) return null;
        const active = queued;
        queued = null;
        await new Promise((resolveRun) => { releaseQueued = resolveRun; });
        releaseQueued = null;
        if (closed) return null;
        Object.assign(active, {
          status: 'RUNNING',
          phase: 'DB_SNAPSHOTTED',
          progress: { current: 2, total: 8 },
          startedAt: '2026-08-30T12:00:01.000Z',
          updatedAt: '2026-08-30T12:00:02.000Z',
        });
        return new Promise((resolveRun) => {
          releaseRunning = () => {
            Object.assign(active, {
              status: 'SUCCEEDED',
              phase: 'COMPLETED',
              progress: { current: 8, total: 8 },
              result: {
                manifestIdentity: 'a'.repeat(64), itemCount: 4, byteCount: 4096,
                verifiedAt: '2026-08-30T12:00:04.000Z', recoveryTestedAt: null,
                backupHealth: 'VERIFIED', restoredCopyLifecycle: null,
              },
              finishedAt: '2026-08-30T12:00:04.000Z',
              updatedAt: '2026-08-30T12:00:04.000Z',
            });
            const primaryBackup = {
              schemaVersion: 1,
              backupId: 'backup.visual.1',
              destinationId: 'backup.local',
              provenance: 'CREATED',
              health: 'VERIFIED',
              manifestSha256: 'a'.repeat(64),
              databaseSha256: 'b'.repeat(64),
              artifactCount: 4,
              byteCount: 4096,
              createdAt: '2026-08-30T12:00:00.000Z',
              registeredAt: '2026-08-30T12:00:04.000Z',
              lastVerifiedAt: '2026-08-30T12:00:04.000Z',
              lastRecoveryTestedAt: null,
            };
            backups = [primaryBackup, ...Array.from({ length: 11 }, (_, index) => ({
              ...primaryBackup,
              backupId: `backup.visual.${index + 2}`,
              createdAt: `2026-08-29T11:${String(index).padStart(2, '0')}:00.000Z`,
              registeredAt: `2026-08-29T11:${String(index).padStart(2, '0')}:05.000Z`,
              lastVerifiedAt: `2026-08-29T11:${String(index).padStart(2, '0')}:05.000Z`,
            }))];
            releaseRunning = null;
            resolveRun(structuredClone(active));
          };
        });
      },
      async close() {
        closed = true;
        releaseQueued?.();
        releaseRunning?.();
      },
    },
    get operationCount() { return operationByIdempotencyKey.size; },
    get requestAttempts() { return requestAttempts; },
    releaseQueued() {
      assert(typeof releaseQueued === 'function', 'Create operation was not durably queued.');
      releaseQueued();
    },
    releaseCreate() {
      assert(typeof releaseRunning === 'function', 'Create operation was not running.');
      releaseRunning();
    },
    setBackupHealth(health) {
      assert(backups[0]?.backupId === 'backup.visual.1', 'A completed visual backup is required.');
      backups[0].health = health;
    },
    advanceCompatibleProjection(timestamp) {
      assert(backups.length > 0, 'A backup projection is required.');
      backups[0].registeredAt = timestamp;
    },
    showRecoveryPassed() {
      assert(backups[0]?.backupId === 'backup.visual.1', 'A completed visual backup is required.');
      backups[0].health = 'VERIFIED';
      backups[0].lastRecoveryTestedAt = '2026-08-30T12:00:06.000Z';
      recent = [terminalOperation('RECOVERY_TEST', 'SUCCEEDED', 2, {
        progressTotal: 7,
        result: {
          manifestIdentity: 'a'.repeat(64), itemCount: 4, byteCount: 4096,
          verifiedAt: '2026-08-30T12:00:06.000Z',
          recoveryTestedAt: '2026-08-30T12:00:07.000Z',
          backupHealth: 'VERIFIED', restoredCopyLifecycle: null,
        },
      }), ...recent];
    },
    showFailure() {
      recent = [terminalOperation('VERIFY', 'FAILED', 3, {
        failure: { code: 'BACKUP_CONTENT_MISMATCH', message: 'The backup content differs from its verified evidence.' },
      }), ...recent];
    },
    showInterrupted() {
      recent = [terminalOperation('VERIFY', 'INTERRUPTED', 4, {
        failure: { code: 'OPERATION_INTERRUPTED', message: 'The interrupted backup operation could not be resumed safely.' },
      }), ...recent];
    },
    restoreReady() {
      assert(backups[0]?.backupId === 'backup.visual.1', 'A completed visual backup is required.');
      backups[0].health = 'VERIFIED';
      backups[0].lastRecoveryTestedAt = '2026-08-30T12:00:06.000Z';
      recent = [{
        ...operation({
          kind: 'RESTORE_AS_COPY',
          backupId: 'backup.visual.1',
          destinationId: 'restore.local',
        }, 5),
        status: 'SUCCEEDED',
        phase: 'COMPLETED',
        progress: { current: 7, total: 7 },
        destinationLabel: 'Restored copies',
        restoredCopyId: 'restored-copy.visual.1',
        result: {
          manifestIdentity: 'a'.repeat(64), itemCount: 4, byteCount: 4096,
          verifiedAt: '2026-08-30T12:00:07.000Z', recoveryTestedAt: null,
          backupHealth: null, restoredCopyLifecycle: 'QUARANTINED_VERIFIED',
        },
        startedAt: '2026-08-30T12:00:06.000Z',
        finishedAt: '2026-08-30T12:00:07.000Z',
        updatedAt: '2026-08-30T12:00:07.000Z',
      }, ...recent];
    },
    get closed() { return closed; },
  };
}

class DevTools {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #eventWaiters = new Map();
  #expectedNetworkError = null;
  errors = [];
  expectedNetworkErrors = [];

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', rejectOpen, { once: true });
    });
    return new DevTools(socket);
  }

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        this.#pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
      } else {
        if (message.method === 'Runtime.exceptionThrown') {
          this.errors.push({ method: message.method });
        } else if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
          const { source, text: entryText } = message.params.entry;
          if (this.#expectedNetworkError?.remaining === 1
              && source === 'network'
              && this.#expectedNetworkError.textPattern.test(entryText)
              && message.params.entry.url === this.#expectedNetworkError.url) {
            this.#expectedNetworkError.remaining = 0;
            this.expectedNetworkErrors.push(this.#expectedNetworkError.label);
          } else {
            this.errors.push({ method: message.method, source });
          }
        }
        const waiters = this.#eventWaiters.get(message.method);
        const waiter = waiters?.shift();
        if (waiter) {
          clearTimeout(waiter.timeout);
          if (waiters.length === 0) this.#eventWaiters.delete(message.method);
          waiter.resolve(message);
        }
      }
    });
  }

  waitForEvent(method, timeoutMs = 10_000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const timeout = setTimeout(() => {
        const waiters = this.#eventWaiters.get(method) ?? [];
        this.#eventWaiters.set(method, waiters.filter((waiter) => waiter.resolve !== resolveEvent));
        rejectEvent(new Error(`${method} event timed out.`));
      }, timeoutMs);
      const waiters = this.#eventWaiters.get(method) ?? [];
      waiters.push({ resolve: resolveEvent, timeout });
      this.#eventWaiters.set(method, waiters);
    });
  }

  armExpectedNetworkError({ label, url, textPattern }) {
    if (this.#expectedNetworkError !== null) {
      throw new Error('An expected network error is already armed.');
    }
    if (typeof label !== 'string' || typeof url !== 'string'
        || !(textPattern instanceof RegExp) || textPattern.global) {
      throw new Error('Expected network error classification is invalid.');
    }
    this.#expectedNetworkError = { label, url, textPattern, remaining: 1 };
  }

  disarmExpectedNetworkError(label) {
    if (this.#expectedNetworkError?.label !== label) {
      throw new Error('The expected network error window does not match.');
    }
    this.#expectedNetworkError = null;
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 10_000) {
    const id = this.#nextId++;
    return new Promise((resolveCommand, rejectCommand) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        rejectCommand(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolveCommand, reject: rejectCommand, method, timeout });
      this.#socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() { this.#socket.close(); }
}

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
}

async function closeServer(server) {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

const harness = visualRuntimeHarness();
const bootstrapSecret = generateWorkspaceOperatorBootstrapSecret();
const unavailableServer = createStudioHttpServer({
  studioService: new StudioService({ store: new InMemoryProjectStore() }),
});
await listen(unavailableServer);
const unavailableBase = `http://127.0.0.1:${unavailableServer.address().port}`;
const controller = new BackupOperationsController({
  runtime: harness.runtime,
  bootstrapSecret,
});
controller.start();
const server = createStudioHttpServer({
  studioService: new StudioService({ store: new InMemoryProjectStore() }),
  backupOperationsController: controller,
});
await listen(server);
const base = `http://127.0.0.1:${server.address().port}`;

const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--lang=en-US',
  '--force-device-scale-factor=1', '--window-size=1440,900', '--remote-debugging-port=0',
  '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profileDirectory}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const chromeClose = trackProcessClose(chrome);
let chromeDiagnostics = '';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data', (chunk) => { chromeDiagnostics += chunk; });

async function devtoolsUrl() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(chromeDiagnostics);
    if (match) return match[1];
    if (chromeClose.spawnError) throw chromeClose.spawnError;
    if (chromeClose.closed || chrome.exitCode !== null) break;
    await delay(20);
  }
  throw new Error(`Chrome DevTools did not start. ${chromeDiagnostics}`);
}

let devtools = null;
let captureError = null;
const observations = { schemaVersion: 1, candidateStatus: 'implemented candidate — not user accepted', screens: [] };
try {
  devtools = await DevTools.connect(await devtoolsUrl());
  const version = await devtools.send('Browser.getVersion');
  observations.browser = version.product;
  const { targetId } = await devtools.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await devtools.send('Target.attachToTarget', { targetId, flatten: true });
  await Promise.all([
    devtools.send('Page.enable', {}, sessionId),
    devtools.send('Runtime.enable', {}, sessionId),
    devtools.send('Log.enable', {}, sessionId),
    devtools.send('Accessibility.enable', {}, sessionId),
  ]);

  const evaluate = async (expression) => {
    const result = await devtools.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    if (result.exceptionDetails) throw new Error('Browser evaluation failed.');
    return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    throw new Error(`${label} did not become ready.`);
  };
  const setViewport = async (width) => {
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
      screenWidth: width, screenHeight: 900,
    }, sessionId);
    await delay(100);
  };
  const capture = async (state, width, focusSelector = '[data-backup-workspace]') => {
    await setViewport(width);
    await evaluate(`document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({ block: 'center' })`);
    await delay(80);
    const layout = await evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify(focusSelector)});
      const rect = target?.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('[data-backup-workspace] button')]
        .map((button) => ({ name: button.textContent.trim(), disabled: button.disabled }));
      return {
        state: ${JSON.stringify(state)}, width: innerWidth, height: innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
        candidate: document.querySelector('.backup-candidate-note')?.textContent,
        heading: target?.querySelector('h2')?.textContent ?? null,
        targetVisible: Boolean(rect && rect.bottom > 0 && rect.top < innerHeight && rect.right <= innerWidth),
        buttons,
      };
    })()`);
    assert(layout.width === width && layout.height === 900, `${state} viewport differs from ${width}x900.`);
    assert(layout.horizontalOverflow === false, `${state} overflows horizontally at ${width}px.`);
    assert(layout.candidate === 'implemented candidate — not user accepted', `${state} lacks candidate status.`);
    assert(layout.targetVisible, `${state} target is not visible at ${width}px.`);
    const screenshot = await devtools.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    }, sessionId, 20_000);
    await writeFile(resolve(outputDirectory, `${state}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    observations.screens.push(layout);
  };

  await setViewport(1440);
  devtools.armExpectedNetworkError({
    label: 'unavailable-backups-404',
    url: `${unavailableBase}/api/backups`,
    textPattern: /server responded with a status of 404\b/,
  });
  await devtools.send('Page.navigate', { url: `${unavailableBase}/#backups` }, sessionId);
  await waitFor("document.querySelector('.backup-safety h2')?.textContent === 'Backups are unavailable.'", 'Unavailable backup workspace');
  await delay(100);
  devtools.disarmExpectedNetworkError('unavailable-backups-404');
  await capture('unavailable', 1440, '.backup-safety');
  await capture('unavailable', 1060, '.backup-safety');

  await setViewport(1440);
  devtools.armExpectedNetworkError({
    label: 'locked-backups-401',
    url: `${base}/api/backups`,
    textPattern: /server responded with a status of 401\b/,
  });
  await devtools.send('Page.navigate', { url: `${base}/#backups` }, sessionId);
  await waitFor("Boolean(document.querySelector('[data-backup-unlock-form]'))", 'Locked backup workspace');
  await delay(100);
  devtools.disarmExpectedNetworkError('locked-backups-401');
  await capture('locked', 1440, '[data-backup-unlock-form]');
  await capture('locked', 1060, '[data-backup-unlock-form]');

  await setViewport(1440);
  await evaluate(`(() => {
    const form = document.querySelector('[data-backup-unlock-form]');
    const input = form.elements.bootstrapSecret;
    input.value = ${JSON.stringify(bootstrapSecret)};
    form.requestSubmit();
  })()`);
  await waitFor("Boolean(document.querySelector('.backup-create')) && !document.querySelector('[data-backup-unlock-form]')", 'Unlocked empty backup workspace');
  const secretCleared = await evaluate(`!document.documentElement.outerHTML.includes(${JSON.stringify(bootstrapSecret)})
    && !document.querySelector('input[name="bootstrapSecret"]')`);
  assert(secretCleared, 'The bootstrap secret remained in the post-submit DOM.');
  await capture('empty', 1440, '.backup-create');
  await capture('empty', 1060, '.backup-create');

  await setViewport(1440);
  await devtools.send('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/backups/operations', requestStage: 'Response' }],
  }, sessionId);
  const lostResponsePause = devtools.waitForEvent('Fetch.requestPaused');
  await evaluate(`document.querySelector('[data-backup-operation-kind="CREATE"]').click()`);
  const paused = await lostResponsePause;
  assert(paused.params.responseStatusCode === 202, 'The simulated lost response was not durably accepted.');
  devtools.armExpectedNetworkError({
    label: 'accepted-operation-abort',
    url: `${base}/api/backups/operations`,
    textPattern: /Failed to load resource: net::ERR_ABORTED\b/,
  });
  await devtools.send('Fetch.failRequest', {
    requestId: paused.params.requestId,
    errorReason: 'Aborted',
  }, sessionId);
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'Backup request saved. Waiting to start.'", 'Queued backup operation');
  await delay(100);
  devtools.disarmExpectedNetworkError('accepted-operation-abort');
  await capture('queued', 1440, '.backup-operation');
  await capture('queued', 1060, '.backup-operation');

  await devtools.send('Fetch.disable', {}, sessionId);
  await waitFor("document.querySelector('[data-backup-operation-kind=\"CREATE\"]')?.disabled === false", 'Create replay control');
  await evaluate(`document.querySelector('[data-backup-operation-kind="CREATE"]').click()`);
  await waitFor("document.querySelector('[data-backup-operation-kind=\"CREATE\"]')?.disabled === false", 'Create replay result');
  assert(harness.requestAttempts === 2 && harness.operationCount === 1,
    'Lost-response replay created a second durable operation.');
  observations.lostResponseReplay = { requestAttempts: 2, durableOperations: 1 };

  harness.releaseQueued();
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'Copying protected files'", 'Running backup operation');
  await capture('running', 1440, '.backup-operation');
  await capture('running', 1060, '.backup-operation');

  harness.releaseCreate();
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor(`Boolean(document.querySelector('[data-backup-select="backup.visual.1"]'))`, 'Completed backup list');

  await evaluate(`document.querySelector('[data-backup-operation-kind="CREATE"]').focus()`);
  await devtools.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
  }, sessionId);
  await devtools.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
  }, sessionId);
  const keyboardFocus = await evaluate(`({
    key: document.activeElement?.dataset.backupFocusKey ?? null,
    visible: document.activeElement?.matches(':focus-visible') ?? false,
  })`);
  assert(keyboardFocus.key && keyboardFocus.visible, 'Keyboard navigation lacks a visible bounded focus target.');
  observations.keyboard = { boundedFocusTarget: true, focusVisible: true };

  const listContinuity = await evaluate(`(() => {
    const list = document.querySelector('[data-backup-scroll]');
    document.querySelector('[data-backup-select="backup.visual.8"]').focus();
    list.scrollTop = 180;
    return { scrollTop: list.scrollTop, focusKey: document.activeElement.dataset.backupFocusKey };
  })()`);
  assert(listContinuity.scrollTop > 0, 'The visual backup list did not become scrollable.');
  harness.advanceCompatibleProjection('2026-08-30T12:00:05.000Z');
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor(`document.activeElement?.dataset.backupFocusKey === ${JSON.stringify(listContinuity.focusKey)}
    && document.querySelector('[data-backup-scroll]')?.scrollTop === ${listContinuity.scrollTop}`, 'Compatible backup-list refresh continuity');
  observations.listRefresh = {
    focusRetained: true,
    scrollRetained: true,
    scrollTop: listContinuity.scrollTop,
  };
  await capture('completed-list', 1440, '.backup-list');
  await capture('completed-list', 1060, '.backup-list');

  await evaluate(`document.querySelector('[data-backup-select="backup.visual.1"]').click()`);
  await waitFor("document.querySelector('.backup-detail h2')?.textContent === 'Backup complete and verified.'", 'Verified backup detail');
  await capture('verified', 1440, '.backup-detail');
  await capture('verified', 1060, '.backup-detail');

  harness.showRecoveryPassed();
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'Recovery test passed.'", 'Recovery-test result');
  await capture('recovery-passed', 1440, '.backup-operation');
  await capture('recovery-passed', 1060, '.backup-operation');

  harness.showFailure();
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'Backup action did not complete.'", 'Failed backup operation');
  await capture('failed', 1440, '.backup-operation');
  await capture('failed', 1060, '.backup-operation');

  harness.showInterrupted();
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'The interrupted action could not be resumed safely.'", 'Interrupted backup operation');
  await capture('interrupted', 1440, '.backup-operation');
  await capture('interrupted', 1060, '.backup-operation');

  harness.setBackupHealth('UNVERIFIED');
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-detail h2')?.textContent === 'This backup has not been verified yet.'", 'Unverified backup detail');
  await capture('verification-required', 1440, '.backup-detail');
  await capture('verification-required', 1060, '.backup-detail');

  harness.setBackupHealth('SUSPECT');
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-detail h2')?.textContent.includes('needs attention')", 'Damaged backup detail');
  const damagedActions = await evaluate(`(() => {
    const action = (kind) => document.querySelector('[data-backup-operation-kind="' + kind + '"]');
    return { verify: action('VERIFY').disabled, recovery: action('RECOVERY_TEST').disabled, restore: action('RESTORE_AS_COPY').disabled };
  })()`);
  assert(damagedActions.verify === false && damagedActions.recovery === true && damagedActions.restore === true,
    'Damaged backup action gates are incorrect.');
  await capture('damaged-suspect', 1440, '.backup-detail');
  await capture('damaged-suspect', 1060, '.backup-detail');

  harness.setBackupHealth('MISSING');
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor(`document.querySelector('.backup-detail .status-pill')?.textContent === 'Missing'`, 'Missing backup detail');
  await capture('damaged-missing', 1440, '.backup-detail');
  await capture('damaged-missing', 1060, '.backup-detail');

  await setViewport(1440);
  await evaluate(`(() => {
    const details = document.querySelector('.backup-detail [data-backup-disclosure-key]');
    details.open = true;
    details.querySelector('summary').focus();
  })()`);
  harness.advanceCompatibleProjection('2026-08-30T12:00:09.000Z');
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor(`document.activeElement?.dataset.backupFocusKey === 'backup-backup.visual.1-summary'
    && document.querySelector('.backup-detail [data-backup-disclosure-key]')?.open === true`, 'Compatible passive refresh continuity');
  observations.compatibleRefresh = { focusRetained: true, disclosureRetained: true, selectionRetained: true };

  harness.restoreReady();
  await evaluate("document.getElementById('refresh-button').click()");
  await waitFor("document.querySelector('.backup-operation h2')?.textContent === 'Restored copy is ready for inspection.'", 'Restored copy status');
  const restoredTruth = await evaluate(`document.querySelector('.backup-operation')?.textContent.includes('It is not active.')
    && document.querySelector('.backup-detail')?.textContent.includes('Recovery test passed.')`);
  assert(restoredTruth, 'Restored-copy and recovery-test status are not both explicit.');
  await capture('restored-copy', 1440, '.backup-operation');
  await capture('restored-copy', 1060, '.backup-operation');

  const accessibility = await devtools.send('Accessibility.getFullAXTree', {}, sessionId);
  const names = accessibility.nodes.map((node) => node.name?.value).filter(Boolean);
  for (const required of ['Create backup now', 'Verify again', 'Test recovery', 'Restore as a new working copy']) {
    assert(names.includes(required), `Accessibility tree lacks ${required}.`);
  }
  assert(names.every((name) => !/delete backup|activate copy|remote backup/i.test(name)),
    'Accessibility tree contains an out-of-scope backup action.');
  observations.accessibility = { requiredActionsPresent: true, forbiddenActionsAbsent: true };
  observations.browserErrors = devtools.errors.length;
  observations.expectedNetworkErrors = devtools.expectedNetworkErrors;
  assert(devtools.errors.length === 0, 'Browser emitted an unexpected exception or log error.');

  const serialized = `${JSON.stringify(observations, null, 2)}\n`;
  assert(!serialized.includes(bootstrapSecret), 'Evidence observation contains the bootstrap secret.');
  assert(!/numberdroid_backup_operator=|databaseSha256|\/tmp\//.test(serialized),
    'Evidence observation contains a token or raw path field.');
  await writeFile(resolve(outputDirectory, 'observation.json'), serialized, 'utf8');
} catch (error) {
  captureError = error;
} finally {
  await finishCapture(captureError, [
    () => closeBrowserAndRemoveProfile({
      child: chrome,
      trackedClose: chromeClose,
      requestBrowserClose: () => devtools?.send('Browser.close', {}, undefined, 2_000),
      closeConnection: () => devtools?.close(),
      removeProfile: () => rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
    }),
    () => closeServer(unavailableServer),
    () => closeServer(server),
    () => controller.close(),
  ]);
}

assert(harness.closed, 'Visual runtime did not close.');
