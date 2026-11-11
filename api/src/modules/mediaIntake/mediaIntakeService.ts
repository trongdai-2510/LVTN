import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { buildMediaMatchIndex } from '../file/mediaMatch';
import { answerFromEvidence } from './mediaAssistantAnswer';
import { buildMediaAssistantContext } from './mediaAssistantContext';
import { normalizeMediaDecision } from './mediaIntakeDecision';
import { MediaIntakeRepository } from './mediaIntakeRepository';
import { LocalMediaAnalysis, type MediaConversationTurn } from './localMediaAnalysis';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${field} không hợp lệ.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field }
    });
  }
  return value;
}

@Injectable()
export class MediaIntakeService {
  constructor(
    private readonly repository: MediaIntakeRepository,
    private readonly logicUsers: LogicUserReferenceRepository,
    private readonly localAnalysis: LocalMediaAnalysis
  ) {}

  async listBatches(user: CurrentUser | null) {
    const batches = await this.repository.listBatches();
    return {
      items: this.canReadImport(user) ? batches : batches.filter((batch) => !batch.import_batch_id)
    };
  }

  async createBatch(input: { batch_name?: string; import_batch_id?: string }, user: CurrentUser | null) {
    const batchName = input.batch_name?.trim() || null;
    if (batchName && batchName.length > 255) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'Tên đợt vượt quá 255 ký tự.', statusCode: HttpStatus.BAD_REQUEST });
    }
    const importBatchId = input.import_batch_id ? requireUuid(input.import_batch_id, 'import_batch_id') : null;
    if (importBatchId) this.assertImportAccess(user);
    if (importBatchId && !(await this.repository.importBatchStatus(importBatchId))) {
      throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Không tìm thấy lô Excel.', statusCode: HttpStatus.NOT_FOUND });
    }
    const actorId = await this.logicUsers.requireLogicUserId(user);
    const batch = await this.repository.createBatch({ batchName, importBatchId, actorId });
    return { batch, items: [] };
  }

  async getBatch(batchId: string, user: CurrentUser | null) {
    const id = requireUuid(batchId, 'batch_id');
    const batch = await this.repository.findBatch(id);
    if (!batch) {
      throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Không tìm thấy đợt media.', statusCode: HttpStatus.NOT_FOUND });
    }
    if (batch.import_batch_id) this.assertImportAccess(user);
    return { batch, items: await this.repository.listItems(id) };
  }

  async addItem(batchId: string, input: { file_id: string; source_path?: string }, user: CurrentUser | null) {
    const id = requireUuid(batchId, 'batch_id');
    const fileId = requireUuid(input.file_id, 'file_id');
    await this.getBatch(id, user);
    const outcome = await this.repository.addItem({ batchId: id, fileId, sourcePath: input.source_path });
    if (outcome.status === 'batch_unavailable') {
      throw new AppError({ code: 'MEDIA_BATCH_NOT_OPEN', message: 'Đợt media không tồn tại hoặc đã đóng.', statusCode: HttpStatus.CONFLICT });
    }
    if (outcome.status === 'file_unavailable') {
      throw new AppError({ code: 'MEDIA_FILE_UNAVAILABLE', message: 'Chỉ nhận ảnh hoặc PDF đang hoạt động trong Kho tệp.', statusCode: HttpStatus.BAD_REQUEST });
    }
    if (outcome.status === 'limit') {
      throw new AppError({ code: 'MEDIA_BATCH_FULL', message: 'Mỗi đợt hỗ trợ tối đa 500 file.', statusCode: HttpStatus.BAD_REQUEST });
    }
    if (outcome.status === 'path_conflict') {
      throw new AppError({ code: 'MEDIA_FILE_PATH_CONFLICT', message: 'Tên hoặc đường dẫn file đã có trong đợt với nội dung khác.', statusCode: HttpStatus.CONFLICT });
    }
    if (!('itemId' in outcome)) {
      throw new AppError({ code: 'MEDIA_ITEM_UNAVAILABLE', message: 'Không thể thêm file vào đợt media.', statusCode: HttpStatus.CONFLICT });
    }
    const detail = await this.getBatch(id, user);
    return { item: detail.items.find((item) => item.id === outcome.itemId), already_added: outcome.status === 'existing' };
  }

  async analyzeBatch(batchId: string, user: CurrentUser | null) {
    const detail = await this.getBatch(batchId, user);
    if (!['open', 'partially_applied'].includes(detail.batch.status)) {
      throw new AppError({ code: 'MEDIA_BATCH_NOT_OPEN', message: 'Đợt media đã đóng.', statusCode: HttpStatus.CONFLICT });
    }
    if (detail.batch.import_batch_id) {
      const importStatus = await this.repository.importBatchStatus(detail.batch.import_batch_id);
      if (importStatus !== 'applied') {
        throw new AppError({
          code: 'MEDIA_IMPORT_NOT_APPLIED',
          message: 'Cần áp dụng lô Excel trước khi đối chiếu ảnh và tài liệu với sản phẩm chính thức.',
          statusCode: HttpStatus.CONFLICT
        });
      }
    }

    const catalog = await this.repository.catalogCandidates();
    const suggest = buildMediaMatchIndex(catalog);
    const catalogByVariant = new Map(catalog.map((item) => [item.variantId, item]));
    let analyzed = 0;
    for (const item of detail.items) {
      if (!['pending', 'suggested', 'unmatched'].includes(item.status)) continue;
      if (item.local_analysis) continue;
      const result = suggest(item.source_path);
      const candidates = result.candidates.map((candidate) => ({
        ...candidate,
        groupName: catalogByVariant.get(candidate.variantId)?.groupName ?? '',
        variantName: catalogByVariant.get(candidate.variantId)?.variantName ?? ''
      }));
      if (await this.repository.saveAnalysis(item.id, candidates, candidates.length > 0 ? 'suggested' : 'unmatched')) {
        analyzed += 1;
      }
    }
    return { ...(await this.getBatch(detail.batch.id, user)), analyzed };
  }

  localAiStatus() {
    return this.localAnalysis.status();
  }

  async analyzeItemLocally(batchId: string, itemId: string, user: CurrentUser | null) {
    const detail = await this.getBatch(batchId, user);
    const id = requireUuid(itemId, 'item_id');
    const item = detail.items.find((candidate) => candidate.id === id);
    if (!item) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Không tìm thấy file trong đợt.', statusCode: HttpStatus.NOT_FOUND });
    if (!['open', 'partially_applied'].includes(detail.batch.status) || !['pending', 'suggested', 'unmatched'].includes(item.status)) {
      throw new AppError({ code: 'MEDIA_ITEM_NOT_ANALYZABLE', message: 'File đã xác nhận hoặc đợt đã đóng.', statusCode: HttpStatus.CONFLICT });
    }
    if (detail.batch.import_batch_id && await this.repository.importBatchStatus(detail.batch.import_batch_id) !== 'applied') {
      throw new AppError({ code: 'MEDIA_IMPORT_NOT_APPLIED', message: 'Cần áp dụng lô Excel trước khi đối chiếu AI.', statusCode: HttpStatus.CONFLICT });
    }
    const analysis = await this.localAnalysis.analyze(item.file_id);
    const catalog = await this.repository.catalogCandidates();
    const catalogByVariant = new Map(catalog.map((candidate) => [candidate.variantId, candidate]));
    const result = buildMediaMatchIndex(catalog)(item.source_path, analysis.observed_codes);
    const candidates = result.candidates.map((candidate) => ({
      ...candidate, groupName: catalogByVariant.get(candidate.variantId)?.groupName ?? '',
      variantName: catalogByVariant.get(candidate.variantId)?.variantName ?? ''
    }));
    const saved = await this.repository.saveLocalAnalysis(item.id, analysis, candidates, candidates.length ? 'suggested' : 'unmatched');
    if (!saved) throw new AppError({ code: 'MEDIA_ITEM_CHANGED', message: 'File đã được người khác xác nhận trong lúc AI xử lý. Hãy tải lại.', statusCode: HttpStatus.CONFLICT });
    return { ...(await this.getBatch(detail.batch.id, user)), analysis_status: result.status };
  }

  async ask(batchId: string, question: string, user: CurrentUser | null, focusItemIds: string[] = [], history: MediaConversationTurn[] = []) {
    const trimmed = question?.trim();
    if (!trimmed || trimmed.length > 500) throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR, message: 'Câu hỏi phải có từ 1 đến 500 ký tự.', statusCode: HttpStatus.BAD_REQUEST
    });
    const detail = await this.getBatch(batchId, user);
    if (detail.items.length === 0) {
      return { answer: 'Lượt này chưa có ảnh/PDF. Hãy thêm file để robot đọc và đối chiếu với sản phẩm trong project.',
        referenced_item_ids: [], model: 'project-data' };
    }
    const context = buildMediaAssistantContext(detail.batch, detail.items, trimmed, focusItemIds);
    const evidenceAnswer = answerFromEvidence(trimmed, context);
    if (evidenceAnswer) return evidenceAnswer;
    return this.localAnalysis.answerQuestion(trimmed, context, history.slice(-6));
  }

  async askProject(question: string, history: MediaConversationTurn[] = []) {
    const trimmed = question?.trim();
    if (!trimmed || trimmed.length > 500) throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR, message: 'Câu hỏi phải có từ 1 đến 500 ký tự.', statusCode: HttpStatus.BAD_REQUEST
    });
    const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    const codePattern = /\b(?=[A-Za-z0-9.-]*\d)[A-Za-z][A-Za-z0-9.-]{3,}\b/;
    const userQuestions = [...history].reverse().filter((turn) => turn.role === 'user');
    const previousQuestion = userQuestions.find((turn) => codePattern.test(turn.text));
    const previousCode = previousQuestion?.text.match(codePattern)?.[0] ?? null;
    const recentQuestion = userQuestions[0]?.text ?? '';
    const recentCode = recentQuestion.match(codePattern)?.[0] ?? null;
    const statusFollowup = /^(con|the|vay)\b/.test(normalized) && /anh|hinh|pdf|tai lieu|datasheet/.test(normalized);
    if (/con nho|vua hoi|truoc do/.test(normalized) && /ma|san pham|gi/.test(normalized)) {
      return { answer: previousCode
        ? `Có, bạn vừa hỏi về mã ${previousCode}. Bạn muốn mình kiểm tra ảnh/tài liệu của mã này hay tìm biến thể liên quan?`
        : 'Trong đoạn trò chuyện hiện tại mình chưa thấy mã sản phẩm nào được nhắc đến. Bạn gửi mã hoặc tên sản phẩm để mình tra trong project nhé.',
        products: [], model: 'project-data' };
    }
    const explicitCode = trimmed.match(codePattern)?.[0] ?? null;
    const code = explicitCode ?? (statusFollowup || /\b(no|do|nay|ay|vua noi|vua hoi)\b/.test(normalized) ? recentCode : null);
    const catalog = await this.repository.assistantCatalog(code);
    const followupMatches = statusFollowup && !code && recentQuestion
      ? await this.repository.assistantNamedProducts(recentQuestion) : [];
    const products: Array<{ id: string; name: string }> = [];
    let answer: string;
    if (code && /tuong tu|gan giong|bien the|cung nhom/.test(normalized)) {
      products.push(...catalog.matches.map((item) => ({ id: item.id, name: item.name })));
      products.push(...(catalog.relatedVariants ?? []).map((item) => ({ id: item.id, name: item.name })));
      answer = catalog.matches.length
        ? (catalog.relatedVariants?.length
          ? `Trong cùng nhóm sản phẩm với ${code}, project có các biến thể: ${catalog.relatedVariants.map((item) => item.modelCode || item.variantName).join(', ')}. Đây là quan hệ cùng nhóm trong dữ liệu, chưa phải kết luận ảnh của chúng giống nhau.`
          : `Mình tìm được ${code}, nhưng chưa thấy biến thể khác đang hoạt động trong cùng nhóm sản phẩm.`)
        : `Chưa tìm thấy mã ${code} trong sản phẩm đang hoạt động. Bạn kiểm tra lại mã giúp mình nhé.`;
    } else if (code) {
      products.push(...catalog.matches.map((item) => ({ id: item.id, name: item.name })));
      const documentsOnly = /pdf|tai lieu|datasheet/.test(normalized) && !/anh|hinh/.test(normalized);
      const imagesOnly = /anh|hinh/.test(normalized) && !/pdf|tai lieu|datasheet/.test(normalized);
      answer = catalog.matches.length
        ? catalog.matches.slice(0, 4).map((item) => `${item.name} — ${item.variantName || item.modelCode}: ${documentsOnly ? `${item.documentCount} tài liệu kỹ thuật đang hoạt động`
          : imagesOnly ? item.hasThumbnail ? 'đã có ảnh đại diện' : 'chưa có ảnh đại diện'
            : `${item.hasThumbnail ? 'đã có ảnh đại diện' : 'chưa có ảnh đại diện'}, ${item.documentCount} tài liệu kỹ thuật đang hoạt động`}`).join('; ') + '. Đây là dữ liệu sản phẩm trong project; bạn có thể gửi ảnh/PDF để robot đối chiếu mã trước khi gán.'
        : `Chưa tìm thấy mã ${code} trong các sản phẩm đang hoạt động của project. Hãy kiểm tra lại mã hoặc tìm theo tên trong trang Sản phẩm.`;
    } else if (followupMatches.length) {
      products.push(...followupMatches.map((item) => ({ id: item.id, name: item.name })));
      const documentsOnly = /pdf|tai lieu|datasheet/.test(normalized) && !/anh|hinh/.test(normalized);
      answer = followupMatches.slice(0, 3).map((item) => `${item.name}: ${documentsOnly ? `${item.documentCount} tài liệu kỹ thuật đang hoạt động`
        : item.hasThumbnail ? 'có ảnh đại diện' : 'chưa có ảnh đại diện'}`).join('; ') + '.';
    } else if (/(thieu|chua co|chua du).*(anh|hinh)|(con|ve) (anh|hinh)/.test(normalized)) {
      const examples = catalog.examplesMissingThumbnails.filter((item) => item.name.length <= 80 && /^[A-Za-zÀ-ỹ]/u.test(item.name.trim()) && !/\([^)]*$/.test(item.name)).slice(0, 3);
      products.push(...examples);
      answer = `Hiện có ${catalog.missingThumbnails} sản phẩm đang hoạt động chưa có ảnh đại diện.${examples.length ? ` Ví dụ: ${examples.map((item) => item.name).join(', ')}.` : ''} Bạn có thể gửi nhiều ảnh hoặc một thư mục để mình tìm sản phẩm phù hợp.`;
    } else if (/(thieu|chua co|chua du).*(pdf|tai lieu|datasheet)|(con|ve) (pdf|tai lieu|datasheet)/.test(normalized)) {
      const examples = catalog.examplesMissingDocuments.filter((item) => item.name.length <= 80 && /^[A-Za-zÀ-ỹ]/u.test(item.name.trim()) && !/\([^)]*$/.test(item.name)).slice(0, 3);
      products.push(...examples);
      answer = `Hiện có ${catalog.missingDocuments} sản phẩm đang hoạt động chưa có tài liệu kỹ thuật.${examples.length ? ` Ví dụ: ${examples.map((item) => item.name).join(', ')}.` : ''} Bạn gửi PDF để mình đọc mã và gợi ý sản phẩm, rồi duyệt trước khi gán.`;
    } else if (/\b(chao|bat dau|lam gi dau tien)\b/.test(normalized)) {
      answer = `Chào bạn! Trong project hiện có ${catalog.missingThumbnails} sản phẩm thiếu ảnh đại diện và ${catalog.missingDocuments} sản phẩm thiếu tài liệu kỹ thuật. Bạn có thể gửi ảnh/PDF ở đây để mình đối chiếu, hoặc hỏi một mã sản phẩm cụ thể trước.`;
    } else if (/thu muc|nhieu anh|hang loat/.test(normalized) && /anh|file|pdf/.test(normalized)) {
      answer = 'Bạn bấm “Chọn thư mục ảnh/PDF” dưới ô hỏi, chọn thư mục rồi chờ robot đối chiếu với sản phẩm trong project. Sau đó mở các gợi ý cần xem, xác nhận file đúng và bấm áp dụng khi đã kiểm tra xong.';
    } else if (/\bmo\b|khong doc|khong thay|\bloi\b/.test(normalized) && /anh|file|pdf|ma/.test(normalized)) {
      answer = 'Nếu file mờ hoặc không đọc được mã, hãy xem bản gốc và thử gửi ảnh/PDF rõ hơn. Bạn cũng có thể cho mình mã model để tra sản phẩm trong project; chỉ xác nhận gán khi file và gợi ý khớp nhau.';
    } else if (/phut|it thoi gian|uu tien/.test(normalized)) {
      answer = `Nếu chỉ có ít thời gian, bạn thử một lượt nhỏ: gửi vài ảnh/PDF cùng nhóm, xem gợi ý có mã rõ rồi xác nhận những file chắc chắn. Hiện ${catalog.missingThumbnails} sản phẩm thiếu ảnh và ${catalog.missingDocuments} sản phẩm thiếu tài liệu; mình chưa có dữ liệu để xếp hạng sản phẩm nào quan trọng nhất.`;
    } else if (/ten.*(chua ro|khong ro|mo ho)|khong biet.*san pham/.test(normalized)) {
      answer = 'Nếu tên sản phẩm chưa rõ, mình chưa thể chọn đích gán chắc chắn. Bạn gửi ảnh/PDF hoặc mã model nếu có; mình sẽ nêu các ứng viên và lý do, còn bạn chọn sản phẩm đúng trước khi áp dụng.';
    } else if (/cach xu ly khac|phuong an khac|ban nghi sao/.test(normalized)) {
      answer = 'Được, bạn muốn đổi bước nào: chọn file, tìm sản phẩm, hay duyệt gợi ý? Nói thêm cách bạn định làm, mình sẽ đối chiếu với dữ liệu và thao tác hiện có trong project.';
    } else {
      const namedMatches = await this.repository.assistantNamedProducts(trimmed);
      if (namedMatches.length) {
        products.push(...namedMatches.map((item) => ({ id: item.id, name: item.name })));
        answer = namedMatches.slice(0, 3).map((item) => `${item.name}: ${item.hasThumbnail ? 'có ảnh đại diện' : 'chưa có ảnh đại diện'}, ${item.documentCount} tài liệu kỹ thuật đang hoạt động`).join('; ') + '. Nếu đây chưa đúng sản phẩm bạn muốn hỏi, hãy gửi mã model để mình kiểm tra chính xác hơn.';
      } else {
        const facts = { activeProducts: catalog.activeProducts, missingThumbnails: catalog.missingThumbnails,
          missingDocuments: catalog.missingDocuments, matchingProducts: [] };
        try {
          answer = await this.localAnalysis.answerProjectQuestion(trimmed, facts, history.slice(-6));
        } catch {
          answer = 'Mình chưa đủ dữ liệu để trả lời chính xác câu này. Bạn gửi mã/tên sản phẩm, hoặc ảnh/PDF cần xử lý để mình đối chiếu với dữ liệu project nhé.';
        }
      }
    }
    return { answer, products: [...new Map(products.map((item) => [item.id, item])).values()].slice(0, 5), model: 'project-data' };
  }

  async confirmItem(batchId: string, itemId: string, rawDecision: unknown, user: CurrentUser | null) {
    const detail = await this.getBatch(batchId, user);
    const id = requireUuid(itemId, 'item_id');
    const item = detail.items.find((candidate) => candidate.id === id);
    if (!item) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Không tìm thấy file trong đợt.', statusCode: HttpStatus.NOT_FOUND });
    const decision = normalizeMediaDecision(rawDecision, item.mime_type);
    this.assertMutationAccess(user, decision);
    const actorId = await this.logicUsers.requireLogicUserId(user);
    await this.repository.confirmItem({ batchId: detail.batch.id, itemId: id, decision, actorId });
    return this.getBatch(detail.batch.id, user);
  }

  async applyBatch(batchId: string, user: CurrentUser | null) {
    const detail = await this.getBatch(batchId, user);
    for (const item of detail.items) {
      if (item.status === 'confirmed') this.assertMutationAccess(user, normalizeMediaDecision(item.decision, item.mime_type));
    }
    if (detail.batch.import_batch_id) {
      const status = await this.repository.importBatchStatus(detail.batch.import_batch_id);
      if (status !== 'applied') throw new AppError({
        code: 'MEDIA_IMPORT_NOT_APPLIED', message: 'Cần áp dụng lô Excel trước khi gán media.', statusCode: HttpStatus.CONFLICT
      });
    }
    const errors: Array<{ item_id: string; message: string }> = [];
    let applied = 0;
    for (const item of detail.items) {
      if (item.status !== 'confirmed') continue;
      try {
        if (await this.repository.applyItem({
          batchId: detail.batch.id, itemId: item.id, reopenReview: !user?.roles.includes('super_admin')
        }) === 'applied') applied += 1;
      } catch (error) {
        const message = error instanceof AppError ? error.message : 'Không áp dụng được file. Kiểm tra log máy chủ.';
        await this.repository.recordApplyError(item.id, message);
        errors.push({ item_id: item.id, message });
      }
    }
    await this.repository.refreshBatchStatus(detail.batch.id);
    return { ...(await this.getBatch(detail.batch.id, user)), applied, errors };
  }

  private canReadImport(user: CurrentUser | null): boolean {
    return Boolean(user?.roles.includes('super_admin') || user?.permissions.includes('import.read'));
  }

  private assertMutationAccess(user: CurrentUser | null, decision: ReturnType<typeof normalizeMediaDecision>): void {
    if (user?.roles.includes('super_admin') || decision.mode === 'skip') return;
    const permissions = new Set(user?.permissions ?? []);
    const denied = decision.attachments.some((attachment) =>
      !permissions.has(attachment.kind === 'image' ? 'product_group.update' : 'technical_document.create')
    );
    if (denied) throw new AppError({
      code: ErrorCodes.PERMISSION_DENIED,
      message: 'Bạn không có quyền gán ảnh hoặc tài liệu đã chọn.',
      statusCode: HttpStatus.FORBIDDEN
    });
  }

  private assertImportAccess(user: CurrentUser | null): void {
    if (this.canReadImport(user)) return;
    throw new AppError({
      code: ErrorCodes.PERMISSION_DENIED,
      message: 'Bạn không có quyền xem lô Excel liên kết với đợt media này.',
      statusCode: HttpStatus.FORBIDDEN
    });
  }
}
