/** 显式界面词表；馆藏名称、来源原文与用户输入不经过翻译。 */
export type Locale = 'zh-CN' | 'en';
export const LANGUAGE_KEY = 'peach.language.v1';

export function getLocale(): Locale {
  try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh-CN' }
  catch { return 'zh-CN' }
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(LANGUAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export const ENGLISH: Readonly<Record<string, string>> = {
  '首页': 'Home', '艺人': 'Performers', '厂牌': 'Studios', '标签': 'Tags',
  '已标记': 'Bookmarked', '播放列表': 'Playlists', '关注': 'Following', '沉浸模式': 'Immersive mode',
  '管理': 'Manage', '统计': 'Statistics', '口味': 'Preferences', '人工复核': 'Review',
  '数据管理': 'Data management', '回收站': 'Trash', '关注管理': 'Manage follows',
  '高清版': 'Higher quality', '任务中心': 'Tasks', 'Peach 配置': 'Peach configuration',
  '全部': 'All', '女优': 'Actresses', '素人': 'Amateurs', '卖家': 'Sellers', '在线': 'Online',
  '设置': 'Settings', '关闭设置': 'Close settings', '外观与导航': 'Appearance & navigation',
  '浏览与播放': 'Browsing & playback', 'JAV 与新作': 'JAV & releases',
  '搜索与推荐': 'Search & recommendations', '内容显示': 'Content display',
  '主题': 'Theme', '增加对比度': 'Increase contrast', '界面音效': 'Interface sounds',
  '浅色': 'Light', '深色': 'Dark', '跟随系统': 'System', '自动': 'Automatic',
  '每批加载作品': 'Videos per batch', '每批作品': 'Videos per batch',
  '悬停预览延迟': 'Hover preview delay', '打开详情自动播放': 'Autoplay video details',
  '离开详情后小窗播放': 'Keep playing in mini player', '快进 / 快退步长': 'Seek step',
  '快进 / 快退': 'Seek step', '搜索记录数量': 'Search history limit', '搜索记录': 'Search history',
  '隐藏敏感画面，停止悬停预览。': 'Hide sensitive images and disable hover previews.',
  '设置分区': 'Settings sections', '打开': 'Open',
  '仅同步已入库影片': 'Update existing videos only', '仅生成视频预览': 'Generate previews only',
  '仅补全资料': 'Fetch metadata only', '更多同步方式': 'More sync options', '同步方式': 'Sync options',
  '低占用': 'Low impact', '标准': 'Standard', '全速': 'Full speed', '处理模式': 'Processing mode',
  '排队中': 'Queued', '进行中': 'Running', '已完成': 'Completed', '失败': 'Failed',
  '已取消': 'Cancelled', '被打断': 'Interrupted', '手动': 'Manual', '定时': 'Scheduled',
  '启动': 'Startup', '命令行': 'Command line', '筛选与排序': 'Filters & sorting',
  '视图与标签': 'Views & tags', '视图': 'View',
  '侧栏光晕': 'Sidebar glow', '导航入口与顺序': 'Navigation & order', '随机': 'Random',
  '评分': 'Rating', '高潮计数': 'Climax count', '观看次数': 'Play count', '时长': 'Duration',
  '体积': 'Size', '入库时间': 'Date added', '观看时间': 'Last played', '降序': 'Descending',
  '升序': 'Ascending', '官方封面': 'Official cover', '预览图': 'Preview',
  '大合集': 'Large compilations', '隐藏大合集': 'Hide large compilations',
  '单人合集': 'Solo compilations', '隐藏单人合集': 'Hide solo compilations',
  '切片': 'Excerpts', '隐藏切片': 'Hide excerpts', '默认排序': 'Default sort',
  '默认排序方向': 'Default sort direction', '视频卡片大小': 'Video card size',
  '作品显示': 'Video display', '默认图片': 'Default image', '合并分卷与版本': 'Group parts & editions',
  '新作显示': 'New release display', '新作自动滚动': 'Auto-scroll releases',
  '相关推荐数量': 'Related video count', '口味与记录': 'Preferences & history',
  '打开口味与记录': 'Open preferences & history', 'SFW 模式': 'SFW mode',
  '搜索历史': 'Search history', '清空': 'Clear', '保存': 'Save', '取消': 'Cancel', '关闭': 'Close',
  '配置读取失败': 'Could not load configuration', '未取得配置，请刷新页面重试。': 'Refresh the page to load configuration.',
  '媒体库与入库': 'Media library & import', '来源与订阅': 'Sources & subscriptions',
  '下载渠道': 'Download providers', '网络与访问': 'Network & access', '应用与维护': 'Application & maintenance',
  '系统诊断': 'Diagnostics', '配置分区': 'Configuration sections', '只读': 'Read only',
  '已保存配置': 'Configuration saved', '媒体目录': 'Media folders', '添加目录': 'Add folder',
  '保存后扫描并补全资料': 'Scan and fetch metadata after saving', '没有保存': 'Not saved',
  '保存后 Peach 会重新启动。': 'Peach restarts after saving.', '保存配置': 'Save configuration',
  '挂载状态': 'Mount status', '未配置挂载点': 'Mount not configured', '刷新挂载状态': 'Refresh mounts',
  '数据上传': 'Data uploads', '开机自启': 'Start at login', '桌面快捷方式': 'Desktop shortcut',
  '创建快捷方式': 'Create shortcut', '版本更新': 'Updates', '检查更新': 'Check for updates',
  '未归属': 'Unassigned', '未评分': 'Unrated', '真实观看': 'Watch progress', '离开位置': 'Resume position',
  '同步媒体库': 'Sync media library', '仅扫描文件': 'Scan files only',
  '仅补全已入库影片': 'Update existing videos only', '仅补全影片资料': 'Fetch metadata only',
  '仅补全预览图': 'Generate previews only', '扫描与采集': 'Scan & metadata',
  '同步这些影片': 'Sync selected videos', '生成视频预览': 'Generate video previews',
  '扫描媒体文件': 'Scan media files', '已暂停': 'Paused', '暂停': 'Pause', '继续': 'Resume',
  '正在暂停': 'Pausing', '正在进行': 'In progress', '最近完成': 'Recently completed',
  '被挡下的': 'Blocked', '加载更早': 'Load earlier', '没有任务在跑。': 'No tasks running.',
  '还没有任务记录': 'No tasks yet', '处理完成': 'Processing complete', '处理较慢': 'Processing slowly',
  '重试未完成项': 'Retry unfinished items', '重复文件': 'Duplicates', '垃圾文件': 'Junk files',
  '复核资料': 'Review metadata', '来源和凭证': 'Sources & credentials',
  '更新资料': 'Refresh metadata', '仅此视频': 'This video only', '优先高清头像': 'Prefer high-resolution portraits',
  '外部播放器 / VR': 'External player / VR', '此设备的外部播放器': 'External player on this device',
  'M3U 播放列表': 'M3U playlist', '生成播放链接': 'Generate playback links',
  '下载 M3U 播放列表': 'Download M3U playlist', '网络播放地址': 'Network playback URL',
  '复制播放地址': 'Copy playback URL', '已复制': 'Copied', '打开 DeoVR': 'Open DeoVR',
  'DeoVR 场景地址': 'DeoVR scene URL', '投影': 'Projection', '立体布局': 'Stereo layout',
  '平面': 'Flat', '单目': 'Mono', '左右': 'Side by side', '上下': 'Top and bottom',
  '链接有效期为 6 小时。VR 播放器可使用网络播放地址；另一台设备需要能访问当前 Peach 地址。':
    'Links expire after 6 hours. The player device must be able to reach this Peach address.',
  '在 DeoVR 中打开场景地址，或使用已安装的 DeoVR 打开链接。':
    'Open the scene URL in DeoVR, or launch the installed DeoVR app with the link.',
};

export function t(source: string): string {
  return getLocale() === 'en' ? ENGLISH[source] ?? source : source;
}
