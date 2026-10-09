import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';

// Public pages
import { InterestFormPage } from './pages/public/InterestFormPage';
import { StorySubmissionPage } from './pages/public/StorySubmissionPage';
import { PaymentCheckoutPage } from './pages/public/PaymentCheckoutPage';
import { ParentStatusPage } from './pages/public/ParentStatusPage';

import { ProtectedRoute } from './components/ProtectedRoute';

// Staff & Admin pages
import { LoginPage } from './pages/staff/LoginPage';
import { DashboardPage } from './pages/staff/DashboardPage';
import { LeadsListPage } from './pages/staff/LeadsListPage';
import { LeadDetailPage } from './pages/staff/LeadDetailPage';
import { EmailTemplatesPage } from './pages/staff/EmailTemplatesPage';
import { CommunicationsLogPage } from './pages/staff/CommunicationsLogPage';
import { StudentsPage } from './pages/staff/StudentsPage';
import { SubmissionsPage } from './pages/staff/SubmissionsPage';
import { WritathonsPage } from './pages/staff/WritathonsPage';
import { TeamPage } from './pages/staff/TeamPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-app-bg text-text-main selection:bg-primary-soft selection:text-primary">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Candidate & Parent Journey */}
                <Route path="/" element={<InterestFormPage />} />
                <Route path="/register" element={<InterestFormPage />} />
                <Route path="/submit-story" element={<StorySubmissionPage />} />
                <Route path="/submit-story/:leadId" element={<StorySubmissionPage />} />
                <Route path="/payment/:token" element={<PaymentCheckoutPage />} />
                <Route path="/status" element={<ParentStatusPage />} />
                <Route path="/status/:leadId" element={<ParentStatusPage />} />

                {/* Staff & Admin CRM Routes (Protected: Admin & Staff only, Parents Restricted) */}
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/leads"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <LeadsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/leads/:id"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <LeadDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/templates"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <EmailTemplatesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/communications"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <CommunicationsLogPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/students"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <StudentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/submissions"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <SubmissionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/writathons"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                      <WritathonsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/team"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <TeamPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
