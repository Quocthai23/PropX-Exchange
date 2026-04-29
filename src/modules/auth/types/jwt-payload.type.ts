export interface JwtPayload {
  sub: string; // user id
  walletAddress?: string | null;
  role: 'ADMIN' | 'INVESTOR' | 'SUPPORT_STAFF';
}
