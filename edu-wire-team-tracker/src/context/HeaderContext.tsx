import { useSyncExternalStore, useEffect, type ReactNode } from 'react'

export interface HeaderConfig {
  title?: string
  subtitle?: string
  actions?: ReactNode
}

type Listener = () => void

class HeaderStore {
  private config: HeaderConfig = {}
  private listeners: Set<Listener> = new Set()

  getConfig = (): HeaderConfig => this.config

  setConfig = (newConfig: HeaderConfig) => {
    this.config = newConfig
    this.notify()
  }

  reset = () => {
    this.config = {}
    this.notify()
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }
}

export const headerStore = new HeaderStore()

/**
 * Hook used by Header.tsx to subscribe to current page header configuration.
 */
export function useHeader(): HeaderConfig {
  return useSyncExternalStore(headerStore.subscribe, headerStore.getConfig)
}

/**
 * Hook called by individual pages to declare their title, subtitle, and action buttons.
 * Automatically synchronizes with Header.tsx and resets on unmount.
 */
export function usePageHeader({ title, subtitle, actions }: HeaderConfig) {
  useEffect(() => {
    headerStore.setConfig({ title, subtitle, actions })
  }, [title, subtitle, actions])

  useEffect(() => {
    return () => {
      headerStore.reset()
    }
  }, [])
}

