'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePortalMeetings } from '@/hooks/use-portal';
import { formatDateTime } from '@/lib/utils';

export default function ClientMeetingsPage() {
  const { data: meetings, isLoading, isError, error, refetch } = usePortalMeetings();

  return (
    <>
      <PageHeader title="Meetings" description="Summaries of meetings your agency has shared with you." />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !meetings ? (
        <ListSkeleton rows={4} />
      ) : meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No shared meetings yet" description="After a meeting, your agency can share a summary here." />
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <CardTitle>{meeting.title}</CardTitle>
                <CardDescription>
                  {formatDateTime(meeting.meetingDate)} ·{' '}
                  <Link href={`/client/projects/${meeting.project.id}`} className="hover:underline">
                    {meeting.project.name}
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{meeting.summary || 'Summary coming soon.'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
