import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    activeSeason: { type: String, default: 'WINTER 2025' },
    lockedByAdmin: { type: Boolean, default: false },
    extraSizes: [String]
});

export default mongoose.model('Settings', SettingsSchema);
