'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogIn, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await auth.login({ email, password });
      const isAdmin = data.memberships.some((m) => m.role === 'COMMITTEE_ADMIN' || m.role === 'SUPER_ADMIN');
      router.push(isAdmin ? '/dashboard/admin' : '/dashboard/resident');
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
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-accent-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] bg-accent-800/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Logo */}
      <a href="/" className="absolute top-8 left-8 flex items-center gap-2.5 group z-10">
        <div className="bg-accent-600 p-2 rounded-lg text-white shadow-sm group-hover:scale-105 transition-transform">
          <Building2 className="w-5 h-5" />
        </div>
        <span className="text-title-sm font-display text-gray-900">
          Omni<span className="text-accent-600">Home</span>
        </span>
      </a>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-display-sm font-display text-gray-900">Welcome back</h1>
            <p className="text-body-sm text-gray-700 mt-1.5">Sign in to your society account</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

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
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
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
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm disabled:opacity-60"
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

        {/* Test Credentials */}
        <div className="mt-5 bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-caption-xs font-medium text-gray-700 mb-2">Test Credentials</p>
          <div className="text-caption-xs text-gray-700 space-y-1">
            <p>Admin: <span className="text-accent-600 font-mono font-medium">admin@sunrise.com</span> / <span className="text-accent-600 font-mono font-medium">admin123</span></p>
            <p>Resident: <span className="text-accent-600 font-mono font-medium">resident@sunrise.com</span> / <span className="text-accent-600 font-mono font-medium">resident123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
