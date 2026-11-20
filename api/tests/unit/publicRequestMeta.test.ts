import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Request } from 'express';

import { PublicController } from '../../src/modules/public/public.controller';
import type { PublicService } from '../../src/modules/public/public.service';
import type { CreatePublicContactRequestDto } from '../../src/modules/public/public.dto';
import type { CreatePublicQuoteRequestDto } from '../../src/modules/public/public.dto';

test('public contact metadata uses the verified request IP, not a client-supplied forwarded header', async () => {
  let received: { ip_address: string | null; user_agent: string | null } | undefined;
  const service = {
    createPublicContactRequest: async (
      _body: CreatePublicContactRequestDto,
      meta: { ip_address: string | null; user_agent: string | null }
    ) => {
      received = meta;
      return {};
    },
    createPublicQuoteRequest: async (
      _body: CreatePublicQuoteRequestDto,
      meta: { ip_address: string | null; user_agent: string | null }
    ) => {
      received = meta;
      return {};
    }
  } as unknown as PublicService;
  const request = {
    ip: '203.0.113.12',
    headers: { 'x-forwarded-for': '198.51.100.99' },
    get: (name: string) => name === 'user-agent' ? 'Test browser' : undefined
  } as unknown as Request;

  await new PublicController(service).createPublicContactRequest(
    {} as CreatePublicContactRequestDto,
    request
  );

  assert.deepEqual(received, {
    ip_address: '203.0.113.12',
    user_agent: 'Test browser'
  });

  received = undefined;
  await new PublicController(service).createPublicQuoteRequest(
    {} as CreatePublicQuoteRequestDto,
    request
  );
  assert.deepEqual(received, {
    ip_address: '203.0.113.12',
    user_agent: 'Test browser'
  });
});
