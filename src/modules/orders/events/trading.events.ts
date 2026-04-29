export const TRADING_EVENTS = {
  ORDER_MATCHED: 'trading.order.matched',
} as const;

export interface OrderMatchedEvent {
  assetId: string;
  price: string;
  quantity: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerUserId: string;
  sellerUserId: string;
  matchedAt: Date;
}
