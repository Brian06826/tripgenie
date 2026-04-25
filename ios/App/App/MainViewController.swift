import UIKit
import Capacitor
import WebKit

/// Custom CAPBridgeViewController subclass that handles first-load failures.
///
/// Problem: On a cold launch, iOS's network stack (DNS, TLS, etc.) can take
/// longer than WKWebView expects, resulting in a white "Error lulgo.com" page
/// on the first launch. The second launch works because DNS/TCP are cached.
///
/// Fix: Show a branded loading overlay until the WebView successfully loads.
/// If the load fails, automatically retry with exponential backoff. If retries
/// are exhausted, show a friendly error screen with a manual retry button.
class MainViewController: CAPBridgeViewController {

    // MARK: - State

    private var loadingOverlay: UIView?
    private var errorOverlay: UIView?
    private var retryCount = 0
    private let maxAutoRetries = 3
    private var isLoadingObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?
    private var loadTimeoutWorkItem: DispatchWorkItem?
    private let loadTimeoutSeconds: TimeInterval = 20
    private var hasSuccessfullyLoaded = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        showLoadingOverlay()
        attachWebViewObservers()
        scheduleLoadTimeout()
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(StoreKitPlugin())
    }

    deinit {
        isLoadingObservation?.invalidate()
        urlObservation?.invalidate()
        loadTimeoutWorkItem?.cancel()
    }

    // MARK: - WebView observation

    private func attachWebViewObservers() {
        // bridge?.webView may not be ready synchronously in viewDidLoad.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let self = self, let webView = self.bridge?.webView else {
                // Try again shortly if the bridge isn't up yet.
                self?.attachWebViewObservers()
                return
            }

            // Enable pinch-to-zoom in the WKWebView scroll view
            webView.scrollView.minimumZoomScale = 1.0
            webView.scrollView.maximumZoomScale = 5.0
            webView.scrollView.pinchGestureRecognizer?.isEnabled = true

            // Observe isLoading → becomes false once a load completes (or fails).
            self.isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] wv, change in
                guard let self = self else { return }
                guard let isLoading = change.newValue, isLoading == false else { return }
                // A load cycle just ended. If the webview now has a real URL
                // and non-zero content, treat it as success.
                if wv.url != nil && wv.url?.absoluteString.isEmpty == false {
                    // Use estimatedProgress as a proxy for "something rendered".
                    if wv.estimatedProgress >= 0.9 {
                        self.handleLoadSuccess()
                    }
                }
            }

            // Observe URL changes — first non-nil URL means navigation started.
            self.urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
                // no-op: we rely on isLoading for completion
                _ = self
            }
        }
    }

    private func scheduleLoadTimeout() {
        loadTimeoutWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, !self.hasSuccessfullyLoaded else { return }
            self.handleLoadFailure(reason: "timeout")
        }
        loadTimeoutWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + loadTimeoutSeconds, execute: work)
    }

    // MARK: - Success / failure handling

    private func handleLoadSuccess() {
        guard !hasSuccessfullyLoaded else { return }
        hasSuccessfullyLoaded = true
        loadTimeoutWorkItem?.cancel()
        retryCount = 0
        hideLoadingOverlay()
        hideErrorOverlay()
    }

    private func handleLoadFailure(reason: String) {
        CAPLog.print("[MainViewController] load failure:", reason, "retry:", retryCount)
        if retryCount < maxAutoRetries {
            retryCount += 1
            let delay = pow(2.0, Double(retryCount - 1)) // 1s, 2s, 4s
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.reloadWebView()
            }
        } else {
            showErrorOverlay()
        }
    }

    private func reloadWebView() {
        hideErrorOverlay()
        showLoadingOverlay()
        scheduleLoadTimeout()
        hasSuccessfullyLoaded = false
        if let webView = bridge?.webView {
            if let url = webView.url, !url.absoluteString.isEmpty {
                webView.reload()
            } else if let serverURL = URL(string: "https://lulgo.com") {
                webView.load(URLRequest(url: serverURL))
            }
        }
    }

    @objc private func retryButtonTapped() {
        retryCount = 0
        reloadWebView()
    }

    // MARK: - Loading overlay

    private func showLoadingOverlay() {
        if loadingOverlay != nil { return }
        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = .white

        let titleLabel = UILabel()
        titleLabel.text = "Lulgo"
        titleLabel.font = UIFont.systemFont(ofSize: 36, weight: .bold)
        titleLabel.textColor = UIColor(red: 0.059, green: 0.090, blue: 0.165, alpha: 1.0) // navy
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(titleLabel)

        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = UIColor(red: 0.976, green: 0.451, blue: 0.086, alpha: 1.0) // #f97316
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        overlay.addSubview(spinner)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -20),
            spinner.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 24),
        ])

        view.addSubview(overlay)
        loadingOverlay = overlay
    }

    private func hideLoadingOverlay() {
        guard let overlay = loadingOverlay else { return }
        UIView.animate(withDuration: 0.25, animations: {
            overlay.alpha = 0
        }, completion: { _ in
            overlay.removeFromSuperview()
        })
        loadingOverlay = nil
    }

    // MARK: - Error overlay

    private func showErrorOverlay() {
        hideLoadingOverlay()
        if errorOverlay != nil { return }

        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = .white

        let titleLabel = UILabel()
        titleLabel.text = "冇辦法連接到網絡"
        titleLabel.font = UIFont.systemFont(ofSize: 22, weight: .semibold)
        titleLabel.textColor = UIColor(red: 0.059, green: 0.090, blue: 0.165, alpha: 1.0)
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(titleLabel)

        let subtitleLabel = UILabel()
        subtitleLabel.text = "請檢查網絡連線，然後再試一次。"
        subtitleLabel.font = UIFont.systemFont(ofSize: 15, weight: .regular)
        subtitleLabel.textColor = UIColor(white: 0.4, alpha: 1.0)
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(subtitleLabel)

        let button = UIButton(type: .system)
        button.setTitle("再試一次", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        button.backgroundColor = UIColor(red: 0.976, green: 0.451, blue: 0.086, alpha: 1.0) // #f97316
        button.layer.cornerRadius = 12
        button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 32, bottom: 14, right: 32)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(retryButtonTapped), for: .touchUpInside)
        overlay.addSubview(button)

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -40),
            titleLabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 32),
            titleLabel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -32),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            subtitleLabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 32),
            subtitleLabel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -32),

            button.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            button.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 32),
        ])

        view.addSubview(overlay)
        errorOverlay = overlay
    }

    private func hideErrorOverlay() {
        errorOverlay?.removeFromSuperview()
        errorOverlay = nil
    }
}
