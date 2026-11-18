import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/common/Logo';
import { GoogleSignInButton } from '../../components/workspace/GoogleSignInButton';
import { getHomeRouteForRole } from '../../lib/rbac';
import { sanitizeInternalRedirect } from '../../lib/siteUrls';
import { InlineSkeletonPulse } from '../../components/common/SkeletonLoaders';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

interface LoginPageProps {
  onNavigate: (route: string, param?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, loginWithGoogle, authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectByRole = (role: any, accountType?: string, kycStatus?: string) => {
    const nextParam = new URLSearchParams(window.location.search).get('next');
    if (nextParam) {
      const safe = sanitizeInternalRedirect(nextParam, '');
      if (safe.route && safe.route !== 'login') {
        onNavigate(safe.route, safe.param);
        return;
      }
    }
    onNavigate(getHomeRouteForRole(role, accountType, kycStatus));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const signedInUser = await login(email, password);
      redirectByRole(signedInUser.role, signedInUser.accountType, signedInUser.kycStatus);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please verify your email and password.');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const signedInUser = await loginWithGoogle();
      if (signedInUser) {
        redirectByRole(signedInUser.role, signedInUser.accountType, signedInUser.kycStatus);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F8FA] dark:bg-[#0B1120]">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-5 bg-[#1E293B] text-white rounded-2xl p-8 flex flex-col justify-between space-y-8 border border-slate-800">
          <div className="space-y-4">
            <span className="text-xs font-semibold text-[#FFC928]">
              Digital India Project · Account Access
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-balance">
              Manage applications, KYC records & Partner commissions securely.
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sign in with Google or your registered email credentials to access Citizen tracking, Operations Manager queues, Authorized Partner filing, or Super Admin controls.
            </p>
          </div>

          <div className="space-y-3.5 text-xs border-t border-slate-700 pt-6">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
              <span className="text-slate-200">End-to-end DPDP Act 2023 consent logging & private encrypted storage</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#FF671F] shrink-0 mt-0.5" />
              <span className="text-slate-200">Role-verified workspaces for Citizens, Partners, Operators, Managers & Admins</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#FFC928] shrink-0 mt-0.5" />
              <span className="text-slate-300">
                Private digital services facilitation firm — independent of any government authority.
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 space-y-6 flex flex-col justify-center">
          <div className="space-y-1.5">
            <Logo size="sm" showSubtitle={false} />
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight pt-2">
              Sign in to your account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Access your Citizen Dashboard, Partner Console, Manager Queue, or Operator Desk.
            </p>
          </div>

          <div className="space-y-3">
            <GoogleSignInButton
              onClick={handleGoogleLogin}
              isLoading={googleLoading}
              text="Continue with Google"
              className="w-full py-3 text-xs font-semibold"
            />

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400">
                Or sign in with registered email
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-[#FF671F] focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-[11px] text-[#FF671F] hover:underline font-semibold cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs focus:bg-white dark:focus:bg-slate-900 focus:border-[#FF671F] focus:outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading && <InlineSkeletonPulse className="w-4" />}
              <span>{authLoading ? 'Signing In...' : 'Sign In'}</span>
              {!authLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              New here?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                Create an Account
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('become-partner')}
              className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-[#138808] font-semibold cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#138808]" />
              <span>Become Our Partner</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
