# 🔥 Production Deployment Guide - Security & Performance

## 1. KYC APPROVAL BOTTLENECK FIX ✅

### Problem
- Admin calls approve KYC endpoint
- Backend waits 10-15s for blockchain confirmation
- API request times out (typical timeout: 30s, but 15s+ is too long)
- User experience: Admin sees spinner, doesn't know if approval is pending

### Solution: Async Background Job (Bull Queue)
```
Timeline:
- T=0ms: Admin clicks approve
- T=100ms: DB status = APPROVING, HTTP 200 returned to frontend
- T=100-15000ms: Backend processes blockchain call asynchronously
- T=15000ms: Blockchain confirms, DB status = APPROVED (or REJECTED if failed)
- User can refresh to see final status
```

### Implementation Details
- **Queue**: Bull (Redis-backed)
- **Job Processor**: `KycApprovalProcessor` (@Processor)
- **Service**: Updated `KycService.approveKyc()` now returns immediately
- **Retry Policy**: 3 attempts with exponential backoff (2s delay)

### Configuration Required
```bash
# .env
REDIS_HOST=localhost          # or Redis hostname
REDIS_PORT=6379              # default Redis port
REDIS_PASSWORD=              # leave empty for local dev, set for production
```

### Testing Async Flow
```bash
# Start Redis first (required for Bull queue)
redis-cli

# In another terminal
npm run start:dev

# Call approve KYC
curl -X PATCH http://localhost:3000/kyc/admin/{userId}/approve

# Response should be immediate (200ms, not 15s)
# {
#   "message": "KYC approval request received. Processing blockchain confirmation in background.",
#   "approvalInProgress": true
# }

# Monitor job status via Redis
redis-cli
> KEYS *kyc-approval*  # See queue keys
> LLEN bull:kyc-approval:*  # See pending jobs
```

---

## 2. PRIVATE KEY SECURITY ⚠️ CRITICAL

### Risk: Server Compromise → Full Asset Loss
If `CHAIN_ADMIN_PRIVATE_KEY` is stolen:
- Hacker can call any smart contract function
- Can approve/transfer/mint/burn assets
- Can drain all user balances
- **Total financial loss** (users trust your backend with $, BRN = credentials)

### Current Implementation: Plaintext .env (Dev/Test Only)
```env
CHAIN_ADMIN_PRIVATE_KEY=0x1234567890abcdef...
```

**This is NOT production-safe.** ❌

### Solution 1: AWS KMS (Recommended)
KMS = Hardware Security Module in the cloud
- Private key encrypted at rest
- Decryption happens only in AWS hardware
- Even AWS staff can't read keys
- Audit logs for all key access

#### Setup (One-time)
```bash
# 1. Create KMS key in AWS
aws kms create-key --description "RWA Backend Admin Key"
# Returns: "KeyId": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_UUID"

# 2. Encrypt private key
aws kms encrypt --key-id <KEY_UUID> --plaintext "0x1234567890abcdef..."
# Returns: "CiphertextBlob": "AQIDAHgz..."

# 3. Store in .env.production
USE_AWS_KMS=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED=AQIDAHgz...

# 4. Remove plaintext private key from git
git rm --cached .env
```

#### In Code
```typescript
// KmsService automatically:
// 1. Decrypts key from AWS on startup (OnModuleInit)
// 2. Caches in memory (not on disk)
// 3. Clears on shutdown
// 4. Logs all access for audit

// BlockchainService uses KmsService.getAdminPrivateKey()
```

### Solution 2: Fireblocks (Enterprise Custody)
- Hardware wallet + smart contract execution
- More expensive but bank-grade security
- No private key ever enters your servers

### Current Implementation vs AWS KMS

#### Dev Mode (current .env)
```env
USE_AWS_KMS=false
CHAIN_ADMIN_PRIVATE_KEY=0x1234...  # Plaintext - acceptable for dev only
```

#### Production
```env
USE_AWS_KMS=true
CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED=AQIDAHg...  # KMS encrypted
```

### Risk Mitigation for MVP
If you can't use AWS KMS yet:
1. ✅ Rotate private key frequently (weekly)
2. ✅ Use AWS IAM role pinning (only blockchain service can decrypt)
3. ✅ Monitor blockchain transaction logs 24/7
4. ✅ Use minimal transaction amounts for testing
5. ✅ Never deploy to production without KMS

---

## 3. ORDER MATCHING DEADLOCK PREVENTION ✅

### Problem: High Concurrency → Database Deadlock
Scenario: 100 users place orders simultaneously
```
Thread 1: SELECT * FROM orders WHERE assetId=A FOR UPDATE (lock)
Thread 2: SELECT * FROM orders WHERE assetId=A FOR UPDATE (wait for Thread 1)
Thread 1: UPDATE orders SET filledQuantity WHERE id=O1 (still has lock)
Thread 2: UPDATE orders SET filledQuantity WHERE id=O2 (still waiting)
... both threads timeout → DEADLOCK ERROR
```

