<template>
  <div
    class="inline-flex items-center gap-4 max-[480px]:gap-2.5"
    role="group"
    :aria-label="ariaLabel"
    :style="rootStyle"
  >
    <div
      v-for="(pair, ci) in units"
      :key="ci"
      class="relative isolate h-[84px] overflow-hidden rounded-xl px-3.5
             max-[480px]:h-16 max-[480px]:rounded-[14px]
             bg-[#e0e0e0] transition-colors duration-300
             dark:bg-[linear-gradient(180deg,#6e737b_0%,#4c5057_16%,#3b3f45_52%,#2b2e33_100%)]
             dark:shadow-[0_10px_22px_-10px_rgba(0,0,0,0.55),0_3px_8px_rgba(0,0,0,0.28)]
             after:pointer-events-none after:absolute after:inset-0 after:z-[5]
             after:rounded-[inherit] after:content-['']
             after:bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0)_42%)]
             after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
    >
      <!-- 数字滚动区 -->
      <div class="flex h-full items-stretch">
        <div
          v-for="(digit, di) in pair"
          :key="di"
          class="relative h-[84px] w-9 overflow-hidden
                 max-[480px]:h-16 max-[480px]:w-8
                 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,#000_26%,#000_74%,rgba(0,0,0,0.12)_100%)]"
        >
          <div
            class="flex flex-col will-change-transform
                   translate-y-[calc(var(--i,0)*-10%)]
                   transition-transform duration-[var(--tr-duration)]
                   ease-[cubic-bezier(0.16,1,0.3,1)]"
            :style="{ '--i': digit }"
          >
            <span
              v-for="n in 10"
              :key="n"
              class="grid h-[84px] place-items-center text-[48px] leading-none font-bold
                     tracking-[-0.02em] tabular-nums antialiased select-none
                     text-[#2b2e33] transition-colors duration-300 dark:text-white
                     max-[480px]:h-16 max-[480px]:text-[36px]"
            >{{ n - 1 }}</span>
          </div>
        </div>
      </div>

      <!-- 上下边缘模糊层 -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 z-4 h-2.5 rounded-t-xl
               backdrop-blur-[3px] backdrop-saturate-[0.92]
               max-[480px]:h-[22px] max-[480px]:rounded-t-[14px]
               [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0.7)_45%,rgba(0,0,0,0)_100%)]"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-4 h-2.5 rounded-b-xl
               backdrop-blur-[3px] backdrop-saturate-[0.92]
               max-[480px]:h-[22px] max-[480px]:rounded-b-[14px]
               [mask-image:linear-gradient(to_top,rgba(0,0,0,1)_0%,rgba(0,0,0,0.7)_45%,rgba(0,0,0,0)_100%)]"
      />
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

/** 唯一需要 JS 注入的变量：动画时长（因为它是 prop 驱动的） */
const rootStyle = computed(() => {
  const d = Number(props.duration)
  return { '--tr-duration': `${Number.isFinite(d) && d >= 0 ? d : 720}ms` }
})
</script>