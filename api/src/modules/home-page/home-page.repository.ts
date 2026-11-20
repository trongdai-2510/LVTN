import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';
import {
  HOME_SECTION_TABLE,
  type HomeSectionMutationInput,
  type HomeSectionRecord
} from './home-page.types';

@Injectable()
export class HomePageRepository {
  constructor(private readonly knexService: KnexService) {}

  async listAll(): Promise<HomeSectionRecord[]> {
    const rows = await this.knexService.db<HomeSectionRecord>(HOME_SECTION_TABLE)
      .select('*')
      .orderBy('sort_order', 'asc');
    return rows.map((row) => ({
      ...row,
      config: typeof row.config === 'string' ? JSON.parse(row.config as unknown as string) : row.config
    }));
  }

  async replaceAll(sections: HomeSectionMutationInput[]): Promise<HomeSectionRecord[]> {
    return this.knexService.db.transaction(async (trx) => {
      const existingRows = await trx<HomeSectionRecord>(HOME_SECTION_TABLE).select('section_type');
      const existingTypes = new Set(existingRows.map((row) => row.section_type));

      for (const section of sections) {
        const payload = {
          section_type: section.section_type,
          enabled: section.enabled,
          sort_order: section.sort_order,
          title_override: section.title_override,
          subtitle: section.subtitle,
          config: JSON.stringify(section.config)
        };

        if (existingTypes.has(section.section_type)) {
          await trx(HOME_SECTION_TABLE)
            .where({ section_type: section.section_type })
            .update({
              enabled: payload.enabled,
              sort_order: payload.sort_order,
              title_override: payload.title_override,
              subtitle: payload.subtitle,
              config: trx.raw('?::jsonb', [payload.config])
            });
        } else {
          await trx(HOME_SECTION_TABLE).insert({
            section_type: payload.section_type,
            enabled: payload.enabled,
            sort_order: payload.sort_order,
            title_override: payload.title_override,
            subtitle: payload.subtitle,
            config: trx.raw('?::jsonb', [payload.config])
          });
        }
      }

      const finalRows = await trx<HomeSectionRecord>(HOME_SECTION_TABLE)
        .select('*')
        .orderBy('sort_order', 'asc');
      return finalRows.map((row) => ({
        ...row,
        config: typeof row.config === 'string' ? JSON.parse(row.config as unknown as string) : row.config
      }));
    });
  }
}
