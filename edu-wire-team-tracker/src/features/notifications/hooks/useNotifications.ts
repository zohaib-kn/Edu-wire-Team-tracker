import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '../services/notificationService'
import type { NotificationsResponse } from '../types/notification.types'

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
}

/**
 * Polls the backend every 10 seconds for unread web notifications.
 * Returns the full response including the unreadCount badge number.
 */
export function useNotifications() {
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.unread,
    queryFn: () => notificationService.getMyNotifications(true),
    refetchInterval: 10_000, // poll every 10 seconds for timely toast alerts
    staleTime: 5_000,
    refetchIntervalInBackground: true, // keep polling even when tab is in the background
  })
}

/**
 * Marks a single notification as read and invalidates the cache immediately
 * so the unread badge count updates without waiting for the next poll.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

/**
 * Marks all notifications as read in one request and refreshes the cache.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

