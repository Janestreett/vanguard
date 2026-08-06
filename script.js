'use strict';

/* ==========================================================================
   VANGUARD WEB WORKS — MOTION ENGINE
   Semua animasi ditulis murni dengan JS (Web Animations API + rAF) supaya
   file ini langsung jalan tanpa perlu ubah HTML/CSS. Menghormati preferensi
   "prefers-reduced-motion" pengguna.
   ========================================================================== */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Bahasa animasi yang konsisten di seluruh halaman ---- */
  const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const EASE_OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const EASE_SMOOTH = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const DUR = { fast: 250, base: 550, slow: 900 };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* --------------------------------------------------------------------
     Helper animasi aman: otomatis "commit" hasil akhir lalu cancel efek
     WAAPI-nya begitu selesai, supaya elemen bebas diutak-atik lagi oleh
     handler hover (tilt, magnetic, dsb) tanpa rebutan properti transform.
     Kalau user minta reduced motion, langsung loncat ke state akhir.
  -------------------------------------------------------------------- */
  function safeAnimate(el, keyframes, options = {}) {
    if (!el) return null;
    if (reduceMotion) {
      const last = keyframes[keyframes.length - 1];
      Object.keys(last).forEach((k) => { el.style[k] = last[k]; });
      return null;
    }
    const opts = Object.assign({ duration: DUR.base, easing: EASE_OUT_EXPO, fill: 'forwards' }, options);
    const anim = el.animate(keyframes, opts);
    anim.finished
      .then(() => {
        try { anim.commitStyles(); } catch (err) { /* elemen sudah lepas dari DOM, aman diabaikan */ }
        anim.cancel();
      })
      .catch(() => {});
    return anim;
  }

  /* ---- Pecah teks berbaris (dipisah <br>) jadi "tirai" yang bisa naik ---- */
  function wrapLines(el) {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = '';
    const inners = [];
    parts.forEach((part) => {
      const mask = document.createElement('span');
      mask.style.display = 'block';
      mask.style.overflow = 'hidden';
      const inner = document.createElement('span');
      inner.style.display = 'inline-block';
      inner.style.willChange = 'transform, opacity';
      inner.style.transform = 'translateY(110%)';
      inner.style.opacity = '0';
      inner.innerHTML = part.trim();
      mask.appendChild(inner);
      el.appendChild(mask);
      inners.push(inner);
    });
    return inners;
  }

  function revealLines(inners, { baseDelay = 0, stagger = 110 } = {}) {
    inners.forEach((inner, i) => {
      safeAnimate(inner, [
        { transform: 'translateY(110%)', opacity: 0 },
        { transform: 'translateY(0%)', opacity: 1 },
      ], { duration: DUR.slow, delay: baseDelay + i * stagger, easing: EASE_OUT_EXPO });
    });
  }

  /* ---- Pecah teks jadi per-huruf (untuk judul besar footer) ---- */
  function wrapChars(el) {
    const text = el.textContent;
    el.textContent = '';
    const spans = [];
    Array.from(text).forEach((ch) => {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(span);
      spans.push(span);
    });
    return spans;
  }

  /* ==========================================================================
     GAYA RUNTIME (untuk elemen baru yang dibuat lewat JS: menu, cursor glow,
     ripple, tooltip, ring chat). Sengaja disuntik dari sini biar file CSS
     kamu tidak perlu disentuh.
     ========================================================================== */
  function injectRuntimeStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .vw-menu-overlay{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#080808;z-index:200;}
      .vw-menu-links{display:flex;flex-direction:column;align-items:center;gap:18px;}
      .vw-menu-link{font-family:'Anton',impact,sans-serif;font-size:clamp(1.8rem,6vw,3.2rem);letter-spacing:1px;color:#fff;text-transform:uppercase;transition:color .25s ease, transform .25s ease;cursor:pointer;}
      .vw-menu-link:hover{color:#E4F059;transform:translateX(6px);}
      .vw-menu-close{position:absolute;top:24px;right:32px;background:transparent;border:1px solid #fff;color:#fff;width:44px;height:44px;border-radius:50%;font-size:1.4rem;cursor:pointer;line-height:1;}
      .vw-menu-close:hover{background:#E4F059;border-color:#E4F059;color:#080808;}
      .vw-cursor-glow{position:fixed;top:0;left:0;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle, rgba(228,240,89,.5), transparent 70%);filter:blur(20px);mix-blend-mode:screen;pointer-events:none;opacity:0;transition:opacity .35s ease;z-index:5;}
      .vw-ripple{position:absolute;border-radius:50%;background:currentColor;pointer-events:none;}
      .vw-tooltip{position:absolute;bottom:100%;left:50%;transform:translate(-50%,0);margin-bottom:10px;background:#080808;color:#fff;padding:6px 14px;border-radius:8px;font-size:.8rem;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .25s ease, transform .25s ease;}
      .vw-chat-ring{position:absolute;inset:0;border-radius:16px;border:2px solid #E4F059;pointer-events:none;}
      @media (prefers-reduced-motion: reduce){
        *{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
      }
    `;
    document.head.appendChild(style);
  }

  /* ==========================================================================
     1) INTRO SAAT HALAMAN DIMUAT — nav turun, badge "pop", judul naik per
     baris seperti tirai dibuka, tombol CTA menyusul.
     ========================================================================== */
  function initPreloaderIntro() {
    const nav = document.querySelector('.nav');
    const badge = document.querySelector('.hero .badge-spin');
    const title = document.querySelector('.hero-title');
    const cta = document.querySelector('.hero .btn-pill');

    if (nav) { nav.style.opacity = '0'; nav.style.transform = 'translateY(-16px)'; }
    // Badge pakai properti CSS "scale" (bukan transform) supaya tidak
    // rebutan dengan animasi @keyframes spin yang jalan terus-menerus.
    if (badge) { badge.style.opacity = '0'; badge.style.scale = '0.4'; }
    if (cta) { cta.style.opacity = '0'; cta.style.transform = 'translateY(24px)'; }

    const inners = title ? wrapLines(title) : [];

    requestAnimationFrame(() => {
      if (nav) {
        safeAnimate(nav, [
          { opacity: 0, transform: 'translateY(-16px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: DUR.base, easing: EASE_OUT_EXPO });
      }
      if (badge) {
        safeAnimate(badge, [
          { opacity: 0, scale: 0.4 },
          { opacity: 1, scale: 1 },
        ], { duration: DUR.slow, easing: EASE_OUT_BACK, delay: 120 });
      }
      revealLines(inners, { baseDelay: 260, stagger: 130 });
      if (cta) {
        safeAnimate(cta, [
          { opacity: 0, transform: 'translateY(24px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: DUR.base, easing: EASE_OUT_EXPO, delay: 260 + inners.length * 130 + 150 });
      }
    });
  }

  /* ==========================================================================
     2) NAV YANG "MENGERUT" SAAT DISCROLL
     ========================================================================== */
  function initStickyNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let ticking = false;
    let scrolled = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const isScrolled = window.scrollY > 40;
        if (isScrolled !== scrolled) {
          scrolled = isScrolled;
          nav.style.transition = `padding ${DUR.fast}ms ${EASE_SMOOTH}`;
          nav.style.padding = isScrolled ? '12px 40px' : '20px 40px';
          const rMark = nav.querySelector('.r-mark');
          if (rMark) {
            rMark.style.transition = `transform ${DUR.fast}ms ${EASE_SMOOTH}`;
            rMark.style.transform = isScrolled ? 'scale(0.85)' : 'scale(1)';
          }
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ==========================================================================
     3) MENU MOBILE — sebelumnya script mencari #navtoggle/#navlinks yang
     tidak ada di HTML (mati total). Sekarang dibuatkan overlay penuh layar
     yang dianimasikan, dipicu oleh tombol .menu-btn yang memang ada.
     ========================================================================== */
  function initMobileMenu() {
    const btn = document.querySelector('.menu-btn');
    if (!btn) return;

    const overlay = document.createElement('div');
    overlay.className = 'vw-menu-overlay';
    overlay.innerHTML = `
      <button class="vw-menu-close" aria-label="Tutup menu">&times;</button>
      <nav class="vw-menu-links">
        <a href="paket layanan.html" class="vw-menu-link">PAKET LAYANAN</a>
        <a href="tentang kami.html" class="vw-menu-link">TENTANG KAMI</a>
        <a href="tim.html" class="vw-menu-link">TIM</a>
        <a href="kontak.html" class="vw-menu-link">KONTAK</a>
      </nav>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.vw-menu-close');
    const links = overlay.querySelectorAll('.vw-menu-link');
    let isOpen = false;

    function openMenu() {
      isOpen = true;
      overlay.style.display = 'flex';
      overlay.style.pointerEvents = 'auto';
      document.body.style.overflow = 'hidden';
      btn.textContent = 'TUTUP ×';
      safeAnimate(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.fast, easing: EASE_SMOOTH });
      links.forEach((link, i) => {
        link.style.opacity = '0';
        link.style.transform = 'translateY(24px)';
        safeAnimate(link, [
          { opacity: 0, transform: 'translateY(24px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: DUR.base, delay: 80 + i * 70, easing: EASE_OUT_EXPO });
      });
    }

    function closeMenu() {
      isOpen = false;
      btn.textContent = 'MENU +';
      document.body.style.overflow = '';
      overlay.style.pointerEvents = 'none';
      const anim = safeAnimate(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.fast, easing: EASE_SMOOTH });
      const done = () => { overlay.style.display = 'none'; };
      if (anim) anim.finished.then(done).catch(done); else done();
    }

    btn.addEventListener('click', () => (isOpen ? closeMenu() : openMenu()));
    closeBtn.addEventListener('click', closeMenu);
    links.forEach((link) => link.addEventListener('click', closeMenu));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) closeMenu(); });
  }

  /* ==========================================================================
     4) RIPPLE DI SETIAP KLIK TOMBOL — feedback instan untuk setiap gerakan
     ========================================================================== */
  function initClickRipple() {
    if (reduceMotion) return;
    const selector = '.btn-pill, .menu-btn, .chat-btn, .vw-menu-close';
    document.addEventListener('click', (e) => {
      const target = e.target.closest(selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
      target.style.overflow = target.style.overflow || 'hidden';

      const ripple = document.createElement('span');
      ripple.className = 'vw-ripple';
      const size = Math.max(rect.width, rect.height) * 1.4;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);

      const anim = safeAnimate(ripple, [
        { transform: 'scale(0)', opacity: 0.55 },
        { transform: 'scale(1)', opacity: 0 },
      ], { duration: 550, easing: 'ease-out' });
      const cleanup = () => ripple.remove();
      if (anim) anim.finished.then(cleanup).catch(cleanup); else cleanup();
    });
  }

  /* ==========================================================================
     5) BADGE LOGO — jeda berputar & bersinar saat disentuh cursor
     ========================================================================== */
  function initBadgeHover() {
    document.querySelectorAll('.badge-spin').forEach((badge) => {
      badge.style.transition = `filter ${DUR.fast}ms ease`;
      badge.addEventListener('mouseenter', () => {
        badge.style.animationPlayState = 'paused';
        badge.style.filter = 'drop-shadow(0 0 14px rgba(228,240,89,.9))';
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.animationPlayState = 'running';
        badge.style.filter = 'none';
      });
    });
  }

  /* ==========================================================================
     6) REVEAL SAAT DI-SCROLL — teks naik, kartu membesar, judul jadi tirai,
     huruf demi huruf untuk judul footer, semua dengan stagger halus.
     ========================================================================== */
  function prepareUp(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(36px)';
    el.style.willChange = 'transform, opacity';
  }
  function prepareScale(el) {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.88)';
    el.style.willChange = 'transform, opacity';
  }

  function revealElement(el) {
    const delay = (el._vwIndex || 0) * 90;
    if (el.dataset.vwLines) {
      revealLines(el._vwInners, { baseDelay: 0, stagger: 100 });
      return;
    }
    if (el._vwChars) {
      el._vwChars.forEach((ch, i) => {
        safeAnimate(ch, [
          { opacity: 0, transform: 'translateY(60%) rotate(6deg)' },
          { opacity: 1, transform: 'translateY(0) rotate(0deg)' },
        ], { duration: DUR.base, delay: i * 45, easing: EASE_OUT_BACK });
      });
      return;
    }
    const isScale = (el.style.transform || '').includes('scale');
    const from = isScale ? 'scale(0.88)' : 'translateY(36px)';
    const to = isScale ? 'scale(1)' : 'translateY(0)';
    safeAnimate(el, [
      { opacity: 0, transform: from },
      { opacity: 1, transform: to },
    ], { duration: DUR.base, delay, easing: EASE_OUT_EXPO });
  }

  function initScrollReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

    const upGroups = [
      '.about .body-text', '.about .btn-pill', '.trainings .eyebrow-center',
      '.team-text .body-text', '.team-text .btn-pill', '.footer-grid > div',
    ];
    upGroups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        el._vwIndex = i;
        prepareUp(el);
        io.observe(el);
      });
    });

    document.querySelectorAll('.typographic-cluster .word').forEach((el, i) => {
      el._vwIndex = i;
      prepareUp(el);
      io.observe(el);
    });

    const scaleGroups = ['.image-grid .img-card', '.team-grid .team-member', '.testi-card', '.about-image .octagon-mask'];
    scaleGroups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        el._vwIndex = i;
        prepareScale(el);
        io.observe(el);
      });
    });

    document.querySelectorAll('.about .section-title, .team .section-title, .testimonials .section-title').forEach((el) => {
      el._vwInners = wrapLines(el);
      el.dataset.vwLines = '1';
      io.observe(el);
    });

    document.querySelectorAll('.footer-title').forEach((el) => {
      el._vwChars = wrapChars(el);
      io.observe(el);
    });
  }

  /* ==========================================================================
     7) HITUNG NAIK ANGKA "200" DI BADGE HARGA SAAT MASUK VIEWPORT
     ========================================================================== */
  function initCounters() {
    const span = document.querySelector('.date-badge span');
    if (!span) return;
    const target = parseInt(span.textContent, 10) || 0;
    if (reduceMotion) { span.textContent = String(target); return; }

    let started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const start = performance.now();
        const duration = 1100;
        requestAnimationFrame(function frame(now) {
          const t = clamp((now - start) / duration, 0, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          span.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(frame);
          else span.textContent = String(target);
        });
        io.unobserve(span);
      });
    }, { threshold: 0.6 });
    io.observe(span);
  }

  /* ==========================================================================
     8) TOMBOL "MAGNETIC" — mengikuti cursor secara halus lalu kembali pegas
     ========================================================================== */
  function initMagneticButtons() {
    document.querySelectorAll('.btn-pill, .chat-btn').forEach((el) => {
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transition = 'transform 0.15s ease-out';
          el.style.transform = `translate(${x * 0.28}px, ${y * 0.28}px)`;
          const icon = el.querySelector('.btn-icon');
          if (icon) icon.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) rotate(${clamp(x * 0.6, -25, 25)}deg)`;
        });
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = `transform ${DUR.base}ms ${EASE_OUT_BACK}`;
        el.style.transform = 'translate(0,0)';
        const icon = el.querySelector('.btn-icon');
        if (icon) {
          icon.style.transition = `transform ${DUR.base}ms ${EASE_OUT_BACK}`;
          icon.style.transform = 'translate(0,0) rotate(0deg)';
        }
      });
    });
  }

  /* ==========================================================================
     9) TILT 3D UNTUK KARTU & GAMBAR — mengikuti posisi cursor
     ========================================================================== */
  function initTiltCards() {
    document.querySelectorAll('.testi-card, .img-card, .team-member, .octagon-mask').forEach((el) => {
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transition = 'transform 0.12s ease-out';
          el.style.transform = `perspective(800px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) scale(1.03)`;
          const img = el.querySelector('img');
          if (img) {
            img.style.transition = 'transform .12s ease-out';
            img.style.transform = `scale(1.08) translate(${px * -8}px, ${py * -8}px)`;
          }
        });
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = `transform ${DUR.base}ms ${EASE_OUT_EXPO}`;
        el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
        const img = el.querySelector('img');
        if (img) {
          img.style.transition = `transform ${DUR.base}ms ${EASE_OUT_EXPO}`;
          img.style.transform = 'scale(1) translate(0,0)';
        }
      });
    });

    // Foto tim: hitam-putih ke berwarna saat disentuh
    document.querySelectorAll('.team-member img').forEach((img) => {
      img.style.transition = `filter ${DUR.base}ms ${EASE_SMOOTH}`;
      img.addEventListener('mouseenter', () => { img.style.filter = 'grayscale(0%)'; });
      img.addEventListener('mouseleave', () => { img.style.filter = 'grayscale(100%)'; });
    });
  }

  /* ==========================================================================
     10) CAHAYA MENGIKUTI CURSOR DI HERO
     ========================================================================== */
  function initCursorGlow() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const glow = document.createElement('div');
    glow.className = 'vw-cursor-glow';
    document.body.appendChild(glow);

    let tx = 0, ty = 0, cx = 0, cy = 0;
    hero.addEventListener('mouseenter', () => { glow.style.opacity = '1'; });
    hero.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
    hero.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });

    (function loop() {
      cx = lerp(cx, tx, 0.15);
      cy = lerp(cy, ty, 0.15);
      glow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ==========================================================================
     11) PARALAX RINGAN DI HERO SAAT DISCROLL
     ========================================================================== */
  function initHeroParallax() {
    const hero = document.querySelector('.hero');
    const title = document.querySelector('.hero-title');
    if (!hero || !title) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const total = rect.height + window.innerHeight;
        const progress = clamp(1 - rect.bottom / total, 0, 1);
        title.style.transform = `translateY(${progress * 70}px)`;
        title.style.opacity = String(clamp(1 - progress * 1.4, 0, 1));
        hero.style.backgroundPosition = `center ${50 + progress * 12}%`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ==========================================================================
     12) KATA-KATA PAKET LAYANAN — fokus ke satu kata saat dihover
     ========================================================================== */
  function initClusterHover() {
    const cluster = document.querySelector('.typographic-cluster');
    if (!cluster) return;
    const words = cluster.querySelectorAll('.word');
    words.forEach((word) => {
      word.style.transition = `transform ${DUR.fast}ms ${EASE_OUT_BACK}, color ${DUR.fast}ms ease, opacity ${DUR.fast}ms ease`;
      word.addEventListener('mouseenter', () => {
        words.forEach((w) => { if (w !== word) w.style.opacity = '0.35'; });
        word.style.transform = 'scale(1.08) translateY(-4px)';
        word.style.color = '#080808';
      });
      word.addEventListener('mouseleave', () => {
        words.forEach((w) => { w.style.opacity = '1'; });
        word.style.transform = 'scale(1) translateY(0)';
        word.style.color = '';
      });
    });
  }

  /* ==========================================================================
     13) TOMBOL CHAT — tooltip, klik "kenyal", dan pulsa ring berkala
     ========================================================================== */
  function initChatButtonIdle() {
    const chat = document.querySelector('.chat-btn');
    if (!chat) return;

    const tip = document.createElement('div');
    tip.className = 'vw-tooltip';
    tip.textContent = 'Chat dengan kami';
    chat.appendChild(tip);
    chat.addEventListener('mouseenter', () => {
      tip.style.opacity = '1';
      tip.style.transform = 'translate(-50%, -12px)';
    });
    chat.addEventListener('mouseleave', () => {
      tip.style.opacity = '0';
      tip.style.transform = 'translate(-50%, 0px)';
    });

    chat.addEventListener('click', () => {
      safeAnimate(chat, [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(0.85) rotate(-8deg)' },
        { transform: 'scale(1.08) rotate(6deg)' },
        { transform: 'scale(1) rotate(0deg)' },
      ], { duration: 480, easing: EASE_OUT_BACK });
    });

    function pulse() {
      const ring = document.createElement('span');
      ring.className = 'vw-chat-ring';
      chat.appendChild(ring);
      const anim = safeAnimate(ring, [
        { transform: 'scale(1)', opacity: 0.8 },
        { transform: 'scale(1.6)', opacity: 0 },
      ], { duration: 1400, easing: 'ease-out' });
      const cleanup = () => ring.remove();
      if (anim) anim.finished.then(cleanup).catch(cleanup); else cleanup();
    }
    pulse();
    setInterval(pulse, 4000);
  }

  /* ==========================================================================
     JALANKAN SEMUA
     ========================================================================== */
  function init() {
    injectRuntimeStyles();
    initPreloaderIntro();
    initStickyNav();
    initMobileMenu();
    initClickRipple();
    initBadgeHover();
    initScrollReveal();
    initCounters();

    if (!reduceMotion) {
      initMagneticButtons();
      initTiltCards();
      initCursorGlow();
      initHeroParallax();
      initClusterHover();
      initChatButtonIdle();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
