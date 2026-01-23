import mongoose from 'mongoose';
import dbConnect from './_utils/dbConnect.js';

// Define Schema (Must match server.js logic)
const CartonSchema = new mongoose.Schema({
    buyer: String,
    storeName: String,
    cartonNo: String,
    measurement: String,
    netWeight: String,
    grossWeight: String,
    rows: [mongoose.Schema.Types.Mixed],
    timestamp: { type: Date, default: Date.now }
});

// Prevent model overwrite
const Carton = mongoose.models.Carton || mongoose.model('Carton', CartonSchema);

export default async function handler(req, res) {
    await dbConnect();

    if (req.method === 'GET') {
        try {
            const cartons = await Carton.find({}).sort({ timestamp: 1 });
            res.status(200).json(cartons);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    } else if (req.method === 'POST') {
        try {
            const carton = new Carton(req.body);
            await carton.save();
            res.status(200).json(carton);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
