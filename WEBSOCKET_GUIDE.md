# Hướng dẫn Tích hợp WebSocket cho Dữ liệu Thị trường

Tài liệu này hướng dẫn cách kết nối và lắng nghe các sự kiện WebSocket để nhận dữ liệu thị trường (ticker) thời gian thực.

## 1. Biến Môi trường (.env)

Frontend cần sử dụng biến môi trường sau để kết nối đến máy chủ WebSocket. Đây là URL chính của backend.

```env
# URL của máy chủ WebSocket
# Ví dụ: ws://localhost:3001
SOCKET_URL=your_backend_websocket_url
```

## 2. Kết nối WebSocket

Sử dụng URL trên để thiết lập kết nối. Gateway cho dữ liệu ticker được đặt tại namespace gốc (`/`).

**Ví dụ kết nối phía client (sử dụng `socket.io-client`):**

```typescript
import { io } from 'socket.io-client';

const URL = process.env.SOCKET_URL; // Hoặc lấy từ config
const socket = io(URL, {
  transports: ['websocket'], // Ưu tiên kết nối WebSocket
});

socket.on('connect', () => {
  console.log('Đã kết nối thành công đến Market Data Gateway!');
});

socket.on('disconnect', () => {
  console.log('Đã ngắt kết nối.');
});

// Lắng nghe sự kiện ticker
// ... xem chi tiết bên dưới
```

## 3. Lắng nghe Sự kiện `ticker`

Sau khi kết nối thành công, bạn có thể lắng nghe sự kiện `ticker` để nhận cập nhật dữ liệu cho **tất cả các tài sản** mỗi khi có giao dịch mới.

- **Sự kiện**: `ticker`
- **Namespace**: `/` (root)
- **Payload**: `TickerPayload`

**Ví dụ cách xử lý sự kiện:**

```typescript
interface TickerPayload {
  assetId: string;
  ask: number;          // Giá mua (Buy Price)
  bid: number;          // Giá bán (Sell Price)
  changePercent: number;// % thay đổi
  low: number;          // Giá thấp nhất trong 24h
  high: number;         // Giá cao nhất trong 24h
  volume: number;       // Khối lượng giao dịch trong 24h
  buyPercent: number;   // Tỷ lệ % mua
  sellPercent: number;  // Tỷ lệ % bán
  lastPrice: number;    // Giá của giao dịch cuối cùng
  timestamp: string;    // ISO 8601 timestamp
}

socket.on('ticker', (data: TickerPayload) => {
  console.log('Nhận được dữ liệu ticker mới:', data);

  // Cập nhật state hoặc store của bạn tại đây
  // Ví dụ: updateAssetRealtimeData(data.assetId, data);
});
```

### Ánh xạ Dữ liệu

Dựa trên yêu cầu của bạn, đây là cách ánh xạ các trường từ `TickerPayload` sang giao diện người dùng:

- **Sell Price**: `bid`
- **Buy Price**: `ask`
- **Chg %**: `changePercent`
- **Low**: `low`
- **High**: `high`
- **Volume**: `volume`
- **Buy %**: `buyPercent`
- **Sell %**: `sellPercent`

**Lưu ý:** Hiện tại, `ask` và `bid` đang được lấy từ giá của giao dịch cuối cùng. Chúng sẽ được cải thiện để phản ánh giá tốt nhất từ sổ lệnh trong các phiên bản sau.
