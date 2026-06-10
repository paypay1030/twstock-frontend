/**
 * 超白話模式：技術術語 → 日常語言
 * 
 * 設計原則：
 *   - 用「我」的語氣，像朋友在解說
 *   - 不用任何技術術語
 *   - 保留警示精神，但不造成恐慌
 *   - 技術模式可隨時切換回來
 */

import type { SignalColor } from '@/types'

// ── 燈號 ──────────────────────────────────────────────────────
export const SIGNAL_PLAIN: Record<SignalColor, {
  emoji: string
  label: string         // 白話短標
  badge: string         // pill 內文字
  headDesc: string      // 股票標頭一句說明
  sigCls: string        // CSS class
  techLabel: string     // 技術模式文字
}> = {
  green: {
    emoji: '🟢',
    label: '現在看起來便宜',
    badge: '可留意布局',
    headDesc: '目前股價接近歷史低點，想買的人可以開始注意了。',
    sigCls: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    techLabel: '綠燈｜接近支撐區',
  },
  yellow: {
    emoji: '🟡',
    label: '中間地帶，繼續觀察',
    badge: '觀察等待',
    headDesc: '目前沒有明顯的買進或賣出訊號，先觀察就好，不用急著動作。',
    sigCls: 'border-amber-300 bg-amber-50 text-amber-700',
    techLabel: '黃燈｜區間整理',
  },
  orange: {
    emoji: '🟠',
    label: '快到高點了',
    badge: '可考慮賣一部分',
    headDesc: '股價接近歷史賣點區，獲利的人開始想賣了，要留意。',
    sigCls: 'border-orange-300 bg-orange-50 text-orange-700',
    techLabel: '橘燈｜接近壓力區',
  },
  red: {
    emoji: '🔴',
    label: '要注意，風險升高',
    badge: '注意風險',
    headDesc: '股價跌破了重要位置，風險升高，請評估是否需要賣出。',
    sigCls: 'border-red-300 bg-red-50 text-red-700',
    techLabel: '紅燈｜跌破支撐',
  },
}

// ── 一句話決策 ────────────────────────────────────────────────
export function generateOneLiner(
  color: SignalColor,
  hasHolding: boolean,
  stockName: string,
  price: number,
  nearestSupport: number | null,
  nearestResist: number | null,
): { action: string; reason: string; techHint: string } {
  const sup = nearestSupport
  const res = nearestResist

  if (color === 'red') {
    return {
      action: hasHolding ? '考慮賣出，保護資金' : '先不要買',
      reason: `${stockName}跌破了重要的低點位置，繼續跌的機率提高。如果有買進，請認真評估是否要賣出。`,
      techHint: '技術說法：紅燈 · 跌破支撐 · 風險升高',
    }
  }
  if (color === 'orange') {
    return {
      action: hasHolding ? '可以先賣掉一部分' : '現在偏貴，先不追',
      reason: `${stockName}股價${res ? `已接近 ${res} 元的歷史高點` : '接近歷史賣點區'}，上漲空間變小。${hasHolding ? '可以先賣一部分，鎖定獲利。' : '現在買進風險比較大。'}`,
      techHint: '技術說法：橘燈 · 接近壓力區 · 考慮減碼',
    }
  }
  if (color === 'green') {
    return {
      action: hasHolding ? '可以考慮再買一點' : '可以考慮少量買進',
      reason: `${stockName}股價${sup ? `接近 ${sup} 元的歷史低點` : '來到相對便宜的位置'}，這個價位風險比較小。建議分批買進，不要一次全押。`,
      techHint: '技術說法：綠燈 · 接近支撐區 · 可考慮布局',
    }
  }
  // yellow
  if (hasHolding) {
    return {
      action: '繼續持有，不用動',
      reason: `${stockName}股價在高低點中間，還不到要賣或再買的時機。耐心等候更好的機會。`,
      techHint: '技術說法：黃燈 · 區間整理 · 續抱',
    }
  }
  return {
    action: '先觀察，再等等',
    reason: `${stockName}現在不算特別便宜也不算貴，不是最好的買進時機。等股價跌到便宜區再考慮。`,
    techHint: '技術說法：黃燈 · 區間整理 · 觀察等待',
  }
}

