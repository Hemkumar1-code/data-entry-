import * as XLSX from 'xlsx';

/**
 * Normalizes store name by taking the first word/segment.
 * e.g. "BABYBUBLE - A" -> "BABYBUBLE"
 */
const normalizeStoreName = (name) => {
    if (!name) return "UNKNOWN";
    const parts = name.trim().split(/[\s-_]+/);
    return parts[0].toUpperCase();
};

export const generatePackingList = (cartons) => {
    if (!cartons || cartons.length === 0) return;

    const wb = XLSX.utils.book_new();

    // 1. Group by Normalized Store
    const storeGroups = {};
    cartons.forEach(carton => {
        const normName = normalizeStoreName(carton.storeName);
        if (!storeGroups[normName]) storeGroups[normName] = [];
        storeGroups[normName].push(carton);
    });

    // 2. Process Each Store
    Object.keys(storeGroups).forEach(storeName => {
        const groupCartons = storeGroups[storeName];
        const wsData = [];
        const merges = [];

        // --- Helper: Add Merge ---
        const addMerge = (sR, sC, eR, eC) => {
            merges.push({ s: { r: sR, c: sC }, e: { r: eR, c: eC } });
        };

        // --- Prepare Header Data ---
        const firstCarton = groupCartons[0];
        const buyer = firstCarton.buyer || "";
        const season = firstCarton.season || "";
        const date = new Date().toISOString().split('T')[0];

        // Calculate Totals for this Sheet
        let totalPcsSheet = 0;
        const dimCounts = {
            "49X29X40": 0,
            "49X29X30": 0,
            "49X29X20": 0,
            "49X30X25": 0
        };

        groupCartons.forEach(c => {
            const rows = Array.isArray(c.rows) ? c.rows : [];
            const cTotal = rows.reduce((sum, r) => sum + (parseInt(r.totalPcs) || 0), 0);
            totalPcsSheet += cTotal;

            // Dimension counting
            let dimMap = (c.measurement || "").replace(/\s/g, '').toUpperCase();
            // Try to match partial? Or exact? The user gave generic text "49X29X40". 
            // We'll normalize "x" to "X".
            dimMap = dimMap.replace(/x/g, 'X');
            if (dimCounts[dimMap] !== undefined) {
                dimCounts[dimMap]++;
            }
        });

        // --- GRID CONSTRUCTION (Row by Row) ---

        // Row 0: Title "PACKING LIST"
        // Merge A1:I1 (0,0 to 0,8)
        wsData.push(["PACKING LIST", "", "", "", "", "", "", "", ""]);
        addMerge(0, 0, 0, 8);

        // Row 1: Spacer
        wsData.push([]);

        // Row 2-9: Header Block
        // We need 3 cols horizontal sections: Exporter (Left), Fabric (Center), Info (Right)
        // Let's assume columns:
        // A, B, C : Exporter
        // D, E    : Fabric
        // F, G, H, I : Info

        // Row 2
        wsData.push([
            "Exporter:", "", "", // A-C
            "Fabric :", "",      // D-E
            "Buyer :", buyer, "", "" // F-I
        ]);
        addMerge(2, 0, 2, 2); // Exporter Label
        addMerge(2, 3, 2, 4); // Fabric Label
        addMerge(2, 6, 2, 8); // Buyer Value merge?

        // Row 3
        wsData.push([
            "M/s. Sree Kanaga Durgaa Textile", "", "",
            "100% Organic Cotton Knitted", "",
            "Invoice No :", "", "", ""
        ]);
        addMerge(3, 0, 3, 2); // Exporter Line 1
        addMerge(3, 3, 3, 4); // Fabric Value
        addMerge(3, 6, 3, 8); // Invoice Value

        // Row 4
        wsData.push([
            "22/41, Muthusamy, 4th Street,", "", "",
            "", "", // Fabric continued vacant
            "Season :", season, "", ""
        ]);
        addMerge(4, 0, 4, 2);
        addMerge(4, 6, 4, 8);

        // Row 5
        wsData.push([
            "Odakaddu,", "", "",
            "", "",
            "Invoice Date :", "", "", ""
        ]);
        addMerge(5, 0, 5, 2);
        addMerge(5, 6, 5, 8);

        // Row 6
        wsData.push([
            "Tirupur 641602", "", "",
            "", "",
            "Date :", date, "", ""
        ]);
        addMerge(6, 0, 6, 2);
        addMerge(6, 6, 6, 8);

        // Row 7
        wsData.push([
            "Tamilnadu, INDIA", "", "",
            "", "",
            "Total Pcs/Sets :", totalPcsSheet, "", ""
        ]);
        addMerge(7, 0, 7, 2);
        addMerge(7, 6, 7, 8);

        // Row 8
        wsData.push([
            "", "", "", // Exporter Done
            "", "",
            "Order Qty :", totalPcsSheet, "", ""
        ]);
        addMerge(8, 6, 8, 8);

        // Row 9
        wsData.push([
            "Order No :", buyer, "", // From requirement: "Order No must be picked automatically"
            "Store Name :", storeName,
            "Destination :", "", "", ""
        ]);
        // Let's ensure these are visible. Merging might be needed based on length.

        wsData.push([]); // Spacer

        // --- Dimensions Block ---
        // "Below the above: CTN Dimension... 49X29X40 – ___ CTNS..."
        wsData.push(["CTN Dimension"]);
        addMerge(11, 0, 11, 2);

        // Hardcoded list from prompt
        const dims = [
            "49X29X40",
            "49X29X30",
            "49X29X20",
            "49X30X25"
        ];
        dims.forEach(d => {
            const count = dimCounts[d] || 0; // Use count if we found any matches, else 0 (or leave blank `___`?) 
            // Prompt says "___ CTNS". Let's format it.
            const text = `${d} – ${count > 0 ? count : '___'} CTNS`;
            wsData.push([text]);
            addMerge(wsData.length - 1, 0, wsData.length - 1, 3);
        });

        wsData.push([]); // Spacer

        // --- DUNS ROW ---
        // "Large centered merged row displaying: DUNS"
        wsData.push(["DUNS"]);
        const dunsRowIdx = wsData.length - 1;
        addMerge(dunsRowIdx, 0, dunsRowIdx, 8);
        // We'll style this later (Centered)

        wsData.push([]); // Spacer

        // --- Main Data Table ---
        // "Mandatory columns: Print, Style, Size, Quantity"
        // Also "Columns must align". Let's standardise.
        // A: Carton No, B: Store, C: Print, D: Style, E: Size, F: Qty, G: Net, H: Gross

        const tableHeader = [
            "Carton No", "Store", "Print", "Style", "Size", "Quantity", "Net Wt", "Gr Wt", "Dimension"
        ];
        wsData.push(tableHeader);

        // Sort Data (Print > Style > Size as per usual logic)
        groupCartons.sort((a, b) => {
            const rA = (a.rows && a.rows[0]) || {};
            const rB = (b.rows && b.rows[0]) || {};
            const pA = (rA.print || "").localeCompare(rB.print || "");
            if (pA !== 0) return pA;
            return (rA.style || "").localeCompare(rB.style || "");
        });

        groupCartons.forEach((c, i) => {
            const rows = Array.isArray(c.rows) ? c.rows : [];
            const r = rows[0] || {};

            // Size text: "S:2 | M:4"
            const sizeText = rows.map(rw => {
                return Object.entries(rw.sizes || {})
                    .filter(([_, v]) => v && parseInt(v) > 0)
                    .map(([s, v]) => `${s}:${v}`)
                    .join(', ');
            }).join(' | ');

            const total = rows.reduce((s, rw) => s + (parseInt(rw.totalPcs) || 0), 0);
            const dim = (c.measurement || "").replace(/cm/gi, '').trim();

            wsData.push([
                i + 1,
                c.storeName,
                r.print || "",
                r.style || "",
                sizeText,
                total,
                c.netWeight,
                c.grossWeight,
                dim
            ]);
        });

        // --- Create Sheet ---
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Apply Merges
        ws['!merges'] = merges;

        // Apply Col Widths
        ws['!cols'] = [
            { wch: 10 }, // Carton
            { wch: 20 }, // Store
            { wch: 20 }, // Print
            { wch: 20 }, // Style
            { wch: 30 }, // Size
            { wch: 10 }, // Qty
            { wch: 10 }, // Net
            { wch: 10 }, // Gr
            { wch: 15 }  // Dim
        ];

        // Style DUNS row (Center) - XLSX basic style support is limited in free version, 
        // generally only text content/merges work safely. 
        // Alignment properties like 's' (style) object often require Pro version or file-saver hacks.
        // We rely on defaults. Merging usually centers in Excel default view for some titles.

        // Append Sheet
        let finalSheetName = storeName.replace(/[*?:\/\[\]\\]/g, ' ').substring(0, 31);
        if (wb.Sheets[finalSheetName]) {
            let i = 1;
            while (wb.Sheets[`${finalSheetName} ${i}`]) i++;
            finalSheetName = `${finalSheetName} ${i}`;
        }
        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    XLSX.writeFile(wb, "Packing_List_Strict.xlsx");
};
