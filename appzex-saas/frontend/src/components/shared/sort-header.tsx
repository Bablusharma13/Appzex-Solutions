import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TH } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export interface SortState<F extends string> {
  field: F;
  order: 'asc' | 'desc';
}

interface SortHeaderProps<F extends string> {
  field: F;
  label: string;
  sort: SortState<F>;
  onSort: (next: SortState<F>) => void;
  className?: string;
}

/** Column header that toggles server-side sorting. */
export function SortHeader<F extends string>({ field, label, sort, onSort, className }: SortHeaderProps<F>) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH className={className} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort({ field, order: active && sort.order === 'desc' ? 'asc' : 'desc' })}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TH>
  );
}
