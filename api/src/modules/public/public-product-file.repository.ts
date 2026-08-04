import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';
import { BRAND_TABLE } from '../brand/brand.types';
import { FILE_METADATA_TABLE } from '../website-settings/website-settings.types';
import { PRODUCT_CATEGORY_TABLE } from '../product-category/product-category.types';
import { PRODUCT_GROUP_TABLE, PRODUCT_IMAGE_TABLE } from '../product-group/product-group.types';
import { PRODUCT_VARIANT_TABLE } from '../product-variant/product-variant.types';
import type { PublicFileRecord } from './public-file';

@Injectable()
export class PublicProductFileRepository {
  constructor(private readonly knexService: KnexService) {}

  async findPublicProductImageFileById(
    fileId: string
  ): Promise<PublicFileRecord | null> {
    const file = await this.knexService
      .db<PublicFileRecord>(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereIn('storage_location', ['local', 'r2'])
      .whereNull('deleted_at')
      .first('id', 'original_filename', 'mime_type', 'storage_location', 'stored_path');

    if (!file) {
      return null;
    }

    const [isThumbnailFile, isGalleryFile] = await Promise.all([
      this.isPublicProductGroupThumbnailFile(fileId),
      this.isPublicProductGalleryFile(fileId)
    ]);

    return isThumbnailFile || isGalleryFile ? file : null;
  }

  private async isPublicProductGroupThumbnailFile(fileId: string): Promise<boolean> {
    const groupAlias = 'group_record';
    const categoryAlias = 'category_record';
    const parentAlias = 'parent_record';
    const brandAlias = 'brand_record';

    const row = await this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .innerJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`
      )
      .leftJoin({ [brandAlias]: BRAND_TABLE }, `${brandAlias}.id`, `${groupAlias}.brand_id`)
      .where(`${groupAlias}.thumbnail_file_id`, fileId)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, 'active')
      .where(`${groupAlias}.review_status`, 'approved')
      .where(`${groupAlias}.publish_status`, 'published')
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, 'active')
      .andWhere((builder) => {
        builder.whereNull(`${categoryAlias}.parent_id`).orWhere((parentBuilder) => {
          parentBuilder
            .whereNotNull(`${categoryAlias}.parent_id`)
            .whereNotNull(`${parentAlias}.id`)
            .whereNull(`${parentAlias}.deleted_at`)
            .where(`${parentAlias}.status`, 'active');
        });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, 'active');
        });
      })
      .first(`${groupAlias}.id`);

    return Boolean(row);
  }

  private async isPublicProductGalleryFile(fileId: string): Promise<boolean> {
    const imageAlias = 'image_record';
    const groupAlias = 'group_record';
    const variantAlias = 'variant_record';
    const categoryAlias = 'category_record';
    const parentAlias = 'parent_record';
    const brandAlias = 'brand_record';

    const row = await this.knexService
      .db({ [imageAlias]: PRODUCT_IMAGE_TABLE })
      .innerJoin(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${imageAlias}.product_group_id`
      )
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${imageAlias}.product_variant_id`
      )
      .innerJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`
      )
      .leftJoin({ [brandAlias]: BRAND_TABLE }, `${brandAlias}.id`, `${groupAlias}.brand_id`)
      .where(`${imageAlias}.file_id`, fileId)
      .whereNull(`${imageAlias}.deleted_at`)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, 'active')
      .where(`${groupAlias}.review_status`, 'approved')
      .where(`${groupAlias}.publish_status`, 'published')
      .andWhere((builder) => {
        builder.whereNull(`${imageAlias}.product_variant_id`).orWhere((variantBuilder) => {
          variantBuilder
            .whereNotNull(`${variantAlias}.id`)
            .whereRaw('?? = ??', [
              `${variantAlias}.product_group_id`,
              `${imageAlias}.product_group_id`
            ])
            .whereNull(`${variantAlias}.deleted_at`)
            .where(`${variantAlias}.status`, 'active')
            .where(`${variantAlias}.review_status`, 'approved')
            .where(`${variantAlias}.publish_status`, 'published');
        });
      })
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, 'active')
      .andWhere((builder) => {
        builder.whereNull(`${categoryAlias}.parent_id`).orWhere((parentBuilder) => {
          parentBuilder
            .whereNotNull(`${categoryAlias}.parent_id`)
            .whereNotNull(`${parentAlias}.id`)
            .whereNull(`${parentAlias}.deleted_at`)
            .where(`${parentAlias}.status`, 'active');
        });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, 'active');
        });
      })
      .first(`${imageAlias}.id`);

    return Boolean(row);
  }
}
