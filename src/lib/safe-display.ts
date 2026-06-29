/**
 * 前端安全顯示工具
 *
 * 後端可能回傳 null（原始 NaN/inf 被清理後），
 * 前端不應對 null 做任何數學運算，應顯示 "--"。
 *
 * 使用時機：
 *   - 任何來自 API 的數值欄位在顯示前都應透過此函數處理
 *   - 特別是：change_pct, week52_high/low, score, range_low/high, stop_loss
 */

/** 任何無效值（null / undefined / NaN / Infinity）都顯示 "--" */
export function safeVal(
  value: number | null | undefined,
  format?: (n: number) => string
): string {
  if (value === null || value === undefined) return '--'
  if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return '--'
  if (format) return format(value)
  return String(value)
}

/** 顯示價格，null 顯示 "--" */
export function safePrice(value: number | null | undefined, decimals = 2): string {
  return safeVal(value, v => v.toFixed(decimals))
}

/** 顯示百分比，含正負號，null 顯示 "--" */
export function safePct(value: number | null | undefined, decimals = 2): string {
  return safeVal(value, v => `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`)
}

/** 顯示整數，null 顯示 "--" */
export function safeInt(value: number | null | undefined): string {
  return safeVal(value, v => Math.round(v).toLocaleString('zh-TW'))
}

/** 安全取 toFixed，null 顯示 "--" */
export function safeFixed(value: number | null | undefined, decimals = 0): string {
  return safeVal(value, v => v.toFixed(decimals))
}
