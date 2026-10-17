/**
 * ============================================================================
 *  MECADES ADMIN — Google Sheets Backup  (Apps Script)
 *  بکاپ خودکار پنل مکادیز در Google Sheets
 * ----------------------------------------------------------------------------
 *  این اسکریپت را یک بار داخل همان Google Sheets باز کنید:
 *      Extensions  →  Apps Script  →  محتوای این فایل را جای Code.gs بگذارید
 *      →  ذخیره  →  رفرش شیت  →  منوی «بکاپ مکادیز» بالای شیت ظاهر می‌شود.
 *
 *  سه راه ورود داده:
 *    ۱) منو ← «وارد کردن کد از شیت «کد بکاپ»»      (کد بکاپ را در آن شیت بچسبانید)
 *    ۲) منو ← «وارد کردن از فایل متنی در Drive»   (فایل .txt دانلودشده از پنل)
 *    ۳) اتصال زندهٔ پنل به Web App  (تنظیمات ← همگام‌سازی Google Sheets ← ارسال)
 *
 *  همهٔ شیت‌ها خودکار ساخته، راست‌به‌چپ، سرصفحه‌دار، فیلتردار، رنگی و مرتب می‌شوند.
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 *  ۰) تنظیمات
 * ------------------------------------------------------------------------- */

/** شناسهٔ شیت مقصد؛ اگر اسکریپت داخل خودِ شیت باز شده باشد لازم نیست. */
var SPREADSHEET_ID = '1iFN8qHAXws8UAu-GVRkGsFqO4pqhwRwkBlyaiHBa5_A';

/** نام شیتی که کد بکاپ داخل آن چسبانده می‌شود. */
var CODE_SHEET = 'کد بکاپ';

/** شمارهٔ نسخهٔ اسکریپت (در شیت «لاگ» و پیام‌ها نمایش داده می‌شود). */
var SCRIPT_VERSION = '1.0.1';

/** اگر true باشد، هش رمزها و نمک در شیت «کاربران» نوشته می‌شود (پیشنهاد: false). */
var INCLUDE_PASSWORD_HASHES = false;

/* رنگ‌های برند مکادیز */
var C = {
  navy: '#3A5268', navyDark: '#1E2D3B', line: '#DDE4EA',
  bgAlt: '#F2F5F8', red: '#B23A2F', green: '#2C6B3C',
  amber: '#B07A16', grey: '#66717D', white: '#FFFFFF', ink: '#1F2A33'
};

var STATUS_LABEL = {
  'new': 'ثبت شده', 'quote': 'بررسی و قیمت‌گذاری', 'design': 'در حال طراحی',
  'client': 'بازبینی با مشتری', 'sample': 'نمونه‌سازی', 'done': 'تحویل شده', 'cancel': 'لغو شده'
};
var PRIORITY_LABEL = { high: 'فوری', normal: 'عادی', low: 'کم‌اهمیت' };
var SOURCE_LABEL = {
  site: 'فرم سایت', insta: 'اینستاگرام', telegram: 'تلگرام',
  whatsapp: 'واتساپ', phone: 'تماس تلفنی', referral: 'معرفی مشتری'
};
var ROLE_LABEL = {
  admin: 'مدیر سیستم', manager: 'مدیر پروژه', accountant: 'حسابدار',
  engineer: 'مهندس', sales: 'فروش'
};

/* ---------------------------------------------------------------------------
 *  ۱) دسترسی به شیت + ابزارهای عمومی
 * ------------------------------------------------------------------------- */

function ss_() {
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
  if (active) return active;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** تاریخ شمسی به شکل 1405/07/25 (همان قالبی که پنل نشان می‌دهد). */
function jdate_(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var j = g2j_(d.getFullYear(), d.getMonth() + 1, d.getDate());
  var hh = ('0' + d.getHours()).slice(-2);
  var mm = ('0' + d.getMinutes()).slice(-2);
  return j[0] + '/' + ('0' + j[1]).slice(-2) + '/' + ('0' + j[2]).slice(-2) + ' ' + hh + ':' + mm;
}
function jdateOnly_(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var j = g2j_(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return j[0] + '/' + ('0' + j[1]).slice(-2) + '/' + ('0' + j[2]).slice(-2);
}
/** تبدیل میلادی → جلالی (الگوریتم استاندارد، بدون کتابخانه). */
function g2j_(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = (365 * gy) + parseInt((gy2 + 3) / 4, 10) - parseInt((gy2 + 99) / 100, 10) +
    parseInt((gy2 + 399) / 400, 10) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * parseInt(days / 12053, 10);
  days %= 12053;
  jy += 4 * parseInt(days / 1461, 10);
  days %= 1461;
  if (days > 365) { jy += parseInt((days - 1) / 365, 10); days = (days - 1) % 365; }
  var jm = (days < 186) ? 1 + parseInt(days / 31, 10) : 7 + parseInt((days - 186) / 30, 10);
  var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function txt_(v) { return (v === null || v === undefined) ? '' : String(v); }
function money_(v) { return Math.round(num_(v)); }
function hours_(sec) { return Math.round((num_(sec) / 3600) * 100) / 100; }

/** چک‌سام ۸ رقمی — دقیقاً همان الگوریتم پنل (برای تشخیص کد دست‌کاری‌شده). */
function checksum_(str) {
  var h1 = 0x811c9dc5, h2 = 5381, i, c;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    h1 ^= c;
    h1 = (h1 + (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24)) >>> 0;
    h2 = ((h2 << 5) + h2 + c) >>> 0;
  }
  var hex = ((h1 ^ h2) >>> 0).toString(16);
  return ('0000000' + hex).slice(-8);
}

/* ---------------------------------------------------------------------------
 *  ۲) منوی شیت
 * ------------------------------------------------------------------------- */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('بکاپ مکادیز')
      .addItem('۱) ساخت / بازسازی همهٔ شیت‌ها', 'menuSetup')
      .addItem('۲) وارد کردن کد از شیت «کد بکاپ»', 'menuImportFromCodeSheet')
      .addItem('۳) وارد کردن از فایل متنی در Drive', 'menuImportFromDrive')
      .addItem('۴) بررسی اتصال و آدرس Web App', 'menuConnection')
      .addSeparator()
      .addItem('پاک کردن داده‌ها (با تأیید)', 'menuClearData')
      .addItem('درباره', 'menuAbout')
      .addToUi();
  } catch (e) { /* در اجرای بدون UI خطا نده */ }
}

