// File: /netlify/functions/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// For Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: 'pricedropstalker-e1061',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid signature' })
        };
    }

    console.log('✅ Webhook received:', stripeEvent.type);

    try {
        switch (stripeEvent.type) {
            case 'payment_intent.succeeded':
                await handleLifetimePayment(stripeEvent.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handleSubscriptionPayment(stripeEvent.data.object);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(stripeEvent.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(stripeEvent.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCancelled(stripeEvent.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(stripeEvent.data.object);
                break;

            default:
                console.log(`🔍 Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};

// Handle successful lifetime payment
async function handleLifetimePayment(paymentIntent) {
    const userId = paymentIntent.metadata.userId;
    
    if (userId && paymentIntent.metadata.type === 'lifetime_license') {
        try {
            await db.collection('users').doc(userId).update({
                plan: 'premium',
                planType: 'lifetime',
                paymentStatus: 'paid',
                paymentIntentId: paymentIntent.id,
                lifetimePurchaseDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ Upgraded user ${userId} to lifetime plan`);
            
            // Optional: Send confirmation email here
            
        } catch (error) {
            console.error('❌ Error updating user for lifetime payment:', error);
        }
    }
}

// Handle successful subscription payment
async function handleSubscriptionPayment(invoice) {
    try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata.userId;
        
        if (!userId) {
            console.log('⚠️ No userId in subscription metadata');
            return;
        }

        // Determine plan based on price ID
        const priceId = invoice.lines.data[0].price.id;
        let planType = 'pro-monthly';
        let plan = 'pro';
        
        switch(priceId) {
            case 'price_1Rf4ARGE2UnpnMgY1HPtFpnL': // Pro Monthly
                planType = 'pro-monthly';
                plan = 'pro';
                break;
            case 'price_1Rf4AkGE2UnpnMgYRRhmX90T': // Premium Monthly
                planType = 'premium-monthly';
                plan = 'premium';
                break;
            default:
                console.log(`⚠️ Unknown price ID: ${priceId}`);
                return;
        }

        await db.collection('users').doc(userId).update({
            plan: plan,
            planType: planType,
            subscriptionId: subscription.id,
            paymentStatus: 'active',
            lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
            nextBillingDate: new Date(subscription.current_period_end * 1000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Updated subscription for user ${userId} - Plan: ${planType}`);

    } catch (error) {
        console.error('❌ Error handling subscription payment:', error);
    }
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
    const userId = subscription.metadata.userId;
    
    if (userId) {
        console.log(`📝 Subscription created for user ${userId}`);
        // The actual upgrade happens on first payment (invoice.payment_succeeded)
    }
}

// Handle subscription updated  
async function handleSubscriptionUpdated(subscription) {
    const userId = subscription.metadata.userId;
    
    if (userId) {
        console.log(`🔄 Subscription updated for user ${userId} - Status: ${subscription.status}`);
        
        // Update subscription status in Firebase
        await db.collection('users').doc(userId).update({
            subscriptionStatus: subscription.status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

// Handle subscription cancelled
async function handleSubscriptionCancelled(subscription) {
    const userId = subscription.metadata.userId;
    
    if (userId) {
        try {
            await db.collection('users').doc(userId).update({
                plan: 'free',
                planType: 'free',
                paymentStatus: 'cancelled',
                subscriptionId: null,
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`❌ Cancelled subscription for user ${userId}`);

        } catch (error) {
            console.error('❌ Error handling subscription cancellation:', error);
        }
    }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
    try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = subscription.metadata.userId;
        
        if (userId) {
            await db.collection('users').doc(userId).update({
                paymentStatus: 'past_due',
                lastFailedPayment: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`⚠️ Payment failed for user ${userId}`);
            
            // Optional: Send payment failure notification email
        }

    } catch (error) {
        console.error('❌ Error handling payment failure:', error);
    }
}