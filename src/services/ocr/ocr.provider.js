/**
 * Abstract OCR Provider Interface
 */
export class OCRProvider {
  /**
   * Process a file / image and extract structured data
   * @param {string} fileIdOrUrl
   * @returns {Promise<{ amount: number|null, vendor: string|null, date: Date|null, gstNumber: string|null }>}
   */
  async extractData(fileIdOrUrl) {
    throw new Error('Method extractData() must be implemented by OCR provider.');
  }
}

/**
 * Intelligent Mock & Pattern OCR Provider for production demonstration
 * (Ready to swap with Google Vision API / Tesseract / AWS Textract)
 */
export class PatternMockOCRProvider extends OCRProvider {
  async extractData(fileIdOrUrl) {
    // Simulated smart OCR extraction based on receipt patterns
    const sampleVendors = ['AWS', 'Google Cloud', 'OpenAI', 'Uber', 'Starbucks', 'Airtel', 'Hostinger'];
    const randomVendor = sampleVendors[Math.floor(Math.random() * sampleVendors.length)];
    const randomAmount = Math.floor(Math.random() * 450) + 50;
    const randomGst = `29${Math.random().toString(36).substring(2, 7).toUpperCase()}1Z5`;

    return {
      amount: randomAmount,
      vendor: randomVendor,
      date: new Date(),
      gstNumber: randomGst,
    };
  }
}
