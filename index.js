import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Stripe with your live key
const stripe = new 
Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Load Firebase service account JSON
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.FIREBASE_CONFIG_PATH || 
'./firebase-service-account.json', 'utf8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(bodyParser.json());

// Simple test route
app.get('/', (req, res) => {
  res.send('Stripe webhook backend is live!');
});

// Stripe webhook route
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) 
=> {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'whsec_CcJHqVUsDYbdAJ6YRkljhLLxnQh4YfBA';
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const db = admin.firestore();
    const counterRef = db.collection('config').doc('counter');

    counterRef.update({
      count: admin.firestore.FieldValue.increment(1),
    }).then(() => {
      console.log('✅ Counter incremented!');
    }).catch((error) => {
      console.error('❌ Error updating counter:', error);
    });
  }

  res.status(200).json({ received: true });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

