'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ArrowUpRight, CornerDownLeft, Search, X} from 'lucide-react';
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command';
import {commandSearchScore} from '@/lib/command-search';
import './command-palette.css';

export type StudioCommand = {
    id: string;
    label: string;
    description?: string;
    keywords?: string[];
    category: string;
    shortcut?: string;
    disabled?: boolean;
    run: () => void;
};

export default function CommandPalette({open, onOpenChange, commands}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    commands: StudioCommand[];
}) {
    const [query, setQuery] = useState('');
    const running = useRef(false);
    const input = useRef<HTMLInputElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    const indexed = useMemo(() => new Map(commands.map(command => [command.id, command])), [commands]);
    const groups = useMemo(() => {
        const result = new Map<string, StudioCommand[]>();
        for (const command of commands) {
            const members = result.get(command.category) ?? [];
            members.push(command);
            result.set(command.category, members);
        }
        return [...result.entries()];
    }, [commands]);
    const matches = useMemo(() => commands.filter(command => commandSearchScore(command, query) > 0), [commands, query]);
    const available = matches.filter(command => !command.disabled).length;
    useEffect(() => {
        if (open) {
            setQuery('');
            running.current = false;
        }
    }, [open]);
    const execute = (command: StudioCommand) => {
        if (command.disabled || running.current) return;
        running.current = true;
        onOpenChange(false);
        command.run();
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="studio-command-palette" showCloseButton={false}
            onOpenAutoFocus={event => {event.preventDefault(); previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; input.current?.focus();}}
            onCloseAutoFocus={event => {event.preventDefault(); if (!running.current && previousFocus.current?.isConnected) previousFocus.current.focus();}}>
            <DialogHeader className="studio-command-heading">
                <DialogTitle>어떤 작업을 할까요?</DialogTitle>
                <DialogDescription>기능 이름이나 키워드로 원하는 도구를 찾으세요.</DialogDescription>
                <DialogClose asChild><button className="studio-command-close" aria-label="기능 검색 닫기"><X size={19}/></button></DialogClose>
            </DialogHeader>
            <Command className="studio-command-root" label="인테리어 편집 기능" loop
                filter={(id, search) => {const command = indexed.get(id); return command ? commandSearchScore(command, search) : 0;}}>
                <CommandInput ref={input} value={query} onValueChange={setQuery}
                    placeholder="예: 벽 그리기, 소재, 평면도, export"
                    aria-label="기능 이름 또는 키워드 검색" autoComplete="off" autoCorrect="off" spellCheck={false}/>
                <div className="studio-command-summary" aria-live="polite" aria-atomic="true">
                    <span>{query.trim() ? '검색 결과' : '모든 기능'} <b>{matches.length}</b></span>
                    <span>{matches.length > 0 && available === 0 ? '현재 실행 가능한 기능이 없습니다' : '방향키로 이동 · Enter로 실행'}</span>
                </div>
                <CommandList className="studio-command-list" aria-label="검색한 편집 기능">
                    <CommandEmpty>
                        <div className="studio-command-empty"><Search size={29}/><b>일치하는 기능이 없습니다</b>
                            <p>짧은 단어로 다시 찾아보세요.<br/>‘벽’, ‘소재’, ‘저장’처럼 입력할 수 있습니다.</p>
                            <button type="button" onClick={() => {setQuery(''); input.current?.focus();}}>검색어 지우고 전체 보기</button>
                        </div>
                    </CommandEmpty>
                    {groups.map(([category, members]) => <CommandGroup key={category} heading={category}>
                        {members.map(command => <CommandItem key={command.id} value={command.id}
                            disabled={command.disabled} onSelect={() => execute(command)}>
                            <span className="studio-command-copy"><b>{command.label}</b>{command.description && <span>{command.description}</span>}</span>
                            {command.disabled ? <span className="studio-command-unavailable">사용 조건 확인</span>
                                : command.shortcut ? <kbd className="studio-command-shortcut">{command.shortcut}</kbd>
                                    : <ArrowUpRight className="studio-command-arrow" size={17} aria-hidden="true"/>}
                        </CommandItem>)}
                    </CommandGroup>)}
                </CommandList>
            </Command>
            <div className="studio-command-footer"><span><kbd><ArrowUp size={12}/></kbd><kbd><ArrowDown size={12}/></kbd> 이동</span><span><kbd><CornerDownLeft size={12}/></kbd> 실행</span><span><kbd>Esc</kbd> 닫기</span></div>
        </DialogContent>
    </Dialog>;
}
