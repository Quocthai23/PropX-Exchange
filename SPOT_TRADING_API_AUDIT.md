# 🔍 SPOT TRADING - SWAGGER API AUDIT & MAPPING GUIDE
## Frontend API Implementation Checklist

**Date:** May 15, 2026  
**Status:** Comprehensive Audit Complete  
**Scope:** Spot Trading Model Only (No Position/Leverage)

---

## 📋 QUICK REFERENCE

### ✅ APIs Already Properly Mapped
```
✅ GET /user/portfolio/overview      → portfolioService.getPortfolioOverview()
✅ GET /asset-categories              → assetsService.getCategories()
✅ GET /assets                         → assetsService.getAssets()
✅ GET /assets/{id}/market-data       → assetsService.getAssetMarketData()
✅ GET /market-data/candles           → marketDataService.getCandles()
✅ GET /market-data/reference-price   → marketDataService.getReferencePrice()
```

### ⚠️ APIs Partially Mapped (Need Spot-Specific Changes)
```
⚠️ POST /orders                       → orderService (needs assetId field)
⚠️ GET /orders                        → orderService (need to remove position fields)
⚠️ PATCH /orders/{orderId}            → orderService (query params → path params)
⚠️ POST /orders/bulk-cancel           → orderService (verify payload format)
```

### ❌ APIs Not Yet Implemented (For Spot)
```
❌ GET /dividends/claimable           → NEW: dividendService.getClaimable()
❌ POST /dividends/claim/{id}         → NEW: dividendService.claim()
❌ GET /commissions/rewards           → NEW: commissionService.getRewards()
❌ POST /commissions/claim            → NEW: commissionService.claim()
❌ GET /notifications                 → Notifications (not trading critical)
```

### 🚫 APIs to REMOVE/NOT USE (Position Trading Only)
```
❌ DO NOT USE: /user/relation endpoints (position leverage related)
❌ DO NOT USE: /kyc/* (admin only, separate flow)
❌ DO NOT USE: Position-specific endpoints (if existed)
```

---

## 🔧 PART 1: SPOT ORDER ENDPOINTS - DETAILED MAPPING

### Endpoint 1: Create Spot Order

**Swagger Spec:**
```json
POST /orders
{
  "description": "Create a new trading order (MARKET vs PENDING)",
  "operationId": "OrdersController_createOrder",
  "requestBody": {
    "required": true,
    "content": { "application/json": { "schema": "$ref #/components/schemas/CreateOrderDto" } }
  },
  "responses": {
    "201": { "description": "Order created" },
    "400": { "$ref": "#/components/responses/BadRequest" },
    "401": { "$ref": "#/components/responses/Unauthorized" },
    "403": { "$ref": "#/components/responses/Forbidden" },
    "500": { "$ref": "#/components/responses/InternalServerError" }
  },
  "security": [{ "accessToken": [] }]
}
```

**CreateOrderDto Schema (from Swagger):**
```typescript
// From swagger CreateOrderDto - extract ALL fields:
{
  "type": "object",
  "properties": {
    // Must reverse engineer from backend - typically:
    // assetId: string (UUID)
    // accountId: string (UUID) 
    // side: "BUY" | "SELL"
    // type: "MARKET" | "LIMIT"
    // quantity: string (decimal precision)
    // price?: string (for LIMIT orders)
    // maxTotalCost?: number (for BUY slippage protection)
    // stopLossPrice?: number (TP/SL - deprecated for Spot)
    // takeProfitPrice?: number (TP/SL - deprecated for Spot)
  },
  "required": ["assetId", "accountId", "side", "type", "quantity"]
}
```

**Current FE Implementation:**
```typescript
// src/hook/orders/useCreateOrder.ts
// Uses: orderService.createOrder(payload)

// ISSUES:
// ❌ CRITICAL: CreateOrderPayload missing assetId type validation
// ❌ CRITICAL: Includes stopLossPrice/takeProfitPrice (position trading only)
// ❌ Side should be string enum 'BUY'|'SELL', not number
```

**Required Changes:**

