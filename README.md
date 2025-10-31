# 🌊 **Lighthouse Checker** - AI-Powered Web Performance Dashboard

A modern, dark-themed web application for running comprehensive Lighthouse audits with AI-powered insights. Built with Next.js, TypeScript, and Tailwind CSS featuring a stunning navy blue + yellow accent design.

![Lighthouse Dashboard](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=for-the-badge&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-3.3-06B6D4?style=for-the-badge&logo=tailwindcss)
![Lighthouse](https://img.shields.io/badge/Lighthouse-13.0-F44B21?style=for-the-badge&logo=lighthouse)

## 🌟 Features

- **Multi-URL Auditing**: Process multiple URLs from CSV upload or direct text input
- **Desktop & Mobile Testing**: Configurable form factors with appropriate throttling
- **AI-Powered Insights**: Optional OpenAI integration for intelligent performance recommendations
- **Real-time Progress**: Live updates during audit processing
- **Report Downloads**: Access HTML and JSON reports for detailed analysis
- **Bypass Token Support**: Handle protected Vercel deployments
- **Clean Dashboard**: Developer-friendly interface with progress tracking

## 🏗️ Architecture

```
lighthouse-webapp/
├── src/
│   ├── components/          # React UI components
│   │   └── LighthouseDashboard.tsx
│   ├── lib/                 # Core business logic
│   │   ├── lighthouse.ts    # Lighthouse service integration
│   │   └── utils.ts         # Utility functions
│   ├── pages/              # Next.js pages and API routes
│   │   ├── api/
│   │   │   ├── audit.ts     # Main audit endpoint
│   │   │   ├── upload-csv.ts # CSV file handling
│   │   │   └── reports/     # Report serving
│   │   ├── _app.tsx         # App configuration
│   │   └── index.tsx        # Main dashboard page
│   ├── styles/              # Global styles
│   │   └── globals.css      # Tailwind CSS configuration
│   └── types/               # TypeScript definitions
│       └── index.ts
├── public/
│   └── reports/             # Generated audit reports
└── reports/                 # Report storage directory
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm
- Chrome/Chromium browser (for Lighthouse)

### Installation

1. **Clone or navigate to the webapp directory:**
   ```bash
   cd lighthouse-webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your values:
   ```env
   # Optional: OpenAI API Key for AI insights
   OPENAI_API_KEY=sk-your-openai-key-here
   
   # Optional: Vercel Bypass Token
   VERCEL_BYPASS_TOKEN=your-bypass-token
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage Guide

### Basic Workflow

1. **Choose Input Method:**
   - **Paste URLs**: Enter URLs directly (one per line or comma-separated)
   - **Upload CSV**: Select a CSV file with URLs in the first column

2. **Configure Settings:**
   - **Form Factor**: Choose Desktop or Mobile testing
   - **OpenAI API Key**: (Optional) For AI-powered insights
   - **Vercel Bypass Token**: (Optional) For protected deployments

3. **Run Audit:**
   - Click "Run Lighthouse Audit" to start processing
   - Monitor real-time progress in the status panel

4. **View Results:**
   - Review scores in the results table
   - Download HTML reports for detailed analysis
   - Read AI insights (if API key provided)

### Input Formats

**Text Input Example:**
```
https://example.com
https://another-site.com/page
https://third-site.com/category/products
```

**CSV Format Example:**
```csv
URL,Description (optional)
https://example.com,Homepage
https://example.com/products,Product Listing
https://example.com/about,About Page
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| Form Factor | Yes | Desktop (fast network, no CPU throttling) or Mobile (4G network, 4x CPU throttling) |
| OpenAI API Key | No | Enables AI-powered insights and recommendations |
| Vercel Bypass Token | No | Required for testing protected Vercel deployments |


## 🔐 Security Considerations

- **File Uploads**: CSV files are limited to 5MB and validated
- **Path Traversal**: Report serving includes path validation
- **API Keys**: Environment variables are server-side only
- **CORS**: API routes are protected from cross-origin requests

## 🐛 Troubleshooting

### Common Issues

**"Lighthouse audit failed"**
- Ensure Chrome/Chromium is installed
- Check if URLs are accessible
- Verify bypass token for protected sites

**"Out of memory" errors**
- Reduce concurrent URL processing
- Increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`

**CSV upload issues**
- Ensure file is valid CSV format
- Check URLs are in the first column
- File size must be under 5MB

**Missing AI insights**
- Verify OpenAI API key is set correctly
- Check API key has sufficient credits
- Ensure GPT-4 model access

### Performance Optimization

**For Large URL Lists:**
- Process in smaller batches (10-20 URLs)
- Use environment variables instead of form inputs
- Consider horizontal scaling for production

**Memory Management:**
- Monitor Node.js memory usage
- Implement session cleanup (already included)
- Use Redis for production session storage


### Adding New Features

1. **New API Endpoints**: Add to `src/pages/api/`
2. **UI Components**: Add to `src/components/`
3. **Utilities**: Add to `src/lib/`
4. **Types**: Update `src/types/index.ts`

---

**Built with ❤️ using Next.js, React, TypeScript, and Lighthouse**