# Discuss

一个基于 Vue 3 + TypeScript + Vite 的现代实时聊天应用，支持好友私聊和群组房间聊天功能，采用 Socket.IO 实现双向实时通信。

## ✨ 功能特性

### 用户系统
- 用户登录认证与权限管理
- 个人信息管理与设置
- Token 持久化存储

### 好友聊天
- 添加好友与好友搜索
- 一对一实时消息推送
- 消息历史记录本地持久化
- 好友在线状态实时同步

### 房间聊天
- 创建和管理聊天房间
- 房间搜索与加入
- 多人实时群聊
- 房间成员在线状态显示
- 消息历史记录本地持久化

### 消息与富文本
- 历史消息按 Markdown 渲染（标题、列表、引用、代码块、表格、链接均有样式）——不开启编辑模式时也可手写 Markdown 语法，属隐藏彩蛋
- 设置页可开启「Markdown 编辑模式」（默认关闭）：开启后输入区显示格式工具栏与预览，图片/文件上传以 Markdown 片段插入正文混排；关闭时输入区保持纯净，上传成功即直接发送（`type: 'image' | 'file'` 独立消息）
- 设置页可切换消息渲染主题（下拉框，内置 30 种 mdnice 主题，默认 GitHub），与编辑模式开关相互独立，切换即时生效并自动适配日间/夜间
- 设置页可调整 Markdown 渲染字号（小 / 标准 / 大 / 特大，默认标准），主题注入时等比缩放全部 px 字号，适配夜间反色
- 群聊输入 `@` 唤起成员候选（↑↓ 选择、Enter / Tab 确认、Esc 关闭），支持连续 @ 多人；@ 以明文插入正文，userId/显示名作为 `mentions` 元数据随消息透传（服务端零改动），历史消息、输入区预览与消息气泡统一高亮，被 @ 者额外强调；私聊不启用
- 图片压缩后上传、文件上传、粘贴上传
- 消息正文渲染统一经 DOMPurify 消毒，杜绝 XSS

### 申请管理
- 好友申请处理（接受/拒绝）
- 房间邀请管理

## 🛠️ 技术栈

### 核心框架
- **Vue 3.5.22** - 渐进式 JavaScript 框架，使用 Composition API
- **TypeScript 5.9.3** - 提供类型安全和更好的开发体验
- **Vite (rolldown-vite 7.1.14)** - 下一代前端构建工具，极速开发体验

### 状态管理与路由
- **Pinia 3.0.4** - Vue 官方状态管理库，替代 Vuex
- **Vue Router 4.6.3** - 官方路由管理器，支持嵌套路由和路由守卫

### UI 与样式
- **Tailwind CSS 4.1.17** - 实用优先的 CSS 框架，快速构建现代 UI
- **Sass 1.93.3** - CSS 预处理器，支持嵌套和模块化

### 网络与数据
- **Axios 1.13.2** - HTTP 客户端，支持请求拦截和响应处理
- **Socket.IO Client 4.8.1** - WebSocket 客户端，实现实时双向通信
- **LocalForage 1.10.0** - 更好的本地存储 API，支持 IndexedDB/WebSQL

### 后端（二选一，靠环境变量切换）
- **server-nestjs**（`stage`） - NestJS + MySQL + Socket.IO，功能完整
- **discuss-worker**（`prod`） - Cloudflare Worker + D1 + Durable Object，接口与 NestJS 对齐，跑在免费额度内

### 工具库
- **Day.js 1.11.19** - 轻量级日期处理库，API 与 Moment.js 兼容
- **Lodash-es 4.17.21** - JavaScript 实用工具库，ES Module 版本
- **js-cookie 3.0.5** - Cookie 操作库
- **NProgress 0.2.0** - 页面加载进度条
- **marked 18.3.0** - Markdown 解析（消息气泡正文渲染）
- **DOMPurify** - 渲染前 HTML 消毒，防止消息注入 XSS
- **juejin-markdown-themes** - 消息渲染主题 CSS 来源（已拷贝到 `src/assets/md-themes/`，不随构建引入运行时依赖）

