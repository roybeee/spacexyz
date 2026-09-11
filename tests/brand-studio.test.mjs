import assert from 'node:assert/strict';
import {build} from 'esbuild';

// 브랜드 스튜디오 표준 매장 엔진: 시공매뉴얼 규칙(존 배분·동선·고정 사양)이 생성 배치와 리포트에 실제로 반영되는지 검증한다.
const bundle=await build({stdin:{contents:"export * from './lib/brand-standards';export * from './lib/brand-layout';export * from './lib/brand-application';export * from './lib/scene-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name)}

const brand=m.ofdBrand(),empty={...m.initialScene(),nodes:[]},identity={id:'ofd-starter',revision:0};
const presets=[[5000,6600,'C'],[6000,8300,'C'],[7200,9200,'B']];
const room=(width,depth,height=2900)=>({width,depth,height});
const layout=(w,d,options,b=brand)=>m.brandScene(empty,b,identity,'layout',room(w,d),false,options);
const sequentialIds=()=>{let n=0;return()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`};

await test('every preset and entrance yields a collision-free valid store whose zones tile the usable area',()=>{
  for(const [w,d,type] of presets)for(const entrance of ['left','center','right']){
    const s=layout(w,d,{entrance,seating:true}),r=s.brandApplication.report;
    assert.deepEqual(m.collisions(s),[],`${w}x${d} ${entrance}`);
    assert.deepEqual(m.validateScene(JSON.parse(JSON.stringify(s))),s);
    assert.equal(r.storeType,type);
    const total=r.zones.reduce((sum,z)=>sum+z.ratio,0);
    assert.ok(Math.abs(total-100)<0.6,`zones sum ${total}`);
    assert.ok(r.zones.find(z=>z.id==='Z2').ratio>=19.5,'display share is the hard rule');
    assert.ok(r.zones.every(z=>z.status!=='fail'));
    assert.ok(r.aisles.every(a=>a.status==='ok'&&a.actual>=a.required),JSON.stringify(r.aisles));
    assert.ok(r.seats.total>0);
    assert.equal(r.seats.total,r.seats.windowBar+r.seats.bench);
    assert.equal(r.equipment.find(e=>e.name==='진열 쇼케이스 플린스').count,s.nodes.filter(n=>n.name==='유리 쇼케이스').length);
    for(const n of s.nodes)assert.ok(n.y+n.height<=2900,`${n.name} exceeds ceiling`);
    m.brandReportSchema.parse(r);
  }
});

await test('zone bands are contiguous from the back wall to the storefront and the display share uses the queue depth',()=>{
  const {bands,report}=m.brandPlan(brand,room(5000,6600));
  assert.equal(bands.length,4);
  assert.equal(bands[0].z0,-3240);assert.equal(bands[3].z1,3240);
  for(let i=1;i<bands.length;i++)assert.equal(bands[i].z0,bands[i-1].z1);
  assert.equal(bands[0].z1-bands[0].z0,450+900);
  assert.equal(bands[1].z1-bands[1].z0,800);
  assert.equal(bands[2].z1-bands[2].z0,2400);
  const display=report.zones.find(z=>z.id==='Z2');
  assert.equal(display.areaM2,Math.round(2100*3200/1e6*10)/10);
  assert.equal(report.pyeong,10);
});

await test('a right-hand entrance mirrors the plan so the display starts beside the door and seating sits opposite',()=>{
  const left=layout(5000,6600,{entrance:'left',seating:true}),right=layout(5000,6600,{entrance:'right',seating:true}),center=layout(5000,6600,{entrance:'center',seating:true});
  const door=s=>s.nodes.find(n=>n.kind==='door');
  assert.equal(door(left).x,-1690);assert.equal(door(right).x,1690);assert.equal(door(center).x,0);
  assert.equal(door(left).host,'front');assert.equal(door(left).width,1000);assert.equal(door(left).material,'glass');
  const showcase=s=>s.nodes.filter(n=>n.name==='유리 쇼케이스').map(n=>n.x).sort((a,b)=>a-b);
  assert.deepEqual(showcase(right),showcase(left).map(x=>-x).sort((a,b)=>a-b));
  assert.ok(showcase(left).every(x=>x<0)&&showcase(right).every(x=>x>0));
  assert.ok(left.nodes.filter(n=>n.kind==='cylinder').every(n=>n.x>door(left).x));
  assert.ok(right.nodes.filter(n=>n.kind==='cylinder').every(n=>n.x<door(right).x));
  const bench=layout(6000,8300,{entrance:'right',seating:true}).nodes.find(n=>n.kind==='bench');
  assert.ok(bench.x<0&&bench.rotation===-90);
  assert.equal(right.brandApplication.entrance,'right');
});

await test('the entrance aisle stays clear of every front-band obstacle and is measured honestly',()=>{
  for(const [w,d] of presets)for(const entrance of ['left','center','right']){
    const {aisle,bands,report}=m.brandPlan(brand,room(w,d),{entrance,seating:true}),s=layout(w,d,{entrance,seating:true}),front=bands[3];
    const zFront=d/2-60,entryZone=zFront-1200; // the aisle must be straight through the entry zone; the display leg may sit beyond it
    for(const n of s.nodes.filter(n=>!n.host&&n.z+(Math.abs(n.rotation)%180===90?n.width:n.depth)/2>entryZone)){const half=(Math.abs(n.rotation)%180===90?n.depth:n.width)/2;assert.ok(n.x+half<=aisle.x0+1||n.x-half>=aisle.x1-1,`${n.name} blocks the entry aisle`)}
    assert.ok(front.z1===zFront);
    assert.equal(aisle.x1-aisle.x0,1200);
    assert.ok(report.aisles[0].actual>=1200);
  }
});

await test('seating can be switched off per store while the brand keeps its seating modules',()=>{
  const s=layout(5000,6600,{entrance:'left',seating:false}),r=s.brandApplication.report;
  assert.equal(r.seats.total,0);
  assert.ok(!s.nodes.some(n=>n.kind==='bench'||n.kind==='cylinder'||n.kind==='table'||n.kind==='chair'));
  assert.equal(s.brandApplication.seating,false);
  assert.ok(r.zones.find(z=>z.id==='Z5').ratio>0);
  assert.ok(!r.equipment.some(e=>e.name.includes('좌석')||e.name.includes('벤치')));
});

await test('a shop too narrow for the display share is refused with the width and module advice a planner would give',()=>{
  assert.throws(()=>layout(3600,9000,{entrance:'left',seating:true}),e=>e.message.includes('진열 존 20%')&&e.message.includes('4,620mm')&&e.message.includes('음료 제조대·픽업대 모듈'));
  const takeout=structuredClone(brand);takeout.modules.beverage.enabled=false;takeout.modules.pickup.enabled=false;
  const s=layout(3600,9000,{entrance:'left',seating:true},takeout),r=s.brandApplication.report;
  assert.ok(r.zones.find(z=>z.id==='Z2').ratio>=20);
  assert.equal(r.equipment.find(e=>e.name==='음료 제조대'),undefined);
  assert.equal(r.zones.find(z=>z.id==='Z4').ratio,0);
  assert.deepEqual(m.collisions(s),[]);
});

await test('service units shrink to design minimums only when the display share needs it and the report says so',()=>{
  const wide=structuredClone(brand);wide.modules.counter.width=1200;
  const r10=layout(5000,6600,{entrance:'left',seating:true}).brandApplication.report;
  assert.ok(r10.warnings.some(w=>w.includes('POS 카운터 900mm')));
  assert.equal(r10.equipment.find(e=>e.name==='주문 카운터 (POS)').note.includes('폭 900mm'),true);
  const r30=layout(12000,7000,{entrance:'left',seating:true}).brandApplication.report;
  assert.ok(!r30.warnings.some(w=>w.includes('줄였습니다')),JSON.stringify(r30.warnings));
  assert.ok(r30.equipment.find(e=>e.name==='주문 카운터 (POS)').note.includes('폭 1200mm'));
});

await test('brand rules drive the plan: queue depth lighting and door width are read from the standard not hard-coded',()=>{
  const custom=structuredClone(brand);custom.rules.queueDepth=3000;custom.rules.lightingWarmth=3500;custom.rules.doorWidth=1200;custom.rules.aisleMain=1500;
  const {bands,aisle}=m.brandPlan(custom,room(6000,8300));
  assert.equal(bands[2].z1-bands[2].z0,3000);
  assert.equal(aisle.x1-aisle.x0,1500);
  const s=layout(6000,8300,{entrance:'left',seating:true},custom);
  assert.equal(s.lighting.warmth,3500);
  assert.equal(s.nodes.find(n=>n.kind==='door').width,1200);
  assert.ok(s.nodes.some(n=>n.name==='진열 스포트 3,500K'));
  assert.equal(s.brandApplication.report.aisles[0].required,1500);
});

await test('fixed plinth specs are enforced: module widths are limited to 600 900 1200 and heights come from the standard',()=>{
  const bad=structuredClone(brand);bad.modules.showcase.width=1000;
  assert.throws(()=>layout(5000,6600,{entrance:'left',seating:true},bad),/600/);
  const s=layout(5000,6600,{entrance:'left',seating:true});
  for(const top of s.nodes.filter(n=>n.name==='플린스 상판 (석재)'))assert.equal(top.y+top.height,900);
  for(const glass of s.nodes.filter(n=>n.name==='유리 쇼케이스')){assert.equal(glass.y,900);assert.equal(glass.material,'glass')}
  for(const body of s.nodes.filter(n=>n.name==='플린스 몸체 (목재 무늬목)')){assert.equal(body.depth,800);assert.equal(body.material,'walnut');assert.equal(body.finish.color,'#5A3A2A')}
  assert.deepEqual(m.fillPlinthModules(2480,1200),[1200,1200]);
  assert.deepEqual(m.fillPlinthModules(2700,1200),[1200,900,600]);
  assert.deepEqual(m.fillPlinthModules(1800,900),[900,900]);
  assert.deepEqual(m.fillPlinthModules(500,1200),[]);
});

await test('store types follow the manual thresholds with planning rounding',()=>{
  const type=(w,d)=>m.brandPlan(brand,room(w,d)).report.storeType;
  assert.equal(type(5000,6600),'C');
  assert.equal(type(4600,6000),'D');
  assert.equal(type(7200,9200),'B');
  assert.equal(type(12000,11500),'A');
  assert.ok(m.brandPlan(brand,room(4600,6000)).report.warnings.some(w=>w.includes('인스토어')));
});

await test('the report carries every manual checklist item as a site check with its grade',()=>{
  const r=m.brandPlan(brand,room(5000,6600)).report;
  for(const item of brand.rules.checklist)assert.ok(r.checks.some(c=>c.label===item.label&&c.grade===item.grade&&c.status==='manual'));
  assert.ok(r.checks.filter(c=>c.status==='ok').length>=4);
  assert.ok(r.equipment.every(e=>['F','S','O'].includes(e.grade)&&e.count>0));
  assert.ok(r.warnings.length<=12&&r.checks.length<=16&&r.equipment.length<=24);
});

await test('mid-size shops wrap the display around the entrance corner so counters keep their brand widths',()=>{
  const s=layout(6000,8300,{entrance:'left',seating:true}),r=s.brandApplication.report;
  const leg=s.nodes.filter(n=>n.group?.name.startsWith('측벽 진열 모듈'));
  assert.equal(leg.filter(n=>n.name==='유리 쇼케이스').length,3);
  assert.ok(leg.every(n=>n.kind==='pendant'||Math.abs(n.rotation)===90));
  assert.ok(leg.filter(n=>n.kind!=='pendant').every(n=>n.x===-2540),'leg plinths hug the left wall');
  for(const n of leg)assert.ok(n.z+(Math.abs(n.rotation)===90?n.width:n.depth)/2<=8300/2-60-1200,'leg stops short of the entry zone');
  assert.ok(leg.filter(n=>n.name==='플린스 몸체 (목재 무늬목)').every(n=>[600,900,1200].includes(n.width)));
  assert.deepEqual(r.zones.map(z=>z.status),['ok','ok','ok','ok','ok']);
  assert.deepEqual(r.warnings,[]);
  assert.ok(r.equipment.find(e=>e.name==='주문 카운터 (POS)').note.includes('폭 1200mm'));
  assert.ok(r.equipment.find(e=>e.name==='음료 제조대').note.includes('폭 1200mm'));
  assert.equal(r.equipment.find(e=>e.name==='진열 쇼케이스 플린스').count,5);
  assert.ok(r.equipment.find(e=>e.name==='진열 쇼케이스 플린스').note.includes('측벽 L자 연장'));
  assert.ok(r.aisles.some(a=>a.name==='측벽 진열 앞 통로'&&a.actual===1200&&a.status==='ok'));
  const right=layout(6000,8300,{entrance:'right',seating:true});
  assert.ok(right.nodes.filter(n=>n.group?.name.startsWith('측벽 진열 모듈')&&n.kind!=='pendant').every(n=>n.x===2540),'mirrored leg hugs the right wall');
  assert.deepEqual(m.collisions(right),[]);
});

await test('the leg is only used when it earns its place: small shops stay straight and a straight-only rule reproduces the warnings',()=>{
  const small=layout(5000,6600,{entrance:'left',seating:true});
  assert.equal(small.nodes.filter(n=>n.group?.name.startsWith('측벽')).length,0);
  assert.equal(small.nodes.length,32);
  const straight=structuredClone(brand);straight.rules.displayWrap='straight';
  const s=layout(6000,8300,{entrance:'left',seating:true},straight),r=s.brandApplication.report;
  assert.equal(s.nodes.filter(n=>n.group?.name.startsWith('측벽')).length,0);
  assert.equal(r.zones.find(z=>z.id==='Z3').status,'warn');
  assert.ok(r.warnings.some(w=>w.includes('L자로 연장')));
  assert.ok(r.equipment.find(e=>e.name==='주문 카운터 (POS)').note.includes('폭 900mm'));
});

await test('a centred door on a narrow shop blocks the leg and the refusal says a side door would fix it',()=>{
  assert.throws(()=>layout(5200,8300,{entrance:'center',seating:true}),e=>e.message.includes('5,220mm')&&e.message.includes('출입구를 왼쪽이나 오른쪽에'));
  const side=layout(5200,8300,{entrance:'left',seating:true}),r=side.brandApplication.report;
  assert.equal(side.nodes.filter(n=>n.group?.name.startsWith('측벽 진열 모듈')&&n.name==='유리 쇼케이스').length,3);
  assert.ok(r.zones.every(z=>z.status==='ok'));
  assert.deepEqual(m.collisions(side),[]);
  const wide=layout(5220,8300,{entrance:'center',seating:true});
  assert.ok(wide.brandApplication.report.zones.find(z=>z.id==='Z2').ratio>=20);
});

await test('service units may grow past the brand width when the counter zone needs it and the report says so',()=>{
  const r=layout(7200,9200,{entrance:'left',seating:true}).brandApplication.report;
  assert.ok(r.equipment.find(e=>e.name==='음료 제조대').note.includes('폭 1800mm'));
  assert.ok(r.warnings.some(w=>w.includes('늘렸습니다')));
  assert.ok(r.zones.every(z=>z.status==='ok'),JSON.stringify(r.zones));
  const deep=layout(9000,12000,{entrance:'left',seating:true}).brandApplication.report;
  assert.ok(deep.zones.some(z=>z.status==='warn'),'a 12m-deep shop is reported honestly');
  assert.ok(deep.warnings.some(w=>w.includes('후방')));
});

await test('planning is deterministic for the same inputs and every node is grouped with a readable Korean name',()=>{
  const a=m.planBrandStore(brand,room(6000,8300),{entrance:'center',seating:true},sequentialIds()),b=m.planBrandStore(brand,room(6000,8300),{entrance:'center',seating:true},sequentialIds());
  assert.deepEqual(a,b);
  const grouped=a.nodes.filter(n=>n.group);
  assert.ok(grouped.length>a.nodes.length*0.8);
  for(const n of a.nodes){assert.ok(/[가-힣]/.test(n.name),n.name);assert.ok(n.name.length<=80)}
  assert.ok(a.nodes.some(n=>n.group?.name.startsWith('진열 모듈 1')));
  assert.ok(a.nodes.some(n=>n.group?.name.startsWith('창가 바')));
});

await test('surface mode is untouched by store options and layout mode records them with the report',()=>{
  const s=m.brandScene(m.initialScene(),brand,identity,'surfaces',room(5000,6600),false,{entrance:'right',seating:false});
  assert.equal(s.brandApplication.entrance,undefined);assert.equal(s.brandApplication.report,undefined);
  assert.equal(s.nodes.length,m.initialScene().nodes.length);
  const l=layout(5000,6600,{entrance:'center',seating:true});
  assert.deepEqual(Object.keys(l.brandApplication).sort(),['appliedAt','entrance','id','mode','name','report','revision','seating','status']);
  assert.throws(()=>m.validateScene({...l,brandApplication:{...l.brandApplication,report:{...l.brandApplication.report,storeType:'Z'}}}));
});

console.log(`${count} brand studio checks passed; manual-driven store planner verified without a browser.`);
