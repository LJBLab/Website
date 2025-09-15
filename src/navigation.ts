import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'Current Ventures',
      links: [
        {
          text: 'All Projects',
          href: getPermalink('/#ventures'),
        },
        {
          text: 'PreventX AI',
          href: getPermalink('/#preventx'),
        },
        {
          text: 'Bliik Platform',
          href: getPermalink('/#bliik'),
        },
        {
          text: 'Federal Systems',
          href: getPermalink('/#federal'),
        },
      ],
    },
    {
      text: 'About',
      links: [
        {
          text: 'Professional Profile',
          href: getPermalink('/profile'),
        },
        {
          text: 'About LJBLab',
          href: getPermalink('/about'),
        },
      ],
    },
    {
      text: 'Blog',
      href: getBlogPermalink(),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Work With Me', href: getPermalink('/#work-with-me'), variant: 'primary' }],
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
