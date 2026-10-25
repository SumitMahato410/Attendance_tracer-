/**
 * Master Test Runner for Multimodal Classroom Intelligence System
 */

const testPresence = require('./test_sustained_presence');
const testFusion = require('./test_fusion_metrics');
const testReasoner = require('./test_agent_reasoner');

console.log('====================================================');
console.log('  RUNNING MULTIMODAL CLASSROOM AGENT TEST SUITE');
console.log('====================================================\n');

try {
  testPresence();
  testFusion();
  testReasoner();

  console.log('\n====================================================');
  console.log('  ALL SUITES PASSED (3/3): SYSTEM VERIFIED OPERATIONAL');
  console.log('====================================================\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
}
