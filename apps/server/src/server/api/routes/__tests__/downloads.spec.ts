import { ANDROID_APK_PATH, buildQrSvg, isQrLinkName, QR_LINKS } from '../downloads.js';

describe('buildQrSvg', () => {
  it('returns an SVG QR code with a white background', () => {
    const svg = buildQrSvg(`https://app.bkmachine.net${ANDROID_APK_PATH}`);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox=');
    expect(svg.toLowerCase()).toContain('#ffffff');
  });
});

describe('QR links', () => {
  it('points at the staged APK and the phone photo page', () => {
    expect(QR_LINKS.android_app).toBe('/downloads/android_app/shop-app.apk');
    expect(QR_LINKS.photo).toBe('/photo');
  });

  it('only accepts the listed names', () => {
    expect(isQrLinkName('photo')).toBe(true);
    expect(isQrLinkName('android_app')).toBe(true);
    expect(isQrLinkName('toString')).toBe(false);
    expect(isQrLinkName('../etc')).toBe(false);
  });
});
