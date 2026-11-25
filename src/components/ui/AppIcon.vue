<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="iconPaths[name] || ''" />
</template>

<script setup lang="ts">
type AppIconName = 'back' | 'search' | 'plus' | 'close' | 'check' | 'send' | 'list' | 'users' | 'room' | 'house' | 'chat' | 'bell' | 'group' | 'clock' | 'image' | 'file' | 'phone' | 'dots' | 'eye' | 'bold' | 'italic' | 'code' | 'codeblock' | 'link' | 'quote'

withDefaults(defineProps<{
  name: AppIconName
  size?: number | string
  strokeWidth?: number | string
}>(), {
  size: 16,
  strokeWidth: 1.8
})

const iconPaths: Record<AppIconName, string> = {
  back: '<path d="M15.75 19.5 8.25 12l7.5-7.5" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />',
  plus: '<path d="M12 4.5v15m7.5-7.5h-15" />',
  close: '<path d="M6 18 18 6M6 6l12 12" />',
  check: '<path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />',
  list: '<path d="M4 6.5h16M4 12h16M4 17.5h10" />',
  users: '<path d="M18 18.7a9.1 9.1 0 0 0 3.7-.5 3 3 0 0 0-4.7-2.7m.9 3.2v.1c0 .2 0 .4-.1.6A12 12 0 0 1 12 21a12 12 0 0 1-6-1.6V19a6 6 0 0 1 6-6 6 6 0 0 1 6 6Z" /><circle cx="12" cy="7" r="3.4" />',
  room: '<path d="M20.25 8.5c.9.3 1.5 1.1 1.5 2.1v4.3c0 1.1-.8 2.1-2 2.2l-1 .1v3l-3-3c-1.4 0-2.7-.1-4-.2" /><path d="M16.5 6.6c0-1.6-1.2-3-2.8-3.2A48 48 0 0 0 5 3.4C3.4 3.6 2.2 5 2.2 6.6v6.2c0 1.6 1.2 3 2.8 3.2L7 16.2V21l4.2-4.2" />',
  house: '<path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-5a2 2 0 0 1 4 0v5h4a1 1 0 0 0 1-1V9.8" />',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" /><path d="M8.5 11.5h7M8.5 8.5h4" />',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />',
  group: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />',
  image: '<path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z" />',
  file: '<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />',
  phone: '<path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />',
  dots: '<path d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  bold: '<path d="M7 4.5h5.5a3.75 3.75 0 0 1 0 7.5H7Zm0 7.5h6.5a3.75 3.75 0 0 1 0 7.5H7Z"/>',
  italic: '<path d="M10.5 4.5h6M7.5 19.5h6M14.8 4.5 9.2 19.5"/>',
  code: '<path d="m8.5 8.5-4 3.5 4 3.5M15.5 8.5l4 3.5-4 3.5"/>',
  codeblock: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m9.5 10.5-2 1.5 2 1.5M14.5 10.5l2 1.5-2 1.5"/>',
  link: '<path d="M9.5 14.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.6l-1.2 1.2"/><path d="M14.5 9.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.6l1.2-1.2"/>',
  quote: '<path d="M7.5 6.5C5.4 7.6 4.2 9.3 4.2 11.6V17h5.1v-5H6.9c.1-1.6.9-2.6 2.4-3.2Zm9.6 0c-2.1 1.1-3.3 2.8-3.3 5.1V17h5.1v-5h-2.4c.1-1.6.9-2.6 2.4-3.2Z" fill="currentColor" stroke="none"/>'
}
</script>
