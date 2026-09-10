'use client';

import {ClipboardPaste, Copy, LoaderCircle, X, BookmarkPlus, FolderOpen} from 'lucide-react';
import './material-transfer.css';

export type MaterialTransferSample = {
    name: string;
    color: string;
    textureId?: string | null;
    sourceName: string;
};

export default function MaterialTransferControls({sample, canCopy, canPaste, busy, scopeLabel, onCopy, onPaste, onClear, onLibrary, onSavePreset}: {
    sample: MaterialTransferSample | null;
    canCopy: boolean;
    canPaste: boolean;
    busy: boolean;
    scopeLabel: string;
    onCopy: () => void;
    onPaste: () => void;
    onClear: () => void;
    onLibrary: () => void;
    onSavePreset: () => void;
}) {
    const copyDisabled = busy || !canCopy;
    const pasteDisabled = busy || !canPaste || !sample;
    return <section className="material-transfer" aria-label="소재 복사와 붙이기">
        <div className="material-transfer-actions">
            <button type="button" disabled={copyDisabled} onClick={onCopy}><Copy size={15}/><span>소재 복사</span></button>
            <button type="button" disabled={pasteDisabled} onClick={onPaste}><ClipboardPaste size={15}/><span>붙이기</span></button>
        </div>
        {sample ? <div className="material-transfer-sample">
            <span className={`material-transfer-chip${sample.textureId ? ' has-texture' : ''}`} style={{backgroundColor:sample.textureId ? undefined : sample.color}} aria-hidden="true"/>
            <div className="material-transfer-copy"><div><b title={sample.name}>{sample.name}</b>{sample.textureId && <span className="material-transfer-image-badge">이미지 소재</span>}</div><small title={sample.sourceName}>복사한 곳 · {sample.sourceName}</small></div>
            <button className="material-transfer-clear" type="button" disabled={busy} onClick={onClear} title="복사한 소재 지우기" aria-label="복사한 소재 지우기"><X size={14}/></button>
        </div> : <p className="material-transfer-hint">소재를 복사한 뒤 다른 면을 선택해 붙이세요.</p>}
        <div className="material-transfer-library"><button type="button" onClick={onLibrary} disabled={busy}><FolderOpen size={13}/>내 소재 보관함</button><button type="button" onClick={onSavePreset} disabled={busy||!sample}><BookmarkPlus size={13}/>보관하기</button></div>
        <p className={`material-transfer-scope${busy ? ' is-busy' : ''}`} role="status" aria-live="polite" aria-atomic="true">{busy && <span className="material-transfer-busy"><LoaderCircle className="spin" size={13}/>소재를 준비하고 있습니다…</span>}<span>붙일 범위</span><b>{scopeLabel || '대상 면을 선택하세요'}</b></p>
    </section>;
}
