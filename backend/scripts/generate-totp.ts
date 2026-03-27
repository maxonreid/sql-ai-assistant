import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const secret  = authenticator.generateSecret();
const service = 'SQL Assistant';
const account = 'DBA';
const otpauth = authenticator.keyuri(account, service, secret);

console.log('\n========================================');
console.log('  TOTP SECRET (save this to .env)');
console.log('========================================');
console.log(`TOTP_SECRET=${secret}`);
console.log('========================================\n');

// Print QR code directly in the terminal
QRCode.toString(otpauth, { type: 'terminal', small: true }, (err, qr) => {
  if (err) throw err;
  console.log('Scan this QR code with Google Authenticator:\n');
  console.log(qr);
  console.log('\nAfter scanning, test a code:');
  console.log(`  npx tsx backend/scripts/verify-totp.ts YOUR_6_DIGIT_CODE\n`);
});