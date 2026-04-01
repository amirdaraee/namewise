/**
 * Generates binary test fixture files (docx, xlsx) that cannot be stored
 * as plain text. Called by Vitest's globalSetup before any tests run.
 */
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import Excel from 'exceljs';

const DATA_DIR = path.join(process.cwd(), 'tests', 'data');

// ---------------------------------------------------------------------------
// Minimal ZIP builder (no external dependencies)
// Produces valid PKZIP-format archives, which is what .docx files are.
// ---------------------------------------------------------------------------

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const fileCrc = crc32(file.data);
    const size = file.data.length;

    // Local file header (30 bytes + filename)
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(0, 8);            // store (no compression)
    local.writeUInt16LE(0, 10);           // mod time
    local.writeUInt16LE(0, 12);           // mod date
    local.writeUInt32LE(fileCrc, 14);     // crc32
    local.writeUInt32LE(size, 18);        // compressed size
    local.writeUInt32LE(size, 22);        // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);           // extra field length
    nameBytes.copy(local, 30);

    // Central directory entry (46 bytes + filename)
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);  // signature
    central.writeUInt16LE(20, 4);           // version made by
    central.writeUInt16LE(20, 6);           // version needed
    central.writeUInt16LE(0, 8);            // flags
    central.writeUInt16LE(0, 10);           // store
    central.writeUInt16LE(0, 12);           // mod time
    central.writeUInt16LE(0, 14);           // mod date
    central.writeUInt32LE(fileCrc, 16);     // crc32
    central.writeUInt32LE(size, 20);        // compressed
    central.writeUInt32LE(size, 24);        // uncompressed
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);           // extra
    central.writeUInt16LE(0, 32);           // comment
    central.writeUInt16LE(0, 34);           // disk start
    central.writeUInt16LE(0, 36);           // internal attrs
    central.writeUInt32LE(0, 38);           // external attrs
    central.writeUInt32LE(localOffset, 42); // local header offset
    nameBytes.copy(central, 46);

    parts.push(local, file.data);
    centralEntries.push(central);
    localOffset += 30 + nameBytes.length + size;
  }

  const centralDir = Buffer.concat(centralEntries);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // signature
  eocd.writeUInt16LE(0, 4);                     // disk number
  eocd.writeUInt16LE(0, 6);                     // central dir start disk
  eocd.writeUInt16LE(files.length, 8);           // entries on this disk
  eocd.writeUInt16LE(files.length, 10);          // total entries
  eocd.writeUInt32LE(centralDir.length, 12);     // central dir size
  eocd.writeUInt32LE(localOffset, 16);           // central dir offset
  eocd.writeUInt16LE(0, 20);                     // comment length

  return Buffer.concat([...parts, centralDir, eocd]);
}

// ---------------------------------------------------------------------------
// Docx fixture
// ---------------------------------------------------------------------------

function createDocxBuffer(title: string, bodyText: string): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${title}</w:t></w:r></w:p>
    <w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(wordRels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(document, 'utf8') }
  ]);
}

// ---------------------------------------------------------------------------
// Main generator — called by Vitest globalSetup
// ---------------------------------------------------------------------------

export async function setup(): Promise<void> {
  // --- sample-document.docx ---
  const docxPath = path.join(DATA_DIR, 'sample-document.docx');
  if (!existsSync(docxPath)) {
    const docxBuf = createDocxBuffer(
      'Employment Contract',
      'This employment contract is entered into between Acme Corporation and John Smith for the position of Senior Software Engineer.'
    );
    writeFileSync(docxPath, docxBuf);
  }

  // --- sample-spreadsheet.xlsx ---
  const xlsxPath = path.join(DATA_DIR, 'sample-spreadsheet.xlsx');
  if (!existsSync(xlsxPath)) {
    const workbook = new Excel.Workbook();
    workbook.title = 'Quarterly Report';
    workbook.creator = 'Test Suite';

    const sheet = workbook.addWorksheet('Q4 Data');
    sheet.addRow(['Category', 'Revenue', 'Expenses', 'Profit']);
    sheet.addRow(['Product A', 50000, 30000, 20000]);
    sheet.addRow(['Product B', 75000, 40000, 35000]);
    sheet.addRow(['Total', 125000, 70000, 55000]);

    await workbook.xlsx.writeFile(xlsxPath);
  }
}
