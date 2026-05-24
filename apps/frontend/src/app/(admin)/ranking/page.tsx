'use client';

import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import { AdminRankingPreview } from '@/components/AdminRankingPreview';

export default function AdminRankingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking — Draft</h1>
      <AdminRankingPreview bolaoId={BOLAO_GLOBAL_ID} />
    </div>
  );
}
