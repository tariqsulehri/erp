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
import { useQueryClient } from '@tanstack/react-query';
import { accountsQueryKey, useBulkCreateAccounts } from '@/lib/api/accounts';
import { ACCOUNT_CODE_PATTERN } from '@/modules/accounts/account-code';
import { IconDownload, IconUpload, IconX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
    if (!code || !ACCOUNT_CODE_PATTERN.test(code)) errors.push('Code must have exactly 10 digits.');
    if (!name)                                  errors.push('Enter a Name.');
    if (!VALID_TYPES.includes(account_type as any))
      errors.push(`The account_type column must be one of: ${VALID_TYPES.join(', ')}.`);
    if (!VALID_BALANCES.includes(normal_balance as any))
      errors.push('The normal_balance column must be Debit or Credit.');

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
    '0101000000,Current Assets,Asset,Debit,false,Short-term assets',
    '0101100000,Cash And Cash Equivalents,Asset,Debit,false,',
    '0101100001,Cash In Hand,Asset,Debit,true,Physical cash held at office',
    '0101100002,Petty Cash,Asset,Debit,true,Small discretionary expenses fund',
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

  const queryClient = useQueryClient();
  const importMutation = useBulkCreateAccounts();

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
    importMutation.mutate({ rows: validRows }, {
      onSuccess: data => {
        setResults(data.results as ResultRow[]);
        queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      },
    });
  };

  const handleClose = () => {
    setRows([]); setResults(null);
    onClose();
    if (results?.some(r => r.success)) onDone();
  };

  const importedCount = results?.filter(r => r.success && r.message === 'Created').length ?? 0;

  const skippedCount = results ? results.filter(r => r.success && r.message !== 'Created').length : 0;
  const failedCount = results ? results.filter(r => !r.success).length : 0;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !importMutation.isPending) handleClose(); }}>
      <div className="dialog dialog-lg" role="dialog" aria-modal="true" aria-labelledby="bulk-import-title" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="panel-header" style={{ padding: '14px 20px' }}>
          <div>
            <h2 id="bulk-import-title" className="dialog-title" style={{ margin: 0 }}>Bulk Import Accounts</h2>
            <p className="dialog-message">Upload a CSV file to create many accounts at once.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={handleClose} disabled={importMutation.isPending} aria-label="Close" title="Close" />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {results ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge variant="success">{importedCount} Created</Badge>
                <Badge variant="warning">{skippedCount} Skipped</Badge>
                <Badge variant="danger">{failedCount} Failed</Badge>
              </div>
              <div className="panel" style={{ maxHeight: 360 }}>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr><th style={{ width: 140 }}>Code</th><th style={{ width: 140 }}>Result</th><th>Message</th></tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i}>
                          <td className="cell-strong">{r.code}</td>
                          <td><Badge variant={r.success ? 'success' : 'danger'}>{r.success ? r.message : 'Failed'}</Badge></td>
                          <td className="cell-muted">{!r.success && r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : rows.length === 0 ? (
            <>
              <button
                type="button"
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  width: '100%', padding: '36px 20px',
                  border: `1px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-input-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  background: dragOver ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
                  color: 'var(--color-text)',
                  transition: 'background var(--transition), border-color var(--transition)',
                }}
              >
                <IconUpload size={28} stroke={1.6} aria-hidden style={{ color: 'var(--color-text-light)' }} />
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{dragOver ? 'Drop Your CSV File Here' : 'Drop A CSV File Or Click To Browse'}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>The file must have these columns: code, name, account_type, normal_balance, is_posting</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <Button variant="secondary" icon={<IconDownload size={16} stroke={1.8} />} onClick={downloadTemplate} style={{ alignSelf: 'flex-start' }}>Download CSV Template</Button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge variant="success">{validRows.length} Ready</Badge>
                {invalidRows.length > 0 && <Badge variant="danger">{invalidRows.length} With Errors</Badge>}
                <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }} onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ''; }}>Change File</Button>
              </div>
              <div className="panel" style={{ maxHeight: 360 }}>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="num" style={{ width: 48 }}>No.</th><th style={{ width: 130 }}>Code</th><th>Name</th>
                        <th style={{ width: 110 }}>Type</th><th style={{ width: 90 }}>Balance</th><th style={{ width: 80 }}>Posting</th><th style={{ width: 200 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.line} style={row.errors.length ? { background: 'var(--color-danger-bg)' } : undefined}>
                          <td className="num cell-muted">{row.line}</td>
                          <td className="cell-strong">{row.code || 'Not Set'}</td>
                          <td>{row.name || 'Not Set'}</td>
                          <td>{row.account_type || 'Not Set'}</td>
                          <td>{row.normal_balance || 'Not Set'}</td>
                          <td>{row.is_posting ? 'Yes' : 'No'}</td>
                          <td title={row.errors.join('\n') || undefined}>
                            {row.errors.length === 0
                              ? <Badge variant="success">Ready</Badge>
                              : <span style={{ color: 'var(--color-danger-text)', fontWeight: 500 }}>{row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1} More)` : ''}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <Button variant="secondary" onClick={handleClose} disabled={importMutation.isPending}>{results ? 'Close' : 'Cancel'}</Button>
          {!results && rows.length > 0 && (
            <Button variant="primary" onClick={handleImport} disabled={validRows.length === 0} loading={importMutation.isPending}>
              {importMutation.isPending ? 'Importing…' : `Import ${validRows.length} Account${validRows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
