'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';

type ProductDetailTabKey = 'overview' | 'specs' | 'documents';

type ProductDetailTabsProps = {
  overviewContent: ReactNode;
  specsContent: ReactNode;
  documentsContent: ReactNode;
};

const TAB_CONFIG: Array<{ key: ProductDetailTabKey; label: string; shortLabel: string }> = [
  { key: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan' },
  { key: 'specs', label: 'Thông số kỹ thuật', shortLabel: 'Thông số' },
  { key: 'documents', label: 'Tài liệu kỹ thuật', shortLabel: 'Tài liệu' }
];

function getTabId(key: ProductDetailTabKey) {
  return `product-detail-tab-${key}`;
}

function getPanelId(key: ProductDetailTabKey) {
  return `product-detail-panel-${key}`;
}

export function ProductDetailTabs({
  overviewContent,
  specsContent,
  documentsContent
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<ProductDetailTabKey>('overview');
  const tabPanels: Record<ProductDetailTabKey, ReactNode> = {
    overview: overviewContent,
    specs: specsContent,
    documents: documentsContent
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + TAB_CONFIG.length) % TAB_CONFIG.length;
    const nextTab = TAB_CONFIG[nextIndex];

    setActiveTab(nextTab.key);
    document.getElementById(getTabId(nextTab.key))?.focus();
  };

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto">
        <div
          aria-label="Nội dung chi tiết sản phẩm"
          className="grid w-full grid-cols-3 items-stretch gap-1 border-b border-[#D7E3FA] px-1 sm:flex sm:min-w-max sm:items-center sm:gap-2 sm:whitespace-nowrap"
          role="tablist"
        >
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                aria-controls={getPanelId(tab.key)}
                aria-selected={isActive}
                className={[
                  'inline-flex min-h-12 items-center justify-center rounded-t-md border-b-2 px-2 py-2 text-center text-[12px] font-medium leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 sm:h-11 sm:min-h-0 sm:px-4 sm:text-[13px]',
                  isActive
                    ? 'border-primary bg-[#EFF4FF] font-semibold text-primary'
                    : 'border-transparent text-body hover:bg-[#F1F6FF] hover:text-primary'
                ].join(' ')}
                id={getTabId(tab.key)}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {TAB_CONFIG.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <div
            aria-labelledby={getTabId(tab.key)}
            className={isActive ? 'block' : 'hidden'}
            hidden={!isActive}
            id={getPanelId(tab.key)}
            key={tab.key}
            role="tabpanel"
          >
            {tabPanels[tab.key]}
          </div>
        );
      })}
    </div>
  );
}
