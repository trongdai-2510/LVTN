const assert = require('node:assert/strict');
const {
  CATEGORY_PAGE_SIZE,
  categoryPage
} = require('../../frontend/src/features/product-categories/categoryBrowse.ts');

const roots = Array.from({ length: 1000 }, (_, index) => ({
  id: `root-${index}`,
  name: `Danh mục ${index}`,
  children: []
}));
const children = Array.from({ length: 1000 }, (_, index) => ({
  id: `child-${index}`,
  name: `Nhóm con ${index}`,
  children: []
}));
roots[0].children = children;

assert.equal(CATEGORY_PAGE_SIZE, 8);
assert.equal(categoryPage(roots, 1).length, 8);
assert.equal(categoryPage(roots, 125).length, 8);
assert.equal(categoryPage(roots, 125)[7].id, 'root-999');
assert.equal(categoryPage(children, 125)[7].id, 'child-999');
assert.equal(categoryPage(roots, 126).length, 0);
assert.equal(categoryPage(roots, -3)[0].id, 'root-0');

console.log('1,000 roots and 1,000 children: eight per page and last-page navigation pass');
