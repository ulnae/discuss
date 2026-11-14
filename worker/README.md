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
| 房间 / 成员 | `/api/room*`、`/api/member*` | ✅ | 含分页、搜索、登录聚合 `/room/overview` |
| 申请（好友 / 房间） | `/api/apply*` | ✅ | 同意时自动建立好友 / 成员关系 |
| 好友 | `/api/friend*` | ✅ | `DELETE /friend/:id` 语义与 NestJS 相同（id 是对方 userId） |
| 系统通知 | `POST /api/alert` | ✅ | 广播到所有在线连接；需要 `x-alert-secret`，未配置则关闭 |
| 实时消息 | Socket.IO `/websocket` | ✅ 原生 WebSocket `/api/ws` | 事件名逐个对齐；连接票据 `GET /api/ws/ticket`（60s 短票） |
| 语音通话信令 | `call:*` / `webrtc:*` | ✅ | 会话状态存 DO storage，休眠不丢 |
| SSE | `GET /sse` | ❌ | 已删除（两端都没有该路由，请求返回 404）；实时统一走 WebSocket |
| 文件 / 图片上传 | multer → `public/` | ✅ | 存 Workers KV（免绑卡），`/public/<userId>/<file>` 读回；未绑定返回 501 |
| 定时清空 public | `@nestjs/schedule` | ✅ | KV `expirationTtl` + Cron Trigger 双层回收 |
| Swagger | `/docs` | ❌ | 接口以本文档 + 代码注释为准 |

### WebSocket 事件（与 `socket.gateway.ts` 同名同结构）

| 方向 | 事件 | 说明 |
|---|---|---|
| C→S | `init` | 上线初始化：广播房间在线、同步好友状态（多端并存，不踢旧连接） |
| C→S | `send:user` | `{ to: 对方userId, content, clientId?, type?, size?, originalname? }` |
| C→S | `send:room` | `{ roomId, content, clientId?, type?, size?, originalname? }` |
| S→C | `message:user` / `message:room` | 私聊 / 群聊（收发双方同一事件，靠 `from` 区分方向） |
| S→C | `online:room` | 房间在线成员 `{ roomId, users: [] }` |
| S→C | `online:friends` | 登录时一次性下发在线好友 |
| S→C | `status:friend` | 好友上下线 `{ userId, status }` |
| S→C | `friend:*` / `room:*` / `member:*` / `apply:revoked` | 好友 / 房间 / 成员 / 申请变更通知 |
| S→C | `system:alert` | 系统广播 `{ senderName, message }` |
| S→C | `exception` | 入站消息处理失败 |
| 双向 | `call:invite/accept/reject/cancel/end`、`call:incoming/ringing/accepted/rejected/canceled/timeout/ended/error` | 通话状态机 |
| 双向 | `webrtc:offer/answer/candidate` | SDP / ICE 转发 |

事件名集中定义在 `src/lib/events.js`，完整的 payload 契约见仓库根目录 **`docs/realtime-contract.md`**。
注意：`kicked` 只有 nestjs 单端登录会发，worker 允许多标签页。

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

# 3.5 系统广播密钥（可选）：不配的话 POST /api/alert 直接返回 403
openssl rand -hex 32 | wrangler secret put ALERT_SECRET

# 4. 部署
wrangler deploy
```

部署完把地址填回前端 `.env.prod`：

```env
VITE_APP_RUNTIME=worker

