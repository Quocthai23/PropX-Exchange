export interface JwtPayload {
  sub: string; // user id
  walletAddress: string;
  role: 'ADMIN' | 'INVESTOR' | 'SUPPORT_STAFF';
}
