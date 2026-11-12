#!/usr/bin/env node
/**
 * discuss-worker 域名自检：一次性验证「域名 → Worker → D1 → Durable Object WebSocket」整条链。
 *
 * 用法：
 *   node scripts/check-domain.mjs https://discuss-api.xxx.dpdns.org
 *   node scripts/check-domain.mjs https://discuss-api.xxx.dpdns.org --register
 *   node scripts/check-domain.mjs http://127.0.0.1:8787 --register        # 本地 wrangler dev
 *
 * 参数：
 *   --register        登录失败时自动注册一个临时账号（默认用户名 check<时间戳>）
 *   --user=xxx        指定账号
 *   --pass=xxx        指定密码（默认 pass1234）
 *
 * 退出码 0 = 全通；1 = 有失败项（每一步都会打印失败原因和建议）。
 */

const args = process.argv.slice(2);
const base = (args.find(a => !a.startsWith('--')) || '').replace(/\/+$/, '');
const flag = name => args.includes(`--${name}`);
const opt = (name, fallback) => {
    const hit = args.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
};

if (!base) {
    console.error('用法: node scripts/check-domain.mjs <base-url> [--register] [--user=xx] [--pass=xx]');
    process.exit(1);
}

const USER = opt('user', `check${Date.now().toString().slice(-6)}`);
const PASS = opt('pass', 'pass1234');
const TIMEOUT = 15000;

let failed = 0;
const t0 = () => Date.now();
const ms = t => `${Date.now() - t}ms`;

function pass(step, detail = '') {
    console.log(`  ✅ ${step}${detail ? '  ' + detail : ''}`);
}

function fail(step, detail = '', hint = '') {
    failed += 1;
    console.log(`  ❌ ${step}${detail ? '  ' + detail : ''}`);
    if (hint) console.log(`     → ${hint}`);
}

async function req(path, init = {}) {
    const res = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { res, text, json };
}

/** 从验证码 SVG 里取出 4 个字符（worker: {id,svg}；nestjs: 裸 svg） */
function parseCaptcha(payload) {
    const svg = (payload && payload.svg) || (typeof payload === 'string' ? payload : '');
    const chars = [...String(svg).matchAll(/<text[^>]*>([^<])<\/text>/g)].map(m => m[1]);
    return { id: (payload && payload.id) || '', answer: chars.join('') };
}

console.log(`\n目标: ${base}\n`);

/* ── 1. HTTP 可达性 ───────────────────────────────────────────── */
{
    const t = t0();
    try {
        const { res, json, text } = await req('/api/health');
        if (res.ok && json && json.data && json.data.service === 'discuss-api') {
            pass('HTTP 可达且是 discuss-api', `${ms(t)}  colo=${json.data.colo || '-'}`);
        } else if (res.status === 404) {
            fail('HTTP 返回 404', text.slice(0, 120), '域名指向了别的东西，或路径不是 /api/health');
        } else {
            fail('HTTP 返回异常', `${res.status} ${text.slice(0, 120)}`, '看 wrangler tail 的日志');
        }
    } catch (error) {
        const reason = error && error.name === 'TimeoutError' ? `超时(>${TIMEOUT}ms)` : (error && error.cause && error.cause.code) || (error && error.message);
        fail('HTTP 连不上', String(reason), '域名未绑定/未解析/DNS 还没生效；先 dig 一下这个域名');
        console.log('\nHTTP 都不通，后面的 WebSocket 不必测了。\n');
        process.exit(1);
    }
}

/* ── 2. D1 与验证码 ──────────────────────────────────────────── */
let captcha = { id: '', answer: '' };
{
    const t = t0();
    try {
        const { res, json } = await req('/api/captcha');
        if (!res.ok || !json || json.code !== 200) {
            fail('取验证码失败', `HTTP ${res.status}`, 'D1 建表了吗？wrangler d1 execute discuss-data --remote --file=./schema.sql');
        } else {
            captcha = parseCaptcha(json.data);
            if (captcha.answer.length >= 3) pass('D1 正常（验证码已写入）', `${ms(t)}  id=${captcha.id.slice(0, 8)}…`);
            else fail('验证码内容解析不出来', JSON.stringify(json.data).slice(0, 120), '接口返回格式变了');
        }
    } catch (error) {
        fail('取验证码异常', String(error && error.message));
    }
}

