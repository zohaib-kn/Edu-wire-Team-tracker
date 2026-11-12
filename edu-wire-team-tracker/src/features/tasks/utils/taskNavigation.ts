import type { Location } from 'react-router-dom'

export interface TaskDetailLocationState {
  backgroundLocation?: Location
}

/**
 * Builds router state when navigating to `/tasks/:id`.
 * - Opening from a non-task route captures that page as `backgroundLocation` so
 *   the Task Detail workspace opens as a route-aware modal over it.
 * - Navigating between parent <-> subtask while already inside a modal keeps the
 *   original `backgroundLocation` intact.
 * - Navigating from a direct `/tasks/:id` page (no `backgroundLocation`) keeps
 *   state empty so full-page fallback continues.
 */
export function getTaskDetailNavState(location: Location): TaskDetailLocationState {
  const currentState = location.state as TaskDetailLocationState | null
  if (currentState?.backgroundLocation) {
    return { backgroundLocation: currentState.backgroundLocation }
  }

  const isTaskRoute = location.pathname.startsWith('/tasks/')
  if (!isTaskRoute) {
    return { backgroundLocation: location }
  }

  return {}
}

/**
 * Resolves the safe return destination when closing the Task Detail workspace.
 */
export function getTaskDetailReturnTarget(
  location: Location,
  fallback = '/dashboard',
): string {
  const currentState = location.state as TaskDetailLocationState | null
  const bg = currentState?.backgroundLocation
  if (!bg || bg.pathname.startsWith('/tasks/')) {
    return fallback
  }

  return `${bg.pathname}${bg.search || ''}${bg.hash || ''}`
}

