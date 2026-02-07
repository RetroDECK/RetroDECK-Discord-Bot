require('dotenv').config();

const http = require('node:http');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const { saveToken, TOKEN_PATH } = require('./services/token-store');

const CLIENT_ID = process.env.OC_CLIENT_ID;
const CLIENT_SECRET = process.env.OC_CLIENT_SECRET;
const REDIRECT_URI = process.env.OC_REDIRECT_URI || 'http://localhost:3000/callback';
const SCOPES = 'email,account';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing OC_CLIENT_ID or OC_CLIENT_SECRET environment variables.');
  process.exit(1);
}

const redirectUrl = new URL(REDIRECT_URI);
const PORT = parseInt(redirectUrl.port, 10) || 3000;
const CALLBACK_PATH = redirectUrl.pathname;

const state = crypto.randomBytes(16).toString('hex');

const authUrl = new URL('https://opencollective.com/oauth/authorize');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('state', state);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== CALLBACK_PATH) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const returnedState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
    console.error(`Authorization failed: ${error}`);
    shutdown(1);
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch — possible CSRF attack</h1>');
    console.error('State parameter mismatch.');
    shutdown(1);
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>No authorization code received</h1>');
    console.error('No authorization code in callback.');
    shutdown(1);
    return;
  }

  try {
    console.log('Exchanging authorization code for access token...');

    const tokenResponse = await fetch('https://opencollective.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${body}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error(`No access_token in response: ${JSON.stringify(tokenData)}`);
    }

    saveToken({
      access_token: tokenData.access_token,
      obtained_at: new Date().toISOString(),
    });

    console.log(`Token saved to ${TOKEN_PATH}`);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authorization successful!</h1><p>You can close this window. The bot token has been saved.</p>');
    shutdown(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${err.message}</p>`);
    console.error('Token exchange error:', err.message);
    shutdown(1);
  }
});

function shutdown(code) {
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 1000);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Either free the port or change OC_REDIRECT_URI to use a different port.`
    );
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT} for OAuth callback...`);
  console.log(`\nOpen this URL in your browser to authorize:\n\n  ${authUrl.toString()}\n`);

  try {
    execSync(`open "${authUrl.toString()}"`);
    console.log('(Browser opened automatically)');
  } catch {
    console.log('(Could not open browser automatically — please open the URL manually)');
  }
});
