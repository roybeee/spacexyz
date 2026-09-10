'use client';
import {randomId} from '@/lib/random-id';
import {renderSceneIdentity} from '@/lib/render-scene-identity';
import {Pencil,Footprints,Calculator,Scissors} from 'lucide-react';
import WalkthroughDialog from './walkthrough-dialog';
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
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
import SectionPanel from './section-panel';
import UnderlayDialog from './underlay-dialog';
import WallDrawingDialog from './wall-drawing-dialog';
import PartitionOpeningsDialog from './partition-openings-dialog';
import DoorMotionDialog from './door-motion-dialog';
import QuickStartGuide from './quick-start-guide';
import CommandPalette, {type StudioCommand} from './command-palette';
import SceneSearchDialog from './scene-search-dialog';
import {defaultSnapSettings,normalizeSnapping} from '@/lib/snap-settings';
import MaterialTransferControls from './material-transfer-controls';
import MaterialPresetsDialog from './material-presets-dialog';
import {sampleMaterial,pasteMaterial,type MaterialSample} from '@/lib/material-transfer';
import {acceptPartitionOpenings,type PartitionOpeningPlan} from '@/lib/partition-openings';
import type {PartitionOpening} from '@/lib/partition-openings-schema';
import {acceptWallPlan,type WallPlan,type WallDrawingRequest} from '@/lib/wall-drawing';
import {acceptUnderlay,setUnderlay} from '@/lib/underlay';
import type {PlanUnderlay} from '@/lib/underlay-schema';
import {sectionDescription,type SectionView} from '@/lib/section-view';
import MaterialBoardDialog from './material-board-dialog';
import {acceptMaterialPlan,type MaterialPlan} from '@/lib/material-board';
import type {MaterialSlot} from '@/lib/material-catalog';
import PhotoDraftDialog from './photo-draft-dialog';
import PlacementDialog from './placement-dialog';
import MeasurementsDialog from './measurements-dialog';
import {addMeasurement,editMeasurement,measurementsCsv,type MeasurementAnchor} from '@/lib/measurements';
import {acceptPlacementPlan,type PlacementPlan} from '@/lib/placement';
import ModelImportDialog from './model-import-dialog';
import RenderDialog from './render-dialog';
import BatchInspector from './batch-inspector';
import DesignVariantsDialog from './design-variants-dialog';
import FloorPlanDialog from './floor-plan-dialog';
import BudgetDialog from './budget-dialog';
import FacadeDialog from './facade-dialog';
import AssembliesDialog from './assemblies-dialog';
import {Checkbox} from '@/components/ui/checkbox';
import GroupControls from './group-controls';
import LayerControls from './layer-controls';
import LayersDialog from './layers-dialog';
import {addLayer,assignLayer,editLayer,type LayerAction} from '@/lib/layers';
import FurnitureTree from './furniture-tree';
import {selectionIds,chooseSelection,normalizeSelection,batchAction,transformGroup,sceneGroups,createGroup,editGroup,type GroupDelta} from '@/lib/selection';
import {restoreVariant} from '@/lib/design-variants';
import { selectionAppearance, editAppearance, collisions } from '@/lib/scene-model';
import { initialScene, validateScene, createNode, cloneUngroupedNode, materials, kindNames, kinds, surfaceNames, applyCommands, quickCommands, type MaterialId, type Kind, type SceneData, type SceneNode, type Selection, type SceneCommand } from '@/lib/scene-model';
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
    source: 'AI' | '빠른 명령' | '스타일' | '사진 팔레트' | '3D 초안' | '디자인 안' | '외관' | '가구 세트' | '배열·정렬' | '소재 교체' | '벽 그리기' | '파티션 개구부';
    baseScene?:string;
    addedIds?:string[];
    placement?:PlacementPlan;
    placementSession?:number;
    materialPlan?:MaterialPlan;
    materialSession?:number;
    wallPlan?:WallPlan;
    wallSession?:number;
    openingPlan?:PartitionOpeningPlan;
    openingSession?:number;
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
    const [scene, setScene] = useState<SceneData>(initialScene), [selection, setSelection] = useState<Selection>({ id: 'floor' }), [tab, setTab] = useState('materials'), [filter, setFilter] = useState('전체'), [query, setQuery] = useState(''), [mode, setMode] = useState('easy'), [tool, setToolState] = useState<ToolMode>('select'), [view, setView] = useState<ViewMode>('perspective'), [faceMode, setFaceMode] = useState<'face' | 'object'>('face'), [snap, setSnap] = useState(true), [cutaway, setCutaway] = useState(true), [undo, setUndo] = useState<SceneData[]>([]), [redo, setRedo] = useState<SceneData[]>([]), [modal, setModal] = useState<string | null>(null), [mobileLibrary, setMobileLibrary] = useState(false), [mobileInspector, setMobileInspector] = useState(false), [projects, setProjects] = useState<Project[]>([]), [projectId, setProjectId] = useState<string | null>(null), [revision, setRevision] = useState(0), [savedScene, setSavedScene] = useState(() => JSON.stringify(initialScene())), [saveState, setSaveState] = useState('새 프로젝트'), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [proposal, setProposal] = useState<Proposal | null>(null), [preview, setPreview] = useState(true), [prompt, setPrompt] = useState(''), [aiReady, setAiReady] = useState(false), [apiKey, setApiKey] = useState(''), [keyDraft, setKeyDraft] = useState(''), [aiBusy, setAiBusy] = useState(false), [photoUrl, setPhotoUrl] = useState('/cafe-reference.jpg'), [palette, setPalette] = useState<string[]>([]), [photoImage, setPhotoImage] = useState(''), [projectLoading, setProjectLoading] = useState(false), [pendingOpen, setPendingOpen] = useState<string | null>(null), [help, setHelp] = useState(false);
    const [aiConfigStatus,setAiConfigStatus]=useState<'checking'|'ready'|'unavailable'>('checking'),[signedIn,setSignedIn]=useState<boolean|null>(null);
    const aiFlight=useRef(false),paletteFlight=useRef(false);
    const [draftSnapshot,setDraftSnapshot]=useState<{scene:SceneData;session:number;photoUrl:string}|null>(null);
    const [section,setSection]=useState<SectionView|null>(null),[sectionPanel,setSectionPanel]=useState(false),[sectionExporting,setSectionExporting]=useState(false);
    const [underlaySnapshot,setUnderlaySnapshot]=useState<{scene:SceneData;session:number}|null>(null),[underlayExporting,setUnderlayExporting]=useState(false);
    const [wallSnapshot,setWallSnapshot]=useState<{scene:SceneData;session:number;request?:WallDrawingRequest}|null>(null);
    const [openingSnapshot,setOpeningSnapshot]=useState<{scene:SceneData;session:number;nodeId:string;openings?:PartitionOpening[]}|null>(null);
    const sectionRef=useRef(section);sectionRef.current=section;
    const lightingStart = useRef<SceneData | null>(null);
    const [snapSettings,setSnapSettings]=useState(defaultSnapSettings),[snapPreferencesReady,setSnapPreferencesReady]=useState(false);
    useEffect(()=>{try{const raw=localStorage.getItem('spatial-snap-settings');if(raw){const saved=JSON.parse(raw);setSnapSettings(normalizeSnapping(saved));if(typeof saved.enabled==='boolean')setSnap(saved.enabled);}}catch{}setSnapPreferencesReady(true);},[]);
    useEffect(()=>{if(snapPreferencesReady)try{localStorage.setItem('spatial-snap-settings',JSON.stringify({...snapSettings,enabled:snap}));}catch{}},[snapSettings,snap,snapPreferencesReady]);
    const [selectionExport,setSelectionExport]=useState<{scene:SceneData;session:number;ids:string[]}|null>(null),[exportOrigin,setExportOrigin]=useState<'center'|'world'>('center'),[selectionExportBusy,setSelectionExportBusy]=useState(false);
    const selectionExportFlight=useRef(false),sceneExportFlight=useRef(false);
    const selectionExportToken=useRef<object|null>(null);
    const [materialPresetSave,setMaterialPresetSave]=useState(false);
    const [materialOpening,setMaterialOpening]=useState(false);
    const [copiedMaterial,setCopiedMaterial]=useState<{sample:MaterialSample;session:number}|null>(null),[transferringMaterial,setTransferringMaterial]=useState(false);
    const transferringMaterialRef=useRef(false),faceModeRef=useRef(faceMode);faceModeRef.current=faceMode;
    const [materialSnapshot,setMaterialSnapshot]=useState<{scene:SceneData;catalog:MaterialSlot[];session:number}|null>(null);
    const materialOpeningRef=useRef(false),modalRef=useRef(modal),proposalRef=useRef(proposal);modalRef.current=modal;proposalRef.current=proposal;
    const projectSession = useRef(0), saveInFlight = useRef(false), loadInFlight = useRef(false);
    useEffect(()=>{if(copiedMaterial&&copiedMaterial.session!==projectSession.current)setCopiedMaterial(null);},[projectSession.current,copiedMaterial]);
    const activeMaterialSample=copiedMaterial?.session===projectSession.current?copiedMaterial.sample:null;
    const [multiSelect,setMultiSelect]=useState(false);
    const [drawStatus,setDrawStatus]=useState({started:false,width:0,depth:0});
    const [measureStarted,setMeasureStarted]=useState(false),[measureError,setMeasureError]=useState(''),[measurementsVisible,setMeasurementsVisible]=useState(true),[exportingMeasures,setExportingMeasures]=useState(false);
    const [editingGroupId,setEditingGroupId]=useState<string|null>(null);
    const [facadeTab,setFacadeTab]=useState<'sign'|'awning'|'front'>('sign'),[cameraName,setCameraName]=useState('');
    const [assemblySave,setAssemblySave]=useState(false);
    const assemblySession=useRef(0),placementSession=useRef(0);
    const [modelFile, setModelFile] = useState<File | null>(null);
    const assetSession = useRef(0), renderSnapshot = useRef({ session: 0, scene: '' });
    const [nameDraft, setNameDraft] = useState(scene.name), [restoreCamera, setRestoreCamera] = useState<SceneData['cameras'][number] | null>(null), [nextModal, setNextModal] = useState<string | null>(null);
    useEffect(() => setNameDraft(scene.name), [scene.name]);
    const engine = useRef<SceneEngine | null>(null), uploadRef = useRef<HTMLInputElement>(null), importRef = useRef<HTMLInputElement>(null), sceneRef = useRef(scene), selectionRef = useRef(selection);
    const [doorMotionSnapshot,setDoorMotionSnapshot]=useState<{scene:SceneData;nodeId:string}|null>(null);
    const walkSnapshot=useRef({session:0,scene:''});
    useEffect(()=>{const e=engine.current;if(e)e.paused=modal==='walk'||modal==='door-motion';return()=>{if(e)e.paused=false;}},[modal]);
    function openWalk(){if(proposal){toast('미리보기를 적용하거나 닫은 뒤 둘러보기를 시작하세요.');return;}if(!engine.current||projectLoading){toast('3D 공간을 다 불러온 뒤 시작하세요.');return;}engine.current.cancelTransform();engine.current.cancelMeasurement();walkSnapshot.current={session:projectSession.current,scene:JSON.stringify({...sceneRef.current,cameras:[]})};setTool('select');setMobileLibrary(false);setMobileInspector(false);setModal('walk');}
    function walkCurrent(){if(walkSnapshot.current.session!==projectSession.current||walkSnapshot.current.scene!==JSON.stringify({...sceneRef.current,cameras:[]})){toast.error('공간이 변경되었습니다. 둘러보기를 다시 열어 주세요.');return false;}return true;}
    const photoUrlRef=useRef(photoUrl);photoUrlRef.current=photoUrl;
    sceneRef.current = scene;
    selectionRef.current = selection;
    const dirty = JSON.stringify(scene) !== savedScene;
    const node = scene.nodes.find(n => n.id === selection?.id);
    const surface = selection && Object.hasOwn(scene.room.surfaces, selection.id) ? scene.room.surfaces[selection.id as keyof SceneData['room']['surfaces']] : undefined;
    const selectedIds=selectionIds(selection),multiple=selectedIds.length>1;
    const appearance = multiple?null:selectionAppearance(scene, faceMode === 'object' && selection ? { id: selection.id } : selection);
    const originalMaterial = !!(appearance && 'original' in appearance && appearance.original);
    const selectedMaterial = originalMaterial ? undefined : appearance?.material;
    const conflicts = useMemo(()=>collisions(scene),[scene.nodes,scene.room.width,scene.room.depth]);
    const material = materials.find(m => m.id === selectedMaterial);
    const activeGroup=sceneGroups(scene).find(g=>g.nodes.length===selectedIds.length&&g.nodes.every(n=>selectedIds.includes(n.id)));
    const currentName = activeGroup&&!editingGroupId?activeGroup.name:multiple?`${selectedIds.length}개 가구`:node?.name ?? surfaceNames[selection?.id ?? ''] ?? '공간 설정';
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
        setEditingGroupId(null);engine.current?.cancelMeasurement();engine.current?.cancelTransform();sceneRef.current=undo[undo.length-1];setScene(undo[undo.length - 1]);
        setUndo(undo.slice(0, -1));
        setProposal(null);
        setSaveState('저장하지 않은 변경');
    }, [undo, redo]);
    const doRedo = useCallback(() => {
        if (!redo.length)
            return;
        setUndo([...undo, sceneRef.current]);
        setEditingGroupId(null);engine.current?.cancelMeasurement();engine.current?.cancelTransform();sceneRef.current=redo[redo.length-1];setScene(redo[redo.length - 1]);
        setRedo(redo.slice(0, -1));
        setProposal(null);
        setSaveState('저장하지 않은 변경');
    }, [undo, redo]);
    const removeSelected = useCallback(() => {
        const ids=selectionIds(selectionRef.current).filter(id=>sceneRef.current.nodes.some(n=>n.id===id));if(!ids.length)return;
        try{if(commit(batchAction(sceneRef.current,ids,{type:'delete'}),'선택한 요소를 삭제했습니다. 실행 취소로 복원할 수 있습니다.'))setSelection(null)}catch(e){toast.error((e as Error).message)}
    }, [commit]);
    useEffect(()=>{
        const editing=editingGroupId&&scene.nodes.some(n=>n.group?.id===editingGroupId)&&(!selection||selectionIds(selection).every(id=>scene.nodes.find(n=>n.id===id)?.group?.id===editingGroupId))?editingGroupId:null;
        if(editing!==editingGroupId)setEditingGroupId(editing);
        setSelection(previous=>{const next=normalizeSelection(scene,previous,editing);return JSON.stringify(previous)===JSON.stringify(next)?previous:next});
    },[scene.nodes,editingGroupId,selection]);
    useEffect(() => {
        request('/api/config').then(d => {setAiReady(d.aiKeyConfigured??d.ai);setSignedIn(d.signedIn);setAiConfigStatus('ready');}).catch(() => setAiConfigStatus('unavailable'));
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
            if(e.isComposing||e.keyCode===229)return;
            const target = e.target as HTMLElement;
            if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
                if(e.repeat){e.preventDefault();return;}
                if((!modal||modal==='commands')&&!help){e.preventDefault();engine.current?.cancelTransform();engine.current?.cancelMeasurement();setMobileLibrary(false);setMobileInspector(false);setModal(modal==='commands'?null:'commands');}return;
            }
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
            else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();if(e.shiftKey)ungroupSelection();else makeGroup('새 가구 그룹');
            }
            else if (e.key === 'Delete' || e.key === 'Backspace')
                removeSelected();
            else if (e.key === 'Escape') {
                if(tool==='draw'){if(drawStatus.started)engine.current?.cancelDrawing();else setTool('select');return;}
                if(tool==='measure'){if(measureStarted){engine.current?.cancelMeasurement();setMeasureError('');}else setTool('select');return;}
                if(editingGroupId){exitGroupEdit();return;}
                engine.current?.cancelTransform();setSelection(null);
                setTool('select');
                setProposal(null);
            }
            else if (!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase() === 'f'){e.preventDefault();focusSelection();}
            else if (!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase() === 't'){e.preventDefault();startMeasuring();}
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
    }, [doUndo, doRedo, removeSelected, modal, mobileLibrary, mobileInspector, editingGroupId, selection, proposal, tool, measureStarted, help, drawStatus.started]);
    function add(kind: Kind) {
        const id = randomId(), n = createNode(kind, id);
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
        if(node.locked){toast.error('잠금을 해제한 뒤 복제하세요.');return;}
        const copy = { ...cloneUngroupedNode(node), id: randomId(), name: `${node.name} 사본`, x: node.x + 600, locked: false };
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
    function openPhotoDraft(){if(uploading||projectLoading){toast('사진과 공간을 다 불러온 뒤 시작하세요.');return;}engine.current?.cancelTransform();setDraftSnapshot({scene:sceneRef.current,session:projectSession.current,photoUrl:photoUrlRef.current});setNextModal(null);setModal('draft');}
    function openAISettings(from:string|null=null){setNextModal(from);setKeyDraft('');setModal('settings');}
    function closeAISettings(){setKeyDraft('');setModal(nextModal);setNextModal(null);}
    async function analyzePalette() {
        if(paletteFlight.current)return;paletteFlight.current=true;
        const source=sceneRef.current,session=projectSession.current,photo=photoUrlRef.current,baseScene=JSON.stringify(source);
        const current=()=>session===projectSession.current&&baseScene===JSON.stringify(sceneRef.current)&&photo===photoUrlRef.current;
        try {
            const p = await photoData(photo);
            if(!current()){toast('사진이나 공간이 변경되었습니다. 다시 색감을 추출해 주세요.');return;}
            setPalette(p.palette);
            setPhotoImage(p.image);
            const commands: SceneCommand[] = [{ type: 'material', target: 'walls', material: 'plaster', color: p.palette[0] }, { type: 'material', target: 'floor', material: 'concrete', color: p.palette[1] }, { type: 'material', target: 'tables', material: 'oak', color: p.palette[2] }];
            const next = applyCommands(source, commands);
            next.palette = p.palette;
            setProposal({ scene: next, title: '사진의 색감을 공간에', details: '사진에서 추출한 3가지 색을 벽·바닥·테이블에 적용합니다. 사진 속 구조를 복원하는 기능은 아닙니다.', source: '사진 팔레트',baseScene });
            setPreview(true);
            setModal(null);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {paletteFlight.current=false;}
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
        if(aiFlight.current)return;
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
            openAISettings();
            return;
        }
        const sceneAtRequest = JSON.stringify(scene), session = projectSession.current,photoAtRequest=photoUrl;
        const current=()=>session===projectSession.current&&sceneAtRequest===JSON.stringify(sceneRef.current)&&(!withPhoto||photoAtRequest===photoUrlRef.current);
        aiFlight.current=true;setAiBusy(true);
        try {
            let image = photoImage;
            if (withPhoto && !image) {
                const p = await photoData(photoUrl);
                if(!current()){toast('사진이나 공간이 변경되었습니다. 현재 장면에서 다시 요청하세요.');return;}
                image = p.image;
                setPhotoImage(image);
                setPalette(p.palette);
            }
            const d = await request('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, scene:{...scene,variants:undefined}, selection, apiKey: apiKey || undefined, ...(withPhoto ? { image } : {}) }) });
            if (!current()) {
                toast('분석 중 장면이 변경되었습니다. 현재 장면에서 다시 요청하세요.');
                return;
            }
            if (!d.commands.length) {
                toast(d.summary);
                return;
            }
            setProposal({ scene: applyCommands(scene, d.commands), title: withPhoto ? '사진에서 가져온 AI 컨셉' : 'AI 편집 제안', details: d.summary, source: 'AI',baseScene:sceneAtRequest });
            setPreview(true);
            setPrompt('');
            setModal(null);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            aiFlight.current=false;setAiBusy(false);
        }
    }
    function openSelectionExport(){
        if(proposal||projectLoading)return;const ids=selectionIds(selectionRef.current),nodes=sceneRef.current.nodes.filter(n=>ids.includes(n.id));
        if(!ids.length||nodes.length!==ids.length||nodes.some(n=>n.hidden)){toast('내보낼 가구·파티션·문·창문을 표시하고 선택하세요.');return;}
        engine.current?.cancelTransform();engine.current?.cancelMeasurement();selectionExportToken.current={};setSelectionExport({scene:sceneRef.current,session:projectSession.current,ids});setExportOrigin('center');setMobileLibrary(false);setMobileInspector(false);setModal('selection-export');
    }
    function closeSelectionExport(){selectionExportToken.current=null;setModal(null);}
    async function exportSelected(){
        if(selectionExportFlight.current||!selectionExport||!engine.current)return;const snapshot=selectionExport,viewer=engine.current,origin=exportOrigin,token=selectionExportToken.current;
        selectionExportFlight.current=true;setSelectionExportBusy(true);
        try{
            if(snapshot.session!==projectSession.current||JSON.stringify(snapshot.scene)!==JSON.stringify(sceneRef.current))throw new Error('장면이 변경되었습니다. 선택 요소 내보내기를 다시 여세요.');
            const bytes=await viewer.exportSelectionGlb(snapshot.ids,origin);
            if(snapshot.session!==projectSession.current||JSON.stringify(snapshot.scene)!==JSON.stringify(sceneRef.current)||viewer!==engine.current||modalRef.current!=='selection-export'||selectionExportToken.current!==token)throw new Error('내보내기 중 장면이나 창이 변경되었습니다. 다시 시도하세요.');
            download(new Blob([bytes],{type:'model/gltf-binary'}),`${snapshot.scene.name}-선택-${origin==='center'?'중심':'원래위치'}.glb`);closeSelectionExport();toast.success(`선택한 ${snapshot.ids.length}개 요소를 GLB로 내보냈습니다.`);
        }catch(e){if(selectionExportToken.current===token)toast.error(e instanceof Error?e.message:'선택 요소를 내보내지 못했습니다.');}
        finally{selectionExportFlight.current=false;setSelectionExportBusy(false);}
    }
    async function exportFile(type: 'png' | 'glb' | 'json') {
        if (proposal) {
            toast('제안을 적용하거나 닫은 뒤 내보내세요.');
            return;
        }
        if(sceneExportFlight.current)return;sceneExportFlight.current=true;const exportScene=sceneRef.current,exportSession=projectSession.current;engine.current?.cancelTransform();engine.current?.cancelMeasurement();
        try {
            if (type === 'json')
                download(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), `${scene.name}.spatial.json`);
            else if (!engine.current)
                throw new Error('3D 장면을 먼저 불러와 주세요.');
            else if (type === 'png'){
                const base=JSON.stringify(sceneRef.current),cut=JSON.stringify(sectionRef.current),session=projectSession.current;
                const png=await engine.current.screenshot(2048,undefined,false,!!sectionRef.current);
                if(base!==JSON.stringify(sceneRef.current)||cut!==JSON.stringify(sectionRef.current)||session!==projectSession.current)throw new Error('장면 또는 단면이 바뀌었습니다. 다시 저장하세요.');
                download(png, `${sceneRef.current.name}${sectionRef.current?'-단면':''}.png`);
            }
            else {
                setBusy(true);
                const viewer=engine.current,bytes=await viewer.exportGlb();
                if(exportSession!==projectSession.current||JSON.stringify(exportScene)!==JSON.stringify(sceneRef.current)||viewer!==engine.current)throw new Error('내보내기 중 장면이 변경되었습니다. 다시 시도하세요.');
                download(new Blob([bytes], { type: 'model/gltf-binary' }), `${exportScene.name}.glb`);
            }
            toast.success(type === 'glb' ? 'GLB를 내보냈습니다. 치수 편집 기록은 프로젝트 파일에 보관됩니다.' : '파일을 내보냈습니다.');
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            sceneExportFlight.current=false;setBusy(false);
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
        throw new Error('평면 보기에서 3D·실내·외관 보기로 바꾼 뒤 시안을 만드세요.'); const snapshot = { session: projectSession.current, scene: renderSceneIdentity(sceneRef.current) }; let image = ''; for (const width of [1536, 1024, 768]) {
        image = await engine.current.screenshot(width, 1.5);
        if (image.length <= 2700000)
            break;
    } if (image.length > 2700000)
        throw new Error('장면 이미지가 너무 큽니다. 모델 디테일을 줄여 주세요.'); if (snapshot.session !== projectSession.current || snapshot.scene !== renderSceneIdentity(sceneRef.current))
        throw new Error('장면이 변경되었습니다. 다시 캡처하세요.'); renderSnapshot.current = snapshot; return image; }
    function setTool(next:ToolMode){if(next!=='select'){setSection(null);sectionRef.current=null;setSectionPanel(false);engine.current?.setSection(null);}setToolState(next);}
    function changeSection(next:SectionView|null){engine.current?.setSection(next);setSection(next);sectionRef.current=next;setRestoreCamera(null);setToolState('select');if(!next)setSectionPanel(false);}
    function openDoorMotion(id?:string,candidate?:SceneData){
        if(projectLoading)return;const source=candidate??sceneRef.current;
        const targets=source.nodes.filter(n=>!n.hidden&&n.kind==='partition'&&n.openings?.some(o=>o.kind==='door'&&o.door));
        const target=targets.find(n=>n.id===id)??targets.find(n=>selectedIds.includes(n.id))??targets[0];
        if(!target){toast('파티션 문 편집에서 개폐 설정을 켠 뒤 동작을 확인하세요.');return;}
        engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setDoorMotionSnapshot({scene:source,nodeId:target.id});setMobileLibrary(false);setMobileInspector(false);setModal('door-motion');
    }
    function openSceneSearch(){if(proposal||projectLoading)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setMobileLibrary(false);setMobileInspector(false);setModal('scene-search');}
    function focusSelection(ids=selectionIds(selectionRef.current)){
        if(proposal||projectLoading)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();changeSection(null);setTool('select');
        if(!engine.current?.focusNodes(ids))toast('화면에서 찾을 가구나 그룹을 선택하세요.');
    }
    function chooseSearchResult(ids:string[]){
        if(proposal||projectLoading)return;const targets=sceneRef.current.nodes.filter(n=>ids.includes(n.id));
        if(!targets.length||targets.length!==ids.length||targets.some(n=>n.hidden)){toast('요소가 변경되었습니다. 다시 검색하세요.');return;}
        engine.current?.cancelTransform();setMultiSelect(false);setFaceMode('object');setTool('select');changeSection(null);
        if(targets.length===1&&targets[0].group){setEditingGroupId(targets[0].group.id);setSelection({id:targets[0].id});}
        else{setEditingGroupId(null);setSelection(normalizeSelection(sceneRef.current,{id:targets[0].id,ids}));}
        setModal(null);engine.current?.focusNodes(ids);
    }
    function openCommands(){if(modal||help)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();setMobileLibrary(false);setMobileInspector(false);setModal('commands');}
    function openOpenings(id?:string){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 개구부를 편집하세요.');return;}if(projectLoading)return;const partitions=sceneRef.current.nodes.filter(n=>n.kind==='partition'),target=partitions.find(n=>n.id===id)??partitions.find(n=>selectedIds.includes(n.id))??partitions.find(n=>!n.locked&&!n.hidden)??partitions[0];if(!target){toast('먼저 벽·파티션을 그리거나 라이브러리에서 파티션을 추가하세요.');return;}engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setOpeningSnapshot({scene:sceneRef.current,session:projectSession.current,nodeId:target.id});setMobileLibrary(false);setMobileInspector(false);setModal('partition-openings');}
    function previewOpenings(plan:PartitionOpeningPlan){if(!openingSnapshot)return;try{const candidate=acceptPartitionOpenings(sceneRef.current,plan,projectSession.current,openingSnapshot.session);setProposal({scene:candidate,source:'파티션 개구부',title:'통로·문·창문 편집',details:plan.summary,baseScene:plan.baseScene,openingPlan:plan,openingSession:openingSnapshot.session});setPreview(true);setModal(null);changeSection(null);setTool('select');selectView('perspective');}catch(e){toast.error((e as Error).message);setModal(null);}}
    function reviseOpenings(){if(!proposal?.openingPlan)return;try{acceptPartitionOpenings(sceneRef.current,proposal.openingPlan,projectSession.current,proposal.openingSession!);setOpeningSnapshot({scene:sceneRef.current,session:projectSession.current,nodeId:proposal.openingPlan.nodeId,openings:proposal.openingPlan.openings});setProposal(null);setModal('partition-openings');}catch(e){setProposal(null);toast.error((e as Error).message);}}
    function openWalls(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 벽을 그리세요.');return;}if(projectLoading)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setWallSnapshot({scene:sceneRef.current,session:projectSession.current});setMobileLibrary(false);setMobileInspector(false);setModal('walls');}
    function previewWalls(plan:WallPlan){if(!wallSnapshot)return;try{const candidate=acceptWallPlan(sceneRef.current,plan,projectSession.current,wallSnapshot.session);setProposal({scene:candidate,title:plan.request.name,details:`${plan.summary} · 새 외곽 겹침 ${plan.overlaps.length}곳`,source:'벽 그리기',baseScene:plan.baseScene,addedIds:plan.addedIds,wallPlan:plan,wallSession:wallSnapshot.session});setPreview(true);setModal(null);changeSection(null);setTool('select');selectView('perspective');}catch(e){toast.error((e as Error).message);setModal(null);}}
    function reviseWalls(){if(!proposal?.wallPlan)return;try{acceptWallPlan(sceneRef.current,proposal.wallPlan,projectSession.current,proposal.wallSession!);setWallSnapshot({scene:sceneRef.current,session:projectSession.current,request:proposal.wallPlan.request});setProposal(null);setModal('walls');}catch(e){setProposal(null);toast.error((e as Error).message);}}
    function openUnderlay(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 도면 배경을 여세요.');return;}if(projectLoading)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setUnderlaySnapshot({scene:sceneRef.current,session:projectSession.current});setMobileLibrary(false);setMobileInspector(false);setModal('underlay');}
    function applyUnderlay(value:PlanUnderlay|null){if(!underlaySnapshot)return false;try{const next=acceptUnderlay(sceneRef.current,value,JSON.stringify(underlaySnapshot.scene),projectSession.current,underlaySnapshot.session);if(!commit(next,value?'도면 배경을 적용했습니다. 평면에서 가구를 배치하세요.':'도면 배경을 제거했습니다.'))return false;changeSection(null);selectView('top');setModal(null);return true;}catch(e){toast.error(e instanceof Error&&e.name!=='ZodError'?e.message:'도면의 크기와 축척을 확인하세요.');return false;}}
    function toggleUnderlay(){if(proposal)return;const u=sceneRef.current.underlay;if(u)commit(setUnderlay(sceneRef.current,{...u,visible:!u.visible}));}
    async function exportUnderlayPng(){if(!engine.current||underlayExporting)return;if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 저장하세요.');return;}const base=JSON.stringify(sceneRef.current),session=projectSession.current;setUnderlayExporting(true);try{const png=await engine.current.screenshot(2048,undefined,false,false,true);if(base!==JSON.stringify(sceneRef.current)||session!==projectSession.current||engine.current.view!=='top'||sectionRef.current)throw new Error('평면 또는 도면 배경이 바뀌었습니다. 다시 저장하세요.');download(png,`${sceneRef.current.name}-도면배경-배치.png`);}catch(e){toast.error((e as Error).message);}finally{setUnderlayExporting(false);}}
    function openSection(){if(!engine.current||projectLoading)return;engine.current.cancelMeasurement();engine.current.cancelTransform();setMobileInspector(false);setMobileLibrary(false);if(!section)changeSection({axis:'y',position:Math.min(1,1500/sceneRef.current.room.height),keep:'negative',guide:true});setSectionPanel(!sectionPanel||!section);}
    async function exportSectionPng(){if(!engine.current||sectionExporting||!sectionRef.current)return;if(proposal){toast('미리보기를 적용하거나 닫은 뒤 단면 이미지를 저장하세요.');return;}const base=JSON.stringify(sceneRef.current),cut=JSON.stringify(sectionRef.current),session=projectSession.current;setSectionExporting(true);try{const png=await engine.current.screenshot(2048,undefined,false,true);if(base!==JSON.stringify(sceneRef.current)||cut!==JSON.stringify(sectionRef.current)||session!==projectSession.current)throw new Error('장면 또는 단면이 바뀌었습니다. 다시 저장하세요.');download(png,`${sceneRef.current.name}-단면.png`);}catch(e){toast.error((e as Error).message);}finally{setSectionExporting(false);}}
    function selectView(next:ViewMode){setRestoreCamera(null);setView(next);engine.current?.setView(next);}
    function resetProjectView(next:SceneData){changeSection(null);engine.current?.cancelMeasurement();setTool('select');setMeasureStarted(false);setMeasureError('');setEditingGroupId(null);engine.current?.setScene(next);selectView('perspective');setMultiSelect(false);}
    function openFacade(tab:'sign'|'awning'|'front'='sign'){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 외관을 편집하세요.');return}engine.current?.cancelTransform();setMobileLibrary(false);setMobileInspector(false);setFacadeTab(tab);setModal('facade');}
    function showCameras(){setCameraName('');setMobileLibrary(false);setMobileInspector(false);setModal('cameras');}
    function selectItem(next:Selection,additive=false){
        if(proposal)return;if(next?.id==='facade-sign'||next?.id==='facade-awning'){openFacade(next.id==='facade-sign'?'sign':'awning');return;}
        const target=sceneRef.current.nodes.find(n=>n.id===next?.id),editing=target?.group?.id===editingGroupId?editingGroupId:null;
        if(editing!==editingGroupId){engine.current?.cancelTransform();setEditingGroupId(editing);}
        setSelection(previous=>chooseSelection(sceneRef.current,previous,next,additive||multiSelect,editing));
        if(additive||multiSelect||target?.group&&target.group.id!==editing)setFaceMode('object');
    }
    function groupCommit(next:()=>SceneData,label:string){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 그룹을 편집하세요.');return false;}engine.current?.cancelTransform();try{return commit(next(),label)}catch(e){toast.error((e as Error).message);return false}}
    function makeGroup(name:string){return groupCommit(()=>createGroup(sceneRef.current,selectionIds(selectionRef.current),name),'그룹으로 묶었습니다. 이름을 붙이고 함께 편집하세요.');}
    function renameGroup(id:string,name:string){return groupCommit(()=>editGroup(sceneRef.current,[id],{type:'rename',name}),'그룹 이름을 변경했습니다.');}
    function ungroupSelection(){const ids=[...new Set(sceneRef.current.nodes.filter(n=>selectionIds(selectionRef.current).includes(n.id)).map(n=>n.group?.id).filter((id):id is string=>!!id))];if(groupCommit(()=>editGroup(sceneRef.current,ids,{type:'ungroup'}),'그룹을 해제했습니다. 가구 배치는 유지됩니다.'))setEditingGroupId(null);}
    function enterGroupEdit(id:string,nodeId?:string){if(proposal)return;const members=sceneRef.current.nodes.filter(n=>n.group?.id===id);if(!members.length)return;engine.current?.cancelTransform();setEditingGroupId(id);setMultiSelect(false);setSelection({id:members.find(n=>n.id===nodeId)?.id??members[0].id});setFaceMode('object');}
    function exitGroupEdit(){engine.current?.cancelTransform();const member=sceneRef.current.nodes.find(n=>n.group?.id===editingGroupId);setEditingGroupId(null);setMultiSelect(false);setSelection(member?normalizeSelection(sceneRef.current,{id:member.id}):null);setFaceMode('object');}
    function selectWholeGroup(id:string,additive:boolean){if(proposal)return;const members=sceneRef.current.nodes.filter(n=>n.group?.id===id);if(!members.length)return;engine.current?.cancelTransform();setEditingGroupId(null);setSelection(previous=>chooseSelection(sceneRef.current,previous,{id:members[0].id},additive||multiSelect));setFaceMode('object');}
    function setNodeState(ids:string[],key:'hidden'|'locked',value:boolean){groupCommit(()=>batchAction(sceneRef.current,ids,{type:key,value}),key==='locked'?(value?'선택 요소를 잠갔습니다.':'잠금을 해제했습니다.'):(value?'선택 요소를 숨겼습니다.':'선택 요소를 표시했습니다.'));}

    function openLayers(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 레이어를 여세요.');return;}if(projectLoading){toast('프로젝트를 다 불러온 뒤 레이어를 여세요.');return;}engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setMobileLibrary(false);setMobileInspector(false);setModal('layers');}
    function layerCommit(action:()=>SceneData,label:string){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 레이어를 편집하세요.');return false;}engine.current?.cancelTransform();try{return commit(action(),label)}catch(e){toast.error((e as Error).message);return false;}}
    function assignSelectionLayer(id:string|null){return layerCommit(()=>assignLayer(sceneRef.current,selectionIds(selectionRef.current).filter(id=>sceneRef.current.nodes.some(n=>n.id===id)),id),'선택 요소의 레이어를 변경했습니다. 그룹은 함께 이동합니다.');}
    function createSceneLayer(name:string,color:string,includeSelection:boolean){return layerCommit(()=>addLayer(sceneRef.current,name,color,includeSelection?selectionIds(selectionRef.current).filter(id=>sceneRef.current.nodes.some(n=>n.id===id)):[]),'레이어를 만들었습니다. 프로젝트를 저장하면 함께 보관됩니다.');}
    function changeSceneLayer(id:string|null,action:LayerAction){const label=action.type==='delete'?'레이어를 삭제했습니다. 가구는 미분류에 그대로 남아 있습니다.':action.type==='rename'?'레이어 이름과 색상을 저장했습니다.':action.type==='isolate'?'이 레이어의 요소만 표시합니다. 실행 취소로 이전 표시 상태를 복원할 수 있습니다.':action.type==='hidden'?(action.value?'레이어의 요소를 숨겼습니다.':'레이어의 요소를 표시했습니다.'):(action.value?'레이어의 요소를 잠갔습니다.':'레이어의 요소 잠금을 해제했습니다.');const done=layerCommit(()=>editLayer(sceneRef.current,id,action),label);if(done&&action.type==='isolate'){setSelection(null);setEditingGroupId(null);setMultiSelect(false);setTool('select');setModal(null);}return done;}
    function selectLayerMembers(id:string|null){if(proposal)return;const ids=sceneRef.current.nodes.filter(n=>(n.layerId??null)===id).map(n=>n.id);if(!ids.length)return;engine.current?.cancelTransform();setEditingGroupId(null);setMultiSelect(false);setSelection({id:ids[0],ids});setFaceMode('object');setTool('select');setModal(null);}

    function moveGroup(ids:string[],delta:GroupDelta,pivot:{x:number;y:number;z:number}){try{commit(transformGroup(sceneRef.current,ids,delta,pivot))}catch(e){toast.error((e as Error).message);engine.current?.setScene(sceneRef.current)}}
    function startMeasuring(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 측정하세요.');return;}if((sceneRef.current.measurements?.length??0)>=30){toast.error('치수는 30개까지 저장할 수 있습니다. 치수 목록에서 정리하세요.');return;}engine.current?.cancelTransform();engine.current?.cancelMeasurement();setSelection(null);setMultiSelect(false);setEditingGroupId(null);setMeasureError('');setMeasureStarted(false);setMeasurementsVisible(true);setTool('measure');setModal(null);setMobileLibrary(false);setMobileInspector(false);}
    function openMeasurements(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 치수 목록을 여세요.');return;}engine.current?.cancelMeasurement();engine.current?.cancelTransform();setTool('select');setMobileLibrary(false);setMobileInspector(false);setModal('measurements');}
    function saveMeasurement(start:MeasurementAnchor,end:MeasurementAnchor){try{const next=addMeasurement(sceneRef.current,start,end);if(commit(next,'치수를 저장했습니다. 다음 두 점을 계속 측정할 수 있습니다.')){setMeasureError('');return true;}return false;}catch(e){setMeasureError(e instanceof Error&&e.name!=='ZodError'?e.message:'측정 지점을 확인하세요.');return false;}}
    function changeMeasurement(id:string,action:{type:'rename';name:string}|{type:'hidden';value:boolean}|{type:'delete'}){try{return commit(editMeasurement(sceneRef.current,id,action));}catch(e){toast.error(e instanceof Error&&e.name!=='ZodError'?e.message:'치수 이름을 확인하세요.');return false;}}
    async function exportMeasurementPng(){if(!engine.current||exportingMeasures)return;setExportingMeasures(true);const base=JSON.stringify(sceneRef.current),session=projectSession.current;try{const png=await engine.current.screenshot(2048,undefined,true);if(base!==JSON.stringify(sceneRef.current)||session!==projectSession.current)throw new Error('장면이 변경되었습니다. 치수 이미지를 다시 저장하세요.');download(png,`${sceneRef.current.name}-치수.png`);}catch(e){toast.error((e as Error).message);}finally{setExportingMeasures(false);}}
    function openPlacement(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 배열·정렬을 여세요.');return;}engine.current?.cancelTransform();placementSession.current=projectSession.current;setMobileLibrary(false);setMobileInspector(false);setModal('placement');}
    function openAssemblies(save=false){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 세트를 여세요.');return}engine.current?.cancelTransform();assemblySession.current=projectSession.current;setAssemblySave(save);setMobileLibrary(false);setMobileInspector(false);setModal('assemblies');}
    function openMaterialPresets(save=false){if(proposal||projectLoading||transferringMaterialRef.current)return;engine.current?.cancelTransform();engine.current?.cancelMeasurement();setMaterialPresetSave(save);setMobileLibrary(false);setMobileInspector(false);setModal('material-presets');}
    async function transferMaterial(action:'copy'|'paste'){
        if(proposalRef.current||projectLoading||transferringMaterialRef.current)return;
        const current=sceneRef.current,picked=structuredClone(selectionRef.current),session=projectSession.current,viewer=engine.current,mode=faceModeRef.current;
        const roomOnly=!!picked&&selectionIds(picked).length===1&&Object.hasOwn(current.room.surfaces,picked.id);if(!viewer&&!roomOnly){toast('3D 장면을 불러온 뒤 소재를 복사하거나 붙이세요.');return;}
        const sample=activeMaterialSample;if(action==='paste'&&!sample){toast('먼저 소재를 복사하세요.');return;}
        const ids=selectionIds(picked),scope=ids.length>1||mode==='object'?'object':'face';
        const target=mode==='object'&&picked?{...picked,face:undefined}:picked;
        viewer?.cancelTransform();viewer?.cancelMeasurement();transferringMaterialRef.current=true;setTransferringMaterial(true);
        try{
            if(!roomOnly)await viewer!.materialNodesReady(ids);
            if(session!==projectSession.current||JSON.stringify(current)!==JSON.stringify(sceneRef.current)||JSON.stringify(picked)!==JSON.stringify(selectionRef.current)||mode!==faceModeRef.current||!roomOnly&&viewer!==engine.current||proposalRef.current||modalRef.current&&modalRef.current!=='commands')throw new Error('장면이나 선택이 변경되었습니다. 소재 작업을 다시 실행하세요.');
            const catalog=roomOnly?[]:viewer!.materialCatalog(current);
            if(action==='copy'){const value=sampleMaterial(current,target,catalog);setCopiedMaterial({sample:value,session});toast.success(`${value.sourceName}의 소재를 복사했습니다. 다른 면을 선택해 붙이세요.`);}
            else{const next=pasteMaterial(current,target,sample!,scope,catalog);if(next===current)toast('이미 같은 소재가 적용되어 있습니다.');else commit(next,'복사한 소재를 적용했습니다. 실행 취소로 되돌릴 수 있습니다.');}
        }catch(e){toast.error(e instanceof Error&&e.name!=='ZodError'?e.message:'소재와 적용 범위를 확인하세요.');}
        finally{transferringMaterialRef.current=false;setTransferringMaterial(false);}
    }
    async function openMaterialBoard(){
        if(proposal){toast('현재 미리보기를 적용하거나 닫은 뒤 소재 관리를 여세요.');return;}
        if(!engine.current||projectLoading||materialOpeningRef.current)return;
        engine.current.cancelTransform();engine.current.cancelMeasurement();setTool('select');
        setMobileLibrary(false);setMobileInspector(false);
        const current=sceneRef.current,session=projectSession.current,viewer=engine.current;
        materialOpeningRef.current=true;setMaterialOpening(true);
        try{
            await viewer.modelsReady();
            if(session!==projectSession.current||JSON.stringify(current)!==JSON.stringify(sceneRef.current)||viewer!==engine.current)throw new Error('공간이 변경되었습니다. 소재 관리를 다시 여세요.');
            if(modalRef.current||proposalRef.current)return;
            setMaterialSnapshot({scene:current,catalog:viewer.materialCatalog(current),session});setModal('material-board');
        }catch(e){toast.error((e as Error).message);}finally{materialOpeningRef.current=false;setMaterialOpening(false);}
    }
    function previewMaterial(plan:MaterialPlan,name:string){
        if(!materialSnapshot)return;
        try{const candidate=acceptMaterialPlan(sceneRef.current,plan,projectSession.current,materialSnapshot.session);
            setProposal({scene:candidate,source:'소재 교체',title:`${name} 소재로 교체`,details:`${plan.changedElements}개 요소 · ${plan.changedRegions}개 소재 영역${plan.reviewPrices?` · 단가 입력된 가구 ${plan.reviewPrices}개의 단가를 재검토하세요.`:''}`,baseScene:plan.baseScene,materialPlan:plan,materialSession:materialSnapshot.session});
            setPreview(true);setModal(null);setSelection(null);setEditingGroupId(null);setTool('select');
        }catch(e){toast.error((e as Error).message);setModal(null);}
    }
    function showMaterials(){setTab('materials');if(window.innerWidth<=1050)setMobileLibrary(true)}
    function quickStartAction(action:'room'|'materials'|'furniture'|'photo'|'commands'){
        if(proposalRef.current||projectLoading||aiBusy||uploading||busy||transferringMaterialRef.current)return;
        engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setHelp(false);setMobileInspector(false);setMobileLibrary(false);
        if(action==='room'||action==='commands'){setModal(action);return;}
        setTab(action);if(window.innerWidth<=1050)setMobileLibrary(true);
    }
    function openBudget(){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 예산을 여세요.');return;}if(projectLoading){toast('프로젝트를 불러온 뒤 예산을 여세요.');return;}engine.current?.cancelTransform();engine.current?.cancelMeasurement();setTool('select');setMobileLibrary(false);setMobileInspector(false);setModal('budget');}
    function budgetCommit(action:(s:SceneData)=>SceneData,label:string){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 예산을 편집하세요.');return false;}engine.current?.cancelTransform();try{return commit(action(sceneRef.current),label)}catch(e){toast.error(e instanceof Error&&e.name!=='ZodError'?e.message:'금액과 항목명을 확인하세요. 금액은 0 이상 정수로 입력하세요.');return false;}}
    function selectBudgetItems(ids:string[]){if(proposal)return;const found=ids.filter(id=>sceneRef.current.nodes.some(n=>n.id===id));if(!found.length)return;engine.current?.cancelTransform();setEditingGroupId(null);setSelection(normalizeSelection(sceneRef.current,{id:found[0],ids:found}));setMultiSelect(false);setFaceMode('object');setTool('select');setModal(null);}
    function openReview(which:'variants'|'plan'){if(proposal){toast('현재 제안을 적용하거나 닫은 뒤 열어 주세요.');return}setMobileInspector(false);setModal(which)}
    function applyRoom(axis: 'width' | 'depth' | 'height', value: number) { return commit({ ...scene, room: { ...scene.room, [axis]: value, source: 'entered' } }); }
    const materialGrid = <><button className="outline-button full material-board-open" disabled={transferringMaterial||projectLoading||!!proposal} onClick={()=>openMaterialPresets()}><FolderOpen size={16}/>내 소재 보관함</button><button className="outline-button full material-board-open" onClick={()=>void openMaterialBoard()} disabled={materialOpening}>{materialOpening?<LoaderCircle size={16} className="spin"/>:<Palette size={16}/>}사용 중인 소재 · 한 번에 교체</button><div className="search-field"><Search size={16}/><input aria-label="소재 검색" placeholder="소재 검색" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="검색 지우기" onClick={() => setQuery('')}><X size={14}/></button>}</div><div className="filter-row">{['전체', '우드', '스톤', '메탈', '페인트', '타일', '패브릭'].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? 'selected' : ''}>{x}</button>)}</div><div className="small-heading"><span>{filter === '전체' ? '모든 소재' : filter}</span><span>{materials.filter(m => (filter === '전체' || m.group === filter) && m.name.includes(query)).length}</span></div><div className="material-grid">{materials.filter(m => (filter === '전체' || m.group === filter) && (m.name.includes(query) || m.group.includes(query))).map(m => <button className={`material-card ${selectedMaterial === m.id ? 'selected' : ''}`} key={m.id} onClick={() => paint(m.id)} aria-label={`${m.name} 소재 적용`}><span className={`swatch pattern-${m.pattern}`} style={{ backgroundColor: m.color }}>{selectedMaterial === m.id && <span className="swatch-check"><Check size={13}/></span>}</span><b>{m.name}</b><small>{m.group}</small></button>)}</div>{!materials.some(m => (filter === '전체' || m.group === filter) && (m.name.includes(query) || m.group.includes(query))) && <p className="empty-copy">검색한 소재가 없습니다.</p>}<p className="fineprint">시각화용 소재입니다. 실제 제품의 색상·규격은 제조사 샘플로 확인하세요.</p></>;
    const photoPanel = <div className="photo-panel"><button className="photo-cover" onClick={() => setModal('photo')}><img src={photoUrl} alt={scene.photoId ? '업로드한 매장 사진' : '카페 인테리어 참고 사진'}/><span><Expand size={14}/>크게 보기</span></button><p className="image-credit">{scene.photoId ? '내 매장 참고 사진' : <>예시 카페 · <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a></>}</p><button className="outline-button full" onClick={() => uploadRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>}내 매장 사진 올리기</button><button className="primary-button full start-draft-button" onClick={openPhotoDraft}><Box size={16}/>사진으로 새 3D 초안</button><div className="section-copy"><b>이 사진의 분위기로</b><p>색감과 소재를 가져와 지금의 3D 공간에 적용하세요.</p></div>{palette.length > 0 && <div className="palette-row">{palette.map((color, i) => <span key={i} style={{ background: color }} title={color}/>)}</div>}<button className="primary-button full" onClick={() => askAI(true)} disabled={aiBusy}><Sparkles size={16}/>{aiBusy ? '사진 분석 중…' : 'AI 컨셉 적용'}</button><button className="text-button full" onClick={analyzePalette}>사진 색감만 추출하기</button><button className="outline-button full render-open-button" onClick={openRender}><Camera size={16}/>이 분위기로 AI 시안 만들기</button><p className="fineprint">AI 분석은 연결 후 사용합니다. 사진의 실제 치수와 숨겨진 구조는 직접 보정해 주세요.</p></div>;
    const canCopyMaterial=!!selection&&!multiple&&!node?.hidden&&!proposal&&!projectLoading;
    const canPasteMaterial=!!selection&&!!activeMaterialSample&&!proposal&&!projectLoading&&(!!surface||multiple||faceMode==='object'||!!selection.face)&&!scene.nodes.some(n=>selectedIds.includes(n.id)&&(n.locked||n.hidden));
    const commandBlocked=!!proposal||projectLoading||aiBusy||uploading||busy||transferringMaterial;
    const commandReason=proposal?'현재 제안을 적용하거나 닫은 뒤 실행하세요.':projectLoading?'프로젝트를 불러오는 중입니다.':aiBusy||uploading||busy||transferringMaterial?'진행 중인 작업을 마친 뒤 실행하세요.':'';
    const cmd=(id:string,label:string,category:string,description:string,run:()=>void,keywords:string[]=[],disabled=false,shortcut?:string):StudioCommand=>({id,label,category,description:commandBlocked?commandReason:description,run,keywords,disabled:commandBlocked||disabled,shortcut});
    const commands:StudioCommand[]=[
        {id:'help',label:'사용 안내 · 빠른 시작',category:'시작하기',description:'6단계 시작 안내, 도구 설명과 단축키를 확인합니다.',keywords:['help','도움말','단축키','초보','가이드','tutorial'],run:()=>setHelp(true)},
        cmd('walls','벽·파티션 연속 그리기','공간 만들기','점을 찍거나 길이를 입력해 벽을 만듭니다.',openWalls,['wall','벽체','draw']),
        cmd('openings','파티션 통로·문·창문 편집','공간 만들기','파티션에 구멍과 여닫이문을 만듭니다.',()=>openOpenings(),['door','window','개구부','경첩','열림']),
        cmd('room','매장 크기와 높이','공간 만들기','실측한 공간 치수를 mm로 입력합니다.',()=>setModal('room'),['room','치수','크기']),
        cmd('underlay','평면도 배경 보정','공간 만들기','도면 이미지의 두 점으로 실제 축척을 맞춥니다.',openUnderlay,['도면','scale','캘리브레이션']),
        cmd('photo','매장 사진에서 시작','사진과 소재','사진을 올리고 색감·3D 초안·AI 컨셉을 적용합니다.',()=>setModal('photo'),['photo','사진','ai','컨셉']),
        cmd('materials','소재 라이브러리','사진과 소재','벽·바닥·가구를 선택하고 소재를 교체합니다.',showMaterials,['material','재질','텍스처']),
        cmd('material-presets','내 소재 보관함','사진과 소재','복사한 소재를 보관하고 다른 프로젝트에서도 가져옵니다.',()=>openMaterialPresets(),['프리셋','preset','저장소재','보관함']),
        cmd('material-copy','선택한 면의 소재 복사','사진과 소재','색상·광택·이미지 크기·회전을 함께 복사합니다.',()=>void transferMaterial('copy'),['copy','소재복사'],!canCopyMaterial),
        cmd('material-paste','복사한 소재 붙이기','사진과 소재',activeMaterialSample?'현재 선택한 범위에 복사한 소재를 붙입니다.':'먼저 3D 면을 선택하고 소재를 복사하세요.',()=>void transferMaterial('paste'),['paste','소재붙이기'],!canPasteMaterial),
        cmd('material-board','사용 중인 소재 한 번에 교체','사진과 소재','장면의 여러 부위에 쓴 소재를 비교하고 바꿉니다.',()=>void openMaterialBoard(),['재료','palette','일괄']),
        cmd('placement','가구 간격·원형 배치·정렬','가구 배치','기준 가구에서 간격을 지정하고 그룹 전체를 배치합니다.',openPlacement,['간격','relative','align','array','겹침','원형','radial']),
        cmd('assemblies','가구·설비 세트 보관함','가구 배치','저장한 가구 구성을 불러옵니다.',()=>openAssemblies(),['그룹','set','보관함']),
        cmd('model','3D 모델 가져오기 · GLB','가구 배치','GLB 파일을 배치하고 크기와 소재를 편집합니다.',()=>openModel(),['import','glb','외부 모델']),
        cmd('snapping','이동·회전 스냅 설정','가구 배치','격자 간격과 회전 단위를 조절합니다.',()=>{engine.current?.cancelTransform();setModal('snap-settings')},['snap','격자','정밀']),
        cmd('find-elements','가구·그룹 검색','가구 배치','이름·종류·레이어로 찾아 바로 선택합니다.',openSceneSearch,['find','search','검색','찾기']),
        cmd('focus','선택한 가구 크게 보기','시점','선택한 가구나 그룹이 화면에 들어오도록 맞춥니다.',()=>focusSelection(),['focus','zoom','확대'],false,'F'),
        cmd('layers','레이어 관리','가구 배치','용도별 표시·잠금·분류를 관리합니다.',openLayers,['layer','분류']),
        cmd('door-motion','문 개폐 동작 미리보기','공간 검토','경첩과 각도를 설정한 문을 움직여 확인합니다.',()=>openDoorMotion(),['swing','animation','문열기','애니메이션']),
        cmd('walk','매장 안 둘러보기','공간 검토','눈높이에서 걷고 통로를 확인합니다.',openWalk,['walk','보행','실내']),
        cmd('measure','두 점 사이 줄자','공간 검토','벽·바닥·가구 표면의 거리를 측정합니다.',startMeasuring,['measure','거리','측정'],false,'T'),
        cmd('measurements','치수 메모 관리','공간 검토','저장한 치수를 찾고 CSV로 내보냅니다.',openMeasurements,['치수목록','measurement']),
        cmd('section','단면으로 내부 보기','공간 검토','축과 위치를 조절하며 내부를 확인합니다.',openSection,['section','자르기','단면']),
        cmd('facade','간판·어닝·유리 전면','공간 검토','매장 외관을 편집합니다.',()=>openFacade(),['외관','간판','awning']),
        cmd('top','평면 시점','시점','위에서 내려다보는 정사영으로 전환합니다.',()=>selectView('top'),['top','2d','위']),
        cmd('perspective','3D 시점','시점','공간 전체를 회전하며 봅니다.',()=>selectView('perspective'),['3d','원근']),
        cmd('cameras','저장한 시점','시점','같은 시점에서 디자인을 비교합니다.',showCameras,['camera','카메라']),
        cmd('budget','수량·단가·예산 검토','저장과 전달','직접 입력한 단가와 예산을 비교합니다.',openBudget,['budget','견적','비용']),
        cmd('variants','디자인 안 저장·비교','저장과 전달','소재와 배치의 다른 안을 보관합니다.',()=>openReview('variants'),['variant','대안','비교']),
        cmd('plan','치수 평면도 · PDF / SVG','저장과 전달','A3 평면도와 가구 목록을 내보냅니다.',()=>openReview('plan'),['export','도면','print']),
        cmd('save','프로젝트 저장','저장과 전달','현재 편집 상태를 저장합니다.',()=>void saveRef.current(),['save','보관'],false,'Ctrl / ⌘ S'),
        cmd('projects','프로젝트 열기','저장과 전달','저장해 둔 공간을 불러옵니다.',()=>setModal('projects'),['open','프로젝트']),
        cmd('png','현재 시점 PNG 내보내기','저장과 전달','현재 3D 시점을 이미지로 저장합니다.',()=>void exportFile('png'),['export','이미지','사진']),
        cmd('selection-glb','선택 요소만 GLB 내보내기','저장과 전달','가구·그룹을 독립된 3D 파일로 저장합니다.',openSelectionExport,['export','선택','glb','모듈'],!node),
        cmd('glb','3D 모델 GLB 내보내기','저장과 전달','현재 문 각도를 포함한 3D 모델을 내보냅니다.',()=>void exportFile('glb'),['export','3d']),
        cmd('json','편집용 JSON 내보내기','저장과 전달','다시 편집할 수 있는 프로젝트 파일을 저장합니다.',()=>void exportFile('json'),['export','json']),
    ];
    const libraryContent = <><div className="library-heading"><div><span className="eyebrow">YOUR DESIGN TOOLKIT</span><h2>공간 라이브러리</h2></div></div><Tabs value={tab} onValueChange={setTab} className="library-tabs"><TabsList className="library-tab-list"><TabsTrigger value="materials"><Palette size={16}/>소재</TabsTrigger><TabsTrigger value="furniture"><Sofa size={16}/>가구</TabsTrigger><TabsTrigger value="photo"><ImagePlus size={16}/>사진</TabsTrigger></TabsList><TabsContent value="materials" className="library-tab-body">{materialGrid}</TabsContent><TabsContent value="furniture" className="library-tab-body"><div className="section-copy"><b>클릭 한 번으로 배치</b><p>추가한 가구는 화면에서 이동하세요.</p></div><button className="outline-button full underlay-open-button" onClick={openUnderlay}><Grid2X2 size={16}/>평면도 이미지 위에 배치</button><button className="outline-button full wall-open-button" onClick={openWalls}><PanelTop size={16}/>벽·파티션 연속 그리기</button><button className="outline-button full wall-open-button" onClick={()=>openOpenings()}><DoorOpen size={16}/>파티션에 통로·문·창문</button><button className="outline-button full model-import-button" onClick={() => openModel()}><Upload size={16}/>내 3D 모델 가져오기 · GLB</button><button className="outline-button full facade-open-button" onClick={()=>openFacade()}><Store size={17}/>간판 · 어닝 · 유리 전면</button><button className="primary-button full assembly-open-button" onClick={()=>openAssemblies()}><Layers size={17}/>가구·설비 세트 불러오기</button><div className="furniture-grid">{kinds.map(kind => { const Icon = icons[kind]; return <button key={kind} onClick={() => add(kind)}><span><Icon size={29} strokeWidth={1.4}/><Plus size={13}/></span><b>{kindNames[kind]}</b></button>; })}</div><p className="fineprint">문·창문은 기본적으로 안쪽 벽에 추가됩니다. 속성에서 연결할 벽을 바꿀 수 있습니다.</p></TabsContent><TabsContent value="photo" className="library-tab-body">{photoPanel}</TabsContent></Tabs><div className="library-bottom"><div className="small-heading"><span><Sparkles size={14}/>빠른 스타일</span><span>3</span></div>{[['내추럴 우드', '#c7a477', '#e9e5dc', '#d0c8b9'], ['모던 인더스트리얼', '#bfc5ca', '#b4b5b0', '#353a3d'], ['딥 월넛', '#77513d', '#777e61', '#d0c8b9']].map(([name, ...colors]) => <button className="style-row" key={name} onClick={() => preset(name)}><span className="style-dots">{colors.map(c => <i key={c} style={{ background: c }}/>)}</span><span>{name}</span><ChevronRight size={14}/></button>)}</div></>;
    const sampleBase=activeMaterialSample?materials.find(m=>m.id===activeMaterialSample.material):null;
    const materialCopyUi=<MaterialTransferControls sample={activeMaterialSample&&sampleBase?{name:sampleBase.name,color:activeMaterialSample.finish.color??sampleBase.color,textureId:activeMaterialSample.finish.textureId,sourceName:activeMaterialSample.sourceName}:null} canCopy={canCopyMaterial} canPaste={canPasteMaterial} busy={transferringMaterial} scopeLabel={multiple?`선택한 가구 ${selectedIds.length}개 전체`:surface?surfaceNames[selection!.id]:faceMode==='face'&&selection?.face?'선택한 면':'선택한 요소 전체'} onCopy={()=>void transferMaterial('copy')} onPaste={()=>void transferMaterial('paste')} onClear={()=>setCopiedMaterial(null)} onLibrary={()=>openMaterialPresets()} onSavePreset={()=>openMaterialPresets(true)}/>;
    const inspectorContent = <>{materialCopyUi}<LayerControls scene={scene} selection={selection} onAssign={assignSelectionLayer} onManage={openLayers}/><GroupControls scene={scene} selection={selection} editingGroupId={editingGroupId} onCreate={makeGroup} onRename={renameGroup} onUngroup={ungroupSelection} onEdit={enterGroupEdit} onExit={exitGroupEdit}/>{multiple?<BatchInspector scene={scene} selection={selection} onCommit={commit} onSelection={setSelection} onMaterials={showMaterials} onSaveSet={()=>openAssemblies(true)} onPlacement={openPlacement}/>:<><div className="inspector-title"><span className="eyebrow">PROPERTIES</span><h2>{currentName}</h2><span className="selection-label">{node ? kindNames[node.kind] : surface ? '공간 표면' : '선택한 요소 없음'}{selection?.face && faceMode === 'face' ? ' · 선택한 면' : ''}</span>{node?.estimated && <span className="estimate-label">초안 치수 · 현장 확인 필요</span>}</div>{selection && <><div className="property-section"><div className="small-heading"><span>선택 범위</span></div><Tabs value={faceMode} onValueChange={v => {
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
                }}/>}</div>{node && <><div className="property-section"><div className="small-heading"><span>크기</span><span>mm</span></div><div className="dimensions-grid">{(['width', 'height', 'depth'] as const).map((axis, i) => <NumberField key={axis} label={['가로', node.kind === 'box' || node.kind === 'cylinder' ? '돌출 높이' : '높이', '깊이'][i]} min={20} value={node[axis]} onCommit={v => updateNode(node.id, { [axis]: v })}/>)}</div>{mode === 'precise' && <><div className="small-heading spaced"><span>위치 & 회전</span></div><div className="dimensions-grid">{(['x', 'y', 'z'] as const).filter(axis => !node.host || axis === 'y' || (['back', 'front'].includes(node.host) ? axis === 'x' : axis === 'z')).map(axis => <NumberField key={axis} label={axis.toUpperCase()} value={node[axis]} min={axis === 'y' ? 0 : -20000} onCommit={v => updateNode(node.id, { [axis]: v })}/>)}</div>{!node.host && <NumberField label="회전" value={node.rotation} unit="°" min={-360} max={360} onCommit={v => updateNode(node.id, { rotation: v })}/>}</>}{node.host && <div className="spaced"><label className="field-label">연결된 벽</label><Select value={node.host} onValueChange={v => { const along = ['back', 'front'].includes(node.host!) ? node.x : node.z; updateNode(node.id, { host: v as SceneNode['host'], x: ['back', 'front'].includes(v) ? along : 0, z: ['left', 'right'].includes(v) ? along : 0, rotation: 0 }); }}><SelectTrigger className="full"><SelectValue /></SelectTrigger><SelectContent>{['back', 'left', 'right', 'front'].map(x => <SelectItem key={x} value={x}>{surfaceNames[x]}</SelectItem>)}</SelectContent></Select></div>}{node.kind==='partition'&&<button className="outline-button full wall-open-button" onClick={()=>openOpenings(node.id)} disabled={node.locked||node.hidden}><DoorOpen size={15}/>통로·문·창문 편집 · {node.openings?.length??0}개</button>}{node.openings?.some(o=>o.door)&&<button className="outline-button full wall-open-button" onClick={()=>openDoorMotion(node.id)} disabled={node.hidden}><DoorOpen size={15}/>문 개폐 동작 보기</button>}<button className="outline-button full arrange-button" onClick={openPlacement}><Grid2X2 size={15}/>배열·정렬·겹침 확인</button><button className="outline-button full assembly-save-button" disabled={!!node.host||node.hidden} onClick={()=>openAssemblies(true)}><Layers size={15}/>선택 가구를 세트로 저장</button><div className="object-actions"><button onClick={duplicate} disabled={node.locked}><Copy size={15}/>복제</button><button onClick={() => updateNode(node.id, { locked: !node.locked })}>{node.locked ? <Unlock size={15}/> : <Lock size={15}/>} {node.locked ? '해제' : '잠금'}</button><button onClick={removeSelected}><Trash2 size={15}/>삭제</button></div></div></>}</>}
 </>}<div className="property-section"><div className="small-heading"><span><Sun size={15}/>조명</span><span>{scene.lighting.warmth.toLocaleString()} K</span></div><Slider aria-label="조명 색온도" value={[scene.lighting.warmth]} min={2700} max={6500} step={100} onValueChange={v => previewLighting('warmth', v[0])} onValueCommit={commitLighting}/><div className="range-labels"><span>따뜻하게</span><span>시원하게</span></div><div className="small-heading spaced"><span>밝기</span><span>{Math.round(scene.lighting.intensity * 100)}%</span></div><Slider aria-label="조명 밝기" value={[scene.lighting.intensity]} min={.2} max={2} step={.1} onValueChange={v => previewLighting('intensity', v[0])} onValueCommit={commitLighting}/></div>
 <div className="property-section"><div className="small-heading"><span>장면 요소</span><button className="scene-layer-link" onClick={openSceneSearch}><Search size={13}/>찾기</button><button className="scene-layer-link" onClick={openLayers}><Layers size={13}/>레이어 {scene.layers?.length??0}</button></div><div className="scene-tree">{Object.entries(surfaceNames).map(([id, name]) => <button className={selection?.id === id ? 'selected' : ''} key={id} onClick={() => selectItem({ id })}><Square size={14}/><span>{name}</span></button>)}<FurnitureTree scene={scene} selection={selection} editingGroupId={editingGroupId} onSelect={selectItem} onSelectGroup={selectWholeGroup} onEdit={enterGroupEdit} onState={setNodeState}/></div></div><button className="text-button full" onClick={openPlacement}>가구 겹침 확인{conflicts.length ? ` · ${conflicts.length}곳` : ``}</button><button className="outline-button full budget-open-button" onClick={openBudget}><Calculator size={15}/>수량·단가·예산 검토</button><button className="outline-button full underlay-open-button" onClick={openUnderlay}><Grid2X2 size={15}/>도면 배경 · 실제 치수로 보정</button><button className="outline-button full room-settings" onClick={() => setModal('room')}><Ruler size={15}/>공간 치수 설정</button></>;
    return <TooltipProvider delayDuration={350}><Toaster position="bottom-right" richColors closeButton/><main className="studio" onDragOver={e => {
            if (e.dataTransfer.types.includes('Files'))
                e.preventDefault();
        }} onDrop={e => {
            if (!e.dataTransfer.files.length)
                return;
            e.preventDefault();
            if (!modal && !loadInFlight.current)
                (e.dataTransfer.files[0].name.toLowerCase().endsWith('.glb') ? openModel(e.dataTransfer.files[0]) : upload(e.dataTransfer.files[0]));
        }}><header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="SPATIAL 스튜디오"><span className="brand-mark"><Box size={23} strokeWidth={1.5}/></span><span>SPATIAL<small>INTERIOR STUDIO</small></span></a><div className="project-title"><span className="project-divider"/><button onClick={() => setModal('projects')}>{scene.name}<ChevronDown size={15}/></button><span className="project-tag">3D 프로젝트</span></div><div className="header-actions"><IconButton label="기능 검색 · Ctrl / ⌘ K" onClick={openCommands}><Search size={18}/></IconButton><span className="save-status"><Cloud size={14}/>{dirty && savedScene ? '저장하지 않은 변경' : saveState}</span><IconButton label="프로젝트 열기" onClick={() => setModal('projects')}><FolderOpen size={18}/></IconButton><IconButton label="AI 연결 설정" onClick={() => openAISettings()}><Settings2 size={18}/></IconButton><button className="outline-button save-button" onClick={() => save()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>}저장</button><DropdownMenu><DropdownMenuTrigger asChild><button className="primary-button export-button"><Download size={16}/><span>내보내기</span><ChevronDown size={13}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>openReview('plan')}><Grid2X2 size={16}/>치수 평면도 · PDF / SVG</DropdownMenuItem><DropdownMenuItem onClick={()=>openFacade()}><Store size={16}/>매장 외관 편집</DropdownMenuItem><DropdownMenuItem onClick={showCameras}><Camera size={16}/>저장한 시점</DropdownMenuItem><DropdownMenuItem onClick={()=>openReview('variants')}><Copy size={16}/>디자인 안 저장·비교</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={openRender}><Sparkles size={16}/>AI 컨셉 이미지 만들기</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('png')}><Camera size={16}/>현재 시점 이미지 · 2K PNG</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('glb')}><Box size={16}/>3D 모델 · GLB</DropdownMenuItem><DropdownMenuItem disabled={!node} onClick={openSelectionExport}><Box size={16}/>선택 요소만 · GLB</DropdownMenuItem><DropdownMenuItem onClick={() => exportFile('json')}><FileJson size={16}/>편집용 프로젝트 · JSON</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={()=>openAssemblies()}><Layers size={16}/>가구·설비 세트 보관함</DropdownMenuItem><DropdownMenuItem onClick={() => openModel()}><Box size={16}/>GLB 모델 가져오기</DropdownMenuItem><DropdownMenuItem onClick={() => importRef.current?.click()}><Upload size={16}/>프로젝트 파일 불러오기</DropdownMenuItem><DropdownMenuItem onClick={() => save(true)}><Copy size={16}/>새 사본으로 저장</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
 <div className="workspace"><SidebarProvider className="studio-sidebar-provider"><Sidebar collapsible="none" className="library"><SidebarContent>{libraryContent}</SidebarContent></Sidebar></SidebarProvider><section className="editor-surface"><div className="editor-bar"><div className="mode-controls"><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="easy">간편 편집</TabsTrigger><TabsTrigger value="precise"><Ruler size={14}/>정밀 편집</TabsTrigger></TabsList></Tabs></div><span className="editor-bar-spacer"/><IconButton label="가구·설비 수량과 예산" onClick={openBudget}><Calculator size={17}/></IconButton><IconButton label="레이어 관리 · 가구 분류·표시·잠금" onClick={openLayers}><Layers size={17}/></IconButton><IconButton label="선택한 가구 크게 보기 · F" onClick={()=>focusSelection()}><ScanLine size={17}/></IconButton><IconButton label="여러 가구 선택 · Shift 클릭" active={multiSelect} onClick={()=>{setMultiSelect(!multiSelect);setFaceMode('object')}}><Layers size={17}/></IconButton><button className="outline-button walk-open-button" onClick={openWalk}><Footprints size={16}/>둘러보기</button><IconButton label="줄자 · 치수 목록" onClick={openMeasurements}><Ruler size={17}/></IconButton><IconButton label="간판·어닝·유리 외관 편집" onClick={()=>openFacade()}><Store size={17}/></IconButton><IconButton label="디자인 안 저장·비교" onClick={()=>openReview('variants')}><Copy size={17}/></IconButton><button className="outline-button render-toolbar-button" onClick={openRender}><Sparkles size={15}/>AI 시안</button><IconButton label="실행 취소 · Ctrl Z" onClick={doUndo} disabled={!undo.length}><Undo2 size={17}/></IconButton><IconButton label="다시 실행 · Ctrl Shift Z" onClick={doRedo} disabled={!redo.length}><Redo2 size={17}/></IconButton><span className="toolbar-divider"/><IconButton label="사용 방법" onClick={() => setHelp(true)}><Info size={17}/></IconButton></div><div className="viewport"><SceneCanvas scene={proposal && preview ? proposal.scene : scene} selection={proposal ? null : selection} tool={proposal ? 'select' : tool} view={view} faceMode={faceMode} snap={snap} snapSettings={snapSettings} cutaway={cutaway} section={section} onSelect={selectItem} multiSelect={multiSelect} onTransformGroup={moveGroup} onTransform={updateNode} measurementsVisible={measurementsVisible} onMeasure={saveMeasurement} onMeasureStatus={(started,error)=>{setMeasureStarted(started);setMeasureError(error??'')}} onDrawStatus={setDrawStatus} onDraw={p => {
            const id = randomId();
            if (commit({ ...sceneRef.current, nodes: [...sceneRef.current.nodes, { ...createNode('box', id), ...p, height: 100 }] })) {
                setSelection({ id });
                setTool('select');
                toast.success('사각형을 만들었습니다. 속성의 높이로 돌출하세요.');
            }
        }} restoreCamera={restoreCamera} onReady={useCallback(e => { engine.current = e; }, [])}/><div className="viewport-top"><div className="scene-caption"><span className="eyebrow">WORKSPACE / 01</span><h1>생각한 공간을, 눈앞에.</h1>{scene.draft && <button className="draft-badge" onClick={() => setModal('draft-notes')}>{scene.draft.method === 'photo-ai' ? '사진 기반 추정 초안' : '배치 템플릿 초안'}<Info size={12}/></button>}<span>{(scene.room.width * scene.room.depth / 1000000).toFixed(1)} m²<span className="dot-separator">·</span>{(scene.room.width * scene.room.depth / 3305800).toFixed(1)}평<span className="dot-separator">·</span>{scene.room.source === 'example' ? '예시 치수' : scene.room.source === 'measured' ? '실측 입력' : '사용자 입력'}</span></div><button className="photo-pill" onClick={() => { setTab('photo'); setModal('photo'); }}><img src={photoUrl} alt=""/><span>{scene.photoId ? '내 매장 사진' : '사진에서 시작하기'}<small>컨셉을 3D 공간으로</small></span><ChevronRight size={15}/></button></div><div className="floating-tools"><IconButton label="단면 보기 · 축과 위치 조절" active={!!section} onClick={openSection}><Scissors size={18}/></IconButton><IconButton label="선택 · V" active={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={18}/></IconButton><IconButton label="이동 · M" active={tool === 'translate'} onClick={() => { setTool('translate'); setFaceMode('object'); }}><Move size={18}/></IconButton><IconButton label="회전 · R" active={tool === 'rotate'} onClick={() => { setTool('rotate'); setFaceMode('object'); }}><RotateCw size={18}/></IconButton><IconButton label="줄자로 두 점 측정 · T" active={tool==='measure'} onClick={startMeasuring}><Ruler size={18}/></IconButton><span /><IconButton label="가구 또는 형태 추가" onClick={() => {
            setTab('furniture');
            if (window.innerWidth <= 1050)
                setMobileLibrary(true);
        }}><Plus size={19}/></IconButton>{mode === 'precise' && <><IconButton label="사각형 그리기 · 두 모서리 클릭" active={tool === 'draw'} onClick={() => { setTool('draw'); selectView('top'); toast('바닥 위에 사각형의 대각선 두 모서리를 차례로 클릭하세요.'); }}><Square size={18}/></IconButton><IconButton label="벽·파티션 연속 그리기" onClick={openWalls}><PanelTop size={18}/></IconButton></>}</div><>{tool==='draw'?<div className="measure-tool-prompt" role="status"><div><Square size={17}/><b>{drawStatus.started?'반대쪽 모서리를 클릭하세요':'첫 모서리를 클릭하세요'}</b><button onClick={()=>{engine.current?.cancelDrawing();setTool('select')}}>그리기 종료</button></div>{drawStatus.started?<p><b>{drawStatus.width.toLocaleString()} × {drawStatus.depth.toLocaleString()} mm</b>{drawStatus.width<50||drawStatus.depth<50?' · 각 변 50mm 이상으로 그리세요':' · 클릭해서 사각형 확정'}</p>:<p>사각형의 대각선 두 모서리를 차례로 클릭합니다.</p>}<p>{snap?`${snapSettings.translation}mm 격자`:'자유 배치'} · Esc로 첫 점 취소 · 만든 뒤 높이를 입력해 돌출</p></div>:tool==='measure'?<div className="measure-tool-prompt" role="status"><div><Ruler size={17}/><b>{measureStarted?'끝점을 클릭하세요':'시작점을 클릭하세요'}</b><button onClick={()=>{engine.current?.cancelMeasurement();setTool('select');}}>측정 종료</button></div><p>{measureError||'가구·벽·바닥의 두 점 사이 직선 거리 · Esc로 첫 점 취소'}</p><button className="text-button" onClick={openMeasurements}>저장한 치수 {scene.measurements?.length??0}개 보기</button></div>:editingGroupId?<div className="multi-selection-pill group-edit-pill"><Pencil size={15}/><span>그룹 안 편집 중</span><button onClick={exitGroupEdit}>편집 완료 · Esc</button></div>:(multiple||multiSelect)&&<div className="multi-selection-pill"><Layers size={15}/><span>{activeGroup?activeGroup.name:`${selectedIds.length}개 선택`}</span>{activeGroup&&<button onClick={()=>enterGroupEdit(activeGroup.id)}>안 편집</button>}<button onClick={()=>{setSelection(null);setMultiSelect(false)}}>선택 해제</button></div>}</><>{section&&sectionPanel&&<SectionPanel room={(proposal&&preview?proposal.scene:scene).room} value={section} onChange={changeSection} onClose={()=>setSectionPanel(false)} onSaveCamera={showCameras} onPng={()=>void exportSectionPng()} exporting={sectionExporting}/>}{section&&!sectionPanel&&<button className="section-view-badge" onClick={()=>setSectionPanel(true)}><Scissors size={14}/>{sectionDescription((proposal&&preview?proposal.scene:scene).room,section)} · 설정</button>}</><>{view==='top'&&!section&&<div className="underlay-view-controls"><button onClick={openWalls} disabled={!!proposal}><PanelTop size={14}/>벽 그리기</button><button onClick={openUnderlay}><Grid2X2 size={14}/>{scene.underlay?'도면 배경 설정':'평면도 이미지 추가'}</button>{scene.underlay&&<><button aria-label={scene.underlay.visible?'도면 배경 숨기기':'도면 배경 표시하기'} disabled={!!proposal} onClick={toggleUnderlay}>{scene.underlay.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><button disabled={underlayExporting||!scene.underlay.visible||!!proposal} onClick={()=>void exportUnderlayPng()}><Download size={14}/>{underlayExporting?'준비 중…':'배경 포함 PNG'}</button></>}</div>}</><div className="view-controls"><Tabs value={view} onValueChange={v => selectView(v as ViewMode)}><TabsList><TabsTrigger value="perspective"><Box size={14}/>3D</TabsTrigger><TabsTrigger value="top"><Grid2X2 size={14}/>평면</TabsTrigger><TabsTrigger value="interior"><Eye size={14}/>실내</TabsTrigger><TabsTrigger value="front"><Store size={14}/>외관</TabsTrigger></TabsList></Tabs></div><div className="zoom-controls"><IconButton label="확대" onClick={() => engine.current?.zoom(.85)}><Plus size={17}/></IconButton><IconButton label="축소" onClick={() => engine.current?.zoom(1.18)}><Minus size={17}/></IconButton><IconButton label="전체 공간 보기" onClick={() => {changeSection(null);selectView('perspective');}}><Maximize size={17}/></IconButton></div><div className="viewport-bottom"><span><MousePointer2 size={13}/>{tool==='draw'?'모서리를 클릭 · 확대 버튼으로 시점 조절':'드래그로 회전 · 스크롤로 확대'}</span><button onClick={showCameras}><Camera size={14}/>시점 저장</button></div>{proposal && <div className="proposal-card"><div className="proposal-head"><span><Sparkles size={16}/>{proposal.source} 미리보기</span><button aria-label="제안 닫기" onClick={() => setProposal(null)}><X size={16}/></button></div><b>{proposal.title}</b><p>{proposal.details}</p><div className="proposal-actions">{proposal.openingPlan&&proposal.scene.nodes.find(n=>n.id===proposal.openingPlan!.nodeId)?.openings?.some(o=>o.door)&&<button className="outline-button" onClick={()=>openDoorMotion(proposal.openingPlan!.nodeId,proposal.scene)}><DoorOpen size={14}/>문 동작 보기</button>}{proposal.openingPlan&&<button className="outline-button" onClick={reviseOpenings}><Pencil size={14}/>개구부 수정</button>}{proposal.wallPlan&&<button className="outline-button" onClick={reviseWalls}><Pencil size={14}/>그리기 수정</button>}<button className="outline-button" onClick={() => setPreview(!preview)}>{preview ? '변경 전 보기' : '제안 보기'}</button><button className="primary-button" onClick={() => {
                if(proposal.openingPlan){try{acceptPartitionOpenings(sceneRef.current,proposal.openingPlan,projectSession.current,proposal.openingSession!);}catch(e){setProposal(null);toast.error((e as Error).message);return;}}
                if(proposal.wallPlan){try{acceptWallPlan(sceneRef.current,proposal.wallPlan,projectSession.current,proposal.wallSession!);}catch(e){setProposal(null);toast.error((e as Error).message);return;}}
                if(proposal.materialPlan){try{acceptMaterialPlan(sceneRef.current,proposal.materialPlan,projectSession.current,proposal.materialSession!);}catch(e){setProposal(null);toast.error((e as Error).message);return;}}
                if(proposal.placement){try{acceptPlacementPlan(sceneRef.current,proposal.placement,projectSession.current,proposal.placementSession!);}catch(e){setProposal(null);toast.error((e as Error).message);return;}}
                if(proposal.baseScene&&proposal.baseScene!==JSON.stringify(sceneRef.current)){setProposal(null);toast.error('미리보기 중 장면이 변경되었습니다. 작업을 다시 미리보기하세요.');return;}
                if(!commit(proposal.scene,'변경을 적용했습니다. 실행 취소로 되돌릴 수 있습니다.'))return;
                setEditingGroupId(null);
                if(proposal.addedIds?.length){setEditingGroupId(null);setSelection({id:proposal.addedIds[0],ids:proposal.addedIds});setFaceMode('object');setTool('translate');setMultiSelect(false);}
                if(proposal.openingPlan){const target=proposal.scene.nodes.find(n=>n.id===proposal.openingPlan!.nodeId);if(target){setEditingGroupId(target.group?.id??null);setSelection({id:target.id});setFaceMode('face');setTool('select');setMultiSelect(false);}}
                if (proposal.newProject) {
                    projectSession.current++;
                    setProjectId(null);
                    setRevision(0);
                    setSavedScene('');
                    setSelection(null);
                    resetProjectView(proposal.scene);
                }
            }}><Check size={15}/>이대로 적용</button></div></div>}</div>
 <div className="ai-composer"><div className="composer-heading"><span><Sparkles size={15}/>AI 디자인 어시스턴트</span><button onClick={() => openAISettings()} className={aiReady || apiKey ? 'connected' : ''}>{aiReady ? '서버 AI 키 설정됨' : apiKey ? 'AI 키 입력됨' : 'AI 연결 설정'}<ChevronRight size={12}/></button></div><form onSubmit={e => { e.preventDefault(); askAI(); }}><input aria-label="AI 공간 편집 요청" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="원하는 공간을 말해보세요. 예: 벽을 웜 화이트로 바꿔줘" maxLength={2000}/><button className="send-button" aria-label="편집 제안 받기" disabled={!prompt.trim() || aiBusy}>{aiBusy ? <LoaderCircle className="spin" size={18}/> : <ArrowUp size={18}/>}</button></form><div className="prompt-examples">{['벽을 웜 화이트로', '테이블 3개 추가', '조명을 따뜻하게'].map(x => <button key={x} onClick={() => setPrompt(x)}>{x}<Plus size={11}/></button>)}<span>기본 명령은 바로 사용 가능</span></div></div></section><aside className="inspector">{inspectorContent}</aside></div><footer className="statusbar"><div><span className="status-square"/>3D 편집 공간<span className="status-separator">/</span><span>{selection ? currentName : '요소를 선택하세요'}</span></div><div><label><Switch checked={cutaway} disabled={view==='front'||!!section} onCheckedChange={setCutaway} aria-label="시야를 가리는 벽 자동 숨김"/>{section?'단면 위치로 표시':view==='front'?'외관 전체 표시':'벽 자동 숨김'}</label><label><Switch checked={snap} onCheckedChange={setSnap} aria-label="이동과 회전 격자 스냅"/>스냅</label><button onClick={()=>{engine.current?.cancelTransform();setModal('snap-settings')}} aria-label="이동 및 회전 스냅 간격 설정">{snapSettings.translation}mm · {snapSettings.rotation}°</button><button onClick={() => setHelp(true)}><Keyboard size={13}/>사용 안내</button><span className="unit-status">단위: mm</span></div></footer><nav className="mobile-toolbar"><button onClick={() => setMobileLibrary(true)}><Layers size={19}/>라이브러리</button><button onClick={() => setMobileInspector(true)}><SlidersHorizontal size={19}/>속성</button><button onClick={() => uploadRef.current?.click()}><ImagePlus size={19}/>사진</button><button onClick={() => setModal('room')}><Ruler size={19}/>공간</button><button onClick={openCommands}><Search size={19}/>기능 찾기</button></nav></main>
 <input ref={uploadRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => upload(e.target.files?.[0])}/><input ref={importRef} type="file" className="hidden" accept=".json" onChange={e => importProject(e.target.files?.[0])}/>
 <Sheet open={mobileLibrary} onOpenChange={setMobileLibrary}><SheetContent side="left" className="mobile-sheet"><SheetHeader><SheetTitle>공간 라이브러리</SheetTitle><SheetDescription>소재와 가구를 선택하세요.</SheetDescription></SheetHeader>{libraryContent}</SheetContent></Sheet><Sheet open={mobileInspector} onOpenChange={setMobileInspector}><SheetContent className="mobile-sheet"><SheetHeader><SheetTitle>선택한 요소 편집</SheetTitle><SheetDescription>크기와 소재를 조정하세요.</SheetDescription></SheetHeader>{inspectorContent}</SheetContent></Sheet>
 {draftSnapshot&&(modal==='draft'||(modal==='settings'&&nextModal==='draft'))&&<PhotoDraftDialog open={modal==='draft'} onClose={()=>setModal(null)} scene={draftSnapshot.scene} photoUrl={draftSnapshot.photoUrl} apiKey={apiKey} aiReady={aiReady} onConnect={()=>openAISettings('draft')} onReady={draft=>{const baseScene=JSON.stringify(draftSnapshot.scene);if(draftSnapshot.session!==projectSession.current||baseScene!==JSON.stringify(sceneRef.current)||draftSnapshot.photoUrl!==photoUrlRef.current)return false;setProposal({scene:draft,title:draft.draft?.summary??'새 3D 초안',details:draft.draft?.notes.slice(0,3).join(' ')??'',source:'3D 초안',newProject:true,baseScene});setPreview(true);setMobileLibrary(false);return true;}}/>}
 <DesignVariantsDialog open={modal==='variants'} onClose={()=>setModal(null)} scene={scene} onCommit={commit} onPreview={id=>{const v=scene.variants?.find(v=>v.id===id);if(!v)return;setProposal({scene:restoreVariant(scene,id),title:v.name,details:v.note||'저장한 배치·소재·조명을 현재 공간과 비교하세요.',source:'디자인 안'});setPreview(true)}}/>
 {modal==='facade'&&<FacadeDialog scene={scene} initialTab={facadeTab} onClose={()=>setModal(null)} onPreview={(candidate,summary)=>{setProposal({scene:candidate,title:'매장 외관 제안',details:summary,source:'외관'});setPreview(true);setSelection(null);setTool('select');engine.current?.setScene(candidate);selectView('front');setModal(null)}}/>}
 {modal==='assemblies'&&<AssembliesDialog key={projectSession.current} scene={scene} ids={selectedIds.filter(id=>scene.nodes.some(n=>n.id===id))} initialSave={assemblySave} onClose={()=>setModal(null)} onPreview={(candidate,ids,name,details,base)=>{if(assemblySession.current!==projectSession.current||base!==JSON.stringify(sceneRef.current)){toast.error('장면이 변경되었습니다. 세트 보관함을 다시 열어 주세요.');setModal(null);return;}setProposal({scene:candidate,title:name,details,source:'가구 세트',baseScene:base,addedIds:ids});setPreview(true);setModal(null);setTool('select');if(view==='front')selectView('perspective');}}/>}
 {modal==='budget'&&<BudgetDialog key={projectSession.current} scene={scene} onClose={()=>setModal(null)} onChange={budgetCommit} onSelect={selectBudgetItems} onUndo={doUndo} onRedo={doRedo} canUndo={!!undo.length} canRedo={!!redo.length}/>}
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
 <RenderDialog open={modal === 'render'} onClose={() => setModal(null)} scene={scene} view={view==='front'?'exterior':'interior'} photoUrl={photoUrl} apiKey={apiKey} aiReady={aiReady} onConnect={() => { openAISettings('render'); }} capture={captureForRender} onResult={r => { if (renderSnapshot.current.session !== projectSession.current || renderSnapshot.current.scene !== renderSceneIdentity(sceneRef.current)) {
        toast('생성한 이미지는 시안 보관함에 저장했습니다.');
        return;
    } commit({ ...sceneRef.current, renders: [...(sceneRef.current.renders ?? []).slice(-19), r] }, 'AI 시안을 보관했습니다. 프로젝트를 저장하면 함께 연결됩니다.'); }}/>
 {modal==='material-presets'&&<MaterialPresetsDialog sample={activeMaterialSample} initialSave={materialPresetSave} onClose={()=>setModal(null)} onChoose={sample=>{setCopiedMaterial({sample,session:projectSession.current});setModal(null);toast.success('소재를 가져왔습니다. 원하는 면을 선택하고 붙이세요.');}}/>}
 <Dialog open={modal==='selection-export'} onOpenChange={open=>!open&&closeSelectionExport()}><DialogContent><DialogHeader><DialogTitle>선택한 요소만 GLB로 저장</DialogTitle><DialogDescription>현재 소재와 문 각도를 포함한 독립 3D 파일을 만듭니다.</DialogDescription></DialogHeader><p>{selectionExport?.ids.length??0}개 요소 · {selectionExport?.scene.nodes.filter(n=>selectionExport.ids.includes(n.id)).slice(0,3).map(n=>n.name).join(' / ')}{(selectionExport?.ids.length??0)>3?' 외':''}</p><fieldset disabled={selectionExportBusy} className="field-label"><legend>내보내기 원점</legend><label><input type="radio" name="export-origin" checked={exportOrigin==='center'} onChange={()=>setExportOrigin('center')}/>선택 영역 바닥 중심 · 다른 공간에서 재사용</label><label><input type="radio" name="export-origin" checked={exportOrigin==='world'} onChange={()=>setExportOrigin('world')}/>현재 프로젝트 좌표 · 원래 위치에 조합</label></fieldset><p className="fineprint">선택한 구성만 내보냅니다. 전체 그룹을 선택하면 그룹 구성을 유지하며, 일부만 선택하면 개별 요소로 저장합니다. 편집 기록은 프로젝트 JSON에 보관하세요.</p><button className="primary-button full" disabled={selectionExportBusy||!selectionExport} onClick={()=>void exportSelected()}>{selectionExportBusy?<LoaderCircle className="spin" size={16}/>:<Download size={16}/>}선택 요소 GLB 저장</button></DialogContent></Dialog>
 <Dialog open={modal==='snap-settings'} onOpenChange={open=>!open&&setModal(null)}><DialogContent><DialogHeader><DialogTitle>이동·회전 스냅</DialogTitle><DialogDescription>그리기와 이동의 간격, 가구를 회전하는 각도 단위를 정하세요.</DialogDescription></DialogHeader><label className="field-label">격자에 맞추기<Switch checked={snap} onCheckedChange={setSnap} aria-label="격자 스냅 사용"/></label><label className="field-label">이동·사각형 그리기 · mm<Select value={String(snapSettings.translation)} onValueChange={v=>setSnapSettings(s=>({...s,translation:Number(v)}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[5,10,25,50,100,250,500].map(v=><SelectItem key={v} value={String(v)}>{v} mm</SelectItem>)}</SelectContent></Select></label><label className="field-label">회전 · 도<Select value={String(snapSettings.rotation)} onValueChange={v=>setSnapSettings(s=>({...s,rotation:Number(v)}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,5,15,30,45,90].map(v=><SelectItem key={v} value={String(v)}>{v}°</SelectItem>)}</SelectContent></Select></label><p className="fineprint">줄자 측정은 클릭한 표면을 그대로 사용합니다. 연속 벽 그리기 창은 해당 창의 50mm 격자를 사용합니다. 이 설정은 현재 기기에 보관됩니다.</p><button className="outline-button" onClick={()=>{setSnapSettings(defaultSnapSettings);setSnap(true)}}>기본값 · 50mm / 15°</button><button className="primary-button" onClick={()=>setModal(null)}>완료</button></DialogContent></Dialog>
 <CommandPalette open={modal==='commands'} onOpenChange={open=>setModal(open?'commands':null)} commands={commands}/>
 {modal==='scene-search'&&<SceneSearchDialog scene={scene} onClose={()=>setModal(null)} onChoose={chooseSearchResult}/>}
 {modal==='door-motion'&&doorMotionSnapshot&&<DoorMotionDialog scene={doorMotionSnapshot.scene} nodeId={doorMotionSnapshot.nodeId} onClose={()=>setModal(null)}/>}
 {modal==='partition-openings'&&openingSnapshot&&<PartitionOpeningsDialog scene={openingSnapshot.scene} nodeId={openingSnapshot.nodeId} initial={openingSnapshot.openings} onClose={()=>setModal(null)} onPreview={previewOpenings}/>}
 {modal==='walls'&&wallSnapshot&&<WallDrawingDialog scene={wallSnapshot.scene} initial={wallSnapshot.request} onClose={()=>setModal(null)} onPreview={previewWalls}/>}
 {modal==='underlay'&&underlaySnapshot&&<UnderlayDialog key={underlaySnapshot.session} scene={underlaySnapshot.scene} onClose={()=>setModal(null)} onApply={applyUnderlay}/>}
 {modal==='material-board'&&materialSnapshot&&<MaterialBoardDialog scene={materialSnapshot.scene} catalog={materialSnapshot.catalog} selection={selection} onClose={()=>setModal(null)} onPreview={previewMaterial}/>}
 {modal==='layers'&&<LayersDialog key={projectSession.current} scene={scene} selection={selection} onClose={()=>setModal(null)} onCreate={createSceneLayer} onAssign={assignSelectionLayer} onEdit={changeSceneLayer} onSelect={selectLayerMembers} onUndo={doUndo} onRedo={doRedo} canUndo={!!undo.length} canRedo={!!redo.length}/>}
 {modal==='walk'&&<WalkthroughDialog key={projectSession.current} scene={scene} onClose={()=>setModal(null)} onSaveCamera={(camera,name)=>{if(!walkCurrent())return false;return commit({...sceneRef.current,cameras:[...sceneRef.current.cameras,{id:randomId(),name,...camera}]},'둘러보기 시점을 저장했습니다.');}} onDownload={png=>{if(walkCurrent())download(png,`${sceneRef.current.name}-실내-둘러보기.png`);}}/>}
 {modal==='measurements'&&<MeasurementsDialog scene={scene} onClose={()=>setModal(null)} onAdd={startMeasuring} onEdit={changeMeasurement} onFocus={id=>{changeSection(null);const m=sceneRef.current.measurements?.find(m=>m.id===id);if(m?.hidden&&!changeMeasurement(id,{type:'hidden',value:false}))return;setModal(null);setMeasurementsVisible(true);engine.current?.focusMeasurement(id);}} visible={measurementsVisible} onVisible={setMeasurementsVisible} onCsv={()=>download(new Blob([measurementsCsv(sceneRef.current)],{type:'text/csv;charset=utf-8'}),`${sceneRef.current.name}-치수.csv`)} onPng={()=>void exportMeasurementPng()} exporting={exportingMeasures}/>}
 {modal==='placement'&&<PlacementDialog key={projectSession.current} onClose={()=>setModal(null)} scene={scene} selection={selection} editingGroupId={editingGroupId} onSelect={selectItem} onPreview={plan=>{try{const candidate=acceptPlacementPlan(sceneRef.current,plan,projectSession.current,placementSession.current);setProposal({scene:candidate,title:plan.request.type==='array'?'반복 배치 제안':plan.request.type==='radial'?'원형 배치 제안':plan.request.type==='relative'?'가구 간격 배치 제안':'그룹·가구 정렬 제안',details:`${plan.summary} · 새 외곽 겹침 ${plan.overlaps.length}곳`,source:'배열·정렬',baseScene:plan.baseScene,addedIds:plan.resultIds,placement:plan,placementSession:placementSession.current});setPreview(true);setModal(null);setTool('select');if(view==='front')selectView('perspective');}catch(e){toast.error((e as Error).message);setModal(null);}}}/>}
 <Dialog open={modal === 'photo'} onOpenChange={o => !o && setModal(null)}><DialogContent className="photo-dialog"><DialogHeader><DialogTitle>사진에서 시작하는 공간</DialogTitle><DialogDescription>실제 매장 사진의 분위기를 3D 공간에 반영해 보세요.</DialogDescription></DialogHeader><img className="dialog-photo" src={photoUrl} alt="매장 참고 사진"/><div className="photo-dialog-actions"><button className="primary-button" onClick={openPhotoDraft}><Box size={16}/>새 3D 초안 만들기</button><button className="outline-button" onClick={() => uploadRef.current?.click()} disabled={uploading}><Upload size={16}/>{uploading ? '업로드 중…' : '내 사진 올리기'}</button><button className="outline-button" onClick={analyzePalette}><Palette size={16}/>사진 색감 적용</button><button className="primary-button" onClick={() => askAI(true)} disabled={aiBusy}><Sparkles size={16}/>{aiBusy ? '분석 중…' : 'AI 컨셉 적용'}</button></div><p className="fineprint">{scene.photoId ? '내 매장 사진' : '예시 카페 · Unsplash'} · 사진은 디자인 참고로 사용됩니다. 실제 공간은 치수를 입력해 보정할 수 있습니다.</p></DialogContent></Dialog>
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
 <Dialog open={modal === 'settings'} onOpenChange={o => !o && closeAISettings()}><DialogContent><DialogHeader><DialogTitle>AI 디자인 연결</DialogTitle><DialogDescription>사진 분석·AI 시안·문장 편집에 OpenAI를 사용합니다.</DialogDescription></DialogHeader><div className="connection-status"><Link2 size={20}/><div><b>{aiConfigStatus==='checking'?'서버 설정 확인 중':aiConfigStatus==='unavailable'?'서버 설정을 확인하지 못함':aiReady?'서버에 AI 키가 설정됨':apiKey?'이 세션에 키가 입력됨':'AI 서비스 연결 전'}</b><p>키 설정과 실제 AI 응답은 별개입니다. 첫 요청이 성공하면 해당 기능의 사용을 확인할 수 있습니다.</p></div></div>{signedIn===false&&<p role="status" className="fineprint">AI 요청과 온라인 저장에는 로그인된 사이트 접속이 필요합니다.</p>}<p className="fineprint">소재 편집·가구 배치·빠른 명령은 AI 연결 없이 사용할 수 있습니다.</p>{!aiReady && <><label className="field-label">OpenAI API 키<input className="text-input" type="password" autoComplete="off" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="sk-…"/></label><p className="fineprint">키는 현재 페이지의 메모리에서만 사용되며 저장하지 않습니다. AI 요청 시 장면 정보와 선택한 사진이 OpenAI로 전송되고 API 사용료가 발생합니다.</p><button className="primary-button full" disabled={!keyDraft.trim()} onClick={() => { setApiKey(keyDraft.trim()); setKeyDraft(''); setModal(nextModal); setNextModal(null); toast('키를 입력했습니다. 첫 AI 요청에서 연결을 확인합니다.'); }}>현재 세션에 연결</button>{apiKey && <button className="text-button full" onClick={() => { setApiKey(''); toast('세션의 키를 지웠습니다.'); }}>연결 해제</button>}</>}<button className="outline-button full" onClick={closeAISettings}>{nextModal?'이전 작업으로 돌아가기':'닫기'}</button></DialogContent></Dialog>
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
 <Dialog open={modal === 'cameras'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>저장한 시점</DialogTitle><DialogDescription>같은 시점에서 소재와 배치를 비교하세요. 단면 설정도 함께 저장하며, 공간 크기가 바뀌면 같은 비율의 위치를 사용합니다.</DialogDescription></DialogHeader>{scene.cameras.map(c => <div className="camera-row" key={c.id}><button className="outline-button" onClick={() => { setSection(c.section??null);sectionRef.current=c.section??null;setSectionPanel(!!c.section);setToolState('select');setView(c.view ?? 'perspective'); setRestoreCamera({ ...c }); setModal(null); }}><Camera size={15}/>{c.name}{c.section&&<Scissors size={13}/>}</button><IconButton label={`${c.name} 삭제`} disabled={!!proposal} onClick={() => commit({ ...scene, cameras: scene.cameras.filter(x => x.id !== c.id) })}><Trash2 size={15}/></IconButton></div>)}{!scene.cameras.length && <p className="empty-copy">아직 저장한 시점이 없습니다.</p>}<label className="field-label camera-name-field">시점 이름<input className="text-input" value={cameraName} maxLength={80} onChange={e=>setCameraName(e.target.value)} placeholder={view==='front'?'예: 정면 간판 검토':'예: 입구에서 본 실내'}/></label>{proposal&&<p className="fineprint">비교 중에는 저장된 시점으로 이동할 수 있습니다. 새 시점 저장과 삭제는 제안 적용 후 가능합니다.</p>}<button className="primary-button full" disabled={scene.cameras.length >= 10||!!proposal} onClick={() => {
            const c = engine.current?.captureCamera();
            if (c)
                commit({ ...scene, cameras: [...scene.cameras, { id: randomId(), name: cameraName.trim()||`${view==='front'?'외관':view==='top'?'평면':view==='interior'?'실내':'3D'} 시점 ${scene.cameras.length + 1}`, ...c }] }, '현재 시점을 저장했습니다.');
        }}><Plus size={16}/>현재 시점 저장</button></DialogContent></Dialog>
 <Dialog open={modal === 'draft-notes'} onOpenChange={o => !o && setModal(null)}><DialogContent><DialogHeader><DialogTitle>이 공간을 만든 기준</DialogTitle><DialogDescription>{scene.draft?.summary}</DialogDescription></DialogHeader><ul className="draft-notes">{scene.draft?.notes.map((note, i) => <li key={i}>{note}</li>)}</ul><p className="fineprint">기본 배치와 사진 분석은 설계 초안입니다. 가구의 추정 치수는 속성에서 보정할 수 있습니다.</p></DialogContent></Dialog>
 <Dialog open={help} onOpenChange={setHelp}><DialogContent className="studio-help-dialog" onCloseAutoFocus={event=>{if(modalRef.current)event.preventDefault();}}><DialogHeader><DialogTitle>공간을 편집하는 방법</DialogTitle><DialogDescription>클릭으로 시작하고, 치수로 완성하세요.</DialogDescription></DialogHeader><Tabs defaultValue="start" className="studio-help-tabs"><TabsList aria-label="사용 안내 종류"><TabsTrigger value="start">빠른 시작</TabsTrigger><TabsTrigger value="tools">도구 안내</TabsTrigger><TabsTrigger value="keys">단축키</TabsTrigger></TabsList><TabsContent value="start"><QuickStartGuide onAction={quickStartAction} disabled={commandBlocked}/>{commandBlocked&&<p className="fineprint" role="status">{commandReason}</p>}</TabsContent><TabsContent value="tools"><div className="help-steps"><p><b>기능 검색 · Ctrl / ⌘ K</b>상단 돋보기에서 기능 이름을 입력하고 Enter로 실행하세요. 장면 요소의 찾기에서는 가구 이름·레이어·그룹으로 검색해 바로 이동합니다. F는 선택한 요소를 크게 보여줍니다.</p><p><b>문 개폐와 가구 간격</b>파티션 통로·문·창문 편집에서 경첩·방향·개방 각도를 정하세요. 문 동작 보기는 별도 미리보기이며 저장할 각도는 개구부 편집에서 적용합니다. 가구 간격·배열·정렬에서는 기준 가구와의 외곽 간격을 mm로 지정할 수 있습니다.</p><p><b>소재 복사 · 붙이기</b>3D 면을 선택하고 속성의 소재 복사를 누르세요. 다른 면을 선택해 붙이면 이미지·크기·회전·광택도 함께 적용됩니다. 객체 전체 모드에서는 모든 부위에 붙이며, 그룹을 선택하면 구성 전체에 적용합니다. 보관하기로 이름을 붙이면 내 소재 보관함에서 다른 프로젝트에도 가져올 수 있습니다.</p><p><b>01 · 선택 & 소재</b>3D 공간의 벽·바닥·가구를 클릭한 뒤 소재를 고르세요. Shift 클릭 또는 여러 가구 선택 버튼으로 함께 편집할 수 있습니다.</p><p><b>그룹으로 함께 편집</b>가구를 여러 개 선택하고 속성의 그룹으로 묶기를 누르세요. 그룹 안 편집에서 개별 가구를 수정하고, 완료 또는 Esc로 돌아옵니다. 저장한 세트를 배치하면 자동으로 묶입니다. 속성의 반복 배치·벽 정렬에서 그룹 전체를 원하는 간격으로 배열하고 3D에서 확인하세요.</p><p><b>02 · 이동 & 크기</b>이동 도구의 축을 드래그하거나 정밀 편집에서 mm 치수를 입력하세요. 하단 스냅 설정에서 이동 간격과 회전 각도를 바꿀 수 있습니다. 사각형 그리기에서는 두 번째 모서리를 찍기 전에 실제 크기와 윤곽을 미리 볼 수 있습니다. 원형 배치는 중심·추가 개수·전체 각도를 정하고 구성의 회전 여부를 선택합니다.</p><p><b>줄자 · 치수 메모</b>T 또는 줄자 도구로 두 점을 찍으세요. 드래그로 시점을 바꿀 수 있으며, 격자 스냅 없이 클릭한 표면을 측정합니다. 위쪽 줄자 버튼에서 이름·표시·CSV·치수 포함 PNG를 관리하세요.</p><p><b>03 · 사진 & AI</b>사진을 올려 색감을 가져오세요. AI 연결 후 소재 컨셉도 제안받을 수 있습니다.</p><p><b>04 · 외관 & 시점</b>외관 편집에서 간판·어닝·유리 전면을 구성하세요. 3D의 간판·어닝을 클릭하면 설정이 열립니다. 외관 시점에서는 전면을 모두 표시합니다.</p><p><b>평면도 이미지 위에 배치</b>평면 보기의 도면 배경 버튼에서 PNG·JPG를 올리고, 두 점 사이 실제 거리로 축척을 맞추세요. 배경 중심·회전·불투명도를 조절한 뒤 가구·파티션을 배치할 수 있습니다. 배경 포함 PNG로 별도 저장하세요.</p><p><b>단면으로 내부 확인</b>왼쪽 가위 아이콘에서 좌우·높이·앞뒤 축, 위치, 남길 방향을 조절하세요. 시점과 단면 PNG를 저장할 수 있습니다. 이동·측정·그리기로 전환하면 전체 형상으로 돌아갑니다. AI 시안 입력과 GLB는 전체 형상을 사용합니다.</p><p><b>수량과 예산 검토</b>계산기 버튼에서 가구별 단가를 입력하세요. 숨긴 가구도 기본 예산에 포함하며, 규격·소재가 바뀌면 단가 재검토를 표시합니다. 목표·별도 비용과 디자인 안 비교, 전체 예산 CSV·인쇄를 지원합니다.</p><p><b>레이어로 용도별 정리</b>상단 레이어 관리에서 분류를 만들고, 가구를 선택해 배정하세요. 그룹은 함께 이동하며 레이어별 표시·잠금과 해당 레이어만 보기를 지원합니다. 레이어 삭제 시 가구는 미분류에 남습니다.</p><p><b>매장 안 둘러보기</b>상단 둘러보기에서 눈높이를 선택하고, 드래그로 시선을 바꾸세요. W A S D 또는 화면 버튼으로 이동합니다. 평면도에서 위치를 바꾸고 시점·PNG를 저장할 수 있습니다.</p><p><b>선택 요소를 다시 쓰기</b>가구나 그룹을 선택하고 내보내기의 선택 요소만 · GLB를 누르세요. 바닥 중심 원점은 다른 프로젝트에서 재사용하기 쉽고, 현재 좌표 원점은 기존 위치에 조합하기 좋습니다.</p><p><b>05 · 저장 & 내보내기</b>디자인 안으로 배치를 비교하고, 치수 평면도와 가구 목록을 내려받으세요. 저장 버튼으로 작업을 보관하고, PNG·GLB·프로젝트 파일로 내보내세요. AI 시안은 원본 장면과 비교한 뒤 JPG로 내려받을 수 있습니다.</p></div></TabsContent><TabsContent value="keys"><p className="fineprint">3D 작업 화면에서 사용하세요. 입력칸과 대화상자에서는 편집 단축키가 실행되지 않습니다. Mac에서는 Ctrl 대신 ⌘를 사용합니다.</p><div className="shortcut-grid"><span>선택 <kbd>V</kbd></span><span>이동 <kbd>M</kbd></span><span>회전 <kbd>R</kbd></span><span>줄자 <kbd>T</kbd></span><span>선택 확대 <kbd>F</kbd></span><span>기능 검색 <kbd>Ctrl K</kbd></span><span>실행 취소 <kbd>Ctrl Z</kbd></span><span>그룹 묶기 <kbd>Ctrl G</kbd></span><span>그룹 해제 <kbd>Ctrl Shift G</kbd></span><span>저장 <kbd>Ctrl S</kbd></span><span>다시 실행 <kbd>Ctrl Shift Z</kbd></span><span>취소 <kbd>Esc</kbd></span></div></TabsContent></Tabs><p className="fineprint">현재 버전은 사각형 스케치·돌출 높이·원기둥·파티션과 치수 편집을 지원합니다. 외부 정적 GLB 모델의 배치·치수·소재를 편집할 수 있습니다. SKP·MAX 직접 편집과 범용 메시 모델링은 지원하지 않습니다. 평면 보기는 정사영으로 표시합니다. 초안은 시공 도면이 아니며 현장 확인이 필요합니다.</p></DialogContent></Dialog>
 </TooltipProvider>;
}
