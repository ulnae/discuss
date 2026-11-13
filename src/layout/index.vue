<template>
  <div class="app-canvas">
    <!-- 左侧导航：与登录页同一套玻璃质感 -->
    <aside class="rail panel">
      <div class="rail-brand" title="Discuss" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
          <path d="M8.5 11.5h7M8.5 8.5h4" />
        </svg>
      </div>

      <nav class="rail-nav" aria-label="主导航">
        <button v-for="page in initRoutes" :key="page.path" type="button" class="rail-btn"
          :class="{ 'is-active': getPath === page.path }" :title="page.meta.title" @click="handleClick(page)">
          <span class="rail-icon" v-html="page.meta.icon"></span>
          <span class="rail-text">{{ page.meta.title }}</span>
        </button>
      </nav>

      <div class="rail-foot">
        <button type="button" class="rail-btn" :title="theme === 'light' ? '切换到深色' : '切换到浅色'" @click="toggleTheme">
          <span class="rail-icon">
            <svg v-if="theme === 'light'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </span>
          <span class="rail-text">主题</span>
        </button>

        <button type="button" class="rail-btn" :class="{ 'is-active': getPath === 'setting' }" title="设置"
          @click="handleSetting">
          <span class="rail-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </span>
          <span class="rail-text">设置</span>
        </button>

        <button type="button" class="rail-btn rail-btn-quiet" title="退出登录" @click="handleLogout">
          <span class="rail-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          </span>
          <span class="rail-text">退出</span>
        </button>
      </div>
    </aside>

    <!-- 内容区：独立玻璃卡片 -->
    <main class="app-main panel">
      <router-view></router-view>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { useUserStore } from "@/store/modules/user";
import router from "@/router";
import { computed, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { initRoutes } from "@/router/routes";
import { useTheme } from '@/hooks/theme'

function handleClick(page: any) {
  router.push({
    name: page.name,
  });
}

const userStore = useUserStore();

const handleLogout = () => {
  userStore.logout();
};

// 关于
const handleSetting = () => {
  router.push({
    name: "setting",
  });
}

const route = useRoute()
const routePath = ref<string | undefined>(undefined)
watchEffect(() => {
  routePath.value = route.path
})
const getPath = computed(() => {
  return routePath.value?.split('/').filter(Boolean)[0]
})

const { theme, toggleTheme } = useTheme()
</script>

<style lang="scss" scoped>
.rail {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 76px;
    padding: 12px 8px;
    box-shadow: var(--shadow-soft);
}

.rail-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    margin: 0 auto 14px;
    border-radius: 13px;
    color: #fff;
    background: #111;
    box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.6);
}

html.dark .rail-brand {
    color: #111;
    background: #fafafa;
    box-shadow: 0 8px 20px -8px rgba(255, 255, 255, 0.35);
}

.rail-nav {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
}

.rail-foot {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
}

.rail-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px;
    border: 0;
    border-radius: 11px;
    color: var(--text-2);
    background: transparent;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    &:hover {
        color: var(--text);
        background: var(--surface-2);
    }

    &.is-active {
        color: var(--text);
        background: var(--surface-3);
    }

    &.rail-btn-quiet:hover {
        color: var(--danger);
    }
}

.rail-icon {
    display: flex;

    :deep(svg) {
        width: 19px;
        height: 19px;
    }
}

.rail-text {
    font-size: 0.6rem;
    letter-spacing: 0.02em;
    line-height: 1;
}

.app-main {
    flex: 1;
    min-width: 0;
    overflow: hidden;
}

/* 移动端：左侧导航改成底部 tab bar，内容区占满剩余高度 */
@media (max-width: 768px) {
    .app-canvas {
        flex-direction: column;
        gap: 0;
        padding: 0;
    }

    .app-main {
        order: 1;
        flex: 1;
        min-height: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        background: var(--surface-solid);
        backdrop-filter: none;
    }

    .rail {
        order: 2;
        flex-direction: row;
        align-items: stretch;
        justify-content: space-around;
        width: 100%;
        padding: 3px 4px calc(3px + env(safe-area-inset-bottom));
        border: 0;
        border-top: 1px solid var(--border);
        border-radius: 0;
        background: var(--surface-solid);
        box-shadow: 0 -8px 24px -18px rgba(15, 23, 42, 0.35);
        backdrop-filter: none;
    }

    .rail-brand {
        display: none;
    }

    .rail-nav {
        flex-direction: row;
        flex: 1;
        gap: 0;
        justify-content: space-around;
    }

    .rail-foot {
        flex-direction: row;
        align-items: stretch;
        gap: 0;
        margin-left: 2px;
        padding-top: 0;
        padding-left: 2px;
        border-top: 0;
        border-left: 1px solid var(--border);
    }

    .rail-btn {
        flex: 1;
        min-width: 54px;
        gap: 2px;
        padding: 6px 3px;
        border-radius: 10px;

        &:active {
            background: var(--surface-2);
        }
    }

    .rail-icon :deep(svg) {
        width: 21px;
        height: 21px;
    }

    .rail-text {
        display: block;
        font-size: 0.58rem;
    }
}

@media (max-width: 360px) {
    .rail-btn {
        min-width: 44px;
    }

    .rail-text {
        font-size: 0.52rem;
    }
}
</style>
