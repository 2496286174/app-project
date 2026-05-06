package com.liarsbarandroidhost

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import java.io.IOException

class MainActivity : Activity() {
  private var hostServer: NativeHostServer? = null
  private var hostPort: Int = 3000
  private lateinit var webView: WebView
  private lateinit var errorView: TextView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    configureImmersiveMode()

    hostServer = startHostServer()

    val container = FrameLayout(this).apply {
      setBackgroundColor(Color.rgb(251, 255, 253))
    }

    errorView = TextView(this).apply {
      text = "页面加载失败，请重试"
      textSize = 16f
      setTextColor(Color.rgb(97, 112, 126))
      gravity = android.view.Gravity.CENTER
      visibility = View.GONE
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    webView = WebView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(Color.rgb(251, 255, 253))
      isVerticalScrollBarEnabled = false
      isHorizontalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
      addJavascriptInterface(AndroidRouteBridge(), "LiarsBarAndroid")
      webViewClient = object : WebViewClient() {
        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
          if (!url.isNullOrBlank()) {
            updateOrientationForRoute(url)
          }
          super.doUpdateVisitedHistory(view, url, isReload)
        }

        override fun onPageFinished(view: WebView, url: String) {
          updateOrientationForRoute(url)
          injectRouteObserver(view)
          errorView.visibility = View.GONE
          webView.visibility = View.VISIBLE
        }

        override fun onReceivedError(
          view: WebView,
          request: WebResourceRequest,
          error: WebResourceError
        ) {
          if (request.isForMainFrame) {
            errorView.visibility = View.VISIBLE
            webView.visibility = View.GONE
          }
        }
      }
      webChromeClient = object : WebChromeClient() {
        override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
          Log.d(
            "LiarsBarWebView",
            "${consoleMessage.messageLevel()}: ${consoleMessage.message()} @${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}"
          )
          return true
        }
      }
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.allowFileAccess = true
      settings.allowContentAccess = true
      settings.mediaPlaybackRequiresUserGesture = false
      settings.loadsImagesAutomatically = true
      settings.loadWithOverviewMode = true
      settings.useWideViewPort = true
      settings.setSupportZoom(false)
      settings.builtInZoomControls = false
      settings.displayZoomControls = false
      settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
      settings.offscreenPreRaster = true
      val bootstrap = """
        <!doctype html>
        <html>
          <body style="background:#fbfffd;">
            <script>
              if (window.localStorage.getItem('playerIdentitySchemaVersion') !== 'player-name-id-v1') {
                window.localStorage.removeItem('playerName');
                window.localStorage.removeItem('playerId');
                window.localStorage.setItem('playerIdentitySchemaVersion', 'player-name-id-v1');
              }
              window.localStorage.setItem('hostAddress', '127.0.0.1');
              window.localStorage.setItem('hostPort', '$hostPort');
              window.location.replace('/login');
            </script>
          </body>
        </html>
      """.trimIndent()
      loadDataWithBaseURL(
        "http://127.0.0.1:$hostPort/",
        bootstrap,
        "text/html",
        "utf-8",
        null
      )
    }

    container.addView(webView)
    container.addView(errorView)
    setContentView(container)
  }

  override fun onResume() {
    super.onResume()
    configureImmersiveMode()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      configureImmersiveMode()
    }
  }

  override fun onDestroy() {
    hostServer?.shutdownAndClear()
    hostServer?.stop()
    hostServer = null
    if (this::webView.isInitialized) {
      webView.destroy()
    }
    super.onDestroy()
  }

  private fun startHostServer(): NativeHostServer {
    for (port in listOf(3000, 3001)) {
      val server = NativeHostServer(applicationContext, port)
      try {
        server.start()
        hostPort = port
        return server
      } catch (error: IOException) {
        server.shutdownAndClear()
        server.stop()
      }
    }

    throw IllegalStateException("No available host port: 3000 or 3001")
  }

  private inner class AndroidRouteBridge {
    @JavascriptInterface
    fun onRouteChanged(route: String) {
      runOnUiThread {
        updateOrientationForRoute(route)
      }
    }
  }

  private fun injectRouteObserver(view: WebView) {
    val script = """
      (function () {
        function notifyRoute() {
          try {
            if (window.LiarsBarAndroid && window.LiarsBarAndroid.onRouteChanged) {
              window.LiarsBarAndroid.onRouteChanged(
                window.location.pathname + window.location.search + window.location.hash
              );
            }
          } catch (error) {}
        }

        if (!window.__liarsBarAndroidRouteObserverInstalled) {
          window.__liarsBarAndroidRouteObserverInstalled = true;
          var originalPushState = window.history.pushState;
          var originalReplaceState = window.history.replaceState;

          window.history.pushState = function () {
            var result = originalPushState.apply(this, arguments);
            window.setTimeout(notifyRoute, 0);
            return result;
          };

          window.history.replaceState = function () {
            var result = originalReplaceState.apply(this, arguments);
            window.setTimeout(notifyRoute, 0);
            return result;
          };

          window.addEventListener('popstate', notifyRoute);
          window.addEventListener('hashchange', notifyRoute);
        }

        notifyRoute();
      })();
    """.trimIndent()

    view.evaluateJavascript(script, null)
  }

  private fun updateOrientationForRoute(_routeOrUrl: String) {
    if (requestedOrientation != ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE) {
      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    }
  }

  @Suppress("DEPRECATION")
  private fun configureImmersiveMode() {
    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        window.attributes = window.attributes.apply {
          // Xiaomi / HyperOS 上使用 ALWAYS 有兼容性风险，统一使用更稳的 SHORT_EDGES
          layoutInDisplayCutoutMode =
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
      }

      window.statusBarColor = Color.TRANSPARENT
      window.navigationBarColor = Color.TRANSPARENT

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        window.setDecorFitsSystemWindows(false)
        window.insetsController?.let { controller ->
          controller.systemBarsBehavior =
            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
          controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        } ?: applyLegacyImmersiveFlags()
        return@runCatching
      }

      applyLegacyImmersiveFlags()
    }.onFailure { error ->
      Log.e("LiarsBarImmersive", "Immersive mode failed; fallback to legacy flags", error)
      applyLegacyImmersiveFlags()
    }
  }

  @Suppress("DEPRECATION")
  private fun applyLegacyImmersiveFlags() {
    window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_FULLSCREEN
          or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
  }
}
