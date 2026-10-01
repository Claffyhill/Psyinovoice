import { whatsappToken, whatsappApiUrl } from '../config/sms.js';

function formatearNumero(numero) {
    const limpio = String(numero).replace(/[\s\-\(\)]/g, '');
    return limpio.startsWith('+') ? limpio.slice(1) : limpio;
}

export async function sendSms(to, message) {
    if (!to) return;
    try {
        const response = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: formatearNumero(to),
                type: 'text',
                text: { body: message }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Error WhatsApp API (${response.status}):`, error);
        }
    } catch (err) {
        console.error(`Error enviando WhatsApp a ${to}:`, err.message);
    }
}
