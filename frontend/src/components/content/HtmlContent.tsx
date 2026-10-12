type HtmlContentProps = {
  /**
   * HTML must be sanitized before it reaches this presentational component.
   * Keeping the sanitizer outside avoids pulling sanitize-html into client bundles
   * that only need to render already-approved public API content.
   */
  sanitizedHtml: string;
  className?: string;
};

export function HtmlContent({ sanitizedHtml, className }: HtmlContentProps) {
  return (
    <div
      className={[
        'text-body [&_h2]:type-card-title-lg [&_h2]:mt-8 [&_h2]:text-secondary [&_h3]:type-card-title [&_h3]:mt-6 [&_h3]:text-secondary [&_ol]:mt-4 [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:type-body [&_p]:text-body [&_p+*]:mt-4 [&_strong]:font-semibold [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5',
        // Mobile: prevent rich-text images and tables from overflowing horizontally.
        // Tables scroll below lg, then return to the normal table layout on desktop.
        '[&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto lg:[&_table]:table lg:[&_table]:overflow-visible',
        className ?? ''
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
