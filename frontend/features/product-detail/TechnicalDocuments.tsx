import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicTechnicalDocument } from '@/types/contracts/public-product-groups';

type TechnicalDocumentsProps = {
  documents: PublicTechnicalDocument[];
};

function getDocumentLabel(documentType: PublicTechnicalDocument['document_type']) {
  switch (documentType) {
    case 'catalogue':
      return 'Catalogue';
    case 'certificate':
      return 'Chứng nhận';
    case 'datasheet':
      return 'Datasheet';
    case 'manual':
      return 'Hướng dẫn';
    default:
      return 'Tài liệu';
  }
}

export function TechnicalDocuments({ documents }: TechnicalDocumentsProps) {
  return (
    <section className="space-y-6">
      {documents.length === 0 ? (
        <div className="rounded-sm border border-borderSoft bg-white px-6 py-8 shadow-soft">
          <p className="type-body-sm text-body">Tài liệu kỹ thuật đang cập nhật.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((document) => {
            const documentSource = resolvePublicFileSource(document.file);

            return (
              <div
                className="flex flex-col gap-4 rounded-sm border border-borderSoft bg-white px-5 py-4 shadow-soft md:flex-row md:items-center md:justify-between"
                key={document.id}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="type-caption inline-flex h-7 items-center rounded-xs bg-subtle px-3 font-bold uppercase text-primary">
                      {getDocumentLabel(document.document_type)}
                    </span>
                    {document.version ? (
                      <span className="type-caption text-body">Version {document.version}</span>
                    ) : null}
                  </div>
                  <p className="text-[18px] font-bold leading-6 text-secondary">
                    {document.document_name}
                  </p>
                  <p className="type-caption text-body">{document.file.original_filename}</p>
                </div>

                {documentSource ? (
                  <a
                    className="type-button inline-flex h-11 w-full items-center justify-center rounded-xs border border-primary/20 bg-white px-5 font-bold text-primaryStrong transition hover:border-primary hover:text-primary sm:w-auto"
                    href={documentSource}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Xem tài liệu
                  </a>
                ) : (
                  <span className="type-button inline-flex h-11 w-full items-center justify-center rounded-xs border border-borderSoft bg-white px-5 font-bold text-body/55 sm:w-auto">
                    Tài liệu đang cập nhật
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
