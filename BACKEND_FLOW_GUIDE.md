/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKEND TRADING SYSTEM - COMPLETE FLOW GUIDE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROJECT: Launch BE (launch-be)
 * PURPOSE: Event-driven order matching with real-time WebSocket updates
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * PART 1: PROBLEM STATEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ISSUE: Candlestick data is empty on FE
 * 
 * ROOT CAUSE ANALYSIS:
 * 
 * ❌ MarketMakerService creates orders but they DON'T MATCH
 * ❌ No ORDER_MATCHED event is emitted to listeners
 * ❌ TradingEventsListener never receives any events
 * ❌ WebSocket /trading namespace never sends trade_matched events to FE
 * ❌ Redis queue remains empty (no trades to process)
 * ❌ MarketDataService has no trades to create candlesticks from
 * 
 * RESULT: 
 *   API /api/candles returns empty []
 *   FE candlestick chart is blank
 */

/**
 * PART 2: ARCHITECTURE DIAGRAM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * BACKEND SERVICES (launch-be/src/modules/worker/):
 * 
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    EVENT-DRIVEN TRADING SYSTEM                      │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * Every 30 seconds:
 * ┌──────────────────────┐
 * │ MarketMakerService   │  📊 Creates BUY + SELL orders
 * │ @Cron(EVERY_30_SECONDS)
 * │                      │  Example: BUY 5 BTC @ $42990
 * │                      │           SELL 5 BTC @ $43010
 * └──────────────┬───────┘
 *                │ submitOrder(buyOrder)
 *                ▼
 * ┌──────────────────────────────────────┐
 * │ OrderMatchingService                 │
 * │ - FIFO Matching Engine               │  ⚙️  Matches orders FIFO
 * │ - Get opposite orders from book      │
 * │ - Create Trade entities              │  Example: BUY matched
 * │ - ⭐ EMIT ORDER_MATCHED EVENT       │  with existing SELL
 * │   this.eventEmitter.emit()           │
 * └──────────────┬──────────────────────┘
 *                │
 *                │ Emits: TRADING_EVENTS.ORDER_MATCHED
 *                │ Payload: { trade, symbol, price, quantity }
 *                │
 *                ▼
 * ┌──────────────────────────────────────┐
 * │ TradingEventsListener                │
 * │ @OnEvent('order.matched')            │  🎯 Catches ORDER_MATCHED
 * │                                      │
 * │ handleOrderMatched(payload)          │  📡 Emits to RealtimeGateway
 * └──────────────┬──────────────────────┘
 *                │
 *                │ realtimeGateway.emitTradeMatched(trade)
 *                │ Namespace: /trading
 *                │ Event: 'trade_matched'
 *                │
 *                ▼
 * ┌──────────────────────────────────────┐
 * │ RealtimeGateway (WebSocket)          │  🚀 Broadcasts to clients
 * │ - Namespace: /trading                │
 * │ - Event: trade_matched               │  Connected clients
 * │ - Data: trade details                │  receive real-time trades
 * └──────────────┬──────────────────────┘
 *                │
 *                │ Socket.emit('trade_matched', tradeData)
 *                │
 *                ▼
 * ┌──────────────────────────────────────┐
 * │ FE: useTradingRealtimeSocket()       │  ✨ Real-time updates
 * │ - Listens to trade_matched           │
 * │ - Updates UI                         │  (src/store/tradingRealtimeSocketStore.ts)
 * │ - Store in state                     │  (src/hook/useTradingRealtimeSocket.ts)
 * └──────────────────────────────────────┘
 * 
 * 
 * PARALLEL FLOW - CANDLESTICK CREATION:
 * 
 * OrderMatchingService (creates Trade)
 *          │
 *          ├─ Saves Trade to database
 *          │
 *          └─ Pushes to Redis queue: 'trades:processing'
 *                       │
 *                       ▼
 *          ┌──────────────────────────────┐
 *          │ MarketDataService            │
 *          │ @Cron listener (Redis queue) │
 *          │ - Reads trades from queue    │
 *          │ - Groups by symbol/timeframe │
 *          │ - Creates Candlestick        │
 *          └──────────────┬───────────────┘
 *                         │
 *                         ├─ Saves to candlestick_1h table
 *                         │
 *                         └─ Emits kline event (default namespace)
 *                                    │
 *                                    ▼
 *          ┌──────────────────────────────┐
 *          │ FE: useKlineSocketStore()    │
 *          │ - Listens to kline events    │
 *          │ - Updates chart data         │
 *          │ - Display candlesticks       │
 *          └──────────────────────────────┘
 */

