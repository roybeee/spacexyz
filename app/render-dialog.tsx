'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Download, ImagePlus, LoaderCircle, Sparkles, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { RenderResult, SceneData } from '@/lib/scene-model';
import { photoData } from '@/lib/photo-palette';
export default function RenderDialog({ open, onClose, scene, view, photoUrl, apiKey, aiReady, onConnect, capture, onResult }: {
    open: boolean;
    onClose: () => void;
    scene: SceneData;
    view: 'interior'|'exterior';
    photoUrl: string;
    apiKey: string;
    aiReady: boolean;
    onConnect: () => void;
    capture: () => Promise<string>;
    onResult: (r: RenderResult) => void;
}) {
    const [image, setImage] = useState(''), [prompt, setPrompt] = useState('자연스러운 우드와 벽 마감, 실제 시공처럼 섬세한 접합부, 따뜻하고 밝은 매장 분위기'), [quality, setQuality] = useState('medium'), [reference, setReference] = useState(true), [busy, setBusy] = useState(false), [capturing, setCapturing] = useState(false), [error, setError] = useState(''), [tab, setTab] = useState('create'), [result, setResult] = useState<RenderResult | null>(null), [gallery, setGallery] = useState<RenderResult[]>([]), [galleryError, setGalleryError] = useState(''), [comparison, setComparison] = useState(50);
    const flight = useRef(false), mounted = useRef(true), captureEpoch = useRef(0);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; captureEpoch.current++; }; }, []);
    useEffect(() => { if (open) {
        refresh();
        loadGallery();
    }
    else
        captureEpoch.current++; }, [open,view]);
    async function refresh() { const token = ++captureEpoch.current; setCapturing(true); setImage(''); setError(''); try {
        const data = await capture();
        if (mounted.current && token === captureEpoch.current)
            setImage(data);
    }
    catch (e) {
        if (mounted.current && token === captureEpoch.current)
            setError((e as Error).message);
    }
    finally {
        if (mounted.current && token === captureEpoch.current)
            setCapturing(false);
    } }
    async function loadGallery() { setGalleryError(''); try {
        const res = await fetch('/api/assets');
        const data = await res.json() as {
            error?: string;
            assets: {
                id: string;
                name: string;
                created_at: string;
                metadata: {
                    prompt?: string;
                };
            }[];
        };
        if (!res.ok)
            throw new Error(data.error || '시안을 불러오지 못했습니다.');
        if (mounted.current)
            setGallery(data.assets.map((a: any) => ({ id: a.id, name: a.name, createdAt: a.created_at, prompt: a.metadata.prompt ?? '' })));
    }
    catch (e) {
        if (mounted.current)
            setGalleryError((e as Error).message);
    } }
    async function generate() { if (flight.current || !image)
        return; if (!aiReady && !apiKey) {
        onConnect();
        return;
    } flight.current = true; setBusy(true); setError(''); const inputImage = image; try {
        const ref = reference ? (await photoData(photoUrl)).image : undefined;
        const response = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), name: `${scene.name.slice(0, 80)} · ${view==='exterior'?'외관':'실내'} AI 시안`, prompt, quality, view, signText:view==='exterior'&&scene.facade?.sign.enabled&&!scene.facade.sign.logoId?scene.facade.sign.text:undefined, image: inputImage, reference: ref, apiKey: apiKey || undefined }) });
        const data = await response.json() as {
            error?: string;
            result: RenderResult;
        };
        if (!response.ok)
            throw new Error(data.error || '시안을 생성하지 못했습니다.');
        if (!mounted.current)
            return;
        setResult(data.result);
        setTab('result');
        setGallery(prev => [data.result, ...prev]);
        onResult(data.result);
    }
    catch (e) {
        if (mounted.current)
            setError((e as Error).message);
    }
    finally {
        flight.current = false;
        if (mounted.current)
            setBusy(false);
    } }
    async function download() { if (!result)
        return; try {
        const res = await fetch(`/api/assets?id=${result.id}`);
        if (!res.ok)
            throw new Error('이미지를 내려받지 못했습니다.');
        const url = URL.createObjectURL(await res.blob()), a = document.createElement('a');
        a.href = url;
        a.download = `${result.name}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    return <Dialog open={open} onOpenChange={o => { if (!o && !busy && !capturing)
        onClose(); }}><DialogContent className="render-dialog"><DialogHeader><DialogTitle>AI 컨셉 이미지</DialogTitle><DialogDescription>현재 3D 배치를 기준으로 소재와 빛을 실사 느낌으로 표현합니다.</DialogDescription></DialogHeader><Tabs value={tab} onValueChange={v => { if (!busy)
        setTab(v); }}><TabsList><TabsTrigger value="create">새 시안</TabsTrigger><TabsTrigger value="gallery">시안 보관함{gallery.length ? ` · ${gallery.length}` : ''}</TabsTrigger>{result && <TabsTrigger value="result">시안 비교</TabsTrigger>}</TabsList></Tabs>
 {tab === 'create' && <div className="render-create"><div><div className="render-preview">{image ? <img src={image} alt="시안 생성에 사용할 3D 장면"/> : <div className="render-placeholder"><Camera /><p>현재 장면 준비 중</p></div>}{capturing && <div className="render-loading"><LoaderCircle className="spin"/>장면 불러오는 중</div>}</div><div className="render-preview-label"><b>배치 기준 · {view==='exterior'?'매장 외관':'현재 3D 장면'}</b><button className="text-button" onClick={refresh} disabled={capturing || busy}><RefreshCw size={14}/>다시 캡처</button></div><p className="fineprint">{view==='exterior'?'간판·어닝·유리 전면의 크기와 위치를 유지하도록 요청합니다. 간판 문구는 원본과 비교해 확인하세요.':'원하는 각도를 3D 화면에서 먼저 정하세요. 실내 보기에서 매장 내부를 촬영하면 공간의 분위기가 잘 드러납니다.'}</p>{reference && <div className="render-reference"><img src={photoUrl} alt="소재와 분위기 참고 사진"/><span>분위기 참고 사진<small>{scene.photoId ? '내 매장 사진' : '예시 카페 사진'}</small></span></div>}</div><div className="render-options"><label className="switch-row"><span>참고 사진 분위기 반영</span><Switch checked={reference} onCheckedChange={setReference} disabled={busy}/></label><label className="field-label">원하는 분위기<textarea className="text-input" rows={5} maxLength={1500} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy}/></label><div className="render-presets">{['내추럴 우드와 밝은 벽, 부드러운 낮빛', '브러시드 스틸과 우드, 선명한 소재 대비', '크림 벽과 딥 네이비 포인트, 따뜻한 조명'].map(p => <button key={p} disabled={busy} onClick={() => setPrompt(p)}>{p}</button>)}</div><label className="field-label">이미지 품질</label><Tabs value={quality} onValueChange={v => { if (!busy)
        setQuality(v); }}><TabsList className="full"><TabsTrigger value="medium">기본</TabsTrigger><TabsTrigger value="high">고품질</TabsTrigger></TabsList></Tabs><p className="fineprint">생성에 수 분이 걸릴 수 있습니다. 사진과 장면을 OpenAI에 전송하며, 고품질은 API 비용과 시간이 더 들 수 있습니다.</p><button className="primary-button full" disabled={!image || busy || capturing} onClick={generate}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {busy ? '시안 생성 중…' : aiReady || apiKey ? 'AI 시안 만들기' : 'AI 연결하고 시작'}</button>{busy && <p role="status" className="render-wait">소재·빛·그림자를 표현하고 있습니다. 이 창을 유지해 주세요.</p>}</div></div>}
 {tab === 'gallery' && <>{galleryError && <p className="form-error" role="alert">{galleryError}<button className="text-button" onClick={loadGallery}>다시 불러오기</button></p>}{!gallery.length ? <div className="empty-state"><ImagePlus /><b>생성한 시안이 여기에 보관됩니다</b><p>원본 3D 장면과 함께 비교할 수 있습니다.</p><button className="primary-button" onClick={() => setTab('create')}>첫 시안 만들기</button></div> : <div className="render-gallery">{gallery.map(r => <button key={r.id} onClick={() => { setResult(r); setTab('result'); }}><img src={`/api/assets?id=${r.id}`} alt={r.name} loading="lazy"/><b>{r.name}</b><small>{new Date(r.createdAt).toLocaleString('ko-KR')}</small></button>)}</div>}</>}
 {tab === 'result' && result && <><div className="render-compare"><img src={`/api/assets?id=${result.id}`} alt="AI로 생성한 컨셉 이미지"/><img className="render-before" src={`/api/assets?id=${result.id}&source=1`} alt="생성 당시 원본 3D 장면" style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}/><span className="compare-line" style={{ left: `${comparison}%` }}/><span className="compare-label before">원본 3D</span><span className="compare-label after">AI 컨셉</span></div><Slider aria-label="원본 장면과 AI 시안 비교" min={0} max={100} step={1} value={[comparison]} onValueChange={v => setComparison(v[0])}/><div className="render-result-footer"><div><b>{result.name}</b><p>{result.prompt}</p></div><button className="primary-button" onClick={download}><Download size={16}/>JPG 내려받기</button></div><p className="fineprint">AI 컨셉 이미지입니다. 가구 수·위치·간판 문구가 원본과 달라질 수 있으니 비교해 확인하세요. 3D 모델과 시공 치수를 수정하지 않습니다.</p></>}
 {error && <p className="form-error" role="alert">{error}</p>}
 </DialogContent></Dialog>;
}