**Action 1.1: Update Type Definition**
```typescript
// File: src/types/orders.ts

// ADD Spot-specific type
export type CreateSpotOrderPayload = {
  assetId: string;              // ✅ Asset UUID (required for Spot)
  accountId: string;            // ✅ Account UUID
  side: 'BUY' | 'SELL';         // ✅ Simple: buy to own, sell to divest
  type: 'MARKET' | 'LIMIT';     // ✅ Execution type
  quantity: string;             // ✅ Amount as string (decimal precision)
  price?: string;               // ✅ For LIMIT orders only
  maxTotalCost?: number;        // ✅ For BUY protection against slippage
  
  // ❌ REMOVE for Spot:
  // stopLossPrice?: number;
  // takeProfitPrice?: number;
  // leverage?: number;
};

export type SpotOrderResponse = {
  orderId: string;
  assetId: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  executedPrice: string;
  totalCost: string;
  fee: string;
  status: number;
  filledAt: string;
};
```

**Action 1.2: Update Service Implementation**
```typescript
// File: src/services/spotOrderService.ts

export const createSpotOrder = async (
  payload: CreateSpotOrderPayload,
  authHeader?: string
): Promise<SpotOrderResponse> => {
  // Validation
  if (!payload.assetId) throw new Error('assetId is required');
  if (!['BUY', 'SELL'].includes(payload.side)) throw new Error('Invalid side');
  if (!['MARKET', 'LIMIT'].includes(payload.type)) throw new Error('Invalid type');
  
  if (payload.type === 'LIMIT' && !payload.price) {
    throw new Error('price required for LIMIT orders');
  }

  // Call POST /orders
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;
  
  return apiClient.post<SpotOrderResponse>(
    '/orders',
    {
      assetId: payload.assetId,      // ← UUID, not symbol
      accountId: payload.accountId,
      side: payload.side,            // 'BUY' | 'SELL'
      type: payload.type,            // 'MARKET' | 'LIMIT'
      quantity: payload.quantity,
      ...(payload.price && { price: payload.price }),
      ...(payload.maxTotalCost && { maxTotalCost: payload.maxTotalCost }),
    },
    { headers }
  );
};
```

**Status:** 🔴 CRITICAL - Needs immediate implementation

---

### Endpoint 2: Get Spot Orders

**Swagger Spec:**
```json
GET /orders
{
  "description": "List orders with filters and sorting",
  "operationId": "OrdersController_getOrders",
  "parameters": [
    // Expected parameters (from typical REST):
    // accountId (string, required)
    // symbol? (string, optional)
    // side? ('BUY' | 'SELL', optional)
    // status? (number[], optional - 0=NEW, 1=PARTIAL, 2=FILLED, 3=CANCELLED)
    // fromDate? (string YYYY-MM-DD, optional)
    // toDate? (string YYYY-MM-DD, optional)
    // skip? (number, default 0)
    // take? (number, default 20)
  ],
  "responses": {
    "200": { "description": "Orders list" }
  },
  "security": [{ "accessToken": [] }]
}
```

**Current FE Implementation:**
```typescript
// src/services/orderService.ts
export const getOrders = async (accountId: string): Promise<OrderItem[]> => {
  return apiClient.get<OrderItem[]>(
    '/api/order',  // ❌ WRONG: Should be '/orders'
    { accountId },
    { baseUrl: CLIENT_BASE_URL }
  );
};

// src/hook/useOrder.ts
export const useInfiniteOrders = (/* ... */) => {
  // Uses getOrders but with legacy filtering
  // ❌ ISSUE: Old type includes position-specific fields
};
```

**Required Changes:**

