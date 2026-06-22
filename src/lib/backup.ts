/**
 * 資料備份與還原
 *
 * 匯出：將四個 LocalStorage key 的內容打包成單一 JSON 檔，
 *       提供下載，檔名格式 twstock-backup-yyyy-mm-dd.json
 * 匯入：讀取備份 JSON，逐一寫回對應 LocalStorage key，
 *       完成後需重新整理頁面讓 Zustand store 重新讀取
 *
 * 設計原則：
 *   - 純粹操作 LocalStorage 原始字串，不依賴 Zustand store 實例，
 *     避免匯入時與當前記憶體中的 store 狀態產生競態問題
 *   - 匯入前一律要求二次確認（由呼叫端 UI 負責），避免誤觸覆蓋
 */
import { STORAGE_KEYS } from '@/stores'

export const BACKUP_VERSION = 1

export interface BackupFile {
  version: number
  exportedAt: string
  data: {
    trades:    unknown
    settings:  unknown
    dividends: unknown
    watchlist: unknown
  }
}

/** 安全讀取 LocalStorage 並解析 JSON，失敗則回傳 null */
function safeReadLocalStorage(key: string): unknown {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 產生今天日期字串 yyyy-mm-dd（本地時區）*/
function todayDateString(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 產生備份檔內容（不觸發下載，純資料組裝，方便測試）
 */
export function buildBackupFile(): BackupFile {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trades:    safeReadLocalStorage(STORAGE_KEYS.trades),
      settings:  safeReadLocalStorage(STORAGE_KEYS.settings),
      dividends: safeReadLocalStorage(STORAGE_KEYS.dividends),
      watchlist: safeReadLocalStorage(STORAGE_KEYS.watchlist),
    },
  }
}

/**
 * 匯出資料：產生 JSON 並觸發瀏覽器下載
 * 檔名：twstock-backup-yyyy-mm-dd.json
 */
export function exportBackup(): void {
  const backup = buildBackupFile()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `twstock-backup-${todayDateString()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ImportResult =
  | { ok: true; summary: { trades: number; dividends: number; watchlist: number; hasSettings: boolean } }
  | { ok: false; error: string }

/**
 * 驗證備份檔格式是否合理（避免匯入無關 JSON 造成資料毀損）
 */
function validateBackupFile(obj: unknown): obj is BackupFile {
  if (!obj || typeof obj !== 'object') return false
  const b = obj as Record<string, unknown>
  if (typeof b.version !== 'number') return false
  if (!b.data || typeof b.data !== 'object') return false
  const d = b.data as Record<string, unknown>
  // 四個欄位必須存在於物件中（值可以是 null，代表該項當初匯出時就沒有資料）
  return ['trades', 'settings', 'dividends', 'watchlist'].every(k => k in d)
}

/**
 * 匯入資料：解析 JSON 字串，驗證格式後寫回 LocalStorage
 *
 * 注意：此函數只負責寫入 LocalStorage，不會自動重新整理頁面。
 *       呼叫端（UI）應在成功後提示使用者並觸發 location.reload()，
 *       讓所有 Zustand store 重新從 LocalStorage 初始化。
 */
export function importBackup(jsonText: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: '檔案格式錯誤，無法解析 JSON，請確認是否為正確的備份檔。' }
  }

  if (!validateBackupFile(parsed)) {
    return { ok: false, error: '備份檔結構不符，請確認是否為「我的持股管家」匯出的備份檔。' }
  }

  const { data } = parsed

  // 逐一寫回，任何一項為 null 則跳過（代表原本就沒有該類資料，不覆蓋成空）
  if (data.trades !== null) {
    localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(data.trades))
  }
  if (data.settings !== null) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(data.settings))
  }
  if (data.dividends !== null) {
    localStorage.setItem(STORAGE_KEYS.dividends, JSON.stringify(data.dividends))
  }
  if (data.watchlist !== null) {
    localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(data.watchlist))
  }

  // 統計筆數供 UI 顯示匯入摘要
  const tradesCount = countArrayField(data.trades, 'trades')
  const dividendsCount = countArrayField(data.dividends, 'dividends')
  const watchlistCount = countArrayField(data.watchlist, 'watchlist')

  return {
    ok: true,
    summary: {
      trades: tradesCount,
      dividends: dividendsCount,
      watchlist: watchlistCount,
      hasSettings: data.settings !== null,
    },
  }
}

/** 從 Zustand persist 格式 { state: { trades: [...] }, version } 中取出陣列長度 */
function countArrayField(raw: unknown, field: string): number {
  if (!raw || typeof raw !== 'object') return 0
  const state = (raw as Record<string, unknown>).state
  if (!state || typeof state !== 'object') return 0
  const arr = (state as Record<string, unknown>)[field]
  return Array.isArray(arr) ? arr.length : 0
}
