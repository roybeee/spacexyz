'use client';

import {ArrowRight, Armchair, Download, ImagePlus, Palette, Ruler, Search} from 'lucide-react';
import './quick-start-guide.css';

export type QuickStartAction = 'room' | 'materials' | 'furniture' | 'photo' | 'commands';

export default function QuickStartGuide({onAction, disabled = false}: {
    onAction: (action: QuickStartAction) => void;
    disabled?: boolean;
}) {
    const steps = [
        {title:'공간 치수 확인', icon:Ruler, text:'가로 폭·세로 깊이·천장 높이를 mm로 입력하세요. 직접 잰 값에만 실측 표시를 켭니다.', action:'room' as const, button:'공간 치수 열기'},
        {title:'가구 하나 놓기', icon:Armchair, text:'가구 탭에서 카페 테이블을 눌러 추가하세요. 선택한 가구의 크기는 속성에서 바꿉니다.', action:'furniture' as const, button:'가구 열기'},
        {title:'소재 바꿔 보기', icon:Palette, text:'가구를 선택하고 소재를 누르세요. 상판만 바꾸려면 속성에서 선택한 면을 고른 뒤 상판을 클릭합니다.', action:'materials' as const, button:'소재 열기'},
        {title:'배치·문 도구 찾기', icon:Search, text:'가구를 선택한 뒤 간격·원형 배치를 검색하세요. 파티션은 문·창문 편집과 문 개폐 동작 미리보기를 지원합니다.', action:'commands' as const, button:'기능 찾기'},
        {title:'사진으로 컨셉 살펴보기', icon:ImagePlus, text:'사진 탭의 내 매장 사진 올리기로 시작하세요. 색감 추출은 바로 쓸 수 있고, 사진 분석·AI 컨셉은 AI 연결이 필요합니다.', action:'photo' as const, button:'사진 열기', badge:'분석·컨셉은 AI 연결 필요'},
        {title:'저장하고 전달하기', icon:Download, text:'상단 저장 후 저장 완료 알림을 확인하세요. 내보내기의 선택 요소만 · GLB로 선택한 가구를 전달합니다. 모바일은 상단 다운로드 아이콘을 누릅니다.'},
    ];

    return <div className="quick-start-guide">
        <p className="quick-start-intro">예시 공간에서 5~10분 동안 익혀 보세요. 버튼을 누르면 안내를 닫고 해당 도구를 엽니다.</p>
        <ol className="quick-start-steps">
            {steps.map((step, index) => <li key={step.title} className="quick-start-card">
                <div className="quick-start-card-heading"><span className="quick-start-number" aria-hidden="true">{index + 1}</span><h3>{step.title}</h3><step.icon size={17} aria-hidden="true"/></div>
                <p>{step.text}</p>
                {step.badge && <span className="quick-start-ai-badge">{step.badge}</span>}
                {step.action && <button type="button" disabled={disabled} onClick={() => onAction(step.action!)}>{step.button}<ArrowRight size={14} aria-hidden="true"/></button>}
            </li>)}
        </ol>
        <p className="quick-start-note">모바일에서 다른 면을 고를 때는 열린 라이브러리·속성 창을 닫으세요. 사진 초안과 간섭 검토는 실측·시공 확인을 대신하지 않습니다.</p>
    </div>;
}
