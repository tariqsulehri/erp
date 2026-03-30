'use client';

/**
 * BulkImportModal — CSV-based bulk account creation.
 *
 * Flow:
 *   1. User uploads a CSV file (or pastes data)
 *   2. Client parses + validates each row immediately
 *   3. User reviews a preview table showing valid/invalid rows
 *   4. User clicks "Import N rows" → server creates accounts in level order
 *   5. Results table shows per-row outcome (Created / Skipped / Error)
 *
 * Expected CSV columns (header row required):
 *   code, name, account_type, normal_balance, is_posting, description
 *
 * account_type values: Asset | Liability | Equity | Revenue | Expense
 * normal_balance:      Debit | Credit
 * is_posting:          true | false | 1 | 0 | yes | no
 */

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── Types ───────────────────────────────────────────────────────────── */
const VALID_TYPES    = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;
const VALID_BALANCES = ['Debit', 'Credit'] as const;

type AccountType    = typeof VALID_TYPES[number];
type NormalBalance  = typeof VALID_BALANCES[number];

interface ParsedRow {
  line:           number;
  code:           string;
  name:           string;
  account_type:   AccountType;
  normal_balance: NormalBalance;
  is_posting:     boolean;
  description?:   string;
  errors:         string[];
}

interface ResultRow {
  code:    string;
  success: boolean;
  message: string;
}

/* ── CSV parser ──────────────────────────────────────────────────────── */
function parseBoolean(val: string): boolean {
  return ['true', '1', 'yes'].includes(val.toLowerCase().trim());
}

function parseCSV(text: string): ParsedRow[] {
  const lines  = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const idxOf   = (name: string) => headers.indexOf(name);

  const iCode    = idxOf('code');
  const iName    = idxOf('name');
  const iType    = idxOf('account_type');
  const iBalance = idxOf('normal_balance');
  const iPosting = idxOf('is_posting');
  const iDesc    = idxOf('description');

  return lines.slice(1).map((line, i) => {
    if (!line.trim()) return null;

    // Handle quoted fields
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,))/g)?.map(c =>
      c.replace(/^"|"$/g, '').replace(/""/g, '"').trim(),
    ) ?? line.split(',').map(c => c.trim());

    const code          = iCode    >= 0 ? (cols[iCode]    ?? '').trim() : '';
    const name          = iName    >= 0 ? (cols[iName]    ?? '').trim() : '';
    const account_type  = iType    >= 0 ? (cols[iType]    ?? '').trim() : '';
    const normal_balance = iBalance >= 0 ? (cols[iBalance] ?? '').trim() : '';
    const is_posting_str = iPosting >= 0 ? (cols[iPosting] ?? '').trim() : 'false';
    const description   = iDesc    >= 0 ? (cols[iDesc]    ?? '').trim() : '';

    const errors: string[] = [];
    if (!code || !/^\d{4}$/.test(code))       errors.push('Code must be exactly 4 digits');
    if (!name)                                  errors.push('Name is required');
    if (!VALID_TYPES.includes(account_type as any))
      errors.push(`account_type must be one of: ${VALID_TYPES.join(', ')}`);
    if (!VALID_BALANCES.includes(normal_balance as any))
      errors.push(`normal_balance must be Debit or Credit`);

    return {
      line:           i + 2,
      code,
      name,
      account_type:   account_type   as AccountType,
      normal_balance: normal_balance as NormalBalance,
      is_posting:     parseBoolean(is_posting_str),
      description:    description || undefined,
      errors,
    } satisfies ParsedRow;
  }).filter(Boolean) as ParsedRow[];
}

