export const Cookies = {
  /**
   * 设置一个Cookie。
   * @param {string} e Cookie名
   * @param {string} t Cookie值
   * @param {number} o 有效期（秒），可选
   * @param {string} n 路径
   */
  set: function (e, t, o, n) {
    const s = `${encodeURIComponent(e)}=${encodeURIComponent(t)}`;
    if (o) {
      const e = new Date;
      e.setTime(e.getTime() + 1e3 * o), document.cookie = `${s}; expires=${e.toUTCString()}; path=${n}`;
    } else document.cookie = `${s}; path=${n}`;
  },
  /**
   * 获取指定名称的Cookie。
   * @param {string} e Cookie名
   * @returns {string|null} Cookie值或null
   */
  get: function (e) {
    const t = document.cookie.split("; ");
    for (const o of t) {
      const [t, n] = o.split("=", 2);
      if (decodeURIComponent(t) === e) return decodeURIComponent(n);
    }
    return null;
  },
  /**
   * 删除指定名称的Cookie。
   * @param {string} e Cookie名
   */
  remove: function (e) {
    this.set(e, "", {
      expires: -1
    });
  },
  /**
   * 获取所有Cookie，返回对象形式。
   * @returns {Object} 所有Cookie的键值对
   */
  getAll: function () {
    const e = document.cookie.split("; "),
      t = {};
    for (const o of e) {
      const [e, n] = o.split("=", 2);
      t[decodeURIComponent(e)] = decodeURIComponent(n);
    }
    return t;
  },
  /**
   * 清除所有Cookie（危险操作）。
   */
  reset_dangerous: function () {
    const e = this.getAll();
    for (const t in e) this.remove(t);
  }
};

export const Local = {
  /**
   * 设置本地存储项。
   * @param {string} e 键名
   * @param {*} t 值
   */
  set: function (e, t) {
    localStorage.setItem(e, JSON.stringify(t));
  },
  /**
   * 获取本地存储项。
   * @param {string} e 键名
   * @returns {*} 存储的值
   */
  get: function (e) {
    const t = localStorage.getItem(e);
    try {
      return JSON.parse(t);
    } catch (e) {
      return t;
    }
  },
  /**
   * 删除本地存储项。
   * @param {string} e 键名
   */
  remove: function (e) {
    localStorage.removeItem(e);
  },
  /**
   * 获取所有本地存储项。
   * @returns {Object} 所有键值对
   */
  getAll: function () {
    const e = {};
    for (let t = 0; t < localStorage.length; t++) {
      const o = localStorage.key(t);
      e[o] = this.get(o);
    }
    return e;
  },
  /**
   * 清空所有本地存储（危险操作）。
   */
  reset_dangerous: function () {
    localStorage.clear();
  }
};

export const Session = {
  /**
   * 设置会话存储项。
   * @param {string} e 键名
   * @param {*} t 值
   */
  set: function (e, t) {
    sessionStorage.setItem(e, JSON.stringify(t));
  },
  /**
   * 获取会话存储项。
   * @param {string} e 键名
   * @returns {*} 存储的值
   */
  get: function (e) {
    const t = sessionStorage.getItem(e);
    try {
      return JSON.parse(t);
    } catch (e) {
      return t;
    }
  },
  /**
   * 删除会话存储项。
   * @param {string} e 键名
   */
  remove: function (e) {
    sessionStorage.removeItem(e);
  },
  /**
   * 获取所有会话存储项。
   * @returns {Object} 所有键值对
   */
  getAll: function () {
    const e = {};
    for (let t = 0; t < sessionStorage.length; t++) {
      const o = sessionStorage.key(t);
      e[o] = this.get(o);
    }
    return e;
  },
  /**
   * 清空所有会话存储（危险操作）。
   */
  reset_dangerous: function () {
    sessionStorage.clear();
  }
};

export default {
  Session, Local, Cookies
};