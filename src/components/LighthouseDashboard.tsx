import React, { useState, useCallback } from 'react';
import { Upload, Plus, Play, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { parseUrlsFromText } from '@/lib/utils';
import { ProcessingStatus, AuditResult, LighthouseConfig } from '@/types';

interface Props {
  onRunAudit: (urls: string[], config: LighthouseConfig) => Promise<void>;
  processingStatus: ProcessingStatus;
  results: AuditResult[];
}

const LighthouseDashboard: React.FC<Props> = ({ onRunAudit, processingStatus, results }) => {
  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [bypassToken, setBypassToken] = useState('');
  const [formFactor, setFormFactor] = useState<'desktop' | 'mobile'>('desktop');
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setInputMethod('file');
    } else {
      alert('Please select a valid CSV file');
    }
  }, []);

  // Parse URLs from current input method
  const getUrls = useCallback((): string[] => {
    if (inputMethod === 'text') {
      return parseUrlsFromText(urlInput);
    }
    // For file input, we'll handle this in the API
    return [];
  }, [inputMethod, urlInput]);

  // Run audit handler
  const handleRunAudit = useCallback(async () => {
    const config: LighthouseConfig = {
      apiKey: apiKey.trim() || undefined,
      bypassToken: bypassToken.trim() || undefined,
      formFactor
    };

    if (inputMethod === 'text') {
      const urls = getUrls();
      if (urls.length === 0) {
        alert('Please enter at least one valid URL');
        return;
      }
      await onRunAudit(urls, config);
    } else if (csvFile) {
      // Handle CSV file upload
      const formData = new FormData();
      formData.append('csv', csvFile);
      formData.append('config', JSON.stringify(config));
      
      try {
        const response = await fetch('/api/upload-csv', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const { urls } = await response.json();
          await onRunAudit(urls, config);
        } else {
          alert('Failed to process CSV file');
        }
      } catch (error) {
        alert('Error uploading CSV file');
      }
    }
  }, [inputMethod, csvFile, urlInput, apiKey, bypassToken, formFactor, getUrls, onRunAudit]);

  return (
    <div className="min-h-screen bg-navy-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-100 mb-4 tracking-tight">
            <span className="text-accent-400">Lighthouse</span> AI Audit Dashboard
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Run performance audits on multiple URLs with AI-powered insights
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <div className="card-header -m-6 mb-6 p-6">
                <h2 className="text-xl font-semibold text-gray-100 flex items-center">
                  <span className="text-accent-400 mr-2">⚙️</span>
                  Configure Audit
                </h2>
              </div>
              
              {/* Input Method Selection */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-200 mb-3 block">
                  Input Method
                </label>
                <div className="flex space-x-6">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      value="text"
                      checked={inputMethod === 'text'}
                      onChange={(e) => setInputMethod(e.target.value as 'text' | 'file')}
                      className="mr-3 w-4 h-4 text-accent-500 bg-navy-800 border-navy-600 focus:ring-accent-500 focus:ring-2"
                    />
                    <span className="text-gray-300 group-hover:text-accent-400 transition-colors">📝 Paste URLs</span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      value="file"
                      checked={inputMethod === 'file'}
                      onChange={(e) => setInputMethod(e.target.value as 'text' | 'file')}
                      className="mr-3 w-4 h-4 text-accent-500 bg-navy-800 border-navy-600 focus:ring-accent-500 focus:ring-2"
                    />
                    <span className="text-gray-300 group-hover:text-accent-400 transition-colors">📊 Upload CSV</span>
                  </label>
                </div>
              </div>

              {/* URL Input */}
              {inputMethod === 'text' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    URLs (one per line or comma-separated)
                  </label>
                  <textarea
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com&#10;https://another-site.com"
                    className="input h-32 resize-none"
                    disabled={processingStatus.status === 'processing'}
                  />
                  <p className="mt-2 text-sm text-gray-400 flex items-center">
                    <span className="inline-block w-2 h-2 bg-accent-500 rounded-full mr-2"></span>
                    <span className="text-accent-400 font-semibold">{getUrls().length}</span> valid URL(s) detected
                  </p>
                </div>
              )}

              {/* File Upload */}
              {inputMethod === 'file' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    CSV File
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-navy-600 border-dashed rounded-lg bg-navy-800/50 hover:border-accent-500 transition-colors duration-200">
                    <div className="space-y-2 text-center">
                      <Upload className="mx-auto h-16 w-16 text-accent-400" />
                      <div className="flex text-sm text-gray-300">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-navy-700 px-3 py-1 rounded-md font-medium text-accent-400 hover:text-accent-300 hover:bg-navy-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-500 focus-within:ring-offset-navy-800 transition-colors">
                          <span>📁 Upload a CSV file</span>
                          <input
                            id="file-upload"
                            type="file"
                            accept=".csv"
                            className="sr-only"
                            onChange={handleFileUpload}
                            disabled={processingStatus.status === 'processing'}
                          />
                        </label>
                        <p className="pl-2">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-400">CSV files only</p>
                    </div>
                  </div>
                  {csvFile && (
                    <div className="mt-3 p-3 bg-navy-800 rounded-md border border-accent-500/30">
                      <p className="text-sm text-accent-400 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        <span className="font-medium">{csvFile.name}</span> selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 flex items-center">
                    <span className="mr-2">📱</span> Form Factor
                  </label>
                  <select
                    value={formFactor}
                    onChange={(e) => setFormFactor(e.target.value as 'desktop' | 'mobile')}
                    className="input"
                    disabled={processingStatus.status === 'processing'}
                  >
                    <option value="desktop">🖥️ Desktop</option>
                    <option value="mobile">📱 Mobile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 flex items-center">
                    <span className="mr-2">🤖</span> OpenAI API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="input"
                    disabled={processingStatus.status === 'processing'}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-200 mb-2 flex items-center">
                  <span className="mr-2">🔑</span> Vercel Bypass Token (Optional)
                </label>
                <input
                  type="password"
                  value={bypassToken}
                  onChange={(e) => setBypassToken(e.target.value)}
                  placeholder="Your bypass token"
                  className="input"
                  disabled={processingStatus.status === 'processing'}
                />
              </div>

              {/* Run Button */}
              <div className="flex justify-center md:justify-start">
                <button
                  onClick={handleRunAudit}
                  disabled={processingStatus.status === 'processing' || (inputMethod === 'text' && getUrls().length === 0) || (inputMethod === 'file' && !csvFile)}
                  className="btn-primary px-8 py-3 text-base w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingStatus.status === 'processing' ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-navy-900 mr-3"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-3" />
                      🚀 Run Lighthouse Audit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div className="lg:col-span-1">
            <div className="card p-6">
              <div className="card-header -m-6 mb-6 p-6">
                <h3 className="text-lg font-semibold text-gray-100 flex items-center">
                  <span className="text-accent-400 mr-2">📊</span>
                  Status
                </h3>
              </div>
              
              {processingStatus.status === 'idle' && (
                <div className="flex items-center text-gray-400">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                  <span>Ready to run audit</span>
                </div>
              )}
              
              {processingStatus.status === 'processing' && (
                <div className="space-y-4">
                  <div className="flex items-center status-processing">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-400 mr-3"></div>
                    <span className="font-medium">Processing...</span>
                  </div>
                  {processingStatus.currentUrl && (
                    <div className="p-3 bg-navy-800 rounded-md border border-navy-600">
                      <p className="text-sm text-gray-300 mb-1">Current URL:</p>
                      <p className="text-xs text-accent-400 font-mono break-all">
                        {processingStatus.currentUrl}
                      </p>
                    </div>
                  )}
                  {processingStatus.progress !== undefined && processingStatus.totalUrls && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-300 mb-2">
                        <span><span className="text-accent-400 font-bold">{processingStatus.progress}</span> of {processingStatus.totalUrls}</span>
                        <span className="text-accent-400 font-bold">{Math.round((processingStatus.progress / processingStatus.totalUrls) * 100)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${(processingStatus.progress / processingStatus.totalUrls) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {processingStatus.status === 'completed' && (
                <div className="space-y-4">
                  <div className="flex items-center status-success">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    <span className="font-medium">Audit completed! ✨</span>
                  </div>
                  {processingStatus.insightsFile && (
                    <div>
                      <a
                        href={processingStatus.insightsFile}
                        download
                        className="badge-download"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download AI Insights
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {processingStatus.status === 'error' && (
                <div className="flex items-center status-error bg-red-900/30 border border-red-800 rounded-md p-3">
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="text-sm">Error: {processingStatus.error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {results.length > 0 && (
          <div className="mt-8">
            <div className="card p-0 overflow-hidden">
              <div className="card-header p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-100 flex items-center">
                    <span className="text-accent-400 mr-3">📈</span>
                    Audit Results
                    <span className="ml-3 text-sm bg-accent-500/20 text-accent-400 px-2 py-1 rounded-full">
                      {results.length} URLs
                    </span>
                  </h2>
                  {processingStatus.insightsFile && (
                    <a
                      href={processingStatus.insightsFile}
                      download
                      className="inline-flex items-center px-4 py-2 bg-accent-500 text-navy-900 text-sm font-semibold rounded-md hover:bg-accent-400 transition-colors shadow-lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download AI Insights
                    </a>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-navy-700">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        🔗 URL
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        ⚡ Performance
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        ♿ Accessibility
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        ✅ Best Practices
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        🎯 SEO
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        📊 Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700">
                    {results.map((result, index) => (
                      <tr key={index} className="table-row">
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-200 max-w-xs">
                            <div className="truncate font-mono text-accent-400">
                              {result.url}
                            </div>
                          </div>
                          {result.error && (
                            <div className="text-sm text-red-400 mt-1 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Error: {result.error}
                            </div>
                          )}
                        </td>
                        {result.scores ? (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <ScoreBadge score={result.scores.performance} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <ScoreBadge score={result.scores.accessibility} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <ScoreBadge score={result.scores['best-practices']} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <ScoreBadge score={result.scores.seo} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {result.reportPaths && (
                                <div className="flex space-x-2">
                                  <a
                                    href={result.reportPaths.html}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link-primary flex items-center text-sm hover:bg-navy-700 px-2 py-1 rounded-md transition-colors"
                                    title="View HTML Report"
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    HTML
                                  </a>
                                </div>
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            No data available
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (score >= 50) return 'bg-accent-500/20 text-accent-400 border border-accent-500/30';
    return 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🟢';
    if (score >= 50) return '🟡';
    return '🔴';
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm">{getScoreEmoji(score)}</span>
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getScoreColor(score)}`}>
        {Math.round(score)}
      </span>
    </div>
  );
};

export default LighthouseDashboard;