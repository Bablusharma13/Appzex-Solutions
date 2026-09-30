'use client';

import { Download, Eye, EyeOff, FileImage, FileSpreadsheet, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDeleteFile, useDownloadFile, useUpdateFileVisibility } from '@/hooks/use-work';
import { errorMessage } from '@/lib/api';
import type { FileItem } from '@/lib/types';
import { formatBytes, formatDate } from '@/lib/utils';
import { VisibilityBadge } from './badges';
import { ConfirmDialog } from './confirm-dialog';

function FileIcon({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith('image/') ? FileImage : /sheet|excel|csv/.test(mimeType) ? FileSpreadsheet : FileText;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}

interface FileListProps {
  files: FileItem[];
  showProject?: boolean;
  /** Agency mode: visibility toggle and delete. */
  manage?: { currentUserId: string | null; isAdmin: boolean } | null;
}

export function FileList({ files, showProject = false, manage = null }: FileListProps) {
  const download = useDownloadFile();
  const updateVisibility = useUpdateFileVisibility();
  const deleteFile = useDeleteFile();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileItem | null>(null);

  const handleDownload = (file: FileItem) => {
    setDownloadingId(file.id);
    download.mutate(
      { id: file.id, name: file.originalName },
      {
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => setDownloadingId(null),
      },
    );
  };

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {files.map((file) => {
          const canDelete = manage && (manage.isAdmin || file.uploadedBy?.id === manage.currentUserId);
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <FileIcon mimeType={file.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{formatBytes(file.size)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(file.createdAt)}</span>
                  {file.uploadedBy && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {file.uploadedBy.name}
                        {file.uploadedBy.role === 'CLIENT' && ' (client)'}
                      </span>
                    </>
                  )}
                  {showProject && file.project && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{file.project.name}</span>
                    </>
                  )}
                </p>
              </div>
              {manage && typeof file.clientVisible === 'boolean' && (
                <span className="hidden sm:block">
                  <VisibilityBadge clientVisible={file.clientVisible} />
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDownload(file)}
                loading={downloadingId === file.id}
                aria-label={`Download ${file.originalName}`}
              >
                {downloadingId !== file.id && <Download />}
              </Button>
              {manage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${file.originalName}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() =>
                        updateVisibility.mutate(
                          { id: file.id, clientVisible: !file.clientVisible },
                          { onSuccess: () => toast.success(file.clientVisible ? 'File is now internal' : 'File shared with the client') },
                        )
                      }
                    >
                      {file.clientVisible ? <EyeOff /> : <Eye />}
                      {file.clientVisible ? 'Make internal' : 'Share with client'}
                    </DropdownMenuItem>
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setPendingDelete(file)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete file?"
        description={`“${pendingDelete?.originalName}” will be permanently removed for everyone, including the client.`}
        confirmLabel="Delete file"
        destructive
        loading={deleteFile.isPending}
        onConfirm={() =>
          pendingDelete &&
          deleteFile.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success('File deleted');
              setPendingDelete(null);
            },
          })
        }
      />
    </>
  );
}
