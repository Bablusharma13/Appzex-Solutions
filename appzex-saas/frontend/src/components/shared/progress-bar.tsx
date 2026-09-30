import type { Progress } from '@/lib/types';
import { cn } from '@/lib/utils';

const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

interface ProgressBarProps {
  value: number;
  size?: keyof typeof heights;
  label?: string;
  className?: string;
}

/** Meter: fill in the accent, unfilled track a lighter step of the same hue. */
export function ProgressBar({ value, size = 'md', label = 'Progress', className }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('w-full overflow-hidden rounded-full bg-primary-soft', heights[size], className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Derived project progress: bar + percentage + completed/total tasks. */
export function ProjectProgress({ progress, size = 'md', className }: { progress: Progress; size?: keyof typeof heights; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{progress.percent}%</span>
        <span className="text-muted-foreground">
          {progress.totalTasks === 0 ? 'No tasks yet' : `${progress.completedTasks}/${progress.totalTasks} tasks`}
        </span>
      </div>
      <ProgressBar value={progress.percent} size={size} label="Project progress" />
    </div>
  );
}
