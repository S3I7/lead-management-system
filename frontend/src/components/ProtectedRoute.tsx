import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, BookOpen } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'STAFF')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ['ADMIN', 'STAFF'],
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is Staff attempting to access an Admin-only route:
  if (user.role === 'STAFF' && !allowedRoles.includes('STAFF')) {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // If user is a Parent or not in allowedRoles -> restrict access
  if (!allowedRoles.includes(user.role as any)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg p-4">
        <div className="bg-white rounded-card p-8 shadow-elevated border-2 border-rose-200 text-center max-w-md w-full animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-heading font-extrabold text-text-dark">
            Staff Access Only
          </h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            You are logged in as a <strong>Parent / Participant</strong>. The staff CRM dashboard and review queues are restricted to authorized Editorial Staff and Administrators.
          </p>

          <div className="my-5 p-4 bg-primary-soft/50 rounded-xl border border-primary/20 text-xs text-left space-y-1">
            <p className="font-semibold text-text-dark">What you can access:</p>
            <p className="text-text-muted">• Register child for Writathon</p>
            <p className="text-text-muted">• Upload and submit story documents</p>
            <p className="text-text-muted">• Track review status and pay publication fee</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/status"
              className="btn-primary text-xs py-2.5 px-4"
            >
              <BookOpen className="w-4 h-4" />
              Open Parent Portal
            </Link>
            <Link
              to="/login"
              className="btn-secondary text-xs py-2.5 px-4"
            >
              Staff Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
