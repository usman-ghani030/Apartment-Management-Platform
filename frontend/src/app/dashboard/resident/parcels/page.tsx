'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Check, User as UserIcon, Clock, Home, X,
  PackageCheck, PackageOpen,
} from 'lucide-react';
import { Panel, CountPill, PanelEmpty } from '@/components/ui/Panel';
import { Field } from '@/components/ui/Field';
import { PageSkeleton } from '@/components/ui/LoadingScreen';
import { ApiError, apiGet, apiPatch } from '@/lib/api';
import type { ParcelResponse } from '@apartment/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────────────────────────────────────
// My packages: what the gate has taken in for my unit, and what I have already
// picked up. Same endpoints as before, rebuilt on the design system.
// ─────────────────────────────────────────────────────────────────────────────

const photoSrc = (url: string) => (url.startsWith('http') ? url : `${API_BASE}${url}`);

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "2 hours ago" reads better than a timestamp for something waiting at the gate. */
function waitLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export default function ResidentParcelsPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const fetchParcels = useCallback(async () => {
    try {
      const data = await apiGet<ParcelResponse[]>('/api/v1/parcels');
      setParcels(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);

  const handleMarkCollected = async (id: string) => {
    setError(''); setSuccess('');
    setCollectingId(id);
    try {
      await apiPatch(`/api/v1/parcels/${id}`, { status: 'COLLECTED' });
      setSuccess('Marked as collected. The gate can see it is with you now.');
      fetchParcels();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally { setCollectingId(null); }
  };

  if (loading) return <PageSkeleton width="max-w-5xl" />;

  const arrived = parcels.filter((p) => p.status === 'ARRIVED');
  const collected = parcels.filter((p) => p.status === 'COLLECTED');

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/resident')}
          aria-label="Back to dashboard"
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:text-accent-700"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,1)] sm:flex">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-display-sm font-display text-gray-900">Packages</h1>
            <p className="text-body-sm text-gray-500">Everything the gate has taken in for your unit</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <p className="flex-1 text-body-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss" className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="flex-1 text-body-sm text-emerald-700">{success}</p>
          <button onClick={() => setSuccess('')} aria-label="Dismiss" className="rounded-lg p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Awaiting collection ─────────────────────────────────────── */}
      <Panel
        icon={PackageOpen}
        title="Awaiting collection"
        hint={arrived.length === 0 ? 'Nothing is waiting for you' : 'Collect from the gate, then mark it here'}
        meta={<CountPill tone={arrived.length === 0 ? 'neutral' : 'accent'}>{arrived.length}</CountPill>}
      >
        {arrived.length === 0 ? (
          <PanelEmpty
            icon={Package}
            title="No packages waiting"
            description="When the gate logs a parcel for your unit, it shows up here with a photo and the time it arrived."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {arrived.map((p) => (
              <li key={p.id} className="relative">
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" aria-hidden="true" />

                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 pl-6">
                  {p.photoUrl ? (
                    <a
                      href={photoSrc(p.photoUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-50"
                      title="View parcel photo"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoSrc(p.photoUrl)}
                        alt={`Parcel ${p.description}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </a>
                  ) : (
                    <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 ring-1 ring-accent-100">
                      <Package className="h-6 w-6" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body font-semibold text-gray-900">{p.description}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                      <Field label="Arrived" hint={shortDateTime(p.createdAt)}>{waitLabel(p.createdAt)}</Field>
                      <Field label="Unit">
                        <span className="inline-flex items-center gap-1.5">
                          <Home className="h-3.5 w-3.5 text-gray-400" /> {p.unitNumber}
                        </span>
                      </Field>
                      <Field label="Logged by">
                        <span className="inline-flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-gray-400" /> {p.loggedByUserName}
                        </span>
                      </Field>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMarkCollected(p.id)}
                    disabled={collectingId === p.id}
                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-semibold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)] transition-all hover:-translate-y-0.5 hover:bg-accent-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {collectingId === p.id ? 'Marking...' : 'Mark collected'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── Collection history ──────────────────────────────────────── */}
      {collected.length > 0 && (
        <Panel
          icon={PackageCheck}
          title="Collection history"
          hint="Parcels you have already taken in"
          meta={<CountPill tone="neutral">{collected.length}</CountPill>}
          className="mt-6"
        >
          <ul className="divide-y divide-gray-100">
            {collected.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Check className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-gray-700">{p.description}</span>
                <span className="inline-flex items-center gap-1.5 text-caption-xs text-gray-400">
                  <Clock className="h-3 w-3" /> {shortDateTime(p.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-caption-xs text-gray-400">
                  <UserIcon className="h-3 w-3" /> {p.collectedByUserName || p.loggedByUserName}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
