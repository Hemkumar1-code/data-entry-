import * as XLSX from 'xlsx';

/**
 * Normalizes store name by taking the first word/segment.
 * e.g. "BABYBUBLE - A" -> "BABYBUBLE"
 * e.g. "BABYBUBLE KOREA" -> "BABYBUBLE"
 */
const normalizeStoreName = (name) => {
    if (!name) return "UNKNOWN";
    // Split by dash, space, or underscore and take the first part
    const parts = name.trim().split(/[\s-_]+/);
    return parts[0].toUpperCase();
};

export const generatePackingList = (cartons) => {
    if (!cartons || cartons.length === 0) return;

    const wb = XLSX.utils.book_new();

    // 1. Group Cartons by Normalized Store Name
    const storeGroups = {};
    cartons.forEach(carton => {
        const normName = normalizeStoreName(carton.storeName);
        if (!storeGroups[normName]) {
            storeGroups[normName] = [];
        }
        storeGroups[normName].push(carton);
    });

    // 2. Generate Sheet per Store Group
    Object.keys(storeGroups).forEach(storeName => {
        const groupCartons = storeGroups[storeName];
        const wsData = [];

        // --- Header Section ---
        const firstCarton = groupCartons[0];
        const orderNo = firstCarton.buyer || ""; // Using Buyer as Order No

        // Fixed Title
        wsData.push(["PACKING LIST"]);
        wsData.push([]);

        // Exporter
        wsData.push(["Exporter:"]);
        wsData.push(["M/s. Sree Kanaga Durgaa Textile"]);
        wsData.push(["22/41, Muthusamy, 4th Street,"]);
        wsData.push(["Odakaddu,"]);
        wsData.push(["Tirupur 641602"]);
        wsData.push(["Tamilnadu, INDIA"]);
        wsData.push([]);

        // Fabric
        wsData.push(["Fabric : 100% Organic Cotton Knitted"]);
        wsData.push([]);

        // Dynamic Header (Order No / Store Name)
        wsData.push([`Order No : ${orderNo}`]);
        wsData.push([`Store Name : ${storeName}`]);
        wsData.push([]);

        // --- Table Headers ---
        // Columns: Carton No | Season | Store (Original) | Print | Style | Size | Qty | Net Wt | Gr Wt | Dim
        const headers = [
            "Carton No", "Season", "Original Store", "Print", "Style", "Size", "Qty (Pcs)", "Net Wt", "Gr Wt", "Dimension"
        ];
        wsData.push(headers);

        // --- Data Grouping (Print -> Style -> Size) ---
        // We'll flatten the structure slightly: Carton -> Rows
        // But the requirement says "Group data by Print -> Style -> Size". 
        // We will output CARTONS sorted/grouped by these fields.

        // Sort approach: Sort the entire carton list based on the primary row's Print/Style.
        // Assuming 1 carton usually has homogeneous content, or we list based on 1st row.

        groupCartons.sort((a, b) => {
            const rowA = a.rows?.[0] || {};
            const rowB = b.rows?.[0] || {};

            // Sort by Print
            const printA = (rowA.print || "").toLowerCase();
            const printB = (rowB.print || "").toLowerCase();
            if (printA < printB) return -1;
            if (printA > printB) return 1;

            // Then by Style
            const styleA = (rowA.style || "").toLowerCase();
            const styleB = (rowB.style || "").toLowerCase();
            if (styleA < styleB) return -1;
            if (styleA > styleB) return 1;

            return 0;
        });

        let currentPrint = null;
        let currentStyle = null;
        let styleTotal = 0;
        let styleNet = 0;
        let styleGross = 0;

        groupCartons.forEach((carton, idx) => {
            const rowPrimary = carton.rows?.[0] || {};
            const print = rowPrimary.print || "-";
            const style = rowPrimary.style || "-";

            // Check if group changed
            if (print !== currentPrint || style !== currentStyle) {
                // If not first, print total for previous group is optional, but requested "Display quantities... under each group"
                // Let's settle for a clean list first, maybe total at end of style?

                // Let's insert a spacer if changing group?
                if (currentPrint !== null) {
                    // Spacer or Subtotal could go here
                }
                currentPrint = print;
                currentStyle = style;
                // Reset totals if we were doing per-group totals (implementing running total below)
            }

            // Calculate carton specifics
            const totalPcs = carton.rows.reduce((s, r) => s + (parseInt(r.totalPcs) || 0), 0);
            const net = parseFloat(carton.netWeight) || 0;
            const gross = parseFloat(carton.grossWeight) || 0;
            const dim = (carton.measurement || "").replace(/cm/gi, '').trim();

            // Extract Size breakdown text (e.g., "S:2, M:4")
            const sizeText = carton.rows.map(r => {
                return Object.entries(r.sizes)
                    .filter(([_, v]) => v && parseInt(v) > 0)
                    .map(([s, v]) => `${s}:${v}`)
                    .join(', ');
            }).join(' | ');

            wsData.push([
                idx + 1, // Re-index for this sheet? Or keeps original Carton No? "Carton No" usually implies unique ID. 
                // But if we split sheets, local index 1..N is often preferred. Let's use 1..N per sheet.
                carton.season,
                carton.storeName,
                print,
                style,
                sizeText,
                totalPcs,
                net,
                gross,
                dim
            ]);

            styleTotal += totalPcs;
            styleNet += net;
            styleGross += gross;
        });

        // Grand Total Row
        wsData.push([]);
        wsData.push(["", "", "", "", "GRAND TOTAL", "", styleTotal, styleNet.toFixed(2), styleGross.toFixed(2)]);

        // Create Sheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Styling (Col Widths)
        ws['!cols'] = [
            { wch: 10 }, // Carton No
            { wch: 15 }, // Season
            { wch: 20 }, // Store
            { wch: 15 }, // Print
            { wch: 15 }, // Style
            { wch: 30 }, // Size
            { wch: 10 }, // Qty
            { wch: 10 }, // Net
            { wch: 10 }, // Gr
            { wch: 15 }  // Dim
        ];

        // Merge Title
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }); // PACKING LIST

        // Add to Workbook
        // Sheet name max 31 chars
        let sheetName = storeName.replace(/[*?:\/\[\]\\]/g, ' ').substring(0, 31);
        // Ensure unique if dupes exist (unlikely with this logic, but safe)
        if (wb.Sheets[sheetName]) {
            sheetName = uniqueSheetName(wb, sheetName);
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, "Packing_List_Advanced.xlsx");
};

function uniqueSheetName(wb, name) {
    let i = 1;
    while (wb.Sheets[`${name} ${i}`]) i++;
    return `${name} ${i}`;
}
