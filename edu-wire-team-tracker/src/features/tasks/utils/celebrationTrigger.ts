import { useSyncExternalStore } from 'react'

export interface CelebrationState {
  isCelebrating: boolean
  taskTitle: string
  key: number
}

let celebrationState: CelebrationState = {
  isCelebrating: false,
  taskTitle: '',
  key: 0,
}

const listeners = new Set<() => void>()

export function triggerCelebration(taskTitle?: string) {
  celebrationState = {
    isCelebrating: true,
    taskTitle: taskTitle || '',
    key: Date.now(),
  }
  listeners.forEach((listener) => listener())
}

export function dismissCelebration() {
  if (!celebrationState.isCelebrating) return
  celebrationState = {
    ...celebrationState,
    isCelebrating: false,
  }
  listeners.forEach((listener) => listener())
}

export function subscribeCelebration(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCelebrationSnapshot(): CelebrationState {
  return celebrationState
}

export function useCelebration(): CelebrationState {
  return useSyncExternalStore(
    subscribeCelebration,
    getCelebrationSnapshot,
    getCelebrationSnapshot,
  )
}

