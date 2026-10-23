import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemMetadataActions } from '../../src/react/item-detail/item-metadata-actions';
import { LIBRARY_PROCESSING_KEY } from '../../src/react/library-processing/library-processing';
import { click, mount } from './render';

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach(client => client.clear()));

async function render(status: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData(LIBRARY_PROCESSING_KEY, { status });
  return mount(<QueryClientProvider client={client}><ItemMetadataActions id={42} /></QueryClientProvider>);
}

it('详情刷新只提交当前影片编号与资料阶段', async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true,
    json: async () => ({ status: init?.method === 'POST' ? 'running' : 'idle' }) }));
  vi.stubGlobal('fetch', fetcher);
  const host = await render('idle');
  await click(host.querySelector('button'));
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(post?.[0]).toBe('/api/library-processing');
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ stage: 'metadata', asset_ids: [42] });
});

it('全库任务运行期间禁用详情刷新', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const host = await render('running');
  expect(host.querySelector('button')?.disabled).toBe(true);
  await click(host.querySelector('button'));
  expect(fetcher).not.toHaveBeenCalled();
});
