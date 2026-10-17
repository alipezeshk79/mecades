/* =====================================================================
   MECADES Admin — Store (state, persistence, seed data, helpers)
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'mecades_admin_v2';
  var VERSION = '1.0.0';

  /* ---------------- Jalali (شمسی) calendar ---------------- */
  var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var WEEKDAYS = ['شنبه','یک‌شنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنج‌شنبه','جمعه'];

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

  function j2g(jy, jm, jd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy = jy <= 979 ? 621 : 1600;
    jy -= jy <= 979 ? 0 : 979;
    var days = 365 * jy + Math.floor((jy + 3) / 4) - Math.floor((jy + 99) / 100) +
               Math.floor((jy + 399) / 400) - 80 + jd + (jm < 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30);
    var gm = 0, i;
    for (i = 0; i < 12 && days > g_d_m[i + 1] + 365; i++) {}
    gm = i + 1;
    var gd = days - g_d_m[gm];
    var leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    if (gm > 2 && leap) gd++;
    return [gy, gm, gd];
  }

  /* ---------------- Formatting ---------------- */
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  function fa(v) {
    return String(v).replace(/[0-9]/g, function (d) { return FA.charAt(d); })
      .replace(/,/g, '٬').replace(/\./g, '٫');
  }
  function en(v) { return String(v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }); }
  function money(n) {
    n = Math.round(Number(n) || 0);
    return fa(n.toLocaleString('en-US').replace(/,/g, '٬')) + ' تومان';
  }
  function moneyShort(n) {
    n = Math.round(Number(n) || 0);
    if (n >= 1e9) return fa((n / 1e9).toFixed(1)) + ' میلیارد';
    if (n >= 1e6) return fa(Math.round(n / 1e5) / 10) + ' میلیون';
    if (n >= 1e3) return fa(Math.round(n / 1e2) / 10) + ' هزار';
    return fa(n);
  }
  function hoursFmt(h) { return fa(Math.round(Number(h) || 0)) + ' ساعت'; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function faDate(ts) {
    var d = new Date(ts), j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return fa(j[2]) + ' ' + MONTHS[j[1] - 1] + ' ' + fa(j[0]);
  }
  function faDateShort(ts) {
    var d = new Date(ts), j = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return fa(j[2]) + ' ' + MONTHS[j[1] - 1];
  }
  function faDateTime(ts) {
    var d = new Date(ts);
    return faDate(ts) + ' — ' + fa(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
  }
  function faDay(ts) {
    var d = new Date(ts);
    return WEEKDAYS[(d.getDay() + 1) % 7] + ' ' + faDate(ts);
  }
  function relTime(ts) {
    var diff = Date.now() - ts, m = 60000, h = 3600000, d = 86400000;
    if (diff < m) return 'همین الان';
    if (diff < h) return fa(Math.floor(diff / m)) + ' دقیقه پیش';
    if (diff < d) return fa(Math.floor(diff / h)) + ' ساعت پیش';
    if (diff < 30 * d) return fa(Math.floor(diff / d)) + ' روز پیش';
    return faDate(ts);
  }
  function jalaliNow() { var d = new Date(); return g2j(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function monthKey(ts) { var j = g2j(new Date(ts).getFullYear(), new Date(ts).getMonth() + 1, new Date(ts).getDate()); return j[0] + '-' + (j[1] < 10 ? '0' + j[1] : j[1]); }
  function monthLabel(key) {
    var p = key.split('-'), jm = parseInt(p[1], 10);
    return MONTHS[jm - 1] + ' ' + fa(p[0]);
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  /* ---------------- Constants ---------------- */
  var STATUS = {
    new:    { label: 'ثبت شده',           cls: 'b-new',    icon: 'inbox',  step: 0, color: '#3A5268' },
    quote:  { label: 'بررسی و قیمت‌گذاری', cls: 'b-quote',  icon: 'calc',   step: 1, color: '#B07A16' },
    design: { label: 'در حال طراحی',       cls: 'b-design', icon: 'draft',  step: 2, color: '#B23A2F' },
    client: { label: 'بازبینی با مشتری',  cls: 'b-client', icon: 'eye',    step: 2, color: '#5D4D86' },
    sample: { label: 'نمونه‌سازی',         cls: 'b-sample', icon: 'layers', step: 2, color: '#1F6F61' },
    done:   { label: 'تحویل شده',         cls: 'b-done',   icon: 'check',  step: 3, color: '#2C6B3C' },
    cancel: { label: 'لغو شده',            cls: 'b-cancel', icon: 'x',      step: 3, color: '#66717D' }
  };
  var STEPS = [
    { key: 'new',    label: 'ثبت سفارش' },
    { key: 'quote',  label: 'بررسی و پیشنهاد قیمت' },
    { key: 'design', label: 'طراحی و بازبینی' },
    { key: 'done',   label: 'تحویل' }
  ];
  var SOURCES = {
    site: 'فرم سایت', insta: 'اینستاگرام', telegram: 'تلگرام', whatsapp: 'واتساپ', phone: 'تماس تلفنی', referral: 'معرفی مشتری'
  };
  var PAY_METHODS = ['واریز بانکی', 'درگاه پرداخت', 'نقدی', 'چک', 'کارت به کارت'];
  var PRIORITY = { high: 'فوری', normal: 'عادی', low: 'کم‌اهمیت' };

  /* ---------------- Seed ---------------- */
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 9); }
  function D(daysAgo, hour) {
    var t = new Date();
    t.setDate(t.getDate() - daysAgo);
    if (hour !== undefined) t.setHours(hour, 0, 0, 0);
    return t.getTime();
  }

  function seed() {
    var jy = jalaliNow()[0];
    var seq = 0;
    var s = {
      version: 1,
      rev: 0,
      settings: {
        company: 'مکادیز',
        legalName: 'مکادیز — طراحی مهندسی مکانیک',
        phone1: '۰۹۰۳ ۰۶۶ ۴۹۹۳',
        phone2: '۰۹۲۱ ۸۷۶ ۱۸۸۹',
        email: 'info@mecades.ir',
        address: 'تهران',
        minOrder: 500000,
        defaultRate: 250000,
        invoicePrefix: 'MEC',
        owner: 'مدیر فنی',
        hoursPerDay: 8
      },
      tiers: [
        { id: 't1', label: 'تا ۲۰ ساعت',        max: 20,  rate: 250000, color: '#3A5268' },
        { id: 't2', label: 'بیشتر از ۲۰ تا ۵۰', max: 50,  rate: 230000, color: '#587794' },
        { id: 't3', label: 'بیشتر از ۵۰ ساعت',  max: 9999, rate: 210000, color: '#93A5B5' }
      ],
      services: [
        { id: 'svc-machine', name: 'طراحی ماشین‌آلات و تجهیزات صنعتی', short: 'ماشین‌آلات', icon: 'cpu',   color: '#3A5268', desc: 'مدل‌سازی سه‌بعدی کامل دستگاه، طراحی شاسی و سازه، چیدمان اجزا و نقشه‌های ساخت.', active: true, rate: 0 },
        { id: 'svc-part',    name: 'طراحی قطعات و مکانیزم‌ها',            short: 'قطعات و مکانیزم', icon: 'ruler', color: '#B23A2F', desc: 'مدل‌سازی قطعه و مجموعه، طراحی مکانیزم حرکت و اعمال نیرو، انتخاب اجزای استاندارد.', active: true, rate: 0 },
        { id: 'svc-consult', name: 'مشاوره و توسعه محصول',               short: 'مشاوره محصول', icon: 'target', color: '#587794', desc: 'امکان‌سنجی فنی، انتخاب مواد و روش ساخت، طراحی بدنه و رابط کاربری محصول.', active: true, rate: 0 },
        { id: 'svc-tech',    name: 'خدمات فنی مهندسی',                   short: 'فنی و مهندسی', icon: 'draft', color: '#2A3D4F', desc: 'نقشه‌کشی صنعتی، اصلاح نقشه‌های موجود، مستندات فنی و پشتیبانی تا مرحله ساخت.', active: true, rate: 0 },
        { id: 'svc-sample',  name: 'نمونه‌سازی',                         short: 'نمونه‌سازی', icon: 'layers', color: '#6F889D', desc: 'تبدیل مدل سه‌بعدی به نمونه واقعی، اصلاح طرح بر اساس نمونه و آماده‌سازی تولید.', active: true, rate: 0 }
      ],
      customers: [
        { id: 'c1', name: 'مهدی رضایی',   phone: '۰۹۱۲۳۴۵۶۷۸۹', company: 'صنایع پترو صنعت پارس', email: 'info@petropars.ir', address: 'تهران، شهرک صنعتی ابن‌سینا', note: 'پروژه‌های تکرارشونده خطوط انتقال سیال', created: D(240) },
        { id: 'c2', name: 'سارا موسوی',   phone: '۰۹۳۵۱۲۳۸۷۶۵', company: 'تجهیز‌سازی مهر',        email: 'sara@mehr-eq.com',   address: 'اصفهان، شهرک صنعتی اصفهان', note: '', created: D(200) },
        { id: 'c3', name: 'امیر کاظمی',   phone: '۰۹۱۹۸۸۷۷۶۶۵', company: 'آرمان قطعه‌سازی',      email: '',                   address: 'تهران، مهرآباد', note: 'تمرکز روی قطعات کم‌تیراژ', created: D(170) },
        { id: 'c4', name: 'نگار احمدی',   phone: '۰۹۱۲۱۱۱۲۲۳۳', company: 'بسته‌بندی مهر و موم',   email: 'negar@packmoh.ir',   address: 'تهران، خاوران', note: '', created: D(140) },
        { id: 'c5', name: 'رضا قاسمی',    phone: '۰۹۱۰۳۳۳۴۴۵۵', company: 'هیرو ماشین صنعت',     email: '',                   address: 'قزوین، شهرک صنعتی شهید نصیری', note: 'دستگاه پولیش کاشی', created: D(120) },
        { id: 'c6', name: 'حسین نادری',   phone: '۰۹۳۶۶۶۷۷۸۸۹', company: '',                    email: '',                   address: 'تهران', note: '', created: D(80) },
        { id: 'c7', name: 'مریم صادقی',   phone: '۰۹۱۲۴۴۴۵۵۶۶', company: 'پترو صنعت خلیج فارس', email: 'm.sadeghi@psf.ir',    address: 'بوشهر، منطقه ویژه صنایع پتروشیمی', note: 'نیازمند پشتیبانی onsite', created: D(55) },
        { id: 'c8', name: 'مهدی نجفی',    phone: '۰۹۳۹۹۹۱۲۳۴', company: 'صنایع بسته‌بندی پارس', email: '',                   address: 'تهران، اسلامشهر', note: '', created: D(30) }
      ],
      orders: [],
      payments: [],
      /* انواع فعالیت + نرخ ساعتی (مدیر در بخش کاربران مدیریت می‌کند) */
      activities: [
        { id: 'act-design',   name: 'طراحی صنعتی',      rate: 250000, needOrder: true,  icon: 'cpu',    color: '#3A5268', active: true, desc: 'مدل‌سازی و طراحی پروژه‌های صنعتی' },
        { id: 'act-3d',       name: 'مدل‌سازی سه‌بعدی',   rate: 230000, needOrder: true,  icon: 'box',    color: '#587794', active: true, desc: 'مدل سه‌بعدی قطعه، مجموعه و نقشه‌های ساخت' },
        { id: 'act-draft',    name: 'نقشه‌کشی فنی',      rate: 210000, needOrder: true,  icon: 'draft',  color: '#2A3D4F', active: true, desc: 'دتایل، نقشه‌های اجرایی و مستندات فنی' },
        { id: 'act-consult',  name: 'مشاوره و جلسه',     rate: 180000, needOrder: false, icon: 'users',  color: '#6F889D', active: true, desc: 'جلسه با مشتری، امکان‌سنجی و بازبینی طرح' },
        { id: 'act-marketing',name: 'بازاریابی',         rate: 150000, needOrder: false, icon: 'target', color: '#B23A2F', active: true, desc: 'جذب مشتری، پیگیری پیشنهادها و شبکه‌های اجتماعی' },
        { id: 'act-support',  name: 'پشتیبانی و اداری',  rate: 120000, needOrder: false, icon: 'inbox',  color: '#93A5B5', active: true, desc: 'پاسخ‌گویی، هماهنگی و امور اداری' }
      ],
      /* فعالیت‌های ثبت‌شدهٔ کاربران: {id,userId,userName,activityId,orderId,startedAt,endedAt,note} */
      sessions: [],
      projects: [
        { id: 'p1', num: 'PORTFOLIO 01', title: 'پرس دستی هیدرولیک', cat: 'ماشین‌آلات', tags: ['SolidWorks', 'جک هیدرولیک', '۳ تن'], desc: 'طراحی، مدل‌سازی سه‌بعدی و ساخت — جک هیدرولیک ۳ تن با برگشت فنری و ستون‌های فولادی.', published: true, cls: 't1', art: 'gear' },
        { id: 'p2', num: 'PORTFOLIO 02', title: 'نمایشگر توزین', cat: 'محصول', tags: ['HMI', 'بدنه', 'IP65'], desc: 'طراحی بدنه، رابط کاربری و جانکشن‌باکس — با آب‌بندی صنعتی مناسب محیط کارگاه.', published: true, cls: 't2', art: 'gauge' },
        { id: 'p3', num: 'PORTFOLIO 03', title: 'دستگاه پولیش کاشی', cat: 'ماشین‌آلات', tags: ['پمپ تزریق', 'HMI لمسی'], desc: 'طراحی و ساخت ماشین‌آلات صنعتی — پمپ تزریق ۸ کاناله و شاسی پروفیل آلومینیوم.', published: true, cls: 't3', art: 'machine' },
        { id: 'p4', num: 'PORTFOLIO 04', title: 'فیکسچر شاسی خودرو', cat: 'مکانیزم', tags: ['Assembly', 'جک'], desc: 'طراحی مجموعه و مکانیزم اعمال نیرو برای فیکسچر خط مونتاژ.', published: false, cls: 't4', art: 'clamp' },
        { id: 'p5', num: 'PORTFOLIO 05', title: 'سرند خشک‌کن صنعتی', cat: 'ماشین‌آلات', tags: ['مکانیزم', 'ارتعاش'], desc: 'طراحی سازه و سیستم ارتعاشی سرند برای خشک‌کن کشاورزی.', published: false, cls: 't5', art: 'screen' }
      ],
      activity: []
    };

    var raw = [
      { c: 'c1', s: 'svc-machine', t: 'طراحی شاسی و مجموعه جک هیدرولیک ۳ تن', h: 26, st: 'done',    d: 210, dl: 185, pay: 5980000, src: 'site',  pr: 'normal', desc: 'طراحی کامل شاسی، جانشینی ستون‌های فولادی و برگشت فنری جک. نقشه‌های ساخت به تفکیک ورق و ماشین‌کاری تحویل شد.' },
      { c: 'c2', s: 'svc-part',    t: 'مدل‌سازی مجموعه انتقال قدرت', h: 14, st: 'done',    d: 185, dl: 165, pay: 3500000, src: 'site',  pr: 'normal', desc: '' },
      { c: 'c3', s: 'svc-tech',    t: 'بازطراحی نقشه‌های خط تولید شماره ۲', h: 9,  st: 'done',    d: 160, dl: 145, pay: 2250000, src: 'insta', pr: 'normal', desc: '' },
      { c: 'c4', s: 'svc-consult', t: 'امکان‌سنجی و بهینه‌سازی بسته‌بندی', h: 6, st: 'done',    d: 145, dl: 135, pay: 1500000, src: 'site',  pr: 'low',    desc: '' },
      { c: 'c5', s: 'svc-machine', t: 'دستگاه پولیش کاشی — شاسی و پمپ تزریق ۸ کاناله', h: 48, st: 'done', d: 130, dl: 95, pay: 6900000, src: 'referral', pr: 'high', desc: '' },
      { c: 'c6', s: 'svc-sample',  t: 'نمونه‌سازی براکت فلزی سفارشی', h: 5, st: 'done', d: 118, dl: 110, pay: 1250000, src: 'whatsapp', pr: 'normal', desc: '' },
      { c: 'c7', s: 'svc-machine', t: 'طراحی دستگاه تزریق رزین اپوکسی', h: 32, st: 'done', d: 105, dl: 70, pay: 7360000, src: 'site',  pr: 'high', desc: 'دو مرحله بازبینی مدل با مشتری و اصلاح جانمایی تابلو برق.' },
      { c: 'c8', s: 'svc-consult', t: 'توسعه محصول دستگاه بسته‌بندی نیمه‌اتوماتیک', h: 4, st: 'new', d: 12, dl: 40, pay: 0, src: 'site', pr: 'normal', desc: 'مشتری درخواست برآورد اولیه برای توسعه محصول موجود دارد.' },
      { c: 'c1', s: 'svc-machine', t: 'طراحی خط پرکن و درب‌بند پتروشیمی', h: 54, st: 'quote', d: 9, dl: 32, pay: 0, pre: 1500000, src: 'phone', pr: 'high', desc: 'درخواست از طریق تماس تلفنی ثبت شد. مشتری فایل P&ID را ارسال کرده است.' },
      { c: 'c3', s: 'svc-part',    t: 'طراحی مکانیزم گیره هیدرولیکی قالب', h: 18, st: 'quote', d: 6, dl: 25, pay: 0, pre: 500000, src: 'insta', pr: 'normal', desc: '' },
      { c: 'c5', s: 'svc-tech',    t: 'تهیه مستندات فنی و نقشه‌های انفجاری', h: 11, st: 'design', d: 4, dl: 18, pay: 0, pre: 500000, src: 'site', pr: 'normal', desc: '' },
      { c: 'c2', s: 'svc-machine', t: 'طراحی میکسر صنعتی ۵۰ لیتری', h: 29, st: 'design', d: 3, dl: 21, pay: 0, pre: 1000000, src: 'site', pr: 'normal', desc: '' },
      { c: 'c8', s: 'svc-part',    t: 'طراحی زنجیر انتقال حرکت شفت‌دار', h: 8, st: 'design', d: 2, dl: 15, pay: 0, pre: 300000, src: 'whatsapp', pr: 'normal', desc: '' },
      { c: 'c7', s: 'svc-consult', t: 'بازطراحی بدنه نمایشگر توزین نسخه ۲', h: 16, st: 'client', d: 18, dl: 12, pay: 0, pre: 2000000, src: 'site', pr: 'high', desc: 'نسخه ۲ مدل برای بازبینی مشتری ارسال شد؛ منتظر نظر اصلاحی.' },
      { c: 'c6', s: 'svc-tech',    t: 'اصلاح نقشه‌های ورق‌کاری مجموعه سایپ', h: 7, st: 'client', d: 15, dl: 9, pay: 0, src: 'telegram', pr: 'normal', desc: '' },
      { c: 'c4', s: 'svc-sample',  t: 'ساخت نمونه فیکسچر مونتاژ', h: 12, st: 'sample', d: 26, dl: 5, pay: 0, pre: 800000, src: 'site', pr: 'normal', desc: '' },
      { c: 'c1', s: 'svc-tech',    t: 'پشتیبانی فنی پروژه نصب خط در بندرعباس', h: 6, st: 'cancel', d: 40, dl: 30, pay: 0, src: 'phone', pr: 'low', desc: 'به دلیل تکرار پروژه قبلی لغو شد.' }
    ];

    raw.forEach(function (o) {
      seq++;
      var created = D(o.d, 9 + (seq % 8));
      var svc = s.services.filter(function (x) { return x.id === o.s; })[0];
      var tier = tierFor(s.tiers, o.h);
      var quote = Math.max(o.h * tier.rate, s.settings.minOrder);
      var pre = o.pre || 0;
      var code = s.settings.invoicePrefix + '-' + jy + '-' + (seq < 10 ? '00' + seq : '0' + seq);
      s.orders.push({
        id: uid('o'),
        code: code,
        seq: seq,
        customerId: o.c,
        serviceId: o.s,
        title: o.t,
        desc: o.desc,
        hours: o.h,
        tierId: tier.id,
        rate: tier.rate,
        quote: quote,
        status: o.st,
        priority: o.pr,
        source: o.src,
        deadline: D(o.dl, 17),
        created: created,
        updated: created,
        paid: o.pay + pre,
        internal: '',
        files: o.s === 'svc-machine' && o.t.indexOf('پمپ') > -1 ? ['پمپ-تزریق-۸کاناله.SLDASM', 'چیدمان-کارگاه.pdf'] : []
      });
      var now = Date.now();
      if (o.pay > 0) {
        s.payments.push({
          id: uid('pay'),
          orderCode: code,
          customerId: o.c,
          amount: o.pay,
          date: Math.min(now - 86400000, created + 86400000 * 3),
          method: PAY_METHODS[seq % PAY_METHODS.length],
          note: 'پیش‌پرداخت قرارداد'
        });
      }
      if (pre > 0) {
        s.payments.push({
          id: uid('pay'),
          orderCode: code,
          customerId: o.c,
          amount: pre,
          date: Math.min(now - 3600000, created + 86400000 * 2),
          method: PAY_METHODS[(seq + 2) % PAY_METHODS.length],
          note: 'پیش‌پرداخت مرحله اول طراحی'
        });
      }
    });

    s.activity = s.orders.slice(-8).reverse().map(function (o) {
      return { id: uid('a'), ts: o.updated, type: o.status, text: 'سفارش «' + o.title + '» ثبت شد' };
    });

    return s;
  }

  function tierFor(tiers, hours) {
    for (var i = 0; i < tiers.length; i++) {
      if (hours <= tiers[i].max) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }

  /* ---------------- Persistence ---------------- */
  /* base64 سازگار با Unicode + چک‌سام کوتاه */
  function _b64e(str) {
    var bin = unescape(encodeURIComponent(str));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _b64d(b64) {
    var s2 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (s2.length % 4) s2 += '=';
    return decodeURIComponent(escape(atob(s2)));
  }
  function _b64bytes(u8) {
    var bin = '';
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _bytesB64(b64) {
    var s2 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (s2.length % 4) s2 += '=';
    var bin = atob(s2), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function _chk(str) {
    var h1 = 0x811c9dc5, h2 = 5381, i;
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 ^= c; h1 = (h1 + (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24)) >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
    return ('0000000' + ((h1 ^ h2) >>> 0).toString(16)).slice(-8);
  }

  var state = null;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.settings || !parsed.orders) return null;
      return parsed;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  /* هر ویرایش یک واحد شمارهٔ نسخه را بالا می‌برد */
  function touch() {
    state.rev = (state.rev || 0) + 1;
    save();
    try { document.dispatchEvent(new CustomEvent('mecades:edit')); } catch (e) {}
    return state.rev;
  }
  /* نسخهٔ نمایشی: v1.0.<شمارهٔ ویرایش> */
  function version() {
    /* پایه: major.minor  +  شمارهٔ ویرایش  →  مثال 1.0.7 */
    var base = VERSION.split('.').slice(0, 2).join('.');
    return base + '.' + (state.rev || 0);
  }
  function rev() { return state.rev || 0; }
  function reset() { state = seed(); state.rev = (state.rev || 0) + 1; save(); }
  /* نسبت‌دادن داده‌های نمونه به کاربران (برای اینکه گزارش کارکرد کاربران خالی نباشد) */
  function assignDemoActors() {
    var users = window.Auth && window.Auth.users();
    if (!users || !users.length) return;
    var changed = false;
    state.orders.forEach(function (o, i) {
      if (!o.createdBy) { var u = users[i % users.length]; o.createdBy = u.id; o.createdByName = u.name; changed = true; }
    });
    state.payments.forEach(function (p, i) {
      if (!p.createdBy) { var u2 = users[(i + 1) % users.length]; p.createdBy = u2.id; p.createdByName = u2.name; changed = true; }
    });
    state.activity.forEach(function (a, i) {
      if (!a.byId && a.by && a.by !== 'سیستم') { a.byId = users[i % users.length].id; changed = true; }
    });
    if (changed) save();
  }

  state = load() || seed();
  /* مهاجرت: داده‌های ذخیره‌شدهٔ نسخه‌های قبل ممکن است این بخش‌ها را نداشته باشند */
  if (!Array.isArray(state.activities) || !state.activities.length) state.activities = seed().activities;
  if (!Array.isArray(state.sessions)) state.sessions = [];
  if (!localStorage.getItem(KEY)) save();

  /* ---------------- Timesheet helpers ---------------- */
  var HOUR = 3600000;
  function actList(onlyActive) {
    return state.activities.filter(function (a) { return onlyActive ? a.active !== false : true; });
  }
  function activity(id) {
    return state.activities.filter(function (a) { return a.id === id; })[0] || null;
  }
  function activityName(id) { var a = activity(id); return a ? a.name : '—'; }
  function runningSession(userId) {
    return state.sessions.filter(function (s) { return s.userId === userId && !s.endedAt; })[0] || null;
  }
  function sessionsOf(userId) {
    return state.sessions.filter(function (s) { return !userId || s.userId === userId; })
      .slice().sort(function (a, b) { return b.startedAt - a.startedAt; });
  }
  function sessionSeconds(s, now) {
    var end = s.endedAt || (now || Date.now());
    return Math.max(0, Math.floor((end - s.startedAt) / 1000));
  }
  function sessionHours(s, now) { return sessionSeconds(s, now) / 3600; }
  function sessionWage(s, now) {
    var a = activity(s.activityId);
    return a ? sessionHours(s, now) * a.rate : 0;
  }
  function startOfToday() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  /* جمع ساعت و دستمزد در یک بازه (پیش‌فرض: از ابتدای امروز) */
  function wageReport(userId, from, to) {
    to = to || Date.now();
    from = from === undefined ? startOfToday() : from;
    var rows = state.sessions.filter(function (s) {
      return (!userId || s.userId === userId) && s.startedAt >= from && s.startedAt <= to;
    });
    var by = {}, totalSec = 0, totalAmt = 0;
    rows.forEach(function (s) {
      var a = activity(s.activityId) || { id: 'x', name: '—', rate: 0, color: '#93A5B5' };
      var sec = sessionSeconds(s, to), amt = (sec / 3600) * a.rate;
      totalSec += sec; totalAmt += amt;
      var k = a.id || 'x';
      if (!by[k]) by[k] = { id: a.id, name: a.name, color: a.color, rate: a.rate, sec: 0, amount: 0, count: 0 };
      by[k].sec += sec; by[k].amount += amt; by[k].count++;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    return { seconds: totalSec, hours: totalSec / 3600, amount: Math.round(totalAmt), rows: rows, byActivity: list };
  }
  function startSession(o) {
    if (!o || !o.userId || !o.activityId) return { ok: false, error: 'اطلاعات ناقص است' };
    if (runningSession(o.userId)) return { ok: false, error: 'برای این کاربر یک فعالیت باز است' };
    var act = activity(o.activityId);
    if (!act) return { ok: false, error: 'فعالیت یافت نشد' };
    if (act.needOrder && !o.orderId) return { ok: false, error: 'برای این فعالیت باید پروژه را انتخاب کنید' };
    var s = {
      id: uid('ts'), userId: o.userId, userName: o.userName || '',
      activityId: o.activityId, orderId: o.orderId || null,
      startedAt: Date.now(), endedAt: null, note: o.note || ''
    };
    state.sessions.push(s);
    touch();
    return { ok: true, session: s };
  }
  function endSession(userId) {
    var s = runningSession(userId);
    if (!s) return { ok: false, error: 'فعالیتی در حال اجرا نیست' };
    s.endedAt = Date.now();
    if (s.endedAt - s.startedAt < 60000) s.endedAt = s.startedAt + 60000; /* حداقل ۱ دقیقه */
    touch();
    return { ok: true, session: s };
  }
  function addActivity(d) {
    var a = { id: uid('act'), name: (d.name || '').trim(), rate: Math.max(0, Math.round(Number(d.rate) || 0)),
      needOrder: !!d.needOrder, icon: d.icon || 'star', color: d.color || '#3A5268', active: true, desc: d.desc || '' };
    if (!a.name) return { ok: false, error: 'نام فعالیت لازم است' };
    state.activities.push(a); touch();
    return { ok: true, activity: a };
  }
  function updateActivity(id, d) {
    var a = activity(id); if (!a) return { ok: false, error: 'فعالیت یافت نشد' };
    if (d.name !== undefined) a.name = String(d.name).trim() || a.name;
    if (d.rate !== undefined) a.rate = Math.max(0, Math.round(Number(d.rate) || 0));
    if (d.needOrder !== undefined) a.needOrder = !!d.needOrder;
    if (d.active !== undefined) a.active = !!d.active;
    if (d.desc !== undefined) a.desc = d.desc;
    if (d.icon !== undefined) a.icon = d.icon;
    touch();
    return { ok: true, activity: a };
  }
  function removeActivity(id) {
    var used = state.sessions.some(function (s) { return s.activityId === id; });
    if (used) {
      var a = activity(id); if (a) a.active = false;
      touch();
      return { ok: true, deactivated: true };
    }
    state.activities = state.activities.filter(function (a) { return a.id !== id; });
    touch();
    return { ok: true, removed: true };
  }
  /* چند فعالیت نمونه برای داده‌های نمایشی */
  function seedDemoTimesheets() {
    var users = (window.Auth && window.Auth.users()) || [];
    if (!users.length || state.sessions.length) return;
    var now = Date.now(), D2 = 86400000;
    var plans = [
      { u: 0, a: 'act-design', o: 'MEC-1405-013', days: 0, from: 3.2, to: 1.1 },
      { u: 1, a: 'act-marketing', o: null, days: 0, from: 4.4, to: 2.6 },
      { u: 2, a: 'act-3d', o: 'MEC-1405-012', days: 0, from: 4.6, to: 2.0 },
      { u: 2, a: 'act-draft', o: 'MEC-1405-011', days: 1, from: 6.5, to: 3.2 },
      { u: 0, a: 'act-consult', o: null, days: 1, from: 5.0, to: 3.5 },
      { u: 1, a: 'act-support', o: null, days: 2, from: 7.0, to: 4.0 },
      { u: 2, a: 'act-design', o: 'MEC-1405-010', days: 2, from: 6.0, to: 2.5 },
      { u: 0, a: 'act-marketing', o: null, days: 3, from: 5.5, to: 3.0 }
    ];
    plans.forEach(function (pl, i) {
      var u = users[pl.u % users.length];
      var start = now - pl.days * D2 - pl.from * HOUR;
      state.sessions.push({
        id: 'ts-demo-' + i, userId: u.id, userName: u.name,
        activityId: pl.a, orderId: pl.o || null,
        startedAt: Math.round(start), endedAt: Math.round(now - pl.days * D2 - pl.to * HOUR), note: ''
      });
    });
    /* یک فعالیت باز برای نمایش زنده (کاربر دوم) */
    var lu = users[1] || users[0];
    if (lu) {
      state.sessions.push({
        id: 'ts-live', userId: lu.id, userName: lu.name,
        activityId: 'act-marketing', orderId: null,
        startedAt: now - 42 * 60000, endedAt: null, note: ''
      });
    }
    save();
  }


  /* ---------------- Public API ---------------- */
  window.Store = {
    KEY: KEY,
    VERSION: VERSION,
    STATUS: STATUS, STEPS: STEPS, SOURCES: SOURCES, PRIORITY: PRIORITY, PAY_METHODS: PAY_METHODS,
    MONTHS: MONTHS, WEEKDAYS: WEEKDAYS,
    get state() { return state; },
    save: save, reset: reset, seed: seed, uid: uid, assignDemoActors: assignDemoActors,
    fa: fa, en: en, money: money, moneyShort: moneyShort, hoursFmt: hoursFmt,
    g2j: g2j, j2g: j2g, faDate: faDate, faDateShort: faDateShort, faDateTime: faDateTime,
    faDay: faDay, relTime: relTime, jalaliNow: jalaliNow, monthKey: monthKey, monthLabel: monthLabel,
    daysBetween: daysBetween, tierFor: tierFor,
    /* فعالیت و ساعت‌کار */
    activity: activity, activityName: activityName, activities: actList,
    runningSession: runningSession, sessionsOf: sessionsOf, sessionSeconds: sessionSeconds,
    sessionHours: sessionHours, sessionWage: sessionWage, wageReport: wageReport, startOfToday: startOfToday,
    startSession: startSession, endSession: endSession,
    addActivity: addActivity, updateActivity: updateActivity, removeActivity: removeActivity,
    seedDemoTimesheets: seedDemoTimesheets,
    /* selectors */
    customer: function (id) { return state.customers.filter(function (c) { return c.id === id; })[0] || null; },
    service: function (id) { return state.services.filter(function (s) { return s.id === id; })[0] || null; },
    order: function (id) { return state.orders.filter(function (o) { return o.id === id; })[0] || null; },
    customerName: function (id) { var c = this.customer(id); return c ? c.name : '—'; },
    serviceName: function (id) { var s = this.service(id); return s ? s.name : '—'; },
    orderPayments: function (code) {
      return state.payments.filter(function (p) { return p.orderCode === code; })
        .reduce(function (a, p) { return a + p.amount; }, 0);
    },
    customerOrders: function (cid) { return state.orders.filter(function (o) { return o.customerId === cid; }); },
    customerPaid: function (cid) {
      return state.payments.filter(function (p) { return p.customerId === cid; })
        .reduce(function (a, p) { return a + p.amount; }, 0);
    },
    customerTotal: function (cid) {
      return this.customerOrders(cid).reduce(function (a, o) { return a + o.quote; }, 0);
    },
    orderPaid: function (o) { return this.orderPayments(o.code); },
    orderDue: function (o) { return Math.max(0, o.quote - this.orderPaid(o)); },
    /* mutations */
    addOrder: function (o) {
      var seq = state.orders.length + 1;
      var jy = jalaliNow()[0];
      o.id = uid('o');
      o.seq = seq;
      o.code = state.settings.invoicePrefix + '-' + jy + '-' + (seq < 10 ? '00' + seq : '0' + seq);
      o.created = Date.now(); o.updated = Date.now();
      var actor = window.Auth && window.Auth.current();
      o.createdBy = actor ? actor.id : null;
      o.createdByName = actor ? actor.name : 'سیستم';
      state.orders.unshift(o);
      this.log('سفارش جدید ثبت شد: ' + o.title, 'new');
      touch(); return o;
    },
    updateOrder: function (id, patch) {
      var o = this.order(id); if (!o) return null;
      for (var k in patch) o[k] = patch[k];
      o.updated = Date.now();
      touch(); return o;
    },
    removeOrder: function (id) {
      state.orders = state.orders.filter(function (o) { return o.id !== id; });
      state.payments = state.payments.filter(function (p) { return p.orderCode !== (this.order(id) || {}).code; });
      touch();
    },
    addPayment: function (p) {
      p.id = uid('pay'); p.date = p.date || Date.now();
      var actor = window.Auth && window.Auth.current();
      p.createdBy = actor ? actor.id : null;
      p.createdByName = actor ? actor.name : 'سیستم';
      state.payments.unshift(p);
      var o = state.orders.filter(function (x) { return x.code === p.orderCode; })[0];
      if (o) { o.paid = this.orderPaid(o); o.updated = Date.now(); }
      this.log('پرداخت ' + money(p.amount) + ' برای سفارش ' + p.orderCode + ' ثبت شد', 'done');
      touch(); return p;
    },
    addCustomer: function (c) { c.id = uid('c'); c.created = Date.now(); state.customers.unshift(c); touch(); return c; },
    updateCustomer: function (id, patch) { var c = this.customer(id); if (!c) return; for (var k in patch) c[k] = patch[k]; touch(); },
    removeCustomer: function (id) { state.customers = state.customers.filter(function (c) { return c.id !== id; }); touch(); },
    log: function (text, type) {
      var u = window.Auth && window.Auth.current();
      state.activity.unshift({ id: uid('a'), ts: Date.now(), text: text, type: type || 'new',
        by: u ? u.name : 'سیستم', byId: u ? u.id : null });
      state.activity = state.activity.slice(0, 60);
      save();
    },
    touch: touch, version: version, rev: rev,
    exportJSON: function () { return JSON.stringify(state, null, 2); },
    importJSON: function (txt) {
      var parsed = JSON.parse(txt);
      if (!parsed.settings || !parsed.orders) throw new Error('ساختار فایل نامعتبر است');
      state = parsed; state.rev = (state.rev || 0) + 1; save();
    },

    /* ---------- کد پشتیبان متنی (برای ذخیره در Google Docs و بازیابی) ---------- */
    _pack: function () {
      var users = (window.Auth && window.Auth.users) ? window.Auth.users() : [];
      return JSON.stringify({ app: 'MECADES', kind: 'backup', v: 1, at: Date.now(), users: users, data: state });
    },
    backupCode: function () {
      var payload = _b64e(this._pack());
      return 'MCD1.' + payload + '.' + _chk(payload);
    },
    /* همان کد، ولی اگر مرورگر از فشرده‌سازی پشتیبانی کند حجمش چند برابر کمتر می‌شود */
    backupCodePacked: function (cb) {
      var str = this._pack();
      var plain = _b64e(str);
      var plainCode = 'MCD1.' + plain + '.' + _chk(plain);
      if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined' || !Blob.prototype.stream) {
        cb(plainCode, '');
        return;
      }
      try {
        var stream = new Blob([str], { type: 'text/plain' }).stream().pipeThrough(new CompressionStream('deflate-raw'));
        new Response(stream).arrayBuffer().then(function (buf) {
          var packed = _b64bytes(new Uint8Array(buf));
          if (packed.length < plain.length * 0.85) cb('MCD1z.' + packed + '.' + _chk(packed), 'z');
          else cb(plainCode, '');
        }).catch(function () { cb(plainCode, ''); });
      } catch (e) { cb(plainCode, ''); }
    },
    backupMeta: function () {
      var st = state;
      var users = (window.Auth && window.Auth.users) ? window.Auth.users() : [];
      var bytes = this._pack().length;
      return {
        bytes: bytes,
        orders: st.orders.length,
        customers: st.customers.length,
        payments: st.payments.length,
        users: users.length,
        activities: (st.activities || []).length,
        sessions: (st.sessions || []).length,
        version: st.rev || 0
      };
    },
    restoreCode: function (txt) {
      var clean = String(txt || '').replace(/[\s\u00a0\u2000-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/g, '');
      var m = clean.match(/MCD1(z?)\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})/i);
      if (!m) return Promise.reject(new Error('کد پشتیبان شناسایی نشد'));
      var payload = m[2];
      if (_chk(payload).toLowerCase() !== m[3].toLowerCase()) {
        return Promise.reject(new Error('کد ناقص یا تغییرکرده است'));
      }
      var readJson = function () {
        if (m[1]) {
          if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('مرورگر از کد فشرده پشتیبانی نمی‌کند'));
          try {
            var bs = new Blob([_bytesB64(payload)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Response(bs).text();
          } catch (e) { return Promise.reject(new Error('کد قابل بازکردن نیست')); }
        }
        try { return Promise.resolve(_b64d(payload)); } catch (e) { return Promise.reject(new Error('کد قابل خواندن نیست')); }
      };
      return readJson().then(function (json) {
        var parsed;
        try { parsed = JSON.parse(json); } catch (e) { throw new Error('محتوای کد معتبر نیست'); }
        var data = parsed, users = null;
        if (parsed && parsed.app === 'MECADES' && parsed.data) { data = parsed.data; users = parsed.users || null; }
        if (!data || !data.settings || !data.orders) throw new Error('ساختار دادهٔ بکاپ نامعتبر است');
        if (users && window.Auth && window.Auth.saveUsers) window.Auth.saveUsers(users);
        state = data; state.rev = (state.rev || 0) + 1; save();
        return { orders: state.orders.length, customers: state.customers.length,
          users: users ? users.length : 0, version: state.rev };
      });
    }
  };
})();
