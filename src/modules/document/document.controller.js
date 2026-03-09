const asyncHandler = require('../../utils/asyncHandler');
const documentService = require('./document.service');

const generateResumePdf = asyncHandler(async (req, res) => {
  await documentService.generateResumePdf({
    userId: req.user.id,
    resumeId: req.body.resumeId,
    res
  });
});

const generateCoverLetterPdf = asyncHandler(async (req, res) => {
  await documentService.generateCoverLetterPdf({
    userId: req.user.id,
    coverLetterId: req.body.coverLetterId,
    res
  });
});

module.exports = {
  generateResumePdf,
  generateCoverLetterPdf
};
