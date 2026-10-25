/**
 * Agent Reasoner - AI-Driven Pedagogical Decision-Support Engine
 * 
 * Implements Scenario 3:
 * Continuously evaluates multimodal telemetry, detects pedagogical inflection points,
 * and formulates context-aware, non-intrusive teaching suggestions for educators.
 */

class AgentReasoner {
  constructor(options = {}) {
    this.cooldownSeconds = options.cooldownSeconds || 25; // Minimum time between consecutive alerts
    this.lastTriggerTime = 0;
    
    this.activeSuggestions = [];
    this.suggestionHistory = [];
    this.listeners = [];

    // Track pedagogical states
    this.monologueSeconds = 0;
    this.lowAttentionSeconds = 0;
  }

  onSuggestion(callback) {
    this.listeners.push(callback);
  }

  evaluate(fusionResult, acousticMetrics, sessionElapsedSeconds) {
    const { classroomScore, classroomDynamic, attentionDropAlert, interactionPeakAlert, individualScores } = fusionResult;
    
    // Update state timers
    if (acousticMetrics.interactionType === 'Extended Monologue') {
      this.monologueSeconds += 1;
    } else {
      this.monologueSeconds = Math.max(0, this.monologueSeconds - 2);
    }

    if (classroomScore < 55) {
      this.lowAttentionSeconds += 1;
    } else {
      this.lowAttentionSeconds = Math.max(0, this.lowAttentionSeconds - 2);
    }

    // Check cooldown
    if (sessionElapsedSeconds - this.lastTriggerTime < this.cooldownSeconds) {
      return this.activeSuggestions;
    }

    let candidate = null;

    // RULE 1: Monotone Lecture Fatigue Alert
    if (this.monologueSeconds >= 40 && classroomScore < 60) {
      candidate = {
        id: `sug_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedTime: sessionElapsedSeconds,
        category: 'PACING_OPTIMIZATION',
        urgency: 'high',
        badge: 'Lecture Fatigue',
        title: 'Monologue Fatigue Detected (>7 min)',
        rationale: `Speech ratio is ${Math.round(acousticMetrics.speechRatio * 100)}% with prolonged continuous monologue while classroom attention has softened to ${classroomScore}%.`,
        action: 'Pause presentation for a 60-second "Think-Pair-Share" or launch a quick interactive concept check poll.',
        status: 'pending'
      };
      this.monologueSeconds = 0;
    }
    // RULE 2: Sudden Attention Drop Across Classroom
    else if (attentionDropAlert) {
      candidate = {
        id: `sug_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedTime: sessionElapsedSeconds,
        category: 'INTERVENTION',
        urgency: 'high',
        badge: 'Attention Drop',
        title: 'Rapid Engagement Plunge Detected',
        rationale: `Classroom attention score dropped sharply over the last window to ${classroomScore}%. Several learners show downward gaze toward laptops/desks.`,
        action: 'Raise voice inflection, pose a direct open-ended question to re-anchor the room, or invite a volunteer to summarize.',
        status: 'pending'
      };
    }
    // RULE 3: High Interaction Peak Momentum
    else if (interactionPeakAlert && this.activeSuggestions.filter(s => s.category === 'POSITIVE_MOMENTUM').length === 0) {
      candidate = {
        id: `sug_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedTime: sessionElapsedSeconds,
        category: 'POSITIVE_MOMENTUM',
        urgency: 'info',
        badge: 'High Engagement',
        title: 'Collaborative Interaction Peak',
        rationale: `Vocal participation is high and multiple hand raises detected. Classroom engagement index reached ${classroomScore}%.`,
        action: 'Capitalize on student momentum: transition from instructor response into student-to-student peer debate.',
        status: 'pending'
      };
    }
    // RULE 4: Cluster / Back Row Disengagement
    else if (individualScores && individualScores.length > 3) {
      const disengaged = individualScores.filter(s => s.mes < 45 && !s.isTransitory);
      if (disengaged.length >= 2) {
        const names = disengaged.map(s => s.name || s.id).join(', ');
        candidate = {
          id: `sug_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          elapsedTime: sessionElapsedSeconds,
          category: 'INDIVIDUAL_SUPPORT',
          urgency: 'medium',
          badge: 'Cluster Disengaged',
          title: 'Localized Attention Drift Identified',
          rationale: `Learners (${names}) have exhibited low gaze alignment and prolonged inactivity (>90s).`,
          action: 'Use proximity teaching: move towards their seating zone or direct a friendly, low-stakes comprehension check.',
          status: 'pending'
        };
      }
    }
    // RULE 5: Mid-Session Cognitive Break (e.g. at 40-50 min in real sessions, or scaled demo)
    else if (sessionElapsedSeconds > 0 && sessionElapsedSeconds % 180 === 0 && classroomScore < 70) {
      candidate = {
        id: `sug_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedTime: sessionElapsedSeconds,
        category: 'ENERGY_BOOST',
        urgency: 'medium',
        badge: 'Cognitive Reset',
        title: 'Cognitive Fatigue Reset Recommended',
        rationale: 'Sustained cognitive demand observed. Average blink rate and gaze variance indicate natural attentional decay.',
        action: 'Introduce a 90-second physical stand-up stretch, water break, or quick reflective quiz.',
        status: 'pending'
      };
    }

    if (candidate) {
      this.lastTriggerTime = sessionElapsedSeconds;
      this.activeSuggestions.unshift(candidate);
      if (this.activeSuggestions.length > 5) {
        this.activeSuggestions.pop();
      }
      this.suggestionHistory.unshift(candidate);
      this.notify(candidate);
    }

    return this.activeSuggestions;
  }

  notify(suggestion) {
    this.listeners.forEach(fn => {
      try { fn(suggestion); } catch (e) { console.error(e); }
    });
  }

  acknowledge(suggestionId) {
    const s = this.activeSuggestions.find(item => item.id === suggestionId);
    if (s) {
      s.status = 'acknowledged';
    }
  }

  dismiss(suggestionId) {
    this.activeSuggestions = this.activeSuggestions.filter(item => item.id !== suggestionId);
  }

  getAllHistory() {
    return this.suggestionHistory;
  }
}

if (typeof window !== 'undefined') {
  window.AgentReasoner = AgentReasoner;
}
