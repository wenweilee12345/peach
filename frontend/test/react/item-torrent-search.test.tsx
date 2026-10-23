import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../src/react/query';
import { JavDetailPage } from '../../src/react/jav-detail/jav-detail-page';
import { javDetailKey, type JavDetail } from '../../src/react/jav-detail/jav-detail';
import { ItemTorrentSearch, torrentQuery } from '../../src/react/item-detail/item-torrent-search';
import { click, mount, settle } from './render';

afterEach(() => queryClient.clear());

it('从串流文件名提取番号并保留用户的明确番号', () => {
  expect(torrentQuery(undefined, '4k688.com@SNOS-449.mp4.strm')).toBe('SNOS-449');
  expect(torrentQuery('SONE-969', 'SNOS-449.strm')).toBe('SONE-969');
  expect(torrentQuery(undefined, 'Example film')).toBe('Example film');
});

it('折叠入口不自动搜索或提交下载', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(<ItemTorrentSearch name="SNOS-449.strm" toast={vi.fn()} />);
  expect(host.querySelector('summary')?.textContent).toContain('Search torrents');
  expect(host.querySelector('input')?.value).toBe('SNOS-449');
  expect(fetcher).not.toHaveBeenCalled();
});

it('搜索候选只读取来源与搜索结果，等待用户逐条选择下载', async () => {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/status')
    ? { connected: true, sources: [{ id: 'jackett', name: 'Jackett' }] }
    : { items: [{ id: 'one', uri: 'magnet:?xt=urn:btih:' + 'a'.repeat(40), name: 'SNOS-449', size: 1024, seeders: 2, source: 'Jackett' }], warnings: [] } }));
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(<ItemTorrentSearch name="SNOS-449.strm" toast={vi.fn()} />);
  await act(async () => {
    const panel = host.querySelector('details')!;
    panel.open = true;
    panel.dispatchEvent(new Event('toggle'));
  });
  await settle();
  await click(Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Search torrents')!);
  await settle();
  expect(host.textContent).toContain('SNOS-449');
  expect(host.textContent).toContain('Send to AllDebrid');
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/torrent-desk/status', '/api/torrent-desk/search']);
});

it('库外作品详情也提供独立的种子搜索入口', async () => {
  const item: JavDetail = { code: 'SNOS-449', title: 'Example work', state: 'ready', summary: '',
    director: '', publisher: '', performers: '', performer_refs: [], studio_refs: [], series_refs: [],
    tags: [], has_cover: false, source_image: false, preview_count: 0, comments_count: 0, source_url: '', wanted: false, want_id: null };
  queryClient.setQueryData(javDetailKey(item.code), item);
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ items: [], tasks: [], providers: [] }) }));
  vi.stubGlobal('fetch', fetcher);
  const host = await mount(<QueryClientProvider client={queryClient}><JavDetailPage code={item.code} readOnly={false}
    actions={{ close: vi.fn(), navigate: vi.fn(), openTag: vi.fn(), receipt: vi.fn() }} /></QueryClientProvider>);
  expect([...host.querySelectorAll('summary')].some(summary => summary.textContent?.includes('Search torrents'))).toBe(true);
  expect(host.querySelector('input')?.value).toBe('SNOS-449');
  expect(fetcher.mock.calls.some(call => String(call[0]).includes('/torrent-desk/submit'))).toBe(false);
});
