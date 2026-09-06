import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { decodeSupportedPng } from '../packages/preview/src/index.js';

const [chromePath, widthArgument, outputArgument, pageUrl, mode = 'candidate', domArgument] = process.argv.slice(2);
if (!chromePath || !widthArgument || !outputArgument || !pageUrl || !['baseline', 'candidate', 'checkpoint-2a', 'checkpoint-2b', 'checkpoint-2c', 'checkpoint-3', 'checkpoint-4', 'checkpoint-4-5', 'a1-7', 'review-feedback'].includes(mode)) {
  throw new Error('Usage: capture-studio-browser-evidence.js CHROME WIDTH OUTPUT URL baseline|candidate|checkpoint-2a|checkpoint-2b|checkpoint-2c|checkpoint-3|checkpoint-4|checkpoint-4-5|a1-7|review-feedback [DOM_OUTPUT]');
}
const width = Number(widthArgument);
const height = 900;
const FAMILY_HYGIENE_DIGEST = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
if (!Number.isInteger(width) || width < 800) throw new Error('WIDTH must be an integer of at least 800.');
const outputPath = resolve(outputArgument);
const domPath = domArgument ? resolve(domArgument) : null;
const observationPath = outputPath.replace(/\.png$/i, '.observation.json');
const expectedWorkspace = new URL(pageUrl).hash.slice(1) || 'overview';
const agentAccessEvidence = new URL(pageUrl).searchParams.get('visualFixture') === 'agent-access';
const checkpoint2aFocus = new URL(pageUrl).searchParams.get('visualFocus');
const checkpoint2bFocus = new URL(pageUrl).searchParams.get('visualFocus');
const checkpoint2cFocus = new URL(pageUrl).searchParams.get('visualFocus');
const checkpoint3Focus = new URL(pageUrl).searchParams.get('visualFocus');
const checkpoint4Focus = new URL(pageUrl).searchParams.get('visualFocus') ?? 'conflict';
const checkpoint45Focus = new URL(pageUrl).searchParams.get('visualFocus') ?? 'irregular';
const checkpoint2cPhase = new URL(pageUrl).searchParams.get('visualPhase') ?? 'applied';
const profileDirectory = await mkdtemp(`${tmpdir()}/numberdroid-studio-chrome-`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--hide-scrollbars',
  '--lang=en-US',
  '--force-device-scale-factor=1',
  `--window-size=${width},${height}`,
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profileDirectory}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const chromeExited = new Promise((resolveExit) => {
  if (chrome.exitCode !== null) resolveExit(chrome.exitCode);
  else chrome.once('exit', resolveExit);
});

let chromeDiagnostics = '';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data', (chunk) => { chromeDiagnostics += chunk; });

async function devtoolsUrl() {
  return new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(() => rejectUrl(new Error(`Chrome DevTools did not start. ${chromeDiagnostics}`)), 10_000);
    const inspect = () => {
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(chromeDiagnostics);
      if (!match) return;
      clearTimeout(timeout);
      resolveUrl(match[1]);
    };
    chrome.stderr.on('data', inspect);
    chrome.once('exit', (code) => {
      clearTimeout(timeout);
      rejectUrl(new Error(`Chrome exited before DevTools started (${code}). ${chromeDiagnostics}`));
    });
    inspect();
  });
}

