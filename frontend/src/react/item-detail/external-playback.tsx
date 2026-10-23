import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { apiSend } from '../../api';
import { SelectField } from '../settings-panel/legacy-controls';
import { ErrorText, Help, Stack } from '../settings/section';
import { busyProps, useAction } from '../settings/use-action';
import { t } from '../../i18n';

const KEY = 'peach.external-player.v1';
const PLAYERS = [['m3u', 'M3U 播放列表'], ['deovr', 'DeoVR'], ['vlc-ios', 'VLC（iPhone / iPad）'], ['iina', 'IINA（Mac）']] as const;

export function playerLink(player: string, url: string, playlist: string, deovr = ''): string {
  if (player === 'deovr') return `deovr://${deovr}`;
  if (player === 'vlc-ios') return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
  if (player === 'iina') return `iina://weblink?url=${encodeURIComponent(url)}`;
  return playlist;
}

export function ExternalPlayback({ id }: { id: number }) {
  const [player, setPlayer] = useState(() => {
    try { return PLAYERS.find(([key]) => key === localStorage.getItem(KEY))?.[0] || 'm3u' } catch { return 'm3u' }
  });
  const [links, setLinks] = useState<{ url: string; playlist: string; deovr: string } | null>(null);
  const [projection, setProjection] = useState('flat');
  const [stereo, setStereo] = useState('off');
  const [copied, setCopied] = useState(false);
  const deovr = links ? `${links.deovr}&projection=${projection}&stereo=${stereo}` : '';
  const action = useAction();
  return <details key={id}>
    <summary>{t('外部播放器 / VR')}</summary>
    <Stack>
      <SelectField id={`external-player-${id}`} label="此设备的外部播放器" options={PLAYERS} value={player}
        epoch={0} onPick={(value) => {
          const selected = PLAYERS.find(([key]) => key === value)?.[0] || 'm3u';
          setPlayer(selected);
          try { localStorage.setItem(KEY, selected) } catch { /* 浏览器未允许保存偏好。 */ }
        }} />
      {player === 'deovr' ? <>
        <SelectField id={`vr-projection-${id}`} label={t('投影')} options={[
          ['flat', t('平面')], ['dome', '180°'], ['sphere', '360°'], ['fisheye', '180° fisheye'],
        ]} value={projection} epoch={0} onPick={setProjection} />
        <SelectField id={`vr-stereo-${id}`} label={t('立体布局')} options={[
          ['off', t('单目')], ['sbs', t('左右')], ['tb', t('上下')],
        ]} value={stereo} epoch={0} onPick={setStereo} />
      </> : null}
      <Button variant="secondary" {...busyProps(action.busy === 'prepare')}
        onClick={() => void action.run('prepare', (signal) => apiSend<{ url: string; playlist: string; deovr: string }>(
          `/api/external-playback?id=${id}`, {}, 'POST', signal), (result) => setLinks({
            url: new URL(result.url, location.origin).href, playlist: new URL(result.playlist, location.origin).href,
            deovr: new URL(result.deovr, location.origin).href,
          }))}>{t('生成播放链接')}</Button>
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      {links ? <>
        <a href={playerLink(player, links.url, links.playlist, deovr)} rel="noreferrer">
          {player === 'm3u' ? t('下载 M3U 播放列表') : player === 'deovr' ? t('打开 DeoVR') : `${t('打开')} ${PLAYERS.find(([key]) => key === player)?.[1]}`}
        </a>
        <Input label={t('网络播放地址')} value={links.url} isReadOnly />
        <Button variant="secondary" onClick={() => void action.run('copy', async () => {
          await navigator.clipboard.writeText(player === 'deovr' ? deovr : links.url);
        }, () => setCopied(true))}>{t(copied ? '已复制' : '复制播放地址')}</Button>
        {player === 'deovr' ? <>
          <Input label={t('DeoVR 场景地址')} value={deovr} isReadOnly />
          <Help>{t('在 DeoVR 中打开场景地址，或使用已安装的 DeoVR 打开链接。')}</Help>
        </> : null}
        <Help>{t('链接有效期为 6 小时。VR 播放器可使用网络播放地址；另一台设备需要能访问当前 Peach 地址。')}</Help>
      </> : null}
    </Stack>
  </details>;
}
