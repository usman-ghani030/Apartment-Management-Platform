'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home, Building2 } from 'lucide-react';
import { auth, ApiError, apiGet } from '@/lib/api';

const UNIT_TYPES: Record<string, string> = {
  OWNER_OCCUPIED: 'Owner Occupied',
  RENTED: 'Rented',
  VACANT: 'Vacant',
};

const BEDROOM_TYPES: Record<string, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bedroom',
  TWO_BED: '2 Bedrooms',
  THREE_BED: '3 Bedrooms',
  FOUR_BED: '4 Bedrooms',
  FOUR_PLUS_BED: '4+ Bedrooms',
};

interface BuildingDetail {
  id: string;
  name: string;
  unitCount: number;
  units: UnitInBuilding[];
}

interface UnitInBuilding {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  bedroomType: string | null;
  residentCount: number;
  occupantName: string | null;
  hasLinkedResident: boolean;
}

export default function BuildingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const buildingId = params.id as string;

  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    auth.me().catch(() => router.push('/login'));
    fetchBuilding();
  }, [router, buildingId]);

  const fetchBuilding = async () => {
    try {
      const data = await apiGet<BuildingDetail>(`/api/v1/buildings/${buildingId}`);
      setBuilding(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load building');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/dashboard/admin/buildings')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        </div>
      </div>
    );
  }

  // Group units by floor
  const unitsByFloor = (building?.units || []).reduce((acc, unit) => {
    const floor = unit.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<number, UnitInBuilding[]>);

  const sortedFloors = Object.keys(unitsByFloor).map(Number).sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/admin/buildings')} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{building?.name}</h1>
              <p className="text-gray-700 text-sm mt-1">{building?.unitCount} unit(s)</p>
            </div>
          </div>
        </div>

        {/* Units by Floor */}
        {building?.units.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center">
            <Home className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-700">No units in this building yet</p>
            <p className="text-gray-700 text-sm mt-1">Add units from the Units page</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedFloors.map((floor) => (
              <div key={floor}>
                <h2 className="text-sm font-medium text-gray-500 mb-3">Floor {floor}</h2>
                <div className="space-y-2">
                  {unitsByFloor[floor].map((u) => (
                    <div
                      key={u.id}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-accent-500/30 transition-all cursor-pointer flex items-center justify-between"
                      onClick={() => router.push(`/dashboard/admin/units/${u.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                          <Home className="w-5 h-5 text-accent-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{u.unitNumber}</h3>
                          <p className="text-xs text-gray-700">
                            {UNIT_TYPES[u.type] || u.type}
                            {u.bedroomType && ` · ${BEDROOM_TYPES[u.bedroomType] || u.bedroomType}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {u.hasLinkedResident ? `👤 ${u.occupantName || 'Resident'}` : u.occupantName ? `📋 ${u.occupantName} (not linked)` : '🏠 Vacant'}
                            {u.residentCount > 0 && ` · ${u.residentCount} resident(s)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