class DevTools {
  #socket;
  #nextId = 1;
  #pending = new Map();
  events = [];

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
        return;
      }
      this.events.push(message);
    });
    const failPending = () => {
      const error = new Error('Chrome DevTools connection closed with commands pending.');
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.#pending.clear();
    };
    socket.addEventListener('close', failPending);
    socket.addEventListener('error', failPending);
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 10_000) {
    const id = this.#nextId++;
    return new Promise((resolveCommand, rejectCommand) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        rejectCommand(new Error(`${method} did not complete within ${timeoutMs} milliseconds.`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolveCommand, reject: rejectCommand, method, timeout });
      try {
        this.#socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        clearTimeout(timeout);
        this.#pending.delete(id);
        rejectCommand(error);
      }
    });
  }

  close() {
    this.#socket.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

let devtools;
try {
  devtools = await DevTools.connect(await devtoolsUrl());
  const browserVersion = await devtools.send('Browser.getVersion');
  const { targetId } = await devtools.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await devtools.send('Target.attachToTarget', { targetId, flatten: true });
  await Promise.all([
    devtools.send('Page.enable', {}, sessionId),
    devtools.send('Runtime.enable', {}, sessionId),
    devtools.send('Network.enable', {}, sessionId),
    devtools.send('Log.enable', {}, sessionId),
    devtools.send('DOM.enable', {}, sessionId),
    devtools.send('Accessibility.enable', {}, sessionId),
    devtools.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
      screenWidth: width, screenHeight: height,
    }, sessionId),
  ]);
  await devtools.send('Page.navigate', { url: pageUrl }, sessionId);

  const readyExpression = mode === 'review-feedback'
    ? `document.getElementById('connection-label')?.textContent === 'Live'
       && document.getElementById('workspace-content')?.dataset.renderedProjectId === 'project.review-feedback'
       && document.getElementById('workspace-content')?.dataset.renderedWorkspace === 'tasks'`
    : mode === 'candidate'
    ? `document.documentElement.dataset.visualEvidenceReady === 'true'
       && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
       && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-demo'
       && document.documentElement.dataset.visualRevision === '7'
       && document.documentElement.dataset.visualActivityCount === '7'
       && document.documentElement.dataset.visualConnectionState === 'Live'`
    : mode === 'checkpoint-2a'
      ? `document.documentElement.dataset.visualEvidenceReady === 'true'
         && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
         && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-2a'
         && document.documentElement.dataset.visualRevision === '4'
         && document.documentElement.dataset.visualActivityCount === '5'
         && document.documentElement.dataset.visualConnectionState === 'Live'`
      : mode === 'checkpoint-2b'
        ? `document.documentElement.dataset.visualEvidenceReady === 'true'
           && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
           && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-2b'
           && document.documentElement.dataset.visualRevision === '7'
           && document.documentElement.dataset.visualActivityCount === '7'
           && document.documentElement.dataset.visualConnectionState === 'Live'`
        : mode === 'checkpoint-2c'
          ? `document.documentElement.dataset.visualEvidenceReady === 'true'
             && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
             && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-2c'
             && document.documentElement.dataset.visualRevision === ${JSON.stringify(checkpoint2cPhase === 'pending' ? '9' : '11')}
             && document.documentElement.dataset.visualActivityCount === ${JSON.stringify(checkpoint2cPhase === 'pending' ? '9' : '12')}
             && document.documentElement.dataset.visualConnectionState === 'Live'`
        : mode === 'checkpoint-3'
          ? `document.documentElement.dataset.visualEvidenceReady === 'true'
             && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
             && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-2c'
             && document.documentElement.dataset.visualRevision === '26'
             && document.documentElement.dataset.visualActivityCount === '27'
             && document.documentElement.dataset.visualConnectionState === 'Live'`
          : mode === 'checkpoint-4'
            ? `document.documentElement.dataset.visualEvidenceReady === 'true'
               && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
               && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-4'
               && document.documentElement.dataset.visualRevision === '6'
               && document.documentElement.dataset.visualActivityCount === '6'
               && document.documentElement.dataset.visualConnectionState === 'Live'`
            : mode === 'checkpoint-4-5'
              ? `document.documentElement.dataset.visualEvidenceReady === 'true'
                 && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
                 && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-checkpoint-2c'
                 && document.documentElement.dataset.visualRevision === ${JSON.stringify(checkpoint45Focus === 'shape-conflict' && width === 1060 ? '38' : '37')}
                 && document.documentElement.dataset.visualActivityCount === ${JSON.stringify(checkpoint45Focus === 'shape-conflict' && width === 1060 ? '39' : '38')}
                 && document.documentElement.dataset.visualConnectionState === 'Live'`
              : mode === 'a1-7'
                ? `document.documentElement.dataset.visualEvidenceReady === 'true'
                   && document.documentElement.dataset.visualWorkspace === ${JSON.stringify(expectedWorkspace)}
                   && document.documentElement.dataset.visualProjectId === 'numberdroid-studio-a1-7'
                   && document.documentElement.dataset.visualRevision === '2'
                   && document.documentElement.dataset.visualActivityCount === '2'
                   && document.documentElement.dataset.visualConnectionState === 'Live'`
          : `document.getElementById('connection-label')?.textContent === 'Live'
         && document.getElementById('revision-label')?.textContent === 'Revision 5'
         && document.querySelector(${JSON.stringify(`[data-workspace="${expectedWorkspace}"]`)})?.classList.contains('active')`;
  const readyDeadline = Date.now() + 15_000;
  let ready = false;
  while (Date.now() < readyDeadline) {
    const result = await devtools.send('Runtime.evaluate', {
      expression: readyExpression,
      returnByValue: true,
    }, sessionId);
    if (result.result?.value === true) {
      ready = true;
      break;
    }
    await delay(100);
  }
  assert(ready, `${mode} ${expectedWorkspace} did not reach screenshot readiness.`);
  let sourceFileRefreshRetention = null;
  let sourceFileResumeTransition = null;
  let sourceImportOperationIsolation = null;
  let sourceImportSyntheticEventRange = null;
  let sourceIdPatternValidity = null;
  let checkpoint2aSourceFocusBeforeLayout = null;
  let checkpoint2aSourceFocusFinal = null;
  let checkpoint2cInteractionEvidence = null;
  let checkpoint3RoomContinuity = null;
  let checkpoint4TaskFocus = null;
  let checkpoint45RoomFocus = null;
  let checkpoint45PhysicalPaint = null;
  let checkpoint45EditorContinuity = null;
  let checkpoint45FindingsNavigation = null;
  let checkpoint45DirectManipulation = null;
  let checkpoint45StudioPreview = null;
  let a17Evidence = null;
  const focusCheckpoint2aSourceTarget = async (phase) => {
    if (mode !== 'checkpoint-2a' || expectedWorkspace !== 'sources') return null;
    const focus = checkpoint2aFocus ?? 'intake-form';
    const evaluatedFocus = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const focus = ${JSON.stringify(checkpoint2aFocus ?? 'intake-form')};
        const target = focus === 'staged-intake'
          ? document.querySelector('.staged-source-intakes [data-resume-source-intake]')?.closest('li')
          : focus === 'approved-source'
            ? document.querySelector('[data-source-id="source.family-hygiene-approved"] .source-preview-frame')
            : document.querySelector('[data-source-intake-form]');
        if (!target) return { phase: ${JSON.stringify(phase)}, focus, exists: false, visible: false };
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const rect = target.getBoundingClientRect();
        return {
          phase: ${JSON.stringify(phase)},
          focus,
          exists: true,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            right: rect.right, bottom: rect.bottom },
          viewport: { width: innerWidth, height: innerHeight },
          scrollY,
          visible: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const observation = evaluatedFocus.result?.value ?? null;
    assert(observation?.exists === true && observation.visible === true,
      `Checkpoint 2A ${focus} focus was not fully contained ${phase}: ${JSON.stringify(observation)}`);
    return observation;
  };
  if (mode === 'checkpoint-2b' && expectedWorkspace === 'sources') {
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-open-cutter="source.family-hygiene-approved"]')?.click()`,
      returnByValue: true,
    }, sessionId);
    let cutterReady = false;
    const cutterDeadline = Date.now() + 15_000;
    while (Date.now() < cutterDeadline) {
      const result = await devtools.send('Runtime.evaluate', {
        expression: `document.querySelectorAll('[data-cutter-overlay] g').length === 4
          && document.querySelectorAll('[data-rectangle-row]').length === 4
          && document.querySelector('.cutter-canvas img')?.complete
          && document.querySelector('.cutter-canvas img')?.naturalWidth === 1254
          && document.querySelector('.cutter-canvas img')?.naturalHeight === 1254
          && document.querySelectorAll('.slice-preview-grid.committed .slice-preview').length === 4
          && [...document.querySelectorAll('.slice-preview-grid.committed img')]
            .every((image) => image.complete && image.naturalWidth === 622 && image.naturalHeight === 622)
          && document.querySelector('.cutter-job-status')?.textContent.includes('APPLIED')`,
        returnByValue: true,
      }, sessionId);
      if (result.result?.value === true) {
        cutterReady = true;
        break;
      }
      await delay(100);
    }
    assert(cutterReady, 'Checkpoint 2B cutter did not load its exact rectangles, APPLIED job, and committed previews.');
    const focusSelector = checkpoint2bFocus === 'committed-slices'
      ? '.slice-preview-grid.committed'
      : checkpoint2bFocus === 'rectangle-inspector'
        ? '.rectangle-inspector'
        : '.cutter-scroll';
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({ block: 'center' })`,
      returnByValue: true,
    }, sessionId);
  }
  if (mode === 'checkpoint-2c' && expectedWorkspace === 'assets') {
    if (checkpoint2cPhase === 'pending') {
      const setup = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const items = [...document.querySelectorAll('[data-proposal-item]')];
          const item = items.at(-1);
          const disposition = item?.querySelector('[data-proposal-disposition]');
          if (!item || !disposition) return { ready: false };
          disposition.value = 'REJECTED';
          disposition.dispatchEvent(new Event('change', { bubbles: true }));
          const currentItem = [...document.querySelectorAll('[data-proposal-item]')].at(-1);
          const reason = currentItem?.querySelector('[data-proposal-reason]');
          const scroller = document.querySelector('[data-asset-scroll="proposal-items"]');
          if (!reason || !scroller) return { ready: false };
          reason.value = 'Evidence draft retained across passive refresh.';
          reason.dispatchEvent(new Event('input', { bubbles: true }));
          scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          reason.scrollIntoView({ block: 'center' });
          window.scrollBy(0, 120);
          reason.focus(); reason.setSelectionRange(9, 14);
          return {
            ready: true,
            reasonNode: reason,
            value: reason.value,
            selectionStart: reason.selectionStart,
            selectionEnd: reason.selectionEnd,
            localScrollTop: scroller.scrollTop,
            pageScrollY: scrollY,
            startedAt: performance.now(),
          };
        })()`,
        returnByValue: false,
      }, sessionId);
      assert(setup.result?.objectId, 'Checkpoint 2C could not prepare the focused dirty decision draft.');
      await devtools.send('Runtime.evaluate', {
        expression: `document.getElementById('refresh-button')?.click()`, returnByValue: true,
      }, sessionId);
      await delay(6_250);
      await devtools.send('Runtime.evaluate', {
        expression: `document.getElementById('refresh-button')?.click()`, returnByValue: true,
      }, sessionId);
      await delay(6_250);
      const retained = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const item = [...document.querySelectorAll('[data-proposal-item]')].at(-1);
          const reason = item?.querySelector('[data-proposal-reason]');
          const scroller = document.querySelector('[data-asset-scroll="proposal-items"]');
          return {
            elapsedMs: performance.now() - ${setup.result.description ? '0' : '0'},
            value: reason?.value ?? null,
            rejectionReason: item?.dataset.proposalRejectionReason ?? null,
            focused: document.activeElement === reason,
            selectionStart: reason?.selectionStart ?? null,
            selectionEnd: reason?.selectionEnd ?? null,
            localScrollTop: scroller?.scrollTop ?? null,
            pageScrollY: scrollY,
            proposalState: document.querySelector('[data-asset-proposal]')?.dataset.proposalState ?? null,
            revision: document.documentElement.dataset.visualRevision ?? null,
            errorCount: Number(document.documentElement.dataset.visualErrorCount ?? -1),
          };
        })()`,
        returnByValue: true,
      }, sessionId);
      checkpoint2cInteractionEvidence = retained.result?.value ?? null;
      assert(checkpoint2cInteractionEvidence?.value === 'Evidence draft retained across passive refresh.'
        && checkpoint2cInteractionEvidence.rejectionReason === checkpoint2cInteractionEvidence.value
        && checkpoint2cInteractionEvidence.focused === true
        && checkpoint2cInteractionEvidence.selectionStart === 9
        && checkpoint2cInteractionEvidence.selectionEnd === 14
        && checkpoint2cInteractionEvidence.localScrollTop > 0
        && checkpoint2cInteractionEvidence.pageScrollY > 0
        && checkpoint2cInteractionEvidence.proposalState === 'PENDING'
        && checkpoint2cInteractionEvidence.revision === '9'
        && checkpoint2cInteractionEvidence.errorCount === 0,
      `Checkpoint 2C dirty decision state did not survive two passive refreshes across 12.5 seconds: ${JSON.stringify(checkpoint2cInteractionEvidence)}`);
    } else {
      const focusSelector = checkpoint2cFocus === 'proposal'
        ? '[data-asset-proposal]'
        : '[data-asset-scroll="asset-inventory"]';
      await devtools.send('Runtime.evaluate', {
        expression: `document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({ block: 'center' })`,
        returnByValue: true,
      }, sessionId);
    }
  }
  if (mode === 'checkpoint-3' && expectedWorkspace === 'rooms') {
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]')?.click()`,
      returnByValue: true,
    }, sessionId);
    await devtools.send('Runtime.evaluate', {
      expression: 'new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))',
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const focusSelector = checkpoint3Focus === 'proposal' ? '[data-room-proposal]' : '.room-findings';
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({ block: 'center' })`,
      returnByValue: true,
    }, sessionId);
    const continuity = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const board = document.querySelector('[data-room-board]');
        const check = document.querySelector('[data-room-control="editor-panel"][data-editor-panel="check"]');
        check.focus(); check.click();
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const checked = {
          sameBoard: document.querySelector('[data-room-board]') === board,
          boardVisible: document.querySelector('[data-room-board]')?.getBoundingClientRect().width > 0,
          focusedPanel: document.activeElement?.dataset.roomFocusKey ?? null,
          lifecycle: document.querySelector('.room-lifecycle .status-pill')?.dataset.roomLifecycle ?? null,
          findingCount: document.querySelectorAll('.room-findings .asset-findings > li:not(.clear)').length,
        };
        const prop = document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]');
        prop.focus(); prop.click();
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        return { ...checked, returnedSameBoard: document.querySelector('[data-room-board]') === board, returnedTool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null };
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    checkpoint3RoomContinuity = continuity.result?.value ?? null;
  }
  if (mode === 'review-feedback') {
    const selected = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        document.querySelector('[data-task-control="select"][data-task-id="task.review-feedback"]')?.click();
        const deadline = Date.now() + 5_000;
        while (!document.querySelector('[data-task-feedback-summary]') && Date.now() < deadline) await new Promise((done) => setTimeout(done, 25));
        return Boolean(document.querySelector('[data-task-feedback-summary]'));
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId, 10_000);
    assert(selected.result?.value === true, 'The dedicated review-feedback task did not open.');
  }
  if (mode === 'checkpoint-4' && expectedWorkspace === 'tasks') {
    const focused = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const focus = ${JSON.stringify(checkpoint4Focus)};
        const state = focus === 'merged' ? 'MERGED' : focus === 'child' ? 'ANCESTOR_BLOCKED' : 'IN_REVIEW';
        const taskId = focus === 'merged' ? 'task.checkpoint-4.accepted'
          : focus === 'candidate' ? 'task.checkpoint-4.candidate'
            : focus === 'child' ? null : 'task.checkpoint-4.conflict';
        const navigate = async (workspace) => {
          location.hash = workspace;
          const deadline = Date.now() + 5_000;
          while (document.getElementById('workspace-content')?.dataset.renderedWorkspace !== workspace && Date.now() < deadline) {
            await new Promise((resolvePoll) => setTimeout(resolvePoll, 25));
          }
        };
        await navigate('overview');
        const overviewMetrics = Object.fromEntries([...document.querySelectorAll('.metric')].map((metric) => [
          metric.querySelector('small')?.textContent ?? '', metric.querySelector('strong')?.textContent ?? '',
        ]));
        const overviewAttention = [...document.querySelectorAll('.overview-attention-item')].map((item) => ({
          tone: item.dataset.tone ?? null, text: item.textContent,
        }));
        await navigate('tasks');
        const taskButtons = [...document.querySelectorAll('[data-task-control="select"]')];
        const target = [...document.querySelectorAll('[data-task-control="select"]')]
          .find((button) => focus === 'child'
            ? button.dataset.taskOrigin === 'TRUSTED_SERVICE_CHILD'
            : button.dataset.taskId === taskId);
        const list = document.querySelector('.task-list');
        const listHeader = document.querySelector('.task-list-header');
        const initialStates = taskButtons.map((button) => button.querySelector('[data-task-state]')?.dataset.taskState);
        const initialAttention = taskButtons.map((button) => {
          const badge = button.querySelector('[data-task-state]'); const badgeStyle = badge ? getComputedStyle(badge) : null;
          return {
            taskId: button.dataset.taskId ?? null,
            state: badge?.dataset.taskState ?? null,
            attention: button.dataset.taskAttention ?? null,
            text: button.textContent,
            badgeColor: badgeStyle?.color ?? null,
            badgeBackground: badgeStyle?.backgroundColor ?? null,
            borderLeftColor: getComputedStyle(button).borderLeftColor,
            borderLeftWidth: getComputedStyle(button).borderLeftWidth,
          };
        });
        const listContained = Boolean(list && listHeader && listHeader.getBoundingClientRect().right <= list.getBoundingClientRect().right
          && taskButtons.every((button) => {
            const badge = button.querySelector('[data-task-state]')?.getBoundingClientRect();
            const item = button.getBoundingClientRect();
            return badge && badge.height <= 40 && badge.left >= item.left && badge.right <= item.right;
          }));
        const createButton = document.querySelector('[data-task-control="open-create"]');
        let createKeyboardReachable = false;
        if (focus === 'create') {
          createButton?.focus(); createKeyboardReachable = document.activeElement === createButton; createButton?.click();
        } else {
          target?.click();
          const taskDetailDeadline = Date.now() + 6_000;
          while (document.querySelector('.task-detail [data-task-state]')?.dataset.taskState !== state
              && Date.now() < taskDetailDeadline) {
            await new Promise((resolvePoll) => setTimeout(resolvePoll, 25));
          }
        }
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const detail = document.querySelector('.task-detail');
        const composer = document.querySelector('.task-composer');
        const review = document.querySelector('.task-review');
        const merge = document.querySelector('[data-task-control="merge"]');
        let createRefreshEvidence = null;
        if (focus === 'create' && composer) {
          try {
          const form = composer.querySelector('[data-task-form="create"]');
          const titleField = form.querySelector('input[name="title"]');
          const agentField = form.querySelector('input[name="agentId"]');
          const objectiveField = form.querySelector('textarea[name="objective"]');
          const maxCommandsField = form.querySelector('input[name="maxCommands"]');
          const expiryField = form.querySelector('input[name="expiryHours"]');
          const capabilityField = form.querySelector('input[value="room.variant.validate"]');
          const autoAcceptField = form.querySelector('input[name="autoAccept"]');
          titleField.value = 'Refresh-safe task draft';
          agentField.value = 'studio.refresh-safe.agent';
          objectiveField.value = 'Keep this complete task draft intact across passive refreshes.';
          maxCommandsField.value = '27';
          expiryField.value = '7';
          capabilityField.checked = true;
          autoAcceptField.checked = true;
          composer.scrollIntoView({ block: 'center', inline: 'nearest' });
          window.scrollBy(0, 120);
          objectiveField.focus(); objectiveField.setSelectionRange(9, 17);
          const beforeScroll = { x: window.scrollX, y: window.scrollY };
          const runPassiveRefresh = async () => {
            const refreshButton = document.getElementById('refresh-button');
            refreshButton.click();
            const deadline = Date.now() + 10_000;
            while (refreshButton.disabled && Date.now() < deadline) {
              await new Promise((resolvePoll) => setTimeout(resolvePoll, 50));
            }
            if (refreshButton.disabled) throw new Error('The visible passive refresh did not settle.');
          };
          await new Promise((resolveWait) => setTimeout(resolveWait, 5_100));
          await runPassiveRefresh();
          const firstRefreshPreserved = document.querySelector('.task-composer') === composer
            && document.querySelector('[data-task-form="create"]') === form
            && document.activeElement === objectiveField;
          const projectId = document.getElementById('workspace-content').dataset.renderedProjectId;
          const concurrentChangeExercised = ${width === 1060};
          let concurrentTaskId = null;
          if (concurrentChangeExercised) {
            const externalSession = await fetch('/api/ui-session').then((response) => response.json());
            const concurrentToken = crypto.randomUUID();
            concurrentTaskId = 'task.visual.refresh.' + concurrentToken;
            const concurrentResponse = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/tasks', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-numberdroid-studio-csrf': externalSession.csrfToken,
              },
              body: JSON.stringify({ task: {
                taskId: concurrentTaskId,
                branchId: 'branch.task.visual.refresh.' + concurrentToken,
                agentId: 'studio.concurrent.agent',
                title: 'Concurrent task list update',
                objective: 'Prove that a same-project update does not replace an open task composer.',
                capabilities: ['project.read'],
                objectScopes: [{ kind: 'project', id: projectId }],
                budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
              } }),
            });
            const concurrentResult = await concurrentResponse.json();
            if (!concurrentResponse.ok) {
              const error = new Error(concurrentResult.error?.message ?? 'Concurrent task creation failed.');
              error.code = concurrentResult.error?.code;
              throw error;
            }
          }
          await new Promise((resolveWait) => setTimeout(resolveWait, 5_100));
          await runPassiveRefresh();
          const refreshedTaskList = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/tasks')
            .then((response) => response.json());
          const currentComposer = document.querySelector('.task-composer');
          const currentForm = currentComposer?.querySelector('[data-task-form="create"]');
          const currentTitleField = currentForm?.querySelector('input[name="title"]');
          const currentAgentField = currentForm?.querySelector('input[name="agentId"]');
          const currentObjectiveField = currentForm?.querySelector('textarea[name="objective"]');
          const currentMaxCommandsField = currentForm?.querySelector('input[name="maxCommands"]');
          const currentExpiryField = currentForm?.querySelector('input[name="expiryHours"]');
          const currentCapabilityField = currentForm?.querySelector('input[value="room.variant.validate"]');
          const currentAutoAcceptField = currentForm?.querySelector('input[name="autoAccept"]');
          createRefreshEvidence = {
            firstRefreshPreserved,
            concurrentChangeExercised,
            serverStateMatched: concurrentChangeExercised
              ? refreshedTaskList.tasks.some((task) => task.taskId === concurrentTaskId)
                && document.getElementById('revision-label').textContent === 'Revision 7'
                && document.getElementById('activity-count').textContent === '7'
              : refreshedTaskList.tasks.length === 4
                && document.getElementById('revision-label').textContent === 'Revision 6'
                && document.getElementById('activity-count').textContent === '6',
            sameComposer: currentComposer === composer,
            sameForm: currentForm === form,
            sameField: currentObjectiveField === objectiveField && currentObjectiveField?.isConnected === true,
            title: currentTitleField?.value ?? null,
            agentId: currentAgentField?.value ?? null,
            objective: currentObjectiveField?.value ?? null,
            maxCommands: currentMaxCommandsField?.value ?? null,
            expiryHours: currentExpiryField?.value ?? null,
            capabilityChecked: currentCapabilityField?.checked ?? null,
            autoAcceptChecked: currentAutoAcceptField?.checked ?? null,
            focused: document.activeElement === currentObjectiveField,
            selectionStart: currentObjectiveField?.selectionStart ?? null,
            selectionEnd: currentObjectiveField?.selectionEnd ?? null,
            scrollUnchanged: window.scrollX === beforeScroll.x && window.scrollY === beforeScroll.y,
          };
          } catch (error) {
            createRefreshEvidence = {
              runtimeErrorCode: error?.code ?? null,
              runtimeErrorMessage: error?.message ?? String(error),
              runtimeErrorStack: error?.stack ?? null,
            };
          }
        }
        let mergeConfirmCalls = 0;
        if (focus === 'conflict' && merge) {
          const originalConfirm = window.confirm;
          window.confirm = () => { mergeConfirmCalls += 1; return false; };
          merge.click();
          window.confirm = originalConfirm;
        }
        (focus === 'create' ? composer : focus === 'merged' ? detail : review)?.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
        return {
          focus,
          found: focus === 'create' ? Boolean(composer) : Boolean(target),
          selectedState: document.querySelector('.task-detail [data-task-state]')?.dataset.taskState ?? null,
          taskCount: taskButtons.length,
          initialStates,
          initialAttention,
          overviewMetrics,
          overviewAttention,
          listContained,
          conflictCount: document.querySelectorAll('.task-conflict-items small').length,
          conflictSummaryText: document.querySelector('.task-conflict-summary')?.textContent ?? null,
          conflictInlineMetaCount: document.querySelectorAll('.task-conflict-items .task-inline-meta, .task-conflict-items small').length,
          conflictActionConsequenceCount: document.querySelectorAll('.task-review-actions .task-action-consequence').length,
          timelineTechnicalDisclosureCount: document.querySelectorAll('.task-timeline details').length,
          reviewTechnicalDisclosureCount: document.querySelectorAll('.task-review-items details').length,
          statusBadgeText: document.querySelector('.task-detail [data-task-state]')?.textContent ?? null,
          reviewItemCount: document.querySelectorAll('.task-review-items li').length,
          timelineCount: document.querySelectorAll('.task-timeline li').length,
          hasMerge: Boolean(merge),
          hasDecide: Boolean(document.querySelector('[data-task-control="decide"]')),
          dispositionSelectCount: document.querySelectorAll('[data-task-review-disposition]').length,
          readonlyDispositionText: document.querySelector('.task-review-disposition-readonly')?.textContent ?? null,
          mergeDisabled: merge?.disabled ?? null,
          mergeConfirmCalls,
          hasRevert: Boolean(document.querySelector('[data-task-control="revert"]')),
          detailVisible: Boolean(detail && detail.getBoundingClientRect().bottom > 0 && detail.getBoundingClientRect().top < innerHeight),
          selectedOrigin: detail?.dataset.taskOrigin ?? null,
          authorityLineageText: detail?.querySelector('[data-task-authority-lineage]')?.textContent ?? null,
          processingAdoptionSectionCount: detail?.querySelectorAll('[data-processing-adoption]').length ?? 0,
          taskActionCount: detail?.querySelectorAll('.task-controls [data-task-control]').length ?? 0,
          reviewVisible: Boolean(review && review.getBoundingClientRect().bottom > 0 && review.getBoundingClientRect().top < innerHeight),
          createVisible: Boolean(composer && composer.getBoundingClientRect().bottom > 0 && composer.getBoundingClientRect().top < innerHeight),
          createFieldCount: composer?.querySelectorAll('input, textarea').length ?? 0,
          createKeyboardReachable,
          createRefreshEvidence,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId, checkpoint4Focus === 'create' ? 30_000 : 10_000);
    checkpoint4TaskFocus = focused.result?.value ?? null;
    assert(checkpoint4TaskFocus?.found === true && checkpoint4TaskFocus.taskCount === 4,
      `Checkpoint 4 could not focus the requested task evidence: ${JSON.stringify(checkpoint4TaskFocus)}`);
  }
  if (mode === 'checkpoint-4-5' && expectedWorkspace === 'rooms') {
    const focused = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const focus = ${JSON.stringify(checkpoint45Focus)};
        const roomId = focus === 'rectangle' ? 'hall.service-east-west' : 'room.family-gathering';
        const navigate = async (workspace) => {
          location.hash = workspace;
          const deadline = Date.now() + 5_000;
          while (document.getElementById('workspace-content')?.dataset.renderedWorkspace !== workspace && Date.now() < deadline) {
            await new Promise((resolvePoll) => setTimeout(resolvePoll, 25));
          }
        };
        await navigate('overview');
        const overviewMetrics = Object.fromEntries([...document.querySelectorAll('.metric')].map((metric) => [
          metric.querySelector('small')?.textContent ?? '', metric.querySelector('strong')?.textContent ?? '',
        ]));
        const roomAttention = [...document.querySelectorAll('.overview-attention-item')]
          .filter((item) => item.querySelector('[data-overview-open="room-findings"]'))
          .map((item) => ({ tone: item.dataset.tone ?? null, text: item.textContent }));
        let overviewOpenEvidence = null;
        if (focus === 'irregular') {
          const open = document.querySelector('[data-overview-open="room-findings"][data-room-variant-id="' + roomId + '"]');
          open.focus(); open.click();
          const deadline = Date.now() + 5_000;
          while (document.getElementById('workspace-content')?.dataset.renderedWorkspace !== 'rooms' && Date.now() < deadline) {
            await new Promise((resolvePoll) => setTimeout(resolvePoll, 25));
          }
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          overviewOpenEvidence = {
            activated: Boolean(open),
            workspace: document.getElementById('workspace-content')?.dataset.renderedWorkspace ?? null,
            roomId: document.querySelector('[data-room-variant-select]')?.value ?? null,
            panel: document.querySelector('[data-room-control="editor-panel"][data-selected="true"]')?.dataset.editorPanel ?? null,
            selectedFindingId: document.querySelector('.room-findings [data-selected="true"]')?.dataset.findingId ?? null,
            selectedFindingCount: document.querySelectorAll('.room-findings [data-selected="true"]').length,
            findingsVisible: document.querySelector('.room-findings')?.getBoundingClientRect().height > 0,
          };
        } else await navigate('rooms');
        const selector = document.querySelector('[data-room-variant-select]');
        if (selector.value !== roomId) {
          selector.value = roomId;
          selector.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        }
        const tool = focus === 'prop' ? 'PROP' : 'PAINT_ROOM';
        document.querySelector('[data-room-control="editor-tool"][data-editor-tool="' + tool + '"]')?.click();
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        if (focus === 'prop') {
          const paletteSelector = '[data-room-control="palette-asset"][data-palette-asset-id="asset.transfer-apparatus-cp45"]';
          const deadline = Date.now() + 10_000;
          while (document.querySelector(paletteSelector + ' .asset-preview.ready')?.dataset.previewState !== 'READY' && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          document.querySelector(paletteSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-asset-preview-rotation="90"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          window.__checkpoint45PropReady = await window.__numberdroidStudioVisualTest?.refreshVisualEvidence();
          document.querySelector('.room-placement-preview')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        } else if (focus === 'shape-refresh') {
          window.__checkpoint45Refresh = await window.__numberdroidStudioVisualTest?.exerciseRoomShapeRefresh();
          document.querySelector('.room-cell[data-x="1"][data-y="0"]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        } else if (focus === 'shape-conflict') {
          window.__checkpoint45Conflict = await window.__numberdroidStudioVisualTest?.exerciseRoomShapeConflict();
          document.querySelector('.room-shape-controls')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        } else {
          document.querySelector('.room-shape-controls')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
        return {
          focus,
          roomId: document.querySelector('[data-room-variant-select]')?.value ?? null,
          tool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null,
          editorToolCount: document.querySelectorAll('[data-room-control="editor-tool"]').length,
          cellCount: document.querySelectorAll('.room-cell').length,
          voidCount: document.querySelectorAll('.room-cell[data-cell-kind="VOID"]').length,
          blockedCount: document.querySelectorAll('.room-cell[data-cell-kind="BLOCKED"]').length,
          overviewMetrics,
          roomAttention,
          overviewOpenEvidence,
          selectedOptionText: document.querySelector('[data-room-variant-select] option:checked')?.textContent ?? null,
          errorBannerText: document.querySelector('.room-error-attention')?.textContent ?? null,
          errorBannerState: document.querySelector('.room-error-attention')?.dataset.roomErrorState ?? null,
          refresh: window.__checkpoint45Refresh ?? null,
          shapeDraftDirty: window.__numberdroidStudioVisualTest?.roomShapeState()?.dirty ?? false,
          shapeConflict: window.__numberdroidStudioVisualTest?.roomShapeState()?.conflict ?? null,
          propReady: window.__checkpoint45PropReady ?? null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    checkpoint45RoomFocus = focused.result?.value ?? null;
    assert(checkpoint45RoomFocus?.roomId && checkpoint45RoomFocus.editorToolCount === 8,
      `Checkpoint 4.5 could not focus the requested room evidence: ${JSON.stringify(checkpoint45RoomFocus)}`);
    if (checkpoint45Focus === 'prop') {
      const networkStart = devtools.events.length;
      const editorBeforePreviewResult = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const zoom = document.querySelector('[data-room-zoom-slider]');
          zoom.value = '1000'; zoom.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]')?.click();
          document.querySelector('.room-cell[data-x="1"][data-y="0"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const paletteSelector = '[data-room-control="palette-asset"][data-palette-asset-id="asset.transfer-apparatus-cp45"]';
          const deadline = Date.now() + 10_000;
          while (document.querySelector(paletteSelector + ' .asset-preview.ready')?.dataset.previewState !== 'READY' && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          document.querySelector(paletteSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-asset-preview-rotation="90"]')?.click();
          const placementPreview = await window.__numberdroidStudioVisualTest?.refreshVisualEvidence();
          let seededScrollKey = null;
          for (const element of document.querySelectorAll('[data-room-scroll]')) {
            const maxTop = element.scrollHeight - element.clientHeight;
            const maxLeft = element.scrollWidth - element.clientWidth;
            if (maxTop > 1) { element.scrollTop = Math.min(37, maxTop); seededScrollKey = element.dataset.roomScroll; break; }
            if (maxLeft > 1) { element.scrollLeft = Math.min(37, maxLeft); seededScrollKey = element.dataset.roomScroll; break; }
          }
          const control = document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]');
          control?.focus({ preventScroll: true });
          const scroll = Object.fromEntries([...document.querySelectorAll('[data-room-scroll]')]
            .map((element) => [element.dataset.roomScroll, { left: element.scrollLeft, top: element.scrollTop }]));
          return {
            activeKey: document.activeElement?.dataset.roomFocusKey ?? document.activeElement?.dataset.roomControl ?? null,
            scroll,
            page: { x: window.scrollX, y: window.scrollY },
            shape: window.__numberdroidStudioVisualTest?.roomShapeState() ?? null,
            seededScrollKey,
            nonZeroScrollKeys: Object.entries(scroll).filter(([, value]) => value.left > 0 || value.top > 0).map(([key]) => key),
            roomId: document.querySelector('[data-room-variant-select]')?.value ?? null,
            editorPresent: Boolean(document.querySelector('[data-room-board]')),
            placementPreview,
            selectedRotation: document.querySelector('[data-asset-preview-rotation][data-selected="true"]')?.dataset.assetPreviewRotation ?? null,
          };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const editorBeforePreview = editorBeforePreviewResult.result?.value;
      assert(editorBeforePreview?.activeKey === 'room-tool-PROP' && editorBeforePreview.editorPresent
        && editorBeforePreview.shape?.dirty === true && editorBeforePreview.nonZeroScrollKeys.length > 0
        && editorBeforePreview.placementPreview?.ready === 'true'
        && editorBeforePreview.placementPreview.loaded === true
        && editorBeforePreview.selectedRotation === '90',
        `Studio preview could not establish exact editor continuity state: ${JSON.stringify(editorBeforePreview)}`);
      await devtools.send('Page.bringToFront', {}, sessionId);
      const focusedPreview = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const button = document.querySelector('[data-room-view="preview"]');
          const root = document.getElementById('workspace-content');
          const events = [];
          const bubbles = [];
          const pageErrors = [];
          const onClick = (event) => {
            const view = event.target.closest?.('[data-room-view]');
            if (view) events.push({
              type: event.type,
              roomView: view.dataset.roomView ?? null,
              isTrusted: event.isTrusted,
              detail: event.detail,
              eventPhase: event.eventPhase,
              defaultPrevented: event.defaultPrevented,
              cancelBubble: event.cancelBubble,
            });
          };
          const onKey = (event) => {
            if (event.key !== 'Enter') return;
            const view = event.target.closest?.('[data-room-view]');
            events.push({
              type: event.type,
              key: event.key,
              code: event.code,
              repeat: event.repeat,
              isTrusted: event.isTrusted,
              roomView: view?.dataset.roomView ?? null,
            });
          };
          const onBubble = (event) => {
            const view = event.target.closest?.('[data-room-view]');
            if (view?.dataset.roomView !== 'preview') return;
            bubbles.push({
              rootPresent: Boolean(document.querySelector('[data-room-preview]')),
              previewPressed: document.querySelector('[data-room-view="preview"]')?.getAttribute('aria-pressed') ?? null,
              targetConnected: event.target.isConnected,
              defaultPrevented: event.defaultPrevented,
              cancelBubble: event.cancelBubble,
              renderedWorkspace: root?.dataset.renderedWorkspace ?? null,
              editorPresent: Boolean(document.querySelector('[data-room-board]')),
              activationState: window.__numberdroidStudioVisualTest?.roomPreviewActivationState() ?? null,
            });
          };
          const onWindowError = (event) => pageErrors.push({
            type: 'error', message: event.message, filename: event.filename,
            lineNumber: event.lineno, columnNumber: event.colno,
            description: event.error?.stack ?? event.error?.message ?? null,
          });
          const onUnhandledRejection = (event) => pageErrors.push({
            type: 'unhandledrejection',
            description: event.reason?.stack ?? event.reason?.message ?? String(event.reason),
          });
          window.__checkpoint45PreviewKeyboard = {
            root, events, bubbles, pageErrors, onClick, onKey, onBubble, onWindowError, onUnhandledRejection,
          };
          root?.addEventListener('click', onClick, true);
          root?.addEventListener('click', onBubble);
          document.addEventListener('keydown', onKey, true);
          document.addEventListener('keyup', onKey, true);
          window.addEventListener('error', onWindowError);
          window.addEventListener('unhandledrejection', onUnhandledRejection);
          button?.focus({ preventScroll: true });
          return {
            buttonFocused: Boolean(button && document.activeElement === button),
            buttonEnabled: Boolean(button && !button.disabled),
            documentFocused: document.hasFocus(),
            visibilityState: document.visibilityState,
            activationState: window.__numberdroidStudioVisualTest?.roomPreviewActivationState() ?? null,
          };
        })()`, returnByValue: true,
      }, sessionId);
      assert(focusedPreview.result?.value?.buttonFocused === true
        && focusedPreview.result.value.buttonEnabled === true
        && focusedPreview.result.value.documentFocused === true
        && focusedPreview.result.value.visibilityState === 'visible',
      `Studio preview view could not receive active-document keyboard focus: ${JSON.stringify(focusedPreview.result?.value)}`);
      const previewActivationRuntimeStart = devtools.events.length;
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r',
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      let previewActivation = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const observed = await devtools.send('Runtime.evaluate', {
          expression: `(() => ({
            events: window.__checkpoint45PreviewKeyboard?.events.map((event) => ({ ...event })) ?? [],
            bubbles: window.__checkpoint45PreviewKeyboard?.bubbles.map((bubble) => ({ ...bubble })) ?? [],
            pageErrors: window.__checkpoint45PreviewKeyboard?.pageErrors.map((error) => ({ ...error })) ?? [],
            rootPresent: Boolean(document.querySelector('[data-room-preview]')),
            previewPressed: document.querySelector('[data-room-view="preview"]')?.getAttribute('aria-pressed') ?? null,
            activationState: window.__numberdroidStudioVisualTest?.roomPreviewActivationState() ?? null,
          }))()`, returnByValue: true,
        }, sessionId);
        previewActivation = observed.result?.value ?? null;
        if (previewActivation?.events.some(({ type }) => type === 'click') && previewActivation.rootPresent) break;
        await delay(50);
      }
      const activationBrowserErrors = devtools.events.slice(previewActivationRuntimeStart)
        .filter(({ method, params }) => method === 'Runtime.exceptionThrown'
          || (method === 'Log.entryAdded' && params?.entry?.level === 'error'))
        .slice(-8)
        .map(({ method, params }) => method === 'Runtime.exceptionThrown'
          ? {
              method,
              text: params.exceptionDetails?.text ?? null,
              description: params.exceptionDetails?.exception?.description ?? null,
              url: params.exceptionDetails?.url ?? null,
              lineNumber: params.exceptionDetails?.lineNumber ?? null,
              columnNumber: params.exceptionDetails?.columnNumber ?? null,
            }
          : { method, text: params.entry?.text ?? null, url: params.entry?.url ?? null });
      previewActivation = { ...previewActivation, browserErrors: activationBrowserErrors };
      assert(previewActivation?.events.length === 3
        && previewActivation.events[0].type === 'keydown'
        && previewActivation.events[0].key === 'Enter'
        && previewActivation.events[0].code === 'Enter'
        && previewActivation.events[0].repeat === false
        && previewActivation.events[0].isTrusted === true
        && previewActivation.events[0].roomView === 'preview'
        && previewActivation.events[1].type === 'click'
        && previewActivation.events[1].roomView === 'preview'
        && previewActivation.events[1].isTrusted === true
        && previewActivation.events[1].detail === 0
        && previewActivation.events[2].type === 'keyup'
        && previewActivation.events[2].key === 'Enter'
        && previewActivation.events[2].code === 'Enter'
        && previewActivation.events[2].repeat === false
        && previewActivation.events[2].isTrusted === true
        && previewActivation.bubbles.length === 1
        && previewActivation.bubbles[0].rootPresent === true
        && previewActivation.bubbles[0].previewPressed === 'true'
        && previewActivation.bubbles[0].activationState?.view === 'preview'
        && previewActivation.bubbles[0].activationState?.previewStatus === 'LOADING'
        && previewActivation.pageErrors.length === 0
        && previewActivation.browserErrors.length === 0
        && previewActivation.rootPresent === true
        && previewActivation.previewPressed === 'true',
      `Physical Preview activation did not produce one exact trusted keyboard click: ${JSON.stringify(previewActivation)}`);
      let previewReady = false; let previewReadyObservation = null;
      for (let attempt = 0; attempt < 240 && !previewReady; attempt += 1) {
        const observed = await devtools.send('Runtime.evaluate', {
          expression: `(() => {
            const root = document.querySelector('[data-room-preview]');
            const resources = [...document.querySelectorAll('[data-preview-resource-state]')];
            return {
              ready: Boolean(root && root.dataset.roomPreviewState === 'READY'
              && resources.length > 0
              && resources.every((resource) => resource.dataset.previewResourceState === 'READY')),
              state: root?.dataset.roomPreviewState ?? null,
              status: root?.querySelector('[data-preview-load-status]')?.textContent ?? null,
              resources: resources.map((resource) => resource.dataset.previewResourceState),
              activationState: window.__numberdroidStudioVisualTest?.roomPreviewActivationState() ?? null,
              pageErrors: window.__checkpoint45PreviewKeyboard?.pageErrors.map((error) => ({ ...error })) ?? [],
            };
          })()`, returnByValue: true,
        }, sessionId);
        previewReadyObservation = observed.result?.value ?? null;
        previewReady = previewReadyObservation?.ready === true;
        if (!previewReady) await delay(50);
      }
      const previewRequestIds = new Set(devtools.events.slice(networkStart)
        .filter(({ method, params }) => method === 'Network.requestWillBeSent'
          && new URL(params.request.url).pathname.endsWith('/preview-scene'))
        .map(({ params }) => params.requestId));
      const previewNetwork = devtools.events.slice(networkStart)
        .filter(({ params }) => previewRequestIds.has(params?.requestId))
        .map(({ method, params }) => ({
          method,
          requestMethod: params.request?.method ?? null,
          url: params.request?.url ?? params.response?.url ?? null,
          status: params.response?.status ?? null,
          mimeType: params.response?.mimeType ?? null,
          encodedDataLength: params.encodedDataLength ?? null,
          errorText: params.errorText ?? null,
          canceled: params.canceled ?? null,
          blockedReason: params.blockedReason ?? null,
        }));
      const previewBrowserErrors = devtools.events.slice(previewActivationRuntimeStart)
        .filter(({ method, params }) => method === 'Runtime.exceptionThrown'
          || (method === 'Log.entryAdded' && params?.entry?.level === 'error'))
        .slice(-8)
        .map(({ method, params }) => method === 'Runtime.exceptionThrown'
          ? {
              method,
              text: params.exceptionDetails?.text ?? null,
              description: params.exceptionDetails?.exception?.description ?? null,
              url: params.exceptionDetails?.url ?? null,
              lineNumber: params.exceptionDetails?.lineNumber ?? null,
              columnNumber: params.exceptionDetails?.columnNumber ?? null,
            }
          : { method, text: params.entry?.text ?? null, url: params.entry?.url ?? null });
      assert(previewReady, `Exact Studio preview scene or PNG resources did not reach READY: ${JSON.stringify({
        ...previewReadyObservation, network: previewNetwork, browserErrors: previewBrowserErrors,
      })}`);
      await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const evidence = window.__checkpoint45PreviewKeyboard;
          evidence?.root?.removeEventListener('click', evidence.onClick, true);
          evidence?.root?.removeEventListener('click', evidence.onBubble);
          document.removeEventListener('keydown', evidence?.onKey, true);
          document.removeEventListener('keyup', evidence?.onKey, true);
          window.removeEventListener('error', evidence?.onWindowError);
          window.removeEventListener('unhandledrejection', evidence?.onUnhandledRejection);
          delete window.__checkpoint45PreviewKeyboard;
        })()`, returnByValue: true,
      }, sessionId);
      const loadFocusResult = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.querySelector('[data-room-preview]');
          return Boolean(root && document.activeElement === root);
        })()`, returnByValue: true,
      }, sessionId);
      assert(loadFocusResult.result?.value === true, 'Async Studio preview load did not preserve focus on the preview root.');
      const inspectFocused = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const inspect = document.querySelector('[data-preview-inspect="prop.preview-overhang"]');
          inspect?.focus({ preventScroll: true });
          return Boolean(inspect && document.activeElement === inspect);
        })()`, returnByValue: true,
      }, sessionId);
      assert(inspectFocused.result?.value === true, 'Preview overhang object could not receive keyboard focus.');
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r',
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const observed = await devtools.send('Runtime.evaluate', {
          expression: `(() => {
            const resources = [...document.querySelectorAll('[data-preview-resource-state]')];
            return Boolean(document.querySelector('[data-preview-logical-footprint="prop.preview-overhang"]')
              && resources.length > 0
              && resources.every((resource) => resource.dataset.previewResourceState === 'READY'));
          })()`, returnByValue: true,
        }, sessionId);
        if (observed.result?.value === true) break;
        await delay(50);
      }
      const previewViewportPosition = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const stage = document.querySelector('[data-room-preview] .room-preview-stage');
          const svg = document.querySelector('[data-room-preview] [data-preview-scene]');
          if (!stage || !svg) return { positioned: false, reason: 'stage-or-scene-missing' };
          stage.scrollIntoView({ block: 'center', inline: 'nearest' });
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const stageRect = stage.getBoundingClientRect();
          return {
            positioned: stageRect.left < window.innerWidth && stageRect.right > 0
              && stageRect.top < window.innerHeight && stageRect.bottom > 0,
            stage: { left: stageRect.left, top: stageRect.top, right: stageRect.right, bottom: stageRect.bottom },
          };
        })()`, returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      assert(previewViewportPosition.result?.value?.positioned === true,
        `Preview pixel oracle could not position the overhang sample inside the physical viewport: ${JSON.stringify(previewViewportPosition.result?.value)}`);
      const previewFactsResult = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const root = document.querySelector('[data-room-preview]');
          const svg = root?.querySelector('[data-preview-scene]');
          const toScreen = (x, y) => {
            const point = svg.createSVGPoint(); point.x = x; point.y = y;
            const screen = point.matrixTransform(svg.getScreenCTM());
            return { x: screen.x, y: screen.y };
          };
          const groups = [...root.querySelectorAll('[data-preview-placement-id="prop.preview-overhang"]')];
          const logical = root.querySelector('[data-preview-logical-footprint="prop.preview-overhang"]');
          const visual = root.querySelector('[data-preview-visual-bounds="prop.preview-overhang"]');
          const anchor = root.querySelector('[data-preview-ground-anchor="prop.preview-overhang"]');
          const previewLayout = root.querySelector('.room-preview-layout');
          const stage = root.querySelector('.room-preview-stage');
          const objects = root.querySelector('.room-preview-objects');
          const stageRect = stage?.getBoundingClientRect(); const objectsRect = objects?.getBoundingClientRect();
          const sideBySide = Boolean(stageRect && objectsRect && objectsRect.left >= stageRect.right - 1 && objectsRect.top < stageRect.bottom);
          const stacked = Boolean(stageRect && objectsRect && objectsRect.top >= stageRect.bottom - 1);
          const transparentSample = toScreen(1.15, .55);
          const opaqueOverhangSample = toScreen(1.9, .55);
          return {
            state: root?.dataset.roomPreviewState ?? null,
            binding: root?.querySelector('.room-preview-binding')?.textContent ?? null,
            notice: root?.querySelector('[data-preview-read-only-notice]')?.textContent ?? null,
            limits: root?.querySelector('.room-preview-limits')?.textContent ?? null,
            phases: groups.map((group) => group.dataset.previewSegmentKind),
            drawIndexes: groups.map((group) => Number(group.dataset.previewDrawIndex)),
            resourceStates: groups.map((group) => group.querySelector('[data-preview-resource-state]')?.dataset.previewResourceState ?? null),
            inspectFocus: document.activeElement?.dataset.previewInspect ?? null,
            inspectPressed: root?.querySelector('[data-preview-inspect="prop.preview-overhang"]')?.getAttribute('aria-pressed') ?? null,
            logical: logical ? { x: Number(logical.getAttribute('x')), y: Number(logical.getAttribute('y')), width: Number(logical.getAttribute('width')), height: Number(logical.getAttribute('height')) } : null,
            visual: visual ? { x: Number(visual.getAttribute('x')), y: Number(visual.getAttribute('y')), width: Number(visual.getAttribute('width')), height: Number(visual.getAttribute('height')) } : null,
            anchor: anchor ? { x: Number(anchor.getAttribute('cx')), y: Number(anchor.getAttribute('cy')) } : null,
            cellCount: root?.querySelectorAll('[data-preview-cell-kind]').length ?? 0,
            voidCount: root?.querySelectorAll('[data-preview-cell-kind="VOID"]').length ?? 0,
            blockedCount: root?.querySelectorAll('[data-preview-cell-kind="BLOCKED"]').length ?? 0,
            connectorCount: root?.querySelectorAll('[data-preview-connector-id]').length ?? 0,
            mutationControlCount: root?.querySelectorAll('[data-room-control], form').length ?? 0,
            pageHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth,
            stageVisible: Boolean(svg && svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().height > 0),
            responsiveLayout: {
              viewportWidth: window.innerWidth,
              display: previewLayout ? getComputedStyle(previewLayout).display : null,
              gridTemplateColumns: previewLayout ? getComputedStyle(previewLayout).gridTemplateColumns : null,
              sideBySide,
              stacked,
            },
            transparentSample,
            opaqueOverhangSample,
            pixelSamplesInViewport: [transparentSample, opaqueOverhangSample].every((point) => (
              point.x >= 0 && point.x < window.innerWidth && point.y >= 0 && point.y < window.innerHeight
            )),
          };
        })()`, returnByValue: true,
      }, sessionId);
      const previewFacts = previewFactsResult.result?.value;
      const painted = await devtools.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId, 30_000);
      const previewOutputPath = outputPath.replace(/prop-(\d+)\.png$/i, 'studio-preview-$1.png');
      const previewBytes = Buffer.from(painted.data, 'base64');
      await mkdir(dirname(previewOutputPath), { recursive: true });
      await writeFile(previewOutputPath, previewBytes);
      const hiddenState = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const groups = [...document.querySelectorAll('[data-preview-placement-id="prop.preview-overhang"]')];
          for (const group of groups) {
            group.dataset.previewEvidenceDisplay = group.style.display;
            group.style.display = 'none';
          }
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          return {
            count: groups.length,
            hiddenCount: groups.filter((group) => getComputedStyle(group).display === 'none').length,
          };
        })()`, returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      assert(hiddenState.result?.value?.count === 3 && hiddenState.result.value.hiddenCount === 3,
        `Preview pixel oracle could not isolate all three overhang segments: ${JSON.stringify(hiddenState.result?.value)}`);
      const reference = await devtools.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId, 30_000);
      const referenceOutputPath = outputPath.replace(/prop-(\d+)\.png$/i, 'studio-preview-reference-$1.png');
      const referenceBytes = Buffer.from(reference.data, 'base64');
      await writeFile(referenceOutputPath, referenceBytes);
      const restoredState = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const groups = [...document.querySelectorAll('[data-preview-placement-id="prop.preview-overhang"]')];
          for (const group of groups) {
            const display = group.dataset.previewEvidenceDisplay;
            if (display) group.style.display = display; else group.style.removeProperty('display');
            delete group.dataset.previewEvidenceDisplay;
          }
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          return groups.filter((group) => getComputedStyle(group).display !== 'none').length;
        })()`, returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      assert(restoredState.result?.value === 3, 'Preview pixel oracle could not restore all three overhang segments.');
      const decodedPainted = decodeSupportedPng(previewBytes, { maxWidth: 2048, maxHeight: 1200, maxInputBytes: 32 * 1024 * 1024 });
      const decodedReference = decodeSupportedPng(referenceBytes, { maxWidth: 2048, maxHeight: 1200, maxInputBytes: 32 * 1024 * 1024 });
      assert(decodedPainted.width === decodedReference.width && decodedPainted.height === decodedReference.height,
        'Preview painted and reference screenshots must have identical dimensions.');
      const pixel = (decoded, point) => {
        const x = Math.round(point.x); const y = Math.round(point.y);
        assert(Number.isFinite(point.x) && Number.isFinite(point.y)
          && x >= 0 && x < decoded.width && y >= 0 && y < decoded.height,
        `Preview pixel sample lies outside the physical screenshot: ${JSON.stringify({ point, width: decoded.width, height: decoded.height })}`);
        const offset = (y * decoded.width + x) * 4;
        return [...decoded.rgba.subarray(offset, offset + 4)];
      };
      const delta = (left, right) => left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0);
      const transparentPainted = pixel(decodedPainted, previewFacts.transparentSample);
      const transparentReference = pixel(decodedReference, previewFacts.transparentSample);
      const opaquePainted = pixel(decodedPainted, previewFacts.opaqueOverhangSample);
      const opaqueReference = pixel(decodedReference, previewFacts.opaqueOverhangSample);
      let changedPixelCount = 0;
      for (let offset = 0; offset < decodedPainted.rgba.length; offset += 4) {
        const paintedPixel = decodedPainted.rgba.subarray(offset, offset + 4);
        const referencePixel = decodedReference.rgba.subarray(offset, offset + 4);
        if (delta(paintedPixel, referencePixel) > 8) changedPixelCount += 1;
      }
      const nonGetRequests = devtools.events.slice(networkStart)
        .filter(({ method }) => method === 'Network.requestWillBeSent')
        .map(({ params }) => params.request)
        .filter(({ method }) => method !== 'GET')
        .map(({ method, url }) => ({ method, url }));
      checkpoint45StudioPreview = {
        ...previewFacts,
        physicalKeyboardOpen: previewActivation?.events.length === 3
          && previewActivation.events[0].type === 'keydown'
          && previewActivation.events[0].isTrusted === true
          && previewActivation.events[1].type === 'click'
          && previewActivation.events[1].roomView === 'preview'
          && previewActivation.events[1].isTrusted === true
          && previewActivation.events[1].detail === 0
          && previewActivation.events[2].type === 'keyup'
          && previewActivation.events[2].isTrusted === true,
        loadFocusPreserved: loadFocusResult.result?.value === true,
        transparentPixelDelta: delta(transparentPainted, transparentReference),
        opaqueOverhangPixelDelta: delta(opaquePainted, opaqueReference),
        changedPixelCount,
        transparentPainted, transparentReference, opaquePainted, opaqueReference,
        nonGetRequests,
        previewOutputPath, referenceOutputPath,
      };
      const focusedEditor = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const button = document.querySelector('[data-room-view="editor"]');
          button?.focus({ preventScroll: true }); return document.activeElement === button;
        })()`, returnByValue: true,
      }, sessionId);
      assert(focusedEditor.result?.value === true, 'Editor return control could not receive keyboard focus.');
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r',
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      let editorAfterPreview = null;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const editorAfterResult = await devtools.send('Runtime.evaluate', {
          expression: `(() => {
            const scroll = Object.fromEntries([...document.querySelectorAll('[data-room-scroll]')]
              .map((element) => [element.dataset.roomScroll, { left: element.scrollLeft, top: element.scrollTop }]));
            return {
              activeKey: document.activeElement?.dataset.roomFocusKey ?? document.activeElement?.dataset.roomControl ?? null,
              scroll,
              page: { x: window.scrollX, y: window.scrollY },
              shape: window.__numberdroidStudioVisualTest?.roomShapeState() ?? null,
              roomId: document.querySelector('[data-room-variant-select]')?.value ?? null,
              editorPresent: Boolean(document.querySelector('[data-room-board]')),
              previewPresent: Boolean(document.querySelector('[data-room-preview]')),
            };
          })()`, returnByValue: true,
        }, sessionId);
        editorAfterPreview = editorAfterResult.result?.value;
        if (editorAfterPreview?.editorPresent && editorAfterPreview.activeKey === editorBeforePreview.activeKey) break;
        await delay(50);
      }
      checkpoint45StudioPreview.editorRoundTrip = {
        before: editorBeforePreview,
        after: editorAfterPreview,
        sameScroll: JSON.stringify(editorAfterPreview?.scroll) === JSON.stringify(editorBeforePreview.scroll),
        samePage: JSON.stringify(editorAfterPreview?.page) === JSON.stringify(editorBeforePreview.page),
        sameShape: JSON.stringify(editorAfterPreview?.shape) === JSON.stringify(editorBeforePreview.shape),
      };
    }
    if (checkpoint45Focus === 'irregular') {
      const observations = []; let dirtyMutationGuard = null;
      for (const [tool, expectedKind] of [['PAINT_VOID', 'VOID'], ['PAINT_BLOCKED', 'BLOCKED'], ['PAINT_ROOM', 'ROOM']]) {
        const setup = await devtools.send('Runtime.evaluate', {
          expression: `(async () => {
            document.querySelector('[data-room-control="editor-tool"][data-editor-tool="${tool}"]')?.click();
            await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
            const cell = document.querySelector('.room-cell[data-x="1"][data-y="0"]');
            cell.scrollIntoView({ block: 'center', inline: 'center' });
            await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
            const rect = cell.getBoundingClientRect(); const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            const hit = document.elementFromPoint(point.x, point.y);
            const overlays = [...document.querySelectorAll('.room-placement, .room-connector')];
            const ghosted = overlays.filter((overlay) => {
              const style = getComputedStyle(overlay); const overlayRect = overlay.getBoundingClientRect();
              return style.pointerEvents === 'none' && Number(style.opacity) > 0 && style.visibility === 'visible'
                && style.display !== 'none' && overlayRect.width > 0 && overlayRect.height > 0;
            });
            const intersectingPlacements = [...document.querySelectorAll('.room-placement')].filter((overlay) => {
              const overlayRect = overlay.getBoundingClientRect();
              return point.x >= overlayRect.left && point.x <= overlayRect.right && point.y >= overlayRect.top && point.y <= overlayRect.bottom;
            });
            const cellBackground = getComputedStyle(cell).backgroundColor;
            const backgroundComponents = cellBackground.match(/[0-9.]+/g)?.map(Number) ?? [];
            const cellBackgroundAlpha = backgroundComponents.length === 4 ? backgroundComponents[3] : 1;
            return { point, hitControl: hit?.dataset?.roomControl ?? null, hitX: hit?.dataset?.x ?? null, hitY: hit?.dataset?.y ?? null,
              overlayCount: overlays.length, ghostedCount: ghosted.length, intersectingPlacementCount: intersectingPlacements.length,
              intersectingOpacity: intersectingPlacements[0] ? getComputedStyle(intersectingPlacements[0]).opacity : null,
              intersectingPointerEvents: intersectingPlacements[0] ? getComputedStyle(intersectingPlacements[0]).pointerEvents : null,
              cellBackground, cellBackgroundAlpha };
          })()`, awaitPromise: true, returnByValue: true,
        }, sessionId);
        assert(setup.result?.value?.hitControl === 'cell' && setup.result.value.hitX === '1' && setup.result.value.hitY === '0'
          && setup.result.value.overlayCount > 0 && setup.result.value.ghostedCount === setup.result.value.overlayCount
          && setup.result.value.intersectingPlacementCount > 0 && Number(setup.result.value.intersectingOpacity) > 0
          && Number(setup.result.value.intersectingOpacity) < 1
          && setup.result.value.intersectingPointerEvents === 'none'
          && setup.result.value.cellBackgroundAlpha > 0 && setup.result.value.cellBackgroundAlpha < 1,
          `Checkpoint 4.5 physical paint did not hit the cell above visible overlays: ${JSON.stringify(setup.result?.value)}`);
        const point = setup.result.value.point;
        await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
        const painted = await devtools.send('Runtime.evaluate', {
          expression: `(async () => {
            await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
            const cell = document.querySelector('.room-cell[data-x="1"][data-y="0"]');
            const shape = window.__numberdroidStudioVisualTest?.roomShapeState();
            const voidKeys = new Set((shape?.voidCells ?? []).map(({ x, y }) => x + ',' + y));
            const overlap = (shape?.blockedCells ?? []).filter(({ x, y }) => voidKeys.has(x + ',' + y));
            return {
              tool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null,
              kind: cell?.dataset.cellKind ?? null,
              label: cell?.querySelector('small')?.textContent ?? null,
              total: document.querySelectorAll('.room-cell').length,
              floor: document.querySelectorAll('.room-cell[data-cell-kind="ROOM"]').length,
              outside: document.querySelectorAll('.room-cell[data-cell-kind="VOID"]').length,
              blocked: document.querySelectorAll('.room-cell[data-cell-kind="BLOCKED"]').length,
              overlap: overlap.length,
              dirty: shape?.dirty ?? null,
              resizeDisabled: document.querySelector('[data-room-form="resize"] button[type="submit"]')?.disabled ?? null,
              revision: Number(document.documentElement.dataset.visualRevision ?? -1),
            };
          })()`, awaitPromise: true, returnByValue: true,
        }, sessionId);
        assert(painted.result?.value?.kind === expectedKind && painted.result.value.overlap === 0
          && painted.result.value.total === painted.result.value.floor + painted.result.value.outside + painted.result.value.blocked
          && painted.result.value.revision === 37,
        `Checkpoint 4.5 physical paint was not immediately visible and exclusive: ${JSON.stringify(painted.result?.value)}`);
        observations.push(painted.result.value);
        if (tool === 'PAINT_VOID') {
          const guarded = await devtools.send('Runtime.evaluate', {
            expression: 'window.__numberdroidStudioVisualTest?.exerciseRoomDirtyMutationGuard()', awaitPromise: true, returnByValue: true,
          }, sessionId);
          dirtyMutationGuard = guarded.result?.value ?? null;
          assert(painted.result.value.dirty === true && painted.result.value.resizeDisabled === true
            && dirtyMutationGuard?.accepted === false && dirtyMutationGuard.beforeRevision === 37
            && dirtyMutationGuard.afterRevision === 37 && dirtyMutationGuard.message?.includes('Save or discard shape changes'),
          `Checkpoint 4.5 dirty shape did not visibly and semantically block other room mutations: ${JSON.stringify({ painted: painted.result.value, dirtyMutationGuard })}`);
        }
      }
      const rejectedOverlap = await devtools.send('Runtime.evaluate', {
        expression: 'window.__numberdroidStudioVisualTest?.exerciseRoomCoordinateOverlapRejection()', awaitPromise: true, returnByValue: true,
      }, sessionId);
      const coordinateOverlap = rejectedOverlap.result?.value ?? null;
      checkpoint45PhysicalPaint = { observations, dirtyMutationGuard, coordinateOverlap, returnedToSavedPartition: observations.at(-1)?.dirty === false };
      assert(checkpoint45PhysicalPaint.returnedToSavedPartition,
        `Checkpoint 4.5 paint cycle did not return to the clean saved partition: ${JSON.stringify(checkpoint45PhysicalPaint)}`);
      assert(coordinateOverlap?.arraysUnchanged === true && coordinateOverlap.dirtyUnchanged === true
        && coordinateOverlap.message?.includes('cannot be both outside and blocked'),
      `Checkpoint 4.5 structured-coordinate overlap was not rejected before draft mutation: ${JSON.stringify(coordinateOverlap)}`);
      const continuity = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const board = document.querySelector('[data-room-board]'); const scroller = document.querySelector('.room-canvas-scroll');
          scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth; scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
          const expectedScroll = { left: scroller.scrollLeft, top: scroller.scrollTop };
          const baseRect = board.getBoundingClientRect(); const states = [];
          const observe = (kind, value) => {
            const currentBoard = document.querySelector('[data-room-board]'); const currentScroller = document.querySelector('.room-canvas-scroll'); const rect = currentBoard?.getBoundingClientRect();
            states.push({ kind, value, sameBoard: currentBoard === board, boardCount: document.querySelectorAll('[data-room-board]').length,
              visible: Boolean(rect?.width > 0 && rect?.height > 0), leftDrift: Math.abs((rect?.left ?? 0) - baseRect.left), topDrift: Math.abs((rect?.top ?? 0) - baseRect.top),
              activeTool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null,
              activePanel: document.querySelector('[data-room-control="editor-panel"][data-selected="true"]')?.dataset.editorPanel ?? null,
              focused: document.activeElement?.dataset.roomFocusKey ?? null, scrollLeft: currentScroller?.scrollLeft ?? null, scrollTop: currentScroller?.scrollTop ?? null });
          };
          for (const panel of ['properties', 'check', 'tool']) {
            const button = document.querySelector('[data-room-control="editor-panel"][data-editor-panel="' + panel + '"]'); button.focus(); button.click();
            await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))); observe('panel', panel);
          }
          for (const tool of ['ENTRANCE', 'SURFACE', 'PROP', 'PAINT_ROOM']) {
            const button = document.querySelector('[data-room-control="editor-tool"][data-editor-tool="' + tool + '"]'); button.focus(); button.click();
            await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))); observe('tool', tool);
          }
          const prop = document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]'); prop.focus(); prop.click();
          const handoffCell = document.querySelector('.room-cell[data-x="0"][data-y="0"]'); handoffCell.focus();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const focusHandoffState = { sameBoard: document.querySelector('[data-room-board]') === board,
            activeTool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null,
            focused: document.activeElement?.dataset.roomFocusKey ?? null };
          const paint = document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_ROOM"]'); paint.focus(); paint.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const layer = document.querySelector('[data-room-layer="SET_DRESSING"]'); layer.focus(); layer.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const layerState = { boardCount: document.querySelectorAll('[data-room-board]').length, visible: document.querySelector('[data-room-board]')?.getBoundingClientRect().width > 0,
            focused: document.activeElement?.dataset.roomFocusKey ?? null, scrollLeft: document.querySelector('.room-canvas-scroll')?.scrollLeft ?? null,
            scrollTop: document.querySelector('.room-canvas-scroll')?.scrollTop ?? null, checked: document.querySelector('[data-room-layer="SET_DRESSING"]')?.checked ?? null };
          document.querySelector('[data-room-layer="SET_DRESSING"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          return { expectedScroll, states, focusHandoffState, layerState, finalBoardCount: document.querySelectorAll('[data-room-board]').length };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      checkpoint45EditorContinuity = continuity.result?.value ?? null;
      assert(checkpoint45EditorContinuity?.states?.length === 7
        && checkpoint45EditorContinuity.states.every(({ sameBoard, boardCount, visible, leftDrift, topDrift, focused, kind, value, scrollLeft, scrollTop }) => (
          sameBoard === true && boardCount === 1 && visible === true && leftDrift <= 1 && topDrift <= 1
            && focused === `room-${kind === 'panel' ? 'panel' : 'tool'}-${value}`
            && scrollLeft === checkpoint45EditorContinuity.expectedScroll.left && scrollTop === checkpoint45EditorContinuity.expectedScroll.top
        ))
        && checkpoint45EditorContinuity.focusHandoffState?.sameBoard === true
        && checkpoint45EditorContinuity.focusHandoffState.activeTool === 'PROP'
        && checkpoint45EditorContinuity.focusHandoffState.focused === 'room-cell-0-0'
        && checkpoint45EditorContinuity.layerState?.boardCount === 1 && checkpoint45EditorContinuity.layerState.visible === true
        && checkpoint45EditorContinuity.layerState.focused === 'room-layer-SET_DRESSING'
        && checkpoint45EditorContinuity.layerState.scrollLeft === checkpoint45EditorContinuity.expectedScroll.left
        && checkpoint45EditorContinuity.layerState.scrollTop === checkpoint45EditorContinuity.expectedScroll.top
        && checkpoint45EditorContinuity.layerState.checked === false && checkpoint45EditorContinuity.finalBoardCount === 1,
      `Checkpoint 4.5 tool/dock/layer changes did not preserve one usable canvas, focus, geometry, and scroll: ${JSON.stringify(checkpoint45EditorContinuity)}`);
      const findingsSetup = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const check = document.querySelector('[data-room-control="editor-panel"][data-editor-panel="check"]');
          check.focus(); check.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const list = document.querySelector('.room-findings .asset-findings');
          const dock = document.querySelector('.room-editor-dock');
          const errorItems = [...document.querySelectorAll('.room-findings .asset-findings > li[data-severity="ERROR"]')];
          const targetButtons = errorItems.flatMap((item) => [...item.querySelectorAll('[data-room-control="finding"]')]);
          const staticError = errorItems.find((item) => !item.querySelector('[data-room-control="finding"]'));
          const originalFetch = window.fetch;
          const root = document.getElementById('workspace-content');
          const findingClickObserver = (event) => {
            const target = event.target.closest?.('[data-room-control="finding"]');
            if (target) window.__roomFindingsNavigationEvidence.clicks.push({
              findingId: target.dataset.findingId ?? null,
              isTrusted: event.isTrusted,
              detail: event.detail,
            });
          };
          window.__roomFindingsNavigationEvidence = { originalFetch, root, findingClickObserver, requests: [], clicks: [] };
          root.addEventListener('click', findingClickObserver, true);
          window.fetch = async (...args) => {
            const request = args[0]; const init = args[1] ?? {};
            const method = String(init.method ?? request?.method ?? 'GET').toUpperCase();
            if (method !== 'GET') window.__roomFindingsNavigationEvidence.requests.push({
              method,
              url: typeof request === 'string' ? request : request?.url ?? null,
            });
            return originalFetch(...args);
          };
          list.scrollTop = Math.min(57, Math.max(0, list.scrollHeight - list.clientHeight));
          dock.scrollTop = Math.min(41, Math.max(0, dock.scrollHeight - dock.clientHeight));
          window.scrollTo(window.scrollX, Math.min(83, Math.max(0, document.documentElement.scrollHeight - innerHeight)));
          const first = targetButtons[0]; first.focus({ preventScroll: true });
          return {
            errorCount: errorItems.length,
            targetCount: targetButtons.length,
            staticError: staticError ? {
              text: staticError.textContent,
              buttonCount: staticError.querySelectorAll('button').length,
            } : null,
            first: {
              focusKey: first?.dataset.roomFocusKey ?? null,
              findingId: first?.dataset.findingId ?? null,
              targetId: first?.dataset.targetId ?? null,
              focused: document.activeElement === first,
            },
            dockScrollable: dock.scrollHeight > dock.clientHeight,
            before: {
              findings: list.scrollTop,
              dock: dock.scrollTop,
              pageX: window.scrollX,
              pageY: window.scrollY,
            },
          };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r',
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      const findingsFirst = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const list = document.querySelector('.room-findings .asset-findings');
          const dock = document.querySelector('.room-editor-dock');
          const buttons = [...document.querySelectorAll('.room-findings [data-severity="ERROR"] [data-room-control="finding"]')];
          const selected = document.querySelector('.room-findings [data-selected="true"]');
          const first = {
            focusedKey: document.activeElement?.dataset.roomFocusKey ?? null,
            selectedFindingId: selected?.dataset.findingId ?? null,
            selectedPlacementId: document.querySelector('[data-room-board] [data-placement-id][data-selected="true"]')?.dataset.placementId
              ?? document.querySelector('.room-placement-list [data-room-control="placement-select"][aria-current="true"]')?.dataset.placementId ?? null,
            selectedConnectorId: document.querySelector('[data-room-board] [data-connector-id][data-selected="true"]')?.dataset.connectorId ?? null,
            after: { findings: list.scrollTop, dock: dock.scrollTop, pageX: window.scrollX, pageY: window.scrollY },
          };
          const secondButton = buttons.at(-1); secondButton.focus({ preventScroll: true });
          return {
            first,
            second: {
              focusKey: secondButton?.dataset.roomFocusKey ?? null,
              findingId: secondButton?.dataset.findingId ?? null,
              targetId: secondButton?.dataset.targetId ?? null,
              focused: document.activeElement === secondButton,
            },
            beforeSecond: { findings: list.scrollTop, dock: dock.scrollTop, pageX: window.scrollX, pageY: window.scrollY },
          };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r',
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      const findingsSecond = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const list = document.querySelector('.room-findings .asset-findings');
          const dock = document.querySelector('.room-editor-dock');
          const selected = document.querySelector('.room-findings [data-selected="true"]');
          const item = document.querySelector('.room-findings .asset-findings > li:not(.clear)');
          const style = item ? getComputedStyle(item) : null;
          const result = {
            focusedKey: document.activeElement?.dataset.roomFocusKey ?? null,
            selectedFindingId: selected?.dataset.findingId ?? null,
            selectedFindingCount: document.querySelectorAll('.room-findings [data-selected="true"]').length,
            selectedPlacementId: document.querySelector('[data-room-board] [data-placement-id][data-selected="true"]')?.dataset.placementId
              ?? document.querySelector('.room-placement-list [data-room-control="placement-select"][aria-current="true"]')?.dataset.placementId ?? null,
            selectedConnectorId: document.querySelector('[data-room-board] [data-connector-id][data-selected="true"]')?.dataset.connectorId ?? null,
            after: { findings: list.scrollTop, dock: dock.scrollTop, pageX: window.scrollX, pageY: window.scrollY },
            fontSize: Number.parseFloat(style?.fontSize ?? '0'),
            lineHeight: Number.parseFloat(style?.lineHeight ?? '0'),
            hasExplanation: Boolean(item?.querySelector('.room-finding-explanation')?.textContent),
            hasRemediation: item?.querySelector('.room-finding-remediation')?.textContent?.startsWith('Next:') ?? false,
            technicalText: item?.querySelector('.room-finding-technical')?.textContent ?? null,
            requestCount: window.__roomFindingsNavigationEvidence?.requests.length ?? -1,
            clicks: window.__roomFindingsNavigationEvidence?.clicks.map((click) => ({ ...click })) ?? [],
          };
          window.fetch = window.__roomFindingsNavigationEvidence.originalFetch;
          window.__roomFindingsNavigationEvidence.root.removeEventListener(
            'click', window.__roomFindingsNavigationEvidence.findingClickObserver, true,
          );
          delete window.__roomFindingsNavigationEvidence;
          return result;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const findingPointerSetup = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="SELECT"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const selectedPlacementId = document.querySelector('[data-room-board] [data-placement-id][data-selected="true"]')?.dataset.placementId ?? null;
          const target = [...document.querySelectorAll('[data-room-board] .room-placement[data-placement-id]')]
            .find((candidate) => candidate.dataset.placementId !== selectedPlacementId);
          const rect = target?.getBoundingClientRect();
          return {
            selectedFindingCount: document.querySelectorAll('.room-findings [data-selected="true"]').length,
            selectedPlacementId,
            targetPlacementId: target?.dataset.placementId ?? null,
            point: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
          };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const findingPointerPoint = findingPointerSetup.result?.value?.point;
      await devtools.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: findingPointerPoint.x, y: findingPointerPoint.y,
        button: 'left', buttons: 1, clickCount: 1,
      }, sessionId);
      const findingPointerDuring = await devtools.send('Runtime.evaluate', {
        expression: `({
          selectedPlacementId: document.querySelector('[data-room-board] [data-placement-id][data-selected="true"]')?.dataset.placementId ?? null,
          selectedFindingCount: document.querySelectorAll('.room-findings [data-selected="true"]').length,
          currentFindingCount: document.querySelectorAll('.room-findings [aria-current="true"]').length,
          gestureActive: window.__numberdroidStudioVisualTest?.roomDirectManipulationState()?.gestureActive ?? false,
        })`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: findingPointerPoint.x, y: findingPointerPoint.y,
        button: 'left', buttons: 0, clickCount: 1,
      }, sessionId);
      const findingPointerAfter = await devtools.send('Runtime.evaluate', {
        expression: `({
          selectedPlacementId: document.querySelector('[data-room-board] [data-placement-id][data-selected="true"]')?.dataset.placementId ?? null,
          selectedFindingCount: document.querySelectorAll('.room-findings [data-selected="true"]').length,
          currentFindingCount: document.querySelectorAll('.room-findings [aria-current="true"]').length,
          gestureActive: window.__numberdroidStudioVisualTest?.roomDirectManipulationState()?.gestureActive ?? false,
        })`, returnByValue: true,
      }, sessionId);
      checkpoint45FindingsNavigation = {
        setup: findingsSetup.result?.value ?? null,
        first: findingsFirst.result?.value ?? null,
        second: findingsSecond.result?.value ?? null,
        pointerSelection: {
          setup: findingPointerSetup.result?.value ?? null,
          during: findingPointerDuring.result?.value ?? null,
          after: findingPointerAfter.result?.value ?? null,
        },
      };
      assert(checkpoint45FindingsNavigation.setup?.errorCount === 5
        && checkpoint45FindingsNavigation.setup.targetCount === 4
        && checkpoint45FindingsNavigation.setup.staticError?.buttonCount === 0
        && checkpoint45FindingsNavigation.setup.staticError.text?.includes('Room-wide issue')
        && checkpoint45FindingsNavigation.setup.first?.focused === true
        && checkpoint45FindingsNavigation.setup.before.findings > 0
        && (width !== 1440 || (checkpoint45FindingsNavigation.setup.dockScrollable === true
          && checkpoint45FindingsNavigation.setup.before.dock > 0))
        && checkpoint45FindingsNavigation.first?.first.focusedKey === checkpoint45FindingsNavigation.setup.first.focusKey
        && checkpoint45FindingsNavigation.first.first.selectedFindingId === checkpoint45FindingsNavigation.setup.first.findingId
        && checkpoint45FindingsNavigation.first.first.selectedPlacementId === checkpoint45FindingsNavigation.setup.first.targetId
        && JSON.stringify(checkpoint45FindingsNavigation.first.first.after) === JSON.stringify(checkpoint45FindingsNavigation.setup.before)
        && checkpoint45FindingsNavigation.first.second?.focused === true
        && checkpoint45FindingsNavigation.second?.focusedKey === checkpoint45FindingsNavigation.first.second.focusKey
        && checkpoint45FindingsNavigation.second.selectedFindingId === checkpoint45FindingsNavigation.first.second.findingId
        && checkpoint45FindingsNavigation.second.selectedPlacementId === checkpoint45FindingsNavigation.first.second.targetId
        && checkpoint45FindingsNavigation.second.selectedFindingCount === 1
        && JSON.stringify(checkpoint45FindingsNavigation.second.after) === JSON.stringify(checkpoint45FindingsNavigation.first.beforeSecond)
        && checkpoint45FindingsNavigation.second.fontSize >= 11
        && checkpoint45FindingsNavigation.second.lineHeight >= checkpoint45FindingsNavigation.second.fontSize * 1.4
        && checkpoint45FindingsNavigation.second.hasExplanation === true
        && checkpoint45FindingsNavigation.second.hasRemediation === true
        && checkpoint45FindingsNavigation.second.clicks?.length === 2
        && checkpoint45FindingsNavigation.second.clicks[0].findingId === checkpoint45FindingsNavigation.setup.first.findingId
        && checkpoint45FindingsNavigation.second.clicks[1].findingId === checkpoint45FindingsNavigation.first.second.findingId
        && checkpoint45FindingsNavigation.second.clicks.every(({ isTrusted, detail }) => isTrusted === true && detail === 0)
        && checkpoint45FindingsNavigation.second.technicalText?.includes('ERROR')
        && checkpoint45FindingsNavigation.second.requestCount === 0
        && checkpoint45FindingsNavigation.pointerSelection.setup?.selectedFindingCount === 1
        && checkpoint45FindingsNavigation.pointerSelection.setup.targetPlacementId
        && checkpoint45FindingsNavigation.pointerSelection.setup.targetPlacementId !== checkpoint45FindingsNavigation.pointerSelection.setup.selectedPlacementId
        && checkpoint45FindingsNavigation.pointerSelection.during?.selectedPlacementId === checkpoint45FindingsNavigation.pointerSelection.setup.targetPlacementId
        && checkpoint45FindingsNavigation.pointerSelection.during.selectedFindingCount === 0
        && checkpoint45FindingsNavigation.pointerSelection.during.currentFindingCount === 0
        && checkpoint45FindingsNavigation.pointerSelection.during.gestureActive === true
        && checkpoint45FindingsNavigation.pointerSelection.after?.selectedPlacementId === checkpoint45FindingsNavigation.pointerSelection.setup.targetPlacementId
        && checkpoint45FindingsNavigation.pointerSelection.after.selectedFindingCount === 0
        && checkpoint45FindingsNavigation.pointerSelection.after.currentFindingCount === 0
        && checkpoint45FindingsNavigation.pointerSelection.after.gestureActive === false,
      `Checkpoint 4.5 finding navigation did not preserve exact identity, target, focus, scroll, readability, or read-only authority: ${JSON.stringify(checkpoint45FindingsNavigation)}`);
      const directSetup = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const waitFor = async (predicate, label) => {
            const deadline = Date.now() + 10_000;
            while (!predicate() && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 25));
            if (!predicate()) throw new Error('Timed out waiting for ' + label + '.');
          };
          const originalFetch = window.fetch;
          window.__roomDirectManipulationEvidence = { requests: [], resizeRequests: [], originalFetch,
            rejectNextAdd: false, syntheticRoomProjection: null };
          window.fetch = async (...args) => {
            const request = args[0]; const url = typeof request === 'string' ? request : request.url;
            const init = args[1] ?? {}; const method = init.method ?? 'GET';
            if (url.endsWith('/rooms/hall.service-east-west/resize') && method === 'POST') {
              const body = JSON.parse(init.body ?? '{}');
              window.__roomDirectManipulationEvidence.resizeRequests.push({ url, method, body });
              window.__roomDirectManipulationEvidence.syntheticRoomProjection = {
                revision: body.expectedRevision + 1,
                roomVersion: body.expectedRoomVariantVersion + 1,
                width: body.width,
                height: body.height,
              };
              return new Response(JSON.stringify({ projectId: 'numberdroid-studio-checkpoint-2c', revision: body.expectedRevision + 1 }), {
                status: 200, headers: { 'content-type': 'application/json' },
              });
            }
            if (url === '/api/projects/numberdroid-studio-checkpoint-2c' && method === 'GET'
                && window.__roomDirectManipulationEvidence.syntheticRoomProjection) {
              const response = await originalFetch(...args); const project = await response.json();
              const projection = window.__roomDirectManipulationEvidence.syntheticRoomProjection;
              const entry = project.snapshot.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === 'hall.service-east-west');
              const head = entry.versions.find(({ version }) => version === entry.headVersion);
              entry.versions.push({ ...head, version: projection.roomVersion, width: projection.width, height: projection.height });
              entry.headVersion = projection.roomVersion;
              project.revision = projection.revision;
              return new Response(JSON.stringify(project), { status: 200, headers: { 'content-type': 'application/json' } });
            }
            if (url.includes('/placements-')) {
              const body = JSON.parse(init.body ?? '{}');
              window.__roomDirectManipulationEvidence.requests.push({ url, method: init.method ?? 'GET', body });
              if (url.endsWith('/placements-add') && window.__roomDirectManipulationEvidence.rejectNextAdd) {
                window.__roomDirectManipulationEvidence.rejectNextAdd = false;
                throw new TypeError('Synthetic connection loss before commit.');
              }
              return new Response(JSON.stringify({ projectId: 'numberdroid-studio-checkpoint-2c', revision: body.expectedRevision + 1 }), {
                status: 200, headers: { 'content-type': 'application/json' },
              });
            }
            return originalFetch(...args);
          };
          const selector = document.querySelector('[data-room-variant-select]'); selector.value = 'hall.service-east-west';
          selector.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="editor-panel"][data-editor-panel="properties"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const resizeForm = document.querySelector('[data-room-form="resize"]');
          const widthBefore = Number(resizeForm?.elements.width.value); const heightBefore = Number(resizeForm?.elements.height.value);
          const resizeBefore = { visible: Boolean(resizeForm), disabled: resizeForm?.elements.width.disabled
            || resizeForm?.elements.height.disabled || resizeForm?.querySelector('button[type="submit"]')?.disabled,
          guidance: document.querySelector('.room-resize-guidance')?.textContent ?? null, width: widthBefore, height: heightBefore };
          resizeForm.elements.width.value = String(widthBefore + 2); resizeForm.requestSubmit();
          await waitFor(() => Number(document.querySelector('[data-room-board]')?.style.getPropertyValue('--room-width')) === widthBefore + 2
            && !document.querySelector('#refresh-button')?.disabled, 'the clean saved-state room resize');
          const resizeAfter = { width: Number(document.querySelector('[data-room-board]').style.getPropertyValue('--room-width')),
            height: Number(document.querySelector('[data-room-board]').style.getPropertyValue('--room-height')),
            revision: window.__numberdroidStudioVisualTest.roomDirectManipulationState().projectRevision };
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="SURFACE"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const surfaceSelector = '[data-room-control="palette-asset"][data-palette-asset-id="asset.family-hygiene.1"]';
          await waitFor(() => document.querySelector(surfaceSelector + ' .asset-preview.ready')?.dataset.previewState === 'READY', 'the exact surface image');
          document.querySelector(surfaceSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('.room-cell[data-x="' + widthBefore + '"][data-y="0"]')?.click();
          await waitFor(() => window.__roomDirectManipulationEvidence.requests.length >= 1
            && !document.querySelector('#refresh-button')?.disabled, 'the first surface placement');
          document.querySelector('.room-cell[data-x="' + (widthBefore + 1) + '"][data-y="0"]')?.click();
          await waitFor(() => window.__roomDirectManipulationEvidence.requests.length >= 2
            && !document.querySelector('#refresh-button')?.disabled, 'the second surface placement');
          const surfaceRequests = window.__roomDirectManipulationEvidence.requests.slice(0, 2);
          const surfaceResize = { resizeBefore, resizeAfter,
            resizeRequests: window.__roomDirectManipulationEvidence.resizeRequests.slice(), requests: surfaceRequests,
            state: window.__numberdroidStudioVisualTest.roomDirectManipulationState() };
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]')?.click();
          document.querySelector('.room-cell[data-x="1"][data-y="0"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PROP"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const paletteSelector = '[data-room-control="palette-asset"][data-palette-asset-id="asset.transfer-apparatus-cp45"]';
          await waitFor(() => document.querySelector(paletteSelector + ' .asset-preview.ready')?.dataset.previewState === 'READY', 'the exact prop image');
          document.querySelector(paletteSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          await waitFor(() => !window.__numberdroidStudioVisualTest.roomDirectManipulationState().suppressCanvasClick,
            'canvas click suppression to settle');
          const beforeDirtyAttempt = window.__roomDirectManipulationEvidence.requests.length;
          document.querySelector('.room-cell[data-x="2"][data-y="0"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const dirtyGuard = {
            requestCount: window.__roomDirectManipulationEvidence.requests.length - beforeDirtyAttempt,
            state: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
            message: document.querySelector('#toast')?.textContent ?? null,
          };
          const originalConfirm = window.confirm; window.confirm = () => true;
          document.querySelector('[data-room-control="shape-reset"]')?.click(); window.confirm = originalConfirm;
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          await waitFor(() => document.querySelector(paletteSelector + ' .asset-preview.ready')?.dataset.previewState === 'READY', 'the exact prop image after shape reset');
          document.querySelector(paletteSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="rotate-placement-ghost"]')?.focus({ preventScroll: true });
          return { requestCount: window.__roomDirectManipulationEvidence.requests.length, surfaceResize, dirtyGuard,
            directSelection: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
            useControlPresent: Boolean(document.querySelector('[data-room-control="use-preview-asset"]')) };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR' }, sessionId);
      const directPoints = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const board = document.querySelector('[data-room-board]');
          board.scrollIntoView({ block: 'center', inline: 'center' });
          const pointFor = (x, y) => { const cell = document.querySelector('.room-cell[data-x="' + x + '"][data-y="' + y + '"]');
            const rect = cell.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; };
          const boardRect = board.getBoundingClientRect();
          const outsideX = boardRect.left > 12 ? boardRect.left - 8 : boardRect.right + 8;
          return { validPoint: pointFor(1, 0), invalidPoint: pointFor(5, 2),
            outsidePoint: { x: outsideX, y: boardRect.top + boardRect.height / 2 } };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.validPoint.x, y: directPoints.result.value.validPoint.y }, sessionId);
      await delay(50);
      const validGhost = await devtools.send('Runtime.evaluate', {
        expression: `(() => { const ghost = document.querySelector('.room-placement-ghost'); const rect = ghost?.getBoundingClientRect(); const board = document.querySelector('[data-room-board]')?.getBoundingClientRect(); return {
          allowed: ghost?.dataset.allowed ?? null, cue: ghost?.querySelector('strong')?.textContent ?? null,
          rotation: ghost?.querySelector('span')?.textContent ?? null,
          cellsWide: rect && board ? Math.round(rect.width / (board.width / Number(document.querySelector('[data-room-board]').style.getPropertyValue('--room-width')))) : null,
          cellsHigh: rect && board ? Math.round(rect.height / (board.height / Number(document.querySelector('[data-room-board]').style.getPropertyValue('--room-height')))) : null,
          requestCount: window.__roomDirectManipulationEvidence.requests.length,
        }; })()`, returnByValue: true,
      }, sessionId);
      const validScreenshot = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId, 30_000);
      const validGhostPath = outputPath.replace(/\.png$/i, '-direct-valid-ghost.png');
      await writeFile(validGhostPath, Buffer.from(validScreenshot.data, 'base64'));
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.invalidPoint.x, y: directPoints.result.value.invalidPoint.y }, sessionId);
      await delay(50);
      const invalidGhost = await devtools.send('Runtime.evaluate', {
        expression: `(() => { const ghost = document.querySelector('.room-placement-ghost'); return {
          allowed: ghost?.dataset.allowed ?? null, cue: ghost?.querySelector('strong')?.textContent ?? null,
          reason: ghost?.querySelector('small')?.textContent ?? null,
          requestCount: window.__roomDirectManipulationEvidence.requests.length,
        }; })()`, returnByValue: true,
      }, sessionId);
      const invalidScreenshot = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId, 30_000);
      const invalidGhostPath = outputPath.replace(/\.png$/i, '-direct-invalid-ghost.png');
      await writeFile(invalidGhostPath, Buffer.from(invalidScreenshot.data, 'base64'));
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.validPoint.x,
        y: directPoints.result.value.validPoint.y }, sessionId);
      await delay(50);
      const scrollbarProbeBefore = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const scroll = document.querySelector('.room-canvas-scroll');
          const board = document.querySelector('[data-room-board]');
          const computed = getComputedStyle(scroll);
          const borderHeight = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
          window.__roomDirectManipulationEvidence.scrollbarProbeStyle = {
            height: scroll.style.height, maxHeight: scroll.style.maxHeight,
          };
          scroll.style.maxHeight = 'none';
          scroll.style.height = (scroll.scrollHeight + borderHeight) + 'px';
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          return { gutter: getComputedStyle(scroll).scrollbarGutter, clientWidth: scroll.clientWidth,
            boardLeft: board.getBoundingClientRect().left, overflowY: scroll.scrollHeight > scroll.clientHeight };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.invalidPoint.x,
        y: directPoints.result.value.invalidPoint.y }, sessionId);
      await delay(50);
      const scrollbarProbeAfter = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const scroll = document.querySelector('.room-canvas-scroll');
          const board = document.querySelector('[data-room-board]');
          const measurement = { gutter: getComputedStyle(scroll).scrollbarGutter, clientWidth: scroll.clientWidth,
            boardLeft: board.getBoundingClientRect().left, overflowY: scroll.scrollHeight > scroll.clientHeight };
          const original = window.__roomDirectManipulationEvidence.scrollbarProbeStyle;
          scroll.style.height = original.height; scroll.style.maxHeight = original.maxHeight;
          delete window.__roomDirectManipulationEvidence.scrollbarProbeStyle;
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          return measurement;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const scrollbarStability = { before: scrollbarProbeBefore.result.value, after: scrollbarProbeAfter.result.value };
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.outsidePoint.x,
        y: directPoints.result.value.outsidePoint.y }, sessionId);
      await delay(50);
      const pointerExit = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ ghostPresent: Boolean(document.querySelector('.room-placement-ghost')),
          state: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
          placedCount: document.querySelectorAll('.room-placement').length,
          requestCount: window.__roomDirectManipulationEvidence.requests.length }))()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.validPoint.x,
        y: directPoints.result.value.validPoint.y }, sessionId);
      await delay(50);
      const pointerReentry = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ ghostPresent: Boolean(document.querySelector('.room-placement-ghost')),
          state: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
          placedCount: document.querySelectorAll('.room-placement').length,
          requestCount: window.__roomDirectManipulationEvidence.requests.length }))()`, returnByValue: true,
      }, sessionId);
      const addRetryStart = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          window.__roomDirectManipulationEvidence.rejectNextAdd = true;
          return window.__roomDirectManipulationEvidence.requests.length;
        })()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: directPoints.result.value.validPoint.x, y: directPoints.result.value.validPoint.y }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: directPoints.result.value.validPoint.x, y: directPoints.result.value.validPoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: directPoints.result.value.validPoint.x, y: directPoints.result.value.validPoint.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      const firstUnknownAdd = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${addRetryStart.result.value + 1}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          return { requestCount: window.__roomDirectManipulationEvidence.requests.length,
            state: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
            hint: document.querySelector('.room-canvas-hint')?.textContent ?? null };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const pendingContextGuard = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const controls = [document.querySelector('.room-placement-list [data-room-control="placement-select"]'),
            document.querySelector('[data-room-control="connector-select"]')].filter(Boolean);
          const before = window.__numberdroidStudioVisualTest.roomDirectManipulationState();
          for (const control of controls) control.click();
          return { attempted: controls.map((control) => control.dataset.roomControl), requestCount: window.__roomDirectManipulationEvidence.requests.length,
            before, after: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
            message: document.querySelector('#toast')?.textContent ?? null };
        })()`, returnByValue: true,
      }, sessionId);
      const previewFailure = await devtools.send('Runtime.evaluate', {
        expression: `(() => { const before = window.__roomDirectManipulationEvidence.requests.length;
          const result = window.__numberdroidStudioVisualTest.exerciseRoomPlacementPreviewFailure();
          return { ...result, before, after: window.__roomDirectManipulationEvidence.requests.length };
        })()`, returnByValue: true,
      }, sessionId);
      const exactRetryPoint = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const board = document.querySelector('[data-room-board]'); board.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = document.querySelector('.room-cell[data-x="1"][data-y="0"]').getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: exactRetryPoint.result.value.x, y: exactRetryPoint.result.value.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: exactRetryPoint.result.value.x, y: exactRetryPoint.result.value.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      const exactAddRetry = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${addRetryStart.result.value + 2}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          const requests = window.__roomDirectManipulationEvidence.requests.slice(${addRetryStart.result.value});
          return { requests, sameBody: JSON.stringify(requests[0]?.body) === JSON.stringify(requests[1]?.body),
            state: window.__numberdroidStudioVisualTest.roomDirectManipulationState() };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const persistentBrush = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const paletteSelector = '[data-room-control="palette-asset"][data-palette-asset-id="asset.transfer-apparatus-cp45"]';
          const deadlineForImage = Date.now() + 10_000;
          while (document.querySelector(paletteSelector + ' .asset-preview.ready')?.dataset.previewState !== 'READY'
              && Date.now() < deadlineForImage) await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          document.querySelector(paletteSelector)?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const before = window.__numberdroidStudioVisualTest.roomDirectManipulationState();
          document.querySelector('.room-cell[data-x="2"][data-y="0"]')?.click();
          const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${addRetryStart.result.value + 3}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          const requests = window.__roomDirectManipulationEvidence.requests.slice(${addRetryStart.result.value});
          return { before, after: window.__numberdroidStudioVisualTest.roomDirectManipulationState(), requests };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const authoritativeAddRecovery = await devtools.send('Runtime.evaluate', {
        expression: `window.__numberdroidStudioVisualTest.exerciseRoomPlacementAddRecovery()`, returnByValue: true,
      }, sessionId);
      const placementVisualRotations = await devtools.send('Runtime.evaluate', {
        expression: `window.__numberdroidStudioVisualTest.roomPlacementVisualRotationEvidence()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
      const dragSetup = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          window.__roomDirectManipulationEvidence.syntheticRoomProjection = null;
          document.querySelector('#refresh-button')?.click();
          const refreshDeadline = Date.now() + 10_000;
          while (document.querySelector('#refresh-button')?.disabled && Date.now() < refreshDeadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          const selector = document.querySelector('[data-room-variant-select]'); selector.value = 'room.family-gathering';
          selector.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="SELECT"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const placement = document.querySelector('[data-placement-id="prop.family-table"]');
          const targetCell = document.querySelector('.room-cell[data-x="2"][data-y="2"]');
          placement.scrollIntoView({ block: 'center', inline: 'center' });
          const pointFor = (x, y) => { const rect = document.querySelector('.room-cell[data-x="' + x + '"][data-y="' + y + '"]').getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; };
          const source = placement.getBoundingClientRect(); const target = targetCell.getBoundingClientRect(); const board = document.querySelector('[data-room-board]').getBoundingClientRect();
          return { source: { x: source.left + source.width / 2, y: source.top + source.height / 2 },
            target: { x: target.left + target.width / 2, y: target.top + target.height / 2 },
            invalid: { void: pointFor(0, 0), blocked: pointFor(1, 2), overlap: pointFor(1, 1),
              outside: { x: board.left - 12, y: board.top + board.height / 2 } },
            requestBaseline: window.__roomDirectManipulationEvidence.requests.length };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const sourcePoint = dragSetup.result.value.source; const targetPoint = dragSetup.result.value.target;
      const requestBaseline = dragSetup.result.value.requestBaseline;

      const invalidReleases = {};
      for (const [kind, point] of Object.entries(dragSetup.result.value.invalid)) {
        await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
        await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1 }, sessionId);
        const during = await devtools.send('Runtime.evaluate', {
          expression: `(() => ({ allowed: document.querySelector('.room-placement-ghost')?.dataset.allowed ?? null,
            reason: document.querySelector('.room-placement-ghost small')?.textContent ?? null,
            requestCount: window.__roomDirectManipulationEvidence.requests.length }))()`, returnByValue: true,
        }, sessionId);
        await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
        await delay(75);
        const after = await devtools.send('Runtime.evaluate', {
          expression: `(() => ({ ghostCleared: !document.querySelector('.room-placement-ghost'),
            hint: document.querySelector('.room-canvas-hint')?.textContent ?? null,
            requestCount: window.__roomDirectManipulationEvidence.requests.length }))()`, returnByValue: true,
        }, sessionId);
        invalidReleases[kind] = { during: during.result.value, after: after.result.value };
      }

      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 1 }, sessionId);
      const duringCancelledDrag = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ requestCount: window.__roomDirectManipulationEvidence.requests.length,
          ghost: Boolean(document.querySelector('.room-placement-ghost')) }))()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      const afterCancelledDrag = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ requestCount: window.__roomDirectManipulationEvidence.requests.length,
          ghostCleared: !document.querySelector('.room-placement-ghost'),
          hint: document.querySelector('.room-canvas-hint')?.textContent ?? null,
          state: window.__numberdroidStudioVisualTest.roomDirectManipulationState() }))()`, returnByValue: true,
      }, sessionId);

      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 1 }, sessionId);
      const pointerCancelState = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const state = window.__numberdroidStudioVisualTest.roomDirectManipulationState();
          const target = document.querySelector('[data-placement-id="prop.family-table"]');
          target?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: state.gesturePointerId, pointerType: 'mouse' }));
          return { before: state, after: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
            ghostCleared: !document.querySelector('.room-placement-ghost'), requestCount: window.__roomDirectManipulationEvidence.requests.length };
        })()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);

      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 1 }, sessionId);
      const passiveRefresh = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const evidence = window.__roomDirectManipulationEvidence;
          evidence.liveBoard = document.querySelector('[data-room-board]');
          evidence.liveTarget = document.querySelector('[data-placement-id="prop.family-table"]');
          evidence.liveTarget.focus({ preventScroll: true });
          const scroll = document.querySelector('.room-canvas-scroll');
          const before = { left: scroll.scrollLeft, top: scroll.scrollTop, windowY: window.scrollY,
            requestCount: evidence.requests.length };
          document.querySelector('#refresh-button').click();
          const deadline = Date.now() + 10_000;
          while (document.querySelector('#refresh-button')?.disabled && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          }
          const afterScroll = document.querySelector('.room-canvas-scroll');
          return { before, sameBoard: evidence.liveBoard === document.querySelector('[data-room-board]'),
            sameTarget: evidence.liveTarget === document.querySelector('[data-placement-id="prop.family-table"]'),
            focused: document.activeElement === evidence.liveTarget,
            scroll: { left: afterScroll.scrollLeft, top: afterScroll.scrollTop, windowY: window.scrollY },
            requestCount: evidence.requests.length,
            state: window.__numberdroidStudioVisualTest.roomDirectManipulationState() };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);

      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 1 }, sessionId);
      const staleProjection = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ changed: window.__numberdroidStudioVisualTest.exerciseRoomGestureProjectionChange(),
          state: window.__numberdroidStudioVisualTest.roomDirectManipulationState(),
          ghostCleared: !document.querySelector('.room-placement-ghost'), requestCount: window.__roomDirectManipulationEvidence.requests.length }))()`,
        returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);

      const committedPoints = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const placement = document.querySelector('[data-placement-id="prop.family-table"]');
          placement.scrollIntoView({ block: 'center', inline: 'center' });
          const targetCell = document.querySelector('.room-cell[data-x="2"][data-y="2"]');
          const source = placement.getBoundingClientRect(); const target = targetCell.getBoundingClientRect();
          return { source: { x: source.left + source.width / 2, y: source.top + source.height / 2 },
            target: { x: target.left + target.width / 2, y: target.top + target.height / 2 } };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const committedSource = committedPoints.result.value.source; const committedTarget = committedPoints.result.value.target;
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: committedSource.x, y: committedSource.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      for (const ratio of [.25, .5, .75, 1]) {
        await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved',
          x: committedSource.x + (committedTarget.x - committedSource.x) * ratio,
          y: committedSource.y + (committedTarget.y - committedSource.y) * ratio, button: 'left', buttons: 1 }, sessionId);
      }
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR' }, sessionId);
      const duringCommittedDrag = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ requestCount: window.__roomDirectManipulationEvidence.requests.length,
          allowed: document.querySelector('.room-placement-ghost')?.dataset.allowed ?? null,
          state: window.__numberdroidStudioVisualTest.roomDirectManipulationState() }))()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: committedTarget.x, y: committedTarget.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      await devtools.send('Runtime.evaluate', {
        expression: `(async () => { const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${requestBaseline + 1}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          } return true; })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);

      const unrelatedShortcut = await devtools.send('Runtime.evaluate', {
        expression: `(() => { document.querySelector('#refresh-button').focus(); return {
          requestCount: window.__roomDirectManipulationEvidence.requests.length,
          selectedPlacementId: window.__numberdroidStudioVisualTest.roomDirectManipulationState().selectedPlacementId }; })()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' }, sessionId);
      const afterUnrelatedShortcut = await devtools.send('Runtime.evaluate', {
        expression: `(() => ({ requestCount: window.__roomDirectManipulationEvidence.requests.length,
          selectedPlacementId: window.__numberdroidStudioVisualTest.roomDirectManipulationState().selectedPlacementId }))()`, returnByValue: true,
      }, sessionId);

      await devtools.send('Runtime.evaluate', {
        expression: `document.querySelector('[data-placement-id="prop.family-table"]')?.focus({ preventScroll: true })`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR' }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR' }, sessionId);
      await devtools.send('Runtime.evaluate', {
        expression: `(async () => { const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${requestBaseline + 2}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          } return true; })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const inspectorMovePoint = await devtools.send('Runtime.evaluate', {
        expression: `(() => { const button = document.querySelector('[data-room-control="move-placement"][data-dx="0"][data-dy="1"]');
          button?.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = button?.getBoundingClientRect(); return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null; })()`, returnByValue: true,
      }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: inspectorMovePoint.result.value.x, y: inspectorMovePoint.result.value.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: inspectorMovePoint.result.value.x, y: inspectorMovePoint.result.value.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      await devtools.send('Runtime.evaluate', {
        expression: `(async () => { const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${requestBaseline + 3}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          } return true; })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const clearPoint = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          window.confirm = () => true;
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="CLEAR"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const target = document.querySelector('[data-placement-id="prop.family-table"]');
          target?.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = target?.getBoundingClientRect();
          return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
            activeTool: document.querySelector('[data-room-control="editor-tool"][data-selected="true"]')?.dataset.editorTool ?? null } : null;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clearPoint.result.value.x, y: clearPoint.result.value.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clearPoint.result.value.x, y: clearPoint.result.value.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      await devtools.send('Runtime.evaluate', {
        expression: `(async () => { const deadline = Date.now() + 10_000;
          while ((window.__roomDirectManipulationEvidence.requests.length < ${requestBaseline + 4}
              || document.querySelector('#refresh-button')?.disabled) && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          } return true; })()`, awaitPromise: true, returnByValue: true,
      }, sessionId, 20_000);
      const afterDrag = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const evidence = window.__roomDirectManipulationEvidence;
          const requests = evidence.requests.slice(${requestBaseline}).map(({ url, method, body }) => ({ url, method, body }));
          const slider = document.querySelector('[data-room-zoom-slider]'); slider.value = '1000';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const scroll = document.querySelector('.room-canvas-scroll'); scroll.scrollLeft = 250; scroll.scrollTop = 120;
          scroll.scrollIntoView({ block: 'center', inline: 'center' });
          const scrollRect = scroll.getBoundingClientRect();
          const panPoint = { x: scrollRect.left + scrollRect.width / 2, y: scrollRect.top + scrollRect.height / 2 };
          return { requests, ghostCleared: !document.querySelector('.room-placement-ghost'), clearTool: ${JSON.stringify(clearPoint.result.value)},
            selectedPlacementId: document.querySelector('.room-placement[data-selected="true"]')?.dataset.placementId ?? null,
            panStart: { left: scroll.scrollLeft, top: scroll.scrollTop },
            scrollRange: { x: scroll.scrollWidth - scroll.clientWidth, y: scroll.scrollHeight - scroll.clientHeight },
            panPoint, panTargetInside: document.elementFromPoint(panPoint.x, panPoint.y)?.closest('.room-canvas-scroll') === scroll };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const panPoint = afterDrag.result.value.panPoint;
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: panPoint.x, y: panPoint.y, button: 'middle', buttons: 4, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: panPoint.x + 35, y: panPoint.y + 25, button: 'middle', buttons: 4 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: panPoint.x + 35, y: panPoint.y + 25, button: 'middle', buttons: 0, clickCount: 1 }, sessionId);
      const panAndRestore = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const evidence = window.__roomDirectManipulationEvidence; const scroll = document.querySelector('.room-canvas-scroll');
          const pan = { left: scroll.scrollLeft, top: scroll.scrollTop, panning: scroll.dataset.panning ?? null,
            requestCount: evidence.requests.length, semanticRequestCount: evidence.requests.length - ${requestBaseline} };
          window.fetch = evidence.originalFetch;
          document.querySelector('[data-room-control="zoom"][data-room-zoom="fit"]')?.click();
          document.querySelector('[data-room-control="editor-tool"][data-editor-tool="PAINT_ROOM"]')?.click();
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const fittedScroll = document.querySelector('.room-canvas-scroll'); const board = fittedScroll.querySelector('[data-room-board]');
          const computed = getComputedStyle(fittedScroll);
          const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
          const verticalPadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
          const verticalBorder = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
          const availableWidth = fittedScroll.clientWidth - horizontalPadding;
          const availableHeight = parseFloat(computed.maxHeight)
            - (computed.boxSizing === 'border-box' ? verticalBorder + verticalPadding : 0);
          const roomWidth = Number(board.style.getPropertyValue('--room-width'));
          const roomHeight = Number(board.style.getPropertyValue('--room-height'));
          const cell = parseFloat(board.style.getPropertyValue('--room-cell'));
          const expected = Math.max(2, Math.min(380, Math.floor(Math.min(availableWidth / roomWidth, availableHeight / roomHeight))));
          const boardRect = board.getBoundingClientRect();
          return { ...pan, fit: { cell, expected, largerWouldOverflow: (cell + 1) * roomWidth > availableWidth
            || (cell + 1) * roomHeight > availableHeight,
          boardContained: boardRect.width <= fittedScroll.clientWidth - horizontalPadding + .5
            && boardRect.height <= fittedScroll.clientHeight - verticalPadding + .5,
          output: document.querySelector('[data-room-zoom-value]')?.textContent ?? null } };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      checkpoint45DirectManipulation = {
        setup: directSetup.result.value,
        validGhost: validGhost.result.value, invalidGhost: invalidGhost.result.value,
        scrollbarStability,
        firstUnknownAdd: firstUnknownAdd.result.value, pendingContextGuard: pendingContextGuard.result.value,
        exactAddRetry: exactAddRetry.result.value,
        pointerExit: pointerExit.result.value, pointerReentry: pointerReentry.result.value,
        persistentBrush: persistentBrush.result.value,
        authoritativeAddRecovery: authoritativeAddRecovery.result.value,
        placementVisualRotations: placementVisualRotations.result.value,
        previewFailure: previewFailure.result.value,
        invalidReleases, cancelledDrag: { during: duringCancelledDrag.result.value, after: afterCancelledDrag.result.value },
        pointerCancel: pointerCancelState.result.value, passiveRefresh: passiveRefresh.result.value,
        staleProjection: staleProjection.result.value, committedDrag: duringCommittedDrag.result.value,
        unrelatedShortcut: { before: unrelatedShortcut.result.value, after: afterUnrelatedShortcut.result.value },
        afterDrag: afterDrag.result.value, pan: panAndRestore.result.value,
        screenshots: { validGhostPath, invalidGhostPath },
      };
      assert(checkpoint45DirectManipulation.setup?.dirtyGuard?.requestCount === 0
        && checkpoint45DirectManipulation.setup.dirtyGuard.state?.pendingPlacementAdd === null
        && checkpoint45DirectManipulation.setup.dirtyGuard.message?.includes('Save or discard')
        && checkpoint45DirectManipulation.setup.surfaceResize?.resizeBefore.visible === true
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.disabled === false
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.guidance?.includes('exact saved room version')
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeAfter.width === checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.width + 2
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeAfter.height === checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.height
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeRequests?.length === 1
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeRequests[0].url.endsWith('/rooms/hall.service-east-west/resize')
        && checkpoint45DirectManipulation.setup.surfaceResize.resizeRequests[0].body.width
          === checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.width + 2
        && checkpoint45DirectManipulation.setup.surfaceResize.requests?.length === 2
        && checkpoint45DirectManipulation.setup.surfaceResize.requests.every(({ url, body }) => url.endsWith('/placements-add')
          && body.placements?.[0]?.layer === 'STRUCTURAL_SURFACE'
          && body.placements[0].assetId === 'asset.family-hygiene.1')
        && checkpoint45DirectManipulation.setup.surfaceResize.requests[0].body.placements[0].anchor.x
          === checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.width
        && checkpoint45DirectManipulation.setup.surfaceResize.requests[1].body.placements[0].anchor.x
          === checkpoint45DirectManipulation.setup.surfaceResize.resizeBefore.width + 1
        && checkpoint45DirectManipulation.setup.surfaceResize.requests[0].body.idempotencyKey
          !== checkpoint45DirectManipulation.setup.surfaceResize.requests[1].body.idempotencyKey
        && checkpoint45DirectManipulation.setup.surfaceResize.requests[0].body.placements[0].placementId
          !== checkpoint45DirectManipulation.setup.surfaceResize.requests[1].body.placements[0].placementId
        && checkpoint45DirectManipulation.setup.surfaceResize.state?.selectedPaletteAssetId === 'asset.family-hygiene.1'
        && checkpoint45DirectManipulation.setup.directSelection?.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.setup.directSelection.selectedPaletteAssetPin?.assetVersion
        && checkpoint45DirectManipulation.setup.useControlPresent === false
        && checkpoint45DirectManipulation.validGhost?.allowed === 'true'
        && checkpoint45DirectManipulation.validGhost.cellsWide === 3
        && checkpoint45DirectManipulation.validGhost.cellsHigh === 2
        && checkpoint45DirectManipulation.validGhost.rotation?.includes('90°')
        && checkpoint45DirectManipulation.invalidGhost?.allowed === 'false'
        && checkpoint45DirectManipulation.invalidGhost.cue?.includes('blocked')
        && checkpoint45DirectManipulation.invalidGhost.reason?.includes('exceeds the room bounds')
        && checkpoint45DirectManipulation.scrollbarStability?.before?.gutter === 'stable'
        && checkpoint45DirectManipulation.scrollbarStability.before.overflowY === false
        && checkpoint45DirectManipulation.scrollbarStability.after.gutter === 'stable'
        && checkpoint45DirectManipulation.scrollbarStability.after.overflowY === true
        && checkpoint45DirectManipulation.scrollbarStability.after.clientWidth
          === checkpoint45DirectManipulation.scrollbarStability.before.clientWidth
        && Math.abs(checkpoint45DirectManipulation.scrollbarStability.after.boardLeft
          - checkpoint45DirectManipulation.scrollbarStability.before.boardLeft) <= .5
        && checkpoint45DirectManipulation.pointerExit?.ghostPresent === false
        && checkpoint45DirectManipulation.pointerExit.state?.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.pointerExit.state.selectedPaletteAssetPin?.assetVersion === 1
        && checkpoint45DirectManipulation.pointerExit.state.placementRotation === 90
        && checkpoint45DirectManipulation.pointerExit.state.placementHover === null
        && checkpoint45DirectManipulation.pointerExit.state.pendingPlacementAdd === null
        && checkpoint45DirectManipulation.pointerExit.state.gestureActive === false
        && checkpoint45DirectManipulation.pointerExit.requestCount === checkpoint45DirectManipulation.invalidGhost.requestCount
        && checkpoint45DirectManipulation.pointerReentry?.ghostPresent === true
        && checkpoint45DirectManipulation.pointerReentry.state?.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.pointerReentry.state.placementRotation === 90
        && checkpoint45DirectManipulation.pointerReentry.requestCount === checkpoint45DirectManipulation.pointerExit.requestCount
        && checkpoint45DirectManipulation.pointerReentry.placedCount === checkpoint45DirectManipulation.pointerExit.placedCount
        && checkpoint45DirectManipulation.firstUnknownAdd?.state?.pendingPlacementAdd
        && checkpoint45DirectManipulation.firstUnknownAdd.hint?.includes('not yet confirmed')
        && checkpoint45DirectManipulation.pendingContextGuard?.attempted?.join(',') === 'placement-select,connector-select'
        && checkpoint45DirectManipulation.pendingContextGuard.requestCount === checkpoint45DirectManipulation.firstUnknownAdd.requestCount
        && checkpoint45DirectManipulation.pendingContextGuard.after?.pendingPlacementAdd
        && checkpoint45DirectManipulation.pendingContextGuard.after.selectedPaletteAssetId === checkpoint45DirectManipulation.pendingContextGuard.before.selectedPaletteAssetId
        && JSON.stringify(checkpoint45DirectManipulation.pendingContextGuard.after.selectedPaletteAssetPin)
          === JSON.stringify(checkpoint45DirectManipulation.pendingContextGuard.before.selectedPaletteAssetPin)
        && checkpoint45DirectManipulation.pendingContextGuard.after.selectedPlacementId
          === checkpoint45DirectManipulation.pendingContextGuard.before.selectedPlacementId
        && checkpoint45DirectManipulation.pendingContextGuard.after.selectedConnectorId
          === checkpoint45DirectManipulation.pendingContextGuard.before.selectedConnectorId
        && checkpoint45DirectManipulation.pendingContextGuard.message?.includes('original cell again')
        && checkpoint45DirectManipulation.exactAddRetry?.requests?.length === 2
        && checkpoint45DirectManipulation.exactAddRetry.sameBody === true
        && checkpoint45DirectManipulation.exactAddRetry.requests[0].body.idempotencyKey === checkpoint45DirectManipulation.exactAddRetry.requests[1].body.idempotencyKey
        && checkpoint45DirectManipulation.exactAddRetry.requests[0].body.placements?.[0]?.placementId === checkpoint45DirectManipulation.exactAddRetry.requests[1].body.placements?.[0]?.placementId
        && checkpoint45DirectManipulation.exactAddRetry.state?.pendingPlacementAdd === null
        && checkpoint45DirectManipulation.exactAddRetry.state.selectedPaletteAssetId === null
        && checkpoint45DirectManipulation.exactAddRetry.state.selectedPlacementId === null
        && checkpoint45DirectManipulation.persistentBrush?.requests?.length === 3
        && checkpoint45DirectManipulation.persistentBrush.before?.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.persistentBrush.after?.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.persistentBrush.after.selectedPlacementId === null
        && checkpoint45DirectManipulation.persistentBrush.requests[2].url.endsWith('/placements-add')
        && checkpoint45DirectManipulation.persistentBrush.requests[1].body.idempotencyKey !== checkpoint45DirectManipulation.persistentBrush.requests[2].body.idempotencyKey
        && checkpoint45DirectManipulation.persistentBrush.requests[1].body.placements?.[0]?.placementId !== checkpoint45DirectManipulation.persistentBrush.requests[2].body.placements?.[0]?.placementId
        && checkpoint45DirectManipulation.authoritativeAddRecovery?.pendingPlacementAdd === null
        && checkpoint45DirectManipulation.authoritativeAddRecovery?.selectedPlacementId === null
        && checkpoint45DirectManipulation.authoritativeAddRecovery.selectedPaletteAssetId === 'asset.transfer-apparatus-cp45'
        && checkpoint45DirectManipulation.authoritativeAddRecovery.message?.includes('authoritative reload confirmed')
        && checkpoint45DirectManipulation.placementVisualRotations?.length === 4
        && checkpoint45DirectManipulation.placementVisualRotations.every(({ contained }) => contained === true)
        && new Set(checkpoint45DirectManipulation.placementVisualRotations.map(({ transform }) => transform)).size === 4
        && checkpoint45DirectManipulation.previewFailure?.armedBefore === true
        && checkpoint45DirectManipulation.previewFailure.ghostBefore === true
        && checkpoint45DirectManipulation.previewFailure.selectedPaletteAssetId === null
        && checkpoint45DirectManipulation.previewFailure.selectedPaletteAssetPin === null
        && checkpoint45DirectManipulation.previewFailure.placementRotation === 0
        && checkpoint45DirectManipulation.previewFailure.boardPlacementEditing === false
        && checkpoint45DirectManipulation.previewFailure.boardPendingRecovery === true
        && checkpoint45DirectManipulation.previewFailure.ghostAfter === true
        && checkpoint45DirectManipulation.previewFailure.pendingRecoveryGhost === true
        && checkpoint45DirectManipulation.previewFailure.pendingPlacementAdd?.anchor.x === 1
        && checkpoint45DirectManipulation.previewFailure.pendingPlacementAdd.anchor.y === 0
        && checkpoint45DirectManipulation.previewFailure.pendingPlacementAdd.rotation === 90
        && checkpoint45DirectManipulation.previewFailure.before === checkpoint45DirectManipulation.previewFailure.after
        && checkpoint45DirectManipulation.previewFailure.message?.includes('original cell again')
        && Object.values(checkpoint45DirectManipulation.invalidReleases).every(({ during, after }) => (
          during.allowed === 'false' && during.requestCount === requestBaseline
            && after.requestCount === requestBaseline && after.ghostCleared === true
            && after.hint?.includes('Drag the selected placement')
        ))
        && checkpoint45DirectManipulation.invalidReleases.void.during.reason?.includes('outside-room cell')
        && checkpoint45DirectManipulation.invalidReleases.blocked.during.reason?.includes('blocked')
        && checkpoint45DirectManipulation.invalidReleases.overlap.during.reason?.includes('overlap')
        && checkpoint45DirectManipulation.invalidReleases.outside.during.reason?.includes('Release inside the room board')
        && checkpoint45DirectManipulation.cancelledDrag.during?.requestCount === requestBaseline
        && checkpoint45DirectManipulation.cancelledDrag.during.ghost === true
        && checkpoint45DirectManipulation.cancelledDrag.after?.requestCount === requestBaseline
        && checkpoint45DirectManipulation.cancelledDrag.after.ghostCleared === true
        && checkpoint45DirectManipulation.cancelledDrag.after.state?.gestureActive === false
        && checkpoint45DirectManipulation.pointerCancel?.before?.gestureActive === true
        && checkpoint45DirectManipulation.pointerCancel.after?.gestureActive === false
        && checkpoint45DirectManipulation.pointerCancel.ghostCleared === true
        && checkpoint45DirectManipulation.pointerCancel.requestCount === requestBaseline
        && checkpoint45DirectManipulation.passiveRefresh?.sameBoard === true
        && checkpoint45DirectManipulation.passiveRefresh.sameTarget === true
        && checkpoint45DirectManipulation.passiveRefresh.focused === true
        && checkpoint45DirectManipulation.passiveRefresh.state?.gestureActive === true
        && checkpoint45DirectManipulation.passiveRefresh.requestCount === requestBaseline
        && checkpoint45DirectManipulation.passiveRefresh.scroll.left === checkpoint45DirectManipulation.passiveRefresh.before.left
        && checkpoint45DirectManipulation.passiveRefresh.scroll.top === checkpoint45DirectManipulation.passiveRefresh.before.top
        && checkpoint45DirectManipulation.passiveRefresh.scroll.windowY === checkpoint45DirectManipulation.passiveRefresh.before.windowY
        && checkpoint45DirectManipulation.staleProjection?.changed?.gestureActive === false
        && checkpoint45DirectManipulation.staleProjection.changed.targetHadCapture === false
        && checkpoint45DirectManipulation.staleProjection.state?.gestureActive === false
        && checkpoint45DirectManipulation.staleProjection.ghostCleared === true
        && checkpoint45DirectManipulation.staleProjection.requestCount === requestBaseline
        && checkpoint45DirectManipulation.committedDrag?.requestCount === requestBaseline
        && checkpoint45DirectManipulation.committedDrag.allowed === 'true'
        && checkpoint45DirectManipulation.committedDrag.state?.gestureRotation === 90
        && checkpoint45DirectManipulation.unrelatedShortcut.before?.requestCount === requestBaseline + 1
        && checkpoint45DirectManipulation.unrelatedShortcut.after?.requestCount === requestBaseline + 1
        && checkpoint45DirectManipulation.unrelatedShortcut.after.selectedPlacementId === checkpoint45DirectManipulation.unrelatedShortcut.before.selectedPlacementId
        && checkpoint45DirectManipulation.afterDrag?.requests?.length === 4
        && checkpoint45DirectManipulation.afterDrag.requests[0].url.endsWith('/placements-move')
        && checkpoint45DirectManipulation.afterDrag.requests[0].body.moves?.[0]?.placementId === 'prop.family-table'
        && checkpoint45DirectManipulation.afterDrag.requests[0].body.moves[0].anchor?.x === 2
        && checkpoint45DirectManipulation.afterDrag.requests[0].body.moves[0].anchor?.y === 2
        && checkpoint45DirectManipulation.afterDrag.requests[0].body.moves[0].rotation === 90
        && checkpoint45DirectManipulation.afterDrag.requests[1].url.endsWith('/placements-move')
        && checkpoint45DirectManipulation.afterDrag.requests[1].body.moves?.[0]?.rotation === 90
        && checkpoint45DirectManipulation.afterDrag.requests[2].url.endsWith('/placements-move')
        && checkpoint45DirectManipulation.afterDrag.requests[2].body.moves?.[0]?.anchor?.y === 2
        && checkpoint45DirectManipulation.afterDrag.requests[3].url.endsWith('/placements-remove')
        && checkpoint45DirectManipulation.afterDrag.requests[3].body.placements?.[0]?.placementId === 'prop.family-table'
        && checkpoint45DirectManipulation.afterDrag.clearTool?.activeTool === 'CLEAR'
        && checkpoint45DirectManipulation.afterDrag.ghostCleared === true
        && checkpoint45DirectManipulation.afterDrag.panTargetInside === true
        && checkpoint45DirectManipulation.afterDrag.scrollRange.x > 0
        && checkpoint45DirectManipulation.afterDrag.scrollRange.y > 0
        && checkpoint45DirectManipulation.pan?.semanticRequestCount === 4
        && checkpoint45DirectManipulation.pan.panning === null
        && checkpoint45DirectManipulation.pan.fit?.cell === checkpoint45DirectManipulation.pan.fit?.expected
        && checkpoint45DirectManipulation.pan.fit.cell > 28
        && checkpoint45DirectManipulation.pan.fit.largerWouldOverflow === true
        && checkpoint45DirectManipulation.pan.fit.boardContained === true
        && checkpoint45DirectManipulation.pan.fit.output?.startsWith('Fit · ')
        && (checkpoint45DirectManipulation.pan.left !== checkpoint45DirectManipulation.afterDrag.panStart.left
          || checkpoint45DirectManipulation.pan.top !== checkpoint45DirectManipulation.afterDrag.panStart.top),
      `Checkpoint 4.5 direct manipulation did not preserve transient, single-command, cancellation, ghost, or middle-pan semantics: ${JSON.stringify(checkpoint45DirectManipulation)}`);
      checkpoint45RoomFocus.tool = 'PAINT_ROOM';
    }
  }
  if (mode === 'checkpoint-2a' && expectedWorkspace === 'sources') {
    const patternValidity = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('[data-source-intake-form] [name="sourceId"]');
        const priorValue = input.value;
        input.value = 'source.family_hygiene:floor-01';
        const valid = { checkValidity: input.checkValidity(), patternMismatch: input.validity.patternMismatch };
        input.value = 'source/path';
        const invalid = { checkValidity: input.checkValidity(), patternMismatch: input.validity.patternMismatch };
        input.value = priorValue;
        return { pattern: input.pattern, valid, invalid, priorValue, restoredValue: input.value };
      })()`,
      returnByValue: true,
    }, sessionId);
    sourceIdPatternValidity = patternValidity.result?.value ?? null;
    assert(sourceIdPatternValidity?.pattern === '[A-Za-z0-9][A-Za-z0-9._:\\-]{0,127}'
      && sourceIdPatternValidity.valid?.checkValidity === true
      && sourceIdPatternValidity.valid.patternMismatch === false
      && sourceIdPatternValidity.invalid?.checkValidity === false
      && sourceIdPatternValidity.invalid.patternMismatch === true
      && sourceIdPatternValidity.restoredValue === sourceIdPatternValidity.priorValue,
    'Chrome did not enforce the source ID UnicodeSets pattern with a literal escaped hyphen.');
    await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        if (document.getElementById('source-preview-aspect-probes')) return;
        const probes = document.createElement('div');
        probes.id = 'source-preview-aspect-probes';
        probes.setAttribute('aria-hidden', 'true');
        probes.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
        const addProbe = async (name, width, height, mediaType) => {
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').fillRect(0, 0, width, height);
          const frame = document.createElement('figure'); frame.className = 'source-preview-frame';
          const preview = document.createElement('a'); preview.className = 'source-preview ready';
          preview.dataset.probe = name; preview.dataset.mediaType = mediaType;
          const image = document.createElement('img'); image.src = canvas.toDataURL(mediaType);
          preview.append(image); frame.append(preview); probes.append(frame);
          await image.decode();
        };
        document.body.append(probes);
        await addProbe('extreme-wide-png', 4096, 1, 'image/png');
        await addProbe('extreme-tall-webp', 1, 4096, 'image/webp');
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const retention = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const original = document.querySelector('[data-source-intake-form] [data-source-file]');
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])],
          'family-hygiene-floor-approved.png', { type: 'image/png' }));
        original.files = transfer.files;
        original.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('refresh-button').click();
        const deadline = Date.now() + 5000;
        while (document.getElementById('refresh-button').disabled && Date.now() < deadline) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 20));
        }
        const current = document.querySelector('[data-source-intake-form] [data-source-file]');
        const result = {
          sameNode: current === original,
          connected: original.isConnected,
          fileCount: current?.files?.length ?? 0,
          fileName: current?.files?.[0]?.name ?? null,
          status: current?.closest('[data-source-intake-form]')?.querySelector('[data-source-status]')?.textContent ?? null,
        };
        current.value = '';
        current.dispatchEvent(new Event('change', { bubbles: true }));
        return result;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    sourceFileRefreshRetention = retention.result?.value ?? null;
    assert(sourceFileRefreshRetention?.sameNode === true
      && sourceFileRefreshRetention.connected === true
      && sourceFileRefreshRetention.fileCount === 1
      && sourceFileRefreshRetention.fileName === 'family-hygiene-floor-approved.png'
      && sourceFileRefreshRetention.status?.includes('Ready to import'),
    'A same-project refresh replaced or cleared the selected source file input.');
    if (checkpoint2aFocus === 'staged-intake') {
      const syntheticEventStart = devtools.events.length;
      const isolation = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          const operationProjectId = document.documentElement.dataset.visualProjectId;
          const operationRevision = Number(document.documentElement.dataset.visualRevision);
          const encodedProjectId = encodeURIComponent(operationProjectId);
          const originalFetch = window.fetch.bind(window);
          const requests = [];
          let phase = 'delayed';
          let releaseUpload;
          const uploadGate = new Promise((resolveUpload) => { releaseUpload = resolveUpload; });
          const response = (body, status = 200) => new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          });
          window.fetch = async (input, init = {}) => {
            const url = typeof input === 'string' ? input : input.url;
            const method = String(init.method ?? 'GET').toUpperCase();
            if (method === 'POST' && url === \`/api/projects/\${encodedProjectId}/source-intakes\`) {
              const headers = new Headers(init.headers);
              requests.push({
                phase,
                kind: 'stage',
                url,
                csrfPresent: Boolean(headers.get('x-numberdroid-studio-csrf')),
                idempotencyPresent: Boolean(headers.get('x-numberdroid-idempotency-key')),
                csrf: headers.get('x-numberdroid-studio-csrf'),
              });
              if (phase === 'delayed') await uploadGate;
              return response({
                schemaVersion: 1,
                projectId: phase === 'mismatch' ? 'project.cross-context-probe' : operationProjectId,
                intakeId: \`intake.\${phase}.context-probe\`,
                state: 'STAGED',
                origin: 'human_upload',
                artifact: {
                  uri: \`cas://sha256/\${'a'.repeat(64)}\`, mediaType: 'image/png',
                  byteSize: 8, width: 1, height: 1,
                },
              }, 201);
            }
            if (method === 'POST' && url === \`/api/projects/\${encodedProjectId}/sources\`) {
              const headers = new Headers(init.headers);
              requests.push({
                phase,
                kind: 'commit',
                url,
                csrfPresent: Boolean(headers.get('x-numberdroid-studio-csrf')),
                idempotencyPresent: Boolean(JSON.parse(init.body).idempotencyKey),
                csrf: headers.get('x-numberdroid-studio-csrf'),
                body: JSON.parse(init.body),
              });
              if (phase === 'commit-failure') {
                return response({ error: { code: 'REVISION_CONFLICT', message: 'Injected commit failure.' } }, 409);
              }
              return response({ schemaVersion: 1, projectId: operationProjectId, revision: operationRevision + 1 });
            }
            if (method === 'GET' && phase === 'commit-failure'
              && url === \`/api/projects/\${encodedProjectId}/source-intakes\`) {
              return response({
                schemaVersion: 1,
                projectId: operationProjectId,
                intakes: [{
                  schemaVersion: 1,
                  projectId: operationProjectId,
                  intakeId: 'intake.commit-failure.context-probe',
                  state: 'STAGED',
                  origin: 'human_upload',
                  intake: {
                    artifact: {
                      uri: \`cas://sha256/\${'a'.repeat(64)}\`, mediaType: 'image/png',
                      byteSize: 8, width: 1, height: 1,
                    },
                  },
                }],
              });
            }
            return originalFetch(input, init);
          };

          const configureForm = (name) => {
            const form = document.querySelector('[data-source-intake-form]');
            form.querySelector('[name="sourceId"]').value = \`source.\${name}.context-probe\`;
            form.querySelector('[name="name"]').value = \`\${name} context probe\`;
            const file = form.querySelector('[data-source-file]');
            const transfer = new DataTransfer();
            transfer.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
              \`\${name}-context-probe.png\`, { type: 'image/png' }));
            file.files = transfer.files;
            file.dispatchEvent(new Event('change', { bubbles: true }));
            return form;
          };
          const waitFor = async (predicate, message) => {
            const deadline = Date.now() + 5000;
            while (!predicate() && Date.now() < deadline) {
              await new Promise((resolveWait) => setTimeout(resolveWait, 20));
            }
            if (!predicate()) throw new Error(message);
          };

          const delayedForm = configureForm('delayed');
          delayedForm.requestSubmit();
          await waitFor(() => document.getElementById('project-select').disabled,
            'Source import did not enter its operation lock.');
          const liveStatus = delayedForm.querySelector('[role="status"][aria-live="polite"]');
          const pending = {
            allFormControlsDisabled: [...delayedForm.elements].every((control) => control.disabled),
            liveStatusOutsideInert: !liveStatus.closest('[inert]'),
            projectSelectDisabled: document.getElementById('project-select').disabled,
            refreshDisabled: document.getElementById('refresh-button').disabled,
            demoDisabled: document.getElementById('demo-button').disabled,
            sourceActionsDisabled: [...document.querySelectorAll(
              '[data-resume-source-intake], [data-discard-source-intake], [data-source-review-propose], '
                + '[data-source-review-decision], [data-open-cutter]',
            )].every((control) => control.disabled),
          };
          const projectSelect = document.getElementById('project-select');
          const crossProjectOption = document.createElement('option');
          crossProjectOption.value = 'project.cross-context-probe';
          crossProjectOption.textContent = 'Cross-context probe';
          projectSelect.append(crossProjectOption);
          projectSelect.value = crossProjectOption.value;
          projectSelect.dispatchEvent(new Event('change', { bubbles: true }));
          document.getElementById('refresh-button').click();
          document.getElementById('demo-button').click();
          const selectedProjectWhilePending = projectSelect.value;
          releaseUpload();
          await waitFor(() => !projectSelect.disabled, 'Source import did not release its operation lock.');
          crossProjectOption.remove();
          const delayedRequests = requests.filter((request) => request.phase === 'delayed');
          const delayedStage = delayedRequests.find((request) => request.kind === 'stage');
          const delayedCommit = delayedRequests.find((request) => request.kind === 'commit');

          phase = 'mismatch';
          const mismatchForm = configureForm('mismatch');
          mismatchForm.requestSubmit();
          await waitFor(() => projectSelect.disabled, 'Cross-project response probe did not start.');
          await waitFor(() => !projectSelect.disabled, 'Cross-project response probe did not settle.');
          const mismatchRequests = requests.filter((request) => request.phase === 'mismatch');
          const mismatchStatus = mismatchForm.querySelector('[data-source-status]');
          const mismatchResult = {
            stageCount: mismatchRequests.filter((request) => request.kind === 'stage').length,
            commitCount: mismatchRequests.filter((request) => request.kind === 'commit').length,
            rejected: mismatchStatus?.textContent?.startsWith('SOURCE_INTAKE_CONTEXT_CHANGED:') ?? false,
            liveStatusOutsideInert: !mismatchStatus.closest('[inert]'),
          };

          phase = 'commit-failure';
          const failedCommitForm = configureForm('commit-failure');
          const failedCommitFile = failedCommitForm.querySelector('[data-source-file]');
          failedCommitForm.requestSubmit();
          await waitFor(() => projectSelect.disabled, 'Commit-failure recovery probe did not start.');
          await waitFor(() => !projectSelect.disabled, 'Commit-failure recovery probe did not settle.');
          const recoveryForm = document.querySelector('[data-source-intake-form]');
          const recoveryFile = recoveryForm.querySelector('[data-source-file]');
          const recoveryStatus = recoveryForm.querySelector('[data-source-status]');
          const failedCommitRequests = requests.filter((request) => request.phase === 'commit-failure');
          const commitFailureRecovery = {
            stageCount: failedCommitRequests.filter((request) => request.kind === 'stage').length,
            commitCount: failedCommitRequests.filter((request) => request.kind === 'commit').length,
            replaced: recoveryForm !== failedCommitForm,
            oldConnected: failedCommitForm.isConnected,
            oldFileCount: failedCommitFile.files.length,
            heading: recoveryForm.querySelector('h2')?.textContent ?? null,
            currentFileCount: recoveryFile.files.length,
            currentFileDisabled: recoveryFile.disabled,
            status: recoveryStatus?.textContent ?? null,
            liveStatusOutsideInert: !recoveryStatus.closest('[inert]'),
          };
          window.fetch = originalFetch;
          document.getElementById('refresh-button').click();
          await waitFor(() => !document.getElementById('refresh-button').disabled
            && document.querySelector('[data-source-intake-form] h2')?.textContent === 'Import source',
          'Synthetic failed-commit recovery context did not clear after a trusted refresh.');
          document.getElementById('toast').classList.remove('visible');
          return {
            operationProjectId,
            operationRevision,
            pending,
            selectedProjectWhilePending,
            delayedStageCount: delayedRequests.filter((request) => request.kind === 'stage').length,
            delayedCommitCount: delayedRequests.filter((request) => request.kind === 'commit').length,
            pathsPinned: delayedRequests.every((request) => request.url.includes(\`/projects/\${encodedProjectId}/\`)),
            csrfPinned: delayedStage?.csrfPresent === true && delayedStage.csrf === delayedCommit?.csrf,
            idempotencyPinned: delayedStage?.idempotencyPresent === true && delayedCommit?.idempotencyPresent === true,
            expectedRevision: delayedCommit?.body?.expectedRevision ?? null,
            revisionLabelAfter: document.getElementById('revision-label')?.textContent ?? null,
            mismatch: mismatchResult,
            commitFailureRecovery,
          };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      sourceImportOperationIsolation = isolation.result?.value ?? null;
      assert(sourceImportOperationIsolation?.pending?.allFormControlsDisabled === true
        && sourceImportOperationIsolation.pending.liveStatusOutsideInert === true
        && sourceImportOperationIsolation.pending.projectSelectDisabled === true
        && sourceImportOperationIsolation.pending.refreshDisabled === true
        && sourceImportOperationIsolation.pending.demoDisabled === true
        && sourceImportOperationIsolation.pending.sourceActionsDisabled === true,
      'Source import did not lock every context-changing or mutable form control while preserving its live status.');
      assert(sourceImportOperationIsolation.selectedProjectWhilePending === sourceImportOperationIsolation.operationProjectId
        && sourceImportOperationIsolation.delayedStageCount === 1
        && sourceImportOperationIsolation.delayedCommitCount === 1
        && sourceImportOperationIsolation.pathsPinned === true
        && sourceImportOperationIsolation.csrfPinned === true
        && sourceImportOperationIsolation.idempotencyPinned === true
        && sourceImportOperationIsolation.expectedRevision === sourceImportOperationIsolation.operationRevision
        && sourceImportOperationIsolation.revisionLabelAfter === `Revision ${sourceImportOperationIsolation.operationRevision}`,
      'Delayed source import escaped its captured project, revision, CSRF, or idempotency context.');
      assert(sourceImportOperationIsolation.mismatch?.stageCount === 1
        && sourceImportOperationIsolation.mismatch.commitCount === 0
        && sourceImportOperationIsolation.mismatch.rejected === true
        && sourceImportOperationIsolation.mismatch.liveStatusOutsideInert === true,
      'A cross-project intake response was not rejected before semantic commit.');
      assert(sourceImportOperationIsolation.commitFailureRecovery?.stageCount === 1
        && sourceImportOperationIsolation.commitFailureRecovery.commitCount === 1
        && sourceImportOperationIsolation.commitFailureRecovery.replaced === true
        && sourceImportOperationIsolation.commitFailureRecovery.oldConnected === false
        && sourceImportOperationIsolation.commitFailureRecovery.oldFileCount === 0
        && sourceImportOperationIsolation.commitFailureRecovery.heading === 'Resume staged source'
        && sourceImportOperationIsolation.commitFailureRecovery.currentFileCount === 0
        && sourceImportOperationIsolation.commitFailureRecovery.currentFileDisabled === true
        && sourceImportOperationIsolation.commitFailureRecovery.status?.includes('remains staged; retry commits this exact artifact')
        && sourceImportOperationIsolation.commitFailureRecovery.liveStatusOutsideInert === true,
      'A post-stage commit failure left the old selectable file form visible or hid durable recovery status.');
      const transition = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const original = document.querySelector('[data-source-intake-form] [data-source-file]');
          const transfer = new DataTransfer();
          transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])],
            'new-source-that-must-be-cleared.png', { type: 'image/png' }));
          original.files = transfer.files;
          original.dispatchEvent(new Event('change', { bubbles: true }));
          const originalConfirm = window.confirm;
          let confirmCalls = 0;
          window.confirm = () => { confirmCalls += 1; return true; };
          document.querySelector('[data-resume-source-intake]')?.click();
          window.confirm = originalConfirm;
          const current = document.querySelector('[data-source-intake-form] [data-source-file]');
          return {
            replaced: current !== original,
            confirmCalls,
            oldConnected: original.isConnected,
            oldFileCount: original.files.length,
            currentFileCount: current?.files?.length ?? -1,
            currentDisabled: current?.disabled ?? false,
            heading: current?.closest('[data-source-intake-form]')?.querySelector('h2')?.textContent ?? null,
            status: current?.closest('[data-source-intake-form]')?.querySelector('[data-source-status]')?.textContent ?? null,
          };
        })()`,
        returnByValue: true,
      }, sessionId);
      sourceFileResumeTransition = transition.result?.value ?? null;
      assert(sourceFileResumeTransition?.replaced === true
        && sourceFileResumeTransition.confirmCalls === 1
        && sourceFileResumeTransition.oldConnected === false
        && sourceFileResumeTransition.oldFileCount === 0
        && sourceFileResumeTransition.currentFileCount === 0
        && sourceFileResumeTransition.currentDisabled === true
        && sourceFileResumeTransition.heading === 'Resume staged source'
        && sourceFileResumeTransition.status?.startsWith('Ready to commit staged intake '),
      'Resume staged intake did not clear the selected new-source file and replace it with the staged form.');
      await devtools.send('Runtime.evaluate', {
        expression: `Promise.all([...document.querySelectorAll('.source-preview img')].map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolveImage) => {
            image.addEventListener('load', resolveImage, { once: true });
            image.addEventListener('error', resolveImage, { once: true });
          });
        }))`,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      await delay(100);
      sourceImportSyntheticEventRange = {
        start: syntheticEventStart,
        end: devtools.events.length,
        projectId: sourceImportOperationIsolation.operationProjectId,
      };
    }
  }
  if (mode === 'a1-7' && expectedWorkspace === 'tasks') {
    const observed = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const waitFor = async (predicate, label, timeoutMs = 10_000) => {
          const deadline = Date.now() + timeoutMs;
          while (!predicate() && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 25));
          if (!predicate()) throw new Error('Timed out waiting for ' + label + '.');
        };
        const waitForPreview = () => waitFor(() => {
          const image = document.querySelector('[data-processing-adoption-preview-image]');
          return image?.complete && image.naturalWidth > 0;
        }, 'the exact A1.7 preview');
        const durableSnapshot = async () => {
          const base = '/api/projects/numberdroid-studio-a1-7';
          const taskBase = base + '/tasks/task.a1-7.processed-asset-review';
          const responses = await Promise.all([
            fetch(base),
            fetch(taskBase),
            fetch(taskBase + '/processing-result-adoptions'),
            fetch(base + '/activity'),
          ]);
          if (responses.some((response) => !response.ok)) throw new Error('A1.7 durable snapshot read failed.');
          return JSON.stringify(await Promise.all(responses.map((response) => response.json())));
        };
        const durableBefore = await durableSnapshot();
        const select = document.querySelector('[data-task-control="select"]');
        select?.focus(); select?.click();
        await waitFor(() => document.querySelector('[data-processing-adoption-state="WAITING_FOR_YOUR_REVIEW"]'), 'the A1.7 review state');
        await waitForPreview();
        const firstSection = document.querySelector('[data-processing-adoption]');
        const firstDetail = document.querySelector('[data-task-view="detail"]');
        const firstImage = firstSection.querySelector('[data-processing-adoption-preview-image]');
        const currentStep = document.querySelector('[data-task-selection-key="current-step"]');
        const taskFacts = document.querySelector('[data-task-selection-key="task-facts"]');
        const initial = {
          selectedTaskId: firstDetail?.dataset.taskContext?.split(':').slice(1).join(':') ?? null,
          state: firstSection.dataset.processingAdoptionState,
          previewState: firstSection.dataset.processingPreviewState,
          candidate: firstSection.dataset.processingAdoptionCandidate,
          naturalWidth: firstImage.naturalWidth,
          naturalHeight: firstImage.naturalHeight,
          alt: firstImage.alt,
          srcPath: new URL(firstImage.src).pathname,
          objectFit: getComputedStyle(firstImage).objectFit,
          objectPosition: getComputedStyle(firstImage).objectPosition,
          checkerBackground: getComputedStyle(firstImage.closest('.asset-preview')).backgroundImage,
          correctionCount: firstSection.querySelectorAll('[data-processing-adoption-quality="correction"] li').length,
          warningCount: firstSection.querySelectorAll('[data-processing-adoption-quality="warnings"] li').length,
          mutationControlCount: firstSection.querySelectorAll('button, form, input, select, textarea, a[href], [data-task-control]').length,
          headingOrder: currentStep && taskFacts
            && (currentStep.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING)
            && (firstSection.compareDocumentPosition(taskFacts) & Node.DOCUMENT_POSITION_FOLLOWING)
            ? 'current-adoption-facts' : 'invalid',
        };
        const decodeFailed = new Promise((resolveFailure) => firstImage.addEventListener('error', resolveFailure, { once: true }));
        firstImage.src = 'data:image/png;base64,AAECAw==';
        await decodeFailed;
        await waitFor(() => firstSection.dataset.processingPreviewState === 'UNAVAILABLE', 'the real A1.7 preview decode fallback');
        const fallback = {
          decodeFailure: true,
          primaryState: firstSection.dataset.processingAdoptionState,
          previewState: firstSection.dataset.processingPreviewState,
          text: firstSection.querySelector('[data-processing-adoption-preview]')?.textContent ?? null,
          imageCount: firstSection.querySelectorAll('img').length,
          correctionCount: firstSection.querySelectorAll('[data-processing-adoption-quality="correction"] li').length,
          navigationPresent: Boolean(document.querySelector('[data-task-control="back-to-list"]')),
        };
        const rerendered = await window.__numberdroidStudioVisualTest?.rerenderA17Candidate();
        await waitForPreview();
        const section = document.querySelector('[data-processing-adoption]');
        const detail = document.querySelector('[data-task-view="detail"]');
        const technical = section.querySelector('[data-processing-adoption-technical]');
        const technicalSummary = technical.querySelector('summary');
        technical.open = true; technicalSummary.focus();
        const selectedCopy = section.querySelector('[data-processing-adoption-quality="correction"] li span');
        const selectionRange = document.createRange();
        const selectedTextNode = selectedCopy.firstChild;
        const selectedLength = Math.min(24, selectedTextNode.data.length);
        selectionRange.setStart(selectedTextNode, 0); selectionRange.setEnd(selectedTextNode, selectedLength);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(selectionRange);
        document.documentElement.dataset.visualTaskScrollProbe = 'true';
        technical.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        detail.scrollTop = Math.min(120, detail.scrollHeight - detail.clientHeight);
        const beforeScroll = { x: window.scrollX, y: window.scrollY, taskTop: detail.scrollTop };
        const selectedText = selection.toString();
        const refresh = document.getElementById('refresh-button'); refresh.click();
        await waitFor(() => !refresh.disabled, 'the passive A1.7 refresh');
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const currentSection = document.querySelector('[data-processing-adoption]');
        const currentDetail = document.querySelector('[data-task-view="detail"]');
        const currentTechnical = currentSection.querySelector('[data-processing-adoption-technical]');
        const currentSelection = window.getSelection();
        const passiveRefresh = {
          sameTaskNode: currentDetail === detail,
          sameAdoptionNode: currentSection === section,
          state: currentSection.dataset.processingAdoptionState,
          previewState: currentSection.dataset.processingPreviewState,
          disclosureOpen: currentTechnical.open,
          focusedSummary: document.activeElement === technicalSummary,
          selectedText: currentSelection?.toString() ?? null,
          expectedSelectedText: selectedText,
          scrollUnchanged: window.scrollX === beforeScroll.x && window.scrollY === beforeScroll.y,
          taskScrollUnchanged: currentDetail.scrollTop === beforeScroll.taskTop,
          taskScrollExercised: beforeScroll.taskTop > 0,
        };
        const changedProbe = await window.__numberdroidStudioVisualTest?.exerciseA17ChangedProjectionRetention();
        await waitForPreview();
        const changedSection = document.querySelector('[data-processing-adoption]');
        const changedDetail = document.querySelector('[data-task-view="detail"]');
        const changedTechnical = changedSection.querySelector('[data-processing-adoption-technical]');
        const changedSelection = window.getSelection();
        const changedProjectionRefresh = {
          hookChangedSection: changedProbe?.changedSectionCreated === true,
          hookRestored: changedProbe?.restored === true,
          taskNodeReplaced: changedDetail !== currentDetail,
          adoptionNodeReplaced: changedSection !== currentSection,
          state: changedSection.dataset.processingAdoptionState,
          previewState: changedSection.dataset.processingPreviewState,
          disclosureOpen: changedTechnical.open,
          focusedSummary: document.activeElement === changedTechnical.querySelector('summary'),
          selectedText: changedSelection?.toString() ?? null,
          expectedSelectedText: selectedText,
          scrollUnchanged: window.scrollX === beforeScroll.x && window.scrollY === beforeScroll.y,
          taskScrollUnchanged: changedDetail.scrollTop === beforeScroll.taskTop,
          taskScrollExercised: beforeScroll.taskTop > 0,
        };
        changedTechnical.open = false;
        delete document.documentElement.dataset.visualTaskScrollProbe;
        const durableAfter = await durableSnapshot();
        changedSection.scrollIntoView({ block: 'start', inline: 'nearest' }); window.scrollBy(0, -82);
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const sectionRect = changedSection.getBoundingClientRect(); const detailRect = changedDetail.getBoundingClientRect();
        const finalImage = changedSection.querySelector('[data-processing-adoption-preview-image]');
        return {
          initial,
          fallback,
          rerendered,
          restoredReady: Boolean(finalImage?.complete && finalImage.naturalWidth === 64 && finalImage.naturalHeight === 64),
          passiveRefresh,
          changedProjectionRefresh,
          durableSnapshotUnchanged: durableAfter === durableBefore,
          final: {
            sectionRect: { x: sectionRect.x, y: sectionRect.y, right: sectionRect.right, bottom: sectionRect.bottom, width: sectionRect.width, height: sectionRect.height },
            detailRect: { x: detailRect.x, y: detailRect.y, right: detailRect.right, bottom: detailRect.bottom, width: detailRect.width, height: detailRect.height },
            visible: sectionRect.bottom > 0 && sectionRect.top < innerHeight,
            horizontallyContained: sectionRect.left >= detailRect.left && sectionRect.right <= detailRect.right
              && sectionRect.left >= 0 && sectionRect.right <= innerWidth,
            technicalClosed: changedTechnical.open === false,
            selectedTaskState: document.querySelector('.task-detail [data-task-state]')?.dataset.taskState ?? null,
            genericTaskReviewSectionPresent: Boolean(document.querySelector('.task-review')),
          },
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId, 30_000);
    a17Evidence = observed.result?.value ?? null;
    const domDocument = await devtools.send('DOM.getDocument', { depth: 0, pierce: true }, sessionId);
    const adoptionNode = await devtools.send('DOM.querySelector', {
      nodeId: domDocument.root.nodeId,
      selector: '[data-processing-adoption]',
    }, sessionId);
    const describedAdoption = await devtools.send('DOM.describeNode', { nodeId: adoptionNode.nodeId }, sessionId);
    const axTree = await devtools.send('Accessibility.getFullAXTree', {}, sessionId);
    const axById = new Map(axTree.nodes.map((node) => [node.nodeId, node]));
    const axRoot = axTree.nodes.find((node) => node.backendDOMNodeId === describedAdoption.node.backendNodeId);
    const scopedAxIds = new Set();
    const visitAx = (nodeId) => {
      if (!nodeId || scopedAxIds.has(nodeId)) return;
      scopedAxIds.add(nodeId);
      for (const childId of axById.get(nodeId)?.childIds ?? []) visitAx(childId);
    };
    visitAx(axRoot?.nodeId);
    a17Evidence.accessibilityScope = axRoot ? 'processing-adoption' : 'missing';
    a17Evidence.accessibility = axTree.nodes
      .filter((node) => scopedAxIds.has(node.nodeId))
      .map((node) => ({ role: node.role?.value ?? null, name: node.name?.value ?? null }))
      .filter(({ role, name }) => ['heading', 'image', 'list', 'listitem', 'DisclosureTriangle'].includes(role)
        && (role === 'list' || role === 'listitem' || /Processed asset draft|Transfer console processed draft|Technical details/.test(name ?? '')));
    a17Evidence.browserRequests = devtools.events
      .filter((event) => event.method === 'Network.requestWillBeSent')
      .map((event) => ({
        method: event.params?.request?.method ?? null,
        path: (() => {
          try { return new URL(event.params?.request?.url ?? '').pathname; } catch { return null; }
        })(),
      }))
      .filter(({ path }) => path !== null);
  }
  checkpoint2aSourceFocusBeforeLayout = await focusCheckpoint2aSourceTarget('before-layout');
  await devtools.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);

  const evaluated = await devtools.send('Runtime.evaluate', {
    expression: `(() => {
      const rect = (node) => {
        if (!node) return null;
        const value = node.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height,
          right: value.right, bottom: value.bottom };
      };
      const overlaps = (a, b) => a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      const boxMetrics = (node) => {
        if (!node) return null;
        const style = getComputedStyle(node);
        return {
          padding: {
            top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight),
            bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft),
          },
          border: {
            top: parseFloat(style.borderTopWidth), right: parseFloat(style.borderRightWidth),
            bottom: parseFloat(style.borderBottomWidth), left: parseFloat(style.borderLeftWidth),
          },
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        };
      };
      const headerNodes = [
        document.querySelector('.agent-access-control'),
        document.getElementById('project-select'),
        document.getElementById('demo-button'),
        document.getElementById('refresh-button'),
      ];
      const headerRects = headerNodes.map(rect);
      const headerOverlapCount = headerRects.flatMap((a, index) => headerRects.slice(index + 1).map((b) => overlaps(a, b)))
        .filter(Boolean).length;
      const brandRect = rect(document.querySelector('.brand'));
      const projectControlsRect = rect(document.querySelector('.project-controls'));
      const topbarRect = rect(document.querySelector('.topbar'));
      const headerOutsideTopbar = [...headerRects, brandRect, projectControlsRect].some((value) => value && topbarRect
        && (value.x < topbarRect.x || value.right > topbarRect.right || value.y < topbarRect.y || value.bottom > topbarRect.bottom));
      const panel = document.getElementById('agent-access-panel');
      const panelRect = rect(panel);
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const panelCenter = panelRect ? document.elementFromPoint(
        Math.min(innerWidth - 1, Math.max(0, panelRect.x + panelRect.width / 2)),
        Math.min(innerHeight - 1, Math.max(0, panelRect.y + Math.min(panelRect.height, innerHeight - panelRect.y) / 2)),
      ) : null;
      const cards = [...document.querySelectorAll('.asset-card')].map((card) => {
        const preview = card.querySelector('.asset-preview');
        const image = preview?.querySelector('img');
        return {
          assetId: card.dataset.assetId,
          card: rect(card),
          preview: rect(preview),
          previewBox: boxMetrics(preview),
          image: rect(image),
          previewState: preview?.dataset.previewState ?? null,
          hasImage: Boolean(image),
          loadedImage: Boolean(image?.complete && image.naturalWidth > 0),
          naturalWidth: image?.naturalWidth ?? 0,
          naturalHeight: image?.naturalHeight ?? 0,
          objectFit: image ? getComputedStyle(image).objectFit : null,
          text: card.textContent,
          v2: card.classList.contains('asset-v2-card'),
        };
      });
      const assetProposal = document.querySelector('[data-asset-proposal]');
      const proposalItems = [...document.querySelectorAll('[data-proposal-item]')].map((item) => ({
        itemId: item.dataset.proposalItem,
        rejectionReason: item.dataset.proposalRejectionReason ?? null,
        text: item.textContent,
        previewState: item.querySelector('.asset-preview')?.dataset.previewState ?? null,
        loadedImage: Boolean(item.querySelector('.asset-preview img')?.complete
          && item.querySelector('.asset-preview img')?.naturalWidth > 0),
        diffRowCount: item.querySelectorAll('.proposal-diff tbody tr').length,
        canonicalIds: [...item.querySelectorAll('.canonical-copy code')].map((node) => node.textContent),
      }));
      const assetLibrary = {
        proposalId: assetProposal?.dataset.assetProposal ?? null,
        proposalState: assetProposal?.dataset.proposalState ?? null,
        proposalItems,
        decisionControlCount: assetProposal?.querySelectorAll('[data-proposal-disposition]').length ?? 0,
        applyControlCount: assetProposal?.querySelectorAll('[data-proposal-apply]').length ?? 0,
        canonicalIds: [...document.querySelectorAll('.canonical-copy code')].map((node) => node.textContent),
        ordinalLabels: [...document.querySelectorAll('.asset-provenance strong, .proposal-identity strong, .slice-vocabulary-card h4')]
          .map((node) => node.textContent).filter((value) => /Slice [1-4]/.test(value)),
        inventoryRect: rect(document.querySelector('[data-asset-scroll="asset-inventory"]')),
        proposalRect: rect(assetProposal),
      };
      const roomBoard = document.querySelector('[data-room-board]');
      const roomProposal = document.querySelector('[data-room-proposal]');
      const roomDesigner = {
        header: rect(document.querySelector('.room-header')),
        layout: rect(document.querySelector('.room-editor-shell')),
        palette: rect(document.querySelector('.room-palette')),
        paletteItemCount: document.querySelectorAll('.room-palette-item').length,
        canvasScroller: rect(document.querySelector('.room-canvas-scroll')),
        canvasOverflowX: document.querySelector('.room-canvas-scroll') ? getComputedStyle(document.querySelector('.room-canvas-scroll')).overflowX : null,
        board: rect(roomBoard),
        cellCount: roomBoard?.querySelectorAll('.room-cell').length ?? 0,
        placementCount: roomBoard?.querySelectorAll('.room-placement').length ?? 0,
        connectorCount: roomBoard?.querySelectorAll('.room-connector').length ?? 0,
        coordinateLabelCount: roomBoard?.querySelectorAll('.room-cell > span').length ?? 0,
        roomOptionCount: document.querySelectorAll('[data-room-variant-select] option').length,
        findingCount: document.querySelectorAll('.room-findings .asset-findings > li:not(.clear)').length,
        lifecycle: document.querySelector('.room-lifecycle .status-pill')?.textContent ?? null,
        proposalId: roomProposal?.dataset.roomProposal ?? null,
        proposalState: roomProposal?.dataset.proposalState ?? null,
        proposalItemCount: roomProposal?.querySelectorAll('[data-room-proposal-item]').length ?? 0,
        proposalItems: [...(roomProposal?.querySelectorAll('[data-room-proposal-item]') ?? [])].map((item) => ({ itemId: item.dataset.roomProposalItem, text: item.textContent })),
        exactPins: [...document.querySelectorAll('.room-placement-list button')].map((button) => button.textContent),
        selectedRoomId: document.querySelector('[data-room-variant-select]')?.value ?? null,
        editorTools: [...document.querySelectorAll('[data-room-control="editor-tool"]')].map((button) => button.dataset.editorTool),
        voidCount: document.querySelectorAll('.room-cell[data-cell-kind="VOID"]').length,
        blockedCount: document.querySelectorAll('.room-cell[data-cell-kind="BLOCKED"]').length,
        ordinaryCount: document.querySelectorAll('.room-cell[data-cell-kind="ROOM"]').length,
        shapeSavePresent: Boolean(document.querySelector('[data-room-control="shape-save"]')),
        shapeConflictPresent: Boolean(document.querySelector('.room-shape-controls [role="alert"]')),
        editorStatus: document.querySelector('.room-editor-status')?.textContent ?? null,
        shapeText: document.querySelector('.room-shape-controls')?.textContent ?? null,
        placementPreview: (() => {
          const preview = document.querySelector('.room-placement-preview .useful-asset-preview');
          const image = preview?.querySelector('.asset-preview.ready img');
          const active = document.querySelector('.room-placement-active');
          const stage = preview?.querySelector('.prop-preview-stage');
          const stageBounds = stage?.getBoundingClientRect();
          const imageBounds = image?.getBoundingClientRect();
          const containedAtRotation = Boolean(stageBounds && imageBounds
            && imageBounds.left >= stageBounds.left - 1 && imageBounds.top >= stageBounds.top - 1
            && imageBounds.right <= stageBounds.right + 1 && imageBounds.bottom <= stageBounds.bottom + 1);
          const fillsRotatedStage = Boolean(stageBounds && imageBounds
            && Math.abs(imageBounds.width - stageBounds.width) <= 4
            && Math.abs(imageBounds.height - stageBounds.height) <= 4);
          return {
            present: Boolean(preview),
            ready: preview?.dataset.previewReady ?? null,
            loadedImage: Boolean(image?.complete && image.naturalWidth > 0),
            facts: preview?.querySelector('.prop-preview-facts')?.textContent ?? null,
            activeText: active?.textContent ?? null,
            useControlPresent: Boolean(document.querySelector('[data-room-control="use-preview-asset"]')),
            selectedRotation: preview?.querySelector('[data-asset-preview-rotation][data-selected="true"]')?.dataset.assetPreviewRotation ?? null,
            collisionCount: preview?.querySelectorAll('.prop-collision-overlay').length ?? 0,
            topLeftMarker: Boolean(preview?.querySelector('.prop-top-left-marker')),
            anchorLabel: preview?.querySelector('.prop-anchor-marker')?.getAttribute('aria-label') ?? null,
            containedAtRotation,
            fillsRotatedStage,
            stageBounds: stageBounds ? { width: stageBounds.width, height: stageBounds.height } : null,
            stageAspect: stageBounds ? stageBounds.width / stageBounds.height : null,
            imageBounds: imageBounds ? { width: imageBounds.width, height: imageBounds.height } : null,
          };
        })(),
      };
      const selectedTask = document.querySelector('[data-task-control="select"][data-selected="true"]');
      const taskWorkspace = {
        composer: rect(document.querySelector('.task-composer')),
        composerText: document.querySelector('.task-composer')?.textContent ?? null,
        layout: rect(document.querySelector('.task-layout')),
        detail: rect(document.querySelector('.task-detail')),
        list: rect(document.querySelector('.task-list')),
        listHeading: rect(document.querySelector('.task-list > h2')),
        listHeadingClientWidth: document.querySelector('.task-list > h2')?.clientWidth ?? null,
        listHeadingScrollWidth: document.querySelector('.task-list > h2')?.scrollWidth ?? null,
        badges: [...document.querySelectorAll('.task-list-item [data-task-state]')].map((badge) => ({
          rect: rect(badge),
          item: rect(badge.closest('.task-list-item')),
          whiteSpace: getComputedStyle(badge).whiteSpace,
        })),
        taskCount: document.querySelectorAll('[data-task-control="select"]').length,
        states: [...document.querySelectorAll('[data-task-control="select"] [data-task-state]')]
          .map((badge) => badge.dataset.taskState),
        selectedState: document.querySelector('.task-detail [data-task-state]')?.dataset.taskState
          ?? selectedTask?.querySelector('[data-task-state]')?.dataset.taskState ?? null,
        selectedText: document.querySelector('.task-detail')?.textContent ?? null,
        timelineCount: document.querySelectorAll('.task-timeline li').length,
        conflictCount: document.querySelectorAll('.task-conflict-items small').length,
        conflictText: document.querySelector('.task-conflict-summary')?.textContent ?? null,
        conflictInlineMetaCount: document.querySelectorAll('.task-conflict-items small').length,
        conflictActionConsequenceCount: document.querySelectorAll('.task-review-actions .task-action-consequence').length,
        timelineTechnicalDisclosureCount: document.querySelectorAll('.task-timeline details').length,
        reviewTechnicalDisclosureCount: document.querySelectorAll('.task-review-items details').length,
        reviewItemCount: document.querySelectorAll('.task-review-items li').length,
        reviewText: document.querySelector('.task-review')?.textContent ?? null,
        reviewDispositions: [...document.querySelectorAll('[data-task-review-disposition]')]
          .map((control) => control.value),
        controlNames: [...document.querySelectorAll('.task-composer [data-task-control], .task-detail [data-task-control], .task-review [data-task-control]')]
          .map((control) => control.dataset.taskControl),
      };
      const sources = [...document.querySelectorAll('.source-card')].map((source) => {
        const preview = source.querySelector('.source-preview');
        const image = preview?.querySelector('img');
        const link = source.querySelector('a.source-preview.ready');
        return {
          sourceId: source.dataset.sourceId,
          text: source.textContent,
          card: rect(source),
          preview: rect(preview),
          previewBox: boxMetrics(preview),
          image: rect(image),
          previewState: preview?.dataset.previewState ?? null,
          loadedImage: Boolean(image?.complete && image.naturalWidth > 0),
          naturalWidth: image?.naturalWidth ?? 0,
          naturalHeight: image?.naturalHeight ?? 0,
          objectFit: image ? getComputedStyle(image).objectFit : null,
          objectPosition: image ? getComputedStyle(image).objectPosition : null,
          linkHref: link?.href ?? null,
          linkTarget: link?.target ?? null,
          linkRel: link?.rel ?? null,
          linkReferrerPolicy: link?.referrerPolicy ?? null,
          linkLabel: link?.getAttribute('aria-label') ?? null,
          linkDescribedBy: link?.getAttribute('aria-describedby') ?? null,
          linkTabIndex: link?.tabIndex ?? null,
          captionId: source.querySelector('.source-preview-frame figcaption')?.id ?? null,
          captionText: source.querySelector('.source-preview-frame figcaption')?.textContent ?? null,
          reviewMutationCount: source.querySelectorAll(
            '[data-source-review-decision], [data-source-review-propose]',
          ).length,
        };
      });
      const aspectRatioProbes = [...document.querySelectorAll('#source-preview-aspect-probes [data-probe]')].map((preview) => {
        const image = preview.querySelector('img');
        return {
          name: preview.dataset.probe,
          mediaType: preview.dataset.mediaType,
          preview: rect(preview),
          previewBox: boxMetrics(preview),
          image: rect(image),
          naturalWidth: image?.naturalWidth ?? 0,
          naturalHeight: image?.naturalHeight ?? 0,
          objectFit: image ? getComputedStyle(image).objectFit : null,
        };
      });
      const stagedIntakes = [...document.querySelectorAll('.staged-source-intakes li')].map((intake) => ({
        text: intake.textContent,
        rect: rect(intake),
        hasResume: Boolean(intake.querySelector('[data-resume-source-intake]')),
        hasDiscard: Boolean(intake.querySelector('[data-discard-source-intake]')),
      }));
      const sourceForm = document.querySelector('[data-source-intake-form]');
      const cutter = document.querySelector('[data-atlas-cutter]');
      const cutterScroller = cutter?.querySelector('.cutter-scroll');
      const cutterCanvas = cutter?.querySelector('.cutter-canvas');
      const cutterOverlay = cutter?.querySelector('[data-cutter-overlay]');
      const cutterSourceImage = cutterCanvas?.querySelector('img');
      const committedPreviews = [...(cutter?.querySelectorAll('.slice-preview-grid.committed .slice-preview') ?? [])]
        .map((preview) => {
          const image = preview.querySelector('img');
          return {
            rect: rect(preview),
            loaded: Boolean(image?.complete && image.naturalWidth > 0),
            naturalWidth: image?.naturalWidth ?? 0,
            naturalHeight: image?.naturalHeight ?? 0,
            objectFit: image ? getComputedStyle(image).objectFit : null,
          };
        });
      const activityText = document.getElementById('workspace-content')?.textContent ?? '';
      return {
        workspace: ${JSON.stringify(expectedWorkspace)},
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        visualEvidenceReady: document.documentElement.dataset.visualEvidenceReady ?? null,
        visualErrorCount: Number(document.documentElement.dataset.visualErrorCount ?? -1),
        projectId: document.documentElement.dataset.visualProjectId ?? null,
        revision: Number(document.documentElement.dataset.visualRevision ?? -1),
        activityCount: Number(document.documentElement.dataset.visualActivityCount ?? -1),
        connectionState: document.getElementById('connection-label')?.textContent ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          || document.body.scrollWidth > document.body.clientWidth,
        headerOverlapCount,
        brandControlsOverlap: overlaps(brandRect, projectControlsRect),
        headerOutsideTopbar,
        cards,
        assetLibrary,
        roomDesigner,
        taskWorkspace,
        sources,
        aspectRatioProbes,
        stagedIntakes,
        sourceForm: {
          present: Boolean(sourceForm),
          rect: rect(sourceForm),
          labelledFields: sourceForm?.querySelectorAll('label').length ?? 0,
          hasLiveStatus: sourceForm?.querySelector('[role="status"][aria-live="polite"]') !== null,
          submitDisabled: sourceForm?.querySelector('button[type="submit"]')?.disabled ?? null,
        },
        cutter: {
          present: Boolean(cutter),
          rect: rect(cutter),
          scroller: rect(cutterScroller),
          scrollerOverflowX: cutterScroller ? getComputedStyle(cutterScroller).overflowX : null,
          canvas: rect(cutterCanvas),
          overlay: rect(cutterOverlay),
          sourceImageLoaded: Boolean(cutterSourceImage?.complete && cutterSourceImage.naturalWidth > 0),
          sourceImageNaturalWidth: cutterSourceImage?.naturalWidth ?? 0,
          sourceImageNaturalHeight: cutterSourceImage?.naturalHeight ?? 0,
          overlayRectangleCount: cutterOverlay?.querySelectorAll('g').length ?? 0,
          overlayRectangles: [...(cutterOverlay?.querySelectorAll('g') ?? [])].map((group) => {
            const shape = group.querySelector('[data-cutter-move]');
            return {
              rectangleId: group.dataset.rectangleId,
              x: Number(shape?.getAttribute('x')),
              y: Number(shape?.getAttribute('y')),
              width: Number(shape?.getAttribute('width')),
              height: Number(shape?.getAttribute('height')),
              label: shape?.getAttribute('aria-label') ?? null,
            };
          }),
          focusableMoveCount: cutterOverlay?.querySelectorAll('[data-cutter-move][tabindex="0"]').length ?? 0,
          focusableResizeCount: cutterOverlay?.querySelectorAll('[data-cutter-resize][tabindex="0"]').length ?? 0,
          rectangleRowCount: cutter?.querySelectorAll('[data-rectangle-row]').length ?? 0,
          numericInputCount: cutter?.querySelectorAll('input[type="number"][data-rectangle-field]').length ?? 0,
          includeInputCount: cutter?.querySelectorAll('[data-rectangle-field="included"]').length ?? 0,
          remapControlCount: cutter?.querySelectorAll('[data-rectangle-field="replacesSliceId"]').length ?? 0,
          remapOptionCount: cutter?.querySelectorAll('[data-rectangle-field="replacesSliceId"] option').length ?? 0,
          jobEvents: [...(cutter?.querySelectorAll('[data-job-event-sequence]') ?? [])].map((item) => ({
            sequence: Number(item.dataset.jobEventSequence),
            type: item.dataset.jobEventType,
            text: item.textContent,
          })),
          committedPreviews,
          inspector: rect(cutter?.querySelector('.rectangle-inspector')),
          committedGrid: rect(cutter?.querySelector('.slice-preview-grid.committed')),
          status: cutter?.querySelector('.cutter-job-status')?.textContent ?? null,
          hasSave: Boolean(cutter?.querySelector('[data-save-atlas]')),
          hasPreview: Boolean(cutter?.querySelector('[data-preview-atlas]')),
          hasCommit: Boolean(cutter?.querySelector('[data-commit-atlas]')),
          helpText: cutter?.querySelector('.cutter-heading p:not(.eyebrow)')?.textContent ?? null,
        },
        activityText,
        agentPanel: {
          open: Boolean(panel && !panel.hidden && document.getElementById('agent-access-state')?.getAttribute('aria-expanded') === 'true'),
          visible: Boolean(panelRect && panelStyle && panelStyle.display !== 'none' && panelStyle.visibility !== 'hidden'
            && Number(panelStyle.opacity) > 0 && panelRect.x >= 0 && panelRect.right <= innerWidth
            && panelRect.y >= 0 && panelRect.bottom <= innerHeight && panel.contains(panelCenter)),
          rect: panelRect,
        },
      };
    })()`,
    returnByValue: true,
  }, sessionId);
  const layout = evaluated.result?.value;
  assert(layout, 'Chrome did not return a layout observation.');
  assert(layout.viewport.width === width && layout.viewport.height === height, 'Chrome viewport differs from the requested evidence size.');
  assert(layout.horizontalOverflow === false, `${mode} ${expectedWorkspace} overflows horizontally at ${width}px.`);
  assert(layout.headerOverlapCount === 0, `Header controls overlap at ${width}px.`);
  assert(layout.brandControlsOverlap === false, `Studio brand overlaps Header controls at ${width}px.`);
  assert(layout.headerOutsideTopbar === false, `Header content leaves the Topbar bounds at ${width}px.`);
  const assertImageWithinPreview = (entry, label) => {
    const { preview, previewBox, image } = entry;
    assert(preview && previewBox && image, `${label} has no measurable preview image.`);
    const content = {
      x: preview.x + previewBox.border.left + previewBox.padding.left,
      y: preview.y + previewBox.border.top + previewBox.padding.top,
      right: preview.right - previewBox.border.right - previewBox.padding.right,
      bottom: preview.bottom - previewBox.border.bottom - previewBox.padding.bottom,
    };
    assert(previewBox.padding.top >= 5 && previewBox.padding.right >= 5
      && previewBox.padding.bottom >= 5 && previewBox.padding.left >= 5
      && previewBox.overflowX === 'visible' && previewBox.overflowY === 'visible',
    `${label} preview lost its non-clipping content inset.`);
    assert(image.x >= content.x - 1 && image.y >= content.y - 1
      && image.right <= content.right + 1 && image.bottom <= content.bottom + 1,
    `${label} image element leaves its preview content box.`);
  };
  const assertRenderedAspect = (entry, label) => {
    const renderedAspect = entry.image.width / entry.image.height;
    const naturalAspect = entry.naturalWidth / entry.naturalHeight;
    assert(Number.isFinite(renderedAspect) && renderedAspect > 0
      && Math.abs((renderedAspect / naturalAspect) - 1) <= 0.15,
    `${label} rendered aspect no longer approximates its natural aspect.`);
  };
  for (const source of layout.sources.filter(({ loadedImage }) => loadedImage)) {
    assertImageWithinPreview(source, source.sourceId);
    assertRenderedAspect(source, source.sourceId);
  }

  const ignoredFavicon = (event) => {
    const value = `${event.params?.response?.url ?? ''} ${event.params?.entry?.url ?? ''} ${event.params?.entry?.text ?? ''}`;
    return value.includes('/favicon.ico');
  };
  const protocolEventRecords = () => {
    const requestUrls = new Map();
    for (const event of devtools.events) {
      if (event.method === 'Network.requestWillBeSent' && event.params?.requestId) {
        requestUrls.set(event.params.requestId, event.params.request?.url ?? '');
      }
    }
    return devtools.events.map((event, index) => ({
      event,
      index,
      url: event.params?.response?.url
        ?? event.params?.entry?.url
        ?? requestUrls.get(event.params?.requestId)
        ?? '',
    }));
  };
  const isProtocolError = ({ event }) => (
    event.method === 'Runtime.exceptionThrown'
      || event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error' && !ignoredFavicon(event)
      || event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'
      || event.method === 'Network.loadingFailed' && event.params?.canceled !== true
      || event.method === 'Network.responseReceived'
        && event.params?.response?.status >= 400
        && new URL(event.params.response.url).origin === new URL(pageUrl).origin && !ignoredFavicon(event)
  );
  const isExpectedSyntheticSourceImportError = ({ event, index, url }) => {
    const range = sourceImportSyntheticEventRange;
    if (!range || index < range.start || index >= range.end) return false;
    if (range.projectId !== 'numberdroid-studio-checkpoint-2a'
      || sourceImportOperationIsolation?.delayedStageCount !== 1
      || sourceImportOperationIsolation?.delayedCommitCount !== 1
      || sourceImportOperationIsolation?.operationRevision !== 4
      || sourceImportOperationIsolation?.revisionLabelAfter !== 'Revision 4') return false;
    let parsed;
    try { parsed = new URL(url, pageUrl); } catch { return false; }
    const fixtureArtifactUrl = new URL(
      `/api/projects/${encodeURIComponent(range.projectId)}/artifacts/sha256/${FAMILY_HYGIENE_DIGEST}`,
      pageUrl,
    ).href;
    if (parsed.href !== fixtureArtifactUrl) return false;
    if (event.method === 'Log.entryAdded') {
      return event.params?.entry?.level === 'error'
        && /ERR_ABORTED/.test(event.params?.entry?.text ?? '');
    }
    return event.method === 'Network.loadingFailed'
      && event.params?.type === 'Image'
      && event.params?.errorText === 'net::ERR_ABORTED';
  };
  const allProtocolErrors = () => protocolEventRecords().filter(isProtocolError);
  const expectedSyntheticProtocolErrors = () => allProtocolErrors().filter(isExpectedSyntheticSourceImportError);
  const protocolErrors = () => allProtocolErrors().filter((record) => !isExpectedSyntheticSourceImportError(record));
  const protocolErrorSummary = (record) => {
    const { event, index, url } = record;
    const text = event.params?.entry?.text
      ?? event.params?.exceptionDetails?.exception?.description
      ?? event.params?.exceptionDetails?.text
      ?? '';
    return JSON.stringify({
      index,
      method: event.method,
      url: String(url).slice(0, 240),
      status: event.params?.response?.status ?? null,
      type: event.params?.type ?? event.params?.entry?.level ?? null,
      canceled: event.params?.canceled ?? null,
      errorText: event.params?.errorText ?? null,
      text: String(text).slice(0, 240),
    });
  };
  const assertNoProtocolErrors = (label) => {
    const unexpected = protocolErrors();
    assert(unexpected.length === 0,
      `${label}: Chrome recorded ${unexpected.length} unexpected runtime/network error(s): `
        + unexpected.map(protocolErrorSummary).join(' | '));
  };
  const assertSyntheticProtocolErrorsBounded = () => {
    const expected = expectedSyntheticProtocolErrors();
    const networkAborts = expected.filter(({ event }) => event.method === 'Network.loadingFailed');
    const pairedLogs = expected.filter(({ event }) => event.method === 'Log.entryAdded');
    assert(networkAborts.length <= 1 && pairedLogs.length <= 1
      && (pairedLogs.length === 0 || networkAborts.length === 1),
    'Synthetic source-import probe exceeded its single fixture-preview abort allowance: '
      + expected.map(protocolErrorSummary).join(' | '));
  };
  assertSyntheticProtocolErrorsBounded();
  assertNoProtocolErrors('Before screenshot assertions');

  if (mode === 'candidate') {
    assert(layout.visualEvidenceReady === 'true', 'Candidate screenshot was taken before the app readiness signal.');
    assert(layout.visualErrorCount === 0, 'Candidate app recorded an uncaught browser error before capture.');
    assert(layout.projectId === 'numberdroid-studio-demo' && layout.revision === 7 && layout.activityCount === 7
      && layout.connectionState === 'Live', 'Candidate screenshot is not bound to the prepared live revision-7 fixture.');
    if (expectedWorkspace === 'assets') {
      const readyCard = layout.cards.find((card) => card.assetId === 'tile.hygiene.floor.visual-ready');
      const processingCard = layout.cards.find((card) => card.assetId === 'tile.hygiene.floor.clean-a');
      assert(layout.cards.length === 2, 'Asset screenshot does not contain both fixture cards.');
      assert(readyCard?.previewState === 'READY' && readyCard.loadedImage, 'Full-source fixture preview is not loaded in its own card.');
      assert(readyCard.objectFit === 'contain', 'READY preview no longer preserves its aspect ratio.');
      assert(processingCard?.previewState === 'PROCESSING' && !processingCard.hasImage, 'Hygiene crop no longer uses its PROCESSING fallback.');
      for (const card of layout.cards) {
        assert(card.card.width >= 219 && card.card.width <= 261, `${card.assetId} card width left the 220–260px contract.`);
        assert(Math.abs(card.preview.width - card.preview.height) <= 1, `${card.assetId} preview region is not square.`);
      }
    }
    if (agentAccessEvidence) {
      assert(layout.agentPanel.open && layout.agentPanel.visible, 'Agent access popover is not visibly contained in the screenshot viewport.');
    }
  }
  if (mode === 'checkpoint-2c') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 2C screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-checkpoint-2c'
      && layout.connectionState === 'Live',
    'Checkpoint 2C screenshot is not bound to the prepared live fixture.');
    if (expectedWorkspace === 'assets' && checkpoint2cPhase === 'pending') {
      assert(layout.revision === 9 && layout.activityCount === 9,
        'Checkpoint 2C pending evidence is not bound to the revision-9 proposal fixture.');
      assert(layout.cards.length === 0
        && layout.assetLibrary.proposalId === 'proposal.family-hygiene-2c'
        && layout.assetLibrary.proposalState === 'PENDING'
        && layout.assetLibrary.proposalItems.length === 4
        && layout.assetLibrary.decisionControlCount === 4,
      'Checkpoint 2C pending proposal review is incomplete.');
      assert(layout.assetLibrary.proposalItems.every(({ previewState, loadedImage, diffRowCount, canonicalIds }) => (
        previewState === 'READY' && loadedImage && diffRowCount === 10 && canonicalIds.length === 2
      )), 'Checkpoint 2C pending items lost READY previews, deterministic diffs, or copyable identities.');
      assert(checkpoint2cInteractionEvidence?.value === 'Evidence draft retained across passive refresh.',
        'Checkpoint 2C pending evidence omitted the 12.5-second passive-refresh interaction proof.');
    }
    if (expectedWorkspace === 'assets' && checkpoint2cPhase === 'applied') {
      assert(layout.revision === 11 && layout.activityCount === 12,
        'Checkpoint 2C applied evidence is not bound to revision 11 plus one final denied audit result.');
      assert(layout.cards.length === 3
        && layout.cards.every(({ v2, previewState, loadedImage, naturalWidth, naturalHeight, objectFit, text }) => (
          v2 && previewState === 'READY' && loadedImage && naturalWidth === 622 && naturalHeight === 622
            && objectFit === 'contain' && text.includes('DRAFT') && !text.includes('FINAL')
        )), 'Checkpoint 2C inventory does not contain three exact READY 622×622 non-final V2 cards.');
      assert(JSON.stringify(layout.cards.map(({ assetId }) => assetId)) === JSON.stringify([
        'asset.family-hygiene.1', 'asset.family-hygiene.2', 'asset.family-hygiene.3',
      ]), 'Checkpoint 2C accepted-subset inventory has the wrong stable asset identities.');
      const rejected = layout.assetLibrary.proposalItems.find(({ itemId }) => itemId === 'item.family-hygiene.4');
      assert(layout.assetLibrary.proposalId === 'proposal.family-hygiene-2c'
        && layout.assetLibrary.proposalState === 'APPLIED'
        && layout.assetLibrary.proposalItems.length === 4
        && rejected?.rejectionReason === 'Reserve this fourth variant for a later visual review.'
        && rejected.text.includes('Rejected: Reserve this fourth variant for a later visual review.')
        && !layout.cards.some(({ assetId }) => assetId === 'asset.family-hygiene.4'),
      'Checkpoint 2C rejected proposal item is not inspectable or incorrectly created an asset.');
      assert(new Set(layout.assetLibrary.ordinalLabels.map((value) => /Slice ([1-4])/.exec(value)?.[1]).filter(Boolean)).size === 4
        && layout.assetLibrary.canonicalIds.length >= 14,
      'Checkpoint 2C evidence lost ordinal-first slice labels or copyable canonical IDs.');
    }
  }
  if (mode === 'checkpoint-3') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 3 screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-checkpoint-2c'
      && layout.revision === 26 && layout.activityCount === 27 && layout.connectionState === 'Live',
    'Checkpoint 3 screenshot is not bound to the prepared revision-26 fixture.');
    if (expectedWorkspace === 'rooms') {
      assert(layout.roomDesigner.header && layout.roomDesigner.layout && layout.roomDesigner.board,
        'Checkpoint 3 room designer did not render its header, layout, and canvas.');
      assert(layout.roomDesigner.roomOptionCount === 2
        && layout.roomDesigner.paletteItemCount === 1
        && layout.roomDesigner.cellCount === 12
        && layout.roomDesigner.coordinateLabelCount === 12
        && layout.roomDesigner.placementCount === 14
        && layout.roomDesigner.connectorCount === 2,
      'Checkpoint 3 room canvas lost a room/hallway option, exact asset palette, coordinates, placements, or connectors.');
      assert(layout.roomDesigner.canvasOverflowX === 'auto',
        'Checkpoint 3 room canvas no longer keeps bounded horizontal overflow.');
      assert(checkpoint3RoomContinuity?.sameBoard === true
        && checkpoint3RoomContinuity.returnedSameBoard === true
        && checkpoint3RoomContinuity.boardVisible === true
        && checkpoint3RoomContinuity.focusedPanel === 'room-panel-check'
        && checkpoint3RoomContinuity.lifecycle === 'DRAFT'
        && checkpoint3RoomContinuity.findingCount === 26
        && checkpoint3RoomContinuity.returnedTool === 'PROP',
      `Checkpoint 3 Check findings/lifecycle or persistent-canvas continuity regressed: ${JSON.stringify(checkpoint3RoomContinuity)}`);
      assert(layout.roomDesigner.proposalId === 'proposal.room.gathering-table'
        && layout.roomDesigner.proposalState === 'APPLIED'
        && layout.roomDesigner.proposalItemCount === 3
        && layout.roomDesigner.proposalItems.find(({ itemId }) => itemId === 'item.add-side-table')?.text.includes('Add prop.family-side-table')
        && layout.roomDesigner.proposalItems.find(({ itemId }) => itemId === 'item.reject-overlap')?.text.includes('studio.room.collision.overlap')
        && layout.roomDesigner.proposalItems.find(({ itemId }) => itemId === 'item.reject-overlap')?.text.includes('REJECTED · Overlaps the accepted gathering table'),
      'Checkpoint 3 applied agent placement proposal is not inspectable.');
      assert(layout.roomDesigner.exactPins.length === 14
        && layout.roomDesigner.exactPins.every((value) => /@1:1/.test(value)),
      'Checkpoint 3 structured placement list lost exact asset and metadata pins.');
    }
  }
  if (mode === 'checkpoint-4') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 4 screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-checkpoint-4'
      && layout.revision === 6 && layout.activityCount === 6 && layout.connectionState === 'Live',
    'Checkpoint 4 screenshot is not bound to the prepared revision-6 fixture.');
    if (expectedWorkspace === 'tasks') {
      const conflictOverviewAttention = checkpoint4TaskFocus.overviewAttention?.find(({ tone }) => tone === 'problem');
      assert(checkpoint4TaskFocus?.taskCount === 4
        && checkpoint4TaskFocus.initialStates.includes('MERGED')
        && checkpoint4TaskFocus.initialStates.filter((state) => state === 'IN_REVIEW').length === 2
        && checkpoint4TaskFocus.initialStates.includes('ANCESTOR_BLOCKED')
        && checkpoint4TaskFocus.overviewMetrics?.['Tasks needing you'] === '3'
        && checkpoint4TaskFocus.overviewMetrics?.['Task conflicts'] === '1'
        && checkpoint4TaskFocus.overviewAttention?.length === 3
        && conflictOverviewAttention?.text?.includes('Recorded conflict — action required')
        && checkpoint4TaskFocus.listContained === true,
      'Checkpoint 4 list-first task workspace lost its three branches, workflow states, or bounded list layout.');
      if (checkpoint4Focus === 'create') {
        assert(!checkpoint4TaskFocus.createRefreshEvidence?.runtimeErrorMessage,
          `Checkpoint 4 concurrent create-refresh setup failed: ${JSON.stringify(checkpoint4TaskFocus.createRefreshEvidence)}`);
        assert(layout.taskWorkspace.composer
          && checkpoint4TaskFocus.createVisible === true
          && checkpoint4TaskFocus.createFieldCount >= 13
          && checkpoint4TaskFocus.createKeyboardReachable === true
          && checkpoint4TaskFocus.createRefreshEvidence?.firstRefreshPreserved === true
          && checkpoint4TaskFocus.createRefreshEvidence?.serverStateMatched === true
          && checkpoint4TaskFocus.createRefreshEvidence?.concurrentChangeExercised === (width === 1060)
          && checkpoint4TaskFocus.createRefreshEvidence?.sameComposer === true
          && checkpoint4TaskFocus.createRefreshEvidence?.sameForm === true
          && checkpoint4TaskFocus.createRefreshEvidence?.sameField === true
          && checkpoint4TaskFocus.createRefreshEvidence?.title === 'Refresh-safe task draft'
          && checkpoint4TaskFocus.createRefreshEvidence?.agentId === 'studio.refresh-safe.agent'
          && checkpoint4TaskFocus.createRefreshEvidence?.objective === 'Keep this complete task draft intact across passive refreshes.'
          && checkpoint4TaskFocus.createRefreshEvidence?.maxCommands === '27'
          && checkpoint4TaskFocus.createRefreshEvidence?.expiryHours === '7'
          && checkpoint4TaskFocus.createRefreshEvidence?.capabilityChecked === true
          && checkpoint4TaskFocus.createRefreshEvidence?.autoAcceptChecked === true
          && checkpoint4TaskFocus.createRefreshEvidence?.focused === true
          && checkpoint4TaskFocus.createRefreshEvidence?.selectionStart === 9
          && checkpoint4TaskFocus.createRefreshEvidence?.selectionEnd === 17
          && checkpoint4TaskFocus.createRefreshEvidence?.scrollUnchanged === true
          && layout.taskWorkspace.composerText?.includes('Create a task for an agent')
          && layout.taskWorkspace.composerText.includes('What should the agent do?')
          && layout.taskWorkspace.controlNames.includes('back-to-list'),
        `Checkpoint 4 focused task composer is missing, unbounded, or not keyboard-reachable from the list action: ${JSON.stringify(checkpoint4TaskFocus)}`);
      } else {
        assert(layout.taskWorkspace.detail
          && layout.taskWorkspace.selectedText?.includes(checkpoint4Focus === 'child' ? 'Create one immutable Level Candidate' : 'Add or update sources')
          && layout.taskWorkspace.selectedText.includes('still available')
          && layout.taskWorkspace.selectedText.includes('Who acts next')
          && layout.taskWorkspace.controlNames.includes('back-to-list'),
        'Checkpoint 4 selected task lost its visible capability or budget projection.');
      }
      if (checkpoint4Focus === 'conflict') {
        const conflictAttention = checkpoint4TaskFocus.initialAttention
          ?.find(({ taskId }) => taskId === 'task.checkpoint-4.conflict');
        const completedAttention = checkpoint4TaskFocus.initialAttention?.find(({ state }) => state === 'MERGED');
        assert(checkpoint4TaskFocus?.selectedState === 'IN_REVIEW'
          && conflictAttention?.attention === 'CONFLICT'
          && conflictAttention.text?.includes('Recorded conflict — action required')
          && conflictAttention.text.includes('Main is always checked again before any merge')
          && conflictAttention.borderLeftWidth === '4px'
          && completedAttention?.attention === 'NONE'
          && conflictAttention.badgeColor !== completedAttention.badgeColor
          && conflictAttention.badgeBackground !== completedAttention.badgeBackground
          && checkpoint4TaskFocus.conflictCount === 1
          && checkpoint4TaskFocus.reviewItemCount === 1
          && checkpoint4TaskFocus.timelineCount === 3
          && checkpoint4TaskFocus.hasMerge === false
          && checkpoint4TaskFocus.mergeDisabled === null
          && checkpoint4TaskFocus.mergeConfirmCalls === 0
          && checkpoint4TaskFocus.reviewVisible === true
          && checkpoint4TaskFocus.statusBadgeText === 'Changes cannot be added'
          && checkpoint4TaskFocus.conflictSummaryText?.includes('Applying the agent result could overwrite newer work')
          && checkpoint4TaskFocus.conflictSummaryText.includes('Affected source: source.checkpoint-4.shared')
          && checkpoint4TaskFocus.conflictSummaryText.includes('Recorded as SEMANTIC_MERGE_CONFLICT')
          && checkpoint4TaskFocus.conflictInlineMetaCount === 1
          && checkpoint4TaskFocus.conflictActionConsequenceCount === 2
          && checkpoint4TaskFocus.timelineTechnicalDisclosureCount === 0
          && checkpoint4TaskFocus.reviewTechnicalDisclosureCount === 0
          && checkpoint4TaskFocus.processingAdoptionSectionCount === 0
          && layout.taskWorkspace.conflictText?.includes('Recommended: End this task without adding changes')
          && layout.taskWorkspace.reviewText?.includes('Saving that decision changes only this review')
          && layout.taskWorkspace.reviewText?.includes('Adds nothing to the project')
          && layout.taskWorkspace.conflictInlineMetaCount === 1
          && layout.taskWorkspace.conflictActionConsequenceCount === 2
          && layout.taskWorkspace.timelineTechnicalDisclosureCount === 0
          && layout.taskWorkspace.reviewTechnicalDisclosureCount === 0
          && layout.taskWorkspace.controlNames.includes('decide')
          && layout.taskWorkspace.controlNames.includes('reject')
          && !layout.taskWorkspace.controlNames.includes('merge'),
        'Checkpoint 4 conflict review lost its conflict-first explanation, action consequences, or inline metadata.');
      }
      if (checkpoint4Focus === 'merged') {
        assert(checkpoint4TaskFocus?.selectedState === 'MERGED'
          && checkpoint4TaskFocus.timelineCount === 8
          && checkpoint4TaskFocus.hasRevert === true
          && checkpoint4TaskFocus.detailVisible === true
          && layout.taskWorkspace.reviewDispositions.includes('USER_ACCEPTED')
          && layout.taskWorkspace.controlNames.includes('revert'),
        'Checkpoint 4 merged lineage, human disposition, timeline, or compensating-revert control is not visibly inspectable.');
      }
      if (checkpoint4Focus === 'candidate') {
        const candidateAttention = checkpoint4TaskFocus.initialAttention
          ?.find(({ taskId }) => taskId === 'task.checkpoint-4.candidate');
        assert(checkpoint4TaskFocus.selectedState === 'IN_REVIEW'
          && candidateAttention?.attention === 'ACTION_REQUIRED'
          && candidateAttention.text?.includes('Waiting for your review')
          && candidateAttention.text.includes('no review-decision, merge, or materialization authority')
          && checkpoint4TaskFocus.reviewItemCount === 1
          && checkpoint4TaskFocus.reviewVisible === true
          && checkpoint4TaskFocus.hasMerge === false
          && checkpoint4TaskFocus.hasDecide === false
          && checkpoint4TaskFocus.dispositionSelectCount === 0
          && checkpoint4TaskFocus.readonlyDispositionText === 'Pending · read-only'
          && layout.taskWorkspace.reviewText?.includes('immutable Candidate is read-only')
          && layout.taskWorkspace.reviewText.includes('does not authorize a review decision, merge, materialization, publication, or release')
          && !layout.taskWorkspace.controlNames.includes('decide')
          && !layout.taskWorkspace.controlNames.includes('merge'),
        'Checkpoint 4 Candidate review exposed mutable review controls or lost its truthful read-only authority boundary.');
      }
      if (checkpoint4Focus === 'child') {
        const childAttention = checkpoint4TaskFocus.initialAttention
          ?.find(({ state }) => state === 'ANCESTOR_BLOCKED');
        assert(checkpoint4TaskFocus.selectedState === 'ANCESTOR_BLOCKED'
          && childAttention?.attention === 'ACTION_REQUIRED'
          && childAttention.text?.includes('Blocked by parent task')
          && checkpoint4TaskFocus.selectedOrigin === 'TRUSTED_SERVICE_CHILD'
          && checkpoint4TaskFocus.authorityLineageText?.includes('Authority lineage')
          && checkpoint4TaskFocus.authorityLineageText.includes('Reserved command budget1')
          && checkpoint4TaskFocus.authorityLineageText.includes('review decisions or merge')
          && checkpoint4TaskFocus.processingAdoptionSectionCount === 0
          && checkpoint4TaskFocus.taskActionCount === 0
          && checkpoint4TaskFocus.hasMerge === false
          && checkpoint4TaskFocus.hasDecide === false
          && layout.taskWorkspace.selectedText?.includes('The child cannot execute, create a Candidate, or change the project')
          && !layout.taskWorkspace.controlNames.includes('merge')
          && !layout.taskWorkspace.controlNames.includes('decide'),
        'Checkpoint 4 derived child lost lineage, reservation, ancestor blocking, or read-only authority truth.');
      }
    }
  }
  if (mode === 'checkpoint-4-5') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 4.5 screenshot was taken before error-free readiness.');
    const expectedCheckpoint45Revision = checkpoint45Focus === 'shape-conflict' ? (width === 1440 ? 38 : 39) : 37;
    assert(layout.projectId === 'numberdroid-studio-checkpoint-2c'
      && layout.revision === expectedCheckpoint45Revision
      && layout.activityCount === expectedCheckpoint45Revision + 1 && layout.connectionState === 'Live',
    'Checkpoint 4.5 screenshot is not bound to the expected prepared or concurrent-conflict fixture revision.');
    assert(checkpoint45RoomFocus?.editorToolCount === 8
      && layout.roomDesigner.editorTools.join(',') === 'SELECT,PAINT_ROOM,PAINT_VOID,PAINT_BLOCKED,ENTRANCE,SURFACE,PROP,CLEAR',
    'Checkpoint 4.5 room editor lost one of its seven persistent-canvas tools.');
    if (checkpoint45Focus === 'irregular') {
      assert(checkpoint45RoomFocus.overviewMetrics?.['Saved room errors'] === '5'
        && checkpoint45RoomFocus.roomAttention?.length === 1
        && checkpoint45RoomFocus.roomAttention[0].tone === 'problem'
        && checkpoint45RoomFocus.roomAttention[0].text?.includes('5 saved room errors: Family Gathering Room')
        && checkpoint45RoomFocus.overviewOpenEvidence?.activated === true
        && checkpoint45RoomFocus.overviewOpenEvidence.workspace === 'rooms'
        && checkpoint45RoomFocus.overviewOpenEvidence.roomId === 'room.family-gathering'
        && checkpoint45RoomFocus.overviewOpenEvidence.panel === 'check'
        && checkpoint45RoomFocus.overviewOpenEvidence.selectedFindingCount === 1
        && checkpoint45RoomFocus.overviewOpenEvidence.selectedFindingId
        && checkpoint45RoomFocus.overviewOpenEvidence.findingsVisible === true
        && checkpoint45RoomFocus.roomId === 'room.family-gathering'
        && checkpoint45RoomFocus.tool === 'PAINT_ROOM'
        && checkpoint45RoomFocus.cellCount === 12
        && checkpoint45RoomFocus.voidCount === 2
        && checkpoint45RoomFocus.blockedCount === 1
        && checkpoint45RoomFocus.selectedOptionText?.includes('5 saved errors')
        && checkpoint45RoomFocus.errorBannerState === 'ERROR'
        && checkpoint45RoomFocus.errorBannerText?.includes('5 saved errors need correction')
        && checkpoint45RoomFocus.errorBannerText.includes('exact room v8')
        && layout.roomDesigner.shapeSavePresent
        && layout.roomDesigner.shapeConflictPresent === false
        && layout.roomDesigner.editorStatus?.includes('Saved')
        && layout.roomDesigner.shapeText?.includes('2 outside')
        && layout.roomDesigner.shapeText?.includes('1 blocked')
        && checkpoint45PhysicalPaint?.observations?.map(({ kind }) => kind).join(',') === 'VOID,BLOCKED,ROOM'
        && checkpoint45PhysicalPaint.returnedToSavedPartition === true,
      'Checkpoint 4.5 irregular room evidence lost its exact VOID/BLOCKED shape or save control.');
    }
    if (checkpoint45Focus === 'rectangle') {
      assert(checkpoint45RoomFocus.roomId === 'hall.service-east-west'
        && checkpoint45RoomFocus.tool === 'PAINT_ROOM'
        && checkpoint45RoomFocus.cellCount === 18
        && checkpoint45RoomFocus.voidCount === 0
        && checkpoint45RoomFocus.blockedCount === 0
        && layout.roomDesigner.shapeText?.includes('0 outside')
        && layout.roomDesigner.shapeText?.includes('0 blocked'),
      'Checkpoint 4.5 rectangular parity evidence no longer shows an unchanged complete envelope.');
    }
    if (checkpoint45Focus === 'prop') {
      assert(checkpoint45RoomFocus.roomId === 'room.family-gathering'
        && checkpoint45RoomFocus.tool === 'PROP'
        && checkpoint45RoomFocus.propReady?.ready === 'true'
        && checkpoint45RoomFocus.propReady.loaded === true
        && layout.roomDesigner.placementPreview.present
        && layout.roomDesigner.placementPreview.ready === 'true'
        && layout.roomDesigner.placementPreview.loadedImage
        && layout.roomDesigner.placementPreview.facts?.includes('Occupies 3 × 2 cells at 90°')
        && layout.roomDesigner.placementPreview.facts.includes('Can be rotated in four directions')
        && layout.roomDesigner.placementPreview.facts.includes('Blocks movement')
        && layout.roomDesigner.placementPreview.facts.includes('Top-left is □ at 0,0; authored anchor is +')
        && layout.roomDesigner.placementPreview.selectedRotation === '90'
        && layout.roomDesigner.placementPreview.collisionCount === 1
        && layout.roomDesigner.placementPreview.topLeftMarker === true
        && layout.roomDesigner.placementPreview.anchorLabel?.includes('after 90 degree rotation')
        && layout.roomDesigner.placementPreview.containedAtRotation === true
        && layout.roomDesigner.placementPreview.fillsRotatedStage === true
        && Math.abs(layout.roomDesigner.placementPreview.stageAspect - 1.5) <= .02
        && layout.roomDesigner.placementPreview.activeText?.includes('Ready to place')
        && layout.roomDesigner.placementPreview.useControlPresent === false,
      `Checkpoint 4.5 prop evidence lost its exact image, footprint, rotation, navigation, bounds, or placement gate: ${JSON.stringify(layout.roomDesigner.placementPreview)}`);
      assert(checkpoint45StudioPreview?.physicalKeyboardOpen === true
        && checkpoint45StudioPreview.state === 'READY'
        && checkpoint45StudioPreview.binding?.includes('revision r37')
        && checkpoint45StudioPreview.binding.includes('room version v8')
        && checkpoint45StudioPreview.notice === 'Approximate Studio Preview · read-only'
        && checkpoint45StudioPreview.limits?.includes('not Numberdroid runtime output')
        && checkpoint45StudioPreview.limits.includes('does not validate, accept, finalize, publish, or change the room')
        && checkpoint45StudioPreview.phases.join(',') === 'BACKGROUND,BODY,FOREGROUND'
        && checkpoint45StudioPreview.resourceStates.every((value) => value === 'READY')
        && checkpoint45StudioPreview.inspectFocus === 'prop.preview-overhang'
        && checkpoint45StudioPreview.inspectPressed === 'true'
        && checkpoint45StudioPreview.logical?.x === 3
        && checkpoint45StudioPreview.logical.y === 0
        && checkpoint45StudioPreview.logical.width === 1
        && checkpoint45StudioPreview.logical.height === 1
        && checkpoint45StudioPreview.visual?.x === 1
        && checkpoint45StudioPreview.visual.y === -2
        && checkpoint45StudioPreview.visual.width === 3
        && checkpoint45StudioPreview.visual.height === 3
        && checkpoint45StudioPreview.anchor?.x === 3.5
        && checkpoint45StudioPreview.anchor.y === 1
        && checkpoint45StudioPreview.cellCount === 12
        && checkpoint45StudioPreview.voidCount === 2
        && checkpoint45StudioPreview.blockedCount === 1
        && checkpoint45StudioPreview.connectorCount >= 1
        && checkpoint45StudioPreview.mutationControlCount === 0
        && checkpoint45StudioPreview.pageHorizontalOverflow === false
        && checkpoint45StudioPreview.stageVisible === true
        && checkpoint45StudioPreview.loadFocusPreserved === true
        && checkpoint45StudioPreview.responsiveLayout?.viewportWidth === width
        && checkpoint45StudioPreview.responsiveLayout.display === 'grid'
        && (width > 1200
          ? checkpoint45StudioPreview.responsiveLayout.sideBySide === true && checkpoint45StudioPreview.responsiveLayout.stacked === false
          : checkpoint45StudioPreview.responsiveLayout.sideBySide === false && checkpoint45StudioPreview.responsiveLayout.stacked === true)
        && checkpoint45StudioPreview.pixelSamplesInViewport === true
        && checkpoint45StudioPreview.transparentPixelDelta <= 8
        && checkpoint45StudioPreview.opaqueOverhangPixelDelta >= 30
        && checkpoint45StudioPreview.changedPixelCount > 0
        && checkpoint45StudioPreview.nonGetRequests.length === 0
        && checkpoint45StudioPreview.editorRoundTrip?.after?.activeKey === 'room-tool-PROP'
        && checkpoint45StudioPreview.editorRoundTrip.after.roomId === 'room.family-gathering'
        && checkpoint45StudioPreview.editorRoundTrip.after.editorPresent === true
        && checkpoint45StudioPreview.editorRoundTrip.after.previewPresent === false
        && checkpoint45StudioPreview.editorRoundTrip.before.shape?.dirty === true
        && checkpoint45StudioPreview.editorRoundTrip.before.nonZeroScrollKeys.length > 0
        && checkpoint45StudioPreview.editorRoundTrip.sameScroll === true
        && checkpoint45StudioPreview.editorRoundTrip.samePage === true
        && checkpoint45StudioPreview.editorRoundTrip.sameShape === true,
      `Studio preview lost exact pins, read-only authority, logical/visual separation, alpha, overhang, or segment order: ${JSON.stringify(checkpoint45StudioPreview)}`);
    }
    if (checkpoint45Focus === 'shape-refresh') {
      assert(checkpoint45RoomFocus.roomId === 'room.family-gathering'
        && checkpoint45RoomFocus.tool === 'PAINT_VOID'
        && checkpoint45RoomFocus.refresh?.beforeVoidCount === 3
        && checkpoint45RoomFocus.refresh.afterVoidCount === 3
        && checkpoint45RoomFocus.refresh.dirty === true
        && checkpoint45RoomFocus.refresh.focused === true
        && checkpoint45RoomFocus.refresh.sameNode === true,
      'Checkpoint 4.5 shape draft or keyboard focus did not survive an unchanged passive refresh.');
    }
    if (checkpoint45Focus === 'shape-conflict') {
      assert(checkpoint45RoomFocus.roomId === 'room.family-gathering'
        && checkpoint45RoomFocus.tool === 'PAINT_VOID'
        && checkpoint45RoomFocus.shapeDraftDirty === true
        && checkpoint45RoomFocus.shapeConflict?.includes('changed while your shape draft was open')
        && layout.roomDesigner.shapeSavePresent
        && layout.roomDesigner.shapeConflictPresent === true
        && layout.roomDesigner.editorStatus?.includes('Conflict'),
      'Checkpoint 4.5 concurrent room-version change did not retain and explicitly block the local shape draft.');
    }
  }
  if (mode === 'a1-7') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'A1.7 screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-a1-7'
      && layout.revision === 2 && layout.activityCount === 2 && layout.connectionState === 'Live',
    'A1.7 screenshot is not bound to the prepared revision-2 fixture.');
    assert(expectedWorkspace === 'tasks'
      && a17Evidence?.initial.state === 'WAITING_FOR_YOUR_REVIEW'
      && a17Evidence.initial.previewState === 'READY'
      && a17Evidence.initial.candidate === 'not-user-accepted'
      && a17Evidence.initial.naturalWidth === 64
      && a17Evidence.initial.naturalHeight === 64
      && a17Evidence.initial.alt === 'Transfer console processed draft processed asset preview'
      && a17Evidence.initial.srcPath === '/api/projects/numberdroid-studio-a1-7/tasks/task.a1-7.processed-asset-review/processing-result-adoptions/3/selected-output'
      && a17Evidence.initial.objectFit === 'contain'
      && a17Evidence.initial.objectPosition === '50% 50%'
      && a17Evidence.initial.checkerBackground !== 'none'
      && a17Evidence.initial.correctionCount === 8
      && a17Evidence.initial.warningCount === 1
      && a17Evidence.initial.mutationControlCount === 0
      && a17Evidence.initial.headingOrder === 'current-adoption-facts',
    `A1.7 exact review state, preview, quality facts, hierarchy, or no-control boundary failed: ${JSON.stringify(a17Evidence)}`);
    assert(a17Evidence.fallback.primaryState === 'WAITING_FOR_YOUR_REVIEW'
      && a17Evidence.fallback.decodeFailure === true
      && a17Evidence.fallback.previewState === 'UNAVAILABLE'
      && a17Evidence.fallback.text?.includes('The exact image preview is unavailable.')
      && a17Evidence.fallback.imageCount === 0
      && a17Evidence.fallback.correctionCount === 8
      && a17Evidence.fallback.navigationPresent === true
      && a17Evidence.rerendered === true
      && a17Evidence.restoredReady === true,
    'A1.7 real PNG decode failure did not remain bounded or restore the exact READY image.');
    assert(a17Evidence.passiveRefresh.sameTaskNode === true
      && a17Evidence.passiveRefresh.sameAdoptionNode === true
      && a17Evidence.passiveRefresh.state === 'WAITING_FOR_YOUR_REVIEW'
      && a17Evidence.passiveRefresh.previewState === 'READY'
      && a17Evidence.passiveRefresh.disclosureOpen === true
      && a17Evidence.passiveRefresh.focusedSummary === true
      && a17Evidence.passiveRefresh.selectedText === a17Evidence.passiveRefresh.expectedSelectedText
      && a17Evidence.passiveRefresh.scrollUnchanged === true
      && a17Evidence.passiveRefresh.taskScrollUnchanged === true
      && a17Evidence.passiveRefresh.taskScrollExercised === true,
    `A1.7 unchanged passive refresh replaced DOM or lost focus, selection, disclosure, or scroll: ${JSON.stringify(a17Evidence.passiveRefresh)}`);
    assert(a17Evidence.changedProjectionRefresh.hookChangedSection === true
      && a17Evidence.changedProjectionRefresh.hookRestored === true
      && a17Evidence.changedProjectionRefresh.taskNodeReplaced === true
      && a17Evidence.changedProjectionRefresh.adoptionNodeReplaced === true
      && a17Evidence.changedProjectionRefresh.state === 'WAITING_FOR_YOUR_REVIEW'
      && a17Evidence.changedProjectionRefresh.previewState === 'READY'
      && a17Evidence.changedProjectionRefresh.disclosureOpen === true
      && a17Evidence.changedProjectionRefresh.focusedSummary === true
      && a17Evidence.changedProjectionRefresh.selectedText === a17Evidence.changedProjectionRefresh.expectedSelectedText
      && a17Evidence.changedProjectionRefresh.scrollUnchanged === true
      && a17Evidence.changedProjectionRefresh.taskScrollUnchanged === true
      && a17Evidence.changedProjectionRefresh.taskScrollExercised === true,
    `A1.7 changed projection did not restore compatible focus, selection, disclosure, or scroll: ${JSON.stringify(a17Evidence.changedProjectionRefresh)}`);
    assert(a17Evidence.durableSnapshotUnchanged === true,
      'A1.7 browser reads changed the durable project/task/adoption/activity projection.');
    assert(a17Evidence.final.visible === true
      && a17Evidence.final.horizontallyContained === true
      && a17Evidence.final.technicalClosed === true
      && a17Evidence.final.selectedTaskState === 'ACTIVE'
      && a17Evidence.final.genericTaskReviewSectionPresent === true,
    'A1.7 final review frame is not a bounded ACTIVE task detail with closed technical disclosure.');
    assert(a17Evidence.accessibilityScope === 'processing-adoption'
      && a17Evidence.accessibility.some(({ role, name }) => role === 'heading' && name === 'Processed asset draft')
      && a17Evidence.accessibility.some(({ role, name }) => role === 'image' && name === 'Transfer console processed draft processed asset preview')
      && a17Evidence.accessibility.filter(({ role }) => role === 'list').length >= 2
      && a17Evidence.accessibility.filter(({ role }) => role === 'listitem').length >= 9
      && a17Evidence.accessibility.some(({ role, name }) => role === 'DisclosureTriangle' && name === 'Technical details'),
    `A1.7 accessibility tree lost its named heading/image, lists, or disclosure: ${JSON.stringify(a17Evidence.accessibility)}`);
    assert(a17Evidence.browserRequests.length > 0
      && a17Evidence.browserRequests.every(({ method, path }) => method === 'GET' && !path.startsWith('/internal/')),
    `A1.7 browser evidence crossed its read-only transport boundary: ${JSON.stringify(a17Evidence.browserRequests)}`);
  }
  if (mode === 'checkpoint-2a') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 2A screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-checkpoint-2a'
      && layout.revision === 4 && layout.activityCount === 5 && layout.connectionState === 'Live',
    'Checkpoint 2A screenshot is not bound to the prepared revision-4 fixture.');
    if (expectedWorkspace === 'sources') {
      const approved = layout.sources.find((source) => source.sourceId === 'source.family-hygiene-approved');
      assert(layout.sources.length === 1, 'Checkpoint 2A source view must contain exactly the approved fixture source.');
      assert(approved?.previewState === 'READY' && approved.loadedImage,
        'The Family Hygiene original-source preview is not loaded.');
      assert(approved.objectFit === 'contain', 'The original-source preview no longer preserves its aspect ratio.');
      assert(approved.objectPosition === '50% 50%', 'The original-source preview is no longer centered.');
      assert(approved.naturalWidth === 1254 && approved.naturalHeight === 1254,
        'The Family Hygiene preview did not load the complete 1254×1254 original.');
      assertImageWithinPreview(approved, 'Family Hygiene');
      assertRenderedAspect(approved, 'Family Hygiene');
      assert(approved.preview?.width <= 221 && Math.abs(approved.preview.width - approved.preview.height) <= 1,
        'The original-source preview is no longer a contained square of at most 220px.');
      assert(approved.linkHref === new URL('/api/projects/numberdroid-studio-checkpoint-2a/artifacts/sha256/67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e', pageUrl).href,
        'The source preview link no longer targets the project-scoped original CAS resource.');
      assert(approved.linkTarget === '_blank' && approved.linkRel.split(/\s+/).includes('noopener')
        && approved.linkRel.split(/\s+/).includes('noreferrer') && approved.linkTabIndex === 0
        && approved.linkReferrerPolicy === 'no-referrer',
      'The original-source link is not keyboard-accessible or safely isolated in a new tab.');
      assert(approved.linkLabel === 'Open Family Hygiene floor 2×2 original source image in a new tab',
        'The original-source link lost its accessible new-tab label.');
      assert(approved.captionText === 'Open original in new tab ↗'
        && approved.linkDescribedBy === approved.captionId,
      'The source preview lost its visible, accessibility-associated new-tab affordance.');
      assert(layout.aspectRatioProbes.length === 2, 'The arbitrary-aspect source containment probes are missing.');
      for (const probe of layout.aspectRatioProbes) {
        assert(probe.objectFit === 'contain' && probe.preview.width <= 221
          && Math.abs(probe.preview.width - probe.preview.height) <= 1,
        `${probe.name} no longer uses the bounded square source preview.`);
        assertImageWithinPreview(probe, probe.name);
        assertRenderedAspect(probe, probe.name);
      }
      assert(layout.aspectRatioProbes.some((probe) => probe.mediaType === 'image/png'
        && probe.naturalWidth === 4096 && probe.naturalHeight === 1),
      'The extreme-wide PNG containment probe did not retain its natural dimensions.');
      assert(layout.aspectRatioProbes.some((probe) => probe.mediaType === 'image/webp'
        && probe.naturalWidth === 1 && probe.naturalHeight === 4096),
      'The extreme-tall WebP containment probe did not retain its natural dimensions.');
      const targetIdsBeforeOpen = new Set((await devtools.send('Target.getTargets')).targetInfos.map(({ targetId: id }) => id));
      const focused = await devtools.send('Runtime.evaluate', {
        expression: `(() => {
          const link = document.querySelector('[data-source-id="source.family-hygiene-approved"] a.source-preview.ready');
          link.focus();
          return document.activeElement === link;
        })()`,
        returnByValue: true,
      }, sessionId);
      assert(focused.result?.value === true, 'The original-source link could not receive keyboard focus.');
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, sessionId);
      let originalTarget = null;
      for (let attempt = 0; attempt < 30 && !originalTarget; attempt += 1) {
        const targets = (await devtools.send('Target.getTargets')).targetInfos;
        originalTarget = targets.find((target) => !targetIdsBeforeOpen.has(target.targetId)
          && target.type === 'page' && target.url === approved.linkHref) ?? null;
        if (!originalTarget) await delay(50);
      }
      assert(originalTarget, 'Pressing Enter on the source preview did not open its original CAS image in a new browser tab.');
      const attachedOriginal = await devtools.send('Target.attachToTarget', {
        targetId: originalTarget.targetId,
        flatten: true,
      });
      await devtools.send('Runtime.enable', {}, attachedOriginal.sessionId);
      let originalSecurity = null;
      for (let attempt = 0; attempt < 30 && !originalSecurity; attempt += 1) {
        const evaluatedOriginal = await devtools.send('Runtime.evaluate', {
          expression: `document.readyState === 'complete' ? ({
            url: location.href,
            openerIsNull: window.opener === null,
            referrer: document.referrer,
          }) : null`,
          returnByValue: true,
        }, attachedOriginal.sessionId);
        originalSecurity = evaluatedOriginal.result?.value ?? null;
        if (!originalSecurity) await delay(50);
      }
      assert(originalSecurity?.url === approved.linkHref && originalSecurity.openerIsNull === true
        && originalSecurity.referrer === '',
      'The keyboard-opened original tab lost its exact URL, null opener, or empty referrer boundary.');
      await devtools.send('Target.closeTarget', { targetId: originalTarget.targetId });
      assert(approved.text.includes('APPROVED_SOURCE') && approved.text.includes('USER_APPROVED')
        && approved.text.includes('human_upload') && approved.text.includes('1254×1254')
        && approved.text.includes('2720519'), 'The approved source lifecycle/provenance/identity is not visible.');
      assert(approved.reviewMutationCount === 0, 'An approved source still exposes a review mutation control.');
      assert(layout.stagedIntakes.length === 1 && layout.stagedIntakes[0].hasResume
        && layout.stagedIntakes[0].hasDiscard, 'The durable staged intake lacks Resume or Discard recovery.');
      assert(layout.sourceForm.present && layout.sourceForm.labelledFields === 8
        && layout.sourceForm.hasLiveStatus && layout.sourceForm.submitDisabled === false,
      'The source intake form is missing its labelled fields, live status, or enabled submit control.');
      if (checkpoint2aFocus === null) {
        assert(layout.sourceForm.rect?.x >= 0 && layout.sourceForm.rect?.right <= width
          && layout.sourceForm.rect?.y >= 0 && layout.sourceForm.rect?.bottom <= height,
        'The source intake form is not fully visible in the intake screenshot.');
      }
      if (checkpoint2aFocus === 'staged-intake') {
        assert(layout.stagedIntakes[0].rect?.x >= 0 && layout.stagedIntakes[0].rect?.right <= width
          && layout.stagedIntakes[0].rect?.y >= 0 && layout.stagedIntakes[0].rect?.bottom <= height,
        'The Resume/Discard recovery row is not fully visible in the recovery screenshot.');
      }
      if (checkpoint2aFocus === 'approved-source') {
        assert(approved.preview?.x >= 0 && approved.preview?.right <= width
          && approved.preview?.y >= 0 && approved.preview?.bottom <= height,
        'The full approved-source preview rect is not contained in the viewport.');
      }
    }
    if (expectedWorkspace === 'activity') {
      assert(layout.activityText.includes('Agent command denied: GRANT_SCOPE_MISSING.')
        && layout.activityText.includes('source.review.propose')
        && layout.activityText.includes('atlas.agent'),
      'The durable denied-attempt Activity evidence is not visible.');
      assert(!layout.activityText.includes('audit-sentinel-secret'), 'Activity leaked the audit redaction sentinel.');
    }
  }
  if (mode === 'checkpoint-2b') {
    assert(layout.visualEvidenceReady === 'true' && layout.visualErrorCount === 0,
      'Checkpoint 2B screenshot was taken before error-free readiness.');
    assert(layout.projectId === 'numberdroid-studio-checkpoint-2b'
      && layout.revision === 7 && layout.activityCount === 7 && layout.connectionState === 'Live',
    'Checkpoint 2B screenshot is not bound to the prepared revision-7 fixture.');
    if (expectedWorkspace === 'sources') {
      const cutter = layout.cutter;
      assert(cutter.present && cutter.overlayRectangleCount === 4 && cutter.rectangleRowCount === 4,
        'Checkpoint 2B cutter does not show the four canonical explicit rectangles.');
      assert(JSON.stringify(cutter.overlayRectangles.map(({ x, y, width, height }) => [x, y, width, height]))
        === JSON.stringify([[3, 3, 622, 622], [629, 3, 622, 622], [3, 629, 622, 622], [629, 629, 622, 622]])
        && cutter.overlayRectangles.every(({ label }) => label?.includes('width 622, height 622')),
      'The source-coordinate overlay differs from the pinned Family Hygiene half-open rectangles.');
      assert(cutter.focusableMoveCount === 4 && cutter.focusableResizeCount === 4
        && cutter.numericInputCount === 16 && cutter.includeInputCount === 4
        && cutter.remapControlCount === 4 && cutter.remapOptionCount === 20,
      'The cutter lost its keyboard-accessible overlay, authoritative numeric controls, or explicit recut mapping controls.');
      assert(cutter.scrollerOverflowX === 'auto' && cutter.canvas.width >= 320
        && Math.abs(cutter.canvas.width - cutter.canvas.height) <= 1
        && Math.abs(cutter.overlay.width - cutter.canvas.width) <= 1
        && Math.abs(cutter.overlay.height - cutter.canvas.height) <= 1,
      'The source-resolution canvas no longer stays square, overlaid, and locally scrollable.');
      assert(cutter.sourceImageLoaded && cutter.sourceImageNaturalWidth === 1254
        && cutter.sourceImageNaturalHeight === 1254,
      'The cutter canvas did not load the complete approved 1254×1254 source.');
      assert(cutter.committedPreviews.length === 4
        && cutter.committedPreviews.every((preview) => preview.loaded
          && preview.naturalWidth === 622 && preview.naturalHeight === 622
          && preview.objectFit === 'contain'),
      'The four committed 622×622 slice previews are not loaded and contained.');
      assert(cutter.status?.startsWith('APPLIED · 4/4 · attempt 1')
        && cutter.hasSave && cutter.hasPreview && !cutter.hasCommit,
      'The cutter action state no longer reflects an already-applied one-time commit.');
      assert(JSON.stringify(cutter.jobEvents.map(({ sequence, type }) => [sequence, type]))
        === JSON.stringify([
          [1, 'QUEUED'], [2, 'RUNNING'], [3, 'PROGRESS'], [4, 'PROGRESS'],
          [5, 'PROGRESS'], [6, 'PROGRESS'], [7, 'SUCCEEDED'], [8, 'APPLIED'],
        ]) && !/"operationIdempotencyKey"|"grantId"|"lease"|"workerId"|"token"|\/workspace|file:/i.test(JSON.stringify(cutter.jobEvents)),
      'The visible durable job history is incomplete, out of order, or exposes internal authority/worker fields.');
      assert(cutter.helpText.includes('without resizing them')
        && cutter.helpText.includes('changing their edges')
        && cutter.helpText.includes('deciding their gameplay purpose')
        && cutter.helpText.includes('Asset Library'),
      'The cutter lost its explicit Checkpoint 2B scope boundary.');
      if (checkpoint2bFocus === 'committed-slices') {
        assert(cutter.committedPreviews.some((preview) => preview.rect?.bottom > 0 && preview.rect?.y < height),
          'The committed slice previews are not visible in the evidence viewport.');
      } else if (checkpoint2bFocus === 'rectangle-inspector') {
        assert(cutter.inspector?.bottom > 0 && cutter.inspector?.y < height,
          'The rectangle inspector is not visible in the evidence viewport.');
      } else {
        assert(cutter.scroller?.bottom > 0 && cutter.scroller?.y < height,
          'The cutter canvas is not visible in the evidence viewport.');
      }
    }
  }

  let taskFeedbackEvidence = null;
  let taskFeedbackFormScreenshot = null;
  if (mode === 'review-feedback' && expectedWorkspace === 'tasks') {
    const resultPromise = devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const waitFor = async (predicate, message) => {
          const deadline = Date.now() + 5_000;
          while (!predicate() && Date.now() < deadline) await new Promise((done) => setTimeout(done, 25));
          if (!predicate()) throw new Error(message);
        };
        const reviewRoot = () => document.querySelector('[data-task-review-context]');
        const context = () => JSON.parse(reviewRoot().dataset.taskReviewContext);
        const field = () => document.querySelector('[data-task-feedback-summary]');
        const comment = () => document.querySelector('[data-task-review-reason]');
        const choice = () => document.querySelector('[data-task-review-disposition]');
        const refresh = async () => {
          const button = document.getElementById('refresh-button'); button.click();
          await waitFor(() => !button.disabled, 'Feedback refresh did not settle.');
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        };
        const projectId = document.getElementById('workspace-content').dataset.renderedProjectId;
        const taskId = 'task.review-feedback';
        const base = '/api/projects/' + encodeURIComponent(projectId) + '/tasks/' + encodeURIComponent(taskId);
        const session = await fetch('/api/ui-session').then((response) => response.json());
        const post = async (path, body) => {
          const response = await fetch(path, { method: 'POST', headers: {
            'content-type': 'application/json', 'x-numberdroid-studio-csrf': session.csrfToken,
          }, body: JSON.stringify(body) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message ?? 'Feedback request failed.');
          return result;
        };
        let confirmCalls = 0;
        const originalConfirm = window.confirm;
        window.confirm = () => { confirmCalls += 1; return true; };
        try {
          const initial = context();
          for (const select of document.querySelectorAll('[data-task-review-disposition]')) select.value = 'USER_ACCEPTED';
          choice().value = 'CHANGES_REQUESTED';
          document.querySelector('[data-task-control="decide"]').click();
          await new Promise((done) => setTimeout(done, 100));
          const requiredSummary = confirmCalls === 0 && document.activeElement === field()
            && context().reviewVersion === initial.reviewVersion;
          field().value = 'Make the surface boundary easier to read.';
          comment().value = 'Keep the saved footprint unchanged.';
          field().focus(); field().setSelectionRange(5, 12);
          window.scrollBy(0, 80); const scrollBefore = { x: scrollX, y: scrollY };
          await refresh();
          const sameReviewRetained = field().value === 'Make the surface boundary easier to read.'
            && comment().value === 'Keep the saved footprint unchanged.'
            && choice().value === 'CHANGES_REQUESTED' && document.activeElement === field()
            && field().selectionStart === 5 && field().selectionEnd === 12
            && scrollX === scrollBefore.x && scrollY === scrollBefore.y;
          reviewRoot().scrollIntoView({ block: 'start', inline: 'nearest' });
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          window.__studioFeedbackFormCapture = { ready: true, released: false };
          await waitFor(() => window.__studioFeedbackFormCapture.released, 'Filled feedback form capture did not complete.');
          await post(base + '/reviews/' + encodeURIComponent(initial.reviewId) + '/decide', {
            decisions: [...document.querySelectorAll('[data-task-review-disposition]')].map((select) => ({ changeId: select.dataset.taskReviewDisposition, disposition: 'USER_REJECTED', reason: 'External review note.' })),
            expectedReviewVersion: initial.reviewVersion, confirm: true,
          });
          await refresh();
          const newVersionCleared = context().reviewVersion === initial.reviewVersion + 1
            && field().value === '' && comment().value === 'External review note.'
            && choice().value === 'USER_REJECTED';
          choice().value = 'CHANGES_REQUESTED'; field().value = 'Make the surface boundary easier to read.';
          comment().value = 'Keep the saved footprint unchanged.';
          document.querySelector('[data-task-control="decide"]').click();
          await waitFor(() => document.querySelector('.task-detail [data-task-state]')?.dataset.taskState === 'CHANGES_REQUESTED', 'Feedback did not reach changes requested.');
          const saved = await fetch(base).then((response) => response.json());
          const exactFeedback = saved.review.feedback?.summary === 'Make the surface boundary easier to read.'
            && saved.review.feedback.basisReviewVersion === initial.reviewVersion + 1
            && saved.review.items[0].reason === 'Keep the saved footprint unchanged.';
          document.querySelector('[data-task-control="resume"]').click();
          await waitFor(() => document.querySelector('.task-detail [data-task-state]')?.dataset.taskState === 'ACTIVE', 'Continuation authorization did not settle.');
          const history = document.querySelector('.task-review');
          const resumedHistoryTruth = document.querySelector('.task-detail [data-task-state]').textContent === 'Agent work allowed'
            && history.querySelector('h3')?.textContent === 'Previous review'
            && history.textContent.includes('Studio does not start an agent')
            && history.textContent.includes('Make the surface boundary easier to read.')
            && history.textContent.includes('Keep the saved footprint unchanged.')
            && !history.textContent.includes('Waiting for your review')
            && !history.querySelector('[data-task-control="decide"]');
          document.querySelector('[data-task-control="pause"]').click();
          await waitFor(() => document.querySelector('.task-detail [data-task-state]')?.dataset.taskState === 'PAUSED', 'Pause after continuation did not settle.');
          const pausedHistory = document.querySelector('.task-review');
          const pausedHistoryTruth = pausedHistory.querySelector('h3')?.textContent === 'Previous review'
            && pausedHistory.textContent.includes('The task is paused; the assigned agent cannot make changes')
            && pausedHistory.textContent.includes('Make the surface boundary easier to read.')
            && pausedHistory.textContent.includes('Keep the saved footprint unchanged.')
            && !pausedHistory.textContent.includes('Waiting for your review')
            && !pausedHistory.querySelector('[data-task-control="decide"]');
          return { requiredSummary, sameReviewRetained, newVersionCleared, exactFeedback, resumedHistoryTruth, pausedHistoryTruth,
            noOverflow: document.documentElement.scrollWidth <= innerWidth };
        } finally { window.confirm = originalConfirm; delete window.__studioFeedbackFormCapture; }
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId, 30_000);
    // The interaction remains awaited below; mark an early rejection handled while capturing.
    resultPromise.catch(() => {});
    const captureReadyDeadline = Date.now() + 10_000;
    let formReady = false;
    while (Date.now() < captureReadyDeadline) {
      const ready = await devtools.send('Runtime.evaluate', {
        expression: 'window.__studioFeedbackFormCapture?.ready === true', returnByValue: true,
      }, sessionId);
      if (ready.result?.value === true) { formReady = true; break; }
      await delay(50);
    }
    assert(formReady, 'The filled feedback form did not become ready for capture.');
    const formScreenshot = await devtools.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    }, sessionId);
    taskFeedbackFormScreenshot = outputPath.replace(/\.png$/i, '-form.png');
    await mkdir(dirname(taskFeedbackFormScreenshot), { recursive: true });
    await writeFile(taskFeedbackFormScreenshot, Buffer.from(formScreenshot.data, 'base64'));
    await devtools.send('Runtime.evaluate', {
      expression: 'window.__studioFeedbackFormCapture.released = true', returnByValue: true,
    }, sessionId);
    const result = await resultPromise;
    taskFeedbackEvidence = result.result?.value ?? null;
    assert(taskFeedbackEvidence && Object.values(taskFeedbackEvidence).every((value) => value === true),
      `Task feedback did not preserve exact-review drafts and truthful continuation: ${JSON.stringify(taskFeedbackEvidence)} ${JSON.stringify(result.exceptionDetails ?? null)}`);
    assertNoProtocolErrors('After task feedback interactions');
  }

  checkpoint2aSourceFocusFinal = await focusCheckpoint2aSourceTarget('before-screenshot');
  assertSyntheticProtocolErrorsBounded();
  assertNoProtocolErrors('Before screenshot capture');
  const screenshot = await devtools.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  }, sessionId);
  const dom = domPath
    ? await devtools.send('Runtime.evaluate', {
      expression: mode === 'a1-7'
        ? `JSON.stringify({
          schemaVersion: 1,
          projectId: document.documentElement.dataset.visualProjectId,
          taskContext: document.querySelector('[data-task-view="detail"]')?.dataset.taskContext ?? null,
          state: document.querySelector('[data-processing-adoption]')?.dataset.processingAdoptionState ?? null,
          candidate: document.querySelector('[data-processing-adoption]')?.dataset.processingAdoptionCandidate ?? null,
          sectionHtml: document.querySelector('[data-processing-adoption]')?.outerHTML ?? null,
        }, null, 2)`
        : 'document.documentElement.outerHTML',
      returnByValue: true,
    }, sessionId)
    : null;
  let checkpoint2bInteractionEvidence = null;
  if (mode === 'checkpoint-2b' && expectedWorkspace === 'sources' && checkpoint2bFocus === 'cutter-canvas') {
    const zoom100 = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const select = document.querySelector('[data-cutter-zoom]');
        select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true }));
        const canvas = document.querySelector('.cutter-canvas'); const scroller = document.querySelector('.cutter-scroll');
        return { width: canvas?.style.width, scrollWidth: scroller?.scrollWidth, clientWidth: scroller?.clientWidth };
      })()`, returnByValue: true,
    }, sessionId);
    assert(zoom100.result?.value?.width === '1254px'
      && zoom100.result.value.scrollWidth > zoom100.result.value.clientWidth,
    '100% zoom did not preserve the 1254-source-pixel canvas with local horizontal scrolling.');
    const zoom200 = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const select = document.querySelector('[data-cutter-zoom]');
        select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true }));
        const canvas = document.querySelector('.cutter-canvas'); const scroller = document.querySelector('.cutter-scroll');
        return { width: canvas?.style.width, scrollWidth: scroller?.scrollWidth, clientWidth: scroller?.clientWidth };
      })()`, returnByValue: true,
    }, sessionId);
    assert(zoom200.result?.value?.width === '2508px'
      && zoom200.result.value.scrollWidth > zoom200.result.value.clientWidth,
    '200% zoom did not preserve the 2508-CSS-pixel canvas with local horizontal scrolling.');
    const scrollRefresh = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const beforeScroller = document.querySelector('.cutter-scroll');
        beforeScroller.scrollLeft = Math.min(321, beforeScroller.scrollWidth - beforeScroller.clientWidth);
        beforeScroller.scrollTop = Math.min(417, beforeScroller.scrollHeight - beforeScroller.clientHeight);
        const beforeField = document.querySelector('[data-cutter-grid-form] [name="top"]');
        beforeField.value = '5';
        beforeField.focus();
        const before = { left: beforeScroller.scrollLeft, top: beforeScroller.scrollTop,
          context: beforeScroller.dataset.cutterScrollContext,
          windowLeft: window.scrollX, windowTop: window.scrollY,
          fieldValue: beforeField.value, fieldValid: beforeField.checkValidity() };
        const refreshButton = document.getElementById('refresh-button');
        const observations = [];
        for (let index = 0; index < 2; index += 1) {
          refreshButton.click();
          const deadline = Date.now() + 5000;
          while (refreshButton.disabled && Date.now() < deadline) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 20));
          }
          await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
          const currentScroller = document.querySelector('.cutter-scroll');
          const currentField = document.querySelector('[data-cutter-grid-form] [name="top"]');
          observations.push({ sameScroller: currentScroller === beforeScroller,
            sameField: currentField === beforeField, focused: document.activeElement === beforeField,
            fieldValue: currentField?.value, fieldValid: currentField?.checkValidity(),
            left: currentScroller?.scrollLeft, top: currentScroller?.scrollTop,
            context: currentScroller?.dataset.cutterScrollContext,
            windowLeft: window.scrollX, windowTop: window.scrollY,
            refreshSettled: !refreshButton.disabled });
        }
        return { before, observations,
          zoom: document.querySelector('[data-cutter-zoom]')?.value };
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert(scrollRefresh.result?.value?.before.left > 0 && scrollRefresh.result.value.before.top > 0
      && scrollRefresh.result.value.before.fieldValid === true
      && scrollRefresh.result.value.zoom === '2' && scrollRefresh.result.value.observations.length === 2
      && scrollRefresh.result.value.observations.every((observation) => observation.sameScroller === true
        && observation.sameField === true && observation.focused === true
        && observation.fieldValue === scrollRefresh.result.value.before.fieldValue
        && observation.fieldValid === true && observation.refreshSettled === true
        && observation.context === scrollRefresh.result.value.before.context
        && observation.left === scrollRefresh.result.value.before.left
        && observation.top === scrollRefresh.result.value.before.top
        && observation.windowLeft === scrollRefresh.result.value.before.windowLeft
        && observation.windowTop === scrollRefresh.result.value.before.windowTop),
    'Two passive refreshes replaced the cutter DOM or lost its focused draft, local scroll axes, or window position.');
    const committedGridDraft = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const beforeScroller = document.querySelector('.cutter-scroll');
        const beforeField = document.querySelector('[data-cutter-grid-form] [name="top"]');
        const before = { left: beforeScroller.scrollLeft, top: beforeScroller.scrollTop,
          windowLeft: window.scrollX, windowTop: window.scrollY, value: beforeField.value };
        beforeField.closest('form').requestSubmit();
        const deadline = Date.now() + 5000;
        while ((document.querySelector('[data-cutter-grid-form] button[type="submit"]')?.disabled
            || beforeField.isConnected) && Date.now() < deadline) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 20));
        }
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const afterScroller = document.querySelector('.cutter-scroll');
        const afterField = document.querySelector('[data-cutter-grid-form] [name="top"]');
        return { before, oldFieldDisconnected: !beforeField.isConnected,
          value: afterField?.value, rectangleCount: document.querySelectorAll('[data-cutter-overlay] g').length,
          firstRectangle: {
            y: document.querySelector('[data-rectangle-index="0"][data-rectangle-field="y"]')?.value,
            height: document.querySelector('[data-rectangle-index="0"][data-rectangle-field="height"]')?.value,
            overlayY: document.querySelector('[data-cutter-move="0"]')?.getAttribute('y'),
            overlayHeight: document.querySelector('[data-cutter-move="0"]')?.getAttribute('height'),
          },
          sameZoom: document.querySelector('[data-cutter-zoom]')?.value === '2',
          scrollerReplaced: beforeScroller !== afterScroller,
          left: afterScroller?.scrollLeft, top: afterScroller?.scrollTop,
          windowLeft: window.scrollX, windowTop: window.scrollY,
          settled: !document.querySelector('[data-cutter-grid-form] button[type="submit"]')?.disabled };
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert(committedGridDraft.result?.value?.oldFieldDisconnected === true
      && committedGridDraft.result.value.before.value === '5'
      && committedGridDraft.result.value.value === committedGridDraft.result.value.before.value
      && committedGridDraft.result.value.rectangleCount === 4
      && committedGridDraft.result.value.firstRectangle.y === '5'
      && committedGridDraft.result.value.firstRectangle.height === '621'
      && committedGridDraft.result.value.firstRectangle.overlayY
        === committedGridDraft.result.value.firstRectangle.y
      && committedGridDraft.result.value.firstRectangle.overlayHeight
        === committedGridDraft.result.value.firstRectangle.height
      && committedGridDraft.result.value.sameZoom === true
      && committedGridDraft.result.value.scrollerReplaced === true
      && committedGridDraft.result.value.left === committedGridDraft.result.value.before.left
      && committedGridDraft.result.value.top === committedGridDraft.result.value.before.top
      && committedGridDraft.result.value.windowLeft === committedGridDraft.result.value.before.windowLeft
      && committedGridDraft.result.value.windowTop === committedGridDraft.result.value.before.windowTop
      && committedGridDraft.result.value.settled === true,
    'Submitting the retained grid draft did not preserve same-zoom scroll/window context through the required rerender.');
    const restoredFit = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const select = document.querySelector('[data-cutter-zoom]');
        select.value = 'fit'; select.dispatchEvent(new Event('change', { bubbles: true }));
        return { zoom: document.querySelector('[data-cutter-zoom]')?.value,
          width: document.querySelector('.cutter-canvas')?.style.width,
          scrollLeft: document.querySelector('.cutter-scroll')?.scrollLeft,
          scrollTop: document.querySelector('.cutter-scroll')?.scrollTop };
      })()`, returnByValue: true,
    }, sessionId);
    assert(restoredFit.result?.value?.zoom === 'fit' && restoredFit.result.value.width === ''
      && restoredFit.result.value.scrollLeft === 0 && restoredFit.result.value.scrollTop === 0,
      'Fit zoom did not restore the responsive cutter canvas with a deliberate local-scroll reset.');
    const excluded = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('[data-rectangle-index="0"][data-rectangle-field="included"]')?.click();
        const remap = document.querySelector('[data-rectangle-index="0"][data-rectangle-field="replacesSliceId"]');
        const firstOverlay = document.querySelector('[data-cutter-move="0"]')?.closest('g');
        return { excluded: firstOverlay?.classList.contains('excluded'),
          overlayRectangleId: firstOverlay?.dataset.rectangleId,
          included: document.querySelector('[data-rectangle-index="0"][data-rectangle-field="included"]')?.checked,
          remapDisabled: remap?.disabled, remapValue: remap?.value };
      })()`, returnByValue: true,
    }, sessionId);
    assert(excluded.result?.value?.excluded === true && excluded.result.value.overlayRectangleId
      && excluded.result.value.included === false
      && excluded.result.value.remapDisabled === true && excluded.result.value.remapValue === '',
    'Include/exclude did not update both the overlay and explicit recut control.');
    const remapped = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('[data-rectangle-index="0"][data-rectangle-field="included"]')?.click();
        const select = document.querySelector('[data-rectangle-index="0"][data-rectangle-field="replacesSliceId"]');
        const selected = select?.options[1]?.value; select.value = selected;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const current = document.querySelector('[data-rectangle-index="0"][data-rectangle-field="replacesSliceId"]');
        return { selected, value: current?.value,
          mapping: document.querySelector('[data-rectangle-row="0"] small')?.textContent,
          others: [...document.querySelectorAll('[data-rectangle-field="replacesSliceId"]')].slice(1).map((entry) => entry.value) };
      })()`, returnByValue: true,
    }, sessionId);
    assert(remapped.result?.value?.selected && remapped.result.value.value === remapped.result.value.selected
      && remapped.result.value.mapping === `Replaces ${remapped.result.value.selected} v1`
      && remapped.result.value.others.every((value) => value === ''),
    'Explicit recut mapping did not retain its exact v1 slice identity or altered unrelated rectangles.');
    const keyboardFocus = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('[data-cutter-move="0"]');
        target?.focus();
        return { focused: document.activeElement === target, x: target?.getAttribute('x') };
      })()`,
      returnByValue: true,
    }, sessionId);
    assert(keyboardFocus.result?.value?.focused === true, 'The first cutter rectangle cannot receive keyboard focus.');
    await devtools.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39,
    }, sessionId);
    await devtools.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39,
    }, sessionId);
    await devtools.send('Runtime.evaluate', {
      expression: `new Promise((resolve) => requestAnimationFrame(resolve))`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const keyboardResult = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('[data-cutter-move="0"]');
        return { focused: document.activeElement === target, x: target?.getAttribute('x'),
          inspectorX: document.querySelector('[data-rectangle-index="0"][data-rectangle-field="x"]')?.value };
      })()`,
      returnByValue: true,
    }, sessionId);
    assert(keyboardResult.result?.value?.focused === true
      && Number(keyboardResult.result.value.x) === Number(keyboardFocus.result.value.x) + 1,
    'Arrow-key rectangle movement did not update one source pixel while retaining overlay focus.');
    assert(keyboardResult.result.value.inspectorX === keyboardResult.result.value.x,
      'Arrow-key rectangle movement left the numeric inspector behind the authoritative SVG geometry.');
    const resizeFocus = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('[data-cutter-resize="0"]');
        target?.focus();
        return { focused: document.activeElement === target,
          height: target?.closest('g')?.querySelector('[data-cutter-move]')?.getAttribute('height') };
      })()`, returnByValue: true,
    }, sessionId);
    await devtools.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40,
    }, sessionId);
    await devtools.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40,
    }, sessionId);
    await devtools.send('Runtime.evaluate', {
      expression: `new Promise((resolve) => requestAnimationFrame(resolve))`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    const resizeResult = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('[data-cutter-resize="0"]');
        return { focused: document.activeElement === target,
          height: target?.closest('g')?.querySelector('[data-cutter-move]')?.getAttribute('height'),
          inspectorHeight: document.querySelector('[data-rectangle-index="0"][data-rectangle-field="height"]')?.value };
      })()`, returnByValue: true,
    }, sessionId);
    assert(resizeFocus.result?.value?.focused === true && resizeResult.result?.value?.focused === true
      && Number(resizeResult.result.value.height) === Number(resizeFocus.result.value.height) + 1,
    'Arrow-key rectangle resize did not update one source pixel while retaining handle focus.');
    assert(resizeResult.result.value.inspectorHeight === resizeResult.result.value.height,
      'Arrow-key rectangle resize left the numeric inspector behind the authoritative SVG geometry.');
    const dragSetup = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const zoom = document.querySelector('[data-cutter-zoom]');
        zoom.value = '2'; zoom.dispatchEvent(new Event('change', { bubbles: true }));
        const scroller = document.querySelector('.cutter-scroll');
        scroller.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
        scroller.scrollLeft = Math.min(43, scroller.scrollWidth - scroller.clientWidth);
        scroller.scrollTop = Math.min(57, scroller.scrollHeight - scroller.clientHeight);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const target = document.querySelector('[data-cutter-move="0"]');
        window.__cutterDragProbeTarget = target;
        const targetRect = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const visible = {
          left: Math.max(targetRect.left, scrollerRect.left),
          right: Math.min(targetRect.right, scrollerRect.right),
          top: Math.max(targetRect.top, scrollerRect.top),
          bottom: Math.min(targetRect.bottom, scrollerRect.bottom),
        };
        const point = { x: (visible.left + visible.right) / 2, y: (visible.top + visible.bottom) / 2 };
        const hit = document.elementFromPoint(point.x, point.y);
        const traceReset = window.__numberdroidStudioVisualTest?.resetCutterPointerTrace() === 0;
        return {
          point,
          traceReset,
          hitTarget: hit === target,
          hitTag: hit?.tagName ?? null,
          hitMoveIndex: hit?.dataset?.cutterMove ?? null,
          context: scroller.dataset.cutterScrollContext,
          left: scroller.scrollLeft,
          top: scroller.scrollTop,
          windowLeft: window.scrollX,
          windowTop: window.scrollY,
          x: target.getAttribute('x'),
          y: target.getAttribute('y'),
          visibleWidth: visible.right - visible.left,
          visibleHeight: visible.bottom - visible.top,
        };
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert(dragSetup.result?.value?.left > 0 && dragSetup.result.value.top > 0
      && dragSetup.result.value.visibleWidth > 30 && dragSetup.result.value.visibleHeight > 30
      && dragSetup.result.value.hitTarget === true
      && dragSetup.result.value.traceReset === true,
    `The drag-continuity probe could not establish an exact visible hit target with nonzero nested scroll: ${JSON.stringify(dragSetup.result?.value)}`);
    const dragPoint = dragSetup.result.value.point;
    let mousePressed = false;
    let dragPressed;
    let dragMoved;
    let duringDrag;
    let afterDrag;
    let dragCleanup;
    try {
      mousePressed = true;
      await devtools.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: dragPoint.x, y: dragPoint.y, button: 'left', buttons: 1, clickCount: 1,
      }, sessionId);
      dragPressed = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          let observation;
          for (let frame = 0; frame < 30; frame += 1) {
            const target = window.__cutterDragProbeTarget;
            const interaction = window.__numberdroidStudioVisualTest?.cutterInteractionState();
            observation = {
              observed: interaction?.dragActive === true
                && interaction.targetConnected === true
                && interaction.hasPointerCapture === true,
              frame,
              interaction,
              targetConnected: target?.isConnected,
              sameTarget: document.querySelector('[data-cutter-move="0"]') === target,
              x: target?.getAttribute('x'),
              y: target?.getAttribute('y'),
            };
            if (observation.observed) return observation;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return observation;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      assert(dragPressed.result?.value?.observed === true
        && dragPressed.result.value.interaction?.dragActive === true
        && dragPressed.result.value.interaction.targetConnected === true
        && dragPressed.result.value.interaction.hasPointerCapture === true
        && dragPressed.result.value.targetConnected === true
        && dragPressed.result.value.sameTarget === true,
      `The CDP drag probe did not establish an active captured cutter drag: ${JSON.stringify({ setup: dragSetup.result?.value, pressed: dragPressed.result?.value })}`);
      await devtools.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: dragPoint.x + 18, y: dragPoint.y + 14, button: 'none', buttons: 1,
      }, sessionId);
      dragMoved = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          let observation;
          for (let frame = 0; frame < 30; frame += 1) {
            const target = window.__cutterDragProbeTarget;
            const scroller = document.querySelector('.cutter-scroll');
            const interaction = window.__numberdroidStudioVisualTest?.cutterInteractionState();
            const pointerTrace = interaction?.pointerTrace ?? [];
            const pointerDown = pointerTrace.findLast((entry) => entry.type === 'pointerdown');
            const pointerMove = pointerTrace.findLast((entry) => entry.type === 'pointermove');
            const settlementEvents = pointerDown
              ? pointerTrace.filter((entry) => entry.sequence > pointerDown.sequence
                && ['pointerup', 'pointercancel', 'lostpointercapture'].includes(entry.type))
              : [];
            const streamContinues = pointerDown && pointerMove
              && pointerMove.sequence > pointerDown.sequence
              && pointerMove.pointerId === pointerDown.pointerId
              && pointerMove.pointerId === interaction?.pointerId
              && (pointerDown.buttons & 1) === 1
              && pointerDown.exactProbeTarget === true
              && pointerDown.targetMoveIndex === '0'
              && (pointerMove.buttons & 1) === 1
              && pointerMove.exactProbeTarget === true
              && pointerMove.targetMoveIndex === '0'
              && pointerMove.targetConnected === true
              && settlementEvents.length === 0;
            const x = target?.getAttribute('x');
            const y = target?.getAttribute('y');
            observation = {
              observed: interaction?.dragActive === true
                && interaction.changed === true
                && interaction.dirty === true
                && interaction.targetConnected === true
                && streamContinues
                && (x !== ${JSON.stringify(dragSetup.result.value.x)} || y !== ${JSON.stringify(dragSetup.result.value.y)}),
              frame,
              interaction,
              targetConnected: target?.isConnected,
              sameTarget: document.querySelector('[data-cutter-move="0"]') === target,
              pointerStream: { pointerDown, pointerMove, settlementEvents, streamContinues },
              x,
              y,
              left: scroller?.scrollLeft,
              top: scroller?.scrollTop,
              windowLeft: window.scrollX,
              windowTop: window.scrollY,
            };
            if (observation.observed) return observation;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return observation;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      assert(dragMoved.result?.value?.observed === true
        && dragMoved.result.value.interaction?.dragActive === true
        && dragMoved.result.value.interaction.changed === true
        && dragMoved.result.value.interaction.dirty === true
        && dragMoved.result.value.interaction.targetConnected === true
        && dragMoved.result.value.pointerStream.streamContinues === true
        && dragMoved.result.value.targetConnected === true
        && dragMoved.result.value.sameTarget === true
        && (dragMoved.result.value.x !== dragSetup.result.value.x
          || dragMoved.result.value.y !== dragSetup.result.value.y)
        && dragMoved.result.value.left === dragSetup.result.value.left
        && dragMoved.result.value.top === dragSetup.result.value.top
        && dragMoved.result.value.windowLeft === dragSetup.result.value.windowLeft
        && dragMoved.result.value.windowTop === dragSetup.result.value.windowTop,
      `The captured cutter drag did not move and retain the same active pointer stream, changed/dirty state, DOM, and scroll before the external-render probe: ${JSON.stringify({ setup: dragSetup.result?.value, pressed: dragPressed.result?.value, moved: dragMoved.result?.value })}`);
      duringDrag = await devtools.send('Runtime.evaluate', {
      expression: `(() => {
        const hook = window.__numberdroidStudioVisualTest;
        const forced = hook?.forceChangedCutterProjectionRender();
        const target = window.__cutterDragProbeTarget;
        const scroller = document.querySelector('.cutter-scroll');
        return {
          forced,
          interaction: hook?.cutterInteractionState(),
          targetConnected: target?.isConnected,
          sameTarget: document.querySelector('[data-cutter-move="0"]') === target,
          x: target?.getAttribute('x'),
          y: target?.getAttribute('y'),
          left: scroller?.scrollLeft,
          top: scroller?.scrollTop,
          windowLeft: window.scrollX,
          windowTop: window.scrollY,
        };
      })()`, returnByValue: true,
      }, sessionId);
      assert(duringDrag.result?.value?.forced?.dragActive === true
        && duringDrag.result.value.forced.deferred === true
        && duringDrag.result.value.interaction?.changed === true
        && duringDrag.result.value.interaction.dirty === true
        && duringDrag.result.value.interaction.targetConnected === true
        && dragMoved.result.value.pointerStream.streamContinues === true
        && duringDrag.result.value.targetConnected === true
        && duringDrag.result.value.sameTarget === true
        && (duringDrag.result.value.x !== dragSetup.result.value.x
          || duringDrag.result.value.y !== dragSetup.result.value.y)
        && duringDrag.result.value.left === dragSetup.result.value.left
        && duringDrag.result.value.top === dragSetup.result.value.top
        && duringDrag.result.value.windowLeft === dragSetup.result.value.windowLeft
        && duringDrag.result.value.windowTop === dragSetup.result.value.windowTop,
      `A changed external cutter projection was not deferred safely during the captured drag: ${JSON.stringify({ setup: dragSetup.result?.value, pressed: dragPressed.result?.value, moved: dragMoved.result?.value, during: duringDrag.result?.value })}`);
      await devtools.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: dragPoint.x + 18, y: dragPoint.y + 14,
        button: 'left', buttons: 0, clickCount: 1,
      }, sessionId);
      mousePressed = false;
      afterDrag = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          let observation;
          for (let frame = 0; frame < 30; frame += 1) {
            const hook = window.__numberdroidStudioVisualTest;
            const target = document.querySelector('[data-cutter-move="0"]');
            const scroller = document.querySelector('.cutter-scroll');
            const interaction = hook?.cutterInteractionState();
            const pointerTrace = interaction?.pointerTrace ?? [];
            const pointerDown = pointerTrace.findLast((entry) => entry.type === 'pointerdown');
            const pointerUp = pointerTrace.findLast((entry) => entry.type === 'pointerup');
            const releaseObserved = pointerDown && pointerUp
              && pointerUp.sequence > pointerDown.sequence
              && pointerUp.pointerId === pointerDown.pointerId
              && pointerUp.buttons === 0;
            const oldTargetConnected = window.__cutterDragProbeTarget?.isConnected;
            const targetReplaced = target !== window.__cutterDragProbeTarget;
            const x = target?.getAttribute('x');
            const y = target?.getAttribute('y');
            const inspectorX = document.querySelector('[data-rectangle-index="0"][data-rectangle-field="x"]')?.value;
            const inspectorY = document.querySelector('[data-rectangle-index="0"][data-rectangle-field="y"]')?.value;
            observation = {
              observed: interaction?.dragActive === false
                && interaction.deferred === false
                && interaction.marker === ${JSON.stringify(duringDrag.result.value.forced.marker)}
                && oldTargetConnected === false
                && targetReplaced === true
                && inspectorX === x
                && inspectorY === y
                && releaseObserved,
              frame,
              interaction,
              oldTargetConnected,
              targetReplaced,
              x,
              y,
              inspectorX,
              inspectorY,
              pointerStream: { pointerDown, pointerUp, releaseObserved },
              left: scroller?.scrollLeft,
              top: scroller?.scrollTop,
              context: scroller?.dataset.cutterScrollContext,
              windowLeft: window.scrollX,
              windowTop: window.scrollY,
            };
            if (observation.observed) return observation;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return observation;
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      assert(afterDrag.result?.value?.observed === true
        && afterDrag.result.value.interaction?.dragActive === false
        && afterDrag.result.value.interaction.deferred === false
        && afterDrag.result.value.interaction.dirty === true
        && afterDrag.result.value.interaction.marker === duringDrag.result.value.forced.marker
        && afterDrag.result.value.oldTargetConnected === false
        && afterDrag.result.value.targetReplaced === true
        && afterDrag.result.value.inspectorX === afterDrag.result.value.x
        && afterDrag.result.value.inspectorY === afterDrag.result.value.y
        && afterDrag.result.value.left === dragSetup.result.value.left
        && afterDrag.result.value.top === dragSetup.result.value.top
        && afterDrag.result.value.context === dragSetup.result.value.context
        && afterDrag.result.value.windowLeft === dragSetup.result.value.windowLeft
        && afterDrag.result.value.windowTop === dragSetup.result.value.windowTop,
      `The deferred external render did not settle the drag into synchronized inspector/SVG state and exact scroll context: ${JSON.stringify({ setup: dragSetup.result?.value, pressed: dragPressed.result?.value, moved: dragMoved.result?.value, during: duringDrag.result?.value, after: afterDrag.result?.value })}`);
    } finally {
      if (mousePressed) {
        await devtools.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased', x: dragPoint.x + 18, y: dragPoint.y + 14,
          button: 'left', buttons: 0, clickCount: 1,
        }, sessionId).catch(() => {});
      }
      dragCleanup = await devtools.send('Runtime.evaluate', {
        expression: `(async () => {
          let observation;
          for (let frame = 0; frame < 30; frame += 1) {
            const interaction = window.__numberdroidStudioVisualTest?.cutterInteractionState();
            const pointerTrace = interaction?.pointerTrace ?? [];
            const pointerDown = pointerTrace.findLast((entry) => entry.type === 'pointerdown');
            const pointerUp = pointerTrace.findLast((entry) => entry.type === 'pointerup');
            const releaseMatches = pointerDown && pointerUp
              && pointerUp.sequence > pointerDown.sequence
              && pointerUp.pointerId === pointerDown.pointerId
              && pointerUp.buttons === 0;
            observation = { frame, interaction, pointerDown, pointerUp, releaseMatches };
            if (releaseMatches) break;
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const traceCleared = window.__numberdroidStudioVisualTest?.clearCutterPointerTrace() === 0;
          window.__cutterDragProbeTarget = null;
          return {
            ...observation,
            traceCleared,
            targetCleared: window.__cutterDragProbeTarget === null,
          };
        })()`, awaitPromise: true, returnByValue: true,
      }, sessionId).catch((error) => ({ result: { value: { cleanupError: error.message } } }));
    }
    assert(dragCleanup.result?.value?.releaseMatches === true
      && dragCleanup.result.value.traceCleared === true
      && dragCleanup.result.value.targetCleared === true,
    `The drag probe did not release the same pointer and clear its fixture target: ${JSON.stringify(dragCleanup.result?.value)}`);
    const closeReopenReset = await devtools.send('Runtime.evaluate', {
      expression: `(async () => {
        const zoom = document.querySelector('[data-cutter-zoom]');
        zoom.value = '2'; zoom.dispatchEvent(new Event('change', { bubbles: true }));
        const beforeScroller = document.querySelector('.cutter-scroll');
        beforeScroller.scrollLeft = Math.min(287, beforeScroller.scrollWidth - beforeScroller.clientWidth);
        beforeScroller.scrollTop = Math.min(359, beforeScroller.scrollHeight - beforeScroller.clientHeight);
        const before = {
          context: beforeScroller.dataset.cutterScrollContext,
          left: beforeScroller.scrollLeft,
          top: beforeScroller.scrollTop,
          windowLeft: window.scrollX,
          windowTop: window.scrollY,
        };
        document.querySelector('[data-close-cutter]')?.click();
        document.querySelector('[data-open-cutter="source.family-hygiene-approved"]')?.click();
        const deadline = Date.now() + 5000;
        while ((!document.querySelector('.cutter-scroll')
            || !document.querySelector('.cutter-job-status')?.textContent.includes('APPLIED'))
            && Date.now() < deadline) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 20));
        }
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        const afterScroller = document.querySelector('.cutter-scroll');
        return {
          before,
          after: {
            context: afterScroller?.dataset.cutterScrollContext,
            left: afterScroller?.scrollLeft,
            top: afterScroller?.scrollTop,
            zoom: document.querySelector('[data-cutter-zoom]')?.value,
            windowLeft: window.scrollX,
            windowTop: window.scrollY,
            terminal: document.querySelector('.cutter-job-status')?.textContent.includes('APPLIED'),
          },
        };
      })()`, awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert(closeReopenReset.result?.value?.before.left > 0
      && closeReopenReset.result.value.before.top > 0
      && closeReopenReset.result.value.after.context
      && closeReopenReset.result.value.after.context !== closeReopenReset.result.value.before.context
      && closeReopenReset.result.value.after.left === 0
      && closeReopenReset.result.value.after.top === 0
      && closeReopenReset.result.value.after.zoom === 'fit'
      && closeReopenReset.result.value.after.windowLeft === closeReopenReset.result.value.before.windowLeft
      && closeReopenReset.result.value.after.windowTop === closeReopenReset.result.value.before.windowTop
      && closeReopenReset.result.value.after.terminal === true,
    'Closing and reopening the cutter did not create a fresh instance with reset local scroll and unchanged window position.');
    const postInteractionErrors = await devtools.send('Runtime.evaluate', {
      expression: `Number(document.documentElement.dataset.visualErrorCount ?? 0)`, returnByValue: true,
    }, sessionId);
    assert(postInteractionErrors.result?.value === 0,
      'Checkpoint 2B local control interactions recorded an uncaught browser error.');
    assertNoProtocolErrors('After Checkpoint 2B interactions');
    checkpoint2bInteractionEvidence = {
      zoomCssWidths: [zoom100.result.value.width, zoom200.result.value.width, restoredFit.result.value.width],
      scrollPreservation: scrollRefresh.result.value,
      committedGridDraft: committedGridDraft.result.value,
      includeExclude: excluded.result.value,
      explicitReplacement: remapped.result.value,
      keyboardMove: { before: Number(keyboardFocus.result.value.x), after: Number(keyboardResult.result.value.x) },
      keyboardResize: { before: Number(resizeFocus.result.value.height), after: Number(resizeResult.result.value.height) },
      dragContinuity: {
        before: dragSetup.result.value,
        pressed: dragPressed.result.value,
        moved: dragMoved.result.value,
        during: duringDrag.result.value,
        after: afterDrag.result.value,
        cleanup: dragCleanup.result.value,
      },
      closeReopenReset: closeReopenReset.result.value,
      postInteractionRuntimeNetworkErrors: 0,
    };
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  if (domPath) {
    await mkdir(dirname(domPath), { recursive: true });
    await writeFile(domPath, `${dom.result.value}\n`);
  }
  const observation = {
    schemaVersion: 1,
    mode,
    url: pageUrl,
    browser: browserVersion.product,
    protocolVersion: browserVersion.protocolVersion,
    screenshotAfterReadinessInSameSession: true,
    runtimeNetworkErrors: 0,
    expectedSyntheticRuntimeNetworkErrors: expectedSyntheticProtocolErrors().length,
    expectedSyntheticRuntimeNetworkErrorSummaries: expectedSyntheticProtocolErrors().map(protocolErrorSummary),
    sourceFileRefreshRetention,
    sourceFileResumeTransition,
    sourceImportOperationIsolation,
    sourceIdPatternValidity,
    checkpoint2aSourceFocusBeforeLayout,
    checkpoint2aSourceFocusFinal,
    checkpoint2cPhase: mode === 'checkpoint-2c' ? checkpoint2cPhase : null,
    checkpoint2cInteractionEvidence,
    checkpoint3RoomContinuity,
    checkpoint4TaskFocus,
    taskFeedbackEvidence,
    taskFeedbackFormScreenshot,
    checkpoint45RoomFocus,
    checkpoint45PhysicalPaint,
    checkpoint45EditorContinuity,
    checkpoint45FindingsNavigation,
    checkpoint45DirectManipulation,
    checkpoint45StudioPreview,
    a17Evidence,
    layout,
    interactions: checkpoint2bInteractionEvidence,
  };
  await writeFile(observationPath, `${JSON.stringify(observation, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', output: outputPath, workspace: expectedWorkspace, width })}\n`);
  await devtools.send('Browser.close').catch(() => {});
} finally {
  devtools?.close();
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  await Promise.race([chromeExited, delay(2_000)]);
  await rm(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
