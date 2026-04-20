# Gas Spike Handling - Implementation Guide 气体飙升处理 - 实施指南

## Quick Start 快速开始

### For End Users (用户使用)

If your withdrawal transaction is stuck on the blockchain:

1. **Check Status** - Get transaction status and recommendations
   ```bash
   GET /transactions/gas/status/{transactionId}
   Authorization: Bearer {JWT_TOKEN}
   ```

2. **Option A: Speed Up** - Increase gas price to expedite confirmation
   ```bash
   POST /transactions/gas/speed-up
   Authorization: Bearer {JWT_TOKEN}
   
   {
     "transactionId": "xxx",
     "multiplier": 1.5  // 1.1x to 3.0x allowed
   }
   ```

3. **Option B: Request Refund** (if stuck for 2+ hours)
   ```bash
   POST /transactions/gas/refund
   Authorization: Bearer {JWT_TOKEN}
   
   {
     "transactionId": "xxx",
     "reason": "Transaction stuck for extended period"
   }
   ```

---

## Architecture 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    TransactionsController                   │
├─────────────────────────────────────────────────────────────┤
│  POST /gas/speed-up      POST /gas/refund     GET /gas/status│
└────────────┬──────────────────┬──────────────────┬──────────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │   GasSpikeService          │
                  ├────────────────────────────┤
                  │  speedUpTransaction()      │
                  │  processRefund()           │
                  │  checkStuckTransactions()  │
                  │  getGasStatus()            │
                  └────────────┬───────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
        ┌───────────▼─────────┐  ┌──────▼────────────┐
        │ BlockchainService   │  │  PrismaService   │
        ├────────────────────┤  ├──────────────────┤
        │getCurrentGasPrice()│  │Transaction table │
        │speedUpWithdrawal() │  │GasSpeedUpAttempt │
        │processRefund()     │  │AuditLog table    │
        │estimateGasCost()   │  │                  │
        └────────────────────┘  └──────────────────┘
```

---

## Database Schema 数据库架构

### Transaction Model (with gas spike fields)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Transaction ID |
| `txHash` | String | Current transaction hash |
| `gasPrice` | Decimal | Initial gas price (wei) |
| `lastGasPrice` | Decimal | Latest gas price after speed-up |
| `speedUpAttempts` | Int | Number of speed-up attempts |
| `stuckSince` | DateTime | When marked as stuck |
| `refundStatus` | String | NONE/PENDING/COMPLETED |
| `refundTxHash` | String | Refund transaction hash |

### GasSpeedUpAttempt Model

Tracks each speed-up attempt with detailed history.

---

## State Machine 状态机

```
Transaction Status Flow:
========================

PENDING (0 confirmations)
   ↓
   ├─→ [After 1 hour] → STUCK_MARKED (stuckSince set)
   │
   ├─→ Speed Up (multiplier 1.1-3.0x)
   │   └─→ New TxHash + speedUpAttempts++
   │       └─→ Keep monitoring...
   │
   ├─→ Speed Up Success
   │   └─→ PENDING (0 confirmations) [with new txHash]
   │       └─→ COMPLETED (when enough confirmations)
   │
   ├─→ Manual Refund (if stuck 2+ hours)
   │   └─→ REFUNDED (status)
   │       └─→ Amount restored to available balance
   │
   └─→ Normal Flow
       └─→ COMPLETED (when enough confirmations)

Refund Eligibility:
===================
- Transaction must be WITHDRAW type
- Must be marked as stuck (stuckSince is not null)
- Must be stuck for minimum 2 hours
- refundStatus must be NONE
```

---

## Cron Jobs 定时任务

### 1. Check Pending Transactions
```
Schedule: Every 10 seconds
Action:   Update confirmation count
          Mark as COMPLETED when ready
```

### 2. Check Stuck Transactions  
```
Schedule: Every minute
Action:   Find pending txs with 0 confirmations for 1+ hour
          Mark as stuck (set stuckSince)
```

---

## Error Scenarios & Solutions 错误情景和解决方案

### Scenario 1: Transaction Pending 30+ Minutes
```json
GET /transactions/gas/status/{id}
Response:
{
  "canSpeedUp": true,
  "recommendations": [
    "Transaction has been pending for 30+ minutes. Consider speeding up..."
  ]
}