/**
 * PART 3: FILE STRUCTURE & RESPONSIBILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * FILE 1: src/modules/worker/order-matching.service.ts
 * ─────────────────────────────────────────────────────
 * 
 * RESPONSIBILITY: Core order matching engine (FIFO)
 * 
 * KEY METHODS:
 * 
 *   submitOrder(order)
 *   ├─ Get opposite side orders (BUY/SELL)
 *   ├─ Match quantities (FIFO)
 *   ├─ Create Trade entity
 *   ├─ ⭐ EMIT EventEmitter2.emit(TRADING_EVENTS.ORDER_MATCHED, payload)
 *   └─ Update order book
 * 
 * DEPENDENCIES:
 *   - EventEmitter2 (from @nestjs/event-emitter)
 *   - Repository: OrderEntity
 *   - Repository: TradeEntity
 * 
 * FLOW:
 *   1. Receives order from MarketMakerService
 *   2. Queries orderbook for opposite orders (sorted FIFO)
 *   3. Matches orders with same/better price
 *   4. Creates Trade record
 *   5. ⭐⭐⭐ CRITICAL: Emits ORDER_MATCHED event
 *   6. Returns created trades
 * 
 * EXAMPLE CODE:
 * 
 *   async submitOrder(order: OrderDTO) {
 *     const trades = [];
 *     
 *     const oppositeOrders = await this.orderRepo.find({
 *       symbol: order.symbol,
 *       side: oppositeSide,
 *       order: { createdAt: 'ASC' } // FIFO
 *     });
 *     
 *     for (const oppOrder of oppositeOrders) {
 *       const qty = Math.min(order.quantity, oppOrder.quantity);
 *       
 *       const trade = await this.tradeRepo.save({
 *         symbol, price, quantity: qty,
 *         buyOrderId, sellOrderId
 *       });
 *       
 *       trades.push(trade);
 *       
 *       // ⭐⭐⭐ EMIT EVENT HERE ⭐⭐⭐
 *       this.eventEmitter.emit(TRADING_EVENTS.ORDER_MATCHED, {
 *         trade,
 *         buyOrderId,
 *         sellOrderId,
 *         symbol,
 *         price,
 *         quantity: qty,
 *         timestamp: new Date()
 *       });
 *       
 *       // Update quantities
 *       order.quantity -= qty;
 *       oppOrder.quantity -= qty;
 *     }
 *     
 *     return trades;
 *   }
 */

/**
 * FILE 2: src/modules/worker/market-maker.service.ts
 * ────────────────────────────────────────────────────
 * 
 * RESPONSIBILITY: Generate test orders every 30 seconds
 * 
 * KEY METHODS:
 * 
 *   @Cron(EVERY_30_SECONDS)
 *   generateMarketOrders()
 *   ├─ For each symbol (BTC/USD, ETH/USD, etc)
 *   ├─ Create BUY order (lower price)
 *   ├─ Submit to OrderMatchingService
 *   ├─ Create SELL order (higher price)
 *   └─ Submit to OrderMatchingService
 * 
 * DEPENDENCIES:
 *   - OrderMatchingService (injected)
 *   - @nestjs/schedule (for @Cron)
 * 
 * FLOW:
 *   1. Every 30 seconds, trigger @Cron
 *   2. For each symbol, create orders:
 *      - BUY: price - 10, qty = random(1-5)
 *      - SELL: price + 10, qty = random(1-5)
 *   3. Submit each order to OrderMatchingService
 *   4. That service will match them if opposite orders exist
 *   5. Events get emitted
 * 
 * EXAMPLE LOG OUTPUT:
 * 
 *   [MarketMaker] 🤖 Generating market orders...
 *   [MarketMaker] 📊 BUY Order: BTC/USD × 3 @ $42990
 *   [MarketMaker] ✅ BUY matched 1 trades
 *   [MarketMaker] 📊 SELL Order: BTC/USD × 3 @ $43010
 *   [MarketMaker] ✅ SELL matched 1 trades
 */

