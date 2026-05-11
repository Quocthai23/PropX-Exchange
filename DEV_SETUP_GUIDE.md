# 🚀 PropX-Exchange: Hướng dẫn Setup Dev Environment

Hướng dẫn này giúp bạn chạy cả **Smart Contract** và **Backend** để phát triển Frontend.

---

## 📋 Yêu cầu hệ thống

- **Node.js**: >= 18.x
- **Yarn**: >= 4.x (hoặc npm)
- **Docker & Docker Compose**: Để chạy MariaDB và Redis
- **Git**: Để quản lý mã nguồn

---

## ⚡ Quick Start (5 phút)

### Bước 1: Clone & Cài đặt dependencies

```bash
# Nếu bạn chưa có repo
git clone <repo-url>
cd PropX-Exchange

# Cài đặt dependencies cho backend
yarn install

# Cài đặt dependencies cho smart contracts
cd smart-contracts && yarn install && cd ..
```

### Bước 2: Setup Environment Variables

```bash
# Tạo file .env ở root directory
cp .env.example .env  # Nếu có file example

# Hoặc tạo thủ công với nội dung cơ bản:
cat > .env << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=3307
DB_USER=propx
DB_PASSWORD=propx
DB_NAME=propx
DB_ROOT_PASSWORD=propx_root
DATABASE_URL=mysql://propx:propx@localhost:3307/propx

# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (tạo secret ngẫu nhiên)
JWT_SECRET=your_jwt_secret_key_change_me_in_production

# Blockchain (tuỳ chọn cho smart contract testing)
PRIVATE_KEY=your_private_key_here
EOF
```

### Bước 3: Chạy Docker Compose (MariaDB + Redis)

```bash
# Khởi động database và cache
docker compose up -d

# Kiểm tra services chạy OK
docker compose ps
```

### Bước 4: Setup Database (Prisma)

```bash
# Chạy migrations
yarn prisma migrate deploy

# (Tuỳ chọn) Seed dữ liệu test
yarn prisma db seed
```

### Bước 5: Chạy Backend

```bash
# Terminal 1: Backend in watch mode
yarn start:dev

# Backend sẽ chạy tại http://localhost:3000
# API Docs: http://localhost:3000/api/docs
```

---

## 🔗 Smart Contracts Setup

### Compile Smart Contracts

```bash
cd smart-contracts

# Cài dependencies lần đầu (nếu chưa)
yarn install

# Compile contracts
yarn build

# Hoặc: npm run build
```

### Chạy Local Hardhat Node (tuỳ chọn)

```bash
cd smart-contracts

# Terminal 2: Chạy Hardhat local network
yarn node

# Pre-configured accounts với 10,000 ETH sẽ được hiển thị
# Lưu lại địa chỉ và private key để test
```

### Deploy Contracts (trên local Hardhat node)

```bash
cd smart-contracts

# Deploy lên Hardhat local network
npx hardhat deploy --network hardhat

# Hoặc nếu Hardhat node đang chạy:
npx hardhat deploy --network localhost
```

---

## 📂 Full Dev Environment (Cách tốt nhất)

Mở **3 terminals** riêng biệt:

### Terminal 1: Database & Cache Services

```bash
# Khởi động Docker containers
docker compose up -d

# Hoặc theo dõi logs:
docker compose up

# Để dừng:
docker compose down
```

### Terminal 2: Smart Contracts (optionally)

```bash
cd smart-contracts

# Nếu muốn local Hardhat network chạy suốt:
yarn node

# Quan sát output để lấy addresses và private keys
```

### Terminal 3: Backend (NestJS)

```bash
# Chắc chắn DBconnection OK trước
yarn start:dev

# Server logs sẽ hiển thị tại http://localhost:3000
# Ctrl+C để dừng
```

### Terminal 4 (tuỳ chọn): Frontend

```bash
# Sau này khi bạn code frontend
cd frontend  # hoặc wherever your FE is
yarn dev  # or npm start
```

---

## 🧪 Kiểm tra Environment

### Kiểm tra Backend Health

```bash
# Mở browser hoặc curl:
curl http://localhost:3000/health

# Hoặc xem API docs:
http://localhost:3000/api/docs
```

### Kiểm tra Database Connection

```bash
# Trong một terminal:
docker exec -it propx-exchange-mariadb-1 mysql -u propx -ppropx -e "SELECT 1;"

# Nếu thành công sẽ thấy: 
# +---+
# | 1 |
# +---+
```

### Kiểm tra Redis

```bash
# Kiểm tra Redis status
docker exec propx-exchange-redis-1 redis-cli ping

# Nếu OK thấy: PONG
```

---

## 🛠️ Các lệnh thường dùng

### Backend

```bash
# Development (watch mode) - Dùng khi code
yarn start:dev

# Build cho production
yarn run build

# Production run
yarn start:prod

# Lint & format code
yarn lint
yarn format

# Run tests
yarn test
yarn test:e2e

# Prisma commands
yarn prisma generate      # Generate Prisma client
yarn prisma migrate dev   # Tạo migration mới
yarn prisma studio       # GUI quản lý database
```

### Smart Contracts

```bash
cd smart-contracts

# Compile
yarn build

# Test
yarn test

# Run local node
yarn node

# Deploy (cần configure network)
yarn deploy
yarn deploy:sepolia
yarn verify:sepolia
```

---

## 📊 Architecture Overview

