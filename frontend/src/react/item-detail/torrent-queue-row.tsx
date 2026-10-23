import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { confirmModal } from '@peach/legacy/ui';
import { apiSend } from '../../api';
import { queryClient } from '../query';
import { ErrorText, Help } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';

export interface TorrentQueueItem { id: number; filename: string; status: string; statusCode?: number; size?: number }
interface TorrentFile { name: string; size: number }

export function TorrentQueueRow({ item, toast, refresh }: { item: TorrentQueueItem; toast(message: string): void; refresh(): Promise<unknown> }) {
  const action = useAction();
  const [files, setFiles] = useState<TorrentFile[] | null>(null);
  const change = (operation: 'restart' | 'delete') => {
    void confirmModal({ title: operation === 'delete' ? 'Remove torrent from AllDebrid' : 'Restart torrent',
      body: operation === 'delete' ? `Remove “${item.filename}” from your AllDebrid library?`
        : `Restart “${item.filename}” in AllDebrid?`,
      confirmLabel: operation === 'delete' ? 'Remove torrent' : 'Restart torrent',
      onConfirm: async () => {
        await apiSend('/api/torrent-desk/manage', { action: operation, id: item.id });
        await queryClient.invalidateQueries({ queryKey: ['torrent-desk', 'queue'], refetchType: 'none' });
        await refresh();
        toast(operation === 'delete' ? 'Removed torrent from AllDebrid' : 'Restarted torrent');
      } });
  };
  return <div className="flex min-w-0 flex-col gap-2 border-t border-separator-border py-3 wrap-anywhere" data-torrent-queue-item="">
    <p className="text-body-2-medium">{item.filename || `Torrent #${item.id}`}</p>
    <Help>{item.status} · {((item.size || 0) / 1024 ** 3).toFixed(2)} GiB</Help>
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" {...busyProps(action.busy === 'files')} onClick={() => {
        if (!action.busy) void action.run('files', signal => apiSend<{ items: TorrentFile[] }>('/api/torrent-desk/manage',
          { action: 'files', id: item.id }, 'POST', signal), data => setFiles(data.items));
      }}>View files</Button>
      <Button variant="secondary" onClick={() => change('restart')}>Restart</Button>
      <Button variant="danger" onClick={() => change('delete')}>Remove from AllDebrid</Button>
    </div>
    {action.error ? <ErrorText>{action.error}</ErrorText> : null}
    {files && !files.length ? <Help>No files available yet.</Help> : null}
    {files?.map((file, index) => <Help key={`${file.name}:${index}`}>{file.name} · {(file.size / 1024 ** 2).toFixed(1)} MiB</Help>)}
  </div>;
}
