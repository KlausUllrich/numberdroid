import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [chromePath, widthArgument, outputArgument, pageUrl, mode = 'candidate', domArgument] = process.argv.slice(2);
if (!chromePath || !widthArgument || !outputArgument || !pageUrl || !['baseline', 'candidate', 'checkpoint-2a', 'checkpoint-2b', 'checkpoint-2c'].includes(mode)) {
  throw new Error('Usage: capture-studio-browser-evidence.js CHROME WIDTH OUTPUT URL baseline|candidate|checkpoint-2a|checkpoint-2b|checkpoint-2c [DOM_OUTPUT]');
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

  send(method, params = {}, sessionId = undefined) {
    const id = this.#nextId++;
    return new Promise((resolveCommand, rejectCommand) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        rejectCommand(new Error(`${method} did not complete within 10 seconds.`));
      }, 10_000);
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
    devtools.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
      screenWidth: width, screenHeight: height,
    }, sessionId),
  ]);
  await devtools.send('Page.navigate', { url: pageUrl }, sessionId);

  const readyExpression = mode === 'candidate'
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
      assert(cutter.helpText.includes('does not resize') && cutter.helpText.includes('does not')
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

  checkpoint2aSourceFocusFinal = await focusCheckpoint2aSourceTarget('before-screenshot');
  assertSyntheticProtocolErrorsBounded();
  assertNoProtocolErrors('Before screenshot capture');
  const screenshot = await devtools.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  }, sessionId);
  const dom = domPath
    ? await devtools.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
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
