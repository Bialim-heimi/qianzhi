import UIKit
import WebKit
import CoreMotion

// Requires the iOS 27.1 SDK. UIHingeInteraction is documented by Apple as a beta API.
@MainActor
final class RitualViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!
    private let motionManager = CMMotionManager()
    private var rocking = PrayerRockingDetector()
    private var loaded = false
    private var latestStatus = "unknown"
    private var hingeInteraction: UIHingeInteraction?
    private var trailingConstraint: NSLayoutConstraint!
    private var leadingConstraint: NSLayoutConstraint!
    private var topConstraint: NSLayoutConstraint!
    private var bottomConstraint: NSLayoutConstraint!

    override var canBecomeFirstResponder: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1)
        UIApplication.shared.applicationSupportsShakeToEdit = false
        let config = WKWebViewConfiguration()
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__QIAN_NATIVE__ = true;",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(WeakShareHandler(self), name: "qianShare")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        leadingConstraint = webView.leadingAnchor.constraint(equalTo: view.leadingAnchor)
        trailingConstraint = webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        topConstraint = webView.topAnchor.constraint(equalTo: view.topAnchor)
        bottomConstraint = webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([leadingConstraint, trailingConstraint, topConstraint, bottomConstraint])
        let interaction = UIHingeInteraction { [weak self] _, update in
            guard let self else { return }
            let status: String
            switch update.hinge?.status {
            case .closed?: status = "closed"
            case .partiallyOpen?: status = "partiallyOpen"
            case .fullyOpen?: status = "fullyOpen"
            default: status = "unknown"
            }
            if status != self.latestStatus { self.rocking.reset() }
            self.latestStatus = status
            if status == "closed" { self.startRockingUpdates() } else { self.motionManager.stopDeviceMotionUpdates() }
            if status == "closed" {
                self.view.endEditing(true)
                self.becomeFirstResponder()
            }
            self.sendStatus()
        }
        hingeInteraction = interaction
        view.addInteraction(interaction)
        guard let entry = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "dist") else {
            let label = UILabel()
            label.text = "缺少 dist 资源文件夹，请按 README 添加。"
            label.textAlignment = .center
            label.frame = view.bounds
            label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(label)
            return
        }
        webView.loadFileURL(entry, allowingReadAccessTo: entry.deletingLastPathComponent())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
        if latestStatus == "closed" { startRockingUpdates() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard view.bounds.width > 0, view.bounds.height > 0 else { return }
        var content = view.safeAreaLayoutGuide.layoutFrame
        // Regions are in view coordinates and already include their margins.
        // Reserve a conservative strip at the nearest edge without drawing any system UI.
        for region in view.reservedRegions(kind: .occlusion) where region.isActive {
            let r = region.frame.intersection(view.bounds)
            guard !r.isNull, r.intersects(content) else { continue }
            let distances = [r.minX, view.bounds.maxX-r.maxX, r.minY, view.bounds.maxY-r.maxY]
            let edge = distances.enumerated().min(by: { $0.element < $1.element })?.offset ?? 1
            switch edge {
            case 0: content = content.intersection(CGRect(x: r.maxX, y: 0, width: max(0,view.bounds.maxX-r.maxX), height: view.bounds.height))
            case 1: content = content.intersection(CGRect(x: 0, y: 0, width: max(0,r.minX), height: view.bounds.height))
            case 2: content = content.intersection(CGRect(x: 0, y: r.maxY, width: view.bounds.width, height: max(0,view.bounds.maxY-r.maxY)))
            default: content = content.intersection(CGRect(x: 0, y: 0, width: view.bounds.width, height: max(0,r.minY)))
            }
        }
        guard !content.isNull else { return }
        leadingConstraint.constant = content.minX
        trailingConstraint.constant = content.maxX-view.bounds.maxX
        topConstraint.constant = content.minY
        bottomConstraint.constant = content.maxY-view.bounds.maxY
    }

    private func sendStatus() {
        guard loaded else { return }
        view.setNeedsLayout()
        webView.callAsyncJavaScript("window.QianNative?.receive(payload)",
            arguments: ["payload": ["status": latestStatus]],
            in: nil, in: .page, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        sendStatus()
    }

    private func startRockingUpdates() {
        guard motionManager.isDeviceMotionAvailable, !motionManager.isDeviceMotionActive else { return }
        motionManager.deviceMotionUpdateInterval = 1.0 / 50.0
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let motion, self.loaded, self.latestStatus == "closed" else { return }
            // z is perpendicular to the phone face, matching the palms' forward/back motion.
            if self.rocking.feed(z: motion.userAcceleration.z * 9.80665,
                                 time: Date.timeIntervalSinceReferenceDate * 1000) {
                self.webView.callAsyncJavaScript("window.QianNative?.shake()", arguments: [:],
                    in: nil, in: .page, completionHandler: nil)
            }
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        motionManager.stopDeviceMotionUpdates()
        rocking.reset()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "qianShare", let body = message.body as? [String: Any],
              let text = body["text"] as? String else { return }
        var items: [Any] = [text]
        if let ink = body["ink"] as? String, let comma = ink.firstIndex(of: ","),
           let data = Data(base64Encoded: String(ink[ink.index(after: comma)...])),
           let image = UIImage(data: data) { items.append(image) }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = view
        controller.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(controller, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL { decisionHandler(.allow) }
        else { decisionHandler(.cancel) }
    }
}

@MainActor
private final class WeakShareHandler: NSObject, WKScriptMessageHandler {
    weak var target: RitualViewController?
    init(_ target: RitualViewController) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

private struct PrayerRockingDetector {
    var phase = 0
    var sign = 0
    var started: Double = 0
    var neutral: Double? = nil
    var until: Double = 0
    mutating func reset() { phase = 0; sign = 0; started = 0; neutral = nil; until = 0 }
    mutating func feed(z: Double, time: Double) -> Bool {
        guard z.isFinite, time.isFinite, time >= until else { return false }
        if phase != 0 && time-started > 2400 { reset() }
        let current = z > 1.3 ? 1 : (z < -1.3 ? -1 : 0)
        if phase == 0 { if current != 0 { sign=current; started=time; phase=1 }; return false }
        if phase == 1 && current == -sign { phase=2; return false }
        if phase == 2 && current == sign {
            if time-started < 300 { reset(); return false }
            phase=3; return false
        }
        if phase == 3 {
            if abs(z) <= 0.55 {
                if neutral == nil { neutral=time }
                if time-(neutral ?? time) >= 100 && time-started >= 400 {
                    reset(); until=time+350; return true
                }
            } else { neutral=nil }
        }
        return false
    }
}