/* ── 3. 登录 / 注册 → JWT ────────────────────────────────────── */
let token = '';
async function doLogin() {
    const { res, json } = await req('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS, captcha: captcha.answer, captchaId: captcha.id })
    });
    return { res, json };
}

{
    const t = t0();
    try {
        let { json } = await doLogin();
        if (!json || json.code !== 200) {
            if (!flag('register')) {
                fail('登录失败', (json && json.msg) || '无响应', '账号不存在时加 --register 自动注册');
            } else {
                const reg = await req('/api/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: USER, password: PASS, email: `${USER}@check.local`, captcha: captcha.answer, captchaId: captcha.id })
                });
                if (!reg.json || reg.json.code !== 200) {
                    fail('注册失败', (reg.json && reg.json.msg) || reg.text.slice(0, 100), '验证码可能已过期，重跑一次');
                } else {
                    ({ json } = await doLogin());
                }
            }
        }
        if (json && json.code === 200 && json.data && json.data.access_token) {
            token = json.data.access_token;
            pass('登录并签发 JWT', `${ms(t)}  user=${USER}`);
        } else if (!failed) {
            fail('未拿到 token', (json && json.msg) || '');
        }
    } catch (error) {
        fail('登录异常', String(error && error.message));
    }
}

/* ── 4. 带 token 的鉴权请求 ──────────────────────────────────── */
if (token) {
    const t = t0();
    try {
        const { res, json } = await req('/api/user?page=1&pageSize=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && json && json.code === 200) pass('鉴权请求正常', `${ms(t)}`);
        else fail('鉴权请求失败', `HTTP ${res.status} ${(json && json.msg) || ''}`);
    } catch (error) {
        fail('鉴权请求异常', String(error && error.message));
    }
}

/* ── 5. WebSocket 握手（这一步才是重点）──────────────────────── */
if (token) {
    const wsURL = `${base.replace(/^http/i, 'ws')}/api/ws?token=${encodeURIComponent(token)}`;
    const t = t0();
    await new Promise(resolve => {
        let settled = false;
        const done = (ok, detail, hint) => {
            if (settled) return;
            settled = true;
            ok ? pass('WebSocket 已连接', detail) : fail('WebSocket 连不上', detail, hint);
            resolve();
        };
        let socket;
        try {
            socket = new WebSocket(wsURL);
        } catch (error) {
            return done(false, String(error && error.message), '地址协议不对？应以 wss:// 或 ws:// 开头');
        }
        let opened = false;
        const timer = setTimeout(() => {
            try { socket.close(); } catch { /* ignore */ }
            done(false, `握手超时(>${TIMEOUT}ms)`, '域名可达但 Upgrade 被中间层拦了；Cloudflare 会正常转发 WS，代理/网关则可能不支持');
        }, TIMEOUT);

        /* 连上后等首帧（Hub 在 accept 时会推 connected），等不到也算连接成功 */
        const greeted = setTimeout(() => {
            if (opened) done(true, `${ms(t)}  已连接（1.5s 内无首帧，可能 DO 稍慢）`);
        }, 1500);

        socket.onopen = () => {
            clearTimeout(timer);
            opened = true;
        };
        socket.onmessage = event => {
            if (typeof event.data !== 'string' || event.data === 'pong') return;
            let frame = null;
            try { frame = JSON.parse(event.data); } catch { /* ignore */ }
            if (frame && frame.event) {
                console.log(`     ← ${frame.event}`);
                if (frame.event === 'connected') {
                    clearTimeout(greeted);
                    done(true, `${ms(t)}  已连接，收到 connected 帧`);
                    try { socket.close(); } catch { /* ignore */ }
                }
            }
        };
        socket.onerror = () => {
            clearTimeout(timer);
            clearTimeout(greeted);
            done(false, '握手失败', '常见原因：DNS 解析到错误地址、证书不匹配、或该域名还没绑到这个 Worker');
        };
        socket.onclose = () => {
            clearTimeout(timer);
            clearTimeout(greeted);
            done(false, '连接被立即关闭', 'token 无效会返回 401；用 wrangler tail 看 Worker 日志');
        };
    });
}

console.log(failed ? `\n结果: ${failed} 项失败\n` : '\n结果: 全部通过 ✅\n');
if (flag('register') && token) {
    console.log(`提示: 本次测试账号 ${USER} / ${PASS} 留在库里不影响使用，可删：`);
    console.log(`  wrangler d1 execute discuss-data --remote --command="DELETE FROM user WHERE username='${USER}'"\n`);
}
process.exit(failed ? 1 : 0);
