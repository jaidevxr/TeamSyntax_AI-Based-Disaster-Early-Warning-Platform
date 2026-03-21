// Vercel Serverless Function for Secure Groq API Proxy

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'Server configuration error: GROQ API Key missing on Vercel environment.' });
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (e) {
        console.error('Vercel Proxy Error:', e);
        res.status(500).json({ error: e.message });
    }
}
