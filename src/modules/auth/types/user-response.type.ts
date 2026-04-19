// User response types for API
export type UserResponse = {
  id: string;
  walletAddress: string;
  email?: string;
  username?: string;
  role: string;
  kycStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProfileResponse = {
  id: string;
  walletAddress: string;
  email?: string;
  username?: string;
  role: string;
  kycStatus: string;
};
