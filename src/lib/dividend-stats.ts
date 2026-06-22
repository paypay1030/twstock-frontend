/**
 * 股息統計計算（純函數）
 *
 * 從 DividendRecord[] 推導：
 *   - 單一股票累積股息
 *   - 全部股息收入（用於真正總報酬）
 *   - 年度股息統計（供股息中心頁面圖表/列表使用）
 */
import type { DividendRecord } from '@/types'

export interface StockDividendSummary {
  code: string
  name: string
  totalAmount: number   // 該股票累積股息
  count: number          // 該股票股息筆數
  latestDate: string | null
}

export interface YearlyDividendSummary {
  year: string           // "2024"
  totalAmount: number
  count: number
}

export interface DividendOverview {
  totalIncome: number                       // 全部股息收入（所有年度加總）
  totalCount: number                          // 總筆數
  byStock: StockDividendSummary[]            // 依股票分組，依累積金額由高到低排序
  byYear: YearlyDividendSummary[]            // 依年度分組，依年度新到舊排序
  thisYearIncome: number                      // 今年累積股息（供首頁「年度已實現」並列參考）
}

/** 全部股息收入加總（最常用，供真正總報酬使用）*/
export function calcTotalDividendIncome(dividends: DividendRecord[]): number {
  return dividends.reduce((sum, d) => sum + d.amount, 0)
}

/** 單一股票的累積股息 */
export function calcStockDividendTotal(dividends: DividendRecord[], code: string): number {
  return dividends
    .filter(d => d.code === code)
    .reduce((sum, d) => sum + d.amount, 0)
}

/** 完整股息總覽：供股息中心頁面使用 */
export function calcDividendOverview(dividends: DividendRecord[]): DividendOverview {
  const totalIncome = calcTotalDividendIncome(dividends)
  const totalCount = dividends.length

  // 依股票分組
  const stockMap = new Map<string, { name: string; total: number; count: number; latestDate: string | null }>()
  for (const d of dividends) {
    const existing = stockMap.get(d.code)
    if (existing) {
      existing.total += d.amount
      existing.count += 1
      if (!existing.latestDate || d.date > existing.latestDate) {
        existing.latestDate = d.date
      }
    } else {
      stockMap.set(d.code, { name: d.name, total: d.amount, count: 1, latestDate: d.date })
    }
  }
  const byStock: StockDividendSummary[] = Array.from(stockMap.entries())
    .map(([code, v]) => ({
      code, name: v.name, totalAmount: v.total, count: v.count, latestDate: v.latestDate,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)

  // 依年度分組（從 date 取年份）
  const yearMap = new Map<string, { total: number; count: number }>()
  for (const d of dividends) {
    const year = d.date.slice(0, 4)
    const existing = yearMap.get(year)
    if (existing) {
      existing.total += d.amount
      existing.count += 1
    } else {
      yearMap.set(year, { total: d.amount, count: 1 })
    }
  }
  const byYear: YearlyDividendSummary[] = Array.from(yearMap.entries())
    .map(([year, v]) => ({ year, totalAmount: v.total, count: v.count }))
    .sort((a, b) => b.year.localeCompare(a.year))

  const currentYear = String(new Date().getFullYear())
  const thisYearIncome = yearMap.get(currentYear)?.total ?? 0

  return { totalIncome, totalCount, byStock, byYear, thisYearIncome }
}