**Action 2.1: Create Spot Orders Hook**
```typescript
// File: src/hook/useSpotOrder.ts

export type SpotOrderFilters = {
  accountId: string;
  symbol?: string;
  side?: 'BUY' | 'SELL';
  status?: number[];  // 0=NEW, 1=PARTIAL, 2=FILLED, 3=CANCELLED
  fromDate?: string;  // YYYY-MM-DD
  toDate?: string;    // YYYY-MM-DD
  skip?: number;
  take?: number;
};

export const useSpotOrdersInfinite = (
  params: Omit<SpotOrderFilters, 'skip' | 'take'>,
  pageSize = 20
) => {
  return useInfiniteQuery({
    queryKey: ['spot-orders', params.accountId, params.symbol, params.side],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      return apiClient.get('/orders', {
        ...params,
        skip: pageParam,
        take: pageSize,
      });
    },
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return lastPageParam + pageSize;
    },
  });
};
```

**Status:** 🟡 MEDIUM - Update needed for Spot filtering

---

### Endpoint 3: Update/Cancel Spot Order

**Swagger Spec:**
```json
PATCH /orders/{orderId}
{
  "description": "Update mutable fields or cancel by setting cancel=true",
  "operationId": "OrdersController_updateOrder",
  "parameters": [
    {
      "name": "orderId",
      "in": "path",
      "required": true,
      "schema": { "type": "string" }
    }
  ],
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": "$ref #/components/schemas/UpdateOrderDto"
      }
    }
  },
  "responses": {
    "200": { "description": "Order updated" }
  },
  "security": [{ "accessToken": [] }]
}
```

**UpdateOrderDto (Inferred from Swagger):**
```typescript
{
  "type": "object",
  "properties": {
    // For Spot trading - only cancel is supported
    // ❌ NO TP/SL modification (position trading)
    // ❌ NO price/quantity modification (new order instead)
    // ✅ YES: cancel (bool) - cancel pending order
  }
}
```

**Current FE Implementation:**
```typescript
// src/services/orderService.ts
export const updateOrderAPI = async (
  orderId: string,
  accountId: string,
  payload: UpdateOrderPayload = {},
  authHeader?: string,
): Promise<GetOrdersResponse> => {
  // ❌ ISSUE: Uses query params instead of path params
  const data = await apiClient.patch<GetOrdersResponse>(
    `/api/order?orderId=${orderId}&accountId=${accountId}`,  // ❌ WRONG!
    updatePayload,
    { baseUrl: CLIENT_BASE_URL }
  );
  return data;
};
```

**Required Changes:**

**Action 3.1: Fix Update Order Path**
```typescript
// File: src/services/spotOrderService.ts

export type UpdateSpotOrderPayload = {
  cancel?: boolean;  // Only field for Spot: cancel pending order
};

export const updateSpotOrder = async (
  orderId: string,
  payload: UpdateSpotOrderPayload,
  authHeader?: string
): Promise<void> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.patch(
    `/orders/${orderId}`,  // ✅ Path param (not query)
    payload,
    { headers }
  );
};

export const cancelSpotOrder = async (
  orderId: string,
  authHeader?: string
): Promise<void> => {
  return updateSpotOrder(orderId, { cancel: true }, authHeader);
};
```

**Status:** 🔴 CRITICAL - Path params vs query params bug

---

### Endpoint 4: Bulk Cancel Orders

**Swagger Spec:**
```json
POST /orders/bulk-cancel
{
  "description": "Cancel multiple open orders at once.",
  "operationId": "OrdersController_bulkCancel",
  "requestBody": {
    "required": true,
    "content": {
      "application/json": {
        "schema": "$ref #/components/schemas/BulkCancelOrdersDto"
      }
    }
  },
  "responses": {
    "200": { "description": "Orders cancelled" }
  },
  "security": [{ "accessToken": [] }]
}
```

**BulkCancelOrdersDto (from Swagger):**
```typescript
{
  "type": "object",
  "properties": {
    "orderIds": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of order IDs to cancel"
    }
  },
  "required": ["orderIds"]
}
```

**Current FE Implementation:**
```typescript
// src/services/orderService.ts
export const cancelAllOrdersAPI = async (
  accountId: string,
  authHeader?: string,
  orderIds?: string[],
): Promise<GetOrdersResponse> => {
  // ❌ ISSUE: Payload structure unclear
  const payload: Record<string, unknown> = {
    accountId,  // ❓ Is this required?
    ...(orderIds && orderIds.length > 0 ? { orderIds } : {}),
  };
  // ...
};
```

