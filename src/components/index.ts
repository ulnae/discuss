// 组件统一出口：业务组件在 shared/，基础组件在 ui/。
// view 层一律从 '@/components' 导入；组件内部引用基础件走 '@/components/ui' 避免循环。
// toast / confirm 是命令式 API（非组件），继续从 '@/components/ui/toast'、'@/components/ui/confirm' 导入。
export * from './ui'
export * from './shared'
