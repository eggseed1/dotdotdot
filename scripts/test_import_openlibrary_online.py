import gzip
import importlib.util
import io
import sqlite3
import tempfile
import unittest
from pathlib import Path

MOD = Path(__file__).with_name("import-openlibrary-online.py")
spec = importlib.util.spec_from_file_location("ol_online", MOD)
ol = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ol)

class FakeResponse(io.BytesIO):
    pass

def fake_opener(request, timeout=None):
    book = b'/type/work\t/works/OL999W\t1\t2026-10-13\t{"key":"/works/OL999W","title":"Tiny Deep Cut Book","first_publish_date":"1931","subjects":["experimental"]}\n'
    return FakeResponse(gzip.compress(book))

class OpenLibraryOnlineTest(unittest.TestCase):
    def test_streamed_full_work_import(self):
        with tempfile.TemporaryDirectory() as root:
            db = str(Path(root, "catalog.sqlite"))
            self.assertGreater(ol.import_online(db, opener=fake_opener), 0)
            with sqlite3.connect(db) as c:
                self.assertEqual(c.execute("SELECT title FROM works WHERE source_id='OL999W'").fetchone()[0], "Tiny Deep Cut Book")

if __name__ == "__main__":
    unittest.main()
