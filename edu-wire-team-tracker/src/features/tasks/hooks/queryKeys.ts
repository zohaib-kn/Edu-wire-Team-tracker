export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown> = {}) => [...taskKeys.lists(), filters] as const,
  myTasks: (filters: Record<string, unknown> = {}) => [...taskKeys.all, 'my-tasks', filters] as const,
  summaries: () => [...taskKeys.all, 'summary'] as const,
  summary: (filters: Record<string, unknown> = {}) => [...taskKeys.summaries(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  metadata: {
    all: ['metadata'] as const,
    teams: () => [...taskKeys.metadata.all, 'teams'] as const,
    branches: () => [...taskKeys.metadata.all, 'branches'] as const,
    members: (teamId: string) => [...taskKeys.metadata.all, 'members', teamId] as const,
  },
}

