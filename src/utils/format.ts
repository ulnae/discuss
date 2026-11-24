/** 名字首字母：中文取第一个字，空值统一显示 ? */
export function avatarInitial(name?: string | null): string {
  return (name || '?').trim().charAt(0).toUpperCase()
}
