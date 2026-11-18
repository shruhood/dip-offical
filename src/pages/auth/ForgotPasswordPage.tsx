import React, { useState } from 'react';
import { Logo } from '../../components/common/Logo';
import { useAuth } from '../../context/AuthContext';
import { InlineSkeletonPulse } from '../../components/common/SkeletonLoaders';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigate: (route: string, param?: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F7F8FA]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
        <div className="space-y-2">
          <Logo size="sm" showSubtitle={false} />
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight pt-2">
            Reset your password
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the email address associated with your Digital India Project account to receive a password recovery link.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#138808] mx-auto" />
            <p className="font-bold">Recovery email dispatched</p>
            <p className="text-slate-600">
              If an account exists for <strong className="font-mono">{email}</strong>, a password reset link has been sent. Check your inbox or spam folder.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="mt-2 inline-flex items-center gap-1.5 text-[#FF671F] font-bold hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign In</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Registered Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs focus:bg-white focus:border-[#FF671F] focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <InlineSkeletonPulse className="w-4" />}
              <span>{loading ? 'Sending Link...' : 'Send Recovery Link'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="w-full py-2 text-slate-600 hover:text-slate-900 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
