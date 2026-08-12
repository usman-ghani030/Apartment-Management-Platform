'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, UserPlus, Mail, Lock, User, Globe, ArrowRight } from 'lucide-react';
import { auth, ApiError } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [societySlug, setSocietySlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSocietyNameChange = (value: string) => {
    setSocietyName(value);
    setSocietySlug(generateSlug(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await auth.signup({ email, password, name, societyName, societySlug });
      router.push('/dashboard/admin');
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

      {/* Logo — matches home page header */}
      <a href="/" className="absolute top-8 left-8 flex items-center gap-2.5 group z-10">
        <div className="bg-gradient-to-br from-accent-500 to-accent-800 p-2 rounded-xl text-white shadow-sm ring-1 ring-accent-700/20 group-hover:scale-105 group-hover:shadow-md transition-all">
          <Building2 className="w-5 h-5" />
        </div>
        <span className="text-title-sm font-display text-gray-900">
          Omni<span className="text-accent-600">Home</span>
        </span>
      </a>

      {/* Signup Card */}
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-display-sm font-display text-gray-900">Create your society</h1>
            <p className="text-body-sm text-gray-700 mt-1.5">Set up your community in minutes</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-body-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="societyName" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                Society Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="societyName"
                  type="text"
                  value={societyName}
                  onChange={(e) => handleSocietyNameChange(e.target.value)}
                  placeholder="e.g. Sunrise Apartments"
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="societySlug" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                Society URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="societySlug"
                  type="text"
                  value={societySlug}
                  onChange={(e) => setSocietySlug(e.target.value)}
                  placeholder="sunrise-apartments"
                  required
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50 font-mono"
                />
              </div>
              <p className="text-caption-xs text-gray-700 mt-1">Your society&apos;s unique identifier (lowercase, hyphens only)</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-caption-xs font-medium text-gray-700 mb-3">Your Account</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-body-sm font-medium text-gray-700 mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
                    />
                  </div>
                </div>

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
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 pl-10 text-body-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm disabled:opacity-60 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating society...
                </span>
              ) : (
                <>
                  Create Society
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-body-sm text-gray-700 mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-accent-600 hover:text-accent-700 transition-colors font-semibold">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
