/**
 * Unit Test: Multimodal Engagement Score (MES) & Dynamics (Scenario 2)
 */

const assert = require('assert');

function runTest() {
  console.log('--- Testing Multimodal Engagement Fusion (MES) ---');

  function calculateMes(gaze, posture, audio, inactivitySec) {
    const wGaze = 0.50;
    const wPosture = 0.30;
    const wAudio = 0.20;
    const wPenalty = 0.15;

    let penalty = 0;
    if (inactivitySec > 60) {
      penalty = Math.min(100, ((inactivitySec - 60) / 120) * 100);
    }

    const raw = gaze * wGaze + posture * wPosture + audio * wAudio - penalty * wPenalty;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  // 1. Highly attentive note-taker
  const highAttn = calculateMes(90, 95, 80, 0);
  assert(highAttn >= 85, `Expected high attention score >= 85, got ${highAttn}`);

  // 2. Distracted phone user with inactivity
  const lowAttn = calculateMes(25, 40, 50, 180);
  assert(lowAttn < 40, `Expected low attention score < 40, got ${lowAttn}`);

  console.log(`✓ Scenario 2 MES Calculation validated (High: ${highAttn}%, Low: ${lowAttn}%).`);
}

module.exports = runTest;
if (require.main === module) runTest();
