#!/usr/bin/env python3
"""Stream official Discogs CC0 masters/releases XML(.gz) as larper101 JSONL.

Usage:
  python3 scripts/import-discogs-dump.py --file discogs_YYYYMMDD_masters.xml.gz --kind masters --out - \
    | node scripts/import-catalog.mjs --source discogs --file -

No scraping or credentials. Download official monthly dumps from https://data.discogs.com/.
Masters represent distinct works; releases without a master are retained as standalone
works. Set --include-mastered-releases to retain individual editions as well.
Country is deliberately unset: Discogs release country is NOT artist origin.
Discogs dumps contain no reliable listener counts; do not use genre popularity as ratings.
"""
import argparse
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET


def value(el, path):
    node = el.find(path)
    return ''.join(node.itertext()).strip() if node is not None else ''


def artist_names(el):
    names = []
    for artist in el.findall('./artists/artist'):
        name = value(artist, 'name')
        if name:
            names.append(name)
    return ', '.join(names)


def strings(el, tag, child):
    return list(dict.fromkeys(x for n in el.findall('./' + tag + '/' + child)
                              if (x := ''.join(n.itertext()).strip())))


def year_from(el, kind):
    text = value(el, 'year' if kind == 'masters' else 'released')
    match = re.match(r'^(\d{4})', text)
    year = int(match.group(1)) if match else None
    return year if year and 1850 <= year <= 2100 else None


def record(el, kind, include_mastered=False):
    uid = el.attrib.get('id', '').strip()
    title = value(el, 'title')
    creator = artist_names(el)
    if not uid or not title or not creator:
        return None
    master_id = value(el, 'master_id') if kind == 'releases' else ''
    if kind == 'releases' and master_id not in ('', '0') and not include_mastered:
        return None
    typ = 'master' if kind == 'masters' else 'release'
    genres = strings(el, 'genres', 'genre') + strings(el, 'styles', 'style')
    genres = list(dict.fromkeys(g.lower() for g in genres if g))
    return {
        'kind': 'music', 'sourceId': f'{typ}:{uid}',
        'title': title, 'creator': creator,
        'year': year_from(el, kind), 'country': '',
        'genres': genres, 'aliases': [], 'ratingCount': None,
        'verified': True,
        'sourceUrl': f'https://www.discogs.com/{typ}/{uid}'
    }


def convert(filename, kind, output, include_mastered=False, limit=None):
    open_file = gzip.open if filename.endswith('.gz') else open
    total = 0
    with open_file(filename, 'rb') as handle:
        context = ET.iterparse(handle, events=('start', 'end'))
        _, root = next(context)
        for event, elem in context:
            if event != 'end' or elem.tag != ('master' if kind == 'masters' else 'release'):
                continue
            item = record(elem, kind, include_mastered)
            if item:
                output.write(json.dumps(item, ensure_ascii=False, separators=(',', ':')) + '\n')
                total += 1
            root.clear()
            if limit is not None and total >= limit:
                break
    return total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True)
    parser.add_argument('--kind', required=True, choices=['masters', 'releases'])
    parser.add_argument('--out', default='-')
    parser.add_argument('--include-mastered-releases', action='store_true')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    output = sys.stdout if args.out == '-' else open(args.out, 'w', encoding='utf-8')
    try:
        total = convert(args.file, args.kind, output, args.include_mastered_releases, args.limit)
        print(f'Discogs {args.kind}: exported {total:,} works', file=sys.stderr)
    finally:
        if output is not sys.stdout:
            output.close()


if __name__ == '__main__':
    main()