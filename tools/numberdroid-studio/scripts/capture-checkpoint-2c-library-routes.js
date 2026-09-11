import assert from 'node:assert/strict';
import { libraryNavigation, libraryReviewSelector } from './library-browser-navigation.js';

/** Preserve CP2C inventory/detail/history assertions across separate ND-1 routes. */
export async function captureCheckpoint2cLibraryRoutes({ devtools, sessionId, phase, focus }) {
  const evaluate = async expression => {
    const value = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(value.exceptionDetails, undefined, JSON.stringify(value.exceptionDetails)); return value.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 50)); }
    const context = await evaluate(`({workspace:document.querySelector('#workspace-content')?.dataset.renderedWorkspace,libraryRoute:document.querySelector('#workspace-content')?.dataset.libraryRoute,heading:document.querySelector('#workspace-content h2')?.textContent})`);
    throw new Error(`${label} did not settle: ${JSON.stringify(context)}`);
  };
  const click = async selector => {
    await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw new Error('Missing CP2C route '+${JSON.stringify(selector)});n.click();})()`);
    await evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  };
  const navigation = libraryNavigation({ evaluate, click, waitFor });
  const proposalId = 'proposal.family-hygiene-2c';
  if (phase === 'pending') {
    await navigation.review('image', proposalId);
    await waitFor("document.querySelectorAll('[data-review-item]').length===4 && document.querySelector('[data-review-canvas]')?.dataset.reviewPreviewState==='ready'", 'CP2C shared pending review');
    const before=await evaluate("fetch('/api/projects/numberdroid-studio-checkpoint-2c').then(r=>r.json())"), proposal=before.snapshot.assetLibrary.proposals.find(p=>p.proposalId===proposalId), items=[];
    for(const item of proposal.items) {
      await click(`[data-review-focus="item:${item.itemId}"]`);
      await waitFor(`document.querySelector('[data-review-canvas] image')?.getAttribute('href')?.endsWith(${JSON.stringify(item.sliceBinding.digest)})`, 'Exact CP2C proposed slice');
      await click(`[data-review-details="proposed"][data-review-item-id="${item.itemId}"]`);
      await waitFor("Boolean(document.querySelector('[data-library-detail]'))", 'CP2C proposed Asset details');
      const detail=await evaluate(`(async()=>{const root=document.querySelector('[data-library-detail]'),image=root.querySelector('img');await image.decode();return{text:root.textContent,canonicalIds:[...root.querySelectorAll('.canonical-copy code')].map(node=>node.textContent),href:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight,proposed:root.dataset.libraryProposed,mutationCount:root.querySelectorAll('[data-library-action="edit"], [data-asset-editor-action="save"]').length};})()`);
      assert(detail.text.includes(item.name)&&detail.text.includes(item.sliceId),'Exact proposed name and cut identity must remain inspectable');
      assert(detail.href.endsWith(item.sliceBinding.digest)&&detail.width===622&&detail.height===622,'Exact committed proposed pixels');
      assert.equal(detail.proposed,'true');assert.equal(detail.mutationCount,0);
      assert.deepEqual(detail.canonicalIds,[item.assetId,item.sliceId],'Copyable Asset and cut identities remain exact');
      assert(detail.text.includes(`Slice ${item.ordinal+1}`),'Human cut ordinal remains visible');
      for(const label of ['Placement','Connectivity','Collision','Navigation','Runtime metadata','Validation and lifecycle']) assert(detail.text.includes(label),`Missing proposed Asset facts: ${label}`);
      items.push({itemId:item.itemId,...detail});
      await click('[data-library-action="back"]');
      await waitFor("Boolean(document.querySelector('[data-review-workspace]'))", 'Return to exact CP2C Review');
    }
    assert.deepEqual(await evaluate("fetch('/api/projects/numberdroid-studio-checkpoint-2c').then(r=>r.json())"),before,'Pending inspection must preserve every legacy row and project revision');
    return {cards:[],sharedReview:{proposalId,items,selectionCount:await evaluate("document.querySelectorAll('[data-review-select]:checked').length"),noWrite:true},inspectedRoutes:['pending','shared-review','four-proposed-details']};
  }
  await waitFor("[...document.querySelectorAll('.asset-v2-card img')].length===3&&[...document.querySelectorAll('.asset-v2-card img')].every(n=>n.complete&&n.naturalWidth>0)", 'Saved CP2C card images');
  const cards = await evaluate(`(()=>{
    const rect=n=>n?.getBoundingClientRect().toJSON()??null;
    const boxMetrics=n=>{const s=getComputedStyle(n),side=prefix=>Object.fromEntries(['top','right','bottom','left'].map(k=>[k,parseFloat(s.getPropertyValue(prefix+'-'+k+(prefix==='border'?'-width':'')))||0]));return{border:side('border'),padding:side('padding')};};
    return [...document.querySelectorAll('.asset-card')].map(card=>{const preview=card.querySelector('.asset-preview'),image=preview?.querySelector('img');return{
      assetId:card.dataset.assetId,card:rect(card),preview:rect(preview),previewBox:preview?boxMetrics(preview):null,image:rect(image),
      previewState:preview?.dataset.previewState??null,hasImage:Boolean(image),loadedImage:Boolean(image?.complete&&image.naturalWidth>0),
      naturalWidth:image?.naturalWidth??0,naturalHeight:image?.naturalHeight??0,objectFit:image?getComputedStyle(image).objectFit:null,
      text:card.textContent,v2:card.classList.contains('asset-v2-card')};});})()`);
  const metadata = { canonicalIds: [], ordinalLabels: [] };
  for (const card of cards) {
    await navigation.details('image', card.assetId);
    const detail = await evaluate(`({canonicalIds:[...document.querySelectorAll('.canonical-copy code')].map(n=>n.textContent),ordinalLabels:[...document.querySelectorAll('.asset-provenance strong, .proposal-identity strong')].map(n=>n.textContent).filter(value=>/Slice [1-4]/.test(value))})`);
    metadata.canonicalIds.push(...detail.canonicalIds); metadata.ordinalLabels.push(...detail.ordinalLabels);
    await navigation.assets();
  }
  await click('[data-workspace="activity"]');
  const history = libraryReviewSelector('image', proposalId);
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(history)}))`, 'CP2C completed review Activity link');
  await click('[data-legacy-review-history] > summary');
  await click(history);
  await waitFor("document.querySelectorAll('[data-proposal-item]').length===4", 'CP2C completed review history');
  const review = await evaluate(`(()=>{const root=document.querySelector('[data-asset-proposal]');return{
    proposalId:root?.dataset.assetProposal??null,proposalState:root?.dataset.proposalState??null,
    proposalItems:[...document.querySelectorAll('[data-proposal-item]')].map(item=>({itemId:item.dataset.proposalItem,rejectionReason:item.dataset.proposalRejectionReason??null,text:item.textContent,
      previewState:item.querySelector('.asset-preview')?.dataset.previewState??null,loadedImage:Boolean(item.querySelector('.asset-preview img')?.complete&&item.querySelector('.asset-preview img')?.naturalWidth>0),
      diffRowCount:item.querySelectorAll('.proposal-diff tbody tr').length,canonicalIds:[...item.querySelectorAll('.canonical-copy code')].map(n=>n.textContent)})),
    decisionControlCount:root?.querySelectorAll('[data-proposal-disposition]').length??0,applyControlCount:root?.querySelectorAll('[data-proposal-apply]').length??0,
    canonicalIds:[...document.querySelectorAll('.canonical-copy code')].map(n=>n.textContent),ordinalLabels:[...document.querySelectorAll('.asset-provenance strong, .proposal-identity strong')].map(n=>n.textContent).filter(value=>/Slice [1-4]/.test(value))};})()`);
  review.canonicalIds.push(...metadata.canonicalIds); review.ordinalLabels.push(...metadata.ordinalLabels);
  if (focus !== 'proposal') {
    // This review was opened from Activity. Its Back action must restore that
    // origin before main navigation reopens the retained Library list.
    await click('[data-library-action="back"]');
    await waitFor("document.querySelector('#workspace-content')?.dataset.renderedWorkspace==='activity'", 'Completed review returns to Activity');
    await click('[data-workspace="assets"]');
    await navigation.assets();
  }
  return { cards, assetLibrary: review, inspectedRoutes: ['assets', 'image-details', 'activity', 'completed-review'] };
}
