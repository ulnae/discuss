/// <reference types="vite/client" />

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