const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const fs = require('fs');
const { timingSafeEqual, randomUUID } = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const databasePath = path.join(__dirname, 'registrations.sqlite');
const certificateDirectory = path.join(__dirname, 'private-certificates');
const certificateMimeTypes = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png']
]);
const registrationDocumentColumns = {
  grade12Certificate: 'certificate_filename',
  grade12Transcript: 'grade12_transcript_filename',
  grade8Certificate: 'grade8_certificate_filename',
  grade10Certificate: 'grade10_certificate_filename'
};
const registrationDocumentLabels = {
  grade12Certificate: 'Grade 12 certificate',
  grade12Transcript: 'Grade 9-12 transcript',
  grade8Certificate: 'Grade 8 certificate',
  grade10Certificate: 'Grade 10 certificate'
};
fs.mkdirSync(certificateDirectory, { recursive: true });
const database = new Database(databasePath);

const registrationDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: certificateDirectory,
    filename: (req, file, callback) => callback(null, `${randomUUID()}${certificateMimeTypes.get(file.mimetype)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, callback) => {
    if (!certificateMimeTypes.has(file.mimetype)) {
      return callback(new Error('Upload each required document as a PDF, JPG, or PNG file.'));
    }
    return callback(null, true);
  }
});

function parseCertificateUpload(req, res, next) {
  registrationDocumentUpload.array('studentDocuments', 4)(req, res, (error) => {
    if (!error) return next();

    const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 'Each uploaded document must be 5 MB or smaller.'
      : error.message || 'Unable to upload the Grade 12 certificate.';
    return res.status(400).json({ message });
  });
}

function removeUploadedDocuments(files) {
  for (const file of files || []) fs.unlink(file.path, () => {});
}

function removeStoredCertificate(filename) {
  if (filename) fs.unlink(path.join(certificateDirectory, path.basename(filename)), () => {});
}

function isValidCertificateContent(file) {
  const content = fs.readFileSync(file.path);
  if (file.mimetype === 'application/pdf') {
    return content.subarray(0, 5).toString() === '%PDF-';
  }
  if (file.mimetype === 'image/jpeg') {
    return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

function getSafeOriginalName(file) {
  return path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'student-document';
}

database.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    student_id TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    program TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    student_type TEXT NOT NULL DEFAULT 'senior',
    semester TEXT NOT NULL DEFAULT '',
    certificate_filename TEXT NOT NULL DEFAULT '',
    grade12_transcript_filename TEXT NOT NULL DEFAULT '',
    grade8_certificate_filename TEXT NOT NULL DEFAULT '',
    grade10_certificate_filename TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
const registrationColumns = new Set(database.pragma('table_info(registrations)').map(({ name }) => name));
for (const column of [
  'student_id', 'phone', 'program', 'academic_year', 'student_type', 'semester',
  'certificate_filename', 'grade12_transcript_filename',
  'grade8_certificate_filename', 'grade10_certificate_filename'
]) {
  if (!registrationColumns.has(column)) {
    database.exec(`ALTER TABLE registrations ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
}
database.exec(`
  CREATE TABLE IF NOT EXISTS registration_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_filename TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id)
  )
`);
const insertLegacyDocument = database.prepare(`
  INSERT OR IGNORE INTO registration_documents (registration_id, original_name, stored_filename, mime_type)
  VALUES (?, ?, ?, ?)
`);
for (const [documentType, column] of Object.entries(registrationDocumentColumns)) {
  const legacyDocuments = database.prepare(`
    SELECT id, ${column} AS storedFilename
    FROM registrations
    WHERE ${column} <> ''
  `).all();
  for (const legacyDocument of legacyDocuments) {
    const extension = path.extname(legacyDocument.storedFilename).toLowerCase();
    const mimeType = [...certificateMimeTypes.entries()].find(([, value]) => value === extension)?.[0];
    if (mimeType) {
      insertLegacyDocument.run(
        legacyDocument.id,
        `${registrationDocumentLabels[documentType]}${extension}`,
        legacyDocument.storedFilename,
        mimeType
      );
    }
  }
}
console.log(`Database connected: ${databasePath}`);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Online registration backend is running.',
    database: 'connected'
  });
});

