'use client';

import { IconCircleCheck, IconFileInvoice } from '@tabler/icons-react';
import { messageStyle } from '../PurchaseVoucherStyles';
import type { PurchaseMessageKind } from '../PurchaseVoucherTypes';

interface PurchaseMessageBannerProps {
  message: {
    kind: PurchaseMessageKind;
    text: string;
  };
}

export function PurchaseMessageBanner({ message }: PurchaseMessageBannerProps) {
  return (
    <div style={messageStyle(message.kind)}>
      {message.kind === 'success' ? <IconCircleCheck size={18} /> : <IconFileInvoice size={18} />}
      {message.text}
    </div>
  );
}
