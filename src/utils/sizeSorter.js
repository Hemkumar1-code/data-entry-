
export const sortSizes = (sizes) => {
    // Standard size order map for easy comparison
    const STANDARD_ORDER = [
        'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'XXXXL', '4XL'
    ];

    const getStandardIndex = (s) => {
        const idx = STANDARD_ORDER.indexOf(s.toUpperCase());
        return idx === -1 ? 999 : idx;
    };

    const isNumeric = (n) => {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    // Split into groups
    const numericSizes = [];
    const standardSizes = [];
    const otherSizes = [];

    sizes.forEach(size => {
        // Clean the size string
        const s = String(size).trim();

        if (isNumeric(s)) {
            numericSizes.push(s);
        } else if (getStandardIndex(s) !== 999) {
            standardSizes.push(s);
        } else {
            otherSizes.push(s);
        }
    });

    // Sort groups
    numericSizes.sort((a, b) => parseFloat(a) - parseFloat(b));

    standardSizes.sort((a, b) => {
        return getStandardIndex(a) - getStandardIndex(b);
    });

    otherSizes.sort(); // Alphabetical for others

    // Combine: Numerics -> Standards -> Others
    return [...numericSizes, ...standardSizes, ...otherSizes];
};
