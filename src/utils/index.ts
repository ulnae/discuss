import { nextTick } from 'vue';
import { toast } from '@/components/ui/toast';
/**
 * 文件大小格式化选项
 */
interface FormatOptions {
  decimals?: number;
  unit?: 'auto' | 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB' | 'EB' | 'ZB' | 'YB';
  short?: boolean;
  space?: boolean;
  base?: 1000 | 1024;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number, options: FormatOptions = {}): string {
  const {
    decimals = 2,
    unit = 'auto',
    short = false,
    space = true,
    base = 1024
  } = options;

  if (bytes === 0) return `0${space ? ' ' : ''}${short ? 'B' : 'Bytes'}`;

  const k = base;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const sizes = short
    ? ['B', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
    : base === 1024
      ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
      : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  return `${size}${space ? ' ' : ''}${sizes[i]}`;
}


function scrollToBottom(id: string) {
  nextTick(() => {
    document.getElementById(id)?.lastElementChild?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  })
}

/**
 * 将数据导出为 JSON 文件并下载
 * @param {any} data - 要导出的 JavaScript 数据（对象/数组/基本类型）
 * @param {string} [filename='data.json'] - 下载的文件名，默认为 'data.json'
 * @param {number|string} [indent=2] - JSON 字符串缩进空格数，设为 null 或 0 可输出压缩格式
 * @returns {void}
 */
function downloadJSON(data: Object, filename = 'data.json', indent = 2) {
  try {
    // 将数据转换为 JSON 字符串，支持缩进美化
    const jsonString = JSON.stringify(data, null, indent);

    // 创建 Blob 对象，指定 MIME 类型为 application/json
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 生成一个临时的对象 URL
    const url = URL.createObjectURL(blob);

    // 创建隐藏的 <a> 元素用于触发下载
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // 将链接添加到 DOM（某些浏览器需要）
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 释放临时 URL，避免内存泄漏
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出 JSON 文件失败：', error);
    toast.error('导出失败，请稍后重试或检查数据格式。');
  }
}

function updateTitle() {
  let timer: any
  let defaultTitle = document.title

  return function setTitle(title: string) {
    timer && clearTimeout(timer)
    document.title = title
    timer = setTimeout(() => {
      document.title = defaultTitle
    }, 10000);
  }
}


/**
 * 判断 URL 是否以指定后缀名结尾（忽略大小写）
 * @param {string} url - 网络静态资源地址（需为合法 URL）
 * @param {string|string[]} suffix - 后缀名，可以是字符串或字符串数组，如 'jpg' 或 ['.png', 'gif']
 * @returns {boolean} - 若 URL 路径部分以任意一个后缀结尾则返回 true，否则返回 false
 */
function isUrlEndWith(url: string, suffix: string | string[]) {
  // 参数有效性检查
  if (!url || typeof url !== 'string') return false;
  if (!suffix) return false;

  // 提取 URL 的路径部分（不含查询参数和哈希）
  let pathname;
  try {
    const urlObj = new URL(url);
    pathname = urlObj.pathname;
  } catch {
    // 无效 URL 直接返回 false
    return false;
  }
  if (!pathname) return false;

  // 将后缀统一转换为数组，并标准化为带点的形式，且转为小写
  const suffixes = Array.isArray(suffix) ? suffix : [suffix];
  const normalizedSuffixes = suffixes
    .filter(s => typeof s === 'string' && s.trim() !== '')
    .map(s => (s.startsWith('.') ? s : '.' + s).toLowerCase());

  const lowerPathname = pathname.toLowerCase();
  return normalizedSuffixes.some(suf => lowerPathname.endsWith(suf));
}

export { formatFileSize, type FormatOptions, scrollToBottom, downloadJSON, updateTitle, isUrlEndWith };