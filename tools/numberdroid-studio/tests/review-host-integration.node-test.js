import assert from 'node:assert/strict';
import test from 'node:test';
import {assemblyFixture,assemblyPayload,owner,projectId} from './assembly-test-helpers.js';
import {clipPayload} from './clip-test-helpers.js';
import {libraryReviewGroups,libraryInventory,filterLibraryItems,libraryRouteKey} from '../apps/studio-server/public/library-state.js';
import {presentActivity} from '../packages/application/src/activity-presentation.js';

test('Library adopts one exact legacy proposal without duplicate pending cards or changing its old row', {timeout:120000}, async t=>{
 const f=await assemblyFixture(t);await f.execute('clip.proposal.submit',{...clipPayload(f.slice),proposalId:'proposal.legacy-card',expectedProposalVersion:0});
 const source={contentKind:'animation',proposalId:'proposal.legacy-card',expectedProposalVersion:1};
 const before=await f.studio.readProjectTrusted(projectId),old=structuredClone(before.snapshot.clipLibrary.proposals[0]);
 const projection=await f.studio.queryLegacyReview({schemaVersion:1,projectId,legacySource:source},owner);
 assert.equal(libraryReviewGroups(before.snapshot).length,1);
 await f.execute('review.feedback.save',{reviewId:projection.groups[0].reviewId,expectedReviewVersion:0,legacySource:source,summary:'Make a calmer cycle.',itemComments:[],confirmed:true});
 const after=await f.studio.readProjectTrusted(projectId),groups=libraryReviewGroups(after.snapshot);
 assert.deepEqual(after.snapshot.clipLibrary.proposals[0],old);
 assert.equal(groups.length,1);assert.equal(groups[0].contentKind,'review');assert.equal(groups[0].status,'CHANGES_REQUESTED');
 assert.equal(filterLibraryItems(groups,{content:'animation'}).length,1);
});

test('an accepted dependency loses its pending asset badge while its related Assembly stays reviewable', {timeout:120000}, async t=>{
 const f=await assemblyFixture(t),id='review.card-subset';
 await f.execute('review.proposal.submit',{reviewId:id,expectedReviewVersion:0,title:'Related machine',items:[{itemId:'image',contentKind:'image',payload:f.payload(),dependsOn:[]},{itemId:'assembly',contentKind:'assembly',payload:assemblyPayload(),dependsOn:['image']}]});
 await f.execute('review.accept',{reviewId:id,expectedReviewVersion:1,selectedItemIds:['image'],confirmed:true});
 const snapshot=(await f.studio.readProjectTrusted(projectId)).snapshot,group=libraryReviewGroups(snapshot)[0];
 assert.equal(libraryInventory(snapshot)[0].relatedReviews.length,0);
 assert.equal(group.changeCount,1);assert.equal(group.acceptedCount,1);assert.deepEqual(group.assetIds,['assembly.fixture']);
 assert.equal(filterLibraryItems([group],{content:'assembly'}).length,1);
 assert.notEqual(libraryRouteKey({view:'review',contentKind:'review',proposalId:id,proposalVersion:2}),libraryRouteKey({view:'review',contentKind:'review',proposalId:id,proposalVersion:2,readOnly:true}));
});

test('Activity display preserves event-time names and distinguishes feedback amendment without mutating events', {timeout:120000}, async t=>{
 const f=await assemblyFixture(t);await f.execute('asset.save',f.payload({name:'First machine name'}));
 await f.execute('asset.save',f.payload({operation:'update',expectedAssetVersion:1,expectedMetadataVersion:1,name:'Later name',image:{mode:'retain'}}));
 const payload={...clipPayload(f.slice),assetId:'clip.activity'};
 await f.execute('review.proposal.submit',{reviewId:'review.activity',expectedReviewVersion:0,title:'Display timing',items:[{itemId:'clip',contentKind:'animation',payload,dependsOn:[]}]});
 for(const [version,summary] of [[1,'Slow the cycle.'],[2,'Use a shorter pause.']])await f.execute('review.feedback.save',{reviewId:'review.activity',expectedReviewVersion:version,summary,itemComments:[],confirmed:true});
 const doc=await f.store.loadProject(projectId),before=structuredClone(doc.revisions.map(r=>r.event)),events=presentActivity(doc);
 assert.match(events.find(e=>e.commandType==='asset.save').presentation.title,/First machine name/);
 const feedback=events.filter(e=>e.commandType==='review.feedback.save');assert.match(feedback[1].presentation.title,/Feedback updated/);
 assert.equal(feedback[0].presentation.feedback.summary,'Slow the cycle.');assert.equal(feedback[1].presentation.inspect.reviewVersion,3);
 assert.deepEqual(doc.revisions.map(r=>r.event),before);
 assert.equal((await f.studio.listActivityTrusted(projectId)).some(event=>event.presentation),false);
});
