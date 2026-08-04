import { Inbox } from '@/components/icons';

import { Card } from './Card';

export function EmptyState({ title = 'Chưa có dữ liệu', description }: { title?: string; description?: string }) {
  return (
    <Card className="flex min-h-48 flex-col items-center justify-center px-5 py-8 text-center">
      <div className="mb-3 rounded-sm bg-muted p-2.5 text-muted-foreground">
        <Inbox size={22} />
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </Card>
  );
}
