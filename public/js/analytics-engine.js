/**
 * Analytics Engine - Real-Time Telemetry Logging, Visual Analytics & Report Generation
 * 
 * Provides:
 * - High-resolution interactive timeline chart rendered on Canvas
 * - Classroom seating spatial heatmap
 * - CSV, JSON and Printable Report export pipelines
 */

class AnalyticsEngine {
  constructor(chartCanvas = null, heatmapCanvas = null) {
    this.chartCanvas = chartCanvas;
    this.chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

    this.heatmapCanvas = heatmapCanvas;
    this.heatmapCtx = heatmapCanvas ? heatmapCanvas.getContext('2d') : null;

    this.timelineHistory = [];
    this.maxTimelinePoints = 80;

    this.annotations = []; // Significant pedagogical moments
  }

  recordSecond(elapsedSeconds, classroomScore, acousticMetrics, roster, individualScores) {
    const point = {
      t: elapsedSeconds,
      score: classroomScore,
      speechPct: Math.round(acousticMetrics.speechRatio * 100),
      studentCount: roster.filter(s => s.status.includes('PRESENT')).length,
      timestamp: new Date().toLocaleTimeString()
    };

    this.timelineHistory.push(point);
    if (this.timelineHistory.length > this.maxTimelinePoints) {
      this.timelineHistory.shift();
    }

    if (this.chartCtx && this.chartCanvas) {
      this.renderTimelineChart();
    }

    if (this.heatmapCtx && this.heatmapCanvas) {
      this.renderSpatialHeatmap(individualScores);
    }
  }

  addAnnotation(elapsedSeconds, text, type = 'info') {
    this.annotations.push({ t: elapsedSeconds, text, type });
    if (this.annotations.length > 20) this.annotations.shift();
  }

  renderTimelineChart() {
    const ctx = this.chartCtx;
    const width = this.chartCanvas.width;
    const height = this.chartCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Draw Background Grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1;

    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      // Axis label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 25}%`, padLeft - 8, y + 3);
    }

    // Engagement Threshold Band (70% to 100% is Optimal Zone)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
    ctx.fillRect(padLeft, padTop, plotW, plotH * 0.3);

    // At-Risk Zone (<50%)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
    ctx.fillRect(padLeft, padTop + plotH * 0.5, plotW, plotH * 0.5);

    if (this.timelineHistory.length < 2) return;

    const n = this.timelineHistory.length;
    const stepX = plotW / Math.max(1, this.maxTimelinePoints - 1);