function menuSetup() {
  var info = setupAll_();
  toast_('همهٔ شیت‌ها ساخته و مرتب شدند ✓', info.sheetCount + ' شیت');
}
function menuImportFromCodeSheet() {
  var res = importFromCodeSheet_();
  toast_(res.ok ? 'کد بکاپ وارد شد ✓' : 'خطا: ' + res.error, res.ok ? summaryText_(res.summary) : '');
}
function menuImportFromDrive() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('وارد کردن از Drive',
    'نام کامل فایل متنی بکاپ (مثلاً mecades-backup-code-2026-10-17.txt) را وارد کنید:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var res = importFromDrive_(resp.getResponseText().trim());
  ui.alert(res.ok ? 'انجام شد' : 'خطا', res.ok ? summaryText_(res.summary) : String(res.error), ui.ButtonSet.OK);
}
function menuConnection() {
  var info = connectionInfo_();
  SpreadsheetApp.getUi().alert('اتصال Web App',
    'آدرس Web App:\n' + (info.url || '(هنوز Deploy نشده)') +
    '\n\nتوکن اتصال:\n' + (info.token || '(ساخته نشده — از منوی «درباره» بسازید)') +
    '\n\nاین دو مقدار را در پنل ← تنظیمات ← «همگام‌سازی Google Sheets» بگذارید.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
function menuClearData() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('پاک کردن داده‌ها', 'همهٔ ردیف‌های داده (به‌جز سرصفحه‌ها) پاک می‌شود. ادامه می‌دهید؟', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var info = setupAll_(true);
  toast_('داده‌ها پاک شد', info.sheetCount + ' شیت خالی شد');
}
function menuAbout() {
  var info = connectionInfo_(true);
  var html =
    '<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right;padding:8px 4px;line-height:1.9">' +
    '<b style="font-size:15px">بکاپ Google Sheets — مکادیز</b><br>' +
    'نسخهٔ اسکریپت: <b>' + SCRIPT_VERSION + '</b><br>' +
    'شیت مقصد: <b>' + ss_().getName() + '</b><br><br>' +
    '<b>آدرس Web App</b><br>' +
    '<code style="background:#F2F5F8;padding:4px 6px;display:block;direction:ltr;word-break:break-all">' +
    (info.url || 'هنوز Deploy نشده') + '</code><br>' +
    '<b>توکن اتصال</b><br>' +
    '<code style="background:#F2F5F8;padding:4px 6px;display:block;direction:ltr;word-break:break-all">' +
    (info.token || '—') + '</code>' +
    '<div style="font-size:11px;color:#66717D;margin-top:8px">این مقادیر را در پنل ← تنظیمات ← «همگام‌سازی Google Sheets» وارد کنید.</div>' +
    '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(320), 'درباره');
}

/* ---------------------------------------------------------------------------
 *  ۳) اتصال (توکن + آدرس Web App)
 * ------------------------------------------------------------------------- */

function connectionInfo_(createToken) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token && createToken) {
    token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('TOKEN', token);
  }
  var url = props.getProperty('WEBAPP_URL') ||
    (ScriptApp.getService().getUrl() || '');
  if (url && url.indexOf('/exec') === -1 && url.indexOf('/dev') === -1) url = url;
  if (url) props.setProperty('WEBAPP_URL', url);
  return { token: token || '', url: url || '' };
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var info = connectionInfo_(false);
  if (p.ping) {
    return json_({ ok: true, pong: true, script: SCRIPT_VERSION, time: new Date().toISOString(),
      sheets: sheetNames_().length });
  }
  var counts = currentCounts_();
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Tahoma,Arial;direction:rtl;text-align:right;padding:18px;line-height:2">' +
    '<h2 style="margin:0 0 6px">MECADES — بکاپ Google Sheets</h2>' +
    '<div style="color:#66717D;font-size:12px">نسخهٔ اسکریپت ' + SCRIPT_VERSION + ' · ' + new Date().toISOString() + '</div><hr>' +
    '<b>وضعیت:</b> فعال ✓<br>' +
    '<b>سفارش‌ها:</b> ' + counts.orders + ' · <b>مشتریان:</b> ' + counts.customers +
    ' · <b>پرداخت‌ها:</b> ' + counts.payments + ' · <b>ساعت‌کار:</b> ' + counts.sessions + '<br>' +
    '<b>آخرین ورود داده:</b> ' + (counts.lastImport || '—') + '<br><br>' +
    '<div style="font-size:12px;color:#66717D">برای اتصال پنل، این آدرس را در تنظیمات پنل وارد کنید:<br>' +
    '<code style="direction:ltr;display:inline-block;background:#F2F5F8;padding:4px 6px">' +
    (ScriptApp.getService().getUrl() || '') + '</code></div></div>'
  ).setTitle('MECADES Backup');
  return html;
}

