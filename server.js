/**
 * Localhost Web Server for Agentic EQ Reply
 * Serves the Sidepanel view as the primary workspace on http://localhost:3000
 * and provides a local CORS proxy for real AI model verification tests.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Local AI API Proxy to bypass browser localhost CORS restrictions during live verification
  if (pathname === '/api/proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const targetUrl = payload.url;
        const targetMethod = payload.method || 'POST';
        const targetHeaders = payload.headers || {};
        const targetBody = payload.body;

        const fetchOptions = {
          method: targetMethod,
          headers: targetHeaders
        };
        if (targetMethod !== 'GET' && targetMethod !== 'HEAD' && targetBody !== undefined && targetBody !== null) {
          fetchOptions.body = typeof targetBody === 'string' ? targetBody : JSON.stringify(targetBody);
        }

        const proxyRes = await fetch(targetUrl, fetchOptions);

        const resText = await proxyRes.text();
        res.writeHead(proxyRes.status, {
          'Content-Type': proxyRes.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(resText);
      } catch (proxyErr) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: { message: `Proxy error: ${proxyErr.message}` } }));
      }
    });
    return;
  }

  // Root URL Workspace: Serve sidepanel directly as the root URL (/) without redirecting
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/sidepanel/sidepanel.html';
  }

  let filePath = path.normalize(path.join(BASE_DIR, pathname));

  // Security: Prevent directory traversal outside BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Robust asset fallback: if a relative file like /sidepanel.css or /sidepanel.js is requested at root, find it in /sidepanel/
  if (!fs.existsSync(filePath)) {
    const candidateInSidepanel = path.normalize(path.join(BASE_DIR, 'sidepanel', pathname));
    if (candidateInSidepanel.startsWith(BASE_DIR) && fs.existsSync(candidateInSidepanel) && fs.statSync(candidateInSidepanel).isFile()) {
      filePath = candidateInSidepanel;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Agentic EQ Reply Workspace is LIVE on Port ${PORT}!`);
  console.log(`📍 Primary Workspace (Root URL):       http://localhost:${PORT}/`);
  console.log(`📱 Direct Sidepanel URL:              http://localhost:${PORT}/sidepanel/sidepanel.html`);
  console.log(`⚙️ Settings & Configuration:          http://localhost:${PORT}/options/options.html`);
  console.log(`======================================================\n`);
});