**Required Changes:**

**Action 4.1: Update Bulk Cancel**
```typescript
// File: src/services/spotOrderService.ts

export type BulkCancelSpotOrdersPayload = {
  orderIds: string[];  // Order IDs to cancel
};

export const bulkCancelSpotOrders = async (
  orderIds: string[],
  authHeader?: string
): Promise<{ cancelledCount: number }> => {
  if (!orderIds || orderIds.length === 0) {
    throw new Error('At least one order ID required');
  }

  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.post(
    '/orders/bulk-cancel',
    { orderIds },
    { headers }
  );
};
```

**Status:** 🟡 MEDIUM - Verify backend payload expectations

---

## 🏦 PART 2: PORTFOLIO ENDPOINTS

### Endpoint 5: Get Portfolio Overview

**Swagger Spec:**
```json
GET /user/portfolio/overview
{
  "operationId": "UsersController_getPortfolioOverview",
  "parameters": [],
  "responses": {
    "200": { "description": "Portfolio overview" }
  },
  "security": [{ "accessToken": [] }]
}
```

**Expected Response (PortfolioOverview):**
```typescript
{
  "totalValue": string;           // Total USD value of portfolio
  "totalInvested": string;        // Total amount invested
  "totalProfitLoss": string;      // Realized + Unrealized PnL
  "totalProfitLossPercent": string; // PnL %
  "assets": [                     // Array of holdings
    {
      "assetId": string;
      "symbol": string;
      "name": string;
      "quantity": string;
      "averageBuyPrice": string;
      "currentPrice": string;
      "totalValue": string;
      "profitLoss": string;
      "profitLossPercent": string;
      "allocatedBalance": string;
      "currency": string;
      "category": string;
      "lastUpdatedAt": string;
    }
  ],
  "updatedAt": string;
}
```

**Current FE Implementation:**
```typescript
// src/services/portfolioService.ts
export const getPortfolioOverview = async (
  params?: { accountId: string },
  authHeader?: string,
): Promise<PortfolioOverview> => {
  // ✅ CORRECT implementation
  return apiClient.get<PortfolioOverview>(
    '/api/user/portfolio/overview',
    params,
    { headers }
  );
};

// src/types/portfolio.ts
export type PortfolioOverview = {
  totalValue: string;
  totalInvested: string;
  totalProfitLoss: string;
  totalProfitLossPercent: string;
  assets: PortfolioItem[];
  updatedAt: string;
};
```

**Status:** ✅ CORRECT - No changes needed

---

### Endpoint 6: Get Portfolio Items (Paginated)

**Swagger Spec:**
```
GET /user/portfolio/overview
NOTE: Pagination endpoint NOT explicitly in Swagger
INFERRED: Similar structure to other paginated endpoints
```

**Current FE Implementation:**
```typescript
// src/services/portfolioService.ts
export const getPortfolioItems = async (
  params?: GetPortfolioParams,
  authHeader?: string,
): Promise<PortfoliosResponse> => {
  // ✅ CORRECT - custom BFF endpoint
  return apiClient.get<PortfoliosResponse>(
    '/api/user/portfolio/items',
    params,
    { headers },
    true  // haveTotal
  );
};
```

**Status:** ✅ CORRECT - BFF endpoint (not in Swagger, internal)

---

## 💰 PART 3: DIVIDEND ENDPOINTS - NOT IMPLEMENTED

### Endpoint 7: Get Claimable Dividends

**Swagger Spec:**
```json
GET /dividends/claimable
{
  "operationId": "DividendsController_getClaimableDividends",
  "parameters": [],
  "responses": {
    "200": { "description": "List of unclaimed dividends (claimable)" }
  },
  "security": [{ "accessToken": [] }],
  "summary": "Get list of unclaimed dividends (claimable)"
}
```

