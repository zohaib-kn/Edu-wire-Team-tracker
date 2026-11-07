import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Toaster as HotToaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './app/providers/AuthProvider'
import { AppRouter } from './app/router/AppRouter'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
        <HotToaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            duration: 6000,
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '12px 16px',
              maxWidth: '420px',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
