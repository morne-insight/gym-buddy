import { createDatabase, scheduleMessage, getUser, closePool } from '../db/index.js';

async function main(): Promise<void> {
  const db = createDatabase();
  const user = await getUser(db, 'user-founder');

  if (!user) {
    console.error('User "user-founder" not found. Run npm run seed first.');
    process.exitCode = 1;
    return;
  }

  if (!user.telegram_chat_id) {
    console.error('User has no Telegram linked. Send /start user-founder to your bot first.');
    process.exitCode = 1;
    return;
  }

  const msg = await scheduleMessage(db, {
    user_id: 'user-founder',
    deliver_at: new Date(Date.now() - 1000).toISOString(),
    message_type: 'test',
    content: 'This is a test message from your Gym Buddy. If you can read this, notifications are working.',
    image_url: null,
    created_by: 'manual_test',
  });

  console.log(`Test message scheduled (ID: ${msg.id}). It will be delivered within 1 minute by the cron job.`);
}

main()
  .catch((err) => {
    console.error('Failed to schedule test message:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
