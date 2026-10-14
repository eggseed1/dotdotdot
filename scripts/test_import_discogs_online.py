import gzip
import importlib.util
import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("import-discogs-online.py")
spec = importlib.util.spec_from_file_location("discogs_online", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fake_opener(xml):
    payload = gzip.compress(xml.encode("utf-8"))
    def open_url(url):
        return io.BytesIO(payload)
    return open_url


class DiscogsOnlineTest(unittest.TestCase):
    def test_url_follows_official_month(self):
        url = mod.url_for("202610", "masters")
        self.assertEqual(url, "https://discogs-data-dumps.s3.us-west-2.amazonaws.com/data/2026/discogs_20261001_masters.xml.gz")
        with self.assertRaises(ValueError):
            mod.month_stamp("../evil")

    def test_full_artist_and_label_import(self):
        artists = """<artists><artist><id>41</id><name>Rare Artist</name>
          <realname>Guitar Person</realname><aliases><name>Rare Alias</name></aliases>
          <namevariations><name>Rare Arty</name></namevariations></artist>
          <artist><id>42</id><name>Another Band</name></artist></artists>"""
        labels = """<labels><label><id>52</id><name>Independent Imprint</name>
          <parentLabel>Parent</parentLabel></label></labels>"""
        with tempfile.TemporaryDirectory() as temp:
            db = str(Path(temp, "catalog.sqlite"))
            a = mod.import_stream("202610", "artists", db, opener=fake_opener(artists))
            l = mod.import_stream("202610", "labels", db, opener=fake_opener(labels))
            self.assertEqual(a, 2)
            self.assertEqual(l, 1)
            with sqlite3.connect(db) as cx:
                self.assertEqual(cx.execute("SELECT name FROM discogs_artists WHERE discogs_id=41").fetchone()[0], "Rare Artist")
                self.assertEqual(cx.execute("SELECT parent_label FROM discogs_labels WHERE discogs_id=52").fetchone()[0], "Parent")

    def test_master_streams_to_catalog(self):
        master = """<masters><master id="77"><title>Deepest Deep Cut</title>
          <year>1991</year><artists><artist><name>A Band Nobody Knows</name></artist></artists>
          <genres><genre>Rock</genre></genres><styles><style>Shoegaze</style></styles></master></masters>"""
        with tempfile.TemporaryDirectory() as temp:
            db = str(Path(temp, "catalog.sqlite"))
            result = mod.import_stream("202610", "masters", db, opener=fake_opener(master))
            self.assertEqual(result, 1)
            with sqlite3.connect(db) as cx:
                self.assertEqual(cx.execute("SELECT title FROM works WHERE id='discogs:master:77'").fetchone()[0], "Deepest Deep Cut")
                self.assertIn(("shoegaze",), cx.execute("SELECT genre FROM work_genres").fetchall())


if __name__ == "__main__":
    unittest.main()
