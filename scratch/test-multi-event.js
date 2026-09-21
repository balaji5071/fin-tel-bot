import { IntentService } from '../src/services/ai/intent.service.js';
import { MultiEventProcessor } from '../src/services/ai/multiEventProcessor.js';
import { ResponseGeneratorService } from '../src/services/ai/responseGenerator.service.js';
import { BalanceService } from '../src/services/balance.service.js';
import { connectDatabase, disconnectDatabase } from '../src/database/prisma.js';
import { UserService } from '../src/services/user.service.js';

async function runMultiEventTests() {
  console.log('🧪 Starting Multi-Event Financial Extraction Engine Test Suite...\n');
  await connectDatabase();

  const user = await UserService.findOrCreateUser({
    id: 8530973341,
    first_name: 'Balaji',
    username: 'balaji_test',
  });
  user.role = 'SUPER_ADMIN';

  // Clean slate before testing
  await BalanceService.resetAllFinancialData(user);

  // =========================================================================
  // TEST 1: Multi-event mixed income & expense from real user message
  // =========================================================================
  console.log('--- Test 1: Mixed Multi-Event Extraction & Processing ---');
  const msg1 = '2 lakh profit from x project and we got 50000 from client, 4000 for traveling.';
  console.log('User input:\n"' + msg1 + '"');

  const extracted1 = await IntentService.detectIntent(msg1);
  console.log('Extracted Financial Events:\n', JSON.stringify(extracted1, null, 2));

  if (extracted1.events.length < 3) {
    throw new Error(`Test 1 Failed: Expected at least 3 events, got ${extracted1.events.length}`);
  }

  const incomes1 = extracted1.events.filter((e) => e.event_type === 'income');
  const expenses1 = extracted1.events.filter((e) => e.event_type === 'expense');

  if (incomes1.length !== 2 || expenses1.length !== 1) {
    throw new Error(`Test 1 Failed: Expected 2 incomes and 1 expense. Got ${incomes1.length} incomes, ${expenses1.length} expenses`);
  }

  // Verify amounts: 200,000, 50,000, 4,000
  const incomeAmounts = incomes1.map((i) => i.amount).sort((a, b) => b - a);
  if (incomeAmounts[0] !== 200000 || incomeAmounts[1] !== 50000) {
    throw new Error(`Test 1 Failed: Expected incomes 200,000 and 50,000, got ${incomeAmounts}`);
  }
  if (expenses1[0].amount !== 4000) {
    throw new Error(`Test 1 Failed: Expected expense 4,000, got ${expenses1[0].amount}`);
  }

  // Process through MultiEventProcessor
  const result1 = await MultiEventProcessor.processEvents({
    financialMessage: extracted1,
    user,
    rawMessage: msg1,
  });
  console.log('Processor Result:', {
    inflow: result1.totalInflow,
    outflow: result1.totalOutflow,
    netImpact: result1.netImpact,
  });

  if (result1.totalInflow !== 250000 || result1.totalOutflow !== 4000 || result1.netImpact !== 246000) {
    throw new Error(`Test 1 Failed: Incorrect net calculation: +₹2,46,000 expected, got ${result1.netImpact}`);
  }

  const reply1 = await ResponseGeneratorService.generateResponse({
    userMessage: msg1,
    backendData: result1,
    userName: user.firstName,
  });
  console.log('AI Financial Employee Reply:\n' + reply1 + '\n');
  console.log('✅ Test 1 Passed: Multi-event income and expense accurately extracted and committed.\n');

  // =========================================================================
  // TEST 2: Indian Multiplier parsing (Crore, Lakh, Formatted)
  // =========================================================================
  console.log('--- Test 2: Unit Multipliers (Crore, Lakh, Formatted) ---');
  // 15 crore test
  const msgCr = 'We got 15 crore from the client';
  const extractedCr = await IntentService.detectIntent(msgCr);
  console.log('Query:', msgCr);
  console.log('Extracted Amount for 15 crore:', extractedCr.events[0]?.amount);
  if (extractedCr.events[0]?.amount !== 150000000) {
    throw new Error(`Test 2a Failed: Expected 150000000 for "15 crore", got ${extractedCr.events[0]?.amount}`);
  }

  // 1lakh for laptop test
  const msgLk = '1lakh for laptop';
  const extractedLk = await IntentService.detectIntent(msgLk);
  console.log('Query:', msgLk);
  console.log('Extracted Amount for 1lakh:', extractedLk.events[0]?.amount);
  if (extractedLk.events[0]?.amount !== 100000) {
    throw new Error(`Test 2b Failed: Expected 100000 for "1lakh", got ${extractedLk.events[0]?.amount}`);
  }

  // 53,820 for mobile test
  const msgFmt = '53,820 for mobile';
  const extractedFmt = await IntentService.detectIntent(msgFmt);
  console.log('Query:', msgFmt);
  console.log('Extracted Amount for 53,820:', extractedFmt.events[0]?.amount);
  if (extractedFmt.events[0]?.amount !== 53820) {
    throw new Error(`Test 2c Failed: Expected 53820 for "53,820", got ${extractedFmt.events[0]?.amount}`);
  }
  console.log('✅ Test 2 Passed: All currency multipliers and commas parsed accurately.\n');

  // =========================================================================
  // TEST 3: Multi-expense + income message
  // =========================================================================
  console.log('--- Test 3: Multiple Expenses & Income in One Message ---');
  const msg3 = 'Paid 500 petrol, 200 tea and got 10000 from client.';
  const extracted3 = await IntentService.detectIntent(msg3);
  console.log('Query:', msg3);
  console.log('Extracted Events Count:', extracted3.events.length);
  if (extracted3.events.length !== 3) {
    throw new Error(`Test 3 Failed: Expected 3 events, got ${extracted3.events.length}`);
  }

  const result3 = await MultiEventProcessor.processEvents({
    financialMessage: extracted3,
    user,
    rawMessage: msg3,
  });
  console.log('Net Impact:', result3.netImpact); // 10000 - 700 = 9300
  if (result3.netImpact !== 9300) {
    throw new Error(`Test 3 Failed: Expected net impact 9300, got ${result3.netImpact}`);
  }
  console.log('✅ Test 3 Passed: Multi-expense + income calculated correctly.\n');

  // =========================================================================
  // TEST 4: Balance queries consistency
  // =========================================================================
  console.log('--- Test 4: Balance Query ---');
  const bMsg = 'balance';
  const bExtracted = await IntentService.detectIntent(bMsg);
  console.log('Query: "balance" -> Event Type:', bExtracted.events[0]?.event_type);
  if (bExtracted.events[0]?.event_type !== 'balance_query') {
    throw new Error(`Test 4 Failed: Expected balance_query, got ${bExtracted.events[0]?.event_type}`);
  }

  const bResult = await MultiEventProcessor.processEvents({
    financialMessage: bExtracted,
    user,
    rawMessage: bMsg,
  });
  console.log('Calculated Balance:', bResult.queryResults?.balance?.currentBalance);

  const bReply = await ResponseGeneratorService.generateResponse({
    userMessage: bMsg,
    backendData: bResult.queryResults.balance,
    userName: user.firstName,
  });
  console.log('AI Reply:\n' + bReply + '\n');
  console.log('✅ Test 4 Passed: Balance query functions seamlessly.\n');

  // =========================================================================
  // TEST 5: Bulk multi-line expenses
  // =========================================================================
  console.log('--- Test 5: Bulk Multi-line Expenses ---');
  const bulkMsg = `Tea: 100
Lunch: 300
Petrol: 500`;
  const bulkExtracted = await IntentService.detectIntent(bulkMsg);
  console.log('Bulk extracted events:', bulkExtracted.events.length);
  if (bulkExtracted.events.length !== 3) {
    throw new Error(`Test 5 Failed: Expected 3 bulk events, got ${bulkExtracted.events.length}`);
  }
  console.log('✅ Test 5 Passed: Bulk report parsed cleanly.\n');

  // =========================================================================
  // TEST 6: Destructive action protection
  // =========================================================================
  console.log('--- Test 6: Destructive Action Confirmation Protection ---');
  const resetMsg = 'Clear all transactions. Reset database.';
  const resetExtracted = await IntentService.detectIntent(resetMsg);
  console.log('Destructive Event Type:', resetExtracted.events[0]?.event_type);
  if (resetExtracted.events[0]?.event_type !== 'admin_reset_data') {
    throw new Error(`Test 6 Failed: Expected admin_reset_data, got ${resetExtracted.events[0]?.event_type}`);
  }

  const resetResult = await MultiEventProcessor.processEvents({
    financialMessage: resetExtracted,
    user,
    rawMessage: resetMsg,
  });
  console.log('Requires Confirmation:', resetResult.requiresConfirmation);
  if (!resetResult.requiresConfirmation) {
    throw new Error('Test 6 Failed: Reset executed without confirmation!');
  }
  console.log('✅ Test 6 Passed: Destructive reset successfully protected.\n');

  await disconnectDatabase();
  console.log('🎉 ALL MULTI-EVENT ENGINE TESTS PASSED WITHOUT ERRORS!');
}

runMultiEventTests().catch(async (e) => {
  console.error('❌ Multi-event test suite failed:', e);
  await disconnectDatabase();
  process.exit(1);
});
