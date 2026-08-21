import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [chromePath, widthArgument, outputArgument, pageUrl, mode = 'candidate', domArgument] = process.argv.slice(2);
if (!chromePath || !widthArgument || !outputArgument || !pageUrl || !['baseline', 'candidate', 'checkpoint-2a'].includes(mode)) {
  throw new Error('Usage: capture-studio-browser-evidence.js CHROME WIDTH OUTPUT URL baseline|candidate|checkpoint-2a [DOM_OUTPUT]');
}
const width = Number(widthArgument);
const height = 900;
if (!Number.isInteger(width) || width < 800) throw new Error('WIDTH must be an integer of at least 800.');
const outputPath = resolve(outputArgument);
const domPath = domArgument ? resolve(domArgument) : null;
const observationPath = outputPath.replace(/\.png$/i, '.observation.json');
const expectedWorkspace = new URL(pageUrl).hash.slice(1) || 'overview';
const agentAccessEvidence = new URL(pageUrl).searchParams.get('visualFixture') === 'agent-access';
const checkpoint2aFocus = new URL(pageUrl).searchParams.get('visualFocus');
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
  if (mode === 'checkpoint-2a' && checkpoint2aFocus === 'approved-source') {
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-source-id="source.family-hygiene-approved"] .source-preview.ready')?.scrollIntoView({ block: 'center' })`,
      returnByValue: true,
    }, sessionId);
  }
  if (mode === 'checkpoint-2a' && checkpoint2aFocus === 'staged-intake') {
    await devtools.send('Runtime.evaluate', {
      expression: `document.querySelector('.staged-source-intakes')?.scrollIntoView({ block: 'center' })`,
      returnByValue: true,
    }, sessionId);
  }
  if (mode === 'checkpoint-2a' && expectedWorkspace === 'sources') {
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
  }
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
          objectFit: image ? getComputedStyle(image).objectFit : null,
        };
      });
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
          actionCount: source.querySelectorAll('.source-review-actions button').length,
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
  const protocolErrors = devtools.events.filter((event) => (
    event.method === 'Runtime.exceptionThrown'
      || event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error' && !ignoredFavicon(event)
      || event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'
      || event.method === 'Network.loadingFailed' && event.params?.canceled !== true
      || event.method === 'Network.responseReceived'
        && event.params?.response?.status >= 400
        && new URL(event.params.response.url).origin === new URL(pageUrl).origin && !ignoredFavicon(event)
  ));
  assert(protocolErrors.length === 0, `Chrome recorded ${protocolErrors.length} runtime/network error(s).`);

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
      assert(approved.actionCount === 0, 'An approved source still exposes a review mutation control.');
      assert(layout.stagedIntakes.length === 1 && layout.stagedIntakes[0].hasResume
        && layout.stagedIntakes[0].hasDiscard, 'The durable staged intake lacks Resume or Discard recovery.');
      assert(layout.sourceForm.present && layout.sourceForm.labelledFields === 8
        && layout.sourceForm.hasLiveStatus && layout.sourceForm.submitDisabled === false,
      'The source intake form is missing its labelled fields, live status, or enabled submit control.');
      if (checkpoint2aFocus === null) {
        assert(layout.sourceForm.rect?.bottom > 0 && layout.sourceForm.rect?.y < height,
          'The source intake form is not visible in the intake screenshot.');
      }
      if (checkpoint2aFocus === 'staged-intake') {
        assert(layout.stagedIntakes[0].rect?.bottom > 0 && layout.stagedIntakes[0].rect?.y < height,
          'The Resume/Discard recovery row is not visible in the recovery screenshot.');
      }
      if (checkpoint2aFocus === 'approved-source') {
        assert(approved.preview?.y >= 0 && approved.preview?.bottom <= height,
          'The full approved-source preview rect is not contained in the 900px viewport.');
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

  const screenshot = await devtools.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false,
  }, sessionId);
  const dom = domPath
    ? await devtools.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true,
    }, sessionId)
    : null;
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
    layout,
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
