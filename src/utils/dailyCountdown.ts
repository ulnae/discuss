/**
 * 格式化剩余时间为 HH:mm:ss
 * @param ms 
 * @returns 
 */
export const formatRemain = (ms: number) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
};

/**
 * 解析 "HH:mm:ss" 或 "HH:mm"
 * @param str 
 * @returns 
 */
export const parseTime = (str: string) => {
    const [h = 0, m = 0, s = 0] = str.split(':').map(Number);
    return { h, m, s };
};


/**
 * 获取下一个目标时间
 * @param now 
 * @param timeStrings 
 * @returns 
 */
export const getNextTarget = (now: Date, timeStrings: string[]) => {
    let next = null;

    for (const str of timeStrings) {
        const { h, m, s } = parseTime(str);

        // 用今天日期构造该时间点
        let target = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            h,
            m,
            s,
            0
        );

        // 如果今天这个时间已经过了（或正好等于），就顺延到明天
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        // 取所有时间点中最早的一个
        if (!next || target.getTime() < next.getTime()) {
            next = target;
        }
    }

    return next;
};

/**
 * 每日多时间点倒计时
 * @param {string[]} timeStrings 时间字符串数组，例如 ['12:00:00', '18:00:00']
 * @param {(text, targetDate, remainMs) => void} onUpdate 每秒回调
 * @returns {Function} 停止倒计时的函数
 */
export function createDailyCountdown(timeStrings: string[], onUpdate: Function) {

    const tick = () => {
        const now = new Date();
        const target = getNextTarget(now, timeStrings);
        const remain = (target as Date).getTime() - now.getTime();
        onUpdate(formatRemain(remain), target, remain);
    };

    // 立即执行一次，然后每秒更新
    tick();
    const timer = setInterval(tick, 1000);

    // 返回停止函数
    return () => clearInterval(timer);
}

// ================= 使用示例 =================
// const times = ['12:00:00', '18:00:00'];

// const stop = createDailyCountdown(times, (text, target) => {
//     console.log(`下一个目标：${target.toLocaleString()}，剩余：${text}`);
// });

// 如果需要停止倒计时，调用 stop()
// stop();