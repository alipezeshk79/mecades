/* =====================================================================
 * MECADES Admin — کد کامل بکاپ‌گیری اکسل (Excel / XLSX)
 * ---------------------------------------------------------------------
 * این فایل «مستقل» است و هیچ کتابخانهٔ بیرونی نمی‌خواهد؛ یک فایل اکسل
 * واقعی (OOXML) می‌سازد و همان‌جایی که لازم باشد قابل استفاده است.
 *
 * ۱) استفاده در پنل (فایل را بعد از app.js لود کنید):
 *        <script src="excel-backup.js"></script>
 *        MECADES_EXCEL_BACKUP.download(Store.state);        → دانلود مستقیم
 *        var bytes = MECADES_EXCEL_BACKUP.build(Store.state); → Uint8Array
 *
 * ۲) استفادهٔ مستقل (بدون پنل):
 *        var state = { orders:[…], customers:[…], payments:[…],
 *                      services:[…], tiers:[…], settings:{…} };
 *        MECADES_EXCEL_BACKUP.download(state, 'backup.xlsx');
 *
 * ۳) بکاپ زمان‌بندی‌شده (خودکار، مثلاً هر شب):
 *        setInterval(function(){ MECADES_EXCEL_BACKUP.download(Store.state); },
 *                    24*60*60*1000);
 *
 * خروجی: یک فایل اکسل با ۶ برگه
 *        سفارش‌ها · مشتریان · پرداختی‌ها · خدمات و نرخنامه ·
 *        گزارش ماهانه · کاربران و تنظیمات
 *
 * نسخه: v1.0.0 — بدون وابستگی، بدون شبکه، کاملاً آفلاین
 * ===================================================================== */

/* =====================================================================
   MECADES Admin — XLSX Writer (بدون هیچ کتابخانهٔ بیرونی)
   یک فایل اکسل واقعی (.xlsx) می‌سازد: فایل ZIP + XML مطابق OOXML.
   استفاده:
     var wb = XLSXWriter.book();
     XLSXWriter.sheet(wb, 'سفارش‌ها', [['کد','مشتری','مبلغ'],[...]]);
     XLSXWriter.download(wb, 'backup.xlsx');
   ===================================================================== */
