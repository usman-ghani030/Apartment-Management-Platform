'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Loader2, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ApiError, API_BASE, apiPost, apiUpload, getAuthToken } from '@/lib/api';

/**
 * The one bulk-CSV import flow, shared by every page that imports records.
 *
 * Four steps, identical everywhere: upload → preview (what will be created,
 * what will be skipped, what is broken) → importing → done. Pages supply only
 * the endpoints and how their own rows read, so Units and Buildings cannot
 * drift apart.
 *
 *   <CsvImportModal
 *     open={showImport}
 *     onClose={() => setShowImport(false)}
 *     entityPlural="units"
 *     sample={{ url: '/api/v1/import/sample-csv', fileName: 'sample-units-import.csv' }}
 *     validateUrl="/api/v1/import/validate"
 *     confirmUrl="/api/v1/import/confirm"
 *     columns={[{ label: 'Unit', value: (r) => r['Unit Number'] }]}
 *     describeSkip={(s) => `${s.buildingName} / ${s.unitNumber}`}
 *     onImported={fetchData}
 *   />
 */

export type CsvImportPreviewRow = Record<string, string>;

export interface CsvImportColumn {
  label: string;
  value: (row: CsvImportPreviewRow) => React.ReactNode;
}

/** Rows the server recognised but will not create (already exist / duplicate). */
export interface CsvImportSkipRow {
  row: number;
  reason: string;
  [key: string]: unknown;
}

export interface CsvImportValidateResult {
  toCreate: CsvImportPreviewRow[];
  toSkip: CsvImportSkipRow[];
  errors: { row: number; reason: string }[];
  totalRows: number;
}

export interface CsvImportResult {
  created: number;
  skipped: number;
  errors: number;
  totalRows: number;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const PREVIEW_LIMIT = 10;

export function CsvImportModal({
  open,
  onClose,
  title,
  subtitle,
  entityPlural,
  sample,
  validateUrl,
  confirmUrl,
  columns,
  describeSkip,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  /** Used in labels: "Confirm (12 units)", "Importing units...". */
  entityPlural: string;
  sample: { url: string; fileName: string };
  validateUrl: string;
  confirmUrl: string;
  columns: CsvImportColumn[];
  /** How a skipped row reads before its reason, e.g. "Tower A / 101". */
  describeSkip: (row: CsvImportSkipRow) => string;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<CsvImportValidateResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A fresh open always starts clean - no leftover file, step or summary.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setStep('upload');
    setPreview(null);
    setError('');
    setBusy(false);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  const pickFile = (picked: File | null) => {
    setFile(picked);
    setError('');
  };

  const backToUpload = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    // Clearing the input lets the same file be chosen again.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSample = async () => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['x-access-token'] = token;
      const res = await fetch(`${API_BASE}${sample.url}`, { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sample.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the sample CSV. Try again.');
    }
  };

  const validate = async () => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await apiUpload<CsvImportValidateResult>(validateUrl, formData);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to validate CSV');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview || preview.toCreate.length === 0) return;
    setError('');
    setBusy(true);
    setStep('importing');
    try {
      const data = await apiPost<CsvImportResult>(confirmUrl, { toCreate: preview.toCreate });
      setResult(data);
      setStep('done');
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to import');
      setStep('preview');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} icon={Upload} title={title} subtitle={subtitle} size="lg">
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">{error}</div>
      )}

      {step === 'upload' && (
        <div className="space-y-5">
          <button
            onClick={downloadSample}
            className="inline-flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3.5 py-2 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-100"
          >
            <Download className="w-4 h-4" /> Download sample CSV
          </button>

          <div className="border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/60 p-8 text-center transition-colors hover:border-accent-300 hover:bg-accent-50/40">
            <div className="w-12 h-12 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-5 h-5 text-accent-500" />
            </div>
            <p className="text-body-sm text-gray-500 mb-3">Drag and drop your CSV file here, or</p>
            <label className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-5 py-2.5 text-body-sm font-medium cursor-pointer transition-all shadow-sm">
              <Upload className="w-4 h-4" /> Choose file
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <div className="mt-3 inline-flex items-center gap-2 bg-accent-50 text-accent-700 rounded-lg px-3 py-1.5 text-body-sm">
                <CheckCircle className="w-3.5 h-3.5" /> {file.name}
              </div>
            )}
          </div>

          <button
            onClick={validate}
            disabled={!file || busy}
            className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-body-sm font-medium flex items-center justify-center gap-2 transition-all"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Validating...
              </>
            ) : (
              'Validate CSV'
            )}
          </button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <p className="text-display font-display text-emerald-700">{preview.toCreate.length}</p>
              <p className="text-caption-xs text-emerald-600 font-medium mt-1">Will create</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-display font-display text-amber-600">{preview.toSkip.length}</p>
              <p className="text-caption-xs text-amber-600 font-medium mt-1">Skipped</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-display font-display text-red-600">{preview.errors.length}</p>
              <p className="text-caption-xs text-red-600 font-medium mt-1">Errors</p>
            </div>
          </div>

          {preview.toSkip.length > 0 && (
            <div>
              <h4 className="text-body-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Skipped rows
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.toSkip.map((skip, i) => (
                  <div key={i} className="text-caption-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
                    Row {skip.row}: {describeSkip(skip)} - {skip.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div>
              <h4 className="text-body-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Validation errors
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.errors.map((rowError, i) => (
                  <div key={i} className="text-caption-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
                    Row {rowError.row}: {rowError.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.toCreate.length > 0 && (
            <div>
              <h4 className="text-body-sm font-medium text-gray-700 mb-2">
                Preview (first {Math.min(preview.toCreate.length, PREVIEW_LIMIT)} rows)
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200">
                <table className="w-full text-caption-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {columns.map((col) => (
                        <th key={col.label} className="text-left py-2 px-3 text-gray-500 font-semibold">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.toCreate.slice(0, PREVIEW_LIMIT).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        {columns.map((col) => (
                          <td key={col.label} className="py-2 px-3">
                            {col.value(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.toCreate.length > PREVIEW_LIMIT && (
                  <p className="text-caption-xs text-gray-500 mt-2 px-3">
                    ...and {preview.toCreate.length - PREVIEW_LIMIT} more
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={backToUpload}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl py-2.5 text-body-sm font-medium transition-all"
            >
              Back
            </button>
            <button
              onClick={confirm}
              disabled={preview.toCreate.length === 0 || busy}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-body-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" /> Confirm ({preview.toCreate.length} {entityPlural})
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-accent-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Importing {entityPlural}...</p>
          <p className="text-gray-400 text-body-sm mt-1">This may take a moment for large files.</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4 text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-display font-display text-emerald-700">{result.created}</p>
              <p className="text-caption-xs text-emerald-600 font-medium mt-1">Created</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-display font-display text-amber-600">{result.skipped}</p>
              <p className="text-caption-xs text-amber-600 font-medium mt-1">Skipped</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-display font-display text-red-600">{result.errors}</p>
              <p className="text-caption-xs text-red-600 font-medium mt-1">Errors</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-accent-600 hover:bg-accent-700 text-white rounded-xl px-6 py-2.5 text-body-sm font-medium transition-all"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
