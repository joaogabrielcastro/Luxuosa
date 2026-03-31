export function Spinner({ className = "h-4 w-4" }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-700`} />;
}
