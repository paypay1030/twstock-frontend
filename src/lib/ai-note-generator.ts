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
  unrealizedPnLPct?: number | null
  nearestSupport?: number | null
  nearestResist?:  number | null
  currentPrice?:   number | null
}

/** 大盤狀態（來自 today_note API 的 marketData.mood） */
export type MarketMood = 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear' | null

/** 判斷是否「接近」某個價位（距離 < 3%） */
function isNear(price: number, level: number | null | undefined): boolean {
  if (!level || price <= 0) return false
  return Math.abs(price - level) / price < 0.03
}

/** 將 marketData.mood 字串轉成型別 */
function parseMood(mood?: string | null): MarketMood {
  const map: Record<string, MarketMood> = {
    '偏強，有量的上漲': 'strong_bull',
    '偏多':             'bull',
    '偏震盪':           'neutral',
    '偏弱':             'bear',
    '偏空，需要留意':   'strong_bear',
  }
  return (mood && map[mood]) ? map[mood] : null
}

/**
 * 依持股燈號與大盤狀態產生今日首頁筆記
 * @param signals 已排序的持股燈號（red → green）
 * @param marketMoodLabel 大盤 mood label（來自 today_note API 的 marketData.mood）
 */
export function generateTodayNote(
  signals: HoldingSignal[],
  marketMoodLabel?: string | null,
): TodayNoteData {
  const holding = signals.filter(s => s.currentShares > 0)
  const mood    = parseMood(marketMoodLabel)
  const mktBull = mood === 'strong_bull' || mood === 'bull'
  const mktBear = mood === 'strong_bear' || mood === 'bear'
  const mktDesc = mktBull ? '大盤今天偏強' : mktBear ? '大盤今天偏弱' : '大盤今天偏震盪'

  // ── 無持股：維持純市場型筆記 ──────────────────────────────
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

  // ── 分析持股狀態 ──────────────────────────────────────────
  const urgent  = holding.filter(s => s.color === 'red')
  const warning = holding.filter(s => s.color === 'orange')

  // 找出「真的接近」支撐或壓力的股票（距離 < 3%）
  const nearResist = holding.filter(s =>
    s.currentPrice && isNear(s.currentPrice, s.nearestResist)
  )
  const nearSupport = holding.filter(s =>
    s.currentPrice && isNear(s.currentPrice, s.nearestSupport)
  )

  // ── 大盤 + 持股組合情境 ───────────────────────────────────
  let headline: string
  let body: string
  let confidence: TodayNoteData['confidence']
  let riskLevel: 'low' | 'mid' | 'high'
  let actions: string[]
  let ifIWere: string
  let riskNote: string

  if (urgent.length > 0) {
    // 紅燈：最高優先，大盤狀態作為補充
    const names = urgent.map(s => s.name).join('、')
    const mktNote = mktBear
      ? `，加上${mktDesc}，要特別小心`
      : mktBull
      ? `，即使${mktDesc}，也不要因此忽視`
      : ''
    headline   = `${names} 需要特別注意${mktNote}。`
    body       = `你有 ${urgent.length} 檔持股出現了比較明顯的下跌訊號（${names}）${mktNote}。這不是一定要賣，但今天要認真評估是否要動作。`
    confidence = mktBear ? 'high' : 'low'
    riskLevel  = 'high'
    actions    = [`特別留意 ${names}`, '評估是否需要停損', '其他持股可先觀察']
    ifIWere    = `如果是我，今天會先仔細看一下 ${urgent[0].name} 的走勢。\n\n如果繼續往下跌，我會考慮賣出一部分，保護資金。\n\n其他持股今天先不動，等 ${urgent[0].name} 的狀況明朗再說。`
    riskNote   = `⚠️ ${names} 出現下跌警訊，今天要認真關注`

  } else if (mktBull && nearResist.length > 0) {
    // 大盤偏強 + 個股接近壓力：最典型的「不要追高」情境
    const names = nearResist.map(s => s.name).join('、')
    headline   = `${mktDesc}，但 ${names} 接近壓力區，先觀察，不要急著追。`
    body       = `${mktDesc}，整體氣氛不錯。不過你的持股 ${names} 已經來到壓力區附近，這個位置容易有賣壓。先觀察，不要在壓力區追高。`
    confidence = 'mid'
    riskLevel  = 'mid'
    actions    = [`留意 ${names} 在壓力區的走勢`, '今天先不要追高', '等突破確認後再評估']
    ifIWere    = `如果是我，今天不會追高。\n\n${names} 接近壓力，如果出現賣壓，我可能會考慮減少一些。\n\n如果真的突破壓力，量能又放大，再考慮加碼也不遲。`
    riskNote   = `留意 ${names} 是否在壓力區出現賣壓`

  } else if (mktBear && nearSupport.length > 0) {
    // 大盤偏弱 + 個股接近支撐：觀察守不守得住
    const names = nearSupport.map(s => s.name).join('、')
    headline   = `${mktDesc}，${names} 接近支撐，先觀察支撐有沒有守住。`
    body       = `${mktDesc}，整體氣氛偏保守。你的持股 ${names} 已接近支撐位，這個位置是關鍵。如果支撐守住，可以繼續持有；如果跌破，要留意是否需要停損。`
    confidence = 'mid'
    riskLevel  = 'mid'
    actions    = [`觀察 ${names} 的支撐是否守住`, '今天不要追買', '留意是否跌破支撐']
    ifIWere    = `如果是我，今天會特別觀察 ${names} 的走勢。\n\n如果支撐守住，可以繼續持有。\n\n如果跌破支撐，我會認真考慮停損或減碼。`
    riskNote   = `留意 ${names} 支撐是否守住`

  } else if (warning.length > 0) {
    // 橘燈：接近壓力，不管大盤
    const names = warning.map(s => s.name).join('、')
    const mktSuffix = mktBull ? '，即使大盤偏強，壓力區仍需小心' : mktBear ? '，大盤偏弱更要謹慎' : ''
    headline   = `${names} 接近壓力區，今天可以先觀察，不用急著追${mktSuffix}。`
    body       = `你有 ${warning.length} 檔持股（${names}）來到了壓力區附近，上漲空間暫時縮小${mktSuffix}。今天不建議追高，可以耐心等待後再決定。`
    confidence = 'mid'
    riskLevel  = 'mid'
    actions    = [`留意 ${names} 的走勢`, '今天不用追高', '其他持股可繼續持有']
    ifIWere    = `如果是我，今天不會追高。\n\n如果 ${warning[0].name} 在壓力區出現賣壓，我可能會考慮減少一些持股。\n\n如果後來回落到支撐區，再評估要不要加碼。`
    riskNote   = `留意 ${warning.map(s => s.name).join('、')} 是否出現賣壓`

  } else {
    // 沒有明顯風險：依大盤給通用建議
    if (mktBull) {
      headline   = '今天持股都還好，大盤偏強，可以繼續觀察。'
      body       = `${mktDesc}，你的 ${holding.length} 檔持股目前都在相對安全的位置。可以放心持有，但不要追高，等更明確的訊號再加碼。`
      confidence = 'high'
      riskLevel  = 'low'
      actions    = ['目前持股可繼續持有', '不要在高點追買', '等待更明確訊號']
      ifIWere    = `如果是我，今天不會急著追高。\n\n持股都在安全位置，先觀察市場怎麼走，有機會再加碼。`
      riskNote   = ''
    } else if (mktBear) {
      headline   = '大盤今天偏弱，持股暫時沒有明顯問題，先觀察。'
      body       = `${mktDesc}，不過你的 ${holding.length} 檔持股目前都還在相對安全的位置，沒有緊急需要處理的狀況。今天先觀察，不要追買。`
      confidence = 'mid'
      riskLevel  = 'mid'
      actions    = ['今天先觀察，不追買', '目前持股可繼續持有', '留意大盤是否繼續走弱']
      ifIWere    = `如果是我，今天不會主動操作。\n\n大盤偏弱時先保守一點，等趨勢明確再說。`
      riskNote   = '留意大盤是否繼續走弱'
    } else {
      headline   = '今天持股都還好，不用急著做任何動作。'
      body       = `你的 ${holding.length} 檔持股目前都在相對安全的位置，沒有緊急需要處理的狀況。可以放心持有，等待更明確的訊號再做決定。`
      confidence = 'high'
      riskLevel  = 'low'
      actions    = ['今天可以放心觀察', '持股維持現況即可', '等待更明確訊號']
      ifIWere    = `如果是我，今天不會做任何動作。\n\n持股都在安全位置，耐心等待就好。\n\n如果有額外資金，可以開始研究下一個想買的股票。`
      riskNote   = ''
    }
  }

  // ── 原因列表（前三個最需要注意的持股）────────────────────
  const top3 = holding.slice(0, 3)
  const reasons = top3.map(s => {
    if (s.color === 'red')    return `${s.name} 出現下跌訊號，需要評估`
    if (s.color === 'orange') return `${s.name} 接近壓力區，先觀望`
    if (s.currentPrice && isNear(s.currentPrice, s.nearestResist))
      return `${s.name} 接近壓力位，留意賣壓`
    if (s.currentPrice && isNear(s.currentPrice, s.nearestSupport))
      return `${s.name} 接近支撐位，觀察是否守住`
    if (s.color === 'green')  return `${s.name} 在相對便宜位置，可留意`
    return `${s.name} 目前整理中，可繼續持有`
  })

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
