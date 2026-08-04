import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';

const VARIANT_ATTRIBUTE_TABLE = 'variant_attribute';
const SUGGESTION_LIMIT = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type VariantAttributeNameSuggestion = {
  name: string;
  usage_count: number;
};

@Injectable()
export class VariantAttributeSuggestionsService {
  private cache: {
    expiresAt: number;
    items: VariantAttributeNameSuggestion[];
  } | null = null;

  constructor(private readonly knexService: KnexService) {}

  async listNameSuggestions(): Promise<{ items: VariantAttributeNameSuggestion[] }> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return { items: this.cache.items };
    }

    const rows = await this.knexService.db(VARIANT_ATTRIBUTE_TABLE)
      .select<{ name: string; usage_count: string | number }[]>({
        name: 'attribute_name'
      })
      .count<{ name: string; usage_count: string | number }[]>({ usage_count: 'id' })
      .whereNull('deleted_at')
      .groupBy('attribute_name')
      .orderBy('usage_count', 'desc')
      .orderBy('attribute_name', 'asc')
      .limit(SUGGESTION_LIMIT);

    const items = rows.map((row) => ({
      name: row.name,
      usage_count: Number(row.usage_count ?? 0)
    }));

    this.cache = {
      expiresAt: now + CACHE_TTL_MS,
      items
    };

    return { items };
  }
}
