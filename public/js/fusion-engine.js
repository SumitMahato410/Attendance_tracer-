/**
 * Fusion Engine - Multimodal Signal Integration & Sustained Presence Filter
 * 
 * Implements:
 * 1. Scenario 1: Sustained Presence Attendance Tracking with False-Positive Filtering
 * 2. Scenario 2: Multimodal Engagement Scoring (MES) across Visual, Acoustic & Inactivity metrics
 */

class FusionEngine {
  constructor(options = {}) {
    // Attendance Configuration
    this.sustainedWindowSeconds = options.sustainedWindowSeconds || 45; // Sliding window size
    this.presenceThreshold = options.presenceThreshold || 0.65; // Required % presence in window
    this.minSustainedSeconds = options.minSustainedSeconds || 20; // Time needed to confirm attendance
    this.lateCutoffSeconds = options.lateCutoffSeconds || 60; // Configurable late threshold for demo

    // Engagement Weightings (positive components sum to 1.0, penalty subtracted)
    this.weights = {
      gaze: options.wGaze !== undefined ? options.wGaze : 0.50,
      postureMotion: options.wMotion !== undefined ? options.wMotion : 0.30,
      audioSynchrony: options.wAudio !== undefined ? options.wAudio : 0.20,
      inactivityPenalty: options.wInactivity !== undefined ? options.wInactivity : 0.15
    };

    // Participant Attendance State Store
    // id -> { id, name, firstSeen, lastSeen, detectionHistory: [], sustainedSeconds, status, isRegistered }
    this.rosterState = new Map();

    // Session Metrics
    this.sessionStartTime = Date.now();
    this.currentClassroomScore = 78;
    this.attentionDropAlert = false;
    this.interactionPeakAlert = false;
    this.classroomDynamic = 'Optimal Flow';
    
    // Historical trends (last 60 seconds)
    this.recentEngagementScores = [];
  }

  resetSession() {
    this.sessionStartTime = Date.now();
    this.rosterState.clear();
    this.recentEngagementScores = [];
    this.attentionDropAlert = false;
    this.interactionPeakAlert = false;
  }

  /**
   * Main fusion loop called once per frame/second
   */
  fuse(visionParticipants, acousticMetrics, sessionElapsedSeconds) {
    const timestamp = Date.now();
    const activeIdsInFrame = new Set(visionParticipants.map(p => p.id));

    // 1. Process Attendance & Sustained Presence Filter
    const updatedRoster = this.processAttendance(visionParticipants, activeIdsInFrame, sessionElapsedSeconds, timestamp);

    // 2. Compute Individual & Classroom Multimodal Engagement Scores
    const individualScores = this.computeEngagementScores(visionParticipants, acousticMetrics);

    // 3. Compute Session Dynamics & Identify Critical Events
    const dynamics = this.analyzeClassroomDynamics(individualScores, acousticMetrics, sessionElapsedSeconds);

    return {
      roster: updatedRoster,
      individualScores,
      classroomScore: dynamics.classroomScore,
      classroomDynamic: dynamics.classroomDynamic,
      attentionDropAlert: dynamics.attentionDropAlert,
      interactionPeakAlert: dynamics.interactionPeakAlert,
      multimodalBreakdown: dynamics.breakdown
    };
  }

