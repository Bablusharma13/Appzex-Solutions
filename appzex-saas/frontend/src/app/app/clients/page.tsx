'use client';

import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { SortHeader, type SortState } from '@/components/shared/sort-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { ClientFormDialog } from '@/features/clients/client-form-dialog';
import { usePermissions } from '@/hooks/use-auth';
import { useClients } from '@/hooks/use-clients';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn, formatDate } from '@/lib/utils';

export default function ClientsPage() {
  const router = useRouter();
  const { isAgencyAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [sort, setSort] = useState<SortState<'companyName' | 'createdAt'>>({ field: 'createdAt', order: 'desc' });
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, sort]);

  const { data, isLoading, isError, error, refetch, isFetching } = useClients({
    page,
    pageSize: 15,
    search: debouncedSearch,
    sort: sort.field,
    order: sort.order,
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Companies your agency works with. Each client only ever sees its own projects."
        actions={
          isAgencyAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New client
            </Button>
          )
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search company, contact or email" className="sm:w-80" label="Search clients" />
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton columns={5} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={debouncedSearch ? 'No clients match your search' : 'No clients yet'}
          description={debouncedSearch ? 'Try a different name or email.' : 'Add your first client to start creating projects for them.'}
          action={
            !debouncedSearch &&
            isAgencyAdmin && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New client
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
                  <SortHeader field="companyName" label="Company" sort={sort} onSort={setSort} />
                  <TH>Contact</TH>
                  <TH>Phone</TH>
                  <TH className="text-right">Projects</TH>
                  <TH>Portal</TH>
                  <SortHeader field="createdAt" label="Added" sort={sort} onSort={setSort} />
                </tr>
              </THead>
              <tbody>
                {data.items.map((client) => (
                  <TR key={client.id} className="cursor-pointer" onClick={() => router.push(`/app/clients/${client.id}`)}>
                    <TD>
                      <Link href={`/app/clients/${client.id}`} className="font-medium hover:underline" onClick={(event) => event.stopPropagation()}>
                        {client.companyName}
                      </Link>
                    </TD>
                    <TD>
                      <p>{client.contactName ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{client.phone ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{client.projectCount}</TD>
                    <TD>
                      {client.portalEnabled ? (
                        <Badge tone="teal">
                          {client.portalUserCount} user{client.portalUserCount === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <Badge>Disabled</Badge>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(client.createdAt)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(client) => router.push(`/app/clients/${client.id}`)} />
    </>
  );
}