function doPost(e) {
  var out = { ok: false };
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var obj = JSON.parse(raw);
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (token && String(obj.token || '') !== token) throw new Error('توکن اتصال نامعتبر است');
    if (obj.kind === 'ping') {
      out = { ok: true, pong: true, script: SCRIPT_VERSION, time: new Date().toISOString() };
    } else {
      out = { ok: true, summary: importPayload_(obj, 'webapp') };
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
    try { logRow_('webapp', null, 'خطا: ' + out.error); } catch (e2) {}
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function toast_(msg, title) {
  try { SpreadsheetApp.getActive().toast(msg, title || 'MECADES', 6); } catch (e) {}
}

/* ---------------------------------------------------------------------------
 *  ۴) ساخت و قالب‌بندی شیت‌ها
 * ------------------------------------------------------------------------- */

/** تعریف همهٔ شیت‌ها: نام، سرصفحه‌ها، عرض ستون‌ها، قالب اعداد. */
function SHEETS_() {
  return [
    { key: 'dash', name: 'داشبورد', headers: ['شاخص', 'مقدار', 'توضیح'],
      widths: [230, 180, 420], formats: ['@', '#,##0', '@'] },

    { key: 'orders', name: 'سفارش‌ها',
      headers: ['کد سفارش', 'تاریخ ثبت', 'مشتری', 'شرکت', 'خدمت', 'ساعات', 'نرخ ساعتی',
        'مبلغ سفارش', 'پرداختی', 'مانده', 'موعد تحویل', 'وضعیت', 'اولویت', 'منبع', 'توضیحات', 'یادداشت داخلی', 'فایل‌ها'],
      widths: [120, 120, 130, 180, 170, 70, 100, 120, 120, 120, 120, 130, 80, 110, 330, 200, 220],
      formats: ['@', '@', '@', '@', '@', '#,##0.0', '#,##0', '#,##0', '#,##0', '#,##0', '@', '@', '@', '@', '@', '@', '@'] },

    { key: 'payments', name: 'پرداخت‌ها',
      headers: ['تاریخ', 'کد سفارش', 'مشتری', 'مبلغ', 'روش پرداخت', 'یادداشت'],
      widths: [120, 120, 150, 130, 130, 300],
      formats: ['@', '@', '@', '#,##0', '@', '@'] },

    { key: 'customers', name: 'مشتریان',
      headers: ['نام', 'تماس', 'شرکت', 'ایمیل', 'آدرس', 'یادداشت', 'تاریخ عضویت',
        'تعداد سفارش', 'مبلغ کل سفارش‌ها', 'پرداختی', 'مانده'],
      widths: [140, 130, 190, 180, 260, 240, 120, 100, 140, 130, 130],
      formats: ['@', '@', '@', '@', '@', '@', '@', '#,##0', '#,##0', '#,##0', '#,##0'] },

    { key: 'services', name: 'خدمات',
      headers: ['خدمت', 'نام کوتاه', 'فعال', 'نرخ ساعتی', 'توضیح'],
      widths: [280, 140, 70, 110, 420],
      formats: ['@', '@', '@', '#,##0', '@'] },

    { key: 'tiers', name: 'نرخ‌نامه',
      headers: ['بازهٔ ساعات', 'حداکثر ساعت', 'نرخ ساعتی'],
      widths: [200, 120, 120], formats: ['@', '#,##0', '#,##0'] },

    { key: 'users', name: 'کاربران',
      headers: ['نام', 'نام خانوادگی', 'نام کاربری', 'نقش', 'تماس', 'شماره حساب',
        'وضعیت', 'تاریخ ایجاد', 'آخرین ورود'].concat(INCLUDE_PASSWORD_HASHES ? ['هش رمز'] : []),
      widths: [110, 130, 130, 120, 130, 190, 80, 120, 120],
      formats: ['@', '@', '@', '@', '@', '@', '@', '@', '@'] },

    { key: 'activities', name: 'فعالیت‌ها',
      headers: ['فعالیت', 'نرخ ساعتی', 'محدود به پروژه', 'فعال', 'توضیح'],
      widths: [160, 110, 120, 70, 380], formats: ['@', '#,##0', '@', '@', '@'] },

    { key: 'sessions', name: 'ساعت‌کار',
      headers: ['تاریخ', 'کاربر', 'فعالیت', 'پروژه', 'شروع', 'پایان', 'مدت (ساعت)', 'نرخ ساعتی', 'دستمزد', 'یادداشت'],
      widths: [120, 130, 150, 250, 90, 90, 100, 110, 130, 220],
      formats: ['@', '@', '@', '@', '@', '@', '#,##0.00', '#,##0', '#,##0', '@'] },

    { key: 'wages', name: 'گزارش دستمزد',
      headers: ['کاربر', 'فعالیت', 'ساعات', 'نرخ ساعتی', 'دستمزد'],
      widths: [150, 160, 100, 110, 140], formats: ['@', '@', '#,##0.00', '#,##0', '#,##0'] },

    { key: 'projects', name: 'پروژه‌ها',
      headers: ['شماره', 'عنوان', 'دسته', 'برچسب‌ها', 'انتشار', 'توضیح'],
      widths: [130, 220, 140, 240, 80, 460], formats: ['@', '@', '@', '@', '@', '@'] },

    { key: 'settings', name: 'تنظیمات',
      headers: ['کلید', 'مقدار'],
      widths: [220, 380], formats: ['@', '@'] },

    { key: 'log', name: 'لاگ',
      headers: ['زمان', 'منبع', 'سفارش‌ها', 'مشتریان', 'پرداخت‌ها', 'کاربران', 'ساعت‌کار', 'نسخهٔ پنل', 'وضعیت'],
      widths: [140, 110, 100, 100, 100, 100, 100, 110, 300],
      formats: ['@', '@', '#,##0', '#,##0', '#,##0', '#,##0', '#,##0', '@', '@'] },

    { key: 'code', name: CODE_SHEET, headers: ['راهنما'], widths: [600], formats: ['@'] }
  ];
}

function sheetNames_() { return SHEETS_().map(function (s) { return s.name; }); }

function sheetFor_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) { sh = ss_().insertSheet(name); }
  return sh;
}

