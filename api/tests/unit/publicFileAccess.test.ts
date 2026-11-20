import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Response } from 'express';

import { PublicService } from '../../src/modules/public/public.service';
import type { PublicRepository } from '../../src/modules/public/public.repository';
import type { PublicProductFileRepository } from '../../src/modules/public/public-product-file.repository';
import type { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import type { RedirectRepository } from '../../src/modules/redirect/redirect.repository';

const sharp: typeof import('sharp').default = require('sharp');

const FILE_ID = '3459eec9-b2e1-4ad2-8351-03b7e8b36f39';
const PUBLIC_IMAGE = {
  id: FILE_ID,
  original_filename: 'product.png',
  mime_type: 'image/png',
  storage_location: 'local',
  stored_path: 'unused'
};

function publicFileService(productLookup: () => Promise<unknown>, bytes = Buffer.from('unusable image bytes')): PublicService {
  const publicRepository = {
    findPublicFileById: async () => PUBLIC_IMAGE
  } as unknown as PublicRepository;
  const productRepository = {
    findPublicProductImageFileById: productLookup
  } as unknown as PublicProductFileRepository;
  const service = new PublicService(
    publicRepository,
    productRepository,
    {} as DashboardService,
    {} as RedirectRepository
  );
  Object.defineProperty(service, 'readPublicFileBuffer', {
    value: async () => bytes
  });
  return service;
}

function captureResponse(): { response: Response; sent: Buffer[]; headers: Map<string, string> } {
  const sent: Buffer[] = [];
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); return response; },
    end: (body: Buffer) => { sent.push(body); return response; }
  } as unknown as Response;
  return { response, sent, headers };
}

test('public product image never falls back to the original bytes when watermarking fails', async () => {
  const service = publicFileService(async () => PUBLIC_IMAGE);
  const { response, sent } = captureResponse();

  await assert.rejects(service.sendPublicFile(FILE_ID, response));
  assert.equal(sent.length, 0);
});

test('public product image lookup failure never falls back to the original bytes', async () => {
  const service = publicFileService(async () => { throw new Error('lookup unavailable'); });
  const { response, sent } = captureResponse();

  await assert.rejects(service.sendPublicFile(FILE_ID, response));
  assert.equal(sent.length, 0);
});

test('public product image returns a watermarked PNG when processing succeeds', async () => {
  const source = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#eeeeee' }
  }).png().toBuffer();
  const service = publicFileService(async () => PUBLIC_IMAGE, source);
  const { response, sent, headers } = captureResponse();

  await service.sendPublicFile(FILE_ID, response);
  assert.equal(sent.length, 1);
  assert.equal(headers.get('Content-Type'), 'image/png');
  assert.equal(headers.get('Cache-Control'), 'private, no-store');
  assert.notDeepEqual(sent[0], source);
  assert.equal((await sharp(sent[0]).metadata()).width, 600);
});

test('other public files retain their original bytes', async () => {
  const source = Buffer.from('public file bytes');
  const service = publicFileService(async () => null, source);
  const { response, sent } = captureResponse();

  await service.sendPublicFile(FILE_ID, response);
  assert.deepEqual(sent, [source]);
});
