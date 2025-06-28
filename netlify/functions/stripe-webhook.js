// File: /netlify/functions/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    console.log('🎯 Webhook function called');
    
    // Simple health check for GET requests
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'Webhook endpoint is working!',
                timestamp: new Date().toISOString()
            })
        };
    }
    
    // Handle POST requests (actual webhooks)
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('❌ STRIPE_WEBHOOK_SECRET not found');
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Webhook secret not configured' })
        };
    }

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
        console.log('✅ Webhook verified:', stripeEvent.type);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid signature' })
        };
    }

    // Log the event (replace with actual processing later)
    console.log('📨 Received event:', stripeEvent.type, stripeEvent.id);
    
    // For now, just acknowledge receipt
    switch (stripeEvent.type) {
        case 'payment_intent.succeeded':
            console.log('💰 Payment succeeded:', stripeEvent.data.object.id);
            break;
        case 'invoice.payment_succeeded':
            console.log('📄 Invoice payment succeeded');
            break;
        case 'customer.subscription.created':
            console.log('📝 Subscription created');
            break;
        case 'customer.subscription.updated':
            console.log('🔄 Subscription updated');
            break;
        case 'customer.subscription.deleted':
            console.log('❌ Subscription cancelled');
            break;
        case 'invoice.payment_failed':
            console.log('⚠️ Payment failed');
            break;
        default:
            console.log('🔍 Unhandled event type:', stripeEvent.type);
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
    };
};
