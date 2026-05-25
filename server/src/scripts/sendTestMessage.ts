import { createDatabase, scheduleMessage, getUser } from '../db/index.js';

const db = createDatabase();
const user = getUser(db, 'user-founder');

if (!user) {
  console.error('User "user-founder" not found. Run npm run seed first.');
  process.exit(1);
}

if (!user.telegram_chat_id) {
  console.error('User has no Telegram linked. Send /start user-founder to your bot first.');
  process.exit(1);
}

const msg = scheduleMessage(db, {
  user_id: 'user-founder',
  deliver_at: new Date(Date.now() - 1000).toISOString(),
  message_type: 'test',
  content: 'This is a test message from your Gym Buddy. If you can read this, notifications are working.',
  image_url: null,
  created_by: 'manual_test',
});

console.log(`Test message scheduled (ID: ${msg.id}). It will be delivered within 1 minute by the cron job.`);
db.close();