// ── 買賣區間 ──────────────────────────────────────────────────
export const ZONE_PLAIN = {
  buy: {
    label:    '📉 便宜買點區間',
    desc:     '跌到這個範圍，買進比較安全',
    techLabel: '建議買進區',
    techDesc:  '接近支撐，風險報酬較佳',
  },
  sell: {
    label:    '📈 賣出高點區間',
    desc:     '漲到這個範圍，可以考慮賣一部分',
    techLabel: '建議賣出區',
    techDesc:  '接近壓力，考慮分批減碼',
  },
  stopLoss: {
    label:    '🚨 跌到這要認真考慮賣出',
    desc:     '跌破這個價，建議評估是否停損',
    techLabel: '停損警戒區',
    techDesc:  '跌入此區請評估出場',
  },
}

// ── 支撐壓力 ──────────────────────────────────────────────────
export const SR_PLAIN = {
  support: {
    label: (rank: number, isStrong: boolean) =>
      rank === 1
        ? (isStrong ? '強力地板價 🛡️' : '地板價 📍')
        : (isStrong ? '第二道強地板 🛡️' : '第二道地板 📍'),
    desc:      '歷史上跌到這附近常常反彈的價位',
    techLabel: (s: string) => s,
  },
  resistance: {
    label: (rank: number, isStrong: boolean) =>
      rank === 1
        ? (isStrong ? '強力天花板 🔝' : '天花板價 📌')
        : (isStrong ? '第二道強天花板 🔝' : '第二道天花板 📌'),
    desc:      '歷史上漲到這附近常常遇到賣壓的價位',
    techLabel: (s: string) => s,
  },
  stopLoss: {
    label:     '🚨 超過這個價就建議賣掉',
    desc:      '跌到這裡損失可能繼續擴大',
    techLabel: '建議停損',
    techDesc:  '',
  },
}

