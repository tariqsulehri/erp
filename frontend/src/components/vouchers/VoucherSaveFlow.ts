import { friendlyErrorMessage, type VoucherMessageKind } from './VoucherShared';

export interface SavedVoucherSummary {
  id: string;
  voucher_number: string;
}

export interface VoucherMutation<Input, Result> {
  mutateAsync(input: Input): Promise<Result>;
}

export async function saveVoucherDocument<CreateInput>({
  createVoucher,
  updateVoucher,
  invalidateVoucherList,
  editingVoucherId,
  createInput,
  submitForApproval,
  resetForm,
  saveErrorFallback,
}: {
  createVoucher: VoucherMutation<CreateInput, SavedVoucherSummary>;
  updateVoucher?: VoucherMutation<{ id: string; body: CreateInput }, SavedVoucherSummary>;
  invalidateVoucherList: () => Promise<unknown>;
  editingVoucherId?: string | null;
  createInput: CreateInput;
  submitForApproval: boolean;
  resetForm: (clearMessage?: boolean) => void;
  saveErrorFallback: string;
}): Promise<{ kind: VoucherMessageKind; text: string }> {
  try {
    const voucher = editingVoucherId && updateVoucher
      ? await updateVoucher.mutateAsync({ id: editingVoucherId, body: createInput })
      : await createVoucher.mutateAsync(createInput);

    const successText = submitForApproval
      ? `${voucher.voucher_number} saved and sent for approval.`
      : `${voucher.voucher_number} saved as Draft.`;

    let refreshWarning = '';
    try {
      await invalidateVoucherList();
    } catch (refreshError) {
      refreshWarning = ` ${friendlyErrorMessage(refreshError, 'The voucher list could not refresh automatically.')}`;
    }

    resetForm(false);
    return { kind: 'success', text: `${successText}${refreshWarning}` };
  } catch (error) {
    return {
      kind: 'error',
      text: friendlyErrorMessage(error, saveErrorFallback),
    };
  }
}