window.XLSXWriter = (function () {
  'use strict';

  /* ---------- CRC32 (برای هدر ZIP) ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /* انکودر UTF-8 (با پشتیبانی مرورگرهای قدیمی و محیط‌های بدون TextEncoder) */
  var TE = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;
  function utf8(str) {
    var out = [], i, c, c2, cp;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) { out.push(c); }
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length && (c2 = str.charCodeAt(i + 1)) >= 0xDC00 && c2 <= 0xDFFF) {
        cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
        i++;
      } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return new Uint8Array(out);
  }
  function enc(str) { return TE ? TE.encode(str) : utf8(str); }

  /* ---------- ZIP (روش store بدون فشرده‌سازی) ---------- */
  function zip(files) {
    var now = new Date();
    var dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    var dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    var local = [], central = [], offset = 0;

    files.forEach(function (f) {
      var name = enc(f.name);
      var data = f.data;
      var crc = crc32(data);

      var lh = new Uint8Array(30 + name.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);   // UTF-8
      lv.setUint16(8, 0, true);        // store
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      lh.set(name, 30);
      local.push(lh, data);

      var ch = new Uint8Array(46 + name.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);

      offset += lh.length + data.length;
    });

    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    var eo = new Uint8Array(22);
    var ev = new DataView(eo.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    var all = local.concat(central, [eo]);
    var total = all.reduce(function (a, c) { return a + c.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  /* ---------- XML ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  function colName(i) {
    var s = '';
    i = i + 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function safeSheetName(n, used) {
    var base = String(n || 'Sheet').replace(/[\[\]\*\/\\\?:]/g, ' ').trim().slice(0, 31) || 'Sheet';
    var out = base, i = 2;
    while (used.indexOf(out) > -1) { out = base.slice(0, 28) + ' ' + i; i++; }
    return out;
  }

  /* ---------- Sheet XML ---------- */
  function sheetXML(rows, opts) {
    opts = opts || {};
    var widths = opts.widths || [];
    var nCols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    xml += '<dimension ref="A1:' + colName(nCols - 1) + Math.max(rows.length, 1) + '"/>';
    xml += '<sheetViews><sheetView rightToLeft="1" workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    xml += '<sheetFormatPr defaultRowHeight="16"/>';
    if (widths.length) {
      xml += '<cols>';
      widths.forEach(function (w, i) {
        xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      });
      xml += '</cols>';
    }
    xml += '<sheetData>';
    rows.forEach(function (row, r) {
      xml += '<row r="' + (r + 1) + '"' + (r === 0 ? ' ht="22" customHeight="1"' : '') + '>';
      row.forEach(function (cell, c) {
        var ref = colName(c) + (r + 1);
        var v = (cell && typeof cell === 'object' && 'v' in cell) ? cell.v : cell;
        var style = (cell && typeof cell === 'object' && cell.s !== undefined) ? cell.s : (r === 0 ? 1 : 0);
        if (v === null || v === undefined || v === '') {
          xml += '<c r="' + ref + '" s="' + style + '"/>';
        } else if (typeof v === 'number' && isFinite(v)) {
          xml += '<c r="' + ref + '" s="' + (r === 0 ? style : 3) + '"><v>' + v + '</v></c>';
        } else {
          xml += '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
        }
      });
      xml += '</row>';
    });
    xml += '</sheetData></worksheet>';
    return xml;
  }

  /* ---------- کتاب (workbook) ---------- */
  function book() { return { sheets: [], names: [] }; }

  function sheet(wb, name, rows, opts) {
    wb.sheets.push(sheetXML(rows || [], opts || {}));
    wb.names.push(safeSheetName(name, wb.names));
    return wb;
  }
  /* نام برگهٔ یکتا (در صورت تکراری بودن شماره‌گذاری می‌شود) */

  function stylesXML() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="12"/><color rgb="FF1E2D3B"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1E2D3B"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFD8E0E6"/></left><right style="thin"><color rgb="FFD8E0E6"/></right>' +
      '<top style="thin"><color rgb="FFD8E0E6"/></top><bottom style="thin"><color rgb="FFD8E0E6"/></bottom><diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="0"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  function build(wb) {
    var files = [];
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    wb.sheets.forEach(function (s, i) {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    ct += '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';
    files.push({ name: '[Content_Types].xml', data: enc(ct) });

    files.push({ name: '_rels/.rels', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>') });

    var wbx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    wb.names.forEach(function (n, i) {
      wbx += '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    });
    wbx += '</sheets></workbook>';
    files.push({ name: 'xl/workbook.xml', data: enc(wbx) });

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    wb.sheets.forEach(function (s, i) {
      rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    });
    rels += '<Relationship Id="rId' + (wb.sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: enc(rels) });

    wb.sheets.forEach(function (s, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: enc(s) });
    });
    files.push({ name: 'xl/styles.xml', data: enc(stylesXML()) });

    var iso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({ name: 'docProps/core.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>MECADES Admin Backup</dc:title><dc:creator>MECADES Admin</dc:creator>' +
      '<cp:lastModifiedBy>MECADES Admin</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified>' +
      '</cp:coreProperties>') });
    files.push({ name: 'docProps/app.xml', data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>MECADES Admin</Application></Properties>') });

    return zip(files);
  }

  function blob(wb) {
    return new Blob([build(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function download(wb, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob(wb));
    a.download = filename || 'mecades-backup.xlsx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
  }

  return { book: book, sheet: sheet, build: build, blob: blob, download: download, zip: zip, crc32: crc32 };
})();

/* =====================================================================
   MECADES Excel Backup — ساخت کتاب کاری از وضعیت پنل
   ===================================================================== */
(function () {
  'use strict';

  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var FA = '۰۱۲۳۴۵۶۷۸۹';

  /* ---------- کمکی‌های تاریخ شمسی و اعداد فارسی ---------- */
  function fa(v) {
    return String(v).replace(/[0-9]/g, function (d) { return FA.charAt(d); })
      .replace(/,/g, '٬').replace(/\./g, '٫');
  }
  function g2j(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
               Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + days % 31; }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + (days - 186) % 30; }
    return [jy, jm, jd];
  }
  function faDate(ts) {
    var d = new Date(ts), j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return fa(j[2]) + ' ' + MONTHS[j[1] - 1] + ' ' + fa(j[0]);
  }
  function monthKey(ts) {
    var j = g2j(new Date(ts).getFullYear(), new Date(ts).getMonth() + 1, new Date(ts).getDate());
    return j[0] + '-' + (j[1] < 10 ? '0' + j[1] : j[1]);
  }
  function num(n) { var v = Math.round(Number(n) || 0); return isFinite(v) ? v : 0; }

  /* ---------- وضعیت پیش‌فرض ---------- */
  function defaultState() {
    if (window.Store && window.Store.state) return window.Store.state;
    return { orders: [], customers: [], payments: [], services: [], tiers: [], settings: {} };
  }

  /* ---------- ساخت کتاب کاری ---------- */
  function versionOf(st) {
    var rev = (st && st.rev) || 0;
    return '1.0.' + rev;
  }
  function buildWorkbook(state) {
    var st = state || defaultState();
    var orders = st.orders || [], customers = st.customers || [], payments = st.payments || [];
    var services = st.services || [], tiers = st.tiers || [];

    function customerById(id) { return customers.filter(function (c) { return c.id === id; })[0] || {}; }
    function customerName(id) { var c = customerById(id); return c.name || '—'; }
    function serviceName(id) { var s = services.filter(function (x) { return x.id === id; })[0]; return s ? (s.short || s.name) : '—'; }
    function orderPaid(o) {
      return payments.filter(function (p) { return p.orderCode === o.code; })
        .reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
    }
    var STATUS = { new: 'جدید', quote: 'برآورد', design: 'طراحی', client: 'تأیید مشتری', sample: 'نمونه اولیه', done: 'تحویل شده', cancel: 'لغو شده' };
    var PRIORITY = { high: 'فوری', normal: 'عادی', low: 'کم‌اهمیت' };

    var wb = window.XLSXWriter.book();

    /* ۱) سفارش‌ها */
    var oRows = [['کد سفارش', 'تاریخ ثبت', 'مشتری', 'شرکت', 'خدمت', 'ساعات', 'نرخ ساعتی', 'مبلغ (تومان)',
      'پرداخت‌شده (تومان)', 'مانده (تومان)', 'موعد تحویل', 'وضعیت', 'اولویت', 'توضیحات']];
    orders.slice().sort(function (a, b) { return a.created - b.created; }).forEach(function (o) {
      var c = customerById(o.customerId), paid = orderPaid(o);
      oRows.push([o.code, faDate(o.created), customerName(o.customerId), c.company || '', serviceName(o.serviceId),
        num(o.hours), num(o.rate), num(o.quote), num(paid), num(Math.max(0, o.quote - paid)),
        faDate(o.deadline), STATUS[o.status] || o.status, PRIORITY[o.priority] || o.priority, o.desc || '']);
    });
    window.XLSXWriter.sheet(wb, 'سفارش‌ها', oRows, { widths: [12, 14, 20, 18, 18, 8, 12, 16, 16, 16, 14, 12, 10, 34] });

    /* ۲) مشتریان */
    var cRows = [['نام مشتری', 'شرکت', 'تلفن', 'ایمیل', 'آدرس', 'تعداد سفارش', 'مجموع فروش (تومان)', 'مانده بدهی (تومان)', 'یادداشت']];
    customers.forEach(function (c) {
      var os = orders.filter(function (o) { return o.customerId === c.id; });
      var total = os.reduce(function (a, o) { return a + o.quote; }, 0);
      var paid = os.reduce(function (a, o) { return a + orderPaid(o); }, 0);
      cRows.push([c.name, c.company || '', c.phone || '', c.email || '', c.address || '',
        num(os.length), num(total), num(Math.max(0, total - paid)), c.note || '']);
    });
    window.XLSXWriter.sheet(wb, 'مشتریان', cRows, { widths: [20, 20, 16, 24, 28, 12, 20, 18, 26] });

    /* ۳) پرداختی‌ها */
    var pRows = [['تاریخ', 'شماره سفارش', 'مشتری', 'مبلغ (تومان)', 'روش پرداخت', 'توضیحات']];
    payments.slice().sort(function (a, b) { return a.date - b.date; }).forEach(function (p) {
      pRows.push([faDate(p.date), p.orderCode || '', customerName(p.customerId), num(p.amount), p.method || '', p.note || '']);
    });
    window.XLSXWriter.sheet(wb, 'پرداختی‌ها', pRows, { widths: [14, 14, 20, 16, 16, 30] });

    /* ۴) خدمات و نرخنامه */
    var sRows = [['خدمت', 'توضیح کوتاه', 'شرح', 'نرخ پایه (تومان)', 'وضعیت']];
    services.forEach(function (sv) {
      sRows.push([sv.name, sv.short || '', sv.desc || '', num(sv.rate), sv.active === false ? 'غیرفعال' : 'فعال']);
    });
    sRows.push([]);
    sRows.push(['پلکان نرخ ساعتی', 'تا (ساعت)', 'نرخ (تومان)']);
    tiers.forEach(function (t) { sRows.push([t.label, num(t.max), num(t.rate)]); });
    window.XLSXWriter.sheet(wb, 'خدمات و نرخنامه', sRows, { widths: [26, 20, 40, 18, 12] });

    /* ۵) گزارش ماهانه */
    var mRows = [['ماه', 'تعداد سفارش', 'ساعات کاری', 'فروش (تومان)', 'دریافتی (تومان)', 'تحویل‌شده']];
    var now = new Date();
    for (var i = 11; i >= 0; i--) {
      var t = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var key = monthKey(t.getTime());
      var os = orders.filter(function (o) { return monthKey(o.created) === key; });
      var pay = payments.filter(function (p) { return monthKey(p.date) === key; })
        .reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
      mRows.push([MONTHS[g2j(t.getFullYear(), t.getMonth() + 1, 1)[1] - 1], num(os.length),
        num(os.reduce(function (a, o) { return a + o.hours; }, 0)),
        num(os.reduce(function (a, o) { return a + o.quote; }, 0)), num(pay),
        num(os.filter(function (o) { return o.status === 'done'; }).length)]);
    }
    window.XLSXWriter.sheet(wb, 'گزارش ماهانه', mRows, { widths: [14, 14, 14, 18, 18, 14] });

    /* ۶) کاربران و تنظیمات */
    var uRows = [['نام', 'نام خانوادگی', 'نام کاربری', 'نقش', 'وضعیت', 'تاریخ ایجاد', 'آخرین ورود']];
    var users = [];
    try { users = JSON.parse(localStorage.getItem('mecades_users') || '[]'); } catch (e) {}
    var ROLE_LABEL = { admin: 'مدیر سیستم', accountant: 'حسابدار', engineer: 'مهندس طراح', viewer: 'مشاهده‌گر' };
    users.forEach(function (u) {
      uRows.push([u.firstName || '', u.lastName || '', u.username, ROLE_LABEL[u.role] || u.role,
        u.active === false ? 'غیرفعال' : 'فعال', u.createdAt ? faDate(u.createdAt) : '—', u.lastLogin ? faDate(u.lastLogin) : '—']);
    });
    uRows.push([]);
    uRows.push(['تنظیمات مجموعه', 'مقدار']);
    var sett = st.settings || {};
    Object.keys(sett).forEach(function (k) { uRows.push([k, String(sett[k])]); });
    uRows.push([]);
    uRows.push(['نسخه پنل', 'v.' + versionOf(st)]);
    uRows.push(['شمارهٔ ویرایش', num((st && st.rev) || 0) + ' ویرایش']);
    window.XLSXWriter.sheet(wb, 'کاربران و تنظیمات', uRows, { widths: [18, 20, 20, 16, 12, 16, 16] });

    return wb;
  }

  /* ---------- خروجی ---------- */
  window.MECADES_EXCEL_BACKUP = {
    build: function (state) { return window.XLSXWriter.build(buildWorkbook(state)); },
    download: function (state, filename) {
      var j = g2j(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
      var name = filename || ('mecades-backup-' + j[0] + '-' + (j[1] < 10 ? '0' + j[1] : j[1]) + '-' + (j[2] < 10 ? '0' + j[2] : j[2]) + '.xlsx');
      window.XLSXWriter.download(buildWorkbook(state), name);
      return name;
    },
    faDate: faDate, monthKey: monthKey
  };
})();
