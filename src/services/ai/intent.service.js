import { z } from 'zod';
import { executeGroqChat } from './groq.client.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_CATEGORIES } from '../../validations/categories.js';

/**
 * Event Types for Financial Event Extraction Engine
 */
export const EVENT_TYPES = [
  'income',
  'expense',
  'balance_query',
  'company_budget_query',
  'monthly_expenses_query',
  'monthly_income_query',
  'employee_expenses_query',
  'vendor_expenses_query',
  'department_expenses_query',
  'admin_count_query',
  'employee_count_query',
  'top_spender_query',
  'top_department_query',
  'financial_summary',
  'cashflow_report',
  'category_report',
  'employee_report',
  'budget_status',
  'set_budget',
  'search_transactions',
  'edit_transaction',
  'delete_transaction',
  'conversation_instruction',
  'admin_reset_data',
  'user_profile',
  'role_elevation_request',
  'general_finance_question',
];

/**
 * Zod Schema for individual financial events
 */
export const FinancialEventSchema = z.object({
  event_type: z.enum(EVENT_TYPES),
  amount: z.number().nullable().optional(),
  currency: z.string().default('INR'),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.95),
  vendor: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),

  // For edit & delete
  transaction_id: z.number().nullable().optional(),
  search_query: z.string().nullable().optional(),
  field: z.enum(['amount', 'category', 'note', 'vendor']).nullable().optional(),
  new_value: z.union([z.string(), z.number()]).nullable().optional(),

  // For search & reports
  keyword: z.string().nullable().optional(),
  timeframe: z.string().nullable().optional(),
  days: z.number().nullable().optional(),
  min_amount: z.number().nullable().optional(),
  max_amount: z.number().nullable().optional(),
  employee_name: z.string().nullable().optional(),

  // For reset
  confirmed: z.boolean().nullable().optional(),
  requires_confirmation: z.boolean().nullable().optional(),

  // For instructions or general questions
  instruction: z.string().nullable().optional(),
  question: z.string().nullable().optional(),
});

/**
 * Zod Schema for complete multi-event message
 */
export const FinancialMessageSchema = z.object({
  message_type: z.enum(['financial_events', 'query', 'instruction', 'admin', 'general']).default('financial_events'),
  events: z.array(FinancialEventSchema).min(1),
  isDeterministic: z.boolean().optional(),
});

/**
 * Normalization Layer:
 * Unwraps arrays, strips markdown code fences, and transforms legacy or raw array outputs
 * into a valid FinancialMessageSchema object.
 */
export function normalizeGroqJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      message_type: 'general',
      events: [{ event_type: 'general_finance_question' }],
    };
  }

  let cleaned = rawText.trim();
  // Strip markdown code fences if present (```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/(\{|\[)[\s\S]*(\}|\])/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw err;
    }
  }

  // If parsed response is an array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        message_type: 'general',
        events: [{ event_type: 'general_finance_question' }],
      };
    }

    // Check if the array contains individual event objects
    if (parsed[0]?.event_type || parsed[0]?.amount || parsed[0]?.intent) {
      const normalizedEvents = parsed.map((item) => normalizeSingleEvent(item)).filter(Boolean);
      return {
        message_type: 'financial_events',
        events: normalizedEvents.length > 0 ? normalizedEvents : [{ event_type: 'general_finance_question' }],
      };
    }

    // Otherwise, take the first object
    parsed = parsed[0];
  }

  // If object has events array
  if (Array.isArray(parsed?.events)) {
    const normalized = parsed.events.map((e) => normalizeSingleEvent(e)).filter(Boolean);
    parsed.events = normalized.length > 0 ? normalized : [{ event_type: 'general_finance_question' }];
    if (normalized.length === 0) {
      parsed.message_type = 'general';
    }
    return parsed;
  }

  // If object is a single event or legacy intent object
  const singleEvent = normalizeSingleEvent(parsed);
  return {
    message_type: singleEvent.event_type === 'balance_query' ? 'query' : (parsed?.message_type || 'financial_events'),
    events: [singleEvent],
  };
}

/**
 * Normalizes a single event object, handling legacy intent names and multipliers
 */
