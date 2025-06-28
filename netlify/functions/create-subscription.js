// File: /netlify/functions/create-subscription.js
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
        const { paymentMethodId, priceId, userId, email } = JSON.parse(event.body);

        // Validate the price ID matches your products
        const validPriceIds = [
            'price_1Rf4ARGE2UnpnMgY1HPtFpnL', // Pro Monthly
            'price_1Rf4AkGE2UnpnMgYRRhmX90T'  // Premium Monthly
        ];

        if (!validPriceIds.includes(priceId)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid price ID' })
            };
        }

        // Create or retrieve customer
        let customer;
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({
                email: email,
                metadata: { userId: userId }
            });
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customer.id,
        });

        // Set as default payment method
        await stripe.customers.update(customer.id, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                userId: userId
            }
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscriptionId: subscription.id,
                status: subscription.status,
                client_secret: subscription.latest_invoice.payment_intent.client_secret
            })
        };

    } catch (error) {
        console.error('Error creating subscription:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};