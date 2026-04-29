// User response types for API
export interface UserResponse {
  id: string;
  walletAddress: string;
  email?: string;
  username?: string;
  role: string;
  kycStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileResponse {
  id: string;
  walletAddress: string;
  email?: string;
  username?: string;
  role: string;
  kycStatus: string;
}
