import { buildOverviewParts, partitionOverviewParts, resolveOverviewCopy, type OverviewTextBlock } from './overviewText';

function TextBlock({ block }: { block: OverviewTextBlock }) {
  if (block.kind === 'subheading') {
    return (
      <h4 className="border-t border-borderSoft/70 pt-5 font-display text-[17px] font-bold leading-6 text-secondary first:border-t-0 first:pt-0">
        {displayTitle(block.text)}
      </h4>
    );
  }

  if (block.kind === 'list') {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-base leading-7 text-body marker:text-primary">
        {block.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    );
  }

  return (
    <p className="max-w-[72ch] text-base leading-7 text-body">
      {block.text}
    </p>
  );
}

function displayTitle(title: string): string {
  const lower = title.toLocaleLowerCase('vi-VN');
  return lower.charAt(0).toLocaleUpperCase('vi-VN') + lower.slice(1);
}

function normalizeModelCode(code: string): string {
  return code.trim().toUpperCase().replace(/×/g, 'X').replace(/\s+/g, '');
}

function getTechnicalParts(shortDescription: string, detailedDescription: string) {
  const { detail } = resolveOverviewCopy(shortDescription, detailedDescription);
  const { overviewParts, technicalParts } = partitionOverviewParts(buildOverviewParts(detail));
  if (technicalParts.length === 0) return [];
  const detailedFeatures = overviewParts.filter((part) =>
    part.kind === 'text' && part.blocks.some((block) => block.kind === 'subheading')
  );
  return [...technicalParts, ...detailedFeatures];
}

export function hasLegacySpecs(shortDescription: string, detailedDescription: string): boolean {
  return getTechnicalParts(shortDescription, detailedDescription).length > 0;
}

export function ProductLegacySpecs({
  shortDescription,
  detailedDescription,
  selectedModelCode
}: {
  shortDescription: string;
  detailedDescription: string;
  selectedModelCode: string | null;
}) {
  const parts = getTechnicalParts(shortDescription, detailedDescription);
  if (parts.length === 0) return null;

  return (
    <section className="border-t border-borderSoft pt-7" data-product-legacy-specs="true">
      <div className="mb-7 border-b border-borderSoft pb-5">
        <h2 className="font-display text-[22px] font-bold leading-tight text-secondary sm:text-[26px]">Bảng mã và đặc tính</h2>
      </div>
      <div>
        {parts.map((part, index) => (
          <section className={index > 0 ? 'border-t border-borderSoft py-7' : 'pb-7'} key={`${part.kind}-${index}`}>
            {part.kind === 'catalog' ? (
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 font-display text-[21px] font-bold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                  <span>Bảng mã hàng và thông số ({part.rows.length} mã)</span>
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" fill="none" viewBox="0 0 16 16">
                    <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                  </svg>
                </summary>
                <div className="pt-4"><CatalogContent catalog={part} selectedModelCode={selectedModelCode} /></div>
              </details>
            ) : <TextPartContent part={part} />}
          </section>
        ))}
      </div>
    </section>
  );
}

type TextPart = Extract<ReturnType<typeof buildOverviewParts>[number], { kind: 'text' }>;

function TextPartContent({ part }: { part: TextPart }) {
  return (
    <>
      {part.title ? <h3 className="mb-5 font-display text-[21px] font-bold text-secondary">{displayTitle(part.title)}</h3> : null}
      <TextPartBlocks blocks={part.blocks} />
    </>
  );
}