/** ساخت/بازسازی همهٔ شیت‌ها (بدون نوشتن داده، فقط ساختار و قالب). */
function setupAll_(clearOnly, keepCodeSheet) {
  var book = ss_();
  var defs = SHEETS_();
  defs.forEach(function (def) {
    var sh = sheetFor_(def.name);
    if (def.key === 'code' && keepCodeSheet) { sh.setRightToLeft(true); return; }
    if (sh.getFilter()) { try { sh.getFilter().remove(); } catch (e) {} }
    sh.clear();
    sh.setRightToLeft(true);
    if (def.key === 'code') { writeCodeSheet_(sh); return; }
    var w = Math.max(def.headers.length, 1);
    sh.getRange(1, 1, 1, w).setValues([def.headers]);
    styleHeader_(sh, w);
    if (!clearOnly) {
      var blank = sh.getRange(2, 1, 1, w).getValues(); /* نگه‌داشتن قالب */
      sh.getRange(2, 1, 1, w).setValues([blank[0].map(function () { return ''; })]);
    }
    sh.setFrozenRows(1);
    applyWidths_(sh, def.widths);
    applyFormats_(sh, def.formats);
    applyFormatsTo_(sh, def.formats, 2, Math.max(sh.getMaxRows() - 1, 1));
    sh.getRange(1, 1, Math.max(sh.getMaxRows(), 1), w).setHorizontalAlignment('right');
    if (def.key === 'orders' || def.key === 'payments' || def.key === 'sessions') {
      try { sh.getRange(1, 1, 2, w).createFilter(); } catch (e) {}
    }
    applyBanding_(sh, w);
  });
  // ترتیب تب‌ها (در اجرای Web App ممکن است UI فعال نباشد)
  try {
    defs.forEach(function (def, i) {
      var sh = book.getSheetByName(def.name);
      if (sh) { book.setActiveSheet(sh); book.moveActiveSheet(i + 1); }
    });
    var first = book.getSheetByName('داشبورد');
    if (first) book.setActiveSheet(first);
  } catch (e) {}
  return { sheetCount: defs.length };
}

function styleHeader_(sh, cols) {
  var r = sh.getRange(1, 1, 1, cols);
  r.setBackground(C.navy)
    .setFontColor(C.white)
    .setFontFamily('Tahoma')
    .setFontSize(10.5)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sh.setRowHeight(1, 34);
}

