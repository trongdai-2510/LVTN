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
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TAB_CONFIG.length - 1 :
      (currentIndex + direction + TAB_CONFIG.length) % TAB_CONFIG.length;
    const nextTab = TAB_CONFIG[nextIndex];

    setActiveTab(nextTab.key);
    document.getElementById(getTabId(nextTab.key))?.focus();
  };

  return (
    <div className="space-y-7">
      <div className="border-b border-borderSoft">
        <div
          aria-label="Nội dung chi tiết sản phẩm"
          className="grid grid-cols-3 items-center sm:flex sm:gap-8"
          role="tablist"
        >
          {TAB_CONFIG.map((tab, index) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                aria-controls={getPanelId(tab.key)}
                aria-selected={isActive}
                className={[
                  'inline-flex min-h-12 min-w-0 items-center justify-center border-b-2 px-1 py-2 text-center text-[13px] font-medium leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:text-sm',
                  isActive
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent text-body/70 hover:text-primary'
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
            tabIndex={0}
          >
            {tabPanels[tab.key]}
          </div>
        );
      })}
    </div>
  );
}
