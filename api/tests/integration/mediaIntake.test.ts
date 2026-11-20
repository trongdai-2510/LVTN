import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import knex, { type Knex } from 'knex';

import { createDatabaseConfig } from '../../src/config/database';
import { KnexService } from '../../src/db/knex.service';
import { MediaIntakeRepository } from '../../src/modules/mediaIntake/mediaIntakeRepository';
import { MediaIntakeService } from '../../src/modules/mediaIntake/mediaIntakeService';
import { ProductGroupRepository } from '../../src/modules/product-group/product-group.repository';
import { TechnicalDocumentRepository } from '../../src/modules/technical-document/technical-document.repository';

class ExpectedRollback extends Error {}

test('a real database batch moves from filename matching to verified content evidence', async () => {
  const database = knex(createDatabaseConfig());
  try {
    await assert.rejects(database.transaction(async (trx) => {
      const variant = await trx('product_variant').where({ model_code: 'DLV2-9N', status: 'active' }).whereNull('deleted_at').first('id');
      const file = await trx('file_metadata').whereNull('deleted_at').whereIn('mime_type', ['image/png', 'image/jpeg']).first('id', 'original_filename');
      assert.ok(variant && file, 'an active DLV2-9N variant and image are required');
      const transactionDb = Object.assign(((table: string) => trx(table)) as unknown as Knex, {
        transaction: async <T>(callback: (transaction: Knex.Transaction) => Promise<T>) => callback(trx), fn: trx.fn
      });
      const connection = { db: transactionDb } as KnexService;
      const repository = new MediaIntakeRepository(
        connection, new ProductGroupRepository(connection), new TechnicalDocumentRepository(connection)
      );
      const service = new MediaIntakeService(repository, {} as never, {
        analyze: async () => ({ model: 'verified-fixture', observed_codes: ['DLV2-9N'], visible_text: ['DLV2-9N'],
          description: 'Mã đọc từ nội dung', uncertainty: '', analyzed_pages: 0 })
      } as never);
      const batch = await repository.createBatch({ batchName: 'rollback content verification', importBatchId: null, actorId: 1 });
      const added = await repository.addItem({ batchId: batch.id, fileId: file.id });
      assert.ok('itemId' in added);
      await service.analyzeBatch(batch.id, null);
      const analyzed = await service.analyzeItemLocally(batch.id, added.itemId, null);
      const item = analyzed.items.find((entry) => entry.id === added.itemId);
      assert.ok(item);
      assert.equal(item.status, 'suggested');
      assert.ok((item.candidates as Array<{ evidence: Array<{ source: string; value: string }> }>).some((candidate) =>
        candidate.evidence.some((evidence) => evidence.source === 'content' && evidence.value === 'DLV2-9N')));
      throw new ExpectedRollback();
    }), ExpectedRollback);
  } finally {
    await database.destroy();
  }
});

test('confirmed image and PDF associations apply atomically and remain idempotent', async () => {
  const database = knex(createDatabaseConfig());
  try {
    await assert.rejects(database.transaction(async (trx) => {
      const group = await trx('product_group').where({ status: 'active' }).whereNull('deleted_at')
        .orderBy('created_at', 'asc').first('id');
      assert.ok(group, 'an active product group is required');
      const imageFile = await trx('file_metadata').whereNull('deleted_at').where('purpose', 'product_image')
        .where('mime_type', 'like', 'image/%')
        .whereNotIn('id', trx('product_image').where({ product_group_id: group.id }).whereNull('deleted_at').select('file_id'))
        .first('id', 'original_filename');
      const pdfFile = await trx('file_metadata').whereNull('deleted_at').where('mime_type', 'application/pdf')
        .whereNotIn('id', trx('technical_document').where({ product_group_id: group.id }).whereNull('deleted_at').select('file_id'))
        .first('id', 'original_filename');
      assert.ok(imageFile && pdfFile, 'an unlinked image and PDF are required');

      // All repository transaction callbacks reuse the outer transaction. The
      // rollback at the end leaves the development catalogue unchanged.
      const transactionDb = Object.assign(((table: string) => trx(table)) as unknown as Knex, {
        transaction: async <T>(callback: (transaction: Knex.Transaction) => Promise<T>) => callback(trx),
        fn: trx.fn
      });
      const connection = { db: transactionDb } as KnexService;
      const repository = new MediaIntakeRepository(
        connection, new ProductGroupRepository(connection), new TechnicalDocumentRepository(connection)
      );
      const batch = await repository.createBatch({ batchName: 'rollback verification', importBatchId: null, actorId: 1 });
      const image = await repository.addItem({ batchId: batch.id, fileId: imageFile.id });
      const pdf = await repository.addItem({ batchId: batch.id, fileId: pdfFile.id });
      assert.ok('itemId' in image && 'itemId' in pdf);
      assert.equal(await repository.saveLocalAnalysis(image.itemId,
        { model: 'local-test', observed_codes: ['ABC-100'] }, [], 'unmatched'), true);
      assert.equal(await repository.saveAnalysis(image.itemId, [], 'unmatched'), false);
      const [analyzedImage] = (await repository.listItems(batch.id)).filter((item) => item.id === image.itemId);
      assert.deepEqual((analyzedImage.local_analysis as { observed_codes: string[] }).observed_codes, ['ABC-100']);
      await repository.confirmItem({ batchId: batch.id, itemId: image.itemId, actorId: 1,
        decision: { mode: 'attach', attachments: [{ kind: 'image', product_group_id: group.id, product_variant_id: null, set_thumbnail: false }] }
      });
      await repository.confirmItem({ batchId: batch.id, itemId: pdf.itemId, actorId: 1,
        decision: { mode: 'attach', attachments: [{ kind: 'document', product_group_id: group.id, product_variant_id: null, document_type: 'datasheet', is_public: false }] }
      });
      assert.equal(await repository.applyItem({ batchId: batch.id, itemId: image.itemId, reopenReview: true }), 'applied');
      assert.equal(await repository.applyItem({ batchId: batch.id, itemId: image.itemId, reopenReview: true }), 'already_applied');
      assert.equal(await repository.applyItem({ batchId: batch.id, itemId: pdf.itemId, reopenReview: true }), 'applied');
      await repository.refreshBatchStatus(batch.id);
      const images = await trx('product_image').where({ product_group_id: group.id, file_id: imageFile.id }).whereNull('deleted_at');
      const documents = await trx('technical_document').where({ product_group_id: group.id, file_id: pdfFile.id }).whereNull('deleted_at');
      assert.equal(images.length, 1);
      assert.equal(documents.length, 1);
      assert.equal(documents[0].is_public, false);
      assert.equal((await repository.findBatch(batch.id))?.status, 'applied');
      throw new ExpectedRollback();
    }), ExpectedRollback);
  } finally {
    await database.destroy();
  }
});
