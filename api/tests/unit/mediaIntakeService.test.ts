import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CurrentUser } from '../../src/common/auth/auth.types';
import type { LogicUserReferenceRepository } from '../../src/common/users/logic-user-reference.repository';
import type { MediaAssistantContext } from '../../src/modules/mediaIntake/mediaAssistantContext';
import { MediaIntakeService } from '../../src/modules/mediaIntake/mediaIntakeService';
import type { MediaIntakeRepository } from '../../src/modules/mediaIntake/mediaIntakeRepository';
import type { LocalMediaAnalysis } from '../../src/modules/mediaIntake/localMediaAnalysis';

const batchId = '00000000-0000-4000-8000-000000000001';
const fileId = '00000000-0000-4000-8000-000000000002';
const user: CurrentUser = {
  id: 'admin', email: 'admin@example.test', display_name: 'Admin', status: 'active',
  roles: ['catalog_editor'], permissions: ['product_group.read', 'product_variant.read', 'file.read']
};

function service(repository: Record<string, unknown>, analysis: Record<string, unknown> = {}): MediaIntakeService {
  const logicUsers = { requireLogicUserId: async () => 12 } as unknown as LogicUserReferenceRepository;
  return new MediaIntakeService(repository as unknown as MediaIntakeRepository, logicUsers, analysis as unknown as LocalMediaAnalysis);
}

test('media batch listing hides Excel-linked work without import permission', async () => {
  const instance = service({
    listBatches: async () => [
      { id: batchId, import_batch_id: null },
      { id: 'linked', import_batch_id: 'excel-id' }
    ]
  });

  assert.deepEqual((await instance.listBatches(user)).items.map((batch) => batch.id), [batchId]);
});

test('an Excel-linked media batch cannot be opened without import permission', async () => {
  const instance = service({
    findBatch: async () => ({ id: batchId, import_batch_id: 'excel-id' }),
    listItems: async () => []
  });

  await assert.rejects(instance.getBatch(batchId, user), (error: unknown) =>
    error instanceof Error && error.message.includes('quyền xem lô Excel')
  );
});

test('analysis stores project candidate evidence without attaching a file', async () => {
  const saved: Array<{ itemId: string; status: string; candidates: unknown[] }> = [];
  const instance = service({
    findBatch: async () => ({ id: batchId, status: 'open', import_batch_id: null }),
    listItems: async () => [{
      id: fileId, status: 'pending', source_path: 'ABC-100/front.jpg',
      file_id: fileId, original_filename: 'front.webp', mime_type: 'image/webp'
    }],
    catalogCandidates: async () => [{
      groupId: 'group-a', variantId: 'variant-a', modelCode: 'ABC-100', sku: 'STSKU-EXAMPLE',
      externalCode: null, groupName: 'Máy A', variantName: 'ABC-100'
    }],
    saveAnalysis: async (itemId: string, candidates: unknown[], status: string) => {
      saved.push({ itemId, candidates, status });
      return true;
    }
  });

  const result = await instance.analyzeBatch(batchId, user);
  assert.equal(result.analyzed, 1);
  assert.equal(saved[0].status, 'suggested');
  assert.deepEqual(saved[0].candidates, [{
    groupId: 'group-a', variantId: 'variant-a',
    evidence: [{ source: 'folder', field: 'modelCode', value: 'ABC-100' }],
    groupName: 'Máy A', variantName: 'ABC-100'
  }]);
});

test('filename reanalysis keeps the result of local file analysis', async () => {
  let saved = false;
  const instance = service({
    findBatch: async () => ({ id: batchId, status: 'open', import_batch_id: null }),
    listItems: async () => [{ id: fileId, status: 'suggested', source_path: 'IMG_001.jpg', local_analysis: { observed_codes: ['ABC-100'] } }],
    catalogCandidates: async () => [],
    saveAnalysis: async () => { saved = true; return true; }
  });

  const result = await instance.analyzeBatch(batchId, user);
  assert.equal(result.analyzed, 0);
  assert.equal(saved, false);
});

