import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TorrentDeskPage } from '../../src/react/torrent-desk/torrent-desk-page';
import { queryClient } from '../../src/react/query';
import { buttonNamed, click, mount, settle, type } from './render';

const confirm = vi.hoisted(() => vi.fn(async (_options: { onConfirm(): Promise<void> }) => true));
vi.mock('@peach/legacy/ui', async original => ({ ...await original<object>(), confirmModal: confirm }));
notifyManager.setScheduler(notify => notify());
afterEach(() => { queryClient.clear(); confirm.mockClear() });

function server() {
  let removed = false;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'http://peach.test').pathname;
    let body: unknown;
    if (path.endsWith('/status')) body = { connected: true, sources: [] };
    else if (path.endsWith('/queue')) body = { items: removed ? [] : [{ id: 123, filename: 'Example torrent', status: 'Ready', size: 100 }], total: removed ? 0 : 1, has_more: false };
    else if (path.endsWith('/manage')) {
      const action = JSON.parse(String(init?.body)).action;
      if (action === 'delete') removed = true;
      body = action === 'files' ? { items: [{ name: 'folder/video.mp4', size: 100 }] } : { ok: true };
    } else body = { items: [], warnings: [] };
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
async function render() {
  const navigate = vi.fn(), toast = vi.fn();
  const host = await mount(<QueryClientProvider client={queryClient}><TorrentDeskPage navigate={navigate} toast={toast} /></QueryClientProvider>);
  await settle();
  return { host, navigate, toast };
}

it('独立页可查询、读取队列和文件列表', async () => {
  const fetcher = server();
  const { host } = await render();
  expect(host.textContent).toContain('Example torrent');
  await click(buttonNamed('View files', host));
  expect(host.textContent).toContain('folder/video.mp4');
  await type(host.querySelector('input'), 'IPZZ-823');
  await click(buttonNamed('Search torrents', host));
  const search = fetcher.mock.calls.find(([url]) => url.endsWith('/search'));
  expect(JSON.parse(String(search?.[1]?.body))).toEqual({ q: 'IPZZ-823', source: '' });
  expect(fetcher.mock.calls.some(([url]) => url.endsWith('/submit'))).toBe(false);
});

it('删除在确认后执行且刷新云端列表', async () => {
  const fetcher = server();
  const { host, toast } = await render();
  await click(buttonNamed('Remove from AllDebrid', host));
  expect(fetcher.mock.calls.some(([, init]) => String(init?.body).includes('delete'))).toBe(false);
  expect(confirm).toHaveBeenCalledOnce();
  await act(async () => confirm.mock.calls[0]![0].onConfirm());
  expect(host.querySelector('[data-torrent-queue-item]')).toBeNull();
  expect(toast).toHaveBeenCalledWith('Removed torrent from AllDebrid');
});

it('资料库筛选提交到服务端，媒体库控件进入现有页面', async () => {
  const fetcher = server();
  const { host, navigate } = await render();
  await type([...host.querySelectorAll('input')].at(-1), 'Example');
  await click(buttonNamed('Filter library', host));
  expect(fetcher.mock.calls.some(([url]) => url.includes('/queue?q=Example'))).toBe(true);
  await click(buttonNamed('Media folders', host));
  expect(navigate).toHaveBeenCalledWith('/settings/library');
});