function applyWidths_(sh, widths) {
  (widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

/** قالب ستون‌ها را روی یک بازهٔ مشخص اعمال می‌کند (قبل از نوشتن داده). */
function applyFormatsTo_(sh, formats, startRow, nRows) {
  if (!formats || !nRows) return;
  formats.forEach(function (f, i) {
    if (f) {
      try { sh.getRange(startRow, i + 1, nRows, 1).setNumberFormat(f); } catch (e) {}
    }
  });
}

function applyFormats_(sh, formats) {
  (formats || []).forEach(function (f, i) {
    if (f && f !== '@') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(f);
  });
}

function applyBanding_(sh, cols) {
  try {
    var bandings = sh.getBandings();
    bandings.forEach(function (b) { b.remove(); });
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), cols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  } catch (e) { /* بی‌اهمیت */ }
}

function writeCodeSheet_(sh) {
  sh.setRightToLeft(true);
  sh.getRange(1, 1).setValue('راهنما').setFontWeight('bold');
  var help = [
    'MECADES ADMIN — شیت «کد بکاپ»',
    '',
    '۱) در پنل مکادیز: تنظیمات ← داده‌ها ← «کد پشتیبان (Google Docs)» ← دکمهٔ «کپی کد».',
    '۲) کل متن را در سلول A3 همین شیت بچسبانید (Ctrl+V). متن می‌تواند چند هزار کاراکتر باشد.',
    '۳) از منوی «بکاپ مکادیز» ← گزینهٔ «۲) وارد کردن کد از شیت «کد بکاپ»» را بزنید.',
    '',
    'نکته‌ها:',
    '• سرصفحه و خط «END OF CODE» مشکلی ایجاد نمی‌کند؛ فقط خودِ کد لازم است.',
    '• اگر کد از ۵۰٬۰۰۰ کاراکتر بزرگ‌تر است (سلول گوگل‌شیت محدودیت دارد)، فایل متنی را در Drive بگذارید',
    '   و از گزینهٔ «۳) وارد کردن از فایل متنی در Drive» استفاده کنید.',
    '• بعد از وارد کردن، این متن را می‌توانید پاک کنید؛ همهٔ داده‌ها در شیت‌های دیگر ذخیره می‌شوند.'
  ];
  sh.getRange(2, 1).setValue(help.join('\n')).setWrap(true).setVerticalAlignment('top')
    .setFontFamily('Tahoma').setFontSize(10);
  sh.setRowHeight(2, 190);
  sh.getRange('A3').setBackground('#FFFDF0').setBorder(true, true, true, true, false, false)
    .setFontFamily('Courier New').setFontSize(9).setValue('');
  sh.getRange('A1').setBackground(C.navy).setFontColor(C.white);
  sh.setColumnWidth(1, 600);
}

/* ---------------------------------------------------------------------------
 *  ۵) ورود داده — از شیت، از Drive، از Web App
 * ------------------------------------------------------------------------- */

function importFromCodeSheet_() {
  var sh = ss_().getSheetByName(CODE_SHEET);
  if (!sh) return { ok: false, error: 'شیت «' + CODE_SHEET + '» پیدا نشد؛ اول «ساخت/بازسازی شیت‌ها» را اجرا کنید.' };
  var text = '';
  var values = sh.getRange(1, 1, Math.min(sh.getMaxRows(), 400), 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i][0] || '');
    if (v.indexOf('MCD1') > -1) { text += v; }
  }
  if (!text) return { ok: false, error: 'در ستون A شیت «کد بکاپ» کدی (MCD1…) پیدا نشد.' };
  try {
    var payload = parseBackupCode_(text);
    return { ok: true, summary: importPayload_(payload, 'sheet', true) };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

function importFromDrive_(filename) {
  try {
    if (!filename) throw new Error('نام فایل خالی است');
    var files = DriveApp.getFilesByName(filename.trim());
    if (!files.hasNext()) throw new Error('فایلی با این نام در Drive پیدا نشد: ' + filename);
    var f = files.next();
    var text = f.getBlob().getDataAsString('UTF-8');
    var payload = parseBackupCode_(text);
    return { ok: true, summary: importPayload_(payload, 'drive') };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/** کد متنی پنل را به شیء داده تبدیل می‌کند (MCD1 یا MCD1z + بررسی چک‌سام). */
function parseBackupCode_(text) {
  var clean = String(text || '').replace(/[\s\u00a0\u2000-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/g, '');
  var m = clean.match(/MCD1(z?)\.([A-Za-z0-9_-]+)\.([0-9a-fA-F]{8})/);
  if (!m) throw new Error('کد بکاپ (MCD1…) در متن پیدا نشد');
  var payload = m[2];
  if (checksum_(payload).toLowerCase() !== m[3].toLowerCase()) {
    throw new Error('کد ناقص یا تغییرکرده است (چک‌سام نمی‌خواند)');
  }
  var bytes = Utilities.base64DecodeWebSafe(payload);
  var json;
  if (m[1] === 'z') {
    var raw = inflateRaw_(bytes);
    json = Utilities.newBlob(raw).getDataAsString('UTF-8');
  } else {
    json = Utilities.newBlob(bytes).getDataAsString('UTF-8');
  }
  var parsed;
  try { parsed = JSON.parse(json); } catch (e) { throw new Error('محتوای کد JSON معتبر نیست'); }
  if (parsed && parsed.app === 'MECADES' && parsed.data) return parsed;
  if (parsed && parsed.settings && parsed.orders) return { app: 'MECADES', users: [], data: parsed };
  throw new Error('ساختار بکاپ شناسایی نشد');
}

/* ---------------------------------------------------------------------------
 *  ۶) نوشتن داده در شیت‌ها
 * ------------------------------------------------------------------------- */

function importPayload_(payload, source, keepCodeSheet) {
  var data = payload.data || payload;
  var users = payload.users || [];
  setupAll_(false, !!keepCodeSheet);   /* ساختار تازه و تمیز */
  var book = ss_();

  var byId = {};
  (data.customers || []).forEach(function (c) { byId[c.id] = c; });
  var svcById = {};
  (data.services || []).forEach(function (s) { svcById[s.id] = s; });
  var actById = {};
  (data.activities || []).forEach(function (a) { actById[a.id] = a; });
  var orderByCode = {};
  (data.orders || []).forEach(function (o) { orderByCode[o.code] = o; });
  var userById = {};
  (users || []).forEach(function (u) { userById[u.id] = u; });

  /* ---- سفارش‌ها ---- */
  var paidOf = function (o) {
    var sum = 0;
    (data.payments || []).forEach(function (p) {
      if (p.orderCode === o.code) sum += num_(p.amount);
    });
    return sum || num_(o.paid);
  };
  var orders = (data.orders || []).slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
  var orderRows = orders.map(function (o) {
    var c = byId[o.customerId] || {};
    var paid = paidOf(o);
    return [
      o.code, jdate_(o.created), c.name || '', c.company || '', (svcById[o.serviceId] || {}).name || '',
      num_(o.hours), num_(o.rate), money_(o.quote), money_(paid), money_(Math.max(0, num_(o.quote) - paid)),
      jdateOnly_(o.deadline), STATUS_LABEL[o.status] || o.status, PRIORITY_LABEL[o.priority] || o.priority || '',
      SOURCE_LABEL[o.source] || o.source || '', o.desc || '', o.internal || '',
      (o.files && o.files.length) ? o.files.join(' | ') : ''
    ];
  });
  writeTable_('سفارش‌ها', orderRows);

  /* ---- پرداخت‌ها ---- */
  var pays = (data.payments || []).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  var payRows = pays.map(function (p) {
    var c = byId[p.customerId] || {};
    var o = orderByCode[p.orderCode];
    return [jdate_(p.date), p.orderCode || '', c.name || (o && byId[o.customerId] ? byId[o.customerId].name : ''),
      money_(p.amount), p.method || '', p.note || ''];
  });
  writeTable_('پرداخت‌ها', payRows);

  /* ---- مشتریان ---- */
  var custs = (data.customers || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fa'); });
  var custRows = custs.map(function (c) {
    var mine = (data.orders || []).filter(function (o) { return o.customerId === c.id; });
    var total = mine.reduce(function (a, o) { return a + num_(o.quote); }, 0);
    var paid = mine.reduce(function (a, o) { return a + paidOf(o); }, 0);
    return [c.name || '', c.phone || '', c.company || '', c.email || '', c.address || '', c.note || '',
      jdateOnly_(c.created), mine.length, money_(total), money_(paid), money_(Math.max(0, total - paid))];
  });
  writeTable_('مشتریان', custRows);

  /* ---- خدمات و نرخ‌نامه ---- */
  writeTable_('خدمات', (data.services || []).map(function (s) {
    return [s.name || '', s.short || '', s.active === false ? 'خیر' : 'بله', num_(s.rate), s.desc || ''];
  }));
  writeTable_('نرخ‌نامه', (data.tiers || []).map(function (t) {
    return [t.label || '', num_(t.max), num_(t.rate)];
  }));

  /* ---- کاربران ---- */
  var userRows = (users || []).slice()
    .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'fa'); })
    .map(function (u) {
      var row = [u.firstName || '', u.lastName || '', u.username || '', ROLE_LABEL[u.role] || u.role || '',
        u.phone || '', u.account || '', u.active === false ? 'غیرفعال' : 'فعال',
        jdateOnly_(u.created), u.lastLogin ? jdate_(u.lastLogin) : ''];
      if (INCLUDE_PASSWORD_HASHES) row.push(u.passwordHash || '');
      return row;
    });
  writeTable_('کاربران', userRows);

  /* ---- فعالیت‌ها ---- */
  writeTable_('فعالیت‌ها', (data.activities || []).map(function (a) {
    return [a.name || '', num_(a.rate), a.needOrder ? 'بله' : 'خیر', a.active === false ? 'خیر' : 'بله', a.desc || ''];
  }));

  /* ---- ساعت‌کار ---- */
  var sessions = (data.sessions || []).slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
  var sesRows = sessions.map(function (s) {
    var act = actById[s.activityId] || {};
    var sec = ((s.endedAt || Date.now()) - (s.startedAt || Date.now())) / 1000;
    var rate = num_(act.rate);
    var o = s.orderId ? (data.orders || []).filter(function (x) { return x.id === s.orderId; })[0] : null;
    var u = userById[s.userId];
    return [jdateOnly_(s.startedAt), (u && u.name) || s.userName || '', act.name || '',
      o ? (o.code + ' — ' + o.title) : '—',
      new Date(s.startedAt).toTimeString().slice(0, 5), s.endedAt ? new Date(s.endedAt).toTimeString().slice(0, 5) : 'در حال کار',
      hours_(sec), rate, Math.round(hours_(sec) * rate), s.note || ''];
  });
  writeTable_('ساعت‌کار', sesRows);

  /* ---- گزارش دستمزد (تجمیع) ---- */
  var agg = {};
  sessions.forEach(function (s) {
    var act = actById[s.activityId] || {};
    var key = (s.userId || '') + '|' + (s.activityId || '');
    if (!agg[key]) {
      var u = userById[s.userId];
      agg[key] = { user: (u && u.name) || s.userName || '—', act: act.name || '—', rate: num_(act.rate), hrs: 0 };
    }
    var sec = ((s.endedAt || Date.now()) - (s.startedAt || Date.now())) / 1000;
    agg[key].hrs += sec / 3600;
  });
  var wageRows = Object.keys(agg).map(function (k) {
    var a = agg[k];
    return [a.user, a.act, Math.round(a.hrs * 100) / 100, a.rate, Math.round(a.hrs * a.rate)];
  }).sort(function (a, b) { return b[4] - a[4]; });
  wageRows.push(['جمع کل', '', Math.round(wageRows.reduce(function (s, r) { return s + r[2]; }, 0) * 100) / 100, '',
    Math.round(wageRows.reduce(function (s, r) { return s + r[4]; }, 0))]);
  writeTable_('گزارش دستمزد', wageRows);

  /* ---- پروژه‌ها ---- */
  writeTable_('پروژه‌ها', (data.projects || []).map(function (p) {
    return [p.num || '', p.title || '', p.cat || '', (p.tags || []).join(' · '), p.published ? 'منتشر' : 'پیش‌نویس', p.desc || ''];
  }));

  /* ---- تنظیمات ---- */
  var st = data.settings || {};
  var setRows = [
    ['نام مجموعه', st.company || ''], ['نام حقوقی', st.legalName || ''],
    ['تلفن ۱', st.phone1 || ''], ['تلفن ۲', st.phone2 || ''], ['ایمیل', st.email || ''],
    ['آدرس', st.address || ''], ['حداقل مبلغ سفارش (تومان)', money_(st.minOrder)],
    ['نرخ ساعتی پیش‌فرض', money_(st.defaultRate)], ['پیشوند کد سفارش', st.invoicePrefix || ''],
    ['مدیر فنی', st.owner || ''], ['ساعات کاری روزانه', num_(st.hoursPerDay)],
    ['نسخهٔ پنل', 'v.' + (data.rev !== undefined ? '1.0.' + data.rev : '—')],
    ['شمارهٔ ویرایش', num_(data.rev)],
    ['تاریخ آخرین بکاپ', jdate_(payload.at || Date.now())],
    ['منبع این بکاپ', source]
  ];
  writeTable_('تنظیمات', setRows);

  /* ---- داشبورد ---- */
  var totalQuote = orders.reduce(function (s, o) { return s + num_(o.quote); }, 0);
  var totalPaid = orders.reduce(function (s, o) { return s + paidOf(o); }, 0);
  var openSessions = (data.sessions || []).filter(function (s) { return !s.endedAt; }).length;
  var wageTotal = wageRows[wageRows.length - 1][4];
  var dashRows = [
    ['سفارش‌ها', orders.length, 'تعداد کل سفارش‌های ثبت‌شده'],
    ['مبلغ کل سفارش‌ها', money_(totalQuote), 'جمع مبلغ سفارش‌ها (تومان)'],
    ['پرداختی‌ها', money_(totalPaid), 'جمع پرداخت‌های ثبت‌شده'],
    ['ماندهٔ مطالبات', money_(Math.max(0, totalQuote - totalPaid)), 'باقی‌ماندهٔ وصول‌نشده'],
    ['مشتریان', (data.customers || []).length, 'تعداد پرونده‌های مشتری'],
    ['تعداد پرداخت‌ها', (data.payments || []).length, 'تعداد فیش‌های ثبت‌شده'],
    ['کاربران', (users || []).length, (users || []).filter(function (u) { return u.active !== false; }).length + ' نفر فعال'],
    ['فعالیت‌های باز', openSessions, 'ساعت‌کارهایی که هنوز پایان نیافته‌اند'],
    ['مجموع ساعت‌کار', Math.round(sesRows.reduce(function (s, r) { return s + num_(r[6]); }, 0) * 100) / 100, 'جمع ساعات ثبت‌شده'],
    ['دستمزد کل', money_(wageTotal), 'ساعت × نرخ ساعتی فعالیت'],
    ['آخرین ورود داده', jdate_(payload.at || Date.now()), 'زمان اجرای این بکاپ'],
    ['منبع', source === 'webapp' ? 'اتصال زندهٔ پنل (Web App)' : (source === 'sheet' ? 'کد چسبانده‌شده در شیت' : 'فایل متنی Drive'), 'مسیر ورود داده']
  ];
  Object.keys(STATUS_LABEL).forEach(function (k) {
    var n = orders.filter(function (o) { return o.status === k; }).length;
    dashRows.push(['سفارش — ' + STATUS_LABEL[k], n, 'وضعیت ' + STATUS_LABEL[k]]);
  });
  writeTable_('داشبورد', dashRows);
  formatDashboard_();

  var summary = {
    orders: orders.length, customers: (data.customers || []).length, payments: (data.payments || []).length,
    users: (users || []).length, sessions: (data.sessions || []).length,
    activities: (data.activities || []).length, version: data.rev
  };
  logRow_(source, summary, 'موفق');
  toast_(summaryText_(summary), 'بکاپ انجام شد');
  return summary;
}

function summaryText_(s) {
  if (!s) return '';
  return s.orders + ' سفارش · ' + s.customers + ' مشتری · ' + s.payments + ' پرداخت · ' +
    s.sessions + ' ساعت‌کار · ' + s.users + ' کاربر';
}

function writeTable_(name, rows) {
  var def = SHEETS_().filter(function (d) { return d.name === name; })[0];
  if (!def) throw new Error('شیت تعریف‌نشده: ' + name);
  var sh = sheetFor_(name);
  if (sh.getFilter()) { try { sh.getFilter().remove(); } catch (e) {} }
  var cols = def.headers.length;
  if (!rows || !rows.length) {
    if (sh.getMaxRows() > 1) {
      sh.getRange(2, 1, sh.getMaxRows() - 1, Math.max(cols, sh.getMaxColumns())).clearContent();
    }
    sh.setFrozenRows(1);
    applyWidths_(sh, def.widths);
    return;
  }
  var need = rows.length + 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  /* قالب ستون‌ها باید *قبل* از نوشتن مقدار ست شود؛ وگرنه گوگل «1405/07/25» را تاریخ میلادی می‌فهمد */
  applyFormatsTo_(sh, def.formats, startRow, rows.length);
  var startRow = 2;
  if (sh.getMaxRows() > need) {
    sh.getRange(startRow + rows.length, 1, sh.getMaxRows() - need + 1, Math.max(cols, sh.getMaxColumns())).clearContent();
  }
  sh.getRange(startRow, 1, rows.length, cols).setValues(rows);
  sh.getRange(startRow, 1, rows.length, cols)
    .setFontFamily('Tahoma').setFontSize(10).setVerticalAlignment('middle').setWrap(false)
    .setHorizontalAlignment('right');
  def.widths && applyWidths_(sh, def.widths);
  sh.setFrozenRows(1);
  try {
    if (sh.getFilter()) sh.getFilter().remove();
    sh.getRange(1, 1, need, cols).createFilter();
  } catch (e) {}
  applyBanding_(sh, cols);
  if (name === 'سفارش‌ها') statusColors_(sh, rows.length);
  if (name === 'ساعت‌کار') sessionColors_(sh, rows.length);
  sh.autoResizeRows(startRow, rows.length);
}

function statusColors_(sh, n) {
  try { sh.clearConditionalFormatRules(); } catch (e) {}
  var make = function (formula, bg, fg) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(bg).setFontColor(fg)
      .setRanges([sh.getRange(2, 12, n, 1)]).build();
  };
  var list = [
    make('=$L2="تحویل شده"', '#E4F3E7', C.green),
    make('=$L2="لغو شده"', '#EEF0F2', C.grey),
    make('=$L2="در حال طراحی"', '#FBEAE8', C.red),
    make('=$L2="بررسی و قیمت‌گذاری"', '#FBF3E0', C.amber),
    make('=$L2="بازبینی با مشتری"', '#EFEBF6', '#4B3B74'),
    make('=$L2="نمونه‌سازی"', '#E3F1EE', '#1F6F61'),
    make('=$L2="ثبت شده"', '#E7EDF3', C.navy)
  ];
  /* مانده > ۰ را قرمز کن */
  list.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setFontColor(C.red).setBold(true)
    .setRanges([sh.getRange(2, 10, n, 1)]).build());
  sh.setConditionalFormatRules(list);
}

