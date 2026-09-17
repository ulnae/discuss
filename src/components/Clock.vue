<template>
  <div class="tr" role="group" :aria-label="ariaLabel" :style="rootStyle">
    <div v-for="(pair, ci) in units" :key="ci" class="tr-card">
      <!-- 数字滚动区 -->
      <div class="tr-digits">
        <div v-for="(digit, di) in pair" :key="di" class="tr-col">
          <div class="tr-track" :style="{ '--i': digit }">
            <span v-for="n in 10" :key="n" class="tr-num">{{ n - 1 }}</span>
          </div>
        </div>
      </div>

      <!-- 上下边缘模糊层 -->
      <span class="tr-fog tr-fog--top" aria-hidden="true" />
      <span class="tr-fog tr-fog--bottom" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 时 */
  hours: { type: [Number, String], default: 0 },
  /** 分 */
  minutes: { type: [Number, String], default: 0 },
  /** 秒 */
  seconds: { type: [Number, String], default: 0 },
  /** 滚动动画时长(ms) */
  duration: { type: [Number, String], default: 720 },
})

/** 补零 + 安全范围控制 */
const toPad = (value) => {
  const n = Number(value)
  const safe = Number.isFinite(n) ? Math.min(99, Math.max(0, Math.trunc(n))) : 0
  return String(safe).padStart(2, '0')
}

/** 拆成 3 组、每组 2 个字符 */
const units = computed(() => [
  toPad(props.hours).split(''),
  toPad(props.minutes).split(''),
  toPad(props.seconds).split(''),
])

const ariaLabel = computed(
  () => `${toPad(props.hours)}:${toPad(props.minutes)}:${toPad(props.seconds)}`
)

const rootStyle = computed(() => {
  const d = Number(props.duration)
  return { '--tr-duration': `${Number.isFinite(d) && d >= 0 ? d : 720}ms` }
})
</script>

<style scoped>
/* ===================== 基础变量 ===================== */
.tr {
  --tr-card-h: 84px;      /* 卡片高度 = 单个数字高度 */
  --tr-digit-w: 36px;     /* 单个数字宽度 */
  --tr-font-size: 48px;   /* 数字字号 */
  --tr-radius: 12px;      /* 圆角 */
  --tr-gap: 16px;         /* 卡片间距 */
  --tr-fog-h: 10px;       /* 边缘模糊高度 */
  --tr-duration: 720ms;

  display: inline-flex;
  align-items: center;
  gap: var(--tr-gap);
  font-family: 'SF Mono', 'JetBrains Mono', 'Roboto Mono', ui-monospace,
    Menlo, Consolas, monospace;
}

.tr *,
.tr *::before,
.tr *::after {
  box-sizing: border-box;
}

/* ===================== 灰色方框卡片 ===================== */
.tr-card {
  position: relative;
  height: var(--tr-card-h);
  padding: 0 14px;
  border-radius: var(--tr-radius);
  overflow: hidden;
  isolation: isolate;
  background: linear-gradient(
    180deg,
    #6e737b 0%,
    #4c5057 16%,
    #3b3f45 52%,
    #2b2e33 100%
  );
  box-shadow:
    /* 外投影 */
    0 10px 22px -10px rgba(0, 0, 0, 0.55),
    0 3px 8px rgba(0, 0, 0, 0.28),
    /* 内高光 / 内阴影 —— 让四个圆角更有“内圆角”厚度感 */
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.07),
    inset 0 0 18px rgba(0, 0, 0, 0.35);
}

/* 顶部内倒角光带 */
.tr-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 5;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.09) 0%,
    rgba(255, 255, 255, 0) 42%
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

/* ===================== 数字列 ===================== */
.tr-digits {
  display: flex;
  height: 100%;
  align-items: stretch;
}

.tr-col {
  position: relative;
  width: var(--tr-digit-w);
  height: var(--tr-card-h);
  overflow: hidden;
  /* 数字靠近边缘时柔和淡出 */
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.12) 0%,
    #000 26%,
    #000 74%,
    rgba(0, 0, 0, 0.12) 100%
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.12) 0%,
    #000 26%,
    #000 74%,
    rgba(0, 0, 0, 0.12) 100%
  );
}

.tr-track {
  display: flex;
  flex-direction: column;
  will-change: transform;
  /* --i 为目标数字，滚动到对应位置 */
  transform: translateY(calc(var(--i, 0) * var(--tr-card-h) * -1));
  transition: transform var(--tr-duration) cubic-bezier(0.16, 1, 0.3, 1);
}

.tr-num {
  display: grid;
  place-items: center;
  height: var(--tr-card-h);
  font-size: var(--tr-font-size);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.16),
    0 3px 10px rgba(0, 0, 0, 0.55);
  user-select: none;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}

/* ===================== 边缘模糊 ===================== */
.tr-fog {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--tr-fog-h);
  pointer-events: none;
  z-index: 4;
  backdrop-filter: blur(3px) saturate(0.92);
  -webkit-backdrop-filter: blur(3px) saturate(0.92);
}

.tr-fog--top {
  top: 0;
  border-radius: var(--tr-radius) var(--tr-radius) 0 0;
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0.7) 45%,
    rgba(0, 0, 0, 0) 100%
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0.7) 45%,
    rgba(0, 0, 0, 0) 100%
  );
}

.tr-fog--bottom {
  bottom: 0;
  border-radius: 0 0 var(--tr-radius) var(--tr-radius);
  -webkit-mask-image: linear-gradient(
    to top,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0.7) 45%,
    rgba(0, 0, 0, 0) 100%
  );
  mask-image: linear-gradient(
    to top,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0.7) 45%,
    rgba(0, 0, 0, 0) 100%
  );
}

/* 小屏自适应 */
@media (max-width: 480px) {
  .tr {
    --tr-card-h: 64px;
    --tr-digit-w: 32px;
    --tr-font-size: 36px;
    --tr-radius: 14px;
    --tr-gap: 10px;
    --tr-fog-h: 22px;
  }
}
</style>