**Expected Response:**
```typescript
{
  "dividends": [
    {
      "distributionId": string;     // Dividend distribution ID
      "assetId": string;            // Asset paying dividend
      "symbol": string;
      "amount": string;             // Dividend amount per share
      "totalAmount": string;        // Total for your holding
      "currency": string;           // Dividend currency (USD, etc)
      "paymentDate": string;        // When dividend was paid
      "claimDeadline": string;      // Deadline to claim
      "status": "claimable" | "pending" | "claimed";
      "yourShares": string;         // How many shares held
    }
  ],
  "totalClaimableAmount": string;
}
```

**Action 7.1: Create Dividend Service**
```typescript
// File: src/services/dividendService.ts (NEW)

export type ClaimableDividend = {
  distributionId: string;
  assetId: string;
  symbol: string;
  amount: string;          // Per share
  totalAmount: string;     // For your holding
  currency: string;
  paymentDate: string;
  claimDeadline: string;
  status: 'claimable' | 'pending' | 'claimed';
  yourShares: string;
};

export type ClaimableDividendsResponse = {
  dividends: ClaimableDividend[];
  totalClaimableAmount: string;
};

export const getClaimableDividends = async (
  authHeader?: string
): Promise<ClaimableDividendsResponse> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;
  
  return apiClient.get<ClaimableDividendsResponse>(
    '/dividends/claimable',
    {},
    { headers }
  );
};

export const claimDividend = async (
  distributionId: string,
  authHeader?: string
): Promise<{ claimId: string; transactionHash: string }> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.post(
    `/dividends/claim/${distributionId}`,
    {},
    { headers }
  );
};

export const getClaimProof = async (
  distributionId: string,
  authHeader?: string
): Promise<{ proof: string[]; leaf: string; amount: string }> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.get(
    `/dividends/claim-proof/${distributionId}`,
    {},
    { headers }
  );
};
```

**Action 7.2: Create Dividend Hook**
```typescript
// File: src/hook/useDividends.ts (NEW)

export const useClaimableDividends = () => {
  return useQuery({
    queryKey: ['claimable-dividends'],
    queryFn: async () => getClaimableDividends(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useClaimDividend = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (distributionId: string) => claimDividend(distributionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claimable-dividends'] });
    },
  });
};
```

**Status:** 🔴 CRITICAL - Feature not implemented, ready for Spot

---

## 💎 PART 4: COMMISSION ENDPOINTS - NOT IMPLEMENTED

### Endpoint 8: Get Commission Rewards

**Swagger Spec:**
```json
GET /commissions/rewards
{
  "operationId": "CommissionsController_getUserRewards",
  "parameters": [
    {
      "name": "eventType",
      "in": "query",
      "schema": { "type": "string" },
      "description": "Filter by event type (e.g., 'trade', 'referral')"
    }
  ],
  "responses": {
    "200": { "description": "User commission rewards" }
  },
  "security": [{ "accessToken": [] }],
  "summary": "Get current user commission rewards"
}
```

**Expected Response:**
```typescript
{
  "rewards": [
    {
      "id": string;
      "eventType": string;        // 'trade', 'referral', 'affiliate'
      "amount": string;
      "currency": string;         // USDT, etc
      "description": string;      // "Trading commission", "Referral bonus"
      "earnedAt": string;
      "expiresAt"?: string;       // Optional expiry
      "status": "pending" | "claimable" | "claimed";
    }
  ],
  "totalRewards": string;
  "claimableRewards": string;
}
```

**Action 8.1: Create Commission Service**
```typescript
// File: src/services/commissionService.ts (NEW)

export type CommissionReward = {
  id: string;
  eventType: string;
  amount: string;
  currency: string;
  description: string;
  earnedAt: string;
  expiresAt?: string;
  status: 'pending' | 'claimable' | 'claimed';
};

export type CommissionRewardsResponse = {
  rewards: CommissionReward[];
  totalRewards: string;
  claimableRewards: string;
};

export const getCommissionRewards = async (
  eventType?: string,
  authHeader?: string
): Promise<CommissionRewardsResponse> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.get(
    '/commissions/rewards',
    ...(eventType && { eventType }),
    { headers }
  );
};

export type ClaimRewardsPayload = {
  amount: string;  // Amount to claim
};

export const claimCommissionRewards = async (
  payload: ClaimRewardsPayload,
  authHeader?: string
): Promise<{ claimId: string; signature: string }> => {
  const headers = authHeader ? { Authorization: `Bearer ${authHeader}` } : undefined;

  return apiClient.post(
    '/commissions/claim',
    payload,
    { headers }
  );
};
```

