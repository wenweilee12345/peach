# Torrent Desk 与 Jackett

主搜索栏输入至少两个字符，当前搜索无结果时会核对整个馆藏。影片不在馆藏中则自动展开种子搜索，
支持卡片、列表与照片墙视图。输入停止 600 毫秒后发起查询；切换搜索时作废当前页面的等待。
只因筛选条件隐藏的已有影片不触发搜索；回收站和资料页的空态也不触发。

作品详情的「Search torrents · Torrent Desk / Jackett」支持搜索番号或片名，未取得媒体的作品也能使用。
串流文件名中的番号会填入搜索框；用户可以直接修改。

本机 Torrent Desk 监听回环地址的 4173 端口，Jackett 来源由 Torrent Desk 管理。
Peach 通过 Torrent Desk 的只读来源列表和搜索接口查询；搜索结果里的 Torznab XML 复用
`torznab==0.2.1` 解析，种子哈希复用 `resource_search.py` 的同源、有界转换。
每轮最多四个本机来源、每个来源一百条条目与六份种子，页面最多显示五十个磁力候选。
请求失败时保留其它来源的候选并显示对应提示。

在折叠区的「AllDebrid account and queue」保存 AllDebrid API key 后，可逐条点击
「Send to AllDebrid」，确认作品名称后提交。搜索本身只列候选。
「Refresh queue」读取 AllDebrid 队列并显示任务状态。任务可下载后，按媒体库原有方式扫描。

API key 使用 Peach 的本机 `CredentialStore` 保存，提供断开操作，状态与候选接口不返回凭据。
配置操作受本机权限约束；搜索、提交与队列接口受 Peach 登录权限约束。
桥接地址固定为回环地址，来源列表只接受本机索引器。

## 复用边界

Torrent Desk 协议依据其 `worker/api.js` 的 `local-sources`、`search`、`add`、`queue` 四个接口。
桥接只依赖这些 HTTP 接口，不复制其源码，也不新增运行时依赖。
Torznab 的维护状态、许可证、固定版本与其它实现比较见 [复用记录](REUSE.md) 的索引器章节。
Peach 保留候选归一、凭据隔离、已登录接口与用户逐条确认的行为。
真实 AllDebrid 写入只在用户点击并确认后发生；隔离测试使用假 HTTP 与临时凭据。
