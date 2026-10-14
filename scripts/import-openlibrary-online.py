#!/usr/bin/env python3
"""Stream the current official Open Library WORKS dump into the larper101 SQLite DB.
Use once from the Render Shell with a persistent disk. Does not scrape HTML or
harvest their API; the official monthly bulk dump is used instead.
Usage: python3 scripts/import-openlibrary-online.py --db /data/catalog.sqlite
"""
import argparse
import pathlib
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OFFICIAL = "https://openlibrary.org/data/ol_dump_works_latest.txt.gz"


def import_online(db_path, opener=urllib.request.urlopen, url=OFFICIAL):
    if url != OFFICIAL:
        raise ValueError("Only the official Open Library dump URL is accepted")
    pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    args = ["node", "scripts/import-openlibrary-dump.mjs", "--file", "-",
            "--gzip", "--db", str(db_path)]
    proc = subprocess.Popen(args, cwd=ROOT, stdin=subprocess.PIPE)
    size = 0
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "larper101/0.2 official bulk importer"})
        with opener(req, timeout=180) as response:
            while True:
                block = response.read(512 * 1024)
                if not block:
                    break
                proc.stdin.write(block)
                size += len(block)
                if size // (256 * 1024 * 1024) != (size - len(block)) // (256 * 1024 * 1024):
                    print(f"Open Library: streamed {size / 1024**3:.2f} GiB", file=sys.stderr, flush=True)
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("Open Library importer exited nonzero")
        print("Open Library: import completed successfully", file=sys.stderr)
        return size
    except BaseException:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        raise
    finally:
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="/data/catalog.sqlite")
    args = parser.parse_args()
    import_online(args.db)


if __name__ == "__main__":
    main()
