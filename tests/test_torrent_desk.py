"""本机桥接用假 HTTP 与临时凭据验证；不提交真实下载。"""
import json
import tempfile
import unittest
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from peach.follow_secrets import CredentialStore
from peach.torrent_desk import TorrentDesk
from peach.routes_torrent_desk import create_router
from peach.routes_auth import require_auth
from tests.test_downloads_resource_search import feed, item


class TorrentDeskTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = CredentialStore(Path(self.directory.name).resolve())
        self.requests = []

    def desk(self, custom=None):
        def respond(request):
            self.requests.append(request)
            if custom:
                result = custom(request)
                if result is not None:
                    return result
            if request.url.path == '/api/local-sources':
                return httpx.Response(200, json={"sources": [
                    {"id": "jackett", "name": "Jackett", "url": "http://127.0.0.1:9117/api"},
                    {"id": "nas", "name": "Remote", "url": "http://192.0.2.1/api"}]})
            if request.url.path == '/api/search':
                return httpx.Response(200, json={"xml": feed(item())})
            if request.url.path == '/api/queue':
                return httpx.Response(200, json={"magnets": [{"id": 1, "filename": "Example", "status": "Ready",
                    "links": ["private-link"]}]})
            return httpx.Response(200, json={})
        return TorrentDesk(self.store, transport=httpx.MockTransport(respond))

    def test_search_uses_managed_source_and_returns_clean_magnet_without_submitting(self):
        result = self.desk().search({"q": "ABC-123"})
        self.assertEqual(len(result['items']), 1)
        self.assertEqual(result['items'][0]['uri'], 'magnet:?xt=urn:btih:c9e15763f722f23e98a29decdfae341b98d53056')
        self.assertNotIn('passkey', json.dumps(result))
        self.assertEqual([str(request.url.host) for request in self.requests], ['127.0.0.1'] * 2)
        self.assertEqual(json.loads(self.requests[-1].content)['source'], {"id": "jackett"})

    def test_key_is_local_and_never_returned_in_status(self):
        desk = self.desk()
        desk.configure({"api_key": "test-secret"})
        self.assertTrue(desk.status()['connected'])
        self.assertNotIn('test-secret', json.dumps(desk.status()))
        self.assertEqual(desk.status()['sources'], [{"id": "jackett", "name": "Jackett"}])
        desk.configure({"disconnect": True})
        self.assertFalse(desk.configured())

    def test_catalog_search_excludes_other_codes_and_preserves_title_search(self):
        desk = self.desk()
        self.assertEqual(desk.search({"q": "SNOS-449"})['items'], [])
        self.assertEqual(len(desk.search({"q": "Example film"})['items']), 1)

    def test_provider_failures_do_not_expose_response_or_credentials(self):
        desk = self.desk(lambda request: httpx.Response(400, json={"error": "secret-api-key"}))
        with self.assertRaisesRegex(ValueError, 'could not complete') as failure:
            desk.status()
        self.assertNotIn('secret-api-key', str(failure.exception))

    def test_submit_requires_account_and_sends_only_valid_magnet(self):
        desk = self.desk()
        with self.assertRaises(ValueError):
            desk.submit({"magnet": "https://example.test/torrent"})
        with self.assertRaises(ValueError):
            desk.submit({"magnet": 'a' * 40})
        desk.configure({"api_key": "test-secret"})
        desk.submit({"magnet": 'a' * 40})
        request = self.requests[-1]
        self.assertEqual(request.url.path, '/api/add')
        self.assertEqual(request.headers['X-AllDebrid-Key'], 'test-secret')
        self.assertEqual(json.loads(request.content)['magnets'], 'magnet:?xt=urn:btih:' + 'a' * 40)

    def test_queue_excludes_download_links(self):
        desk = self.desk()
        desk.configure({"api_key": "test-secret"})
        queue = desk.queue()
        self.assertEqual(queue['items'][0]['filename'], 'Example')
        self.assertNotIn('private-link', json.dumps(queue))

    def test_file_tree_lists_names_without_provider_links(self):
        desk = self.desk(lambda request: httpx.Response(200, json={'magnets': [{'files': [
            {'n': 'folder', 'e': [{'n': 'video.mp4', 's': 100, 'l': 'private-link'}]}]}]}))
        desk.configure({'api_key': 'test-secret'})
        result = desk.manage({'action': 'files', 'id': 123})
        self.assertEqual(result['items'], [{'name': 'folder/video.mp4', 'size': 100}])
        self.assertNotIn('private-link', json.dumps(result))
        self.assertEqual(json.loads(self.requests[-1].content), {'id': '123'})

    def test_management_actions_use_only_the_explicit_torrent(self):
        desk = self.desk()
        desk.configure({'api_key': 'test-secret'})
        for action in ('restart', 'delete'):
            desk.manage({'action': action, 'id': 123})
            self.assertEqual(self.requests[-1].url.path, '/api/' + action)
            self.assertEqual(json.loads(self.requests[-1].content), {'id': '123'})
        before = len(self.requests)
        for body in ({'action': 'delete', 'id': '../1'}, {'action': 'delete', 'id': True}, {'action': 'bad', 'id': 1}):
            with self.assertRaises(ValueError):
                desk.manage(body)
        self.assertEqual(len(self.requests), before)

    def test_library_filter_and_pagination_cover_entries_after_the_first_page(self):
        rows = [{'id': index, 'filename': f'Torrent {index}', 'links': ['private']} for index in range(205)]
        desk = self.desk(lambda request: httpx.Response(200, json={'magnets': rows}))
        desk.configure({'api_key': 'test-secret'})
        result = desk.queue({'offset': 200})
        self.assertEqual(result['total'], 205)
        self.assertFalse(result['has_more'])
        self.assertEqual([row['id'] for row in result['items']], list(range(200, 205)))
        result = desk.queue({'q': 'Torrent 204'})
        self.assertEqual(result['total'], 1)
        self.assertEqual(result['items'][0]['id'], 204)
        self.assertNotIn('private', json.dumps(result))

    def test_source_failure_is_partial_and_unsafe_xml_is_rejected(self):
        desk = self.desk(lambda request: httpx.Response(200, json={"xml": '<!DOCTYPE rss><rss/>'})
                         if request.url.path == '/api/search' else None)
        self.assertEqual(desk.search({"q": "ABC-123"})['items'], [])
        self.assertTrue(desk.search({"q": "ABC-123"})['warnings'])

    def test_auth_and_local_configuration_dependencies_apply(self):
        from types import SimpleNamespace
        app = FastAPI()
        def local_only():
            from fastapi import HTTPException
            raise HTTPException(403, 'Local only')
        app.include_router(create_router(local_only))
        app.state.settings = SimpleNamespace(secrets_root=Path(self.directory.name).resolve())
        app.dependency_overrides[require_auth] = lambda: None
        with TestClient(app) as client:
            result = client.post('/api/torrent-desk/configuration', json={"api_key": "private"})
        self.assertEqual(result.status_code, 403)

    def test_mutation_routes_reject_cross_origin_before_service_calls(self):
        from types import SimpleNamespace
        app = FastAPI()
        app.include_router(create_router(lambda: None))
        app.state.settings = SimpleNamespace(token='', secrets_root=Path(self.directory.name).resolve())
        with TestClient(app) as client:
            for route, body in [('submit', {'magnet': 'a' * 40}), ('manage', {'action': 'delete', 'id': 1}),
                                ('configuration', {'api_key': 'private'}), ('search', {'q': 'ABC-123'})]:
                with self.subTest(route=route):
                    result = client.post('/api/torrent-desk/' + route, json=body,
                                         headers={'origin': 'https://untrusted.example', 'sec-fetch-site': 'cross-site'})
                    self.assertEqual(result.status_code, 403)
        self.assertFalse(self.store.load('torrent-desk'))
