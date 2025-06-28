// File: /netlify/functions/create-payment-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { amount, paymentMethodId, userId, email } = JSON.parse(event.body);

        // Validate amount for lifetime license
        if (amount !== 2500) { // $25.00 in cents
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid amount' })
            };
        }

        // Create payment intent for lifetime license
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method: paymentMethodId,
            confirmation_method: 'manual',
            confirm: true,
            return_url: `${process.env.URL || 'https://your-netlify-site.netlify.app'}/dashboard.html`,
            metadata: {
                userId: userId,
                email: email,
                type: 'lifetime_license',
                priceId: 'price_1Rf4BqGE2UnpnMgYG5HD1emE'
            }
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                client_secret: paymentIntent.client_secret
            })
        };

    } catch (error) {
        console.error('Error creating payment intent:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};