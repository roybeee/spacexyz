'use client';
import { useEffect, useRef, useState } from 'react';
import { Box, Sparkles, Ruler, LoaderCircle, LayoutTemplate } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { draftInputSchema, templateDraft, type DraftInput } from '@/lib/photo-draft';
import { type SceneData, validateScene } from '@/lib/scene-model';
import { photoData } from '@/lib/photo-palette';
export default function PhotoDraftDialog({ open, onClose, photoUrl, scene, apiKey, aiReady, onReady, onConnect }: {
    open: boolean;
    onClose: () => void;
    photoUrl: string;
    scene: SceneData;
    apiKey: string;
    aiReady: boolean;
    onReady: (s: SceneData) => boolean;
    onConnect: () => void;
}) {
    const [brand, setBrand] = useState<DraftInput['brand']>('ofd'), [size, setSize] = useState({ width: scene.room.width, depth: scene.room.depth, height: scene.room.height }), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const flight = useRef(false), alive = useRef(true), controller = useRef<AbortController | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
    async function generate(ai: boolean) { if (flight.current) return; setError(''); let input: DraftInput; try {
        input = draftInputSchema.parse({ ...size, brand, name: `${brand === 'ofd' ? 'OFD' : brand === 'oda' ? 'ODA' : '카페'} · ${ai ? '사진 초안' : '새 배치'}` });
    }
    catch {
        setError('가로·세로 2,400~20,000mm, 높이 2,200~6,000mm를 입력하세요.');
        return;
    } if (ai && !aiReady && !apiKey) {
        onConnect();
        return;
    } flight.current = true; setBusy(true); controller.current = new AbortController(); try {
        let next: SceneData;
        if (ai) {
            const p = await photoData(photoUrl);
            if (!alive.current) return;
            const r = await fetch('/api/photo-draft', { method: 'POST', signal: controller.current.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, image: p.image, apiKey: apiKey || undefined }) });
            const result = await r.json() as {
                error?: string;
                scene: unknown;
            };
            if (!r.ok)
                throw new Error(result.error ?? '3D 초안을 만들지 못했습니다.');
            next = validateScene(result.scene);
            next.palette = p.palette;
        }
        else
            next = templateDraft(input);
        if (!alive.current) return;
        if (scene.photoId)
            next.photoId = scene.photoId;
        if (onReady(next)) onClose();
        else setError('사진이나 공간이 변경되었습니다. 이 창을 닫고 새 초안을 시작해 주세요.');
    }
    catch (e) {
        if (alive.current) setError(e instanceof Error ? e.message : '초안을 만들지 못했습니다.');
    }
    finally {
        flight.current = false;
        if (alive.current) setBusy(false);
    } }
    return <Dialog open={open} onOpenChange={o => { if (!o && !busy)
        onClose(); }}><DialogContent className="draft-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>사진으로 3D 공간 시작하기</DialogTitle><DialogDescription>공간의 크기를 입력하고 편집 가능한 초안을 만드세요.</DialogDescription></DialogHeader><div className="draft-columns"><div><img src={photoUrl} alt={scene.photoId ? '내 매장 참고 사진' : '예시 카페 참고 사진'}/><span className="draft-photo-label">{scene.photoId ? '내 매장 사진' : '예시 카페 · Unsplash'}</span><div className="draft-guide"><Ruler size={18}/><p>벽 크기는 입력값을 사용합니다. 사진에서 가져온 가구의 크기와 배치는 <b>추정값</b>으로 표시됩니다.</p></div></div><div className="draft-form"><label className="field-label">브랜드 방향</label><Tabs value={brand} onValueChange={v => {if(!busy)setBrand(v as DraftInput['brand']);}}><TabsList className="full"><TabsTrigger value="ofd">OFD</TabsTrigger><TabsTrigger value="oda">ODA</TabsTrigger><TabsTrigger value="cafe">카페</TabsTrigger></TabsList></Tabs><div className="draft-size-presets">{[[10, 5000, 6600], [15, 6000, 8260], [20, 8000, 8260]].map(([p, w, d]) => <button disabled={busy} key={p} onClick={() => setSize({ ...size, width: w, depth: d })}>약 {p}평</button>)}</div><div className="draft-dimensions">{(['width', 'depth', 'height'] as const).map((axis, i) => <label key={axis}>{['가로 폭', '세로 깊이', '천장 높이'][i]}<div><input type="number" aria-label={`초안 ${['가로 폭', '세로 깊이', '천장 높이'][i]}`} min={axis === 'height' ? 2200 : 2400} max={axis === 'height' ? 6000 : 20000} value={size[axis]} disabled={busy} onChange={e => setSize({ ...size, [axis]: Number(e.target.value) })}/><small>mm</small></div></label>)}</div><p className="draft-area">{(size.width * size.depth / 1000000).toFixed(1)} m² <small>약 {(size.width * size.depth / 3305800).toFixed(1)}평</small></p><button className="primary-button full" onClick={() => generate(true)} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>} {busy ? '3D 초안 만드는 중…' : '사진 분석으로 3D 초안 만들기'}</button><button className="outline-button full" onClick={() => generate(false)} disabled={busy}><LayoutTemplate size={16}/>기본 배치 템플릿으로 시작</button><p className="fineprint">사진 분석은 AI 연결이 필요합니다. 기본 배치는 사진을 분석하지 않고 입력한 치수에 맞춰 구성합니다.</p></div></div>{error && <p role="alert" className="form-error">{error}</p>}<p className="draft-preserve"><Box size={14}/>결과를 먼저 비교하고 적용하세요. 현재 작업은 미리보기 동안 유지됩니다.</p></DialogContent></Dialog>;
}
