import { Label } from '@first2apply/ui';

/**
 * 0-500 mile distance slider, shared by "Search all UK boards" and "Add Search".
 */
export function DistanceSlider({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (miles: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-medium">{value === 0 ? 'Exact location only' : `Within ${value} miles`}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={500}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>400</span>
        <span>500 miles</span>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