## 📁 项目结构

```
Discuss/
├── docs/                      # 协议文档
│   └── realtime-contract.md   # 实时事件唯一事实来源
├── public/                    # 静态资源（原样拷入 dist）
│   ├── favicon.svg           # 站点图标（现代浏览器优先）
│   ├── favicon.ico           # 站点图标兜底（16/32/48）
│   ├── apple-touch-icon.png  # iOS 主屏图标
│   └── 404.html              # GitHub Pages 兜底页：旧 history 深链转 hash
├── src/
│   ├── api/                  # API 接口模块（路径常量直接写在各自 index.ts）
│   │   ├── index.ts          # 自动聚合所有接口模块
│   │   ├── apply/            # 申请相关接口
│   │   ├── friend/           # 好友相关接口
│   │   ├── member/           # 成员相关接口
│   │   ├── rtc/              # ICE 配置接口
│   │   ├── room/             # 房间相关接口
│   │   └── user/             # 用户相关接口
│   ├── assets/               # 资源文件
│   │   ├── font/             # 字体资源
│   │   ├── md-themes/        # 消息渲染主题 CSS（30 种，默认主题静态内置，其余按需加载）
│   │   └── style/            # 全局样式
│   │       ├── design.scss   # 设计变量与公共组件样式
│   │       ├── index.scss    # 主样式文件
│   │       └── taillwind.css # Tailwind CSS 入口
│   ├── components/           # 公共组件
│   │   ├── index.ts          # 组件导出入口
│   │   ├── ui/               # 基础 UI：AppIcon / UserAvatar / LoadingBlock / EmptyState 等
│   │   │   ├── alert/        # 系统广播展示
│   │   │   ├── confirm/      # 全局确认弹窗（含 ConfirmHost）
│   │   │   └── toast/        # 轻提示
│   │   ├── ApplyCard.vue     # 申请卡片
│   │   ├── CallDialog.vue    # 通话弹窗
│   │   ├── ChatHeader.vue    # 聊天头部
│   │   ├── Comment.vue       # 消息气泡
│   │   ├── DetailPanel.vue   # 好友资料 / 群成员共用右侧面板
│   │   ├── MessageComposer.vue # 消息输入区
│   │   ├── SearchPage.vue    # 搜索页骨架
│   │   └── SidePanel.vue     # 会话侧栏
│   ├── constants/            # 常量定义
│   │   └── events.ts         # 实时通信事件名（业务代码勿写字符串字面量）
│   ├── directives/           # 自定义指令
│   │   └── vEnter.ts         # 回车事件指令
│   ├── hooks/                # 组合式函数（聊天会话、文件选择、自动滚动、主题等）
│   │   ├── mdPreference.ts   # Markdown 偏好：编辑模式开关 + 渲染主题（持久化 / 动态注入）
│   ├── layout/               # 布局组件
│   │   └── index.vue         # 主布局
│   ├── plugin/               # 插件配置
│   │   ├── axios.ts          # Axios 实例与统一拦截器
│   │   ├── socket.ts         # Socket 适配层（Socket.IO / 原生 WebSocket 二选一）
│   │   └── dayjs.ts          # Dayjs 插件配置
│   ├── router/               # 路由配置
│   │   ├── index.ts          # 路由实例
│   │   └── routes.ts         # 路由定义
│   ├── settings/             # 项目设置
│   │   └── index.ts          # 全局配置
│   ├── store/                # 状态管理
│   │   ├── index.ts          # Pinia 实例
│   │   ├── helpers/          # store 内部公共逻辑
│   │   │   └── fetchGuard.ts # 拉取竞态守卫
│   │   └── modules/          # Pinia 模块
│   │       ├── alert.ts      # 系统广播
│   │       ├── apply.ts      # 申请状态
│   │       ├── call.ts       # 语音通话状态与信令
│   │       ├── friend.ts     # 好友状态
│   │       ├── menu.ts       # 菜单状态
│   │       ├── room.ts       # 房间状态
│   │       ├── socket.ts     # Socket 状态
│   │       └── user.ts       # 用户状态
│   ├── utils/                # 工具函数
│   │   ├── messageCache.ts   # 聊天记录本地存储（唯一入口，按账号隔离）
│   │   ├── messageMerge.ts   # 消息去重与排序
│   │   ├── format.ts         # 头像首字、时间等展示格式化
│   │   ├── nav.ts            # 返回目标与返回处理函数
│   │   ├── markdown.ts       # Markdown 渲染唯一入口（解析 + 消毒 + LRU 缓存）
│   │   ├── image.ts          # 图片处理
│   │   ├── dailyCountdown.ts # 倒计时
│   │   └── index.ts          # 通用工具
│   ├── views/                # 页面视图
│   │   ├── 404/              # 404 页面
│   │   ├── apply/            # 申请管理页面
│   │   ├── dashboard/        # 首页仪表板
│   │   ├── friend/           # 好友模块
│   │   │   ├── layout.vue    # 好友布局
│   │   │   ├── search.vue    # 搜索好友
│   │   │   └── index.vue     # 好友聊天
│   │   ├── login/            # 登录页面
│   │   ├── room/             # 房间模块
│   │   │   ├── layout.vue    # 房间布局
│   │   │   ├── search.vue    # 搜索房间
│   │   │   ├── create.vue    # 创建房间
│   │   │   └── index.vue     # 房间聊天
│   │   └── setting/          # 设置页面
│   ├── App.vue               # 根组件
│   ├── importRoutercom.ts    # 路由组件导入工具
│   ├── main.ts               # 应用入口
│   └── vite-env.d.ts         # Vite 类型声明
├── worker/                   # Cloudflare Worker 后端（详见 worker/README.md）
│   ├── src/                  # 路由 + Durable Object
│   ├── schema.sql            # D1 建表脚本
│   └── wrangler.toml         # Worker / D1 / DO 配置
├── .env                      # 开发环境变量（nestjs 后端）
├── .env.prod                 # 生产环境变量（worker 后端）
├── .env.stage                # 预发环境变量（nestjs 后端）
├── .env.test                 # 测试环境变量（nestjs 后端）
├── .github/
│   └── workflows/
│       └── static.yml        # GitHub Pages 部署配置
├── .gitignore                # Git 忽略文件
├── .vscode/
│   └── extensions.json       # VSCode 推荐扩展（Volar，禁用 Vetur）
├── dist/                     # 构建输出目录
├── index.html                # HTML 入口
├── package.json              # 项目依赖配置
├── tsconfig.json             # TypeScript 配置
├── tsconfig.app.json         # 应用 TypeScript 配置
├── tsconfig.node.json        # Node TypeScript 配置
└── vite.config.ts            # Vite 配置
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** 或 **pnpm**

### 安装依赖

```bash
npm install
```

### 配置环境变量

项目提供四套环境文件，由构建命令通过 `--mode` 选择（见下方「生产构建」）。四个文件的**字段完全一致、顺序一致**，只需按环境改值：

| 文件 | mode | 用途 | 后端 |
|---|---|---|---|
| `.env` | development | 本地开发（`npm run dev`） | `server-nestjs` |
| `.env.test` | test | 测试环境（`build:test` / `pm2start`） | `server-nestjs` |
| `.env.stage` | stage | 预发环境（`build:stage`） | `server-nestjs` |
| `.env.prod` | prod | 生产环境（`build` / `build:worker` / CI） | Cloudflare Worker |

以 `.env` 为例，完整的 8 个字段如下：

```env
# 构建信息（VERSION 与 package.json version 保持一致）
VITE_APP_BUILD_INFO=development
VITE_APP_VERSION=0.0.0

