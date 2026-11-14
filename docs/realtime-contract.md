# 实时事件与接口契约

> 唯一事实来源。三端代码里的常量表必须与本文一致：
>
> | 端 | 文件 |
> |---|---|
> | 前端 | `Discuss/src/constants/events.ts` |
> | worker | `Discuss/worker/src/lib/events.js` |
> | server-nestjs | `server-nestjs/src/socket/events.ts` |
>
> 改事件名 / 改 payload 字段时，**先改本文，再改三端常量与实现**。

## 一、命名约定

| 约定 | 规则 |
|---|---|
| 房间标识 | 统一 `roomId`，需要展示名称时附带 `roomName`（不再出现 `room`、`room_id` 等变体） |
| 用户标识 | 统一 `userId`，需要展示名称时附带 `username`（不再出现 `friend`、`user.id`、`member`） |
| 操作者 | 统一 `byUserId` + `byUsername`（不再用嵌套 `by: { id, username }`） |
| 消息方向 | 统一 `from` / `to`（`from` = 发送方 userId，`to` = 接收方 userId） |
| 时间戳 | socket 报文统一 `timestamp`（毫秒数字）；REST 响应里的 `createdAt` 等仍为 ISO 字符串 |
| 别名 | **不允许**。历史拼写 `status:firend` 已彻底移除，不存在兼容别名 |

## 二、客户端 → 服务端

| 事件 | payload | 说明 |
|---|---|---|
| `init` | — | 上线初始化。worker 允许多端并存；nestjs 仍为单端登录（后连接踢掉旧连接，发 `kicked`） |
| `send:user` | `{ to, content, clientId?, type?, size?, originalname? }` | 私聊消息，`to` 是接收方 userId |
| `send:room` | `{ roomId, content, clientId?, type?, size?, originalname? }` | 群聊消息，服务端校验发送者是该房间成员 |
| `call:invite` | `{ to }` | 发起通话 |
| `call:accept` / `call:reject` / `call:cancel` / `call:end` | `{ callId }` | 通话状态机 |
| `webrtc:offer` / `webrtc:answer` | `{ callId, sdp }` | SDP 转发 |
| `webrtc:candidate` | `{ callId, candidate }` | ICE 转发 |

## 三、服务端 → 客户端

### 连接与消息

| 事件 | payload | 说明 |
|---|---|---|
| `message:user` | `{ id?, clientId?, from, to, content, timestamp, type?, size?, originalname? }` | 私聊消息。**收发双方都收同一个事件**，收信人靠 `from` 判断来源；发送方靠 `clientId` 对账本地乐观消息 |
| `message:room` | `{ id?, clientId?, roomId, from, content, timestamp, type?, size?, originalname? }` | 群聊消息，房间全员（含发送者）都收到 |

### 在线状态

| 事件 | payload | 说明 |
|---|---|---|
| `online:room` | `{ roomId, users: string[], timestamp }` | 房间在线成员名单。服务端对名单做 diff，无变化时不广播给全屋 |
| `online:friends` | `{ users: string[], timestamp }` | 登录时一次性下发的在线好友 id |
| `status:friend` | `{ userId, status: boolean, timestamp }` | 好友上下线 |
| `kicked` | `{ reason, timestamp }` | 异地登录被踢。**仅 nestjs 单端语义下发送**；worker 允许多标签页共存，不会发 |

### 好友

| 事件 | payload |
|---|---|
| `friend:request` | `{ apply }`（apply 为 REST 形状） |
| `friend:accepted` | `{ applyId, status, userId, username }`（`userId`/`username` 是同意方） |
| `friend:rejected` | `{ applyId, status, userId, username }` |
| `friend:added` | `{ userId, username }`（直接加好友时的对方） |
| `friend:removed` | `{ userId, username }`（删除你的那个人） |

### 房间与申请

