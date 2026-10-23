import { act } from 'react';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { CatalogGridPage } from '../../src/react/catalog-grid/catalog-grid-page';
import type { CatalogGridProps } from '../../src/react/catalog-grid/types';
import { setCatalogView } from '../../src/react/catalog-grid/catalog-view';
import { queryClient } from '../../src/react/query';
import { mount, mountRoot, settle } from './render';

notifyManager.setScheduler(notify => notify());
afterEach(() => { queryClient.clear(); act(() => setCatalogView('cards')) });

function props(query = 'IPZZ-823', patch: Partial<CatalogGridProps> = {}): CatalogGridProps {
  return { mode: 'catalog', filters: { q: query }, selected: new Set(), selectMode: false,
    revision: 0, seekSeconds: 10, skeletonHtml: () => '', wireDrag: vi.fn(),
    layout: { active: false, size: 'small', portrait: false, javImage: 'cover' },
    helpers: { badgeHtml: () => '', titleHtml: (_, name) => name, displayName: (_, name) => name, tagLabel: tag => tag },
    actions: { open: vi.fn(), openResource: vi.fn(), openShort: vi.fn(), openShorts: vi.fn(), openMix: vi.fn(),
      openEntity: vi.fn(), openUnowned: vi.fn(), toggleTag: vi.fn(), toggleSelection: vi.fn(),
      watchLater: vi.fn(async () => {}), resourceOperation: vi.fn(async () => {}), mixRelated: vi.fn(async () => []), canFlip: () => false },
    ...patch };
}
const app = (value: CatalogGridProps) => <QueryClientProvider client={queryClient}><CatalogGridPage {...value} /></QueryClientProvider>;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 680)) });
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
function server(globalMatch = false) {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/status')) return response({ connected: true, sources: [] });
    if (url.endsWith('/search')) return response({ items: [{ id: 'candidate', uri: 'magnet:?xt=urn:btih:' + 'a'.repeat(40),
      name: 'IPZZ-823 candidate', seeders: 3, size: 1024, source: 'Jackett' }], warnings: [] });
    const global = new URL(url, 'http://peach.test').searchParams.get('thumb') === '0';
    return response({ items: global && globalMatch ? [{ id: 1, name: 'Existing video' }] : [], total: global && globalMatch ? 1 : 0 });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

it.each(['cards', 'list', 'wall'])('主搜索无馆藏匹配时在 %s 视图自动搜索但不提交下载', async view => {
  setCatalogView(view === 'list' ? 'list' : 'cards');
  const fetcher = server();
  const host = await mount(app(props('IPZZ-823', { wall: view === 'wall' })));
  expect(fetcher.mock.calls.some(([url]) => url.includes('/torrent-desk/'))).toBe(false);
  await flush();
  await settle();
  expect(host.querySelector('[data-torrent-fallback]')).not.toBeNull();
  expect(host.textContent).toContain('IPZZ-823 candidate');
  const searches = fetcher.mock.calls.filter(([url]) => url.endsWith('/search'));
  expect(searches).toHaveLength(1);
  expect(JSON.parse(String(searches[0]?.[1]?.body))).toEqual({ q: 'IPZZ-823' });
  expect(fetcher.mock.calls.some(([url]) => url.includes('/submit'))).toBe(false);
});

it('其它筛选隐藏的已有影片不触发外部搜索', async () => {
  const fetcher = server(true);
  await mount(app(props()));
  await flush();
  expect(fetcher.mock.calls.some(([url]) => url.includes('/torrent-desk/'))).toBe(false);
});

it.each([{ q: '', state: '' }, { q: 'IPZZ-823', state: 'trash' }])('普通空态与回收站不自动搜索 %j', async filters => {
  const fetcher = server();
  await mount(app(props('', { filters })));
  await flush();
  expect(fetcher.mock.calls.some(([url]) => url.includes('/torrent-desk/'))).toBe(false);
});

it('更换主搜索词会取消旧的种子请求并丢弃迟到结果', async () => {
  let release!: (value: ReturnType<typeof response>) => void;
  let oldSignal: AbortSignal | null | undefined;
  const fetcher = server();
  const initial = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => {
    if (url.endsWith('/search') && JSON.parse(String(init?.body)).q === 'IPZZ-823') {
      oldSignal = init?.signal;
      return new Promise(resolve => { release = resolve });
    }
    return initial(url, init);
  });
  const root = await mountRoot(app(props()));
  await flush();
  expect(oldSignal).toBeDefined();
  await root.rerender(app(props('SNOS-449')));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => release(response({ items: [{ id: 'late', name: 'Late old result' }], warnings: [] })));
  await flush();
  expect(root.host.textContent).not.toContain('Late old result');
  expect(root.host.querySelector('input')?.value).toBe('SNOS-449');
});
