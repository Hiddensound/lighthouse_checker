import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { readFileSync } from 'fs';
import { unlink } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { UploadResponse } from '@/types';
import { dedupeUrls, MAX_URLS_PER_AUDIT } from '@/lib/utils';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Parse CSV file and extract URLs
 */
function parseCSV(filePath: string): string[] {
  try {
    const csvData = readFileSync(filePath, 'utf-8');
    const records = parse(csvData, {
      columns: false,
      skip_empty_lines: true
    });
    return records.map((row: any) => row[0]?.trim()).filter((url: string) => url && url.length > 0);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

/**
 * Handle CSV file upload
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<UploadResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let uploadedFilepath: string | undefined;
  try {
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'tmp'),
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    });

    const [, files] = await form.parse(req);
    const csvFile = Array.isArray(files.csv) ? files.csv[0] : files.csv;

    if (!csvFile) {
      return res.status(400).json({ success: false, error: 'No CSV file uploaded' });
    }
    uploadedFilepath = csvFile.filepath;

    // Validate file type
    if (!csvFile.originalFilename?.endsWith('.csv')) {
      return res.status(400).json({ success: false, error: 'Please upload a CSV file' });
    }

    // Parse URLs from CSV
    const urls = parseCSV(csvFile.filepath);

    if (urls.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid URLs found in CSV file' });
    }

    // Validate URLs (http/https only)
    const validUrls = dedupeUrls(urls.filter(url => {
      try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    })).slice(0, MAX_URLS_PER_AUDIT);

    if (validUrls.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid URLs found in CSV file' });
    }

    return res.status(200).json({
      success: true,
      urls: validUrls
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process CSV file'
    });
  } finally {
    if (uploadedFilepath) {
      // Best-effort cleanup; don't fail the request if unlink fails.
      unlink(uploadedFilepath).catch(() => {});
    }
  }
}