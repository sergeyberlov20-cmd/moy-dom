import { json, corsPreflight } from './lib.js';
import { handleLead, handleEvent } from './leads.js';
import { handleTelegram, dailyDigest, tgSetup, tgTest, tgDiag, tgProfile } from './bot.js';
import { remindStale } from './remind.js';
import { releaseScheduled, postRelease } from './release.js';
import { reviewsDry, updateYandexReviews, runReviewsCron } from './reviews.js';
import { ghDiag } from './diag.js';
import {
  adminLogin, adminVerify, adminLogout, adminMe,
  adminLeads, adminUpdateLead, adminStats, adminExport, adminBotStats
} from './admin.js';

const RT = [
  ['/api/lead', 'POST', handleLead],
  ['/api/event', 'POST', handleEvent],
  ['/api/tg/webhook', 'POST', handleTelegram],
  ['/api/tg/setup', 'GET', tgSetup],
  ['/api/tg/test', 'GET', tgTest],
  ['/api/tg/diag', 'GET', tgDiag],
  ['/api/tg/profile', 'GET', tgProfile],
  ['/api/diag/gh', 'GET', ghDiag],
  ['/api/post/release', 'GET', postRelease],
  ['/api/reviews/update', 'GET', async (request, env) => {
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || '';
    if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) return json({ ok: false, error: 'forbidden' }, 403);
    try {
      // ?notify=1 — тот же путь, что у крона, с сообщением в Telegram о новых отзывах
      return json(url.searchParams.get('notify') === '1' ? await runReviewsCron(env) : await updateYandexReviews(env));
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  }],
  ['/api/reviews/dry', 'GET', async (request, env) => {
    const key = new URL(request.url).searchParams.get('key') || '';
    if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) return json({ ok: false, error: 'forbidden' }, 403);
    return json(await reviewsDry());
  }],
  ['/api/admin/login', 'POST', adminLogin],
  ['/api/admin/verify', 'POST', adminVerify],
  ['/api/admin/logout', 'POST', adminLogout],
  ['/api/admin/me', 'GET', adminMe],
  ['/api/admin/leads', 'GET', adminLeads],
  ['/api/admin/lead', 'POST', adminUpdateLead],
  ['/api/admin/stats', 'GET', adminStats],
  ['/api/admin/botstats', 'GET', adminBotStats],
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
    if (cron === '0 6 * * *') {
      ctx.waitUntil(releaseScheduled(env).catch(() => null));
      ctx.waitUntil(dailyDigest(env));
    } else if (cron === '0 4 1,15 * *') {
      // раз в две недели: 1-го и 15-го в 07:00 МСК
      ctx.waitUntil(runReviewsCron(env).catch(() => null));
    } else {
      ctx.waitUntil(remindStale(env));
    }
  }
};