/**
 * FILE 3: src/modules/worker/trading-events.listener.ts
 * ───────────────────────────────────────────────────────
 * 
 * RESPONSIBILITY: Listen to ORDER_MATCHED events and emit WebSocket
 * 
 * KEY METHODS:
 * 
 *   @OnEvent(TRADING_EVENTS.ORDER_MATCHED)
 *   handleOrderMatched(payload)
 *   └─ Emits to RealtimeGateway WebSocket
 * 
 * DEPENDENCIES:
 *   - RealtimeGateway (injected)
 *   - @nestjs/event-emitter (for @OnEvent)
 * 
 * FLOW:
 *   1. OrderMatchingService emits EVENT
 *   2. This listener catches it via @OnEvent decorator
 *   3. Extracts trade data from payload
 *   4. Calls realtimeGateway.emitTradeMatched(trade)
 *   5. Gateway broadcasts to all connected clients
 * 
 * EXAMPLE CODE:
 * 
 *   @OnEvent(TRADING_EVENTS.ORDER_MATCHED)
 *   async handleOrderMatched(payload: any) {
 *     this.logger.log(`ORDER_MATCHED event received: ${payload.symbol}`);
 *     
 *     // Emit to WebSocket clients
 *     this.realtimeGateway.emitTradeMatched(payload.trade);
 *     
 *     // Could also:
 *     // - Update Redis cache
 *     // - Send notifications
 *     // - Trigger candlestick creation
 *   }
 */

/**
 * FILE 4: src/modules/worker/worker.module.ts (UPDATED)
 * ──────────────────────────────────────────────────────
 * 
 * WHAT TO DO:
 * 
 *   @Module({
 *     providers: [
 *       WorkerService,
 *       OrderMatchingService,      // ← ADD
 *       MarketMakerService,        // ← ADD
 *       TradingEventsListener,     // ← ADD
 *     ]
 *   })
 *   export class WorkerModule {}
 */

/**
 * FILE 5: src/app.module.ts (UPDATED)
 * ────────────────────────────────────
 * 
 * WHAT TO ADD:
 * 
 *   import { ScheduleModule } from '@nestjs/schedule';
 *   import { EventEmitterModule } from '@nestjs/event-emitter';
 *   
 *   @Module({
 *     imports: [
 *       ScheduleModule.forRoot(),        // ← ADD (for @Cron)
 *       EventEmitterModule.forRoot(),    // ← ADD (for @OnEvent/@Emit)
 *       ApiModule,
 *       BlockchainModule,
 *       DatabaseModule,
 *       QueueModule,
 *       RedisModule,
 *       WorkerModule,
 *     ]
 *   })
 *   export class AppModule {}
 */

/**
 * PART 4: INTEGRATION STEPS (Implementation Plan)
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * STEP 1: Create Constants File
 * ──────────────────────────────
 * 
 * File: src/constants/trading-events.ts
 * 
 * export const TRADING_EVENTS = {
 *   ORDER_MATCHED: 'order.matched',
 *   ORDER_CREATED: 'order.created',
 *   ORDER_CANCELLED: 'order.cancelled',
 *   ORDER_UPDATED: 'order.updated',
 * };
 * 
 * WHY: Centralize event names to avoid typos
 */