# 后端运行时：worker = Cloudflare Worker（Discuss/worker），nestjs = server-nestjs
VITE_APP_RUNTIME=nestjs

# REST API 前缀（axios baseURL）
VITE_APP_BASE_API=/api

# 接口请求路径 / 图片文件前缀（vite 代理 target、socket 连接地址）
VITE_APP_API_BASE_URL=http://192.168.58.190:3000

# WebSocket 地址（worker 运行时使用；nestjs 运行时忽略此项）
VITE_APP_WS_BASE_URL=http://192.168.58.190:3000

# 路由基础路径
VITE_APP_BASE_URL=/

# 标题（会注入到 index.html 的 <title>）
VITE_APP_TITLE=Discuss-dev
```

各字段说明：

| 字段 | 说明 | 使用位置 |
|---|---|---|
| `VITE_APP_BUILD_INFO` | 构建环境标识（development / test / stage / production） | 元数据，暂未在代码中读取 |
| `VITE_APP_VERSION` | 应用版本号，作为请求头 `Base-Version` 发送 | `src/plugin/axios.ts` |
| `VITE_APP_RUNTIME` | 后端运行时：`nestjs` 或 `worker` | `src/plugin/socket.ts`（决定 socket 实现） |
| `VITE_APP_BASE_API` | REST 接口前缀，即 axios 的 `baseURL` | `src/plugin/axios.ts`、`src/settings/index.ts` |
| `VITE_APP_API_BASE_URL` | 接口/图片文件基址；开发环境兼作 Vite `/api` 代理的 target | `vite.config.ts`、`src/plugin/socket.ts`、`src/components/Comment.vue` |
| `VITE_APP_WS_BASE_URL` | WebSocket 地址，仅在 `runtime=worker` 时生效；留空则复用 `VITE_APP_API_BASE_URL` | `src/plugin/socket.ts` |
| `VITE_APP_BASE_URL` | 路由基础路径，同时作为 Vite 的 `base` | `src/router/index.ts`、`vite.config.ts` |
| `VITE_APP_TITLE` | 页面标题，通过 `vite-plugin-html` 注入到 `index.html` 的 `<title>` | `vite.config.ts`、`index.html` |

四个环境之间，真正需要按环境区分的变量如下（其余字段四套保持一致）：

| 变量 | `.env` (dev) | `.env.test` | `.env.stage` | `.env.prod` |
|---|---|---|---|---|
| `VITE_APP_BUILD_INFO` | development | test | stage | production |
| `VITE_APP_RUNTIME` | nestjs | nestjs | nestjs | worker |
| `VITE_APP_BASE_API` | `/api` | `http://192.168.58.190:3000/api` | `http://62.234.18.27:3000/api` | `https://discuss-api.ulnae.dpdns.org/api` |
| `VITE_APP_API_BASE_URL` | `http://192.168.58.190:3000` | `http://192.168.58.190:3000` | `http://62.234.18.27:3000` | `https://discuss-api.ulnae.dpdns.org` |
| `VITE_APP_WS_BASE_URL` | `http://192.168.58.190:3000` | `http://192.168.58.190:3000` | `http://62.234.18.27:3000` | `https://discuss-api.ulnae.dpdns.org` |
| `VITE_APP_BASE_URL` | `/` | `/` | `/` | `/discuss/` |
| `VITE_APP_TITLE` | Discuss-dev | Discuss-test | Discuss-stage | Discuss |

