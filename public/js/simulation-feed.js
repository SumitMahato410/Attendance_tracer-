/**
 * Simulation Feed - High-Fidelity Synthetic Classroom Video & Behavioral Simulator
 * 
 * Simulates a realistic multi-student classroom environment with realistic physics,
 * head rotations, hand-raise gestures, note-taking, distractions, late arrivals,
 * and transitory visitors (to test false-positive rejection).
 */

class SimulationFeed {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    this.elapsedSeconds = 0;
    this.activeScenario = 'balanced'; // 'balanced', 'fatigue', 'qa_spike', 'transitory_test'
    
    // Seeded student agents with realistic physical positions & behaviors
    this.students = [
      {
        id: 'STU-101',
        name: 'Aarav Sharma',
        basePos: { x: 0.22, y: 0.65 },
        color: '#38bdf8',
        gazeBaseline: { yaw: 0, pitch: -8 },
        behaviorState: 'Attentive',
        isHandRaised: false,
        isNoteTaking: true,
        motion: 0.25,
        inactivity: 0,
        deskPos: { x: 0.16, y: 0.72, w: 0.24, h: 0.22 },
        headRadius: 28,
        active: true
      },
      {
        id: 'STU-102',
        name: 'Maya Chen',
        basePos: { x: 0.68, y: 0.64 },
        color: '#f43f5e',
        gazeBaseline: { yaw: -6, pitch: -5 },
        behaviorState: 'Attentive',
        isHandRaised: false,
        isNoteTaking: false,
        motion: 0.3,
        inactivity: 0,
        deskPos: { x: 0.60, y: 0.72, w: 0.24, h: 0.22 },
        headRadius: 27,
        active: true
      },
      {
        id: 'STU-103',
        name: 'Liam Davis',
        basePos: { x: 0.18, y: 0.40 },
        color: '#eab308',
        gazeBaseline: { yaw: 12, pitch: -12 },
        behaviorState: 'Attentive',
        isHandRaised: false,
        isNoteTaking: false,
        motion: 0.12,
        inactivity: 10,
        deskPos: { x: 0.12, y: 0.45, w: 0.20, h: 0.18 },
        headRadius: 24,
        active: true
      },
      {
        id: 'STU-104',
        name: 'Sophia Patel',
        basePos: { x: 0.48, y: 0.42 },
        color: '#10b981',
        gazeBaseline: { yaw: 2, pitch: -6 },
        behaviorState: 'Attentive',
        isHandRaised: false,
        isNoteTaking: true,
        motion: 0.22,
        inactivity: 5,
        deskPos: { x: 0.40, y: 0.47, w: 0.20, h: 0.18 },
        headRadius: 25,
        active: true
      },
      {
        id: 'STU-105',
        name: 'Noah Wilson (Late)',
        basePos: { x: 0.78, y: 0.38 },
        color: '#a855f7',
        gazeBaseline: { yaw: -10, pitch: -10 },
        behaviorState: 'Attentive',
        isHandRaised: false,
        isNoteTaking: false,
        motion: 0.18,
        inactivity: 0,
        deskPos: { x: 0.70, y: 0.44, w: 0.20, h: 0.18 },
        headRadius: 23,
        active: false // Arrives late
      },
      {
        id: 'VIS-999',
        name: 'Hallway Visitor (Transitory)',
        basePos: { x: 0.92, y: 0.25 },
        color: '#ec4899',
        gazeBaseline: { yaw: -30, pitch: 0 },
        behaviorState: 'Passing Hallway',
        isHandRaised: false,
        isNoteTaking: false,
        motion: 0.65,
        inactivity: 0,
        deskPos: null,
        headRadius: 20,
        active: false, // Appears briefly to test false positive rejection
        isTransitory: true
      }
    ];

