/**
 * Unit Test: Sustained Presence Temporal Filtering (Scenario 1)
 */

const assert = require('assert');

function runTest() {
  console.log('--- Testing Sustained Presence Temporal Filter ---');

  // Simple pure JS reference of Sustained Presence Filter
  class TestPresenceFilter {
    constructor(windowSeconds = 10, threshold = 0.6, minSustained = 4) {
      this.windowSeconds = windowSeconds;
      this.threshold = threshold;
      this.minSustained = minSustained;
      this.history = new Map();
    }

    update(activeIds, t) {
      for (const id of activeIds) {
        if (!this.history.has(id)) {
          this.history.set(id, { id, firstSeen: t, sustained: 0, timeline: [] });
        }
        const rec = this.history.get(id);
        rec.sustained += 1;
        rec.timeline.push({ t, present: 1 });
      }

      const results = {};
      for (const [id, rec] of this.history.entries()) {
        if (!activeIds.includes(id)) {
          rec.timeline.push({ t, present: 0 });
        }
        rec.timeline = rec.timeline.filter(item => item.t >= t - this.windowSeconds);
        const presentCount = rec.timeline.reduce((s, it) => s + it.present, 0);
        const ratio = presentCount / rec.timeline.length;

        let status = 'EVALUATING';
        if (rec.sustained < this.minSustained) {
          status = 'FILTERED (Transitory)';
        } else if (ratio >= this.threshold) {
          status = 'PRESENT [Sustained]';
        }
        results[id] = { status, sustained: rec.sustained, ratio };
      }
      return results;
    }
  }

  const filter = new TestPresenceFilter(10, 0.6, 5);

  // Student A attends continuously for 8 seconds
  let res;
  for (let t = 0; t < 8; t++) {
    res = filter.update(['STU_A'], t);
  }
  assert.strictEqual(res['STU_A'].status, 'PRESENT [Sustained]', 'Student A must be sustained present');

  // Visitor B appears for only 2 seconds and leaves
  for (let t = 8; t < 10; t++) {
    res = filter.update(['STU_A', 'VISITOR_B'], t);
  }
  for (let t = 10; t < 16; t++) {
    res = filter.update(['STU_A'], t);
  }

  assert.strictEqual(res['VISITOR_B'].status, 'FILTERED (Transitory)', 'Transitory visitor must be rejected');
  assert.strictEqual(res['STU_A'].status, 'PRESENT [Sustained]', 'Student A must remain sustained');

  console.log('✓ Scenario 1 Sustained Presence & False-Positive Rejection verified.');
}

module.exports = runTest;
if (require.main === module) runTest();
