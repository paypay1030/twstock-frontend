# 我的持股管家

台股個人投資分析助手前端。超白話模式，讓不懂技術分析的人也能看懂。

## 快速啟動（本機）

```bash
# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.local.example .env.local
# 編輯 .env.local，確認 NEXT_PUBLIC_API_URL 指向後端

# 3. 啟動開發伺服器
npm run dev
# 開啟 http://localhost:3000
```

> **注意**：前端需要後端同時運行。請先確認後端在 `http://localhost:8000` 正常運行。

## 部署到 Vercel

### 步驟

1. 將專案推送至 GitHub
2. 前往 [vercel.com](https://vercel.com)，Import Git Repository
3. Framework Preset 選 **Next.js**（自動偵測）
4. 在 **Environment Variables** 設定：

```
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

5. Deploy

### 注意事項

- 必須先部署後端（Railway），取得 API URL 後再設定 Vercel 環境變數
- 後端的 `ALLOWED_ORIGINS` 必須包含 Vercel 給的前端網址

## 功能說明

### 超白話模式（預設）
右上角切換。把技術術語轉成一般人看得懂的語言：
- 支撐 → 地板價
- 壓力 → 天花板價
- 黃燈 → 中間地帶，繼續觀察
- 橘燈 → 快到高點了

### 股票分析頁（`/analyze`）
- 搜尋 1,937 檔上市上櫃股票
- 懶人決策卡：一句話告訴你現在該怎麼做
- K 線圖 + 均線 + 支撐壓力標示
- AI 白話翻譯

### 持股管理頁（`/portfolio`）
- 四種交易類型：買進 / 加碼 / 減碼 / 賣出
- FIFO 損益計算
- 解套進度追蹤（環形 / 條形）
- 智慧減碼試算
- 投資日誌（買賣原因 + 信心程度）

### 交易紀錄頁（`/trades`）
- 所有交易的時間軸
- 點開查看投資日誌

## 技術架構

- **Framework**: Next.js 14 (App Router)
- **UI**: TailwindCSS
- **圖表**: lightweight-charts（TradingView 同款）
- **狀態**: Zustand + LocalStorage（離線可用）
- **語言**: TypeScript
