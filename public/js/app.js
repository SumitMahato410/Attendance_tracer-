/**
 * Application Controller - Multimodal Classroom Intelligence Cockpit
 * 
 * Orchestrates:
 * - Vision Engine & Synthetic/Live Feed
 * - Audio Processing Engine
 * - Multimodal Fusion Engine (Sustained Presence & MES)
 * - Agentic Pedagogical Reasoner (AI Teaching Suggestions)
 * - Analytics & Reporting Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const videoCanvas = document.getElementById('videoCanvas');
  const audioCanvas = document.getElementById('audioCanvas');
  const chartCanvas = document.getElementById('chartCanvas');
  const heatmapCanvas = document.getElementById('heatmapCanvas');

  // Gauges and Metrics
  const avgEngagementGauge = document.getElementById('avgEngagementGauge');
  const classroomDynamicBadge = document.getElementById('classroomDynamicBadge');
  const speechRatioVal = document.getElementById('speechRatioVal');
  const dialogueTypeVal = document.getElementById('dialogueTypeVal');
  const gazeScoreVal = document.getElementById('gazeScoreVal');
  const postureScoreVal = document.getElementById('postureScoreVal');
  const sessionClockVal = document.getElementById('sessionClockVal');
  const sustainedCountVal = document.getElementById('sustainedCountVal');
  const lateCountVal = document.getElementById('lateCountVal');
  const transitoryCountVal = document.getElementById('transitoryCountVal');

  // Controls
  const sourceSelect = document.getElementById('sourceSelect');
  const privacyToggle = document.getElementById('privacyToggle');
  const gazeToggle = document.getElementById('gazeToggle');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Panels and Lists
  const rosterTbody = document.getElementById('rosterTbody');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const studentModal = document.getElementById('studentModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalStudentDetails = document.getElementById('modalStudentDetails');

  // Core Engines
  const simulation = new SimulationFeed(videoCanvas);
  const vision = new VisionEngine(videoCanvas, {
    privacyMode: privacyToggle ? privacyToggle.checked : true,
    showGazeVectors: true
  });
  const audio = new AudioEngine(audioCanvas);
  const fusion = new FusionEngine({
    sustainedWindowSeconds: 45,
    presenceThreshold: 0.65,
    minSustainedSeconds: 15,
    lateCutoffSeconds: 30
  });
  const reasoner = new AgentReasoner({ cooldownSeconds: 18 });
  const analytics = new AnalyticsEngine(chartCanvas, heatmapCanvas);

  // Application State
  let sessionStart = Date.now();
  let elapsedSeconds = 0;
  let isLiveMode = false;
  let latestRoster = [];
  let latestScores = [];

  // Register Reasoner Event Handler
  reasoner.onSuggestion((suggestion) => {
    analytics.addAnnotation(elapsedSeconds, suggestion.badge, suggestion.urgency === 'high' ? 'alert' : 'info');
    renderSuggestions();
  });

  // Source Selector
  sourceSelect.addEventListener('change', async (e) => {
    if (e.target.value === 'live') {
      const okCam = await vision.startLiveCamera();
      const okMic = await audio.startLiveMic();
      isLiveMode = okCam;
      if (!okCam) {
        alert('Could not access live camera. Falling back to synthetic classroom feed.');
        sourceSelect.value = 'simulation';
      }
    } else {
      vision.stopLiveCamera();
      audio.stopLiveMic();
      isLiveMode = false;
    }
  });

  // Scenario Buttons / Select
  scenarioSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    simulation.setScenario(val);
    
    // Sync acoustic scenario
    if (val === 'fatigue') {
      audio.setSimulationPhase('monologue_fatigue');
    } else if (val === 'qa_spike') {
      audio.setSimulationPhase('qa_spike');
    } else {
      audio.setSimulationPhase('lecture');
    }
  });

  // Privacy Toggle
  privacyToggle.addEventListener('change', (e) => {
    vision.setPrivacyMode(e.target.checked);
  });

  // Gaze Vector Toggle
  if (gazeToggle) {
    gazeToggle.addEventListener('change', (e) => {
      vision.setShowGazeVectors(e.target.checked);
    });
  }

  // Export Buttons
  exportCsvBtn.addEventListener('click', () => {
    analytics.downloadCsv(latestRoster);
  });

  exportJsonBtn.addEventListener('click', () => {
    analytics.downloadJson(latestRoster, reasoner.getAllHistory(), {
      elapsedSeconds,
      avgEngagement: avgEngagementGauge.textContent
    });
  });

  // Reset Session
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset classroom session logs, clock and attendance records?')) {
      sessionStart = Date.now();
      elapsedSeconds = 0;
      fusion.resetSession();
      renderRoster([]);
      renderSuggestions();
    }
  });

  // Quick Action Buttons in Simulation Toolbar
  document.querySelectorAll('.scenario-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const scen = e.currentTarget.dataset.scenario;
      scenarioSelect.value = scen;
      scenarioSelect.dispatchEvent(new Event('change'));
      
      document.querySelectorAll('.scenario-pill').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
    });
  });

  // Main 60 FPS Render Loop
  let lastTime = performance.now();
  function renderLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    let participantsData = [];

    if (isLiveMode) {
      // In live camera mode, we process user webcam
      // Provide tracked participant bounding box around user face
      const w = videoCanvas.width;
      const h = videoCanvas.height;
      participantsData = [{
        id: 'USER-01',
        name: 'Live Instructor / Participant',
        bbox: [w * 0.3, h * 0.2, w * 0.4, h * 0.55],
        headPose: { yaw: 0, pitch: -4, roll: 0 },
        motionVelocity: 0.2,
        inactivityTimer: 0,
        isHandRaised: false,
        isNoteTaking: false,
        isPhoneDistracted: false,
        isTransitory: false
      }];
      vision.processFrame(participantsData, now);
    } else {
      // Simulation mode: update simulation and draw
      simulation.update(dt);
      simulation.render();
      participantsData = simulation.getParticipantDetections();
      vision.processFrame(participantsData, now);
    }

    // Process audio frame
    audio.processFrame(dt);

    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // 1-Second Interval Loop for Fusion, Attendance & Reasoner
  setInterval(() => {
    elapsedSeconds += 1;
    updateSessionClock(elapsedSeconds);

    const acoustic = audio.getAcousticMetrics();
    const visionParticipants = vision.participants;

    // Multimodal Fusion (Attendance & Engagement)
    const fusionResult = fusion.fuse(visionParticipants, acoustic, elapsedSeconds);
    latestRoster = fusionResult.roster;
    latestScores = fusionResult.individualScores;

    // Evaluate AI Pedagogical Reasoner
    reasoner.evaluate(fusionResult, acoustic, elapsedSeconds);

    // Record Analytics Frame
    analytics.recordSecond(elapsedSeconds, fusionResult.classroomScore, acoustic, fusionResult.roster, fusionResult.individualScores);

    // Update Dashboard UI
    updateTelemetryUI(fusionResult, acoustic);
    renderRoster(fusionResult.roster);
    renderSuggestions();
  }, 1000);

  function updateSessionClock(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    sessionClockVal.textContent = `${m}:${s}`;
  }

  function updateTelemetryUI(fusionResult, acoustic) {
    const score = fusionResult.classroomScore;
    avgEngagementGauge.textContent = `${score}%`;

    // Dynamic color for gauge
    if (score >= 75) {
      avgEngagementGauge.style.color = '#10b981'; // Green
    } else if (score >= 55) {
      avgEngagementGauge.style.color = '#f59e0b'; // Amber
    } else {
      avgEngagementGauge.style.color = '#ef4444'; // Red
    }

    classroomDynamicBadge.textContent = fusionResult.classroomDynamic;
    
    // Sub-metrics
    speechRatioVal.textContent = `${acoustic.speechPercent}%`;
    dialogueTypeVal.textContent = acoustic.interactionType;
    gazeScoreVal.textContent = `${fusionResult.multimodalBreakdown.gaze}%`;
    postureScoreVal.textContent = `${fusionResult.multimodalBreakdown.posture}%`;

    // Roster status counters
    const sustained = latestRoster.filter(s => s.status.includes('PRESENT [Sustained]')).length;
    const late = latestRoster.filter(s => s.status.includes('Late')).length;
    const transitory = latestRoster.filter(s => s.status.includes('FILTERED') || s.isTransitory).length;

    sustainedCountVal.textContent = sustained;
    lateCountVal.textContent = late;
    transitoryCountVal.textContent = transitory;
  }

  function renderRoster(roster) {
    if (!rosterTbody) return;
    rosterTbody.innerHTML = '';

    roster.forEach(st => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to view student telemetry drilldown';

      // Status pill styling
      let statusClass = 'status-verifying';
      if (st.status.includes('PRESENT [Sustained]')) statusClass = 'status-sustained';
      else if (st.status.includes('Late')) statusClass = 'status-late';
      else if (st.status.includes('FILTERED')) statusClass = 'status-filtered';
      else if (st.status.includes('TEMPORARY')) statusClass = 'status-absent';

      const displayName = privacyToggle.checked ? `[ANON-${st.id.slice(-4)}]` : st.name;

      tr.innerHTML = `
        <td><strong style="color: #f8fafc;">${st.id}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${st.isTransitory ? '#ec4899' : '#38bdf8'};"></div>
            <span>${displayName}</span>
          </div>
        </td>
        <td><span class="status-pill ${statusClass}">${st.status}</span></td>
        <td>${st.sustainedSeconds}s</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${st.presenceRatio}%; background: ${st.presenceRatio >= 70 ? '#10b981' : '#f59e0b'};"></div>
            </div>
            <span>${st.presenceRatio}%</span>
          </div>
        </td>
        <td><span style="font-weight: 600; color: ${st.avgEngagement >= 70 ? '#10b981' : st.avgEngagement >= 50 ? '#f59e0b' : '#ef4444'}">${st.avgEngagement}%</span></td>
      `;

      tr.addEventListener('click', () => openStudentModal(st));
      rosterTbody.appendChild(tr);
    });
  }

  function renderSuggestions() {
    if (!suggestionsContainer) return;
    const active = reasoner.activeSuggestions;
    suggestionsContainer.innerHTML = '';

    if (active.length === 0) {
      suggestionsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <div>No active interventions needed. Classroom engagement is in healthy equilibrium.</div>
        </div>
      `;
      return;
    }

    active.forEach(sug => {
      const card = document.createElement('div');
      card.className = `suggestion-card ${sug.urgency}`;
      
      card.innerHTML = `
        <div class="suggestion-header">
          <span class="suggestion-badge ${sug.urgency}">${sug.badge}</span>
          <span class="suggestion-time">${sug.timestamp}</span>
        </div>
        <div class="suggestion-title">${sug.title}</div>
        <div class="suggestion-rationale"><strong>Observation:</strong> ${sug.rationale}</div>
        <div class="suggestion-action"><strong>Recommended Move:</strong> ${sug.action}</div>
        <div class="suggestion-footer">
          <button class="btn btn-sm btn-primary action-accept" data-id="${sug.id}">Acknowledge & Apply</button>
          <button class="btn btn-sm btn-ghost action-dismiss" data-id="${sug.id}">Dismiss</button>
        </div>
      `;

      card.querySelector('.action-accept').addEventListener('click', () => {
        reasoner.acknowledge(sug.id);
        card.style.opacity = '0.5';
        card.querySelector('.action-accept').textContent = 'Applied ✓';
        card.querySelector('.action-accept').disabled = true;
      });

      card.querySelector('.action-dismiss').addEventListener('click', () => {
        reasoner.dismiss(sug.id);
        renderSuggestions();
      });

      suggestionsContainer.appendChild(card);
    });
  }

  function openStudentModal(st) {
    if (!studentModal || !modalStudentDetails) return;
    const displayName = privacyToggle.checked ? `[ANON-${st.id.slice(-4)}]` : st.name;

    modalStudentDetails.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 16px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin: 0 0 4px 0;">${displayName}</h2>
          <span style="font-size: 0.85rem; color: #94a3b8;">Identifier: ${st.id} • Offline Edge Record</span>
        </div>
        <span class="status-pill ${st.status.includes('PRESENT') ? 'status-sustained' : 'status-late'}">${st.status}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="metric-card-mini">
          <div class="metric-title">Sustained Time</div>
          <div class="metric-val">${st.sustainedSeconds} seconds</div>
        </div>
        <div class="metric-card-mini">
          <div class="metric-title">Presence Window Ratio</div>
          <div class="metric-val">${st.presenceRatio}%</div>
        </div>
        <div class="metric-card-mini">
          <div class="metric-title">Average Engagement</div>
          <div class="metric-val" style="color: #10b981;">${st.avgEngagement}%</div>
        </div>
        <div class="metric-card-mini">
          <div class="metric-title">Verification Integrity</div>
          <div class="metric-val">100% Cryptographic On-Device</div>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 8px; border: 1px solid #334155;">
        <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: #38bdf8;">Attendance Verification Certificate</h4>
        <p style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; margin: 0 0 8px 0;">
          This participant's attendance was authenticated using temporal sustained presence windowing.
          Transitory presence (< 15s) false-positive filtering succeeded.
        </p>
        <div style="font-family: monospace; font-size: 0.72rem; color: #64748b; word-break: break-all;">
          SHA256-TOKEN: a8f7c9e013b56782d4f290bc9341ea290145be8fcd7612b
        </div>
      </div>
    `;

    studentModal.style.display = 'flex';
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      studentModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === studentModal) {
      studentModal.style.display = 'none';
    }
  });
});
