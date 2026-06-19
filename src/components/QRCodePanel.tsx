import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getQrTargetUrl, QR_LABEL } from '../config/branding';

interface QRCodePanelProps {
  /** Smaller layout for the corner overlay during the live mirror. */
  compact?: boolean;
}

export function QRCodePanel({ compact = false }: QRCodePanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(getQrTargetUrl(), {
      width: compact ? 168 : 240,
      margin: 1,
      color: {
        dark: '#3E2418',
        light: '#FAF6EF',
      },
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [compact]);

  return (
    <div
      className={`qr-panel${compact ? ' qr-panel--compact' : ''}`}
      aria-label={QR_LABEL}
    >
      <div className="qr-panel-frame">
        {qrDataUrl ? (
          <img className="qr-panel-image" src={qrDataUrl} alt={QR_LABEL} />
        ) : (
          <div className="qr-panel-placeholder" aria-hidden>
            <div className="qr-panel-grid" />
            <span className="qr-panel-placeholder-mark">QR</span>
          </div>
        )}
      </div>
      <p className="qr-panel-label">{QR_LABEL}</p>
    </div>
  );
}
