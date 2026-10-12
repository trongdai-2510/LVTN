type WorkflowState = {
  review_status?: string;
  publish_status?: string;
};

export function isVisibilityOnlyUnpublish<T extends { publish_status?: string }>(
  input: T,
  allowedMetadataKeys: readonly string[] = []
): boolean {
  return input.publish_status === 'unpublished' &&
    Object.entries(input).every(([key, value]) =>
      key === 'publish_status' || allowedMetadataKeys.includes(key) || value === undefined
    );
}

function comparable(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

/**
 * The current schema stores only one mutable public row, not a separately
 * published revision. A material edit by a non-Super Admin reopens review and
 * hides that row until it is approved and explicitly published again. A Super
 * Admin may update the public row in place.
 */
export function reopenPublishedContentAfterMajorEdit<
  TCurrent extends WorkflowState,
  TMutation extends WorkflowState
>(
  current: TCurrent,
  mutation: TMutation,
  majorFields: readonly string[],
  actorIsSuperAdmin = false
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
  if (!hasMajorChange || actorIsSuperAdmin) return mutation;

  // The workflow guard authorizes an explicit approve-and-publish request.
  // Keep that atomic action public instead of reopening it after validation.
  if (
    mutation.review_status === 'approved' &&
    mutation.publish_status === 'published'
  ) {
    return mutation;
  }

  mutation.review_status = 'pending_review';
  mutation.publish_status = 'unpublished';
  return mutation;
}
