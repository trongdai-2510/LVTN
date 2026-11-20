import { Injectable } from "@nestjs/common";

import { DashboardAnalyticsQueryDto } from "./dashboard.dto";
import { DashboardRepository } from "./dashboard.repository";

type AnalyticsMode = "days" | "month" | "year";

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  recordSiteView(): Promise<number> {
    return this.dashboardRepository.recordSiteView();
  }

  recordProductView(productGroupId: string): Promise<number> {
    return this.dashboardRepository.recordProductView(productGroupId);
  }

  async getAnalytics(query: DashboardAnalyticsQueryDto) {
    const today = currentVietnamDateParts();
    const mode: AnalyticsMode = query.mode ?? "days";
    const year = query.year ?? today.year;
    const month = query.month ?? today.month;
    const range = buildRange(mode, year, month, today);

    const [rows, topProductRows] = await Promise.all([
      this.dashboardRepository.listTraffic({
        startDate: range.startDate,
        endDate: range.endDate,
        grain: mode === "year" ? "month" : "day",
      }),
      this.dashboardRepository.listTopProducts({
        startDate: range.startDate,
        endDate: range.endDate,
        limit: 6,
      }),
    ]);

    const counts = new Map(
      rows.map((row) => [row.bucket, Number(row.view_count ?? 0)]),
    );
    const series = range.keys.map((key) => ({
      key,
      label: formatBucketLabel(key, mode),
      view_count: counts.get(key) ?? 0,
    }));

    return {
      range: {
        mode,
        year,
        month: mode === "year" ? null : month,
        start_date: range.startDate,
        end_date: previousDate(range.endDate),
        label: range.label,
      },
      traffic: {
        total: series.reduce((sum, item) => sum + item.view_count, 0),
        series,
      },
      top_products: topProductRows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        brand_name: row.brand_name,
        period_view_count: Number(row.period_view_count ?? 0),
        total_view_count: Number(row.view_count ?? 0),
      })),
    };
  }
}

function currentVietnamDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
  };
}

function buildRange(
  mode: AnalyticsMode,
  year: number,
  month: number,
  today: { year: number; month: number; day: number },
) {
  if (mode === "year") {
    const keys = Array.from(
      { length: 12 },
      (_, index) => `${year}-${pad(index + 1)}`,
    );
    return {
      startDate: `${year}-01-01`,
      endDate: `${year + 1}-01-01`,
      keys,
      label: `Năm ${year}`,
    };
  }

  if (mode === "month") {
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const keys = Array.from(
      { length: dayCount },
      (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`,
    );
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return {
      startDate: keys[0],
      endDate: `${nextYear}-${pad(nextMonth)}-01`,
      keys,
      label: `Tháng ${month}/${year}`,
    };
  }

  const end = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 19);
  const keys = Array.from({ length: 20 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return isoDate(date);
  });
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    startDate: keys[0],
    endDate: isoDate(endExclusive),
    keys,
    label: "20 ngày gần nhất",
  };
}

function formatBucketLabel(key: string, mode: AnalyticsMode) {
  if (mode === "year") return `T${Number(key.slice(5, 7))}`;
  const [, month, day] = key.split("-");
  return `${Number(day)}/${Number(month)}`;
}

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return isoDate(date);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
