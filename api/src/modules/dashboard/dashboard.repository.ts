import { Injectable } from "@nestjs/common";
import type { Knex } from "knex";

import { KnexService } from "../../db/knex.service";
import { PRODUCT_GROUP_TABLE } from "../product-group/product-group.types";

export const PRODUCT_GROUP_DAILY_VIEW_TABLE = "product_group_daily_view";
export const SITE_DAILY_VIEW_TABLE = "site_daily_view";

export interface DashboardTrafficRow {
  bucket: string;
  view_count: string | number;
}

export interface DashboardTopProductRow {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  view_count: string | number;
  period_view_count: string | number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly knexService: KnexService) {}

  async recordSiteView(): Promise<number> {
    const db = this.knexService.db;
    const viewDate = db.raw("timezone('Asia/Ho_Chi_Minh', now())::date");
    const rows = (await db(SITE_DAILY_VIEW_TABLE)
      .insert({
        view_date: viewDate,
        view_count: 1,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict("view_date")
      .merge({
        view_count: db.raw(`${SITE_DAILY_VIEW_TABLE}.view_count + 1`),
        updated_at: db.fn.now(),
      })
      .returning("view_count")) as Array<{ view_count: number | string }>;

    return Number(rows[0]?.view_count ?? 0);
  }

  async recordProductView(productGroupId: string): Promise<number> {
    return this.knexService.db.transaction(async (trx) => {
      const rows = (await trx(PRODUCT_GROUP_TABLE)
        .where({ id: productGroupId })
        .whereNull("deleted_at")
        .where({
          status: "active",
          review_status: "approved",
          publish_status: "published",
        })
        .update({ view_count: trx.raw("coalesce(view_count, 0) + 1") })
        .returning("view_count")) as Array<{ view_count: number | string }>;

      if (rows.length === 0) return 0;

      const viewDate = trx.raw("timezone('Asia/Ho_Chi_Minh', now())::date");
      await trx(PRODUCT_GROUP_DAILY_VIEW_TABLE)
        .insert({
          product_group_id: productGroupId,
          view_date: viewDate,
          view_count: 1,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .onConflict(["product_group_id", "view_date"])
        .merge({
          view_count: trx.raw(
            `${PRODUCT_GROUP_DAILY_VIEW_TABLE}.view_count + 1`,
          ),
          updated_at: trx.fn.now(),
        });

      return Number(rows[0].view_count);
    });
  }

  async listTraffic(params: {
    startDate: string;
    endDate: string;
    grain: "day" | "month";
  }): Promise<DashboardTrafficRow[]> {
    const bucketExpression =
      params.grain === "month"
        ? "to_char(date_trunc('month', view_date), 'YYYY-MM')"
        : "to_char(view_date, 'YYYY-MM-DD')";

    return (await this.knexService
      .db(SITE_DAILY_VIEW_TABLE)
      .where("view_date", ">=", params.startDate)
      .where("view_date", "<", params.endDate)
      .groupByRaw(bucketExpression)
      .select(this.knexService.db.raw(`${bucketExpression} as bucket`))
      .sum({ view_count: "view_count" })
      .orderBy("bucket", "asc")) as DashboardTrafficRow[];
  }

  async listTopProducts(params: {
    startDate: string;
    endDate: string;
    limit: number;
  }): Promise<DashboardTopProductRow[]> {
    const db = this.knexService.db;
    const productAlias = "product_record";
    const viewAlias = "daily_view";
    const brandAlias = "brand_record";

    return (await db({ [productAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [brandAlias]: "brand" },
        `${brandAlias}.id`,
        `${productAlias}.brand_id`,
      )
      .leftJoin(
        { [viewAlias]: PRODUCT_GROUP_DAILY_VIEW_TABLE },
        function joinDailyViews() {
          this.on(`${viewAlias}.product_group_id`, "=", `${productAlias}.id`)
            .andOn(
              `${viewAlias}.view_date`,
              ">=",
              db.raw("?", [params.startDate]),
            )
            .andOn(
              `${viewAlias}.view_date`,
              "<",
              db.raw("?", [params.endDate]),
            );
        },
      )
      .whereNull(`${productAlias}.deleted_at`)
      .where(`${productAlias}.status`, "active")
      .where(`${productAlias}.review_status`, "approved")
      .where(`${productAlias}.publish_status`, "published")
      .groupBy(
        `${productAlias}.id`,
        `${productAlias}.name`,
        `${productAlias}.slug`,
        `${productAlias}.view_count`,
        `${brandAlias}.name`,
      )
      .select(
        `${productAlias}.id`,
        `${productAlias}.name`,
        `${productAlias}.slug`,
        `${brandAlias}.name as brand_name`,
        `${productAlias}.view_count`,
      )
      .sum({ period_view_count: `${viewAlias}.view_count` })
      .orderByRaw(`coalesce(sum(${viewAlias}.view_count), 0) desc`)
      .orderBy(`${productAlias}.view_count`, "desc")
      .limit(params.limit)) as DashboardTopProductRow[];
  }
}
