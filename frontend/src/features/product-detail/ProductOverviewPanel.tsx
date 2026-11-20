import {
  buildOverviewHighlights,
  buildOverviewParts,
  partitionOverviewParts,
  resolveOverviewCopy,
  type OverviewTextBlock
} from './overviewText';

type TextPart = {
  title: string | null;
  blocks: OverviewTextBlock[];
};

function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase('vi-VN');
  return lower.charAt(0).toLocaleUpperCase('vi-VN') + lower.slice(1);
}

function firstSentence(value: string): string {
  return value.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? value;
}

function ContentBlock({ block }: { block: OverviewTextBlock }) {
  if (block.kind === 'list') {
    return (
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-body marker:text-primary">
        {block.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    );
  }
  if (block.kind === 'subheading') {
    return <h4 className="font-display text-[17px] font-semibold text-secondary">{sentenceCase(block.text)}</h4>;
  }
  return <p className="text-[15px] leading-7 text-body">{block.text}</p>;
}

export function ProductOverviewPanel({
  shortDescription,
  detailedDescription
}: {
  shortDescription: string;
  detailedDescription: string;
}) {
  const { summary, detail } = resolveOverviewCopy(shortDescription, detailedDescription);
  const { overviewParts, technicalParts } = partitionOverviewParts(buildOverviewParts(detail));
  const highlights = buildOverviewHighlights(overviewParts);
  const additionalParts: TextPart[] = overviewParts.flatMap((part) => {
    if (part.kind !== 'text') return [];
    const firstHeading = part.blocks.findIndex((block) => block.kind === 'subheading');
    if (firstHeading === 0) return [];
    return [{
      title: firstHeading < 0 ? part.title : null,
      blocks: firstHeading < 0 ? part.blocks : part.blocks.slice(0, firstHeading)
    }];
  });
  const hasContent = Boolean(summary || highlights.length || additionalParts.length);

  return (
    <section className="pb-2" data-product-overview-panel="true">
      <div className="max-w-[850px]">
        <h2 className="font-display text-[29px] font-bold leading-tight tracking-[-0.02em] text-secondary sm:text-[34px]">
          Về sản phẩm
        </h2>
        {summary ? (
          <p className="mt-5 whitespace-pre-line text-[16px] leading-[1.7] text-secondary sm:text-[17px] sm:leading-[1.75]">
            {summary}
          </p>
        ) : null}
        {!hasContent ? (
          <p className="mt-5 text-base leading-7 text-body">Giới thiệu sản phẩm đang được cập nhật.</p>
        ) : null}
      </div>

      {highlights.length > 0 ? (
        <div className="mt-9 border-t border-borderSoft pt-7 sm:mt-10">
          <h3 className="font-display text-[22px] font-bold leading-7 text-secondary sm:text-[25px]">
            Đặc điểm nổi bật
          </h3>
          <div className="mt-4 grid gap-x-12 md:grid-cols-2">
            {highlights.map((highlight, index) => (
              <article className="border-t border-borderSoft py-5" key={`${highlight.title}-${index}`}>
                <div className="flex gap-4 sm:gap-5">
                  <span aria-hidden="true" className="shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-display text-[16px] font-semibold leading-6 text-secondary">
                      {sentenceCase(highlight.title)}
                    </h4>
                    <p className="mt-2 text-[15px] leading-7 text-body">
                      {technicalParts.length > 0 ? firstSentence(highlight.description) : highlight.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {additionalParts.map((part, index) => (
        <div className="max-w-[850px] border-t border-borderSoft py-7" key={`${part.title ?? 'text'}-${index}`}>
          {part.title ? (
            <h3 className="mb-4 font-display text-[21px] font-bold text-secondary">{sentenceCase(part.title)}</h3>
          ) : null}
          <div className="space-y-4">
            {part.blocks.map((block, blockIndex) => <ContentBlock block={block} key={`${block.kind}-${blockIndex}`} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
