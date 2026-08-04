import { HtmlContent } from '@/components/content/HtmlContent';
import { sanitizeRichTextHtml } from '@/lib/security/sanitize-rich-text';

type SanitizedHtmlContentProps = {
  html: string | null | undefined;
  className?: string;
};

export function SanitizedHtmlContent({ html, className }: SanitizedHtmlContentProps) {
  return (
    <HtmlContent
      className={className}
      sanitizedHtml={sanitizeRichTextHtml(html) ?? ''}
    />
  );
}