```
Frontend (bạn sẽ code)
    ↓
    ↓ HTTP/WebSocket
    ↓
NestJS Backend (port 3000)
    ├── REST APIs
    ├── WebSocket real-time (/trading namespace)
    ├── Event Emitter (order matching)
    │
    ├── Database: MariaDB (port 3307)
    │   └── Prisma ORM
    │
    ├── Cache: Redis (port 6379)
    │   └── Queue processing
    │
    └── Smart Contracts Integration
        └── Ethers.js
            ├── Local Hardhat Node (port 8545)
            ├── Sepolia Testnet
            └── Production Network
```

---

## 🐛 Troubleshooting

### Backend không kết nối Database

```bash
# 1. Kiểm tra Docker containers running
docker ps

# 2. Kiểm tra DATABASE_URL trong .env
cat .env | grep DATABASE_URL

# 3. Kiểm tra MariaDB health
docker logs propx-exchange-mariadb-1

# 4. Restart containers
docker-compose restart mariadb
```

### Port 3000 đã được sử dụng

```bash
# Tìm process sử dụng port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Hoặc thay đổi PORT trong .env
PORT=3001 yarn start:dev
```

### Prisma generate errors

```bash
# Xoá node_modules và reinstall
rm -rf node_modules
yarn install

# Regenerate Prisma
yarn prisma:generate
```

### Redis connection error

```bash
# Xoá Redis container và volume
docker-compose down -v redis

# Khởi động lại
docker-compose up -d redis
```

---

## 📝 Development Workflow

### 1. Khi code Backend

```bash
# Terminal 1: Services
docker-compose up

# Terminal 2: Watch mode
yarn start:dev

# Khi edit file .ts → NestJS auto reload
```

### 2. Khi code Smart Contract

```bash
# Terminal 1: Local Hardhat node
cd smart-contracts && yarn node

# Terminal 2: Compile & deploy
yarn build
yarn deploy

# Terminal 3: Run tests
yarn test
```

### 3. Khi code Frontend

```bash
# Chắc chắn backend chạy OK tại http://localhost:3000

# Terminal 1: Backend
yarn start:dev

# Terminal 2: Frontend
cd ../frontend  # wherever your FE is
yarn dev
```

---

## 🎯 Khởi đầu Frontend Development

Khi backend & smart contracts đã chạy OK:

### Kết nối WebSocket Real-time

```typescript
// Frontend sẽ nhận real-time trade updates
import io from 'socket.io-client';

const socket = io('http://localhost:3000/trading');

socket.on('trade_matched', (tradeData) => {
  console.log('New trade:', tradeData);
  // Update your charts, orders, etc.
});

socket.on('kline', (candleData) => {
  console.log('Candlestick:', candleData);
  // Update candlestick chart
});
```

### API Endpoints chính

```
GET  /api/health                    # Health check
GET  /api/docs                      # Swagger API docs
GET  /api/candles                   # Get candlesticks
POST /api/orders                    # Create order
GET  /api/orders                    # Get orders
GET  /api/trades                    # Get trades
POST /api/auth/login                # Login
GET  /api/users/profile             # User profile
```

---

## 📱 WebSocket Events

```typescript
// Real-time namespace: /trading

// Events emitted by server:
socket.on('trade_matched', (/* trade data */));  // Giao dịch mới
socket.on('order_updated', (/* order data */));  // Cập nhật lệnh
socket.on('kline', (/* candle data */));         // Candlestick
socket.on('balance_updated', (/* balance */));   // Số dư thay đổi

// Client có thể emit:
socket.emit('subscribe_symbol', { symbol: 'BTC/USDT' });
socket.emit('unsubscribe_symbol', { symbol: 'BTC/USDT' });
```

---

## ✅ Checklist Setup

- [ ] Node.js >= 18.x cài đặt
- [ ] Yarn cài đặt (`yarn --version`)
- [ ] Docker & Docker Compose cài đặt
- [ ] `.env` file tạo ở root
- [ ] `yarn install` chạy thành công
- [ ] `docker-compose up -d` chạy thành công
- [ ] `yarn prisma migrate deploy` chạy OK
- [ ] `yarn start:dev` chạy OK (port 3000)
- [ ] Backend health check: `curl http://localhost:3000/health`
- [ ] API Docs accessible: `http://localhost:3000/api/docs`
- [ ] Smart contracts compiled: `cd smart-contracts && yarn build`

---

## 🎉 Bạn đã sẵn sàng code Frontend!

**Backend & Smart Contracts đang chạy:**
- ✅ Backend: http://localhost:3000
- ✅ API Docs: http://localhost:3000/api/docs
- ✅ WebSocket real-time: ws://localhost:3000/trading
- ✅ Database: MariaDB (localhost:3307)
- ✅ Cache: Redis (localhost:6379)
- ✅ Smart Contracts: Compiled & ready

Bây giờ bạn có thể tập trung vào **Frontend Development**! 🚀

---

## 📚 Tài liệu thêm

- [NestJS Docs](https://docs.nestjs.com)
- [Hardhat Docs](https://hardhat.org)
- [Prisma Docs](https://www.prisma.io/docs)
- [Socket.io Docs](https://socket.io/docs/)

---

**Có vấn đề?** Kiểm tra logs:

```bash
# Backend logs
docker logs container_name

# Database logs
docker logs propx-exchange-mariadb-1

# Redis logs
docker logs propx-exchange-redis-1
```
