import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { VerificationSkeleton } from '../../components/common/SkeletonLoaders';
import { useAuth } from '../../context/AuthContext';
import {
  firebaseApplyActionCode,
  firebaseCheckActionCode,
  firebaseConfirmPasswordReset,
  firebaseVerifyPasswordResetCode,
} from '../../services/firebase';
import { sanitizeInternalRedirect } from '../../lib/siteUrls';
import { getHomeRouteForRole } from '../../lib/rbac';

interface AuthActionPageProps {
  onNavigate: (route: string, param?: string) => void;
}

export const AuthActionPage: React.FC<AuthActionPageProps> = ({ onNavigate }) => {
  const { user, refreshUserProfile } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || '';
  const oobCode = params.get('oobCode') || '';
  const safeContinue = sanitizeInternalRedirect(params.get('continueUrl'), '/login');

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Validating secure authentication link on digitalindiaproject.com...');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function processAction() {
      if (!mode || !oobCode) {
        if (!active) return;
        setStatus('error');
        setMessage('Invalid or incomplete authentication action link.');
        return;
      }

      try {
        if (mode === 'verifyEmail') {
          await firebaseApplyActionCode(oobCode);
          await refreshUserProfile();
          if (!active) return;
          setStatus('success');
          setMessage('Your email address has been verified on digitalindiaproject.com.');
        } else if (mode === 'resetPassword') {
          const verifiedEmail = await firebaseVerifyPasswordResetCode(oobCode);
          if (!active) return;
          setAccountEmail(verifiedEmail);
          setStatus('ready');
          setMessage(`Create a new password for ${verifiedEmail}`);
        } else if (mode === 'recoverEmail') {
          const info = await firebaseCheckActionCode(oobCode);
          await firebaseApplyActionCode(oobCode);
          if (!active) return;
          setStatus('success');
          setMessage(
            `Email address restored${info?.data?.email ? ` to ${info.data.email}` : ''}. Please sign in with your updated credentials.`
          );
        } else {
          setStatus('error');
          setMessage('Unsupported authentication action requested.');
        }
      } catch (err: any) {
        if (!active) return;
        setStatus('error');
        setMessage(err?.message || 'This authentication link is invalid or has expired.');
      }
    }

    processAction();
    return () => {
      active = false;
    };
  }, [mode, oobCode, refreshUserProfile]);

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr(null);

    if (newPassword.length < 8) {
      setFormErr('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormErr('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await firebaseConfirmPasswordReset(oobCode, newPassword);
      setStatus('success');
      setMessage('Your password has been updated. You can now sign in on digitalindiaproject.com.');
    } catch (err: any) {
      setFormErr(err?.message || 'Could not update password. Please request a new reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (user && mode === 'verifyEmail') {
      onNavigate(getHomeRouteForRole(user.role, user.accountType, user.kycStatus));
      return;
    }
    onNavigate(safeContinue.route === 'auth-action' ? 'login' : safeContinue.route, safeContinue.param);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F8FA] dark:bg-[#0B1120]">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="space-y-2">
          <Logo size="sm" showSubtitle={false} />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#138808] pt-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>digitalindiaproject.com · Verified Auth Link</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === 'resetPassword'
              ? 'Reset Account Password'
              : mode === 'verifyEmail'
              ? 'Email Verification'
              : mode === 'recoverEmail'
              ? 'Recover Account Email'
              : 'Account Verification'}
          </h1>
        </div>

        {status === 'loading' && (
          <VerificationSkeleton
            title="Verifying Action Link..."
            subtitle={message}
          />
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="flex-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Request Fresh Link
              </button>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && mode === 'resetPassword' && (
          <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Setting new password for <strong className="font-mono text-slate-900 dark:text-white">{accountEmail}</strong>.
            </p>

            {formErr && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formErr}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password (min 8 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Updating Password...' : 'Save New Password'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <span>{user && mode === 'verifyEmail' ? 'Open My Dashboard' : 'Continue to Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
