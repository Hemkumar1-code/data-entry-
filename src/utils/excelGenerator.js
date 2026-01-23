import * as XLSX from 'xlsx';

/**
 * Generates an Excel workbook with one sheet per carton.
 * Strict formatting rules applied.
 */
export const generateExcel = (cartons, settings = {}) => {
    if (!cartons || cartons.length === 0) return;

    const { activeSeason, lockedByAdmin } = settings;

    const wb = XLSX.utils.book_new();
    const totalCartons = cartons.length;

    cartons.forEach((carton, index) => {
        const sheetData = [];
        const cartonNum = index + 1;

        // 1. DATA AGGREGATION
        const styles = new Set(carton.rows.map(r => r.style).filter(Boolean));
        const prints = new Set(carton.rows.map(r => r.print).filter(Boolean));

        // Style Logic
        const styleVal = styles.size === 1 ? [...styles][0] : "ALL STYLES";

        // Color Logic (using Print field)
        const colourVal = prints.size === 1 ? [...prints][0] : "ALL COLOURS";

        // Total PCS
        const totalPcs = carton.rows.reduce((sum, row) => sum + (parseInt(row.totalPcs) || 0), 0);

        // Measurement cleaning (remove CM logic)
        let measurement = (carton.measurement || "").toString().replace(/cm/gi, '').trim();

        // 2. BUILD VERTICAL HEADER
        const rows = [
            ["CARTON No.", `${cartonNum} OF ${totalCartons}`],
            ["SEASON", lockedByAdmin ? activeSeason : (carton.season || activeSeason)],
            ["STORE NAME", carton.storeName || ""],
            ["COLOUR", colourVal],
            ["STYLE", styleVal],
            ["TOTAL PCS", totalPcs],
            ["NET WEIGHT", carton.netWeight], // User enters Kg? Add unit if needed? Prompt said "Net Weight (Kg)" in UI label.
            ["GROSS WEIGHT", carton.grossWeight],
            ["CARTON DIMENSION", measurement],
            ["MADE IN INDIA", ""]
        ];

        // Create Sheet
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column Widths
        ws['!cols'] = [{ wch: 25 }, { wch: 40 }];

        // No Gridlines (property supported in some viewers)
        ws['!gridlines'] = false;

        XLSX.utils.book_append_sheet(wb, ws, `CARTON ${cartonNum}`);
    });

    // Write file
    XLSX.writeFile(wb, "Shipping_Manifest.xlsx");
};
