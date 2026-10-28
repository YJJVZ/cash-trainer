/** Thin horizontal gauge (accuracy). */
export function Meter({ value }: { value: number }) {
  const tone = value >= 0.8 ? 'bg-ok' : value >= 0.6 ? 'bg-muted' : 'bg-err';
  return (
    <div className="h-1 w-full bg-surface-3 rounded-[1px] overflow-hidden" aria-hidden>
      <div className={`h-full ${tone}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
