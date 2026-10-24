import assert from 'node:assert/strict';
import test from 'node:test';

import { getHeaderItems } from '../src/features/site-shell/headerItems.ts';

const item = (id, order) => ({
  id,
  parent_id: null,
  title: id,
  link_type: 'internal',
  link_target: `/${id}`,
  sort_order: order,
  children: []
});

test('managed header preserves custom links and admin order', () => {
  const menu = { items: [item('news', 3), item('custom', 1), item('products', 2)] };
  assert.deepEqual(getHeaderItems(menu, [item('fallback', 0)]).map(({ id }) => id), [
    'custom', 'products', 'news'
  ]);
});

test('managed empty menu stays empty while missing menu uses fallback', () => {
  const fallback = [item('home', 1)];
  assert.deepEqual(getHeaderItems({ items: [] }, fallback), []);
  assert.deepEqual(getHeaderItems(null, fallback), fallback);
});

test('groups with children stay available for navigation', () => {
  const group = { ...item('solutions', 1), link_type: 'group', link_target: null, children: [item('service', 1)] };
  const empty = { ...group, id: 'empty', children: [] };
  assert.deepEqual(getHeaderItems({ items: [empty, group] }, []).map(({ id }) => id), ['solutions']);
});
