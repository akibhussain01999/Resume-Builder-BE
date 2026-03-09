const templates = [
  {
    id: 'modern',
    type: 'resume',
    name: 'Modern Slate',
    category: 'professional',
    previewUrl: '/assets/templates/modern.png'
  },
  {
    id: 'executive',
    type: 'resume',
    name: 'Executive Prime',
    category: 'executive',
    previewUrl: '/assets/templates/executive.png'
  },
  {
    id: 'elegant-cl',
    type: 'cover-letter',
    name: 'Elegant Letter',
    category: 'minimal',
    previewUrl: '/assets/templates/elegant-cl.png'
  }
];

const templateCategories = [
  { id: 'professional', label: 'Professional' },
  { id: 'executive', label: 'Executive' },
  { id: 'minimal', label: 'Minimal' }
];

const resumeExamples = [
  {
    id: 'example-se-1',
    role: 'software-engineer',
    title: 'Software Engineer - Mid Level',
    summary: 'Full-stack engineer with 5 years experience in cloud native systems.'
  },
  {
    id: 'example-fe-1',
    role: 'frontend-engineer',
    title: 'Frontend Engineer - Senior',
    summary: 'React specialist delivering high performance and accessible UI systems.'
  }
];

module.exports = {
  templates,
  templateCategories,
  resumeExamples
};
