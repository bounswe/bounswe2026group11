declare module 'qrcode' {
  interface QRCodeMatrix {
    size: number;
    get(row: number, col: number): boolean;
  }

  interface QRCodeModel {
    modules: QRCodeMatrix;
  }

  interface QRCodeCreateOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
  }

  const QRCode: {
    create(value: string, options?: QRCodeCreateOptions): QRCodeModel;
  };

  export default QRCode;
}
