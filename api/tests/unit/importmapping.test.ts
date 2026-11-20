import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildPreviewColumnMappingSummary,
  buildSuggestedImportColumnMapping,
  validateImportColumnMappingConfig,
  type ImportColumnMappingConfig
} from '../../src/modules/import-workspace/import-column-mapping';
import { ImportWorkspaceService } from '../../src/modules/import-workspace/import-workspace.service';
import { buildDerivedImportRow } from '../../src/modules/import-workspace/intake/row-normalizer';
import { extractImportedVariantAttributesFromCells } from '../../src/modules/import-workspace/variant-spec-sync';

const headers = ['Danh mục chính', 'Danh mục con', 'Tên sản phẩm', 'Giá'];

function flatMapping(priceColumn: string | null = null): ImportColumnMappingConfig {
  return {
    category_main_column: 'Danh mục chính',
    category_sub_column: 'Danh mục con',
    product_group_column: 'Tên sản phẩm',
    product_variant_column: 'Tên sản phẩm',
    brand_column: null,
    short_description_column: null,
    group_external_code_column: null,
    variant_external_code_column: null,
    sku_column: null,
    model_code_column: null,
    public_price_column: priceColumn,
    spec_columns: [],
    attribute_columns: [],
    ignored_columns: []
  };
}

test('flat product import may reuse the product name as its default variant', () => {
  const mapping = validateImportColumnMappingConfig(flatMapping(), headers);
  const derived = buildDerivedImportRow(
    {
      source_row_number: 2,
      cells: {
        'Danh mục chính': 'Thiết bị điện',
        'Danh mục con': 'Đèn LED',
        'Tên sản phẩm': 'Đèn nhà xưởng 100W',
        Giá: null
      }
    },
    mapping
  );

  assert.equal(derived.product_name, 'Đèn nhà xưởng 100W');
  assert.equal(derived.variant_name, 'Đèn nhà xưởng 100W');
  assert.match(derived.group_external_code, /^STPG-[A-F0-9]{12}$/);
  assert.match(derived.variant_external_code, /^STPV-[A-F0-9]{12}$/);
  assert.match(derived.sku, /^STSKU-[A-F0-9]{12}$/);
});

test('Excel Mã sản phẩm belongs to each saleable item, not its shared group', () => {
  const columns = [
    'Danh mục chính',
    'Danh mục con',
    'Tên sản phẩm',
    'Tên biến thể',
    'Mã sản phẩm'
  ];
  const suggested = buildSuggestedImportColumnMapping(columns);
  assert.equal(suggested.model_code_column, 'Mã sản phẩm');
  assert.equal(suggested.group_external_code_column, null);

  const first = buildDerivedImportRow(
    {
      source_row_number: 2,
      cells: {
        'Danh mục chính': 'Thiết bị điện',
        'Danh mục con': 'Đèn LED',
        'Tên sản phẩm': 'Đèn nhà xưởng',
        'Tên biến thể': '100W',
        'Mã sản phẩm': 'LED-100'
      }
    },
    suggested
  );
  const second = buildDerivedImportRow(
    {
      source_row_number: 3,
      cells: {
        'Danh mục chính': 'Thiết bị điện',
        'Danh mục con': 'Đèn LED',
        'Tên sản phẩm': 'Đèn nhà xưởng',
        'Tên biến thể': '150W',
        'Mã sản phẩm': 'LED-150'
      }
    },
    suggested
  );
  assert.equal(first.group_external_code, second.group_external_code);
  assert.equal(first.model_code, 'LED-100');
  assert.equal(second.model_code, 'LED-150');
  assert.notEqual(first.variant_external_code, second.variant_external_code);
});

test('generated variant identity stays stable when Excel rows are reordered', () => {
  const mapping = validateImportColumnMappingConfig(flatMapping(), headers);
  const cells = {
    'Danh mục chính': 'Thiết bị điện',
    'Danh mục con': 'Đèn LED',
    'Tên sản phẩm': 'Đèn nhà xưởng 100W',
    Giá: null
  };
  const first = buildDerivedImportRow({ source_row_number: 2, cells }, mapping);
  const moved = buildDerivedImportRow({ source_row_number: 129, cells }, mapping);

  assert.equal(moved.group_external_code, first.group_external_code);
  assert.equal(moved.variant_external_code, first.variant_external_code);
  assert.equal(moved.sku, first.sku);
});

