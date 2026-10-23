import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { confirmModal } from '@peach/legacy/ui';
import { apiGet, apiSend } from '../../api';
import { ErrorText, Help, Stack } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';

interface Candidate { id: string; uri: string; name: string; size: number; seeders: number; source: string }
interface SearchResult { items: Candidate[]; warnings: string[] }
interface DeskStatus { connected: boolean; sources: { id: string; name: string }[] }
interface QueueItem { id: number; filename: string; status: string }

export function torrentQuery(code: string | undefined, name: string): string {
  return code || name.match(/(?:FC2[-_ ]?(?:PPV[-_ ]?)?\d{5,8}|[A-Z]{2,10}[-_]\d{2,7})/i)?.[0].replaceAll('_', '-') || name;
}

export function ItemTorrentSearch({ code, name, toast }: { code?: string; name: string; toast(message: string): void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => torrentQuery(code, name));
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [key, setKey] = useState('');
  const [submitted, setSubmitted] = useState<string[]>([]);
  const action = useAction();
  const refresh = () => void action.run('status', signal => apiGet<DeskStatus>('/api/torrent-desk/status', signal), setStatus);
  const search = () => {
    if (action.busy || query.trim().length < 2) return;
    setResult(null);
    void action.run('search', signal => apiSend<SearchResult>('/api/torrent-desk/search', { q: query.trim(), source }, 'POST', signal), setResult);
  };
  return <details open={open} onToggle={event => {
    const next = event.currentTarget.open;
    setOpen(next);
    if (next && !status && !action.busy) refresh();
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
        <Button variant="secondary" disabled={query.trim().length < 2} {...busyProps(action.busy === 'search')} onClick={search}>
          {action.busy === 'search' ? 'Searching torrents…' : 'Search torrents'}</Button>
        <Button variant="secondary" {...busyProps(action.busy === 'status')} onClick={() => { if (!action.busy) refresh() }}>Check connection</Button>
      </div>
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
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
              setSubmitted(previous => [...previous, row.id]); toast('Sent torrent to AllDebrid');
            } });
        }}>{submitted.includes(row.id) ? 'Sent to AllDebrid' : 'Send to AllDebrid'}</Button>
      </div>)}
      <details><summary>AllDebrid account and queue</summary><Stack>
        <Help>{status?.connected ? 'AllDebrid API key saved on this PC.' : 'Connect AllDebrid to send a torrent and view the queue.'}</Help>
        <Input label="AllDebrid API key" type="password" autoComplete="off" value={key} onChange={setKey} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!key.trim()} {...busyProps(action.busy === 'connect')} onClick={() => {
            if (action.busy) return;
            void action.run('connect', signal => apiSend<{ connected: boolean }>('/api/torrent-desk/configuration', { api_key: key }, 'POST', signal), next => {
              setKey(''); setStatus(previous => ({ connected: next.connected, sources: previous?.sources || [] })); toast('Saved AllDebrid connection');
            });
          }}>Save connection</Button>
          {status?.connected ? <Button variant="secondary" {...busyProps(action.busy === 'disconnect')} onClick={() => {
            if (action.busy) return;
            void action.run('disconnect', signal => apiSend('/api/torrent-desk/configuration', { disconnect: true }, 'POST', signal), () => {
              setStatus(previous => ({ connected: false, sources: previous?.sources || [] })); setQueue(null); toast('Disconnected AllDebrid');
            });
          }}>Disconnect</Button> : null}
          <Button variant="secondary" disabled={!status?.connected} {...busyProps(action.busy === 'queue')} onClick={() => {
            if (!action.busy) void action.run('queue', signal => apiGet<{ items: QueueItem[] }>('/api/torrent-desk/queue', signal), next => setQueue(next.items));
          }}>{action.busy === 'queue' ? 'Loading queue…' : 'Refresh queue'}</Button>
        </div>
        {queue && !queue.length ? <Help>Your AllDebrid queue is empty.</Help> : null}
        {queue?.map(row => <Help key={row.id}>{row.filename} · {row.status}</Help>)}
      </Stack></details>
    </Stack>
  </details>;
}
