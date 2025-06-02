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
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const db = admin.firestore();
    const counterRef = db.collection('stats').doc('payments');

    counterRef.update({
      count: admin.firestore.FieldValue.increment(1)
    }).then(() => {
      console.log('Payment count incremented');
    }).catch((error) => {
      console.error('Error updating Firestore:', error);
    });
  }

  res.status(200).json({ received: true });
});