  processAttendance(visionParticipants, activeIdsInFrame, sessionElapsedSeconds, timestamp) {
    // Update each detected participant
    visionParticipants.forEach(p => {
      let rec = this.rosterState.get(p.id);
      if (!rec) {
        rec = {
          id: p.id,
          name: p.name || `Student ${p.id}`,
          firstSeen: sessionElapsedSeconds,
          lastSeen: sessionElapsedSeconds,
          detectionTimeline: [], // 1 = detected, 0 = absent per second
          sustainedSeconds: 0,
          totalDetectedSeconds: 0,
          presenceRatio: 0,
          status: 'Evaluating Presence...',
          isTransitory: !!p.isTransitory,
          confidenceScore: 0,
          avgEngagement: 75,
          engagementSamples: []
        };
        this.rosterState.set(p.id, rec);
      }

      rec.lastSeen = sessionElapsedSeconds;
      rec.totalDetectedSeconds += 1;
      rec.detectionTimeline.push({ t: sessionElapsedSeconds, present: 1 });
    });

    // Handle participants absent in this frame
    for (let [id, rec] of this.rosterState.entries()) {
      if (!activeIdsInFrame.has(id)) {
        rec.detectionTimeline.push({ t: sessionElapsedSeconds, present: 0 });
      }

      // Trim timeline to sliding window
      const windowCutoff = sessionElapsedSeconds - this.sustainedWindowSeconds;
      rec.detectionTimeline = rec.detectionTimeline.filter(item => item.t >= windowCutoff);

      // Calculate sliding window presence ratio
      const presentCount = rec.detectionTimeline.reduce((sum, item) => sum + item.present, 0);
      const windowSpan = Math.max(1, rec.detectionTimeline.length);
      rec.presenceRatio = Math.round((presentCount / windowSpan) * 100);

      // Sustained duration calculation
      if (activeIdsInFrame.has(id)) {
        rec.sustainedSeconds += 1;
      }

      // Determine Attendance Status via Sustained Presence Criteria
      const timeSinceLastSeen = sessionElapsedSeconds - rec.lastSeen;

      if (rec.isTransitory || (rec.sustainedSeconds < this.minSustainedSeconds && rec.presenceRatio < this.presenceThreshold * 100)) {
        // Transitory / brief walk-in filter
        if (timeSinceLastSeen > 10) {
          rec.status = 'FILTERED (Transitory Passerby)';
        } else {
          rec.status = `Verifying Presence (${Math.round((rec.sustainedSeconds / this.minSustainedSeconds) * 100)}%)`;
        }
      } else if (rec.sustainedSeconds >= this.minSustainedSeconds && rec.presenceRatio >= (this.presenceThreshold * 100 * 0.8)) {
        // Confirmed sustained attendance
        if (timeSinceLastSeen > 60) {
          rec.status = 'TEMPORARY ABSENCE';
        } else if (rec.firstSeen > this.lateCutoffSeconds) {
          rec.status = 'PRESENT [Late Arrival]';
        } else {
          rec.status = 'PRESENT [Sustained]';
        }
      } else if (timeSinceLastSeen > 90 && rec.sustainedSeconds >= this.minSustainedSeconds) {
        rec.status = 'EARLY DEPARTURE';
      }
    }

    return Array.from(this.rosterState.values());
  }

  computeEngagementScores(visionParticipants, acousticMetrics) {
    const scores = visionParticipants.map(p => {
      // 1. Gaze component (0 to 100)
      const gazeScore = p.gazeAlignment || 70;

      // 2. Posture & Movement component (0 to 100)
      // Normal attentive movement is between 0.1 and 0.5. Extreme flailing or 0 movement is penalized.
      let postureScore = 80;
      if (p.isHandRaised) {
        postureScore = 100;
      } else if (p.isNoteTaking) {
        postureScore = 95;
      } else if (p.behavioralState.includes('Distracted') || p.isPhoneDistracted) {
        postureScore = 30;
      } else if (p.motionVelocity < 0.05) {
        postureScore = 55; // Sluggish/slouching
      }

      // 3. Audio synchrony component (0 to 100)
      // Higher during active dialogue or attentive listening
      let audioScore = 70;
      if (acousticMetrics.interactionType === 'Active Q&A / Dialogue') {
        audioScore = p.isHandRaised ? 98 : 88;
      } else if (acousticMetrics.interactionType === 'Extended Monologue') {
        // In monologue, attentive gaze is what matters
        audioScore = gazeScore > 75 ? 80 : 50;
      }

      // 4. Inactivity Penalty (0 to 100)
      const inactivitySeconds = p.inactivityTimer || 0;
      let penalty = 0;
      if (inactivitySeconds > 60) {
        penalty = Math.min(100, Math.round(((inactivitySeconds - 60) / 120) * 100));
      }

      // Multimodal Engagement Score Equation:
      // MES = wGaze * G + wMotion * P + wAudio * A - wInactivity * I
      const rawMes = (
        gazeScore * this.weights.gaze +
        postureScore * this.weights.postureMotion +
        audioScore * this.weights.audioSynchrony -
        penalty * this.weights.inactivityPenalty
      );

      const finalMes = Math.max(0, Math.min(100, Math.round(rawMes)));

      // Record sample in participant state
      const rosterRec = this.rosterState.get(p.id);
      if (rosterRec) {
        rosterRec.engagementSamples.push(finalMes);
        if (rosterRec.engagementSamples.length > 100) rosterRec.engagementSamples.shift();
        const sum = rosterRec.engagementSamples.reduce((a, b) => a + b, 0);
        rosterRec.avgEngagement = Math.round(sum / rosterRec.engagementSamples.length);
      }

      return {
        id: p.id,
        name: p.name,
        mes: finalMes,
        gazeScore,
        postureScore,
        inactivitySeconds: Math.round(inactivitySeconds),
        behavioralState: p.behavioralState,
        isTransitory: p.isTransitory
      };
    });

    return scores;
  }