function normalizeSingleEvent(item) {
  if (!item || typeof item !== 'object') {
    return { event_type: 'general_finance_question' };
  }

  let eventType = item.event_type || item.intent;

  // Map legacy intents
  if (eventType === 'create_expense') eventType = 'expense';
  if (eventType === 'create_income') eventType = 'income';
  if (eventType === 'edit_expense') eventType = 'edit_transaction';
  if (eventType === 'delete_expense') eventType = 'delete_transaction';
  if (eventType === 'search_expenses') eventType = 'search_transactions';
  if (eventType === 'today_expenses' || eventType === 'weekly_expenses' || eventType === 'monthly_expenses') {
    eventType = 'financial_summary';
  }

  if (!EVENT_TYPES.includes(eventType)) {
    eventType = 'general_finance_question';
  }

  // Clean and parse amount if string
  let amount = item.amount;
  if (typeof amount === 'string') {
    amount = parseNumberWithMultipliers(amount);
  }

  return {
    event_type: eventType,
    amount: typeof amount === 'number' && !isNaN(amount) ? amount : null,
    currency: item.currency || 'INR',
    description: item.description || item.note || item.source || null,
    category: item.category || null,
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
    vendor: item.vendor || null,
    date: item.date || null,
    source: item.source || item.description || null,
    transaction_id: item.transaction_id || item.expense_id || null,
    search_query: item.search_query || null,
    field: item.field || null,
    new_value: item.new_value || null,
    timeframe: item.timeframe || null,
    confirmed: item.confirmed ?? null,
    requires_confirmation: item.requires_confirmation ?? null,
    instruction: item.instruction || null,
    question: item.question || null,
  };
}

/**
 * Helper to convert strings like "15 crore", "2 lakh", "50k", "53,820" to numbers
 */
