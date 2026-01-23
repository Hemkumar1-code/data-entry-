import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import cors from 'cors';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = 'local_db.json';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- MONGODB & LOCAL FALLBACK SETUP ---
let useMongoDB = false;
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erp_data_entry';

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log('✅ MongoDB Connected. Using Database Storage.');
        useMongoDB = true;
    })
    .catch(err => {
        console.warn('⚠️ MongoDB Connection Failed. Switching to Local JSON File Storage.');
        console.error('Error:', err.message);
        useMongoDB = false;
    });

// Schema for Mongo
const FileRecordSchema = new mongoose.Schema({
    fileName: String,
    uploadDate: { type: Date, default: Date.now },
    fileSize: String,
    rowCount: Number,
    stores: [String],
    styles: [String],
    prints: [String],
    detectedColumns: {
        storeColumn: String,
        styleColumn: String,
        printColumn: String,
        colourColumn: String
    },
    status: { type: String, enum: ['SUCCESS', 'PARTIAL', 'FAILED'], default: 'SUCCESS' },
    errorReason: String,
    rows: [[mongoose.Schema.Types.Mixed]]
});
const FileRecord = mongoose.model('FileRecord', FileRecordSchema);

const CartonSchema = new mongoose.Schema({
    buyer: String,
    storeName: String,
    cartonNo: String,
    measurement: String,
    netWeight: String,
    grossWeight: String,
    rows: [mongoose.Schema.Types.Mixed], // { print, style, sizes: {...}, totalPcs }
    timestamp: { type: Date, default: Date.now }
});
const Carton = mongoose.model('Carton', CartonSchema);

const SettingsSchema = new mongoose.Schema({
    activeSeason: String,
    extraSizes: [String],
    _id: { type: String, default: 'global_settings' } // Singleton
});
const Settings = mongoose.model('Settings', SettingsSchema);

// --- DB ADAPTER ---
const DB = {
    async getAll() {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            return await FileRecord.find({}, '-rows').sort({ uploadDate: -1 });
        } else {
            return readLocalDB().map(f => {
                const { rows, ...rest } = f;
                return rest;
            }).sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        }
    },
    async getOne(id) {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            return await FileRecord.findById(id);
        } else {
            const data = readLocalDB();
            return data.find(f => f._id === id);
        }
    },
    async save(data) {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            const record = new FileRecord(data);
            return await record.save();
        } else {
            const records = readLocalDB();
            const newRecord = { _id: Date.now().toString(), ...data, uploadDate: new Date() };
            records.push(newRecord);
            writeLocalDB(records);
            return newRecord;
        }
    },
    async delete(id) {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            return await FileRecord.findByIdAndDelete(id);
        } else {
            const records = readLocalDB();
            const filtered = records.filter(f => f._id !== id);
            writeLocalDB(filtered);
            return { message: 'Deleted' };
        }
    },

    // --- CARTON METHODS ---
    async getCartons() {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            return await Carton.find({}).sort({ timestamp: 1 });
        } else {
            return readLocalDB().filter(r => r.isCarton).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
    },
    async saveCarton(data) {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            const carton = new Carton(data);
            return await carton.save();
        } else {
            const records = readLocalDB();
            const newCarton = { _id: Date.now().toString(), ...data, isCarton: true, timestamp: new Date() };
            records.push(newCarton);
            writeLocalDB(records);
            return newCarton;
        }
    },
    async clearCartons() {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            return await Carton.deleteMany({});
        } else {
            const records = readLocalDB();
            const filtered = records.filter(r => !r.isCarton); // Keep files, remove cartons (if mixed)
            writeLocalDB(filtered);
            return { message: 'Cleared' };
        }
    },

    // --- SETTINGS METHODS ---
    async getSettings() {
        const DEFAULT_SETTINGS = { activeSeason: "WINTER 2025", extraSizes: [] };
        if (useMongoDB && mongoose.connection.readyState === 1) {
            const s = await Settings.findById('global_settings');
            return s || DEFAULT_SETTINGS;
        } else {
            const records = readLocalDB();
            const s = records.find(r => r.isSettings);
            return s || DEFAULT_SETTINGS;
        }
    },
    async saveSettings(data) {
        if (useMongoDB && mongoose.connection.readyState === 1) {
            // Upsert
            return await Settings.findByIdAndUpdate('global_settings', { ...data, _id: 'global_settings' }, { new: true, upsert: true });
        } else {
            const records = readLocalDB();
            // Remove old settings
            const filtered = records.filter(r => !r.isSettings);
            const newSettings = { ...data, isSettings: true, _id: 'global_settings' };
            filtered.push(newSettings);
            writeLocalDB(filtered);
            return newSettings;
        }
    }
};

