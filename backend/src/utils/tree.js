/** 扁平菜单列表转树形结构，空 children 会被移除 */
function buildTree(list) {
  const map = new Map(list.map(m => [m.id, { ...m, children: [] }])), roots = [];
  list.forEach(m => { const node = map.get(m.id), p = m.parent_id && map.get(m.parent_id); p ? p.children.push(node) : roots.push(node); });
  const clean = n => { if (n.children && n.children.length) n.children.forEach(clean); else delete n.children; };
  roots.forEach(clean);
  return roots;
}

/** 提取菜单列表中的全部权限点（逗号分隔去重） */
const permList = menus => menus.flatMap(m => String(m.permission || '').split(',').map(x => x.trim()).filter(Boolean));

module.exports = { buildTree, permList };
