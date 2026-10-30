import { ExecutiveAiWorkspace } from '@/components/executive-ai/ExecutiveAiWorkspace';

export const metadata = { title: 'Executive AI Copilot — BizTrack' };

export default function ExecutiveAiRoute() {
  return (
    <div className="page-shell" style={{ overflowY: 'auto' }}>
      <ExecutiveAiWorkspace />
    </div>
  );
}
