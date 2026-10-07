// Is Whimsy running inside the Mac app (Electron) or the Android app (Capacitor)?
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const cap = typeof window !== 'undefined' ? window.Capacitor : null;

export const isAndroidApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
export const isMacApp = /Electron\//.test(ua) && /Macintosh/.test(ua);
export const isDesktopApp = /Electron\//.test(ua);
export const isNativeApp = isAndroidApp || isDesktopApp;

// Android: write the backup to the app's cache, then open the system share sheet
// (Drive, Files, Nearby Share, email...). Resolves false if the person cancels.
export async function shareFileAndroid(name, text) {
  const { Filesystem, Share } = cap.Plugins;
  const res = await Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
  try {
    await Share.share({ title: 'Whimsy backup', files: [res.uri] });
    return true;
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/cancel/i.test(msg)) return false;
    throw e;
  }
}