test('variants of one product use a mapped SKU or model to remain distinct and stable', () => {
  const mapping = validateImportColumnMappingConfig(
    {
      ...flatMapping(),
      product_variant_column: 'Biến thể',
      sku_column: 'SKU',
      model_code_column: 'Model'
    },
    [...headers, 'Biến thể', 'SKU', 'Model']
  );
  const baseCells = {
    'Danh mục chính': 'Thiết bị điện',
    'Danh mục con': 'Đèn LED',
    'Tên sản phẩm': 'Đèn nhà xưởng',
    'Biến thể': '100W',
    SKU: null,
    Model: null,
    Giá: null
  };
  const bySku = buildDerivedImportRow(
    { source_row_number: 2, cells: { ...baseCells, SKU: 'LED-100' } },
    mapping
  );
  const movedSku = buildDerivedImportRow(
    { source_row_number: 90, cells: { ...baseCells, SKU: 'LED-100', 'Biến thể': '100W mới' } },
    mapping
  );
  const otherSku = buildDerivedImportRow(
    { source_row_number: 3, cells: { ...baseCells, SKU: 'LED-150' } },
    mapping
  );
  const byModel = buildDerivedImportRow(
    { source_row_number: 4, cells: { ...baseCells, Model: 'MX-200' } },
    mapping
  );
  const movedModel = buildDerivedImportRow(
    { source_row_number: 190, cells: { ...baseCells, Model: 'MX-200' } },
    mapping
  );

  assert.equal(bySku.variant_external_code, movedSku.variant_external_code);
  assert.notEqual(bySku.variant_external_code, otherSku.variant_external_code);
  assert.equal(byModel.variant_external_code, movedModel.variant_external_code);
  assert.notEqual(bySku.variant_external_code, byModel.variant_external_code);
});

test('reimport without explicit identifiers matches a uniquely named legacy variant in its mapped group', async () => {
  const mappedIds: Array<string | null> = [];
  const repository = {
    insertRawDataRows: async () => undefined,
    findLatestMapping: async (entityType: string) =>
      entityType === 'product_group' ? { official_id: 'official-group' } : null,
    createPendingProductGroup: async () => 'pending-group',
    findOfficialVariantsByIdentity: async () => [],
    findOfficialVariantsByGroupAndName: async (groupId: string, name: string) => {
      assert.equal(groupId, 'official-group');
      assert.equal(name, 'Đèn nhà xưởng 100W');
      return [{ id: 'legacy-variant', public_price_mode: 'contact_for_quote', public_price_amount: null }];
    },
    createPendingVariant: async (input: { mapped_official_id: string | null }) => {
      mappedIds.push(input.mapped_official_id);
      return 'pending-variant';
    }
  };
  const service = Object.create(ImportWorkspaceService.prototype) as {
    importWorkspaceRepository: typeof repository;
    stageWorkbookIntoBatch: (
      batch: unknown,
      workbook: unknown,
      mapping: ImportColumnMappingConfig,
      transaction: unknown
    ) => Promise<unknown>;
  };
  service.importWorkspaceRepository = repository;
  const mapping = validateImportColumnMappingConfig(flatMapping(), headers);

  await service.stageWorkbookIntoBatch(
    { id: 'test-batch' },
    {
      rows: [{
        source_row_number: 52,
        cells: {
          'Danh mục chính': 'Thiết bị điện',
          'Danh mục con': 'Đèn LED',
          'Tên sản phẩm': 'Đèn nhà xưởng 100W',
          Giá: null
        }
      }]
    },
    mapping,
    {}
  );
  assert.deepEqual(mappedIds, ['legacy-variant']);
});

test('ambiguous legacy names stop staging instead of choosing an arbitrary variant', async () => {
  let createdVariants = 0;
  const repository = {
    insertRawDataRows: async () => undefined,
    findLatestMapping: async (entityType: string) =>
      entityType === 'product_group' ? { official_id: 'official-group' } : null,
    createPendingProductGroup: async () => 'pending-group',
    findOfficialVariantsByIdentity: async () => [],
    findOfficialVariantsByGroupAndName: async () => [
      { id: 'variant-one' },
      { id: 'variant-two' }
    ],
    createPendingVariant: async () => {
      createdVariants += 1;
      return 'pending-variant';
    }
  };
  const service = Object.create(ImportWorkspaceService.prototype) as {
    importWorkspaceRepository: typeof repository;
    stageWorkbookIntoBatch: (
      batch: unknown,
      workbook: unknown,
      mapping: ImportColumnMappingConfig,
      transaction: unknown
    ) => Promise<unknown>;
  };
  service.importWorkspaceRepository = repository;
  const mapping = validateImportColumnMappingConfig(flatMapping(), headers);

  await assert.rejects(
    service.stageWorkbookIntoBatch(
      { id: 'test-batch' },
      {
        rows: [{
          source_row_number: 7,
          cells: {
            'Danh mục chính': 'Thiết bị điện',
            'Danh mục con': 'Đèn LED',
            'Tên sản phẩm': 'Đèn nhà xưởng 100W',
            Giá: null
          }
        }]
      },
      mapping,
      {}
    ),
    /Dòng 7: có nhiều mặt hàng tên/
  );
  assert.equal(createdVariants, 0);
});

