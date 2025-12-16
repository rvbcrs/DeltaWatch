import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { 
  Monitor as SharedMonitor, 
  User as SharedUser, 
  AuthResponse,
  HistoryRecord 
} from '@deltawatch/shared';

const TOKEN_KEY = 'deltawatch_token';
const SERVER_URL_KEY = 'deltawatch_server_url';

// Re-export shared types with extended history for mobile
export interface Monitor extends SharedMonitor {
  history?: Array<HistoryRecord & { id: number }>;
}

export type User = SharedUser;
export type LoginResponse = AuthResponse;

// Platform-agnostic storage (SecureStore on mobile, localStorage on web)
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

class ApiService {
  private serverUrl: string = '';
  private token: string = '';

  async initialize(): Promise<boolean> {
    try {
      const savedUrl = await storage.getItem(SERVER_URL_KEY);
      const savedToken = await storage.getItem(TOKEN_KEY);
      
      console.log('API initialize - savedUrl:', savedUrl);
      console.log('API initialize - savedToken:', savedToken ? 'present' : 'none');
      
      if (savedUrl) this.serverUrl = savedUrl;
      if (savedToken) this.token = savedToken;
      
      console.log('API initialize - this.serverUrl:', this.serverUrl);
      
      return !!savedToken;
    } catch (e) {
      console.error('Failed to initialize:', e);
      return false;
    }
  }

  setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/$/, '');
    storage.setItem(SERVER_URL_KEY, this.serverUrl);
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    console.log('Logging in to:', this.serverUrl);
    
    const res = await fetch(`${this.serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: LoginResponse = await res.json();
    this.token = data.token;
    await storage.setItem(TOKEN_KEY, data.token);
    return data;
  }

  async logout(): Promise<void> {
    this.token = '';
    await storage.removeItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private async authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.serverUrl}${endpoint}`;
    console.log('authFetch URL:', url);
    console.log('authFetch token:', this.token ? 'present' : 'missing');
    
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 401) {
      await this.logout();
      throw new Error('Session expired');
    }

    return res;
  }

  async getMonitors(): Promise<Monitor[]> {
    const res = await this.authFetch('/monitors');
    if (!res.ok) {
      throw new Error('Failed to fetch monitors');
    }
    const data = await res.json();
    return data.data || [];
  }

  async getMonitor(id: number): Promise<Monitor | null> {
    // Use monitors list endpoint which includes history data
    const monitors = await this.getMonitors();
    return monitors.find(m => m.id === id) || null;
  }

  async triggerCheck(monitorId: number): Promise<void> {
    const res = await this.authFetch(`/monitors/${monitorId}/check`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error('Check failed');
    }
  }

  async toggleMonitorStatus(monitorId: number, active: boolean): Promise<void> {
    await this.authFetch(`/monitors/${monitorId}`, {
      method: 'PUT',
      body: JSON.stringify({ active }),
    });
  }

  async deleteMonitor(monitorId: number): Promise<void> {
    const res = await this.authFetch(`/monitors/${monitorId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete monitor');
    }
  }

  async deleteHistoryRecord(monitorId: number, historyId: number): Promise<void> {
    const res = await this.authFetch(`/monitors/${monitorId}/history/${historyId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete history record');
    }
  }

  async getHealth(): Promise<{ server: string; database: string; browser: string }> {
    const res = await fetch(`${this.serverUrl}/api/health`);
    return res.json();
  }
}

export const api = new ApiService();
