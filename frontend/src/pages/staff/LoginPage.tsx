import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Feather, Lock, Mail, Shield, UserCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface RolePreset {
  id: 'ADMIN' | 'STAFF';
  label: string;
  badge: string;
  email: string;
  password: string;
  icon: React.ElementType;
  description: string;
  destination: string;
  colorClass: {
    activeBorder: string;
    activeBg: string;
    text: string;
    badgeBg: string;
  };
}

const ROLES: RolePreset[] = [
  {
    id: 'ADMIN',
    label: 'Administrator',
    badge: 'Full Access',
    email: 'admin@writathon.com',
    password: 'admin123',
    icon: Shield,
    description: 'Campaign setup, email templates, user management & all lead records.',
    destination: '/admin/dashboard',
    colorClass: {
      activeBorder: 'border-primary ring-2 ring-primary/20',
      activeBg: 'bg-primary-soft/60',
      text: 'text-primary',
      badgeBg: 'bg-purple-100 text-purple-800',
    },
  },
  {
    id: 'STAFF',
    label: 'Editorial Staff',
    badge: 'Reviewer',
    email: 'reviewer@writathon.com',
    password: 'staff123',
    icon: UserCheck,
    description: 'Story review queue, manual originality check & eligibility decisions.',
    destination: '/staff/dashboard',
    colorClass: {
      activeBorder: 'border-secondary ring-2 ring-secondary/20',
      activeBg: 'bg-secondary-soft/60',
      text: 'text-secondary',
      badgeBg: 'bg-pink-100 text-pink-800',
    },
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [selectedRole, setSelectedRole] = useState<RolePreset>(ROLES[1]); // Default to Staff Reviewer
  const [email, setEmail] = useState<string>(ROLES[1].email);
  const [password, setPassword] = useState<string>(ROLES[1].password);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectRole = (role: RolePreset) => {
    setSelectedRole(role);
    setEmail(role.email);
    setPassword(role.password);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const loggedUser = await login(email, password);
      // Route based on authenticated user role
      if (loggedUser.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (loggedUser.role === 'STAFF') {
        navigate('/staff/dashboard');
      } else {
        logout();
        setError('Parents do not need an account. Please track your registration on the Check Status page using your Tracking ID.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const IconComponent = selectedRole.icon;

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <Feather className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-text-dark tracking-tight">
            Staff & Admin Sign In
          </h1>
          <p className="text-xs text-text-muted mt-1.5 max-w-sm mx-auto">
            Authorized portal for Editorial Reviewers and Administrators. Parents do not need an account and can use the public status tracker.
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-card p-6 sm:p-8 shadow-elevated border border-app-border space-y-6">
          {/* Role Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-text-dark uppercase tracking-wider mb-2.5">
              1. Choose Access Role:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLES.map((role) => {
                const isSelected = selectedRole.id === role.id;
                const RoleIcon = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? `${role.colorClass.activeBorder} ${role.colorClass.activeBg} shadow-xs`
                        : 'border-app-border hover:bg-gray-50 bg-white text-text-main'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-white shadow-xs ' + role.colorClass.text : 'bg-gray-100 text-gray-500'}`}>
                        <RoleIcon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.colorClass.badgeBg}`}>
                        {role.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className={`text-xs font-heading font-bold ${isSelected ? role.colorClass.text : 'text-text-dark'}`}>
                        {role.label}
                      </h3>
                      <p className="text-[10px] text-text-muted truncate mt-0.5 font-mono">
                        {role.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Role Description Box */}
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center gap-2.5">
              <IconComponent className={`w-4 h-4 shrink-0 ${selectedRole.colorClass.text}`} />
              <div className="text-[11px] text-text-main">
                <span className="font-bold">{selectedRole.label}:</span> {selectedRole.description}{' '}
                <span className="text-gray-400 font-mono">({selectedRole.destination})</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <label className="block text-xs font-bold text-text-dark uppercase tracking-wider">
              2. Credentials:
            </label>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-text-dark mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-app-border text-xs outline-none focus:ring-2 focus:ring-primary font-medium"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-dark mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-app-border text-xs outline-none focus:ring-2 focus:ring-primary font-medium"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-xs font-bold tracking-wide mt-2"
            >
              {isLoading ? (
                'Authenticating...'
              ) : (
                <>
                  <span>Sign In as {selectedRole.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Note */}
          <div className="border-t border-app-border pt-4 text-center">
            <p className="text-[11px] text-text-muted">
              Are you a parent tracking a story? No login is needed. <Link to="/status" className="text-primary font-semibold hover:underline">Track with your Lead ID here</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
