#!/usr/bin/env node

import dotenv from 'dotenv';
import https from 'node:https';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error('\n❌ ERROR: BOT_TOKEN is missing in your .env file!\n');
  process.exit(1);
}

const args = process.argv.slice(2);
const command = (args[0] || 'info').toLowerCase();
const targetUrl = args[1] || process.env.APP_URL;

const callTelegramApi = (method, payload = {}) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse Telegram API response: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
};

const run = async () => {
  console.log('\n🤖 \x1b[36mTelegram Webhook Manager\x1b[0m\n');

  try {
    // 1. Get current Bot Profile
    const me = await callTelegramApi('getMe');
    if (!me.ok) {
      console.error(`❌ Invalid BOT_TOKEN: ${me.description}`);
      process.exit(1);
    }
    console.log(`✅ Authenticated Bot: \x1b[32m@${me.result.username}\x1b[0m (ID: ${me.result.id})\n`);

    if (command === 'info') {
      console.log('📡 Fetching current webhook status from Telegram...');
      const info = await callTelegramApi('getWebhookInfo');
      if (info.ok) {
        console.log('\n--- Telegram Webhook Status ---');
        console.log(`URL:                 \x1b[33m${info.result.url || '(None - Polling Mode)'}\x1b[0m`);
        console.log(`Custom Certificate:  ${info.result.has_custom_certificate}`);
        console.log(`Pending Updates:     ${info.result.pending_update_count}`);
        if (info.result.last_error_date) {
          const errDate = new Date(info.result.last_error_date * 1000).toISOString();
          console.log(`Last Error Date:     \x1b[31m${errDate}\x1b[0m`);
          console.log(`Last Error Message:  \x1b[31m${info.result.last_error_message}\x1b[0m`);
        }
        console.log('-------------------------------\n');
      } else {
        console.error('❌ Failed to get webhook info:', info.description);
      }
      return;
    }

    if (command === 'delete') {
      console.log('🗑️  Deleting Telegram webhook...');
      const del = await callTelegramApi('deleteWebhook', { drop_pending_updates: false });
      if (del.ok) {
        console.log('\n\x1b[32m✅ Telegram webhook successfully deleted!\x1b[0m');
        console.log('The bot can now be run locally in polling mode with `npm run dev`.\n');
      } else {
        console.error('❌ Failed to delete webhook:', del.description);
      }
      return;
    }

    if (command === 'set') {
      if (!targetUrl) {
        console.error('❌ Error: Target URL is required.');
        console.log('\nUsage:');
        console.log('  npm run webhook:set https://your-project.vercel.app');
        console.log('  or define APP_URL in your .env file.\n');
        process.exit(1);
      }

      let webhookEndpoint = targetUrl.trim();
      if (!webhookEndpoint.startsWith('http://') && !webhookEndpoint.startsWith('https://')) {
        webhookEndpoint = `https://${webhookEndpoint}`;
      }
      if (!webhookEndpoint.endsWith('/api/webhook')) {
        webhookEndpoint = `${webhookEndpoint.replace(/\/$/, '')}/api/webhook`;
      }

      console.log(`🔗 Setting Webhook URL to: \x1b[34m${webhookEndpoint}\x1b[0m`);

      const payload = {
        url: webhookEndpoint,
        drop_pending_updates: false,
      };

      if (WEBHOOK_SECRET) {
        payload.secret_token = WEBHOOK_SECRET;
        console.log('🔒 Using secret_token from TELEGRAM_WEBHOOK_SECRET');
      }

      const res = await callTelegramApi('setWebhook', payload);

      if (res.ok) {
        console.log('\n\x1b[32m🎉 SUCCESS! Webhook is registered with Telegram.\x1b[0m');
        console.log(`Messages sent to @${me.result.username} will now be delivered to your Vercel endpoint!`);
        console.log(`Webhook URL: ${webhookEndpoint}\n`);
      } else {
        console.error('\n❌ Telegram API Error:', res.description);
      }
      return;
    }

    console.log(`Unknown command: "${command}". Available commands: info, set, delete`);
  } catch (error) {
    console.error('Fatal Error:', error.message);
    process.exit(1);
  }
};

run();
