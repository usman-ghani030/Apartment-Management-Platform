import { LoadingScreen } from '@/components/ui/LoadingScreen';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <LoadingScreen label="Loading OmniHome" hint="Just a moment while we get things ready." />
    </div>
  );
}
