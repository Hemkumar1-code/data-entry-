import mongoose from 'mongoose';

const CartonSchema = new mongoose.Schema({
    cartonNo: String,
    season: String,
    storeName: String,
    buyer: String,

    // Row Item Details
    rows: [{
        print: String,
        style: String,
        sizes: Object, // { S: 10, M: 20 }
        totalPcs: Number
    }],

    // Global Details
    netWeight: String,
    grossWeight: String,
    measurement: String,

    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Carton', CartonSchema);
