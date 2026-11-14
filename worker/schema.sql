-- Discuss Worker D1 建表脚本
-- 执行：wrangler d1 execute discuss-data --remote --file=./schema.sql
--
-- 设计说明：
--   1. 表与 server-nestjs 的 TypeORM 实体一一对应（user / room / member / apply / friend），
--      字段名保持一致，便于后续从 MySQL 导数据（uuid 主键可原样保留）。
--   2. 时间列统一存毫秒整数（INTEGER），接口返回时转成 ISO 字符串，
--      与 TypeORM 的 timestamp 序列化结果一致。
--   3. 布尔列统一用 INTEGER 0/1，接口返回时转 boolean。

CREATE TABLE IF NOT EXISTS user (
  id        TEXT PRIMARY KEY,
  username  TEXT NOT NULL UNIQUE,
  password  TEXT NOT NULL,            -- pbkdf2$<iter>$<saltB64>$<hashB64>
  email     TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  isDeleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_username ON user(username);
CREATE INDEX IF NOT EXISTS idx_user_created ON user(createdAt);

CREATE TABLE IF NOT EXISTS room (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  creator     TEXT NOT NULL,
  createdAt   INTEGER NOT NULL,
  updatedAt   INTEGER NOT NULL,
  isDeleted   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_room_creator ON room(creator);
CREATE INDEX IF NOT EXISTS idx_room_created ON room(createdAt);

CREATE TABLE IF NOT EXISTS member (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  room_id   TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  isDeleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_member_user ON member(user_id);
CREATE INDEX IF NOT EXISTS idx_member_room ON member(room_id);

-- 同一用户在同一房间只允许一条「未删除」记录。
-- 用部分索引（WHERE isDeleted = 0）：退群后软删的行不占用唯一性，重新入群仍可插入。
-- 建索引前先清掉历史并发产生的重复行，否则脚本在旧库上会失败。
DELETE FROM member
 WHERE isDeleted = 0
   AND rowid NOT IN (SELECT MIN(rowid) FROM member WHERE isDeleted = 0 GROUP BY user_id, room_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_active ON member(user_id, room_id) WHERE isDeleted = 0;

CREATE TABLE IF NOT EXISTS apply (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL DEFAULT '',
  room_id        TEXT,
  apply_user_id  TEXT,
  status         INTEGER NOT NULL DEFAULT 0,
  handle_status  INTEGER NOT NULL DEFAULT 0,
  createdAt      INTEGER NOT NULL,
  updatedAt      INTEGER NOT NULL,
  isDeleted      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_apply_user ON apply(user_id);
CREATE INDEX IF NOT EXISTS idx_apply_room ON apply(room_id);
CREATE INDEX IF NOT EXISTS idx_apply_target ON apply(apply_user_id);

CREATE TABLE IF NOT EXISTS friend (
  id        TEXT PRIMARY KEY,
  creator   TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  isDeleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_friend_creator ON friend(creator);
CREATE INDEX IF NOT EXISTS idx_friend_target ON friend(friend_id);

-- 同上：好友关系以「未删除」为唯一，删好友后可以重新添加
DELETE FROM friend
 WHERE isDeleted = 0
   AND rowid NOT IN (SELECT MIN(rowid) FROM friend WHERE isDeleted = 0 GROUP BY creator, friend_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_active ON friend(creator, friend_id) WHERE isDeleted = 0;

-- 图形验证码：Worker 没有 express-session，用短命行替代
CREATE TABLE IF NOT EXISTS captcha (
  id      TEXT PRIMARY KEY,
  text    TEXT NOT NULL,
  expire  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captcha_expire ON captcha(expire);

-- 上传文件登记表：KV 只能按 key 读、不支持按用户/按时间查询，
-- 所以索引信息落 D1，用于配额判断与过期回收。
CREATE TABLE IF NOT EXISTS upload (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  key       TEXT NOT NULL UNIQUE,
  size      INTEGER NOT NULL,
  mime      TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upload_user ON upload(userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_upload_created ON upload(createdAt);

-- 单行累计值：避免每次上传都 SUM 全表（D1 按行计费，且行数会增长）
CREATE TABLE IF NOT EXISTS upload_stat (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  bytes     INTEGER NOT NULL DEFAULT 0,
  files     INTEGER NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO upload_stat (id, bytes, files, updatedAt) VALUES (1, 0, 0, 0);
