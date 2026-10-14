import gzip
import io
import json
import tempfile
import sqlite3
import subprocess
import unittest
from pathlib import Path
import importlib.util

script = Path(__file__).with_name('import-discogs-dump.py')
spec = importlib.util.spec_from_file_location('discogs_importer', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DiscogsImportTest(unittest.TestCase):
    def test_masters_and_releases(self):
        masters = b'''<masters><master id="777"><title>Loveless</title><year>1991</year><artists><artist><name>My Bloody Valentine</name></artist></artists><genres><genre>Rock</genre></genres><styles><style>Shoegaze</style></styles></master></masters>'''
        releases = b'''<releases><release id="3"><title>Loveless</title><released>1991-11-01</released><country>UK</country><master_id>777</master_id><artists><artist><name>My Bloody Valentine</name></artist></artists></release><release id="4"><title>Obscure Test Album</title><released>1983</released><artists><artist><name>Small Band</name></artist></artists><styles><style>Experimental</style></styles></release></releases>'''
        with tempfile.TemporaryDirectory() as folder:
            master_path = Path(folder, 'masters.xml.gz')
            release_path = Path(folder, 'releases.xml.gz')
            master_path.write_bytes(gzip.compress(masters))
            release_path.write_bytes(gzip.compress(releases))
            out = io.StringIO()
            self.assertEqual(module.convert(str(master_path), 'masters', out), 1)
            m = json.loads(out.getvalue())
            self.assertEqual(m['sourceId'], 'master:777')
            self.assertIn('shoegaze', m['genres'])
            self.assertIsNone(m['ratingCount'])
            out = io.StringIO()
            self.assertEqual(module.convert(str(release_path), 'releases', out), 1)
            r = json.loads(out.getvalue())
            self.assertEqual(r['sourceId'], 'release:4')
            self.assertEqual(r['country'], '')
            self.assertEqual(r['year'], 1983)
            out = io.StringIO()
            self.assertEqual(module.convert(str(release_path), 'releases', out, True), 2)


    def test_stream_into_real_catalog(self):
        masters = b'''<masters><master id="999"><title>Almost Unknown Record</title><year>1987</year><artists><artist><name>Unknown Artist</name></artist></artists><genres><genre>Rock</genre></genres><styles><style>Shoegaze</style></styles></master></masters>'''
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder, 'masters.xml.gz')
            db = Path(folder, 'catalog.sqlite')
            source.write_bytes(gzip.compress(masters))
            text = io.StringIO()
            module.convert(str(source), 'masters', text)
            result = subprocess.run(
                ['node', 'scripts/import-catalog.mjs', '--file', '-', '--source', 'discogs', '--db', str(db)],
                input=text.getvalue(), capture_output=True, text=True, cwd=script.parent.parent, check=True
            )
            self.assertIn('"imported": 1', result.stdout)
            connection = sqlite3.connect(db)
            row = connection.execute('SELECT title,rating_count,verified FROM works WHERE source=?', ('discogs',)).fetchone()
            self.assertEqual(row, ('Almost Unknown Record', None, 1))
            genres = connection.execute('SELECT genre FROM work_genres ORDER BY genre').fetchall()
            self.assertIn(('shoegaze',), genres)
            connection.close()


if __name__ == '__main__':
    unittest.main()