function sessionColors_(sh, n) {
  try {
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$F2="در حال کار"')
      .setBackground('#E4F3E7').setFontColor(C.green).setBold(true)
      .setRanges([sh.getRange(2, 1, n, 10)]).build();
    var all = sh.getConditionalFormatRules();
    all.push(rule);
    sh.setConditionalFormatRules(all);
  } catch (e) {}
}

function formatDashboard_() {
  var sh = ss_().getSheetByName('داشبورد');
  if (!sh) return;
  var last = sh.getLastRow();
  if (last < 2) return;
  sh.getRange(2, 1, last - 1, 1).setFontWeight('bold');
  sh.getRange(2, 2, last - 1, 1).setHorizontalAlignment('center').setFontSize(12).setFontWeight('bold').setFontColor(C.navyDark);
  sh.getRange(2, 3, last - 1, 1).setFontColor(C.grey).setFontSize(10);
  sh.setRowHeights(2, last - 1, 30);
  sh.setFrozenRows(1);
}

function logRow_(source, summary, status) {
  var sh = sheetFor_('لاگ');
  var row = [jdate_(Date.now()), source, summary ? summary.orders : '', summary ? summary.customers : '',
    summary ? summary.payments : '', summary ? summary.users : '', summary ? summary.sessions : '',
    summary && summary.version !== undefined ? 'v.1.0.' + summary.version : '', status || ''];
  if (sh.getLastRow() < 2) {
    sh.getRange(1, 1, 1, 9).setValues([['زمان', 'منبع', 'سفارش‌ها', 'مشتریان', 'پرداخت‌ها', 'کاربران', 'ساعت‌کار', 'نسخهٔ پنل', 'وضعیت']]);
    styleHeader_(sh, 9);
  }
  sh.appendRow(row);
  sh.setRightToLeft(true);
  applyWidths_(sh, [140, 110, 100, 100, 100, 100, 100, 110, 300]);
}