> 说明：开发环境 `VITE_APP_BASE_API=/api` 配合 Vite 的 `/api` 代理使用，代理 target 取 `VITE_APP_API_BASE_URL`；生产环境 REST 与 WebSocket 统一走 Worker 自定义域名，见下方「API 入口」。

### 开发模式

```bash
npm run dev
```

访问 http://localhost:8090

### 生产构建

```bash
npm run build          # = prod 模式，接口指向 Cloudflare Worker
npm run build:worker   # 同上，别名，语义更明确
npm run build:stage    # stage 模式，接口指向 server-nestjs
npm run build:test     # test 模式
```

构建产物输出到 `dist` 目录。

> 「换后端」= 换一个 `--mode`，不用改代码。四套环境文件的字段完全一致，
> 差异集中在 `VITE_APP_RUNTIME`（socket 实现）、`VITE_APP_BASE_API`、
> `VITE_APP_API_BASE_URL`、`VITE_APP_WS_BASE_URL` 等几项，详见上方对照表。

### 预览构建

```bash
npm run preview
```

## 🔌 核心功能说明

### 实时通信（双后端兼容）

`src/plugin/socket.ts` 提供统一适配层：`VITE_APP_RUNTIME=nestjs` 时用 Socket.IO（`/websocket`），
`VITE_APP_RUNTIME=worker` 时用原生 WebSocket（`/api/ws?token=`，由 Durable Object 承载）。
业务代码只依赖 `on / emit / disconnect`，事件名两边完全一致：

