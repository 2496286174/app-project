'use client';

import { useCallback, useEffect, useState } from 'react';

type AndroidAwareWindow = Window & {
  LiarsBarAndroid?: {
    onRouteChanged?: (route: string) => void;
  };
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

function notifyAndroidRoute() {
  try {
    (window as AndroidAwareWindow).LiarsBarAndroid?.onRouteChanged?.(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  } catch {
    // Android bridge is optional outside the native WebView.
  }
}

async function requestFullscreenForLock() {
  const doc = document as FullscreenDocument;
  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    return;
  }

  const target = document.documentElement as FullscreenElement;
  const requestFullscreen = target.requestFullscreen?.bind(target) || target.webkitRequestFullscreen?.bind(target);
  if (requestFullscreen) {
    await requestFullscreen();
  }
}

async function requestLandscapeLock(options: { requestFullscreen?: boolean } = {}): Promise<boolean> {
  const orientation = window.screen?.orientation as LockableScreenOrientation | undefined;
  if (!orientation?.lock) {
    return false;
  }

  try {
    if (options.requestFullscreen) {
      await requestFullscreenForLock();
    }
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export default function LandscapeOrientationLock() {
  const [lockFailed, setLockFailed] = useState(false);

  const handleEnterLandscape = useCallback(async () => {
    const locked = await requestLandscapeLock({ requestFullscreen: true });
    setLockFailed(!locked);
  }, []);

  useEffect(() => {
    void requestLandscapeLock();
    notifyAndroidRoute();

    const notifyRouteLater = () => {
      window.setTimeout(() => {
        void requestLandscapeLock();
        notifyAndroidRoute();
      }, 0);
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args: Parameters<History['pushState']>) {
      const result = originalPushState.apply(this, args);
      notifyRouteLater();
      return result;
    };

    window.history.replaceState = function replaceState(...args: Parameters<History['replaceState']>) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteLater();
      return result;
    };

    const handleOrientationChange = () => {
      void requestLandscapeLock();
      setLockFailed(false);
    };

    window.addEventListener('popstate', notifyRouteLater);
    window.addEventListener('hashchange', notifyRouteLater);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', notifyRouteLater);
      window.removeEventListener('hashchange', notifyRouteLater);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return (
    <div className="landscape-required-overlay">
      <div className="landscape-required-card">
        <p className="landscape-required-title">请横屏使用</p>
        <p className="landscape-required-copy">点击进入全屏横屏；如果浏览器不支持，请打开系统自动旋转后横放手机。</p>
        <button type="button" className="landscape-required-action" onClick={handleEnterLandscape}>
          进入横屏
        </button>
        {lockFailed ? (
          <p className="landscape-required-hint">当前浏览器拒绝横屏锁定，可以换 Chrome/系统浏览器，或使用 Android App。</p>
        ) : null}
      </div>
    </div>
  );
}
