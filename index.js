import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS: Only allow your frontend domain
const allowedOrigins = ['https://payadollartoseehowmanypeoplepaidadollar.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.options('*', cors()); // handle preflight

// ✅ Parse JSON (after raw webhook middleware)
app.use(bodyParser.json());

// ✅ Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// ✅ Firebase setup
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.FIREBASE_CONFIG_PATH || './firebase-service-account.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ✅ Webhook route uses raw body
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const counterRef = db.collection('stats').doc('live');
    try {
      await counterRef.update({
        total: admin.firestore.FieldValue.increment(1),
      });
      console.log('💰 Payment received, Firestore updated');
    } catch (error) {
      console.error('❌ Firestore update failed:', error);
    }
  }

  res.json({ received: true });
});

// ✅ Create checkout session
app.post('/create-checkout-session', async (req, res) => {
  const token = uuidv4();

  await db.collection('accessTokens').doc(token).set({
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Curiosity Counter Access',
            },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      success_url: `https://payadollartoseehowmanypeoplepaidadollar.com/thankyou.html?token=${token}`,
      cancel_url: `https://payadollartoseehowmanypeoplepaidadollar.com`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Failed to create checkout session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ✅ Simple health check
app.get('/', (req, res) => {
  res.send('Stripe webhook backend is live!');
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
