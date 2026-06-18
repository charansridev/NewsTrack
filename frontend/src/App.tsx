import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { AuthProvider } from '@/auth/AuthContext'
import { DriverAuthProvider } from '@/auth/DriverAuthContext'
import { router } from '@/routes/router'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DriverAuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </DriverAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
