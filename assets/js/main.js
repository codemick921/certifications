/* ==========================================================================
   Credential portfolio — data loading and interaction
   No dependencies. Reads /data/profile.json and /data/certs.json.
   ========================================================================== */

(function () {
  'use strict';

  var DATA_PROFILE = '/data/profile.json';
  var DATA_CERTS = '/data/certs.json';

  var state = {
    certs: [],
    profile: null,
    issuer: 'all',
    query: '',
    lastFocused: null,
    openId: null
  };

  /* ---------------------------------------------------------------- utils */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'class') node.className = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value === true ? '' : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function initials(name) {
    return String(name || '')
      .replace(/[^A-Za-z ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (word) { return word.charAt(0).toUpperCase(); })
      .join('');
  }

  function formatDate(value) {
    if (!value) return 'Undated';
    var parts = String(value).split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1] || 1);
    if (!year || year < 1900 || year > 2200) return 'Undated';
    var date = new Date(Date.UTC(year, month - 1, 1));
    try {
      return new Intl.DateTimeFormat('en-GB', {
        month: 'short', year: 'numeric', timeZone: 'UTC'
      }).format(date);
    } catch (err) {
      return String(year);
    }
  }

  function sortKey(cert) {
    return String(cert.date || '').replace(/[^0-9]/g, '').padEnd(6, '0');
  }

  function isCompleted(cert) { return (cert.status || 'completed') === 'completed'; }

  function statusLabel(cert) {
    var status = cert.status || 'completed';
    if (status === 'in-progress') return 'In progress';
    if (status === 'planned') return 'Planned';
    return 'Completed';
  }

  function searchBlob(cert) {
    return [
      cert.title, cert.issuer, cert.category, cert.credentialId,
      (cert.skills || []).join(' '), cert.note
    ].join(' ').toLowerCase();
  }

  /* ------------------------------------------------------------ rendering */

  function renderProfile(profile) {
    if (!profile) return;

    if (profile.name) {
      $('#hero-name').textContent = profile.name;
      $('#foot-name').textContent = profile.name;
      document.title = 'Certifications — ' + profile.name;
      var og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', 'Certifications — ' + profile.name);
      var author = document.querySelector('meta[name="author"]');
      if (author) author.setAttribute('content', profile.name);
    }

    if (profile.mark) $('#brand-mark').textContent = profile.mark;
    else if (profile.name) $('#brand-mark').textContent = initials(profile.name);

    if (profile.lede) $('#hero-lede').textContent = profile.lede;

    var head = $('.hero__name');
    if (profile.location && head) {
      var eye = $('.eyebrow');
      if (eye) eye.textContent = 'Credential portfolio · ' + profile.location;
    }

    var links = (profile.links || []).filter(function (l) { return l && l.label && l.href; });
    if (links.length) {
      [$('#hero-links'), $('#contact-links')].forEach(function (list) {
        if (!list) return;
        list.textContent = '';
        links.forEach(function (link) {
          list.appendChild(el('li', {}, [
            el('a', { href: link.href, rel: 'me noopener', target: link.href.indexOf('http') === 0 ? '_blank' : null },
              [link.label])
          ]));
        });
      });
    }

    if (Array.isArray(profile.about) && profile.about.length) {
      var body = $('#about-body');
      body.textContent = '';
      profile.about.forEach(function (para) {
        body.appendChild(el('p', { text: para }));
      });
    }

    if (profile.contactLine) {
      var line = $('.contact-block__line');
      if (line) line.textContent = profile.contactLine;
    }
  }

  function renderStats(certs) {
    var completed = certs.filter(isCompleted);
    var issuers = {};
    completed.forEach(function (c) { if (c.issuer) issuers[c.issuer] = true; });
    var pending = certs.filter(function (c) { return !isCompleted(c); });

    var latest = completed.slice().sort(function (a, b) {
      return sortKey(b).localeCompare(sortKey(a));
    })[0];

    $('#stat-completed').textContent = completed.length ? String(completed.length) : '0';
    $('#stat-issuers').textContent = String(Object.keys(issuers).length);
    $('#stat-progress').textContent = String(pending.length);
    $('#stat-latest').textContent = latest ? formatDate(latest.date) : '—';
  }

  function renderFilters(certs) {
    var wrap = $('#issuer-chips');
    var issuers = {};
    certs.filter(isCompleted).forEach(function (c) {
      if (c.issuer) issuers[c.issuer] = (issuers[c.issuer] || 0) + 1;
    });

    var names = Object.keys(issuers).sort(function (a, b) { return a.localeCompare(b); });
    wrap.textContent = '';

    function makeChip(value, label) {
      var chip = el('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(state.issuer === value),
        'data-issuer': value,
        text: label
      }, []);
      chip.addEventListener('click', function () {
        state.issuer = state.issuer === value ? 'all' : value;
        renderFilters(state.certs);
        renderGrid();
      });
      return chip;
    }

    if (names.length > 1) wrap.appendChild(makeChip('all', 'All'));
    names.forEach(function (name) {
      wrap.appendChild(makeChip(name, name));
    });

    // Re-sync pressed state after a programmatic change.
    Array.prototype.forEach.call(wrap.children, function (chip) {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('data-issuer') === state.issuer));
    });
  }

  function buildCard(cert) {
    var badgeNode;
    if (cert.badge) {
      badgeNode = el('img', {
        class: 'card__badge',
        src: cert.badge,
        alt: '',
        loading: 'lazy',
        decoding: 'async'
      });
      badgeNode.addEventListener('error', function () {
        var fallback = el('span', { class: 'card__issuer-mark', text: initials(cert.issuer || cert.title) });
        badgeNode.replaceWith(fallback);
      });
    } else {
      badgeNode = el('span', { class: 'card__issuer-mark', text: initials(cert.issuer || cert.title) });
    }

    var card = el('button', {
      type: 'button',
      class: 'card' + (cert.placeholder ? ' card--placeholder' : ''),
      'data-id': cert.id,
      'aria-haspopup': 'dialog',
      'aria-label': cert.title + ', issued by ' + (cert.issuer || 'unknown issuer') + '. Open details.'
    }, [
      el('div', { class: 'card__top' }, [
        badgeNode,
        el('span', { class: 'card__date', text: formatDate(cert.date) })
      ]),
      el('h3', { class: 'card__title', text: cert.title }),
      el('p', { class: 'card__issuer', text: cert.issuer || '' }),
      el('div', { class: 'card__foot' }, [
        cert.verifyUrl
          ? el('span', { class: 'card__verified', text: 'Verifiable' })
          : el('span', { text: cert.credentialId ? 'ID ' + cert.credentialId : 'No public link' }),
        cert.placeholder ? el('span', { class: 'card__flag', text: 'Sample' }) : null
      ])
    ]);

    card.addEventListener('click', function () { openModal(cert.id, card); });
    return el('li', {}, [card]);
  }

  function renderGrid() {
    var grid = $('#cert-grid');
    var empty = $('#empty-state');
    var completed = state.certs.filter(isCompleted);

    var visible = completed.filter(function (cert) {
      var okIssuer = state.issuer === 'all' || cert.issuer === state.issuer;
      var okQuery = !state.query || searchBlob(cert).indexOf(state.query) !== -1;
      return okIssuer && okQuery;
    }).sort(function (a, b) {
      return sortKey(b).localeCompare(sortKey(a)) || String(a.title).localeCompare(String(b.title));
    });

    grid.textContent = '';
    visible.forEach(function (cert) { grid.appendChild(buildCard(cert)); });

    var filtering = state.issuer !== 'all' || Boolean(state.query);
    empty.hidden = visible.length > 0;
    $('#clear-filters').hidden = !filtering;

    var note = $('#count-note');
    if (!completed.length) note.textContent = 'No credentials added yet.';
    else if (filtering) note.textContent = visible.length + ' of ' + completed.length + ' shown';
    else note.textContent = completed.length + (completed.length === 1 ? ' credential' : ' credentials');
  }

  function renderProgress() {
    var list = $('#progress-list');
    var pending = state.certs.filter(function (c) { return !isCompleted(c); })
      .sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });

    list.textContent = '';
    $('#progress-empty').hidden = pending.length > 0;

    pending.forEach(function (cert) {
      var stateLabel = cert.status === 'planned' ? 'Next up' : 'In progress';
      list.appendChild(el('li', { class: 'progress-item' }, [
        el('span', {
          class: 'progress-item__state',
          'data-state': cert.status === 'planned' ? 'planned' : 'active',
          text: stateLabel
        }),
        el('span', { class: 'progress-item__title' }, [
          cert.title,
          el('span', { class: 'progress-item__issuer', text: cert.issuer || '' })
        ]),
        el('span', { class: 'progress-item__note', text: cert.note || '' })
      ]));
    });
  }

  /* ---------------------------------------------------------------- modal */

  function buildViewer(cert) {
    var viewer = $('#modal-viewer');
    viewer.textContent = '';

    var embed = cert.embed || {};
    if (embed.type === 'iframe' && embed.src) {
      viewer.appendChild(el('iframe', {
        src: embed.src,
        title: (embed.label || cert.title) + ' credential',
        loading: 'lazy',
        allowfullscreen: true
      }));
      return;
    }
    if (embed.type === 'pdf' && embed.src) {
      viewer.appendChild(el('object', { data: embed.src, type: 'application/pdf' }, [
        el('p', { class: 'viewer-fallback' }, [
          'Preview unavailable in this browser. ',
          el('a', { href: embed.src, target: '_blank', rel: 'noopener' }, ['Open the certificate'])
        ])
      ]));
      return;
    }
    if (embed.src && (embed.type === 'image' || !embed.type)) {
      var img = el('img', { src: embed.src, alt: (embed.label || cert.title) + ' certificate', loading: 'lazy' });
      img.addEventListener('error', function () {
        viewer.textContent = '';
        viewer.appendChild(el('p', { class: 'viewer-fallback', text: 'The certificate image could not be loaded.' }));
      });
      viewer.appendChild(img);
      return;
    }
    if (cert.verifyUrl) {
      viewer.appendChild(el('p', { class: 'viewer-fallback' }, [
        'This credential is verified on the issuer\u2019s site. ',
        el('a', { href: cert.verifyUrl, target: '_blank', rel: 'noopener' }, ['Open the verification page'])
      ]));
    }
  }

  function openModal(id, trigger) {
    var cert = state.certs.filter(function (c) { return c.id === id; })[0];
    if (!cert) return;

    state.lastFocused = trigger || document.activeElement;
    state.openId = id;

    $('#modal-issuer').textContent = cert.issuer || '';
    $('#modal-title').textContent = cert.title || '';
    $('#modal-meta').textContent = [
      cert.date ? formatDate(cert.date) : statusLabel(cert),
      cert.credentialId ? 'ID ' + cert.credentialId : null
    ].filter(Boolean).join(' · ');

    var tags = $('#modal-tags');
    tags.textContent = '';
    (cert.skills || []).forEach(function (skill) {
      tags.appendChild(el('li', { text: skill }));
    });

    var actions = $('#modal-actions');
    actions.textContent = '';
    if (cert.verifyUrl) {
      actions.appendChild(el('a', { href: cert.verifyUrl, target: '_blank', rel: 'noopener' }, ['Verify credential']));
    }
    if (cert.embed && cert.embed.src) {
      actions.appendChild(el('a', { href: cert.embed.src, target: '_blank', rel: 'noopener' }, ['Open file']));
    }

    buildViewer(cert);

    var modal = $('#modal');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.modal__panel').focus();

    if (history.replaceState && id) {
      try { history.replaceState(null, '', '#cert-' + encodeURIComponent(id)); } catch (e) {}
    }

    document.addEventListener('keydown', onKeydown);
  }

  function closeModal() {
    var modal = $('#modal');
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    state.openId = null;
    document.removeEventListener('keydown', onKeydown);

    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }

    if (history.replaceState) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;

    var panel = $('.modal__panel');
    var focusable = panel.querySelectorAll(
      'a[href], button:not([disabled]), iframe, object, input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* --------------------------------------------------------------- schema */

  function injectSchema(profile, certs) {
    var completed = certs.filter(isCompleted);
    var data = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: (profile && profile.name) || document.title,
      url: location.origin,
      hasCredential: completed.map(function (cert) {
        return {
          '@type': 'EducationalOccupationalCredential',
          name: cert.title,
          credentialCategory: cert.category || 'Certificate',
          recognizedBy: { '@type': 'Organization', name: cert.issuer || '' },
          url: cert.verifyUrl || undefined,
          dateCreated: cert.date || undefined,
          identifier: cert.credentialId || undefined
        };
      })
    };

    try {
      var node = document.createElement('script');
      node.type = 'application/ld+json';
      node.textContent = JSON.stringify(data);
      document.head.appendChild(node);
    } catch (err) { /* schema is a bonus, never fatal */ }
  }

  /* ------------------------------------------------------------ data load */

  function loadJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' returned ' + res.status);
      return res.json();
    });
  }

  function showLoadError(message) {
    var grid = $('#cert-grid');
    grid.textContent = '';
    grid.appendChild(el('li', { class: 'empty' }, [
      el('strong', { text: 'Credentials could not be loaded. ' }),
      message,
      ' ',
      el('span', { text: 'If you opened this file directly, run a local server instead (npm run dev).' })
    ]));
    $('#count-note').textContent = 'Unavailable';
  }

  function init() {
    var yearNode = $('#year');
    if (yearNode) yearNode.textContent = String(new Date().getFullYear());

    var search = $('#search');
    var timer;

    search.addEventListener('input', function () {
      clearTimeout(timer);
      var value = search.value.trim().toLowerCase();
      timer = setTimeout(function () {
        state.query = value;
        renderGrid();
      }, 120);
    });

    $('#clear-filters').addEventListener('click', function () {
      state.issuer = 'all';
      state.query = '';
      search.value = '';
      renderFilters(state.certs);
      renderGrid();
      search.focus();
    });

    $('#modal-close').addEventListener('click', closeModal);
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (node) {
      node.addEventListener('click', closeModal);
    });

    var dismiss = $('#sample-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        $('#sample-banner').hidden = true;
        try { sessionStorage.setItem('sampleDismissed', '1'); } catch (e) {}
      });
    }

    Promise.all([
      loadJSON(DATA_PROFILE).catch(function () { return null; }),
      loadJSON(DATA_CERTS)
    ]).then(function (results) {
      state.profile = results[0];
      var payload = results[1] || {};
      state.certs = Array.isArray(payload) ? payload : (payload.certificates || []);

      state.certs = state.certs.filter(function (c) { return c && c.id && c.title; });
      state.certs.sort(function (a, b) { return sortKey(b).localeCompare(sortKey(a)); });

      renderProfile(state.profile);
      renderStats(state.certs);
      renderFilters(state.certs);
      renderGrid();
      renderProgress();
      injectSchema(state.profile, state.certs);

      var hasPlaceholders = state.certs.some(function (c) { return c.placeholder; });
      var dismissed = false;
      try { dismissed = sessionStorage.getItem('sampleDismissed') === '1'; } catch (e) {}
      if (hasPlaceholders && !dismissed) $('#sample-banner').hidden = false;

      var match = /^#cert-(.+)$/.exec(location.hash);
      if (match) openModal(decodeURIComponent(match[1]), null);
    }).catch(function (err) {
      showLoadError(err && err.message ? err.message : 'Unknown error.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