app.post('/api/register', parseCertificateUpload, (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const studentId = typeof req.body.studentId === 'string' ? req.body.studentId.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const program = typeof req.body.program === 'string' ? req.body.program.trim() : '';
  const academicYear = typeof req.body.academicYear === 'string' ? req.body.academicYear.trim() : '';
  const studentType = typeof req.body.studentType === 'string' ? req.body.studentType.trim() : '';
  const semester = typeof req.body.semester === 'string' ? req.body.semester.trim() : '';
  const uploadedFiles = req.files || [];
  const rejectRegistration = (message) => {
    removeUploadedDocuments(req.files);
    return res.status(400).json({ message });
  };

  if (!name || !email || !studentId || !phone || !program || !academicYear || !['new', 'senior'].includes(studentType) || (studentType === 'senior' && !semester)) {
    return rejectRegistration('Complete all required student information.');
  }

  if (studentType === 'new' && uploadedFiles.length !== 4) {
    return rejectRegistration('Select all four required documents in the upload field.');
  }

  if (studentType === 'senior' && uploadedFiles.length) {
    return rejectRegistration('School document uploads are only for new students.');
  }

  if (uploadedFiles.some((file) => !isValidCertificateContent(file))) {
    return rejectRegistration('Each uploaded document must be a valid PDF, JPG, or PNG file.');
  }

  if (name.length > 120 || email.length > 254 || studentId.length > 64 || phone.length > 32 || program.length > 160 || academicYear.length > 32 || semester.length > 32) {
    return rejectRegistration('One or more fields are too long.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return rejectRegistration('Enter a valid email address.');
  }

  let result;
  try {
    const saveRegistration = database.transaction(() => {
      const registration = database.prepare(`
        INSERT INTO registrations (
          name, email, student_id, phone, program, academic_year,
          student_type, semester, certificate_filename,
          grade12_transcript_filename, grade8_certificate_filename,
          grade10_certificate_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
        name, email, studentId, phone, program, academicYear, studentType, semester,
        '', '', '', ''
      );
      const insertDocument = database.prepare(`
        INSERT INTO registration_documents (registration_id, original_name, stored_filename, mime_type)
        VALUES (?, ?, ?, ?)
      `);
      for (const file of uploadedFiles) {
        insertDocument.run(registration.lastInsertRowid, getSafeOriginalName(file), file.filename, file.mimetype);
      }
      return registration;
    });
    result = saveRegistration();
  } catch (error) {
    removeUploadedDocuments(req.files);
    console.error('Could not save student registration:', error.message);
    return res.status(500).json({ message: 'Could not save the registration. Please try again.' });
  }

  return res.status(201).json({
    message: `Registration successful for ${name}!`,
    data: { id: result.lastInsertRowid }
  });
});

function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN || (process.env.NODE_ENV === 'production' ? '' : '1616');
  const authorization = req.get('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!adminToken || (process.env.NODE_ENV === 'production' && adminToken.length < 20)) {
    return res.status(503).json({ message: 'Set a strong ADMIN_TOKEN to enable admin access.' });
  }

  const suppliedBuffer = Buffer.from(suppliedToken);
  const expectedBuffer = Buffer.from(adminToken);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(401).json({ message: 'Invalid admin token.' });
  }

  return next();
}

app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  const registrations = database.prepare(`
    SELECT id, name, email, student_id AS studentId, phone, program,
      academic_year AS academicYear, student_type AS studentType,
      semester, created_at AS createdAt
    FROM registrations
    ORDER BY id DESC
  `).all();

  if (registrations.length) {
    const ids = registrations.map((registration) => registration.id);
    const placeholders = ids.map(() => '?').join(', ');
    const documents = database.prepare(`
      SELECT id, registration_id AS registrationId, original_name AS fileName
      FROM registration_documents
      WHERE registration_id IN (${placeholders})
      ORDER BY id
    `).all(...ids);
    const documentsByRegistration = new Map(registrations.map((registration) => [registration.id, []]));
    for (const document of documents) documentsByRegistration.get(document.registrationId).push(document);
    for (const registration of registrations) {
      registration.documents = documentsByRegistration.get(registration.id);
    }
  }

  return res.json({ data: registrations });
});

app.get('/api/admin/registrations/:id/documents/:documentId', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid registration ID.' });
  }

  const documentId = Number(req.params.documentId);
  if (!Number.isInteger(documentId) || documentId < 1) {
    return res.status(400).json({ message: 'Invalid document ID.' });
  }

  const document = database.prepare(`
    SELECT original_name AS fileName, stored_filename AS storedFilename, mime_type AS mimeType
    FROM registration_documents
    WHERE id = ? AND registration_id = ?
  `).get(documentId, id);
  if (!document) {
    return res.status(404).json({ message: 'This document is not available for the registration.' });
  }

  const filename = path.basename(document.storedFilename);
  const downloadName = path.basename(document.fileName);
  const filePath = path.join(certificateDirectory, filename);
  res.set('Cache-Control', 'private, no-store');
  if (req.query.view === '1') {
    res.type(document.mimeType);
    res.set('Content-Disposition', 'inline');
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ message: 'The document could not be found.' });
      }
    });
  }

  return res.download(filePath, downloadName, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ message: 'The certificate file could not be found.' });
    }
  });
});

app.patch('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const studentId = typeof req.body.studentId === 'string' ? req.body.studentId.trim() : '';
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const program = typeof req.body.program === 'string' ? req.body.program.trim() : '';
  const academicYear = typeof req.body.academicYear === 'string' ? req.body.academicYear.trim() : '';
  const studentType = typeof req.body.studentType === 'string' ? req.body.studentType.trim() : '';
  const semester = typeof req.body.semester === 'string' ? req.body.semester.trim() : '';

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid registration ID.' });
  }

  if (!name || !email || !studentId || !phone || !program || !academicYear || !['new', 'senior'].includes(studentType) || (studentType === 'senior' && !semester)) {
    return res.status(400).json({ message: 'Complete all required student information.' });
  }

  if (name.length > 120 || email.length > 254 || studentId.length > 64 || phone.length > 32 || program.length > 160 || academicYear.length > 32 || semester.length > 32) {
    return res.status(400).json({ message: 'One or more fields are too long.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const result = database.prepare(`
    UPDATE registrations
    SET name = ?, email = ?, student_id = ?, phone = ?, program = ?, academic_year = ?, student_type = ?, semester = ?
    WHERE id = ?
  `).run(name, email, studentId, phone, program, academicYear, studentType, semester, id);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  return res.json({ message: 'Registration updated.' });
});

app.delete('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid registration ID.' });
  }

  const registration = database.prepare('SELECT id FROM registrations WHERE id = ?').get(id);
  if (!registration) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  const documents = database.prepare('SELECT stored_filename FROM registration_documents WHERE registration_id = ?').all(id);
  const deleteRegistration = database.transaction(() => {
    database.prepare('DELETE FROM registration_documents WHERE registration_id = ?').run(id);
    database.prepare('DELETE FROM registrations WHERE id = ?').run(id);
  });
  deleteRegistration();
  for (const document of documents) removeStoredCertificate(document.stored_filename);

  return res.json({ message: 'Registration deleted.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
