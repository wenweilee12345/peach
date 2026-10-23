"""PC 版单影片资料、挂载轮询及自动头像质量边界。"""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
from PIL import Image
from peach import avatar_followup, avatar_provider, push_discovery, web_library_processing
from peach.previews import entity_image_key


def image(size):
    body = io.BytesIO()
    Image.new('RGB', size, 'blue').save(body, format='PNG')
    return body.getvalue()


class PcEditionTests(unittest.TestCase):
    def test_portrait_upgrade_preserves_detail_and_manual_selection(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            path = root / f'{entity_image_key("performer", 1)}.img'
            path.write_bytes(image((125, 125)))
            larger = avatar_provider.inspect_avatar(image((600, 800)))
            self.assertTrue(avatar_followup.sharper_than_installed(root, 'performer', 1, larger))
            path.write_bytes(image((700, 900)))
            self.assertFalse(avatar_followup.sharper_than_installed(root, 'performer', 1, larger))
            Path(str(path) + '.provenance.json').write_text(json.dumps({'user_selected': True}))
            enormous = avatar_provider.inspect_avatar(image((1200, 1600)))
            self.assertFalse(avatar_followup.sharper_than_installed(root, 'performer', 1, enormous))

    def test_polling_preference_roundtrips_and_can_be_disabled(self):
        with tempfile.TemporaryDirectory() as temporary:
            settings = push_discovery.PushDiscoverySettings(Path(temporary).resolve())
            self.assertFalse(settings.load({}).poll_local)
            settings.save({'enabled': True, 'poll_local': True, 'cloud': False}, {})
            self.assertTrue(settings.load({}).poll_local)
            settings.save({'enabled': False, 'poll_local': False}, {})
            self.assertFalse(settings.load({}).poll_local)

    def test_targeted_metadata_does_not_silently_join_an_unrelated_job(self):
        with mock.patch('peach.web_library_processing.settings_file.active'), mock.patch(
                'peach.web_library_processing._current', return_value={'status': 'running'}):
            with self.assertRaisesRegex(ValueError, '所选影片'):
                web_library_processing.w_library_processing(object(), {'stage': 'metadata', 'asset_ids': [7]})

    def test_polling_observer_uses_existing_ingest_queue(self):
        with tempfile.TemporaryDirectory() as temporary:
            service = mock.Mock()
            service.config.poll_local = True
            service.config.watch_local = True
            service._local_roots.return_value = [('local', r'R:\media', Path(temporary).resolve())]
            with mock.patch('watchdog.observers.polling.PollingObserver') as factory:
                push_discovery.PushDiscoveryService._start_local(service)
                factory.assert_called_once_with(timeout=30)
                factory.return_value.start.assert_called_once()
                self.assertEqual(factory.return_value.schedule.call_args.kwargs, {'recursive': True})
