import { apiClient } from '@/lib/api';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types/auth';

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', data);
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', data);
  },

  async getProfile(): Promise<User> {
    return apiClient.get<User>('/auth/profile');
  },
};