# REST 与 WS 统一走 Worker 自定义域（前提：已按下一节绑好域名）
VITE_APP_BASE_API=https://discuss-api.<你的子域>.dpdns.org/api
# 图片/文件前缀（末尾不要带 /api）
VITE_APP_API_BASE_URL=https://discuss-api.<你的子域>.dpdns.org
# WebSocket 与 REST 同源
VITE_APP_WS_BASE_URL=https://discuss-api.<你的子域>.dpdns.org
```

并把 `wrangler.toml` 里的 `ALLOW_ORIGIN` 改成实际前端地址（逗号分隔多个）。

> `workers.dev` 在国内被 DNS 污染，浏览器直连会超时，所以三个地址都必须用自定义域。
> 自定义域建好之后 REST 与 WebSocket 同源，不存在"REST 走反代、WS 直连"的拆分。

### 让 WebSocket 在国内可用（给 Worker 绑域名）

现象：`wss://discuss-api.<子域>.workers.dev/api/ws` 一直连不上，控制台里反复重连。
原因不是代码 —— `workers.dev` 的 DNS 在国内被污染，连 HTTP 都到不了；
而通用的反向代理只转发 HTTP，**不支持 WebSocket 升级**，靠中转救不了实时。

| 方案 | 成本 | 国内可用 | 代价 |
|---|---|---|---|
| **免费子域 + Worker 自定义域**（推荐） | 0 | ✅ 直连，无中转 | 注册约 5 分钟；域名不在自己名下 |
| 买个便宜自有域（`.top` 等） | 约 ¥10/年 | ✅ 直连 | 无（最省心） |
| Deno Deploy 做 WS 反代 | 0（100 万请求/月） | ⚠️ `deno.dev` 时通时不通 | 多一跳、双向流量翻倍、多一个要维护的服务 |
| HTTP 长轮询（复用 REST 入口） | 0 | ✅ | 每个在线用户约 4000+ 请求/天，免费 10 万/天只够 ~20 人，且 DO 无法休眠 |

以 `dpdns.org`（DigitalPlat，注册即时通过、支持自定义 NS）为例：

1. 打开 https://domain.digitalplat.org 用 GitHub 登录，申请 `<name>.dpdns.org`；
2. Cloudflare → **Add a site** → 填 `<name>.dpdns.org`，选 Free 计划，记下它给的两条 NS；
3. 回 DigitalPlat 面板，把该子域的 **NS 改成 Cloudflare 那两条**，等 Cloudflare 里 zone 变成
   **Active**（几分钟到几小时不等，没 Active 之前后面都会失败）；
4. 打开 `wrangler.toml` 末尾的 `[[routes]]` 注释，`pattern` 改成 `discuss-api.<name>.dpdns.org`，
   然后 `wrangler deploy` —— 证书和 DNS 记录由 Cloudflare 自动处理，不用手加 CNAME；

   > ⚠️ **加了 `routes` 之后 Wrangler 会默认关闭 `workers.dev`**。如果还有旧入口（反向代理、
   > 旧版前端缓存）指向 `discuss-api.<子域>.workers.dev`，关掉会让它 404。本项目保留
   > `workers_dev = true` 仅用于境外/调试直连，生产流量全部走自定义域。
5. 前端 `.env.prod` 改一行并重新构建：

```env
VITE_APP_WS_BASE_URL=https://discuss-api.<name>.dpdns.org
```

6. REST 也指向同一域名（本项目当前就是此状态，无反向代理、无代理超时限制）：

```env
VITE_APP_BASE_API=https://discuss-api.<name>.dpdns.org/api
VITE_APP_API_BASE_URL=https://discuss-api.<name>.dpdns.org
```

本项目生产环境已经是这个状态，REST 与 WS 同源，不经过任何反向代理。

**为什么这样就能通**：`workers.dev` 是 Cloudflare 的公共后缀，被按域名污染；换成自己 zone 里的域名后，
DNS 由你委托的 Cloudflare NS 权威应答，解析结果是 Cloudflare 的 anycast IP（和大量正常站点共用的那批，
本身没有被封），请求到边缘后 Cloudflare 再看 Host 头把流量交给这个 Worker，证书由 Workers 自定义域自动签发。
也就是说：没有中转、没有额外一跳，只是把一个「解析不出来的名字」换成「能解析出来的名字」。

**绑定后自检**（会用真实验证码走完 登录 → 鉴权 → WS 握手）：

```bash
node scripts/check-domain.mjs https://discuss-api.<name>.dpdns.org --register
```

全绿说明域名、证书、D1、Durable Object 全通；哪一步红了会直接给原因和建议。

