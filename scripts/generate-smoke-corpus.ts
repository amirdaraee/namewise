/**
 * Smoke-test corpus generator — manual pre-release quality check, NOT CI.
 *
 * Generates ~10 deliberately messy files in ./smoke-corpus/ that mimic what
 * real users point namewise at: scanner default names, "Untitled-final(2)"
 * documents, Windows "New Text Document.txt", etc.
 *
 * Usage:
 *   npm run smoke:generate          # just (re)create the corpus
 *   npm run smoke                   # build + generate + dry-run rename with
 *                                   # your configured provider/API key
 *
 * Eyeball the suggested names: are they descriptive, correctly categorized,
 * and in the right language? This doubles as the prompt-tuning feedback loop.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Excel from 'exceljs';
import PDFDocument from 'pdfkit';

const CORPUS_DIR = path.join(process.cwd(), 'smoke-corpus');

function createPdfBuffer(write: (doc: InstanceType<typeof PDFDocument>) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuf = Buffer.concat(chunks);
      // pdfjs v1.x misreads small pooled Buffers (byteOffset > 0); padding past
      // 4096 bytes forces a dedicated allocation — same trick as the test fixtures.
      if (pdfBuf.length > 4096) {
        resolve(pdfBuf);
      } else {
        const pad = Buffer.alloc(4097 - pdfBuf.length, 0x20);
        resolve(Buffer.concat([pdfBuf, Buffer.from('\n%padded\n'), pad]));
      }
    });
    doc.on('error', reject);
    write(doc);
    doc.end();
  });
}

async function main(): Promise<void> {
  if (existsSync(CORPUS_DIR)) rmSync(CORPUS_DIR, { recursive: true });
  mkdirSync(CORPUS_DIR, { recursive: true });

  // 1. Scanner default name, real text content (invoice)
  writeFileSync(
    path.join(CORPUS_DIR, 'scan0001.pdf'),
    await createPdfBuffer(doc => {
      doc.fontSize(18).text('INVOICE #2024-0312');
      doc.fontSize(11).text('\nBilled to: Riverside Dental Clinic\nDate: March 12, 2024\n\nDescription: Annual website maintenance and hosting\nAmount due: $1,450.00\nPayment due within 30 days.');
    })
  );

  // 2. The classic "final final" document (meeting notes)
  writeFileSync(
    path.join(CORPUS_DIR, 'Untitled-final(2).pdf'),
    await createPdfBuffer(doc => {
      doc.fontSize(14).text('Product Team Meeting Notes');
      doc.fontSize(11).text('\nDate: June 3, 2026\nAttendees: Sara, Mike, Priya\n\nDecisions:\n- Ship onboarding redesign in July\n- Defer mobile dark mode to Q4\n- Hire one more backend engineer');
    })
  );

  // 3. Image-only PDF (no selectable text) — exercises the scanned-PDF vision path
  writeFileSync(
    path.join(CORPUS_DIR, 'Scan_2023_11_30.pdf'),
    await createPdfBuffer(doc => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('white');
    })
  );

  // 4. Windows default name, recipe content
  writeFileSync(
    path.join(CORPUS_DIR, 'New Text Document.txt'),
    'Grandma\'s lemon poppy seed muffins\n\nIngredients: 2 cups flour, 3/4 cup sugar, 2 tbsp poppy seeds, zest of 2 lemons, 1 cup buttermilk, 2 eggs.\nBake at 190C for 18-20 minutes. Makes 12 muffins.\n'
  );

  // 5. Keyboard-mash name, project README content
  writeFileSync(
    path.join(CORPUS_DIR, 'asdf.md'),
    '# Inventory Sync Service\n\nSyncs warehouse inventory counts between Shopify and the internal ERP every 15 minutes.\n\n## Setup\n\n```bash\nnpm install && npm start\n```\n'
  );

  // 6. Vague sequential name, insurance letter
  writeFileSync(
    path.join(CORPUS_DIR, 'document1.txt'),
    'Dear Policyholder,\n\nThis letter confirms the renewal of your home insurance policy HO-2291-B effective January 1, 2026. Your annual premium is $1,184. Coverage includes fire, theft, and water damage up to $450,000.\n\nNorthstar Insurance Group\n'
  );

  // 7. "(copy)" suffix, travel itinerary
  writeFileSync(
    path.join(CORPUS_DIR, 'notes (copy).md'),
    '# Lisbon Trip\n\n- Flight TP 942, departs May 14 08:25\n- Hotel: Casa do Bairro, Alfama (3 nights)\n- Day 2: Sintra day trip, Pena Palace tickets booked\n- Day 3: Time Out Market, Fado show 21:00\n'
  );

  // 8. The infamous final-FINAL, CSV-ish sales data
  writeFileSync(
    path.join(CORPUS_DIR, 'data-export-final-FINAL.txt'),
    'region,month,units,revenue\nNorth,2026-01,412,20600\nNorth,2026-02,498,24900\nSouth,2026-01,377,18850\nSouth,2026-02,401,20050\n'
  );

  // 9. Excel default workbook name, household budget
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('Budget');
  sheet.addRow(['Category', 'Monthly budget', 'Actual']);
  sheet.addRow(['Rent', 2100, 2100]);
  sheet.addRow(['Groceries', 600, 684]);
  sheet.addRow(['Transport', 150, 121]);
  sheet.addRow(['Savings', 800, 800]);
  await workbook.xlsx.writeFile(path.join(CORPUS_DIR, 'Book1.xlsx'));

  // 10. Camera default name, image with drawn text (needs optional canvas)
  try {
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4e8d0';
    ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('FARMERS MARKET', 180, 200);
    ctx.font = '28px sans-serif';
    ctx.fillText('Every Saturday 8am - 1pm, Oak Street Square', 90, 280);
    writeFileSync(path.join(CORPUS_DIR, 'IMG_20240315_0042.jpg'), canvas.toBuffer('image/jpeg'));
  } catch {
    console.log('  (canvas not installed — skipping the image fixture)');
  }

  console.log(`Smoke corpus written to ${CORPUS_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
