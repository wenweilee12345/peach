"""本机 Torrent Desk 桥接：Jackett 搜索、磁力候选和 AllDebrid 队列。"""
from __future__ import annotations

import json
import time
from urllib.parse import urlsplit
from xml.etree.ElementTree import ParseError

import httpx
from torznab.exceptions import TorznabAPIError
from torznab.parser import parse_torznab

from .catalog_rules import release_code_from_text, same_release_code
from .downloads import parse_magnet
from .feeds import scan_code
from .follow_secrets import CredentialStore
from .resource_search import _torrent_hash, qualities

ORIGIN = "http://127.0.0.1:4173"
PROVIDER = "torrent-desk"
MAX_BYTES = 3_000_000


def magnet_hash(item):
    """按 Torznab 字段顺序读取已有哈希，不请求种子链接。"""
    for value in (item.magnet_url, item.infohash, item.link, item.guid):
        try:
            return parse_magnet(value or "").info_hash
        except ValueError:
            pass
    return None


class TorrentDesk:
    def __init__(self, credentials: CredentialStore, *, transport=None):
        self.credentials = credentials
        self.transport = transport

    def configured(self) -> bool:
        saved = self.credentials.load(PROVIDER)
        return bool(saved and saved.values.get("api_key"))

    def configure(self, body: dict) -> dict:
        key = str(body.get("api_key") or "").strip()
        if body.get("disconnect") is True:
            key = ""
        elif not key:
            raise ValueError("Enter your AllDebrid API key.")
        if len(key) > 512 or any(char.isspace() for char in key):
            raise ValueError("Invalid AllDebrid API key.")
        self.credentials.save(PROVIDER, {"api_key": key})
        return {"ok": True, "connected": bool(key)}

    def _post(self, route: str, body: dict, *, account=False) -> dict:
        headers = {}
        if account:
            saved = self.credentials.load(PROVIDER)
            key = saved.values.get("api_key", "") if saved else ""
            if not key:
                raise ValueError("Connect AllDebrid in Torrent search first.")
            headers["X-AllDebrid-Key"] = key
        try:
            with httpx.Client(transport=self.transport, trust_env=False, follow_redirects=False,
                              timeout=25) as client:
                with client.stream("POST", f"{ORIGIN}/api/{route}", json=body, headers=headers) as response:
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_BYTES:
                            raise ValueError("Torrent Desk response is too large.")
                    if response.status_code != 200:
                        raise ValueError("Torrent Desk could not complete the request. Check the service and account.")
                    data = json.loads(content)
                    if not isinstance(data, dict) or data.get("error"):
                        raise ValueError("Torrent Desk returned an invalid response.")
                    return data
        except (httpx.HTTPError, UnicodeError, json.JSONDecodeError):
            raise ValueError("Torrent Desk is unavailable. Start it on this PC at port 4173.") from None

    def sources(self) -> list[dict]:
        rows = self._post("local-sources", {}).get("sources", [])
        # 本机试用只连接本机索引器。
        return [row for row in rows if isinstance(row, dict)
                and urlsplit(str(row.get("url", ""))).hostname in ("127.0.0.1", "localhost", "::1")][:4]

    def status(self) -> dict:
        return {"ok": True, "connected": self.configured(),
                "sources": [{"id": row["id"], "name": row["name"]} for row in self.sources()]}

    def search(self, body: dict) -> dict:
        query = str(body.get("q") or "").strip()
        if not 2 <= len(query) <= 200:
            raise ValueError("Search needs 2–200 characters.")
        selected = str(body.get("source") or "")
        sources = [source for source in self.sources() if not selected or source["id"] == selected]
        if not sources:
            raise ValueError("No local Jackett sources are configured in Torrent Desk.")
        found, warnings = {}, []
        deadline = time.monotonic() + 60
        with httpx.Client(transport=self.transport, trust_env=False, follow_redirects=False) as client:
            for source in sources:
                if time.monotonic() >= deadline:
                    warnings.append("Search time limit reached. Choose one indexer and retry.")
                    break
                try:
                    xml = str(self._post("search", {"q": query, "source": {"id": source["id"]}}).get("xml", ""))
                    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
                        raise ValueError("Unsupported XML declarations.")
                    budget = 6
                    for item in parse_torznab(xml)[:100]:
                        code = release_code_from_text(query)
                        if code and not same_release_code(scan_code(str(item.title or "")), code):
                            continue
                        info_hash = magnet_hash(item)
                        if not info_hash and item.link and budget > 0:
                            budget -= 1
                            info_hash = _torrent_hash(client, source, item.link, deadline)
                        if not info_hash:
                            continue
                        if info_hash in found:
                            found[info_hash]["seeders"] = max(found[info_hash]["seeders"], int(item.seeders or 0))
                            continue
                        found[info_hash] = {"id": info_hash, "uri": f"magnet:?xt=urn:btih:{info_hash}",
                                            "name": str(item.title or "")[:500], "size": int(item.size or 0),
                                            "seeders": int(item.seeders or 0), "source": source["name"],
                                            **qualities(str(item.title or ""), item.tags, query)}
                except (ValueError, ParseError, TorznabAPIError):
                    warnings.append(f"{source['name']}: search failed; check this indexer in Jackett.")
        return {"ok": True, "items": sorted(found.values(), key=lambda row: (-row["seeders"], -row["resolution"]))[:50],
                "warnings": warnings}

    def submit(self, body: dict) -> dict:
        magnet = parse_magnet(str(body.get("magnet") or ""))
        self._post("add", {"magnets": f"magnet:?xt=urn:btih:{magnet.info_hash}"}, account=True)
        return {"ok": True}

    def queue(self) -> dict:
        data = self._post("queue", {}, account=True)
        rows = data.get("magnets", [])
        if isinstance(rows, dict):
            rows = [rows]
        return {"ok": True, "items": [{key: row.get(key) for key in
                ("id", "filename", "status", "statusCode", "size", "downloaded", "uploadDate")}
                for row in rows[:100] if isinstance(row, dict)]}
