# Tai lieu ky thuat - Thiet ke frontend chart & trade flow

Ngay: 2026-05-11

## 1) Muc tieu
- Cung cap giao dien chart gia va cac thao tac trade nhanh, ro rang.
- Dam bao realtime, on dinh, dung du lieu tu backend cho cac chi so quan trong.
- Giam loi nhap sai, tang toc do dat lenh.

## 2) Pham vi
- Chart gia (candlestick/line) + chi bao co ban.
- Orderbook, last trades, thong tin ticker.
- Form dat lenh (limit/market/stop).
- Quan ly lenh (open/cancel), lich su lenh, lich su giao dich.

## 2.1) Backend spec (REST)

### 2.1.1 Market data
- GET /market-data/candles
	- Query: assetId, resolution (1m/5m/15m/1h/4h/1d/1w), from, to (ISO8601)
	- Tra ve: OHLCV theo candle
- GET /market-data/reference-price
	- Query: assetId
	- Tra ve: NAV reference line + market price overlay
- GET /market-data/valuation/history
	- Query: assetId, areaCode (optional), limit (default 30)

### 2.1.2 Orders
- POST /orders
	- Body: assetId, side (BUY/SELL), type (MARKET/LIMIT/STOP...), quantity, price (optional), idempotencyKey (optional), maxTotalCost (optional)
- GET /orders
	- Query: take, cursor, side, status, assetId
- PATCH /orders/{orderId}
	- Body: cancel (true/false), price, stopLossPrice, takeProfitPrice
- POST /orders/bulk-cancel
	- Body: orderIds[]

### 2.1.3 Assets (lay rule trade)
- GET /assets
	- Public trading list. FE can lay trading rules (minTradeSize, maxTradeSize, volumeStep, pipSize, slippage, tradingCommissionPerLot) neu backend tra ve.
- GET /asset-categories
	- Lay category va marginMultiplier (hien tai luon la 1.0)

### 2.1.4 Commissions (phi)
- GET /commissions/config (Admin)
	- Lay commissionRate theo CommissionEvent
- GET /commissions/stats (User)
	- Thong ke commission theo user

## 2.2) Backend spec (WebSocket)

### 2.2.1 Namespace /trading
- Client emit: subscribe_market { assetId }
- Client emit: unsubscribe_market { assetId }
- Client emit: subscribe_user (can JWT)

Events server emit:
- trade_matched { assetId, price, quantity, buyOrderId, sellOrderId, buyerUserId, sellerUserId, matchedAt }
- price_update { assetId, price, quantity, timestamp }
- order_book_update { assetId, timestamp }
- my_order_matched { side, orderId, assetId, price, quantity, matchedAt }

### 2.2.2 Default namespace
- Event: kline { assetId, resolution, time, open, high, low, close, volume, isClosed }

## 3) Tu duy thiet ke
- Phan lop thong tin: quan sat (chart), hanh dong (form trade), trang thai (orders/positions).
- Uu tien thao tac nhanh: Buy/Sell luon gan chart.
- Realtime co kiem soat: thong tin nhanh (price, orderbook) cap nhat lien tuc, thong tin it thay doi refresh dinh ky.
- Mot nguon su that: so du, trang thai lenh, PnL phai lay tu backend.

## 4) Thanh phan UI va nut can co

### 4.1 Chart toolbar
- Timeframe: 1m, 5m, 15m, 1h, 4h, 1D, 1W
- Chart type: Candlestick / Line / Heikin Ashi
- Indicators: MA, EMA, VWAP, RSI, MACD, Bollinger
- Compare/Overlay symbol (tuy scope)
- Fullscreen/Expand
- Snapshot/Download (tuy scope)

### 4.2 Trade action (gan chart)
- Buy (mau xanh)
- Sell (mau do)
- Place/Submit order
- Cancel All (open orders)
- Close Position (neu co futures)
- TP/SL toggle (neu ho tro)

### 4.3 Quick actions
- Quick price: Bid / Ask / Last
- Quick amount %: 25% / 50% / 75% / 100%
- Crosshair toggle

## 5) Bo cuc goi y
- Left: Chart + toolbar + indicators
- Right: Orderbook + Last trades + Ticker
- Bottom: Tabs Open Orders / Order History / Trade History
- Trade panel: ben canh chart (desktop), duoi chart (mobile)

## 6) Cac luong tinh nang can bo sung