> WS 握手只校验 `?token=`，不校验 Origin，所以换域名后前端业务代码、`ALLOW_ORIGIN` 都不用动。
> 若 Cloudflare 拒绝把该子域加为 zone（提示不是可注册域），换 `qzz.io`、`xx.kg` 等其它免费后缀重试，
> 或直接买个几块钱的域名 —— 这是这类免费子域最常见的坑。


### 本地开发

```bash
wrangler d1 execute discuss-data --local --file=./schema.sql   # 本地库
wrangler dev --local --var JWT_SECRET:dev-secret               # 起服务
```

前端把 `.env` 的 `VITE_APP_RUNTIME` 改 `worker`、`VITE_APP_BASE_API` 指到 `http://127.0.0.1:8787/api` 即可联调。

### 图片 / 文件上传（Workers KV）

用 **KV** 而不是 R2：R2 虽然免费额度更大（10 GB），但开通需要**绑定银行卡**；KV 属于 Workers 自带，
免费版 1 GB 存储、10 万读/天、1000 写/天、单值 25 MiB，**不需要任何支付信息**，对个人聊天室足够。

命名空间已建好，`wrangler.toml` 里已写好：

```toml
[[kv_namespaces]]
binding = "UPLOAD"
id = "9b094aa97a984a8cac3a169c15db81e4"
```

换账号重建时执行：

```bash
wrangler kv namespace create UPLOAD     # 把输出的 id 填回 wrangler.toml
wrangler deploy
```

上传成功返回 `path: public/<userId>/<filename>`，前端拼 `${VITE_APP_API_BASE_URL}/${path}` 访问，
与 NestJS 的静态目录用法一致。

**容量参数**（都在 `wrangler.toml` 的 `[vars]` 里，改完重新 deploy 即可）：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `UPLOAD_MAX_BYTES` | 2 MB | 图片单文件上限；前端会先压到长边 1920，实际 200–500 KB |
| `UPLOAD_MAX_DOC_BYTES` | 5 MB | 其它文档/音视频上限 |
| `QUOTA_USER_BYTES` | 64 MB | 单用户总量，防止一个人吃满 1 GB |
| `QUOTA_USER_DAILY_BYTES` / `_COUNT` | 15 MB / 20 次 | 单用户日内配额 |
| `QUOTA_GLOBAL_DAILY_COUNT` | 800 次 | **全站**每日上传次数上限；KV 免费只有 1000 写/天，留 200 次给回收与重试 |
| `QUOTA_GLOBAL_BYTES` | 900 MB | 全局软上限（KV 免费 1 GB，留 10% 余量） |
| `RETENTION_DAYS` | 30 | 保留天数，同时作为 KV 的 `expirationTtl` |

**清理是三层**，从被动兜底到主动回收：

1. **KV `expirationTtl`**（平台执行，30 天）——写入时就把过期时间交给 KV，到期自动删除，
   **不占用每天 1000 次的 delete 额度**，也不依赖 Worker 是否在跑；
2. **Cron 每日回收**（`[triggers]`，UTC 19:00 = 北京 03:00）——清掉过期的 D1 登记行；
   总量超过软上限 92% 时按最旧优先删到 75%，这一步要真删 KV，单次最多 300 个以保护 delete 额度；
3. **统计校准**——每天重算 `upload_stat`，修正累计值漂移。

**水位与降级**（按 `upload_stat.bytes / QUOTA_GLOBAL_BYTES`）：

| 水位 | 动作 |
|---|---|
| ≤ 70% | 正常，用量写进 `/api/health` 的 `storage` 字段 |
| 70–85% | 仅日志告警，不拦用户 |
| 85–95% | 拒绝新图片（507），文字消息不受影响 |
| > 95% | 拒绝全部上传，下一次 Cron 强制回收到 75% |

几点实现上的取舍：

