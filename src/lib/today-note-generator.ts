/**
 * 今日筆記生成器
 *
 * 依使用者持股的燈號分佈，產生個人化的「今天的小筆記」。
 * 這是本機計算邏輯（不呼叫外部 AI API），基於已取得的技術分析燈號。
 * 未來若有 AI 晨報 API，可直接呼叫 setTodayNote() 覆蓋此結果。
 *
 * 設計原則：
 *   - 結論先行：第一句直接告訴使用者今天該怎麼做
 *   - 無持股時顯示市場中性觀察
 *   - 語氣陪伴式，不是報告式
 */

import type { TodayNoteData } from '@/components/nb/TodayNoteCard'
import type { SignalColor } from '@/types'

export interface HoldingSignal {
  code: string
  name: string
  color: SignalColor
}

/**
 * 依持股燈號分佈產生今日筆記
 */
export function generateTodayNote(signals: HoldingSignal[]): TodayNoteData {
  if (signals.length === 0) {
    return generateNoHoldingNote()
  }

  const reds    = signals.filter(s => s.color === 'red')
  const oranges = signals.filter(s => s.color === 'orange')
  const greens  = signals.filter(s => s.color === 'green')
  const yellows = signals.filter(s => s.color === 'yellow')

  // 依最嚴重情況決定今日基調
  if (reds.length > 0) {
    return generateRedNote(reds, oranges, signals.length)
  }
  if (oranges.length > 0) {
    return generateOrangeNote(oranges, greens, signals.length)
  }
  if (greens.length > 0) {
    return generateGreenNote(greens, yellows, signals.length)
  }
  return generateYellowNote(signals.length)
}

// ── 有持股跌破支撐（紅燈） ────────────────────────────────────
function generateRedNote(
  reds: HoldingSignal[],
  oranges: HoldingSignal[],
  total: number,
): TodayNoteData {
  const redNames = reds.map(s => s.name).join('、')
  const multi    = reds.length > 1

  return {
    headline: `${redNames}${multi ? '等' : ''}需要特別注意。\n今天先評估是否要調整策略。`,
    body: `你有 ${reds.length} 檔持股${multi ? '' : `（${redNames}）`}出現了風險訊號，跌破了重要的支撐位置。這種情況下，繼續下跌的機率比較高，今天要認真思考是否需要採取行動。`,
    reasons: [
      `${redNames} 跌破重要支撐，風險升高`,
      '跌破支撐後繼續下跌機率偏高',
      ...(oranges.length > 0 ? [`另有 ${oranges.length} 檔接近壓力區，整體需留意`] : []),
    ],
    ifIWere: `如果是我，今天會先認真評估 ${redNames} 的處置方式。\n\n如果跌破停損位，要有勇氣執行停損，不要讓虧損繼續擴大。\n\n其他持股繼續觀察就好，不用急著動作。`,
    actions: [
      `確認 ${redNames} 的停損位`,
      '今天先不追加任何新持股',
      '設定好停損後，就放下心理壓力',
    ],
    riskLevel:  'high',
    riskNote:   `今天最重要的事是保護資金，而不是賺錢。`,
    confidence: 'low',
  }
}

// ── 有持股接近壓力（橘燈）────────────────────────────────────
function generateOrangeNote(
  oranges: HoldingSignal[],
  greens: HoldingSignal[],
  total: number,
): TodayNoteData {
  const orangeNames = oranges.map(s => s.name).join('、')
  const multi       = oranges.length > 1

  return {
    headline: `${orangeNames}${multi ? '' : ''}接近壓力區。\n今天先觀察，不用急著追價。`,
    body: `你有 ${oranges.length} 檔持股${multi ? '' : `（${orangeNames}）`}股價接近了壓力區，這個位置賣壓比較重，上漲空間相對縮小。今天適合「觀察等待」，不適合追高。`,
    reasons: [
      `${orangeNames} 接近壓力區，賣壓可能增加`,
      '接近壓力時追高風險偏高',
      ...(greens.length > 0 ? [`${greens.map(s => s.name).join('、')} 位置不錯，可繼續持有`] : []),
    ],
    ifIWere: `如果是我，今天會觀察 ${orangeNames} 能否突破壓力區。\n\n如果突破且成交量放大，可以繼續持有。\n如果出現明顯賣壓，可以考慮減少一部分持股，降低風險。`,
    actions: [
      `留意 ${orangeNames} 的量能變化`,
      '今天不追高，等待方向明朗',
      ...(greens.length > 0 ? ['可以考慮布局近支撐的持股'] : ['繼續觀察整體方向']),
    ],
    riskLevel:  'mid',
    riskNote:   '',
    confidence: 'mid',
  }
}

