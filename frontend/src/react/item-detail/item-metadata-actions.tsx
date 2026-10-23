import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/base/buttons/button';
import { apiSend, errorMessage } from '../../api';
import { queryClient } from '../query';
import { Note } from '../components/note';
import { fetchLibraryProcessing, LIBRARY_PROCESSING_KEY, LIBRARY_PROCESSING_URL,
  processingActive, type LibraryProcessingData } from '../library-processing/library-processing';

/** A single asset request includes STRM files and assets with an existing cover. */
export function ItemMetadataActions({ id }: { id: number }) {
  const job = useQuery({ queryKey: LIBRARY_PROCESSING_KEY,
    queryFn: ({ signal }) => fetchLibraryProcessing(signal), refetchInterval: 3000 });
  const refresh = useMutation({
    mutationFn: async () => {
      const current = await fetchLibraryProcessing();
      if (processingActive(current)) throw new Error('A library task is running. Finish it before refreshing this video.');
      return apiSend<LibraryProcessingData>(LIBRARY_PROCESSING_URL,
        { stage: 'metadata', asset_ids: [id] });
    },
    onSuccess: state => {
      queryClient.setQueryData(LIBRARY_PROCESSING_KEY, state);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_PROCESSING_KEY });
    },
  });
  return <section aria-label="Video metadata" className="my-3 flex flex-col gap-2">
    <Button variant="secondary" disabled={refresh.isPending || processingActive(job.data)}
      onClick={() => refresh.mutate()}>Refresh metadata — this video only</Button>
    {refresh.error ? <Note tone="error">{errorMessage(refresh.error)}</Note> : null}
    {refresh.isSuccess ? <Note tone="neutral">Metadata refresh started for this video. Progress is shown in Tasks.</Note> : null}
    {processingActive(job.data) && !refresh.isSuccess
      ? <Note tone="neutral">A library task is running. This action becomes available when it finishes.</Note> : null}
  </section>;
}
