import * as T from 'three';
import type {SceneEngine} from './scene-engine';
import type {SceneData} from './scene-model';
import {walkWorld,walkBlocker,moveWalk,findWalkStart,walkDirection,type WalkPoint,type WalkWorld} from './walk-world';

export type WalkAction='forward'|'back'|'left'|'right'|'turnLeft'|'turnRight'|'lookUp'|'lookDown';
export type WalkState=WalkPoint&{yaw:number;pitch:number;eyeHeight:number;speed:number;blocked:string|null;available:boolean};
const keyActions:Record<string,WalkAction>={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',KeyD:'right',ArrowLeft:'turnLeft',ArrowRight:'turnRight'};
export class WalkthroughController{
 frozen=false;
 state:WalkState={x:0,z:0,yaw:0,pitch:0,eyeHeight:1650,speed:1000,blocked:null,available:false};
 world:WalkWorld;
 private keys=new Map<string,WalkAction>();
 private buttons=new Map<number,WalkAction>();
 private drag:{id:number;x:number;y:number}|null=null;
 private lastTime=0;
 private lastPublish=0;
 private disposed=false;
 private canvas:HTMLCanvasElement;
 constructor(private engine:SceneEngine,private scene:SceneData,private onChange:(state:WalkState)=>void){
  engine.setMode('select');engine.setSelection(null);engine.setView('interior');
  engine.navigationActive=true;engine.orbit.enabled=false;engine.cutaway=false;engine.helpers.visible=false;engine.measurementOverlay.group.visible=false;
  engine.perspective.fov=65;engine.perspective.updateProjectionMatrix();
  this.canvas=engine.renderer.domElement;
  this.canvas.setAttribute('aria-label','실내 둘러보기. 드래그로 시선 변경, W A S D로 이동, 방향키로 전진·후진·회전.');
  this.canvas.style.cursor='grab';
  this.world=walkWorld(scene,this.state.eyeHeight);
  const door=scene.nodes.find(n=>n.kind==='door'&&n.host==='front'&&!n.hidden);
  const start=findWalkStart(this.world,{x:door?.x??0,z:this.world.limitZ-120});
  if(start){Object.assign(this.state,start,{available:true});this.state.yaw=Math.atan2(start.x,start.z);}
  else this.state.blocked='시작 가능한 위치를 찾지 못했습니다. 평면도의 빈 곳을 선택하거나 가구 간격을 넓혀 주세요.';
  this.canvas.addEventListener('keydown',this.keyDown);
  window.addEventListener('keyup',this.keyUp);
  this.canvas.addEventListener('blur',this.stop);
  window.addEventListener('blur',this.stop);
  document.addEventListener('visibilitychange',this.stop);
  this.canvas.addEventListener('pointerdown',this.pointerDown);
  this.canvas.addEventListener('pointermove',this.pointerMove);
  this.canvas.addEventListener('pointerup',this.pointerEnd);
  this.canvas.addEventListener('pointercancel',this.pointerEnd);
  this.canvas.addEventListener('lostpointercapture',this.pointerEnd);
  engine.navigationUpdate=this.tick;this.syncCamera();this.publish();this.canvas.focus({preventScroll:true});
 }
 private keyDown=(e:KeyboardEvent)=>{const action=keyActions[e.code];if(!action||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();this.keys.set(e.code,action);};
 private keyUp=(e:KeyboardEvent)=>{const action=keyActions[e.code];if(action)this.keys.delete(e.code);};
 private pointerDown=(e:PointerEvent)=>{if(this.frozen||e.button!==0||e.isPrimary===false||this.drag)return;this.canvas.focus({preventScroll:true});this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);this.canvas.style.cursor='grabbing';};
 private pointerMove=(e:PointerEvent)=>{if(!this.drag||e.pointerId!==this.drag.id)return;this.look(-(e.clientX-this.drag.x)*.004,-(e.clientY-this.drag.y)*.004);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};};
 private pointerEnd=(e:PointerEvent)=>{if(this.drag?.id===e.pointerId){this.drag=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);this.canvas.style.cursor='grab';}};
 stop=()=>{this.keys.clear();this.buttons.clear();const drag=this.drag;this.drag=null;if(drag&&this.canvas.hasPointerCapture(drag.id))this.canvas.releasePointerCapture(drag.id);this.canvas.style.cursor='grab';this.lastTime=0;};
 hold(action:WalkAction,pointer:number){this.buttons.set(pointer,action);}
 release(pointer:number){this.buttons.delete(pointer);}
 step(action:WalkAction){this.perform(new Set([action]),.05);this.publish();}
 private tick=(now:number)=>{
  if(this.disposed)return;
  const dt=this.lastTime?Math.min(.05,Math.max(0,(now-this.lastTime)/1000)):0;this.lastTime=now;
  if(document.hidden){this.stop();return;}
  const actions=new Set([...this.keys.values(),...this.buttons.values()]);
  if(actions.size)this.perform(actions,dt);
  if(now-this.lastPublish>=100&&actions.size){this.lastPublish=now;this.publish();}
 };
 private perform(actions:Set<WalkAction>,dt:number){
  if(this.frozen||!this.state.available)return;
  const val=(yes:WalkAction,no:WalkAction)=>Number(actions.has(yes))-Number(actions.has(no));
  this.look(val('turnLeft','turnRight')*dt*1.4,val('lookUp','lookDown')*dt, false);
  const delta=walkDirection(this.state.yaw,val('forward','back'),val('right','left'),this.state.speed,dt),result=moveWalk(this.world,this.state,delta);
  Object.assign(this.state,result.point,{blocked:result.blocked});this.syncCamera();
 }
 private look(yaw:number,pitch:number,publish=true){this.state.yaw=((this.state.yaw+yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;this.state.pitch=Math.max(-Math.PI*.38,Math.min(Math.PI*.38,this.state.pitch+pitch));this.syncCamera();if(publish)this.publish();}
 private syncCamera(){if(!this.state.available)return;const {x,z,yaw,pitch,eyeHeight}=this.state,position=new T.Vector3(x/1000,eyeHeight/1000,z/1000),direction=new T.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));this.engine.camera.position.copy(position);this.engine.orbit.target.copy(position).addScaledVector(direction,2);this.engine.camera.lookAt(this.engine.orbit.target);}
 private publish(){if(!this.disposed)this.onChange({...this.state});}
 teleport(point:WalkPoint){this.stop();const blocker=walkBlocker(this.world,point);if(blocker)throw new Error(`${blocker}과 겹칩니다. 가구에서 여유가 있는 바닥을 선택하세요.`);Object.assign(this.state,point,{available:true,blocked:null});this.syncCamera();this.publish();this.canvas.focus({preventScroll:true});}
 setEyeHeight(height:number){this.stop();const world=walkWorld(this.scene,height),blocker=this.state.available?walkBlocker(world,this.state):null;if(blocker)throw new Error(`${blocker} 아래입니다. 빈 공간으로 이동한 뒤 눈높이를 바꾸세요.`);this.world=world;this.state.eyeHeight=height;this.publish();this.syncCamera();}
 setSpeed(speed:number){if(![500,1000,1600].includes(speed))return;this.state.speed=speed;this.publish();}
 level(){this.state.pitch=0;this.syncCamera();this.publish();}
 dispose(){if(this.disposed)return;this.stop();this.disposed=true;this.engine.navigationUpdate=undefined;this.canvas.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);this.canvas.removeEventListener('blur',this.stop);window.removeEventListener('blur',this.stop);document.removeEventListener('visibilitychange',this.stop);this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);for(const event of ['pointerup','pointercancel','lostpointercapture'])this.canvas.removeEventListener(event,this.pointerEnd as EventListener);}
}
