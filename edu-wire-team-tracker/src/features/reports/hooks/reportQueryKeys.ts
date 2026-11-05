export const reportKeys = {
  all: ['reports'] as const,
  daily: (filters: Record<string, unknown> = {}) => [...reportKeys.all, 'daily', filters] as const,
  weekly: (filters: Record<string, unknown> = {}) => [...reportKeys.all, 'weekly', filters] as const,
}

