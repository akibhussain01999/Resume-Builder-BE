const { StatusCodes } = require('http-status-codes');
const PDFDocument = require('pdfkit');
const ApiError = require('../../utils/ApiError');
const Resume = require('../resume/resume.model');
const CoverLetter = require('../cover-letter/coverLetter.model');

const writePdfFromLines = (res, filename, lines) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);

  lines.forEach((line, index) => {
    doc.fontSize(index === 0 ? 18 : 12).text(String(line || ''), {
      paragraphGap: 8
    });
  });

  doc.end();
};

const generateResumePdf = async ({ userId, resumeId, res }) => {
  const resume = await Resume.findOne({ resumeId, userId });
  if (!resume) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'RESUME_NOT_FOUND', 'Resume not found');
  }

  const lines = [
    resume.title,
    `Template: ${resume.templateId}`,
    `Theme: ${resume.themeColor}`,
    '',
    JSON.stringify(resume.data, null, 2)
  ];

  return writePdfFromLines(res, `${resume.resumeId}.pdf`, lines);
};

const generateCoverLetterPdf = async ({ userId, coverLetterId, res }) => {
  const letter = await CoverLetter.findOne({ coverLetterId, userId });
  if (!letter) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'COVER_LETTER_NOT_FOUND', 'Cover letter not found');
  }

  const lines = [
    letter.title,
    `Template: ${letter.templateId}`,
    `Theme: ${letter.themeColor}`,
    '',
    JSON.stringify(letter.data, null, 2)
  ];

  return writePdfFromLines(res, `${letter.coverLetterId}.pdf`, lines);
};

module.exports = {
  generateResumePdf,
  generateCoverLetterPdf
};