function TextPartBlocks({ blocks }: { blocks: OverviewTextBlock[] }) {
  const intro: OverviewTextBlock[] = [];
  const groups: Array<{ title: string; blocks: OverviewTextBlock[] }> = [];

  for (const block of blocks) {
    if (block.kind === 'subheading') {
      groups.push({ title: block.text, blocks: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].blocks.push(block);
    } else {
      intro.push(block);
    }
  }

  return (
    <div className="w-full">
      {intro.length > 0 ? (
        <div className="max-w-[72ch] space-y-4">
          {intro.map((block, index) => <TextBlock block={block} key={`${block.kind}-${index}`} />)}
        </div>
      ) : null}
      {groups.length > 0 ? (
        <div className={intro.length > 0 ? 'mt-7 grid gap-x-10 gap-y-6 md:grid-cols-2' : 'grid gap-x-10 gap-y-6 md:grid-cols-2'}>
          {groups.map((group, index) => (
            <div className="border-t border-borderSoft pt-4" key={`${group.title}-${index}`}>
              <h4 className="font-display text-[17px] font-semibold leading-6 text-secondary">{displayTitle(group.title)}</h4>
              <div className="mt-3 space-y-3">
                {group.blocks.map((block, blockIndex) => <TextBlock block={block} key={`${block.kind}-${blockIndex}`} />)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}


type CatalogPart = Extract<ReturnType<typeof buildOverviewParts>[number], { kind: 'catalog' }>;

function CatalogContent({ catalog, selectedModelCode }: { catalog: CatalogPart; selectedModelCode: string | null }) {
  const isSelected = (code: string) =>
    Boolean(selectedModelCode && normalizeModelCode(code) === normalizeModelCode(selectedModelCode));

  return (
    <div className="min-w-0">
      {catalog.context ? <p className="mb-4 text-base leading-7 text-body">{catalog.context}</p> : null}
      <div aria-label="Bảng mã hàng và thông số sản phẩm" className="hidden overflow-x-auto rounded-sm border border-borderSoft sm:block" role="region" tabIndex={0}>
        <table className="w-full min-w-[700px] border-collapse text-left text-[14px] leading-6">
          <caption className="sr-only">Mã hàng và thông số theo mô tả sản phẩm</caption>
          <thead className="bg-panel text-secondary">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-semibold" scope="col">Mã hàng</th>
              {catalog.columns.map((column) => (
                <th className="whitespace-nowrap px-4 py-3 font-semibold" key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.rows.map((row, rowIndex) => (
              <CatalogRow
                columns={catalog.columns.length + 1}
                key={`${row.code}-${rowIndex}`}
                row={row}
                selected={isSelected(row.code)}
                showGroup={Boolean(row.group && row.group !== catalog.rows[rowIndex - 1]?.group)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-borderSoft rounded-sm border border-borderSoft sm:hidden">
        {catalog.rows.map((row, rowIndex) => (
          <div className={isSelected(row.code) ? 'bg-subtle/60 px-4 py-4' : 'px-4 py-4'} key={`${row.code}-${rowIndex}`}>
            {row.group && row.group !== catalog.rows[rowIndex - 1]?.group ? (
              <p className="mb-3 text-[13px] font-semibold text-primary">{row.group}</p>
            ) : null}
            <h4 className="flex flex-wrap items-center gap-2 font-semibold text-secondary">
              {row.code}
              {isSelected(row.code) ? <span className="rounded-xs bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">Đang xem</span> : null}
            </h4>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {catalog.columns.map((column, columnIndex) => (
                <div key={column}>
                  <dt className="text-[12px] leading-4 text-body/70">{column}</dt>
                  <dd className="mt-1 text-[14px] font-semibold tabular-nums text-secondary">{row.values[columnIndex]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogRow({
  columns,
  row,
  selected,
  showGroup
}: {
  columns: number;
  row: { code: string; group: string | null; values: string[] };
  selected: boolean;
  showGroup: boolean;
}) {
  return (
    <>
      {showGroup ? (
        <tr className="border-t border-borderSoft bg-subtle/70">
          <th className="px-4 py-2 text-[13px] font-semibold text-primaryStrong" colSpan={columns}>
            {row.group}
          </th>
        </tr>
      ) : null}
      <tr className={selected ? 'border-t border-borderSoft/70 bg-subtle/60' : 'border-t border-borderSoft/70 bg-white hover:bg-subtle/50'}>
        <th className="whitespace-nowrap px-4 py-2.5 font-semibold text-secondary" scope="row">
          {row.code}
          {selected ? <span className="ml-2 rounded-xs bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">Đang xem</span> : null}
        </th>
        {row.values.map((value, index) => (
          <td className="whitespace-nowrap px-4 py-2.5 text-body" key={`${value}-${index}`}>{value}</td>
        ))}
      </tr>
    </>
  );
}
