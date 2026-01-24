import * as XLSX from 'xlsx';
import { sortSizes } from './sizeSorter';

/**
 * Normalizes store name by taking the first word/segment.
 * e.g. "BABYBUBBLE-A" -> "BABYBUBBLE"
 */
const normalizeStoreName = (name) => {
    if (!name) return "UNKNOWN";

    const parts = name.trim().split(/[\s-]+/);
    return parts[0].toUpperCase();
};

export const generatePackingList = (cartons) => {
    if (!cartons || cartons.length === 0) return;

    const wb = XLSX.utils.book_new();

    // 1. Group by Normalized Base Store
    const storeGroups = {};
    cartons.forEach(carton => {
        const normName = normalizeStoreName(carton.storeName);
        if (!storeGroups[normName]) storeGroups[normName] = [];
        storeGroups[normName].push(carton);
    });

    // 2. Process Each Store
    Object.keys(storeGroups).forEach(baseStoreName => {
        const groupCartons = storeGroups[baseStoreName];

        // --- PREPARE DATA ---
        // We need all unique sizes present in this group to build columns
        const allSizesSet = new Set();
        groupCartons.forEach(c => {
            const rows = Array.isArray(c.rows) ? c.rows : [];
            rows.forEach(r => {
                Object.keys(r.sizes || {}).forEach(s => {
                    if (r.sizes[s] && parseInt(r.sizes[s]) > 0) allSizesSet.add(s);
                });
            });
        });
        const sortedSizes = sortSizes([...allSizesSet]);

        // Calculate Totals for Header
        let totalPcsSheet = 0;
        const dimCounts = {}; // "LxWxH" -> count
        const uniqueBuyers = new Set();
        const uniqueInvoices = new Set();
        // Note: Invoice/Date not in DataEntry currently, assume constant/empty if missing

        groupCartons.forEach((c, idx) => {
            // Totals
            const rows = Array.isArray(c.rows) ? c.rows : [];
            const cTotal = rows.reduce((sum, r) => sum + (parseInt(r.totalPcs) || 0), 0);
            totalPcsSheet += cTotal;

            // Dims
            let dim = (c.measurement || "").replace(/\s/g, '').toUpperCase();
            // Standardize separator if needed
            if (dim) {
                dimCounts[dim] = (dimCounts[dim] || 0) + 1;
            }

            if (c.buyer) uniqueBuyers.add(c.buyer);
            // if(c.invoice) uniqueInvoices.add(c.invoice);
        });

        // Header Values
        const buyerVal = [...uniqueBuyers].join(', ');
        const dateVal = new Date().toISOString().split('T')[0];
        const seasonVal = groupCartons[0]?.season || "WINTER 2025";

        // --- BUILD SHEET DATA (AOA) ---
        const wsData = [];
        const merges = [];

        // Helper for merge (0-indexed)
        const addMerge = (sR, sC, eR, eC) => {
            merges.push({ s: { r: sR, c: sC }, e: { r: eR, c: eC } });
        };

        // COLS MAPPING:
        // A: Carton No, B: Store, C: Print, D: Style ... E..N: Sizes ... N+1: Total, N+2: Net, N+3: Gr, N+4: Dim
        // However, Header needs specific layout. We usually use 9-10 cols for header layout.
        // Let's ensure header fits.
        const ROW_WIDTH = 9 + sortedSizes.length; // Approximate

        // ROW 0: TITLE
        wsData.push(["PACKING LIST"]);
        addMerge(0, 0, 0, 8); // Merge first few cols

        // ROW 1: Spacer
        wsData.push([]);

        // ROW 2-9: Fixed Header Info
        // Exporter (A-C), Fabric (D-E), Buyer/Info (F-I)

        // Row 2
        wsData.push(["Exporter:", "", "", "Fabric :", "", "Buyer :", buyerVal, "", ""]);
        addMerge(2, 0, 2, 2); addMerge(2, 3, 2, 4); addMerge(2, 6, 2, 8);

        // Row 3
        wsData.push(["M/s. Sree Kanaga Durgaa Textile", "", "", "100% Organic Cotton Knitted", "", "Invoice No :", "", "", ""]);
        addMerge(3, 0, 3, 2); addMerge(3, 3, 3, 4); addMerge(3, 6, 3, 8);

        // Row 4
        wsData.push(["22/41, Muthusamy, 4th Street,", "", "", "", "", "Season :", seasonVal, "", ""]);
        addMerge(4, 0, 4, 2); addMerge(4, 6, 4, 8);

        // Row 5
        wsData.push(["Odakaddu,", "", "", "", "", "Invoice Date :", "", "", ""]);
        addMerge(5, 0, 5, 2); addMerge(5, 6, 5, 8);

        // Row 6
        wsData.push(["Tirupur 641602", "", "", "", "", "Date :", dateVal, "", ""]);
        addMerge(6, 0, 6, 2); addMerge(6, 6, 6, 8);

        // Row 7
        wsData.push(["Tamilnadu, INDIA", "", "", "", "", "Total Pcs / Sets :", totalPcsSheet, "", ""]);
        addMerge(7, 0, 7, 2); addMerge(7, 6, 7, 8);

        // Row 8
        wsData.push(["", "", "", "", "", "Order Qty :", totalPcsSheet, "", ""]);
        addMerge(8, 6, 8, 8);

        // Row 9
        wsData.push(["Order No :", buyerVal, "", "Store Name :", baseStoreName, "Destination :", "", "", ""]);
        // Assume Order No = Buyer Name or similar if unavailable

        wsData.push([]); // Spacer

        // --- DIMENSIONS & DUNS ---
        wsData.push(["CTN Dimension"]);
        addMerge(11, 0, 11, 2);

        Object.entries(dimCounts).forEach(([dim, count]) => {
            const rowIdx = wsData.length;
            wsData.push([`${dim} – ${count} CTNS`]);
            addMerge(rowIdx, 0, rowIdx, 3);
        });

        wsData.push([]);
        wsData.push(["DUNS"]);
        addMerge(wsData.length - 1, 0, wsData.length - 1, 8);
        wsData.push([]);

        // --- TABLE HEADER ---
        // Carton No | Store (Original) | Print | Style | ...Sizes... | Total | Net | Gross | Dim
        const tableHeader = [
            "Carton No",
            "Store Name",
            "Print",
            "Style",
            ...sortedSizes,
            "Total Pcs",
            "Net Wt",
            "Gr Wt",
            "Dimension"
        ];
        wsData.push(tableHeader);

        // --- TABLE BODY ---
        // Strict Rule: Unselected styles must NOT appear. (Done by using saved row data)
        // Strict Rule: Sizes HORIZONTAL. (Done by spreading sortedSizes)

        // Sort Cartons (maybe by Carton No since we auto-generated/logic?)
        // Or keep input order. Input order is safer.

        groupCartons.forEach((carton, cIdx) => {
            const rows = Array.isArray(carton.rows) ? carton.rows : [];

            // If carton has multiple rows (mixed), we assume the Packing List wants detailed breakdown?
            // "Data grouped by: Print -> Style -> Size"
            // If a carton has 2 styles, we should list them.
            // Does Carton No repeat? Usually yes, or merge.
            // Let's repeat Carton No for clarity or list once.
            // Simple approach: One Excel Row per DataEntry Row.

            rows.forEach((row, rIdx) => {
                const rowTotal = Object.values(row.sizes || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

                // Map sizes to columns
                const sizeCols = sortedSizes.map(sizeKey => {
                    return (row.sizes && row.sizes[sizeKey]) ? row.sizes[sizeKey] : "";
                });

                // Display Carton No only on first row of carton?
                // Visual preference. Let's show it on all for sorting safety, user can merge.
                // Or better: Show "1" for first, "" for others?
                // Let's show explicit index "1", "2" based on carton array index.
                const cNo = cIdx + 1; // 1-based index within this Store Group (or global?)
                // Requirement Part A says "Numeric 1,2,3...". 
                // Part B doesn't specify carton numbering scheme, but it's likely they want the SAME ID as Part A.
                // But Part A uses Global index. Part B groups by Store. 
                // If we use Global Index, we need to find it relative to original list.
                // But here we only have `cartons` which is the full list passed to function?
                // Yes, `cartons` is full list. But we grouped them.
                // `cartons` passed to this function might be filtered? No, usually full list.
                // To match Part A's Carton IDs:
                // We should find the index of this carton in the original `cartons` array.
                // But `cartons` argument IS the original array?
                // No, `cartons` is passed in.
                // Let's find its global index.
                const globalIndex = cartons.indexOf(carton) + 1;

                const rowData = [
                    globalIndex,
                    carton.storeName,
                    row.print,
                    row.style,
                    ...sizeCols,
                    rowTotal,
                    rIdx === 0 ? carton.netWeight : "", // Show weights only once per carton?
                    rIdx === 0 ? carton.grossWeight : "",
                    rIdx === 0 ? (carton.measurement || "") : ""
                ];
                wsData.push(rowData);
            });
        });

        // Create Sheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = merges;

        // Auto-width
        const wscols = [
            { wch: 8 }, // Ctn
            { wch: 15 }, // Store
            { wch: 15 }, // Print
            { wch: 15 }, // Style
            ...sortedSizes.map(() => ({ wch: 6 })), // Sizes
            { wch: 8 }, // Total
            { wch: 8 }, // Net
            { wch: 8 }, // Gross
            { wch: 12 } // Dim
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, baseStoreName.substring(0, 31));
    });

    XLSX.writeFile(wb, "Packing_List_Strict.xlsx");
};
