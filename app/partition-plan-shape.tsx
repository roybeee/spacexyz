'use client';

import {doorGeometry, type LocalDoorBox} from '@/lib/door-geometry';
import type {SceneNode} from '@/lib/scene-model';

function DoorPlanBox({box, part}: {box:LocalDoorBox; part:'leaf'|'handle'}) {
    return <rect data-door-part={part} x={box.x - box.width / 2} y={box.z - box.depth / 2}
        width={box.width} height={box.depth} transform={`rotate(${-box.rotation} ${box.x} ${box.z})`}/>;
}

/** Local millimetres. The containing group supplies the node pose and selection colours. */
export default function PartitionPlanShape({node, ghost = false}: {node:SceneNode; ghost?:boolean}) {
    if (!node.openings?.length) return <g fill={ghost ? 'none' : undefined}><rect x={-node.width / 2} y={-node.depth / 2} width={node.width} height={node.depth}/></g>;
    const intervals = node.openings.map(opening => [opening.x - opening.width / 2, opening.x + opening.width / 2]).sort((a, b) => a[0] - b[0]);
    const spans: {left:number; right:number}[] = [];
    let cursor = -node.width / 2;
    for (const [left, right] of intervals) {
        if (left > cursor) spans.push({left:cursor, right:left});
        cursor = Math.max(cursor, right);
    }
    if (cursor < node.width / 2) spans.push({left:cursor, right:node.width / 2});
    return <g fill={ghost ? 'none' : undefined}>
        {spans.map((span, index) => <rect key={`wall-${index}`} x={span.left} y={-node.depth / 2} width={span.right - span.left} height={node.depth}/>)}
        {node.openings.map(opening => {
            const left = opening.x - opening.width / 2, right = opening.x + opening.width / 2;
            if (opening.kind === 'window') return <g key={opening.id} data-opening-id={opening.id} stroke={ghost ? undefined : '#3c83a3'} fill="none"><title>{opening.name} · 창문</title><line x1={left} y1={-node.depth * .2} x2={right} y2={-node.depth * .2}/><line x1={left} y1={node.depth * .2} x2={right} y2={node.depth * .2}/></g>;
            if (opening.kind === 'passage') return <g key={opening.id} data-opening-id={opening.id}><title>{opening.name} · 빈 통로</title></g>;
            const door = doorGeometry(node, opening);
            if (!door) return <g key={opening.id} data-opening-id={opening.id}><title>{opening.name} · 고정 문</title><line x1={left} y1={0} x2={right} y2={0} fill="none"/></g>;
            const steps = Math.ceil(opening.door!.angle / 5);
            const arc = steps > 0 ? Array.from({length:steps + 1}, (_, index) => {
                const yaw = door.yaw * Math.PI / 180 * index / steps;
                return `${door.hinge.x + door.dir * door.leafWidth * Math.cos(yaw)},${door.hinge.z - door.dir * door.leafWidth * Math.sin(yaw)}`;
            }).join(' ') : '';
            return <g key={opening.id} data-opening-id={opening.id}>
                <title>{opening.name} · {opening.door!.hinge === 'left' ? '왼쪽' : '오른쪽'} 경첩 · {opening.door!.angle}°</title>
                {arc && <polyline data-door-part="swing" points={arc} fill="none" strokeDasharray="45 35" strokeOpacity={.65}/>}
                <DoorPlanBox box={door.leaf} part="leaf"/><DoorPlanBox box={door.handle} part="handle"/>
                <circle data-door-part="hinge" cx={door.hinge.x} cy={door.hinge.z} r={15}/>
            </g>;
        })}
    </g>;
}
