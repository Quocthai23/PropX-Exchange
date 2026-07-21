# 🚀 PropX-Exchange Backend

Hệ thống Backend cho nền tảng Giao dịch và Chứng khoán hóa Tài sản Thực (**RWA - Real World Asset Tokenization & Exchange**). Dự án được phát triển trên nền tảng **NestJS**, tích hợp **Blockchain (Smart Contracts)**, cơ chế khớp lệnh tự động (FIFO) và cập nhật dữ liệu thị trường thời gian thực qua **WebSocket**.

---

## 📋 Mục lục

1. [Giới thiệu & Tính năng](#-giới-thiệu--tính-năng)
2. [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
3. [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
4. [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
5. [Hướng dẫn cài đặt nhanh (Quick Start)](#-hướng-dẫn-cài-đặt-nhanh-quick-start)
6. [Tích hợp Smart Contracts](#-tích-hợp-smart-contracts)
7. [WebSocket & Real-time Events](#-websocket--real-time-events)
8. [Các API Endpoints chính](#-các-api-endpoints-chính)
9. [Cấu hình & Tối ưu hóa Database](#-cấu-hình--tối-ưu-hóa-database)

---

## 🌟 Giới thiệu & Tính năng

**PropX-Exchange** cung cấp giải pháp đầu tư tài sản thực (như bất động sản) dưới dạng token hóa kỹ thuật số.

### Các tính năng cốt lõi:
- **Khớp lệnh tự động (Spot Trading Engine)**: Cơ chế khớp lệnh FIFO (First In, First Out) hoạt động thông qua Event-driven architecture.
- **RWA Tokenization & Management**:
  - Hỗ trợ Onboarding tài sản thực và phát hành Token tương ứng.
  - Phân phối lợi nhuận (Dividends) và quản lý yêu cầu rút tài sản (Redemption).
- **Cơ chế biểu quyết phi tập trung (DAO & Governance)**: Tích hợp voting snapshot cho các đề xuất cộng đồng.
- **Dữ liệu thị trường thời gian thực**: Cập nhật giá (Ask/Bid, Kline/Candlesticks, Volume) liên tục thông qua WebSockets.
- **Bảo mật & Quản lý ví**:
  - Hỗ trợ đăng nhập truyền thống (Email/Mật khẩu + 2FA Speakeasy) và Web3 (SIWE - Sign-In with Ethereum).
  - Quản lý mã khóa bảo mật thông qua AWS KMS (hoặc chạy Plaintext ở môi trường dev).
- **Hệ thống hàng đợi (Queue Processing)**: Sử dụng Redis và BullMQ để xử lý các tác vụ bất đồng bộ nặng (xử lý giao dịch, gửi mail, tính toán kline).

---

## 🛠 Công nghệ sử dụng

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database ORM**: [Prisma ORM](https://www.prisma.io/)
- **Cơ sở dữ liệu**: PostgreSQL / MariaDB (Mặc định trong môi trường phát triển sử dụng Neon PostgreSQL hoặc MariaDB qua Docker)
- **Caching & Message Queue**: Redis (Upstash Redis / Redis local) & BullMQ
- **Blockchain**: Hardhat, Ethers.js, SIWE
- **Real-time Gateway**: Socket.io (tích hợp adapter Redis)
- **Logger**: Winston Logger & Winston Daily Rotate File
- **Bảo mật**: AWS KMS, bcryptjs, JWT, Speakeasy (2FA)

---

## 📂 Cấu trúc thư mục

Thư mục chính chứa mã nguồn nghiệp vụ nằm trong `src/modules`:

```
src/modules/
├── accounts/        # Quản lý tài khoản giao dịch, danh mục đầu tư (Portfolio)
├── assets/          # Quản lý RWA token, thông tin chi tiết tài sản thực
├── auth/            # Xác thực người dùng (JWT, SIWE, 2FA, Session)
├── balances/        # Theo dõi số dư tài khoản của nhà đầu tư
├── commissions/     # Quản lý hoa hồng, phần thưởng giới thiệu (Referral Rewards)
├── dao/             # Biểu quyết và quản trị đề xuất (DAO Proposals & Voting)
├── dividends/       # Tính toán và phân phối lợi nhuận cho chủ sở hữu Token
├── images/          # Upload hình ảnh tài sản
├── kyc/             # Xác thực danh tính khách hàng (Know Your Customer)
├── market-data/     # Xử lý Candlestick (Kline) và các chỉ số thị trường
├── market-maker/    # Tạo lệnh ảo (Bot) phục vụ việc mô phỏng thanh khoản dev
├── news/            # Quản lý tin tức thị trường tài sản
├── notifications/   # Quản lý thông báo trong ứng dụng & email
├── onboarding/      # Quy trình duyệt tài sản mới lên sàn
├── orders/          # Quản lý sổ lệnh (Orderbook) - Đặt lệnh BUY/SELL
├── payment/         # Cổng nạp/rút tiền pháp định hoặc crypto
├── posts/           # Quản lý bài đăng, bình luận cộng đồng (Social Trading)
├── realtime/        # WebSocket Gateway kết nối với Frontend
├── settlement/      # Giải quyết giao dịch trên blockchain
├── support/         # Hệ thống Ticket chăm sóc khách hàng
└── users/           # Quản lý thông tin profile người dùng
```

---

## 💻 Yêu cầu hệ thống

- **Node.js**: `>= 18.x`
- **Yarn**: `>= 4.x` (hoặc npm)
- **Docker & Docker Compose**: Để chạy MariaDB và Redis cục bộ (nếu không sử dụng dịch vụ đám mây như Neon và Upstash)

---

## ⚡ Hướng dẫn cài đặt nhanh (Quick Start)

### Bước 1: Clone dự án và Cài đặt thư viện
```bash
# Clone repository
git clone <repo-url>
cd PropX-Exchange

# Cài đặt dependencies cho Backend
yarn install

# Cài đặt dependencies cho Smart Contracts
cd smart-contracts && yarn install && cd ..
```

### Bước 2: Thiết lập Biến môi trường (`.env`)
Tạo file `.env` ở thư mục gốc của backend dựa trên mẫu dưới đây (hoặc sao chép từ `.env.example`):
```env
# Database (Ví dụ cấu hình Neon PostgreSQL hoặc MySQL)
DATABASE_URL="postgresql://neondb_owner:...@ep-divine-resonance...aws.neon.tech/neondb?sslmode=require"

# Redis Config (Upstash Redis hoặc Redis Local)
REDIS_URL="rediss://default:...@talented-mammal-105368.upstash.io:6379"

# Cấu hình bảo mật AWS KMS (Đặt false để dev bằng local private key)
USE_AWS_KMS=false
CHAIN_ADMIN_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRATION=1h

# Blockchain Network
CHAIN_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Application Settings
NODE_ENV=development
PORT=3001
CDN_BASE_URL=http://localhost:3001
ENABLE_MARKET_MAKER=true
ENABLE_DEMO_MARKET_DATA=true
```

### Bước 3: Chạy Docker Compose (Nếu chạy Database & Redis Local)
Nếu bạn không sử dụng cơ sở dữ liệu trên cloud (Neon, Upstash), bạn có thể dựng nhanh các service thông qua Docker:
```bash
docker compose up -d
```

### Bước 4: Đồng bộ Database (Prisma Migrations)
```bash
# Đồng bộ schema lên database
yarn prisma migrate deploy

# Khởi tạo dữ liệu mẫu (Seed Data)
yarn prisma db seed
```

### Bước 5: Khởi động Backend
```bash
# Chạy ở chế độ Development (Watch mode)
yarn start:dev

# Server chạy tại: http://localhost:3001
# Tài liệu Swagger API Docs: http://localhost:3001/api/docs
```

---

## 🔗 Tích hợp Smart Contracts

Mã nguồn Smart Contracts nằm tại thư mục `/smart-contracts`.

### Biên dịch Contracts
```bash
cd smart-contracts
yarn build
```

### Chạy Local Hardhat Node (Phục vụ Testnet nội bộ)
```bash
# Khởi chạy blockchain giả lập tại local
yarn node
# Sau khi khởi chạy, hệ thống sẽ hiển thị danh sách các tài khoản có sẵn 10,000 ETH kèm private key.
```

### Deploy Smart Contracts lên Node Local
```bash
# Deploy lên local network đang chạy
npx hardhat deploy --network localhost
```

---

## 📱 WebSocket & Real-time Events

Hệ thống cung cấp kết nối Real-time qua Socket.io để cập nhật liên tục thông tin bảng giá và khớp lệnh.

### Kết nối đến Gateway:
- **Root Namespace**: `/` (Dùng để nhận `ticker` data chung cho toàn sàn)
- **Trading Namespace**: `/trading` (Dùng để theo dõi lệnh khớp và biểu đồ kline chi tiết)

### Các sự kiện phía Server phát ra (Emitted Events):
- `ticker` (Namespace `/`): Cập nhật giá bid/ask, % change, volume 24h của tất cả các tài sản mỗi khi có biến động.
- `trade_matched` (Namespace `/trading`): Thông báo giao dịch khớp lệnh thành công.
- `order_updated` (Namespace `/trading`): Cập nhật trạng thái lệnh (Active, Filled, Cancelled).
- `kline` (Namespace `/trading`): Cập nhật nến biểu đồ thời gian thực.
- `balance_updated` (Namespace `/trading`): Cập nhật số dư ví tức thời cho khách hàng.

Ví dụ lắng nghe sự kiện `ticker` ở Client:
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', { transports: ['websocket'] });

socket.on('ticker', (data) => {
  console.log('Dữ liệu Ticker thời gian thực:', data);
  // data: { assetId, ask, bid, changePercent, low, high, volume, lastPrice, timestamp }
});
```

---

## 📌 Các API Endpoints chính

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Kiểm tra trạng thái hoạt động của hệ thống |
| **GET** | `/api/docs` | Swagger API Documentation |
| **POST** | `/api/auth/login` | Đăng nhập tài khoản truyền thống |
| **POST** | `/api/auth/wallet-login` | Đăng nhập thông qua Web3 Wallet (SIWE) |
| **GET** | `/api/assets` | Lấy danh sách các tài sản RWA niêm yết |
| **POST** | `/api/orders` | Đặt lệnh giao dịch (MARKET / LIMIT) |
| **GET** | `/api/orders` | Lấy danh sách lệnh cá nhân |
| **GET** | `/api/market-data/candles` | Lấy dữ liệu nến lịch sử (Kline) |

---

## ⚙️ Cấu hình & Tối ưu hóa Database

Trong trường hợp hệ thống gặp lỗi `"Too many connections"` hoặc quá hạn kết nối của Prisma (Prisma pool timeouts), bạn có thể tối ưu hóa thông qua các biến môi trường sau:

- **`DATABASE_POOL_MAX`** (Mặc định: `10`): Điều chỉnh số lượng kết nối tối đa trong Pool của mỗi instance backend.
- **`PRISMA_CONNECT_RETRIES`** (Mặc định: `5`): Số lần thử kết nối lại tối đa khi Prisma gặp sự cố mạng tạm thời.

### Ví dụ chạy tối ưu hóa trên Local:
```bash
DATABASE_POOL_MAX=5 PRISMA_CONNECT_RETRIES=5 yarn start:dev
```

### Điều chỉnh trên MariaDB/MySQL Server (Nếu cần tăng giới hạn kết nối):
```sql
SET GLOBAL max_connections = 200;
```
Để lưu cài đặt này vĩnh viễn, hãy cập nhật tệp `my.cnf` hoặc `my.ini` trong phần `[mysqld]`:
```ini
[mysqld]
max_connections=200
```
Sau đó tiến hành khởi động lại cơ sở dữ liệu.
