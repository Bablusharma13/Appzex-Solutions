'use client';

import { Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { RoleBadge } from '@/components/shared/badges';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import type { Comment } from '@/lib/types';
import { formatDateTime, timeAgo } from '@/lib/utils';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId?: string | null;
  onSubmit?: (content: string, reset: () => void) => void;
  submitting?: boolean;
  placeholder?: string;
  emptyText?: string;
}

/** Conversation list + composer, used for task comments and feedback replies. */
export function CommentThread({ comments, currentUserId, onSubmit, submitting, placeholder = 'Write a comment…', emptyText = 'No comments yet.' }: CommentThreadProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !onSubmit) return;
    onSubmit(trimmed, () => setContent(''));
  };

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.user.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">
                    {comment.user.name}
                    {comment.user.id === currentUserId && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  {comment.user.role === 'CLIENT' && <RoleBadge role="CLIENT" />}
                  <time className="text-xs text-muted-foreground" dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                    {timeAgo(comment.createdAt)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-sm leading-relaxed text-foreground">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {onSubmit && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor="comment-composer" className="sr-only">
            {placeholder}
          </label>
          <Textarea
            id="comment-composer"
            rows={3}
            value={content}
            maxLength={5000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={placeholder}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={submitting} disabled={!content.trim()}>
              {!submitting && <Send />} Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
