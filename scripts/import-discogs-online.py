#!/usr/bin/env python3
"""Stream official Discogs CC0 monthly dumps into a persistent larper101 SQLite DB.

This is an explicit ONE-TIME admin command, not a web-server startup action.
No web scraping; only the public Discogs data-dump S3 bucket is accessed.
Download is streamed; the compressed XML is not retained on disk.

Examples:
  python3 scripts/import-discogs-online.py --month 202610 --db /data/catalog.sqlite --kinds artists masters
  python3 scripts/import-discogs-online.py --month 202610 --db /data/catalog.sqlite --kinds releases labels

A full import can require tens of GB or more of database storage, especially
for individual releases plus the fuzzy-search indexes. Run from Render Shell
with a persistent disk and sufficient free space. Re-running is idempotent.
"""
import argparse
import datetime as dt
import gzip
import importlib.util
import json
import pathlib
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("discogs_dump_converter", ROOT / "scripts" / "import-discogs-dump.py")
CONVERTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONVERTER)
KINDS = ("artists", "masters", "releases", "labels")
BASE_URL = "https://discogs-data-dumps.s3.us-west-2.amazonaws.com/data/{year}/discogs_{stamp}_{kind}.xml.gz"
UA = "larper101 catalog importer/0.2 (official CC0 data dumps)"


def month_stamp(month):
    if len(month) != 6 or not month.isdigit():
        raise ValueError("month must be YYYYMM")
    date = dt.datetime.strptime(month, "%Y%m")
    if date.year < 2008 or date > dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(days=35):
        raise ValueError("month out of range")
    return f"{month}01"


def url_for(month, kind):
    if kind not in KINDS:
        raise ValueError("Unsupported kind")
    stamp = month_stamp(month)
    return BASE_URL.format(year=month[:4], stamp=stamp, kind=kind)


def open_dump(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=180)


def parse_root(raw, kind):
    """Yields individual top-level elements without retaining the full XML."""
    with gzip.GzipFile(fileobj=raw, mode="rb") as content:
        context = ET.iterparse(content, events=("start", "end"))
        _, root = next(context)
        name = {"artists": "artist", "masters": "master",
                "releases": "release", "labels": "label"}[kind]
        for event, elem in context:
            if event == "end" and elem.tag == name:
                yield elem
                root.clear()


def init_entities(db):
    db.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=20000;
        CREATE TABLE IF NOT EXISTS discogs_artists (
            discogs_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL, real_name TEXT, aliases TEXT NOT NULL DEFAULT '[]',
            name_variations TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS discogs_artists_name ON discogs_artists(name COLLATE NOCASE);
        CREATE TABLE IF NOT EXISTS discogs_labels (
            discogs_id INTEGER PRIMARY KEY, name TEXT NOT NULL,
            parent_label TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS discogs_labels_name ON discogs_labels(name COLLATE NOCASE);
    """)


def save_entity(db, kind, elem):
    sid = elem.get("id") or CONVERTER.value(elem, "id")
    name = CONVERTER.value(elem, "name")
    if not sid or not sid.isdigit() or not name:
        return False
    if kind == "artists":
        aliases = CONVERTER.strings(elem, "aliases", "name")
        namevariations = CONVERTER.strings(elem, "namevariations", "name")
        real = CONVERTER.value(elem, "realname")
        db.execute("""INSERT INTO discogs_artists(discogs_id,name,real_name,aliases,name_variations)
            VALUES (?,?,?,?,?) ON CONFLICT(discogs_id) DO UPDATE SET
            name=excluded.name, real_name=excluded.real_name, aliases=excluded.aliases,
            name_variations=excluded.name_variations,updated_at=CURRENT_TIMESTAMP""",
            (int(sid), name, real, json.dumps(aliases, ensure_ascii=False),
             json.dumps(namevariations, ensure_ascii=False)))
    else:
        db.execute("""INSERT INTO discogs_labels(discogs_id,name,parent_label)
            VALUES (?,?,?) ON CONFLICT(discogs_id) DO UPDATE SET
            name=excluded.name,parent_label=excluded.parent_label,updated_at=CURRENT_TIMESTAMP""",
            (int(sid), name, CONVERTER.value(elem, "parentLabel")))
    return True


def import_stream(month, kind, database, limit=None, opener=open_dump):
    url = url_for(month, kind)
    print(f"Discogs {kind}: streaming {url}", file=sys.stderr, flush=True)
    count = 0
    with opener(url) as response:
        if kind in ("artists", "labels"):
            db = sqlite3.connect(database, timeout=30)
            try:
                init_entities(db)
                for elem in parse_root(response, kind):
                    if save_entity(db, kind, elem):
                        count += 1
                        if count % 5000 == 0:
                            db.commit()
                        if count % 50000 == 0:
                            print(f"{kind}: {count:,} imported", file=sys.stderr, flush=True)
                    if limit is not None and count >= limit:
                        break
                db.commit()
            finally:
                db.close()
        else:
            command = ["node", "scripts/import-catalog.mjs", "--source", "discogs",
                       "--file", "-", "--db", str(database)]
            proc = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.PIPE,
                                    encoding="utf-8")
            try:
                for elem in parse_root(response, kind):
                    work = CONVERTER.record(elem, kind)
                    if work:
                        proc.stdin.write(json.dumps(work, ensure_ascii=False) + "\n")
                        count += 1
                        if count % 50000 == 0:
                            print(f"{kind}: {count:,} sent to catalog DB", file=sys.stderr, flush=True)
                    if limit is not None and count >= limit:
                        break
            except BaseException:
                proc.kill()
                proc.wait()
                raise
            finally:
                if proc.stdin and not proc.stdin.closed:
                    proc.stdin.close()
            if proc.wait() != 0:
                raise RuntimeError(f"Catalog importer failed for {kind}")
    print(f"{kind}: completed {count:,} rows", file=sys.stderr, flush=True)
    return count


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--month", required=True, help="Official Discogs dump YYYYMM, e.g. 202610")
    ap.add_argument("--db", default="/data/catalog.sqlite")
    ap.add_argument("--kinds", nargs="+", choices=KINDS, default=["artists", "masters", "labels"],
                    help="Default imports all artists/masters/labels; add releases for the broadest coverage.")
    ap.add_argument("--limit", type=int, help="Test-only limit per dump; omit for full import")
    ap.add_argument("--show-urls", action="store_true", help="Print source URLs only")
    args = ap.parse_args()
    month_stamp(args.month)
    for kind in args.kinds:
        print(f"{kind}: {url_for(args.month, kind)}")
    if args.show_urls:
        return
    dbpath = pathlib.Path(args.db).expanduser().resolve()
    dbpath.parent.mkdir(parents=True, exist_ok=True)
    total = {}
    for kind in args.kinds:
        try:
            total[kind] = import_stream(args.month, kind, str(dbpath), args.limit)
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"Discogs {kind}: HTTP {exc.code}. Verify available month at https://data.discogs.com/")
    print(json.dumps({"database": str(dbpath), "counts": total, "complete": args.limit is None}, indent=2))


if __name__ == "__main__":
    main()
