"""外部播放器票据只授权单资产、限时读取。"""
import unittest

from peach.external_playback import TTL_SECONDS, deovr_scene, issue, valid


class ExternalPlaybackTests(unittest.TestCase):
    def test_deovr_projection_and_source_are_explicit(self):
        scene = deovr_scene(42, 'VR title', 'https://peach.example/external-stream/42?ticket=signed',
                            projection='dome', stereo='sbs')
        self.assertEqual(scene['screenType'], 'dome')
        self.assertEqual(scene['stereoMode'], 'sbs')
        self.assertTrue(scene['is3d'])
        self.assertEqual(scene['id'], 42)
        self.assertIn('ticket=signed', scene['path'])
        self.assertFalse(deovr_scene(42, 'Flat title', 'https://peach.example/42')['is3d'])
        with self.assertRaises(ValueError):
            deovr_scene(42, 'title', 'url', projection='unknown')
        with self.assertRaises(ValueError):
            deovr_scene(42, 'title', 'url', stereo='unknown')

    def test_ticket_is_scoped_expiring_and_tamper_evident(self):
        key = b'one-instance-key'
        ticket = issue(key, 42, now=100)
        self.assertTrue(valid(key, 42, ticket, now=101))
        self.assertFalse(valid(key, 43, ticket, now=101))
        self.assertFalse(valid(b'another-instance', 42, ticket, now=101))
        self.assertFalse(valid(key, 42, ticket, now=100 + TTL_SECONDS))
        self.assertFalse(valid(key, 42, ticket + '0', now=101))
        self.assertFalse(valid(key, 42, '../../media.mp4', now=101))

    def test_ticket_binds_origin(self):
        ticket = issue(b'key', 1, origin='https://public.example', now=100)
        self.assertTrue(valid(b'key', 1, ticket, origin='https://public.example', now=101))
        self.assertFalse(valid(b'key', 1, ticket, origin='https://other.example', now=101))
        self.assertFalse(valid(b'key', 1, ticket, now=101))
