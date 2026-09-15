export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  knowledges: '/knowledges',
  knowledgeNew: '/knowledges/new',
  knowledgeEdit: (id: string) => `/knowledges/${id}`,
  categories: '/categories',
  tags: '/tags',
} as const;