function currentCounts_() {
  var book = ss_();
  var c = function (name) {
    var sh = book.getSheetByName(name);
    return sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  };
  var last = '';
  var log = book.getSheetByName('لاگ');
  if (log && log.getLastRow() > 1) last = log.getRange(log.getLastRow(), 1).getValue();
  return { orders: c('سفارش‌ها'), customers: c('مشتریان'), payments: c('پرداخت‌ها'), sessions: c('ساعت‌کار'), lastImport: last };
}

/* ---------------------------------------------------------------------------
 *  ۷) باز کردن DEFLATE خام (برای کدهای MCD1z)
 *     پیاده‌سازی کامل RFC 1951: بلوک‌های stored / fixed / dynamic
 * ------------------------------------------------------------------------- */

function inflateRaw_(bytes) {
  var pos = 0, bitbuf = 0, bitcnt = 0;
  var out = [];
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function bits(n) {
    while (bitcnt < n) {
      if (pos >= bytes.length) throw new Error('داده فشرده ناقص است');
      bitbuf |= bytes[pos++] << bitcnt;
      bitcnt += 8;
    }
    var v = bitbuf & ((1 << n) - 1);
    bitbuf >>>= n;
    bitcnt -= n;
    return v;
  }
  /** ساخت جدول هافمن کانونی */
  function build(lengths) {
    var max = 0, i;
    for (i = 0; i < lengths.length; i++) if (lengths[i] > max) max = lengths[i];
    var count = new Array(max + 1);
    for (i = 0; i <= max; i++) count[i] = 0;
    for (i = 0; i < lengths.length; i++) count[lengths[i]]++;
    count[0] = 0;
    var offs = new Array(max + 2);
    offs[1] = 0;
    for (i = 1; i < max; i++) offs[i + 1] = offs[i] + count[i];
    var symbols = new Array(lengths.length);
    for (i = 0; i < lengths.length; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { count: count, symbols: symbols.slice(0, lengths.length), max: max };
  }
  function decode(h) {
    var code = 0, first = 0, index = 0, len, c;
    for (len = 1; len <= h.max; len++) {
      code |= bits(1);
      c = h.count[len];
      if (code - first < c) return h.symbols[index + (code - first)];
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw new Error('کد هافمن نامعتبر');
  }
  function copyBlock(len, dist) {
    var start = out.length - dist;
    if (start < 0) throw new Error('فاصلهٔ نامعتبر در داده فشرده');
    for (var i = 0; i < len; i++) out.push(out[start + i]);
  }

  var fixedLit = null, fixedDist = null;
  function getFixed() {
    if (fixedLit) return;
    var i, l = new Array(288);
    for (i = 0; i < 144; i++) l[i] = 8;
    for (i = 144; i < 256; i++) l[i] = 9;
    for (i = 256; i < 280; i++) l[i] = 7;
    for (i = 280; i < 288; i++) l[i] = 8;
    fixedLit = build(l);
    var d = new Array(30);
    for (i = 0; i < 30; i++) d[i] = 5;
    fixedDist = build(d);
  }

  var last = 0;
  while (!last) {
    last = bits(1);
    var type = bits(2);
    if (type === 0) {           /* بدون فشرده‌سازی */
      bitbuf = 0; bitcnt = 0;
      if (pos + 4 > bytes.length) throw new Error('بلوک خام ناقص');
      var len = bytes[pos] | (bytes[pos + 1] << 8);
      pos += 4;                 /* len + ~len */
      for (var i2 = 0; i2 < len; i2++) out.push(bytes[pos + i2]);
      pos += len;
    } else if (type === 1 || type === 2) {
      var lit, distH;
      if (type === 1) { getFixed(); lit = fixedLit; distH = fixedDist; }
      else {
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        var clen = new Array(19);
        for (var j = 0; j < 19; j++) clen[j] = 0;
        for (var j2 = 0; j2 < hclen; j2++) clen[CLORDER[j2]] = bits(3);
        var clH = build(clen);
        var lens = [];
        while (lens.length < hlit + hdist) {
          var sym = decode(clH);
          if (sym < 16) lens.push(sym);
          else if (sym === 16) {
            var prev = lens[lens.length - 1];
            var rep = 3 + bits(2);
            while (rep--) lens.push(prev);
          } else if (sym === 17) {
            var rep17 = 3 + bits(3);
            while (rep17--) lens.push(0);
          } else {
            var rep18 = 11 + bits(7);
            while (rep18--) lens.push(0);
          }
        }
        lit = build(lens.slice(0, hlit));
        distH = build(lens.slice(hlit));
      }
      while (true) {
        var s = decode(lit);
        if (s < 256) { out.push(s); continue; }
        if (s === 256) break;
        var li = s - 257;
        var length = LBASE[li] + bits(LEXT[li]);
        var ds = decode(distH);
        var distance = DBASE[ds] + bits(DEXT[ds]);
        copyBlock(length, distance);
      }
    } else {
      throw new Error('نوع بلوک فشردهٔ نامعتبر');
    }
  }
  return out;
}