test('conflicting SKU and model matches stop staging before an incorrect update', async () => {
  const repository = {
    insertRawDataRows: async () => undefined,
    findLatestMapping: async () => null,
    createPendingProductGroup: async () => 'pending-group',
    findOfficialVariantsByIdentity: async () => [
      { id: 'sku-match' },
      { id: 'model-match' }
    ],
    createPendingVariant: async () => {
      assert.fail('A variant must not be staged with an arbitrary official match');
    }
  };
  const service = Object.create(ImportWorkspaceService.prototype) as {
    importWorkspaceRepository: typeof repository;
    stageWorkbookIntoBatch: (
      batch: unknown,
      workbook: unknown,
      mapping: ImportColumnMappingConfig,
      transaction: unknown
    ) => Promise<unknown>;
  };
  service.importWorkspaceRepository = repository;
  const mapping = validateImportColumnMappingConfig(
    { ...flatMapping(), sku_column: 'SKU', model_code_column: 'Model' },
    [...headers, 'SKU', 'Model']
  );

  await assert.rejects(
    service.stageWorkbookIntoBatch(
      { id: 'test-batch' },
      {
        rows: [{
          source_row_number: 11,
          cells: {
            'Danh mục chính': 'Thiết bị điện',
            'Danh mục con': 'Đèn LED',
            'Tên sản phẩm': 'Đèn nhà xưởng 100W',
            SKU: 'LED-100',
            Model: 'MX-100',
            Giá: null
          }
        }]
      },
      mapping,
      {}
    ),
    /Dòng 11: Mã sản phẩm, SKU hoặc mã liên kết đang khớp với nhiều mặt hàng/
  );
});

test('column reuse remains forbidden for unrelated business roles', () => {
  assert.throws(
    () =>
      validateImportColumnMappingConfig(
        {
          ...flatMapping(),
          category_sub_column: 'Danh mục chính'
        },
        headers
      ),
    /không thể gán cho hai đích dữ liệu khác nhau/
  );
});

test('flat import preserves supported integer prices and flags overflow without inventing a price', () => {
  const mapping = validateImportColumnMappingConfig(flatMapping('Giá'), headers);
  const baseCells = {
    'Danh mục chính': 'Thiết bị điện',
    'Danh mục con': 'Đèn LED',
    'Tên sản phẩm': 'Đèn nhà xưởng 100W'
  };

  const maximum = buildDerivedImportRow(
    {
      source_row_number: 2,
      cells: { ...baseCells, Giá: '2.147.483.647 VND' }
    },
    mapping
  );
  assert.equal(maximum.public_price_amount, 2_147_483_647);
  assert.equal(maximum.price_parse_error, null);

  const overflow = buildDerivedImportRow(
    {
      source_row_number: 3,
      cells: { ...baseCells, Giá: '2147483648' }
    },
    mapping
  );
  assert.equal(overflow.public_price_mode, 'contact_for_quote');
  assert.equal(overflow.public_price_amount, null);
  assert.match(overflow.price_parse_error ?? '', /exceeds supported integer range/);
});

test('selected spec and attribute columns are shown as applied variant attributes, not staged-only data', () => {
  const allHeaders = [...headers, 'Công suất', 'Chất liệu'];
  const mapping: ImportColumnMappingConfig = {
    ...flatMapping('Giá'),
    spec_columns: ['Công suất'],
    attribute_columns: ['Chất liệu']
  };
  const preview = buildPreviewColumnMappingSummary(allHeaders, [], mapping);
  const selected = preview.proposed_mapping.filter((item) => ['Công suất', 'Chất liệu'].includes(item.source_column));
  assert.equal(selected.length, 2);
  assert.ok(selected.every((item) => item.status === 'mapped'));
  assert.ok(selected.every((item) => item.decision.includes('thuộc tính biến thể')));
  assert.equal(preview.unresolved_columns.length, 0);
});

test('explicitly choosing no attribute columns does not silently import curated columns', () => {
  const service = Object.create(ImportWorkspaceService.prototype) as ImportWorkspaceService;
  const resolveHeaders = (service as unknown as {
    resolveImportedVariantAllowedHeaders: (mapping: unknown) => string[] | null;
  }).resolveImportedVariantAllowedHeaders.bind(service);
  assert.deepEqual(resolveHeaders({ spec_columns: [], attribute_columns: [] }), []);
  assert.deepEqual(resolveHeaders({ spec_columns: ['Công suất'], attribute_columns: ['Chất liệu'] }), ['Công suất', 'Chất liệu']);
  assert.ok((resolveHeaders(null) ?? []).length > 0);
  assert.deepEqual(extractImportedVariantAttributesFromCells({ 'Công suất': '100W' }, []), []);
  assert.equal(extractImportedVariantAttributesFromCells({ 'Công suất': '100W' }, null).length, 1);
});
