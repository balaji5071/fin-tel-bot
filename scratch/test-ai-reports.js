import { IntentService } from '../src/services/ai/intent.service.js';
import { ToolRouter } from '../src/services/ai/toolRouter.js';
import { ResponseGeneratorService } from '../src/services/ai/responseGenerator.service.js';
import { connectDatabase, disconnectDatabase } from '../src/database/prisma.js';
import { UserService } from '../src/services/user.service.js';

async function runReportTests() {
  console.log('🧪 Starting Advanced AI Financial Intents Test Suite...\n');
  await connectDatabase();

  const testUser = await UserService.findOrCreateUser({
    id: 8530973341,
    first_name: 'Balaji',
    username: 'balaji_test',
  });

  // Test 1: create_income
  console.log('--- Test 1: Record Income ---');
  const msg1 = 'Received 50000 from client consulting';
  const intent1 = await IntentService.detectIntent(msg1);
  console.log('Detected Intent:', intent1.intent, 'Amount:', intent1.amount);
  const result1 = await ToolRouter.routeIntent({ intentResult: intent1, user: testUser, rawMessage: msg1 });
  const reply1 = await ResponseGeneratorService.generateResponse({
    userMessage: msg1,
    intent: intent1.intent,
    backendData: result1,
    userName: testUser.firstName,
  });
  console.log('Assistant Reply:\n' + reply1 + '\n');

  // Test 2: cashflow_report
  console.log('--- Test 2: Cashflow Report ---');
  const msg2 = 'Show cashflow overview';
  const intent2 = await IntentService.detectIntent(msg2);
  console.log('Detected Intent:', intent2.intent);
  const result2 = await ToolRouter.routeIntent({ intentResult: intent2, user: testUser, rawMessage: msg2 });
  console.log('Backend Data:', result2);
  const reply2 = await ResponseGeneratorService.generateResponse({
    userMessage: msg2,
    intent: intent2.intent,
    backendData: result2,
    userName: testUser.firstName,
  });
  console.log('Assistant Reply:\n' + reply2 + '\n');

  // Test 3: budget_status
  console.log('--- Test 3: Budget Status ---');
  const msg3 = 'What is our budget status?';
  const intent3 = await IntentService.detectIntent(msg3);
  console.log('Detected Intent:', intent3.intent);
  const result3 = await ToolRouter.routeIntent({ intentResult: intent3, user: testUser, rawMessage: msg3 });
  const reply3 = await ResponseGeneratorService.generateResponse({
    userMessage: msg3,
    intent: intent3.intent,
    backendData: result3,
    userName: testUser.firstName,
  });
  console.log('Assistant Reply:\n' + reply3 + '\n');

  // Test 4: financial_summary
  console.log('--- Test 4: Financial Summary & Runway ---');
  const msg4 = 'Give me a financial summary with burn rate and runway';
  const intent4 = await IntentService.detectIntent(msg4);
  console.log('Detected Intent:', intent4.intent);
  const result4 = await ToolRouter.routeIntent({ intentResult: intent4, user: testUser, rawMessage: msg4 });
  const reply4 = await ResponseGeneratorService.generateResponse({
    userMessage: msg4,
    intent: intent4.intent,
    backendData: result4,
    userName: testUser.firstName,
  });
  console.log('Assistant Reply:\n' + reply4 + '\n');

  await disconnectDatabase();
  console.log('🎉 Advanced reports & actions test suite passed cleanly!');
}

runReportTests().catch(async (e) => {
  console.error('❌ Advanced test failed:', e);
  await disconnectDatabase();
  process.exit(1);
});
