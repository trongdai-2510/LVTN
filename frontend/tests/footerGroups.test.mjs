import assert from 'node:assert/strict';
import test from 'node:test';

import { getDirectFooterLinks, getFooterGroups, getFooterLinks } from '../src/features/site-shell/footerGroups.ts';

const link = (id) => ({
  id,
  parent_id: null,
  title: id,
  link_type: 'internal',
  link_target: `/${id}`,
  sort_order: 0,
  open_in_new_tab: false,
  icon_name: null,
  description: null,
  children: []
});

test('a footer support menu can supply any number of named link groups', () => {
  const groups = ['Kỹ thuật', 'Mua hàng', 'Thông tin'].map((title, index) => ({
    ...link(`group${index}`),
    title,
    link_type: 'group',
    link_target: null,
    children: [link(`page${index}`)]
  }));

  assert.deepEqual(getFooterGroups(groups).map(({ title, items }) => ({ title, ids: items.map((item) => item.id) })), [
    { title: 'Kỹ thuật', ids: ['page0'] },
    { title: 'Mua hàng', ids: ['page1'] },
    { title: 'Thông tin', ids: ['page2'] }
  ]);
});

test('empty groups stay hidden and direct footer links remain separate', () => {
  const roots = [link('contact'), { ...link('empty'), link_type: 'group', link_target: null }];
  assert.deepEqual(getFooterGroups(roots), []);
});

test('legal links inside a group are usable links rather than an empty group target', () => {
  const roots = [{ ...link('policies'), link_type: 'group', link_target: null, children: [link('privacy')] }];
  assert.deepEqual(getFooterLinks(roots).map((item) => item.link_target), ['/privacy']);
});

test('a missing or disabled footer menu never invents public links', () => {
  assert.deepEqual(getDirectFooterLinks(null), []);
  assert.deepEqual(getDirectFooterLinks({ items: [] }), []);
  assert.deepEqual(getDirectFooterLinks({ items: [link('contact'), { ...link('group'), link_type: 'group' }] }).map((item) => item.id), ['contact']);
});
