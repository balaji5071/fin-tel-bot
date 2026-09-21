import { IntentService } from '../src/services/ai/intent.service.js';
import { MultiEventProcessor } from '../src/services/ai/multiEventProcessor.js';
import { ResponseGeneratorService } from '../src/services/ai/responseGenerator.service.js';
import prisma from '../src/database/prisma.js';

async function runTests() {
  console.log('====================================================');
  console.log('Testing Company Finance & Organization Deterministic Routing');
  console.log('====================================================\n');

  // Fetch a test user (e.g. Balaji or Raju)
  const testUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!testUser) {
    console.error('No test user found in DB');
    process.exit(1);
  }

  const queries = [
    { name: '1. Employee Expenses (Non-existent: Anwar)', text: 'How much Anwar spent?' },
    { name: '2. Employee Expenses (Existing: Raju)', text: 'How much did Raju spend?' },
    { name: '3. Admin Count', text: 'How many admins are there?' },
    { name: '4. Employee Count', text: 'How many employees are there?' },
    { name: '5. Top Spender This Month', text: 'Who spent the most this month?' },
    { name: '6. Top Department This Month', text: 'Which department spent the most?' },
    { name: '7. Company Budget', text: 'What is the company budget?' },
    { name: '8. Current Balance', text: 'What is the current balance right now?' },
    { name: '9. Monthly Expenses', text: 'Monthly expenses' },
    { name: '10. Monthly Income', text: 'Monthly income' },
    { name: '11. Department Expenses', text: 'Department expenses' },
    { name: '12. Vendor Expenses', text: 'Vendor expenses' },
  ];

  let passed = 0;
  let failed = 0;

  for (const q of queries) {
    console.log(`\n--- [TEST] ${q.name} ---`);
    console.log(`Query: "${q.text}"`);

    const start = performance.now();

    // Step 1: Detect intent
    const intentRes = await IntentService.detectIntent(q.text);
    const intentTime = (performance.now() - start).toFixed(2);

    if (!intentRes.isDeterministic) {
      console.error(`❌ FAILED: Query was NOT matched deterministically! Got:`, intentRes);
      failed++;
      continue;
    }

    console.log(`✅ Deterministic Match in ${intentTime}ms: event_type = "${intentRes.events[0].event_type}"`);

    // Step 2: Multi-event processing
    const procStart = performance.now();
    const backendData = await MultiEventProcessor.processEvents({
      financialMessage: intentRes,
      user: testUser,
      rawMessage: q.text,
    });
    const procTime = (performance.now() - procStart).toFixed(2);

    // Step 3: Response generator
    const genStart = performance.now();
    const response = await ResponseGeneratorService.generateResponse({
      userMessage: q.text,
      intent: intentRes.message_type,
      backendData,
      userName: testUser.firstName,
      user: testUser,
    });
    const genTime = (performance.now() - genStart).toFixed(2);
    const totalTime = (performance.now() - start).toFixed(2);

    console.log(`Response Time: total=${totalTime}ms (intent=${intentTime}ms, db=${procTime}ms, format=${genTime}ms)`);
    console.log(`Response Output:\n${response}\n`);

    // Verification assertions:
    // 1. Must not contain dollar sign ($)
    if (response.includes('$')) {
      console.error(`❌ FAILED: Response contains dollar sign ($)!`);
      failed++;
      continue;
    }

    // 2. Must be non-empty string
    if (!response || response.trim().length === 0) {
      console.error(`❌ FAILED: Response is empty!`);
      failed++;
      continue;
    }

    console.log(`✅ PASS: ${q.name}`);
    passed++;
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed}/${queries.length} PASSED (${failed} failed)`);
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
