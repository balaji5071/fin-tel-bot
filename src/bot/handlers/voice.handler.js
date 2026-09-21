import { groq } from '../../services/ai/groq.client.js';
import { handleConversationalMessage } from './conversation.handler.js';
import { logger } from '../../utils/logger.js';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Download a file from a URL to a temporary local file
 */
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
};

/**
 * Handle Telegram Voice Notes using Groq Whisper Speech-to-Text
 * @param {import('telegraf').Context} ctx
 */
export const handleVoiceMessage = async (ctx) => {
  const voice = ctx.message?.voice;
  if (!voice) return;

  try {
    await ctx.sendChatAction('record_voice').catch(() => {});
    await ctx.reply('🎙️ _Listening to your voice note..._', { parse_mode: 'Markdown' });

    // 1. Obtain file link from Telegram
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const tempFilePath = path.join(os.tmpdir(), `voice_${Date.now()}_${voice.file_id}.ogg`);

    // 2. Download voice file
    await downloadFile(fileLink.href, tempFilePath);

    // 3. Transcribe audio using Groq Whisper model
    const fileStream = fs.createReadStream(tempFilePath);
    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-large-v3',
      language: 'en',
    });

    // Cleanup temp file
    fs.unlink(tempFilePath, () => {});

    const transcribedText = transcription.text?.trim();
    if (!transcribedText || /^[\s.,!?-]+$/.test(transcribedText)) {
      return ctx.reply("I couldn't catch that clearly. Could you try speaking again or type it out?");
    }

    logger.info(`Transcribed voice note: "${transcribedText}"`);
    await ctx.reply(`🗣️ _"${transcribedText}"_`, { parse_mode: 'Markdown' });

    // 4. Inject transcribed text into message context and route through conversational pipeline
    ctx.message.text = transcribedText;
    return handleConversationalMessage(ctx);
  } catch (error) {
    logger.error('Error processing voice message with Groq Whisper:', error);
    return ctx.reply('⚠️ Sorry, I had trouble processing that voice note. Please try typing your request.');
  }
};
