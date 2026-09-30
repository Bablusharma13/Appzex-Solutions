'use client';

import { Building2, Eye, LifeBuoy, MoreHorizontal, Plus, Power, PowerOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AgencyStatusBadge, PlanBadge } from '@/components/shared/badges';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { SortHeader, type SortState } from '@/components/shared/sort-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select } from '@/components/ui/input';
import { TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { AgencyActionDialog, type AgencyAction } from '@/features/super-admin/agency-action-dialog';
import { CreateAgencyDialog } from '@/features/super-admin/create-agency-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSuperAdminAgencies } from '@/hooks/use-super-admin';
import { AGENCY_STATUS, PLAN, options } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';

type SortField = 'name' | 'createdAt' | 'status' | 'plan';

export default function AgenciesPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState<SortState<SortField>>({ field: 'createdAt', order: 'desc' });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AgencyAction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, status, plan, sort]);

  const { data, isLoading, isError, error, refetch, isFetching } = useSuperAdminAgencies({
    page,
    pageSize: 10,
    search: debouncedSearch,
    status,
    plan,
    sort: sort.field,
    order: sort.order,
  });

  const filtered = Boolean(debouncedSearch || status || plan);

  return (
    <>
      <PageHeader
        title="Agencies"
        description="Search, inspect and manage every tenant. Suspending an agency immediately blocks its team and clients."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New agency
          </Button>
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, slug, email or owner" className="sm:w-80" label="Search agencies" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {options(AGENCY_STATUS).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={plan} onChange={(event) => setPlan(event.target.value)} className="sm:w-40" aria-label="Filter by plan">
          <option value="">All plans</option>
          {options(PLAN).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton columns={7} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? 'No agencies match your filters' : 'No agencies yet'}
          description={filtered ? 'Try a different search term or clear the filters.' : 'Create the first agency to get started.'}
          action={
            filtered ? (
              <Button variant="outline" onClick={() => { setSearch(''); setStatus(''); setPlan(''); }}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New agency
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className={cn('overflow-hidden transition-opacity', isFetching && 'opacity-70')}>
            <Table>
              <THead>
                <tr>
                  <SortHeader field="name" label="Agency" sort={sort} onSort={setSort} />
                  <TH>Owner</TH>
                  <SortHeader field="status" label="Status" sort={sort} onSort={setSort} />
                  <SortHeader field="plan" label="Plan" sort={sort} onSort={setSort} />
                  <TH className="text-right">Users</TH>
                  <TH className="text-right">Clients</TH>
                  <TH className="text-right">Projects</TH>
                  <SortHeader field="createdAt" label="Created" sort={sort} onSort={setSort} />
                  <TH className="w-12">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <tbody>
                {data.items.map((agency) => (
                  <TR key={agency.id}>
                    <TD>
                      <Link href={`/super-admin/agencies/${agency.id}`} className="font-medium text-foreground hover:underline">
                        {agency.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{agency.contactEmail}</p>
                    </TD>
                    <TD>
                      {agency.owner ? (
                        <>
                          <p className="text-sm">{agency.owner.name}</p>
                          <p className="text-xs text-muted-foreground">{agency.owner.email}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD>
                      <AgencyStatusBadge status={agency.status} />
                    </TD>
                    <TD>
                      <PlanBadge plan={agency.plan} />
                    </TD>
                    <TD className="text-right tabular-nums">{agency.counts.users}</TD>
                    <TD className="text-right tabular-nums">{agency.counts.clients}</TD>
                    <TD className="text-right tabular-nums">{agency.counts.projects}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(agency.createdAt)}</TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${agency.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem asChild>
                            <Link href={`/super-admin/agencies/${agency.id}`}>
                              <Eye /> View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setAction({ type: 'support', agency })}>
                            <LifeBuoy /> Enter workspace
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {agency.status === 'ACTIVE' ? (
                            <DropdownMenuItem destructive onSelect={() => setAction({ type: 'suspend', agency })}>
                              <PowerOff /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setAction({ type: 'activate', agency })}>
                              <Power /> Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <AgencyActionDialog action={action} onClose={() => setAction(null)} />
      <CreateAgencyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
