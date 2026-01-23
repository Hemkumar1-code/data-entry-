import pool from './_utils/sqlConnect.js';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            // Ensure table exists (lazy init for smoother UX, though prod should use migrations)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS cartons (
                    id SERIAL PRIMARY KEY,
                    buyer TEXT,
                    store_name TEXT,
                    carton_no TEXT,
                    measurement TEXT,
                    net_weight TEXT,
                    gross_weight TEXT,
                    rows_data JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            const { rows } = await pool.query('SELECT * FROM cartons ORDER BY created_at ASC');

            // Map Snake_Case DB columns to CamelCase JSON
            const formatted = rows.map(r => ({
                _id: r.id,
                buyer: r.buyer,
                storeName: r.store_name,
                cartonNo: r.carton_no,
                measurement: r.measurement,
                netWeight: r.net_weight,
                grossWeight: r.gross_weight,
                rows: r.rows_data,
                timestamp: r.created_at
            }));

            res.status(200).json(formatted);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    } else if (req.method === 'POST') {
        try {
            const { buyer, storeName, cartonNo, measurement, netWeight, grossWeight, rows } = req.body;

            const query = `
                INSERT INTO cartons (buyer, store_name, carton_no, measurement, net_weight, gross_weight, rows_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *;
            `;
            const values = [buyer, storeName, cartonNo, measurement, netWeight, grossWeight, JSON.stringify(rows)];

            const { rows: resultRows } = await pool.query(query, values);
            const r = resultRows[0];

            res.status(200).json({
                success: true,
                _id: r.id,
                buyer: r.buyer,
                // ... return other fields if needed by frontend immediately
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
