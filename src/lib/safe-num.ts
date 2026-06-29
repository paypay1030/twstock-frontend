/**
 * 前端數值安全顯示工具
 *
 * 後端可能回傳 null（原為 NaN/Inf 已由 SafeJSONResponse 轉換），
 * 或前端計算中產生 undefined。
 * 這些情況都應顯示 "--" 而非讓 React crash。
 */

/** 安全取得數值，null/undefined/NaN 一律回傳 null */
export function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (isNaN(n) || !isFinite(n)) return null
  return n
}

/** 安全顯示數值，無效時顯示 fallback（預設 "--"）*/
export function displayNum(
  v: unknown,
  decimals = 0,
  fallback = '--'
): string {
  const n = safeNum(v)
  if (n === null) return fallback
  const rounded = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n))
  const [int, dec] = rounded.split('.')
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${formatted}.${dec}` : formatted
}

/** 安全顯示價格（2 位小數）*/
export function displayPrice(v: unknown, fallback = '--'): string {
  return displayNum(v, 2, fallback)
}

/** 安全顯示百分比（2 位小數，帶 % 符號）*/
export function displayPct(v: unknown, fallback = '--'): string {
  const n = safeNum(v)
  if (n === null) return fallback
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}
