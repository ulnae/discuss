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

## 📁 项目结构

```
Discuss/
├── public/                    # 静态资源
│   ├── _headers              # Cloudflare Headers 配置
│   ├── _redirects            # Cloudflare 重定向规则
│   └── siam.svg              # SVG 图标
├── src/
│   ├── api/                  # API 接口模块
│   │   ├── apply/            # 申请相关接口
│   │   ├── friend/           # 好友相关接口
│   │   ├── member/           # 成员相关接口
│   │   ├── room/             # 房间相关接口
│   │   └── user/             # 用户相关接口
│   ├── assets/               # 资源文件
│   │   └── style/            # 全局样式
│   │       ├── index.scss    # 主样式文件
│   │       └── taillwind.css # Tailwind CSS 入口
│   ├── components/           # 公共组件
│   │   └── index.ts          # 组件导出入口
│   ├── directives/           # 自定义指令
│   │   └── vEnter.ts         # 回车事件指令
│   ├── layout/               # 布局组件
│   │   └── index.vue         # 主布局
│   ├── plugin/               # 插件配置
│   │   ├── axios.ts          # Axios 实例配置
│   │   ├── socket.ts         # Socket 适配层（Socket.IO / 原生 WebSocket 二选一）
│   │   └── dayjs.ts          # Dayjs 插件配置
│   ├── router/               # 路由配置
│   │   ├── index.ts          # 路由实例
│   │   └── routes.ts         # 路由定义
│   ├── settings/             # 项目设置
│   │   └── index.ts          # 全局配置
│   ├── store/                # 状态管理
│   │   ├── index.ts          # Pinia 实例
│   │   └── modules/          # Pinia 模块
│   │       ├── apply.ts      # 申请状态
│   │       ├── database.ts   # 数据库状态
│   │       ├── friend.ts     # 好友状态
│   │       ├── menu.ts       # 菜单状态
│   │       ├── room.ts       # 房间状态
│   │       ├── socket.ts     # Socket 状态
│   │       └── user.ts       # 用户状态
│   ├── utils/                # 工具函数
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
├── .env                      # 开发环境变量
├── .env.prod                 # 生产环境变量（worker 后端）
├── .env.stage                # 预发环境变量（nestjs 后端）
├── .github/
│   └── workflows/
│       └── static.yml        # GitHub Pages 部署配置
├── .gitignore                # Git 忽略文件
├── .vscode/
│   └── extensions.json       # VSCode 推荐扩展
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

复制 `.env` 文件并根据实际情况修改配置：

```env
# 构建信息
VITE_APP_BUILD_INFO=development

# 后端运行时：nestjs = server-nestjs，worker = Cloudflare Worker
VITE_APP_RUNTIME=nestjs

# API 基础路径
VITE_APP_BASE_API=/api

# 路由基础路径
VITE_APP_BASE_URL=/

# 是否使用 Mock 数据
VITE_APP_BUILD_MODE=false

# 路由路径
VITE_BASE=/

# 应用标题
VITE_APP_TITLE=dev

# 接口请求地址
VITE_APP_API_BASE_URL=http://192.168.58.190:3000
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:8000

### 生产构建

```bash
npm run build          # = prod 模式，接口指向 Cloudflare Worker
npm run build:worker   # 同上，别名，语义更明确
npm run build:stage    # stage 模式，接口指向 server-nestjs
npm run build:test     # test 模式
```

构建产物输出到 `dist` 目录。

> 环境变量差异只有三处：`VITE_APP_RUNTIME`（socket 用哪种实现）、
> `VITE_APP_BASE_API`、`VITE_APP_API_BASE_URL`。所以「换后端」= 换一个 `--mode`，不用改代码。

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

### 本地存储策略

使用 **LocalForage** 和 **Pinia** 实现消息历史记录的本地持久化：

- **User_Message** - 用户消息历史存储
- **Room_Message** - 房间消息历史存储
- 采用防抖机制（1秒延迟）避免频繁写入
- 支持 IndexedDB/WebSQL，存储容量更大

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

项目采用模块化的 API 设计，各模块职责清晰：

- **api/user** - 用户登录、登出、信息获取
- **api/friend** - 好友添加、搜索、列表获取
- **api/member** - 成员管理
- **api/room** - 房间创建、搜索、加入
- **api/apply** - 申请处理（好友/房间）

### 状态管理

使用 Pinia 管理应用状态，各模块独立管理：

- **user** - 用户信息、Token、登录状态
- **friend** - 好友列表、好友状态
- **room** - 房间列表、房间信息
- **socket** - WebSocket 连接、消息存储
- **database** - LocalForage 数据库实例
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
- 开发服务器端口：8000
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