const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = 3001;

let currentQrImage = '';
let isConnected = false;

const TARGET_PHONE = '919994191474';
const BACKEND_URL = 'http://localhost:8000/api/dashboard';

// WhatsApp Client configuration with anti-blocking & web cache fix
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wa_session' }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version-https/main/html/2.2412.54.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
    }
});

// Dynamic QR Code Generator for Live Web View
client.on('qr', async (qr) => {
    console.log('🔄 New QR Code generated, updating live page...');
    isConnected = false;
    try {
        currentQrImage = await QRCode.toDataURL(qr);
    } catch (err) {
        console.error('Failed to convert QR to DataURL:', err);
    }
});

client.on('ready', () => {
    console.log('✅ WhatsApp Web Client is Ready & Connected!');
    isConnected = true;
    currentQrImage = '';
    sendAutomaticReminders();
});

client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Authentication Failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp Disconnected:', reason);
    isConnected = false;
    client.initialize();
});

// Web endpoint for Client to scan QR Code
app.get('/scan-qr', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
                <h1 style="color: #22c55e;">✅ WhatsApp Connected Successfully!</h1>
                <p style="color: #64748b; font-size: 16px;">The automated reminder system is currently active.</p>
            </div>
        `);
    }

    if (!currentQrImage) {
        return res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
                <h2>⏳ Generating Live WhatsApp QR Code...</h2>
                <p style="color: #64748b;">Please refresh this page in a few seconds.</p>
                <script>setTimeout(() => { window.location.reload(); }, 3000);</script>
            </div>
        `);
    }

    res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
            <h2 style="color: #0f172a;">📱 Scan WhatsApp QR Code</h2>
            <p style="color: #475569;">Open WhatsApp > Settings > Linked Devices > Link a Device</p>
            <div style="margin: 20px 0;">
                <img src="${currentQrImage}" style="width: 280px; height: 280px; border: 2px solid #e2e8f0; border-radius: 12px; padding: 10px; background: white;" />
            </div>
            <p style="color: #94a3b8; font-size: 13px;">This page automatically refreshes every 15 seconds to keep the QR code active.</p>
            <script>
                setTimeout(() => { window.location.reload(); }, 15000);
            </script>
        </div>
    `);
});

// Function to send automatic pickup reminders
async function sendAutomaticReminders() {
    try {
        console.log('🔍 Checking pending pickup reminders from Backend...');
        const response = await axios.get(BACKEND_URL);
        const reminders = response.data?.reminders || [];

        const dueShops = reminders.filter(r => r.status === 'due_today' || r.status === 'overdue');

        if (dueShops.length === 0) {
            console.log('ℹ️ No pending reminders for today.');
            return;
        }

        const messageLines = dueShops.map(item => 
            `• Shop: ${item.shop_no} (${item.shop_name || 'N/A'}) - Status: ${item.status.toUpperCase()} - Date: ${item.next_pickup ? item.next_pickup.slice(0, 10) : 'N/A'}`
        );

        const message = `*Auro Product Automatic Pickup Reminder*\n\nAttention! You have pickup tasks pending:\n\n${messageLines.join("\n")}\n\nPlease action these entries immediately.`;

        const chatId = `${TARGET_PHONE}@c.us`;

        await client.sendMessage(chatId, message);
        console.log(`🚀 Automated WhatsApp Reminder Sent to ${TARGET_PHONE}!`);
    } catch (error) {
        console.error('❌ Failed to send automated reminder:', error.message);
    }
}

// Cron Job: Daily at 9:00 AM
cron.schedule('0 9 * * *', () => {
    console.log('⏰ Executing Scheduled Daily WhatsApp Reminder Job...');
    sendAutomaticReminders();
});

// Express Server & WhatsApp Client Initialization
app.listen(PORT, () => {
    console.log(`🌐 Live QR Page running at: http://localhost:${PORT}/scan-qr`);
});

client.initialize();