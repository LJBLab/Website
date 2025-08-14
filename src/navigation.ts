import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'Portfolio',
      links: [
        {
          text: 'AI & Machine Learning',
          href: getPermalink('/#ai-ml'),
        },
        {
          text: 'Data Science',
          href: getPermalink('/#data-science'),
        },
        {
          text: 'Blazor Applications',
          href: getPermalink('/#blazor'),
        },
        {
          text: 'MAUI Development',
          href: getPermalink('/#maui'),
        },
      ],
    },
    {
      text: 'Blog',
      href: getBlogPermalink(),
    },
    {
      text: 'About',
      links: [
        {
          text: 'About LJBLab',
          href: getPermalink('/about'),
        },
        {
          text: 'Professional Profile',
          href: getPermalink('/profile'),
        },
      ],
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Get Started', href: getPermalink('/contact'), variant: 'primary' }],
};

export const footerData = {
  links: [
    {
      title: 'Technologies',
      links: [
        { text: 'Artificial Intelligence', href: '#' },
        { text: 'Data Science', href: '#' },
        { text: 'Blazor Applications', href: '#' },
        { text: 'MAUI Development', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'Portfolio', href: getPermalink('/#portfolio') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Quick Links',
      links: [
        { text: 'Home', href: getPermalink('/') },
        { text: 'Services', href: getPermalink('/services') },
        { text: 'Documentation', href: '#' },
        { text: 'GitHub', href: 'https://github.com/ljblab' },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'Email', icon: 'tabler:mail', href: 'mailto:lincoln@ljblab.dev' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/ljblab' },
    { ariaLabel: 'Discord', icon: 'tabler:brand-discord', href: '#' },
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
  ],
  footNote: `
    &copy; 2025 LJBLab. All rights reserved. Innovation Through Code.
  `,
};
