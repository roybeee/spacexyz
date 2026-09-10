"""Import the complete public Samhwa color-search HTML without inventing colors.
Usage: python scripts/import-samhwa-colors.py downloaded.html YYYY-MM-DD
Fetch source: curl -L --max-time 180 -o downloaded.html https://spsamhwa.com/color/search
"""
from html.parser import HTMLParser
from pathlib import Path
from collections import Counter, defaultdict
import hashlib, json, re, sys

class Palette(HTMLParser):
    def __init__(self):
        super().__init__(); self.book = None; self.rows = {}; self.occurrences = Counter()
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        group = re.fullmatch(r"color == '?([a-z0-9]+)'?", a.get('x-show', ''))
        if group: self.book = group[1]
        if 'data-color-id' not in a: return
        if self.book not in ('950', '600', '1200', 'other'): raise ValueError('Unknown color book')
        row = [a['data-color-id'], self.book, a['data-colorcodename'].strip(), a['data-colorname'].strip(), a['data-colorcode'].strip(), a['data-pageinfo'].strip(), a['data-keyword'].strip()]
        if not row[0].isdigit() or not row[2]: raise ValueError('Missing color identity')
        old = self.rows.get(row[0])
        if old and old != row: raise ValueError('Conflicting source ID: ' + row[0])
        self.rows[row[0]] = row; self.occurrences[self.book] += 1

if __name__ == '__main__':
    raw = Path(sys.argv[1]).read_bytes(); html = raw.decode('utf-8')
    if '</html>' not in html.lower(): raise ValueError('Incomplete HTML')
    checked = sys.argv[2]
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', checked): raise ValueError('Use ISO date')
    p = Palette(); p.feed(html); rows = list(p.rows.values()); counts = Counter(r[1] for r in rows)
    for book, expected in [('950',950),('600',600),('1200',1200)]:
        if counts[book] != expected: raise ValueError(f'Incomplete {book}: {counts[book]}')
    if not counts['other']: raise ValueError('Missing other colors')
    bycode = defaultdict(list)
    for row in rows: bycode[row[2]].append(row)
    conflicts = [code for code, group in bycode.items() if len({r[4] for r in group}) > 1]
    invalid = [{'sourceId':r[0], 'code':r[2], 'sourceValue':r[4]} for r in rows if not re.fullmatch(r'#[0-9A-Fa-f]{6}',r[4])]
    out = Path(__file__).resolve().parents[1] / 'lib/data'; out.mkdir(exist_ok=True)
    dataset = '[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows) + '\n]\n'
    (out/'samhwa-colors.json').write_text(dataset)
    manifest = dict(sourceUrl='https://spsamhwa.com/color/search', paletteUrl='https://1200color.samhwa.com/color', checkedAt=checked, sourceSha256=hashlib.sha256(raw).hexdigest(), datasetSha256=hashlib.sha256(dataset.encode()).hexdigest(), columns=['sourceId','book','code','name','sourceHex','pageCode','keywords'], totalRecords=len(rows), validColors=len(rows)-len(invalid), uniqueCodes=len(bycode), bookCounts=dict(counts), sourceOccurrences=dict(p.occurrences), duplicateCodeDifferentHex=conflicts, unavailableColors=invalid)
    (out/'samhwa-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:manifest[k] for k in ['totalRecords','validColors','uniqueCodes','bookCounts','unavailableColors']},ensure_ascii=False))
