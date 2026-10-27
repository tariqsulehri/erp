import { LoadingScreen } from '@/components/ui/LoadingSpinner';

export default function RootLoading() {
  return (
    <LoadingScreen
      message="Loading Workspace…"
      description="Connecting to ERP platform"
      fullScreen
    />
  );
}
