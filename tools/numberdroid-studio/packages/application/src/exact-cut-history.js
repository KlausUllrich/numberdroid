import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger } from '../../domain/src/validation.js';
import { validateExactSliceBinding } from '../../domain/src/asset-definition.js';
export function resolveHistoricalSliceBinding(document,projectId,sliceId,sliceVersion,cutoff=Number.MAX_SAFE_INTEGER) {
  requireId(sliceId,'sliceId');requireInteger(sliceVersion,'sliceVersion',{min:1});
  invariant(document.projectId===projectId,'CLIP_SLICE_INVALID','The source project does not match.');
  for(const revision of document.revisions){if(revision.number>cutoff)continue;const matches=(revision.snapshot.atlases??[]).flatMap(atlas=>atlas.sliceHeads??[]).filter(slice=>slice.sliceId===sliceId && slice.version===sliceVersion);invariant(matches.length<=1,'CLIP_SLICE_AMBIGUOUS','Cut identity occurs under multiple atlases.');if(!matches.length)continue;const slice=matches[0];const {rectangleId:_rectangleId,...rectangle}=slice.rectangle;return validateExactSliceBinding({projectId,sliceId,sliceVersion,atlasId:slice.atlasId,sourceId:slice.sourceId,sourceDigest:slice.sourceDigest,definitionVersion:slice.definitionVersion,definitionFingerprint:slice.definitionFingerprint,rectangleId:slice.rectangleId,rectangle,processorId:slice.processorId,digest:slice.digest,artifactUri:slice.artifactUri,mediaType:slice.mediaType,byteSize:slice.byteSize,width:slice.width,height:slice.height,priorDigest:slice.priorDigest,committedRevision:revision.number});}
  invariant(false,'CLIP_SLICE_NOT_FOUND','The exact cut version is unavailable at this project revision.',{sliceId,sliceVersion,cutoff});
}
export function clipSliceHistory(document,clip,cutoff=Number.MAX_SAFE_INTEGER){return new Map(clip.frames.map(frame=>[`${frame.slice.sliceId}@${frame.slice.sliceVersion}`,resolveHistoricalSliceBinding(document,document.projectId,frame.slice.sliceId,frame.slice.sliceVersion,cutoff)]));}
export function querySavedSliceDocument(request,document) {
 const allowed=['schemaVersion','projectId','sliceId','sliceVersion'];
 invariant(request && Object.keys(request).every(key=>allowed.includes(key)) && request.schemaVersion===1,'VALIDATION_ERROR','Use the saved-cut schema 1 query.');
 invariant(request.projectId===document.projectId,'CLIP_SLICE_INVALID','The requested cut belongs to another project.');
 const head=document.revisions.at(-1),binding=resolveHistoricalSliceBinding(document,document.projectId,request.sliceId,request.sliceVersion,head.number);
 const currentAtlas=(head.snapshot.atlases??[]).find(atlas=>atlas.id===binding.atlasId),current=currentAtlas?.sliceHeads.find(slice=>slice.sliceId===binding.sliceId);
 const historic=document.revisions.find(revision=>revision.number===binding.committedRevision)?.snapshot.atlases?.find(atlas=>atlas.id===binding.atlasId);
 invariant(currentAtlas && current && historic,'CLIP_SLICE_CORRUPT','Saved cut editing context is unavailable.');
 return {schemaVersion:1,projectId:document.projectId,revision:head.number,binding,currentHead:{sliceId:current.sliceId,sliceVersion:current.version},atlas:{atlasId:currentAtlas.id,definitionVersion:currentAtlas.definitionVersion,definitionFingerprint:currentAtlas.definitionFingerprint},source:{sourceId:binding.sourceId,digest:binding.sourceDigest,width:historic.sourceWidth,height:historic.sourceHeight}};
}
