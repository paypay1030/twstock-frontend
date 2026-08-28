'use client'

import { useEffect, useRef } from 'react'
import type { KLine, SRLevel } from '@/types'

interface StockChartProps {
  klines: KLine[]
  supportLevels: SRLevel[]
  resistanceLevels: SRLevel[]
  stopLoss: number
  height?: number
}

export default function StockChart({
  klines,
  supportLevels,
  resistanceLevels,
  stopLoss,
  height = 280,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || klines.length === 0) return

    let chart: any = null

    const init = async () => {
      const { createChart, ColorType, CrosshairMode, LineStyle } = await import('lightweight-charts')

      chart = createChart(containerRef.current!, {
        width:  containerRef.current!.clientWidth,
        height: height,
        layout: {
          background: { type: ColorType.Solid, color: '#FAFAF9' },
          textColor: '#78716C',
          fontSize: 11,
          fontFamily: "'Noto Sans TC', sans-serif",
        },
        grid: {
          vertLines: { color: '#F5F5F4', style: LineStyle.Solid },
          horzLines: { color: '#F5F5F4', style: LineStyle.Solid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: '#E7E5E4',
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: '#E7E5E4',
          timeVisible: true,
          secondsVisible: false,
        },
      })

      // K 線主圖
      const candleSeries = chart.addCandlestickSeries({
        upColor:          '#DC2626',  // 台股：漲紅
        downColor:        '#16A34A',  // 台股：跌綠
        borderUpColor:    '#DC2626',
        borderDownColor:  '#16A34A',
        wickUpColor:      '#DC2626',
        wickDownColor:    '#16A34A',
      })

      // 過濾掉 OHLC 任一欄位為 null 的 K 線（ETF 部分歷史資料可能不完整）
      const validKlines = klines.filter(
        k => k.open !== null && k.high !== null && k.low !== null && k.close !== null
      )

      const candleData = validKlines.map(k => ({
        time:  k.date as any,
        open:  k.open  as number,
        high:  k.high  as number,
        low:   k.low   as number,
        close: k.close as number,
      }))
      candleSeries.setData(candleData)

      // 均線
      const maConfigs = [
        { key: 'ma20',  color: '#F59E0B', title: 'MA20',  width: 1 },
        { key: 'ma60',  color: '#3B82F6', title: 'MA60',  width: 1.5 },
        { key: 'ma240', color: '#8B5CF6', title: 'MA240', width: 2 },
      ] as const

      for (const { key, color, title, width } of maConfigs) {
        const maData = klines
          .filter(k => k[key] !== null)
          .map(k => ({ time: k.date as any, value: k[key] as number }))
        if (maData.length > 0) {
          const maSeries = chart.addLineSeries({
            color, lineWidth: width, title,
            priceLineVisible: false, lastValueVisible: false,
          })
          maSeries.setData(maData)
        }
      }

      // 支撐線（綠）
      for (const sr of supportLevels) {
        const priceLine = {
          price:     (sr.range_low + sr.range_high) / 2,
          color:     sr.strength === 'strong' ? '#16A34A' : '#86EFAC',
          lineWidth: sr.strength === 'strong' ? 2 : 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title:     sr.label,
        }
        candleSeries.createPriceLine(priceLine)
      }

      // 壓力線（紅）
      for (const sr of resistanceLevels) {
        candleSeries.createPriceLine({
          price:     (sr.range_low + sr.range_high) / 2,
          color:     sr.strength === 'strong' ? '#DC2626' : '#FCA5A5',
          lineWidth: sr.strength === 'strong' ? 2 : 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title:     sr.label,
        })
      }

      // 停損線（橘）
      if (stopLoss > 0) {
        candleSeries.createPriceLine({
          price: stopLoss, color: '#EA580C', lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true, title: '停損',
        })
      }

      // 成交量子圖
      const volumeSeries = chart.addHistogramSeries({
        color:              '#D6D3D1',
        priceFormat:        { type: 'volume' },
        priceScaleId:       '',
        scaleMargins:       { top: 0.85, bottom: 0 },
      })

      volumeSeries.setData(validKlines.map(k => ({
        time:  k.date as any,
        value: k.volume,
        color: (k.close ?? 0) >= (k.open ?? 0) ? '#FECACA' : '#BBF7D0',
      })))

      // 響應式寬度
      const ro = new ResizeObserver(entries => {
        for (const e of entries) {
          chart.applyOptions({ width: e.contentRect.width })
        }
      })
      ro.observe(containerRef.current!)

      return () => ro.disconnect()
    }

    const cleanup = init()

    return () => {
      cleanup.then(fn => fn?.())
      chart?.remove()
    }
  }, [klines, supportLevels, resistanceLevels, stopLoss, height])

  return (
    <div className="w-full rounded-xl overflow-hidden border border-nb-border2 bg-nb-s4">
      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 px-3 pt-2.5 pb-1.5 border-b border-nb-border">
        {[
          { color: '#F59E0B', label: 'MA20' },
          { color: '#3B82F6', label: 'MA60' },
          { color: '#8B5CF6', label: 'MA240' },
          { color: '#86EFAC', label: '支撐' },
          { color: '#FCA5A5', label: '壓力' },
          { color: '#EA580C', label: '停損' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="inline-block w-5 h-0.5" style={{ background: color }} />
            <span className="text-[10px] text-nb-t2">{label}</span>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
