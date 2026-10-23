import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { confirmModal } from '@peach/legacy/ui';
import { apiGet, apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import { ErrorText, Help, Stack } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';
import { TorrentQueueRow, type TorrentQueueItem } from './torrent-queue-row';

interface Candidate { id: string; uri: string; name: string; size: number; seeders: number; source: string }
interface SearchResult { items: Candidate[]; warnings: string[] }
interface DeskStatus { connected: boolean; sources: { id: string; name: string }[] }
interface TorrentQueue { items: TorrentQueueItem[]; total: number; has_more: boolean }

export function torrentQuery(code: string | undefined, name: string): string {
  return code || name.match(/(?:FC2[-_ ]?(?:PPV[-_ ]?)?\d{5,8}|[A-Z]{2,10}[-_]\d{2,7})/i)?.[0].replaceAll('_', '-') || name;
}

export function ItemTorrentSearch({ code, name, toast, autoSearch = false, standalone = false }: {
  code?: string; name: string; toast(message: string): void; autoSearch?: boolean; standalone?: boolean;
}) {
  const [open, setOpen] = useState(autoSearch || standalone);
  const [query, setQuery] = useState(() => torrentQuery(code, name));
  const [automaticQuery] = useState(query);
  const [manualSearch, setManualSearch] = useState(false);
  const [source, setSource] = useState('');
  const [savedStatus, setStatus] = useState<DeskStatus | null>(null);
  const [savedResult, setResult] = useState<SearchResult | null>(null);
  const [queueFilter, setQueueFilter] = useState('');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [queueOffset, setQueueOffset] = useState(0);
  const [magnet, setMagnet] = useState('');
  const [key, setKey] = useState('');
  const [submitted, setSubmitted] = useState<string[]>([]);
  const action = useAction();
  const automatic = useQuery({
    queryKey: ['torrent-desk', 'automatic-search', automaticQuery], enabled: autoSearch,
    staleTime: 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const [status, result] = await Promise.all([
        apiGet<DeskStatus>('/api/torrent-desk/status', signal),
        apiSend<SearchResult>('/api/torrent-desk/search', { q: automaticQuery }, 'POST', signal),
      ]);
      return { status, result };
    },
  }, queryClient);
  const connection = useQuery({ queryKey: ['torrent-desk', 'status'], enabled: standalone,
    queryFn: ({ signal }) => apiGet<DeskStatus>('/api/torrent-desk/status', signal),
    retry: false, refetchOnWindowFocus: false,
  }, queryClient);
  const status = savedStatus ?? automatic.data?.status ?? connection.data;
  const queueKey = ['torrent-desk', 'queue', libraryQuery, queueOffset] as const;
  const queueUrl = `/api/torrent-desk/queue?${new URLSearchParams({ q: libraryQuery, offset: String(queueOffset) })}`;
  const queueData = useQuery({ queryKey: queueKey,
    enabled: standalone && !!status?.connected, retry: false, refetchOnWindowFocus: false,
    refetchInterval: standalone && status?.connected ? 15_000 : false,
    queryFn: ({ signal }) => apiGet<TorrentQueue>(queueUrl, signal),
  }, queryClient);
  const queue = status?.connected ? queueData.data?.items : undefined;
  const result = manualSearch ? savedResult : savedResult ?? automatic.data?.result;
  const searching = action.busy === 'search' || automatic.isFetching;
  const error = action.error || (!manualSearch && automatic.error ? errorMessage(automatic.error) : '')
    || (!savedStatus && standalone && connection.error ? errorMessage(connection.error) : '');
  const refresh = () => void action.run('status', signal => apiGet<DeskStatus>('/api/torrent-desk/status', signal), setStatus);
  const search = () => {
    if (action.busy || automatic.isFetching || query.trim().length < 2) return;
    setManualSearch(true);
    setResult(null);
    void action.run('search', async signal => {
      const [nextStatus, nextResult] = await Promise.all([
        status ? Promise.resolve(status) : apiGet<DeskStatus>('/api/torrent-desk/status', signal),
        apiSend<SearchResult>('/api/torrent-desk/search', { q: query.trim(), source }, 'POST', signal),
      ]);
      return { status: nextStatus, result: nextResult };
    }, next => { setStatus(next.status); setResult(next.result) });
  };
  return <details open={open} onToggle={event => {
    const next = event.currentTarget.open;
    setOpen(next);
    if (next && !autoSearch && !standalone && !status && !action.busy) refresh();
  }}>
    <summary>Search torrents · Torrent Desk / Jackett</summary>
    <Stack>
      <Input label="Title or catalog code" value={query} onChange={setQuery} maxLength={200}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); search() } }} />
      {status ? <label className="flex flex-col gap-1 text-body-2-regular">Indexer
        <select aria-label="Torrent indexer" value={source} onChange={event => setSource(event.target.value)} className="max-w-full rounded-md border border-separator-border bg-background p-2">
          <option value="">All local indexers</option>
          {status.sources.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </label> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={query.trim().length < 2} {...busyProps(searching)} onClick={search}>
          {searching ? 'Searching torrents…' : 'Search torrents'}</Button>
        <Button variant="secondary" {...busyProps(action.busy === 'status')} onClick={() => { if (!action.busy) refresh() }}>Check connection</Button>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {result?.warnings.map(message => <Help key={message}>{message}</Help>)}
      {result && !result.items.length ? <Help role="status">No matching torrents. Try another catalog code or indexer.</Help> : null}
      {result?.items.map(row => <div key={row.id} className="flex min-w-0 flex-col gap-2 border-t border-separator-border pt-3 wrap-anywhere">
        <p className="text-body-2-medium">{row.name}</p>
        <Help>{(row.size / 1024 ** 3).toFixed(2)} GiB · {row.seeders} seeders · {row.source}</Help>
        <Button variant="secondary" disabled={!status?.connected || submitted.includes(row.id)} onClick={() => {
          if (action.busy) return;
          void confirmModal({ title: 'Send torrent to AllDebrid', body: `Add “${row.name}” to your AllDebrid account?`, confirmLabel: 'Send to AllDebrid',
            onConfirm: async () => {
              await apiSend('/api/torrent-desk/submit', { magnet: row.uri });
              void queryClient.invalidateQueries({ queryKey: ['torrent-desk', 'queue'] });
              setSubmitted(previous => [...previous, row.id]); toast('Sent torrent to AllDebrid');
            } });
        }}>{submitted.includes(row.id) ? 'Sent to AllDebrid' : 'Send to AllDebrid'}</Button>
      </div>)}
      <details open={standalone || undefined}><summary>AllDebrid account and queue</summary><Stack>
        <Help>{status?.connected ? 'AllDebrid API key saved on this PC.' : 'Connect AllDebrid to send a torrent and view the queue.'}</Help>
        <Input label="AllDebrid API key" type="password" autoComplete="off" value={key} onChange={setKey} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!key.trim()} {...busyProps(action.busy === 'connect')} onClick={() => {
            if (action.busy) return;
            void action.run('connect', signal => apiSend<{ connected: boolean }>('/api/torrent-desk/configuration', { api_key: key }, 'POST', signal), next => {
              void queryClient.resetQueries({ queryKey: ['torrent-desk', 'queue'] });
              setKey(''); setStatus(previous => ({ connected: next.connected, sources: previous?.sources || [] })); toast('Saved AllDebrid connection');
            });
          }}>Save connection</Button>
          {status?.connected ? <Button variant="secondary" {...busyProps(action.busy === 'disconnect')} onClick={() => {
            if (action.busy) return;
            void action.run('disconnect', signal => apiSend('/api/torrent-desk/configuration', { disconnect: true }, 'POST', signal), () => {
              setStatus(previous => ({ connected: false, sources: previous?.sources || [] }));
              queryClient.removeQueries({ queryKey: ['torrent-desk', 'queue'] }); toast('Disconnected AllDebrid');
            });
          }}>Disconnect</Button> : null}
          <Button variant="secondary" disabled={!status?.connected} {...busyProps(action.busy === 'queue')} onClick={() => {
            if (!action.busy) void action.run('queue', signal => apiGet<TorrentQueue>(queueUrl, signal),
              next => queryClient.setQueryData(queueKey, next));
          }}>{action.busy === 'queue' ? 'Loading queue…' : 'Refresh queue'}</Button>
        </div>
        {standalone ? <>
          <Input label="Magnet link or info hash" value={magnet} onChange={setMagnet} maxLength={2000} />
          <Button variant="secondary" disabled={!status?.connected || !magnet.trim()} onClick={() => {
            void confirmModal({ title: 'Add magnet to AllDebrid', body: 'Add this magnet to your AllDebrid download queue?', confirmLabel: 'Add magnet',
              onConfirm: async () => {
                await apiSend('/api/torrent-desk/submit', { magnet: magnet.trim() });
                setMagnet(''); await queryClient.invalidateQueries({ queryKey: ['torrent-desk', 'queue'] }); toast('Added magnet to AllDebrid');
              } });
          }}>Add magnet</Button>
          <Input label="Filter AllDebrid library" value={queueFilter} onChange={setQueueFilter} maxLength={200} />
          <Button variant="secondary" onClick={() => { setLibraryQuery(queueFilter.trim()); setQueueOffset(0) }}>Filter library</Button>
        </> : null}
        {status?.connected && queueData.error ? <ErrorText>{errorMessage(queueData.error)}</ErrorText> : null}
        {queue && !queue.length ? <Help>Your AllDebrid queue is empty.</Help> : null}
        {queue?.map(row => <TorrentQueueRow key={row.id} item={row} toast={toast} refresh={() => queueData.refetch({ cancelRefetch: false })} />)}
        {queue && standalone ? <div className="flex flex-wrap items-center gap-2">
          <Help>{queueData.data?.total ?? queue.length} torrents</Help>
          <Button variant="secondary" disabled={!queueOffset} onClick={() => setQueueOffset(offset => Math.max(0, offset - 100))}>Previous page</Button>
          <Button variant="secondary" disabled={!queueData.data?.has_more} onClick={() => setQueueOffset(offset => offset + 100)}>Next page</Button>
        </div> : null}
      </Stack></details>
    </Stack>
  </details>;
}
