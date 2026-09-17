'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
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

      {/* Logo - matches login page */}
      <a href="/" className="absolute top-8 left-8 flex items-center gap-2.5 group z-10">
        <img src="/logo3.png" alt="OmniHome" className="h-14 w-auto object-contain" />
        <span className="text-title-sm font-display text-gray-900">
          Omni<span className="text-accent-600">Home</span>
        </span>
      </a>

      {/* Reset Password Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-display-sm font-display text-gray-900">Set a new password</h1>
            <p className="text-body-sm text-gray-700 mt-1.5">
              Choose a new password for your account.
            </p>
          </div>

          {!token ? (
            <div className="text-center">
              <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                This reset link is invalid or missing. Please request a new one.
              </div>
              <a
                href="/forgot-password"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-accent-600 hover:text-accent-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Request a new link
              </a>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                Your password has been reset. You can now sign in with your new password.
              </div>
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm"
              >
                Back to sign in
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
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

                <div>
                  <label htmlFor="confirm" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      minLength={8}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm disabled:opacity-60"
                >
                  {loading ? 'Saving...' : (
                    <>
                      Reset password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white text-body-sm text-gray-700">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}