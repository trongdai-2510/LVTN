type WorkflowState = {
  review_status?: string;
  publish_status?: string;
};

function comparable(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

/**
 * The current schema stores only one mutable public row, not a separately
 * published revision. A material edit therefore must stop exposing that row
 * until it has been reviewed and explicitly published again.
 */
export function reopenPublishedContentAfterMajorEdit<
  TCurrent extends WorkflowState,
  TMutation extends WorkflowState
>(
  current: TCurrent,
  mutation: TMutation,
  majorFields: readonly string[]
): TMutation {
  if (
    current.review_status !== 'approved' ||
    current.publish_status !== 'published'
  ) {
    return mutation;
  }

  const currentFields = current as Record<string, unknown>;
  const mutationFields = mutation as Record<string, unknown>;
  const hasMajorChange = majorFields.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(mutationFields, field) &&
      comparable(mutationFields[field]) !== comparable(currentFields[field])
  );
  if (!hasMajorChange) return mutation;

  mutation.review_status = 'pending_review';
  mutation.publish_status = 'unpublished';
  return mutation;
}
