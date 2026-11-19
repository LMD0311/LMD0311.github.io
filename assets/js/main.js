(function () {
  'use strict';

  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktopQuery = window.matchMedia('(min-width: 961px)');
  var systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /* ------------------------------------------------------------
   * 1. Theme Toggle
   * ------------------------------------------------------------ */
  (function initThemeToggle() {
    var root = document.documentElement;
    var button = document.getElementById('theme-toggle');
    if (!button) return;

    var fadeTimer;
    var colors = [
      'primary', 'primary-hover', 'primary-soft', 'on-primary', 'primary-container',
      'on-primary-container', 'background', 'surface', 'surface-container', 'text',
      'text-secondary', 'text-muted', 'border', 'button-text', 'button-background',
      'button-hover'
    ];

    var registered = !!(window.CSS && CSS.registerProperty);
    if (registered) {
      var initial = getComputedStyle(root);
      colors.forEach(function (name) {
        try {
          CSS.registerProperty({
            name: '--theme-' + name,
            syntax: '<color>',
            inherits: true,
            initialValue: initial.getPropertyValue('--theme-' + name).trim()
          });
        } catch (e) {
          registered = false;
        }
      });
      if (registered) {
        root.style.setProperty(
          '--theme-color-properties',
          colors.map(function (name) { return '--theme-' + name; }).join(', ')
        );
      }
    }

    function isDark() {
      var theme = root.dataset.theme;
      return theme ? theme === 'dark' : systemThemeQuery.matches;
    }

    function updateButton() {
      var dark = isDark();
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      var sr = button.querySelector('.sr-only');
      if (sr) sr.textContent = dark ? 'Light mode' : 'Dark mode';
    }

    function endFade() {
      root.classList.remove('theme-fade', 'theme-fade-fallback');
      root.style.colorScheme = isDark() ? 'dark' : 'light';
    }

    updateButton();
    endFade();

    systemThemeQuery.addEventListener('change', function () {
      updateButton();
      endFade();
    });

    reducedMotionQuery.addEventListener('change', function () {
      if (reducedMotionQuery.matches) {
        clearTimeout(fadeTimer);
        endFade();
      }
    });

    button.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      clearTimeout(fadeTimer);
      if (!reducedMotionQuery.matches) {
        root.classList.add(registered ? 'theme-fade' : 'theme-fade-fallback');
        // Commit transition properties before updating theme tokens.
        getComputedStyle(root).getPropertyValue('--theme-background');
      }
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* Ignore storage errors in restricted environments. */
      }
      updateButton();
      if (reducedMotionQuery.matches) {
        endFade();
      } else {
        fadeTimer = window.setTimeout(endFade, 340);
      }
    });
  }());

  /* ------------------------------------------------------------
   * 2. Native Back-to-Top FAB
   * ------------------------------------------------------------ */
  (function initBackToTop() {
    var btt = document.getElementById('back-to-top');
    if (!btt) return;

    var ticking = false;
    function syncVisibility() {
      ticking = false;
      var hidden = window.scrollY < 240;
      btt.classList.toggle('hidden', hidden);
      btt.tabIndex = hidden ? -1 : 0;
      document.body.classList.toggle('fab-collapsed', hidden);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(syncVisibility);
    }

    btt.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: reducedMotionQuery.matches ? 'auto' : 'smooth'
      });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    syncVisibility();
  }());

  /* ------------------------------------------------------------
   * 3. WeChat Modal (Shared-Element WAAPI Motion)
   * ------------------------------------------------------------ */
  (function initWeChatModal() {
    var trigger = document.querySelector('.wechat-link');
    var modal = document.getElementById('wechat-modal');
    if (!trigger || !modal) return;

    var closeBtn = modal.querySelector('.md-modal-close');
    var card = modal.querySelector('.md-modal-card');
    var scrim = modal.querySelector('.md-modal-scrim');
    var animation = null;
    var state = 'closed';
    var lastFocus;
    var oldOverflow;
    var background = [];
    var dx = 0, dy = 0, sx = 0.1, sy = 0.1;

    function geometry() {
      var icon = trigger.getBoundingClientRect();
      var bounds = card.getBoundingClientRect();
      dx = icon.left + icon.width / 2 - (bounds.left + bounds.width / 2);
      dy = icon.top + icon.height / 2 - (bounds.top + bounds.height / 2);
      sx = icon.width / bounds.width;
      sy = icon.height / bounds.height;
    }

    function shape(x, y, w, h) {
      return 'translate(' + x + 'px,' + y + 'px) scale(' + w + ',' + h + ')';
    }

    function snapshot() {
      var style = getComputedStyle(card);
      return { transform: style.transform, opacity: style.opacity, borderRadius: style.borderRadius };
    }

    function play(frames, duration, easing, done) {
      if (animation) animation.cancel();
      animation = null;
      if (reducedMotionQuery.matches || !card.animate) {
        done();
        return;
      }
      animation = card.animate(frames, { duration: duration, easing: easing, fill: 'both' });
      var current = animation;
      current.onfinish = function () {
        if (animation !== current) return;
        done();
        current.cancel();
        animation = null;
      };
    }

    function finishClose() {
      modal.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      modal.classList.remove('md-open', 'md-closing', 'md-anchor-left');
      modal.style.removeProperty('--md-modal-left');
      modal.style.removeProperty('--md-modal-top');
      scrim.style.removeProperty('transition-duration');
      document.documentElement.style.overflow = oldOverflow;
      background.forEach(function (item) { item.element.inert = item.inert; });
      background = [];
      state = 'closed';
      if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    }

    function open() {
      if (state !== 'closed') return;
      lastFocus = document.activeElement;
      oldOverflow = document.documentElement.style.overflow;
      trigger.setAttribute('aria-expanded', 'true');
      modal.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      getComputedStyle(card).opacity;

      if (desktopQuery.matches) {
        var iconBounds = trigger.getBoundingClientRect();
        var cardBounds = card.getBoundingClientRect();
        var left = Math.min(Math.max(24, iconBounds.right + 16), window.innerWidth - cardBounds.width - 24);
        var top = Math.min(Math.max(24, iconBounds.top + (iconBounds.height - cardBounds.height) / 2), window.innerHeight - cardBounds.height - 24);
        modal.style.setProperty('--md-modal-left', left + 'px');
        modal.style.setProperty('--md-modal-top', top + 'px');
        modal.classList.add('md-anchor-left');
      }

      modal.classList.add('md-open');
      geometry();
      background = Array.prototype.map.call(
        document.querySelectorAll('.wrapper, .theme-toggle, #back-to-top, .skip-link'),
        function (element) {
          var item = { element: element, inert: element.inert };
          element.inert = true;
          return item;
        }
      );

      state = 'opening';
      closeBtn.focus({ preventScroll: true });
      play([
        { transform: shape(dx, dy, sx, sy), opacity: 0, borderRadius: '50%' },
        { transform: shape(dx * 0.08, dy * 0.1, 0.88, 1.025), opacity: 1, borderRadius: '34px', offset: 0.62 },
        { transform: shape(0, 0, 1, 1), opacity: 1, borderRadius: '28px' }
      ], 560, 'cubic-bezier(.2, 0, 0, 1)', function () { state = 'open'; });
    }

    function reverseOpening() {
      var current = animation;
      if (!current) return false;
      var currentTime = Number(current.currentTime) || 0;
      if (currentTime <= 1) {
        current.cancel();
        animation = null;
        finishClose();
        return true;
      }
      scrim.style.setProperty('transition-duration', Math.max(80, Math.round(currentTime)) + 'ms');
      state = 'closing';
      modal.classList.remove('md-open');
      modal.classList.add('md-closing');
      current.onfinish = function () {
        if (animation !== current) return;
        finishClose();
        current.cancel();
        animation = null;
      };
      try {
        current.reverse();
        return true;
      } catch (e) {
        current.cancel();
        animation = null;
        return false;
      }
    }

    function close() {
      if (state === 'closed' || state === 'closing') return;
      if (state === 'opening' && reverseOpening()) return;
      var start = snapshot();
      if (state === 'open') geometry();
      state = 'closing';
      scrim.style.setProperty('transition-duration', '380ms');
      modal.classList.remove('md-open');
      modal.classList.add('md-closing');
      play([
        start,
        { transform: shape(dx * 0.16, dy * 0.12, 0.7, 0.94), opacity: 0.9, borderRadius: '34px', offset: 0.38 },
        { transform: shape(dx, dy, sx, sy), opacity: 0, borderRadius: '50%' }
      ], 380, 'cubic-bezier(.3, 0, .8, .15)', finishClose);
    }

    trigger.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open();
    });

    modal.addEventListener('pointerdown', function (e) {
      if (e.target === scrim) close();
    });

    modal.addEventListener('click', function (e) {
      if (e.target instanceof Element && e.target.closest('[data-md-modal-close]')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (state === 'closed') return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus({ preventScroll: true }); }
    });

    reducedMotionQuery.addEventListener('change', function () {
      if (!reducedMotionQuery.matches || !animation) return;
      animation.cancel();
      animation = null;
      if (state === 'closing') finishClose();
      else state = 'open';
    });
  }());

  /* ------------------------------------------------------------
   * 4. GitHub Star Counts (Deduplicated & Session-Cached)
   * ------------------------------------------------------------ */
  (function initGitHubStars() {
    var CACHE_KEY = 'gh_stars_v1';
    var CACHE_TTL = 15 * 60 * 1000;
    var nodes = document.querySelectorAll('.star-count[data-repo]');
    if (!nodes.length) return;

    var repoGroups = new Map();
    Array.prototype.forEach.call(nodes, function (el) {
      var repo = el.getAttribute('data-repo');
      if (!repo) return;
      if (!repoGroups.has(repo)) repoGroups.set(repo, []);
      repoGroups.get(repo).push(el);
    });

    function fmt(n) {
      return Number(n).toLocaleString('en-US');
    }

    function applyCount(repo, count) {
      var targets = repoGroups.get(repo);
      if (!targets) return;
      var formatted = fmt(count || 0);
      targets.forEach(function (el) {
        el.textContent = formatted;
      });
    }

    var cache = {};
    try {
      cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') || {};
    } catch (e) {
      cache = {};
    }

    var now = Date.now();
    repoGroups.forEach(function (_, repo) {
      var entry = cache[repo];
      if (entry && typeof entry.count === 'number' && (now - entry.ts) < CACHE_TTL) {
        applyCount(repo, entry.count);
        return;
      }
      fetch('https://api.github.com/repos/' + repo)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
        .then(function (d) {
          var count = d.stargazers_count || 0;
          applyCount(repo, count);
          cache[repo] = { count: count, ts: Date.now() };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
          } catch (e) {
            /* Ignore storage quota errors. */
          }
        })
        .catch(function () {
          /* Keep embedded star count as graceful fallback. */
        });
    });
  }());

  /* ------------------------------------------------------------
   * 5. Teaser Image Reveal & Flicker-Free Scroll Reveal
   * ------------------------------------------------------------ */
  (function initRevealAndMedia() {
    var teaserImages = document.querySelectorAll('.material-home .pub-row img.teaser');
    Array.prototype.forEach.call(teaserImages, function (img) {
      var reveal = function () {
        window.requestAnimationFrame(function () {
          img.classList.add('md-image-ready');
        });
      };
      if (img.complete) reveal();
      else {
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    });

    if (reducedMotionQuery.matches || !('IntersectionObserver' in window)) return;

    var foldLimit = window.innerHeight * 0.92;
    var candidates = document.querySelectorAll('.pub-row, .pub-mini-list, .pub-group-title, .news-frame, .info-list');
    var belowFold = [];
    var pubDelayIndex = 0;

    Array.prototype.forEach.call(candidates, function (el) {
      if (el.getBoundingClientRect().top > foldLimit) {
        if (el.classList.contains('pub-row')) {
          el.style.setProperty('--md-reveal-delay', Math.min(pubDelayIndex, 3) * 60 + 'ms');
          pubDelayIndex += 1;
        }
        el.classList.add('md-reveal');
        belowFold.push(el);
      }
    });

    if (!belowFold.length) return;

    var io = new IntersectionObserver(function (entries) {
      Array.prototype.forEach.call(entries, function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('md-visible');
        io.unobserve(el);
        var delay = parseInt(el.style.getPropertyValue('--md-reveal-delay'), 10) || 0;
        window.setTimeout(function () {
          el.classList.remove('md-reveal', 'md-visible');
          el.style.removeProperty('--md-reveal-delay');
        }, delay + 600);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px -28px 0px' });

    belowFold.forEach(function (el) { io.observe(el); });
  }());

  /* ------------------------------------------------------------
   * 6. M3 Ripple & Tactile State Feedback
   * ------------------------------------------------------------ */
  (function initFeedback() {
    var FEEDBACK_HOSTS = '.material-home button, .material-home a.btn, .material-home .profile-nav a, .material-home .social-icons a, .material-home .full-list';
    var pressed = new Set();
    var releaseTimers = new WeakMap();
    var rippleClips = new WeakMap();

    document.querySelectorAll(FEEDBACK_HOSTS).forEach(function (host) {
      host.classList.add('md-feedback');
    });

    function fadeRipple(host) {
      var clip = rippleClips.get(host);
      if (!clip || clip.classList.contains('md-ripple-fade')) return;
      var ripple = clip.querySelector('.md-ripple');
      if (!ripple) return;
      var style = getComputedStyle(ripple);
      ripple.style.transform = style.transform;
      ripple.style.opacity = style.opacity;
      ripple.style.animation = 'none';
      clip.classList.add('md-ripple-fade');
      window.setTimeout(function () {
        if (rippleClips.get(host) === clip) {
          clip.remove();
          rippleClips.delete(host);
        }
      }, 220);
    }

    function feedback(host, x, y) {
      clearTimeout(releaseTimers.get(host));
      fadeRipple(host);
      host.classList.add('md-pressed');
      pressed.add(host);
      if (reducedMotionQuery.matches) return;

      var rect = host.getBoundingClientRect();
      var size = Math.hypot(rect.width, rect.height) * 2;
      var clip = document.createElement('span');
      clip.className = 'md-ripple-clip';
      clip.setAttribute('aria-hidden', 'true');

      var ripple = document.createElement('span');
      ripple.className = 'md-ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = ((x == null ? rect.width / 2 : x - rect.left) - size / 2) + 'px';
      ripple.style.top = ((y == null ? rect.height / 2 : y - rect.top) - size / 2) + 'px';

      clip.appendChild(ripple);
      host.appendChild(clip);
      rippleClips.set(host, clip);

      window.setTimeout(function () {
        if (rippleClips.get(host) === clip) fadeRipple(host);
      }, 650);
    }

    function release() {
      pressed.forEach(function (host) {
        releaseTimers.set(host, window.setTimeout(function () {
          host.classList.remove('md-pressed');
        }, 120));
        fadeRipple(host);
      });
      pressed.clear();
    }

    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !(e.target instanceof Element)) return;
      var host = e.target.closest(FEEDBACK_HOSTS);
      if (host) feedback(host, e.clientX, e.clientY);
    });

    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);

    document.addEventListener('keydown', function (e) {
      if (e.repeat || !(e.target instanceof Element)) return;
      var host = e.target.closest(FEEDBACK_HOSTS);
      if (!host || (e.key !== 'Enter' && e.key !== ' ')) return;
      if (e.key === ' ' && host.tagName === 'A' && host.getAttribute('role') !== 'button') return;
      feedback(host);
      if (e.key === ' ' && host.tagName === 'A') {
        e.preventDefault();
        host.click();
      }
    });

    document.addEventListener('keyup', release);

    document.addEventListener('click', function (e) {
      if (e.detail !== 0 || !(e.target instanceof Element)) return;
      var host = e.target.closest(FEEDBACK_HOSTS);
      if (host && !host.classList.contains('md-pressed')) feedback(host);
      release();
    });
  }());

  /* ------------------------------------------------------------
   * 7. Sidebar Navigation Rail, Sliding Indicator & Scroll Sync
   * ------------------------------------------------------------ */
  (function initProfileNav() {
    var nav = document.querySelector('.profile-nav');
    if (!nav) return;

    var navGroup = nav.querySelector('.nav-group');
    var navSub = navGroup && navGroup.querySelector('.nav-sub');
    var navIndicator = nav.querySelector('.md-nav-indicator');
    var navIndicatorFramePending = false;
    var navMotionFrame = 0;
    var navMotionUntil = 0;

    function updateNavIndicator() {
      navIndicatorFramePending = false;
      if (!navIndicator || !desktopQuery.matches) {
        if (navIndicator) navIndicator.style.opacity = '0';
        return;
      }
      var activeLink = nav.querySelector('a[aria-current="location"]');
      if (!activeLink) {
        navIndicator.style.opacity = '0';
        return;
      }
      var navBounds = nav.getBoundingClientRect();
      var activeBounds = activeLink.getBoundingClientRect();
      navIndicator.style.setProperty('--md-nav-x', Math.round(activeBounds.left - navBounds.left) + 'px');
      navIndicator.style.setProperty('--md-nav-y', Math.round(activeBounds.top - navBounds.top) + 'px');
      navIndicator.style.width = Math.round(activeBounds.width) + 'px';
      navIndicator.style.height = Math.round(activeBounds.height) + 'px';
      navIndicator.style.opacity = '1';
    }

    function scheduleNavIndicator() {
      if (navIndicatorFramePending) return;
      navIndicatorFramePending = true;
      window.requestAnimationFrame(updateNavIndicator);
    }

    function followNavMotionFrame() {
      navMotionFrame = 0;
      var now = window.performance ? window.performance.now() : Date.now();
      updateNavIndicator();
      if (now < navMotionUntil) {
        navMotionFrame = window.requestAnimationFrame(followNavMotionFrame);
      } else {
        nav.classList.remove('nav-motion-live');
        scheduleNavIndicator();
      }
    }

    function followNavMotion(duration) {
      nav.classList.add('nav-motion-live');
      navMotionUntil = Math.max(
        navMotionUntil,
        (window.performance ? window.performance.now() : Date.now()) + duration
      );
      if (!navMotionFrame) navMotionFrame = window.requestAnimationFrame(followNavMotionFrame);
    }

    if (navGroup) {
      navGroup.addEventListener('mouseenter', function () {
        nav.classList.add('nav-open');
        followNavMotion(320);
      });
      nav.addEventListener('mouseleave', function () {
        if (!navGroup.classList.contains('has-active-sub')) nav.classList.remove('nav-open');
        followNavMotion(320);
      });
      if (navSub) {
        navSub.addEventListener('transitionrun', function () { followNavMotion(320); });
        navSub.addEventListener('transitionend', scheduleNavIndicator);
      }
      if (window.ResizeObserver) {
        new ResizeObserver(scheduleNavIndicator).observe(nav);
      }
    }

    var sectionLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var sectionItems = sectionLinks.map(function (link) {
      var id = link.getAttribute('href').slice(1);
      return { id: id, link: link, target: document.getElementById(id) };
    }).filter(function (item) { return item.target; });

    var navFramePending = false;
    var bottomIntentId = window.location.hash ? window.location.hash.slice(1) : '';
    var sawBottom = false;

    nav.addEventListener('click', function (e) {
      if (!(e.target instanceof Element)) return;
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      bottomIntentId = link.getAttribute('href').slice(1);
      sawBottom = false;
    });

    function syncSectionNav() {
      navFramePending = false;
      if (!sectionItems.length) return;

      var marker = window.scrollY + Math.min(144, window.innerHeight * 0.24);
      var active = sectionItems[0];
      sectionItems.forEach(function (item) {
        if (item.target.getBoundingClientRect().top + window.scrollY <= marker) {
          active = item;
        }
      });

      var atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        sawBottom = true;
        var preferredId = bottomIntentId || window.location.hash.slice(1);
        var preferredItem = preferredId && sectionItems.filter(function (item) {
          return item.id === preferredId;
        })[0];

        if (preferredItem) {
          var bounds = preferredItem.target.getBoundingClientRect();
          if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
            active = preferredItem;
          } else {
            active = sectionItems[sectionItems.length - 1];
          }
        } else {
          active = sectionItems[sectionItems.length - 1];
        }
      } else if (sawBottom) {
        sawBottom = false;
        bottomIntentId = '';
      }

      sectionItems.forEach(function (item) {
        if (item.link === active.link) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      });

      if (navGroup) {
        var isPublication = active.link.closest('.nav-group') === navGroup;
        navGroup.classList.toggle('is-active', isPublication);
        navGroup.classList.toggle('has-active-sub', isPublication && active.link !== navGroup.querySelector(':scope > a'));
      }

      scheduleNavIndicator();
    }

    function scheduleSectionNav() {
      if (navFramePending) return;
      navFramePending = true;
      window.requestAnimationFrame(syncSectionNav);
    }

    window.addEventListener('scroll', scheduleSectionNav, { passive: true });
    window.addEventListener('resize', function () {
      scheduleSectionNav();
      scheduleNavIndicator();
    });
    window.addEventListener('hashchange', function () {
      bottomIntentId = window.location.hash ? window.location.hash.slice(1) : '';
      sawBottom = false;
      scheduleSectionNav();
    });

    scheduleSectionNav();
  }());

  /* ------------------------------------------------------------
   * 8. News Scroll Edge Fades
   * ------------------------------------------------------------ */
  (function initNewsFades() {
    var newsScroll = document.querySelector('.news-scroll');
    var newsFrame = newsScroll && newsScroll.closest('.news-frame');
    if (!newsScroll || !newsFrame) return;

    function syncNewsFades() {
      newsFrame.classList.toggle('at-top', newsScroll.scrollTop < 4);
      newsFrame.classList.toggle(
        'at-bottom',
        newsScroll.scrollTop + newsScroll.clientHeight >= newsScroll.scrollHeight - 4
      );
    }

    newsScroll.addEventListener('scroll', syncNewsFades, { passive: true });
    window.addEventListener('resize', syncNewsFades);
    syncNewsFades();
  }());
}());
