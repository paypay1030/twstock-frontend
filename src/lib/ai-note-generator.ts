/**
 * AI 筆記產生器
 *
 * 根據持股資料與燈號，產生 TodayNoteData 供首頁 TodayNoteCard 顯示。
 * 設計原則：
 *   - 結論先行：最需要注意的股票決定今天整體語氣
 *   - 白話優先：動作建議要讓不懂技術分析的人也看得懂
 *   - 未來可替換：此函數可直接被 AI API 的回傳結果覆蓋
 */
import type { TodayNoteData } from '@/components/nb/TodayNoteCard'
import type { SignalColor } from '@/types'

export interface HoldingSignal {
  code: string
  name: string
  color: SignalColor
  action: string
  currentShares: number
  unrealizedPnLPct?: number | null  // 用於決定緊急程度
}

/**
 * 依持股燈號產生今日首頁筆記
 * @param signals 已排序的持股燈號（red → orange → yellow → green）
 */
export function generateTodayNote(signals: HoldingSignal[]): TodayNoteData {
  const holding = signals.filter(s => s.currentShares > 0)

  if (holding.length === 0) {
    return {
      headline:   '今天沒有持股需要注意。\n可以看看有沒有想研究的股票。',
      body:       '目前沒有任何持股，市場的變動對你影響不大。趁這個機會研究一下你有興趣的股票，等好機會再出手。',
      reasons:    ['目前沒有任何持股', '市場波動影響有限', '可觀察潛在買點'],
      ifIWere:    '如果我是你，今天會先把想買的股票加入自選股，設好目標價，等待機會再行動。',
      actions:    ['今天不用急著操作', '可以研究自選股', '觀察市場方向'],
      riskLevel:  'low',
      riskNote:   '',
      confidence: 'high',
    }
  }

  const urgent   = holding.filter(s => s.color === 'red')
  const warning  = holding.filter(s => s.color === 'orange')
  const stable   = holding.filter(s => s.color === 'yellow' || s.color === 'green')

  // 根據最嚴重的燈號決定今天基調
  const hasCritical = urgent.length > 0
  const hasWarning  = warning.length > 0

  // ── 今日標題（最重要的一句話）──────────────────────────────
  let headline: string
  let body: string
  let confidence: TodayNoteData['confidence']
  let riskLevel: 'low' | 'mid' | 'high'
  let actions: string[]

  if (hasCritical) {
    const names = urgent.map(s => s.name).join('、')
    headline   = `${names}需要特別注意，\n今天要認真評估是否要動作。`
    body       = `你有 ${urgent.length} 檔持股出現了比較明顯的下跌訊號（${names}）。這不是一定要賣，但今天要認真看一下，評估是否要做出決定。`
    confidence = 'low'
    riskLevel  = 'high'
    actions    = [
      `特別留意 ${names}`,
      '評估是否需要停損',
      '其他持股可先觀察',
    ]
  } else if (hasWarning) {
    const names = warning.map(s => s.name).join('、')
    headline   = `${names}接近壓力區，\n今天可以先觀察，不用急著追。`
    body       = `你有 ${warning.length} 檔持股（${names}）來到了壓力區附近，上漲空間暫時縮小。今天不建議追高，可以耐心等待後再決定。`
    confidence = 'mid'
    riskLevel  = 'mid'
    actions    = [
      `留意 ${names} 的走勢`,
      '今天不用追高',
      '其他持股可繼續持有',
    ]
  } else {
    headline   = '今天持股都還好，\n不用急著做任何動作。'
    body       = `你的 ${holding.length} 檔持股目前都在相對安全的位置，沒有緊急需要處理的狀況。可以放心持有，等待更明確的訊號再做決定。`
    confidence = 'high'
    riskLevel  = 'low'
    actions    = [
      '今天可以放心觀察',
      '持股維持現況即可',
      '等待更明確訊號',
    ]
  }

  // ── 原因（列出前三個最需要注意的持股）──────────────────────
  const top3 = holding.slice(0, 3)
  const reasons = top3.map(s => {
    if (s.color === 'red')    return `${s.name}出現下跌訊號，需要評估`
    if (s.color === 'orange') return `${s.name}接近壓力區，先觀望`
    if (s.color === 'green')  return `${s.name}在相對便宜位置，可留意加碼`
    return `${s.name}目前整理中，可繼續持有`
  })

  // ── 如果是我（具體行動建議）────────────────────────────────
  let ifIWere: string
  if (hasCritical) {
    const name = urgent[0].name
    ifIWere = `如果是我，今天會先仔細看一下 ${name} 的走勢。\n\n如果繼續往下跌，我會考慮賣出一部分，保護資金。\n\n其他持股今天先不動，等 ${name} 的狀況明朗再說。`
  } else if (hasWarning) {
    const name = warning[0].name
    ifIWere = `如果是我，今天不會追高。\n\n如果 ${name} 在壓力區出現賣壓，我可能會考慮減少一些持股。\n\n如果後來回落到支撐區，再評估要不要加碼。`
  } else {
    ifIWere = `如果是我，今天不會做任何動作。\n\n持股都在安全位置，耐心等待就好。\n\n如果有額外資金，可以開始研究下一個想買的股票。`
  }

  // ── 風險提醒 ────────────────────────────────────────────────
  const riskNote = hasCritical
    ? `⚠️ ${urgent.map(s => s.name).join('、')} 出現下跌警訊，今天要認真關注`
    : hasWarning
    ? `留意 ${warning.map(s => s.name).join('、')} 是否出現賣壓`
    : ''

  return {
    headline,
    body,
    reasons,
    ifIWere,
    actions,
    riskLevel,
    riskNote,
    confidence,
  }
}

/**
 * 依 risk.level 與 signal.color 計算 AI 信心程度
 */
export function calcConfidenceLevel(
  signalColor: SignalColor,
  riskLevel: 'low' | 'mid' | 'high',
): TodayNoteData['confidence'] {
  // 訊號明確（紅/綠）+ 風險評估確定 → 高把握
  if ((signalColor === 'red' || signalColor === 'green') && riskLevel !== 'mid') {
    return 'high'
  }
  // 橘燈（接近壓力）或中等風險 → 普通把握
  if (signalColor === 'orange' || riskLevel === 'mid') {
    return 'mid'
  }
  // 黃燈（整理）→ 變數較大
  if (signalColor === 'yellow') {
    return 'low'
  }
  return 'mid'
}
