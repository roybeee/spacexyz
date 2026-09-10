import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'spatial-command-search-'));
const file = join(directory, 'bundle.mjs');
const bundle = await build({entryPoints:['lib/command-search.ts'], bundle:true, platform:'node', format:'esm', write:false});
await writeFile(file, bundle.outputFiles[0].text);
const {commandSearchScore: score} = await import(pathToFileURL(file));
await rm(directory, {recursive:true, force:true});
let checks = 0;
function test(name, fn) {fn(); checks++; console.log('PASS ' + name);}
const material = {label:'소재 일괄 변경', category:'소재·디자인', description:'선택한 면의 마감을 함께 바꿉니다.', keywords:['material', 'replace finish', '재질', 'texture']};
const glb = {label:'GLB 저장', category:'내보내기', keywords:['export', '3D model']};

test('Korean label searches accept omitted, extra and nonbreaking spaces', () => {
    for (const query of ['소재일괄변경', ' 소재 일괄 변경 ', '소재\u00a0일괄\t변경']) assert.equal(score(material, query), 1);
});
test('Korean decomposed input and fullwidth English resolve to the same command', () => {
    assert.equal(score(material, material.label.normalize('NFD')), 1);
    assert.equal(score(glb, 'ＧＬＢ 저장'), 1);
    assert.equal(score(glb, 'EXPORT'), score(glb, 'export'));
});
test('mixed language keywords combine with categories regardless of word order', () => {
    assert.ok(score(glb, '내보내기 export') > 0);
    assert.ok(score(glb, 'export 내보내기') > 0);
    assert.ok(score(material, '마감 material') > 0);
    assert.equal(score(material, 'material 외관'), 0);
});
test('literal punctuation is safe and does not act as a regex wildcard', () => {
    assert.equal(score(material, '.*'), 0);
    assert.equal(score(material, '['), 0);
    assert.ok(score({label:'실행 취소 (Undo)', category:'편집'}, '(Undo)') > 0);
});
test('clear labels rank ahead of descriptions with the same keyword', () => {
    const exact = score({label:'소재', category:'도구'}, '소재');
    const prefix = score({label:'소재 편집', category:'도구'}, '소재');
    const alias = score({label:'마감 편집', category:'도구', keywords:['소재']}, '소재');
    const description = score({label:'도구', category:'편집', description:'소재를 바꿉니다'}, '소재');
    assert.ok(exact > prefix && prefix > alias && alias > description && description > 0);
});
test('empty queries show every command and absent optional fields remain searchable', () => {
    const command = {label:'저장', category:'프로젝트'};
    assert.equal(score(command, ''), 1);
    assert.equal(score(command, ' \t\n'), 1);
    assert.ok(score(command, '프로젝트') > 0);
    assert.equal(score(command, '프로젝트 삭제'), 0);
});
test('search is read only and does not index callback or internal identifier text', () => {
    const command = {...glb, id:'secret-command', run:() => {throw new Error('must not run')}};
    const snapshot = JSON.stringify(command);
    assert.equal(score(command, 'secret-command'), 0);
    assert.equal(score(command, 'must not run'), 0);
    assert.equal(JSON.stringify(command), snapshot);
});
console.log(`${checks} command search checks passed.`);
