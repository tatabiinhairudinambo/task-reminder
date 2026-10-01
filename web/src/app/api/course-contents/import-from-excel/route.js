import ExcelJS from 'exceljs';
import { requireVerifiedUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendResponse, sendError, route } from '@/lib/api-response';

// POST /api/course-contents/import-from-excel - CourseContentController@importFromExcel
//
// Replaces Maatwebsite\Excel with exceljs. The response contract is unchanged:
//   201 clean import            -> { imported_count, duplicate_rows: [] }
//   200 with duplicates         -> { imported_count, duplicate_rows: [...] }
//   422 row validation failures -> row_errors inside `data`
//   422 heading mismatch        -> errors.headings on the envelope
//
// Legacy templates use `scu`/`sks` for the credit column; both map to
// `credits`, matching the Laravel import normalisation.

const EXPECTED = [
  'semester',
  'code',
  'course_content',
  'credits',
  'lecturer',
  'day',
  'hour_start',
  'hour_end',
];

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!file || typeof file === 'string') {
    return sendError('The file field is required.', 422, { file: ['The file field is required.'] });
  }

  let rows;

  try {
    rows = await readSheet(file);
  } catch {
    return sendError('Gagal membaca file Excel. Pastikan file tidak rusak.', 422);
  }

  if (rows.length === 0) {
    return sendError('File yang diunggah kosong.', 422);
  }

  // Normalize legacy credit aliases before checking headings, so a template
  // using SCU is accepted.
  const normalized = rows.map((row) => {
    if (!row.credits && (row.scu || row.sks)) {
      return { ...row, credits: row.scu || row.sks };
    }
    return row;
  });

  const keysForCheck = Object.keys(rows[0]);
  const missing = EXPECTED.filter((h) => !keysForCheck.includes(h));

  if (missing.length > 0) {
    return sendError('Format kolom template tidak sesuai.', 422, {
      headings: `Kolom yang hilang: ${missing.join(', ')}`,
    });
  }

  const existing = await prisma.courseContent.findMany({
    where: { user_id: user.id },
    select: { code: true, course_content: true, semester: true },
  });

  const existingCodes = new Map();
  const existingNames = new Map();

  for (const row of existing) {
    const codes = existingCodes.get(row.semester) ?? new Set();
    codes.add(row.code);
    existingCodes.set(row.semester, codes);

    const names = existingNames.get(row.semester) ?? new Set();
    names.add(row.course_content);
    existingNames.set(row.semester, names);
  }

  const rowErrors = [];
  const duplicateRows = [];
  const validRows = [];

  normalized.forEach((row, index) => {
    // Skip fully blank rows.
    const hasValue = EXPECTED.some((h) => String(row[h] ?? '').trim() !== '');
    if (!hasValue) return;

    const lineNumber = index + 2;

    const prepared = {};
    for (const heading of EXPECTED) {
      const value = row[heading];
      prepared[heading] = typeof value === 'string' ? value.trim() : value ?? null;
    }

    const errors = validateRow(prepared);

    if (Object.keys(errors).length > 0) {
      rowErrors.push({ line: lineNumber, errors });
      return;
    }

    const isDuplicateCode = existingCodes.get(prepared.semester)?.has(prepared.code) ?? false;
    const isDuplicateName =
      existingNames.get(prepared.semester)?.has(prepared.course_content) ?? false;

    if (isDuplicateCode || isDuplicateName) {
      duplicateRows.push({
        ...prepared,
        _line: lineNumber,
        _duplicate_message: isDuplicateCode
          ? 'Kode sudah digunakan untuk semester tersebut'
          : 'Mata kuliah sudah ditambahkan',
      });
      return;
    }

    validRows.push({
      semester: prepared.semester,
      code: prepared.code,
      course_content: prepared.course_content,
      credits: Number(prepared.credits),
      lecturer: prepared.lecturer,
      day: prepared.day,
      hour_start: timeToDate(prepared.hour_start),
      hour_end: timeToDate(prepared.hour_end),
      user_id: user.id,
    });
  });

  if (rowErrors.length > 0) {
    return sendResponse(
      { row_errors: rowErrors },
      'Terjadi kesalahan validasi pada file yang diunggah.',
      422
    );
  }

  let importedCount = 0;

  if (validRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.courseContent.createMany({ data: validRows });
      importedCount = validRows.length;
    });
  }

  const status = duplicateRows.length === 0 ? 201 : 200;
  const message =
    duplicateRows.length === 0
      ? 'Impor berhasil.'
      : 'Impor selesai dengan beberapa baris duplikat.';

  return sendResponse(
    { imported_count: importedCount, duplicate_rows: duplicateRows },
    message,
    status
  );
});

/** Read the first worksheet into heading-keyed objects. */
async function readSheet(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headings = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headings[colNumber] = String(cell.value ?? '').trim().toLowerCase();
  });

  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const heading = headings[colNumber];
      if (!heading) return;
      record[heading] = cell.value === null || cell.value === undefined ? null : cell.value;
    });

    rows.push(record);
  });

  return rows;
}

/** Row rules mirroring the Laravel validator array. */
function validateRow(row) {
  const errors = {};

  const required = (field) => {
    if (!row[field] || String(row[field]).trim() === '') {
      return `The ${field.replace(/_/g, ' ')} field is required.`;
    }
    return null;
  };

  for (const field of ['semester', 'code', 'course_content', 'lecturer', 'day', 'hour_start', 'hour_end']) {
    const message = required(field);
    if (message) errors[field] = [message];
  }

  if (!row.credits || String(row.credits).trim() === '') {
    errors.credits = ['The credits field is required.'];
  } else if (!Number.isInteger(Number(row.credits))) {
    errors.credits = ['The credits field must be an integer.'];
  } else if (Number(row.credits) < 1) {
    errors.credits = ['The credits field must be at least 1.'];
  }

  return errors;
}

function timeToDate(value) {
  const [h, m] = String(value ?? '00:00').split(':');
  return new Date(Date.UTC(1970, 0, 1, Number(h) || 0, Number(m) || 0, 0));
}