| 事件 | 方向 | 说明 |
|------|------|------|
| `connect` / `disconnect` | 本地 | 连接建立 / 断开（原生实现内建指数退避重连） |
| `init` | 发送 | 上线初始化：广播在线状态（worker 允许多端，nestjs 单端踢旧连接） |
| `send:user` | 发送 | 私聊消息 `{ to, content, clientId?, type?, size?, originalname? }` |
| `send:room` | 发送 | 房间消息 `{ roomId, content, clientId?, type?, size?, originalname? }` |
| `message:user` | 接收 | 私聊消息（收发双方同一事件，靠 `from` 区分方向） |
| `message:room` | 接收 | 房间群聊消息 |
| `online:room` | 接收 | 房间在线成员 `{ roomId, users }` |
| `online:friends` | 接收 | 登录时下发在线好友 |
| `status:friend` | 接收 | 好友上下线 `{ userId, status }` |
| `kicked` | 接收 | 异地登录被踢下线（仅 nestjs） |
| `system:alert` | 接收 | 系统广播 `{ senderName, message }` |
| `exception` | 接收 | 服务端处理失败提示（不再据此登出） |
| `call:*` / `webrtc:*` | 双向 | 语音通话信令与 SDP/ICE 转发 |

完整的事件名、payload 与命名约定见 **[docs/realtime-contract.md](docs/realtime-contract.md)**（唯一事实来源）。
事件名集中定义在 `src/constants/events.ts`，不要再在业务代码里写字符串字面量。

### 消息 Markdown 与附件

消息 `content` 始终是不透明字符串，服务端只做中继（消息历史存本地 IndexedDB），因此 **Markdown 只涉及前端**。
设置页提供两项独立配置（`src/hooks/mdPreference.ts`，localStorage 按用户 ID 隔离持久化）：

| 设置 | 默认 | 行为 |
|------|------|------|
| **Markdown 编辑模式** | 关闭 | 开启：输入区显示格式工具栏（粗体/斜体/行内代码/代码块/链接/引用）与预览切换，图片/文件上传后以 `![](/path)`、`[文件名](/path)` 片段插入输入框，可与文字混排后统一发送；关闭：输入区保持纯净，上传成功即直接发送 `type: 'image' \| 'file'` 独立消息 |
| **渲染主题** | GitHub | 只影响消息正文视觉，与上面的开关无关；下拉框共 30 种主题，切换即时生效 |

- `src/utils/markdown.ts` 是唯一渲染入口：`marked`（`gfm + breaks`）解析 → `DOMPurify` 消毒 → 按原文 LRU 缓存（300 条），供气泡正文与编辑模式预览共用。
- 消毒钩子统一处理附件路径：正文里的 `/upload/...` 相对路径补全为 `VITE_APP_API_BASE_URL` 前缀，图片懒加载，链接强制新窗口 + `noopener`。
- 历史消息同样按 Markdown 渲染（旧纯文本里的 `#`、`*`、`1.` 会被识别为格式，这是渲染语义的一部分）；即使不开启编辑模式，手写 Markdown 语法也能渲染（隐藏彩蛋）。
- **渲染主题**来自 `juejin-markdown-themes` 的 30 种主题，CSS 已拷到 `src/assets/md-themes/`。默认的 GitHub 静态内置（首屏即有样式），其余通过 `import.meta.glob({ query: '?raw' })` 拆成独立 chunk 按需加载，选中哪个才拉哪个；运行时把主题 CSS 改写成 `.md-themed` 作用域后注入 `<style>`，避免污染全局。
- **消息内容样式与项目设计解耦**：`design.scss` 的 `.cm-md` 只保留排版基底（不断行、首尾间距压平、列表符号恢复），元素视觉完全由主题 CSS 接管，不引用任何项目设计变量。
- **日间/夜间适配**：主题 CSS 均为浅色底设计。收发双方气泡配色统一（同一套底色/文字色，仅靠位置与尖角区分方向），日间气泡为浅色底、主题按原样渲染；夜间气泡为深色底，对所有 `.md-themed` 统一用 `invert(1) hue-rotate(180deg)` 反色（图片/视频再反回去）。不再出现「一边黑一边白、一边反色一边原色」的不一致。
- **配置按用户隔离**：`mdInputEnabled:<userId>` / `mdTheme:<userId>` 存 localStorage，换账号自动加载该账号自己的配置，登出后为 guest；旧版全局 key 首次读取时一次性迁移到当前用户。

