const http = require('http');
const express = require('express');
require('dotenv').config({ path: 'tma/.env' }); // Adjust if needed

// We mock environment variables needed to start the server
process.env.PORT = '8080';
process.env.SUPABASE_URL = 'http://localhost:8080';
process.env.SUPABASE_ANON_KEY = 'mock_key';
process.env.RAZORPAY_KEY_ID = 'mock_rzp_key';
process.env.RAZORPAY_KEY_SECRET = 'mock_rzp_secret';
process.env.BOT_TOKEN = 'mock_bot_token';
process.env.NODE_ENV = 'development'; // Bypasses Telegram init data validation

// We can monkey patch the app after importing it to bypass validateTelegramData
const app = require('./tma/server.js');
const server = http.createServer(app);

server.listen(8080, async () => {
    console.log("Test server started.");

    // Test Razorpay endpoint
    try {
        const rzpRes = await fetch('http://localhost:8080/api/payment/create-razorpay-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'ind_monthly', amount: 100 }) // Sending wrong amount
        });
        const rzpText = await rzpRes.text();
        console.log("Razorpay Response:", rzpRes.status, rzpText);
    } catch (e) {
        console.error("Razorpay Test Error:", e);
    }

    // Test Stars endpoint
    try {
        const starsRes = await fetch('http://localhost:8080/api/payment/create-stars-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'ind_monthly', amount: 1 }) // Sending wrong amount
        });
        const starsText = await starsRes.text();
        console.log("Stars Response:", starsRes.status, starsText);
    } catch (e) {
         console.error("Stars Test Error:", e);
    }

    server.close();
});
