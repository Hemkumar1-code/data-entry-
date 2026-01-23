export default async function handler(req, res) {
    // Log the request for debugging in Vercel logs
    console.log(`[${req.method}] /api/cartons`, req.body || 'No Body');

    if (req.method === 'GET') {
        // Return empty array (or mock data) since we have no DB
        res.status(200).json([]);
    } else if (req.method === 'POST') {
        const carton = req.body;

        // Log the carton data to simulate "saving"
        console.log("Mock Saving Carton:", JSON.stringify(carton, null, 2));

        // Return success response immediately
        res.status(200).json({
            success: true,
            message: 'Carton received successfully (No DB Mode)',
            ...carton
        });
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