export function parseNumberWithMultipliers(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return null;

  const cleaned = val.replace(/,/g, '').trim().toLowerCase();

  // Match crore / cr
  const crMatch = cleaned.match(/^([\d.]+)\s*(?:crore|cr)\b/);
  if (crMatch) {
    return parseFloat(crMatch[1]) * 10000000;
  }

  // Match lakh / lac / lk
  const lakhMatch = cleaned.match(/^([\d.]+)\s*(?:lakh|lac|l)\b/);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * 100000;
  }

  // Match k (thousands)
  const kMatch = cleaned.match(/^([\d.]+)\s*k\b/);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export class IntentService {
  /**
   * Parse user's natural language input into structured FinancialMessage with ALL extracted events
   * @param {string} userMessage
   * @param {Array<{role: string, content: string}>} [conversationHistory=[]]
   * @returns {Promise<z.infer<typeof FinancialMessageSchema>>}
   */
  static async detectIntent(userMessage, conversationHistory = []) {
    const trimmed = userMessage.trim();

    // 1. Deterministic Destructive Pre-Check
    if (/^(confirm\s+reset|confirm\s+wipe|confirm\s+clear)$/i.test(trimmed)) {
      logger.warn(`Deterministic match: admin_reset_data confirmed for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'admin',
        events: [{ event_type: 'admin_reset_data', confirmed: true }],
      };
    }

    if (
      /\b(reset\s+all(\s+data)?|clear\s+all(\s+transactions)?|wipe(\s+all|\s+database|\s+data)?|erase\s+all(\s+records|\s+transactions)?)\b/i.test(
        trimmed
      )
    ) {
      logger.warn(`Deterministic match: admin_reset_data for destructive input "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'admin',
        events: [{ event_type: 'admin_reset_data', requires_confirmation: true }],
      };
    }

    // 2. Deterministic Balance Query
    if (
      /^(what('?s| is)\s+(our|the|my|company)?\s*(current\s+|bank\s+|cash\s+)?balance(\s+right\s+now)?\s*\??|current\s+balance(\s+right\s+now)?\s*\??|company\s+balance\s*\??|balance\s+now\s*\??|how\s+much\s+(money|cash)\s+(is\s+left|do\s+we\s+have)\s*\??|cash\s+available\s*\??|bank\s+balance\s*\??|balance\s*\??)$/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: balance_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'balance_query' }],
      };
    }

    // 3. Deterministic Company Budget Query
    if (
      /^(what('?s| is)\s+(the\s+|our\s+)?(company\s+|monthly\s+)?budget\s*\??|company\s+budget\s*\??|our\s+budget\s*\??|monthly\s+budget\s*\??|budget\s+status\s*\??|how\s+much\s+is\s+(the\s+|our\s+)?budget\s*\??)$/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: company_budget_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'company_budget_query' }],
      };
    }

    // 4. Deterministic Admin Count Query ("How many admins are there?")
    if (/\b(how many admins( are there)?|admin count|number of admins|total admins|who are the admins|list admins)\b/i.test(trimmed)) {
      logger.info(`Deterministic match: admin_count_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'admin_count_query' }],
      };
    }

    // 5. Deterministic Employee Count Query ("How many employees are there?")
    if (/\b(how many employees( are there)?|employee count|number of employees|total employees|who are the employees|list employees|how many staff)\b/i.test(trimmed)) {
      logger.info(`Deterministic match: employee_count_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'employee_count_query' }],
      };
    }

    // 6. Deterministic Top Spender Query ("Who spent the most this month?")
    if (/\b(who spent the most( this month)?|top spender|highest spender|biggest spender|who spent most|top spending employee)\b/i.test(trimmed)) {
      logger.info(`Deterministic match: top_spender_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'top_spender_query' }],
      };
    }

    // 7. Deterministic Top Department Query ("Which department spent the most?")
    if (/\b(which department spent the most|top spending department|highest spending department|which department has the highest expense)\b/i.test(trimmed)) {
      logger.info(`Deterministic match: top_department_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'top_department_query' }],
      };
    }

    // 8. Deterministic Monthly Expenses Query
    if (
      /^(what\s+are\s+(our|the)\s+monthly\s+expenses\s*\??|monthly\s+expenses?\s*\??|expenses?\s+this\s+month\s*\??|how\s+much\s+did\s+we\s+spend\s+this\s+month\s*\??|total\s+monthly\s+expenses?\s*\??|total\s+expenses?\s+this\s+month\s*\??|company\s+expenses?\s+this\s+month\s*\??)$/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: monthly_expenses_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'monthly_expenses_query' }],
      };
    }

    // 9. Deterministic Monthly Income Query
    if (
      /^(what\s+is\s+(our|the)\s+monthly\s+income\s*\??|monthly\s+income\s*\??|income\s+this\s+month\s*\??|how\s+much\s+income\s+this\s+month\s*\??|total\s+monthly\s+income\s*\??|total\s+income\s+this\s+month\s*\??|monthly\s+revenue\s*\??|revenue\s+this\s+month\s*\??)$/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: monthly_income_query for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'monthly_income_query' }],
      };
    }

    // 10. Deterministic Employee Expenses Query ("How much Anwar spent?", "How much did Raju spend?", "Anwar expenses")
    const empSpentMatch =
      trimmed.match(/^how\s+much\s+(?:did\s+|has\s+)?([a-zA-Z0-9_]+)\s+(?:spend|spent)\s*\??$/i) ||
      trimmed.match(/^expenses?\s+(?:of|for|by)\s+([a-zA-Z0-9_]+)\s*\??$/i) ||
      trimmed.match(/^([a-zA-Z0-9_]+)(?:'s)?\s+expenses?\s*\??$/i);

    if (empSpentMatch) {
      const candidate = empSpentMatch[1].trim();
      const stopWords = ['we', 'i', 'you', 'they', 'he', 'she', 'our', 'my', 'the', 'company', 'all', 'department', 'vendor', 'admin', 'admins', 'employee', 'employees', 'monthly', 'today', 'this', 'that', 'total'];
      if (!stopWords.includes(candidate.toLowerCase())) {
        logger.info(`Deterministic match: employee_expenses_query for "${trimmed}" -> employee: ${candidate}`);
        return {
          isDeterministic: true,
          message_type: 'query',
          events: [{ event_type: 'employee_expenses_query', employee_name: candidate }],
        };
      }
    }

    // 11. Deterministic Department Expenses Query
    const deptMatch =
      trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s+)?department\s+expenses?\s*\??$/i) ||
      trimmed.match(/^how\s+much\s+did\s+([a-zA-Z0-9_-]+)\s+department\s+spend\s*\??$/i) ||
      trimmed.match(/^expenses?\s+by\s+department\s*\??$/i) ||
      trimmed.match(/^department\s+spending\s*(?:breakdown)?\s*\??$/i);

    if (deptMatch) {
      const capturedDept = deptMatch[1]?.trim() || null;
      logger.info(`Deterministic match: department_expenses_query for "${trimmed}" -> dept: ${capturedDept || 'All'}`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'department_expenses_query', department: capturedDept }],
      };
    }

    // 12. Deterministic Vendor Expenses Query
    const vendorMatch =
      trimmed.match(/^vendor\s+expenses?\s*\??$/i) ||
      trimmed.match(/^expenses?\s+(?:on|for)\s+vendor\s+([a-zA-Z0-9_.-]+)\s*\??$/i) ||
      trimmed.match(/^how\s+much\s+(?:did\s+we\s+spend|spent)\s+on\s+(?:vendor\s+)?([a-zA-Z0-9_.-]+)\s*\??$/i) ||
      trimmed.match(/^([a-zA-Z0-9_.-]+)\s+vendor\s+expenses?\s*\??$/i);

    if (vendorMatch) {
      const capturedVendor = vendorMatch[1]?.trim() || null;
      const ignoredVendors = ['this', 'that', 'our', 'the', 'all', 'total', 'monthly', 'any', 'we'];
      const validVendor = capturedVendor && !ignoredVendors.includes(capturedVendor.toLowerCase()) ? capturedVendor : null;

      logger.info(`Deterministic match: vendor_expenses_query for "${trimmed}" -> vendor: ${validVendor || 'All'}`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'vendor_expenses_query', vendor: validVendor }],
      };
    }

    // 13. Deterministic Identity / User Profile Check
    if (/^(who am i|who am i to you|what is my role|what'?s my role|my role|my profile|my permissions)\s*\??$/i.test(trimmed)) {
      logger.info(`Deterministic match: user_profile for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'user_profile' }],
      };
    }

    // 14. Deterministic Admin Request / Elevation Check
    if (
      /\b(make me (an? )?admin|give me admin( access)?|need admin( access)?|who (can|has|have)( the)? ability to make me admin|who can make me admin|how to become admin|promote me|higher people|i need admin access)\b/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: role_elevation_request for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'role_elevation_request' }],
      };
    }

    // 15. Deterministic Budget Setting / Permission Check
    if (
      /\b(can i set( the)? budget|who can set( the)? budget|can i set( it)?)\b/i.test(
        trimmed
      )
    ) {
      logger.info(`Deterministic match: budget_status (permission inquiry) for "${trimmed}"`);
      return {
        isDeterministic: true,
        message_type: 'query',
        events: [{ event_type: 'budget_status' }],
      };
    }

    // 16. Deterministic Set Budget attempt
    const setBudgetMatch = trimmed.match(/\b(?:set\s+(?:the\s+)?budget\s+(?:to\s+)?|make\s+(?:the\s+)?budget\s+)(\d[\d,\s]*(?:k|lakh|crore|cr)?)\b/i);
    if (setBudgetMatch) {
      const parsedAmt = parseNumberWithMultipliers(setBudgetMatch[1]);
      if (parsedAmt && parsedAmt > 0) {
        logger.info(`Deterministic match: set_budget for "${trimmed}" -> amount: ${parsedAmt}`);
        return {
          isDeterministic: true,
          message_type: 'admin',
          events: [{ event_type: 'set_budget', amount: parsedAmt }],
        };
      }
    }

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });

    const categoriesList = [...DEFAULT_CATEGORIES, 'Fuel', 'Utilities', 'Equipment', 'Entertainment'].join(', ');

    const systemPrompt = `You are a financial event extraction engine.
Extract ALL financial events from a message.
A single message may contain multiple incomes and expenses, mixed with balance queries or questions.
Return JSON only.
Never return markdown.
Never return explanations.
Never return code blocks.
Never drop any financial event.
Every income, expense, balance request, correction, deletion request, and financial instruction must be represented in the output.

### OUTPUT FORMAT:
{
  "message_type": "financial_events",
  "events": [
    {
      "event_type": "income",
      "amount": 200000,
      "currency": "INR",
      "description": "X Project Profit"
    },
    {
      "event_type": "income",
      "amount": 50000,
      "currency": "INR",
      "description": "Client Payment"
    },
    {
      "event_type": "expense",
      "amount": 4000,
      "currency": "INR",
      "description": "Travel",
      "category": "Travel",
      "confidence": 0.95
    }
  ]
}

### CRITICAL NUMBER AND CURRENCY UNIT CONVERSIONS:
Convert all word-based numbers and multipliers into raw integer amounts:
- "crore" / "cr" = multiply number by 10,000,000.
  Example: "15 crore" -> 150000000
  Example: "1 crore" -> 10000000
  Example: "2.5 crore" -> 25000000
- "lakh" / "lac" = multiply number by 100,000.
  Example: "2 lakh" -> 200000
  Example: "1 lakh" / "1lakh" -> 100000
  Example: "1.5 lakh" -> 150000
- "k" = multiply number by 1,000.
  Example: "50k" -> 50000
  Example: "4k" -> 4000
- Numbers with commas: "53,820" -> 53820, "1,00,000" -> 100000.
NEVER extract "15 crore" as 15. It MUST be 150000000.
NEVER extract "2 lakh" as 2. It MUST be 200000.

### EVENT TYPES:
1. "income": Money received, profit, revenue, client payments, fund infusion.
   Fields: "event_type": "income", "amount": number, "currency": "INR", "description": string

2. "expense": Money spent, paid, bills, purchases, travel, petrol, supplies.
   Fields: "event_type": "expense", "amount": number, "currency": "INR", "description": string, "category": string, "confidence": number (0.0 - 1.0)

3. "balance_query": Inquiring about current balance, money left, bank balance.
   Fields: "event_type": "balance_query"

4. "financial_summary": Overall summary, runway, burn rate, monthly total.
   Fields: "event_type": "financial_summary"

5. "cashflow_report": Inflow vs outflow cash report.
   Fields: "event_type": "cashflow_report"

6. "category_report": Breakdown by category.
   Fields: "event_type": "category_report", "category": string or null

7. "employee_report": Top spenders leaderboard.
   Fields: "event_type": "employee_report"

8. "budget_status": Checking monthly budget status.
   Fields: "event_type": "budget_status"

9. "edit_transaction": Modifying previous transaction.
   Fields: "event_type": "edit_transaction", "search_query": string, "field": "amount"|"category"|"note", "new_value": value

10. "delete_transaction": Deleting a specific single transaction.
    Fields: "event_type": "delete_transaction", "search_query": string

11. "admin_reset_data": Resetting or clearing all transactions/database.
    Fields: "event_type": "admin_reset_data", "requires_confirmation": true

12. "conversation_instruction": Meta instructions to bot.
    Fields: "event_type": "conversation_instruction", "instruction": string

### BULK LIST FORMATS:
Lists like:
Tea: 100
Lunch: 300
Petrol: 500
or
Today's Expenses
Tea 100
Lunch 300
Petrol 500
Must produce 3 separate "expense" events!

### CURRENT CONTEXT:
- Date: ${currentDateStr} (${currentDayName})
- Default Categories: ${categoriesList}`;

    const messages = [{ role: 'system', content: systemPrompt }];

    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach((turn) => {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content,
        });
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const responseRaw = await executeGroqChat({
        messages,
        jsonMode: true,
        temperature: 0.1,
      });

      const normalizedJson = normalizeGroqJsonResponse(responseRaw);
      const validated = FinancialMessageSchema.parse(normalizedJson);
      logger.info(`Extracted ${validated.events.length} financial event(s) from query: "${userMessage}"`);
      return validated;
    } catch (error) {
      logger.error('Failed to parse financial events from Groq:', error);
      return {
        message_type: 'general',
        events: [{ event_type: 'general_finance_question', question: userMessage }],
      };
    }
  }
}
