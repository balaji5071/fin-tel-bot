import Groq from 'groq-sdk';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Singleton Groq Client initialization
 */
export const groq = new Groq({
  apiKey: config.GROQ_API_KEY,
});

export const PRIMARY_MODEL = config.GROQ_MODEL || 'openai/gpt-oss-120b';
export const FALLBACK_MODEL = 'openai/gpt-oss-20b';

/**
 * Executes a chat completion with automatic fallback to secondary model on rate limit or transient failure
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {boolean} [options.jsonMode=true]
 * @param {number} [options.temperature=0.1]
 * @param {number} [options.max_tokens=1500]
 * @returns {Promise<string>}
 */
export const executeGroqChat = async ({
  messages,
  jsonMode = true,
  temperature = 0.1,
  max_tokens = 1500,
}) => {
  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, 'qwen/qwen3.8-27b'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`Empty response returned from Groq model ${model}`);
      }

      return content;
    } catch (error) {
      lastError = error;
      logger.warn(`Groq request failed with model ${model}: ${error.message}. Trying next fallback if available...`);
      if (error?.status === 429 || error?.message?.includes('Rate limit')) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  logger.error('All Groq model attempts failed:', lastError);
  throw lastError;
};
