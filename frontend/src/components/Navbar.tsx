import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Feather, LayoutDashboard, LogOut, BookOpen, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStaffRoute = location.pathname.startsWith('/admin');
  const isStaffOrAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'STAFF':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'PARENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-app-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
              <Feather className="w-5 h-5" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-xl tracking-tight bg-brand-gradient bg-clip-text text-transparent">
                Writathon
              </span>
              <span className="text-[10px] block font-semibold text-text-muted uppercase tracking-widest -mt-1">
                Lead CRM & Publication
              </span>
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <Link
              to="/register"
              className={`px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                location.pathname === '/register' || location.pathname === '/'
                  ? 'bg-primary-soft text-primary font-semibold'
                  : 'text-text-main hover:bg-gray-100'
              }`}
            >
              Interest Form
            </Link>
            <Link
              to="/submit-story"
              className={`px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                location.pathname.startsWith('/submit-story')
                  ? 'bg-primary-soft text-primary font-semibold'
                  : 'text-text-main hover:bg-gray-100'
              }`}
            >
              Submit Story
            </Link>
            <Link
              to="/status"
              className={`px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                location.pathname.startsWith('/status')
                  ? 'bg-primary-soft text-primary font-semibold'
                  : 'text-text-main hover:bg-gray-100'
              }`}
            >
              Check Status
            </Link>

            {/* Role-conditional Staff Dashboard or Parent Status Link */}
            {isStaffOrAdmin && (
              <>
                <span className="h-5 w-px bg-gray-300 mx-2" />
                <Link
                  to="/admin/dashboard"
                  className={`px-4 py-2 rounded-pill text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    isStaffRoute
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-primary hover:bg-primary-soft font-semibold'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Staff Dashboard
                </Link>
              </>
            )}

            {user?.role === 'PARENT' && (
              <>
                <span className="h-5 w-px bg-gray-300 mx-2" />
                <Link
                  to="/status"
                  className="px-4 py-2 rounded-pill text-sm font-medium flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Parent Portal
                </Link>
              </>
            )}
          </nav>

          {/* Right Action: User profile & Logout or Sign In */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
                    {user.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-text-dark leading-tight">{user.full_name}</p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="btn-ghost text-xs py-1.5 px-3 border border-app-border text-gray-500 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-xs py-2 px-5">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
