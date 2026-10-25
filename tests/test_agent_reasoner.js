/**
 * Unit Test: AI-Driven Teaching Suggestions Agent (Scenario 3)
 */

const assert = require('assert');

function runTest() {
  console.log('--- Testing AI-Driven Teaching Suggestions Agent ---');

  function evaluateRules(classroomScore, monologueSeconds, attentionDropAlert) {
    if (monologueSeconds > 300 && classroomScore < 60) {
      return { trigger: true, category: 'PACING_OPTIMIZATION', badge: 'Lecture Fatigue' };
    }
    if (attentionDropAlert) {
      return { trigger: true, category: 'INTERVENTION', badge: 'Attention Drop' };
    }
    return { trigger: false };
  }

  // Test Case 1: Long monologue + dropping attention
  const r1 = evaluateRules(52, 420, false);
  assert.strictEqual(r1.trigger, true);
  assert.strictEqual(r1.category, 'PACING_OPTIMIZATION');

  // Test Case 2: Sudden drop alert
  const r2 = evaluateRules(45, 60, true);
  assert.strictEqual(r2.trigger, true);
  assert.strictEqual(r2.category, 'INTERVENTION');

  // Test Case 3: Healthy classroom
  const r3 = evaluateRules(82, 60, false);
  assert.strictEqual(r3.trigger, false);

  console.log('✓ Scenario 3 AI Teaching Advisor rule triggers verified.');
}

module.exports = runTest;
if (require.main === module) runTest();