// ── 風險等級 ──────────────────────────────────────────────────
export const RISK_PLAIN = {
  low:    { label: '目前風險不大 🟢',   desc: '股價離低點不遠，持股相對安心',   techLabel: '低風險', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  medium: { label: '風險適中 🟡',       desc: '股價在中間位置，維持正常注意',   techLabel: '中風險', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100' },
  high:   { label: '風險偏高，注意 🔴', desc: '股價位置偏高或偏低，需要謹慎',   techLabel: '高風險', color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
}

// ── 觸發條件 ──────────────────────────────────────────────────
export function plainifyTrigger(condition: string, action: string) {
  const map: Record<string, string> = {
    '觀察，注意支撐是否守住': '要留意，可能繼續跌',
    '接近壓力，考慮減碼':     '可以考慮賣掉一部分',
    '考慮大幅減碼或出場':     '考慮大部分出場',
    '停損警示，請評估出場':   '⚠️ 建議賣出，停止虧損',
  }
  return { plainCondition: condition, plainAction: map[action] ?? action }
}

// ── AI 翻譯段落 ───────────────────────────────────────────────
export function generateAISections(
  color: SignalColor,
  riskLevel: 'low' | 'medium' | 'high',
  stockName: string,
  price: number,
  nearestSupport: number | null,
  nearestResist: number | null,
  stopLoss: number,
  hasHolding: boolean,
  avgCost?: number | null,
) {
  const riskText = { low: '不大', medium: '中等', high: '偏高' }[riskLevel]

  const situation = color === 'green'
    ? `${stockName}的股價現在來到了相對便宜的位置${nearestSupport ? `（${nearestSupport} 元附近）` : ''}，歷史上在這個價位附近，買進的人比賣出的人多，股價比較容易止跌反彈。`
    : color === 'orange'
    ? `${stockName}的股價正在接近歷史上大家常常選擇賣出的位置${nearestResist ? `（${nearestResist} 元附近）` : ''}。這個區域賣壓比較重，股價繼續上漲的空間變小了。`
    : color === 'red'
    ? `${stockName}的股價跌破了一個重要的低點位置，這是一個警訊。歷史上跌破這個位置之後，繼續下跌的機率比較高。`
    : `${stockName}的股價目前在高點和低點的中間，沒有特別偏高或偏低。這種情況下，市場在「等待方向」，通常需要一段時間觀察才會有比較明顯的訊號。`

  const riskExplain = riskLevel === 'low'
    ? `目前風險${riskText}。股價距離歷史低點不遠，就算繼續跌，空間也相對有限。這個位置持股比較安心。`
    : riskLevel === 'high'
    ? `目前風險${riskText}，需要特別注意。${hasHolding && avgCost && price < avgCost ? `你的持股目前處於虧損狀態（成本 ${avgCost}，現價 ${price}），要考慮是否要執行停損。` : '現在進場的風險比較高，建議等待更好的時機。'}`
    : `目前風險${riskText}，不用太擔心，但也不能完全放鬆。維持正常的關注就好。`

  const whatToDo = color === 'red'
    ? `${hasHolding ? `你已經有持股，現在最重要的是保護資金。如果跌破 ${stopLoss} 元，請認真考慮賣出，避免虧損繼續擴大。` : `現在不建議買進，等待股價止跌穩定之後再考慮。`}`
    : color === 'orange'
    ? `${hasHolding ? `你已經有持股，可以考慮在 ${nearestResist ?? '目前位置'} 附近賣出一部分，鎖定部分獲利。剩下的可以繼續持有，等待下一個訊號。` : `現在不是好的買進時機，先觀察就好。如果後來股價跌回到便宜區${nearestSupport ? `（${nearestSupport} 附近）` : ''}，再考慮買進。`}`
    : color === 'green'
    ? `${hasHolding ? `你已經有持股，現在是可以考慮「加碼」的時機${nearestSupport ? `，在 ${nearestSupport} 附近可以再買一點` : ''}。記得分批買進，不要一次全押。` : `現在是相對好的買進時機${nearestSupport ? `，在 ${nearestSupport} 附近考慮買進` : ''}。建議分 2-3 次買進，降低風險。`}`
    : `${hasHolding ? '繼續持有就好，不用急著做任何動作。' : '先觀察就好，等到股價跌到便宜區再考慮買進，不要追高。'}`

  const watchOut = `如果股價跌破 ${stopLoss} 元，那就要認真考慮賣出了。這個價位跌破之後，繼續跌的風險很高，屆時損失可能繼續擴大。`

  return { situation, riskExplain, whatToDo, watchOut }
}

// ── 解套追蹤白話文字 ─────────────────────────────────────────
export function generateUnstuckText(
  avgCost: number,
  currentPrice: number,
  currentShares: number,
  distancePct: number,
) {
  const isProfit = currentPrice >= avgCost
  const diffAmt  = Math.abs(Math.round((avgCost - currentPrice) * currentShares))
  const diffPct  = Math.abs(distancePct).toFixed(1)

  if (isProfit) {
    const gainAmt = Math.round((currentPrice - avgCost) * currentShares)
    return {
      summary: `恭喜！你的持股目前已經獲利 ${gainAmt.toLocaleString()} 元，現價高於你的買進成本。`,
      ringLabel: '已超過成本 ✓',
      isProfit: true,
    }
  }
  if (parseFloat(diffPct) < 3) {
    return {
      summary: `現在只差一點點就回本了！還差 ${diffPct}%（約 ${diffAmt.toLocaleString()} 元），加油。`,
      ringLabel: `差 ${diffPct}% 回本`,
      isProfit: false,
    }
  }
  if (parseFloat(diffPct) < 10) {
    return {
      summary: `目前虧損 ${diffPct}%，還需漲 ${diffPct}% 才能回到買進成本。不用太擔心，繼續觀察。`,
      ringLabel: `還差 ${diffPct}%`,
      isProfit: false,
    }
  }
  return {
    summary: `目前虧損幅度較大（${diffPct}%），建議認真評估是否需要停損或調整策略，避免損失繼續擴大。`,
    ringLabel: `還差 ${diffPct}%`,
    isProfit: false,
  }
}