/**
 * STEP 2: Create/Update Trade & Order Entities
 * ──────────────────────────────────────────────
 * 
 * File: src/modules/database/entities/order.entity.ts
 * 
 * @Entity('orders')
 * export class OrderEntity {
 *   @PrimaryColumn('varchar')
 *   id: string;
 *   
 *   @Column('varchar')
 *   symbol: string; // 'BTC/USD'
 *   
 *   @Column('enum', { enum: ['BUY', 'SELL'] })
 *   side: 'BUY' | 'SELL';
 *   
 *   @Column('decimal', { precision: 18, scale: 8 })
 *   price: number;
 *   
 *   @Column('decimal', { precision: 18, scale: 8 })
 *   quantity: number;
 *   
 *   @Column('decimal', { precision: 18, scale: 8 })
 *   filledQuantity: number = 0;
 *   
 *   @Column('enum', { enum: ['ACTIVE', 'FILLED', 'CANCELLED'] })
 *   status: string = 'ACTIVE';
 *   
 *   @Column('varchar')
 *   accountId: string;
 *   
 *   @CreateDateColumn()
 *   createdAt: Date;
 *   
 *   @UpdateDateColumn()
 *   updatedAt: Date;
 * }
 * 
 * File: src/modules/database/entities/trade.entity.ts
 * 
 * @Entity('trades')
 * export class TradeEntity {
 *   @PrimaryColumn('varchar')
 *   id: string;
 *   
 *   @Column('varchar')
 *   symbol: string;
 *   
 *   @Column('decimal', { precision: 18, scale: 8 })
 *   price: number;
 *   
 *   @Column('decimal', { precision: 18, scale: 8 })
 *   quantity: number;
 *   
 *   @Column('varchar', { nullable: true })
 *   buyOrderId?: string;
 *   
 *   @Column('varchar', { nullable: true })
 *   sellOrderId?: string;
 *   
 *   @Column('varchar', { nullable: true })
 *   buyerAccountId?: string;
 *   
 *   @Column('varchar', { nullable: true })
 *   sellerAccountId?: string;
 *   
 *   @Column('datetime')
 *   timestamp: Date;
 *   
 *   @CreateDateColumn()
 *   createdAt: Date;
 * }
 */

/**
 * STEP 3: Inject Repositories in OrderMatchingService
 * ──────────────────────────────────────────────────────
 * 
 * constructor(
 *   private eventEmitter: EventEmitter2,
 *   @InjectRepository(OrderEntity)
 *   private readonly orderRepo: Repository<OrderEntity>,
 *   @InjectRepository(TradeEntity)
 *   private readonly tradeRepo: Repository<TradeEntity>,
 * ) {}
 */

/**
 * STEP 4: Update RealtimeGateway (WebSocket)
 * ────────────────────────────────────────────
 * 
 * File: src/gateways/realtime.gateway.ts
 * 
 * WHAT TO ADD:
 * 
 *   @WebSocketGateway({
 *     namespace: 'trading',
 *     cors: true
 *   })
 *   export class RealtimeGateway {
 *     @WebSocketServer()
 *     server: Server;
 *     
 *     // Emit trade_matched event to all connected clients
 *     emitTradeMatched(trade: any) {
 *       this.server.emit('trade_matched', {
 *         id: trade.id,
 *         symbol: trade.symbol,
 *         price: trade.price,
 *         quantity: trade.quantity,
 *         buyOrderId: trade.buyOrderId,
 *         sellOrderId: trade.sellOrderId,
 *         timestamp: trade.timestamp,
 *       });
 *     }
 *     
 *     @SubscribeMessage('subscribeSymbol')
 *     handleSubscribe(client: Socket, data: { symbol: string }) {
 *       client.join(`trades:${data.symbol}`);
 *     }
 *   }
 */

/**
 * STEP 5: Update MarketDataService
 * ────────────────────────────────────
 * 
 * File: src/modules/worker/market-data.service.ts (existing or create new)
 * 
 * WHAT TO ADD:
 * 
 *   @Injectable()
 *   export class MarketDataService {
 *     @Cron(CronExpression.EVERY_10_SECONDS)
 *     async processTrades() {
 *       // Read from Redis queue: 'trades:processing'
 *       const trades = await this.redis.lpop('trades:processing', 100);
 *       
 *       for (const tradeData of trades) {
 *         // Group by symbol and timeframe
 *         // Update or create candlestick
 *         const candlestick = await this.createOrUpdateCandlestick(tradeData);
 *         
 *         // Emit kline event to clients listening on default namespace
 *         this.klineGateway.emitKline({
 *           symbol: candlestick.symbol,
 *           timeframe: candlestick.timeframe,
 *           candle: {
 *             open: candlestick.open,
 *             high: candlestick.high,
 *             low: candlestick.low,
 *             close: candlestick.close,
 *             volume: candlestick.volume,
 *             timestamp: candlestick.timestamp,
 *             isClosed: false
 *           }
 *         });
 *       }
 *     }
 *   }
 * 
 *   private async createOrUpdateCandlestick(trade: any) {
 *     const timestamp = this.calculateCandleTime(trade.timestamp);
 *     
 *     let candle = await this.candleRepo.findOne({
 *       symbol: trade.symbol,
 *       timeframe: 3600, // 1h
 *       timestamp
 *     });
 *     
 *     if (!candle) {
 *       candle = new CandlestickEntity();
 *       candle.open = trade.price;
 *     }
 *     
 *     candle.high = Math.max(candle.high, trade.price);
 *     candle.low = Math.min(candle.low, trade.price);
 *     candle.close = trade.price;
 *     candle.volume += trade.quantity;
 *     
 *     return await this.candleRepo.save(candle);
 *   }
 */

