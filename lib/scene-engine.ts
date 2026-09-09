import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { materials, nodeAppearance, type MaterialFinish, type MaterialId, type SceneData, type SceneNode, type Selection } from './scene-model';
export type ToolMode = 'select' | 'translate' | 'rotate' | 'draw';
export type ViewMode = 'perspective' | 'top' | 'front' | 'interior';
export class SceneEngine {
    renderer: T.WebGLRenderer;
    scene = new T.Scene();
    root = new T.Group();
    helpers = new T.Group();
    camera: T.PerspectiveCamera | T.OrthographicCamera;
    perspective: T.PerspectiveCamera;
    planCamera = new T.OrthographicCamera(-5, 5, 5, -5, .01, 200);
    private geometryKey = "";
    orbit: OrbitControls;
    transform: TransformControls;
    observer: ResizeObserver;
    frame = 0;
    data?: SceneData;
    selection: Selection = null;
    outline?: T.BoxHelper;
    mode: ToolMode = 'select';
    view: ViewMode = 'perspective';
    grid: T.GridHelper;
    cutaway = true;
    dimensions = false;
    light: T.DirectionalLight;
    ambient: T.HemisphereLight;
    environment: T.WebGLRenderTarget;
    selectedObject?: T.Object3D;
    drawStart: T.Vector3 | null = null;
    onDraw: (p: {
        x: number;
        z: number;
        width: number;
        depth: number;
    }) => void;
    onSelect: (s: Selection) => void;
    onTransform: (id: string, p: Partial<SceneNode>) => void;
    private down = [0, 0];
    private dragActive = false;
    private suppress = false;
    private pointerDown: (e: PointerEvent) => void;
    private pointerUp: (e: PointerEvent) => void;
    private textures = new Map<string, T.CanvasTexture>();
    private selectionMode: 'face' | 'object' = 'face';
    constructor(public host: HTMLElement, callbacks: {
        onDraw: (p: {
            x: number;
            z: number;
            width: number;
            depth: number;
        }) => void;
        onSelect: (s: Selection) => void;
        onTransform: (id: string, p: Partial<SceneNode>) => void;
    }) {
        this.onDraw = callbacks.onDraw;
        this.onSelect = callbacks.onSelect;
        this.onTransform = callbacks.onTransform;
        this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.renderer.domElement.setAttribute('aria-label', '편집 가능한 매장 3D 장면');
        this.renderer.domElement.tabIndex = 0;
        this.host.appendChild(this.renderer.domElement);
        this.scene.background = new T.Color('#e8ebef');
        this.perspective = new T.PerspectiveCamera(38, 1, .05, 200);
        this.camera = this.perspective;
        this.camera.position.set(10, 9.5, 12);
        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = .12;
        this.orbit.target.set(0, .55, 0);
        this.orbit.maxPolarAngle = Math.PI * .49;
        this.orbit.minDistance = 1;
        this.orbit.maxDistance = 70;
        this.scene.add(this.root, this.helpers);
        this.root.name = 'SPATIAL_PROJECT';
        const pmrem = new T.PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this.environment = pmrem.fromScene(room, .04);
        this.scene.environment = this.environment.texture;
        room.dispose();
        pmrem.dispose();
        this.scene.environmentIntensity = .65;
        this.ambient = new T.HemisphereLight(0xffffff, 0x999b9c, 2);
        this.scene.add(this.ambient);
        this.light = new T.DirectionalLight(0xfff1db, 3.5);
        this.light.position.set(-4, 9, 4);
        this.light.castShadow = true;
        this.light.shadow.mapSize.set(2048, 2048);
        Object.assign(this.light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 30 });
        this.light.shadow.bias = -.0003;
        this.light.shadow.normalBias = .035;
        this.scene.add(this.light);
        this.grid = new T.GridHelper(30, 60, 0xc5cbd2, 0xd7dce2);
        this.grid.position.y = -.18;
        this.helpers.add(this.grid);
        this.transform = new TransformControls(this.camera, this.renderer.domElement);
        this.transform.setSize(.75);
        this.transform.setTranslationSnap(.05);
        this.transform.setRotationSnap(Math.PI / 12);
        this.scene.add(this.transform.getHelper());
        this.transform.addEventListener('dragging-changed', e => {
            this.dragActive = !!e.value;
            this.orbit.enabled = !e.value;
            if (e.value)
                this.suppress = true;
        });
        this.transform.addEventListener('mouseUp', () => {
            const o = this.transform.object;
            if (!o)
                return;
            const id = o.userData.nodeId as string;
            const n = this.data?.nodes.find(n => n.id === id);
            if (!n)
                return;
            const patch: Partial<SceneNode> = { x: Math.round(o.position.x * 1000), y: Math.max(0, Math.round(o.position.y * 1000)), z: Math.round(o.position.z * 1000), rotation: Math.round(Math.atan2(2 * (o.quaternion.w * o.quaternion.y + o.quaternion.x * o.quaternion.z), 1 - 2 * (o.quaternion.y * o.quaternion.y + o.quaternion.z * o.quaternion.z)) * 180 / Math.PI) };
            if (patch.x !== n.x || patch.y !== n.y || patch.z !== n.z || patch.rotation !== n.rotation)
                this.onTransform(id, patch);
        });
        this.pointerDown = e => { this.down = [e.clientX, e.clientY]; this.suppress = this.dragActive; };
        this.pointerUp = e => {
            if (this.suppress || this.dragActive || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5)
                return;
            const r = this.renderer.domElement.getBoundingClientRect();
            const ray = new T.Raycaster();
            ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
            if (this.mode === 'draw') {
                const point = new T.Vector3();
                if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), point))
                    return;
                point.x = Math.round(point.x * 20) / 20;
                point.z = Math.round(point.z * 20) / 20;
                if (!this.drawStart) {
                    this.drawStart = point;
                    this.host.style.cursor = 'crosshair';
                    return;
                }
                const start = this.drawStart;
                this.drawStart = null;
                const width = Math.round(Math.abs(point.x - start.x) * 1000), depth = Math.round(Math.abs(point.z - start.z) * 1000);
                if (width >= 50 && depth >= 50)
                    this.onDraw({ x: Math.round((point.x + start.x) * 500), z: Math.round((point.z + start.z) * 500), width, depth });
                return;
            }
            const hits = ray.intersectObjects(this.root.children, true).filter(h => {
                let o: T.Object3D | null = h.object;
                while (o) {
                    if (!o.visible)
                        return false;
                    o = o.parent;
                }
                return !!h.object.userData.nodeId;
            });
            const hit = hits[0];
            if (!hit) {
                this.onSelect(null);
                return;
            }
            const id = hit.object.userData.nodeId;
            const part = hit.object.userData.part as string;
            this.onSelect({ id, face: this.selectionMode === 'face' && part ? `${part}:${hit.face?.materialIndex ?? 0}` : undefined });
        };
        this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(host);
        this.resize();
        this.loop();
    }
    private resize() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        if (!w || !h)
            return;
        this.renderer.setSize(w, h, false);
        if (this.camera instanceof T.PerspectiveCamera)
            this.camera.aspect = w / h;
        else
            this.fitPlan(w / h);
        this.camera.updateProjectionMatrix();
    }
    private loop = () => { this.frame = requestAnimationFrame(this.loop); this.orbit.update(); this.updateCutaway(); this.outline?.update(); this.renderer.render(this.scene, this.camera); };
    texture(id: MaterialId, color?: string) {
        const existing = this.textures.get(`${id}:${color ?? "default"}`);
        if (existing)
            return existing;
        const m = materials.find(m => m.id === id)!;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const c = canvas.getContext('2d')!;
        c.fillStyle = color ?? m.color;
        c.fillRect(0, 0, 256, 256);
        let seed = 43;
        const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        if (m.pattern === 'wood') {
            for (let i = 0; i < 240; i++) {
                c.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '75,38,8'},${random() * .12})`;
                c.lineWidth = .3 + random() * 1.2;
                c.beginPath();
                let x = random() * 256;
                c.moveTo(x, 0);
                for (let y = 0; y <= 256; y += 8)
                    c.lineTo(x + Math.sin(y / 40 + i) * random() * 4, y);
                c.stroke();
            }
            c.fillStyle = 'rgba(60,30,8,.15)';
            c.fillRect(0, 0, 1, 256);
            c.fillRect(127, 0, 1, 256);
        }
        else if (m.pattern === 'tile') {
            c.strokeStyle = '#aaa9a2';
            c.lineWidth = 2;
            c.strokeRect(0, 0, 128, 128);
            c.strokeRect(128, 128, 128, 128);
            c.strokeRect(128, 0, 128, 128);
            c.strokeRect(0, 128, 128, 128);
        }
        else if (m.pattern === 'terrazzo') {
            for (let i = 0; i < 200; i++) {
                c.fillStyle = ['#88847c', '#b39b83', '#f0eee8', '#a9a69b'][i % 4];
                const x = random() * 256, y = random() * 256, d = 1 + random() * 4;
                c.beginPath();
                c.moveTo(x, y);
                c.lineTo(x + d, y + d / 2);
                c.lineTo(x + d * .4, y + d);
                c.closePath();
                c.fill();
            }
        }
        else if (m.pattern === 'fabric') {
            for (let i = 0; i < 256; i += 3) {
                c.fillStyle = 'rgba(70,55,40,.06)';
                c.fillRect(i, 0, 1, 256);
                c.fillRect(0, i, 256, 1);
            }
        }
        else {
            for (let i = 0; i < 5000; i++) {
                c.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${random() * .08})`;
                const x = random() * 256, y = random() * 256;
                c.fillRect(x, y, m.pattern === 'steel' ? 20 : 1, 1);
            }
        }
        const tx = new T.CanvasTexture(canvas);
        tx.colorSpace = T.SRGBColorSpace;
        tx.wrapS = tx.wrapT = T.RepeatWrapping;
        tx.anisotropy = 4;
        this.textures.set(`${id}:${color ?? "default"}`, tx);
        if (this.textures.size > 40) {
            const key = this.textures.keys().next().value;
            if (key) {
                this.textures.get(key)?.dispose();
                this.textures.delete(key);
            }
        }
        return tx;
    }
    private material(id: MaterialId, color?: string, repeat: [
        number,
        number
    ] = [1, 1], finish: MaterialFinish = {}) {
        const m = materials.find(m => m.id === id)!;
        const map = this.texture(id, finish.color ?? color).clone();
        map.needsUpdate = true;
        const scale = (finish.scale ?? 900) / 1000;
        map.repeat.set(repeat[0] / scale, repeat[1] / scale);
        map.center.set(.5, .5);
        map.rotation = (finish.rotation ?? 0) * Math.PI / 180;
        const material = new T.MeshStandardMaterial({ color: '#ffffff', map, roughness: finish.roughness ?? m.roughness, metalness: finish.metalness ?? m.metalness, side: T.DoubleSide });
        if (id === 'glass') {
            material.transparent = true;
            material.opacity = .28;
            material.depthWrite = false;
        }
        return material;
    }
    private nodeMaterial(node: SceneNode, face: string, size: [
        number,
        number
    ] = [1, 1]) { const a = nodeAppearance(node, face); return this.material(a.material, undefined, size, a.finish); }
    private box(parent: T.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, id: string, part: string, mat: MaterialId, node?: SceneNode): T.Mesh<T.BoxGeometry, T.Material | T.Material[]> {
        const geometry = new T.BoxGeometry(Math.max(.006, w), Math.max(.006, h), Math.max(.006, d));
        const sizes: [
            [
                number,
                number
            ],
            [
                number,
                number
            ],
            [
                number,
                number
            ],
            [
                number,
                number
            ],
            [
                number,
                number
            ],
            [
                number,
                number
            ]
        ] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        const mats = sizes.map((size, i) => node ? this.nodeMaterial(node, `${part}:${i}`, [Math.max(.006, size[0]), Math.max(.006, size[1])]) : this.material(mat, undefined, size));
        const mesh = new T.Mesh(geometry, mats);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { nodeId: id, part };
        parent.add(mesh);
        return mesh;
    }
    private cylinder(parent: T.Object3D, r: number, h: number, x: number, y: number, z: number, id: string, part: string, mat: MaterialId, node?: SceneNode, rTop?: number) { const mats = [0, 1, 2].map(i => node ? this.nodeMaterial(node, `${part}:${i}`, i === 0 ? [Math.PI * r * 2, h] : [r * 2, r * 2]) : this.material(mat)); const mesh = new T.Mesh(new T.CylinderGeometry(rTop ?? r, r, h, 32), mats); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { nodeId: id, part }; parent.add(mesh); return mesh; }
    setScene(data: SceneData) {
        const roomResized = this.data?.room.width !== data.room.width || this.data?.room.depth !== data.room.depth;
        const key = JSON.stringify({ room: data.room, nodes: data.nodes });
        this.data = data;
        if (key === this.geometryKey) {
            for (const n of data.nodes) {
                const o = this.root.children.find(o => o.userData.nodeId === n.id);
                if (o && !n.host) {
                    o.position.set(n.x / 1000, n.y / 1000, n.z / 1000);
                    o.rotation.set(0, n.rotation * Math.PI / 180, 0);
                }
            }
            this.setLighting(data.lighting);
            return;
        }
        this.geometryKey = key;
        this.transform.detach();
        this.clearGroup(this.root);
        const w = data.room.width / 1000, d = data.room.depth / 1000, h = data.room.height / 1000;
        const floor = this.box(this.root, w, .15, d, 0, -.075, 0, 'floor', 'surface', data.room.surfaces.floor.material);
        this.disposeMaterial(floor.material);
        floor.material = this.surfaceMaterial('floor', [w, d]);
        for (const key of ['back', 'left', 'right', 'front'] as const) {
            const along = key === 'back' || key === 'front' ? w : d;
            const wall = new T.Group();
            wall.name = `wall-${key}`;
            wall.userData = { wall: key, nodeId: key };
            if (key === 'back')
                wall.position.z = -d / 2;
            if (key === 'front')
                wall.position.z = d / 2;
            if (key === 'left') {
                wall.position.x = -w / 2;
                wall.rotation.y = Math.PI / 2;
            }
            if (key === 'right') {
                wall.position.x = w / 2;
                wall.rotation.y = Math.PI / 2;
            }
            const openings = data.nodes.filter(n => n.host === key && !n.hidden);
            const xs = new Set([-along / 2, along / 2]), ys = new Set([0, h]);
            for (const o of openings) {
                const center = (key === 'back' || key === 'front' ? o.x : -o.z) / 1000;
                xs.add(center - o.width / 2000);
                xs.add(center + o.width / 2000);
                ys.add(o.y / 1000);
                ys.add((o.y + o.height) / 1000);
            }
            const xa = [...xs].sort((a, b) => a - b), ya = [...ys].sort((a, b) => a - b);
            for (let i = 0; i < xa.length - 1; i++)
                for (let j = 0; j < ya.length - 1; j++) {
                    const cx = (xa[i] + xa[i + 1]) / 2, cy = (ya[j] + ya[j + 1]) / 2;
                    const open = openings.some(o => { const center = (key === 'back' || key === 'front' ? o.x : -o.z) / 1000; return Math.abs(cx - center) < o.width / 2000 && cy > o.y / 1000 && cy < (o.y + o.height) / 1000; });
                    if (!open) {
                        const mesh = this.box(wall, xa[i + 1] - xa[i], ya[j + 1] - ya[j], .12, cx, cy, 0, key, 'surface', data.room.surfaces[key].material);
                        this.disposeMaterial(mesh.material);
                        mesh.material = this.surfaceMaterial(key, [xa[i + 1] - xa[i], ya[j + 1] - ya[j]]);
                    }
                }
            this.root.add(wall);
        }
        for (const node of data.nodes)
            this.buildNode(node);
        this.setLighting(data.lighting);
        if (roomResized && this.view === 'top')
            this.setView('top');
        this.setSelection(this.selection);
        this.updateCutaway();
    }
    private surfaceMaterial(id: keyof SceneData['room']['surfaces'], repeat: [
        number,
        number
    ]) { const s = this.data!.room.surfaces[id]; return this.material(s.material, s.color, repeat, s.finish); }
    private buildNode(n: SceneNode) {
        const g = new T.Group();
        g.name = n.name;
        g.userData = { nodeId: n.id };
        g.position.set(n.x / 1000, n.y / 1000, n.z / 1000);
        g.rotation.y = n.rotation * Math.PI / 180;
        g.visible = !n.hidden;
        const w = n.width / 1000, h = n.height / 1000, d = n.depth / 1000;
        const box = (ww: number, hh: number, dd: number, x: number, y: number, z: number, part: string, mat: MaterialId = n.material) => this.box(g, ww, hh, dd, x, y, z, n.id, part, mat, n);
        const cylinder = (r: number, hh: number, x: number, y: number, z: number, part: string, mat: MaterialId = n.material, rt?: number) => this.cylinder(g, r, hh, x, y, z, n.id, part, mat, n, rt);
        switch (n.kind) {
            case 'table':
            case 'round-table': {
                const thick = .045;
                if (n.kind === 'table')
                    box(w, thick, d, 0, h - thick / 2, 0, 'top');
                else
                    cylinder(w / 2, thick, 0, h - thick / 2, 0, 'top').scale.z = d / w;
                cylinder(.045, h - thick, 0, (h - thick) / 2, 0, 'stem', 'charcoal');
                cylinder(Math.min(w, d) * .32, .035, 0, .025, 0, 'base', 'charcoal');
                break;
            }
            case 'chair': {
                const seat = Math.min(.45, h * .59);
                box(w, .045, d, 0, seat, 0, 'seat');
                box(w, h - seat - .09, .055, 0, (h + seat + .09) / 2, d / 2 - .03, 'back');
                for (const x of [-1, 1])
                    for (const z of [-1, 1])
                        box(.03, seat, .03, x * (w / 2 - .045), seat / 2, z * (d / 2 - .045), `leg${x}${z}`, 'charcoal');
                break;
            }
            case 'bench': {
                const seat = Math.min(.46, h * .65);
                box(w, seat - .09, d, 0, (seat - .09) / 2, 0, 'base', 'oak');
                box(w, .1, d, 0, seat - .03, 0, 'seat');
                box(w, Math.max(.08, h - seat), .11, 0, (h + seat) / 2, d / 2 - .06, 'back');
                break;
            }
            case 'counter': {
                box(w - .02, h - .04, d - .02, 0, (h - .04) / 2, 0, 'body');
                box(w, .045, d, 0, h - .022, 0, 'top');
                for (let i = 0; i < Math.max(2, Math.floor(w / .6)); i++)
                    box(.006, h - .13, .006, -w / 2 + (i + 1) * w / (Math.floor(w / .6) + 1), (h - .1) / 2, d / 2 - .004, `joint${i}`, 'charcoal');
                break;
            }
            case 'shelf': {
                box(.04, h, d, -w / 2 + .02, h / 2, 0, 'side1');
                box(.04, h, d, w / 2 - .02, h / 2, 0, 'side2');
                for (let i = 0; i < 5; i++)
                    box(w, .035, d, 0, .04 + i * (h - .06) / 4, 0, `shelf${i}`);
                break;
            }
            case 'plant': {
                cylinder(w * .3, h * .24, 0, h * .12, 0, 'pot', 'concrete', w * .4);
                cylinder(.02, h * .65, 0, h * .5, 0, 'trunk', 'walnut');
                for (let i = 0; i < 10; i++) {
                    const angle = i * 2.4;
                    const mesh = new T.Mesh(new T.SphereGeometry(1, 12, 8), this.nodeMaterial(n, `leaf${i}:0`, [w, h]));
                    mesh.scale.set(w * .22, h * .14, d * .32);
                    mesh.rotation.y = angle;
                    mesh.position.set(Math.sin(angle) * w * .15, h * (.45 + i * .044), Math.cos(angle) * d * .15);
                    mesh.userData = { nodeId: n.id, part: `leaf${i}` };
                    mesh.castShadow = true;
                    g.add(mesh);
                }
                break;
            }
            case 'pendant': {
                cylinder(w / 2, h * .6, 0, h * .3, 0, 'shade', n.material, w * .22).scale.z = d / w;
                cylinder(.008, h * .4, 0, h * .8, 0, 'cord', 'charcoal');
                const bulb = new T.Mesh(new T.SphereGeometry(Math.min(w * .15, h * .12), 12, 8), new T.MeshStandardMaterial({ color: '#fff4d4', emissive: '#ffce86', emissiveIntensity: 2 }));
                bulb.position.y = Math.min(h * .12, w * .15);
                g.add(bulb);
                const light = new T.PointLight('#ffe3b1', 4, 4, 2);
                light.position.y = -.08;
                g.add(light);
                break;
            }
            case 'door':
            case 'window': {
                const room = this.data!.room;
                const host = n.host!;
                if (host === 'back') {
                    g.position.set(n.x / 1000, n.y / 1000, -room.depth / 2000);
                }
                if (host === 'front') {
                    g.position.set(n.x / 1000, n.y / 1000, room.depth / 2000);
                }
                if (host === 'left') {
                    g.position.set(-room.width / 2000, n.y / 1000, n.z / 1000);
                    g.rotation.y = Math.PI / 2;
                }
                if (host === 'right') {
                    g.position.set(room.width / 2000, n.y / 1000, n.z / 1000);
                    g.rotation.y = Math.PI / 2;
                }
                g.userData.host = host;
                box(w, h, .025, 0, h / 2, 0, 'panel');
                for (const x of [-1, 1])
                    box(.045, h, d, x * (w / 2 - .022), h / 2, 0, `frame${x}`, 'charcoal');
                box(w, .045, d, 0, h - .022, 0, 'frameTop', 'charcoal');
                if (n.kind === 'window') {
                    box(w, .045, d, 0, .022, 0, 'frameBottom', 'charcoal');
                    box(.035, h, .055, 0, h / 2, 0, 'divider', 'charcoal');
                }
                else
                    box(.02, .16, .06, w / 2 - .12, h * .47, .035, 'handle', 'steel');
                break;
            }
            case 'cylinder':
                cylinder(w / 2, h, 0, h / 2, 0, 'body').scale.z = d / w;
                break;
            default: box(w, h, d, 0, h / 2, 0, 'body');
        }
        this.root.add(g);
        return g;
    }
    setLighting(value: SceneData['lighting']) { this.renderer.toneMappingExposure = .85 + value.intensity * .35; this.ambient.intensity = 1.3 + value.intensity * .65; this.light.intensity = 2.5 * value.intensity; const t = (value.warmth - 2700) / (6500 - 2700); this.light.color.setRGB(1, .77 + t * .22, .5 + t * .5); }
    private updateCutaway() {
        if (!this.data)
            return;
        const p = this.camera.position;
        const d = this.data.room.depth / 1000, w = this.data.room.width / 1000;
        for (const item of this.root.children) {
            const wall = item.userData.wall ?? item.userData.host;
            if (!wall)
                continue;
            const n = this.data.nodes.find(n => n.id === item.userData.nodeId);
            const hidden = n?.hidden ?? false;
            const front = wall === 'front' && p.z > d / 2, back = wall === 'back' && p.z < -d / 2, left = wall === 'left' && p.x < -w / 2, right = wall === 'right' && p.x > w / 2;
            item.visible = !hidden && !(this.cutaway && (this.view === 'top' || front || back || left || right));
        }
    }
    setSelection(selection: Selection) {
        this.selection = selection;
        this.transform.detach();
        if (this.outline) {
            this.helpers.remove(this.outline);
            this.outline.geometry.dispose();
            (this.outline.material as T.Material).dispose();
            this.outline = undefined;
        }
        if (!selection)
            return;
        const n = this.data?.nodes.find(n => n.id === selection.id);
        const obj = this.root.children.find(o => o.userData.nodeId === selection.id);
        if (!obj)
            return;
        this.selectedObject = obj;
        if (selection.face && !Object.hasOwn(this.data!.room.surfaces, selection.id)) {
            const part = selection.face.split(':')[0];
            let partObject: T.Object3D | undefined;
            obj.traverse(o => {
                if (o.userData.part === part && !partObject)
                    partObject = o;
            });
            this.outline = new T.BoxHelper(partObject ?? obj, 0x7861f0);
        }
        else
            this.outline = new T.BoxHelper(obj, 0x7861f0);
        (this.outline.material as T.Material).depthTest = false;
        this.outline.renderOrder = 10;
        this.helpers.add(this.outline);
        if (n && !n.locked && !n.hidden && !n.host && (this.mode === 'translate' || this.mode === 'rotate')) {
            this.transform.setMode(this.mode);
            this.transform.showX = this.mode === 'translate';
            this.transform.showY = true;
            this.transform.showZ = this.mode === 'translate';
            this.transform.attach(obj);
        }
    }
    setMode(mode: ToolMode) { this.mode = mode; this.drawStart = null; this.orbit.enabled = mode !== 'draw'; this.host.style.cursor = mode === 'draw' ? 'crosshair' : 'default'; this.setSelection(this.selection); }
    setSelectionMode(mode: 'face' | 'object') { this.selectionMode = mode; }
    setSnap(value: boolean) { this.transform.setTranslationSnap(value ? .05 : null); this.transform.setRotationSnap(value ? Math.PI / 12 : null); }
    private fitPlan(aspect: number) { const w = (this.data?.room.width ?? 7200) / 1000, d = (this.data?.room.depth ?? 6400) / 1000; const half = Math.max(d * 1.25 / 2, w * 1.25 / (2 * aspect)); this.planCamera.left = -half * aspect; this.planCamera.right = half * aspect; this.planCamera.top = half; this.planCamera.bottom = -half; this.planCamera.updateProjectionMatrix(); }
    setView(view: ViewMode) {
        this.view = view;
        this.planCamera.up.set(0, 0, -1);
        const nextCamera = view === 'top' ? this.planCamera : this.perspective;
        if (nextCamera !== this.camera) {
            this.orbit.dispose();
            this.camera = nextCamera;
            this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
            this.orbit.enableDamping = true;
            this.orbit.dampingFactor = .12;
            this.orbit.minDistance = 1;
            this.orbit.maxDistance = 70;
            this.orbit.enabled = this.mode !== 'draw';
        }
        this.transform.camera = this.camera;
        const width = (this.data?.room.width ?? 7200) / 1000, depth = (this.data?.room.depth ?? 6400) / 1000, size = Math.max(width, depth);
        this.orbit.target.set(0, .55, 0);
        this.orbit.enableRotate = view !== 'top';
        this.orbit.maxPolarAngle = view === 'top' ? Math.PI : view === 'interior' ? Math.PI * .58 : Math.PI * .49;
        if (view === 'perspective')
            this.camera.position.set(size * 1.25, size * 1.12, size * 1.5);
        if (view === 'top') {
            this.planCamera.zoom = 1;
            this.camera.position.set(0, size * 2.05, .00001);
            this.camera.up.set(0, 0, -1);
            this.orbit.target.set(0, 0, 0);
        }
        else
            this.camera.up.set(0, 1, 0);
        if (view === 'front')
            this.camera.position.set(0, 2.9, size * 1.6);
        if (view === 'interior') {
            this.camera.position.set(-width * .25, 1.65, depth * .4);
            this.orbit.target.set(0, 1.35, -depth * .4);
        }
        this.resize();
        this.orbit.update();
        this.setSelection(this.selection);
    }
    zoom(factor: number) { if (this.camera instanceof T.OrthographicCamera) {
        this.camera.zoom = Math.max(.1, Math.min(20, this.camera.zoom / factor));
        this.camera.updateProjectionMatrix();
    }
    else
        this.camera.position.sub(this.orbit.target).multiplyScalar(factor).add(this.orbit.target); this.orbit.update(); }
    captureCamera() { return { view: this.view, zoom: this.camera.zoom, position: this.camera.position.toArray() as [
            number,
            number,
            number
        ], target: this.orbit.target.toArray() as [
            number,
            number,
            number
        ] }; }
    restoreCamera(camera: {
        position: [
            number,
            number,
            number
        ];
        target: [
            number,
            number,
            number
        ];
        view?: ViewMode;
        zoom?: number;
    }) { this.setView(camera.view ?? 'perspective'); this.camera.position.fromArray(camera.position); this.orbit.target.fromArray(camera.target); this.camera.zoom = camera.zoom ?? 1; this.camera.updateProjectionMatrix(); this.orbit.update(); }
    async exportGlb() {
        const clone = this.root.clone(true);
        clone.traverse(o => {
            if (o.userData.wall || o.userData.host)
                o.visible = !this.data?.nodes.find(n => n.id === o.userData.nodeId)?.hidden;
        });
        return await new GLTFExporter().parseAsync(clone, { binary: true, onlyVisible: true, maxTextureSize: 1024 }) as ArrayBuffer;
    }
    async screenshot() {
        const oldSize = new T.Vector2();
        this.renderer.getSize(oldSize);
        const oldRatio = this.renderer.getPixelRatio();
        const oldAspect = oldSize.x / oldSize.y;
        const helperVis = this.helpers.visible;
        const gizmoVis = this.transform.getHelper().visible;
        this.helpers.visible = false;
        this.transform.getHelper().visible = false;
        try {
            const width = 2048, height = Math.round(width / oldAspect);
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(width, height, false);
            this.renderer.render(this.scene, this.camera);
            return this.renderer.domElement.toDataURL('image/png');
        }
        finally {
            this.renderer.setPixelRatio(oldRatio);
            this.renderer.setSize(oldSize.x, oldSize.y, false);
            if (this.camera instanceof T.PerspectiveCamera)
                this.camera.aspect = oldAspect;
            this.camera.updateProjectionMatrix();
            this.helpers.visible = helperVis;
            this.transform.getHelper().visible = gizmoVis;
        }
    }
    private disposeMaterial(material: T.Material | T.Material[]) {
        for (const m of Array.isArray(material) ? material : [material]) {
            if (m instanceof T.MeshStandardMaterial)
                m.map?.dispose();
            m.dispose();
        }
    }
    private clearGroup(group: T.Group) {
        group.traverse(o => {
            if (o instanceof T.Mesh) {
                o.geometry.dispose();
                this.disposeMaterial(o.material);
            }
        });
        group.clear();
    }
    dispose() {
        cancelAnimationFrame(this.frame);
        this.observer.disconnect();
        this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown);
        this.renderer.domElement.removeEventListener('pointerup', this.pointerUp);
        this.orbit.dispose();
        this.transform.dispose();
        this.clearGroup(this.root);
        this.grid.geometry.dispose();
        (this.grid.material as T.Material).dispose();
        if (this.outline) {
            this.outline.geometry.dispose();
            (this.outline.material as T.Material).dispose();
        }
        for (const tx of this.textures.values())
            tx.dispose();
        this.environment.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