// ── 有持股接近支撐（綠燈）────────────────────────────────────
function generateGreenNote(
  greens: HoldingSignal[],
  yellows: HoldingSignal[],
  total: number,
): TodayNoteData {
  const greenNames = greens.map(s => s.name).join('、')
  const multi      = greens.length > 1

  return {
    headline: `${greenNames}${multi ? '' : ''}來到相對便宜的位置。\n今天是值得留意的機會。`,
    body: `你有 ${greens.length} 檔持股${multi ? '' : `（${greenNames}）`}股價接近了支撐區，歷史上在這個價位附近，買進的人比賣出的人多，是相對安全的位置。`,
    reasons: [
      `${greenNames} 接近支撐區，風險報酬比偏佳`,
      '支撐區是歷史上容易止跌反彈的位置',
      ...(yellows.length > 0 ? [`其他 ${yellows.length} 檔在觀察區間，繼續持有`] : []),
    ],
    ifIWere: `如果是我，今天會考慮在 ${greenNames} 的支撐區附近分批布局。\n\n記得不要一次全押，留一部分資金等待更好的機會。\n\n如果跌破支撐，要有紀律地停損。`,
    actions: [
      `可以考慮在 ${greenNames} 支撐區分批布局`,
      '分 2-3 次買進，降低風險',
      '設定好停損位再進場',
    ],
    riskLevel:  'low',
    riskNote:   '',
    confidence: 'mid',
  }
}

// ── 所有持股都在觀察區（黃燈）────────────────────────────────
function generateYellowNote(total: number): TodayNoteData {
  return {
    headline: '今天持股都還在觀察區間。\n耐心等待，不用急著動作。',
    body: `你的 ${total} 檔持股目前都沒有特別的買進或賣出訊號，股價在支撐與壓力之間整理。這種情況下，耐心等待比主動操作更重要。`,
    reasons: [
      '持股均處於區間整理，無明顯訊號',
      '現在追高或殺低都不是好時機',
      '等待明確方向再決定，勝率更高',
    ],
    ifIWere: '如果是我，今天不會做任何操作。\n\n繼續持有現有部位，等待更清楚的方向訊號出現。\n\n耐心是這種市場環境下最好的策略。',
    actions: [
      '繼續持有，不追高也不殺低',
      '等待明確突破或回測訊號',
      '今天最好的操作是不操作',
    ],
    riskLevel:  'low',
    riskNote:   '',
    confidence: 'mid',
  }
}

// ── 尚無持股 ──────────────────────────────────────────────────
function generateNoHoldingNote(): TodayNoteData {
  return {
    headline: '今天先觀察市場，\n不用急著進場。',
    body: '目前還沒有持股，今天是觀察市場、累積判斷的好時機。先選好幾支想研究的股票，追蹤一段時間，等到熟悉之後再考慮進場。',
    reasons: [
      '沒有持股，今天沒有需要緊急處理的事情',
      '先觀察比衝動進場更安全',
      '可以先到分析頁研究幾支有興趣的股票',
    ],
    ifIWere: '如果是我，今天會先到分析頁，搜尋幾支有興趣的股票，看看燈號和支撐壓力在哪裡。\n\n不用急著買，先建立自己的觀察名單。',
    actions: [
      '到分析頁搜尋有興趣的股票',
      '把想追蹤的股票加入自選股',
      '等到熟悉再考慮進場',
    ],
    riskLevel:  'low',
    riskNote:   '',
    confidence: 'mid',
  }
}
