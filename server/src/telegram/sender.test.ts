import { createTelegramSender } from './sender.js';
import { describe, it, expect } from '@jest/globals';

function createMockBot() {
  const calls: Array<{ method: string; chatId: string; url: string; caption?: string }> = [];
  return {
    calls,
    bot: {
      sendPhoto: async (chatId: string, url: string, opts?: { caption?: string }) => {
        calls.push({ method: 'sendPhoto', chatId, url, caption: opts?.caption });
      },
      sendAnimation: async (chatId: string, url: string, opts?: { caption?: string }) => {
        calls.push({ method: 'sendAnimation', chatId, url, caption: opts?.caption });
      },
    } as any,
  };
}

describe('createTelegramSender', () => {
  it('sends photos via sendPhoto', async () => {
    const { bot, calls } = createMockBot();
    const sender = createTelegramSender(bot);

    await sender('12345', 'https://example.com/bench.jpg', 'Bench Press');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('sendPhoto');
    expect(calls[0].chatId).toBe('12345');
    expect(calls[0].url).toBe('https://example.com/bench.jpg');
    expect(calls[0].caption).toBe('Bench Press');
  });

  it('sends GIFs via sendAnimation', async () => {
    const { bot, calls } = createMockBot();
    const sender = createTelegramSender(bot);

    await sender('12345', 'https://example.com/exercise.gif');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('sendAnimation');
    expect(calls[0].url).toBe('https://example.com/exercise.gif');
  });

  it('sends non-gif URLs via sendPhoto', async () => {
    const { bot, calls } = createMockBot();
    const sender = createTelegramSender(bot);

    await sender('12345', 'https://example.com/form.png');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('sendPhoto');
  });
});
