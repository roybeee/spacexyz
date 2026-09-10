import type {SceneData} from './scene-model';
/** Adding a saved render must not invalidate the unchanged captured 3D scene. */
export function renderSceneIdentity(scene:SceneData){return JSON.stringify({...scene,renders:[]});}
