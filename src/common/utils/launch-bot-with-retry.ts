import { Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';

// Telegraf's `bot.launch()` tries to reach api.telegram.org exactly ONCE. If
// that single attempt fails — e.g. a transient ECONNRESET/ETIMEDOUT while the
// buyer's/admin's internet or Telegram itself is briefly unreachable — the
// bot just stays dead for the rest of the process's life; nothing ever
// retries it, even after the network recovers. The only "fix" used to be
// restarting the whole backend by hand.
//
// This wraps launch() with its own retry loop: on failure it waits and tries
// again, backing off up to `maxDelayMs` so a persistent outage doesn't hammer
// Telegram's API or the ISP. Once the network is back, the very next attempt
// succeeds and the bot comes online with no manual restart needed.
export function launchBotWithRetry(
  bot: Telegraf,
  logger: Logger,
  label: string,
  options: { minDelayMs?: number; maxDelayMs?: number } = {},
): { stop: () => void } {
  const minDelayMs = options.minDelayMs ?? 5000;
  const maxDelayMs = options.maxDelayMs ?? 60000;
  let delay = minDelayMs;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function attempt() {
    if (stopped) return;
    bot
      .launch()
      .then(() => {
        delay = minDelayMs;
        logger.log(`${label} ishga tushdi.`);
      })
      .catch((error) => {
        if (stopped) return;
        const seconds = Math.round(delay / 1000);
        logger.error(
          `${label} ishga tushmadi: ${(error as Error).message}. ${seconds} soniyadan keyin avtomatik qayta urinib ko'riladi.`,
        );
        timer = setTimeout(attempt, delay);
        delay = Math.min(delay * 2, maxDelayMs);
      });
  }

  attempt();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
