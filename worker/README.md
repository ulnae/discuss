# discuss-worker

Discuss 的后台服务，跑在 Cloudflare Workers 上：**Worker（HTTP）+ D1（SQLite）+ Durable Object（实时）**。

目的很简单：把 `server-nestjs` 那套接口原样搬到 Cloudflare 免费额度内，前端 `Discuss` 只靠一个环境变量切换后端，代码零改动（除了 socket 适配层）。

---

## 一、能力对照表

| 模块 | server-nestjs | 本 Worker | 说明 |
|---|---|---|---|
| 注册 / 登录 | `POST /api/user`、`/api/user/login` | ✅ | 密码 pbkdf2 替代 bcrypt（Worker 跑不了原生模块） |
| 图形验证码 | `/api/captcha`（express-session） | ✅ | 答案落 D1，前端带 `captchaId` 回传 |
| 用户 CRUD | `/api/user*` | ✅ | 响应字段、错误文案一致 |
| 房间 / 成员 | `/api/room*`、`/api/member*` | ✅ | 含分页、搜索、我的房间 |
| 申请（好友 / 房间） | `/api/apply*` | ✅ | 同意时自动建立好友 / 成员关系 |
| 好友 | `/api/friend*` | ✅ | `DELETE /friend/:id` 语义与 NestJS 相同（id 是对方 userId） |
| 系统通知 | `POST /api/alert` | ✅ | 广播到所有在线连接 |
| 实时消息 | Socket.IO `/websocket` | ✅ 原生 WebSocket `/api/ws` | 事件名逐个对齐，见下表 |
| 语音通话信令 | `call:*` / `webrtc:*` | ✅ | 会话状态存 DO storage，休眠不丢 |
| SSE | `GET /sse` | ❌ | 前端仅在注释里用过；实时需求由 WebSocket 承担，接口返回 501 |
| 文件 / 图片上传 | multer → `public/` | ⚠️ 可选 | 绑定 R2 后可用 `/public/<userId>/<file>`；未绑定返回 501 |
| 定时清空 public | `@nestjs/schedule` | ❌ | 由 R2 生命周期规则或 Cron Trigger 替代，本项目未启用 |
| Swagger | `/docs` | ❌ | 接口以本文档 + 代码注释为准 |

### WebSocket 事件（与 `socket.gateway.ts` 同名同结构）

| 方向 | 事件 | 说明 |
|---|---|---|
| C→S | `init` | 上线初始化：踢掉同账号旧连接、广播房间在线、同步好友状态 |
| C→S | `send:user` | `{ sender: 对方userId, content, type?, size?, originalname? }` |
| C→S | `send:room` | `{ room, content, type?, size?, originalname? }` |
| S→C | `message:user` / `message:sender` / `message:room` | 私聊 / 回显 / 群聊 |
| S→C | `online:room` | 房间在线成员 `{ room, users: [] }` |
| S→C | `online:friends` | 登录时一次性下发在线好友 |
| S→C | `status:firend` | 好友上下线（拼写沿用前端既有事件名，未改） |
| S→C | `kicked` | 异地登录被踢 |
| S→C | `system:alert` | 系统广播 |
| 双向 | `call:invite/accept/reject/cancel/end`、`call:incoming/ringing/accepted/rejected/canceled/timeout/ended/error` | 通话状态机 |
| 双向 | `webrtc:offer/answer/candidate` | SDP / ICE 转发 |

---

## 二、目录

```
worker/
├── wrangler.toml      # Worker 名、D1 / DO 绑定、环境变量
├── schema.sql         # 建表脚本（幂等，可重复执行）
├── src/
│   ├── index.js       # 路由入口：/api/*、/public/*、/api/ws
│   ├── lib/           # http 响应封装、JWT、密码、D1 帮助、鉴权
│   ├── routes/        # user / room / member / apply / friend / captcha
│   └── durable/
│       └── hub.js     # DiscussHub：WebSocket Hibernation、在线状态、消息、通话
└── package.json
```

---

## 三、部署

```bash
cd worker
npm install

# 1. 建库，把输出的 database_id 填进 wrangler.toml
wrangler d1 create discuss-data

# 2. 建表（--remote 才是线上）
wrangler d1 execute discuss-data --remote --file=./schema.sql

# 3. JWT 密钥（必填！不配的话登录接口会 500）
#    生成 32 字节随机串直接灌进去，值不会回显
openssl rand -hex 32 | wrangler secret put JWT_SECRET

# 4. 部署
wrangler deploy
```

部署完把地址填回前端 `.env.prod`：

```env
VITE_APP_RUNTIME=worker

# REST：经 Netlify 反代，国内可达（见 ../netlify-proxy/README.md）
VITE_APP_BASE_API=https://ulnae.localhost.cc/discuss/api
# 图片/文件前缀（末尾不要带 /api）
VITE_APP_API_BASE_URL=https://ulnae.localhost.cc/discuss
# WebSocket 直连 Worker —— Netlify 不支持转发 WS
VITE_APP_WS_BASE_URL=https://discuss-api.<你的子域>.workers.dev
```

