import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api';
import { t } from '../../i18n';
import { RetryNote } from '../components/grid-reveal';
import { ItemTorrentSearch } from '../item-detail/item-torrent-search';
import type { CatalogGridProps, MediaPage } from './types';

/** 搜索空态核对整个馆藏，筛选隐藏的已有影片不触发种子搜索。 */
export function catalogTorrentQuery(props: CatalogGridProps): string {
  const query = props.filters?.q?.trim() || '';
  return props.mode === 'catalog' && props.filters?.state !== 'trash' && query.length >= 2 && query.length <= 200 ? query : '';
}

export function CatalogEmpty({ props, libraryEmpty = false }: { props: CatalogGridProps; libraryEmpty?: boolean }) {
  const query = catalogTorrentQuery(props);
  const [settled, setSettled] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 600);
    return () => clearTimeout(timer);
  }, [query]);
  const ready = !!query && query === settled;
  const library = useQuery({
    queryKey: ['torrent-desk', 'library-match', query], enabled: ready,
    queryFn: ({ signal }) => apiGet<MediaPage>(`/api/items?${new URLSearchParams({ q: query, limit: '1', thumb: '0' })}`, signal),
    retry: false, refetchOnWindowFocus: false,
  });
  if (ready && library.isSuccess && !library.isFetching && !library.data.items.length) {
    return <section data-torrent-fallback="" className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 p-4">
      <p role="status">{t('媒体库中没有匹配的影片。')}</p>
      <ItemTorrentSearch key={query} name={query} autoSearch toast={message => props.receipt?.(message)} />
    </section>;
  }
  const html = props.emptyHtml?.({ trash: props.filters?.state === 'trash', libraryEmpty }) || '';
  return <div data-media-empty="" aria-busy={!!query && (!ready || library.isFetching) || undefined}>
    <div dangerouslySetInnerHTML={{ __html: html }} />
    {ready && library.error ? <RetryNote message={t('媒体库查询失败')} onRetry={() => void library.refetch()} /> : null}
  </div>;
}