### 6.1 Bat buoc
- Realtime chart (WS)
- Orderbook realtime (WS + snapshot)
- Dat lenh limit/market/stop
- Huy lenh
- Hien thi so du kha dung

### 6.2 Nen co
- Xac nhan lenh (neu size lon)
- Validate input (tick size, min size)
- Uoc tinh fee
- Canh bao loi ro rang (reason_code)
- Auto refresh open orders

### 6.3 Nang cao
- Bracket order (TP/SL)
- Trailing stop
- OCO (One Cancels Other)

## 7) Frontend can tinh vs khong can tinh

### 7.1 Frontend can tinh (display-only)
- Notional = price * amount
- Fee uoc tinh (fee_rate tu backend)
- Ty le su dung so du (25/50/75/100)
- % change theo candle hien tai

### 7.2 Frontend khong can tinh (lay backend)
- So du kha dung, so du bi khoa
- Trang thai/ket qua khop lenh
- PnL, margin, liquidation price
- Validation cuoi (min/tick/step)
- Slippage protection

## 8) Realtime data flow (goi y)
- Kline tu event kline (default namespace) de update chart.
- Trade va price realtime tu /trading (trade_matched, price_update).
- Orderbook update tu /trading (order_book_update) + REST snapshot (neu co endpoint).
- Throttle render chart/orderbook (200-500ms)

## 9) Error & edge cases
- Mat ket noi WS: hien banner + fallback polling
- Gia thay doi nhanh: lock price khi user dang nhap
- Lenh bi reject: hien reason_code ro rang

## 10) UX luu y
- Mau Buy/Sell tuong phan ro rang + icon
- Tooltip cho min/max/tick size
- Focus vao input amount khi bam Buy/Sell
- Thong bao Insufficient balance ngay khi nhap

## 11) Quy tac tick/min/fee (frontend su dung)

### 11.1 Tick/min/step
- Frontend can lay tu /assets (neu backend tra ve cac truong):
	- minTradeSize: so luong toi thieu
	- maxTradeSize: so luong toi da
	- volumeStep: buoc tang so luong
	- pipSize: buoc gia (tick)
	- slippage: gioi han truot gia
- Neu /assets khong tra ve day du, can bo sung endpoint hoac them truong vao public payload.

### 11.2 Fee/commission
- CommissionEvent.TRADE co commissionRate (decimal fraction, vi du 0.10 = 10%).
- Asset co the co tradingCommissionPerLot (phi theo lot).
- Frontend chi uoc tinh fee, backend la nguon su that.

## 12) Ghi chu thieu spec
- Khong thay REST endpoint cho orderbook snapshot / last trades trong swagger.
- Neu can realtime orderbook chi tiet, can them WS payload hoac REST snapshot.

## 13) Bo sung spec can co (de hoan thien FE)

### 13.1 Orderbook snapshot + last trades
Chon Option A - REST snapshot + WS diff.

Option A - REST snapshot + WS diff
- GET /market-data/orderbook
	- Query: assetId, depth (default 50)
	- Response: { assetId, bids: [[price, qty]], asks: [[price, qty]], timestamp }
- GET /market-data/trades
	- Query: assetId, limit (default 50)
	- Response: [{ tradeId, price, quantity, side, timestamp }]
- WS /trading event: order_book_update
	- Payload: { assetId, bidsDelta, asksDelta, sequence, timestamp }

Option B - WS full snapshot (khong ap dung)

### 13.2 Public payload /assets (bat buoc co)
De frontend validate va tinh display dung, public payload can co cac truong sau:
- minTradeSize
- maxTradeSize
- volumeStep
- pipSize (tick)
- tradingCommissionPerLot
- digit (so chu so thap phan de display gia)

Ghi chu: Neu /assets khong the public day du, can them endpoint /assets/{id}/trade-rules.

### 13.3 Quy tac tinh fee (uu tien)
De thong nhat tinh fee tren FE, can chot quy tac sau:

Goi y uu tien (neu co du lieu):
- Neu tradingCommissionPerLot != null va contractSize co, fee = tradingCommissionPerLot * lots
	- lots = quantity / contractSize
- Neu chi co commissionRate (CommissionEvent.TRADE), fee = notional * commissionRate
	- notional = price * quantity

Neu ca hai cung co, can chon 1 quy tac duy nhat va ghi ro trong backend response.

### 13.4 Quy tac rounding
Can them 2 quy tac:
- Rounding quantity theo volumeStep (lam tron xuong)
- Rounding price theo pipSize (lam tron gan nhat hoac xuong, chot 1 quy tac)