test('assistant explains an item using stored project evidence', async () => {
  let received: MediaAssistantContext | null = null;
  const instance = service({
    findBatch: async () => ({ id: batchId, batch_name: 'Đợt thử', import_batch_id: null }),
    listItems: async () => [{
      id: fileId, original_filename: 'IMG_001.jpg', source_path: 'IMG_001.jpg', mime_type: 'image/jpeg', status: 'suggested',
      candidates: [{ groupName: 'Đèn bàn', variantName: 'ABC-100', evidence: [{ source: 'content', value: 'ABC-100' }] }]
    }]
  }, { answerQuestion: async (_question: string, context: MediaAssistantContext) => {
    received = context;
    return { answer: 'IMG_001.jpg được gợi ý cho Đèn bàn vì mã ABC-100 đọc từ nội dung file.',
      referenced_item_ids: [fileId], model: 'local-test' };
  } });

  const result = await instance.ask(batchId, 'Tôi nên cân nhắc điều gì về IMG_001.jpg?', user);
  assert.match(result.answer, /ABC-100 đọc từ nội dung file/);
  assert.deepEqual(result.referenced_item_ids, [fileId]);
  assert.equal(result.model, 'local-test');
  assert.equal((received as MediaAssistantContext | null)?.items[0].candidates[0].evidence[0].value, 'ABC-100');
});

test('assistant does not invent a code on an image when the match came from its filename', async () => {
  const instance = service({
    findBatch: async () => ({ id: batchId, batch_name: 'Đợt thử', import_batch_id: null }),
    listItems: async () => [{
      id: fileId, original_filename: 'A6CLR_01.png', source_path: 'A6CLR_01.png',
      mime_type: 'image/png', status: 'suggested',
      local_analysis: { observed_codes: [], description: 'Không có mã trên ảnh.' },
      candidates: [{ groupName: 'Đèn báo dọn phòng', variantName: 'A6CLR',
        evidence: [{ source: 'filename', field: 'modelCode', value: 'A6CLR' }] }]
    }]
  }, { answerQuestion: async () => { throw new Error('Should use verified evidence'); } });

  const result = await instance.ask(batchId, 'Ảnh A6CLR_01.png chắc chắn thuộc sản phẩm nào?', user);
  assert.match(result.answer, /tên file/);
  assert.match(result.answer, /chưa phải xác nhận/);
  assert.doesNotMatch(result.answer, /mã.*trên ảnh/i);
  assert.deepEqual(result.referenced_item_ids, [fileId]);
});

test('assistant answers catalogue questions from current project records', async () => {
  const instance = service({ assistantCatalog: async (code: string | null) => {
    assert.equal(code, 'A6CLR');
    return { activeProducts: 3, missingThumbnails: 1, missingDocuments: 2,
      examplesMissingThumbnails: [], examplesMissingDocuments: [],
      matches: [{ id: 'group-a', name: 'Đèn báo dọn phòng', variantName: 'Đèn báo dọn phòng',
        modelCode: 'A6CLR', hasThumbnail: true, documentCount: 0 }] };
  } });

  const result = await instance.askProject('A6CLR đã có ảnh và PDF chưa?');
  assert.match(result.answer, /đã có ảnh đại diện/);
  assert.match(result.answer, /0 tài liệu kỹ thuật/);
  assert.deepEqual(result.products, [{ id: 'group-a', name: 'Đèn báo dọn phòng' }]);
});

test('project assistant recalls the last product code from this conversation only', async () => {
  const instance = service({});
  const remembered = await instance.askProject('Bạn còn nhớ tôi vừa hỏi về sản phẩm nào không?', [
    { role: 'user', text: 'A6CLR đã có tài liệu chưa?' },
    { role: 'assistant', text: 'A6CLR chưa có tài liệu.' }
  ]);
  assert.match(remembered.answer, /A6CLR/);
  const fresh = await instance.askProject('Bạn còn nhớ tôi vừa hỏi về sản phẩm nào không?');
  assert.doesNotMatch(fresh.answer, /A6CLR/);
});