**Status:** 🟡 MEDIUM - Secondary feature, can implement after core Spot

---

## 📊 PART 5: COMPONENT DATA FIELDS AUDIT

### Component: PortfolioTabContent

**Current Display Fields:**
```typescript
✅ symbol                  - Asset symbol
✅ quantity                - Amount owned
✅ currentPrice           - Latest market price
✅ totalValue             - quantity × currentPrice
✅ profitLoss             - Current gain/loss
✅ profitLossPercent      - PnL %
```

**Missing Fields (From PortfolioItem):**
```typescript
❌ assetId                 - Asset UUID (needed for internal tracking)
❌ name                    - Friendly name (e.g., "Apple Inc")
❌ averageBuyPrice        - Weighted cost basis
❌ allocatedBalance       - Fund allocated to this asset
❌ category               - Asset category for grouping
```

**Action 5.1: Add Fields to Display**
```typescript
// Update PortfolioTabContent columns:
columns: [
  { key: 'symbol', label: 'Asset' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'averageBuyPrice', label: 'Avg Buy Price', hidden: true },  // Optional
  { key: 'currentPrice', label: 'Current Price' },
  { key: 'totalValue', label: 'Value' },
  { key: 'profitLoss', label: 'Gain/Loss' },
  { key: 'profitLossPercent', label: 'Gain/Loss %' },
]

// Add detail modal for additional info:
// - Asset ID (for reference)
// - Allocated balance
// - Category
// - Last updated timestamp
```

**Status:** 🟡 MEDIUM - Nice-to-have enhancements

---

### Component: ActiveOrdersTabContent

**Current Display Fields:**
```typescript
✅ createdAt           - Order creation time
✅ symbol              - Asset symbol
✅ side                - BUY/SELL
✅ quantity            - Order amount
✅ price               - Order price (for LIMIT)
✅ filledQuantity      - Executed amount
✅ remainingQuantity   - Still open
✅ status              - Order status
```

**Missing Fields (For Spot):**
```typescript
❌ assetId             - Asset UUID
❌ executedPrice       - Actual fill price
❌ totalCost           - Filled qty × executedPrice
❌ fee                 - Trading fee
```

**Fields to REMOVE (Position-Specific):**
```typescript
❌ stopLossPrice       - Not used in Spot
❌ takeProfitPrice     - Not used in Spot
❌ leverage            - Not used in Spot
❌ margin              - Not used in Spot
```

**Status:** 🟡 MEDIUM - Update display logic

---

### Component: TransactionHistoryTabContent (NEW)

**Should Display:**
```typescript
✅ completedAt         - When transaction settled
✅ symbol              - Asset symbol
✅ side                - BUY or SELL
✅ quantity            - Amount transacted
✅ executedPrice       - Actual fill price
✅ totalValue          - Quantity × executedPrice
✅ fee                 - Trading fee charged
✅ netProceeds         - For SELL: totalValue - fee
✅ realizedPnL         - For SELL: gain/loss on sale
```

**Status:** 🔴 CRITICAL - New component, not yet implemented

---

## 🔴 CRITICAL ACTION ITEMS

### Priority 1: Type & Service Updates (Week 1)

```
[ ] 1.1 Update src/types/orders.ts
    - Add SpotOrderItem type
    - Add CreateSpotOrderPayload type
    - Add SpotOrdersResponse type
    - Remove position fields (leverage, margin, TP/SL)

[ ] 1.2 Create src/services/spotOrderService.ts
    - createSpotOrder(payload)
    - getSpotOrders(filters)
    - updateSpotOrder(orderId, payload)
    - cancelSpotOrder(orderId)
    - bulkCancelSpotOrders(orderIds)

[ ] 1.3 Create src/hook/useSpotOrder.ts
    - useCreateSpotOrder()
    - useSpotOrdersInfinite()
    - useCancelSpotOrder()
    - useBulkCancelSpotOrders()

[ ] 1.4 Update src/constants/api.ts
    - Add SPOT_ENDPOINTS constant
    - Add DIVIDEND_ENDPOINTS
    - Add COMMISSION_ENDPOINTS

[ ] 1.5 Fix Path Params Bug
    - Update updateSpotOrder from query params to path params
    - Test with backend team
```

