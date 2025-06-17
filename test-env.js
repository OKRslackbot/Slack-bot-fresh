require('dotenv').config();

console.log('=== ENVIRONMENT CHECK ===');
console.log('Bot Token:', process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING');
console.log('App Token:', process.env.SLACK_APP_TOKEN ? 'SET' : 'MISSING');
console.log('Signing Secret:', process.env.SLACK_SIGNING_SECRET ? 'SET' : 'MISSING');

if (!process.env.SLACK_APP_TOKEN) {
  console.log('❌ SLACK_APP_TOKEN is missing!');
  console.log('Make sure your .env file has: SLACK_APP_TOKEN=xapp-...');
}
