export interface FetchGuardHost {
  getId(): number
  setId(id: number): void
  setLoading(loading: boolean): void
}

/** 并发请求 loading 守卫：只有最后一次主动请求的 finally 能关闭 loading */
export function createFetchGuard(host: FetchGuardHost) {
  return {
    start() {
      const id = host.getId() + 1
      host.setId(id)
      host.setLoading(true)
      return id
    },
    finish(id: number) {
      if (host.getId() === id) host.setLoading(false)
    }
  }
}
