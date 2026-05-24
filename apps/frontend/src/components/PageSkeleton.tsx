export function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-7 bg-trovao-surface rounded-lg w-2/5" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
    </div>
  );
}
