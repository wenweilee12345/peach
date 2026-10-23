"""Torrent Desk 的已登录界面端点；凭据仅在本机配置。"""
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from .follow_secrets import CredentialStore
from .routes_auth import require_auth
from .torrent_desk import TorrentDesk


def create_router(local_only) -> APIRouter:
    router = APIRouter(prefix="/api/torrent-desk", dependencies=[Depends(require_auth)])

    def service(request: Request):
        return TorrentDesk(CredentialStore(request.app.state.settings.secrets_root))

    def call(service, action, body=None):
        try:
            return JSONResponse(getattr(service, action)(body) if body is not None
                                else getattr(service, action)(), headers={"Cache-Control": "no-store"})
        except ValueError as error:
            raise HTTPException(400, str(error)) from None

    @router.get("/status")
    def status(desk=Depends(service)):
        return call(desk, "status")

    @router.post("/search")
    def search(body: dict = Body(...), desk=Depends(service)):
        return call(desk, "search", body)

    @router.get("/queue")
    def queue(q: str = '', offset: int = 0, desk=Depends(service)):
        return call(desk, "queue", {'q': q, 'offset': offset})

    @router.post("/submit")
    def submit(body: dict = Body(...), desk=Depends(service)):
        return call(desk, "submit", body)

    @router.post("/configuration", dependencies=[Depends(local_only)])
    def configure(body: dict = Body(...), desk=Depends(service)):
        return call(desk, "configure", body)

    @router.post("/manage")
    def manage(body: dict = Body(...), desk=Depends(service)):
        return call(desk, "manage", body)

    return router