- **登记表放 D1**：KV 只能按 key 读、不能按用户或时间检索，`upload` 表是配额判断与回收的唯一依据；
  全局用量走 `upload_stat` 单行累计，避免每次上传都 `SUM` 全表（D1 按行计费）。
- **`/public/*` 走边缘缓存 7 天**：命中缓存不消耗 KV 读额度；不用 1 年是因为过期文件删掉后
  还能从缓存里读出来。
- **KV 是最终一致**：写入后本数据中心立即可读，其它地区最多 60 秒才可见。刚上传的图片在发送者
  所在地立刻能显示，异地用户偶发 404 重试即可，README 不额外做补偿。
- **拒绝 SVG / HTML**：这两类在同域下会执行脚本，等于给 API 域名开了个 XSS 口子；只放行图片与常见文档，
  并统一加 `X-Content-Type-Options: nosniff`，非图片强制 `Content-Disposition: attachment`。
- **为什么不选 D1 存 BLOB**：D1 免费版单库上限 500 MB，且文件塞进主库会让 Time Travel 备份和查询一起变慢。
- **规模上限**：1 GB ÷ 500 KB ≈ 2000 张压缩图，配合 30 天过期，日常使用不会触顶；
  真撞上了会先拒绝上传（507/429）而不是静默失败，文字消息始终可用。


---

## 四、免费额度怎么省

| 手段 | 效果 |
|---|---|
| **WebSocket Hibernation**（`state.acceptWebSocket`） | 空闲连接不产生 Duration 计费，Durable Object 直接休眠；有消息才唤醒 |
| **自动 ping/pong**（`setWebSocketAutoResponse`） | 心跳在边缘应答，不唤醒 DO，也不占一次请求 |
| 客户端 25s 心跳 | 断线能及时发现并指数退避重连，避免无意义重连风暴 |
| **roomIndex 内存索引** | 群消息只遍历该房间的连接，不再对全站每条连接做一次 `deserializeAttachment` |
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
4. **SSE 下线**：两端都没有 `GET /api/sse` 这个路由了（请求返回 404），实时统一走 WebSocket。
5. **运行期加入房间无需重连**：成员关系变化后 Worker 会调用 DO 的 `/sync` 刷新连接上的
   `rooms` 订阅，新加入的房间立刻能收发消息；被踢/退出的房间同时被摘掉。
   （tag 只在 accept 时写入，所以房间判定用的是 attachment 里的 `rooms`，不是 tag。）
6. **时间格式**：库里存毫秒整数，接口返回 ISO 字符串，与 TypeORM 的序列化结果一致。

---

## 六、常见问题

**Q：上传图片报「当前 Worker 未绑定 UPLOAD（KV）存储」？**
`wrangler.toml` 里 `[[kv_namespaces]]` 没生效，或命名空间被删了。执行：

```bash
wrangler kv namespace list                 # 确认 UPLOAD 还在
wrangler kv namespace create UPLOAD        # 不在了就重建，把新 id 填回 wrangler.toml
wrangler deploy
curl -s https://<你的域名>/api/health      # storage 字段应出现 usedBytes / quotaBytes
```

注意 KV 的 id 是「账号 + 命名空间」唯一的，换 Cloudflare 账号必须重新创建并替换 id。

**Q：不想用 R2，还有哪些存储方案？**
按「是否需要绑卡」筛，能用的只有三个：

| 方案 | 免费额度 | 结论 |
|---|---|---|
| **Workers KV**（当前） | 1 GB / 10 万读 / 1000 写 / 天 | ✅ 推荐：零绑卡、零新增账号、与 Worker 同源 |
| D1 BLOB | 单库 500 MB | ❌ 主库会被图片撑满，备份与查询一起变慢 |
| GitHub 仓库 + jsDelivr | 仓库建议 < 1 GB | ⚠️ 每次上传一个 commit，历史无法真正删除；`raw.githubusercontent.com` 国内不可用，jsDelivr 也不稳定 |

Supabase Storage（1 GB）虽然不绑卡，但免费项目 7 天无活动会被暂停，对低频聊天室是硬伤。

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