    // 1. Plot Speech Activity Line (Purple Dashed)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    this.timelineHistory.forEach((pt, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + plotH * (1 - pt.speechPct / 100);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Plot Engagement Score Area & Line (Cyan / Emerald Gradient)
    const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    this.timelineHistory.forEach((pt, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + plotH * (1 - pt.score / 100);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastX = padLeft + (n - 1) * stepX;
    ctx.lineTo(lastX, padTop + plotH);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Solid Line on top
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this.timelineHistory.forEach((pt, idx) => {
      const x = padLeft + idx * stepX;
      const y = padTop + plotH * (1 - pt.score / 100);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Current Value Pulsing Dot
    const latest = this.timelineHistory[n - 1];
    const latestX = padLeft + (n - 1) * stepX;
    const latestY = padTop + plotH * (1 - latest.score / 100);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(latestX, latestY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Render Annotation flags
    this.annotations.forEach(ann => {
      const targetPtIdx = this.timelineHistory.findIndex(pt => Math.abs(pt.t - ann.t) <= 1);
      if (targetPtIdx >= 0) {
        const ax = padLeft + targetPtIdx * stepX;
        ctx.strokeStyle = ann.type === 'alert' ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax, padTop);
        ctx.lineTo(ax, padTop + plotH);
        ctx.stroke();

        ctx.fillStyle = ann.type === 'alert' ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(ax, padTop + 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Time Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('-60s', padLeft, height - 10);
    ctx.fillText('-30s', padLeft + plotW * 0.5, height - 10);
    ctx.fillText('Live (Now)', padLeft + plotW, height - 10);
  }

  renderSpatialHeatmap(individualScores) {
    const ctx = this.heatmapCtx;
    const width = this.heatmapCanvas.width;
    const height = this.heatmapCanvas.height;

    ctx.clearRect(0, 0, width, height);

    // 2x3 Seating Zone layout representing classroom rows
    // Rows: Front, Back; Columns: Left, Center, Right
    const zones = [
      { name: 'Front-Left (Aarav)', x: 0.08, y: 0.15, w: 0.38, h: 0.32, score: 85 },
      { name: 'Front-Right (Maya)', x: 0.54, y: 0.15, w: 0.38, h: 0.32, score: 90 },
      { name: 'Mid-Left (Liam)', x: 0.08, y: 0.55, w: 0.38, h: 0.32, score: 55 },
      { name: 'Mid-Right (Sophia/Noah)', x: 0.54, y: 0.55, w: 0.38, h: 0.32, score: 82 }
    ];

    // Update with live individual scores if matching
    if (individualScores && individualScores.length > 0) {
      const aarav = individualScores.find(s => s.id === 'STU-101');
      if (aarav) zones[0].score = aarav.mes;

      const maya = individualScores.find(s => s.id === 'STU-102');
      if (maya) zones[1].score = maya.mes;

      const liam = individualScores.find(s => s.id === 'STU-103');
      if (liam) zones[2].score = liam.mes;

      const sophia = individualScores.find(s => s.id === 'STU-104');
      if (sophia) zones[3].score = sophia.mes;
    }

    // Draw Instructor Podium Bar at Top
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fillRect(width * 0.25, 6, width * 0.5, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PODIUM / INSTRUCTIONAL FOCUS', width * 0.5, 15);

    // Draw each Seating Zone
    zones.forEach(z => {
      const zx = z.x * width;
      const zy = z.y * height;
      const zw = z.w * width;
      const zh = z.h * height;

      // Color interpolation based on engagement
      let bg = 'rgba(16, 185, 129, 0.25)'; // Green
      let border = '#10b981';
      if (z.score < 50) {
        bg = 'rgba(239, 68, 68, 0.25)'; // Red
        border = '#ef4444';
      } else if (z.score < 70) {
        bg = 'rgba(245, 158, 11, 0.25)'; // Amber
        border = '#f59e0b';
      }

      ctx.fillStyle = bg;
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(zx, zy, zw, zh);

      // Zone Label & Score
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.name, zx + zw / 2, zy + zh * 0.45);

      ctx.font = '700 14px Inter, sans-serif';
      ctx.fillStyle = border;
      ctx.fillText(`${z.score}% Engagement`, zx + zw / 2, zy + zh * 0.75);
    });
  }

  generateCsv(roster) {
    let csv = 'StudentID,Name,AttendanceStatus,SustainedPresenceSeconds,PresenceRatioPct,AvgEngagementPct,VerificationMethod\n';
    roster.forEach(st => {
      csv += `"${st.id}","${st.name}","${st.status}",${st.sustainedSeconds},${st.presenceRatio}%,${st.avgEngagement}%,"Multimodal Temporal Window Filter (Privacy Edge)"\n`;
    });
    return csv;
  }

  downloadCsv(roster) {
    const csvData = this.generateCsv(roster);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Classroom_Attendance_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  downloadJson(roster, suggestions, sessionMetrics) {
    const data = {
      system: 'Multimodal Attendance & Engagement Agent',
      exportTimestamp: new Date().toISOString(),
      offlineCertified: true,
      sessionMetrics,
      roster,
      timelinePoints: this.timelineHistory,
      teachingSuggestionsHistory: suggestions
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Classroom_Session_Report_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  }
}

if (typeof window !== 'undefined') {
  window.AnalyticsEngine = AnalyticsEngine;
}
