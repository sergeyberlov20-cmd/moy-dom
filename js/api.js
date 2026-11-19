/* Мост «сайт → API заявок» (Cloudflare Worker).
   Заявки уходят в свою базу + Telegram. */
(function () {
  var BASE = 'https://moydom-leads.sergeyberlov20.workers.dev';
  var startedAt = Date.now();

  window.MD_API = BASE;
  window.mdElapsed = function () { return Date.now() - startedAt; };

  window.mdTrack = function (type, meta) {
    if (!BASE) return;
    try {
      fetch(BASE + '/api/event', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, page: location.pathname, meta: meta || '' })
      }).catch(function () {});
    } catch (e) {}
  };

  window.mdSendLead = function (payload) {
    if (!BASE) return Promise.reject(new Error('no-api'));
    var body = Object.assign({}, payload || {});
    if (!body.elapsed) body.elapsed = window.mdElapsed();
    return fetch(BASE + '/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('api ' + r.status);
      return r.json();
    });
  };

  if (!BASE) return;

  /* режим обслуживания: если включён — показываем заглушку вместо сайта */
  window.mdMaintenanceShown = false;
  function showMaintenance(message) {
    if (window.mdMaintenanceShown) return;
    window.mdMaintenanceShown = true;
    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'alert');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1c2e5a;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Inter,Arial,sans-serif;';
    wrap.innerHTML = '<div style="max-width:520px;">' +
      '<div style="font-size:2.4rem;font-weight:900;letter-spacing:.5px;margin-bottom:14px;">Мой<span style="color:#cc2229;">Дом</span></div>' +
      '<div style="font-size:1.25rem;font-weight:800;margin-bottom:10px;">Сайт на обслуживании</div>' +
      '<p style="color:rgba(255,255,255,.75);line-height:1.7;margin:0 0 18px;">' + (message || 'Обновляем каталог — вернёмся совсем скоро.') + '</p>' +
      '<a href="tel:+79495044455" style="display:inline-block;background:#cc2229;color:#fff;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:12px;">+7 949 504-44-55</a>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  try {
    fetch(BASE + '/api/status', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.maintenance) showMaintenance(s.message);
      })
      .catch(function () {});
  } catch (e) {}

  // клики по телефону — по всему сайту
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === 'A' && String(el.getAttribute('href') || '').indexOf('tel:') === 0) {
        window.mdTrack('tel_click', el.getAttribute('href'));
        break;
      }
      el = el.parentNode;
    }
  }, true);

  // просмотр страницы (один раз)
  if (document.readyState === 'complete') window.mdTrack('pageview', document.title);
  else window.addEventListener('load', function () { window.mdTrack('pageview', document.title); }, { once: true });
})();

