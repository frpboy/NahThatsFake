import { bot } from './bot';
import { startScheduler } from './services/scheduler';

// Long-polling entry point: starts the in-process scheduler and polls Telegram.
// (The Vercel webhook entry point is ./webhook.ts - it does not run the scheduler.)
startScheduler();

// Start the bot
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started!`);
    
    // Set commands for BotFather (suggestions)
    bot.api.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'How to use the bot' },
      { command: 'credits', description: 'View your credits' },
      { command: 'history', description: 'Recent checks' },
      { command: 'refer', description: 'Invite friends and earn credits' },
      { command: 'premium', description: 'Upgrade to premium' },
      { command: 'feedback', description: 'Submit suggestion/bug' },
    ]);
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
