import { MessageSquare, Paperclip } from 'lucide-react';
import { FeedbackStatusBadge } from '@/components/shared/badges';
import type { Feedback } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

/** Compact list of feedback items; click opens the conversation. */
export function FeedbackList({ items, onOpen, showProject = false }: { items: Feedback[]; onOpen: (id: string) => void; showProject?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.description}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>
                  {item.submittedBy.name}
                  {item.submittedBy.role === 'CLIENT' ? ' (client)' : ''}
                </span>
                <span aria-hidden>·</span>
                <span>{timeAgo(item.createdAt)}</span>
                {showProject && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {item.project.name}
                      {item.project.client ? ` — ${item.project.client.companyName}` : ''}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              {item.commentCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="size-3.5" aria-hidden /> {item.commentCount}
                </span>
              )}
              {Boolean(item.fileCount) && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3.5" aria-hidden /> {item.fileCount}
                </span>
              )}
              <FeedbackStatusBadge status={item.status} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
