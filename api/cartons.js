import { GOOGLE_SCRIPT_URL } from '../src/utils/constants.js';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Check if URL is configured
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
        console.error("GOOGLE_SCRIPT_URL is not configured in src/utils/constants.js");
        return res.status(500).json({
            error: "Backend Setup Required: Please add your Google Web App URL to src/utils/constants.js"
        });
    }

    if (req.method === 'GET') {
        try {
            const googleRes = await fetch(GOOGLE_SCRIPT_URL);
            if (!googleRes.ok) throw new Error("Failed to fetch from Google Sheets");
            const data = await googleRes.json();
            res.status(200).json(data);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to connect to Google Sheet database" });
        }
    } else if (req.method === 'POST') {
        try {
            const googleRes = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });

            if (!googleRes.ok) throw new Error("Failed to save to Google Sheets");
            const result = await googleRes.json();

            if (result.error) throw new Error(result.error);

            res.status(200).json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