test('a follow-up about documents stays on the product from the previous turn', async () => {
  const codeAssistant = service({ assistantCatalog: async (code: string | null) => {
    assert.equal(code, 'DLV2-9N');
    return { activeProducts: 2, missingThumbnails: 1, missingDocuments: 1,
      examplesMissingThumbnails: [], examplesMissingDocuments: [],
      matches: [{ id: 'group-1', name: 'Đèn DLV2', variantName: 'DLV2-9N', modelCode: 'DLV2-9N',
        hasThumbnail: true, documentCount: 0 }] };
  } });
  const codeAnswer = await codeAssistant.askProject('Còn tài liệu thì sao?', [
    { role: 'user', text: 'DLV2-9N có ảnh chưa?' },
    { role: 'assistant', text: 'Đã có ảnh đại diện.' }
  ]);
  assert.match(codeAnswer.answer, /DLV2-9N.*0 tài liệu/);
  assert.doesNotMatch(codeAnswer.answer, /thiếu tài liệu kỹ thuật/);

  const nameAssistant = service({
    assistantCatalog: async (code: string | null) => {
      assert.equal(code, null);
      return { activeProducts: 2, missingThumbnails: 1, missingDocuments: 1,
        examplesMissingThumbnails: [], examplesMissingDocuments: [], matches: [] };
    },
    assistantNamedProducts: async (question: string) => {
      assert.match(question, /Downlight/);
      return [{ id: 'group-2', name: 'Đèn Downlight viền vàng', hasThumbnail: true, documentCount: 1 }];
    }
  });
  const nameAnswer = await nameAssistant.askProject('Còn PDF thì sao?', [
    { role: 'user', text: 'Đèn Downlight viền vàng có ảnh không?' },
    { role: 'assistant', text: 'Có ảnh đại diện.' }
  ]);
  assert.match(nameAnswer.answer, /Downlight viền vàng: 1 tài liệu/);
});

test('project assistant gives name matches from records and uses local conversation for open questions', async () => {
  const history = [{ role: 'user' as const, text: 'Tôi đang chuẩn bị ảnh sản phẩm.' }];
  let asked = false;
  const instance = service({
    assistantCatalog: async () => ({ activeProducts: 12, missingThumbnails: 3, missingDocuments: 5,
      examplesMissingThumbnails: [], examplesMissingDocuments: [], matches: [] }),
    assistantNamedProducts: async (question: string) => question.includes('Downlight')
      ? [{ id: 'product-1', name: 'Đèn Downlight 118mm', hasThumbnail: true, documentCount: 1 }] : []
  }, {
    answerProjectQuestion: async (_question: string, facts: unknown, receivedHistory: unknown) => {
      asked = true;
      assert.deepEqual(receivedHistory, history);
      assert.deepEqual(facts, { activeProducts: 12, missingThumbnails: 3, missingDocuments: 5, matchingProducts: [] });
      return 'Bạn có thể gửi ảnh ở ô chat để mình đối chiếu.';
    }
  });
  const named = await instance.askProject('Đèn Downlight 118mm có ảnh và tài liệu chưa?');
  assert.match(named.answer, /1 tài liệu/);
  assert.deepEqual(named.products, [{ id: 'product-1', name: 'Đèn Downlight 118mm' }]);
  assert.equal(asked, false);
  const open = await instance.askProject('Tôi có phương pháp mới để sắp xếp file, bạn đánh giá thế nào?', history);
  assert.match(open.answer, /gửi ảnh/);
  assert.equal(asked, true);
});

test('project assistant keeps folder guidance separate from blurry-image guidance', async () => {
  const instance = service({ assistantCatalog: async () => ({ activeProducts: 12, missingThumbnails: 3,
    missingDocuments: 5, examplesMissingThumbnails: [], examplesMissingDocuments: [], matches: [] }) });
  const folder = await instance.askProject('Tôi có nhiều ảnh trong một thư mục, làm thế nào để xử lý?');
  assert.match(folder.answer, /Chọn thư mục ảnh\/PDF/);
  assert.doesNotMatch(folder.answer, /file mờ/);
  const blurry = await instance.askProject('Ảnh bị mờ, không đọc được mã thì sao?');
  assert.match(blurry.answer, /file mờ/);
  const followup = await instance.askProject('Còn tài liệu kỹ thuật thì sao?');
  assert.match(followup.answer, /5 sản phẩm/);
  const priority = await instance.askProject('Tôi chỉ có 15 phút, nên ưu tiên việc gì?');
  assert.match(priority.answer, /chưa có dữ liệu để xếp hạng/);
  const unclear = await instance.askProject('Tên sản phẩm chưa rõ thì sao?');
  assert.match(unclear.answer, /ứng viên và lý do/);
  const alternative = await instance.askProject('Tôi muốn cân nhắc một cách xử lý khác, bạn nghĩ sao?');
  assert.match(alternative.answer, /chọn file, tìm sản phẩm, hay duyệt gợi ý/);
});

