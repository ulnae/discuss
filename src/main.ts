import { createApp } from 'vue'
import 'nprogress/nprogress.css';
import '@/assets/style/index.scss'
import '@/assets/style/taillwind.css'
import App from './App.vue'
import { pinia } from '@/store'
import router from '@/router'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
