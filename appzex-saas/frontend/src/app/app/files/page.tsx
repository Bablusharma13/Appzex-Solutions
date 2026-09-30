'use client';

import { FileText, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileList } from '@/components/shared/file-list';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { FileUploadDialog } from '@/features/files/file-upload-dialog';
import { ProjectSelect } from '@/features/shared/option-selects';
import { usePermissions } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFiles, useUploadFile } from '@/hooks/use-work';
import { cn } from '@/lib/utils';

export default function FilesPage() {
  const { canEdit, isAgencyAdmin, userId } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [projectId, setProjectId] = useState('');
  const [visibility, setVisibility] = useState('');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const upload = useUploadFile();

  useEffect(() => setPage(1), [debouncedSearch, projectId, visibility]);
  const { data, isLoading, isError, error, refetch, isFetching } = useFiles({
    page,
    pageSize: 20,
    search: debouncedSearch,
    projectId,
    clientVisible: visibility,
  });
  const filtered = Boolean(debouncedSearch || projectId || visibility);

  return (
    <>
      <PageHeader
        title="Files"
        description="Stored privately. Downloads always go through permission checks; clients only see files you share."
        actions={
          canEdit && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Upload file
            </Button>
          )
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search file names" label="Search files" />
        <ProjectSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-60" placeholder="All projects" aria-label="Filter by project" />
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="sm:w-44" aria-label="Filter by visibility">
          <option value="">All files</option>
          <option value="true">Shared with client</option>
          <option value="false">Internal only</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={5} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? 'No files match your filters' : 'No files yet'}
          description={filtered ? 'Try clearing a filter.' : 'Upload briefs, designs and deliverables to a project.'}
          action={!filtered && canEdit && <Button onClick={() => setUploadOpen(true)}><Upload /> Upload file</Button>}
        />
      ) : (
        <div className={cn('transition-opacity', isFetching && 'opacity-70')}>
          <FileList files={data.items} showProject manage={canEdit ? { currentUserId: userId, isAdmin: isAgencyAdmin } : null} />
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        pending={upload.isPending}
        onUpload={(input, done, fail) =>
          upload.mutate(input, {
            onSuccess: (file) => {
              toast.success(`${file.originalName} uploaded`);
              done();
            },
            onError: fail,
          })
        }
      />
    </>
  );
}
