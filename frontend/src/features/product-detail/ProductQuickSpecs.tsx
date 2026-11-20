import type {
  PublicHighlightSpec,
  PublicSpecGroup,
  PublicSpecItem
} from '@/types/contracts/public-product-groups';

type ProductQuickSpecsProps = {
  highlightSpecs?: PublicHighlightSpec[];
  maxItems?: number;
  sharedSpecGroups: PublicSpecGroup[];
  tone?: 'hero' | 'section';
  variantHighlightSpecs?: PublicHighlightSpec[];
  variantSpecGroups: PublicSpecGroup[];
};

type QuickSpecDefinition = {
  key: string;
  label: string;
  patterns: string[];
};

export type QuickSpecItem = {
  key: string;
  label: string;
  value: string;
};

const QUICK_SPEC_DEFINITIONS: QuickSpecDefinition[] = [
  { key: 'cong-suat', label: 'Công suất', patterns: ['cong suat', 'power'] },
  { key: 'dien-ap', label: 'Điện áp', patterns: ['dien ap', 'voltage'] },
  {
    key: 'quang-thong',
    label: 'Quang thông',
    patterns: ['quang thong', 'lumen']
  },
  {
    key: 'kich-thuoc',
    label: 'Kích thước',
    patterns: ['kich thuoc', 'size', 'dimensions']
  },
  { key: 'bao-hanh', label: 'Bảo hành', patterns: ['bao hanh', 'warranty'] },
  {
    key: 'nhiet-do-mau',
    label: 'Nhiệt độ màu',
    patterns: ['cct', 'mau anh sang', 'nhiet do mau']
  }
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function flattenSpecItems(
  groups: PublicSpecGroup[]
): Array<PublicSpecItem & { normalized_name: string }> {
  return groups.flatMap((group) =>
    group.items
      .filter((item) => hasValue(item.spec_name) && hasValue(item.spec_value))
      .map((item) => ({
        ...item,
        normalized_name: normalizeText(item.spec_name)
      }))
  );
}

export function buildQuickSpecs(
  highlightSpecs: PublicHighlightSpec[],
  variantHighlightSpecs: PublicHighlightSpec[],
  sharedSpecGroups: PublicSpecGroup[],
  variantSpecGroups: PublicSpecGroup[],
  maxItems: number
): QuickSpecItem[] {
  const curatedItems = [
    ...variantHighlightSpecs,
    ...highlightSpecs
  ]
    .filter((item) => hasValue(item.display_label) && hasValue(item.display_value))
    .map((item) => ({
      key: item.id,
      label: item.display_label.trim(),
      value: item.display_value.trim()
    }));

  if (curatedItems.length > 0) {
    return curatedItems;
  }

  const orderedItems = [
    ...flattenSpecItems(variantSpecGroups),
    ...flattenSpecItems(sharedSpecGroups)
  ];
  const takenIds = new Set<string>();
  const quickSpecs: QuickSpecItem[] = [];

  for (const definition of QUICK_SPEC_DEFINITIONS) {
    const matchedItem = orderedItems.find(
      (item) =>
        !takenIds.has(item.id) &&
        definition.patterns.some((pattern) => item.normalized_name.includes(pattern))
    );

    if (!matchedItem) {
      continue;
    }

    takenIds.add(matchedItem.id);
    quickSpecs.push({
      key: definition.key,
      label: definition.label,
      value: matchedItem.spec_value.trim()
    });
  }

  for (const item of orderedItems) {
    if (quickSpecs.length >= maxItems) {
      break;
    }

    if (takenIds.has(item.id)) {
      continue;
    }

    takenIds.add(item.id);
    quickSpecs.push({
      key: item.id,
      label: item.spec_name.trim(),
      value: item.spec_value.trim()
    });
  }

  return quickSpecs;
}

function getQuickSpecGridClassName(totalItems: number): string {
  if (totalItems <= 1) {
    return 'grid-cols-1';
  }

  if (totalItems === 2) {
    return 'grid-cols-2';
  }

  return 'grid-cols-3';
}

function renderTiles(quickSpecs: QuickSpecItem[]) {
  return (
    <dl
      className={`grid overflow-hidden border-l border-t border-borderSoft/75 ${getQuickSpecGridClassName(quickSpecs.length)}`}
    >
      {quickSpecs.map((item) => (
        <div
          className="min-w-0 border-b border-r border-borderSoft/75 bg-white px-3 py-2.5 sm:px-4 sm:py-3"
          key={item.key}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-body/65 sm:text-[11px]">
            {item.label}
          </dt>
          <dd className="mt-1 break-words text-[14px] font-bold leading-5 text-secondary sm:text-[15px] sm:leading-6">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductQuickSpecs({
  highlightSpecs = [],
  sharedSpecGroups,
  variantHighlightSpecs = [],
  variantSpecGroups,
  maxItems = 6,
  tone = 'section'
}: ProductQuickSpecsProps) {
  const quickSpecs = buildQuickSpecs(
    highlightSpecs,
    variantHighlightSpecs,
    sharedSpecGroups,
    variantSpecGroups,
    maxItems
  );

  if (quickSpecs.length === 0) {
    return null;
  }

  if (tone === 'hero') {
    return (
      <section className="space-y-2.5" data-product-quick-specs="true">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-primary">
          Thông số nổi bật
        </h2>
        {renderTiles(quickSpecs)}
      </section>
    );
  }

  return (
    <section className="space-y-4" data-product-quick-specs="true">
      <div className="space-y-1">
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-primary">
          Thông số nổi bật
        </p>
        <h2 className="type-section-title text-secondary">Điểm kỹ thuật chính</h2>
      </div>

      {renderTiles(quickSpecs)}
    </section>
  );
}
