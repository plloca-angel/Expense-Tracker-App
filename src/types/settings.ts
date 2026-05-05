export type ThemePreference = 'light' | 'dark' | 'system';

export type AppSettings = {
  currency: string;
  theme: ThemePreference;
};

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  theme: 'system',
};
