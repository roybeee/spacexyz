'use client';
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Store, Box, Layers, Palette, Sofa, ImagePlus, Sparkles, ChevronDown, ChevronRight, ChevronLeft, Undo2, Redo2, MousePointer2, Move, RotateCw, Copy, Trash2, Lock, Unlock, Eye, EyeOff, Download, Save, FolderOpen, Plus, Minus, Maximize, Grid2X2, Camera, Settings2, Search, Check, ArrowUp, Upload, Sun, Lightbulb, Ruler, X, FileJson, PanelLeft, SlidersHorizontal, Armchair, Table2, Leaf, DoorOpen, RectangleHorizontal, Circle, PanelTop, Square, Info, LoaderCircle, CheckCheck, Expand, Keyboard, Cloud, Link2, ScanLine, Menu } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SidebarProvider, Sidebar, SidebarContent } from '@/components/ui/sidebar';
import { Toaster, toast } from 'sonner';
import SceneCanvas from './scene-canvas';
import MaterialDetail from './material-detail';
import PhotoDraftDialog from './photo-draft-dialog';
import PlacementDialog from './placement-dialog';
import ModelImportDialog from './model-import-dialog';
import RenderDialog from './render-dialog';
import BatchInspector from './batch-inspector';
import DesignVariantsDialog from './design-variants-dialog';
import FloorPlanDialog from './floor-plan-dialog';
import FacadeDialog from './facade-dialog';
import AssembliesDialog from './assemblies-dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {selectionIds,chooseSelection,normalizeSelection,batchAction,transformGroup,type GroupDelta} from '@/lib/selection';
import {restoreVariant} from '@/lib/design-variants';
import { selectionAppearance, editAppearance, collisions } from '@/lib/scene-model';
import { initialScene, validateScene, createNode, materials, kindNames, kinds, surfaceNames, applyCommands, quickCommands, type MaterialId, type Kind, type SceneData, type SceneNode, type Selection, type SceneCommand } from '@/lib/scene-model';
import type { SceneEngine, ToolMode, ViewMode } from '@/lib/scene-engine';
import { photoData } from '@/lib/photo-palette';
type Project = {
    id: string;
    name: string;
    revision: number;
    updated_at: string;
};
type Proposal = {
    scene: SceneData;
    title: string;
    details: string;
    source: 'AI' | '빠른 명령' | '스타일' | '사진 팔레트' | '3D 초안' | '디자인 안' | '외관' | '가구 세트';
    baseScene?:string;
    addedIds?:string[];
    newProject?: boolean;
};
const icons: Record<SceneNode['kind'], typeof Box> = { table: Table2, 'round-table': Circle, chair: Armchair, bench: Sofa, counter: RectangleHorizontal, shelf: Layers, plant: Leaf, pendant: Lightbulb, box: Box, cylinder: Circle, partition: PanelTop, door: DoorOpen, window: Square, model: Box };
function IconButton({ label, children, active = false, ...props }: {
    label: string;
    children: ReactNode;
    active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) { return <Tooltip><TooltipTrigger asChild><button aria-label={label} className={`icon-button ${active ? 'active' : ''}`} {...props}>{children}</button></TooltipTrigger><TooltipContent sideOffset={8}>{label}</TooltipContent></Tooltip>; }
function NumberField({ label, value, onCommit, min = -20000, max = 20000, unit = 'mm' }: {
    label: string;
    value: number;
    onCommit: (n: number) => boolean | void;
    min?: number;
    max?: number;
    unit?: string;
}) {
    const [draft, setDraft] = useState(String(Math.round(value)));
    useEffect(() => setDraft(String(Math.round(value))), [value]);
    const commit = () => {
        const n = Number(draft);
        if (draft.trim() && Number.isFinite(n) && n >= min && n <= max) {
            if (n !== value) {
                const accepted = onCommit(n);
                if (accepted === false)
                    setDraft(String(Math.round(value)));
            }
        }
        else {
            setDraft(String(Math.round(value)));
            toast.error(`${label}: ${min}~${max}${unit} 범위로 입력하세요.`);
        }
    };
    return <label className="number-field"><span>{label}</span><div><input aria-label={label} type="number" min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => {
            if (e.key === 'Enter')
                e.currentTarget.blur();
        }}/><small>{unit}</small></div></label>;
}
function download(data: Blob | string, name: string) {
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    if (typeof data !== 'string')
        setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request(url: string, options?: RequestInit): Promise<any> {
    const r = await fetch(url, options);
    const data = await r.json() as Record<string, any>;
    if (!r.ok)
        throw new Error(data.error || '작업을 완료하지 못했습니다.');
    return data;
}
export default function InteriorStudio() {
    const [scene, setScene] = useState<SceneData>(initialScene), [selection, setSelection] = useState<Selection>({ id: 'floor' }), [tab, setTab] = useState('materials'), [filter, setFilter] = useState('전체'), [query, setQuery] = useState(''), [mode, setMode] = useState('easy'), [tool, setTool] = useState<ToolMode>('select'), [view, setView] = useState<ViewMode>('perspective'), [faceMode, setFaceMode] = useState<'face' | 'object'>('face'), [snap, setSnap] = useState(true), [cutaway, setCutaway] = useState(true), [undo, setUndo] = useState<SceneData[]>([]), [redo, setRedo] = useState<SceneData[]>([]), [modal, setModal] = useState<string | null>(null), [mobileLibrary, setMobileLibrary] = useState(false), [mobileInspector, setMobileInspector] = useState(false), [projects, setProjects] = useState<Project[]>([]), [projectId, setProjectId] = useState<string | null>(null), [revision, setRevision] = useState(0), [savedScene, setSavedScene] = useState(() => JSON.stringify(initialScene())), [saveState, setSaveState] = useState('새 프로젝트'), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [proposal, setProposal] = useState<Proposal | null>(null), [preview, setPreview] = useState(true), [prompt, setPrompt] = useState(''), [aiReady, setAiReady] = useState(false), [apiKey, setApiKey] = useState(''), [keyDraft, setKeyDraft] = useState(''), [aiBusy, setAiBusy] = useState(false), [photoUrl, setPhotoUrl] = useState('/cafe-reference.jpg'), [palette, setPalette] = useState<string[]>([]), [photoImage, setPhotoImage] = useState(''), [projectLoading, setProjectLoading] = useState(false), [pendingOpen, setPendingOpen] = useState<string | null>(null), [help, setHelp] = useState(false);
    const lightingStart = useRef<SceneData | null>(null);
    const projectSession = useRef(0), saveInFlight = useRef(false), loadInFlight = useRef(false);
    const [multiSelect,setMultiSelect]=useState(false);
    const [facadeTab,setFacadeTab]=useState<'sign'|'awning'|'front'>('sign'),[cameraName,setCameraName]=useState('');
    const [assemblySave,setAssemblySave]=useState(false);
    const assemblySession=useRef(0);
    const [modelFile, setModelFile] = useState<File | null>(null);
    const assetSession = useRef(0), renderSnapshot = useRef({ session: 0, scene: '' });
    const [nameDraft, setNameDraft] = useState(scene.name), [restoreCamera, setRestoreCamera] = useState<SceneData['cameras'][number] | null>(null), [nextModal, setNextModal] = useState<string | null>(null);
    useEffect(() => setNameDraft(scene.name), [scene.name]);
    const engine = useRef<SceneEngine | null>(null), uploadRef = useRef<HTMLInputElement>(null), importRef = useRef<HTMLInputElement>(null), sceneRef = useRef(scene), selectionRef = useRef(selection);
    sceneRef.current = scene;
    selectionRef.current = selection;
    const dirty = JSON.stringify(scene) !== savedScene;
    const node = scene.nodes.find(n => n.id === selection?.id);
    const surface = selection && Object.hasOwn(scene.room.surfaces, selection.id) ? scene.room.surfaces[selection.id as keyof SceneData['room']['surfaces']] : undefined;
    const selectedIds=selectionIds(selection),multiple=selectedIds.length>1;
    const appearance = multiple?null:selectionAppearance(scene, faceMode === 'object' && selection ? { id: selection.id } : selection);
    const originalMaterial = !!(appearance && 'original' in appearance && appearance.original);
    const selectedMaterial = originalMaterial ? undefined : appearance?.material;
    const conflicts = collisions(scene);
    const material = materials.find(m => m.id === selectedMaterial);
    const currentName = multiple?`${selectedIds.length}개 가구`:node?.name ?? surfaceNames[selection?.id ?? ''] ?? '공간 설정';
    const commit = useCallback((next: SceneData, label?: string) => {
        try {
            const valid = validateScene(next);
            if (JSON.stringify(valid) === JSON.stringify(sceneRef.current)){setProposal(null);return true;}
            const previous = sceneRef.current;
            setUndo(a => [...a.slice(-99), previous]);
            setRedo([]);
            sceneRef.current = valid;
            setScene(valid);
            setProposal(null);
            setSaveState('저장하지 않은 변경');
            if (label)
                toast.success(label);
            return true;
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : '치수를 확인하세요.');
            engine.current?.setScene(sceneRef.current);
            return false;
        }
    }, []);
    const updateNode = useCallback((id: string, p: Partial<SceneNode>) => {
        const s = sceneRef.current, n = s.nodes.find(n => n.id === id);
        if (!n)
            return false;
        if (n.locked && Object.keys(p).some(k => k !== 'locked' && k !== 'hidden')) {
            toast.error('잠금을 해제한 뒤 수정하세요.');
            engine.current?.setScene(s);
            return false;
        }
        return commit({ ...s, nodes: s.nodes.map(n => n.id === id ? { ...n, ...p } : n) });
    }, [commit]);
    function previewLighting(field: 'warmth' | 'intensity', value: number) {
        if (!lightingStart.current)
            lightingStart.current = sceneRef.current;
        const next = { ...sceneRef.current, lighting: { ...sceneRef.current.lighting, [field]: value } };
        sceneRef.current = next;
        setScene(next);
        setProposal(null);
    }
    function commitLighting() {
        if (lightingStart.current) {
            const before = lightingStart.current;
            lightingStart.current = null;
            setUndo(a => [...a.slice(-99), before]);
            setRedo([]);
            setSaveState('저장하지 않은 변경');
        }
    }
    const doUndo = useCallback(() => {
        if (!undo.length)
            return;
        setRedo([...redo, sceneRef.current]);
        engine.current?.cancelTransform();sceneRef.current=undo[undo.length-1];setScene(undo[undo.length - 1]);
        setUndo(undo.slice(0, -1));
        setProposal(null);
        setSaveState('저장하지 않은 변경');
    }, [undo, redo]);
    const doRedo = useCallback(() => {
        if (!redo.length)
            return;
        setUndo([...undo, sceneRef.current]);
        engine.current?.cancelTransform();sceneRef.current=redo[redo.length-1];setScene(redo[redo.length - 1]);
        setRedo(redo.slice(0, -1));
        setProposal(null);
        setSaveState('저장하지 않은 변경');
    }, [undo, redo]);
    const removeSelected = useCallback(() => {
        const ids=selectionIds(selectionRef.current).filter(id=>sceneRef.current.nodes.some(n=>n.id===id));if(!ids.length)return;
        try{if(commit(batchAction(sceneRef.current,ids,{type:'delete'}),'선택한 요소를 삭제했습니다. 실행 취소로 복원할 수 있습니다.'))setSelection(null)}catch(e){toast.error((e as Error).message)}
    }, [commit]);
    useEffect(()=>{setSelection(previous=>{const next=normalizeSelection(scene,previous);return JSON.stringify(previous)===JSON.stringify(next)?previous:next})},[scene.nodes]);
    useEffect(() => {
        request('/api/config').then(d => setAiReady(d.ai)).catch(() => { });
        request('/api/projects').then(d => setProjects(d.projects)).catch(() => { });
        let raw: string | null = null;
        try {
            raw = localStorage.getItem('spatial-recovery');
        }
        catch { }
        if (raw) {
            try {
                const draft = JSON.parse(raw);
                const data = validateScene(draft.scene);
                setScene(data);
                setProjectId(draft.id ?? null);
                setRevision(draft.revision ?? 0);
                setSavedScene(draft.savedScene ?? '');
                setSaveState('이 기기의 임시 작업 복구');
            }
            catch {
                try {
                    localStorage.removeItem('spatial-recovery');
                }
                catch { }
            }
        }
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                localStorage.setItem('spatial-recovery', JSON.stringify({ scene, id: projectId, revision, savedScene }));
            }
            catch { }
        }, 500);
        return () => clearTimeout(timer);
    }, [scene, projectId, revision, savedScene]);
    useEffect(() => {
        if (scene.photoId) {
            setPhotoUrl(`/api/photos?id=${scene.photoId}`);
            setPalette(scene.palette ?? []);
        }
        else {
            setPhotoUrl('/cafe-reference.jpg');
            setPalette(scene.palette ?? []);
        }
        setPhotoImage('');
    }, [scene.photoId]);
    useEffect(() => {
        const fn = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', fn);
        return () => window.removeEventListener('beforeunload', fn);
    }, [dirty]);
    async function save(asCopy = false) {
        if (saveInFlight.current || loadInFlight.current) {
            toast('현재 저장 또는 불러오기가 끝난 뒤 시도하세요.');
            return;
        }
        saveInFlight.current = true;
        setBusy(true);
        const snapshot = sceneRef.current, session = projectSession.current;
        try {
            const data = await request('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: asCopy ? undefined : projectId, revision: asCopy ? 0 : revision, scene: snapshot }) });
            if (session === projectSession.current) {
                setProjectId(data.id);
                setRevision(data.revision);
                setSavedScene(JSON.stringify(snapshot));
                setSaveState('클라우드 저장됨');
            }
            toast.success(`${snapshot.name} 저장 완료`);
            request('/api/projects').then(d => setProjects(d.projects)).catch(() => { });
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : '저장하지 못했습니다.');
            if (session === projectSession.current)
                setSaveState('저장 실패 · 다시 시도');
        }
        finally {
            saveInFlight.current = false;
            setBusy(false);
        }
    }
    const saveRef = useRef(save);
    saveRef.current = save;
    useEffect(() => {
        const keys = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('input,textarea,[contenteditable=true],[role=dialog]'))
                return;
            if (modal || mobileLibrary || mobileInspector)
                return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey)
                    doRedo();
                else
                    doUndo();
            }
            else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveRef.current();
            }
            else if (e.key === 'Delete' || e.key === 'Backspace')
                removeSelected();
            else if (e.key === 'Escape') {
                setSelection(null);
                setTool('select');
                setProposal(null);
            }
            else if (e.key.toLowerCase() === 'v')
                setTool('select');
            else if (e.key.toLowerCase() === 'm') {
                setFaceMode('object');setTool('translate');
            }
            else if (e.key.toLowerCase() === 'r') {
                setFaceMode('object');setTool('rotate');
            }
        };
        window.addEventListener('keydown', keys);
        return () => window.removeEventListener('keydown', keys);
    }, [doUndo, doRedo, removeSelected, modal, mobileLibrary, mobileInspector]);
    function add(kind: Kind) {
        const id = crypto.randomUUID(), n = createNode(kind, id);
        if (kind === 'pendant')
            n.y = Math.max(0, scene.room.height - n.height - 300);
        if (commit({ ...scene, nodes: [...scene.nodes, n] }, `${kindNames[kind]}를 추가했습니다.`)) {
            setSelection({ id });
            setTool('translate');
            setMobileLibrary(false);
        }
    }
    function paint(id: MaterialId) {
        try {
            if(multiple){commit(batchAction(sceneRef.current,selectedIds,{type:'material',material:id}));return;}
            commit(editAppearance(sceneRef.current, selection, { material: id }, faceMode));
        }
        catch (e) {
            toast.error((e as Error).message);
        }
    }
    function duplicate() {
        if(multiple){try{const next=batchAction(sceneRef.current,selectedIds,{type:'duplicate',x:500,z:0});const added=next.nodes.filter(n=>!sceneRef.current.nodes.some(o=>o.id===n.id));if(commit(next))setSelection({id:added[0].id,ids:added.map(n=>n.id)})}catch(e){toast.error((e as Error).message)}return;}
        if (!node)
            return;
        const copy = { ...structuredClone(node), id: crypto.randomUUID(), name: `${node.name} 사본`, x: node.x + 600, locked: false };
        if (commit({ ...scene, nodes: [...scene.nodes, copy] }))
            setSelection({ id: copy.id });
    }
    async function openProject(id: string) {
        if (loadInFlight.current)
            return;
        const session = ++projectSession.current;
        if (id === 'new') {
            const s = initialScene();
            s.name = '새 매장 프로젝트';
            s.nodes = [];
            s.room.source = 'entered';
            sceneRef.current = s;
            setScene(s);
            resetProjectView(s);
            setProjectId(null);
            setRevision(0);
            setSavedScene('');
            setUndo([]);
            setRedo([]);
            setSelection({ id: 'floor' });
            setProposal(null);
            setSaveState('새 프로젝트');
            setSavedScene(JSON.stringify(s));
            setPendingOpen(null);
            setModal('room');
            return;
        }
        loadInFlight.current = true;
        setProjectLoading(true);
        try {
            const d = await request(`/api/projects?id=${id}`), s = validateScene(d.scene);
            if (session !== projectSession.current)
                return;
            sceneRef.current = s;
            setScene(s);
            resetProjectView(s);
            setProjectId(d.id);
            setRevision(d.revision);
            setSavedScene(JSON.stringify(s));
            setUndo([]);
            setRedo([]);
            setProposal(null);
            setSelection(null);
            setSaveState('클라우드 저장됨');
            setModal(null);
            toast.success('저장한 프로젝트를 불러왔습니다.');
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            loadInFlight.current = false;
            setProjectLoading(false);
            setPendingOpen(null);
        }
    }
    async function upload(file?: File) {
        if (!file)
            return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
            toast.error('JPG·PNG·WEBP 사진을 10MB 이하로 올려 주세요.');
            return;
        }
        const session = projectSession.current;
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const d = await request('/api/photos', { method: 'POST', body: form });
            const p = await photoData(d.url);
            if (session !== projectSession.current) {
                toast('프로젝트가 바뀌어 사진을 적용하지 않았습니다.');
                return;
            }
            commit({ ...sceneRef.current, photoId: d.id, palette: p.palette }, '사진을 업로드했습니다. 색감 적용 또는 AI 분석을 선택하세요.');
            setPhotoUrl(d.url);
            setPalette(p.palette);
            setPhotoImage(p.image);
            setTab('photo');
            setModal('photo');
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setUploading(false);
            if (uploadRef.current)
                uploadRef.current.value = '';
        }
    }
    async function analyzePalette() {
        try {
            const p = await photoData(photoUrl);
            setPalette(p.palette);
            setPhotoImage(p.image);
            const commands: SceneCommand[] = [{ type: 'material', target: 'walls', material: 'plaster', color: p.palette[0] }, { type: 'material', target: 'floor', material: 'concrete', color: p.palette[1] }, { type: 'material', target: 'tables', material: 'oak', color: p.palette[2] }];
            const next = applyCommands(scene, commands);
            next.palette = p.palette;
            setProposal({ scene: next, title: '사진의 색감을 공간에', details: '사진에서 추출한 3가지 색을 벽·바닥·테이블에 적용합니다. 사진 속 구조를 복원하는 기능은 아닙니다.', source: '사진 팔레트' });
            setPreview(true);
            setModal(null);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
    }
    function preset(name: string) {
        const presets: Record<string, SceneCommand[]> = { '내추럴 우드': [{ type: 'material', target: 'walls', material: 'plaster' }, { type: 'material', target: 'floor', material: 'terrazzo' }, { type: 'material', target: 'tables', material: 'oak' }, { type: 'light', value: 4200 }], '모던 인더스트리얼': [{ type: 'material', target: 'walls', material: 'concrete' }, { type: 'material', target: 'floor', material: 'concrete' }, { type: 'material', target: 'tables', material: 'steel' }, { type: 'light', value: 5000 }], '딥 월넛': [{ type: 'material', target: 'walls', material: 'sage' }, { type: 'material', target: 'floor', material: 'terrazzo' }, { type: 'material', target: 'tables', material: 'walnut' }, { type: 'light', value: 3000 }] };
        try {
            setProposal({ scene: applyCommands(scene, presets[name]), title: name, details: '벽, 바닥, 테이블 소재와 조명 색온도를 함께 변경합니다.', source: '스타일' });
            setPreview(true);
            setMobileLibrary(false);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
    }
    async function askAI(withPhoto = false) {
        const text = withPhoto ? '참고 사진의 인테리어 색감과 소재 컨셉을 현재 3D 공간의 벽, 바닥, 테이블과 조명에 반영해 줘. 치수와 배치는 유지해 줘.' : prompt.trim();
        if (!text)
            return;
        const quick = withPhoto ? null : quickCommands(text, selection);
        if (quick) {
            try {
                setProposal({ scene: applyCommands(scene, quick), title: '빠른 명령 미리보기', details: text, source: '빠른 명령' });
                setPreview(true);
                setPrompt('');
            }
            catch (e) {
                toast.error((e as Error).message);
            }
            return;
        }
        if (!aiReady && !apiKey) {
            setModal('settings');
            return;
        }
        const sceneAtRequest = JSON.stringify(scene), session = projectSession.current;
        setAiBusy(true);
        try {
            let image = photoImage;
            if (withPhoto && !image) {
                const p = await photoData(photoUrl);
                image = p.image;
                setPhotoImage(image);
                setPalette(p.palette);
            }
            const d = await request('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, scene:{...scene,variants:undefined}, selection, apiKey: apiKey || undefined, ...(withPhoto ? { image } : {}) }) });
            if (session !== projectSession.current || sceneAtRequest !== JSON.stringify(sceneRef.current)) {
                toast('분석 중 장면이 변경되었습니다. 현재 장면에서 다시 요청하세요.');
                return;
            }
            if (!d.commands.length) {
                toast(d.summary);
                return;
            }
            setProposal({ scene: applyCommands(scene, d.commands), title: withPhoto ? '사진에서 가져온 AI 컨셉' : 'AI 편집 제안', details: d.summary, source: 'AI' });
            setPreview(true);
            setPrompt('');
            setModal(null);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setAiBusy(false);
        }
    }
    async function exportFile(type: 'png' | 'glb' | 'json') {
        if (proposal) {
            toast('제안을 적용하거나 닫은 뒤 내보내세요.');
            return;
        }
        try {
            if (type === 'json')
                download(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), `${scene.name}.spatial.json`);
            else if (!engine.current)
                throw new Error('3D 장면을 먼저 불러와 주세요.');
            else if (type === 'png')
                download(await engine.current.screenshot(), `${scene.name}.png`);
            else {
                setBusy(true);
                download(new Blob([await engine.current.exportGlb()], { type: 'model/gltf-binary' }), `${scene.name}.glb`);
            }
            toast.success(type === 'glb' ? 'GLB를 내보냈습니다. 치수 편집 기록은 프로젝트 파일에 보관됩니다.' : '파일을 내보냈습니다.');
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function importProject(file?: File) {
        if (!file)
            return;
        try {
            if (file.size > 1500000)
                throw new Error('프로젝트 파일은 1.5MB 이하만 지원합니다.');
            const data = validateScene(JSON.parse(await file.text()));
            delete data.photoId;for(const variant of data.variants??[])delete variant.design.photoId;
            projectSession.current++;
            if(!commit(data, '프로젝트 파일을 불러왔습니다. 포함된 외부 모델과 시안은 같은 계정에서 열 수 있습니다.'))return;
            resetProjectView(data);
            setProjectId(null);
            setRevision(0);
            setSavedScene('');
            setSelection(null);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            if (importRef.current)
                importRef.current.value = '';
        }
    }
    function openModel(file?: File) { if (proposal) {
        toast('제안을 적용하거나 닫은 뒤 모델을 추가하세요.');
        return;
    } assetSession.current = projectSession.current; setModelFile(file ?? null); setMobileLibrary(false); setModal('model'); }
    function openRender() { if (proposal) {
        toast('제안을 적용하거나 닫은 뒤 시안을 만드세요.');
        return;
    } setMobileLibrary(false); setModal('render'); }
    async function captureForRender() { if (!engine.current)
        throw new Error('3D 장면을 먼저 불러와 주세요.'); if (view === 'top')
        throw new Error('평면 보기에서 3D·실내·외관 보기로 바꾼 뒤 시안을 만드세요.'); const snapshot = { session: projectSession.current, scene: JSON.stringify(sceneRef.current) }; let image = ''; for (const width of [1536, 1024, 768]) {
        image = await engine.current.screenshot(width, 1.5);
        if (image.length <= 2700000)
            break;
    } if (image.length > 2700000)
        throw new Error('장면 이미지가 너무 큽니다. 모델 디테일을 줄여 주세요.'); if (snapshot.session !== projectSession.current || snapshot.scene !== JSON.stringify(sceneRef.current))
        throw new Error('장면이 변경되었습니다. 다시 캡처하세요.'); renderSnapshot.current = snapshot; return image; }
    function selectView(next:ViewMode){setRestoreCamera(null);setView(next);engine.current?.setView(next);}
    function resetProjectView(next:SceneData){engine.current?.setScene(next);selectView('perspective');setMultiSelect(false);}
    function openFacade(tab:'sign'|'awning'|'front'='sign'){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 외관을 편집하세요.');return}engine.current?.cancelTransform();setMobileLibrary(false);setMobileInspector(false);setFacadeTab(tab);setModal('facade');}
    function showCameras(){setCameraName('');setMobileLibrary(false);setMobileInspector(false);setModal('cameras');}
    function selectItem(next:Selection,additive=false){if(proposal)return;if(next?.id==='facade-sign'||next?.id==='facade-awning'){openFacade(next.id==='facade-sign'?'sign':'awning');return;}setSelection(previous=>chooseSelection(sceneRef.current,previous,next,additive||multiSelect));if(additive||multiSelect)setFaceMode('object');}
    function moveGroup(ids:string[],delta:GroupDelta,pivot:{x:number;y:number;z:number}){try{commit(transformGroup(sceneRef.current,ids,delta,pivot))}catch(e){toast.error((e as Error).message);engine.current?.setScene(sceneRef.current)}}
    function openAssemblies(save=false){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 세트를 여세요.');return}engine.current?.cancelTransform();assemblySession.current=projectSession.current;setAssemblySave(save);setMobileLibrary(false);setMobileInspector(false);setModal('assemblies');}
    function showMaterials(){setTab('materials');if(window.innerWidth<=1050)setMobileLibrary(true)}
    function openReview(which:'variants'|'plan'){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 열어 주세요.');return}setMobileInspector(false);setModal(which)}
    function applyRoom(axis: 'width' | 'depth' | 'height', value: number) { return commit({ ...scene, room: { ...scene.room, [axis]: value, source: 'entered' } }); }
    const materialGrid = <><div className="search-field"><Search size={16}/><input aria-label="소재 검색" placeholder="소재 검색" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="검색 지우기" onClick={() => setQuery('')}><X size={14}/></button>}</div><div className="filter-row">{['전체', '우드', '스톤', '메탈', '페인트', '타일', '패브릭'].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? 'selected' : ''}>{x}</button>)}</div><div className="small-heading"><span>{filter === '전체' ? '모든 소재' : filter}</span><span>{materials.filter(m => (filter === '전체' || m.group === filter) && m.name.includes(query)).length}</span></div><div className="material-grid">{materials.filter(m => (filter === '전체' || m.group === filter) && (m.name.includes(query) || m.group.includes(query))).map(m => <button className={`material-card ${selectedMaterial === m.id ? 'selected' : ''}`} key={m.id} onClick={() => paint(m.id)} aria-label={`${m.name} 소재 적용`}><span className={`swatch pattern-${m.pattern}`} style={{ backgroundColor: m.color }}>{selectedMaterial === m.id && <span className="swatch-check"><Check size={13}/></span>}</span><b>{m.name}</b><small>{m.group}</small></button>)}</div>{!materials.some(m => (filter === '전체' || m.group === filter) && (m.name.includes(query) || m.group.includes(query))) && <p className="empty-copy">검색한 소재가 없습니다.</p>}<p className="fineprint">시각화용 소재입니다. 실제 제품의 색상·규격은 제조사 샘플로 확인하세요.</p></>;
    const photoPanel = <div className="photo-panel"><button className="photo-cover" onClick={() => setModal('photo')}><img src={photoUrl} alt={scene.photoId ? '업로드한 매장 사진' : '카페 인테리어 참고 사진'}/><span><Expand size={14}/>크게 보기</span></button><p className="image-credit">{scene.photoId ? '내 매장 참고 사진' : <>예시 카페 · <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a></>}</p><button className="outline-button full" onClick={() => uploadRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>}내 매장 사진 올리기</button><button className="primary-button full start-draft-button" onClick={() => setModal('draft')}><Box size={16}/>사진으로 새 3D 초안</button><div className="section-copy"><b>이 사진의 분위기로</b><p>색감과 소재를 가져와 지금의 3D 공간에 적용하세요.</p></div>{palette.length > 0 && <div className="palette-row">{palette.map((color, i) => <span key={i} style={{ background: color }} title={color}/>)}</div>}<button className="primary-button full" onClick={() => askAI(true)} disabled={aiBusy}><Sparkles size={16}/>{aiBusy ? '사진 분석 중…' : 'AI 컨셉 적용'}</button><button className="text-button full" onClick={analyzePalette}>사진 색감만 추출하기</button><button className="outline-button full render-open-button" onClick={openRender}><Camera size={16}/>이 분위기로 AI 시안 만들기</button><p className="fineprint">AI 분석은 연결 후 사용합니다. 사진의 실제 치수와 숨겨진 구조는 직접 보정해 주세요.</p></div>;
    const libraryContent = <><div className="library-heading"><div><span className="eyebrow">YOUR DESIGN TOOLKIT</span><h2>공간 라이브러리</h2></div></div><Tabs value={tab} onValueChange={setTab} className="library-tabs"><TabsList className="library-tab-list"><TabsTrigger value="materials"><Palette size={16}/>소재</TabsTrigger><TabsTrigger value="furniture"><Sofa size={16}/>가구</TabsTrigger><TabsTrigger value="photo"><ImagePlus size={16}/>사진</TabsTrigger></TabsList><TabsContent value="materials" className="library-tab-body">{materialGrid}</TabsContent><TabsContent value="furniture" className="library-tab-body"><div className="section-copy"><b>클릭 한 번으로 배치</b><p>추가한 가구는 화면에서 이동하세요.</p></div><button className="outline-button full model-import-button" onClick={() => openModel()}><Upload size={16}/>내 3D 모델 가져오기 · GLB</button><button className="outline-button full facade-open-button" onClick={()=>openFacade()}><Store size={17}/>간판 · 어닝 · 유리 전면</button><button className="primary-button full assembly-open-button" onClick={()=>openAssemblies()}><Layers size={17}/>가구·설비 세트 불러오기</button><div className="furniture-grid">{kinds.map(kind => { const Icon = icons[kind]; return <button key={kind} onClick={() => add(kind)}><span><Icon size={29} strokeWidth={1.4}/><Plus size={13}/></span><b>{kindNames[kind]}</b></button>; })}</div><p className="fineprint">문·창문은 기본적으로 안쪽 벽에 추가됩니다. 속성에서 연결할 벽을 바꿀 수 있습니다.</p></TabsContent><TabsContent value="photo" className="library-tab-body">{photoPanel}</TabsContent></Tabs><div className="library-bottom"><div className="small-heading"><span><Sparkles size={14}/>빠른 스타일</span><span>3</span></div>{[['내추럴 우드', '#c7a477', '#e9e5dc', '#d0c8b9'], ['모던 인더스트리얼', '#bfc5ca', '#b4b5b0', '#353a3d'], ['딥 월넛', '#77513d', '#777e61', '#d0c8b9']].map(([name, ...colors]) => <button className="style-row" key={name} onClick={() => preset(name)}><span className="style-dots">{colors.map(c => <i key={c} style={{ background: c }}/>)}</span><span>{name}</span><ChevronRight size={14}/></button>)}</div></>;
    const inspectorContent = <>{multiple?<BatchInspector scene={scene} selection={selection} onCommit={commit} onSelection={setSelection} onMaterials={showMaterials} onSaveSet={()=>openAssemblies(true)}/>:<><div className="inspector-title"><span className="eyebrow">PROPERTIES</span><h2>{currentName}</h2><span className="selection-label">{node ? kindNames[node.kind] : surface ? '공간 표면' : '선택한 요소 없음'}{selection?.face && faceMode === 'face' ? ' · 선택한 면' : ''}</span>{node?.estimated && <span className="estimate-label">초안 치수 · 현장 확인 필요</span>}</div>{selection && <><div className="property-section"><div className="small-heading"><span>선택 범위</span></div><Tabs value={faceMode} onValueChange={v => {
                setFaceMode(v as 'face' | 'object');
                if (v === 'object' && selection)
                    setSelection({ id: selection.id });
            }}><TabsList className="full"><TabsTrigger value="face">선택한 면</TabsTrigger><TabsTrigger value="object">요소 전체</TabsTrigger></TabsList></Tabs>{material && <button className="current-material" onClick={() => {
                    setTab('materials');
                    if (window.innerWidth <= 1050)
                        setMobileLibrary(true);
                }}><span className={`swatch pattern-${material.pattern}`} style={{ backgroundColor: material.color }}/><div><small>현재 소재</small><b>{material.name}</b></div><ChevronRight size={17}/></button>}{originalMaterial && <button className="current-material native-material" onClick={() => { setTab('materials'); if (window.innerWidth <= 1050)
            setMobileLibrary(true); }}><Box size={22}/><div><small>현재 소재</small><b>모델 원본 소재</b><small>소재를 선택하면 교체됩니다</small></div><ChevronRight size={17}/></button>}{node?.kind === 'model' && <button className="text-button full" disabled={node.locked} onClick={() => updateNode(node.id, { uniformMaterial: false, faces: {}, faceFinishes: {}, finish: {}, color: undefined })}>모델 전체 원본 소재 복원</button>}{appearance && <MaterialDetail key={`${projectSession.current}:${selection?.id}:${faceMode}:${selection?.face??''}`} original={originalMaterial} model={node?.kind==='model'} material={appearance.material} finish={appearance.finish} disabled={node?.locked} onChange={finish => {
                    try {
                        commit(editAppearance(sceneRef.current, selection, { finish }, faceMode));
                    }
                    catch (e) {
                        toast.error((e as Error).message);
                    }
                }}/>}</div>{node && <><div className="property-section"><div className="small-heading"><span>크기</span><span>mm</span></div><div className="dimensions-grid">{(['width', 'height', 'depth'] as const).map((axis, i) => <NumberField key={axis} label={['가로', node.kind === 'box' || node.kind === 'cylinder' ? '돌출 높이' : '높이', '깊이'][i]} min={20} value={node[axis]} onCommit={v => updateNode(node.id, { [axis]: v })}/>)}</div>{mode === 'precise' && <><div className="small-heading spaced"><span>위치 & 회전</span></div><div className="dimensions-grid">{(['x', 'y', 'z'] as const).filter(axis => !node.host || axis === 'y' || (['back', 'front'].includes(node.host) ? axis === 'x' : axis === 'z')).map(axis => <NumberField key={axis} label={axis.toUpperCase()} value={node[axis]} min={axis === 'y' ? 0 : -20000} onCommit={v => updateNode(node.id, { [axis]: v })}/>)}</div>{!node.host && <NumberField label="회전" value={node.rotation} unit="°" min={-360} max={360} onCommit={v => updateNode(node.id, { rotation: v })}/>}</>}{node.host && <div className="spaced"><label className="field-label">연결된 벽</label><Select value={node.host} onValueChange={v => { const along = ['back', 'front'].includes(node.host!) ? node.x : node.z; updateNode(node.id, { host: v as SceneNode['host'], x: ['back', 'front'].includes(v) ? along : 0, z: ['left', 'right'].includes(v) ? along : 0, rotation: 0 }); }}><SelectTrigger className="full"><SelectValue /></SelectTrigger><SelectContent>{['back', 'left', 'right', 'front'].map(x => <SelectItem key={x} value={x}>{surfaceNames[x]}</SelectItem>)}</SelectContent></Select></div>}<button className="outline-button full arrange-button" onClick={() => setModal('placement')}><Grid2X2 size={15}/>배열·정렬·겹침 확인</button><button className="outline-button full assembly-save-button" disabled={!!node.host||node.hidden} onClick={()=>openAssemblies(true)}><Layers size={15}/>선택 가구를 세트로 저장</button><div className="object-actions"><button onClick={duplicate}><Copy size={15}/>복제</button><button onClick={() => updateNode(node.id, { locked: !node.locked })}>{node.locked ? <Unlock size={15}/> : <Lock size={15}/>} {node.locked ? '해제' : '잠금'}</button><button onClick={removeSelected}><Trash2 size={15}/>삭제</button></div></div></>}</>}
 </>}<div className="property-section"><div className="small-heading"><span><Sun size={15}/>조명</span><span>{scene.lighting.warmth.toLocaleString()} K</span></div><Slider aria-label="조명 색온도" value={[scene.lighting.warmth]} min={2700} max={6500} step={100} onValueChange={v => previewLighting('warmth', v[0])} onValueCommit={commitLighting}/><div className="range-labels"><span>따뜻하게</span><span>시원하게</span></div><div className="small-heading spaced"><span>밝기</span><span>{Math.round(scene.lighting.intensity * 100)}%</span></div><Slider aria-label="조명 밝기" value={[scene.lighting.intensity]} min={.2} max={2} step={.1} onValueChange={v => previewLighting('intensity', v[0])} onValueCommit={commitLighting}/></div>
 <div className="property-section"><div className="small-heading"><span>장면 요소</span><span>{scene.nodes.length + 5}</span></div><div className="scene-tree">{Object.entries(surfaceNames).map(([id, name]) => <button className={selection?.id === id ? 'selected' : ''} key={id} onClick={() => setSelection({ id })}><Square size={14}/><span>{name}</span></button>)}{scene.nodes.map(n => { const Icon = icons[n.kind]; return <div className={`tree-object ${selectedIds.includes(n.id) ? 'selected' : ''}`} key={n.id}><>{multiSelect&&<Checkbox className="tree-checkbox" checked={selectedIds.includes(n.id)} aria-label={`${n.name} 선택`} onCheckedChange={()=>selectItem({id:n.id},true)}/>}<button className="tree-label" onClick={e => selectItem({ id: n.id },e.shiftKey)}><Icon size={14}/><span>{n.name}</span>{n.locked && <Lock size={12}/>}</button><button aria-label={`${n.name} ${n.hidden ? '표시' : '숨기기'}`} onClick={() => updateNode(n.id, { hidden: !n.hidden })}>{n.hidden ? <EyeOff size={13}/> : <Eye size={13}/>}</button></></div>; })}</div></div><button className="text-button full" onClick={() => setModal('placement')}>가구 겹침 확인{conflicts.length ? ` · ${conflicts.length}곳` : ``}</button><button className="outline-button full room-settings" onClick={() => setModal('room')}><Ruler size={15}/>공간 치수 설정</button></>;
    return <TooltipProvider delayDuration={350}><Toaster position="bottom-right" richColors closeButton/><main className="studio" onDragOver={e => {
            if (e.dataTransfer.types.includes('Files'))
                e.preventDefault();
        }} onDrop={e => {
            if (!e.dataTransfer.files.length)
                return;
            e.preventDefault();
            if (!modal && !loadInFlight.current)
                (e.dataTransfer.files[0].name.toLowerCase().endsWith('.glb') ? openModel(e.dataTransfer.files[0]) : upload(e.dataTransfer.files[0]));
        }}><header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="SPATIAL 스튜디오"><span className="brand-mark"><Box size={23} strokeWidth={1.5}/></span><span>SPATIAL<small>INTERIOR STUDIO</small></span></a><div className="project-title"><span className="project-divider"/><button onClick={() => setModal('projects')}>{scene.name}<ChevronDown size={15}/></button><span className="project-tag">3D 프로젝트</span></div><div className="header-actions"><span className="save-status"><Cloud size={14}/>{dirty && savedScene ? '저장하지 않은 변경' : saveState}</span><IconButton label="프로젝트 열기" onClick={() => setModal('projects')}><FolderOpen size={18}/></IconButton><IconButton label="AI 연결 설정" onClick={() => setModal('settings')}><Settings2 size={18}/></IconButton><button className="outline-button save-button" onClick={() => save()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>}저장</button><DropdownMenu><DropdownMenuTrigger asChild><button className="primary-button export-button"><Download size={16}/><span>내보내기</span><ChevronDown size={13}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>openReview('plan')}><Grid2X2 size={16}/>치수 평면도 · PDF / SVG</DropdownMenuItem><DropdownMenuItem onClick={()=>openFacade()}><Store size={16}/>매장 외관 편집</DropdownMenuItem><DropdownMenuItem onClick={showCameras}><Camera size={16}/>저장한 시점</DropdownMenuItem><DropdownMenuItem onClick={()=>openReview('variants')}><Copy size={16}/>디자인 안 저장·비교</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={openRender}><Sparkles size={16}/>AI 컨셉 이미지 만들기</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('png')}><Camera size={16}/>현재 시점 이미지 · 2K PNG</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('glb')}><Box size={16}/>3D 모델 · GLB</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('json')}><FileJson size={16}/>편집용 프로젝트 · JSON</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={()=>openAssemblies()}><Layers size={16}/>가구·설비 세트 보관함</DropdownMenuItem><DropdownMenuItem onClick={() => openModel()}><Box size={16}/>GLB 모델 가져오기</DropdownMenuItem><DropdownMenuItem onClick={() => importRef.current?.click()}><Upload size={16}/>프로젝트 파일 불러오기</DropdownMenuItem><DropdownMenuItem onClick={() => save(true)}><Copy size={16}/>새 사본으로 저장</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
 <div className="workspace"><SidebarProvider className="studio-sidebar-provider"><Sidebar collapsible="none" className="library"><SidebarContent>{libraryContent}</SidebarContent></Sidebar></SidebarProvider><section className="editor-surface"><div className="editor-bar"><div className="mode-controls"><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="easy">간편 편집</TabsTrigger><TabsTrigger value="precise"><Ruler size={14}/>정밀 편집</TabsTrigger></TabsList></Tabs></div><span className="editor-bar-spacer"/><IconButton label="여러 가구 선택 · Shift 클릭" active={multiSelect} onClick={()=>{setMultiSelect(!multiSelect);setFaceMode('object')}}><Layers size={17}/></IconButton><IconButton label="간판·어닝·유리 외관 편집" onClick={()=>openFacade()}><Store size={17}/></IconButton><IconButton label="디자인 안 저장·비교" onClick={()=>openReview('variants')}><Copy size={17}/></IconButton><button className="outline-button render-toolbar-button" onClick={openRender}><Sparkles size={15}/>AI 시안</button><IconButton label="실행 취소 · Ctrl Z" onClick={doUndo} disabled={!undo.length}><Undo2 size={17}/></IconButton><IconButton label="다시 실행 · Ctrl Shift Z" onClick={doRedo} disabled={!redo.length}><Redo2 size={17}/></IconButton><span className="toolbar-divider"/><IconButton label="사용 방법" onClick={() => setHelp(true)}><Info size={17}/></IconButton></div><div className="viewport"><SceneCanvas scene={proposal && preview ? proposal.scene : scene} selection={proposal ? null : selection} tool={proposal ? 'select' : tool} view={view} faceMode={faceMode} snap={snap} cutaway={cutaway} onSelect={selectItem} multiSelect={multiSelect} onTransformGroup={moveGroup} onTransform={updateNode} onDraw={p => {
            const id = crypto.randomUUID();
            if (commit({ ...sceneRef.current, nodes: [...sceneRef.current.nodes, { ...createNode('box', id), ...p, height: 100 }] })) {
                setSelection({ id });
                setTool('select');
                toast.success('사각형을 만들었습니다. 속성의 높이로 돌출하세요.');
            }
        }} restoreCamera={restoreCamera} onReady={useCallback(e => { engine.current = e; }, [])}/><div className="viewport-top"><div className="scene-caption"><span className="eyebrow">WORKSPACE / 01</span><h1>생각한 공간을, 눈앞에.</h1>{scene.draft && <button className="draft-badge" onClick={() => setModal('draft-notes')}>{scene.draft.method === 'photo-ai' ? '사진 기반 추정 초안' : '배치 템플릿 초안'}<Info size={12}/></button>}<span>{(scene.room.width * scene.room.depth / 1000000).toFixed(1)} m²<span className="dot-separator">·</span>{(scene.room.width * scene.room.depth / 3305800).toFixed(1)}평<span className="dot-separator">·</span>{scene.room.source === 'example' ? '예시 치수' : scene.room.source === 'measured' ? '실측 입력' : '사용자 입력'}</span></div><button className="photo-pill" onClick={() => { setTab('photo'); setModal('photo'); }}><img src={photoUrl} alt=""/><span>{scene.photoId ? '내 매장 사진' : '사진에서 시작하기'}<small>컨셉을 3D 공간으로</small></span><ChevronRight size={15}/></button></div><div className="floating-tools"><IconButton label="선택 · V" active={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={18}/></IconButton><IconButton label="이동 · M" active={tool === 'translate'} onClick={() => { setTool('translate'); setFaceMode('object'); }}><Move size={18}/></IconButton><IconButton label="회전 · R" active={tool === 'rotate'} onClick={() => { setTool('rotate'); setFaceMode('object'); }}><RotateCw size={18}/></IconButton><span /><IconButton label="가구 또는 형태 추가" onClick={() => {
            setTab('furniture');
            if (window.innerWidth <= 1050)
                setMobileLibrary(true);
        }}><Plus size={19}/></IconButton>{mode === 'precise' && <><IconButton label="사각형 그리기 · 두 모서리 클릭" active={tool === 'draw'} onClick={() => { setTool('draw'); selectView('top'); toast('바닥 위에 사각형의 대각선 두 모서리를 차례로 클릭하세요.'); }}><Square size={18}/></IconButton><IconButton label="파티션 만들기" onClick={() => add('partition')}><PanelTop size={18}/></IconButton></>}</div><>{(multiple||multiSelect)&&<div className="multi-selection-pill"><Layers size={15}/><span>{selectedIds.length}개 선택</span><button onClick={()=>{setSelection(null);setMultiSelect(false)}}>선택 해제</button></div>}</><div className="view-controls"><Tabs value={view} onValueChange={v => selectView(v as ViewMode)}><TabsList><TabsTrigger value="perspective"><Box size={14}/>3D</TabsTrigger><TabsTrigger value="top"><Grid2X2 size={14}/>평면</TabsTrigger><TabsTrigger value="interior"><Eye size={14}/>실내</TabsTrigger><TabsTrigger value="front"><Store size={14}/>외관</TabsTrigger></TabsList></Tabs></div><div className="zoom-controls"><IconButton label="확대" onClick={() => engine.current?.zoom(.85)}><Plus size={17}/></IconButton><IconButton label="축소" onClick={() => engine.current?.zoom(1.18)}><Minus size={17}/></IconButton><IconButton label="전체 공간 보기" onClick={() => selectView('perspective')}><Maximize size={17}/></IconButton></div><div className="viewport-bottom"><span><MousePointer2 size={13}/>드래그로 회전<span className="dot-separator">·</span>스크롤로 확대</span><button onClick={showCameras}><Camera size={14}/>시점 저장</button></div>{proposal && <div className="proposal-card"><div className="proposal-head"><span><Sparkles size={16}/>{proposal.source} 미리보기</span><button aria-label="제안 닫기" onClick={() => setProposal(null)}><X size={16}/></button></div><b>{proposal.title}</b><p>{proposal.details}</p><div className="proposal-actions"><button className="outline-button" onClick={() => setPreview(!preview)}>{preview ? '변경 전 보기' : '제안 보기'}</button><button className="primary-button" onClick={() => {
                if(proposal.baseScene&&proposal.baseScene!==JSON.stringify(sceneRef.current)){setProposal(null);toast.error('미리보기 중 장면이 변경되었습니다. 세트를 다시 배치해 주세요.');return;}
                if(!commit(proposal.scene,'변경을 적용했습니다. 실행 취소로 되돌릴 수 있습니다.'))return;
                if(proposal.addedIds?.length){setSelection({id:proposal.addedIds[0],ids:proposal.addedIds});setFaceMode('object');setTool('translate');setMultiSelect(proposal.addedIds.length>1);}
                if (proposal.newProject) {
                    projectSession.current++;
                    setProjectId(null);
                    setRevision(0);
                    setSavedScene('');
                    setSelection(null);
                    resetProjectView(proposal.scene);
                }
            }}><Check size={15}/>이대로 적용</button></div></div>}</div>
 <div className="ai-composer"><div className="composer-heading"><span><Sparkles size={15}/>AI 디자인 어시스턴트</span><button onClick={() => setModal('settings')} className={aiReady || apiKey ? 'connected' : ''}>{aiReady ? 'AI 연결됨' : apiKey ? 'AI 키 입력됨' : 'AI 연결 설정'}<ChevronRight size={12}/></button></div><form onSubmit={e => { e.preventDefault(); askAI(); }}><input aria-label="AI 공간 편집 요청" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="원하는 공간을 말해보세요. 예: 벽을 웜 화이트로 바꿔줘" maxLength={2000}/><button className="send-button" aria-label="편집 제안 받기" disabled={!prompt.trim() || aiBusy}>{aiBusy ? <LoaderCircle className="spin" size={18}/> : <ArrowUp size={18}/>}</button></form><div className="prompt-examples">{['벽을 웜 화이트로', '테이블 3개 추가', '조명을 따뜻하게'].map(x => <button key={x} onClick={() => setPrompt(x)}>{x}<Plus size={11}/></button>)}<span>기본 명령은 바로 사용 가능</span></div></div></section><aside className="inspector">{inspectorContent}</aside></div><footer className="statusbar"><div><span className="status-square"/>3D 편집 공간<span className="status-separator">/</span><span>{selection ? currentName : '요소를 선택하세요'}</span></div><div><label><Switch checked={cutaway} disabled={view==='front'} onCheckedChange={setCutaway} aria-label="앞쪽 벽 단면 보기"/>{view==='front'?'외관 전체 표시':'단면 보기'}</label><label><Switch checked={snap} onCheckedChange={setSnap} aria-label="50밀리미터 격자 스냅"/>50mm 스냅</label><button onClick={() => setHelp(true)}><Keyboard size={13}/>단축키</button><span className="unit-status">단위: mm</span></div></footer><nav className="mobile-toolbar"><button onClick={() => setMobileLibrary(true)}><Layers size={19}/>라이브러리</button><button onClick={() => setMobileInspector(true)}><SlidersHorizontal size={19}/>속성</button><button onClick={() => uploadRef.current?.click()}><ImagePlus size={19}/>사진</button><button onClick={() => setModal('room')}><Ruler size={19}/>공간</button></nav></main>
 <input ref={uploadRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => upload(e.target.files?.[0])}/><input ref={importRef} type="file" className="hidden" accept=".json" onChange={e => importProject(e.target.files?.[0])}/>
 <Sheet open={mobileLibrary} onOpenChange={setMobileLibrary}><SheetContent side="left" className="mobile-sheet"><SheetHeader><SheetTitle>공간 라이브러리</SheetTitle><SheetDescription>소재와 가구를 선택하세요.</SheetDescription></SheetHeader>{libraryContent}</SheetContent></Sheet><Sheet open={mobileInspector} onOpenChange={setMobileInspector}><SheetContent className="mobile-sheet"><SheetHeader><SheetTitle>선택한 요소 편집</SheetTitle><SheetDescription>크기와 소재를 조정하세요.</SheetDescription></SheetHeader>{inspectorContent}</SheetContent></Sheet>
 <PhotoDraftDialog key={`${projectId ?? 'new'}:${scene.photoId ?? 'example'}`} open={modal === 'draft'} onClose={() => setModal(null)} scene={scene} photoUrl={photoUrl} apiKey={apiKey} aiReady={aiReady} onConnect={() => { setNextModal('draft'); setModal('settings'); }} onReady={draft => { setProposal({ scene: draft, title: draft.draft?.summary ?? '새 3D 초안', details: draft.draft?.notes.slice(0, 3).join(' ') ?? '', source: '3D 초안', newProject: true }); setPreview(true); setMobileLibrary(false); }}/>
 <DesignVariantsDialog open={modal==='variants'} onClose={()=>setModal(null)} scene={scene} onCommit={commit} onPreview={id=>{const v=scene.variants?.find(v=>v.id===id);if(!v)return;setProposal({scene:restoreVariant(scene,id),title:v.name,details:v.note||'저장한 배치·소재·조명을 현재 공간과 비교하세요.',source:'디자인 안'});setPreview(true)}}/>
 {modal==='facade'&&<FacadeDialog scene={scene} initialTab={facadeTab} onClose={()=>setModal(null)} onPreview={(candidate,summary)=>{setProposal({scene:candidate,title:'매장 외관 제안',details:summary,source:'외관'});setPreview(true);setSelection(null);setTool('select');engine.current?.setScene(candidate);selectView('front');setModal(null)}}/>}
 {modal==='assemblies'&&<AssembliesDialog key={projectSession.current} scene={scene} ids={selectedIds.filter(id=>scene.nodes.some(n=>n.id===id))} initialSave={assemblySave} onClose={()=>setModal(null)} onPreview={(candidate,ids,name,details,base)=>{if(assemblySession.current!==projectSession.current||base!==JSON.stringify(sceneRef.current)){toast.error('장면이 변경되었습니다. 세트 보관함을 다시 열어 주세요.');setModal(null);return;}setProposal({scene:candidate,title:name,details,source:'가구 세트',baseScene:base,addedIds:ids});setPreview(true);setModal(null);setTool('select');if(view==='front')selectView('perspective');}}/>}
 <FloorPlanDialog open={modal==='plan'} onClose={()=>setModal(null)} scene={scene}/>
 <ModelImportDialog open={modal === 'model'} onClose={() => setModal(null)} initialFile={modelFile} scene={scene} onAdd={n => { if (assetSession.current !== projectSession.current) {
        toast('프로젝트가 바뀌었습니다. 현재 공간에서 모델을 다시 추가하세요.');
        return false;
    } if (commit({ ...sceneRef.current, nodes: [...sceneRef.current.nodes, n] }, '3D 모델을 추가했습니다. 크기와 소재를 편집하세요.')) {
        setSelection({ id: n.id });
        setFaceMode('object');
        setTool('translate');
        return true;
    } return false; }}/>
 <RenderDialog open={modal === 'render'} onClose={() => setModal(null)} scene={scene} view={view==='front'?'exterior':'interior'} photoUrl={photoUrl} apiKey={apiKey} aiReady={aiReady} onConnect={() => { setNextModal('render'); setModal('settings'); }} capture={captureForRender} onResult={r => { if (renderSnapshot.current.session !== projectSession.current || renderSnapshot.current.scene !== JSON.stringify(sceneRef.current)) {
        toast('생성한 이미지는 시안 보관함에 저장했습니다.');
        return;
    } commit({ ...sceneRef.current, renders: [...(sceneRef.current.renders ?? []).slice(-19), r] }, 'AI 시안을 보관했습니다. 프로젝트를 저장하면 함께 연결됩니다.'); }}/>
 <PlacementDialog open={modal === 'placement'} onClose={() => setModal(null)} scene={scene} selection={selection} onCommit={commit} onSelect={setSelection}/>
 <Dialog open={modal === 'photo'} onOpenChange={o => !o && setModal(null)}><DialogContent className="photo-dialog"><DialogHeader><DialogTitle>사진에서 시작하는 공간</DialogTitle><DialogDescription>실제 매장 사진의 분위기를 3D 공간에 반영해 보세요.</DialogDescription></DialogHeader><img className="dialog-photo" src={photoUrl} alt="매장 참고 사진"/><div className="photo-dialog-actions"><button className="primary-button" onClick={() => setModal('draft')}><Box size={16}/>새 3D 초안 만들기</button><button className="outline-button" onClick={() => uploadRef.current?.click()} disabled={uploading}><Upload size={16}/>{uploading ? '업로드 중…' : '내 사진 올리기'}</button><button className="outline-button" onClick={analyzePalette}><Palette size={16}/>사진 색감 적용</button><button className="primary-button" onClick={() => askAI(true)} disabled={aiBusy}><Sparkles size={16}/>{aiBusy ? '분석 중…' : 'AI 컨셉 적용'}</button></div><p className="fineprint">{scene.photoId ? '내 매장 사진' : '예시 카페 · Unsplash'} · 사진은 디자인 참고로 사용됩니다. 실제 공간은 치수를 입력해 보정할 수 있습니다.</p></DialogContent></Dialog>
 <Dialog open={modal === 'room'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>공간 치수</DialogTitle><DialogDescription>실제 매장의 치수를 입력하면 3D 공간에 반영됩니다.</DialogDescription></DialogHeader><label className="field-label">프로젝트 이름<input className="text-input" value={nameDraft} maxLength={100} onChange={e => setNameDraft(e.target.value)} onBlur={() => {
            const name = nameDraft.trim();
            if (name)
                commit({ ...sceneRef.current, name });
            else
                setNameDraft(sceneRef.current.name);
        }} onKeyDown={e => {
            if (e.key === 'Enter')
                e.currentTarget.blur();
        }}/></label><div className="dimensions-grid"><NumberField label="가로 폭" min={2400} max={20000} value={scene.room.width} onCommit={n => applyRoom('width', n)}/><NumberField label="세로 깊이" min={2400} max={20000} value={scene.room.depth} onCommit={n => applyRoom('depth', n)}/><NumberField label="천장 높이" min={2200} max={6000} value={scene.room.height} onCommit={n => applyRoom('height', n)}/></div><div className="room-area"><Ruler /><span>{(scene.room.width * scene.room.depth / 1000000).toFixed(1)} m² <small>약 {(scene.room.width * scene.room.depth / 3305800).toFixed(1)}평</small></span></div><label className="switch-row"><span>현장에서 측정한 치수입니다</span><Switch checked={scene.room.source === 'measured'} onCheckedChange={v => commit({ ...scene, room: { ...scene.room, source: v ? 'measured' : 'entered' } })}/></label><p className="fineprint">가구나 문·창문이 공간 밖으로 나가는 치수는 적용되지 않습니다. 먼저 해당 요소를 이동하거나 크기를 줄여 주세요.</p><button className="primary-button full" onClick={() => setModal(null)}>완료</button></DialogContent></Dialog>
 <Dialog open={modal === 'settings'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>AI 디자인 연결</DialogTitle><DialogDescription>사진 분석·AI 시안·문장 편집에 OpenAI를 사용합니다.</DialogDescription></DialogHeader><div className="connection-status"><Link2 size={20}/><div><b>{aiReady ? '서버 AI 연결 사용 가능' : apiKey ? '이 세션에 키가 입력됨' : 'AI 서비스 연결 전'}</b><p>소재 편집·가구 배치·빠른 명령은 연결 없이 사용할 수 있습니다.</p></div></div>{!aiReady && <><label className="field-label">OpenAI API 키<input className="text-input" type="password" autoComplete="off" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="sk-…"/></label><p className="fineprint">키는 현재 페이지의 메모리에서만 사용되며 저장하지 않습니다. AI 요청 시 장면 정보와 선택한 사진이 OpenAI로 전송되고 API 사용료가 발생합니다.</p><button className="primary-button full" disabled={!keyDraft.trim()} onClick={() => { setApiKey(keyDraft.trim()); setKeyDraft(''); setModal(nextModal); setNextModal(null); toast('키를 입력했습니다. 첫 AI 요청에서 연결을 확인합니다.'); }}>현재 세션에 연결</button>{apiKey && <button className="text-button full" onClick={() => { setApiKey(''); toast('세션의 키를 지웠습니다.'); }}>연결 해제</button>}</>}</DialogContent></Dialog>
 <Dialog open={modal === 'projects'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>나의 프로젝트</DialogTitle><DialogDescription>저장한 공간을 이어서 편집하세요.</DialogDescription></DialogHeader><button className="primary-button full" onClick={() => {
            if (dirty)
                setPendingOpen('new');
            else
                openProject('new');
        }}><Plus size={16}/>새 공간 만들기</button><div className="project-list">{projects.length ? projects.map(p => <button key={p.id} disabled={projectLoading} onClick={() => {
                if (dirty)
                    setPendingOpen(p.id);
                else
                    openProject(p.id);
            }}><span className="project-icon"><Box size={20}/></span><span><b>{p.name}</b><small>{new Date(p.updated_at).toLocaleDateString('ko-KR')} · 버전 {p.revision}</small></span><ChevronRight size={16}/></button>) : <div className="empty-state"><FolderOpen /><b>첫 공간을 저장해 보세요</b><p>상단의 저장 버튼으로 프로젝트를 보관할 수 있습니다.</p></div>}</div>{pendingOpen && <div className="inline-confirm"><b>현재 작업에 저장하지 않은 변경이 있습니다.</b><p>프로젝트를 열면 현재 장면이 교체됩니다.</p><button className="outline-button" onClick={() => setPendingOpen(null)}>계속 편집</button><button className="primary-button" onClick={() => openProject(pendingOpen)}>저장 없이 열기</button></div>}<button className="outline-button full" onClick={() => { setModal(null); save(true); }}><Copy size={16}/>현재 작업을 새 사본으로 저장</button></DialogContent></Dialog>
 <Dialog open={modal === 'cameras'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>저장한 시점</DialogTitle><DialogDescription>같은 시점에서 소재와 배치를 비교해 보세요.</DialogDescription></DialogHeader>{scene.cameras.map(c => <div className="camera-row" key={c.id}><button className="outline-button" onClick={() => { setView(c.view ?? 'perspective'); setRestoreCamera({ ...c }); setModal(null); }}><Camera size={15}/>{c.name}</button><IconButton label={`${c.name} 삭제`} disabled={!!proposal} onClick={() => commit({ ...scene, cameras: scene.cameras.filter(x => x.id !== c.id) })}><Trash2 size={15}/></IconButton></div>)}{!scene.cameras.length && <p className="empty-copy">아직 저장한 시점이 없습니다.</p>}<label className="field-label camera-name-field">시점 이름<input className="text-input" value={cameraName} maxLength={80} onChange={e=>setCameraName(e.target.value)} placeholder={view==='front'?'예: 정면 간판 검토':'예: 입구에서 본 실내'}/></label>{proposal&&<p className="fineprint">비교 중에는 저장된 시점으로 이동할 수 있습니다. 새 시점 저장과 삭제는 제안 적용 후 가능합니다.</p>}<button className="primary-button full" disabled={scene.cameras.length >= 10||!!proposal} onClick={() => {
            const c = engine.current?.captureCamera();
            if (c)
                commit({ ...scene, cameras: [...scene.cameras, { id: crypto.randomUUID(), name: cameraName.trim()||`${view==='front'?'외관':view==='top'?'평면':view==='interior'?'실내':'3D'} 시점 ${scene.cameras.length + 1}`, ...c }] }, '현재 시점을 저장했습니다.');
        }}><Plus size={16}/>현재 시점 저장</button></DialogContent></Dialog>
 <Dialog open={modal === 'draft-notes'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>이 공간을 만든 기준</DialogTitle><DialogDescription>{scene.draft?.summary}</DialogDescription></DialogHeader><ul className="draft-notes">{scene.draft?.notes.map((note, i) => <li key={i}>{note}</li>)}</ul><p className="fineprint">기본 배치와 사진 분석은 설계 초안입니다. 가구의 추정 치수는 속성에서 보정할 수 있습니다.</p></DialogContent></Dialog>
 <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogHeader><DialogTitle>공간을 편집하는 방법</DialogTitle><DialogDescription>클릭으로 시작하고, 치수로 완성하세요.</DialogDescription></DialogHeader><div className="help-steps"><p><b>01 · 선택 & 소재</b>3D 공간의 벽·바닥·가구를 클릭한 뒤 소재를 고르세요. Shift 클릭 또는 여러 가구 선택 버튼으로 함께 편집할 수 있습니다.</p><p><b>02 · 이동 & 크기</b>이동 도구의 축을 드래그하거나 정밀 편집에서 mm 치수를 입력하세요.</p><p><b>03 · 사진 & AI</b>사진을 올려 색감을 가져오세요. AI 연결 후 소재 컨셉도 제안받을 수 있습니다.</p><p><b>04 · 외관 & 시점</b>외관 편집에서 간판·어닝·유리 전면을 구성하세요. 3D의 간판·어닝을 클릭하면 설정이 열립니다. 외관 시점에서는 전면을 모두 표시합니다.</p><p><b>05 · 저장 & 내보내기</b>디자인 안으로 배치를 비교하고, 치수 평면도와 가구 목록을 내려받으세요. 저장 버튼으로 작업을 보관하고, PNG·GLB·프로젝트 파일로 내보내세요. AI 시안은 원본 장면과 비교한 뒤 JPG로 내려받을 수 있습니다.</p></div><div className="shortcut-grid"><span>선택 <kbd>V</kbd></span><span>이동 <kbd>M</kbd></span><span>회전 <kbd>R</kbd></span><span>실행 취소 <kbd>Ctrl Z</kbd></span></div><p className="fineprint">현재 버전은 사각형 스케치·돌출 높이·원기둥·파티션과 치수 편집을 지원합니다. 외부 정적 GLB 모델의 배치·치수·소재를 편집할 수 있습니다. SKP·MAX 직접 편집과 범용 메시 모델링은 지원하지 않습니다. 평면 보기는 정사영으로 표시합니다. 초안은 시공 도면이 아니며 현장 확인이 필요합니다.</p></DialogContent></Dialog>
 </TooltipProvider>;
}
