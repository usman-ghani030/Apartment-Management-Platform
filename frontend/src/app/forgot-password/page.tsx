'use client';

import React, { useState } from 'react';
import { Mail, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleOnly, setGoogleOnly] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGoogleOnly(false);
    setLoading(true);

    try {
      const result = await auth.forgotPassword(email);
      if (result.googleOnly) {
        setGoogleOnly(true);
      }
      setSent(true);
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

      {/* Logo — matches login page */}
      <a href="/" className="absolute top-8 left-8 flex items-center gap-2.5 group z-10">
        <img src="/logo3.png" alt="OmniHome" className="h-12 w-auto object-contain group-hover:scale-105 group-hover:shadow-md transition-all" />
        <span className="text-title-sm font-display text-gray-900">
          Omni<span className="text-accent-600">Home</span>
        </span>
      </a>

      {/* Forgot Password Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-display-sm font-display text-gray-900">Forgot your password?</h1>
            <p className="text-body-sm text-gray-700 mt-1.5">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          {sent ? (
            <div className="text-center">
              {googleOnly ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                    This account uses Google Sign-In. Please sign in with Google instead.
                  </div>
                  <a
                    href="/login"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-colors mb-4"
                  >
                    Sign in with Google
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </>
              ) : (
                <>
                  <div className="bg-green-50 border border-green-200 text-green-700 text-body-sm rounded-lg px-4 py-3 mb-6">
                    A password reset link has been sent to your email. Check your inbox.
                  </div>
                  <p className="text-body-sm text-gray-700 mb-6">
                    Check your inbox (and spam folder). The link expires in 60 minutes
                    and can only be used once.
                  </p>
                </>
              )}
              <a
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-accent-600 hover:text-accent-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </a>
            </div>
          ) : (
            <>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm disabled:opacity-60"
                >
                  {loading ? 'Sending...' : (
                    <>
                      Send reset link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-body-sm text-gray-700 mt-6">
                Remembered it?{' '}
                <a href="/login" className="text-accent-600 hover:text-accent-700 transition-colors font-semibold">
                  Back to sign in
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}