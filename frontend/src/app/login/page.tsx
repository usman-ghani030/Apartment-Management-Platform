'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
import GoogleSignInButton from '@/components/auth/google-sign-in-button';

const FEATURES = [
  'Track dues, invoices and payment history',
  'Raise maintenance tickets and follow progress',
  'Approve visitors with QR gate passes',
  'Society notices, polls and amenities in one place',
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  const redirectToDashboard = (data: { memberships: { role?: string }[] }) => {
    const role = data.memberships[0]?.role;
    const dest =
      role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN' ? '/dashboard/admin'
      : role === 'SECURITY_GUARD' ? '/dashboard/guard'
      : '/dashboard/resident';
    router.push(dest);
  };

  // Google Sign-In: forward the verified ID token to the backend, which links
  // it to an existing account (or rejects the sign-in if no account exists).
  const handleGoogleToken = async (idToken: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const data = await auth.googleSignIn(idToken);
      if (data.linked) {
        setGoogleLinked(true);
      }
      redirectToDashboard(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await auth.login({ email, password });
      redirectToDashboard(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Left panel - brand story (hidden on mobile) ──────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[44%] bg-gradient-to-br from-accent-800 via-accent-900 to-[#0d1c40] relative overflow-hidden flex-col justify-between p-10 xl:p-14">
        {/* Backdrop */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#3b82f6] rounded-full blur-[140px] opacity-30" />
          <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] bg-[#1d4ed8] rounded-full blur-[160px] opacity-25" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
        </div>

        <div className="relative">
          {/* Wordmark-only lockup */}
          <a href="/" className="inline-flex items-center">
            <span className="text-display font-display text-white tracking-tight">
              Omni<span className="text-[#93c5fd]">Home</span>
            </span>
          </a>

          <div className="w-12 h-1 rounded-full bg-[#60a5fa] mt-12 xl:mt-14" aria-hidden="true" />

          <h2 className="text-display-lg font-display text-white mt-6 max-w-md tracking-tight">
            Welcome back to{' '}
            <span className="bg-gradient-to-r from-white to-[#93c5fd] bg-clip-text text-transparent">
              your community.
            </span>
          </h2>
          <p className="text-body text-[#c7d8f5] mt-5 max-w-md">
            Dues, visitors, tickets and notices - everything is where you left it.
          </p>

          <ul className="mt-10 space-y-3 max-w-md">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3.5 bg-white/[0.07] border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm"
              >
                <span className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#93c5fd]" />
                </span>
                <span className="text-body-sm font-medium text-white/90">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2 text-caption-xs font-medium text-white/90 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" aria-hidden="true" />
            Admins · Residents · Guards - one platform
          </span>
          <p className="text-caption text-white/50 mt-4">© {new Date().getFullYear()} OmniHome</p>
        </div>
      </div>

      {/* ── Right panel - form ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-12 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-100 rounded-full blur-[120px]" />
        </div>

        {/* Mobile lockup */}
        <a href="/" className="lg:hidden relative flex items-center mb-8">
          <span className="text-title font-display text-gray-900">
            Omni<span className="text-accent-600">Home</span>
          </span>
        </a>

        <div className="relative w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl shadow-blue-900/10">
            <div className="mb-6">
              <h1 className="text-display-sm font-display text-gray-900">Welcome back</h1>
              <p className="text-body-sm text-gray-700 mt-1">Sign in to your society account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                {error}
              </div>
            )}

            {googleLinked && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                Your Google account has been linked to your existing OmniHome account.
              </div>
            )}

            {/* Google Sign-In - same session handling as password login */}
            <div className="mb-6">
              <div className="flex justify-center">
                <GoogleSignInButton
                  onToken={handleGoogleToken}
                  disabled={loading || googleLoading}
                />
              </div>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-caption-xs font-medium text-gray-700">or sign in with email</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <a
                    href="/forgot-password"
                    className="text-caption-xs font-medium text-accent-600 hover:text-accent-700 transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-body-sm text-gray-700 mt-6">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="text-accent-600 hover:text-accent-700 transition-colors font-semibold">
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
