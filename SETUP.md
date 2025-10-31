# Lighthouse AI Web Application

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd lighthouse-webapp
npm install
```

### 2. Environment Setup (Optional)
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Open Browser
Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Features Checklist

✅ **Core Functionality**
- [x] Multi-URL input (text + CSV upload)
- [x] Desktop & Mobile Lighthouse audits
- [x] Real-time progress tracking
- [x] Report generation (HTML + JSON)
- [x] AI insights integration (OpenAI)
- [x] Vercel bypass token support

✅ **UI/UX**
- [x] Clean dashboard interface
- [x] File upload with drag-and-drop
- [x] Progress visualization
- [x] Results table with score badges
- [x] Download links for reports

✅ **Backend**
- [x] API routes for audit processing
- [x] Session-based progress tracking
- [x] File upload handling
- [x] Report serving with security

✅ **Configuration**
- [x] TypeScript setup
- [x] Tailwind CSS styling
- [x] Next.js optimization
- [x] Environment variable support

## 🛠️ Tech Stack

- **Frontend**: React + Next.js + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Performance Testing**: Lighthouse + Puppeteer
- **AI Integration**: OpenAI API
- **File Processing**: CSV parsing + validation

## 📊 Performance Expectations

### Desktop vs Mobile Scores
- **Desktop**: Fast network, no CPU throttling → Higher scores (70-95)
- **Mobile**: 4G network, 4x CPU throttling → Realistic mobile scores (30-70)

### Processing Time
- **Per URL**: ~30-60 seconds depending on page complexity
- **Batch Processing**: Linear scaling with real-time progress

## 🚢 Deployment Options

### Vercel (Recommended)
```bash
# Push to GitHub and connect to Vercel
vercel --prod
```

### Local Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t lighthouse-app .
docker run -p 3000:3000 lighthouse-app
```

## 📝 Usage Flow

1. **Input URLs** → Text area or CSV upload
2. **Configure** → Desktop/Mobile + Optional API keys  
3. **Run Audit** → Real-time progress tracking
4. **View Results** → Scores table + Download reports
5. **AI Insights** → Generated recommendations (if API key provided)

---

**Ready to transform your Lighthouse workflow into a powerful web application!** 🎯