import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/routes/AppLayout'
import LoginPage from '@/features/auth/LoginPage'
import DriverLoginPage from '@/features/auth/DriverLoginPage'
import DriverHomePage from '@/features/driver/DriverHomePage'
import DriverDeliveryDetailPage from '@/features/driver/DriverDeliveryDetailPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import DeliveriesPage from '@/features/deliveries/DeliveriesPage'
import DeliveryDetailPage from '@/features/deliveries/DeliveryDetailPage'
import IssuesPage from '@/features/issues/IssuesPage'
import IssueDetailPage from '@/features/issues/IssueDetailPage'
import ProductsPage from '@/features/products/ProductsPage'
import FleetPage from '@/features/fleet/FleetPage'
import OrganizationsPage from '@/features/admin/OrganizationsPage'
import UsersPage from '@/features/admin/UsersPage'
import AnalyticsPage from '@/features/analytics/AnalyticsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/driver/login', element: <DriverLoginPage /> },
  { path: '/driver', element: <DriverHomePage /> },
  { path: '/driver/deliveries/:id', element: <DriverDeliveryDetailPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/deliveries', element: <DeliveriesPage /> },
          { path: '/deliveries/:id', element: <DeliveryDetailPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/issues', element: <IssuesPage /> },
          { path: '/issues/:id', element: <IssueDetailPage /> },
          {
            element: <RequireRole roles={['Administrator', 'DistributionManager']} />,
            children: [
              { path: '/drivers', element: <FleetPage /> },
              { path: '/analytics', element: <AnalyticsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['Administrator']} />,
            children: [
              { path: '/organizations', element: <OrganizationsPage /> },
              { path: '/users', element: <UsersPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
