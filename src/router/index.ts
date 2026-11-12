import { createRouter, createWebHashHistory } from 'vue-router'
import routes from './routes'
import NProgress from 'nprogress';

import { pinia } from '@/store'
import { useMenuStore } from '@/store/modules/menu'

const menuStore = useMenuStore(pinia)

const router = createRouter({
    // GitHub Pages 是纯静态托管，没有 rewrite：history 模式下刷新 /discuss/friend/1
    // 会直接 404（服务器找不到该路径的文件）。改用 hash 后 URL 变成 /discuss/#/friend/1，
    // 刷新永远只请求 /discuss/，由前端自己解析 # 之后的部分。
    // 旧的 history 深链由 public/404.html 兜底转成 hash。
    history: createWebHashHistory(import.meta.env.VITE_APP_BASE_URL),
    routes
})

NProgress.configure({
    showSpinner: false,
    easing: 'ease',
    speed: 1000,
    minimum: 0.2,
    trickle: false,
    trickleSpeed: 800,
});

router.beforeEach(async (to, from, next: Function) => {
    if (!NProgress.isStarted()) {
        NProgress.start();
    }

    console.log('[Router]:beforeEach', to.name, from.name);
    if (localStorage.getItem('token')) { // 已登陆
        if (!menuStore.isLoad) { // 已登陆-未加载路由
            let asyncRoutes: any = await menuStore.GenerateRoutes()
            const layout = routes.find(r => r.path === '/')
            layout.children = [...asyncRoutes]
            router.addRoute(layout)
            
            menuStore.isLoad = true
            if (to.name === 'login') {
                next(from.path)
            } else {
                next(to.fullPath)
            }

        } else { // 
            next()
        }
    } else {
        if (to.name !== 'login') { // 不是去login
            next({
                name: 'login',
                query: {
                    redirect: encodeURIComponent(to.fullPath)
                }
            })
        } else {
            next()
        }
    }
})

router.afterEach(_ => {
    console.log('[Router]:afterEach');
    NProgress.done();
})
router.isReady().then(res => {
    console.log('[Router]:isReady');
})
export default router
