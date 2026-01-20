const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Column name variations (case-insensitive)
const UPC_VARIATIONS = ['upc', 'upc_code', 'upc code', 'upccode', 'product upc', 'item upc', 'barcode', 'ean', 'gtin'];
const BRAND_VARIATIONS = ['brand', 'brand name', 'brandname', 'manufacturer', 'product brand', 'vendor', 'supplier'];

/**
 * Parse Excel file and extract UPC data
 * @param {string} filePath - Path to the Excel file
 * @returns {Object} - { success, data, error }
 */
function parseExcelFile(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        data: null,
        error: 'File not found'
      };
    }

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        data: null,
        error: 'No sheets found in the Excel file'
      };
    }

    // Try each sheet to find one with UPC and Brand columns
    for (const sheetName of workbook.SheetNames) {
      console.log(`[EXCEL] Checking sheet: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet to 2D array to search for header row
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!sheetData || sheetData.length === 0) {
        continue;
      }

      // Search first 20 rows for the header row containing UPC and Brand
      const headerRowIndex = findHeaderRow(sheetData);

      if (headerRowIndex === -1) {
        console.log(`[EXCEL] No header row found in sheet: ${sheetName}`);
        continue;
      }

      console.log(`[EXCEL] Found header row at index ${headerRowIndex} in sheet: ${sheetName}`);

      // Get header row
      const headerRow = sheetData[headerRowIndex];
      console.log('[EXCEL] Header row:', headerRow);

      // Find column indices
      const upcColIndex = findColumnIndex(headerRow, UPC_VARIATIONS);
      const brandColIndex = findColumnIndex(headerRow, BRAND_VARIATIONS);

      if (upcColIndex === -1) {
        console.log(`[EXCEL] UPC column not found in sheet: ${sheetName}`);
        continue;
      }

      console.log(`[EXCEL] UPC column index: ${upcColIndex}, Brand column index: ${brandColIndex}`);

      // Extract data starting from row after header
      const dataRows = sheetData.slice(headerRowIndex + 1);
      const normalizedData = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const upc = String(row[upcColIndex] || '').trim();
        const brand = brandColIndex !== -1 ? String(row[brandColIndex] || '').trim() : '';

        // Skip empty UPC rows
        if (!upc) continue;

        normalizedData.push({
          rowId: headerRowIndex + 2 + i, // Excel row number (1-based + header)
          upc: upc,
          brand: brand,
          status: 'PENDING'
        });
      }

      if (normalizedData.length === 0) {
        console.log(`[EXCEL] No valid data rows in sheet: ${sheetName}`);
        continue;
      }

      console.log(`[EXCEL] Successfully parsed ${normalizedData.length} rows from sheet: ${sheetName}`);

      return {
        success: true,
        data: normalizedData,
        error: null,
        stats: {
          sheetName,
          headerRow: headerRowIndex + 1,
          totalRows: dataRows.length,
          validRows: normalizedData.length,
          skippedRows: dataRows.length - normalizedData.length
        }
      };
    }

    // No valid sheet found
    return {
      success: false,
      data: null,
      error: 'Required column "UPC" not found in any sheet. Please ensure your Excel file has a column named "UPC" or "UPC_Code".'
    };

  } catch (error) {
    console.error('[EXCEL] Parse error:', error);
    return {
      success: false,
      data: null,
      error: `Failed to parse Excel file: ${error.message}`
    };
  }
}

/**
 * Find the header row index containing UPC column
 * @param {Array} sheetData - 2D array of sheet data
 * @returns {number} - Row index or -1 if not found
 */
function findHeaderRow(sheetData) {
  // Search first 20 rows for header
  const maxSearchRows = Math.min(20, sheetData.length);

  for (let i = 0; i < maxSearchRows; i++) {
    const row = sheetData[i];
    if (!row || !Array.isArray(row)) continue;

    // Check if this row contains a UPC column header
    const hasUpc = row.some(cell => {
      const cellValue = String(cell || '').toLowerCase().trim();
      return UPC_VARIATIONS.includes(cellValue);
    });

    if (hasUpc) {
      return i;
    }
  }

  return -1;
}

/**
 * Find column index by name variations
 * @param {Array} headerRow - Header row array
 * @param {Array} variations - Array of acceptable column names
 * @returns {number} - Column index or -1 if not found
 */
function findColumnIndex(headerRow, variations) {
  for (let i = 0; i < headerRow.length; i++) {
    const cellValue = String(headerRow[i] || '').toLowerCase().trim();
    if (variations.includes(cellValue)) {
      return i;
    }
  }
  return -1;
}

/**
 * Validate a single UPC format
 * @param {string} upc - UPC code
 * @returns {boolean}
 */
function isValidUpc(upc) {
  // UPC should be numeric and typically 12-13 digits
  // But we accept any numeric string as Amazon may handle variations
  const cleanUpc = String(upc).replace(/\D/g, '');
  return cleanUpc.length >= 8 && cleanUpc.length <= 14;
}

module.exports = {
  parseExcelFile,
  isValidUpc,
  findHeaderRow,
  findColumnIndex,
  UPC_VARIATIONS,
  BRAND_VARIATIONS
};
