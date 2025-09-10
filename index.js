// index.js
import express from 'express';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
app.use(express.json());

const STATE = new Map(); // super-simple in-memory session store

const sendMsg = async (to, payload) => {
  const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) console.error('WA send error:', data);
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
      // greeting + category (simple text with instructions)
      await sendMsg(from, {
        type: 'text',
        text: { 
          body: `Welcome to ${process.env.BRAND_NAME} 🍴\n\nPlease choose a category by typing:\n\n1️⃣ Type "1" or "basics" for Basics Menu\n2️⃣ Type "2" or "premium" for Premium Menu\n\nOr simply type the number!` 
        }
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
          type: 'text',
          text: { 
            body: `🍛 Basics Menu\n\nChoose an item by typing the number:\n\n1️⃣ Veg Thali - ₹120\n2️⃣ Paneer Curry + Roti - ₹150\n3️⃣ Dal Tadka + Rice - ₹100\n\nType the number (1, 2, or 3) to select!` 
          }
        });
        return res.sendStatus(200);
      }
      if (norm.includes('premium') || norm.includes('2') || text === '2️⃣ Premium' || text === '2') {
        sess.category = 'Premium';
        sess.stage = 'menu_premium';
        STATE.set(from, sess);
        await sendMsg(from, {
          type: 'text',
          text: { 
            body: `🍽️ Premium Menu\n\nChoose an item by typing the number:\n\n1️⃣ Paneer Butter Masala + Naan - ₹240\n2️⃣ Veg Biryani + Raita - ₹220\n3️⃣ Kaju Curry + Tandoori Roti - ₹260\n\nType the number (1, 2, or 3) to select!` 
          }
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
      // Handle number selection for menu items
      let choice = null;
      
      if (text === '1' || norm.includes('1')) {
        choice = sess.stage === 'menu_basics' ? priceMap.b1 : priceMap.p1;
      } else if (text === '2' || norm.includes('2')) {
        choice = sess.stage === 'menu_basics' ? priceMap.b2 : priceMap.p2;
      } else if (text === '3' || norm.includes('3')) {
        choice = sess.stage === 'menu_basics' ? priceMap.b3 : priceMap.p3;
      }

      if (choice) {
        sess.item = choice.item;
        sess.amount = choice.amount;
        sess.stage = 'payment';
        STATE.set(from, sess);

        await sendMsg(from, {
          type: 'text',
          text: { 
            body: `You selected ${choice.item} – ₹${choice.amount} ✅\n\nChoose payment method by typing:\n\n1️⃣ Type "1" or "upi" for UPI Payment\n2️⃣ Type "2" or "cod" for Cash on Delivery\n\nType the number or method name!` 
          }
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

        await sendMsg(from, { type: 'text', text: { body: `Pay via UPI:\n${link}\n\nPayment done ho jaye to reply: PAID` } });
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