  analyzeClassroomDynamics(individualScores, acousticMetrics, sessionElapsedSeconds) {
    // Filter out transitory passersby from classroom aggregate
    const genuineStudents = individualScores.filter(s => !s.isTransitory);
    
    if (genuineStudents.length === 0) {
      return {
        classroomScore: 75,
        classroomDynamic: 'Classroom Empty / Standby',
        attentionDropAlert: false,
        interactionPeakAlert: false,
        breakdown: { gaze: 75, posture: 75, audio: 75, penalty: 0 }
      };
    }

    const avgGaze = Math.round(genuineStudents.reduce((acc, s) => acc + s.gazeScore, 0) / genuineStudents.length);
    const avgPosture = Math.round(genuineStudents.reduce((acc, s) => acc + s.postureScore, 0) / genuineStudents.length);
    const avgScore = Math.round(genuineStudents.reduce((acc, s) => acc + s.mes, 0) / genuineStudents.length);
    const avgInactivity = Math.round(genuineStudents.reduce((acc, s) => acc + s.inactivitySeconds, 0) / genuineStudents.length);

    // Track rolling history to detect sharp trends
    this.recentEngagementScores.push(avgScore);
    if (this.recentEngagementScores.length > 30) {
      this.recentEngagementScores.shift();
    }

    // Detect Attention Drop (drop of >= 18 points between start of window and current)
    let attentionDropAlert = false;
    if (this.recentEngagementScores.length >= 15) {
      const pastScore = this.recentEngagementScores[0];
      if (pastScore - avgScore >= 18 && avgScore < 60) {
        attentionDropAlert = true;
      }
    }

    // Detect Interaction Peak
    const handsRaised = individualScores.filter(s => s.behavioralState === 'Raising Hand').length;
    const interactionPeakAlert = handsRaised >= 2 || (acousticMetrics.interactionType === 'Active Q&A / Dialogue' && avgScore > 82);

    // Determine Holistic Classroom Dynamic State
    let classroomDynamic = 'Optimal Flow';
    if (attentionDropAlert || (avgScore < 52 && acousticMetrics.interactionType === 'Extended Monologue')) {
      classroomDynamic = 'Monotone Lecture Fatigue';
    } else if (interactionPeakAlert) {
      classroomDynamic = 'High-Interaction Q&A Peak';
    } else if (avgScore > 80 && acousticMetrics.interactionType === 'Silent Individual Work') {
      classroomDynamic = 'Deep Focus / Independent Writing';
    } else if (avgScore < 50) {
      classroomDynamic = 'Disengagement Cluster';
    } else if (acousticMetrics.interactionType === 'Active Q&A / Dialogue') {
      classroomDynamic = 'Collaborative Discussion';
    }

    this.currentClassroomScore = avgScore;
    this.attentionDropAlert = attentionDropAlert;
    this.interactionPeakAlert = interactionPeakAlert;
    this.classroomDynamic = classroomDynamic;

    return {
      classroomScore: avgScore,
      classroomDynamic,
      attentionDropAlert,
      interactionPeakAlert,
      breakdown: {
        gaze: avgGaze,
        posture: avgPosture,
        audio: Math.round(acousticMetrics.speechRatio * 100),
        inactivityPenalty: Math.min(100, Math.round((avgInactivity / 60) * 20))
      }
    };
  }
}

if (typeof window !== 'undefined') {
  window.FusionEngine = FusionEngine;
}