| 事件 | payload |
|---|---|
| `apply:revoked` | `{ applyId, fromUserId, roomId? }`（撤回人 `fromUserId`；好友申请无 `roomId`） |
| `room:apply` | `{ apply, roomId, roomName }` |
| `room:apply:result` | `{ applyId, status, roomId, roomName }` |
| `room:joined` | `{ roomId, roomName }`（被拉进房间 / 申请通过后给本人） |
| `room:updated` | `{ room }`（完整房间对象，用于覆盖本地 `room_info`） |
| `room:left` | `{ roomId, roomName }`（自己退出） |
| `room:kicked` | `{ roomId, roomName, byUserId, byUsername }` |
| `room:deleted` | `{ roomId, roomName, byUserId, byUsername }` |
| `member:joined` | `{ roomId, userId, username }` |
| `member:removed` | `{ roomId, userId, byUserId, byUsername, reason: 'left' \| 'kicked' }` |

### 系统与通话

| 事件 | payload | 说明 |
|---|---|---|
| `system:alert` | `{ senderName, message, timestamp }` | 系统广播（`POST /api/alert`，需 `x-alert-secret` 头或已登录管理员调用） |
| `exception` | `{ event, message, timestamp }` | 服务端处理某条入站消息失败（两个后端形状一致，nest 由 `WsExceptionFilter` 发出）。前端提示用户，**不得据此登出** |
| `call:incoming` | `{ callId, from, username, timestamp }` | 来电 |
| `call:ringing` | `{ callId, to, timestamp }` | 主叫振铃中 |
| `call:accepted` / `call:rejected` | `{ callId, from?, timestamp }` | 被叫应答 / 拒绝 |
| `call:canceled` / `call:timeout` / `call:ended` | `{ callId, reason?, timestamp }` | 取消 / 振铃超时 / 挂断 |
| `call:error` | `{ callId?, to?, reason, timestamp }` | `invalid` / `offline` / `busy-self` / `busy` / `unavailable` |

## 四、REST 接口

三端共用的接口形状以 worker 为准，nestjs 对齐实现。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/room` | 创建房间（同时写入成员） |
| GET | `/api/room` | 分页房间列表 |
| GET | `/api/room/search?name=` | 按名称搜索 |
| GET | `/api/room/overview` | **登录 / 重连唯一入口**：我加入的房间 + 每房成员 + 每房在线名单 |
| GET | `/api/room/:id` | 房间详情 |
| PATCH | `/api/room/:id` | 更新房间（群主） |
| DELETE | `/api/room/:id` | 解散房间（群主） |
| GET | `/api/member?room_id=` | 成员查询（必须是该房间成员；`user_id` 只允许查自己） |
| POST | `/api/member` | 添加成员 |
| DELETE | `/api/member/:id` | 移出成员 / 退出房间 |
| POST | `/api/apply` | 发起申请（好友 / 入群） |
| GET | `/api/apply` | 我发起的申请 |
| GET | `/api/apply/mine` | 别人申请我的 |
| GET | `/api/apply/room?id=` | 某房间的待处理申请 |
| PATCH | `/api/apply/:id` | 处理申请 |
| DELETE | `/api/apply/:id` | 撤回申请 |
| GET/POST/DELETE | `/api/friend` | 好友列表 / 添加 / 删除（`creator` 取 token，不接受 body 传值） |
| POST | `/api/alert` | 全站广播，需 `x-alert-secret` 头；未配置 `ALERT_SECRET` 时返回 403 |

### 权限与状态码

- **写操作一律校验归属**：改房间/解散房间只允许群主，注销账号只允许本人，移出成员只允许群主或本人，
  发群消息必须是该房间成员（两个后端都在服务端校验，不依赖客户端自觉）。
- **401 只用于「未登录 / 登录失效」**：前端 axios 拦截器遇 401 会直接登出，所以
  「无权限」「不存在」「已存在」分别用 403 / 404 / 409，绝不能用 401 表达业务失败。
- **JWT 每次请求都校验账号仍然存在且未软删**，注销后旧 token 立刻失效。

**已移除**（不要再加回来）：

- `GET /room/mine` —— 被 `/room/overview` 取代，前端已无调用方；
- `POST /sse` —— 实时通道只有 WebSocket，SSE 已删除；
- `send:message`、`system:message`、`connected`、`message:sender` 四个事件 —— 从未被前端使用或已合并进 `message:user`。

## 五、变更流程

1. 改本文档（事件 / 字段 / 语义）；
2. 同步三端常量文件（见文首表格）；
3. 三端一起发布 —— 事件名不再提供别名兼容，**新旧版本必须同批上线**；
4. 首次上线后观察 1 个发布周期，确认无旧客户端报错再清理残留注释。
