import { expect, it, vi } from 'vitest';
import { act } from 'react';
import { ItemTorrentSearch, torrentQuery } from '../../src/react/item-detail/item-torrent-search';
import { click, mount, settle } from './render';

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