### Solution: Redis Queue (Bull) + Serial Processing
```
Timeline:
User 1 places BUY order
    → Queued to Redis queue
    → Processor takes it: matches with existing SELL orders
    → Atomic Prisma.$transaction([...updates...])
    → Returns result

User 2 places BUY order (while User 1 still processing)
    → Also queued to Redis
    → Waits in queue (no DB locks held!)
    → Eventually processed serially
    → No deadlock ✅
```

### Implementation Details
- **Queue Name**: `order-matching`
- **Processing**: Serial (one job at a time by default)
- **Matching Logic**: FIFO (First-In-First-Out)
  - Buy orders matched with lowest-priced SELL orders
  - Sell orders matched with highest-priced BUY orders
  - Oldest orders matched first (fairness)

### Configuration Required
```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### How It Works
```typescript
// User places order
POST /orders
{
  "assetId": "...",
  "side": "BUY",
  "price": 100,
  "quantity": 50
}

// Response (immediate)
{
  "id": "order-123",
  "status": "OPEN",
  "message": "Order created and queued for matching",
  "matchingInProgress": true
}

// Backend: Job processor runs async
- Fetch order, find matching counterparties
- Execute atomic Prisma.$transaction
  - Update both orders (filledQuantity, status)
  - Update balances
  - Create trade record
- Return match count
```

### Concurrency Guarantees
- ✅ No deadlocks (serial processing)
- ✅ Atomic trades (Prisma.$transaction)
- ✅ FIFO fairness (first order processed first)
- ✅ At-least-once delivery (retries on failure)

### Monitoring Queues
```bash
# Terminal 1: Start Bull UI (optional)
npm install --save-dev @bull-board/express
# Add to app.module.ts routes

# Terminal 2: Check queue status
redis-cli
> LLEN bull:order-matching:1  # See pending job count
> KEYS bull:order-matching:*  # See all queues
```

---

## 4. Environment Variables Checklist

### Development (.env)
```bash
# Blockchain
CHAIN_RPC_URL=http://localhost:8545
CHAIN_ADMIN_PRIVATE_KEY=0x1234567890abcdef...  # plaintext - dev only
USE_MOCK_CHAIN=true  # optional: mock blockchain for testing

# KMS
USE_AWS_KMS=false  # disabled in dev

# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # not needed for local

# Other
IDENTITY_REGISTRY_ADDRESS=0x...
DATABASE_URL=mysql://user:pass@localhost:3306/rwa_db
KYC_PII_ENCRYPTION_KEY=your-secret-key
```

### Production (.env.production)
```bash
# Blockchain
CHAIN_RPC_URL=https://eth-mainnet.infura.io/v3/PROJECT_ID
# CHAIN_ADMIN_PRIVATE_KEY=  # NEVER commit plaintext
USE_AWS_KMS=true  # REQUIRED for production
CHAIN_ADMIN_PRIVATE_KEY_ENCRYPTED=AQIDAHg...

# AWS KMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Redis (managed service)
REDIS_HOST=redis.production.aws.com
REDIS_PORT=6379
REDIS_PASSWORD=...  # strong password

# Other
IDENTITY_REGISTRY_ADDRESS=0x...
DATABASE_URL=mysql://prod_user:strong_pass@prod-mysql.aws.com:3306/rwa_db
KYC_PII_ENCRYPTION_KEY=...  # rotated regularly
```

---

## 5. Deployment Checklist

- [ ] Redis running and accessible
  ```bash
  redis-cli ping  # Should return PONG
  ```

- [ ] Prisma migrations applied
  ```bash
  npx prisma migrate deploy
  ```

- [ ] AWS KMS key created (if using)
  ```bash
  aws kms describe-key --key-id <KEY_ID>
  ```

- [ ] Environment variables set correctly
  ```bash
  npm run build  # Should succeed
  npm run lint   # Should pass
  ```

- [ ] Test KYC approval async flow
  ```bash
  curl -X PATCH http://localhost:3000/kyc/admin/{userId}/approve
  # Should return in <1 second, not 15 seconds
  ```

- [ ] Test order matching queue
  ```bash
  curl -X POST http://localhost:3000/orders -d '{"assetId":"...","side":"BUY",...}'
  # Should return immediately with matchingInProgress=true
  ```

- [ ] Monitor logs for errors
  ```bash
  # Check for failed jobs
  npm run logs
  ```

---

## 6. Troubleshooting

### KYC Approval Still Slow?
```bash
# Check if job processor is running
docker logs backend | grep "BlockchainService"

# Check Redis queue
redis-cli
> LLEN bull:kyc-approval:1
> HGETALL bull:kyc-approval:${JOB_ID}:data
```

### Order Matching Not Working?
```bash
# Check if queue processor started
docker logs backend | grep "OrderMatchingProcessor"

# Check Redis for pending jobs
redis-cli
> LLEN bull:order-matching:1
```

### Private Key Decryption Failed?
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test KMS access
aws kms decrypt --ciphertext-blob fileb://encrypted.bin

# Check KMS logs
aws logs tail /aws/kms --follow
```

---

## 7. References

- **Bull Queue Docs**: https://docs.bullmq.io/
- **AWS KMS**: https://docs.aws.amazon.com/kms/
- **NestJS Queue**: https://docs.nestjs.com/techniques/queues
- **Prisma Transactions**: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
