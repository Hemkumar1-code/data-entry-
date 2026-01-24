import * as XLSX from 'xlsx';


export const generateExcel = (cartons, settings = {}) => {
    if (!cartons || cartons.length === 0) return;

    const { activeSeason } = settings;

    // 1️⃣ HEADER RULE (ROW 1 – FIXED)
    const header = [
        "CARTON No.",
        "SEASON",
        "STORE NAME",
        "COLOUR",
        "STYLE",
        "TOTAL PCS",
        "NET WEIGHT",
        "GROSS WEIGHT",
        "CARTON DIMENSION",
        "MADE IN INDIA"
    ];

    const dataRows = [];



    cartons.forEach((carton, index) => {
        // 2️⃣ DATA START RULE (Row 2 onwards)

        // 3️⃣ CARTON No. (Auto 1..N)
        const cartonNum = index + 1;

        // 4️⃣ SEASON RULE (Mandatory)
        const season = carton.season || activeSeason || "";

        // 5️⃣ STORE NAME RULE (Strict match)
        const storeName = carton.storeName || "";

        // Analyze Rows for Print/Style
        const rows = Array.isArray(carton.rows) ? carton.rows : [];
        const prints = new Set(rows.map(r => r.print).filter(Boolean));
        const styles = new Set(rows.map(r => r.style).filter(Boolean));

        // 6️⃣ COLOUR (PRINT) RULE
        // >1 different print -> "ALL COLOUR"
        // 1 print -> User selected print name
        let colourVal = "ALL COLOUR";
        if (prints.size === 1) {
            colourVal = [...prints][0];
        } else if (prints.size === 0) {
            colourVal = "";
        }

        // 7️⃣ STYLE RULE
        // >1 different style -> "ALL STYLE"
        // 1 style -> User selected style
        let styleVal = "ALL STYLE";
        if (styles.size === 1) {
            styleVal = [...styles][0];
        } else if (styles.size === 0) {
            styleVal = "";
        }

        // 9️⃣ TOTAL PCS RULE (Sum of all quantities)
        // 8️⃣ SIZE RULE (Size columns NOT allowed in this Excel)
        const totalPcs = rows.reduce((sum, r) => sum + (parseInt(r.totalPcs) || 0), 0);

        // 1️⃣0️⃣ NET WEIGHT RULE (Numeric)
        const netWeight = parseFloat(carton.netWeight) || 0;

        // 1️⃣1️⃣ GROSS WEIGHT RULE (Numeric > Net)
        const grossWeight = parseFloat(carton.grossWeight) || 0;

        // 1️⃣2️⃣ CARTON DIMENSION RULE (L x W x H)
        // Clean "cm" if present
        const dimension = (carton.measurement || "").replace(/cm/gi, '').trim();

        // 1️⃣3️⃣ MADE IN INDIA RULE (Fixed)
        const origin = "INDIA";

        dataRows.push([
            cartonNum,
            season,
            storeName,
            colourVal,
            styleVal,
            totalPcs,
            netWeight,
            grossWeight,
            dimension,
            origin
        ]);
    });

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // Column Widths (Visual help)
    ws['!cols'] = [
        { wch: 10 }, // Carton No
        { wch: 15 }, // Season
        { wch: 25 }, // Store
        { wch: 20 }, // Colour
        { wch: 20 }, // Style
        { wch: 10 }, // Total
        { wch: 10 }, // Net
        { wch: 10 }, // Gross
        { wch: 15 }, // Dim
        { wch: 10 }  // Origin
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carton Sheet");

    // Write file
    XLSX.writeFile(wb, "Carton_Entry_Strict.xlsx");
};
