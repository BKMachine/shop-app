import bwipjs from 'bwip-js';
import { Router } from 'express';
import HttpError from '../../middleware/httpError.js';

const router: Router = Router();

export const ANDROID_APK_PATH = '/downloads/android_app/shop-app.apk';

/**
 * Links Settings > Extras shows as QR codes, so a phone's camera can open them
 * directly. Only these paths, so the route can't be used to encode arbitrary text.
 */
export const QR_LINKS = {
  android_app: ANDROID_APK_PATH,
  photo: '/photo',
} as const;

export function isQrLinkName(value: string): value is keyof typeof QR_LINKS {
  return Object.hasOwn(QR_LINKS, value);
}

/** QR code (SVG, white background so it scans in dark mode too) for the given text. */
export function buildQrSvg(text: string): string {
  return bwipjs.toSVG({
    bcid: 'qrcode',
    text,
    scale: 4,
    paddingwidth: 4,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF',
  });
}

// /api/downloads/android_app/qr.svg, /api/downloads/photo/qr.svg: the full link
// built from the host the PC is browsing on.
router.get('/downloads/:name/qr.svg', (req, res, next) => {
  const { name } = req.params;
  if (!isQrLinkName(name)) return next(new HttpError(404, 'Unknown QR link.'));

  try {
    const url = new URL(QR_LINKS[name], `${req.protocol}://${req.get('host')}`).toString();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(buildQrSvg(url));
  } catch (e) {
    next(e);
  }
});

export default router;