    this.transitoryDuration = 0;
  }

  setScenario(name) {
    this.activeScenario = name;
    if (name === 'transitory_test') {
      const visitor = this.students.find(s => s.id === 'VIS-999');
      if (visitor) {
        visitor.active = true;
        this.transitoryDuration = 8; // Present for 8 seconds only
      }
    } else if (name === 'late_arrival') {
      const noah = this.students.find(s => s.id === 'STU-105');
      if (noah) noah.active = true;
    }
  }

  update(dt) {
    this.elapsedSeconds += dt;
    const time = this.elapsedSeconds;

    // Handle Transitory Visitor Countdown
    const visitor = this.students.find(s => s.id === 'VIS-999');
    if (visitor && visitor.active) {
      this.transitoryDuration -= dt;
      visitor.basePos.x -= dt * 0.04; // Walking across doorway
      if (this.transitoryDuration <= 0) {
        visitor.active = false;
        visitor.basePos.x = 0.95; // reset
      }
    }

    // Noah enters late automatically after 30 seconds if not already activated
    if (time > 30 && this.activeScenario !== 'manual') {
      const noah = this.students.find(s => s.id === 'STU-105');
      if (noah && !noah.active) {
        noah.active = true;
      }
    }

    // Dynamic Behavioral Simulation based on activeScenario
    this.students.forEach(st => {
      if (!st.active) return;

      // Natural micro-movements
      const microX = Math.sin(time * 1.5 + st.id.charCodeAt(5)) * 2;
      const microY = Math.cos(time * 1.2 + st.id.charCodeAt(6)) * 1.5;

      // Behavioral dynamics
      if (this.activeScenario === 'fatigue') {
        // Liam and Noah get disengaged / sleepy / check phone
        if (st.id === 'STU-103' || st.id === 'STU-105') {
          st.gazeBaseline.pitch = -35 + Math.sin(time * 0.5) * 5; // Looking down at lap
          st.gazeBaseline.yaw = (Math.sin(time * 0.3) > 0 ? 30 : -25);
          st.isPhoneDistracted = true;
          st.isNoteTaking = false;
          st.motion = 0.04;
          st.inactivity += dt * 1.5;
        } else {
          // Others yawn or gaze drift
          st.gazeBaseline.pitch = -22;
          st.motion = 0.1;
        }
      } else if (this.activeScenario === 'qa_spike') {
        // High attention, Maya and Sophia raise hands
        st.gazeBaseline.pitch = -4;
        st.gazeBaseline.yaw = (Math.sin(time * 2) * 8);
        if (st.id === 'STU-102') {
          st.isHandRaised = true;
        }
        if (st.id === 'STU-104') {
          st.isHandRaised = (Math.sin(time) > 0);
        }
        st.isPhoneDistracted = false;
        st.motion = 0.35;
        st.inactivity = 0;
      } else {
        // 'balanced' realistic classroom
        if (st.id === 'STU-103') {
          // Liam drifts after 20 seconds
          if (time > 20) {
            st.gazeBaseline.pitch = -32;
            st.gazeBaseline.yaw = 28;
            st.isPhoneDistracted = true;
            st.motion = 0.05;
          } else {
            st.gazeBaseline.pitch = -12;
            st.isPhoneDistracted = false;
          }
        }
        if (st.id === 'STU-102' && Math.sin(time * 0.4) > 0.6) {
          st.isHandRaised = true;
        } else if (st.id === 'STU-102') {
          st.isHandRaised = false;
        }
      }

      st.currentHeadPose = {
        yaw: Math.round(st.gazeBaseline.yaw + microX * 2),
        pitch: Math.round(st.gazeBaseline.pitch + microY * 2),
        roll: Math.round(microX)
      };
    });
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Background: Modern Smart Classroom
    // Gradient wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, '#0f172a');
    wallGrad.addColorStop(0.5, '#1e293b');
    wallGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Front Presentation Screen Glow on far wall
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fillRect(width * 0.2, 0, width * 0.6, height * 0.25);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.2, 0, width * 0.6, height * 0.25);

    // Presentation text preview
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LECTURE MODULE 4: MULTIMODAL PERCEPTION & ATTENTION DYNAMICS', width * 0.5, 32);

    // Floor perspective lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(width * 0.1 + i * (width * 0.16), height * 0.35);
      ctx.lineTo(width * (0.05 + i * 0.18), height);
      ctx.stroke();
    }

    // Doorway / Hallway on Right side (where transitory visitors appear)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(width * 0.88, height * 0.15, width * 0.11, height * 0.45);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.strokeRect(width * 0.88, height * 0.15, width * 0.11, height * 0.45);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('HALLWAY', width * 0.935, height * 0.18);

    // Render Student Desks and Avatars (sorted back to front for proper occlusion)
    const activeStudents = this.students.filter(s => s.active).sort((a, b) => a.basePos.y - b.basePos.y);

    activeStudents.forEach(st => {
      const cx = st.basePos.x * width;
      const cy = st.basePos.y * height;
      const headR = st.headRadius;

      // Draw Desk if student has one
      if (st.deskPos) {
        const dx = st.deskPos.x * width;
        const dy = st.deskPos.y * height;
        const dw = st.deskPos.w * width;
        const dh = st.deskPos.h * height;

        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.strokeRect(dx, dy, dw, dh);

        // Laptop or Notebook on desk
        if (st.isNoteTaking) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(dx + dw * 0.25, dy + 6, dw * 0.4, dh * 0.4);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(dx + dw * 0.28, dy + 10, dw * 0.34, 2);
          ctx.fillRect(dx + dw * 0.28, dy + 15, dw * 0.34, 2);
        } else {
          // Closed tablet / notebook
          ctx.fillStyle = 'rgba(51, 65, 85, 0.8)';
          ctx.fillRect(dx + dw * 0.3, dy + 8, dw * 0.35, dh * 0.35);
        }
      }

      // Draw Student Body / Torso
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy + headR * 1.5, headR * 1.3, headR * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hand Raised Gesture
      if (st.isHandRaised) {
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + headR * 0.8, cy + headR);
        ctx.lineTo(cx + headR * 1.2, cy - headR * 1.2);
        ctx.stroke();

        // Palm
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(cx + headR * 1.2, cy - headR * 1.2, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Student Head
      ctx.fillStyle = '#fed7aa'; // Natural skin tone base
      ctx.beginPath();
      ctx.arc(cx, cy, headR, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(cx, cy - headR * 0.2, headR * 0.95, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes & Gaze rendering
      const yawOffset = (st.currentHeadPose.yaw / 45) * (headR * 0.35);
      const pitchOffset = (st.currentHeadPose.pitch / 45) * (headR * 0.35);

      ctx.fillStyle = '#0f172a';
      // Left eye
      ctx.beginPath();
      ctx.arc(cx - headR * 0.35 + yawOffset, cy + pitchOffset, 3, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.beginPath();
      ctx.arc(cx + headR * 0.35 + yawOffset, cy + pitchOffset, 3, 0, Math.PI * 2);
      ctx.fill();

      // Note-taking pen movement
      if (st.isNoteTaking) {
        const penWiggle = Math.sin(this.elapsedSeconds * 12) * 4;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy + headR * 1.8);
        ctx.lineTo(cx + 8 + penWiggle, cy + headR * 2.2);
        ctx.stroke();
      }
    });

    ctx.textAlign = 'left';
  }

  /**
   * Return detected participant telemetry matching VisionEngine output format
   */
  getParticipantDetections() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    return this.students
      .filter(s => s.active)
      .map(st => {
        const cx = st.basePos.x * width;
        const cy = st.basePos.y * height;
        const r = st.headRadius;

        // Bounding box: [x, y, w, h]
        const bbox = [
          Math.round(cx - r * 1.4),
          Math.round(cy - r * 1.2),
          Math.round(r * 2.8),
          Math.round(r * 3.4)
        ];

        return {
          id: st.id,
          name: st.name,
          bbox,
          headPose: { ...st.currentHeadPose },
          motionVelocity: st.motion,
          inactivityTimer: st.inactivity,
          isHandRaised: st.isHandRaised,
          isNoteTaking: st.isNoteTaking,
          isPhoneDistracted: st.isPhoneDistracted,
          isTransitory: !!st.isTransitory
        };
      });
  }
}

if (typeof window !== 'undefined') {
  window.SimulationFeed = SimulationFeed;
}
