import { Button } from '@/components/base/buttons/button';
import { ItemTorrentSearch } from '../item-detail/item-torrent-search';

export function TorrentDeskPage({ navigate, toast }: { navigate(path: string): void; toast(message: string): void }) {
  return <div data-torrent-desk-page="" className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-4">
    <div className="flex flex-wrap gap-2" aria-label="Peach library controls">
      <Button variant="secondary" onClick={() => navigate('/?browse=folders')}>Browse Peach library</Button>
      <Button variant="secondary" onClick={() => navigate('/settings/library')}>Media folders</Button>
      <Button variant="secondary" onClick={() => navigate('/data-cleanup#libraryProcessing')}>Scan and refresh metadata</Button>
      <Button variant="secondary" onClick={() => navigate('/trash')}>Recycle bin</Button>
    </div>
    <ItemTorrentSearch name="" toast={toast} standalone />
  </div>;
}