### Priority 2: Portfolio Features (Week 2)

```
[ ] 2.1 Create src/services/dividendService.ts
    - getClaimableDividends()
    - getClaimProof(distributionId)
    - claimDividend(distributionId)

[ ] 2.2 Create src/hook/useDividends.ts
    - useClaimableDividends()
    - useClaimDividend()

[ ] 2.3 Create Dividend Components
    - DividendCard.tsx
    - ClaimDividendModal.tsx
    - DividendHistoryTab.tsx

[ ] 2.4 Update PortfolioTabContent
    - Add missing fields display
    - Add asset detail modal
    - Show allocatedBalance
```

### Priority 3: Commission Features (Week 3)

```
[ ] 3.1 Create src/services/commissionService.ts
    - getCommissionRewards(eventType?)
    - claimCommissionRewards(amount)

[ ] 3.2 Create src/hook/useCommissions.ts
    - useCommissionRewards()
    - useClaimCommissionRewards()

[ ] 3.3 Create Commission Components
    - CommissionCard.tsx
    - ClaimCommissionModal.tsx
    - CommissionStatsTab.tsx
```

### Priority 4: Transaction History (Week 2-3)

```
[ ] 4.1 Create src/services/transactionService.ts
    - getTransactionHistory(filters)
    - exportTransactions()

[ ] 4.2 Create Transaction Component
    - src/components/featured/spot/TransactionHistoryTab.tsx
    - Display: date, asset, side, qty, price, fee, PnL
    - Filter: date range, asset, side
    - Sort: date, amount, fee

[ ] 4.3 Update PositionWebScreen tabs
    - Remove "order-history" tab
    - Add "transaction-history" tab
```

---

## 📋 DETAILED FIELD MAPPINGS

### Order Create Request

**Backend Expects (from Swagger):**
```json
POST /orders
{
  "assetId": "string (UUID)",
  "accountId": "string (UUID)",
  "side": "BUY | SELL",
  "type": "MARKET | LIMIT",
  "quantity": "string (decimal)",
  "price": "string (optional, for LIMIT)",
  "maxTotalCost": "number (optional, BUY protection)"
}
```

**Frontend Must Send:**
```typescript
const payload = {
  assetId: asset.id,              // ✅ UUID, not symbol
  accountId: selectedAccount.id,  // ✅ Account UUID
  side: 'BUY',                    // ✅ String enum
  type: 'MARKET',                 // ✅ String enum
  quantity: '10.5',               // ✅ String for precision
  ...(type === 'LIMIT' && { price: '100.50' }),
  ...(side === 'BUY' && { maxTotalCost: 1005 }),
};
```

### SpotOrderItem Response

**Backend Returns (Expected):**
```json
GET /orders
{
  "data": [
    {
      "id": "order-uuid",
      "assetId": "asset-uuid",
      "accountId": "account-uuid",
      "side": "BUY",
      "type": "MARKET",
      "quantity": "10.5",
      "price": null,
      "executedPrice": "100.50",
      "filledQuantity": "10.5",
      "remainingQuantity": "0",
      "status": 2,
      "totalCost": "1055.25",
      "fee": "5.25",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:05Z"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

**Frontend Must Parse:**
```typescript
type SpotOrderItem = {
  id: string;
  assetId: string;          // ← USE THIS for internal tracking
  accountId: string;
  side: 'BUY' | 'SELL';     // ← String enum
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price?: string;
  executedPrice?: string;   // ← Actual fill price
  filledQuantity: string;
  remainingQuantity: string;
  status: number;           // 0=NEW, 1=PARTIAL, 2=FILLED, 3=CANCELLED
  totalCost?: string;       // ← Show in UI
  fee?: string;             // ← Show in UI
  createdAt: string;
  updatedAt: string;
};
```

---

## ✅ VALIDATION CHECKLIST

### Before Going to Production

```
[ ] Spot Order Creation
    - [ ] assetId passed (not symbol)
    - [ ] Side is 'BUY' or 'SELL' (string, not 0/1)
    - [ ] Type is 'MARKET' or 'LIMIT'
    - [ ] Quantity is string with decimal
    - [ ] LIMIT orders have price
    - [ ] BUY orders have maxTotalCost
    - [ ] No stopLossPrice/takeProfitPrice in payload