// Local DB Helpers
const readLocalDB = () => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data) || [];
    } catch (e) { return []; }
};
const writeLocalDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};


// --- PROCESSING LOGIC ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const getCellValue = (cell) => {
    if (cell === null || cell === undefined) return "";
    return String(cell).trim();
};

const isNumeric = (val) => {
    return /^\d+$/.test(val);
};

const scoreHeaderRow = (row) => {
    let score = 0;
    const lowerRow = row.map(c => String(c).toLowerCase().trim());

    if (lowerRow.some(c => c.includes('style') || c.includes('article') || c.includes('style no'))) score += 3;
    if (lowerRow.some(c => c.includes('colour') || c.includes('color'))) score += 2;
    if (lowerRow.some(c => c.includes('print'))) score += 2;
    if (lowerRow.some(c => c.includes('store') || c.includes('retailer') || c.includes('order no') || c.includes('buyer'))) score += 2;
    if (lowerRow.some(c => c.includes('size'))) score += 1;
    if (lowerRow.some(c => c.includes('qty'))) score += 1;

    return score;
};

const processFile = (buffer, filename) => {
    let workbook;
    try {
        workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (e) {
        return {
            fileName: filename, status: 'FAILED', errorReason: 'Corrupted Excel file',
            fileSize: (buffer.length / 1024).toFixed(2) + ' KB', rowCount: 0, rows: []
        };
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { fileName: filename, status: 'FAILED', errorReason: 'No sheets found', rows: [] };

    const sheet = workbook.Sheets[sheetName];
    // Use header:1 to get raw array. 
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rawRows || rawRows.length === 0) {
        return {
            fileName: filename, status: 'FAILED', errorReason: 'File is empty',
            fileSize: (buffer.length / 1024).toFixed(2) + ' KB', rowCount: 0, rows: []
        };
    }

    // 1. HEADER ROW DETECTION (Scan 50 rows)
    let headerRowIdx = -1;
    let maxScore = 0;

    for (let i = 0; i < Math.min(rawRows.length, 50); i++) {
        const score = scoreHeaderRow(rawRows[i]);
        if (score > maxScore) {
            maxScore = score;
            headerRowIdx = i;
        }
    }

    // 2. COLUMN MAPPING
    // Even if score is low, we try mapped columns
    let detectedCols = { storeColumn: null, styleColumn: null, printColumn: null, colourColumn: null };
    let storeIdx = -1, styleIdx = -1, printIdx = -1, colourIdx = -1;

    if (headerRowIdx !== -1) {
        const headerRow = rawRows[headerRowIdx].map(c => String(c).toLowerCase().trim());

        storeIdx = headerRow.findIndex(h => ['store', 'store name', 'retailer', 'customer', 'buyer'].includes(h));
        if (storeIdx === -1) storeIdx = headerRow.findIndex(h => h.includes('order no') || h.includes('po no')); // Fallback

        styleIdx = headerRow.findIndex(h => ['style', 'style no', 'style name', 'article', 'article no'].includes(h));

        printIdx = headerRow.findIndex(h => ['print', 'pattern', 'design'].includes(h));
        colourIdx = headerRow.findIndex(h => ['colour', 'color'].includes(h));

        if (storeIdx !== -1) detectedCols.storeColumn = rawRows[headerRowIdx][storeIdx];
        if (styleIdx !== -1) detectedCols.styleColumn = rawRows[headerRowIdx][styleIdx];
        if (printIdx !== -1) detectedCols.printColumn = rawRows[headerRowIdx][printIdx];
        if (colourIdx !== -1) detectedCols.colourColumn = rawRows[headerRowIdx][colourIdx];
    }

    // 3. EXTRACTION
    let extractedStores = [];
    const uniqueStyles = new Set();
    const uniquePrints = new Set();

    let activePrintIdx = printIdx !== -1 ? printIdx : colourIdx;

    // --- A. BROAD PATTERN SCAN FOR STORES (CRITICAL FIX) ---
    const patternStores = [];
    const patternSources = new Set();

    // We scan 30 rows. We loosed the regex significantly.
    for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
        const row = rawRows[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim();
            if (!cell) continue;

            let val = null;

            // Priority: Check if cell *contains* "ORDER NO" (case insensitive)
            // e.g. "ORDER NO : BABYBUBBLE", "ORDER NO:BABYBUBBLE", "ORDER NO - 123"
            if (/order\s*no/i.test(cell)) {
                // Try to extract value from SAME cell
                // Remove "ORDER NO" and delimiters
                const cleaned = cell.replace(/order\s*no/i, '').replace(/^[\s:.-;]+/, '').trim();

                if (cleaned.length > 1) {
                    val = cleaned;
                }
                // Look adjacent if cell was just "ORDER NO"
                else if (cleaned.length === 0 && j + 1 < row.length) {
                    const nextVal = String(row[j + 1]).trim();
                    if (nextVal) val = nextVal;
                }
            }
            // Fallback: Check "Store", "Customer", "Buyer"
            else if (/(store|customer|retailer|buyer)/i.test(cell)) {
                const cleaned = cell.replace(/(store|customer|retailer|buyer)/i, '').replace(/^[\s:.-;]+/, '').trim();
                if (cleaned.length > 1) {
                    val = cleaned;
                } else if (cleaned.length === 0 && j + 1 < row.length) {
                    const nextVal = String(row[j + 1]).trim();
                    if (nextVal) val = nextVal;
                }
            }

            if (val && val.length > 1 && !isNumeric(val) && !val.toLowerCase().includes('date')) {
                let finalVal = val;
                if (patternSources.has(finalVal.toLowerCase())) {
                    let suffixChar = 'A';
                    let candidate = `${val} - ${suffixChar}`;
                    while (patternSources.has(candidate.toLowerCase())) {
                        suffixChar = String.fromCharCode(suffixChar.charCodeAt(0) + 1);
                        candidate = `${val} - ${suffixChar}`;
                    }
                    finalVal = candidate;
                }
                patternSources.add(finalVal.toLowerCase());
                patternStores.push(finalVal);
            }

            // --- KEY-VALUE SCAN FOR STYLE & PRINT ---
            // e.g. "Style: 12345", "Print: Floral"

            // STYLE
            if (/style/i.test(cell)) {
                const cleaned = cell.replace(/style(\s*no)?/i, '').replace(/^[\s:.-;]+/, '').trim();
                let sVal = null;
                if (cleaned.length > 1) sVal = cleaned;
                else if (cleaned.length === 0 && j + 1 < row.length) sVal = String(row[j + 1]).trim();

                if (sVal && !isNumeric(sVal) && sVal.length > 1) uniqueStyles.add(sVal);
            }

            // PRINT / COLOUR
            if (/(print|pattern|design|colour|color)/i.test(cell)) {
                const cleaned = cell.replace(/(print|pattern|design|colour|color)/i, '').replace(/^[\s:.-;]+/, '').trim();
                let pVal = null;
                if (cleaned.length > 1) pVal = cleaned;
                else if (cleaned.length === 0 && j + 1 < row.length) pVal = String(row[j + 1]).trim();

                if (pVal && !isNumeric(pVal) && pVal.length > 1) uniquePrints.add(pVal);
            }
        }
    }

    // B. COLUMN ROW SCAN
    if (headerRowIdx !== -1) {
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row) continue;
            const hasData = row.some(c => String(c).trim() !== "");
            if (!hasData) continue;

            if (storeIdx !== -1 && row[storeIdx]) {
                const val = getCellValue(row[storeIdx]);
                if (val && !isNumeric(val) && val.length > 1) {
                    extractedStores.push(val);
                }
            }
            if (styleIdx !== -1 && row[styleIdx]) {
                const val = getCellValue(row[styleIdx]);
                if (val && !isNumeric(val)) uniqueStyles.add(val);
            }
            if (activePrintIdx !== -1 && row[activePrintIdx]) {
                const val = getCellValue(row[activePrintIdx]);
                if (val && !isNumeric(val)) uniquePrints.add(val);
            }
        }
    }

    // MERGE STORES
    let finalStores = [];

    if (extractedStores.length > 0) {
        finalStores = Array.from(new Set(extractedStores));
    } else if (patternStores.length > 0) {
        finalStores = patternStores;
        detectedCols.storeColumn = "(Detected via Header Pattern)";
    }

    // Update detectedCols explanation
    if (uniqueStyles.size > 0 && styleIdx === -1) {
        detectedCols.styleColumn = "(Detected via Patterns)";
    }
    if (uniquePrints.size > 0 && activePrintIdx === -1) {
        detectedCols.printColumn = "(Detected via Patterns)";
    }

    // 4. STATUS
    let status = 'SUCCESS';
    let errorReason = '';

    if (uniqueStyles.size === 0) {
        status = 'PARTIAL';
        errorReason = "No Styles detected. ";
    }

    if (finalStores.length === 0) {
        status = status === 'SUCCESS' ? 'PARTIAL' : status;
        errorReason += "Store name could not be detected. ";
    }
    if (finalStores.length === 0 && uniqueStyles.size === 0 && uniquePrints.size === 0) {
        status = 'FAILED';
        errorReason = "No data extracted.";
    }

    return {
        fileName: filename,
        fileSize: (buffer.length / 1024).toFixed(2) + ' KB',
        rowCount: rawRows.length,
        stores: finalStores.sort(),
        styles: Array.from(uniqueStyles).sort(),
        prints: Array.from(uniquePrints).sort(),
        detectedColumns: detectedCols,
        status: status,
        errorReason: errorReason.trim(),
        rows: rawRows
    };
};

