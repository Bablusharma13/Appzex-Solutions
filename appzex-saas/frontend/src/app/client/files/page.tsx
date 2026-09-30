'use client';

import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileList } from '@/components/shared/file-list';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { FileUploadDialog } from '@/features/files/file-upload-dialog';
import { usePortalFiles, usePortalProjects, usePortalUpload } from '@/hooks/use-portal';

export default function ClientFilesPage() {
  const [projectId, setProjectId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: projects = [] } = usePortalProjects();
  const { data: files, isLoading, isError, error, refetch } = usePortalFiles({ projectId });
  const upload = usePortalUpload();

  return (
    <>
      <PageHeader
        title="Files"
        description="Files shared between you and your agency. Downloads are protected by your login."
        actions={
          <Button onClick={() => setUploadOpen(true)} disabled={projects.length === 0}>
            <Upload /> Share a file
          </Button>
        }
      />
      <FilterBar>
        <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-60" aria-label="Filter by project">
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </FilterBar>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !files ? (
        <ListSkeleton rows={4} />
      ) : files.length === 0 ? (
        <EmptyState icon={FileText} title="No files yet" description="Your agency has not shared files with you yet." />
      ) : (
        <FileList files={files} showProject />
      )}
      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowVisibilityChoice={false}
        projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
        pending={upload.isPending}
        onUpload={(input, done, fail) =>
          upload.mutate(
            { projectId: input.projectId, file: input.file },
            {
              onSuccess: (file) => {
                toast.success(`${file.originalName} shared with your agency`);
                done();
              },
              onError: fail,
            },
          )
        }
      />
    </>
  );
}
