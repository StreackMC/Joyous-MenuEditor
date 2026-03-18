let initialized = false;

/**
 * 新建并获取jmenu编辑器元素
 * @returns {Element{}} 结构化全部所需的元素
 */
export function createAndGet() {
  initialize();
};

function initialize(params) {
  if (initialized) return;
}

export default {
  createAndGet, initialized,
};