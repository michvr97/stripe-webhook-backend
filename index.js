import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const serviceAccount = 
JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const rawBodyBuffer = (req, res, buf) => {
  req.rawBody = buf;
};

app.post('/webhook', bodyParser.raw({ type: 'application/json', verify: 
rawBodyBuffer }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, 
process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('✅ Stripe checkout.session.completed received');
    const docRef = db.doc('stats/live');
    docRef.update({
      total: admin.firestore.FieldValue.increment(1),
    });
  }

  res.json({ received: true });
});

app.get('/', (req, res) => {
  res.send('Stripe webhook backend is running.');
});

app.listen(port, () => {
  console.log(`🚀 Listening on port ${port}`);
});

