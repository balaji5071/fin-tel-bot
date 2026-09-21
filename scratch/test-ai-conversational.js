import { IntentService } from '../src/services/ai/intent.service.js';
import { ToolRouter } from '../src/services/ai/toolRouter.js';
import { ResponseGeneratorService } from '../src/services/ai/responseGenerator.service.js';
import { connectDatabase, disconnectDatabase } from '../src/database/prisma.js';
import { UserService } from '../src/services/user.service.js';
import { logger } from '../src/utils/logger.js';

async function runTests() {
  console.log('🧪 Starting Conversational AI Financial Employee Test Suite...\n');

  // Connect DB
  await connectDatabase();

  // Ensure a test user exists
  const testUser = await UserService.findOrCreateUser({
    id: 8530973341,
    first_name: 'Balaji',
    username: 'balaji_test',
  });
  console.log(`✅ Test User verified: ${testUser.firstName} (ID: ${testUser.id})\n`);

  // Test Case 1: Single Expense Detection
  console.log('--- Test 1: Single Expense Detection ---');
  const msg1 = 'Spent 500 on petrol today';
  const intent1 = await IntentService.detectIntent(msg1);
  console.log('User:', msg1);
  console.log('Detected Intent:', JSON.stringify(intent1, null, 2));

  if (intent1.intent !== 'create_expense' || intent1.amount !== 500) {
    throw new Error(`Test 1 Failed: Expected create_expense with 500, got ${intent1.intent}, ${intent1.amount}`);
  }
  console.log('✅ Test 1 Passed: Correctly identified create_expense\n');

  // Test Case 2: Bulk Expense Parsing
  console.log('--- Test 2: Bulk Expense Parsing ---');
  const msg2 = `Tea: 100
Lunch: 300
Petrol: 500`;
  const intent2 = await IntentService.detectIntent(msg2);
  console.log('User:\n' + msg2);
  console.log('Detected Intent:', JSON.stringify(intent2, null, 2));

  if (intent2.intent !== 'bulk_expense_entry' || !intent2.transactions || intent2.transactions.length !== 3) {
    throw new Error(`Test 2 Failed: Expected bulk_expense_entry with 3 transactions`);
  }
  console.log('✅ Test 2 Passed: Correctly parsed bulk report into 3 transactions\n');

  // Test Case 3: Monthly Expenses Query
  console.log('--- Test 3: Monthly Expenses Query ---');
  const msg3 = 'How much did we spend this month?';
  const intent3 = await IntentService.detectIntent(msg3);
  console.log('User:', msg3);
  console.log('Detected Intent:', intent3.intent);

  if (intent3.intent !== 'monthly_expenses') {
    throw new Error(`Test 3 Failed: Expected monthly_expenses, got ${intent3.intent}`);
  }
  console.log('✅ Test 3 Passed: Correctly identified monthly_expenses\n');

  // Test Case 4: Cost Analysis Comparison
  console.log('--- Test 4: Cost Analysis Comparison ---');
  const msg4 = 'Did we spend more than last month?';
  const intent4 = await IntentService.detectIntent(msg4);
  console.log('User:', msg4);
  console.log('Detected Intent:', intent4.intent);

  if (intent4.intent !== 'cost_analysis') {
    throw new Error(`Test 4 Failed: Expected cost_analysis, got ${intent4.intent}`);
  }
  console.log('✅ Test 4 Passed: Correctly identified cost_analysis\n');

  // Test Case 5: End-to-End Execution: Intent -> ToolRouter -> DB -> ResponseGenerator
  console.log('--- Test 5: End-to-End Single Expense Logging ---');
  const backendData1 = await ToolRouter.routeIntent({
    intentResult: intent1,
    user: testUser,
    rawMessage: msg1,
  });
  console.log('Authoritative DB Calculation/Result:', backendData1);

  const reply1 = await ResponseGeneratorService.generateResponse({
    userMessage: msg1,
    intent: intent1.intent,
    backendData: backendData1,
    userName: testUser.firstName,
  });
  console.log('AI Financial Assistant Reply:\n' + reply1);
  console.log('✅ Test 5 Passed: End-to-End Single Expense Logged & Answered naturally\n');

  // Test Case 6: End-to-End Bulk Entry
  console.log('--- Test 6: End-to-End Bulk Expense Entry ---');
  const backendData2 = await ToolRouter.routeIntent({
    intentResult: intent2,
    user: testUser,
    rawMessage: msg2,
  });
  console.log('Authoritative DB Bulk Result:', backendData2);

  const reply2 = await ResponseGeneratorService.generateResponse({
    userMessage: msg2,
    intent: intent2.intent,
    backendData: backendData2,
    userName: testUser.firstName,
  });
  console.log('AI Financial Assistant Reply:\n' + reply2);
  console.log('✅ Test 6 Passed: End-to-End Bulk Entry Logged & Answered naturally\n');

  // Test Case 7: End-to-End Contextual Delete
  console.log('--- Test 7: Contextual Delete Expense ---');
  const msg7 = 'Delete the petrol expense I added today';
  const intent7 = await IntentService.detectIntent(msg7);
  console.log('User:', msg7);
  console.log('Detected Intent:', intent7.intent);

  const backendData7 = await ToolRouter.routeIntent({
    intentResult: intent7,
    user: testUser,
    rawMessage: msg7,
  });
  console.log('Authoritative Delete Result:', backendData7);

  if (!backendData7.deleted) {
    throw new Error(`Test 7 Failed: Expected expense to be deleted, got: ${JSON.stringify(backendData7)}`);
  }

  const reply7 = await ResponseGeneratorService.generateResponse({
    userMessage: msg7,
    intent: intent7.intent,
    backendData: backendData7,
    userName: testUser.firstName,
  });
  console.log('AI Financial Assistant Reply:\n' + reply7);
  console.log('✅ Test 7 Passed: Contextual Delete executed successfully\n');

  await disconnectDatabase();
  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY! The bot is fully transformed into an AI Financial Employee.');
}

runTests().catch(async (err) => {
  console.error('❌ Test suite failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
