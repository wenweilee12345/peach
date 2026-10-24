"""FFmpeg 对应源码归档与发行清单的行为验证。"""
from __future__ import annotations

import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/fetch_ffmpeg_sources.py"
SPEC = importlib.util.spec_from_file_location("ffmpeg_source_build", SCRIPT)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class FFmpegSourceBuildTests(unittest.TestCase):
    def test_source_lock_pins_all_linked_external_dependencies(self):
        lock = builder.load_sources()
        self.assertEqual(lock["version"], "9.0.2")
        self.assertEqual(lock["license"], "GPL-3.0-or-later")
        self.assertEqual(len(lock["sources"]), 4)
        self.assertIn('dav1d', {source['name'] for source in lock['sources']})

    def make_sources(self, output):
        lock = builder.load_sources()
        directory = output / "sources"
        directory.mkdir()
        for source in lock["sources"]:
            archive = directory / source["archive"]
            with tarfile.open(archive, "w:gz") as package:
                data = b"upstream source and license\n"
                entry = tarfile.TarInfo(f"{source['name']}-revision/README")
                entry.size = len(data)
                package.addfile(entry, io.BytesIO(data))
            source["sha256"] = builder.digest(archive)
        return lock

    def test_prepare_rejects_source_archive_tampering(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary).resolve()
            lock = self.make_sources(output)
            (output / "sources" / lock["sources"][0]["archive"]).write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "SHA256"):
                builder.prepare(output, lock)
            self.assertFalse((output / "work/ffmpeg").exists())


if __name__ == "__main__":
    unittest.main()
