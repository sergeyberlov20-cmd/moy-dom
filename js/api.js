/* Мост «сайт → API заявок» (Cloudflare Worker).
   Заявки уходят в свою базу + Telegram, Formspree остаётся резервом. */
(function () {
  var BASE = 'https://moydom-leads.sergeyberlov20.workers.dev';

  window.MD_API = BASE;

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
    return fetch(BASE + '/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('api ' + r.status);
      return r.json();
    });
  };

  if (!BASE) return;

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
