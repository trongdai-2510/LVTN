import { normalizeSafeNavigationTarget } from "../../common/navigation/safeNavigationTarget";
import type { PublicFileSummary, PublicExtraBlocksPayload, PublicExtraBlockItem, PublicPageContentLayout } from "./public.types";

export function normalizePublicExtraBlocks(
  raw: unknown,
  fileMap: Map<string, PublicFileSummary>,
): PublicExtraBlocksPayload {
  if (!raw || typeof raw !== "object") return { blocks: [], layout: null };
  const payload = raw as { blocks?: unknown; layout?: unknown };
  if (!Array.isArray(payload.blocks)) return { blocks: [], layout: null };
  const blocks: PublicExtraBlockItem[] = [];
  for (const entry of payload.blocks) {
    if (!entry || typeof entry !== "object") continue;
    const block = entry as Record<string, unknown>;
    const id = typeof block.id === "string" ? block.id : "";
    const title =
      typeof block.title === "string" && block.title ? block.title : null;
    if (block.type === "bullet_list" && Array.isArray(block.items)) {
      blocks.push({
        id,
        type: "bullet_list",
        title,
        items: block.items
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            text: typeof item.text === "string" ? item.text : "",
            link: normalizeLink(item.link),
          }))
          .filter((item) => item.text),
      });
    } else if (block.type === "card_grid" && Array.isArray(block.items)) {
      const columnsRaw = block.columns;
      const columns: 2 | 3 | 4 =
        columnsRaw === 2 || columnsRaw === 3 || columnsRaw === 4
          ? columnsRaw
          : 2;
      blocks.push({
        id,
        type: "card_grid",
        title,
        columns,
        items: block.items
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            title: typeof item.title === "string" ? item.title : "",
            description:
              typeof item.description === "string" && item.description.trim()
                ? item.description
                : null,
            link: normalizeLink(item.link),
          }))
          .filter((item) => item.title),
      });
    } else if (block.type === "image_card") {
      const imageFileId =
        typeof block.image_file_id === "string" ? block.image_file_id : "";
      const imageFile = imageFileId ? (fileMap.get(imageFileId) ?? null) : null;
      // Bỏ qua nếu file bị xoá / không tồn tại → tránh hiển thị card vỡ ảnh
      if (!imageFile) continue;
      const toneRaw = block.tone;
      const tone: "positive" | "negative" | "neutral" =
        toneRaw === "positive" || toneRaw === "negative" ? toneRaw : "neutral";
      const description =
        typeof block.description === "string" && block.description.trim()
          ? block.description
          : null;
      const slotKey =
        typeof block.slot_key === "string" && block.slot_key.trim()
          ? block.slot_key.trim()
          : null;
      blocks.push({
        id,
        type: "image_card",
        title,
        description,
        tone,
        slot_key: slotKey,
        image_file_id: imageFileId,
        image_file: imageFile,
        link: normalizeLink(block.link),
      });
    }
  }
  return { blocks, layout: normalizePublicPageLayout(payload.layout) };
}

function normalizePublicPageLayout(
  raw: unknown,
): PublicPageContentLayout | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  const normalized = sections
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      visible: entry.visible === true,
    }))
    .filter((entry) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id));
  if (normalized.length === 0 || !normalized.some((entry) => entry.visible)) {
    return null;
  }
  return { sections: normalized };
}

export function collectExtraBlockImageIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as { blocks?: unknown };
  if (!Array.isArray(payload.blocks)) return [];
  const ids: string[] = [];
  for (const entry of payload.blocks) {
    if (!entry || typeof entry !== "object") continue;
    const block = entry as Record<string, unknown>;
    if (
      block.type === "image_card" &&
      typeof block.image_file_id === "string" &&
      block.image_file_id
    ) {
      ids.push(block.image_file_id);
    }
  }
  return ids;
}

function normalizeLink(
  raw: unknown,
): { label: string | null; target: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const link = raw as Record<string, unknown>;
  const target = normalizeSafeNavigationTarget(link.target);
  if (!target) return null;
  const label =
    typeof link.label === "string" && link.label.trim()
      ? link.label.trim()
      : null;
  return { target, label };
}

export function buildWatermarkedImageFilename(filename: string): string {
  const baseName =
    filename.trim().replace(/\.[^.]+$/, "") || "song-thanh-product-image";
  return `${baseName}-song-thanh.png`;
}
