import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTagDto, UpdateTagDto } from '../../src/modules/tag/tagDto';

test('tag appearance accepts only the supported icon and tone choices', () => {
  const valid = plainToInstance(CreateTagDto, {
    name: 'Bán chạy',
    icon_key: 'flame',
    tone_key: 'amber'
  });
  assert.equal(validateSync(valid).length, 0);

  for (const field of ['icon_key', 'tone_key'] as const) {
    const invalid = plainToInstance(UpdateTagDto, { [field]: '<script>alert(1)</script>' });
    assert.ok(validateSync(invalid).some((error) => error.property === field));
  }
});
