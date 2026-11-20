import type { ProductWorkspaceSection } from './businessTypes';
import type { ProductReadiness, ProductReadinessIssue } from './productReadiness';

export function sectionForProductIssue(issue: ProductReadinessIssue): ProductWorkspaceSection {
  if (issue.source === 'variant') return 'variants';
  if (issue.source === 'document') return 'documents';
  if (issue.source === 'workflow') return 'main';
  if (issue.source === 'content' || issue.source === 'seo') return 'content';
  // The primary image and image gallery are edited on the main tab.
  return 'main';
}

export function productIssueAnchor(issue: ProductReadinessIssue): string {
  return issue.source === 'workflow' && issue.code !== 'product_archived'
    ? '#product-group-display'
    : '';
}

export function getProductReadinessNotice(readiness: ProductReadiness) {
  const dataIssue = readiness.dataIssues[0];
  if (dataIssue) {
    const count = readiness.dataIssues.length;
    return {
      kind: 'data',
      issue: dataIssue,
      summary: count === 1 ? '1 dữ liệu bắt buộc cần sửa.' : `${count} dữ liệu bắt buộc cần sửa.`,
      containerClass: 'border-red-200 bg-red-50/70',
      iconClass: 'text-red-700',
      actionClass: 'border-red-300 text-red-800 hover:bg-red-100 focus:ring-red-400'
    };
  }

  const publicationIssue = readiness.publicationIssues[0];
  if (publicationIssue) {
    const count = readiness.publicationIssues.length;
    return {
      kind: 'publication',
      issue: publicationIssue,
      summary: readiness.isPublic
        ? `${count} mục cần bổ sung trước lần cập nhật hiển thị tiếp theo.`
        : `${count} điều kiện còn thiếu để có thể hiển thị trên website.`,
      containerClass: 'border-amber-200 bg-amber-50/70',
      iconClass: 'text-amber-700',
      actionClass: 'border-amber-300 text-amber-900 hover:bg-amber-100 focus:ring-amber-400'
    };
  }

  const workflowIssue = readiness.workflowIssues[0];
  if (workflowIssue) {
    return {
      kind: 'workflow',
      issue: workflowIssue,
      summary: 'Hồ sơ không thiếu dữ liệu bắt buộc; kiểm tra trạng thái sử dụng và duyệt.',
      containerClass: 'border-blue-200 bg-blue-50/70',
      iconClass: 'text-blue-700',
      actionClass: 'border-blue-300 text-blue-800 hover:bg-blue-100 focus:ring-blue-400'
    };
  }

  const qualityIssue = readiness.qualityIssues[0];
  if (qualityIssue) {
    const count = readiness.qualityIssues.length;
    return {
      kind: 'quality',
      issue: qualityIssue,
      summary: `${count} gợi ý không bắt buộc để hồ sơ đầy đủ hơn.`,
      containerClass: 'border-slate-200 bg-slate-50',
      iconClass: 'text-slate-500',
      actionClass: 'border-slate-300 text-slate-700 hover:bg-slate-100 focus:ring-slate-400'
    };
  }

  return {
    kind: 'complete',
    issue: null,
    summary: 'Không còn dữ liệu hoặc điều kiện hiển thị cần bổ sung.',
    containerClass: 'border-emerald-200 bg-emerald-50/70',
    iconClass: 'text-emerald-700',
    actionClass: 'border-emerald-300 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-400'
  };
}
