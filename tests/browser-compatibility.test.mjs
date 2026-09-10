import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {randomId} from './lib/random-id';export {renderSceneIdentity} from './lib/render-scene-identity';export {initialScene} from './lib/scene-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {randomId,renderSceneIdentity,initialScene}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const withoutUUID={getRandomValues:crypto.getRandomValues.bind(crypto)},ids=Array.from({length:1000},()=>randomId(withoutUUID));
assert.equal(new Set(ids).size,1000);assert.ok(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));console.log('PASS UUID fallback uses valid unique v4 identifiers');
const scene=initialScene(),saved={...scene,renders:[{id:randomId(),name:'시안',createdAt:new Date().toISOString(),prompt:'test'}]};assert.equal(renderSceneIdentity(scene),renderSceneIdentity(saved));console.log('PASS sequential generated images remain linked to an unchanged scene');
assert.notEqual(renderSceneIdentity(scene),renderSceneIdentity({...saved,room:{...saved.room,width:saved.room.width+100}}));assert.notEqual(renderSceneIdentity(scene),renderSceneIdentity({...saved,photoId:randomId()}));console.log('PASS room and reference changes invalidate a captured scene');
console.log('3 browser compatibility checks passed.');