Action: POST /transactions/gas/speed-up with multiplier 1.5x
```

### Scenario 2: Max Speed-Up Attempts Reached
```json
{
  "speedUpAttempts": 5,
  "maxSpeedUpAttempts": 5,
  "canSpeedUp": false,
  "recommendations": [
    "Maximum speed-up attempts reached. Consider requesting a refund."
  ]
}

Action: Wait 2+ hours then POST /transactions/gas/refund
```

### Scenario 3: Speed-Up Successful
```json
POST /transactions/gas/speed-up
{
  "transactionId": "tx-123",
  "multiplier": 1.5
}

Response (Success):
{
  "message": "Transaction speed-up initiated successfully.",
  "newTxHash": "0x1234...",
  "speedUpCost": "0.005000"
}

→ System monitors new transaction
→ When confirmed: Transaction marked COMPLETED
→ Amount transferred to user wallet
```

### Scenario 4: Refund Processed
```json
POST /transactions/gas/refund
{
  "transactionId": "tx-123",
  "reason": "Stuck 3 hours, no confirmation"
}

Response (Success):
{
  "message": "Refund processed successfully.",
  "refundTxHash": "0x5678...",
  "refundAmount": "1000.000000"
}

→ Original transaction replaced on-chain
→ Amount restored to user's available balance
→ User can withdraw again
```

---

## Configuration Guide 配置指南

### Default Settings (in GasSpikeService)

```typescript
STUCK_TIMEOUT_MS = 60 * 60 * 1000        // Mark as stuck after 1 hour
MAX_SPEED_UP_ATTEMPTS = 5                 // Max 5 speed-up attempts
MIN_GAS_MULTIPLIER = 1.1                  // Min 1.1x increase
MAX_GAS_MULTIPLIER = 3.0                  // Max 3.0x increase
REFUND_MIN_DURATION = 2 * 60 * 60 * 1000  // Minimum 2 hours before refund
```

### To Adjust Settings

Edit `src/modules/assets/services/gas-spike.service.ts`:

```typescript
// Example: Change max attempts to 10
private readonly MAX_SPEED_UP_ATTEMPTS = 10;

// Example: Change stuck timeout to 30 minutes
private readonly STUCK_TIMEOUT_MS = 30 * 60 * 1000;

// Then rebuild: npm run build
```

---

## Testing Guide 测试指南

### Unit Test Example

```typescript
describe('GasSpikeService', () => {
  it('should speed up transaction with 1.5x multiplier', async () => {
    const result = await gasSpikeService.speedUpTransaction({
      transactionId: 'tx-123',
      multiplier: 1.5,
    });
    
    expect(result.newTxHash).toBeDefined();
    expect(result.speedUpCost).toBeDefined();
  });

  it('should reject speed-up if max attempts reached', async () => {
    // Setup: transaction with 5 speed-up attempts already
    
    await expect(
      gasSpikeService.speedUpTransaction({
        transactionId: 'tx-stuck',
        multiplier: 1.5,
      })
    ).rejects.toThrow('Maximum speed-up attempts');
  });

  it('should process refund if stuck 2+ hours', async () => {
    // Setup: transaction stuck since 2+ hours ago
    
    const result = await gasSpikeService.processRefund({
      transactionId: 'tx-stuck',
      reason: 'Test refund',
    });
    
    expect(result.refundTxHash).toBeDefined();
    expect(tx.refundStatus).toBe('COMPLETED');
  });
});
```

### Integration Test - Full Workflow

```typescript
describe('Gas Spike Workflow', () => {
  it('should handle stuck transaction -> speed up -> completion', async () => {
    // 1. Create withdrawal
    const tx = await transactionsService.requestWithdraw(
      userId,
      { amount: '1000' }
    );
    
    // 2. Approve withdrawal
    await transactionsService.approveWithdraw(adminId, tx.id);
    
    // 3. Wait 1+ hour (simulate time passing)
    jest.useFakeTimers();
    jest.advanceTimersByTime(61 * 60 * 1000);
    
    // 4. Check if marked as stuck
    await transactionsCron.checkStuckTransactions();
    const stuckTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(stuckTx.stuckSince).toBeDefined();
    
    // 5. Speed up
    const speedUpResult = await gasSpikeService.speedUpTransaction({
      transactionId: tx.id,
      multiplier: 1.5,
    });
    expect(speedUpResult.newTxHash).toBeDefined();
    
    // 6. Verify new attempt recorded
    const attempts = await prisma.gasSpeedUpAttempt.findMany({
      where: { transactionId: tx.id },
    });
    expect(attempts.length).toBe(1);
  });
});
```

---

## Monitoring & Alerting 监控和告警

### Key Metrics to Track

1. **Stuck Transactions**
   ```sql
   SELECT COUNT(*) 
   FROM Transaction 
   WHERE status = 'PENDING' AND stuckSince IS NOT NULL
   ```

2. **Speed-Up Success Rate**
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM GasSpeedUpAttempt WHERE status = 'COMPLETED') /
     (SELECT COUNT(*) FROM GasSpeedUpAttempt) * 100 as success_rate
   ```

