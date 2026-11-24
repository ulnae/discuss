/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BUILD_INFO: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_RUNTIME: 'worker' | 'nestjs'
  readonly VITE_APP_BASE_API: string
  readonly VITE_APP_API_BASE_URL: string
  readonly VITE_APP_WS_BASE_URL: string
  readonly VITE_APP_BASE_URL: string
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// declare module 'socket.io-client' 
interface Window{
  eventCenterForMicroVue?:any
  returnCitySN?:any
  ActiveXObject?: any
}