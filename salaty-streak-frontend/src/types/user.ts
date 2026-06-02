export interface UserProfile {
  id: string;
  name: string;
  email: string;
  gender: 'MALE' | 'FEMALE' | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}