'use client';

import { FileUp, UploadCloud } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { FormField } from '@/components/shared/form-field';
import { InlineAlert } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Label } from '@/components/ui/input';
import { ProjectSelect } from '@/features/shared/option-selects';
import { useOnOpen } from '@/hooks/use-on-open';
import { errorMessage } from '@/lib/api';
import { cn, formatBytes } from '@/lib/utils';

export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Client-side pre-check for fast feedback; the API re-validates type, content and size. */
export function precheckFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  if (file.size > MAX_UPLOAD_BYTES) return 'File is too large. Maximum size is 10 MB.';
  if (file.size === 0) return 'The file is empty.';
  return null;
}

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed project; omit to let the user choose (agency only). */
  projectId?: string;
  /** Agency uploads can be internal; client uploads are always shared. */
  allowVisibilityChoice?: boolean;
  projectOptions?: { id: string; name: string }[];
  pending?: boolean;
  onUpload: (input: { projectId: string; file: File; clientVisible: boolean }, done: () => void, fail: (error: unknown) => void) => void;
}

export function FileUploadDialog({ open, onOpenChange, projectId, allowVisibilityChoice = true, projectOptions, pending, onUpload }: FileUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [chosenProject, setChosenProject] = useState(projectId ?? '');
  const [clientVisible, setClientVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useOnOpen(open, () => {
    setFile(null);
    setError(null);
    setClientVisible(false);
    setChosenProject(projectId ?? (projectOptions?.length === 1 ? projectOptions[0].id : ''));
  });

  const pick = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = precheckFile(candidate);
    setError(problem);
    setFile(problem ? null : candidate);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  };

  const submit = () => {
    if (!file || !chosenProject) return;
    setError(null);
    onUpload(
      { projectId: chosenProject, file, clientVisible: allowVisibilityChoice ? clientVisible : true },
      () => onOpenChange(false),
      (uploadError) => setError(errorMessage(uploadError)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload file</DialogTitle>
          <DialogDescription>Files are stored privately and can only be downloaded by authorized users.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!projectId && (
            <FormField label="Project" htmlFor="upload-project" required>
              {projectOptions ? (
                <select
                  id="upload-project"
                  value={chosenProject}
                  onChange={(event) => setChosenProject(event.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-surface px-3 text-sm"
                >
                  <option value="">Select a project</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              ) : (
                <ProjectSelect id="upload-project" value={chosenProject} onChange={(event) => setChosenProject(event.target.value)} />
              )}
            </FormField>
          )}

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
              dragging ? 'border-primary bg-primary-soft' : 'border-slate-300 bg-muted/30',
            )}
          >
            {file ? (
              <>
                <FileUp className="mb-2 size-7 text-primary" aria-hidden />
                <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                <Button type="button" variant="link" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
                  Choose a different file
                </Button>
              </>
            ) : (
              <>
                <UploadCloud className="mb-2 size-7 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">Drag a file here, or</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
                  Browse files
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">PDF, images, Word, Excel, CSV or TXT · up to 10 MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={(event) => pick(event.target.files?.[0])}
              aria-label="Choose file to upload"
            />
          </div>

          {allowVisibilityChoice ? (
            <Label className="flex items-start gap-2.5 font-normal">
              <Checkbox className="mt-0.5" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} />
              <span>
                <span className="block text-sm font-medium">Share with the client</span>
                <span className="text-xs text-muted-foreground">Internal files are never visible in the client portal.</span>
              </span>
            </Label>
          ) : (
            <p className="text-xs text-muted-foreground">Files you upload are shared with your agency team.</p>
          )}

          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={pending} disabled={!file || !chosenProject}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
