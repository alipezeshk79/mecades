/* =====================================================================
   MECADES Admin — Auth (سیستم حساب کاربری)
   الگوی ورود/راه‌اندازی اولیه الهام‌گرفته از AXIS:
   هش SHA-256 با salt، نشست در sessionStorage، و «بازنشانی این مرورگر».
   ===================================================================== */
(function () {
  'use strict';

  var USERS_KEY = 'mecades_users';
  var SESSION_KEY = 'mecades_session';

  /* ---------------- نقش‌ها و دسترسی‌ها ---------------- */
  var ROLES = {
    admin: {
      label: 'مدیر سیستم', desc: 'دسترسی کامل به همهٔ بخش‌ها، کاربران و تنظیمات',
      color: '#B23A2F',
      perms: ['*']
    },
    accountant: {
      label: 'حسابدار', desc: 'سفارش‌ها، مشتریان، حسابداری، گزارش‌ها و خروجی‌ها',
      color: '#3A5268',
      perms: ['dashboard.view', 'order.view', 'order.create', 'order.edit', 'payment.create',
        'customer.view', 'customer.manage', 'accounting.view', 'reports.view',
        'service.view', 'project.view', 'data.export', 'settings.view', 'profile.view']
    },
    engineer: {
      label: 'مهندس طراح', desc: 'ثبت و پیگیری سفارش‌ها، مشتریان و نمونه‌کارها',
      color: '#2F6F63',
      perms: ['dashboard.view', 'order.view', 'order.create', 'order.edit', 'payment.create',
        'customer.view', 'customer.manage', 'service.view', 'project.view', 'project.manage', 'profile.view']
    },
    viewer: {
      label: 'مشاهده‌گر', desc: 'فقط مشاهدهٔ اطلاعات، بدون امکان تغییر',
      color: '#6F889D',
      perms: ['dashboard.view', 'order.view', 'customer.view', 'service.view', 'project.view',
        'accounting.view', 'reports.view', 'profile.view']
    }
  };

  /* ---------------- ابزارها ---------------- */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00A0\u2007\u202F]/g, '')
      .trim().toLowerCase();
  }
  /* جدا کردن «نام» و «نام خانوادگی» از یک نام کامل */
  function splitName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
  }
  function joinName(first, last) {
    return ((first || '') + ' ' + (last || '')).trim();
  }
  function readUsers() {
    var u = [];
    try { u = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(u)) u = [];
    /* مهاجرت کاربران قدیمی: تفکیک نام و نام خانوادگی */
    var changed = false;
    u.forEach(function (x) {
      if (x.firstName === undefined || x.lastName === undefined) {
        var p = splitName(x.name || x.username || '');
        x.firstName = p.first; x.lastName = p.last;
        changed = true;
      }
      if (!x.name) { x.name = joinName(x.firstName, x.lastName); changed = true; }
    });
    if (changed) saveUsers(u);
    return u;
  }
  function saveUsers(u) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function salt() {
    var s = '';
    var arr = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < arr.length; j++) s += ('0' + arr[j].toString(16)).slice(-2);
    return s;
  }
  /* هش سبک برای وقتی crypto.subtle در دسترس نیست (مثلاً file:// روی بعضی مرورگرها) */
  function weakHash(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c + i, 2654435761) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function hashPassword(pwd, slt) {
    var input = 'mecades::' + (slt || '') + '::' + String(pwd);
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      try {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
          .then(function (b) {
            return Array.prototype.map.call(new Uint8Array(b), function (x) {
              return ('0' + x.toString(16)).slice(-2);
            }).join('');
          });
      } catch (e) { /* fallthrough */ }
    }
    return Promise.resolve(weakHash(input));
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 9); }

  /* ---------------- نشست ---------------- */
  function readSession() {
    var raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || !s.userId) return null;
      var u = readUsers().filter(function (x) { return x.id === s.userId; })[0];
      if (!u || u.active === false) { clearSession(); return null; }
      return u;
    } catch (e) { return null; }
  }
  function writeSession(u, remember) {
    var payload = JSON.stringify({ userId: u.id, at: Date.now(), remember: !!remember });
    try {
      sessionStorage.setItem(SESSION_KEY, payload);
      if (remember) localStorage.setItem(SESSION_KEY, payload);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* ---------------- API ---------------- */
  var Auth = {
    ROLES: ROLES,
    USERS_KEY: USERS_KEY,
    users: readUsers,
    saveUsers: saveUsers,
    norm: norm, splitName: splitName, joinName: joinName,
    hashPassword: hashPassword,
    salt: salt,
    current: function () { return readSession(); },
    isSetup: function () { return readUsers().length > 0; },
    can: function (perm) {
      var u = readSession();
      if (!u) return false;
      var role = ROLES[u.role] || ROLES.viewer;
      if (role.perms.indexOf('*') > -1) return true;
      return role.perms.indexOf(perm) > -1;
    },
    /* ساخت کاربر جدید */
    create: function (data) {
      var users = readUsers();
      var uname = norm(data.username);
      if (!uname) return Promise.reject(new Error('نام کاربری الزامی است'));
      if (users.some(function (u) { return norm(u.username) === uname; }))
        return Promise.reject(new Error('این نام کاربری قبلاً ثبت شده است'));
      var pwd = data.password ? String(data.password) : '';
      if (pwd && pwd.length < 4)
        return Promise.reject(new Error('رمز عبور باید حداقل ۴ کاراکتر باشد'));
      /* اگر رمزی تعیین نشده باشد، کاربر در اولین ورود خودش رمز را می‌سازد */
      var parts = (data.firstName !== undefined || data.lastName !== undefined)
        ? { first: (data.firstName || '').trim(), last: (data.lastName || '').trim() }
        : splitName(data.name || data.username || '');
      var fullName = joinName(parts.first, parts.last) || data.username;
      if (!pwd) {
        var nu = {
          id: uid('u'),
          firstName: parts.first,
          lastName: parts.last,
          name: fullName,
          username: data.username,
          role: ROLES[data.role] ? data.role : 'viewer',
          phone: data.phone || '',
          account: data.account || '',
          salt: null,
          passwordHash: null,
          needsPassword: true,
          active: true,
          mustChange: false,
          createdAt: Date.now(),
          lastLogin: null
        };
        users.push(nu);
        saveUsers(users);
        return Promise.resolve(nu);
      }
      var slt = salt();
      return hashPassword(pwd, slt).then(function (h) {
        var u = {
          id: uid('u'),
          firstName: parts.first,
          lastName: parts.last,
          name: fullName,
          username: data.username,
          role: ROLES[data.role] ? data.role : 'viewer',
          phone: data.phone || '',
          account: data.account || '',
          salt: slt,
          passwordHash: h,
          needsPassword: false,
          active: true,
          mustChange: !!data.mustChange,
          createdAt: Date.now(),
          lastLogin: null
        };
        users.push(u);
        saveUsers(users);
        return u;
      });
    },
    update: function (id, patch) {
      var users = readUsers();
      var u = users.filter(function (x) { return x.id === id; })[0];
      if (!u) return Promise.reject(new Error('کاربر یافت نشد'));
      if (patch.username && norm(patch.username) !== norm(u.username)) {
        if (users.some(function (x) { return norm(x.username) === norm(patch.username); }))
          return Promise.reject(new Error('این نام کاربری قبلاً ثبت شده است'));
        u.username = patch.username;
      }
      if (patch.firstName !== undefined || patch.lastName !== undefined) {
        u.firstName = (patch.firstName !== undefined ? patch.firstName : (u.firstName || '')).trim();
        u.lastName = (patch.lastName !== undefined ? patch.lastName : (u.lastName || '')).trim();
        u.name = joinName(u.firstName, u.lastName);
      } else if (patch.name) {
        var sp = splitName(patch.name);
        u.name = patch.name; u.firstName = sp.first; u.lastName = sp.last;
      }
      if (patch.role && ROLES[patch.role]) u.role = patch.role;
      if (patch.active !== undefined) u.active = !!patch.active;
      if (patch.phone !== undefined) u.phone = patch.phone;
      if (patch.account !== undefined) u.account = patch.account;
      saveUsers(users);
      return Promise.resolve(u);
    },
    setPassword: function (id, pwd) {
      if (!pwd || String(pwd).length < 4) return Promise.reject(new Error('رمز عبور باید حداقل ۴ کاراکتر باشد'));
      var users = readUsers();
      var u = users.filter(function (x) { return x.id === id; })[0];
      if (!u) return Promise.reject(new Error('کاربر یافت نشد'));
      var slt = salt();
      return hashPassword(pwd, slt).then(function (h) {
        u.salt = slt; u.passwordHash = h; u.mustChange = false;
        saveUsers(users);
        return u;
      });
    },
    remove: function (id) {
      var users = readUsers().filter(function (x) { return x.id !== id; });
      saveUsers(users);
    },
    login: function (username, password, remember) {
      var uname = norm(username);
      var u = readUsers().filter(function (x) { return norm(x.username) === uname; })[0];
      if (!u) return Promise.resolve({ ok: false, error: 'کاربری با این نام کاربری پیدا نشد' });
      if (u.active === false) return Promise.resolve({ ok: false, error: 'این حساب غیرفعال شده است' });
      /* حسابی که هنوز رمز تعیین نکرده → کاربر در اولین ورود رمز خودش را می‌سازد */
      if (!u.passwordHash) return Promise.resolve({ ok: false, error: 'PASSWORD_REQUIRED', needsPassword: true, userId: u.id });
      return hashPassword(password, u.salt).then(function (h) {
        if (h !== u.passwordHash) return { ok: false, error: 'رمز عبور نادرست است' };
        u.lastLogin = Date.now();
        saveUsers(readUsers().map(function (x) { return x.id === u.id ? u : x; }));
        writeSession(u, remember);
        return { ok: true, user: u };
      });
    },
    /* تعیین رمز در اولین ورود (کاربری که مدیر ساخته و رمز نداده است) */
    firstLogin: function (username, password) {
      var uname = norm(username);
      var u = readUsers().filter(function (x) { return norm(x.username) === uname; })[0];
      if (!u) return Promise.resolve({ ok: false, error: 'کاربری با این نام کاربری پیدا نشد' });
      if (u.active === false) return Promise.resolve({ ok: false, error: 'این حساب غیرفعال شده است' });
      if (u.passwordHash) return Promise.resolve({ ok: false, error: 'رمز عبور این حساب قبلاً تعیین شده است' });
      if (!password || String(password).length < 4)
        return Promise.resolve({ ok: false, error: 'رمز عبور باید حداقل ۴ کاراکتر باشد' });
      var slt = salt();
      return hashPassword(password, slt).then(function (h) {
        var users = readUsers();
        var t = users.filter(function (x) { return x.id === u.id; })[0];
        t.salt = slt; t.passwordHash = h; t.needsPassword = false; t.mustChange = false;
        t.lastLogin = Date.now();
        saveUsers(users);
        writeSession(t, true);
        return { ok: true, user: t };
      });
    },
    logout: clearSession,
    resetBrowser: function () {
      try {
        localStorage.removeItem(USERS_KEY);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    },
    /* کاربران نمونه برای شروع سریع */
    seedDemo: function () {
      var users = readUsers();
      if (users.length) return Promise.resolve(users);
      var demo = [
        { firstName: 'محمد', lastName: 'رضایی', username: 'admin', role: 'admin', password: 'admin123', mustChange: true },
        { firstName: 'مریم', lastName: 'کریمی', username: 'hesabdar', role: 'accountant', password: 'hesab123', mustChange: false },
        { firstName: 'امیر', lastName: 'نادری', username: 'mohandes', role: 'engineer', password: 'mohandes123', mustChange: false }
      ];
      return demo.reduce(function (chain, d) {
        return chain.then(function (acc) {
          return Auth.create(d).then(function (u) { acc.push(u); return acc; });
        });
      }, Promise.resolve([])).then(function (list) {
        /* نسبت‌دادن داده‌های نمونه به کاربران تا گزارش کارکرد خالی نباشد */
        if (window.Store && window.Store.assignDemoActors) window.Store.assignDemoActors();
        if (window.Store && window.Store.seedDemoTimesheets) window.Store.seedDemoTimesheets();
        return list;
      });
    }
  };

  window.Auth = Auth;
})();
