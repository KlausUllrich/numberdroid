import { invariant } from './errors.js';
import { requireEnum, requireId, requireInteger, requireRecord, requireString } from './validation.js';
export const CLIP_MAX_BYTES = 256 * 1024;
export const CLIP_VALIDATOR_VERSION = 'numberdroid-studio.clip-validator.v1';
const idSchema = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const number = (minimum, maximum) => ({ type:'number', minimum, maximum });
const object = properties => ({ type:'object', additionalProperties:false, required:Object.keys(properties), properties });
export const CLIP_SLICE_SCHEMA = object({ sliceId:idSchema, sliceVersion:{type:'integer',minimum:1} });
const pointSchema = object({x:number(-65535,65535),y:number(-65535,65535)});
export const CLIP_DECLARATION_SCHEMA = object({ schemaVersion:{const:1}, coordinateSpace:{const:'clip-pixels'}, fps:number(0.1,120), playbackMode:{enum:['once','loop','pingpong']}, unitsPerPixel:{type:'number',exclusiveMinimum:0,maximum:64}, canvas:object({width:{type:'integer',minimum:1,maximum:65535},height:{type:'integer',minimum:1,maximum:65535}}), anchor:pointSchema, frames:{type:'array',minItems:1,maxItems:256,items:object({frameId:idSchema,name:{type:'string',minLength:1,maxLength:160},slice:CLIP_SLICE_SCHEMA,durationMs:{oneOf:[{type:'null'},number(1,60000)]},offset:pointSchema})} });
export const clipSliceKey = pin => `${pin.sliceId}@${pin.sliceVersion}`;
function exact(value, fields, label) {
  requireRecord(value,label);
  invariant(Object.keys(value).length===fields.length && fields.every(key=>Object.hasOwn(value,key)), 'CLIP_INVALID', `${label}: provide exactly the supported fields.`, {field:label});
  return value;
}
function finite(value,label,min,max) { invariant(typeof value==='number' && Number.isFinite(value) && value>=min && value<=max,'CLIP_INVALID',`${label}: choose a finite value between ${min} and ${max}.`,{field:label});return Object.is(value,-0)?0:value; }
function point(value,label) { exact(value,['x','y'],label);return {x:finite(value.x,`${label}.x`,-65535,65535),y:finite(value.y,`${label}.y`,-65535,65535)}; }
export function normalizeClipDeclaration(value) {
  exact(value,['schemaVersion','coordinateSpace','fps','playbackMode','unitsPerPixel','canvas','anchor','frames'],'clip');
  invariant(value.schemaVersion===1 && value.coordinateSpace==='clip-pixels','CLIP_INVALID','Use clip schema 1 in clip pixels.');
  exact(value.canvas,['width','height'],'clip.canvas');
  const canvas={width:requireInteger(value.canvas.width,'clip.canvas.width',{min:1,max:65535}),height:requireInteger(value.canvas.height,'clip.canvas.height',{min:1,max:65535})};
  const unitsPerPixel=finite(value.unitsPerPixel,'clip.unitsPerPixel',Number.MIN_VALUE,64);
  invariant(canvas.width*unitsPerPixel<=64 && canvas.height*unitsPerPixel<=64,'CLIP_INVALID','Clip canvas must fit within 64 physical project units per axis.');
  invariant(Array.isArray(value.frames) && value.frames.length>=1 && value.frames.length<=256,'CLIP_INVALID','Use between 1 and 256 frame occurrences.');
  const frames=Array.from(value.frames,(frame,index)=>{const path=`clip.frames[${index}]`;exact(frame,['frameId','name','slice','durationMs','offset'],path);exact(frame.slice,['sliceId','sliceVersion'],`${path}.slice`);return {frameId:requireId(frame.frameId,`${path}.frameId`),name:requireString(frame.name,`${path}.name`,{max:160}),slice:{sliceId:requireId(frame.slice.sliceId,`${path}.slice.sliceId`),sliceVersion:requireInteger(frame.slice.sliceVersion,`${path}.slice.sliceVersion`,{min:1})},durationMs:frame.durationMs===null?null:finite(frame.durationMs,`${path}.durationMs`,1,60000),offset:point(frame.offset,`${path}.offset`)};});
  invariant(new Set(frames.map(frame=>frame.frameId)).size===frames.length,'CLIP_INVALID','Each frame occurrence needs a distinct frame ID.');
  const clip={schemaVersion:1,coordinateSpace:'clip-pixels',fps:finite(value.fps,'clip.fps',0.1,120),playbackMode:requireEnum(value.playbackMode,'clip.playbackMode',['once','loop','pingpong']),unitsPerPixel,canvas,anchor:point(value.anchor,'clip.anchor'),frames};
  invariant(new TextEncoder().encode(JSON.stringify(clip)).length<=CLIP_MAX_BYTES,'CLIP_TOO_LARGE','Clip declarations are limited to 256 KiB.');return clip;
}
