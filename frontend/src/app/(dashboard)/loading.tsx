import { LoadingScreen } from '@/components/ui/LoadingSpinner';

export default function DashboardLoading() {
  return (
    <LoadingScreen
      message="Loading Screen…"
      description="Fetching fresh accounting and operations data"
    />
  );
}
