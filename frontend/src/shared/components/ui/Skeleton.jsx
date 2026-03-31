export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`${className} animate-pulse rounded bg-slate-200`} />;
}