### 本地存储策略

聊天记录只存在浏览器本地（**LocalForage / IndexedDB**），后端不落库。唯一入口是
`src/utils/messageCache.ts`（`MessageCache`），Pinia 里的 Map 只作为运行时内存态。

**按账号隔离**：每条记录的 key 都带 userId 前缀，不同账号数据互不干扰：

```
u:<userId>:<peerId>      私聊会话
r:<userId>:<roomId>      群聊会话
sys:<userId>:alerts      系统广播
```

由此保证三种账号切换场景都正确：

| 场景 | 行为 |
|------|------|
| 账号 A → 登出 → 登录账号 B | B 只加载自己前缀的数据，**看不到 A 的记录** |
| 账号 B → 登出 → 登回账号 A | 登出只清内存、不清本地数据，A 的记录**仍在** |
| 刷新页面 | 从本地恢复当前账号记录；异步读取期间若账号已切换则丢弃结果，防止串号 |

- **即时写入**：消息上屏即落盘，不用防抖（否则「发完立刻刷新」会因定时器未触发而丢消息）；同一会话的写入按 key 串行，避免异步乱序用旧快照覆盖新数据。写入前会把 Pinia 的响应式数据转成普通对象（IndexedDB 无法结构化克隆 Vue Proxy）。
- 每会话最多保留最近 200 条（内存态保留 500 条供上翻）。

**导入 / 导出**：设置页导出为自描述的 v2 备份文件，结构如下：

```json
{
  "format": "discuss-chat-backup",
  "version": 2,
  "exportedAt": "2026-11-18T06:00:00.000Z",
  "owner": { "id": "<userId>", "username": "<用户名>" },
  "data": {
    "users": [{ "peerId": "...", "messages": [] }],
    "rooms": [{ "roomId": "...", "messages": [] }],
    "alerts": []
  }
}
```

导入时会校验 `format` / `version` / `owner.id`，**账号不匹配的备份会被拒绝**，防止把他人记录导入当前账号；校验通过后写入当前账号分区并按 timestamp 去重合并。

### 路由结构

| 路径 | 说明 | 认证 |
|------|------|------|
| `/login` | 登录页面 | 否 |
| `/dashboard` | 首页仪表板 | 是 |
| `/friend/dashboard` | 好友欢迎页 | 是 |
| `/friend/search` | 搜索好友 | 是 |
| `/friend/:id` | 与好友聊天 | 是 |
| `/room/dashboard` | 房间欢迎页 | 是 |
| `/room/search` | 搜索房间 | 是 |
| `/room/create` | 创建房间 | 是 |
| `/room/:id` | 房间聊天 | 是 |
| `/apply` | 申请管理 | 是 |
| `/setting` | 设置页面 | 是 |

> **路由模式为 hash**（`createWebHashHistory`），实际地址形如 `https://ulnae.github.io/discuss/#/friend/1`。
> 原因：GitHub Pages 是纯静态托管，没有 rewrite 能力，history 模式下刷新 `/discuss/friend/1` 会因为找不到文件直接 404。
> 改用 hash 后刷新只请求 `/discuss/`，由前端解析 `#` 之后的部分，零服务端依赖。
>
> 以前分享出去的 history 深链（`/discuss/friend/1`）由 `public/404.html` 兜底：GitHub 返回它之后，
> 脚本把路径转成 `#/friend/1` 再跳回首页，因此旧链接不会失效。

