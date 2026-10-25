/**
 * Multimodal Attendance & Engagement Agent - Offline Local Server
 * 
 * 100% Zero-Dependency Node.js server.
 * Operates strictly on-device without cloud external telemetry,
 * ensuring complete privacy-preserving local execution.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DEFAULT_PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'sample_data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// Ensure sample_data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let latestAttendanceStore = [];
let latestSessionAnalyticsStore = null;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Add CORS headers for local execution
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsedUrl);
    return;
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

function handleApi(req, res, pathname, parsedUrl) {
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'operational',
      deployment: '100% Offline Edge Appliance',
      privacyGuarantees: {
        rawVideoStored: false,
        cloudTelemetry: false,
        onDeviceProcessing: true,
        sustainedPresenceFiltering: true
      },
      activeSensors: ['ComputerVision_GazePose', 'Audio_FFT_VAD', 'TemporalFusion_MES', 'Pedagogical_Reasoner'],
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/api/attendance/export' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        latestAttendanceStore = payload.roster || [];

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonFilename = `attendance_${timestampStr}.json`;
        const csvFilename = `attendance_${timestampStr}.csv`;

        fs.writeFileSync(path.join(DATA_DIR, jsonFilename), JSON.stringify(payload, null, 2));

        // Generate CSV content
        let csvContent = 'StudentID,StudentName,Status,SustainedPresenceSeconds,PresenceRatioPct,FirstDetected,LastDetected,AverageEngagement\n';
        if (Array.isArray(payload.roster)) {
          payload.roster.forEach(st => {
            csvContent += `"${st.id}","${st.name}","${st.status}",${st.sustainedSeconds || 0},${st.presenceRatio || 0},"${st.firstDetected || ''}","${st.lastDetected || ''}",${st.avgEngagement || 0}\n`;
          });
        }
        fs.writeFileSync(path.join(DATA_DIR, csvFilename), csvContent);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          savedJson: jsonFilename,
          savedCsv: csvFilename,
          recordCount: latestAttendanceStore.length
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/attendance/latest' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      roster: latestAttendanceStore,
      count: latestAttendanceStore.length,
      retrievedAt: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/api/analytics/session' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        latestSessionAnalyticsStore = JSON.parse(body);
        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const analyticsFilename = `session_analytics_${timestampStr}.json`;
        fs.writeFileSync(path.join(DATA_DIR, analyticsFilename), JSON.stringify(latestSessionAnalyticsStore, null, 2));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, saved: analyticsFilename }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

function startServer(port) {
  server.listen(port, () => {
    console.log('\n============================================================');
    console.log('   MULTIMODAL ATTENDANCE & ENGAGEMENT AGENT');
    console.log('   Privacy-Preserving Classroom Intelligence System');
    console.log('============================================================');
    console.log(`\n  Local Server Active: http://localhost:${port}`);
    console.log(`  Local IP Access:     http://127.0.0.1:${port}`);
    console.log(`  Operating Mode:      100% Offline Edge Processing`);
    console.log(`  Public Directory:    ${PUBLIC_DIR}`);
    console.log(`  Data Output:         ${DATA_DIR}\n`);
    console.log('Ready for live classroom processing or simulated dynamics.\n');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, attempting port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server failed to start:', err);
    }
  });
}

startServer(DEFAULT_PORT);