// --- ROUTES ---

app.get('/api/files', async (req, res) => {
    try {
        const files = await DB.getAll();
        res.json(files);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/files/:id', async (req, res) => {
    try {
        const file = await DB.getOne(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        res.json(file);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

        const processed = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const data = processFile(file.buffer, file.originalname);
                const saved = await DB.save(data);
                processed.push(saved);
            } catch (e) {
                errors.push({ file: file.originalname, error: e.message });
            }
        }
        res.json({ message: 'Processed', files: processed, errors });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/files/:id', async (req, res) => {
    try {
        await DB.delete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// CARTON ENDPOINTS
app.post('/api/cartons', async (req, res) => {
    try {
        const carton = await DB.saveCarton(req.body);
        res.json(carton);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cartons', async (req, res) => {
    try {
        const cartons = await DB.getCartons();
        res.json(cartons);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cartons/clear', async (req, res) => {
    try {
        await DB.clearCartons();
        res.json({ message: 'All cartons cleared' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SETTINGS ENDPOINTS ---
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await DB.getSettings();
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', async (req, res) => {
    try {
        const settings = await DB.saveSettings(req.body);
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/aggregated', async (req, res) => {
    try {
        const files = await DB.getAll();
        const allStores = new Set();
        const allStyles = new Set();
        const allPrints = new Set();

        for (const f of files) {
            if (f.stores) f.stores.forEach(s => allStores.add(s));
            if (f.styles) f.styles.forEach(s => allStyles.add(s));
            if (f.prints) f.prints.forEach(p => allPrints.add(p));
        }

        res.json({
            stores: Array.from(allStores).sort(),
            styles: Array.from(allStyles).sort(),
            prints: Array.from(allPrints)
                .filter(p => !/Ta(p|pp)ing/i.test(p)) // Remove Tapping/Taping options
                .sort()
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`MODE: ${useMongoDB ? 'MongoDB' : 'Local JSON'}`);
});
