import { DOCUMENT_STATUS_OPTIONS, documentStatusLabel, STOCK_DOCUMENT_STATUS_OPTIONS } from '@/components/documents/DraftDocumentActions';

describe('documentStatusLabel', () => {
  it('shows Voided as Cancelled for a draft and as Reversed for a document that had been posted', () => {
    expect(documentStatusLabel('Voided')).toBe('Cancelled');
    expect(documentStatusLabel('Voided', null)).toBe('Cancelled');
    expect(documentStatusLabel('Voided', '2026-10-01T10:00:00Z')).toBe('Reversed');
  });

  it('leaves other statuses as they are', () => {
    expect(documentStatusLabel('Draft')).toBe('Draft');
    expect(documentStatusLabel('Posted', '2026-10-01T10:00:00Z')).toBe('Posted');
  });

  it('names the Voided filter for each kind of list', () => {
    expect(DOCUMENT_STATUS_OPTIONS.find(option => option.value === 'Voided')?.label).toBe('Cancelled');
    expect(STOCK_DOCUMENT_STATUS_OPTIONS.find(option => option.value === 'Voided')?.label).toBe('Cancelled Or Reversed');
  });
});
