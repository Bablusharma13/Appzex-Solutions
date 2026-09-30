'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Select } from '@/components/ui/input';
import { useTeam } from '@/hooks/use-agency';
import { useClientOptions } from '@/hooks/use-clients';
import { useProjectOptions } from '@/hooks/use-projects';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string };

/** Team member dropdown, populated from the caller's own agency. */
export const TeamSelect = forwardRef<HTMLSelectElement, SelectProps>(({ placeholder = 'Unassigned', ...props }, ref) => {
  const { data: team = [], isLoading } = useTeam();
  return (
    <Select ref={ref} disabled={isLoading || props.disabled} {...props}>
      <option value="">{isLoading ? 'Loading…' : placeholder}</option>
      {team
        .filter((member) => member.isActive)
        .map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
            {member.jobTitle ? ` — ${member.jobTitle}` : ''}
          </option>
        ))}
    </Select>
  );
});
TeamSelect.displayName = 'TeamSelect';

export const ClientSelect = forwardRef<HTMLSelectElement, SelectProps>(({ placeholder = 'Select a client', ...props }, ref) => {
  const { data, isLoading } = useClientOptions();
  return (
    <Select ref={ref} disabled={isLoading || props.disabled} {...props}>
      <option value="">{isLoading ? 'Loading…' : placeholder}</option>
      {data?.items.map((client) => (
        <option key={client.id} value={client.id}>
          {client.companyName}
        </option>
      ))}
    </Select>
  );
});
ClientSelect.displayName = 'ClientSelect';

export const ProjectSelect = forwardRef<HTMLSelectElement, SelectProps & { activeOnly?: boolean }>(
  ({ placeholder = 'Select a project', activeOnly = false, ...props }, ref) => {
    const { data, isLoading } = useProjectOptions();
    const projects = data?.items.filter((project) => !activeOnly || project.status !== 'COMPLETED') ?? [];
    return (
      <Select ref={ref} disabled={isLoading || props.disabled} {...props}>
        <option value="">{isLoading ? 'Loading…' : placeholder}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} · {project.client.companyName}
          </option>
        ))}
      </Select>
    );
  },
);
ProjectSelect.displayName = 'ProjectSelect';
