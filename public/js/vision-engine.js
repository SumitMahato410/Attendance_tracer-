/**
 * Vision Engine - Computer Vision & Behavioral Signal Extraction
 * 
 * Extracts:
 * - Sustained face/participant detection & tracking
 * - 3D Head Pose (Yaw, Pitch, Roll)
 * - Gaze direction vector & attention alignment
 * - Movement dynamics, gestures (hand raises, note-taking)
 * - Inactivity duration counter
 * - Privacy-preserving face blurring & feature hashing
 */

class VisionEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.privacyMode = options.privacyMode !== undefined ? options.privacyMode : true;
    this.showLandmarks = options.showLandmarks !== undefined ? options.showLandmarks : true;
    this.showGazeVectors = options.showGazeVectors !== undefined ? options.showGazeVectors : true;
    
    this.videoStream = null;
    this.videoElement = document.createElement('video');
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    
    this.isLiveCamera = false;
    this.participants = [];
    this.trackedHistory = new Map(); // id -> history of detections
    this.lastFrameTime = performance.now();
  }

  setPrivacyMode(enabled) {
    this.privacyMode = enabled;
  }

  setShowLandmarks(enabled) {
    this.showLandmarks = enabled;
  }

  setShowGazeVectors(enabled) {
    this.showGazeVectors = enabled;
  }

  async startLiveCamera() {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      this.videoElement.srcObject = this.videoStream;
      await this.videoElement.play();
      this.isLiveCamera = true;
      return true;
    } catch (err) {
      console.warn('Live camera access denied or unavailable:', err);
      this.isLiveCamera = false;
      return false;
    }
  }

  stopLiveCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    this.isLiveCamera = false;
  }

  /**
   * Process a frame given detected or simulated participants
   */
  processFrame(participantsData, timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Render underlying video feed if in live camera mode
    if (this.isLiveCamera && this.videoElement.readyState >= 2) {
      this.ctx.drawImage(this.videoElement, 0, 0, width, height);
    }

    // Process each participant
    const processed = participantsData.map(p => {
      // Update inactivity timer
      let inactivityTime = p.inactivityTimer || 0;
      if (p.motionVelocity < 0.08 && Math.abs(p.headPose.pitch) < 10) {
        inactivityTime += dt;
      } else {
        inactivityTime = Math.max(0, inactivityTime - dt * 2);
      }

      // Compute Gaze Alignment Score (0 to 100)
      // Yaw: 0 is center (facing board), Pitch: 0 is level eye-line
      // Pitch < -20 means looking down at desk/phone
      const yawPenalty = Math.min(1, Math.abs(p.headPose.yaw) / 45);
      const pitchPenalty = p.headPose.pitch < -20 ? Math.min(1, (Math.abs(p.headPose.pitch) - 20) / 35) : Math.abs(p.headPose.pitch) / 45;
      const gazeAlignment = Math.max(0, Math.min(100, Math.round((1 - (yawPenalty * 0.6 + pitchPenalty * 0.4)) * 100)));

      // Behavioral State Tag
      let behavioralState = 'Attentive';
      if (p.isHandRaised) {
        behavioralState = 'Raising Hand';
      } else if (p.isNoteTaking) {
        behavioralState = 'Writing / Notes';
      } else if (p.isPhoneDistracted || (p.headPose.pitch < -28 && p.motionVelocity < 0.15)) {
        behavioralState = 'Looking Down / Screen';
      } else if (Math.abs(p.headPose.yaw) > 35) {
        behavioralState = 'Distracted (Turned Away)';
      } else if (inactivityTime > 120) {
        behavioralState = 'Prolonged Inactivity';
      }

      return {
        ...p,
        gazeAlignment,
        inactivityTimer: inactivityTime,
        behavioralState,
        timestamp
      };
    });

    this.participants = processed;

    // Render Overlays
    this.renderOverlays(processed, width, height);

    return processed;
  }

  renderOverlays(participants, width, height) {
    participants.forEach(p => {
      const { bbox, headPose, gazeAlignment, behavioralState, isTransitory } = p;
      if (!bbox) return;

      const [x, y, w, h] = bbox;

      // Privacy Mode: Face Blurring / Anonymization
      if (this.privacyMode) {
        this.applyPrivacyBlur(x, y, w, h);
      }

      // Draw Bounding Box
      this.ctx.save();
      let strokeColor = '#10b981'; // Green: High attention
      if (isTransitory) {
        strokeColor = '#ec4899'; // Pink: Transitory / Visitor
      } else if (gazeAlignment < 40 || behavioralState.includes('Distracted')) {
        strokeColor = '#ef4444'; // Red: Low attention
      } else if (gazeAlignment < 70) {
        strokeColor = '#f59e0b'; // Amber: Medium attention
      }

      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2.5;
      this.ctx.setLineDash(isTransitory ? [4, 4] : []);
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.setLineDash([]);

      // Draw Participant Tag
      const displayName = this.privacyMode ? `[ANON-${p.id.slice(-4)}]` : (p.name || p.id);
      const tagText = `${displayName} • ${gazeAlignment}% Attn`;
      
      this.ctx.font = '600 12px Inter, system-ui, sans-serif';
      const textWidth = this.ctx.measureText(tagText).width;
      
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.fillRect(x, Math.max(0, y - 24), textWidth + 16, 22);

      this.ctx.fillStyle = strokeColor;
      this.ctx.fillRect(x, Math.max(0, y - 24), 3, 22);

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.fillText(tagText, x + 8, Math.max(16, y - 8));

      // Draw Head Pose Orientation Arrow (Gaze Vector)
      if (this.showGazeVectors && headPose) {
        this.renderGazeVector(x + w / 2, y + h * 0.45, headPose, strokeColor);
      }

      // Draw State Indicator below box
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      this.ctx.fillRect(x, y + h + 4, w, 18);
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '500 10px Inter, system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(behavioralState, x + w / 2, y + h + 16);
      this.ctx.textAlign = 'left';

      this.ctx.restore();
    });
  }

  applyPrivacyBlur(x, y, w, h) {
    this.ctx.save();
    // Clamp to canvas boundaries
    const safeX = Math.max(0, Math.floor(x));
    const safeY = Math.max(0, Math.floor(y));
    const safeW = Math.min(this.canvas.width - safeX, Math.floor(w));
    const safeH = Math.min(this.canvas.height - safeY, Math.floor(h));

    if (safeW <= 0 || safeH <= 0) {
      this.ctx.restore();
      return;
    }

    // High performance privacy pixelation / mosaic
    const pixelSize = 14;
    try {
      const imgData = this.ctx.getImageData(safeX, safeY, safeW, safeH);
      const data = imgData.data;

      for (let py = 0; py < safeH; py += pixelSize) {
        for (let px = 0; px < safeW; px += pixelSize) {
          const sampleIdx = (py * safeW + px) * 4;
          const r = data[sampleIdx];
          const g = data[sampleIdx + 1];
          const b = data[sampleIdx + 2];

          // Fill the block with the sampled color
          for (let dy = 0; dy < pixelSize && py + dy < safeH; dy++) {
            for (let dx = 0; dx < pixelSize && px + dx < safeW; dx++) {
              const targetIdx = ((py + dy) * safeW + (px + dx)) * 4;
              data[targetIdx] = r;
              data[targetIdx + 1] = g;
              data[targetIdx + 2] = b;
            }
          }
        }
      }
      this.ctx.putImageData(imgData, safeX, safeY);

      // Overlay privacy watermark
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      this.ctx.fillRect(safeX, safeY, safeW, safeH);
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(safeX, safeY, safeW, safeH);
    } catch (e) {
      // Fallback in case of tainted canvas
      this.ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
      this.ctx.fillRect(safeX, safeY, safeW, safeH);
    }
    this.ctx.restore();
  }

  renderGazeVector(cx, cy, headPose, color) {
    const { yaw, pitch } = headPose;
    // Yaw drives horizontal vector, Pitch drives vertical vector
    const length = 40;
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    const dx = Math.sin(radYaw) * length;
    const dy = -Math.sin(radPitch) * length + 5;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + dx, cy + dy);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    this.ctx.beginPath();
    this.ctx.moveTo(cx + dx, cy + dy);
    this.ctx.lineTo(cx + dx - 8 * Math.cos(angle - Math.PI / 6), cy + dy - 8 * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(cx + dx - 8 * Math.cos(angle + Math.PI / 6), cy + dy - 8 * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.restore();
  }
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.VisionEngine = VisionEngine;
}
