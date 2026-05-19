import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ui/ProtectedRoute.jsx'
import Navbar from './components/ui/Navbar.jsx'

import HomePage      from './pages/HomePage.jsx'
import AuthPage      from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import AboutPage     from './pages/AboutPage.jsx'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"     element={<><Navbar /><HomePage /></>} />
            <Route path="/about" element={<><Navbar /><AboutPage /></>} />
            <Route path="/login"    element={<AuthPage mode="login"    />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute><><Navbar /><AnalyticsPage /></></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
