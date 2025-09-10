// index.js
import express from 'express';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
app.use(express.json());

const STATE = new Map(); // super-simple in-memory session store

const sendMsg = async (to, payload) => {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
  console.log('📤 Sending message to:', to);
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('❌ WA send error:', data);
    console.error('❌ Status:', res.status);
    console.error('❌ Token used:', process.env.WHATSAPP_TOKEN?.substring(0, 20) + '...');
  } else {
    console.log('✅ Message sent successfully:', data);
  }
  return data;
};

// 1) Webhook verify (Meta dashboard calls this once)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my-verify-token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

// 2) Incoming messages
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    if (!msg) {
      console.log('❌ No message found in webhook payload');
      return res.sendStatus(200);
    }
    console.log('✅ Message found:', msg);

    const from = msg.from;                      // user wa_id
    const name = contact?.profile?.name || '';
    const type = msg.type;
    let text = '';
    if (type === 'text') text = (msg.text?.body || '').trim();
    if (type === 'button') text = (msg.button?.text || '').trim();
    if (type === 'interactive') {
      text = msg.interactive?.button_reply?.title
          || msg.interactive?.list_reply?.title
          || '';
      text = (text || '').trim();
    }
    const norm = (text || '').toLowerCase();

    // init session
    const sess = STATE.get(from) || { stage: 'start', item: null, amount: null, category: null };

    // route by stage
    if (sess.stage === 'start') {
      // greeting + category (interactive buttons)
      await sendMsg(from, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: `Welcome to ${process.env.BRAND_NAME} 🍴\nPlease choose a category:` },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'cat_basic', title: '1️⃣ Basics' } },
              { type: 'reply', reply: { id: 'cat_premium', title: '2️⃣ Premium' } },
            ],
          },
        },
      });
      sess.stage = 'category';
      STATE.set(from, sess);
      return res.sendStatus(200);
    }

    if (sess.stage === 'category') {
      if (norm.includes('basic') || norm.includes('1') || text === '1️⃣ Basics' || text === '1') {
        sess.category = 'Basics';
        sess.stage = 'menu_basics';
        STATE.set(from, sess);
        await sendMsg(from, {
          type: 'interactive',
          interactive: {
            type: 'list',
            header: { type: 'text', text: '🍛 Basics Menu' },
            body: { text: 'Choose an item' },
            action: {
              button: 'Select',
              sections: [
                { title: 'Basics', rows: [
                  { id: 'b1', title: 'Veg Thali', description: '₹120' },
                  { id: 'b2', title: 'Paneer Curry + Roti', description: '₹150' },
                  { id: 'b3', title: 'Dal Tadka + Rice', description: '₹100' },
                ]},
              ],
            },
          },
        });
        return res.sendStatus(200);
      }
      if (norm.includes('premium') || norm.includes('2') || text === '2️⃣ Premium' || text === '2') {
        sess.category = 'Premium';
        sess.stage = 'menu_premium';
        STATE.set(from, sess);
        await sendMsg(from, {
          type: 'interactive',
          interactive: {
            type: 'list',
            header: { type: 'text', text: '🍽️ Premium Menu' },
            body: { text: 'Choose an item' },
            action: {
              button: 'Select',
              sections: [
                { title: 'Premium', rows: [
                  { id: 'p1', title: 'Paneer Butter Masala + Naan', description: '₹240' },
                  { id: 'p2', title: 'Veg Biryani + Raita', description: '₹220' },
                  { id: 'p3', title: 'Kaju Curry + Tandoori Roti', description: '₹260' },
                ]},
              ],
            },
          },
        });
        return res.sendStatus(200);
      }
    }

    const priceMap = {
      b1: { item: 'Veg Thali', amount: 120 },
      b2: { item: 'Paneer Curry + Roti', amount: 150 },
      b3: { item: 'Dal Tadka + Rice', amount: 100 },
      p1: { item: 'Paneer Butter Masala + Naan', amount: 240 },
      p2: { item: 'Veg Biryani + Raita', amount: 220 },
      p3: { item: 'Kaju Curry + Tandoori Roti', amount: 260 },
    };

    if (sess.stage === 'menu_basics' || sess.stage === 'menu_premium') {
      // when interactive list reply arrives, WhatsApp sends interactive.list_reply.id/title,
      // but we normalized `text` to title; map both ways:
      const chosen = Object.values(priceMap).find(v => v.item.toLowerCase() === text.toLowerCase());
      let choice = chosen;
      // fallback if you parse IDs from payload (optional)
      const rowsId = msg?.interactive?.list_reply?.id;
      if (!choice && rowsId && priceMap[rowsId]) choice = priceMap[rowsId];

      if (choice) {
        sess.item = choice.item;
        sess.amount = choice.amount;
        sess.stage = 'payment';
        STATE.set(from, sess);

        await sendMsg(from, {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: `You selected ${choice.item} – ₹${choice.amount} ✅\nChoose payment:` },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'pay_upi', title: '1️⃣ UPI' } },
                { type: 'reply', reply: { id: 'pay_cod', title: '2️⃣ Cash on Delivery' } },
              ],
            },
          },
        });
        return res.sendStatus(200);
      }
    }

    if (sess.stage === 'payment') {
      if (norm.includes('upi') || norm.includes('1')) {
        const tid = Date.now().toString();
        const link =
          `upi://pay?pa=${encodeURIComponent(process.env.UPI_ID)}` +
          `&pn=${encodeURIComponent(process.env.BRAND_NAME)}` +
          `&am=${encodeURIComponent(sess.amount)}` +
          `&cu=INR&tid=${tid}`;

        sess.stage = 'await_upi';
        STATE.set(from, sess);

        // Send UPI payment instructions
        await sendMsg(from, { 
          type: 'text', 
          text: { 
            body: `💳 UPI Payment\n\nAmount: ₹${sess.amount}\nUPI ID: ${process.env.UPI_ID}\n\n📱 iPhone Users:\n1. Open your UPI app (PhonePe, GPay, Paytm)\n2. Enter UPI ID: ${process.env.UPI_ID}\n3. Enter amount: ₹${sess.amount}\n4. Add note: Order from ${process.env.BRAND_NAME}\n\n🤖 Android Users:\nClick this link: ${link}\n\n💡 Alternative for all users:\nCopy this UPI ID: ${process.env.UPI_ID}\nAnd amount: ₹${sess.amount}\n\nPayment done ho jaye to reply: PAID` 
          } 
        });
        return res.sendStatus(200);
      }
      if (norm.includes('cash') || norm.includes('cod') || norm.includes('2')) {
        const orderId = `#${Math.floor(10000 + Math.random()*89999)}`;
        const eta = 40;
        await sendMsg(from, {
          type: 'text',
          text: { body: `Your order has been placed ✅\nOrder ID: ${orderId}\nItem: ${sess.item}\nAmount: ₹${sess.amount}\nPayment: COD\nDelivery Time: ${eta} mins 🚚\nThank you for choosing ${process.env.BRAND_NAME} 🍴` }
        });
        STATE.delete(from); // reset session
        return res.sendStatus(200);
      }
    }

    if (sess.stage === 'await_upi' && /\bpaid|payment done|done\b/i.test(norm)) {
      const orderId = `#${Math.floor(10000 + Math.random()*89999)}`;
      const eta = 40;
      await sendMsg(from, {
        type: 'text',
        text: { body: `Payment received ✅\nOrder ID: ${orderId}\nItem: ${sess.item}\nAmount: ₹${sess.amount}\nDelivery Time: ${eta} mins 🚚\nThank you for your payment! 🍴` }
      });
      STATE.delete(from);
      return res.sendStatus(200);
    }

    // fallback help
    await sendMsg(from, { type: 'text', text: { body: `Type:\n• Hi (start)\n• PAID (after UPI)\n• Or choose buttons shown.` } });
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('WhatsApp bot running'));
