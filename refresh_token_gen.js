/**
 * Run: node refresh_token_gen.js
 * It will open a local server, print a URL to visit, then print your refresh token.
 */

const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const CLIENT_ID     = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3333/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/adwords'],
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) return;

  const code = new URL(req.url, 'http://localhost:3333').searchParams.get('code');
  if (!code) {
    res.end('No code found. Try again.');
    return;
  }

  res.end('<h2>✅ Done! Check your terminal for the refresh token. You can close this tab.</h2>');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Success! Add this to your .env file:\n');
    console.log(`REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nThen delete refresh_token_gen.js\n');
  } catch (err) {
    console.error('❌ Token exchange failed:', err.message);
  }

  server.close();
});

server.listen(3333, () => {
  console.log('\n👉 Visit this URL in your browser:\n');
  console.log(url);
  console.log('\nWaiting for Google to redirect back...\n');
});