3. **Average Speed-Up Multiplier**
   ```sql
   SELECT AVG(newGasPrice / oldGasPrice) as avg_multiplier
   FROM GasSpeedUpAttempt
   ```

4. **Refund Rate**
   ```sql
   SELECT COUNT(*) 
   FROM Transaction 
   WHERE refundStatus = 'COMPLETED'
   ```

---

## Troubleshooting 故障排除

### Issue: Speed-up fails with "Failed to speed up transaction on chain"

**Causes:**
- Network RPC unreachable
- Insufficient balance for higher gas
- Invalid transaction hash

**Solutions:**
1. Check `CHAIN_RPC_URL` is accessible
2. Verify signer account has sufficient balance
3. Confirm transaction hash exists on chain

### Issue: Transaction stays PENDING after speed-up

**Causes:**
- Network congestion still high
- Gas price increased but still too low
- Transaction not properly broadcasted

**Solutions:**
1. Try speed-up again with 2.0x multiplier
2. Check blockchain explorer for transaction status
3. Review logs for blockchain service errors

### Issue: Refund endpoint returns "Transaction must be stuck for at least 2 hours"

**Causes:**
- Transaction hasn't been stuck long enough
- stuckSince timestamp not set properly

**Solutions:**
1. Wait until 2-hour mark
2. Check if transaction is actually stuck (0 confirmations)
3. Verify system cron job ran and marked transaction

---

## Performance Considerations 性能注意事项

1. **Cron Job Load**
   - `checkPendingTransactions`: Runs every 10 seconds, processes all PENDING txs
   - `checkStuckTransactions`: Runs every 60 seconds, marks stuck txs
   - Estimated impact: ~50-100ms per run for 100 pending transactions

2. **Database Indexes**
   - Ensure indexes on:
     - `Transaction(status, txHash)` - for pending lookup
     - `Transaction(status, stuckSince)` - for stuck lookup
     - `GasSpeedUpAttempt(transactionId)` - for speed-up history

3. **Blockchain RPC Calls**
   - `getTransactionConfirmations`: 1 call per pending transaction
   - `estimateGas`: On-demand only (during speed-up)
   - `getCurrentGasPrice`: 1 call per speed-up request

---

## Security Considerations 安全考虑

1. **Access Control**
   - Users can only speed-up/refund their own transactions
   - Validate `userId` from JWT matches transaction owner

2. **Replay Protection**
   - Each speed-up creates new transaction with unique nonce
   - Previous transaction automatically replaced on-chain

3. **Price Validation**
   - Multiplier clamped to 1.1x - 3.0x range
   - Admin controls acceptable gas price range via configuration

4. **Audit Logging**
   - All speed-up and refund operations logged
   - Includes user ID, timestamp, gas prices, transaction hashes

---

## References & Resources

- [Gas Spike Handling Documentation](./GAS_SPIKE_HANDLING.md)
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [EIP-1559 Gas Model](https://ethereum.org/en/developers/docs/gas/)
- [Transaction Replacement (RBF)](https://en.bitcoin.it/wiki/Transaction_replacement)
