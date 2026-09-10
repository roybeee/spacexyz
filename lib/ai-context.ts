import type {SceneData} from './scene-model';
/** Spatial editing needs geometry and appearance; project prices are omitted from the provider context. */
export function sceneForDesignAi(scene:SceneData){const {budget,variants,underlay,...design}=scene;return {...design,nodes:design.nodes.map(({estimate,objectPhoto,...node})=>node)};}
