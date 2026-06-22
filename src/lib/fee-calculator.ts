/**
 * 手續費／證交稅計算引擎
 *
 * 固定參數（不開放 UI 調整，預設依中信證券折扣設定）：
 *   手續費率：1.425‰
 *   手續費折扣：6 折
 *   股票證交稅：3‰（千分之三）
 *   ETF 證交稅：1‰（千分之一）
 *
 * 設計原則：純函數，無副作用，方便單元測試與在多處重複使用
 *（賣多少頁面試算 / 持股管理頁帳面vs實際 / 交易紀錄頁統計 / 首頁真正總報酬）
 */
import type {
  InstrumentType, TradeFeeBreakdown, TrimFeeDetail,
  RealProfitResult, TotalReturnResult,
} from '@/types'

// ── 固定參數 ─────────────────────────────────────────────────
export const FEE_RATE       = 0.001425  // 1.425‰
export const FEE_DISCOUNT   = 0.6       // 6 折
export const STOCK_TAX_RATE = 0.003     // 股票證交稅 3‰
export const ETF_TAX_RATE   = 0.001     // ETF 證交稅 1‰
export const MIN_FEE        = 1         // 台股手續費最低 1 元（多數券商規則，未滿則收 1 元）

/** 依商品類型取得證交稅率 */
export function getTaxRate(instrumentType: InstrumentType = 'stock'): number {
  return instrumentType === 'etf' ? ETF_TAX_RATE : STOCK_TAX_RATE
}

/** 計算手續費（已套用折扣，最低 1 元） */
export function calcFee(amount: number): number {
  if (amount <= 0) return 0
  const fee = amount * FEE_RATE * FEE_DISCOUNT
  return Math.max(Math.round(fee), MIN_FEE)
}

/** 計算證交稅（僅賣出收取） */
export function calcTax(amount: number, instrumentType: InstrumentType = 'stock'): number {
  if (amount <= 0) return 0
  return Math.round(amount * getTaxRate(instrumentType))
}

/**
 * 計算單筆交易的完整費稅明細
 *
 * 買進：netAmount = grossAmount + fee（手續費由買方額外支付，不收證交稅）
 * 賣出：netAmount = grossAmount - fee - tax（手續費與證交稅都從賣出所得中扣除）
 */
export function calcTradeFee(
  price: number,
  shares: number,
  side: 'buy' | 'sell',
  instrumentType: InstrumentType = 'stock'
): TradeFeeBreakdown {
  const grossAmount = Math.round(price * shares)
  const fee = calcFee(grossAmount)

  if (side === 'buy') {
    return {
      grossAmount,
      fee,
      tax: 0,
      netAmount: grossAmount + fee,
    }
  }

  // 賣出
  const tax = calcTax(grossAmount, instrumentType)
  return {
    grossAmount,
    fee,
    tax,
    netAmount: grossAmount - fee - tax,
  }
}

/**
 * 計算「若以此股數、此價格賣出」的實際回收金額與獲利
 * （供減碼試算 TrimCalculator 使用）
 *
 * @param sellPrice       預計賣出價格
 * @param sellShares      預計賣出股數
 * @param avgCost         加權平均成本（每股，已含買進手續費攤銷）
 * @param instrumentType  股票或 ETF（決定證交稅率）
 */
export function calcSellProfit(
  sellPrice: number,
  sellShares: number,
  avgCost: number,
  instrumentType: InstrumentType = 'stock'
): TrimFeeDetail {
  const breakdown = calcTradeFee(sellPrice, sellShares, 'sell', instrumentType)
  const buyCostBasis = Math.round(avgCost * sellShares)

  return {
    grossAmount: breakdown.grossAmount,
    buyCostBasis,
    fee: breakdown.fee,
    tax: breakdown.tax,
    netRecover: breakdown.netAmount,
    realProfit: breakdown.netAmount - buyCostBasis,
  }
}

/**
 * 計算單一持股的「帳面 vs 實際」損益（供持股管理頁帳面/實際切換顯示）
 *
 * 帳面：currentValue - avgCost×shares（不計任何費稅，沿用既有 HoldingStats 邏輯）
 * 實際：若現在以現價全部賣出，扣除預估手續費與證交稅後的真實損益
 *
 * @param avgCost          加權平均成本（已含買進手續費攤銷，來自 calcHoldingStats）
 * @param currentShares    目前持股股數
 * @param currentPrice     現價
 * @param instrumentType   股票或 ETF
 */
export function calcRealProfit(
  avgCost: number,
  currentShares: number,
  currentPrice: number,
  instrumentType: InstrumentType = 'stock'
): RealProfitResult {
  const bookCost  = Math.round(avgCost * currentShares)
  const bookValue = Math.round(currentPrice * currentShares)
  const bookPnL   = bookValue - bookCost
  const bookPnLPct = bookCost > 0 ? Math.round((bookPnL / bookCost) * 10000) / 100 : 0

  // 預估若現在全部賣出的費稅
  const sellGross  = currentPrice * currentShares
  const estSellFee = calcFee(sellGross)
  const estSellTax = calcTax(sellGross, instrumentType)

  const realCost = bookCost   // avgCost 已含買進手續費，realCost 與 bookCost 同基礎
  const realPnL  = bookValue - estSellFee - estSellTax - realCost
  const realPnLPct = realCost > 0 ? Math.round((realPnL / realCost) * 10000) / 100 : 0

  return {
    code: '',
    bookCost, bookValue, bookPnL, bookPnLPct,
    realCost, estSellFee, estSellTax, realPnL, realPnLPct,
  }
}

/**
 * 真正總報酬 = 已實現損益（實際）+ 未實現損益（帳面）+ 股息收入
 *
 * 已實現損益使用實際獲利（calcHoldingStats 的 realizedPnL 已扣費稅）
 * 未實現損益使用帳面（現價 - 含手續費成本，尚未產生的賣出費稅不預先扣除）
 */
export function calcTotalReturn(
  realizedPnL: number,      // 來自 calcHoldingStats，已是實際獲利
  unrealizedPnL: number,    // 來自 calcHoldingStats，帳面（已含買進手續費成本）
  dividendIncome: number
): TotalReturnResult {
  return {
    realizedPnL,
    unrealizedPnL,
    dividendIncome,
    totalReturn: realizedPnL + unrealizedPnL + dividendIncome,
  }
}
