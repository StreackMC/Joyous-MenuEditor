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

export class IndexedDB {
  /**
   * 创建一个 IndexedDB 实例。
   * @param {Object} options 配置项
   * @param {string} [options.dbName='JoyousME-DefaultTable'] 数据库名称
   * @param {string} [options.storeName='defaultStore'] 对象仓库名称
   * @param {number} [options.version=1] 数据库版本
   * @param {string} [options.atomic='parallel'] 原子化方案：'serial'（串行，等待上个操作完成） 或 'parallel'（并行，效率优先）
   */
  constructor({ dbName = 'JoyousME-DefaultTable', storeName = 'defaultStore', version = 1, atomic = 'parallel' } = {}) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.atomic = atomic === 'serial' ? 'serial' : 'parallel';

    this._db = null;          // 数据库连接
    this._ready = null;       // 初始化 Promise
    this._queue = Promise.resolve(); // 串行队列
    this._init();
  }

  /** 初始化数据库连接（内部使用） */
  _init() {
    this._ready = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this._db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  /** 确保数据库已就绪（内部使用） */
  async _ensureReady() {
    if (!this._ready) this._init();
    await this._ready;
  }

  /** 执行一个数据库操作，根据 atomic 决定是否串行排队 */
  _exec(operation) {
    if (this.atomic === 'serial') {
      this._queue = this._queue.then(async () => {
        await this._ensureReady();
        return operation(this._db);
      });
      return this._queue;
    } else {
      return (async () => {
        await this._ensureReady();
        return operation(this._db);
      })();
    }
  }

  /**
   * 设置存储项。
   * @param {string} key 键名
   * @param {*} value 值（支持结构化克隆的数据）
   * @returns {Promise<void>}
   */
  set(key, value) {
    return this._exec((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(value, key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  /**
   * 获取存储项。
   * @param {string} key 键名
   * @returns {Promise<*>} 存储的值，若不存在则为 undefined
   */
  get(key) {
    return this._exec((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    });
  }

  /**
   * 删除存储项。
   * @param {string} key 键名
   * @returns {Promise<void>}
   */
  remove(key) {
    return this._exec((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }

  /**
   * 获取所有存储项。
   * @returns {Promise<Object>} 键值对对象
   */
  getAll() {
    return this._exec((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.getAll();
        const keysRequest = store.getAllKeys();
        Promise.all([
          new Promise((res, rej) => {
            request.onerror = rej;
            request.onsuccess = () => res(request.result);
          }),
          new Promise((res, rej) => {
            keysRequest.onerror = rej;
            keysRequest.onsuccess = () => res(keysRequest.result);
          })
        ]).then(([values, keys]) => {
          const result = {};
          for (let i = 0; i < keys.length; i++) {
            result[keys[i]] = values[i];
          }
          resolve(result);
        }).catch(reject);
      });
    });
  }

  /**
   * 清空所有存储项（危险操作）。
   * @returns {Promise<void>}
   */
  reset_dangerous() {
    return this._exec((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  }
}

export default {
  // 默认不导出 IndexedDB ，因为这是异步API并且还需要 new 一下
  Session, Local, Cookies
};