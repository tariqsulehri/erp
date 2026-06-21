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
  postVoucher,
  invalidateVoucherList,
  createInput,
  postAfterSave,
  resetForm,
  saveErrorFallback,
}: {
  createVoucher: VoucherMutation<CreateInput, SavedVoucherSummary>;
  postVoucher: VoucherMutation<{ id: string }, unknown>;
  invalidateVoucherList: () => Promise<unknown>;
  createInput: CreateInput;
  postAfterSave: boolean;
  resetForm: (clearMessage?: boolean) => void;
  saveErrorFallback: string;
}): Promise<{ kind: VoucherMessageKind; text: string }> {
  try {
    const voucher = await createVoucher.mutateAsync(createInput);

    let successText = `${voucher.voucher_number} saved as Draft.`;
    if (postAfterSave) {
      try {
        await postVoucher.mutateAsync({ id: voucher.id });
        successText = `${voucher.voucher_number} saved and posted successfully.`;
      } catch (postError) {
        resetForm(false);
        return {
          kind: 'error',
          text: `${voucher.voucher_number} was saved as Draft, but could not be posted. ${friendlyErrorMessage(postError, 'Please review the voucher and try Process again.')}`,
        };
      }
    }

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
