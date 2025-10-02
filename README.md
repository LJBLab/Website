# LJBLab Website - Parallel Innovation Architect

## 🚀 Overview

Professional portfolio and business website for Lincoln J Bicalho, showcasing expertise in AI/ML, federal systems modernization, and parallel innovation across healthcare, government, and social impact sectors.

**Live Site:** [ljblab.dev](https://ljblab.dev)

## 🎯 Key Features

- **Parallel Innovation Showcase** - Highlighting 3 concurrent ventures (PreventX AI, Bliik, U.S. Federal Government)
- **Impact Dashboard** - Real metrics demonstrating measurable results (32% cost reduction, 1000+ families connected)
- **Interactive Case Studies** - Deep dives into successful projects with proven outcomes
- **Smart Contact System** - 4-step qualification form for pre-qualifying leads
- **Career Timeline** - Visual representation of 10+ years of parallel innovation
- **Client Testimonials** - Real voices from team members and stakeholders
- **Dark/Light Mode** - Fully responsive design with accessibility features

## 🛠️ Tech Stack

- **Framework:** [Astro](https://astro.build) v4.x
- **UI/Styling:** [Tailwind CSS](https://tailwindcss.com) v3.x
- **Template:** Based on [AstroWind](https://github.com/onwidget/astrowind)
- **Icons:** [Tabler Icons](https://tabler-icons.io/)
- **Analytics:** Google Analytics (G-2M8SP1FDEX)
- **Deployment:** Static site generation (SSG)

## 📦 Project Structure

```
/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images and media
│   ├── components/     # Reusable Astro components
│   │   └── widgets/    # Main page sections
│   ├── content/        # Blog posts and content
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   ├── styles/         # Global styles
│   └── config.yaml     # Site configuration
├── Documents/          # Planning and strategy docs
└── package.json        # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lincolnbicalho/LJBLab-Website.git
cd LJBLab-Website
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Open [http://localhost:4321](http://localhost:4321) in your browser

## 📝 Available Scripts

| Command           | Action                                       |
|:-----------------|:---------------------------------------------|
| `npm run dev`    | Start local dev server at `localhost:4321`  |
| `npm run build`  | Build production site to `./dist/`          |
| `npm run preview`| Preview build locally before deploying      |

## 🌐 Deployment

### Build for Production

```bash
npm run build
```

The site will be built to the `./dist/` directory, ready for deployment to any static hosting service.

### Deployment Options

- **Netlify:** Drop the `dist` folder to Netlify
- **Vercel:** Connect GitHub repo for automatic deployments
- **GitHub Pages:** Use GitHub Actions for CI/CD
- **Custom Server:** Serve the `dist` folder with any web server

## 📧 Contact Configuration

The contact form uses a client-side mailto integration. Update the email address in:
- `/src/components/widgets/ContactOptimized.astro`

Current configuration:
- **Email:** lincoln@ljblab.dev
- **Response Time:** 48 hours
- **LinkedIn:** [linkedin.com/in/lincoln-bicalho](https://www.linkedin.com/in/lincoln-bicalho/)
- **GitHub:** [@lincolnbicalho](https://github.com/lincolnbicalho)

## 🎨 Customization

### Site Configuration

Edit `/src/config.yaml` for:
- Site metadata
- Navigation menus
- Social links
- Google Analytics

### Content Updates

- **Homepage:** `/src/pages/index.astro`
- **Case Studies:** `/src/components/widgets/CaseStudies.astro`
- **Testimonials:** `/src/components/widgets/Testimonials.astro`
- **Current Ventures:** `/src/components/widgets/CurrentVenturesV2.astro`

### Styling

The site uses Tailwind CSS with custom configuration in `tailwind.config.js`

## 📊 Key Metrics Displayed

- **32%** Healthcare cost reduction (PreventX AI)
- **1000+** Families connected to care (Bliik)
- **10+** Federal systems modernized
- **100%** Project success rate
- **10+** Years of parallel innovation

## 🔒 Security & Privacy

- No backend server required (static site)
- Contact form uses client-side email (no data storage)
- GDPR-compliant privacy policy included
- No cookies except Google Analytics (with consent)

## 🤝 Professional Engagement

For business inquiries:
- **Email:** lincoln@ljblab.dev
- **LinkedIn:** [Connect on LinkedIn](https://www.linkedin.com/in/lincoln-bicalho/)
- **Schedule:** Use the contact form for a free 30-minute strategy session

## 📄 License

© 2024 LJBLab. All rights reserved.

---

**Built with parallel innovation principles:** Managing multiple concurrent projects while maintaining excellence across all ventures.

🚀 **Currently Active:** PreventX AI | Bliik Platform | U.S. Federal Government Systems