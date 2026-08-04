import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { KnexModule } from './db/knex.module';
import { AdminPermissionModule } from './modules/admin-permission/admin-permission.module';
import { AdminRoleModule } from './modules/admin-role/admin-role.module';
import { AdminUserModule } from './modules/admin-user/admin-user.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { BannerModule } from './modules/banner/banner.module';
import { BrandPageModule } from './modules/brand-page/brand-page.module';
import { BrandModule } from './modules/brand/brand.module';
import { ContactModule } from './modules/contact/contact.module';
import { CustomerModule } from './modules/customer/customer.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FileModule } from './modules/file/file.module';
import { HealthModule } from './modules/health/health.module';
import { HomePageModule } from './modules/home-page/home-page.module';
import { ImportWorkspaceModule } from './modules/import-workspace/import-workspace.module';
import { MenuModule } from './modules/menu/menu.module';
import { NewsCategoryModule } from './modules/news-category/news-category.module';
import { PageContentModule } from './modules/page-content/page-content.module';
import { ProductCategoryModule } from './modules/product-category/product-category.module';
import { ProductGroupModule } from './modules/product-group/product-group.module';
import { ProductVariantModule } from './modules/product-variant/product-variant.module';
import { ProjectModule } from './modules/project/project.module';
import { PublicModule } from './modules/public/public.module';
import { QuoteModule } from './modules/quote/quote.module';
import { RedirectModule } from './modules/redirect/redirect.module';
import { ServiceModule } from './modules/service/service.module';
import { TechnicalDocumentModule } from './modules/technical-document/technical-document.module';
import { WebsiteSettingsModule } from './modules/website-settings/website-settings.module';
import { AuditTrailInterceptor } from './common/audit/audit-trail.interceptor';

@Module({
  imports: [
    // Mặc định nới rộng để không chặn admin/ảnh; các route nhạy cảm siết riêng bằng @Throttle.
    // Admin product screens legitimately load several reference datasets at once.
    // Sensitive public mutations keep their stricter route-level limits.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
    KnexModule,
    AdminPermissionModule,
    AdminUserModule,
    AdminRoleModule,
    AuthModule,
    HealthModule,
    FileModule,
    ProductCategoryModule,
    BrandModule,
    BrandPageModule,
    ProductGroupModule,
    ProductVariantModule,
    TechnicalDocumentModule,
    PublicModule,
    ServiceModule,
    ProjectModule,
    CustomerModule,
    DashboardModule,
    ContactModule,
    QuoteModule,
    WebsiteSettingsModule,
    MenuModule,
    NewsCategoryModule,
    PageContentModule,
    BannerModule,
    RedirectModule,
    AuditLogModule,
    HomePageModule,
    ImportWorkspaceModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor }
  ]
})
export class AppModule {}
