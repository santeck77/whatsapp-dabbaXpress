# WhatsApp Food Ordering Bot

A complete WhatsApp Cloud API bot for food ordering with interactive menus, UPI payments, and Cash on Delivery (COD) functionality.

## Features

- 🍴 Interactive food menu with categories (Basics & Premium)
- 💳 UPI payment integration with deeplinks
- 💰 Cash on Delivery (COD) option
- 📱 Interactive buttons and lists for better UX
- 🎯 Session management for order tracking
- 📋 Order confirmation with unique order IDs

## Prerequisites

- Node.js 18+ installed
- Meta Developer Account
- WhatsApp Business Account
- Public HTTPS URL for webhook (ngrok, Vercel, Railway, etc.)

## Setup Instructions

### 1. Meta Developer Setup

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Create a new app → Select "Business" → Choose "WhatsApp"
3. Add a test phone number and get your **Phone Number ID**
4. Generate a **Permanent Access Token**:
   - Go to Business Settings → System Users
   - Create/select a system user
   - Generate token with `whatsapp_business_messaging` permissions

### 2. Project Setup

```bash
# Clone or download this project
cd whatsapp-food-bot

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Edit .env with your credentials
```

### 3. Environment Configuration

Edit your `.env` file with the following values:

```env
# WhatsApp Cloud API Configuration
WHATSAPP_TOKEN=your_permanent_access_token_here
PHONE_NUMBER_ID=your_phone_number_id_here
VERIFY_TOKEN=my-verify-token

# Business Information
BRAND_NAME=Your Restaurant Name
UPI_ID=your-upi-id@paytm

# Server Configuration
PORT=3000
```

### 4. Webhook Setup

1. **Start your server locally:**
   ```bash
   npm start
   ```

2. **Expose your local server using ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Configure webhook in Meta Dashboard:**
   - Go to your WhatsApp app → Configuration
   - Set webhook URL: `https://your-ngrok-url.ngrok.io/webhook`
   - Set verify token: `my-verify-token` (or your custom token)
   - Subscribe to `messages` events

### 5. Test the Bot

1. Send a message to your WhatsApp test number
2. The bot will respond with category options
3. Follow the interactive menu to place an order

## Menu Structure

### Basics Category
- Veg Thali - ₹120
- Paneer Curry + Roti - ₹150
- Dal Tadka + Rice - ₹100

### Premium Category
- Paneer Butter Masala + Naan - ₹240
- Veg Biryani + Raita - ₹220
- Kaju Curry + Tandoori Roti - ₹260

## Payment Methods

### UPI Payment
- Generates UPI deeplink for instant payment
- User confirms payment by typing "PAID"
- Order confirmation with unique order ID

### Cash on Delivery
- Direct order placement
- Immediate confirmation
- 40-minute delivery estimate

## API Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Message handling

## Deployment Options

### Vercel
```bash
npm install -g vercel
vercel
```

### Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

## Production Considerations

1. **Security:**
   - Use environment variables for all sensitive data
   - Implement webhook signature verification
   - Rotate access tokens regularly

2. **Session Management:**
   - Replace in-memory Map with Redis or database
   - Implement session expiration

3. **Error Handling:**
   - Add comprehensive logging
   - Implement retry mechanisms

4. **Payment Integration:**
   - Integrate with Razorpay/PayU for automatic payment confirmation
   - Add payment gateway webhooks

## Customization

### Adding New Menu Items
Edit the `priceMap` object in `index.js`:

```javascript
const priceMap = {
  b1: { item: 'Veg Thali', amount: 120 },
  b2: { item: 'Paneer Curry + Roti', amount: 150 },
  // Add new items here
  b4: { item: 'New Item', amount: 180 },
};
```

### Modifying Categories
Update the interactive buttons and lists in the message handlers.

### Changing Business Info
Update the `BRAND_NAME` and `UPI_ID` in your `.env` file.

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages:**
   - Check if webhook URL is accessible
   - Verify webhook token matches
   - Ensure HTTPS is enabled

2. **Messages not sending:**
   - Verify access token permissions
   - Check phone number ID
   - Ensure user has initiated conversation

3. **UPI links not working:**
   - Verify UPI ID format
   - Test on mobile device
   - Check UPI app installation

## Support

For issues and questions:
- Check Meta's [WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- Review webhook setup guide
- Test with Meta's webhook testing tools

## License

MIT License - feel free to use and modify for your business needs.
