import { KASDAN_LOGO_PATH } from '../config/branding';

export function BrandLogo() {
  return (
    <div className="kiosk-brand-logo" aria-hidden>
      <img src={KASDAN_LOGO_PATH} alt="" />
    </div>
  );
}
