import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE", "PUT"]
    }
});

app.use(cors());
app.use(express.json());

// --- Excel Database Logic ---
const DB_FILE = 'master_db.xlsx';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, DB_FILE);

// Initialize DB if missing
if (!fs.existsSync(DB_PATH)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, "Cartons");

    // Settings Sheet
    const wsSettings = XLSX.utils.json_to_sheet([{ activeSeason: 'WINTER 2025', lockedByAdmin: false, extraSizes: "[]" }]);
    XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");

    XLSX.writeFile(wb, DB_PATH);
    console.log(`Initialized ${DB_FILE}`);
}

// Helper: Read Entire DB
const readDB = () => {
    const wb = XLSX.readFile(DB_PATH);

    // Cartons
    let cartons = [];
    if (wb.Sheets["Cartons"]) {
        const raw = XLSX.utils.sheet_to_json(wb.Sheets["Cartons"]);
        // Parse the JSON stringified 'data' column if we use that structure,
        // OR if we flatten, we read as is. Plan said "Stringifying complex data".
        // Let's assume schema: { _id, data: JSON_STRING, updatedBy }
        cartons = raw.map(row => {
            try {
                return typeof row.data === 'string' ? JSON.parse(row.data) : row;
            } catch (e) {
                return row;
            }
        });
    }

    // Settings
    let settings = { activeSeason: 'WINTER 2025', extraSizes: [] };
    if (wb.Sheets["Settings"]) {
        const rawSettings = XLSX.utils.sheet_to_json(wb.Sheets["Settings"]);
        if (rawSettings.length > 0) {
            const s = rawSettings[0];
            // Parse extraSizes if stringified
            if (typeof s.extraSizes === 'string') {
                try { s.extraSizes = JSON.parse(s.extraSizes); } catch (e) { }
            }
            settings = { ...settings, ...s };
        }
    }

    return { cartons, settings };
};

// Helper: Write DB
const writeDB = (cartons, settings) => {
    const wb = XLSX.utils.book_new();

    // 1. Cartons -> Serialize complex objects to avoid Excel destruction
    const cartonRows = cartons.map(c => ({
        _id: c._id,
        timestamp: c.timestamp,
        // Store full object as JSON string to preserve arrays/nested objects perfecty
        data: JSON.stringify(c)
    }));
    const wsCartons = XLSX.utils.json_to_sheet(cartonRows);
    XLSX.utils.book_append_sheet(wb, wsCartons, "Cartons");

    // 2. Settings
    const settingRow = {
        ...settings,
        extraSizes: JSON.stringify(settings.extraSizes || [])
    };
    const wsSettings = XLSX.utils.json_to_sheet([settingRow]);
    XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");

    XLSX.writeFile(wb, DB_PATH);
};

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    console.log('🔌 Client Connected:', socket.id);
    socket.join('updates');
    socket.on('disconnect', () => console.log('❌ Client Disconnected:', socket.id));
});

// --- API Routes ---

// GET All Cartons
app.get('/api/cartons', (req, res) => {
    try {
        const { cartons } = readDB();
        // Sort by timestamp if needed, but array order usually preserved
        res.json(cartons);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST (Add/Update) Carton
app.post('/api/cartons', (req, res) => {
    try {
        const newCarton = req.body;
        // Ensure ID
        if (!newCarton._id || newCarton._id.length < 10) {
            newCarton._id = Date.now().toString(); // Simple ID for Excel
        }

        const { cartons, settings } = readDB();

        const idx = cartons.findIndex(c => c._id === newCarton._id);
        if (idx > -1) {
            cartons[idx] = newCarton;
        } else {
            cartons.push(newCarton);
        }

        writeDB(cartons, settings);

        io.to('updates').emit('sync_cartons', { type: 'UPDATE', carton: newCarton });

        // Notify about Admin update if needed (simple check if user is admin? 
        // We don't have auth context here easily, but we can assume *any* write triggers refresh for safety
        // or just rely on 'sync_cartons' which we already have on frontend)

        res.json(newCarton);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE Carton
app.delete('/api/cartons/:id', (req, res) => {
    try {
        const { cartons, settings } = readDB();
        const newCartons = cartons.filter(c => c._id !== req.params.id);

        if (newCartons.length !== cartons.length) {
            writeDB(newCartons, settings);
            io.emit('sync_cartons', { type: 'DELETE', id: req.params.id });
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET Settings
app.get('/api/settings', (req, res) => {
    try {
        const { settings } = readDB();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST Settings
app.post('/api/settings', (req, res) => {
    try {
        const update = req.body;
        const { cartons, settings } = readDB();
        const newSettings = { ...settings, ...update };

        writeDB(cartons, newSettings);

        io.emit('sync_settings', newSettings);

        // If Admin locked season, maybe force refresh?
        io.emit('admin_refresh_request', { message: "Global Settings Updated" });

        res.json(newSettings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Upload Files (Simple Mock or Multer if needed later, ignoring for Sync task unless requested)
app.post('/api/upload', (req, res) => {
    res.json({ message: "File upload endpoint placeholder" });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 Storage: ${DB_FILE}`);
});
