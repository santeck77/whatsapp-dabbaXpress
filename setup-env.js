// Setup script to create .env file with your Meta App credentials
import fs from 'fs';

const envContent = `# WhatsApp Cloud API Configuration
WHATSAPP_TOKEN=EAATNw9xhAvEBPWrl1uxyedTAOtf9LI6efVXkc0XK85gSXoJqhl14A6LbVLOzLgQeb2Lwvs61UJ
PHONE_NUMBER_ID=714448665094548
VERIFY_TOKEN=my-verify-token

# Business Information
BRAND_NAME=DabbaXpress
UPI_ID=your-upi-id@paytm

# Server Configuration
PORT=3000`;

try {
  fs.writeFileSync('.env', envContent);
  console.log('✅ .env file created successfully!');
  console.log('\n📋 Your configuration:');
  console.log('- App Name: DabbaXpress');
  console.log('- Phone Number ID: 714448665094548');
  console.log('- Test Number: +1 555 160 5262');
  console.log('\n⚠️  Important: Update UPI_ID with your actual UPI ID');
  console.log('⚠️  Note: This is a temporary token - generate permanent token for production');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('\n📝 Please manually create .env file with the following content:');
  console.log(envContent);
}
