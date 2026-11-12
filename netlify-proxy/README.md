# netlify-proxy/ 目录说明

Discuss 的 API 入口反代层。因为 `discuss.localhost.cc` 注册不了，所以**与 `tools` 项目共用
同一个 Netlify 站点**（`ulnae.localhost.cc`），靠路径前缀把两套接口分开：

```
浏览器
  └─ https://ulnae.localhost.cc
       ├─ /api/*            → tools-api.yyh3531.workers.dev        （tools，原有规则不动）
       └─ /discuss/api/*    → discuss-api.yyh3531.workers.dev      （本项目，本目录新增）
              └─ Netlify Edge 原样转发
                   └─ Cloudflare Worker（D1 / Durable Object）
```

**两边的 Worker、D1 数据库、Durable Object 完全独立**，只在 Netlify 这一层相邻：
一个站点、两份 `_redirects` 规则、两个路径前缀。

---

## 一、为什么需要这一层

`tools/netlify-proxy/README.md` 已踩过一遍，结论对 Discuss 完全适用：

| 做法 | 结果 |
|---|---|
| 直连 `*.workers.dev` | 国内 DNS 污染，实测 12 秒超时 |
| `localhost.cc` 子域 CNAME → `workers.dev`（灰云） | TLS 握手失败，证书签不下来 |
| 同上开橙云 | Cloudflare 1014（跨账号 CNAME 指向 Worker 不允许） |
| Workers 自定义域 | 做不到：`localhost.cc` 只开放 A/AAAA/CNAME/TXT/MX，**不能 NS 委派** |

（原本更干净的做法是给 Discuss 单独注册 `discuss.localhost.cc` + 独立 Netlify 站点，
但该子域已被占用/不可注册，退而求其次走前缀共用。）

---

## 二、WebSocket 过不去（重要）

**Netlify 的反代只处理 HTTP，不支持 WebSocket 升级**（官方社区明确答复 "we do not support
proxying websockets"），而且代理请求有 **26 秒超时**，长连接即便握手成功也会被切断。

所以 Discuss 的实时通道 `/api/ws`（Durable Object）**不走这一层**，由前端直连 Worker。
`.env.prod` 里 `VITE_APP_WS_BASE_URL` 与 `VITE_APP_BASE_API` 是两个独立变量，就是为这件事准备的。

| 方案 | 现状 |
|---|---|
| 直连 `wss://discuss-api.yyh3531.workers.dev` | 当前实现。网络能通时实时正常；国内多数网络会连不上，表现为一直重连、消息发不出去 |
| 给 Worker 绑自有域名 | 彻底解决。需要能 **NS 委派**的域名（`eu.org` 免费或十元级 `.top`/`.xyz`），迁进 Cloudflare 后绑 `api.xxx.top`，连这一层反代都能删掉 |
| 改轮询 | 不推荐：26 秒超时掐断长轮询，纯轮询又极吃免费额度 |

---

## 三、部署

本目录只有两样东西要落到 `tools` 的 Netlify 站点上：

### 1. 追加转发规则

把 `_redirects.append` 里的两条规则追加到 `tools/netlify-proxy/_redirects` **末尾**
（保留原有 `/api/*` 那条）：

```
/discuss/api/*      https://discuss-api.yyh3531.workers.dev/api/:splat      200!
/discuss/public/*   https://discuss-api.yyh3531.workers.dev/public/:splat   200!
```

### 2. 放自检页

把本目录的 `discuss/` 整个文件夹复制到 `tools/netlify-proxy/discuss/`，
访问 `https://ulnae.localhost.cc/discuss/` 就是链路自检页。

### 3. 重新拖拽部署

Netlify 手动部署是快照 —— 必须去 Deploys 页面把 `tools/netlify-proxy/` 的**内容**重新拖一次，
否则线上还是旧规则。拖完先确认 tools 的 `/api/*` 没被覆盖。

> 以后**每次改 tools 的 Netlify 站点都必须带上 discuss 的两条规则**，这是共用站点的代价。
> 如果哪天有了可委派的自有域名，把 Discuss 整个搬到 Worker 自定义域，这一层就可以删掉。

---

## 四、前端配置

`.env.prod` 三个变量各管一段：

| 变量 | 值 | 用途 |
|---|---|---|
| `VITE_APP_BASE_API` | `https://ulnae.localhost.cc/discuss/api` | axios 的 `baseURL` |
| `VITE_APP_API_BASE_URL` | `https://ulnae.localhost.cc/discuss` | 图片/文件前缀（消息里的 `/public/xxx` 直接拼上），**末尾不要带 `/api`** |
| `VITE_APP_WS_BASE_URL` | `https://discuss-api.yyh3531.workers.dev` | WebSocket，**不走反代** |

---

## 五、验证

```bash
# 链路 + 出口机房
curl -sD - https://ulnae.localhost.cc/discuss/api/health

# 确认 tools 没被挤掉
curl -s https://ulnae.localhost.cc/api/health

# CORS 预检：Origin 必须命中 worker 的 ALLOW_ORIGIN
curl -sD - -o /dev/null -X OPTIONS https://ulnae.localhost.cc/discuss/api/user/login \
  -H "Origin: https://ulnae.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# 期望：204 + Access-Control-Allow-Origin: https://ulnae.github.io

# 自检页
curl -s -o /dev/null -w "%{http_code}\n" https://ulnae.localhost.cc/discuss/

# WebSocket 直连（不经 Netlify）：101 或 401 都说明网络可达
curl -sD - -o /dev/null --http1.1 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://discuss-api.yyh3531.workers.dev/api/ws?token=x"
```

---

## 六、坑

1. **`200!` 的感叹号别丢**：少了它，站点里一旦出现同名静态文件就会顶掉规则。
2. **别动 `/api/*`**：那是 tools 的命脉，追加规则时只加 `/discuss/*` 两行。
3. **CORS 仍由 Worker 决定**：Netlify 只是透明转发，`Access-Control-Allow-Origin` 来自
   `worker/wrangler.toml` 的 `ALLOW_ORIGIN`（已含 `https://ulnae.github.io`、`https://ulnae.localhost.cc`）。
4. **反代会藏住访客信息**：Worker 里 `request.cf` 描述的是 Netlify 边缘节点那一跳，不是访客本人。
5. **26 秒超时**：单个请求不能挂超过 26 秒，别在这层做长轮询。
6. **别给 `/api/*`、`/discuss/api/*` 加缓存**：接口都是实时的，命中缓存会读到旧数据。