/* ── Template download ──────────────────────────────────────────────── */
function downloadTemplate() {
  const header = 'code,name,account_type,normal_balance,is_posting,description';
  const rows = [
    '1100,Current Assets,Asset,Debit,false,Short-term assets',
    '1110,Cash & Cash Equivalents,Asset,Debit,false,',
    '1111,Cash in Hand,Asset,Debit,true,Physical cash held at office',
    '1112,Petty Cash,Asset,Debit,true,Small discretionary expenses fund',
  ];
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'coa-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main modal ──────────────────────────────────────────────────────── */
interface BulkImportModalProps {
  open:    boolean;
  onClose: () => void;
  onDone:  () => void;
}

export function BulkImportModal({ open, onClose, onDone }: BulkImportModalProps) {
  const [rows,    setRows]    = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const importMutation = trpc.accounts.bulkCreate.useMutation({
    onSuccess: data => {
      setResults(data.results as ResultRow[]);
      utils.accounts.list.invalidate();
      utils.accounts.getHierarchy.invalidate();
    },
  });

  if (!open) return null;

  const validRows   = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
      setResults(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  };

  const handleImport = () => {
    if (!validRows.length) return;
    importMutation.mutate({ rows: validRows });
  };

  const handleClose = () => {
    setRows([]); setResults(null);
    onClose();
    if (results?.some(r => r.success)) onDone();
  };

  const importedCount = results?.filter(r => r.success && r.message === 'Created').length ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div onClick={!importMutation.isPending ? handleClose : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'fadeIn 0.15s ease',
        }}
      >
        {/* Modal */}
        <div onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 760, maxHeight: '90vh',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.15s ease',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                Bulk Import Accounts
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Upload a CSV file to create multiple accounts at once
              </p>
            </div>
            <button onClick={handleClose} disabled={importMutation.isPending}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', padding: 4, borderRadius: 4, display: 'flex',
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {/* Results view */}
            {results ? (
              <div>
                {/* Summary pills */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Created', value: importedCount, color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Skipped', value: results.filter(r => r.success && r.message !== 'Created').length, color: '#d97706', bg: '#fffbeb' },
                    { label: 'Failed',  value: results.filter(r => !r.success).length, color: '#dc2626', bg: '#fef2f2' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, padding: '12px 16px', borderRadius: 'var(--radius)',
                      background: s.bg, border: `1px solid ${s.color}30`,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Results table */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Code</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Result</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{r.code}</td>
                          <td style={{ padding: '6px 12px' }}>
                            <span style={{
                              fontSize: '0.6875rem', fontWeight: 700,
                              color: r.success ? '#16a34a' : '#dc2626',
                              background: r.success ? '#f0fdf4' : '#fef2f2',
                              padding: '2px 8px', borderRadius: 8,
                            }}>
                              {r.success ? '✓' : '✗'} {r.message}
                            </span>
                          </td>
                          <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)' }}>
                            {!r.success && r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                {/* Upload area */}
                {rows.length === 0 && (
                  <>
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius)', padding: '40px 20px',
                        textAlign: 'center', cursor: 'pointer',
                        background: dragOver ? 'var(--color-primary-light)' : 'var(--color-bg)',
                        transition: 'all 0.15s',
                        marginBottom: 16,
                      }}
                    >
                      <input ref={fileRef} type="file" accept=".csv"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                      />
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5"
                        style={{ marginBottom: 12, opacity: 0.6 }}>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text)' }}>
                        {dragOver ? 'Drop your CSV here' : 'Drop CSV or click to browse'}
                      </p>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Required columns: code, name, account_type, normal_balance, is_posting
                      </p>
                    </div>

                    <button className="btn btn-secondary" onClick={downloadTemplate}
                      style={{ width: '100%', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      Download CSV Template
                    </button>
                  </>
                )}

                {/* Preview table */}
                {rows.length > 0 && (
                  <>
                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      <span style={{
                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        color: '#16a34a', background: '#f0fdf4',
                        padding: '4px 12px', borderRadius: 8,
                        border: '1px solid #bbf7d0',
                      }}>
                        ✓ {validRows.length} valid
                      </span>
                      {invalidRows.length > 0 && (
                        <span style={{
                          fontSize: 'var(--font-size-xs)', fontWeight: 600,
                          color: '#dc2626', background: '#fef2f2',
                          padding: '4px 12px', borderRadius: 8,
                          border: '1px solid #fecaca',
                        }}>
                          ✗ {invalidRows.length} invalid
                        </span>
                      )}
                      <button className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ''; }}>
                        Change File
                      </button>
                    </div>

                    {/* Preview */}
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                        <thead style={{ position: 'sticky', top: 0 }}>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>#</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Code</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Name</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Type</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Balance</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Posting</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.line}
                              style={{
                                borderBottom: '1px solid var(--color-border)',
                                background: row.errors.length ? '#fff5f5' : 'white',
                              }}>
                              <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)' }}>{row.line}</td>
                              <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{row.code || '—'}</td>
                              <td style={{ padding: '6px 12px' }}>{row.name || '—'}</td>
                              <td style={{ padding: '6px 12px' }}>{row.account_type || '—'}</td>
                              <td style={{ padding: '6px 12px' }}>{row.normal_balance || '—'}</td>
                              <td style={{ padding: '6px 12px' }}>{row.is_posting ? 'Yes' : 'No'}</td>
                              <td style={{ padding: '6px 12px' }}>
                                {row.errors.length === 0 ? (
                                  <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Valid</span>
                                ) : (
                                  <span style={{ color: '#dc2626', fontWeight: 600 }} title={row.errors.join('\n')}>
                                    ✗ {row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ''}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            background: '#f8fafc',
          }}>
            <button className="btn btn-secondary" onClick={handleClose} disabled={importMutation.isPending}>
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && rows.length > 0 && (
              <button className="btn btn-primary"
                onClick={handleImport}
                disabled={validRows.length === 0 || importMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {importMutation.isPending
                  ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Importing…</>
                  : `Import ${validRows.length} Account${validRows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </>
  );
}