/**
 * PART 5: DATA FLOW - COMPLETE EXAMPLE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * TIMELINE: What happens when system starts
 * 
 * T+0s:    Backend starts
 *          - ScheduleModule loaded (enables @Cron)
 *          - EventEmitterModule loaded (enables @OnEvent)
 *          - MarketMakerService registered
 *          - OrderMatchingService registered
 *          - TradingEventsListener registered
 * 
 * T+30s:   MarketMaker cron triggers
 *          - Creates BUY order: { id: 'BOT_BUY_1', symbol: 'BTC/USD', side: 'BUY', price: 42990, qty: 3 }
 *          - Calls orderMatching.submitOrder(buyOrder)
 *          
 *          OrderMatching processes BUY:
 *          - Queries orderbook for SELL orders
 *          - Assumes empty (first order) → adds to orderbook
 *          - Returns empty trades array
 *          
 *          - Creates SELL order: { id: 'BOT_SELL_1', symbol: 'BTC/USD', side: 'SELL', price: 43010, qty: 3 }
 *          - Calls orderMatching.submitOrder(sellOrder)
 *          
 *          OrderMatching processes SELL:
 *          - Queries orderbook for BUY orders
 *          - Finds: BUY_1 at 42990, qty: 3
 *          - Price matches (42990 < 43010 is favorable)
 *          - Creates Trade: { id: 'TRADE_1', symbol: 'BTC/USD', price: 42990, qty: 3 }
 *          - ⭐ EMITS: this.eventEmitter.emit('order.matched', { trade, ... })
 *          - Updates order book
 *          
 *          TradingEventsListener catches event:
 *          - @OnEvent('order.matched') triggered
 *          - Calls realtimeGateway.emitTradeMatched(trade)
 *          
 *          RealtimeGateway broadcasts:
 *          - Emits to /trading namespace: 'trade_matched' event
 *          - All connected FE clients receive: { symbol: 'BTC/USD', price: 42990, qty: 3, ... }
 *          
 *          FE receives:
 *          - useTradingRealtimeSocket().onTradeMatched() callback triggered
 *          - Updates state.latestTrades
 *          - UI re-renders with new trade
 * 
 * T+30-60s: MarketDataService cron triggers (every 10s)
 *          - Reads from Redis queue
 *          - Creates Candlestick: { symbol: 'BTC/USD', open: 42990, high: 42990, low: 42990, close: 42990, volume: 3 }
 *          - Emits kline event
 *          - FE receives kline → chart updates
 * 
 * T+60s:   Second cycle of MarketMaker
 *          - Creates new BUY/SELL orders
 *          - Prices update via random walk
 *          - Process repeats...
 */

/**
 * PART 6: DEBUGGING CHECKLIST
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * [ ] 1. Check logs for MarketMaker execution
 *        Look for: "[MarketMaker] 🤖 Generating market orders..."
 * 
 * [ ] 2. Check logs for Order creation
 *        Look for: "[MarketMaker] 📊 BUY Order: BTC/USD × 3 @ $42990"
 * 
 * [ ] 3. Check logs for OrderMatching
 *        Look for: "[OrderMatching] ✅ Trade created: TRADE_xxx"
 * 
 * [ ] 4. Check logs for Event emission
 *        Look for: "[TradingEventsListener] 📡 ORDER_MATCHED event received"
 * 
 * [ ] 5. Verify FE receives WebSocket events
 *        - Open DevTools Console
 *        - Check WebSocket messages in Network tab
 *        - Should see trade_matched events
 * 
 * [ ] 6. Verify candlesticks are created
 *        - Query database: SELECT * FROM candlesticks
 *        - Check API: GET /api/candles?symbol=BTC/USD
 *        - Should return array with timestamps
 */

export {};
