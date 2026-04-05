const User = require('../../user/user.model');
const Resume = require('../../resume/resume.model');
const CoverLetter = require('../../cover-letter/coverLetter.model');

const getStats = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalResumes,
    totalCoverLetters,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    newResumesToday,
    newResumesThisWeek,
    newResumesThisMonth,
    verifiedUsers,
    recentUsers,
    recentResumes
  ] = await Promise.all([
    User.countDocuments(),
    Resume.countDocuments(),
    CoverLetter.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Resume.countDocuments({ createdAt: { $gte: startOfToday } }),
    Resume.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Resume.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ isEmailVerified: true }),
    User.find().sort({ createdAt: -1 }).limit(5).select('name email isEmailVerified createdAt'),
    Resume.find().sort({ createdAt: -1 }).limit(5).select('resumeId title templateId userId createdAt')
  ]);

  return {
    overview: {
      totalUsers,
      totalResumes,
      totalCoverLetters,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers
    },
    signups: {
      today: newUsersToday,
      thisWeek: newUsersThisWeek,
      thisMonth: newUsersThisMonth
    },
    resumes: {
      today: newResumesToday,
      thisWeek: newResumesThisWeek,
      thisMonth: newResumesThisMonth
    },
    recentUsers,
    recentResumes
  };
};

module.exports = { getStats };
