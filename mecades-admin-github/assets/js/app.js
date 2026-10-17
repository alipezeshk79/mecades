/* =====================================================================
   MECADES Admin — Application (router, views, interactions)
   ===================================================================== */
(function () {
  'use strict';

  var S = window.Store;
  var viewEl = document.getElementById('view');
  var modalRoot = document.getElementById('modalRoot');
  var toastsEl = document.getElementById('toasts');
  var state = S.state;

  /* ================= helpers ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return esc(S.money(n)); }
  function statusBadge(key) { var s = S.STATUS[key] || S.STATUS.new; return '<span class="badge ' + s.cls + '">' + esc(s.label) + '</span>'; }
  function srcTag(src) { return '<span class="tag">' + esc(S.SOURCES[src] || src) + '</span>'; }
  function prioTag(p) {
    var cls = p === 'high' ? 'b-design' : p === 'low' ? 'b-cancel' : 'b-new';
    var lbl = S.PRIORITY[p] || 'عادی';
    return '<span class="badge ' + cls + '">' + esc(lbl) + '</span>';
  }
  function icon(n, cls) { return window.icon(n, cls); }
  function daysLeft(ts) { return S.daysBetween(Date.now(), ts); }
  function deadlineTag(ts) {
    var d = daysLeft(ts);
    if (d < 0) return '<span class="badge b-cancel">' + S.fa(Math.abs(d)) + ' روز تأخیر</span>';
    if (d <= 3) return '<span class="badge b-due">' + S.fa(d) + ' روز</span>';
    return '<span class="tag">' + S.faDateShort(ts) + '</span>';
  }
  function emptyBox(title, sub, ic) {
    return '<div class="empty">' + icon(ic || 'inbox') + '<b>' + esc(title) + '</b><p>' + esc(sub || '') + '</p></div>';
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function toCSV(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var v = String(c == null ? '' : c).replace(/"/g, '""');
        return /[",\n]/.test(v) ? '"' + v + '"' : v;
      }).join(',');
    }).join('\r\n');
  }
  function toFaCSV(rows) {
    return '\ufeff' + rows.map(function (r) { return r.map(function (c) { return S.fa(c); }).join(','); }).join('\r\n');
  }

  /* ================= charts ================= */
  function monthSeries(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      var j = S.g2j(t.getFullYear(), t.getMonth() + 1, t.getDate());
      out.push({ key: S.monthKey(t.getTime()), label: S.MONTHS[j[1] - 1], ts: t.getTime() });
    }
    return out;
  }
  function axisFmt(v) {
    if (!v) return '۰';
    if (v >= 1e9) return S.fa(Math.round(v / 1e8) / 10) + ' میلیارد';
    if (v >= 1e6) return S.fa(Math.round(v / 1e5) / 10) + ' م';
    return S.fa(v / 1e3) + ' ه';
  }
  function revenueChart() {
    var months = monthSeries(8);
    var data = months.map(function (m) {
      var v = 0, h = 0;
      S.state.orders.forEach(function (o) {
        if (S.monthKey(o.created) === m.key) { v += o.quote; h += o.hours; }
      });
      return { key: m.key, label: m.label, value: v, hours: h };
    });
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var W = 760, H = 236, padB = 34, padT = 22, padS = 8, padE = 8;
    var iw = W - padS - padE, ih = H - padB - padT;
    var slot = iw / data.length, bw = Math.min(48, slot * 0.5);
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="نمودار درآمد ماهانه">';
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - (ih * g / 4);
      svg += '<line x1="' + padS + '" y1="' + y + '" x2="' + (W - padE) + '" y2="' + y + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 6"/>';
      svg += '<text x="' + (W - padE) + '" y="' + (y - 6) + '" font-size="10.5" fill="var(--muted)" text-anchor="end">' + axisFmt(max * g / 4) + '</text>';
    }
    data.forEach(function (d, i) {
      var h = d.value > 0 ? Math.max(5, (d.value / max) * ih) : 4;
      var x = padS + slot * i + (slot - bw) / 2, y = padT + ih - h;
      var isLast = i === data.length - 1;
      svg += '<rect class="bar" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="8" fill="' + (isLast ? 'var(--red)' : 'url(#gbar)') + '"><title>' + esc(d.label) + ' — ' + S.money(d.value) + ' — ' + S.fa(d.hours) + ' ساعت</title></rect>';
      svg += '<text x="' + (x + bw / 2) + '" y="' + (H - 11) + '" font-size="11.5" fill="var(--muted)" text-anchor="middle">' + esc(d.label) + '</text>';
      if (d.value > 0) {
        svg += '<text x="' + (x + bw / 2) + '" y="' + (y - 8) + '" font-size="11" fill="var(--text)" text-anchor="middle" font-weight="700">' + S.fa(S.moneyShort(d.value)) + '</text>';
      }
    });
    svg += '<defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--navy-500)"/><stop offset="100%" stop-color="var(--navy)"/></linearGradient></defs>';
    svg += '</svg>';
    return svg;
  }
  function donut() {
    var counts = {};
    S.state.orders.forEach(function (o) { counts[o.serviceId] = (counts[o.serviceId] || 0) + o.quote; });
    var items = S.state.services.map(function (s) { return { name: s.short || s.name, color: s.color, value: counts[s.id] || 0 }; })
      .filter(function (x) { return x.value > 0; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var R = 54, C = 2 * Math.PI * R, off = 0;
    var svg = '<svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="ترکیب خدمات">';
    svg += '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="var(--bg-alt)" stroke-width="18"/>';
    items.forEach(function (it) {
      var frac = it.value / total;
      svg += '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="' + it.color + '" stroke-width="18" ' +
        'stroke-dasharray="' + (frac * C).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off * C).toFixed(2) + '" ' +
        'transform="rotate(-90 75 75)" stroke-linecap="butt"><title>' + esc(it.name) + '</title></circle>';
      off += frac;
    });
    svg += '<text x="75" y="70" font-size="13" fill="var(--muted)" text-anchor="middle">مجموع</text>';
    svg += '<text x="75" y="90" font-size="15" font-weight="700" fill="var(--text)" text-anchor="middle">' + S.fa(S.moneyShort(total)) + '</text>';
    svg += '</svg>';
    return { svg: svg, items: items, total: total };
  }


  /* ================= auth (حساب کاربری) ================= */
  var AUTH_MODE = 'login';
  var AUTH_USER = '';
  function brandMark(size) {
    var w = size || 52;
    return '<img class="brand-logo" src="assets/img/mecades-mark.png" width="' + w + '" alt="MECADES">';
  }
  function showAuth(mode) {
    AUTH_MODE = mode;
    var old = document.getElementById('authLayer'); if (old) old.remove();
    var isSetup = mode === 'setup';
    var isFirst = mode === 'first';
    var hasUsers = Auth.isSetup();
    var demoUsers = Auth.users().filter(function (u) { return u.username === 'admin' || u.username === 'hesabdar' || u.username === 'mohandes'; });
    var title = isSetup ? 'راه‌اندازی اولیه سیستم' : (isFirst ? 'تعیین رمز عبور' : 'ورود به پنل مکادیز');
    var desc = isSetup
      ? 'هیچ حسابی در این مرورگر ثبت نشده است؛ حساب مدیر اصلی را بسازید تا کار با پنل آغاز شود.'
      : (isFirst
        ? 'اولین ورود شماست؛ نام کاربری‌ای که مدیر در اختیارتان گذاشته را وارد کنید و رمز عبور خودتان را تعیین کنید.'
        : 'برای دسترسی به سفارش‌ها، مشتریان و حسابداری، نام کاربری و رمز عبور خود را وارد کنید.');
    var html = '<div class="auth" id="authLayer">' +
      '<div class="auth-bg"></div><div class="auth-orb"></div>' +
      '<div class="auth-card">' +
      '<div class="auth-brand">' + brandMark(56) +
      '<div><b>MECADES</b><small>پنل مدیریت طراحی مهندسی</small></div></div>' +
      '<h1>' + title + '</h1>' +
      '<p class="auth-desc">' + desc + '</p>' +
      '<form id="authForm" autocomplete="off">' +
      (isSetup ? '<div class="auth-fld"><label>نام</label><input id="authFirst" placeholder="مثلاً محمد" autocomplete="given-name"></div>' +
        '<div class="auth-fld"><label>نام خانوادگی</label><input id="authLast" placeholder="مثلاً رضایی" autocomplete="family-name"></div>' : '') +
      '<div class="auth-fld"><label>نام کاربری</label><input id="authUser" placeholder="admin" autocomplete="username" value="' + esc(isFirst ? AUTH_USER : '') + '"' + (isFirst ? ' readonly' : '') + '></div>' +
      (isFirst
        ? '<div class="auth-fld"><label>رمز عبور (جدید)</label><div class="auth-pass">' +
          '<input id="authPass" type="password" placeholder="حداقل ۴ کاراکتر" autocomplete="new-password">' +
          '<button type="button" id="authTogglePass" title="نمایش رمز عبور">' + icon('eye') + '</button></div></div>' +
          '<div class="auth-fld"><label>تکرار رمز عبور</label><input id="authConfirm" type="password" placeholder="تکرار رمز عبور" autocomplete="new-password"></div>'
        : '<div class="auth-fld"><label>رمز عبور</label><div class="auth-pass">' +
          '<input id="authPass" type="password" placeholder="••••••" autocomplete="current-password">' +
          '<button type="button" id="authTogglePass" title="نمایش رمز عبور">' + icon('eye') + '</button></div></div>' +
          (isSetup ? '<div class="auth-fld"><label>تکرار رمز عبور</label><input id="authConfirm" type="password" placeholder="••••••"></div>' : '')) +
      '<button class="auth-btn" id="authSubmit" type="submit">' + icon('logout') + (isSetup ? ' ساخت حساب و ورود' : (isFirst ? ' تعیین رمز و ورود' : ' ورود به پنل')) + '</button>' +
      '</form>' +
      '<div class="auth-error" id="authError"></div>' +
      (demoUsers.length && !isSetup && !isFirst ? '<div class="auth-demo"><b>ورود سریع نمایشی</b><div class="auth-demo-row">' +
        demoUsers.map(function (u) {
          var pw = u.username === 'admin' ? 'admin123' : (u.username === 'hesabdar' ? 'hesab123' : 'mohandes123');
          return '<button type="button" class="auth-demo-btn" data-act="auth-demo" data-user="' + esc(u.username) + '" data-pass="' + pw + '">' +
            esc(u.name) + '<small>' + esc(u.username) + '</small></button>';
        }).join('') + '</div></div>' : '') +
      '<div class="auth-links">' +
      '<span class="auth-link" data-act="auth-reset">بازنشانی این مرورگر</span><span class="auth-dot">·</span>' +
      (hasUsers ? '<span class="auth-link" data-act="auth-setup">راه‌اندازی اولیه سیستم</span>' : '<span class="auth-link" data-act="auth-seed">ساخت حساب‌های نمایشی</span>') +
      '</div>' +
      '<div class="auth-foot"><span>MECADES ADMIN SYSTEM</span><span class="auth-ver" data-ver>v.' + esc(S.version()) + '</span></div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
    var f = document.getElementById('authForm');
    f.addEventListener('submit', function (e) { e.preventDefault(); submitAuth(); });
    document.getElementById('authTogglePass').addEventListener('click', function () {
      var p = document.getElementById('authPass');
      p.type = p.type === 'password' ? 'text' : 'password';
      this.classList.toggle('on', p.type === 'text');
    });
    var uf = document.getElementById('authUser');
    if (uf && !isFirst) uf.focus();
    if (isFirst) { var pEl = document.getElementById('authPass'); if (pEl) pEl.focus(); }
    updateVersion();
  }
  function hideAuth() {
    var l = document.getElementById('authLayer'); if (l) l.remove();
    document.body.style.overflow = '';
  }
  function authError(msg) {
    var e = document.getElementById('authError');
    if (!e) return;
    e.textContent = msg || '';
    e.classList.toggle('show', !!msg);
  }
  function submitAuth() {
    var user = document.getElementById('authUser').value.trim();
    var pass = document.getElementById('authPass').value;
    var btn = document.getElementById('authSubmit');
    authError('');
    if (AUTH_MODE === 'setup') {
      var first = document.getElementById('authFirst').value.trim();
      var last = document.getElementById('authLast').value.trim();
      var conf = document.getElementById('authConfirm').value;
      if (!first || !last) { authError('نام و نام خانوادگی را وارد کنید'); return; }
      if (pass !== conf) { authError('رمز عبور و تکرار آن یکسان نیست'); return; }
      btn.disabled = true;
      Auth.create({ firstName: first, lastName: last, username: user, password: pass, role: 'admin' })
        .then(function (u) { S.touch(); Auth.login(user, pass, true); afterLogin(u); })
        .catch(function (err) { authError(err.message || 'خطا در ساخت حساب'); btn.disabled = false; });
      return;
    }
    if (AUTH_MODE === 'first') {
      var conf2 = document.getElementById('authConfirm').value;
      if (!user) { authError('نام کاربری را وارد کنید'); return; }
      if (pass.length < 4) { authError('رمز عبور باید حداقل ۴ کاراکتر باشد'); return; }
      if (pass !== conf2) { authError('رمز عبور و تکرار آن یکسان نیست'); return; }
      btn.disabled = true;
      Auth.firstLogin(user, pass).then(function (r) {
        if (!r.ok) { authError(r.error); btn.disabled = false; return; }
        S.touch();
        afterLogin(r.user);
      });
      return;
    }
    if (!user || !pass) { authError('نام کاربری و رمز عبور را وارد کنید'); return; }
    btn.disabled = true;
    Auth.login(user, pass, true).then(function (r) {
      if (!r.ok) {
        /* حسابی که مدیر ساخته و رمزی نداده → ورود با تعیین رمز در اولین بار */
        if (r.needsPassword) { btn.disabled = false; AUTH_USER = user; showAuth('first'); return; }
        authError(r.error); btn.disabled = false; return;
      }
      afterLogin(r.user);
    });
  }
  function afterLogin(u) {
    hideAuth();
    applyUser(u);
    S.log('ورود کاربر ' + u.name + ' به سیستم', 'done');
    if (u.mustChange) forcePasswordChange(u);
    render();
  }
  function forcePasswordChange(u) {
    openModal('<div class="modal-head"><h3>تغییر رمز عبور</h3></div>' +
      '<div class="modal-body"><p class="small muted" style="line-height:2;margin-bottom:14px">این حساب با رمز پیش‌فرض وارد شده است. برای ادامه، یک رمز عبور دلخواه انتخاب کنید.</p>' +
      '<form data-form="force-pass" data-id="' + u.id + '"><div class="grid2">' +
      fld('رمز عبور جدید', '<input type="password" name="pwd1" required autocomplete="new-password">') +
      fld('تکرار رمز عبور', '<input type="password" name="pwd2" required autocomplete="new-password">') +
      '</div><div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره و ادامه</button></div>' +
      '</form></div>');
  }

  /* ================= views ================= */
  var views = {};

  /* ---------- همگام‌سازی اختیاری با Google Sheets (Apps Script) ---------- */
  /* آدرس Web App دیپلوی‌شدهٔ همین شیت (پیش‌فرضِ آماده) */
  var DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwElZff8nLb9dw2kSBmplkD9xtpO01XEOWOMpRHb_YQzVqRXj-b21_VQ7o5RFtYJby1rQ/exec';
  var GAS_KEY = 'mecades_gas_webapp';
  var GAS_TOKEN_KEY = 'mecades_gas_token';
  var GAS_LAST_KEY = 'mecades_gas_last';
  function gasConfig() {
    var url = null, token = '', last = null;
    try { url = localStorage.getItem(GAS_KEY); } catch (e) { url = null; }
    if (url === null || url === undefined) url = DEFAULT_GAS_URL;   /* پیش‌فرض آماده */
    try { token = localStorage.getItem(GAS_TOKEN_KEY) || ''; } catch (e) {}
    try { last = JSON.parse(localStorage.getItem(GAS_LAST_KEY) || 'null'); } catch (e) { last = null; }
    return { url: url, token: token, last: last, isDefault: url === DEFAULT_GAS_URL };
  }
  function gasSet(url, token) {
    try {
      if (url === null) localStorage.removeItem(GAS_KEY); else localStorage.setItem(GAS_KEY, url);
      if (token === null) localStorage.removeItem(GAS_TOKEN_KEY); else localStorage.setItem(GAS_TOKEN_KEY, token);
    } catch (e) {}
  }
  function gasPayload() {
    var cfg = gasConfig();
    return JSON.stringify({
      app: 'MECADES', kind: 'sync', v: 1, token: cfg.token,
      at: Date.now(), users: Auth.users(), data: S.state
    });
  }
  function gasBusy(btn, on) {
    if (!btn) return;
    if (on) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = 'در حال ارسال…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  /** ارسال واقعی: اول با CORS تا پاسخ JSON خوانده شود؛ اگر مرورگر اجازه نداد، no-cors */
  function gasSend(btn) {
    var cfg = gasConfig();
    if (!cfg.url) { gasGuideModal(); return; }
    var body = gasPayload();
    var kb = Math.round(body.length / 1024);
    gasBusy(btn, true);

    function succeed(summary, verified) {
      gasBusy(btn, false);
      var stamp = { at: Date.now(), kb: kb, orders: S.state.orders.length,
        verified: !!verified, summary: summary || null };
      try { localStorage.setItem(GAS_LAST_KEY, JSON.stringify(stamp)); } catch (e) {}
      if (summary) {
        toast('ذخیره شد: ' + S.fa(summary.orders) + ' سفارش، ' + S.fa(summary.customers) + ' مشتری، ' +
          S.fa(summary.payments) + ' پرداخت، ' + S.fa(summary.sessions) + ' ساعت‌کار', 'ok');
      } else {
        toast('بکاپ (' + S.fa(kb) + ' کیلوبایت) به Google Sheets فرستاده شد — تأیید سرور خوانده نشد', 'ok');
      }
      render();
    }
    function fail(msg) {
      gasBusy(btn, false);
      toast(msg || 'ارسال انجام نشد — آدرس Web App را بررسی کنید');
    }
    function noCors(lastErr) {
      try {
        fetch(cfg.url, {
          method: 'POST', mode: 'no-cors', cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body
        }).then(function () { succeed(null, false); })
          .catch(function (err) {
            fail('اتصال برقرار نشد: ' + ((err && err.message) || (lastErr && lastErr.message) || 'خطای شبکه') +
              ' — «Who has access» باید Anyone باشد');
          });
      } catch (e) { fail('مرورگر اجازهٔ ارسال نداد'); }
    }

    try {
      fetch(cfg.url, {
        method: 'POST', cache: 'no-store', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body
      }).then(function (res) { return res.text(); })
        .then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { j = null; }
          if (j && j.ok) return succeed(j.summary, true);
          if (j && j.error) return fail('Google Sheets: ' + j.error);
          noCors(null);          /* پاسخ خوانا نبود؛ با no-cors دوباره بفرست */
        })
        .catch(function (err) { noCors(err); });
    } catch (e) { noCors(e); }
  }
  /** تست اتصال: GET ?ping=1 (پاسخ JSON با CORS باز است) */
  function gasPing(btn) {
    var cfg = gasConfig();
    if (!cfg.url) { gasGuideModal(); return; }
    gasBusy(btn, true);
    var url = cfg.url + (cfg.url.indexOf('?') > -1 ? '&' : '?') + 'ping=1';
    var t0 = Date.now();
    fetch(url, { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        gasBusy(btn, false);
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { j = null; }
        if (j && j.ok) {
          toast('اتصال برقرار است ✓ اسکریپت ' + (j.script || '?') + ' · ' + S.fa(j.sheets || 0) +
            ' شیت · ' + S.fa(Date.now() - t0) + ' میلی‌ثانیه', 'ok');
        } else if (j && j.error) {
          toast('Google Sheets: ' + j.error);
        } else {
          toast('پاسخ سرور قابل خواندن نبود — احتمالاً «Who has access» روی Anyone نیست');
        }
      })
      .catch(function () { gasBusy(btn, false); toast('اتصال برقرار نشد — آدرس /exec را بررسی کنید یا دسترسی را Anyone کنید'); });
  }
  function gasGuideModal() {
    openModal('<div class="modal-head"><h3>همگام‌سازی با Google Sheets</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' +
      '<p class="small muted" style="line-height:2;margin-bottom:10px">یک بار اسکریپت آمادهٔ <code>google-apps-script/Code.gs</code> را داخل همان Google Sheet نصب کنید؛ بعد از آن، هر بار با یک دکمه همهٔ داده‌ها در شیت‌های مرتب ذخیره می‌شود.</p>' +
      '<ol class="gas-steps">' +
      '<li>Google Sheet خود را باز کنید ← منوی <b>Extensions</b> ← <b>Apps Script</b>.</li>' +
      '<li>محتوای فایل <code>Code.gs</code> را جای کد نمونه بچسبانید و ذخیره کنید.</li>' +
      '<li>در Apps Script: <b>Deploy</b> ← <b>New deployment</b> ← نوع <b>Web app</b> ← ' +
        '<i>Execute as: Me</i> و <i>Who has access: Anyone</i> ← <b>Deploy</b>.</li>' +
      '<li>آدرس <code>…/exec</code> را کپی کنید و همین‌جا در فیلد «آدرس Web App» بگذارید.</li>' +
      '<li>در شیت، منوی <b>بکاپ مکادیز</b> ← <b>درباره</b> را بزنید تا «توکن اتصال» ساخته و نمایش داده شود؛ آن را هم اینجا وارد کنید.</li>' +
      '</ol>' +
      '<div class="hint-box" style="margin-top:10px">' + icon('shield') +
        '<span>هیچ داده‌ای خودکار ارسال نمی‌شود؛ فقط با زدن دکمهٔ «ارسال به Google Sheets». اگر آدرس را پاک کنید، پنل کاملاً آفلاین می‌ماند.</span></div>' +
      '<div class="small muted" style="margin-top:8px;line-height:1.9">' +
        'آدرس <b>/exec</b> شیت شما از قبل تنظیم شده است؛ کافی است «تست اتصال» را بزنید. ' +
        'اولین ارسال ممکن است تا یک دقیقه طول بکشد (ساخت ۱۴ شیت + نوشتن داده). ' +
        'اگر در شیت منوی «درباره» را باز کرده‌اید، توکن ساخته می‌شود و باید آن را هم اینجا وارد کنید.</div>' +
      '<div class="row-flex" style="margin-top:12px"><button class="btn btn-line" type="button" data-act="close-modal">بستن</button></div>' +
      '</div>', true);
  }

  /* ---------- Dashboard ---------- */
  views.dashboard = function () {
    var st = S.state;
    var now = new Date(), jn = S.jalaliNow();
    var thisMonth = S.monthKey(now.getTime());
    var active = st.orders.filter(function (o) { return ['new', 'quote', 'design', 'client', 'sample'].indexOf(o.status) > -1; });
    var monthOrders = st.orders.filter(function (o) { return S.monthKey(o.created) === thisMonth; });
    var revenue = monthOrders.reduce(function (a, o) { return a + o.quote; }, 0);
    var hours = monthOrders.reduce(function (a, o) { return a + o.hours; }, 0);
    var paidAll = st.payments.reduce(function (a, p) { return a + p.amount; }, 0);
    var due = st.orders.filter(function (o) { return o.status !== 'done' && o.status !== 'cancel'; })
      .reduce(function (a, o) { return a + S.orderDue(o); }, 0);
    var overdue = st.orders.filter(function (o) { return o.status !== 'done' && o.status !== 'cancel' && o.deadline < Date.now() && S.orderDue(o) > 0; }).length;
    var dn = donut();
    var upcoming = st.orders.filter(function (o) { return ['new', 'quote', 'design', 'client', 'sample'].indexOf(o.status) > -1; })
      .sort(function (a, b) { return a.deadline - b.deadline; }).slice(0, 6);
    var recent = st.orders.slice().sort(function (a, b) { return b.created - a.created; }).slice(0, 6);

    var me = Auth.current();
    var greetName = (me && (me.firstName || me.name)) || st.settings.owner;
    var quote = window.QUOTES ? QUOTES.pick(me ? me.id : 'guest', Date.now()) : { text: '', author: '' };
    var html = '';
    html += '<section class="hero fade-in"><div class="hero-in">' +
      '<div><h2>سلام، ' + esc(greetName) + ' 👋</h2>' +
      (quote.text ? '<p class="hero-quote" id="heroQuote">' + icon('star') + '<span>' + esc(quote.text) + '</span>' +
        (quote.author ? '<i class="q-by" title="گویندهٔ این جمله">' + esc(quote.author) + '</i>' : '') + '</p>' : '') +
      '<div class="hero-cta">' +
      '<a class="btn btn-white" href="#/orders/new">' + icon('plus') + ' ثبت سفارش جدید</a>' +
      timeIconBtn() +
      '</div></div>' +
      '<div class="hero-side">' +
      '<div class="hero-clock"><div class="t" data-clock-time>--:--</div><div class="d" data-clock-date>—</div></div>' +
      '</div>' +
      '</div></section>';

    /* کارت‌های همهٔ بخش‌های منو، درست زیر نوار خوش‌آمد */
    html += '<div class="mod-wrap">' + moduleCards() + '</div>';
    /* در چیدمان کناری (حالت قبلی) به‌جای کارت‌ها، نوار خلاصهٔ اعداد */
    html += kpiStrip(revenue, hours, due, overdue, st.orders.filter(function (o) { return o.status === 'new'; }).length);

    html += '<div class="dash-grid">';
    /* chart */
    html += '<div class="card span2"><div class="card-head"><div><h3>درآمد و ساعات کارکرد</h3><p>مجموع ارزش سفارش‌های ثبت‌شده در ۸ ماه اخیر</p></div><div class="spacer"></div>' +
      '<a class="btn btn-line btn-sm" href="#/reports">' + icon('chart') + ' گزارش کامل</a></div>' +
      '<div class="card-body">' + revenueChart() + '</div></div>';

    /* donut */
    html += '<div class="card"><div class="card-head"><div><h3>ترکیب خدمات</h3><p>سهم هر خدمت از درآمد کل</p></div></div>' +
      '<div class="card-body"><div class="donut-wrap">' + dn.svg +
      '<div class="donut-legend">' + dn.items.map(function (it) {
        return '<div><i style="background:' + it.color + '"></i>' + esc(it.name) + '<b>' + S.fa(Math.round(it.value / dn.total * 100)) + '٪</b></div>';
      }).join('') + '</div></div></div></div>';

    /* recent orders */
    html += '<div class="card span2"><div class="card-head"><div><h3>آخرین سفارش‌ها</h3><p>جدیدترین پروژه‌های ثبت‌شده</p></div><div class="spacer"></div>' +
      '<a class="btn btn-line btn-sm" href="#/orders">' + icon('chevronL') + ' همه سفارش‌ها</a></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>کد</th><th>سفارش</th><th>مشتری</th><th>خدمت</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>';
    if (!recent.length) html += '<tr><td colspan="6">' + emptyBox('سفارشی ثبت نشده', 'اولین سفارش را ثبت کنید', 'orders') + '</td></tr>';
    recent.forEach(function (o) {
      html += '<tr class="clickable" data-act="open-order" data-id="' + o.id + '">' +
        '<td><span class="num">' + esc(o.code) + '</span></td>' +
        '<td class="wrap">' + esc(o.title) + '</td>' +
        '<td>' + esc(S.customerName(o.customerId)) + '</td>' +
        '<td>' + esc(S.serviceName(o.serviceId)) + '</td>' +
        '<td><span class="amt">' + money(o.quote) + '</span></td>' +
        '<td>' + statusBadge(o.status) + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';

    /* activity + deadlines */
    html += '<div class="card"><div class="card-head"><div><h3>سررسیدهای نزدیک</h3><p>سفارش‌های باز با نزدیک‌ترین موعد</p></div></div><div class="card-body">';
    if (!upcoming.length) html += emptyBox('سفارش بازی وجود ندارد', 'همه‌چیز به‌روز است', 'check');
    else html += '<div class="mini-list">' + upcoming.map(function (o) {
      return '<div class="mini-item" data-act="open-order" data-id="' + o.id + '" style="cursor:pointer">' +
        '<div class="ic">' + icon(S.STATUS[o.status].icon) + '</div>' +
        '<div style="min-width:0;flex:1"><b>' + esc(o.title) + '</b><small>' + esc(S.customerName(o.customerId)) + ' · ' + S.faDateShort(o.deadline) + '</small></div>' +
        deadlineTag(o.deadline) + '</div>';
    }).join('') + '</div>';
    html += '</div></div>';

    html += '<div class="card"><div class="card-head"><div><h3>فعالیت‌های اخیر</h3><p>گزارش لحظه‌ای فعالیت‌ها</p></div></div><div class="card-body">';
    var acts = st.activity.slice(0, 7);
    if (!acts.length) html += emptyBox('فعالیتی ثبت نشده', '', 'pulse');
    else html += '<div class="timeline">' + acts.map(function (a) {
      return '<div class="tl-item' + (a.type === 'done' ? ' hot' : '') + '"><b>' + esc(a.text) + '</b><p>' + S.relTime(a.ts) + '</p></div>';
    }).join('') + '</div>';
    html += '</div></div>';

    html += '</div>';
    return html;
  };

  /* ---------- Orders list ---------- */
  views.orders = function () {
    var st = S.state;
    var q = (window.__filters && window.__filters.orders) || {};
    var list = st.orders.slice();
    if (q.s) list = list.filter(function (o) { return o.status === q.s; });
    if (q.svc) list = list.filter(function (o) { return o.serviceId === q.svc; });
    if (q.sr) list = list.filter(function (o) { return o.source === q.sr; });
    if (q.text) {
      var t = q.text.toLowerCase();
      list = list.filter(function (o) {
        return (o.title + ' ' + o.code + ' ' + S.customerName(o.customerId) + ' ' + S.serviceName(o.serviceId)).toLowerCase().indexOf(t) > -1;
      });
    }
    var sort = q.sort || 'new';
    list.sort(function (a, b) {
      if (sort === 'due') return a.deadline - b.deadline;
      if (sort === 'amount') return b.quote - a.quote;
      if (sort === 'deadline') return S.orderDue(b) - S.orderDue(a);
      return b.created - a.created;
    });
    var total = list.reduce(function (a, o) { return a + o.quote; }, 0);

    var html = '<div class="page-head"><div><h2>مدیریت سفارش‌ها</h2>' +
      '<p>سفارش‌های ثبت‌شده مکادیز؛ از ثبت اولیه تا تحویل نقشه و فایل سه‌بعدی.</p></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-line btn-sm" data-act="csv-orders" data-perm="data.export">' + icon('download') + ' خروجی CSV</button>' +
      '<a class="btn btn-red" href="#/orders/new">' + icon('plus') + ' سفارش جدید</a></div>';

    html += '<div class="toolbar">' +
      '<div class="search-box grow" style="max-width:320px"><span>' + icon('search') + '</span>' +
      '<input class="inp" id="ofilter" placeholder="جستجوی سفارش، مشتری یا کد…" value="' + esc(q.text || '') + '" data-filter="orders.text"></div>' +
      '<select class="inp" data-filter="orders.s"><option value="">همه وضعیت‌ها</option>' +
      Object.keys(S.STATUS).map(function (k) { return '<option value="' + k + '"' + (q.s === k ? ' selected' : '') + '>' + S.STATUS[k].label + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-filter="orders.svc"><option value="">همه خدمات</option>' +
      st.services.map(function (s) { return '<option value="' + s.id + '"' + (q.svc === s.id ? ' selected' : '') + '>' + esc(s.short || s.name) + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-filter="orders.sr"><option value="">همه منابع</option>' +
      Object.keys(S.SOURCES).map(function (k) { return '<option value="' + k + '"' + (q.sr === k ? ' selected' : '') + '>' + S.SOURCES[k] + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-filter="orders.sort">' +
      [['new', 'جدیدترین'], ['due', 'نزدیک‌ترین موعد'], ['amount', 'بیشترین مبلغ'], ['deadline', 'بیشترین مانده']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '</div>';

    html += '<div class="card"><div class="card-head"><div><h3>' + S.fa(list.length) + ' سفارش</h3><p>مجموع ارزش سفارش‌های این فهرست: <b>' + money(total) + '</b></p></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>کد سفارش</th><th>سفارش</th><th>مشتری</th><th>مبلغ</th><th>پرداختی / مانده</th><th>موعد</th><th>وضعیت</th><th class="sticky-col">عملیات</th>' +
      '</tr></thead><tbody>';
    if (!list.length) html += '<tr><td colspan="8">' + emptyBox('سفارشی یافت نشد', 'فیلترها را تغییر دهید یا سفارش جدیدی ثبت کنید', 'search') + '</td></tr>';
    list.forEach(function (o) {
      var paid = S.orderPaid(o), due = Math.max(0, o.quote - paid);
      html += '<tr class="clickable" data-act="open-order" data-id="' + o.id + '">' +
        '<td><span class="num">' + esc(o.code) + '</span></td>' +
        '<td class="wrap" style="max-width:195px"><b>' + esc(o.title) + '</b>' +
        '<div class="small muted">' + esc(S.serviceName(o.serviceId)) + '</div>' +
        '<div class="row-flex" style="gap:5px;margin-top:4px">' + srcTag(o.source) + prioTag(o.priority) + (o.quick ? '<span class="tag">ثبت سریع</span>' : '') + '</div></td>' +
        '<td class="wrap">' + esc(S.customerName(o.customerId)) + '<div class="small muted">' + esc((S.customer(o.customerId) || {}).company || '') + '</div></td>' +
        '<td><span class="amt">' + money(o.quote) + '</span><div class="small muted">' + S.fa(o.hours) + ' ساعت</div></td>' +
        '<td><span class="amt">' + money(paid) + '</span>' +
        (due > 0 ? '<div class="small" style="color:var(--accent-text);font-weight:700">مانده ' + money(due) + '</div>' : '<div class="small" style="color:#2c6b3c">تسویه</div>') + '</td>' +
        '<td>' + deadlineTag(o.deadline) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td class="sticky-col"><div class="act" style="gap:4px">' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="open-order" data-id="' + o.id + '" title="مشاهده">' + icon('eye') + '</button>' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="pay" data-id="' + o.id + '" data-perm="payment.create" title="ثبت پرداختی">' + icon('wallet') + '</button>' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="invoice" data-id="' + o.id + '" title="پیش‌فاکتور">' + icon('printer') + '</button>' +
        '</div></td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  };

  /* ---------- Order detail ---------- */
  views.order = function (id) {
    var o = S.order(id);
    if (!o) return '<div class="card"><div class="card-body">' + emptyBox('سفارش یافت نشد', 'شاید حذف شده باشد', 'x') + '</div></div>' +
      '<p style="margin-top:14px"><a class="btn btn-line" href="#/orders">' + icon('chevronR') + ' بازگشت به لیست</a></p>';
    var c = S.customer(o.customerId) || {};
    var svc = S.service(o.serviceId) || {};
    var paid = S.orderPaid(o), due = Math.max(0, o.quote - paid);
    var payList = S.state.payments.filter(function (p) { return p.orderCode === o.code; });

    var html = '<div class="page-head"><div>' +
      '<a href="#/orders" class="link small">' + icon('chevronR') + ' بازگشت به سفارش‌ها</a>' +
      '<h2 style="margin-top:6px">' + esc(o.title) + '</h2>' +
      '<p><span class="num">' + esc(o.code) + '</span> · ' + esc(svc.name) + ' · ثبت‌شده ' + S.relTime(o.created) + '</p></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-line btn-sm" data-act="invoice" data-id="' + o.id + '">' + icon('printer') + ' پیش‌فاکتور</button>' +
      '<button class="btn btn-navy btn-sm" data-act="pay" data-id="' + o.id + '" data-perm="payment.create">' + icon('wallet') + ' ثبت پرداختی</button>' +
      '<a class="btn btn-red btn-sm" href="#/orders/new">' + icon('plus') + ' سفارش جدید</a></div>';

    /* stage stepper */
    var cur = S.STATUS[o.status].step;
    html += '<div class="card" style="margin-bottom:18px"><div class="card-body"><div class="stepper">' +
      S.STEPS.map(function (stp, i) {
        var cls = i < cur ? 'done' : (i === cur ? 'current' : '');
        return '<div class="step ' + cls + '"><div class="dot">' + (i < cur ? icon('check') : S.fa(i + 1)) + '</div><small>' + esc(stp.label) + '</small></div>';
      }).join('') + '</div>' +
      '<div class="divider"></div>' +
      '<div class="row-flex"><span class="muted small">تغییر وضعیت:</span>' +
      Object.keys(S.STATUS).map(function (k) {
        return '<button class="btn btn-sm ' + (o.status === k ? 'btn-navy' : 'btn-line') + '" data-act="set-status" data-id="' + o.id + '" data-status="' + k + '" data-perm="order.edit">' + esc(S.STATUS[k].label) + '</button>';
      }).join('') + '</div></div></div>';

    html += '<div class="detail-grid"><div>';
    /* info */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>اطلاعات سفارش</h3><p>مشخصات پروژه و وضعیت مالی</p></div></div><div class="card-body">' +
      '<div class="kv">' +
      kvBox('مشتری', esc(S.customerName(o.customerId)) + (c.company ? '<div class="small muted">' + esc(c.company) + '</div>' : '')) +
      kvBox('شماره تماس', esc(c.phone || '—')) +
      kvBox('خدمت', esc(svc.name || '—')) +
      kvBox('منبع ثبت', esc(S.SOURCES[o.source] || '—')) +
      kvBox('ساعات برآوردی', S.fa(o.hours) + ' ساعت') +
      kvBox('نرخ ساعتی', money(o.rate) + ' / ساعت') +
      kvBox('مبلغ کل', '<span class="money">' + money(o.quote) + '</span>') +
      kvBox('پرداختی / مانده', '<span class="money">' + money(paid) + '</span> / <span class="money" style="color:var(--accent-text)">' + money(due) + '</span>') +
      kvBox('موعد تحویل', S.faDate(o.deadline)) +
      kvBox('اولویت', S.PRIORITY[o.priority] || 'عادی') +
      '</div>' +
      (o.desc ? '<div class="divider"></div><div><b class="small">توضیحات سفارش</b><p class="small muted" style="line-height:2;margin-top:6px;white-space:pre-line">' + esc(o.desc) + '</p></div>' : '') +
      (o.files && o.files.length ? '<div class="divider"></div><div><b class="small">فایل‌های پیوست</b><div class="row-flex" style="margin-top:8px">' +
        o.files.map(function (f) { return '<span class="tag">' + icon('file') + ' ' + esc(f) + '</span>'; }).join('') + '</div></div>' : '') +
      '</div></div>';

    /* payments */
    html += '<div class="card"><div class="card-head"><div><h3>پرداختی‌ها</h3><p>سوابق مالی این سفارش</p></div><div class="spacer"></div>' +
      '<button class="btn btn-line btn-sm" data-act="pay" data-id="' + o.id + '" data-perm="payment.create">' + icon('plus') + ' پرداختی</button></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>مبلغ</th><th>روش</th><th>توضیحات</th></tr></thead><tbody>';
    if (!payList.length) html += '<tr><td colspan="4">' + emptyBox('پرداختی ثبت نشده', 'هنوز دریافتی برای این سفارش ثبت نشده است', 'wallet') + '</td></tr>';
    payList.forEach(function (p) {
      html += '<tr><td>' + S.faDate(p.date) + '</td><td><span class="amt">' + money(p.amount) + '</span></td>' +
        '<td>' + esc(p.method) + '</td><td class="wrap muted">' + esc(p.note || '') + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';

    html += '</div><div>';

    /* summary card */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>خلاصه مالی</h3></div></div><div class="card-body">' +
      '<div class="row-flex" style="justify-content:space-between;padding:7px 0"><span class="muted small">مبلغ کل</span><b>' + money(o.quote) + '</b></div>' +
      '<div class="row-flex" style="justify-content:space-between;padding:7px 0"><span class="muted small">دریافت‌شده</span><b style="color:#2c6b3c">' + money(paid) + '</b></div>' +
      '<div class="row-flex" style="justify-content:space-between;padding:7px 0"><span class="muted small">مانده</span><b style="color:var(--accent-text)">' + money(due) + '</b></div>' +
      '<div class="prog ' + (paid / (o.quote || 1) > .6 ? '' : 'red') + '" style="margin-top:12px"><i style="width:' + Math.min(100, Math.round(paid / (o.quote || 1) * 100)) + '%"></i></div>' +
      '<div class="small muted" style="margin-top:8px">' + S.fa(Math.round(paid / (o.quote || 1) * 100)) + '٪ تسویه شده</div>' +
      '</div></div>';

    /* actions */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>عملیات</h3></div></div><div class="card-body"><div class="quick-grid" style="grid-template-columns:1fr">' +
      '<button class="quick" data-act="invoice" data-id="' + o.id + '"><span class="ic">' + icon('printer') + '</span><span><b>مشاهده و چاپ پیش‌فاکتور</b><small>سفارش ' + esc(o.code) + '</small></span></button>' +
      '<button class="quick" data-act="edit-order" data-id="' + o.id + '" data-perm="order.edit"><span class="ic">' + icon('edit') + '</span><span><b>ویرایش سفارش</b><small>مشخصات، ساعات و موعد</small></span></button>' +
      '<a class="quick" href="#/customers/' + o.customerId + '"><span class="ic">' + icon('users') + '</span><span><b>پرونده مشتری</b><small>' + esc(S.customerName(o.customerId)) + '</small></span></a>' +
      '<button class="quick" data-act="del-order" data-id="' + o.id + '" data-perm="order.delete"><span class="ic" style="color:var(--red)">' + icon('trash') + '</span><span><b>حذف سفارش</b><small>این عملیات قابل بازگشت نیست</small></span></button>' +
      '</div></div></div>';

    /* timeline */
    html += '<div class="card"><div class="card-head"><div><h3>تاریخچه</h3></div></div><div class="card-body"><div class="timeline">' +
      '<div class="tl-item hot"><b>آخرین بروزرسانی</b><p>' + S.relTime(o.updated) + ' · وضعیت: ' + S.STATUS[o.status].label + '</p></div>' +
      '<div class="tl-item"><b>ثبت سفارش</b><p>' + S.faDateTime(o.created) + ' · از ' + esc(S.SOURCES[o.source] || '—') + '</p></div>' +
      payList.map(function (p) {
        return '<div class="tl-item"><b>دریافت ' + money(p.amount) + '</b><p>' + S.faDate(p.date) + ' · ' + esc(p.method) + '</p></div>';
      }).join('') +
      '<div class="tl-item"><b>موعد تحویل</b><p>' + S.faDate(o.deadline) + (o.deadline < Date.now() && o.status !== 'done' ? ' (گذشته)' : '') + '</p></div>' +
      '</div></div></div>';

    html += '</div></div>';
    return html;
  };
  function kvBox(l, v) { return '<div class="box"><small>' + esc(l) + '</small><b>' + v + '</b></div>'; }

  /* ---------- New order ---------- */
  views['new-order'] = function () {
    var st = S.state;
    var html = '<div class="page-head"><div><h2>ثبت سفارش جدید</h2>' +
      '<p>پروژه جدید را ثبت کنید؛ مبلغ بر اساس ساعات برآوردی و پلکان نرخنامه محاسبه می‌شود.</p></div>' +
      '<div class="spacer"></div><a class="btn btn-line btn-sm" href="#/orders">' + icon('chevronR') + ' بازگشت</a></div>';

    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><h3>مشخصات سفارش</h3><p>موارد ستاره‌دار الزامی است</p></div></div>' +
      '<div class="card-body"><form data-form="new-order"><div class="grid2">' +
      fld('مشتری', '<select name="customerId"><option value="">— انتخاب مشتری ثبت‌شده —</option>' +
        st.customers.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + (c.company ? ' — ' + esc(c.company) : '') + '</option>'; }).join('') +
        '</select><div class="help">اگر مشتری جدید است، نام و شماره تماس را در کادرهای پایین وارد کنید.</div>' +
        '<input name="newCustomerName" placeholder="نام مشتری جدید" style="margin-top:8px">' +
        '<input name="newCustomerPhone" placeholder="شماره تماس مشتری جدید" style="margin-top:8px">') +
      fld('نوع خدمت', '<select name="serviceId" id="f-service" required>' + st.services.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
      }).join('') + '</select>') +
      fld('عنوان سفارش', '<input name="title" required placeholder="مثلاً: طراحی شاسی دستگاه پرکن">') +
      fld('منبع ثبت', '<select name="source">' + Object.keys(S.SOURCES).map(function (k) {
        return '<option value="' + k + '">' + S.SOURCES[k] + '</option>';
      }).join('') + '</select>') +
      fld('ساعات برآوردی', '<input type="number" name="hours" id="f-hours" min="1" value="10" required>') +
      fld('موعد تحویل', '<input type="date" name="deadline" id="f-deadline" required>') +
      fld('اولویت', '<select name="priority"><option value="normal">عادی</option><option value="high">فوری</option><option value="low">کم‌اهمیت</option></select>') +
      fld('مبلغ پیش‌پرداخت (تومان)', '<input type="number" name="paid" id="f-paid" min="0" value="0">') +
      '</div>' +
      fld('توضیحات پروژه', '<textarea name="desc" placeholder="کاربرد قطعه یا دستگاه، ابعاد تقریبی، جنس مورد نظر، روش ساخت مدنظر و…"></textarea>') +
      '<div class="row-flex" style="margin-top:6px"><button type="submit" class="btn btn-red">' + icon('save') + ' ثبت سفارش</button>' +
      '<a class="btn btn-line" href="#/orders">انصراف</a></div>' +
      '</form></div></div>';

    /* live estimator */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>برآورد هزینه</h3><p>بر اساس پلکان نرخنامه</p></div></div><div class="card-body" id="estimator">' +
      estimatorHTML(10) + '</div></div>';
    html += '<div class="card"><div class="card-head"><div><h3>پلکان نرخنامه</h3></div></div><div class="card-body tight"><table class="tbl"><thead><tr><th>ساعات برآوردی</th><th>نرخ ساعتی</th></tr></thead><tbody>' +
      st.tiers.map(function (t) { return '<tr><td>' + esc(t.label) + '</td><td><span class="amt">' + money(t.rate) + '</span></td></tr>'; }).join('') +
      '</tbody></table></div></div>';

    html += '</div></div>';
    return html;
  };
  function fld(label, control) {
    return '<div class="fld"><label>' + esc(label) + '</label>' + control + '</div>';
  }
  function estimatorHTML(hours) {
    var tier = S.tierFor(S.state.tiers, hours);
    var total = Math.max(hours * tier.rate, S.state.settings.minOrder);
    var min = total === S.state.settings.minOrder && hours * tier.rate < S.state.settings.minOrder;
    return '<div class="row-flex" style="justify-content:space-between;padding:6px 0"><span class="muted small">پلکان نرخ</span><b>' + esc(tier.label) + '</b></div>' +
      '<div class="row-flex" style="justify-content:space-between;padding:6px 0"><span class="muted small">نرخ ساعتی</span><b>' + money(tier.rate) + '</b></div>' +
      '<div class="row-flex" style="justify-content:space-between;padding:6px 0"><span class="muted small">ساعات</span><b>' + S.fa(hours) + ' ساعت</b></div>' +
      '<div class="divider"></div>' +
      '<div class="row-flex" style="justify-content:space-between"><span class="b">مبلغ کل</span><b style="font-size:20px;color:var(--accent-text)">' + money(total) + '</b></div>' +
      (min ? '<div class="small muted" style="margin-top:8px">حداقل مبلغ سفارش ' + money(S.state.settings.minOrder) + ' اعمال شد.</div>' : '') +
      '<div class="small muted" style="margin-top:8px">پیش‌پرداخت پیشنهادی: ' + money(Math.round(total * 0.4)) + '</div>';
  }

  /* ---------- Quick orders (channels) ---------- */
  views.quick = function () {
    var st = S.state;
    var counts = {};
    Object.keys(S.SOURCES).forEach(function (k) { counts[k] = 0; });
    st.orders.forEach(function (o) { counts[o.source] = (counts[o.source] || 0) + 1; });
    var list = st.orders.slice().sort(function (a, b) { return b.created - a.created; });

    var html = '<div class="page-head"><div><h2>سفارش‌های سریع و کانال‌های ارتباطی</h2>' +
      '<p>سفارش‌هایی که از فرم سایت، تماس، پیام‌رسان‌ها و معرفی مشتریان ثبت شده‌اند.</p></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-red btn-sm" data-act="open-quick" data-perm="order.create">' + icon('bolt') + ' ثبت سریع سفارش</button></div>';

    var SRC_ICON = { site: 'globe', phone: 'phone', insta: 'star', telegram: 'send', whatsapp: 'inbox', referral: 'users' };
    html += '<div class="kpis kpis-3" style="margin-bottom:20px">' +
      Object.keys(S.SOURCES).map(function (k) {
        return '<div class="kpi"><div class="ic">' + icon(SRC_ICON[k] || 'send') + '</div>' +
          '<small>' + esc(S.SOURCES[k]) + '</small><b>' + S.fa(counts[k] || 0) + '<span class="u">سفارش</span></b></div>';
      }).join('') + '</div>';

    html += '<div class="card"><div class="card-head"><div><h3>همه پیام‌های ثبت‌شده</h3><p>برای ثبت سریع، از دکمه بالا استفاده کنید</p></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>کد</th><th>تاریخ</th><th>منبع</th><th>موضوع</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>';
    list.slice(0, 40).forEach(function (o) {
      html += '<tr class="clickable" data-act="open-order" data-id="' + o.id + '">' +
        '<td><span class="num">' + esc(o.code) + '</span></td>' +
        '<td>' + S.faDateShort(o.created) + '</td>' +
        '<td>' + srcTag(o.source) + '</td>' +
        '<td class="wrap">' + esc(o.title) + '</td>' +
        '<td>' + esc(S.customerName(o.customerId)) + '</td>' +
        '<td><span class="amt">' + money(o.quote) + '</span></td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td><div class="act"><button class="icon-btn" style="width:32px;height:32px" data-act="edit-order" data-id="' + o.id + '" data-perm="order.edit">' + icon('edit') + '</button></div></td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  };

  /* ---------- Customers ---------- */
  views.customers = function () {
    var st = S.state;
    var q = (window.__filters && window.__filters.customers) || {};
    var list = st.customers.filter(function (c) {
      if (!q.text) return true;
      var t = q.text.toLowerCase();
      return (c.name + ' ' + (c.company || '') + ' ' + c.phone).toLowerCase().indexOf(t) > -1;
    });
    var html = '<div class="page-head"><div><h2>مشتریان</h2><p>فهرست مشتریان، سوابق سفارش و وضعیت حساب هر کدام.</p></div>' +
      '<div class="spacer"></div><button class="btn btn-red btn-sm" data-act="new-customer" data-perm="customer.manage">' + icon('plus') + ' افزودن مشتری</button></div>';

    html += '<div class="toolbar"><div class="search-box grow" style="max-width:320px">' + icon('search') +
      '<input class="inp" placeholder="جستجوی نام، شرکت یا تلفن…" value="' + esc(q.text || '') + '" data-filter="customers.text"></div></div>';

    html += '<div class="card"><div class="card-head"><div><h3>' + S.fa(list.length) + ' مشتری</h3></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>نام مشتری</th><th>شرکت</th><th>شماره تماس</th><th>تعداد سفارش</th><th>مجموع خرید</th><th>پرداختی</th><th>مانده</th><th>آخرین سفارش</th><th class="sticky-col"></th></tr></thead><tbody>';
    if (!list.length) html += '<tr><td colspan="9">' + emptyBox('مشتری یافت نشد', 'مشتری جدید اضافه کنید', 'users') + '</td></tr>';
    list.forEach(function (c) {
      var total = S.customerTotal(c.id), paid = S.customerPaid(c.id), due = total - paid;
      var ords = S.customerOrders(c.id);
      var last = ords.length ? Math.max.apply(null, ords.map(function (o) { return o.created; })) : 0;
      html += '<tr class="clickable" data-act="open-customer" data-id="' + c.id + '">' +
        '<td><b>' + esc(c.name) + '</b></td>' +
        '<td>' + esc(c.company || '—') + '</td>' +
        '<td><span class="num">' + esc(c.phone) + '</span></td>' +
        '<td>' + S.fa(ords.length) + '</td>' +
        '<td><span class="amt">' + money(total) + '</span></td>' +
        '<td><span class="amt">' + money(paid) + '</span></td>' +
        '<td>' + (due > 0 ? '<span class="amt" style="color:var(--accent-text)">' + money(due) + '</span>' : '<span class="badge b-done">تسویه</span>') + '</td>' +
        '<td>' + (last ? S.faDateShort(last) : '—') + '</td>' +
        '<td class="sticky-col"><div class="act" style="gap:4px">' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="edit-customer" data-id="' + c.id + '" data-perm="customer.manage">' + icon('edit') + '</button>' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="del-customer" data-id="' + c.id + '" data-perm="customer.manage">' + icon('trash') + '</button>' +
        '</div></td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  };

  /* ---------- Customer file ---------- */
  views.customer = function (id) {
    var c = S.customer(id);
    if (!c) return '<div class="card"><div class="card-body">' + emptyBox('مشتری یافت نشد', '', 'users') + '</div></div>';
    var ords = S.customerOrders(id).sort(function (a, b) { return b.created - a.created; });
    var total = S.customerTotal(id), paid = S.customerPaid(id), due = total - paid;
    var pays = S.state.payments.filter(function (p) { return p.customerId === id; });

    var html = '<div class="page-head"><div>' +
      '<a href="#/customers" class="link small">' + icon('chevronR') + ' بازگشت به مشتریان</a>' +
      '<h2 style="margin-top:6px">' + esc(c.name) + '</h2>' +
      '<p>' + esc(c.company || 'بدون شرکت') + ' · <span class="num">' + esc(c.phone) + '</span>' + (c.email ? ' · ' + esc(c.email) : '') + '</p></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-line btn-sm" data-act="edit-customer" data-id="' + c.id + '" data-perm="customer.manage">' + icon('edit') + ' ویرایش</button>' +
      '<button class="btn btn-navy btn-sm" data-act="customer-pay" data-id="' + c.id + '" data-perm="payment.create">' + icon('wallet') + ' ثبت پرداختی</button></div>';

    html += '<div class="kpis" style="margin-bottom:20px">' +
      kpi('wallet', 'مجموع سفارش‌ها', money(total)) +
      kpi('check', 'مجموع پرداختی', money(paid)) +
      kpi('target', 'مانده بدهی', money(due), due > 0) +
      kpi('orders', 'تعداد سفارش', S.fa(ords.length) + ' پروژه') +
      '</div>';

    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><h3>سفارش‌های این مشتری</h3></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>فاکتور</th><th>تاریخ</th><th>سفارش</th><th>مبلغ</th><th>مانده</th><th>وضعیت</th></tr></thead><tbody>';
    if (!ords.length) html += '<tr><td colspan="6">' + emptyBox('سفارشی ثبت نشده', '', 'orders') + '</td></tr>';
    ords.forEach(function (o) {
      var d = Math.max(0, o.quote - S.orderPaid(o));
      html += '<tr class="clickable" data-act="open-order" data-id="' + o.id + '">' +
        '<td><span class="num">' + esc(o.code) + '</span></td><td>' + S.faDateShort(o.created) + '</td>' +
        '<td class="wrap">' + esc(o.title) + '</td><td><span class="amt">' + money(o.quote) + '</span></td>' +
        '<td>' + (d > 0 ? money(d) : '<span class="badge b-done">تسویه</span>') + '</td><td>' + statusBadge(o.status) + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';

    html += '<div class="card"><div class="card-head"><div><h3>تاریخچه پرداختی‌ها</h3></div></div><div class="card-body tight"><table class="tbl"><thead><tr><th>تاریخ</th><th>مبلغ</th><th>روش</th><th>سفارش</th></tr></thead><tbody>';
    if (!pays.length) html += '<tr><td colspan="4">' + emptyBox('پرداختی ثبت نشده', '', 'wallet') + '</td></tr>';
    pays.forEach(function (p) {
      html += '<tr><td>' + S.faDate(p.date) + '</td><td><span class="amt">' + money(p.amount) + '</span></td><td>' + esc(p.method) + '</td>' +
        '<td><span class="num">' + esc(p.orderCode) + '</span></td></tr>';
    });
    html += '</tbody></table></div></div>';

    html += '</div><div>' +
      '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>اطلاعات تماس</h3></div></div><div class="card-body"><div class="kv" style="grid-template-columns:1fr">' +
      kvBox('شماره تماس', esc(c.phone || '—')) +
      kvBox('ایمیل', esc(c.email || '—')) +
      kvBox('آدرس', esc(c.address || '—')) +
      kvBox('یادداشت', esc(c.note || '—')) +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div><h3>نرخ‌گذاری پیشنهادی</h3></div></div><div class="card-body">' +
      '<div class="small muted">برای این مشتری می‌توانید نرخ ساعتی ویژه اعمال کنید؛ در ویرایش سفارش، مبلغ قابل تغییر است.</div>' +
      '<div class="row-flex" style="margin-top:12px">' + S.state.tiers.map(function (t) {
        return '<span class="tag">' + esc(t.label) + ' — ' + money(t.rate) + '</span>';
      }).join('') + '</div></div></div>' +
      '</div></div>';
    return html;
  };
  /* ---------- Accounting ---------- */
  views.accounting = function () {
    var st = S.state;
    var period = (window.__filters && window.__filters.accounting && window.__filters.accounting.period) || '1M';
    var now = Date.now();
    var from = now - { '1W': 7, '1M': 30, '3M': 90, '1Y': 365, ALL: 99999 }[period] * 86400000;
    var orders = st.orders.filter(function (o) { return o.created >= from; });
    var pays = st.payments.filter(function (p) { return p.date >= from; });
    var sales = orders.reduce(function (a, o) { return a + o.quote; }, 0);
    var income = pays.reduce(function (a, p) { return a + p.amount; }, 0);
    var claims = st.orders.filter(function (o) { return o.status !== 'done' && o.status !== 'cancel' && o.quote - S.orderPaid(o) > 0; });
    var due = claims.reduce(function (a, o) { return a + (o.quote - S.orderPaid(o)); }, 0);

    var html = '<div class="page-head"><div><h2>حسابداری</h2><p>پرتفوی مالی، دریافتی‌ها و مطالبات باز مکادیز.</p></div>' +
      '<div class="spacer"></div><button class="btn btn-line btn-sm" data-act="csv-tx" data-perm="data.export">' + icon('download') + ' خروجی تراکنش‌ها</button></div>';

    html += '<div class="row-flex" style="margin-bottom:18px">' +
      [['1W', '۱ هفته'], ['1M', '۱ ماه'], ['3M', '۳ ماه'], ['1Y', '۱ سال'], ['ALL', 'همه']].map(function (p) {
        return '<button class="btn btn-sm ' + (period === p[0] ? 'btn-navy' : 'btn-line') + '" data-act="acc-period" data-period="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>';

    html += '<div class="kpis" style="margin-bottom:20px">' +
      kpi('chart', 'مجموع فروش ثبت‌شده', money(sales)) +
      kpi('wallet', 'دریافتی‌ها', money(income)) +
      kpi('target', 'مطالبات باقی‌مانده', money(due), due > 0) +
      kpi('orders', 'تعداد سفارش دوره', S.fa(orders.length) + ' سفارش') +
      '</div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>تراکنش‌ها</h3><p>سفارش‌ها و دریافتی‌های بازه انتخابی</p></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>نوع</th><th>مشتری</th><th>شماره سفارش</th><th>مبلغ</th><th>توضیحات</th></tr></thead><tbody>';
    var tx = [];
    orders.forEach(function (o) { tx.push({ ts: o.created, type: 'فروش (سفارش)', cid: o.customerId, code: o.code, amount: o.quote, note: o.title }); });
    pays.forEach(function (p) { tx.push({ ts: p.date, type: 'دریافت', cid: p.customerId, code: p.orderCode, amount: p.amount, note: p.method }); });
    tx.sort(function (a, b) { return b.ts - a.ts; });
    if (!tx.length) html += '<tr><td colspan="6">' + emptyBox('تراکنشی در این بازه نیست', '', 'wallet') + '</td></tr>';
    tx.forEach(function (t) {
      var incomeRow = t.type === 'دریافت';
      html += '<tr><td>' + S.faDate(t.ts) + '</td>' +
        '<td><span class="badge ' + (incomeRow ? 'b-pay' : 'b-new') + '">' + esc(t.type) + '</span></td>' +
        '<td>' + esc(S.customerName(t.cid)) + '</td>' +
        '<td><span class="num">' + esc(t.code) + '</span></td>' +
        '<td><span class="amt" style="color:' + (incomeRow ? '#2c6b3c' : 'var(--text)') + '">' + (incomeRow ? '+' : '') + money(t.amount) + '</span></td>' +
        '<td class="wrap muted">' + esc(t.note || '') + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';

    html += '<div class="grid2">';
    /* receivables */
    html += '<div class="card"><div class="card-head"><div><h3>مطالبات</h3><p>سفارش‌های تسویه‌نشده</p></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>مشتری</th><th>سفارش</th><th>مانده</th><th>عمر</th></tr></thead><tbody>';
    if (!claims.length) html += '<tr><td colspan="4">' + emptyBox('مطالبه‌ای وجود ندارد', 'همه سفارش‌ها تسویه شده‌اند', 'check') + '</td></tr>';
    claims.forEach(function (o) {
      var age = Math.max(0, Math.floor((now - o.created) / 86400000));
      html += '<tr><td>' + esc(S.customerName(o.customerId)) + '</td>' +
        '<td><span class="num">' + esc(o.code) + '</span></td>' +
        '<td><span class="amt" style="color:var(--accent-text)">' + money(o.quote - S.orderPaid(o)) + '</span></td>' +
        '<td>' + (age > 60 ? '<span class="badge b-design">' + S.fa(age) + ' روز</span>' : '<span class="tag">' + S.fa(age) + ' روز</span>') + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';

    /* portfolio */
    html += '<div class="card"><div class="card-head"><div><h3>پرتفوی مشتریان</h3></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>مشتری</th><th>کل سفارش‌ها</th><th>پرداختی‌ها</th><th>بدهی</th></tr></thead><tbody>';
    st.customers.forEach(function (c) {
      var tot = S.customerTotal(c.id), pd = S.customerPaid(c.id);
      if (!tot && !pd) return;
      html += '<tr class="clickable" data-act="open-customer" data-id="' + c.id + '"><td>' + esc(c.name) + '</td>' +
        '<td><span class="amt">' + money(tot) + '</span></td><td><span class="amt">' + money(pd) + '</span></td>' +
        '<td><span class="amt" style="color:var(--accent-text)">' + money(tot - pd) + '</span></td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    html += '</div>';
    return html;
  };

  /* ---------- Services & pricing ---------- */
  views.services = function () {
    var st = S.state;
    var html = '<div class="page-head"><div><h2>خدمات و نرخنامه</h2><p>خدمات قابل ارائه، نرخ ساعتی و پلکان قیمت‌گذاری مکادیز.</p></div>' +
      '<div class="spacer"></div><button class="btn btn-line btn-sm" data-act="add-tier" data-perm="service.manage">' + icon('plus') + ' پلکان نرخ</button></div>';

    html += '<div class="svc-grid-admin" style="margin-bottom:22px">';
    st.services.forEach(function (s) {
      html += '<div class="svc-card">' +
        '<div class="ic" style="background:' + s.color + '">' + icon(s.icon) + '</div>' +
        '<h3>' + esc(s.name) + '</h3><p>' + esc(s.desc) + '</p>' +
        '<div class="row-flex"><span class="tag">' + icon('clock') + ' ' + (s.rate ? money(s.rate) + ' / ساعت' : 'نرخ پلکانی') + '</span>' +
        (s.active ? '<span class="badge b-done">فعال</span>' : '<span class="badge b-cancel">غیرفعال</span>') + '</div>' +
        '<div class="row-flex" style="margin-top:auto;padding-top:6px">' +
        '<button class="btn btn-line btn-sm" data-act="edit-service" data-id="' + s.id + '" data-perm="service.manage">' + icon('edit') + ' ویرایش</button>' +
        '<a class="btn btn-ghost btn-sm" href="#/orders/new">' + icon('plus') + ' سفارش</a></div>' +
        '</div>';
    });
    html += '</div>';

    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><h3>پلکان نرخنامه</h3><p>نرخ ساعتی بر اساس مجموع ساعات برآوردی پروژه</p></div></div>' +
      '<div class="card-body tight"><table class="tbl"><thead><tr><th>ساعات برآوردی</th><th>نرخ ساعتی</th><th>حداقل مبلغ</th><th></th></tr></thead><tbody>';
    st.tiers.forEach(function (t) {
      html += '<tr><td>' + esc(t.label) + '</td><td><span class="amt">' + money(t.rate) + '</span></td>' +
        '<td><span class="amt">' + money(st.settings.minOrder) + '</span></td>' +
        '<td><div class="act"><button class="icon-btn" style="width:32px;height:32px" data-act="edit-tier" data-id="' + t.id + '" data-perm="service.manage">' + icon('edit') + '</button>' +
        '<button class="icon-btn" style="width:32px;height:32px" data-act="del-tier" data-id="' + t.id + '" data-perm="service.manage">' + icon('trash') + '</button></div></td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* calculator */
    html += '<div class="card"><div class="card-head"><div><h3>ماشین‌حساب نرخ</h3><p>برآورد سریع مبلغ سفارش</p></div></div><div class="card-body">' +
      '<div class="fld"><label>ساعات برآوردی</label><input type="number" id="calc-hours" min="1" value="16"></div>' +
      '<div id="calc-out" style="margin-top:12px">' + estimatorHTML(16) + '</div></div></div>';

    html += '</div></div>';
    return html;
  };

  /* ---------- Projects ---------- */
  views.projects = function () {
    var st = S.state;
    var html = '<div class="page-head"><div><h2>نمونه‌کارها</h2><p>پروژه‌های منتشرشده در بخش محصولات سایت mecades.ir.</p></div>' +
      '<div class="spacer"></div><button class="btn btn-red btn-sm" data-act="new-project" data-perm="project.manage">' + icon('plus') + ' نمونه‌کار جدید</button></div>';

    html += '<div class="proj-grid-admin">';
    st.projects.forEach(function (p) {
      html += '<div class="proj-card">' +
        '<div class="thumb ' + p.cls + '">' + projectArt(p.art) + '</div>' +
        '<div class="body"><span class="num">' + esc(p.num) + '</span><h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="tags" style="margin-top:4px">' + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="row-flex" style="margin-top:auto;padding-top:10px">' +
        (p.published ? '<span class="badge b-done">منتشرشده</span>' : '<span class="badge b-cancel">پیش‌نویس</span>') +
        '<div class="spacer" style="margin-inline-start:auto"></div>' +
        '<button class="icon-btn" style="width:32px;height:32px" data-act="edit-project" data-id="' + p.id + '" data-perm="project.manage">' + icon('edit') + '</button>' +
        '<button class="icon-btn" style="width:32px;height:32px" data-act="del-project" data-id="' + p.id + '" data-perm="project.manage">' + icon('trash') + '</button>' +
        '</div></div></div>';
    });
    html += '</div>';
    return html;
  };
  function projectArt(kind) {
    if (kind === 'gauge') return '<svg viewBox="0 0 100 100"><rect x="18" y="26" width="64" height="48" rx="6"/><circle cx="50" cy="50" r="16"/><path d="M50 34v16l11 8M28 80h44"/></svg>';
    if (kind === 'machine') return '<svg viewBox="0 0 100 100"><rect x="14" y="44" width="72" height="30" rx="4"/><path d="M28 44V28h44v16M40 28V16h20v12M50 74v10M20 84h60"/></svg>';
    if (kind === 'clamp') return '<svg viewBox="0 0 100 100"><path d="M20 30h60v18H20zM28 48v22M72 48v22M36 70h28M14 30v-8h72v8"/></svg>';
    if (kind === 'screen') return '<svg viewBox="0 0 100 100"><path d="M18 26h64v40H18zM18 44h64M32 26v40M46 26v40M60 26v40M74 26v40M28 66v12M72 66v12"/></svg>';
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="9"/><path d="M50 26v10M50 64v10M26 50h10M64 50h10M33 33l7 7M60 60l7 7M67 33l-7 7M40 60l-7 7"/></svg>';
  }

  /* ---------- Reports ---------- */
  views.reports = function () {
    var st = S.state;
    var months = monthSeries(8);
    var rows = months.map(function (m) {
      var os = st.orders.filter(function (o) { return S.monthKey(o.created) === m.key; });
      var sales = os.reduce(function (a, o) { return a + o.quote; }, 0);
      var hours = os.reduce(function (a, o) { return a + o.hours; }, 0);
      var done = os.filter(function (o) { return o.status === 'done'; }).length;
      var jj = S.g2j(new Date(m.ts).getFullYear(), new Date(m.ts).getMonth() + 1, new Date(m.ts).getDate());
      return { key: m.key, label: S.MONTHS[jj[1] - 1] + ' ' + S.fa(jj[0]), sales: sales, hours: hours, count: os.length, done: done };
    });
    var totalSales = rows.reduce(function (a, r) { return a + r.sales; }, 0);
    var totalHours = rows.reduce(function (a, r) { return a + r.hours; }, 0);
    var totalCount = rows.reduce(function (a, r) { return a + r.count; }, 0);
    var avg = totalCount ? Math.round(totalSales / totalCount) : 0;

    var bySvc = st.services.map(function (s) {
      var os = st.orders.filter(function (o) { return o.serviceId === s.id; });
      return { s: s, count: os.length, sales: os.reduce(function (a, o) { return a + o.quote; }, 0), hours: os.reduce(function (a, o) { return a + o.hours; }, 0) };
    }).sort(function (a, b) { return b.sales - a.sales; });

    var byClient = st.customers.map(function (c) {
      var os = S.customerOrders(c.id);
      return { c: c, count: os.length, sales: S.customerTotal(c.id), due: S.customerTotal(c.id) - S.customerPaid(c.id) };
    }).filter(function (x) { return x.count > 0; }).sort(function (a, b) { return b.sales - a.sales; }).slice(0, 6);

    var html = '<div class="page-head"><div><h2>گزارش‌ها</h2><p>گزارش فروش، تولید و ترکیب پروژه‌ها در بازه ۸ ماه اخیر.</p></div>' +
      '<div class="spacer"></div><button class="btn btn-line btn-sm" data-act="csv-report" data-perm="data.export">' + icon('download') + ' خروجی گزارش</button></div>';

    html += '<div class="kpis" style="margin-bottom:20px">' +
      kpi('chart', 'فروش کل بازه', money(totalSales)) +
      kpi('clock', 'ساعات کارکرد', S.fa(totalHours) + ' ساعت') +
      kpi('orders', 'تعداد سفارش', S.fa(totalCount) + ' پروژه') +
      kpi('target', 'میانگین هر سفارش', money(avg)) +
      '</div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>روند فروش ماهانه</h3></div></div>' +
      '<div class="card-body">' + revenueChart() + '</div></div>';

    html += '<div class="detail-grid"><div class="card"><div class="card-head"><div><h3>جدول ماهانه</h3></div></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ماه</th><th>تعداد سفارش</th><th>ساعات</th><th>فروش</th><th>تحویل‌شده</th></tr></thead><tbody>' +
      rows.slice().reverse().map(function (r) {
        return '<tr><td>' + esc(r.label) + '</td><td>' + S.fa(r.count) + '</td><td><span class="num">' + S.fa(r.hours) + ' س</span></td>' +
          '<td><span class="amt">' + money(r.sales) + '</span></td><td>' + S.fa(r.done) + '</td></tr>';
      }).join('') + '</tbody></table></div></div></div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>عملکرد خدمات</h3></div></div>' +
      '<div class="card-body tight"><table class="tbl"><thead><tr><th>خدمت</th><th>سفارش</th><th>ساعات</th><th>فروش</th></tr></thead><tbody>' +
      bySvc.map(function (b) {
        return '<tr><td>' + esc(b.s.name) + '</td><td>' + S.fa(b.count) + '</td><td><span class="num">' + S.fa(b.hours) + ' س</span></td>' +
          '<td><span class="amt">' + money(b.sales) + '</span></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    html += '<div class="card"><div class="card-head"><div><h3>مشتریان برتر</h3></div></div>' +
      '<div class="card-body tight"><table class="tbl"><thead><tr><th>مشتری</th><th>سفارش</th><th>فروش</th><th>مانده</th></tr></thead><tbody>' +
      byClient.map(function (b) {
        return '<tr class="clickable" data-act="open-customer" data-id="' + b.c.id + '"><td>' + esc(b.c.name) + '<div class="small muted">' + esc(b.c.company || '') + '</div></td>' +
          '<td>' + S.fa(b.count) + '</td><td><span class="amt">' + money(b.sales) + '</span></td>' +
          '<td><span class="amt" style="color:var(--accent-text)">' + money(b.due) + '</span></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    html += '</div></div>';
    return html;
  };

  /* ---------- Settings ---------- */
  views.settings = function () {
    var st = S.state, s = st.settings;
    var html = '<div class="page-head"><div><h2>تنظیمات</h2><p>اطلاعات مجموعه، نرخ‌ها و مدیریت داده‌های پنل.</p></div></div>';

    html += '<div class="set-grid"><div class="card"><div class="card-head"><div><h3>اطلاعات مجموعه</h3><p>روی پیش‌فاکتور و پنل نمایش داده می‌شود</p></div></div>' +
      '<div class="card-body"><form data-form="settings"><div class="grid2">' +
      fld('نام مجموعه', '<input name="company" value="' + esc(s.company) + '">') +
      fld('عنوان کامل', '<input name="legalName" value="' + esc(s.legalName) + '">') +
      fld('تلفن اول', '<input name="phone1" value="' + esc(s.phone1) + '">') +
      fld('تلفن دوم', '<input name="phone2" value="' + esc(s.phone2) + '">') +
      fld('ایمیل', '<input name="email" value="' + esc(s.email) + '">') +
      fld('آدرس', '<input name="address" value="' + esc(s.address) + '">') +
      fld('حداقل مبلغ سفارش (تومان)', '<input type="number" name="minOrder" value="' + S.en(s.minOrder) + '">') +
      fld('پیشوند کد سفارش', '<input name="invoicePrefix" value="' + esc(s.invoicePrefix) + '">') +
      fld('نام مدیر', '<input name="owner" value="' + esc(s.owner) + '">') +
      fld('ساعات کاری روزانه', '<input type="number" name="hoursPerDay" value="' + S.en(s.hoursPerDay) + '">') +
      '</div><div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره تنظیمات</button></div>' +
      '</form></div></div>';

    html += '<div><div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>ظاهر پنل</h3><p>حالت روشن و تیره مطابق سایت مکادیز</p></div></div>' +
      '<div class="card-body"><div class="row-flex"><button class="btn btn-line btn-sm" data-act="set-theme" data-theme="light">' + icon('sun') + ' روشن</button>' +
      '<button class="btn btn-line btn-sm" data-act="set-theme" data-theme="dark">' + icon('moon') + ' تیره</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="toggle-theme">' + icon('refresh') + ' تغییر خودکار</button></div>' +
      '<div class="divider"></div>' +
      '<div class="row-flex" style="margin-bottom:10px">' +
      '<button class="btn ' + (layout() === 'cards' ? 'btn-red' : 'btn-line') + ' btn-sm" data-act="set-layout" data-layout-mode="cards">' + icon('dash') + ' چیدمان کارتی</button>' +
      '<button class="btn ' + (layout() === 'sidebar' ? 'btn-red' : 'btn-line') + ' btn-sm" data-act="set-layout" data-layout-mode="sidebar">' + icon('menu') + ' چیدمان کناری</button>' +
      '</div>' +
      '<div class="small muted">پنل به‌صورت پیش‌فرض بر اساس تنظیمات سیستم شما نمایش داده می‌شود و داده‌ها در همین مرورگر ذخیره می‌شوند.</div>' +
      '</div></div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>داده‌ها</h3><p>پشتیبان‌گیری و بازیابی اطلاعات</p></div></div><div class="card-body">' +
      '<div class="quick-grid">' +
      '<button class="quick" data-act="export-json" data-perm="data.manage"><span class="ic">' + icon('download') + '</span><span><b>خروجی JSON</b><small>دانلود کامل اطلاعات پنل</small></span></button>' +
      '<button class="quick" data-act="import-json" data-perm="data.manage"><span class="ic">' + icon('upload') + '</span><span><b>بازیابی از فایل</b><small>جایگزینی داده‌های فعلی</small></span></button>' +
      '<button class="quick" data-act="reset-data" data-perm="data.manage"><span class="ic" style="color:var(--red)">' + icon('refresh') + '</span><span><b>بازنشانی داده‌ها</b><small>بازگشت به داده‌های نمونه</small></span></button>' +
      '<button class="quick" data-act="csv-orders" data-perm="data.export"><span class="ic">' + icon('download') + '</span><span><b>خروجی سفارش‌ها</b><small>فایل CSV سازگار با اکسل</small></span></button>' +
      '<button class="quick" data-act="backup-code" data-perm="data.manage"><span class="ic">' + icon('shield') + '</span><span><b>کد پشتیبان (Google Docs)</b><small>متن بکاپ برای ذخیره در گوگل داک</small></span></button>' +
      '<button class="quick" data-act="restore-code" data-perm="data.manage"><span class="ic">' + icon('refresh') + '</span><span><b>بازیابی از کد</b><small>چسباندن کد ذخیره‌شده و برگرداندن داده‌ها</small></span></button>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="row-flex" style="align-items:center;gap:14px;flex-wrap:wrap">' +
      '<button class="btn btn-red" data-act="excel-backup" data-perm="data.export">' + icon('download') + ' بکاپ اکسل (XLSX)</button>' +
      '<span class="small muted">یک فایل اکسل واقعی با ۶ برگه (سفارش‌ها، مشتریان، پرداختی‌ها، خدمات، گزارش ماهانه، کاربران) ساخته می‌شود. کد ساخت این فایل در فایل <code>excel-backup.js</code> پروژه قرار دارد.</span>' +
      '</div></div></div>';

    var gas = gasConfig();
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>همگام‌سازی Google Sheets</h3>' +
      '<p>ذخیرهٔ خودکار همهٔ داده‌ها در شیت‌های مرتب (اختیاری)</p></div><div class="spacer"></div>' +
      '<button class="btn btn-line btn-sm" data-act="gas-guide">' + icon('bell') + ' راهنمای نصب</button></div><div class="card-body">' +
      '<div class="grid2">' +
      fld('آدرس Web App (…/exec)', '<input name="gasUrl" dir="ltr" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(gas.url) + '">' +
        (gas.isDefault ? '<span class="small muted" style="display:block;margin-top:5px">آدرس دیپلوی‌شدهٔ شیت شما از پیش تنظیم شده است.</span>' : '')) +
      fld('توکن اتصال (اختیاری)', '<input name="gasToken" dir="ltr" placeholder="از منوی «بکاپ مکادیز ← درباره»" value="' + esc(gas.token) + '">') +
      '</div>' +
      '<div class="row-flex" style="align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px">' +
      '<button class="btn btn-red" data-act="gas-send">' + icon('upload') + ' ارسال به Google Sheets</button>' +
      '<button class="btn btn-line" data-act="gas-ping">' + icon('check') + ' تست اتصال</button>' +
      '<button class="btn btn-line" data-act="gas-save">' + icon('save') + ' ذخیرهٔ آدرس</button>' +
      '<span class="small muted">' + (gas.last
        ? 'آخرین ارسال: ' + esc(S.faDateTime(gas.last.at)) + ' · ' + S.fa(gas.last.kb || 0) + ' کیلوبایت · ' +
          S.fa((gas.last.summary && gas.last.summary.orders) || gas.last.orders || 0) + ' سفارش' +
          (gas.last.verified ? ' · تأییدشده توسط سرور ✓' : '')
        : (gas.url ? 'هنوز ارسالی انجام نشده — «تست اتصال» را بزنید' : 'اتصال برقرار نیست؛ پنل آفلاین کار می‌کند')) + '</span>' +
      '</div>' +
      '<div class="small muted" style="margin-top:8px;line-height:1.9">اسکریپت آماده در <code>google-apps-script/Code.gs</code> است و همهٔ بخش‌ها (سفارش‌ها، مشتریان، پرداخت‌ها، کاربران، ساعت‌کار، دستمزد، تنظیمات) را در شیت‌های جدا و مرتب می‌نویسد. برای داده‌های بزرگ‌تر، از «کد پشتیبان (Google Docs)» هم می‌توانید استفاده کنید.</div>' +
      '</div></div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>حساب‌های کاربری</h3><p>مدیریت اعضای تیم، نقش‌ها و سطح دسترسی</p></div></div><div class="card-body">' +
      '<div class="row-flex" style="align-items:center;gap:14px;flex-wrap:wrap">' +
      '<a class="btn btn-line btn-sm" href="#/users" data-perm="user.manage">' + icon('users') + ' صفحه کاربران</a>' +
      '<span class="small muted">تعداد حساب‌های فعال: ' + S.fa(Auth.users().filter(function (u) { return u.active !== false; }).length) + ' از ' + S.fa(Auth.users().length) + '</span>' +
      '</div></div></div>';

    html += '<div class="card"><div class="card-head"><div><h3>درباره پنل</h3></div></div><div class="card-body">' +
      '<img class="about-logo" src="assets/img/mecades-logo.png" alt="MECADES — Industrial Design &amp; Engineering">' +
      '<div class="kv" style="grid-template-columns:1fr">' +
      kvBox('نسخه', 'MECADES Admin v.' + S.version()) +
      kvBox('شمارهٔ ویرایش', S.fa(S.rev()) + ' ویرایش (هر ویرایش یک واحد به نسخه اضافه می‌شود)') +
      kvBox('تعداد سفارش‌ها', S.fa(st.orders.length)) +
      kvBox('تعداد مشتریان', S.fa(st.customers.length)) +
      kvBox('حجم داده', S.fa(Math.round(JSON.stringify(st).length / 1024)) + ' کیلوبایت') +
      '</div></div></div>';

    html += '</div></div>';
    return html;
  };


  /* ---------- Users (حساب کاربری) ---------- */
  var PERM_LABELS = {
    'dashboard.view': 'داشبورد', 'order.view': 'مشاهده سفارش', 'order.create': 'ثبت سفارش',
    'order.edit': 'ویرایش سفارش', 'order.delete': 'حذف سفارش', 'payment.create': 'ثبت پرداخت',
    'customer.view': 'مشاهده مشتری', 'customer.manage': 'مدیریت مشتری', 'accounting.view': 'حسابداری',
    'reports.view': 'گزارش‌ها', 'service.view': 'خدمات و نرخنامه', 'project.view': 'نمونه‌کارها',
    'project.manage': 'مدیریت نمونه‌کار', 'data.export': 'خروجی اکسل و CSV',
    'settings.view': 'تنظیمات', 'user.manage': 'مدیریت کاربران'
  };
  function permLabel(p) { return PERM_LABELS[p] || p; }
  function kpi(ic, title, value, unit, delta, up, accent) {
    /* دو سبک فراخوانی: kpi(ic, title, value, warn:boolean)
       و kpi(ic, title, value, unit, delta, up, accent) */
    var warn = false;
    if (typeof unit === 'boolean') { warn = unit; unit = ''; }
    return '<div class="kpi ' + (accent ? 'accent' : '') + (warn ? ' warn' : '') + ' fade-in">' +
      '<div class="ic">' + icon(ic) + '</div>' +
      '<small>' + esc(title) + '</small><b' + (warn ? ' style="color:var(--accent-text)"' : '') + '>' + value +
      (unit ? '<span class="u">' + esc(unit) + '</span>' : '') + '</b>' +
      (delta ? '<span class="delta ' + (up ? 'up' : 'down') + '">' + esc(delta) + '</span>' : '') + '</div>';
  }
  function roleBadge(role) {
    var r = Auth.ROLES[role] || Auth.ROLES.viewer;
    return '<span class="role-badge" style="background:' + r.color + '1a;color:' + r.color + ';border-color:' + r.color + '40">' + esc(r.label) + '</span>';
  }
  views.users = function () {
    var users = Auth.users();
    var me = Auth.current();
    var html = '<div class="page-head"><div><h2>کاربران سیستم</h2><p>مدیریت حساب‌های کاربری، نقش‌ها و سطح دسترسی اعضای تیم.</p></div>' +
      '<div class="row-flex"><button class="btn btn-line btn-sm" data-act="auth-reset-all">' + icon('refresh') + ' راه‌اندازی اولیه</button>' +
      '<button class="btn btn-red" data-act="user-new">' + icon('plus') + ' کاربر جدید</button></div></div>';

    if (me) {
      html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>مشخصات من</h3>' +
        '<p>شماره تماس و شماره حساب برای واریز وجه — فقط شما این بخش را می‌بینید</p></div>' +
        '<a class="btn btn-line btn-sm" href="#/profile">' + icon('users') + ' ویرایش مشخصات</a></div>' +
        '<div class="card-body"><div class="kv">' +
        kvBox('نام', esc(me.firstName || '—')) +
        kvBox('نام خانوادگی', esc(me.lastName || '—')) +
        kvBox('نام کاربری', '<code>' + esc(me.username) + '</code>') +
        kvBox('نقش', roleBadge(me.role)) +
        kvBox('شماره تماس', me.phone ? esc(me.phone) : '<span class="muted">ثبت نشده</span>') +
        kvBox('شماره حساب', me.account ? '<code>' + esc(me.account) + '</code>' : '<span class="muted">ثبت نشده</span>') +
        kvBox('آخرین ورود', me.lastLogin ? esc(S.faDate(me.lastLogin)) : '—') +
        '</div></div></div>';
    }

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>حساب‌ها (' + S.fa(users.length) + ')</h3>' +
      '<p>نام کاربری، نقش، وضعیت و آخرین ورود هر حساب</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>نام</th><th>نام خانوادگی</th><th>نام کاربری</th><th>نقش</th><th>تماس و حساب</th><th>وضعیت</th><th>آخرین ورود</th><th>امروز / دستمزد</th><th>عملیات</th></tr></thead><tbody>';
    if (!users.length) {
      html += '<tr><td colspan="9">' + emptyBox('هنوز کاربری ساخته نشده', 'با دکمهٔ «کاربر جدید» اولین حساب را بسازید.', 'users') + '</td></tr>';
    }
    users.forEach(function (u) {
      var isMe = me && me.id === u.id;
      html += '<tr><td class="wrap">' + esc(u.firstName || '—') + '</td>' +
        '<td class="wrap"><a class="user-link" href="#/users/' + u.id + '"><b>' + esc(u.lastName || '—') + '</b></a>' +
        (isMe ? ' <span class="tag">شما</span>' : '') + '</td>' +
        '<td class="wrap"><code>' + esc(u.username) + '</code></td>' +
        '<td class="wrap">' + roleBadge(u.role) + '</td>' +
        '<td class="wrap">' + (u.phone ? '<div class="mini-row">' + icon('phone') + esc(u.phone) + '</div>' : '') +
        (u.account ? '<div class="mini-row">' + icon('wallet') + '<code>' + esc(u.account) + '</code></div>' : '') +
        (!u.phone && !u.account ? '<span class="muted small">ثبت نشده</span>' : '') + '</td>' +
        '<td class="wrap">' + (u.active === false ? '<span class="badge b-cancel">غیرفعال</span>' : '<span class="badge b-done">فعال</span>') +
        (u.mustChange ? ' <span class="tag">نیازمند تغییر رمز</span>' : '') + '</td>' +
        '<td class="wrap">' + (u.lastLogin ? esc(S.faDate(u.lastLogin)) : '<span class="muted">بدون ورود</span>') + '</td>' +
        '<td class="wrap">' + (function () {
          var wr = S.wageReport(u.id), run = S.runningSession(u.id);
          return '<b>' + hoursLabel(wr.seconds) + '</b>' +
            (run ? ' <span class="tag live">در حال کار</span>' : '') +
            '<div class="small muted">' + wageLabel(wr.amount) + '</div>';
        })() + '</td>' +
        '<td class="wrap"><div class="row-flex tight">' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="user-edit" data-id="' + u.id + '" title="ویرایش">' + icon('edit') + '</button>' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="user-pass" data-id="' + u.id + '" title="تغییر رمز">' + icon('shield') + '</button>' +
        '<button class="icon-btn" style="width:30px;height:30px" data-act="user-toggle" data-id="' + u.id + '" title="' + (u.active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی') + '">' + icon(u.active === false ? 'check' : 'x') + '</button>' +
        (isMe ? '' : '<button class="icon-btn" style="width:30px;height:30px" data-act="user-del" data-id="' + u.id + '" title="حذف کاربر">' + icon('trash') + '</button>') +
        '</div></td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* ---------- فعالیت‌ها و نرخ ساعتی (مدیر) ---------- */
    if (canAllTeam()) {
      var actsAll = S.activities(false);
      html += '<div class="card" style="margin-bottom:18px" data-perm="user.manage"><div class="card-head">' +
        '<div><h3>فعالیت‌ها و نرخ ساعتی</h3><p>نوع کارهایی که تیم ثبت می‌کند؛ دستمزد هر کاربر = ساعت × نرخ فعالیت</p></div>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-red btn-sm" data-act="act-new">' + icon('plus') + ' فعالیت جدید</button></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>فعالیت</th><th>نرخ ساعتی</th><th>پروژه‌محور</th><th>وضعیت</th><th>استفاده</th><th>عملیات</th></tr></thead><tbody>';
      if (!actsAll.length) html += '<tr><td colspan="6">' + emptyBox('فعالیتی تعریف نشده', 'با دکمهٔ «فعالیت جدید» شروع کنید.', 'clock') + '</td></tr>';
      actsAll.forEach(function (a) {
        var used = S.state.sessions.filter(function (x) { return x.activityId === a.id; });
        var hrs = used.reduce(function (sum, x) { return sum + S.sessionHours(x); }, 0);
        html += '<tr><td class="wrap"><div class="hstack-sm"><span class="act-dot" style="background:' + a.color + '">' + icon(a.icon) + '</span>' +
          '<div><b>' + esc(a.name) + '</b>' + (a.desc ? '<div class="small muted">' + esc(a.desc) + '</div>' : '') + '</div></div></td>' +
          '<td><span class="amt">' + S.money(a.rate) + '</span></td>' +
          '<td>' + (a.needOrder ? '<span class="tag strong">بله</span>' : '<span class="tag">خیر</span>') + '</td>' +
          '<td>' + (a.active === false ? '<span class="badge b-cancel">غیرفعال</span>' : '<span class="badge b-done">فعال</span>') + '</td>' +
          '<td class="wrap"><small>' + S.fa(used.length) + ' ثبت · ' + hoursLabel(hrs * 3600) + '</small></td>' +
          '<td class="wrap"><div class="row-flex tight">' +
          '<button class="icon-btn" style="width:30px;height:30px" data-act="act-edit" data-id="' + a.id + '" title="ویرایش">' + icon('edit') + '</button>' +
          '<button class="icon-btn" style="width:30px;height:30px" data-act="act-del" data-id="' + a.id + '" title="حذف / غیرفعال">' + icon('trash') + '</button>' +
          '</div></td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    html += '<div class="card"><div class="card-head"><div><h3>نقش‌ها و سطح دسترسی</h3><p>دسترسی پیش‌فرض هر نقش در سیستم</p></div></div><div class="card-body">';
    Object.keys(Auth.ROLES).forEach(function (k) {
      var r = Auth.ROLES[k];
      html += '<div class="role-row"><span class="role-dot" style="background:' + r.color + '"></span>' +
        '<div class="role-txt"><b>' + esc(r.label) + '</b><small>' + esc(r.desc) + '</small></div>' +
        '<div class="perm-tags">' + (r.perms.indexOf('*') > -1
          ? '<span class="tag strong">دسترسی کامل به همه بخش‌ها</span>'
          : r.perms.map(function (pm) { return '<span class="tag">' + esc(permLabel(pm)) + '</span>'; }).join('')) + '</div></div>';
    });
    html += '<div class="divider"></div><div class="small muted">رمز عبور کاربران به‌صورت هش‌شده (SHA-256 با salt اختصاصی) ذخیره می‌شود؛ متن اصلی رمز هرگز در مرورگر نگه‌داری نمی‌شود.</div>';
    html += '</div></div>';
    return html;
  };


  /* ---------- گزارش کارکرد یک کاربر ---------- */
  views.user = function (id) {
    var u = Auth.users().filter(function (x) { return x.id === id; })[0];
    if (!u) {
      return '<div class="card"><div class="card-body">' + emptyBox('کاربر یافت نشد', 'حساب کاربری موردنظر حذف شده است.', 'users') + '</div></div>';
    }
    var st = S.state;
    var orders = st.orders.filter(function (o) { return o.createdBy === u.id; });
    var pays = st.payments.filter(function (p) { return p.createdBy === u.id; });
    var acts = st.activity.filter(function (a) { return a.byId === u.id; });
    var totalQuote = orders.reduce(function (a, o) { return a + o.quote; }, 0);
    var totalHours = orders.reduce(function (a, o) { return a + o.hours; }, 0);
    var paidTotal = pays.reduce(function (a, p) { return a + p.amount; }, 0);
    var doneOrders = orders.filter(function (o) { return o.status === 'done'; }).length;

    var html = '<div class="page-head"><div class="hstack">' +
      '<a class="btn btn-ghost btn-sm" href="#/users">' + icon('chevronR') + ' بازگشت به کاربران</a>' +
      '<h2>' + esc(u.firstName || '') + ' ' + esc(u.lastName || '') + ' ' + roleBadge(u.role) + '</h2>' +
      '<p>گزارش کارکرد: سفارش‌های ثبت‌شده، پرداختی‌ها و فعالیت‌های این کاربر.</p></div>' +
      '<div class="row-flex">' +
      '<button class="btn btn-line btn-sm" data-act="user-edit" data-id="' + u.id + '">' + icon('edit') + ' ویرایش مشخصات</button>' +
      '<button class="btn btn-line btn-sm" data-act="user-pass" data-id="' + u.id + '">' + icon('shield') + ' تغییر رمز</button>' +
      '</div></div>';

    /* ---------- ساعت‌کار و دستمزد ---------- */
    var wToday = S.wageReport(u.id);
    var wMonth = S.wageReport(u.id, (function () { var d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); })());
    html += '<div class="kpis kpis-3" style="margin-bottom:20px">' +
      kpi('clock', 'ساعت امروز', S.fa((wToday.seconds / 3600).toFixed(1)), 'ساعت', (wToday.rows.length ? S.fa(wToday.rows.length) + ' فعالیت' : 'بدون ثبت'), wToday.seconds > 0, true) +
      kpi('wallet', 'دستمزد امروز', S.fa(S.moneyShort(wToday.amount)), 'تومان', 'ساعت × نرخ فعالیت', wToday.amount > 0) +
      kpi('chart', 'دستمزد این ماه', S.fa(S.moneyShort(wMonth.amount)), 'تومان', S.fa((wMonth.seconds / 3600).toFixed(1)) + ' ساعت کارکرد', wMonth.amount > 0) +
      '</div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>ریز فعالیت‌ها و دستمزد</h3>' +
      '<p>ساعت‌های ثبت‌شده بر اساس نوع فعالیت — امروز و از ابتدای ماه</p></div>' +
      '<div class="spacer"></div><button class="btn btn-line btn-sm" data-act="ts-open" data-id="' + u.id + '">' + icon('clock') + ' شروع/پایان فعالیت</button></div>' +
      '<div class="card-body">';
    if (!wMonth.byActivity.length) {
      html += emptyBox('هنوز فعالیتی ثبت نشده', 'با دکمهٔ بالا اولین ساعت کاری این کاربر را ثبت کنید.', 'clock');
    } else {
      html += '<div class="wage-list">' + wMonth.byActivity.map(function (r) {
        return '<div class="wage-row"><span class="act-dot" style="background:' + (r.color || '#3A5268') + '">' + icon('clock') + '</span>' +
          '<div class="wage-txt"><b>' + esc(r.name) + '</b><small>' + hoursLabel(r.sec) + ' · ' + S.fa(r.count) + ' ثبت · نرخ ' + S.money(r.rate) + '</small></div>' +
          '<b class="wage-amt">' + S.money(Math.round(r.amount)) + '</b></div>';
      }).join('') + '</div>' +
        '<div class="wage-total"><span>جمع دستمزد این ماه</span><b>' + S.money(wMonth.amount) + '</b></div>';
    }
    html += '</div></div>';

    /* شاخص‌ها */
    html += '<div class="kpis" style="margin-bottom:20px">' +
      kpi('orders', 'سفارش‌های ثبت‌شده', S.fa(orders.length), 'فقره', S.fa(doneOrders) + ' تحویل‌شده', true) +
      kpi('wallet', 'مبلغ سفارش‌ها', S.fa(S.moneyShort(totalQuote)), 'تومان', 'مجموع ثبت‌شده', true, true) +
      kpi('clock', 'ساعات کارکرد', S.fa(totalHours), 'ساعت', S.fa(orders.length ? Math.round(totalHours / orders.length) : 0) + ' ساعت/سفارش', true) +
      kpi('wallet', 'پرداختی‌های ثبت‌شده', S.fa(S.moneyShort(paidTotal)), 'تومان', S.fa(pays.length) + ' فقره', paidTotal > 0) +
      '</div>';

    /* مشخصات کاربر */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>مشخصات کاربر</h3>' +
      '<p>اطلاعات تماس و شماره حساب برای واریز وجه</p></div></div><div class="card-body">' +
      '<div class="kv">' +
      kvBox('نام', esc(u.firstName || '—')) +
      kvBox('نام خانوادگی', esc(u.lastName || '—')) +
      kvBox('نام کاربری', '<code>' + esc(u.username) + '</code>') +
      kvBox('نقش', roleBadge(u.role)) +
      kvBox('وضعیت', u.active === false ? '<span class="badge b-cancel">غیرفعال</span>' : '<span class="badge b-done">فعال</span>') +
      kvBox('تاریخ عضویت', esc(S.faDate(u.createdAt))) +
      kvBox('آخرین ورود', u.lastLogin ? esc(S.faDate(u.lastLogin)) : '—') +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="grid2">' +
      '<div class="detail-box">' + icon('phone') + '<div><small>شماره تماس</small><b>' + (u.phone ? esc(u.phone) : 'ثبت نشده') + '</b></div></div>' +
      '<div class="detail-box">' + icon('wallet') + '<div><small>شماره حساب (واریز وجه)</small><b>' + (u.account ? '<code>' + esc(u.account) + '</code>' : 'ثبت نشده') + '</b></div></div>' +
      '</div></div></div>';

    /* روند ماهانه */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>روند ۶ ماه اخیر</h3>' +
      '<p>سفارش‌ها و پرداختی‌های ثبت‌شده توسط این کاربر</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ماه</th><th>سفارش</th><th>ساعات</th><th>مبلغ سفارش‌ها</th><th>پرداختی ثبت‌شده</th><th>تحویل‌شده</th></tr></thead><tbody>';
    monthSeries(6).forEach(function (m) {
      var os = orders.filter(function (o) { return S.monthKey(o.created) === m.key; });
      var ps = pays.filter(function (p) { return S.monthKey(p.date) === m.key; });
      html += '<tr class="clickable" data-act="open-order" data-id="' + (os[0] ? os[0].id : '') + '">' +
        '<td class="wrap">' + esc(m.label) + '</td>' +
        '<td class="wrap">' + S.fa(os.length) + '</td>' +
        '<td class="wrap">' + S.fa(os.reduce(function (a, o) { return a + o.hours; }, 0)) + '</td>' +
        '<td class="wrap">' + money(os.reduce(function (a, o) { return a + o.quote; }, 0)) + '</td>' +
        '<td class="wrap">' + money(ps.reduce(function (a, p) { return a + p.amount; }, 0)) + '</td>' +
        '<td class="wrap">' + S.fa(os.filter(function (o) { return o.status === 'done'; }).length) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* سفارش‌های ثبت‌شده */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>سفارش‌های ثبت‌شده (' + S.fa(orders.length) + ')</h3>' +
      '<p>سفارش‌هایی که این کاربر در پنل ثبت کرده است</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>کد</th><th>عنوان</th><th>مشتری</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>';
    if (!orders.length) {
      html += '<tr><td colspan="6">' + emptyBox('سفارشی ثبت نشده', 'این کاربر هنوز سفارشی در پنل ثبت نکرده است.', 'orders') + '</td></tr>';
    }
    orders.slice(0, 15).forEach(function (o) {
      html += '<tr class="clickable" data-act="open-order" data-id="' + o.id + '">' +
        '<td class="wrap"><b>' + esc(o.code) + '</b></td>' +
        '<td class="wrap">' + esc(o.title) + '</td>' +
        '<td class="wrap">' + esc(S.customerName(o.customerId)) + '</td>' +
        '<td class="wrap">' + esc(S.faDate(o.created)) + '</td>' +
        '<td class="wrap">' + money(o.quote) + '</td>' +
        '<td class="wrap">' + statusBadge(o.status) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* پرداختی‌های ثبت‌شده */
    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>پرداختی‌های ثبت‌شده (' + S.fa(pays.length) + ')</h3>' +
      '<p>دریافتی‌هایی که این کاربر در پنل ثبت کرده است</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>تاریخ</th><th>شماره سفارش</th><th>مشتری</th><th>مبلغ</th><th>روش</th><th>توضیحات</th></tr></thead><tbody>';
    if (!pays.length) {
      html += '<tr><td colspan="6">' + emptyBox('پرداختی ثبت نشده', 'این کاربر هنوز پرداختی‌ای ثبت نکرده است.', 'wallet') + '</td></tr>';
    }
    pays.slice(0, 15).forEach(function (p) {
      html += '<tr class="clickable" data-act="open-order" data-id="' + (st.orders.filter(function (o) { return o.code === p.orderCode; })[0] || {}).id + '">' +
        '<td class="wrap">' + esc(S.faDate(p.date)) + '</td>' +
        '<td class="wrap"><b>' + esc(p.orderCode || '—') + '</b></td>' +
        '<td class="wrap">' + esc(S.customerName(p.customerId)) + '</td>' +
        '<td class="wrap">' + money(p.amount) + '</td>' +
        '<td class="wrap">' + esc(p.method || '') + '</td>' +
        '<td class="wrap">' + esc(p.note || '') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* فعالیت‌ها */
    html += '<div class="card"><div class="card-head"><div><h3>فعالیت‌های ثبت‌شده (' + S.fa(acts.length) + ')</h3>' +
      '<p>تاریخچهٔ اقدامات این کاربر در پنل</p></div></div><div class="card-body"><div class="feed">' +
      (acts.length ? acts.slice(0, 12).map(function (a) {
        return '<div class="feed-item"><span class="dot ' + esc(a.type) + '"></span><div><b>' + esc(a.text) + '</b>' +
          '<small>' + esc(S.relTime(a.ts)) + ' · ' + esc(S.faDateTime(a.ts)) + '</small></div></div>';
      }).join('') : '<div class="small muted">فعالیتی ثبت نشده است.</div>') +
      '</div></div></div>';
    return html;
  };

  /* ---------- مشخصات من ---------- */
  views.profile = function () {
    var me = Auth.current();
    if (!me) return '';
    var myOrders = S.state.orders.filter(function (o) { return o.createdBy === me.id; });
    var myPays = S.state.payments.filter(function (p) { return p.createdBy === me.id; });
    var html = '<div class="page-head"><div><h2>مشخصات من</h2>' +
      '<p>شماره تماس و شماره حساب برای واریز وجه؛ این اطلاعات فقط برای شما نمایش داده می‌شود.</p></div></div>';

    html += '<div class="card" style="margin-bottom:18px"><div class="card-head"><div><h3>اطلاعات حساب</h3>' +
      '<p>نام کاربری و نقش توسط مدیر تعیین می‌شود</p></div>' + roleBadge(me.role) + '</div>' +
      '<div class="card-body"><form data-form="my-profile"><div class="grid2">' +
      fld('نام', '<input value="' + esc(me.firstName || '') + '" disabled>') +
      fld('نام خانوادگی', '<input value="' + esc(me.lastName || '') + '" disabled>') +
      fld('نام کاربری', '<input value="' + esc(me.username) + '" disabled>') +
      fld('شماره تماس', '<input name="phone" value="' + esc(me.phone || '') + '" placeholder="۰۹۱۲…" inputmode="tel">') +
      fld('شماره حساب (برای واریز وجه)', '<input name="account" value="' + esc(me.account || '') + '" placeholder="شماره کارت / شبا" inputmode="numeric">') +
      '</div><div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره مشخصات</button>' +
      '<button class="btn btn-line" type="button" data-act="user-pass" data-id="' + me.id + '">' + icon('shield') + ' تغییر رمز عبور</button>' +
      '</div></form></div></div>';

    html += '<div class="kpis" style="margin-bottom:18px">' +
      kpi('orders', 'سفارش‌های من', S.fa(myOrders.length), 'فقره', S.fa(S.moneyShort(myOrders.reduce(function (a, o) { return a + o.quote; }, 0))) + ' تومان', true) +
      kpi('wallet', 'پرداختی‌های من', S.fa(myPays.length), 'فقره', S.fa(S.moneyShort(myPays.reduce(function (a, p) { return a + p.amount; }, 0))) + ' تومان', true) +
      kpi('clock', 'ساعات کارکرد من', S.fa(myOrders.reduce(function (a, o) { return a + o.hours; }, 0)), 'ساعت', 'مجموع سفارش‌های ثبت‌شده', true) +
      kpi('calendar', 'عضویت از', esc(S.faDate(me.createdAt)), '', 'آخرین ورود: ' + (me.lastLogin ? esc(S.faDate(me.lastLogin)) : '—'), true) +
      '</div>';
    return html;
  };

  /* ---------- user modals ---------- */
  function userModal(u) {
    var isNew = !u;
    var roles = Object.keys(Auth.ROLES).map(function (k) {
      return '<option value="' + k + '"' + (u && u.role === k ? ' selected' : '') + '>' + esc(Auth.ROLES[k].label) + '</option>';
    }).join('');
    openModal('<div class="modal-head"><h3>' + (isNew ? 'کاربر جدید' : 'ویرایش کاربر') + '</h3></div>' +
      '<div class="modal-body"><form data-form="user" data-id="' + (u ? u.id : '') + '">' +
      fld('نام', '<input name="firstName" value="' + esc(u ? (u.firstName || '') : '') + '" required placeholder="مثلاً محمد">') +
      fld('نام خانوادگی', '<input name="lastName" value="' + esc(u ? (u.lastName || '') : '') + '" required placeholder="مثلاً رضایی">') +
      fld('نام کاربری', '<input name="username" value="' + esc(u ? u.username : '') + '" required autocomplete="off">') +
      fld('شماره تماس', '<input name="phone" value="' + esc(u && u.phone ? u.phone : '') + '" placeholder="۰۹۱۲…" inputmode="tel">') +
      fld('شماره حساب (برای واریز وجه)', '<input name="account" value="' + esc(u && u.account ? u.account : '') + '" placeholder="شماره کارت / شبا" inputmode="numeric">') +
      (isNew ? fld('رمز عبور (اختیاری)', '<input type="password" name="password" placeholder="اگر خالی بماند، کاربر در اولین ورود خودش تعیین می‌کند" autocomplete="new-password">') : '') +
      fld('نقش کاربر', '<select name="role">' + roles + '</select>') +
      (isNew ? '' : fld('وضعیت', '<select name="active"><option value="1"' + (u.active !== false ? ' selected' : '') + '>فعال</option><option value="0"' + (u.active === false ? ' selected' : '') + '>غیرفعال</option></select>')) +
      (isNew ? '<div class="hint-box">' + icon('shield') + '<span>اگر رمزی تعیین نکنید، کاربر در اولین ورود با همین نام کاربری رمز عبور خودش را می‌سازد.</span></div>' : '') +
      '<div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره</button>' +
      '<button class="btn btn-ghost" type="button" data-act="close-modal">انصراف</button></div>' +
      '</form></div>');
  }
  function passwordModal(u) {
    openModal('<div class="modal-head"><h3>تغییر رمز عبور</h3></div>' +
      '<div class="modal-body"><form data-form="user-pass" data-id="' + u.id + '">' +
      '<p class="small muted" style="margin-bottom:12px">رمز جدید برای «' + esc(u.name) + '» تعیین می‌شود.</p>' +
      fld('رمز عبور جدید', '<input type="password" name="pwd1" required autocomplete="new-password">') +
      fld('تکرار رمز عبور', '<input type="password" name="pwd2" required autocomplete="new-password">') +
      '<div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره رمز</button>' +
      '<button class="btn btn-ghost" type="button" data-act="close-modal">انصراف</button></div>' +
      '</form></div>');
  }

  /* ---------- کد پشتیبان متنی (Google Docs) ---------- */
  function wrapCode(code, width) {
    var out = [], i;
    for (i = 0; i < code.length; i += width) out.push(code.slice(i, i + width));
    return out.join('\n');
  }
  function jDate() {
    var j = S.jalaliNow();
    return j[0] + '/' + ('0' + j[1]).slice(-2) + '/' + ('0' + j[2]).slice(-2);
  }
  function pad2n(n) { return (n < 10 ? '0' : '') + n; }
  function backupCodeText(code, m) {
    m = m || S.backupMeta();
    var now = new Date();
    var d = jDate() + '  ' + pad2n(now.getHours()) + ':' + pad2n(now.getMinutes());
    /* سرصفحه انگلیسی/ASCII است تا داخل جعبهٔ چپ‌به‌راست هیچ به‌هم‌ریختگی دوجهته پیش نیاید */
    var head = [
      'MECADES ADMIN - BACKUP CODE',
      'v.' + S.version() + '  ' + d + '  ' + Math.round(m.bytes / 1024) + 'KB',
      'Orders ' + m.orders + ' / Customers ' + m.customers,
      'Payments ' + m.payments + ' / Users ' + m.users + ' / Sess ' + m.sessions,
      '',
      '== COPY BELOW THIS LINE ==',
      ''
    ].join('\n');
    var foot = [
      '',
      '== END OF CODE ==',
      '',
      'Restore: Settings > Restore from code > paste everything.',
      'Keep this in a private Google Doc.'
    ].join('\n');
    return head + wrapCode(code, 92) + foot;
  }
  function backupCodeModal() {
    var m = S.backupMeta();
    var txt = backupCodeText(S.backupCode(), m);
    openModal('<div class="modal-head"><h3>کد پشتیبان برای Google Docs</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' +
      '<div class="bkc-note">' + icon('shield') +
        '<div><b>' + S.fa(m.orders) + ' سفارش، ' + S.fa(m.customers) + ' مشتری، ' + S.fa(m.payments) + ' پرداخت، ' +
        S.fa(m.users) + ' کاربر، ' + S.fa(m.sessions) + ' ساعت‌کار</b><span>این متن همهٔ داده‌های پنل (به‌همراه حساب‌های کاربری و رمزهای هش‌شده) را در خود دارد؛ آن را در یک Google Doc بچسبانید و نگه دارید.</span></div></div>' +
      '<textarea class="bkc-box" id="backupCodeBox" readonly spellcheck="false" dir="ltr">' + esc(txt) + '</textarea>' +
      '<div class="row-flex" style="margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn btn-red" data-act="copy-backup-code">' + icon('save') + ' کپی کد</button>' +
      '<button class="btn btn-line" data-act="download-backup-code">' + icon('download') + ' دانلود فایل متنی</button>' +
      '<span class="small muted" id="bkcSize">' + S.fa(txt.length.toLocaleString('en-US')) + ' کاراکتر</span>' +
      '</div>' +
      '<div class="hint-box" style="margin-top:12px">' + icon('refresh') +
        '<span>بازیابی: تنظیمات ← «بازیابی از کد» ← همین متن را بچسبانید. داده‌های فعلی جایگزین می‌شوند، پس اول از وضعیت فعلی هم یک کد بگیرید.</span></div>' +
      '<div class="small muted" style="margin-top:8px;line-height:1.9">در Google Docs: یک سند تازه بسازید ← <b>Ctrl+V</b> ← عنوان سند را «بکاپ پنل مکادیز — ' +
        S.fa(jDate()) + '» بگذارید و دسترسی را روی «خصوصی» نگه دارید.</div>' +
      '</div>', true);
    /* نسخهٔ فشرده (اگر مرورگر پشتیبانی کند) جای متن اولیه را می‌گیرد */
    S.backupCodePacked(function (code) {
      var box = document.getElementById('backupCodeBox');
      if (!box) return;
      var compact = backupCodeText(code);
      if (compact.length >= box.value.length) return;
      box.value = compact;
      var sz = document.getElementById('bkcSize');
      if (sz) sz.textContent = S.fa(compact.length.toLocaleString('en-US')) + ' کاراکتر';
    });
  }
  function restoreCodeModal() {
    openModal('<div class="modal-head"><h3>بازیابی از کد پشتیبان</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="restore-code">' +
      '<p class="small muted" style="line-height:2;margin-bottom:10px">متنی که در Google Docs ذخیره کرده‌اید را کامل بچسبانید (سرصفحه و خط‌های اضافه مشکلی ندارد).</p>' +
      '<textarea class="bkc-box" name="code" required spellcheck="false" dir="ltr" placeholder="MCD1.…"></textarea>' +
      '<div class="row-flex" style="margin-top:10px"><button class="btn btn-red" type="submit">' + icon('upload') + ' بازیابی داده‌ها</button>' +
      '<button class="btn btn-ghost" type="button" data-act="close-modal">انصراف</button></div>' +
      '</form></div>', true);
  }

  /* ================= Excel backup (XLSX) ================= */
  function excelNumber(n) { var v = Math.round(Number(n) || 0); return isFinite(v) ? v : 0; }
  function backupWorkbook() {
    var st = S.state;
    var wb = window.XLSXWriter.book();

    /* --- سفارش‌ها --- */
    var oRows = [['کد سفارش', 'تاریخ ثبت', 'مشتری', 'شرکت', 'خدمت', 'ساعات', 'نرخ ساعتی', 'مبلغ (تومان)',
      'پرداخت‌شده (تومان)', 'مانده (تومان)', 'موعد تحویل', 'وضعیت', 'اولویت', 'منبع', 'توضیحات']];
    st.orders.slice().sort(function (a, b) { return a.created - b.created; }).forEach(function (o) {
      var c = S.customer(o.customerId) || {};
      var paid = S.orderPaid(o);
      oRows.push([o.code, S.faDate(o.created), S.customerName(o.customerId), c.company || '', S.serviceName(o.serviceId),
        excelNumber(o.hours), excelNumber(o.rate), excelNumber(o.quote), excelNumber(paid), excelNumber(Math.max(0, o.quote - paid)),
        S.faDate(o.deadline), (S.STATUS[o.status] || {}).label || o.status, (S.PRIORITY[o.priority] || {}).label || o.priority,
        S.SOURCES[o.source] || o.source, o.desc || '']);
    });
    XLSXWriter.sheet(wb, 'سفارش‌ها', oRows, { widths: [12, 14, 20, 18, 18, 8, 12, 16, 16, 16, 14, 12, 10, 12, 34] });

    /* --- مشتریان --- */
    var cRows = [['نام مشتری', 'شرکت', 'تلفن', 'ایمیل', 'آدرس', 'تعداد سفارش', 'مجموع فروش (تومان)', 'مانده بدهی (تومان)', 'یادداشت']];
    st.customers.forEach(function (c) {
      var os = st.orders.filter(function (o) { return o.customerId === c.id; });
      var total = os.reduce(function (a, o) { return a + o.quote; }, 0);
      var paid = os.reduce(function (a, o) { return a + S.orderPaid(o); }, 0);
      cRows.push([c.name, c.company || '', c.phone || '', c.email || '', c.address || '',
        excelNumber(os.length), excelNumber(total), excelNumber(Math.max(0, total - paid)), c.note || '']);
    });
    XLSXWriter.sheet(wb, 'مشتریان', cRows, { widths: [20, 20, 16, 24, 28, 12, 20, 18, 26] });

    /* --- پرداختی‌ها --- */
    var pRows = [['تاریخ', 'شماره سفارش', 'مشتری', 'مبلغ (تومان)', 'روش پرداخت', 'توضیحات']];
    st.payments.slice().sort(function (a, b) { return a.date - b.date; }).forEach(function (p) {
      pRows.push([S.faDate(p.date), p.orderCode || '', S.customerName(p.customerId), excelNumber(p.amount), p.method || '', p.note || '']);
    });
    XLSXWriter.sheet(wb, 'پرداختی‌ها', pRows, { widths: [14, 14, 20, 16, 16, 30] });

    /* --- خدمات و نرخنامه --- */
    var sRows = [['خدمت', 'توضیح کوتاه', 'شرح', 'نرخ پایه (تومان)', 'وضعیت']];
    st.services.forEach(function (sv) {
      sRows.push([sv.name, sv.short || '', sv.desc || '', excelNumber(sv.rate), sv.active === false ? 'غیرفعال' : 'فعال']);
    });
    sRows.push([]);
    sRows.push(['پلکان نرخ ساعتی', 'تا (ساعت)', 'نرخ (تومان)']);
    st.tiers.forEach(function (t) { sRows.push([t.label, excelNumber(t.max), excelNumber(t.rate)]); });
    XLSXWriter.sheet(wb, 'خدمات و نرخنامه', sRows, { widths: [26, 20, 40, 18, 12] });

    /* --- گزارش ماهانه --- */
    var mRows = [['ماه', 'تعداد سفارش', 'ساعات کاری', 'فروش (تومان)', 'دریافتی (تومان)', 'تحویل‌شده']];
    monthSeries(12).forEach(function (m) {
      var os = st.orders.filter(function (o) { return S.monthKey(o.created) === m.key; });
      var pay = st.payments.filter(function (p) { return S.monthKey(p.date) === m.key; })
        .reduce(function (a, p) { return a + p.amount; }, 0);
      mRows.push([m.label, excelNumber(os.length), excelNumber(os.reduce(function (a, o) { return a + o.hours; }, 0)),
        excelNumber(os.reduce(function (a, o) { return a + o.quote; }, 0)), excelNumber(pay),
        excelNumber(os.filter(function (o) { return o.status === 'done'; }).length)]);
    });
    XLSXWriter.sheet(wb, 'گزارش ماهانه', mRows, { widths: [14, 14, 14, 18, 18, 14] });

    /* --- کاربران و تنظیمات --- */
    var uRows = [['نام', 'نام خانوادگی', 'نام کاربری', 'نقش', 'وضعیت', 'تاریخ ایجاد', 'آخرین ورود']];
    Auth.users().forEach(function (u) {
      uRows.push([u.firstName || '', u.lastName || '', u.username, (Auth.ROLES[u.role] || {}).label || u.role,
        u.active === false ? 'غیرفعال' : 'فعال', S.faDate(u.createdAt), u.lastLogin ? S.faDate(u.lastLogin) : '—']);
    });
    uRows.push([]);
    uRows.push(['تنظیمات مجموعه', 'مقدار']);
    var sett = st.settings || {};
    Object.keys(sett).forEach(function (k) { uRows.push([k, String(sett[k])]); });
    uRows.push([]);
    uRows.push(['نسخه پنل', 'v.' + S.version()]);
    uRows.push(['شمارهٔ ویرایش', S.fa(S.rev()) + ' ویرایش']);
    XLSXWriter.sheet(wb, 'کاربران و تنظیمات', uRows, { widths: [18, 20, 20, 16, 12, 16, 16] });

    return wb;
  }
  function exportExcelBackup() {
    if (!Auth.can('data.export')) { toast('سطح دسترسی شما اجازهٔ خروجی گرفتن را نمی‌دهد', 'err'); return; }
    var j = S.jalaliNow();
    var fname = 'mecades-backup-' + j[0] + '-' + String(j[1]).padStart(2, '0') + '-' + String(j[2]).padStart(2, '0') + '.xlsx';
    try {
      XLSXWriter.download(backupWorkbook(), fname);
      S.log('خروجی اکسل بکاپ تهیه شد (' + fname + ')', 'done');
      toast('فایل اکسل بکاپ دانلود شد', 'ok');
    } catch (err) {
      toast('ساخت فایل اکسل با خطا مواجه شد', 'err');
    }
  }

  /* ================= modals ================= */
  function openModal(html, wide) {
    modalRoot.innerHTML = '<div class="modal-back" data-act="close-modal"></div>' +
      '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    modalRoot.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { modalRoot.classList.remove('open'); modalRoot.innerHTML = ''; document.body.style.overflow = ''; }

  function customerModal(c) {
    c = c || {};
    openModal('<div class="modal-head"><h3>' + (c.id ? 'ویرایش مشتری' : 'افزودن مشتری') + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="customer" data-id="' + (c.id || '') + '"><div class="grid2">' +
      fld('نام و نام خانوادگی', '<input name="name" required value="' + esc(c.name || '') + '">') +
      fld('شماره تماس', '<input name="phone" required value="' + esc(c.phone || '') + '">') +
      fld('شرکت / مجموعه', '<input name="company" value="' + esc(c.company || '') + '">') +
      fld('ایمیل', '<input name="email" value="' + esc(c.email || '') + '">') +
      fld('آدرس', '<input name="address" value="' + esc(c.address || '') + '">') +
      fld('یادداشت', '<input name="note" value="' + esc(c.note || '') + '">') +
      '</div><div class="row-flex" style="margin-top:6px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>');
  }

  function orderModal(o) {
    o = o || {};
    var st = S.state;
    openModal('<div class="modal-head"><h3>' + (o.id ? 'ویرایش سفارش' : 'ثبت سریع سفارش') + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="order" data-id="' + (o.id || '') + '"><div class="grid2">' +
      fld('عنوان سفارش', '<input name="title" required value="' + esc(o.title || '') + '" placeholder="مثلاً طراحی فیکسچر">') +
      fld('مشتری', '<select name="customerId" required><option value="">— انتخاب —</option>' +
        st.customers.map(function (c) { return '<option value="' + c.id + '"' + (o.customerId === c.id ? ' selected' : '') + '>' + esc(c.name) + (c.company ? ' — ' + esc(c.company) : '') + '</option>'; }).join('') + '</select>') +
      fld('خدمت', '<select name="serviceId">' + st.services.map(function (s) {
        return '<option value="' + s.id + '"' + (o.serviceId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('') + '</select>') +
      fld('منبع', '<select name="source">' + Object.keys(S.SOURCES).map(function (k) {
        return '<option value="' + k + '"' + (o.source === k ? ' selected' : '') + '>' + S.SOURCES[k] + '</option>';
      }).join('') + '</select>') +
      fld('ساعات', '<input type="number" name="hours" min="1" value="' + (o.hours || 8) + '">') +
      fld('موعد تحویل', '<input type="date" name="deadline" value="' + toInputDate(o.deadline || Date.now() + 14 * 86400000) + '">') +
      fld('اولویت', '<select name="priority">' + Object.keys(S.PRIORITY).map(function (k) {
        return '<option value="' + k + '"' + (o.priority === k ? ' selected' : '') + '>' + S.PRIORITY[k] + '</option>';
      }).join('') + '</select>') +
      fld('مبلغ کل (تومان)', '<input type="number" name="quote" value="' + (o.quote || 0) + '">') +
      '</div>' +
      fld('توضیحات', '<textarea name="desc">' + esc(o.desc || '') + '</textarea>') +
      '<div class="row-flex" style="margin-top:6px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره سفارش</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>', true);
  }
  function toInputDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }

  function paymentModal(orderId, customerId) {
    var st = S.state;
    var o = orderId ? S.order(orderId) : null;
    var list = o ? [o] : st.orders.filter(function (x) { return x.customerId === customerId; });
    openModal('<div class="modal-head"><h3>ثبت پرداختی</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="payment"><div class="grid2">' +
      fld('سفارش', '<select name="orderCode" required><option value="">— انتخاب سفارش —</option>' +
        list.map(function (x) { return '<option value="' + x.code + '">' + esc(x.code + ' — ' + x.title) + '</option>'; }).join('') + '</select>') +
      fld('مبلغ (تومان)', '<input type="number" name="amount" min="1" required>') +
      fld('تاریخ پرداخت', '<input type="date" name="date" value="' + toInputDate(Date.now()) + '">') +
      fld('روش پرداخت', '<select name="method">' + S.PAY_METHODS.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select>') +
      '</div>' +
      fld('توضیحات', '<input name="note" placeholder="مثلاً پیش‌پرداخت ۴۰٪">') +
      '<div class="row-flex" style="margin-top:6px"><button class="btn btn-red" type="submit">' + icon('save') + ' ثبت پرداختی</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>');
  }

  function invoiceModal(id) {
    var o = S.order(id); if (!o) return;
    var c = S.customer(o.customerId) || {}, st = S.state;
    var paid = S.orderPaid(o), due = Math.max(0, o.quote - paid);
    var html = '<div class="modal-head no-print"><h3>پیش‌فاکتور ' + esc(o.code) + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="invoice-paper">' +
      '<div class="ip-head"><img class="ip-logo" src="assets/img/mecades-mark.png" width="52" alt="MECADES">' +
      '<div><h3>MECADES</h3><div style="font-size:12px;color:#566677;margin-top:4px">' + esc(st.settings.legalName) + '</div>' +
      '<div style="font-size:11.5px;color:#566677;margin-top:6px">' + esc(st.settings.phone1) + ' · ' + esc(st.settings.email) + '</div></div>' +
      '<div style="text-align:left;font-size:12px"><div style="font-weight:700;font-size:13px">پیش‌فاکتور</div>' +
      '<div style="color:#566677;margin-top:4px">شماره: ' + esc(o.code) + '</div>' +
      '<div style="color:#566677">تاریخ: ' + S.faDate(o.created) + '</div>' +
      '<div style="color:#566677">موعد تحویل: ' + S.faDate(o.deadline) + '</div></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;font-size:12.5px">' +
      '<div><b>مشتری:</b> ' + esc(c.name || '—') + (c.company ? '<br>' + esc(c.company) : '') + '<br><span style="color:#566677">' + esc(c.phone || '') + '</span></div>' +
      '<div><b>خدمت:</b> ' + esc(S.serviceName(o.serviceId)) + '<br><b>عنوان:</b> ' + esc(o.title) + '</div></div>' +
      '<table><thead><tr><th>شرح</th><th>ساعت</th><th>نرخ (تومان)</th><th>مبلغ (تومان)</th></tr></thead><tbody>' +
      '<tr><td>' + esc(o.title) + '</td><td>' + S.fa(o.hours) + '</td><td>' + S.fa(o.rate) + '</td><td>' + S.fa(o.quote) + '</td></tr>' +
      '</tbody><tfoot>' +
      '<tr><td colspan="3" style="text-align:left">مبلغ کل</td><td>' + S.fa(o.quote) + '</td></tr>' +
      '<tr><td colspan="3" style="text-align:left">دریافت‌شده</td><td>' + S.fa(paid) + '</td></tr>' +
      '<tr class="ip-total"><td colspan="3" style="text-align:left">مانده</td><td>' + S.fa(due) + '</td></tr>' +
      '</tfoot></table>' +
      '<div style="margin-top:26px;display:flex;justify-content:space-between;font-size:11.5px;color:#566677">' +
      '<div>مهر و امضای مکادیز</div><div>مهر و امضای مشتری</div></div>' +
      '<div style="margin-top:18px;font-size:11px;color:#7b8a99;text-align:center">این سند به‌صورت سیستمی تولید شده و معتبر است. — mecades.ir</div>' +
      '</div></div>' +
      '<div class="modal-foot no-print"><button class="btn btn-red" data-act="print">' + icon('printer') + ' چاپ / PDF</button>' +
      '<button class="btn btn-line" data-act="close-modal">بستن</button></div>';
    openModal(html, true);
  }

  function serviceModal(id) {
    var s = S.service(id); if (!s) return;
    openModal('<div class="modal-head"><h3>ویرایش خدمت</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="service" data-id="' + s.id + '">' +
      fld('عنوان خدمت', '<input name="name" value="' + esc(s.name) + '">') +
      fld('عنوان کوتاه', '<input name="short" value="' + esc(s.short || '') + '">') +
      fld('توضیح', '<textarea name="desc">' + esc(s.desc || '') + '</textarea>') +
      '<div class="grid2" style="margin-top:8px">' +
      fld('رنگ شاخص', '<input type="color" name="color" value="' + esc(s.color) + '" style="height:44px;padding:4px">') +
      fld('نرخ ساعتی ویژه (۰ = پلکانی)', '<input type="number" name="rate" value="' + S.en(s.rate || 0) + '">') +
      '</div>' +
      '<label class="switch" style="margin-top:14px"><input type="checkbox" name="active"' + (s.active ? ' checked' : '') + '><span class="track"></span>فعال در فرم سفارش</label>' +
      '<div class="row-flex" style="margin-top:16px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>');
  }

  function tierModal(id) {
    var t = id ? S.state.tiers.filter(function (x) { return x.id === id; })[0] : null;
    t = t || { id: '', label: '', max: 20, rate: 250000 };
    openModal('<div class="modal-head"><h3>' + (t.id ? 'ویرایش پلکان نرخ' : 'پلکان نرخ جدید') + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="tier" data-id="' + t.id + '"><div class="grid2">' +
      fld('عنوان بازه', '<input name="label" required value="' + esc(t.label) + '" placeholder="مثال: تا ۲۰ ساعت">') +
      fld('حداکثر ساعت', '<input type="number" name="max" min="1" value="' + t.max + '">') +
      fld('نرخ ساعتی (تومان)', '<input type="number" name="rate" min="0" value="' + S.en(t.rate) + '">') +
      fld('رنگ', '<input type="color" name="color" value="' + esc(t.color || '#3A5268') + '" style="height:44px;padding:4px">') +
      '</div><div class="row-flex" style="margin-top:8px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>');
  }

  function projectModal(id) {
    var p = id ? S.state.projects.filter(function (x) { return x.id === id; })[0] : null;
    p = p || { id: '', num: 'PORTFOLIO 0' + (S.state.projects.length + 1), title: '', cat: '', tags: [], desc: '', published: false, cls: 't1', art: 'gear' };
    openModal('<div class="modal-head"><h3>' + (p.id ? 'ویرایش نمونه‌کار' : 'نمونه‌کار جدید') + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="project" data-id="' + p.id + '"><div class="grid2">' +
      fld('شماره', '<input name="num" value="' + esc(p.num) + '">') +
      fld('عنوان', '<input name="title" required value="' + esc(p.title) + '">') +
      fld('دسته', '<input name="cat" value="' + esc(p.cat) + '">') +
      fld('برچسب‌ها (با , جدا کنید)', '<input name="tags" value="' + esc((p.tags || []).join('، ')) + '">') +
      fld('طرح گرافیکی', '<select name="art">' +
        [['gear', 'چرخ‌دنده'], ['gauge', 'نمایشگر'], ['machine', 'ماشین'], ['clamp', 'فیکسچر'], ['screen', 'سرند']]
          .map(function (a) { return '<option value="' + a[0] + '"' + (p.art === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select>') +
      fld('گرادیان رنگی', '<select name="cls">' +
        ['t1', 't2', 't3', 't4', 't5'].map(function (c) { return '<option value="' + c + '"' + (p.cls === c ? ' selected' : '') + '>' + c.toUpperCase() + '</option>'; }).join('') + '</select>') +
      '</div>' +
      fld('توضیح', '<textarea name="desc">' + esc(p.desc) + '</textarea>') +
      '<label class="switch" style="margin-top:14px"><input type="checkbox" name="published"' + (p.published ? ' checked' : '') + '><span class="track"></span>منتشرشده در سایت</label>' +
      '<div class="row-flex" style="margin-top:16px"><button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره</button>' +
      '<button type="button" class="btn btn-line" data-act="close-modal">انصراف</button></div></form></div>');
  }

  function confirmModal(title, text, act, id) {
    openModal('<div class="modal-head"><h3>' + esc(title) + '</h3><button class="x" data-act="close-modal">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><p style="line-height:2">' + esc(text) + '</p></div>' +
      '<div class="modal-foot"><button class="btn btn-red" data-act="' + act + '" data-id="' + (id || '') + '">' + icon('trash') + ' بله، انجام بده</button>' +
      '<button class="btn btn-line" data-act="close-modal">انصراف</button></div>');
  }

  /* command palette */
  function openCmdk(query) {
    openModal('<div class="cmdk"><input id="cmdk-input" placeholder="جستجوی سفارش، مشتری، نمونه‌کار…" value="' + esc(query || '') + '">' +
      '<div class="cmdk-list" id="cmdk-list"></div></div>');
    var input = document.getElementById('cmdk-input');
    input.focus();
    input.addEventListener('input', function () { renderCmdk(input.value); });
    renderCmdk(query || '');
  }
  function renderCmdk(q) {
    var list = document.getElementById('cmdk-list'); if (!list) return;
    q = (q || '').toLowerCase();
    var res = [];
    S.state.orders.forEach(function (o) {
      if (!q || (o.title + o.code + S.customerName(o.customerId)).toLowerCase().indexOf(q) > -1)
        res.push({ ic: 'orders', t: o.title, s: o.code + ' · ' + S.customerName(o.customerId), go: '#/orders/' + o.id });
    });
    S.state.customers.forEach(function (c) {
      if (!q || (c.name + (c.company || '') + c.phone).toLowerCase().indexOf(q) > -1)
        res.push({ ic: 'users', t: c.name, s: (c.company || '') + ' · ' + c.phone, go: '#/customers/' + c.id });
    });
    S.state.projects.forEach(function (p) {
      if (!q || p.title.toLowerCase().indexOf(q) > -1)
        res.push({ ic: 'box', t: p.title, s: p.num, go: '#/projects' });
    });
    res = res.slice(0, 12);
    list.innerHTML = res.length ? res.map(function (r, i) {
      return '<div class="cmdk-item" data-act="cmdk-go" data-go="' + r.go + '"><span class="ic">' + icon(r.ic) + '</span><span><b>' + esc(r.t) + '</b><small>' + esc(r.s) + '</small></span></div>';
    }).join('') : '<div class="cmdk-empty">نتیجه‌ای یافت نشد</div>';
  }

  /* ================= routing ================= */
  function currentRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'dashboard', id = parts[1] || null;
    if (name === 'orders') {
      if (!id) name = 'orders';
      else if (id === 'new') { name = 'new-order'; id = null; }
      else name = 'order';
    }
    if (name === 'customers') {
      if (!id) name = 'customers';
      else name = 'customer';
    }
    if (name === 'users') {
      if (!id) name = 'users';
      else name = 'user';
    }
    return { name: name, id: id };
  }
  var TITLES = {
    dashboard: ['داشبورد', 'نمای کلی وضعیت مکادیز'],
    orders: ['مدیریت سفارش‌ها', 'سفارش‌های ثبت‌شده و مراحل انجام'],
    order: ['جزئیات سفارش', 'مشخصات، مالی و تاریخچه'],
    'new-order': ['ثبت سفارش جدید', 'فرم ثبت پروژه و برآورد هزینه'],
    quick: ['کانال‌های ارتباطی', 'سفارش‌های ثبت‌شده از سایت و پیام‌رسان‌ها'],
    customers: ['مشتریان', 'فهرست و سوابق مشتریان'],
    customer: ['پرونده مشتری', 'صورت‌حساب و تاریخچه'],
    accounting: ['حسابداری', 'پرتفوی مالی و گزارش تراکنش‌ها'],
    services: ['خدمات و نرخنامه', 'پیشنهاد قیمت و زمان'],
    projects: ['نمونه‌کارها', 'مدیریت محصولات سایت'],
    reports: ['گزارش‌ها', 'فروش، ساعات و عملکرد'],
    settings: ['تنظیمات', 'پیکربندی پنل'],
    users: ['کاربران', 'حساب‌های کاربری و سطح دسترسی'],
    user: ['گزارش کارکرد کاربر', 'سفارش‌ها و پرداختی‌های ثبت‌شده'],
    profile: ['مشخصات من', 'اطلاعات تماس و شماره حساب']
  };
  var ROUTE_PERM = {
    dashboard: 'dashboard.view', orders: 'order.view', order: 'order.view', 'new-order': 'order.create',
    quick: 'order.view', customers: 'customer.view', customer: 'customer.view',
    accounting: 'accounting.view', reports: 'reports.view', services: 'service.view',
    projects: 'project.view', users: 'user.manage', user: 'user.manage',
    settings: 'settings.view', profile: 'profile.view'
  };
  function render() {
    if (!Auth.current()) { showAuth(Auth.isSetup() ? 'login' : 'setup'); return; }
    var r = currentRoute();
    var need = ROUTE_PERM[r.name];
    var html = '';
    if (need && !Auth.can(need)) {
      html = '<div class="card"><div class="card-body">' + emptyBox('دسترسی ندارید',
        'نقش کاربری شما (' + ((Auth.ROLES[(Auth.current() || {}).role] || {}).label || 'کاربر') + ') اجازهٔ مشاهدهٔ این بخش را ندارد.',
        'shield') + '<div class="row-flex" style="justify-content:center;margin-top:10px">' +
        '<a class="btn btn-line btn-sm" href="#/dashboard">' + icon('dash') + ' بازگشت به داشبورد</a></div></div></div>';
      viewEl.innerHTML = html;
      enhanceTables(viewEl);
      viewEl.classList.remove('fade-in'); void viewEl.offsetWidth; viewEl.classList.add('fade-in');
      var tt0 = document.getElementById('tbTitle');
      if (tt0) tt0.innerHTML = '<h1>دسترسی ندارید</h1><p>این بخش برای نقش شما محدود شده است</p>';
      document.querySelectorAll('.nav a').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#/' + r.name);
      });
      document.querySelectorAll('[data-perm]').forEach(function (el) {
        el.classList.toggle('perm-off', !Auth.can(el.getAttribute('data-perm')));
      });
      updateClock();
      return;
    }
    var fn = views[r.name] || views.dashboard;
    try { html = fn(r.id); } catch (e) { html = '<div class="card"><div class="card-body">' + emptyBox('خطا در نمایش صفحه', String(e && e.message), 'x') + '</div></div>'; }
    viewEl.innerHTML = html;
    enhanceTables(viewEl);
    viewEl.classList.remove('fade-in'); void viewEl.offsetWidth; viewEl.classList.add('fade-in');
    var t = TITLES[r.name] || TITLES.dashboard;
    var tt = document.getElementById('tbTitle');
    if (tt) tt.innerHTML = '<h1>' + esc(t[0]) + '</h1><p>' + esc(t[1]) + '</p>';
    /* nav active */
    var navKey = r.name === 'order' ? 'orders' : (r.name === 'customer' ? 'customers' : (r.name === 'new-order' ? 'orders' : r.name));
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#/' + navKey);
    });
    /* page-specific */
    if (r.name === 'new-order') {
      var h = document.getElementById('f-hours');
      if (h) h.addEventListener('input', function () {
        var box = document.getElementById('estimator');
        if (box) box.innerHTML = estimatorHTML(parseInt(h.value || '0', 10));
      });
      var d = document.getElementById('f-deadline');
      if (d && !d.value) d.value = toInputDate(Date.now() + 14 * 86400000);
    }
    if (r.name === 'services') {
      var ch = document.getElementById('calc-hours');
      if (ch) ch.addEventListener('input', function () {
        var out = document.getElementById('calc-out');
        if (out) out.innerHTML = estimatorHTML(parseInt(ch.value || '0', 10));
      });
    }
    /* اطلاعات کاربر در سایدبار */
    var cu = Auth.current();
    if (cu) applyUser(cu);
    /* نسخه (با هر ویرایش یک واحد بالا می‌رود) */
    updateVersion();
    /* سطح دسترسی: مخفی‌سازی موارد غیرمجاز */
    document.querySelectorAll('[data-perm]').forEach(function (el) {
      el.classList.toggle('perm-off', !Auth.can(el.getAttribute('data-perm')));
    });
    updateClock();
    document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function updateVersion() {
    var v = 'v.' + S.version();
    document.querySelectorAll('[data-ver]').forEach(function (el) { el.textContent = v; });
  }
  /* با هر ویرایش، نسخه بلافاصله در همهٔ بخش‌ها به‌روز می‌شود */
  document.addEventListener('mecades:edit', updateVersion);
  function updateClock() {
    var d = new Date();
    var t = document.querySelectorAll('[data-clock-time]');
    var dt = document.querySelectorAll('[data-clock-date]');
    if (!t.length) return;
    var hh = d.getHours(), mm = d.getMinutes();
    var str = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    t.forEach(function (el) { el.textContent = str; });
    dt.forEach(function (el) { el.textContent = S.faDay(d.getTime()); });
    /* ساعت‌شمار فعالیت‌های باز */
    document.querySelectorAll('[data-ts-elapsed]').forEach(function (el) {
      var run = S.runningSession(el.getAttribute('data-ts-elapsed'));
      if (run) el.textContent = secLabel(S.sessionSeconds(run));
    });
  }

  /* ================= events ================= */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');
    /* کنترل سطح دسترسی */
    if (el.getAttribute('data-perm') && !Auth.can(el.getAttribute('data-perm'))) {
      toast('شما به این بخش دسترسی ندارید', 'err'); return;
    }

    switch (act) {
      case 'close-modal': closeModal(); break;
      case 'open-order': location.hash = '#/orders/' + id; break;
      case 'open-customer': location.hash = '#/customers/' + id; break;
      case 'new-customer': customerModal(null); break;
      case 'edit-customer': customerModal(S.customer(id)); break;
      case 'del-customer':
        confirmModal('حذف مشتری', 'با حذف این مشتری، سفارش‌های او حذف نمی‌شود اما ارتباطشان با مشتری گسسته می‌شود. ادامه می‌دهید؟', 'do-del-customer', id);
        break;
      case 'do-del-customer':
        S.removeCustomer(id); closeModal(); toast('مشتری حذف شد', 'ok'); render(); break;
      case 'pay': paymentModal(id, null); break;
      case 'customer-pay': paymentModal(null, id); break;
      case 'invoice': invoiceModal(id); break;
      case 'print': window.print(); break;
      case 'set-status':
        S.updateOrder(id, { status: el.getAttribute('data-status') });
        S.log('وضعیت سفارش به «' + S.STATUS[el.getAttribute('data-status')].label + '» تغییر کرد', el.getAttribute('data-status'));
        toast('وضعیت سفارش به‌روزرسانی شد', 'ok'); render(); break;
      case 'open-quick': orderModal(null); break;
      case 'edit-order': orderModal(S.order(id)); break;
      case 'del-order':
        confirmModal('حذف سفارش', 'این سفارش و پرداختی‌های ثبت‌شده برای آن حذف می‌شوند. ادامه می‌دهید؟', 'do-del-order', id);
        break;
      case 'do-del-order':
        S.removeOrder(id); closeModal(); toast('سفارش حذف شد', 'ok'); location.hash = '#/orders'; render(); break;
      case 'edit-service': serviceModal(id); break;
      case 'edit-tier': tierModal(id); break;
      case 'add-tier': tierModal(null); break;
      case 'del-tier':
        S.state.tiers = S.state.tiers.filter(function (t) { return t.id !== id; });
        S.touch(); toast('پلکان نرخ حذف شد', 'ok'); render(); break;
      case 'new-project': projectModal(null); break;
      case 'edit-project': projectModal(id); break;
      case 'del-project':
        S.state.projects = S.state.projects.filter(function (p) { return p.id !== id; });
        S.touch(); toast('نمونه‌کار حذف شد', 'ok'); render(); break;
      case 'acc-period':
        window.__filters = window.__filters || {};
        window.__filters.accounting = { period: el.getAttribute('data-period') };
        render(); break;
      case 'toggle-theme': {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        setTheme(next); break;
      }
      case 'set-theme': setTheme(el.getAttribute('data-theme')); break;
      case 'csv-orders': exportOrdersCSV(); break;
      case 'csv-tx': exportTxCSV(); break;
      case 'csv-report': exportReportCSV(); break;
      case 'export-json':
        download('mecades-admin-backup.json', S.exportJSON(), 'application/json');
        toast('فایل پشتیبان دانلود شد', 'ok'); break;
      case 'gas-guide': gasGuideModal(); break;
      case 'gas-save': {
        var uIn = document.querySelector('input[name="gasUrl"]');
        var tIn = document.querySelector('input[name="gasToken"]');
        var uVal = (uIn && uIn.value || '').trim();
        var tVal = (tIn && tIn.value || '').trim();
        if (uVal && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_\-]+\/(exec|dev)/.test(uVal)) {
          toast('آدرس باید با https://script.google.com/macros/s/…/exec شروع شود');
          break;
        }
        gasSet(uVal || null, tVal || null);
        toast(uVal ? 'آدرس ذخیره شد' : 'اتصال حذف شد', 'ok');
        render(); break;
      }
      case 'gas-send': gasSend(el); break;
      case 'gas-ping': gasPing(el); break;
      case 'backup-code': backupCodeModal(); break;
      case 'restore-code': restoreCodeModal(); break;
      case 'copy-backup-code': {
        var box = document.getElementById('backupCodeBox');
        if (!box) break;
        box.removeAttribute('readonly'); box.select(); box.setSelectionRange(0, box.value.length);
        var done = false;
        try { done = document.execCommand('copy'); } catch (e) { done = false; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(box.value).then(function () { toast('کد پشتیبان کپی شد', 'ok'); }).catch(function () {});
        }
        box.setAttribute('readonly', 'readonly');
        if (done) toast('کد پشتیبان کپی شد — در Google Doc بچسبانید', 'ok');
        else toast('کد انتخاب شد؛ با Ctrl+C کپی کنید', 'warn');
        break;
      }
      case 'download-backup-code':
        download('mecades-backup-code-' + new Date().toISOString().slice(0, 10) + '.txt',
          document.getElementById('backupCodeBox') ? document.getElementById('backupCodeBox').value : backupCodeText(S.backupCode()),
          'text/plain;charset=utf-8');
        toast('فایل متنی کد پشتیبان دانلود شد', 'ok'); break;
      case 'import-json':
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = function () {
          var f = inp.files[0]; if (!f) return;
          var fr = new FileReader();
          fr.onload = function () {
            try { S.importJSON(fr.result); toast('اطلاعات بازیابی شد', 'ok'); render(); }
            catch (err) { toast('خطا در خواندن فایل', 'err'); }
          };
          fr.readAsText(f);
        };
        inp.click(); break;
      case 'reset-data':
        confirmModal('بازنشانی داده‌ها', 'همه سفارش‌ها، مشتریان و تنظیمات به حالت اولیه (داده نمونه) برمی‌گردد. ادامه می‌دهید؟', 'do-reset', '');
        break;
      case 'do-reset':
        S.reset(); closeModal(); toast('داده‌ها بازنشانی شد', 'ok'); location.hash = '#/dashboard'; render(); break;
      case 'logout': {
        closeAcct();
        S.log('خروج از حساب کاربری', 'cancel');
        Auth.logout();
        closeModal();
        location.hash = '#/dashboard';
        showAuth('login');
        toast('از حساب کاربری خارج شدید', 'ok');
        break;
      }
      case 'auth-demo': {
        var uEl = document.getElementById('authUser'), pEl = document.getElementById('authPass');
        if (uEl) uEl.value = el.getAttribute('data-user');
        if (pEl) pEl.value = el.getAttribute('data-pass');
        submitAuth();
        break;
      }
      case 'auth-reset':
        confirmModal('بازنشانی این مرورگر',
          'تمام حساب‌های کاربری، نشست‌ها و داده‌های پنل از این مرورگر پاک می‌شود و سیستم به حالت راه‌اندازی اولیه برمی‌گردد. ادامه می‌دهید؟',
          'do-auth-reset', '');
        break;
      case 'do-auth-reset':
        Auth.resetBrowser(); S.reset(); closeModal();
        location.hash = '#/dashboard';
        showAuth('setup');
        toast('این مرورگر بازنشانی شد', 'ok');
        break;
      case 'auth-reset-all':
        confirmModal('راه‌اندازی اولیه سیستم',
          'با ادامه، همهٔ حساب‌های کاربری حذف می‌شوند و یک حساب مدیر جدید ساخته می‌شود. داده‌های سفارش‌ها دست‌نخورده می‌مانند. ادامه می‌دهید؟',
          'do-auth-reset', '');
        break;
      case 'auth-setup':
        confirmModal('راه‌اندازی اولیه سیستم',
          'برای ساخت حساب جدید، حساب‌های فعلی حذف می‌شوند. ادامه می‌دهید؟', 'do-auth-reset', '');
        break;
      case 'auth-seed':
        Auth.seedDemo().then(function () {
          toast('حساب‌های نمایشی ساخته شد', 'ok');
          showAuth('login');
        });
        break;
      case 'user-new': userModal(null); break;
      case 'user-edit': userModal(Auth.users().filter(function (u) { return u.id === id; })[0]); break;
      case 'user-pass': {
        var up = Auth.users().filter(function (u) { return u.id === id; })[0];
        if (up) passwordModal(up);
        break;
      }
      case 'user-toggle': {
        var ut = Auth.users().filter(function (u) { return u.id === id; })[0];
        if (!ut) break;
        Auth.update(id, { active: ut.active === false }).then(function () {
          S.touch();
          toast(ut.active === false ? 'کاربر فعال شد' : 'کاربر غیرفعال شد', 'ok'); render();
        });
        break;
      }
      case 'user-del':
        confirmModal('حذف کاربر', 'این حساب کاربری حذف می‌شود و امکان ورود آن وجود نخواهد داشت. ادامه می‌دهید؟', 'do-user-del', id);
        break;
      case 'do-user-del':
        Auth.remove(id); S.touch(); closeModal(); toast('کاربر حذف شد', 'ok'); render(); break;
      case 'excel-backup': exportExcelBackup(); break;
      case 'cmdk-go': closeModal(); location.hash = el.getAttribute('data-go'); break;
      case 'open-cmdk': closeAcct(); openCmdk(''); break;
      case 'toggle-layout': toggleLayout(); break;
      case 'set-layout':
        setLayout(el.getAttribute('data-layout-mode'));
        toast(layout() === 'cards' ? 'چیدمان کارتی فعال شد' : 'چیدمان کناری فعال شد', 'ok');
        break;
      case 'ts-menu': openTimeMenu(); break;
      case 'ts-open': openTimeModal(el.getAttribute('data-id')); break;
      case 'ts-stop': {
        var tu = Auth.users().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
        var meNow3 = Auth.current();
        if (!tu || !meNow3) break;
        if (!canAllTeam() && tu.id !== meNow3.id) { toast('اجازهٔ پایان فعالیت دیگران را ندارید', 'err'); break; }
        var er = S.endSession(tu.id);
        if (!er.ok) { toast(er.error || 'خطا', 'err'); break; }
        S.log('پایان فعالیت ' + S.activityName(er.session.activityId) + ' (' + tu.name + ')', 'done');
        closeModal(); toast('فعالیت بسته شد و در دستمزد ثبت گردید', 'ok'); render(); break;
      }
      case 'act-new': openActivityModal(); break;
      case 'act-edit': openActivityModal(el.getAttribute('data-id')); break;
      case 'act-del': {
        var delA = S.activity(el.getAttribute('data-id'));
        if (!delA) break;
        var dr = S.removeActivity(delA.id);
        S.log('حذف فعالیت «' + delA.name + '»', 'cancel');
        toast(dr.deactivated ? 'این فعالیت استفاده شده؛ غیرفعال شد' : 'فعالیت حذف شد', 'ok');
        render(); break;
      }
      case 'go-home':
        closeAcct();
        if (location.hash === '#/dashboard') { window.scrollTo ? window.scrollTo(0, 0) : null; }
        else location.hash = '#/dashboard';
        break;
      case 'go-back':
        closeAcct();
        if (window.history && window.history.length > 1) window.history.back();
        else location.hash = '#/dashboard';
        break;
      case 'toggle-acct':
        var acct = document.getElementById('acct');
        if (acct) acct.classList.toggle('open');
        break;
      case 'acct-go': closeAcct(); break;
      case 'toggle-sidebar':
        var sb = document.getElementById('sidebar');
        sb.classList.toggle('open');
        if (sb.classList.contains('open')) {
          var sc = document.createElement('div'); sc.className = 'scrim'; sc.setAttribute('data-act', 'close-sidebar');
          document.body.appendChild(sc);
        } else { var s2 = document.querySelector('.scrim'); if (s2) s2.remove(); }
        break;
      case 'close-sidebar':
        var sb2 = document.getElementById('sidebar'); if (sb2) sb2.classList.remove('open');
        var s3 = document.querySelector('.scrim'); if (s3) s3.remove();
        break;
    }
  });

  /* filter inputs */
  function setFilter(el) {
    var parts = el.getAttribute('data-filter').split('.');
    window.__filters = window.__filters || {};
    window.__filters[parts[0]] = window.__filters[parts[0]] || {};
    window.__filters[parts[0]][parts[1]] = el.value;
    clearTimeout(window.__ft);
    var delay = el.tagName === 'SELECT' ? 0 : 280;
    window.__ft = setTimeout(function () {
      render();
      var i = document.querySelector('[data-filter="' + el.getAttribute('data-filter') + '"]');
      if (i) { i.focus(); if (i.setSelectionRange) { try { i.setSelectionRange(i.value.length, i.value.length); } catch (x) {} } }
    }, delay);
  }
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-filter]');
    if (el) setFilter(el);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-filter]');
    if (el) setFilter(el);
  });

  /* forms */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var fd = new FormData(f);
    var kind = f.getAttribute('data-form');
    var id = f.getAttribute('data-id');

    if (kind === 'restore-code') {
      S.restoreCode(fd.get('code')).then(function (res) {
        var me = Auth.current();
        var stillThere = me && Auth.users().some(function (u) { return u.id === me.id; });
        closeModal();
        toast('بازیابی انجام شد — ' + S.fa(res.orders) + ' سفارش، ' + S.fa(res.customers) + ' مشتری و ' +
          S.fa(res.users) + ' کاربر', 'ok');
        if (!stillThere) { setTimeout(function () { location.reload(); }, 900); return; }
        location.hash = '#/dashboard'; render();
      }).catch(function (err) { toast((err && err.message) || 'کد پشتیبان معتبر نیست'); });
      return;
    }

    if (kind === 'customer') {
      var c = { name: fd.get('name'), phone: fd.get('phone'), company: fd.get('company'), email: fd.get('email'), address: fd.get('address'), note: fd.get('note') };
      if (id) { S.updateCustomer(id, c); toast('اطلاعات مشتری به‌روزرسانی شد', 'ok'); }
      else { S.addCustomer(c); toast('مشتری جدید ثبت شد', 'ok'); }
      closeModal(); render(); return;
    }

    if (kind === 'order') {
      var hours = parseInt(fd.get('hours') || '8', 10);
      var tier = S.tierFor(S.state.tiers, hours);
      var quote = parseInt(fd.get('quote') || '0', 10) || Math.max(hours * tier.rate, S.state.settings.minOrder);
      var data = {
        title: fd.get('title'), customerId: fd.get('customerId'), serviceId: fd.get('serviceId'),
        source: fd.get('source'), hours: hours, rate: tier.rate, quote: quote,
        deadline: new Date(fd.get('deadline')).getTime() || Date.now() + 14 * 86400000,
        priority: fd.get('priority'), desc: fd.get('desc'), status: 'new', quick: true
      };
      if (id) { S.updateOrder(id, data); toast('سفارش بروزرسانی شد', 'ok'); }
      else { S.addOrder(data); toast('سفارش سریع ثبت شد', 'ok'); }
      closeModal(); location.hash = '#/orders'; render(); return;
    }

    if (kind === 'new-order') {
      var hrs = parseInt(fd.get('hours') || '10', 10);
      var tr = S.tierFor(S.state.tiers, hrs);
      var q2 = Math.max(hrs * tr.rate, S.state.settings.minOrder);
      var cid = fd.get('customerId');
      var newName = (fd.get('newCustomerName') || '').trim();
      if (!cid && newName) {
        var nc = S.addCustomer({ name: newName, phone: (fd.get('newCustomerPhone') || '').trim(), company: '', email: '', address: '', note: '' });
        cid = nc.id;
        toast('مشتری «' + newName + '» ساخته شد', 'ok');
      }
      if (!cid) { toast('ابتدا مشتری را انتخاب کنید', 'err'); return; }
      var o = {
        title: fd.get('title'), customerId: cid, serviceId: fd.get('serviceId'),
        source: fd.get('source'), hours: hrs, rate: tr.rate, quote: q2,
        deadline: new Date(fd.get('deadline')).getTime() || Date.now() + 14 * 86400000,
        priority: fd.get('priority'), desc: fd.get('desc'), status: 'new', files: []
      };
      var created = S.addOrder(o);
      var prepaid = parseInt(fd.get('paid') || '0', 10);
      if (prepaid > 0) {
        S.addPayment({ orderCode: created.code, customerId: cid, amount: prepaid, date: Date.now(), method: S.PAY_METHODS[0], note: 'پیش‌پرداخت ثبت سفارش' });
      }
      toast('سفارش «' + o.title + '» ثبت شد', 'ok');
      location.hash = '#/orders/' + created.id; render(); return;
    }

    if (kind === 'payment') {
      var code = fd.get('orderCode');
      var target = S.state.orders.filter(function (x) { return x.code === code; })[0];
      if (!target) { toast('سفارش نامعتبر است', 'err'); return; }
      S.addPayment({
        orderCode: code, customerId: target.customerId, amount: parseInt(fd.get('amount'), 10),
        date: new Date(fd.get('date')).getTime() || Date.now(), method: fd.get('method'), note: fd.get('note')
      });
      toast('پرداختی ثبت شد', 'ok'); closeModal(); render(); return;
    }

    if (kind === 'service') {
      var s = S.service(id);
      if (s) {
        s.name = fd.get('name'); s.short = fd.get('short'); s.desc = fd.get('desc');
        s.color = fd.get('color'); s.rate = parseInt(fd.get('rate') || '0', 10);
        s.active = fd.get('active') === 'on';
        S.touch(); toast('خدمت به‌روزرسانی شد', 'ok');
      }
      closeModal(); render(); return;
    }

    if (kind === 'tier') {
      var t = id ? S.state.tiers.filter(function (x) { return x.id === id; })[0] : null;
      var obj = { label: fd.get('label'), max: parseInt(fd.get('max') || '20', 10), rate: parseInt(fd.get('rate') || '0', 10), color: fd.get('color') };
      if (t) { Object.assign(t, obj); toast('پلکان نرخ به‌روزرسانی شد', 'ok'); }
      else { obj.id = S.uid('t'); S.state.tiers.push(obj); toast('پلکان نرخ اضافه شد', 'ok'); }
      S.touch(); closeModal(); render(); return;
    }

    if (kind === 'project') {
      var tags = (fd.get('tags') || '').split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var p = id ? S.state.projects.filter(function (x) { return x.id === id; })[0] : null;
      var po = { num: fd.get('num'), title: fd.get('title'), cat: fd.get('cat'), tags: tags, desc: fd.get('desc'), art: fd.get('art'), cls: fd.get('cls'), published: fd.get('published') === 'on' };
      if (p) { Object.assign(p, po); toast('نمونه‌کار به‌روزرسانی شد', 'ok'); }
      else { po.id = S.uid('p'); S.state.projects.push(po); toast('نمونه‌کار جدید اضافه شد', 'ok'); }
      S.touch(); closeModal(); render(); return;
    }

    if (kind === 'user') {
      var uFirst = (fd.get('firstName') || '').trim();
      var uLast = (fd.get('lastName') || '').trim();
      var uUser = (fd.get('username') || '').trim();
      var uRole = fd.get('role') || 'viewer';
      if (!uFirst || !uLast || !uUser) { toast('نام، نام خانوادگی و نام کاربری الزامی است', 'err'); return; }
      if (id) {
        Auth.update(id, { firstName: uFirst, lastName: uLast, username: uUser, role: uRole, active: fd.get('active') === '1',
            phone: (fd.get('phone') || '').trim(), account: (fd.get('account') || '').trim() })
          .then(function () { S.touch(); toast('اطلاعات کاربر به‌روزرسانی شد', 'ok'); closeModal(); render(); })
          .catch(function (e) { toast(e.message || 'خطا در ذخیره', 'err'); });
        return;
      }
      var pwd = (fd.get('password') || '').trim();
      Auth.create({ firstName: uFirst, lastName: uLast, username: uUser, password: pwd, role: uRole,
          phone: (fd.get('phone') || '').trim(), account: (fd.get('account') || '').trim() })
        .then(function (nu) {
          S.touch();
          toast(pwd ? 'کاربر جدید ساخته شد' : 'کاربر ساخته شد؛ رمز در اولین ورود توسط خودش تعیین می‌شود', 'ok');
          closeModal(); render();
        })
        .catch(function (e) { toast(e.message || 'خطا در ساخت کاربر', 'err'); });
      return;
    }

    if (kind === 'my-profile') {
      var meNow = Auth.current();
      if (!meNow) { toast('نشست فعال نیست', 'err'); return; }
      Auth.update(meNow.id, { phone: (fd.get('phone') || '').trim(), account: (fd.get('account') || '').trim() })
        .then(function () { S.touch(); toast('مشخصات شما ذخیره شد', 'ok'); render(); })
        .catch(function (e) { toast(e.message || 'خطا در ذخیره', 'err'); });
      return;
    }

    if (kind === 'user-pass') {
      var p1 = fd.get('pwd1') || '', p2 = fd.get('pwd2') || '';
      if (p1 !== p2) { toast('رمز عبور و تکرار آن یکسان نیست', 'err'); return; }
      Auth.setPassword(id, p1)
        .then(function () { S.touch(); toast('رمز عبور تغییر کرد', 'ok'); closeModal(); render(); })
        .catch(function (e) { toast(e.message || 'خطا در تغییر رمز', 'err'); });
      return;
    }

    if (kind === 'force-pass') {
      var fp1 = fd.get('pwd1') || '', fp2 = fd.get('pwd2') || '';
      if (fp1 !== fp2) { toast('رمز عبور و تکرار آن یکسان نیست', 'err'); return; }
      Auth.setPassword(id, fp1)
        .then(function () { S.touch(); closeModal(); toast('رمز عبور با موفقیت تغییر کرد', 'ok'); render(); })
        .catch(function (e) { toast(e.message || 'خطا در تغییر رمز', 'err'); });
      return;
    }

    if (kind === 'ts-start') {
      var actId = fd.get('activity'), ord = fd.get('order') || null;
      var target = Auth.users().filter(function (x) { return x.id === id; })[0];
      var meNow2 = Auth.current();
      if (!target || !meNow2) { toast('کاربر نامعتبر است', 'err'); return; }
      if (!canAllTeam() && target.id !== meNow2.id) { toast('اجازهٔ ثبت فعالیت برای دیگران را ندارید', 'err'); return; }
      var res = S.startSession({ userId: target.id, userName: target.name, activityId: actId, orderId: ord, note: fd.get('note') || '' });
      if (!res.ok) { toast(res.error || 'خطا در ثبت فعالیت', 'err'); return; }
      S.log('شروع فعالیت ' + S.activityName(actId) + ' توسط ' + target.name, 'pulse');
      closeModal(); toast('فعالیت آغاز شد — ساعت‌شمار روشن است', 'ok'); render(); return;
    }

    if (kind === 'activity') {
      if (!canAllTeam()) { toast('فقط مدیر می‌تواند فعالیت تعریف کند', 'err'); return; }
      var payload = {
        name: fd.get('name'), rate: fd.get('rate'), desc: fd.get('desc'),
        needOrder: fd.get('needOrder') === 'on'
      };
      var ar = id ? S.updateActivity(id, payload) : S.addActivity(payload);
      if (!ar.ok) { toast(ar.error || 'خطا در ذخیره فعالیت', 'err'); return; }
      S.log((id ? 'ویرایش' : 'افزودن') + ' فعالیت «' + payload.name + '» با نرخ ' + S.money(payload.rate), 'done');
      closeModal(); toast('فعالیت ذخیره شد', 'ok'); render(); return;
    }

    if (kind === 'settings') {
      var s2 = S.state.settings;
      ['company', 'legalName', 'phone1', 'phone2', 'email', 'address', 'invoicePrefix', 'owner'].forEach(function (k) { s2[k] = fd.get(k); });
      s2.minOrder = parseInt(fd.get('minOrder') || '500000', 10);
      s2.hoursPerDay = parseInt(fd.get('hoursPerDay') || '8', 10);
      S.touch(); toast('تنظیمات ذخیره شد', 'ok'); render(); return;
    }
  });

  /* keyboard */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(''); }
    if (e.key === 'Escape') { closeModal(); }
  });

  /* theme */
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('mecades_theme', t); } catch (e) {}
    var b = document.getElementById('themeBtn');
    if (b) b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
    toast(t === 'dark' ? 'حالت تیره فعال شد' : 'حالت روشن فعال شد', 'ok');
  }
  function initTheme() {
    var t = null;
    try { t = localStorage.getItem('mecades_theme'); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    var b = document.getElementById('themeBtn');
    if (b) b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  }

  /* toast */
  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'ok' ? ' ok' : '');
    el.innerHTML = icon(kind === 'ok' ? 'check' : 'bell') + '<span>' + esc(msg) + '</span>';
    toastsEl.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; setTimeout(function () { el.remove(); }, 300); }, 3200);
  }
  window.toast = toast;

  /* CSV exports */
  function exportOrdersCSV() {
    var rows = [['کد سفارش', 'تاریخ', 'مشتری', 'شرکت', 'خدمت', 'ساعات', 'نرخ', 'مبلغ', 'پرداختی', 'مانده', 'موعد', 'وضعیت', 'منبع']];
    S.state.orders.forEach(function (o) {
      var c = S.customer(o.customerId) || {};
      rows.push([o.code, S.faDate(o.created), S.customerName(o.customerId), c.company || '', S.serviceName(o.serviceId),
        o.hours, o.rate, o.quote, S.orderPaid(o), Math.max(0, o.quote - S.orderPaid(o)), S.faDate(o.deadline),
        S.STATUS[o.status].label, S.SOURCES[o.source] || o.source]);
    });
    download('mecades-orders.csv', toFaCSV(rows), 'text/csv;charset=utf-8');
    toast('فایل CSV سفارش‌ها دانلود شد', 'ok');
  }
  function exportTxCSV() {
    var rows = [['تاریخ', 'نوع', 'مشتری', 'شماره سفارش', 'مبلغ (تومان)', 'توضیحات']];
    S.state.payments.forEach(function (p) {
      rows.push([S.faDate(p.date), 'دریافت', S.customerName(p.customerId), p.orderCode, p.amount, p.method + ' ' + (p.note || '')]);
    });
    S.state.orders.forEach(function (o) {
      rows.push([S.faDate(o.created), 'فروش (سفارش)', S.customerName(o.customerId), o.code, o.quote, o.title]);
    });
    rows.sort(function (a, b) { return 0; });
    download('mecades-transactions.csv', toFaCSV(rows), 'text/csv;charset=utf-8');
    toast('فایل تراکنش‌ها دانلود شد', 'ok');
  }
  function exportReportCSV() {
    var rows = [['ماه', 'تعداد سفارش', 'ساعات', 'فروش (تومان)', 'تحویل‌شده']];
    monthSeries(8).forEach(function (m) {
      var os = S.state.orders.filter(function (o) { return S.monthKey(o.created) === m.key; });
      var jm2 = S.g2j(new Date(m.ts).getFullYear(), new Date(m.ts).getMonth() + 1, new Date(m.ts).getDate());
      rows.push([S.MONTHS[jm2[1] - 1], os.length,
        os.reduce(function (a, o) { return a + o.hours; }, 0),
        os.reduce(function (a, o) { return a + o.quote; }, 0),
        os.filter(function (o) { return o.status === 'done'; }).length]);
    });
    download('mecades-report.csv', toFaCSV(rows), 'text/csv;charset=utf-8');
    toast('گزارش دانلود شد', 'ok');
  }

  /* ================= فعالیت کاربران و دستمزد ================= */
  function secLabel(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s2 = sec % 60;
    function p2(n) { return (n < 10 ? '۰' : '') + S.fa(n); }
    return p2(h) + ':' + p2(m) + ':' + p2(s2);
  }
  function hoursLabel(sec) { return S.fa((sec / 3600).toFixed(1)) + ' ساعت'; }
  function wageLabel(n) { return S.fa(S.moneyShort(Math.round(n || 0))) + ' تومان'; }
  function canAllTeam() { return Auth.can('user.manage'); }
  function teamUsers() {
    var me = Auth.current();
    var all = Auth.users().filter(function (u) { return u.active !== false; });
    if (canAllTeam() && me) return all;
    return me ? all.filter(function (u) { return u.id === me.id; }) : [];
  }
  function orderTitle(id) { var o = id && S.order(id); return o ? o.title : ''; }

  /* دکمهٔ آیکونی فعالیت — کنار «ثبت سفارش جدید» */
  function timeIconBtn() {
    var rows = teamUsers();
    var online = rows.filter(function (u) { return !!S.runningSession(u.id); }).length;
    var me = Auth.current();
    var run = me ? S.runningSession(me.id) : null;
    var mySec = me ? S.wageReport(me.id).seconds : 0;
    return '<button class="btn btn-glass ts-btn' + (online ? ' live' : '') + '" data-act="ts-menu" ' +
      'title="فعالیت کاربران — شروع/پایان کار' + (mySec ? ' · امروز ' + hoursLabel(mySec) : '') + '" aria-label="فعالیت کاربران">' +
      icon('clock') + '<span class="ts-btn-txt">فعالیت</span>' +
      (online ? '<i class="ts-btn-dot"></i>' : '') +
      (run ? '<i class="ts-btn-time" data-ts-elapsed="' + me.id + '">' + secLabel(S.sessionSeconds(run)) + '</i>' : '') +
      '</button>';
  }

  /* پاپ‌اپ فهرست فعالیت‌ها (همان محتوای قبلی، داخل مودال) */
  function openTimeMenu() {
    var rows = teamUsers();
    var me = Auth.current();
    var online = rows.filter(function (u) { return !!S.runningSession(u.id); }).length;
    var body = '<div class="tsm">' +
      '<div class="tsm-head"><span class="live-dot' + (online ? ' on' : '') + '"></span>' +
      '<b>فعالیت کاربران</b><small>' + (online ? S.fa(online) + ' نفر در حال کار' : 'کسی در حال کار نیست') + '</small>' +
      (me ? '<button class="tsw-all" data-act="ts-open" data-id="' + me.id + '">' + icon('clock') + ' فعالیت من</button>' : '') +
      '</div><div class="tsm-list">';
    if (!rows.length) body += '<div class="tsw-empty">کاربری یافت نشد</div>';
    rows.forEach(function (u) {
      var run = S.runningSession(u.id);
      var act = run ? S.activity(run.activityId) : null;
      var today = S.wageReport(u.id);
      body += '<button class="tsw-row' + (run ? ' on' : '') + '" data-act="ts-open" data-id="' + u.id + '">' +
        '<span class="tsw-av" style="background:' + (act ? act.color : '#93A5B5') + '">' + esc((u.name || 'م').trim().charAt(0)) + '</span>' +
        '<span class="tsw-txt"><b>' + esc(run ? act.name : u.name) + '</b>' +
        '<small>' + (run ? esc(orderTitle(run.orderId) || u.name) : 'بدون فعالیت باز · امروز ' + hoursLabel(today.seconds) + '') + '</small></span>' +
        '<span class="tsw-side">' +
        (run ? '<i class="tsw-el" data-ts-elapsed="' + u.id + '">' + secLabel(S.sessionSeconds(run)) + '</i><em class="tsw-badge">در حال کار</em>'
             : '<i class="tsw-plus">' + icon('play') + '</i>') +
        '</span></button>';
    });
    body += '</div><div class="tsw-sum"><span>' + icon('wallet') + 'دستمزد امروز تیم: <b>' +
      wageLabel(rows.reduce(function (a, u) { return a + S.wageReport(u.id).amount; }, 0)) + '</b></span>' +
      '<span>فعالیت‌های باز: <b>' + S.fa(online) + '</b></span></div></div>';
    openModal('<div class="modal-head"><div><h3>فعالیت کاربران</h3>' +
      '<p class="small muted">روی هر نفر بزنید تا فعالیتش را شروع یا پایان دهید.</p></div>' +
      '<button class="x" data-act="close-modal" aria-label="بستن">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + body + '</div>');
  }

  /* پنل فعالیت — نسخهٔ قدیمی (نگه‌داری‌شده برای گزارش) */
  function timeWidget() {
    var rows = teamUsers();
    var me = Auth.current();
    var online = rows.filter(function (u) { return !!S.runningSession(u.id); }).length;
    var html = '<div class="tsw">' +
      '<div class="tsw-head"><span class="live-dot' + (online ? ' on' : '') + '"></span>' +
      '<b>فعالیت کاربران</b>' +
      '<small>' + (online ? S.fa(online) + ' نفر آنلاین' : 'کسی در حال کار نیست') + '</small>' +
      '<button class="tsw-all" data-act="ts-open" data-id="' + (me ? me.id : '') + '">' + icon('clock') + ' فعالیت من</button></div>' +
      '<div class="tsw-list">';
    if (!rows.length) html += '<div class="tsw-empty">کاربری یافت نشد</div>';
    rows.forEach(function (u) {
      var run = S.runningSession(u.id);
      var act = run ? S.activity(run.activityId) : null;
      var today = S.wageReport(u.id);
      var initial = (u.name || 'م').trim().charAt(0);
      html += '<button class="tsw-row' + (run ? ' on' : '') + '" data-act="ts-open" data-id="' + u.id + '">' +
        '<span class="tsw-av" style="background:' + (act ? act.color : '#93A5B5') + '">' + esc(initial) + '</span>' +
        '<span class="tsw-txt"><b>' + esc(run ? act.name : u.name) + '</b>' +
        '<small>' + (run ? esc(orderTitle(run.orderId) || u.name) : 'بدون فعالیت باز · امروز ' + hoursLabel(today.seconds)) + '</small></span>' +
        '<span class="tsw-side">' +
        (run ? '<i class="tsw-el" data-ts-elapsed="' + u.id + '">' + secLabel(S.sessionSeconds(run)) + '</i>' +
               '<em class="tsw-badge">در حال کار</em>'
             : '<i class="tsw-plus">' + icon('play') + '</i>') +
        '</span></button>';
    });
    html += '</div><div class="tsw-sum"><span>' + icon('wallet') + 'دستمزد امروز تیم: <b>' +
      wageLabel(rows.reduce(function (a, u) { return a + S.wageReport(u.id).amount; }, 0)) + '</b></span>' +
      '<span>فعالیت‌های باز: <b>' + S.fa(online) + '</b></span></div></div>';
    return html;
  }

  /* پاپ‌اپ شروع/پایان فعالیت */
  function openTimeModal(userId) {
    var me = Auth.current();
    if (!me) return;
    var u = Auth.users().filter(function (x) { return x.id === userId; })[0];
    if (!u) { toast('کاربر یافت نشد', 'err'); return; }
    if (!canAllTeam() && u.id !== me.id) { toast('فقط مدیر می‌تواند فعالیت دیگران را ببیند', 'err'); return; }
    var run = S.runningSession(u.id);
    var today = S.wageReport(u.id);
    var body = '';
    if (run) {
      var act = S.activity(run.activityId);
      body += '<div class="ts-run">' +
        '<span class="ts-run-ic" style="background:' + (act ? act.color : '#3A5268') + '">' + icon(act ? act.icon : 'clock') + '</span>' +
        '<div><b>' + esc(act ? act.name : '—') + '</b>' +
        '<small>' + (run.orderId ? 'پروژه: ' + esc(orderTitle(run.orderId)) : 'بدون پروژه') + '</small>' +
        '<small>شروع: ' + esc(S.faDateTime(run.startedAt)) + '</small></div>' +
        '<div class="ts-run-time" data-ts-elapsed="' + u.id + '">' + secLabel(S.sessionSeconds(run)) + '</div></div>' +
        '<div class="ts-today">' + icon('clock') + ' امروز: <b>' + hoursLabel(today.seconds) + '</b> · دستمزد امروز: <b>' + wageLabel(today.amount) + '</b></div>' +
        tsHistory(u.id) +
        '<div class="row-flex" style="margin-top:14px">' +
        '<button class="btn btn-red" data-act="ts-stop" data-id="' + u.id + '">' + icon('pause') + ' پایان فعالیت</button>' +
        '<button class="btn btn-line" data-act="close-modal">' + icon('x') + ' بستن</button></div>' +
        (u.id !== me.id ? '<p class="small muted" style="margin-top:12px">این فعالیت برای «' + esc(u.name) + '» باز است؛ شما به‌عنوان مدیر می‌توانید آن را ببندید.</p>' : '');
    } else {
      var acts = S.activities(true);
      var orders = S.state.orders.filter(function (o) { return o.status !== 'cancel'; });
      body += '<form data-form="ts-start" data-id="' + u.id + '">' +
        fld('نوع فعالیت', '<select name="activity">' + acts.map(function (a) {
          return '<option value="' + a.id + '">' + esc(a.name) + ' — ' + S.fa(a.rate.toLocaleString('en-US').replace(/,/g, '٬')) + ' تومان/ساعت</option>';
        }).join('') + '</select>') +
        '<div class="ts-proj">' + fld('پروژهٔ در حال کار (برای فعالیت‌های پروژه‌محور)', '<select name="order"><option value="">— انتخاب پروژه —</option>' +
          orders.map(function (o) { return '<option value="' + o.id + '">' + esc(o.code) + ' · ' + esc(o.title) + '</option>'; }).join('') + '</select>') + '</div>' +
        fld('یادداشت (اختیاری)', '<input name="note" placeholder="مثلاً: بازبینی نقشه‌های شاسی">') +
        '<div class="ts-today">' + icon('clock') + ' تا این لحظه امروز: <b>' + hoursLabel(today.seconds) + '</b> · دستمزد: <b>' + wageLabel(today.amount) + '</b></div>' +
        tsHistory(u.id) +
        '<div class="row-flex" style="margin-top:14px">' +
        '<button class="btn btn-red" type="submit">' + icon('play') + ' شروع فعالیت</button>' +
        '<button class="btn btn-line" type="button" data-act="close-modal">' + icon('x') + ' انصراف</button></div></form>';
    }
    openModal('<div class="modal-head"><div><h3>فعالیت ' + esc(u.name) + '</h3>' +
      '<p class="small muted">نوع فعالیت را انتخاب کنید و ساعت کاری را آغاز کنید.</p></div>' +
      '<button class="x" data-act="close-modal" aria-label="بستن">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + body + '</div>');
    /* فیلد پروژه فقط برای فعالیت‌های پروژه‌محور */
    var sel = document.querySelector('form[data-form="ts-start"] select[name="activity"]');
    if (sel) {
      var sync = function () {
        var a = S.activity(sel.value);
        var box = document.querySelector('.ts-proj');
        if (box) box.style.display = (a && a.needOrder) ? '' : 'none';
      };
      sel.addEventListener('change', sync);
      sync();
    }
  }

  /* آخرین فعالیت‌های ثبت‌شدهٔ یک کاربر + جمع دستمزد امروز */
  function tsHistory(userId) {
    var rows = S.sessionsOf(userId).slice(0, 6);
    var today = S.wageReport(userId);
    var html = '<div class="ts-wage-total"><span>' + icon('wallet') + ' جمع دستمزد امروز</span><b>' + S.money(today.amount) + '</b></div>';
    if (!rows.length) return html + '<div class="small muted" style="margin-top:10px">هنوز فعالیتی برای این کاربر ثبت نشده است.</div>';
    html += '<div class="ts-history">' + rows.map(function (s2) {
      var a = S.activity(s2.activityId) || { name: '—', color: '#93A5B5' };
      var sec = S.sessionSeconds(s2), wage = S.sessionWage(s2);
      return '<div class="ts-h-row"><span class="ts-h-dot" style="background:' + a.color + '"></span>' +
        '<span class="ts-h-txt"><b>' + esc(a.name) + (s2.endedAt ? '' : ' · در حال اجرا') + '</b>' +
        '<small>' + esc(S.faDateTime(s2.startedAt)) + (s2.orderId ? ' · ' + esc(orderTitle(s2.orderId)) : '') + '</small></span>' +
        '<span class="ts-h-val">' + secLabel(sec) + '<small>' + S.money(Math.round(wage)) + '</small></span></div>';
    }).join('') + '</div>';
    return html;
  }

  /* پاپ‌اپ مدیریت فعالیت‌ها (فقط مدیر) */
  function openActivityModal(id) {
    var a = id ? S.activity(id) : null;
    openModal('<div class="modal-head"><div><h3>' + (a ? 'ویرایش فعالیت' : 'فعالیت جدید') + '</h3>' +
      '<p class="small muted">نرخ ساعتی همین‌جا تعیین می‌شود و مبنای دستمزد کاربران است.</p></div>' +
      '<button class="x" data-act="close-modal" aria-label="بستن">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><form data-form="activity" data-id="' + (a ? a.id : '') + '">' +
      fld('نام فعالیت', '<input name="name" required value="' + esc(a ? a.name : '') + '" placeholder="مثلاً طراحی صنعتی">') +
      fld('نرخ ساعتی (تومان)', '<input name="rate" type="number" min="0" step="1000" required value="' + (a ? S.en(a.rate) : '200000') + '">') +
      fld('توضیح کوتاه', '<input name="desc" value="' + esc(a ? a.desc : '') + '" placeholder="این فعالیت شامل چه کارهایی است؟">') +
      '<label class="check-row"><input type="checkbox" name="needOrder"' + ((!a || a.needOrder) ? ' checked' : '') + '> هنگام ثبت، انتخاب پروژه الزامی باشد</label>' +
      '<div class="row-flex" style="margin-top:14px">' +
      '<button class="btn btn-red" type="submit">' + icon('save') + ' ذخیره فعالیت</button>' +
      '<button class="btn btn-line" type="button" data-act="close-modal">' + icon('x') + ' انصراف</button></div>' +
      '</form></div>');
  }

  /* ================= تشخیص دستگاه =================
     پنل خودش اندازهٔ صفحه و نوع ورودی (لمسی/ماوس) را می‌فهمد و چیدمان را
     بر همان اساس مرتب می‌کند: mobile | tablet | desktop
     نتیجه در <html data-device="…" data-touch="0|1"> می‌نشیند و CSS با آن
     جدول‌ها را کارتی، فرم‌ها را تک‌ستونه و هدر را جمع‌وجور می‌کند. */
  function deviceInfo() {
    var w = window.innerWidth || 1024;
    var touch = false;
    try { touch = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && w < 900); } catch (e) {}
    var mode = w <= 720 ? 'mobile' : (w <= 1024 ? 'tablet' : 'desktop');
    if (w <= 900 && touch) mode = 'mobile';
    return { mode: mode, touch: touch, w: w };
  }
  function applyDevice() {
    var d = deviceInfo();
    document.documentElement.setAttribute('data-device', d.mode);
    document.documentElement.setAttribute('data-touch', d.touch ? '1' : '0');
    /* در موبایل منوی کناری همیشه کشویی است */
    if (d.mode === 'mobile') {
      var sb = document.getElementById('sidebar');
      if (sb) sb.classList.remove('open');
      var sc = document.querySelector('.scrim'); if (sc) sc.remove();
    }
    return d;
  }

  /* در حالت موبایل جدول‌ها به «کارت» تبدیل می‌شوند؛ برای هر سلول، عنوان
     ستون را به‌صورت data-label می‌گذاریم تا کنار مقدار نمایش داده شود. */
  function enhanceTables(root) {
    var tbls = (root || document).querySelectorAll('.tbl');
    Array.prototype.forEach.call(tbls, function (tbl) {
      var ths = Array.prototype.map.call(tbl.querySelectorAll('thead th'), function (th) {
        return (th.textContent || '').replace(/\s+/g, ' ').trim();
      });
      Array.prototype.forEach.call(tbl.querySelectorAll('tbody tr'), function (tr) {
        var cells = tr.children;
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          if (c.tagName !== 'TD') continue;
          if (c.hasAttribute('colspan')) continue;
          if (c.classList.contains('act')) c.setAttribute('data-label', 'عملیات');
          else {
            var label = ths[i] || '';
            if (label) c.setAttribute('data-label', label);
          }
          /* محتوای سلول را در یک بسته می‌پیچیم تا در حالت کارتی همه با هم
             (و نه کنار هم) نمایش داده شوند */
          if (!c.querySelector(':scope > .tdv')) {
            var box = document.createElement('span');
            box.className = 'tdv';
            while (c.firstChild) box.appendChild(c.firstChild);
            c.appendChild(box);
          }
        }
        /* ردیف‌های «خالی» را به کارت بزرگ تبدیل نکن */
        if (tr.querySelector('[colspan]')) tr.classList.add('is-empty');
      });
    });
  }

  /* ================= چیدمان ================= */
  var MODULES = [
    { go: '#/orders',     ic: 'orders', t: 'سفارش‌ها',          d: 'ثبت، پیگیری و مدیریت سفارش‌های طراحی', perm: 'order.view', badge: true },
    { go: '#/quick',      ic: 'bolt',   t: 'کانال‌های ارتباطی', d: 'ثبت سریع سفارش و پیام‌های دریافتی',    perm: 'order.view' },
    { go: '#/customers',  ic: 'users',  t: 'مشتریان',          d: 'پرونده مشتریان، تماس و سابقه سفارش',    perm: 'customer.view' },
    { go: '#/accounting', ic: 'wallet', t: 'حسابداری',         d: 'پرداخت‌ها، پیش‌پرداخت و مانده حساب‌ها',  perm: 'accounting.view' },
    { go: '#/reports',    ic: 'chart',  t: 'گزارش‌ها',          d: 'گزارش درآمد، ساعات کارکرد و عملکرد',    perm: 'reports.view' },
    { go: '#/services',   ic: 'layers', t: 'خدمات و نرخ‌نامه', d: 'خدمات، تعرفه ساعتی و قیمت‌گذاری',       perm: 'service.view' },
    { go: '#/projects',   ic: 'box',    t: 'نمونه‌کارها',      d: 'پروژه‌های شاخص و نمونه‌های اجراشده',    perm: 'project.view' },
    { go: '#/users',      ic: 'users',  t: 'کاربران',           d: 'ساخت حساب، نقش‌ها و دسترسی‌ها',         perm: 'user.manage' },
    { go: '#/settings',   ic: 'cog',    t: 'تنظیمات',           d: 'اطلاعات شرکت، تقویم و پشتیبان‌گیری',    perm: 'settings.view' }
  ];

  function layout() {
    return document.documentElement.getAttribute('data-layout') === 'sidebar' ? 'sidebar' : 'cards';
  }
  function setLayout(mode, opts) {
    mode = mode === 'sidebar' ? 'sidebar' : 'cards';
    document.documentElement.setAttribute('data-layout', mode);
    try { localStorage.setItem('mecades_layout', mode); } catch (e) {}
    var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
    var scrim = document.querySelector('.scrim'); if (scrim) scrim.remove();
    if (!(opts && opts.silent) && typeof render === 'function') render();
  }
  function toggleLayout() {
    setLayout(layout() === 'cards' ? 'sidebar' : 'cards');
    toast(layout() === 'cards' ? 'چیدمان کارتی فعال شد' : 'چیدمان کناری فعال شد', 'ok');
  }
  function closeAcct() { var a = document.getElementById('acct'); if (a) a.classList.remove('open'); }
  document.addEventListener('click', function (e) {
    var a = document.getElementById('acct');
    if (a && a.classList.contains('open') && !a.contains(e.target)) closeAcct();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAcct(); });

  /* کارت‌های ماژول — جایگزین منوی کشویی در چیدمان کارتی */
  function moduleCards() {
    var newCount = S.state.orders.filter(function (o) { return o.status === 'new'; }).length;
    var html = '<div class="mod-head"><div><h3>دسترسی سریع به بخش‌ها</h3></div></div>' +
      '<div class="mod-grid" id="modGrid">';
    MODULES.forEach(function (m) {
      var badge = (m.badge && newCount) ? ' <span class="st">' + icon('inbox') + S.fa(newCount) + ' سفارش جدید</span>' : '';
      html += '<a class="mod-card fade-in" href="' + m.go + '" data-perm="' + m.perm + '">' +
        '<span class="ic">' + icon(m.ic) + '</span>' +
        '<h4>' + esc(m.t) + '</h4><p>' + esc(m.d) + '</p>' + badge + '</a>';
    });
    return html + '</div>';
  }

  /* نوار خلاصهٔ اعداد — فقط در چیدمان کناری (حالت قبلی) */
  function kpiStrip(revenue, hours, due, overdue, newCount) {
    var cells = [
      { ic: 'wallet', t: 'درآمد این ماه', v: S.moneyShort(revenue), u: 'تومان' },
      { ic: 'clock', t: 'ساعات کارکرد ماه', v: S.fa(hours), u: 'ساعت' },
      { ic: 'target', t: 'مطالبات باز', v: S.moneyShort(due), u: 'تومان' },
      { ic: 'inbox', t: 'سفارش جدید', v: S.fa(newCount), u: overdue ? S.fa(overdue) + ' تأخیر' : 'بدون تأخیر' }
    ];
    return '<div class="kpi-strip">' + cells.map(function (c) {
      return '<div class="ks-cell"><span class="ic">' + icon(c.ic) + '</span>' +
        '<span class="ks-txt"><small>' + esc(c.t) + '</small><b>' + c.v +
        ' <span class="u">' + esc(c.u) + '</span></b></span></div>';
    }).join('') + '</div>';
  }

  /* ================= boot ================= */
  function boot() {
    initTheme();
    applyDevice();
    var rT = null;
    function onResize() { clearTimeout(rT); rT = setTimeout(function () { applyDevice(); }, 120); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    /* sidebar counts */
    var newCount = S.state.orders.filter(function (o) { return o.status === 'new'; }).length;
    var badge = document.getElementById('navBadge');
    if (badge) { badge.textContent = S.fa(newCount); badge.style.display = newCount ? '' : 'none'; }
    document.documentElement.setAttribute('aria-layout', layout());
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/dashboard';
    setInterval(updateClock, 1000);
    /* نشست کاربر */
    var u = Auth.current();
    if (!u) { showAuth(Auth.isSetup() ? 'login' : 'setup'); return; }
    applyUser(u);
    render();
  }
  function applyUser(u) {
    var un = document.getElementById('userName'), ur = document.getElementById('userRole'), av = document.getElementById('userAvatar');
    var roleLabel = (Auth.ROLES[u.role] || {}).label || 'کاربر';
    if (un) un.textContent = u.name;
    if (ur) ur.textContent = roleLabel;
    if (av) av.textContent = (u.name || 'م').trim().charAt(0);
    var tb = document.getElementById('tbAvatar'), tbn = document.getElementById('tbUserName'), tbr = document.getElementById('tbUserRole');
    if (tbn) tbn.textContent = u.name;
    if (tbr) tbr.textContent = roleLabel;
    if (tb) tb.textContent = (u.name || 'م').trim().charAt(0);
  }
  document.addEventListener('DOMContentLoaded', boot);

  /* API کنسول (برای اسکریپت‌ها و بکاپ گیری خودکار) */
  window.MECADES = {
    VERSION: S.VERSION,
    version: function () { return S.version(); },
    buildBackup: function () { return XLSXWriter.build(backupWorkbook()); },
    exportExcel: exportExcelBackup,
    auth: Auth,
    store: S
  };
})();
