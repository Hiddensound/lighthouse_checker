export interface LighthouseConfig {
  apiKey?: string;
  bypassToken?: string;
  formFactor: 'desktop' | 'mobile';
}

export interface AuditResult {
  url: string;
  scores?: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
    pwa: number | 'N/A';
  };
  opportunities?: Array<{
    title: string;
    displayValue?: string;
    numericValue?: number;
  }>;
  reportPaths?: {
    json: string;
    html: string;
  };
  error?: string;
}

export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  currentUrl?: string;
  progress?: number;
  totalUrls?: number;
  results?: AuditResult[];
  error?: string;
  insightsFile?: string; // Path to AI insights file
}

export interface UploadResponse {
  success: boolean;
  urls?: string[];
  error?: string;
}