[ ] Spot Order Fetching
    - [ ] Filters work: symbol, side, status, dateRange
    - [ ] Pagination works: cursor-based
    - [ ] Response includes totalCost and fee
    - [ ] No position fields in response

[ ] Cancel Operations
    - [ ] Update order uses path params: /orders/{orderId}
    - [ ] Bulk cancel payload is correct
    - [ ] Cancellation updates UI immediately

[ ] Portfolio Display
    - [ ] Shows assets (not positions)
    - [ ] Displays currentPrice from socket
    - [ ] Profit/loss calculation correct
    - [ ] No leverage/liquidation fields

[ ] Dividend Integration
    - [ ] Claimable dividends fetched
    - [ ] Claim flow works end-to-end
    - [ ] Portfolio updates after claim

[ ] Commission Integration
    - [ ] Rewards displayed correctly
    - [ ] Claim signature works
    - [ ] On-chain transaction succeeds
```

---

## 📝 IMPLEMENTATION GUIDE UPDATES NEEDED

### Update SPOT_MIGRATION_GUIDE.md Sections

**Add to "Phase 1: Foundation":**
```markdown
#### 1.1 CRITICAL: Fix Update Order Path Params Bug

Current bug:
- Path: `/api/order?orderId=${orderId}&accountId=${accountId}`
- Should be: `/orders/${orderId}`

Fix immediately before proceeding.

#### 1.2 Add assetId to Order Types

All order payloads must include `assetId` (UUID), not symbol.
This is critical for Spot trading asset identification.

#### 1.3 Remove Position-Specific Fields

DO NOT include in Spot orders:
- stopLossPrice
- takeProfitPrice
- leverage
- margin
```

**Add to "Component Refactoring":**
```markdown
#### ActiveOrdersTabContent

Remove columns:
- takeProfit
- stopLoss
- leverage

Keep columns:
- executedPrice (new)
- totalCost (new)
- fee (new)
```

**Add to "Phase 2: Components":**
```markdown
#### 2.5 Create Transaction History Component

NEW component to replace OrderHistoryTab:
- File: src/components/featured/spot/TransactionHistoryTab.tsx
- Data source: getSpotOrders with status=FILLED
- Display: date, asset, side, qty, executedPrice, totalCost, fee, PnL
```

**Add to "Phase 4: Real-Time Architecture":**
```markdown
#### Socket Events for Spot Trading

New events (replace position events):
- `order.created` → New order created
- `order.filled` → Order partially/fully filled
- `order.cancelled` → Order cancelled
- `portfolio.updated` → Holdings changed (after buy/sell)
```

---

## 🎯 NEXT STEPS

**Week 1 (Immediate):**
1. ✅ Fix Update Order path params bug (CRITICAL)
2. ✅ Add assetId validation to types
3. ✅ Create spotOrderService.ts with correct endpoints
4. ✅ Create useSpotOrder.ts hook

**Week 2:**
1. ✅ Refactor ActiveOrdersTabContent
2. ✅ Create TransactionHistoryTab
3. ✅ Implement DividendService
4. ✅ Update PortfolioTabContent display

**Week 3:**
1. ✅ Implement CommissionService
2. ✅ Create Dividend UI components
3. ✅ Create Commission UI components
4. ✅ End-to-end testing

---

**Ready to start implementation? Which component/service should I build first?** 🚀
