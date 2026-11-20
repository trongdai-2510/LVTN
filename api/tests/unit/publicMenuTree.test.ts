import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildPublicMenuTree, hiddenSystemPageTargets } from '../../src/modules/public/publicMenuTree';

const menuId = 'menu-1';

function row(id: string, parentId: string | null, title: string) {
  return {
    id,
    menu_id: menuId,
    parent_id: parentId,
    title,
    link_type: parentId ? 'internal' as const : 'group' as const,
    link_target: parentId ? '/san-pham' : null,
    sort_order: 0,
    open_in_new_tab: false,
    icon_name: null,
    description: null,
  };
}

test('public menu keeps visible children under their active group', () => {
  const tree = buildPublicMenuTree([row('group', null, 'Tài liệu'), row('link', 'group', 'Catalogue')]);
  assert.deepEqual(tree.map((item) => [item.title, item.children.map((child) => child.title)]), [
    ['Tài liệu', ['Catalogue']],
  ]);
});

test('public menu never promotes descendants of a hidden or archived parent', () => {
  const tree = buildPublicMenuTree([
    row('visible', null, 'Liên kết nhanh'),
    row('orphan', 'hidden-group', 'Liên kết chưa công khai'),
    row('grandchild', 'orphan', 'Tài liệu chưa công khai'),
  ]);
  assert.deepEqual(tree.map((item) => item.id), ['visible']);
});

test('public menu omits a link to a hidden system page without changing its stored item', () => {
  const about = { ...row('about', null, 'Giới thiệu'), link_type: 'internal' as const, link_target: '/gioi-thieu?source=header' };
  const product = { ...row('product', null, 'Danh sách sản phẩm'), link_type: 'internal' as const, link_target: '/san-pham/danh-sach' };
  const items = [about, product];
  const hiddenTargets = hiddenSystemPageTargets(['san-pham']);

  assert.equal(hiddenTargets.has('/gioi-thieu'), true);
  assert.equal(hiddenTargets.has('/san-pham'), false);
  assert.deepEqual(buildPublicMenuTree(items, hiddenTargets).map((item) => item.id), ['product']);
  assert.equal(items[0].link_target, '/gioi-thieu?source=header');
});

test('a hidden menu parent does not promote its child, while the child route remains unrelated to parent publication', () => {
  const parent = { ...row('parent', null, 'Dự án'), link_type: 'internal' as const, link_target: '/du-an' };
  const child = { ...row('child', 'parent', 'Dự án mẫu'), link_target: '/du-an/project-example' };
  const independent = { ...row('independent', null, 'Dự án mẫu'), link_type: 'internal' as const, link_target: '/du-an/project-example' };

  assert.deepEqual(
    buildPublicMenuTree([parent, child, independent], hiddenSystemPageTargets([])).map((item) => item.id),
    ['independent']
  );
});
