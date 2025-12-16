// Shared type definitions for DeltaWatch
// Re-export and extend types from the shared package

import { 
  Monitor as SharedMonitor, 
  HistoryRecord as SharedHistoryRecord,
  User as SharedUser,
  ApiResponse
} from '@deltawatch/shared';

// Re-export shared types
export type { ApiResponse };

// Web-specific extensions of shared types
export interface Monitor extends SharedMonitor {
  user_id?: number;
  selector_text?: string;
  notify_config?: string;
  ai_prompt?: string;
  scenario_config?: string;
  keywords?: string;
  ai_only_visual?: boolean;
  created_at?: string;
  history?: HistoryItem[];
}

export interface HistoryItem extends SharedHistoryRecord {
  monitor_id?: number;
  prev_screenshot_path?: string;
  diff_screenshot_path?: string;
  ai_summary?: string;
}

export interface User extends SharedUser {
  is_blocked?: boolean;
  email_verified?: boolean;
  created_at?: string;
}

export interface Settings {
  id: number;
  user_id: number;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  notification_email?: string;
  pushover_user_key?: string;
  pushover_api_token?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  ai_provider?: 'openai' | 'ollama';
  ai_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
  proxy_enabled?: boolean;
  proxy_url?: string;
  stealth_mode?: boolean;
  webhook_enabled?: boolean;
  webhook_url?: string;
}

export interface Stats {
  totalMonitors: number;
  activeMonitors: number;
  checksToday: number;
  changesDetected: number;
  successRate: number;
  errorsToday: number;
}




export interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
