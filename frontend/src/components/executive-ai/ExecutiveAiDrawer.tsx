'use client';

import { Drawer } from '@/components/ui/Drawer';
import { ExecutiveAiWorkspace } from './ExecutiveAiWorkspace';

export interface ExecutiveAiDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ExecutiveAiDrawer({ open, onClose }: ExecutiveAiDrawerProps) {
  return (
    <Drawer
      open={open}
      title="Executive AI Assistant"
      size="lg"
      onClose={onClose}
    >
      <ExecutiveAiWorkspace isDrawer={true} />
    </Drawer>
  );
}
