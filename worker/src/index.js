import { json, corsPreflight } from './lib.js';
import { handleLead, handleEvent } from './leads.js';
import { handleTelegram, dailyDigest, tgSetup, tgTest, tgDiag } from './bot.js';
import { remindStale } from './remind.js';
import {
  adminLogin, adminVerify, adminLogout, adminMe,
  adminLeads, adminUpdateLead, adminStats, adminExport
} from './admin.js';

const RT = [
  ['/api/lead', 'POST', handleLead],
  ['/api/event', 'POST', handleEvent],
  ['/api/tg/webhook', 'POST', handleTelegram],
  ['/api/tg/setup', 'GET', tgSetup],
  ['/api/tg/test', 'GET', tgTest],
  ['/api/tg/diag', 'GET', tgDiag],
  ['/api/admin/login', 'POST', adminLogin],
  ['/api/admin/verify', 'POST', adminVerify],
  ['/api/admin/logout', 'POST', adminLogout],
  ['/api/admin/me', 'GET', adminMe],
  ['/api/admin/leads', 'GET', adminLeads],
  ['/api/admin/lead', 'POST', adminUpdateLead],
  ['/api/admin/stats', 'GET', adminStats],
  ['/api/admin/export', 'GET', adminExport]
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return corsPreflight(request, env);
    if (path === '/') return json({ ok: true, service: 'moydom-leads', v: 1 });

    for (const [route, method, handler] of RT) {
      if (path === route && request.method === method) {
        try {
          return await handler(request, env);
        } catch (e) {
          return json({ ok: false, error: 'server', detail: String((e && e.message) || e) }, 500);
        }
      }
    }
    return json({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(controller, env, ctx) {
    const cron = (controller && controller.cron) || '';
    if (cron === '0 6 * * *') ctx.waitUntil(dailyDigest(env));
    else ctx.waitUntil(remindStale(env));
  }
};
