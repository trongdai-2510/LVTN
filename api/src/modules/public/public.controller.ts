import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import {
  PublicBannerListQueryDto,
  PublicBrandListQueryDto,
  CreatePublicContactRequestDto,
  PublicNewsListQueryDto,
  PublicRelatedNewsQueryDto,
  PublicProjectListQueryDto,
  CreatePublicQuoteRequestDto,
  PublicProductCategoryListQueryDto,
  PublicProductGroupListQueryDto,
  PublicSearchSuggestionQueryDto,
  PublicServiceListQueryDto,
} from "./public.dto";
import { PublicService } from "./public.service";
import type {
  PublicBannerListResponse,
  PublicBrandDetailResponse,
  PublicBrandListResponse,
  PublicCategoryListResponse,
  PublicContactRequestCreateResponse,
  PublicNewsCategoryListResponse,
  PublicNewsListResponse,
  PublicPageContentDetailResponse,
  PublicProjectDetailResponse,
  PublicProjectListResponse,
  PublicProductGroupDetailResponse,
  PublicProductGroupListResponse,
  PublicProductGroupViewResponse,
  PublicQuoteRequestCreateResponse,
  PublicRedirectListResponse,
  PublicSearchSuggestionResponse,
  PublicServiceDetailResponse,
  PublicServiceListResponse,
  PublicSiteViewResponse,
  PublicSiteShellResponse,
} from "./public.types";

@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("site-shell")
  getSiteShell(): Promise<PublicSiteShellResponse> {
    return this.publicService.getSiteShell();
  }

  @Get("redirects")
  listPublicRedirects(): Promise<PublicRedirectListResponse> {
    return this.publicService.listPublicRedirects();
  }

  @Post("site-views")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  recordPublicSiteView(): Promise<PublicSiteViewResponse> {
    return this.publicService.recordPublicSiteView();
  }

  @Get("product-categories")
  listPublicProductCategories(
    @Query() query: PublicProductCategoryListQueryDto,
  ): Promise<PublicCategoryListResponse> {
    return this.publicService.listPublicCategories(query);
  }

  @Get("product-groups")
  listPublicProductGroups(
    @Query() query: PublicProductGroupListQueryDto,
  ): Promise<PublicProductGroupListResponse> {
    return this.publicService.listPublicProductGroups(query);
  }

  @Get("search-suggestions")
  listPublicSearchSuggestions(
    @Query() query: PublicSearchSuggestionQueryDto,
  ): Promise<PublicSearchSuggestionResponse> {
    return this.publicService.listPublicSearchSuggestions(query);
  }

  @Get("product-groups/:slug")
  getPublicProductGroupDetail(
    @Param("slug") slug: string,
  ): Promise<PublicProductGroupDetailResponse> {
    return this.publicService.getPublicProductGroupDetail(slug);
  }

  @Post("product-groups/:slug/view")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  recordPublicProductGroupView(
    @Param("slug") slug: string,
  ): Promise<PublicProductGroupViewResponse> {
    return this.publicService.recordPublicProductGroupView(slug);
  }

  @Get("services")
  listPublicServices(
    @Query() query: PublicServiceListQueryDto,
  ): Promise<PublicServiceListResponse> {
    return this.publicService.listPublicServices(query);
  }

  @Get("services/:slug")
  getPublicServiceDetail(
    @Param("slug") slug: string,
  ): Promise<PublicServiceDetailResponse> {
    return this.publicService.getPublicServiceDetail(slug);
  }

  @Get("projects")
  listPublicProjects(
    @Query() query: PublicProjectListQueryDto,
  ): Promise<PublicProjectListResponse> {
    return this.publicService.listPublicProjects(query);
  }

  @Get("projects/:slug")
  getPublicProjectDetail(
    @Param("slug") slug: string,
  ): Promise<PublicProjectDetailResponse> {
    return this.publicService.getPublicProjectDetail(slug);
  }

  @Get("brands")
  listPublicBrands(
    @Query() query: PublicBrandListQueryDto,
  ): Promise<PublicBrandListResponse> {
    return this.publicService.listPublicBrands(query);
  }

  @Get("brands/:slug")
  getPublicBrandDetail(
    @Param("slug") slug: string,
  ): Promise<PublicBrandDetailResponse> {
    return this.publicService.getPublicBrandDetail(slug);
  }

  @Get("news/related")
  listRelatedNews(@Query() query: PublicRelatedNewsQueryDto) {
    return this.publicService.listRelatedNews(query);
  }

  @Get("news")
  listPublicNews(
    @Query() query: PublicNewsListQueryDto,
  ): Promise<PublicNewsListResponse> {
    return this.publicService.listPublicNews(query);
  }

  @Get("news-categories")
  listPublicNewsCategories(): Promise<PublicNewsCategoryListResponse> {
    return this.publicService.listPublicNewsCategories();
  }

  @Get("page-contents/:slug")
  getPublicPageContent(
    @Param("slug") slug: string,
  ): Promise<PublicPageContentDetailResponse> {
    return this.publicService.getPublicPageContent(slug);
  }

  @Get("banners")
  listPublicBanners(
    @Query() query: PublicBannerListQueryDto,
  ): Promise<PublicBannerListResponse> {
    return this.publicService.listPublicBanners(query);
  }

  @Get("files/:id/download-watermarked")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  downloadPublicWatermarkedProductImage(
    @Param("id") id: string,
    @Res() response: Response,
  ): Promise<void> {
    return this.publicService.sendPublicWatermarkedProductImageDownload(
      id,
      response,
    );
  }

  @Get("files/:id")
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  getPublicFile(
    @Param("id") id: string,
    @Res() response: Response,
  ): Promise<void> {
    return this.publicService.sendPublicFile(id, response);
  }

  // Form công khai không cần auth → siết để chống spam/flood DB.
  @Post("contact-requests")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createPublicContactRequest(
    @Body() body: CreatePublicContactRequestDto,
    @Req() request: Request,
  ): Promise<PublicContactRequestCreateResponse> {
    return this.publicService.createPublicContactRequest(
      body,
      this.extractRequestMeta(request),
    );
  }

  @Post("quote-requests")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createPublicQuoteRequest(
    @Body() body: CreatePublicQuoteRequestDto,
    @Req() request: Request,
  ): Promise<PublicQuoteRequestCreateResponse> {
    return this.publicService.createPublicQuoteRequest(
      body,
      this.extractRequestMeta(request),
    );
  }

  private extractRequestMeta(request: Request): {
    ip_address: string | null;
    user_agent: string | null;
  } {
    const userAgent = request.get("user-agent")?.trim() || null;

    return {
      ip_address: request.ip?.trim() || null,
      user_agent: userAgent,
    };
  }
}
