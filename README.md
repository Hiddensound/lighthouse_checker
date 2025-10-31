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

## 📊 Understanding Results

### Lighthouse Scores

Each URL is scored across five categories:
- **Performance** (0-100): Loading speed and runtime performance  
- **Accessibility** (0-100): Compliance with accessibility standards
- **Best Practices** (0-100): Security, HTTPS usage, and modern web standards
- **SEO** (0-100): Search engine optimization factors
- **PWA** (0-100): Progressive Web App capabilities

### Score Interpretation

- 🟢 **90-100**: Excellent
- 🟡 **50-89**: Needs Improvement  
- 🔴 **0-49**: Poor

### Desktop vs Mobile Differences

**Desktop Configuration:**
- Fast network (10 Mbps)
- No CPU throttling
- Desktop viewport (1350x940)
- Typically higher scores

**Mobile Configuration:**  
- 4G network simulation (1.6 Mbps)
- 4x CPU throttling
- Mobile viewport (375x812)
- More realistic mobile experience

## 🔧 API Reference

### POST `/api/audit`

Start a new Lighthouse audit session.

**Request Body:**
```json
{
  "urls": ["https://example.com", "https://site2.com"],
  "config": {
    "formFactor": "desktop",
    "apiKey": "sk-optional-openai-key",
    "bypassToken": "optional-vercel-token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "unique-session-id",
  "message": "Audit started successfully"
}
```

### GET `/api/audit?sessionId=<id>`

Get audit progress and results.

**Response:**
```json
{
  "status": "processing|completed|error",
  "currentUrl": "https://currently-processing.com",
  "progress": 2,
  "total": 5,
  "results": [...],
  "error": "error message if any"
}
```

### POST `/api/upload-csv`

Upload and parse CSV file.

**Form Data:**
- `csv`: CSV file
- `config`: JSON string with audit configuration

**Response:**
```json
{
  "success": true,
  "urls": ["https://extracted-url1.com", "..."]
}
```

## 🚢 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Set environment variables in Vercel dashboard
   - Deploy automatically on push

3. **Environment Variables in Vercel:**
   ```
   OPENAI_API_KEY=your-key-here
   VERCEL_BYPASS_TOKEN=your-token-here
   ```

### Local Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

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

## 🔄 Migration from Local Scripts

Your existing scripts have been integrated as follows:

| Original Script | Integration Location | Changes Made |
|----------------|---------------------|--------------|
| `Desktop_runs_lighthouse_ChatGPT_AI.js` | `src/lib/lighthouse.ts` (desktop config) | Modularized, added error handling |
| `mobiletestruns_lighthouse_ChatGPT_AI.js` | `src/lib/lighthouse.ts` (mobile config) | Integrated with desktop version |
| CSV parsing logic | `src/pages/api/upload-csv.ts` | Enhanced validation, security |
| AI insights generation | `src/lib/lighthouse.ts` | Configurable, optional |

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Adding New Features

1. **New API Endpoints**: Add to `src/pages/api/`
2. **UI Components**: Add to `src/components/`
3. **Utilities**: Add to `src/lib/`
4. **Types**: Update `src/types/index.ts`

### Testing

```bash
# Install testing dependencies (not included by default)
npm install --save-dev @testing-library/react @testing-library/jest-dom jest

# Run tests
npm test
```

## 📝 License

This project is licensed under the MIT License - see the original repository for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review GitHub issues in the original repository
3. Create a new issue with detailed information

---

**Built with ❤️ using Next.js, React, TypeScript, and Lighthouse**