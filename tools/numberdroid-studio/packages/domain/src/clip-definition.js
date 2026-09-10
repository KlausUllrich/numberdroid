import { invariant } from './errors.js';
import { requireEnum, requireId, requireInteger, requireRecord, requireString } from './validation.js';
import { ASSET_KINDS, validateExactSliceBinding } from './asset-definition.js';
import { createHash } from 'node:crypto';
function canonical(value) { if(Array.isArray(value))return value.map(canonical);if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const clipFingerprint=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const CLIP_METADATA_SCHEMA={type:'object',additionalProperties:false,required:['role','tags'],properties:{role:{oneOf:[{type:'null'},{type:'string',minLength:1,maxLength:64}]},tags:{type:'array',maxItems:32,uniqueItems:true,items:{type:'string',minLength:1,maxLength:64}}}};
export function normalizeClipMetadata(value){requireRecord(value,'metadata');invariant(Object.keys(value).length===2&&Object.hasOwn(value,'role')&&Object.hasOwn(value,'tags'),'CLIP_INVALID','Provide role and tags only.');const role=value.role===null?null:requireString(value.role,'metadata.role',{max:64});invariant(Array.isArray(value.tags)&&value.tags.length<=32,'CLIP_INVALID','Use at most 32 tags.');const tags=Array.from(value.tags,tag=>requireString(tag,'metadata.tags',{max:64}));invariant(new Set(tags).size===tags.length,'CLIP_INVALID','Remove duplicate tags.');return {role,tags};}
export { CLIP_DECLARATION_SCHEMA, CLIP_SLICE_SCHEMA, normalizeClipDeclaration, clipSliceKey } from './clip-normalization.js';
import { CLIP_MAX_BYTES, CLIP_VALIDATOR_VERSION, normalizeClipDeclaration, clipSliceKey } from './clip-normalization.js';
export function validateClipDefinition({assetId,name,kind,metadata,clip,slices,projectId}) {
  const declaration=normalizeClipDeclaration(clip), normalizedMetadata=normalizeClipMetadata(metadata);
  const content={assetId:requireId(assetId,'assetId'),name:requireString(name,'name',{max:160}),kind:requireEnum(kind,'kind',ASSET_KINDS),metadata:normalizedMetadata,clip:declaration};
  invariant(new TextEncoder().encode(JSON.stringify(content)).length<=CLIP_MAX_BYTES,'CLIP_TOO_LARGE','Clip content is limited to 256 KiB.');
  const map=slices instanceof Map?slices:new Map((slices??[]).map(binding=>[clipSliceKey(binding),binding]));
  let left=0,top=0,right=declaration.canvas.width,bottom=declaration.canvas.height,totalPixels=0;
  const seen=new Set();
  for(const frame of declaration.frames){const key=clipSliceKey(frame.slice),binding=map.get(key);invariant(binding,'CLIP_SLICE_NOT_FOUND','An exact saved cut version is unavailable.',{frameId:frame.frameId,...frame.slice});validateExactSliceBinding(binding);invariant(binding.projectId===projectId && binding.sliceId===frame.slice.sliceId && binding.sliceVersion===frame.slice.sliceVersion,'CLIP_SLICE_INVALID','Frame cut identity belongs to another project or version.');left=Math.min(left,frame.offset.x);top=Math.min(top,frame.offset.y);right=Math.max(right,frame.offset.x+binding.width);bottom=Math.max(bottom,frame.offset.y+binding.height);if(!seen.has(key)){totalPixels+=binding.width*binding.height;seen.add(key);}}
  invariant(totalPixels<=268435456,'CLIP_TOO_LARGE','Unique clip frames exceed the 256 megapixel preview budget.');
  invariant([left,top,right,bottom,right-left,bottom-top].every(v=>Number.isFinite(v)&&Math.abs(v)<=1000000),'CLIP_TOO_LARGE','Resolved clip geometry exceeds its preview bound.');
  return {...content,metadataFingerprint:clipFingerprint({kind:content.kind,metadata:normalizedMetadata,clip:declaration}),contentFingerprint:clipFingerprint(content),findings:[],framePins:declaration.frames.map(frame=>({frameId:frame.frameId,...frame.slice})),frameBounds:{x:left,y:top,width:right-left,height:bottom-top}};
}
