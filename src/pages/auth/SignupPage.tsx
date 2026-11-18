import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/common/Logo';
import { GoogleSignInButton } from '../../components/workspace/GoogleSignInButton';
import { getHomeRouteForRole } from '../../lib/rbac';
import { InlineSkeletonPulse } from '../../components/common/SkeletonLoaders';
import {
  Lock,
  Mail,
  User,
  Phone,
  Building2,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Handshake,
} from 'lucide-react';

interface SignupPageProps {
  onNavigate: (route: string, param?: string) => void;
  initialType?: string;
}

const VALID_ACCOUNT_TYPES = new Set(['customer', 'partner', 'operator', 'business']);

function resolveInitialAccountType(propType?: string): 'customer' | 'partner' | 'operator' | 'business' {
  if (propType && VALID_ACCOUNT_TYPES.has(propType)) {
    return propType as 'customer' | 'partner' | 'operator' | 'business';
  }
  if (typeof window !== 'undefined') {
    const qp = new URLSearchParams(window.location.search).get('type');
    if (qp && VALID_ACCOUNT_TYPES.has(qp)) {
      return qp as 'customer' | 'partner' | 'operator' | 'business';
    }
  }
  return 'customer';
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigate, initialType }) => {
  const { register, loginWithGoogle, authLoading } = useAuth();

  const [accountType, setAccountType] = useState<'customer' | 'partner' | 'operator' | 'business'>(() =>
    resolveInitialAccountType(initialType)
  );

  React.useEffect(() => {
    if (initialType && VALID_ACCOUNT_TYPES.has(initialType)) {
      setAccountType(initialType as 'customer' | 'partner' | 'operator' | 'business');
    }
  }, [initialType]);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [referredByCode, setReferredByCode] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !mobile.trim()) {
      setError('Please fill in all required profile fields.');
      return;
    }

    if ((accountType === 'business' || accountType === 'operator' || accountType === 'partner') && !companyName.trim()) {
      setError('Please enter your business, center, or organization name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPass) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    if (!consent) {
      setError('You must review and accept the consent terms to create an account.');
      return;
    }

    try {
      const createdUser = await register(name, email, mobile, password, accountType, companyName, referredByCode);
      if (accountType === 'operator') {
        onNavigate('operator-enroll');
      } else if (accountType === 'partner') {
        onNavigate('partner');
      } else {
        onNavigate(getHomeRouteForRole(createdUser.role, createdUser.accountType, createdUser.kycStatus));
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please verify your information.');
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const cleanMobile = mobile.replace(/\D/g, '');
      const formattedMobile = cleanMobile.length >= 10 ? `+91 ${cleanMobile.slice(-10)}` : undefined;
      const signedInUser = await loginWithGoogle({
        accountType,
        companyName: companyName.trim() || undefined,
        mobile: formattedMobile,
        referredByCode: referredByCode.trim() || undefined,
      });
      if (signedInUser) {
        if (accountType === 'operator' && signedInUser.kycStatus !== 'Approved') {
          onNavigate('operator-enroll');
        } else if (accountType === 'partner') {
          onNavigate('partner');
        } else {
          onNavigate(getHomeRouteForRole(signedInUser.role, signedInUser.accountType, signedInUser.kycStatus));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-up failed or was cancelled.');
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
              Account Onboarding · Citizen, Distributor, Operator & B2B
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-balance">
              Create your Digital India Project account.
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Register as a Citizen for personal services, a Distributor / Referral Partner for commissions, a Center Operator for walk-in processing, or a B2B Corporate &amp; API account.
            </p>
          </div>

          <div className="space-y-3.5 text-xs border-t border-slate-700 pt-6">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
              <span className="text-slate-200">Instant access to drafts, vault, and 14-stage application tracking</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#FF671F] shrink-0 mt-0.5" />
              <span className="text-slate-200">Partners & Operators receive dedicated verification desks and ledger controls</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#FFC928] shrink-0 mt-0.5" />
              <span className="text-slate-300">
                100% itemized service & statutory fees via Cashfree verified payments.
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 space-y-5">
          <div className="space-y-1.5">
            <Logo size="sm" showSubtitle={false} />
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight pt-2">
              Create your account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your account role below, then register with Google or Email & Password.
            </p>
          </div>

          {/* 4 Account Type Segmented Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAccountType('customer')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                accountType === 'customer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <User className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
              <span>Citizen</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('partner')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                accountType === 'partner'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Handshake className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Distributor</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('operator')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                accountType === 'operator'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#138808] shrink-0" />
              <span>Operator</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('business')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                accountType === 'business'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>B2B</span>
            </button>
          </div>

          <GoogleSignInButton
            onClick={handleGoogleSignup}
            isLoading={googleLoading}
            text={
              accountType === 'operator'
                ? 'Sign up with Google & Start KYC'
                : accountType === 'partner'
                ? 'Sign up with Google & Enroll Partner'
                : 'Sign up with Google'
            }
            className="w-full py-2.5 text-xs font-semibold"
          />

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400">Or register with email</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Legal Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Chandra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number (10 digits) *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="7777941227"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                </div>
              </div>
            </div>

            {(accountType === 'business' || accountType === 'operator' || accountType === 'partner') && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {accountType === 'operator'
                    ? 'Facilitation Center / Kendra Name *'
                    : accountType === 'partner'
                    ? 'Partner / Agency Name *'
                    : 'Company / Organization Name *'}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. Samarvani Seva Kendra"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. REF-RAJESH102"
                  value={referredByCode}
                  onChange={(e) => setReferredByCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#FF671F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password (min 8 chars) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1 flex-1 rounded-full ${
                          strength >= lvl
                            ? strength >= 3
                              ? 'bg-[#138808]'
                              : 'bg-[#FFC928]'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    required
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 text-[#FF671F] rounded"
                required
              />
              <span>
                I accept the{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('legal', 'terms')}
                  className="text-[#FF671F] font-semibold hover:underline cursor-pointer"
                >
                  Terms & Privacy Policy
                </button>{' '}
                and understand Digital India Project is a private registration facilitation firm.
              </span>
            </label>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading && <InlineSkeletonPulse className="w-4" />}
              <span>
                {authLoading
                  ? 'Creating Account...'
                  : accountType === 'operator'
                  ? 'Create Account & Proceed to KYC'
                  : accountType === 'partner'
                  ? 'Create Account & Enroll as Partner'
                  : 'Create Account'}
              </span>
              {!authLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="font-bold text-[#FF671F] hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