test('local analysis matches observed codes to the current catalogue and stores evidence', async () => {
  const saved: Array<{ analysis: unknown; candidates: unknown[]; status: string }> = [];
  const instance = service({
    findBatch: async () => ({ id: batchId, status: 'open', import_batch_id: null }),
    listItems: async () => [{ id: fileId, file_id: fileId, source_path: 'IMG_001.jpg', status: 'pending',
      candidates: saved[0]?.candidates ?? [], local_analysis: saved[0]?.analysis ?? null }],
    catalogCandidates: async () => [{ groupId: 'group-a', variantId: 'variant-a', modelCode: 'ABC-100',
      groupName: 'Đèn bàn', variantName: 'ABC-100' }],
    saveLocalAnalysis: async (_id: string, analysis: unknown, candidates: unknown[], status: string) => {
      saved.push({ analysis, candidates, status });
      return true;
    }
  }, { analyze: async () => ({ model: 'local-test', observed_codes: ['ABC-100'], visible_text: [],
    description: 'Mã trên ảnh', uncertainty: '', analyzed_pages: 0 }) });

  const result = await instance.analyzeItemLocally(batchId, fileId, user);
  assert.equal(result.analysis_status, 'unique');
  assert.equal(saved[0]?.status, 'suggested');
  assert.deepEqual(saved[0]?.candidates, [{ groupId: 'group-a', variantId: 'variant-a',
    evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }],
    groupName: 'Đèn bàn', variantName: 'ABC-100' }]);
});

test('batch apply continues after one file fails and keeps that decision retryable', async () => {
  const secondId = '00000000-0000-4000-8000-000000000003';
  const recorded: string[] = [];
  const instance = service({
    findBatch: async () => ({ id: batchId, status: 'open', import_batch_id: null }),
    listItems: async () => [
      { id: fileId, status: 'confirmed', mime_type: 'image/webp', decision: { mode: 'attach', attachments: [{ kind: 'image', product_group_id: batchId }] } },
      { id: secondId, status: 'confirmed', mime_type: 'image/webp', decision: { mode: 'attach', attachments: [{ kind: 'image', product_group_id: batchId }] } }
    ],
    applyItem: async ({ itemId }: { itemId: string }) => {
      if (itemId === fileId) throw new Error('temporary failure');
      return 'applied';
    },
    recordApplyError: async (itemId: string) => { recorded.push(itemId); },
    refreshBatchStatus: async () => undefined
  });

  const result = await instance.applyBatch(batchId, { ...user, permissions: [...user.permissions, 'product_group.update'] });
  assert.equal(result.applied, 1);
  assert.deepEqual(recorded, [fileId]);
  assert.deepEqual(result.errors?.map((error) => error.item_id), [fileId]);
});

test('image batch cannot be applied by a reader without product edit permission', async () => {
  let applied = false;
  const instance = service({
    findBatch: async () => ({ id: batchId, status: 'open', import_batch_id: null }),
    listItems: async () => [{ id: fileId, status: 'confirmed', mime_type: 'image/webp',
      decision: { mode: 'attach', attachments: [{ kind: 'image', product_group_id: batchId }] } }],
    applyItem: async () => { applied = true; }
  });
  await assert.rejects(instance.applyBatch(batchId, user), (error: unknown) =>
    error instanceof Error && error.message.includes('không có quyền gán ảnh'));
  assert.equal(applied, false);
});
