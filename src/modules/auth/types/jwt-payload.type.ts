export type JwtPayload = {
  sub: string; // user id
  walletAddress: string;
  role: 'ADMIN' | 'INVESTOR';
};