并把 `wrangler.toml` 里的 `ALLOW_ORIGIN` 改成实际前端地址（逗号分隔多个）。

> `workers.dev` 在国内被 DNS 污染，浏览器直连会超时，所以 REST 必须走 `netlify-proxy/` 那一层；
> 但 WebSocket 过不了 Netlify，只能直连（若网络不通，实时会一直重连、消息发不出）。
> 彻底解决要给 Worker 绑一个能 NS 委派的自有域名，详见 `netlify-proxy/README.md` 第三节。

### 本地开发

```bash
wrangler d1 execute discuss-data --local --file=./schema.sql   # 本地库
wrangler dev --local --var JWT_SECRET:dev-secret               # 起服务
```

前端把 `.env` 的 `VITE_APP_RUNTIME` 改 `worker`、`VITE_APP_BASE_API` 指到 `http://127.0.0.1:8787/api` 即可联调。

### 可选：开启图片 / 文件上传（R2）

```bash
wrangler r2 bucket create discuss-uploads
```

然后取消 `wrangler.toml` 里 `[[r2_buckets]]` 的注释并重新 `wrangler deploy`。
上传成功返回 `path: public/<userId>/<filename>`，前端拼 `${VITE_APP_API_BASE_URL}/${path}` 访问，和 NestJS 的静态目录用法一致。

---

## 四、免费额度怎么省

| 手段 | 效果 |
|---|---|
| **WebSocket Hibernation**（`state.acceptWebSocket`） | 空闲连接不产生 Duration 计费，Durable Object 直接休眠；有消息才唤醒 |
| **自动 ping/pong**（`setWebSocketAutoResponse`） | 心跳在边缘应答，不唤醒 DO，也不占一次请求 |
| 客户端 25s 心跳 | 断线能及时发现并指数退避重连，避免无意义重连风暴 |
| 单 DO 实例（`idFromName('hub')`） | 好友/房间关系都在同一个 D1，避免跨 DO 转发带来的额外请求 |
| 验证码 / 会话不落 KV | D1 免费额度是 500 万读/天、10 万写/天，比 KV 的 1000 写/天宽松得多 |
| `PBKDF2_ITERATIONS=10000` | 免费版单次请求 CPU 上限 10ms；迭代次数写在哈希串里，付费后可调高而不影响老密码 |

粗略估算：100 个在线用户、每人 20 条消息/天 + 若干状态广播 ≈ 每天几千次请求，远低于免费版 10 万次/天。

> 注意：Durable Object 的 WebSocket 消息在免费版按「请求」计费（不是按条数叠加），
> 真正省的是「连接挂着但没人说话」的那部分 —— 这正是 Hibernation 解决的场景。

---

## 五、与 NestJS 的差异（上线前需要知道）

1. **密码算法不同**：NestJS 用 bcrypt，Worker 用 `pbkdf2$iter$salt$hash`。
   两套用户表不能直接互换；要迁移历史账号，只能在首次登录时做「bcrypt 校验 → 重新用 pbkdf2 存储」的兼容逻辑（本项目未实现，D1 从空库开始）。
2. **验证码存 D1**：没有 session，答案随 `captchaId` 走；有效期内可重复使用（与 NestJS 的 session 一致）。
3. **JWT 可互通**：两边都是 HS256 + `{ id, username }`，只要 `JWT_SECRET` 相同，token 互相认。
4. **SSE 下线**：`GET /api/sse` 返回 501，前端实时统一走 WebSocket。
5. **新加入的房间要重连才进 tag**：连接建立时按当时的成员关系打 tag；运行期新加入的房间，刷新页面（重连）后才会收到该房间的群消息。
6. **时间格式**：库里存毫秒整数，接口返回 ISO 字符串，与 TypeORM 的序列化结果一致。

---

## 六、常见问题

**Q：登录接口 500，报 `Imported HMAC key length (0)...`？**
`JWT_SECRET` 没配。WebCrypto 用空密钥做 HMAC 就会抛这句，和登录逻辑无关。执行：

```bash
cd worker
printf '%s' "$(openssl rand -hex 32)" | wrangler secret put JWT_SECRET
```

现在代码里也加了前置检查：没配 secret 时所有 `/api/*` 直接返回「服务端未配置 JWT_SECRET」，
不会再冒出那句看不懂的报错（`/api/health` 不受影响，可用于存活探测）。

**Q：前端登录一直提示 `Invalid or expired captcha`？**
验证码 60 秒过期，且每次点图会换新 id。检查前端是否把 `captchaId` 和 `captcha` 一起提交（`src/api/user/index.ts` 已处理）。

**Q：WebSocket 连不上？**
`/api/ws` 必须走 `wss://`（Pages 是 https，混合内容会被浏览器拦），且 token 放在 query。用 `wrangler tail` 看是否 401。

**Q：跨域报错？**
`ALLOW_ORIGIN` 必须精确到协议 + 域名 + 端口，多个用逗号分隔，不要带路径。

**Q：想重置本地数据？**
删掉 `worker/.wrangler/state` 再重新 `d1 execute --local`。