### API 模块

项目采用模块化的 API 设计，各模块职责清晰。所有模块共用 `src/plugin/axios.ts` 导出的实例，请求路径常量直接写在各自 `index.ts` 中，统一走 `VITE_APP_BASE_API`，不存在接口切换分支：

- **api/user** - 登录、注册、用户信息、搜索、上传、资料更新、验证码
- **api/friend** - 好友列表与删除
- **api/member** - 房间成员列表与移出
- **api/room** - 房间总览、创建、搜索、解散
- **api/apply** - 申请处理（好友/房间）
- **api/rtc** - ICE 配置（TURN 短期凭证）

### 状态管理

使用 Pinia 管理应用状态，各模块独立管理：

- **user** - 用户信息、Token、登录状态
- **friend** - 好友列表、好友状态
- **room** - 房间列表、房间信息
- **socket** - WebSocket 连接、消息的内存态（本地持久化见 `utils/messageCache.ts`）
- **alert** - 系统广播列表
- **apply** - 申请列表
- **menu** - 菜单状态

## 📦 部署

### GitHub Pages（前端）

项目已配置 GitHub Pages 自动部署，推送到 **master** 分支即触发 `npm run build`（prod 模式 → Cloudflare Worker 接口）。

部署地址：https://ulnae.github.io/discuss/

构建产物里的 `404.html`（源文件 `public/404.html`）会被 GitHub Pages 当作兜底页，用于把旧的 history 深链转成 hash 地址；正常刷新只请求 `/discuss/`，不会再 404。

### 后端（二选一）

| 环境 | 后端 | 构建命令 |
|---|---|---|
| prod / GitHub Pages | `worker/`（Cloudflare Worker + D1 + DO） | `npm run build` |
| stage | `server-nestjs`（NestJS + MySQL） | `npm run build:stage` |

Worker 的建库、部署、免费额度说明见 [`worker/README.md`](./worker/README.md)。

### API 入口

生产环境 REST 与 WebSocket **统一走 Worker 的自定义域名**：

```env
VITE_APP_BASE_API=https://discuss-api.ulnae.dpdns.org/api
VITE_APP_API_BASE_URL=https://discuss-api.ulnae.dpdns.org
VITE_APP_WS_BASE_URL=https://discuss-api.ulnae.dpdns.org
```

`workers.dev` 在国内被 DNS 污染（实测 12 秒超时），必须先按
[`worker/README.md`](./worker/README.md#让-websocket-在国内可用给-worker-绑域名) 给 Worker 绑自定义域。
绑定后 REST 与 WS 同源，`tools` 项目的 Netlify 反代与本项目再无关系。

> 换域名 / 回滚：改 `.env.prod` 上面三行 + `worker/wrangler.toml` 的 `[[routes]]`，重新构建并 `wrangler deploy`。

### 手动部署

构建后的文件位于 `dist` 目录，可部署到任何静态文件服务器：

- Nginx
- Apache
- Vercel
- Netlify
- Cloudflare Pages

## 🔧 开发配置

### Vite 配置

- 使用 **rolldown-vite** 作为构建工具，性能更优
- 开发服务器端口：8090
- 自动打开浏览器
- 配置 `/api` 代理到后端服务
- 路径别名 `@` 指向 `src` 目录
- 生产环境 base 路径配置为 GitHub Pages 地址

### TypeScript 配置

- 严格模式开启
- 支持 Vue SFC 类型检查
- 路径别名类型提示
- 目标编译到 ESNext

### Tailwind CSS 配置

- 使用 Tailwind CSS 4.x
- 通过 Vite 插件集成
- 支持任意值和现代 CSS 特性

## 📄 License

MIT

## 🙏 致谢

感谢所有开源项目的贡献者！