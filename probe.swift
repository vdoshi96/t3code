import UIKit
enum T3ComposerClipboard {
  static func read() -> [String: String] { [:] }
  static func write(text: String, fragment: String) {}
}
final class ProbeController: UIViewController {
  let composer = T3ComposerEditorView()
  let status = UILabel()
  var editor: UITextView { composer.subviews.first as! UITextView }
  let draft = (1...40).map { "Line \($0): a long composer draft" }.joined(separator: "\n")
  var logs: [String] = []
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    let heading = UILabel(frame: CGRect(x: 20, y: 80, width: 360, height: 50))
    heading.text = "T3 editor probe: " + (CommandLine.arguments.dropFirst().first ?? "")
    heading.font = .systemFont(ofSize: 18, weight: .semibold)
    view.addSubview(heading)
    status.frame = CGRect(x: 20, y: 140, width: 360, height: 90)
    status.numberOfLines = 0
    status.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
    view.addSubview(status)
    composer.frame = CGRect(x: 20, y: 250, width: 360, height: 160)
    composer.backgroundColor = .secondarySystemBackground
    view.addSubview(composer)
    composer.layoutIfNeeded()
    document(draft)
    later(1) { self.composer.focusEditor() }
    later(2) {
      self.editor.scrollRangeToVisible(self.editor.selectedRange)
      self.log("Long draft, scrolled to end")
    }
    later(4) {
      self.composer.blurEditor()
      self.composer.setScrollEnabled(false)
      self.composer.setContentInsetVertical(6)
      self.composer.frame.size.height = 36
      self.composer.layoutIfNeeded()
    }
    later(5) { self.log("Blurred and collapsed") }
    later(6) {
      self.composer.focusEditor()
      self.composer.setScrollEnabled(true)
      self.composer.setContentInsetVertical(0)
      self.composer.frame.size.height = 160
      self.composer.layoutIfNeeded()
    }
    later(7) { self.log("Refocused and expanded") }
    later(10) {
      self.document(self.draft + String(repeating: "\nNew dictated text at the end", count: 4))
    }
    later(11) { self.log("Controlled insertion at end") }
    later(14) { self.editor.insertText(" typed at the end") }
    later(15) { self.log("Native typing at end") }
  }
  func document(_ value: String) {
    let json: [String: Any] = ["value": value, "selection": ["start": value.utf16.count, "end": value.utf16.count], "tokensJson": "[]", "mostRecentEventCount": 10000, "isNativeEcho": false]
    composer.setControlledDocumentJson(String(data: try! JSONSerialization.data(withJSONObject: json), encoding: .utf8)!)
    composer.layoutIfNeeded()
  }
  func later(_ seconds: Double, _ block: @escaping () -> Void) {
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: block)
  }
  func log(_ step: String) {
    editor.layoutIfNeeded()
    let caret = editor.caretRect(for: editor.selectedTextRange!.end)
    let visible = editor.bounds.contains(CGPoint(x: caret.midX, y: caret.midY))
    status.text = "\(step)\noffset: \(Int(editor.contentOffset.y)), caret: \(Int(caret.minY))\nCaret visible: \(visible), focused: \(editor.isFirstResponder)"
    let row = "\(step): offset=\(editor.contentOffset) bounds=\(editor.bounds) content=\(editor.contentSize) selection=\(editor.selectedRange) caret=\(caret) visible=\(visible) focused=\(editor.isFirstResponder)"
    logs.append(row)
    try! logs.joined(separator: "\n").write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("results.txt"), atomically: true, encoding: .utf8)
  }
}
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: scene)
    window.rootViewController = ProbeController()
    window.makeKeyAndVisible()
    self.window = window
  }
}
final class AppDelegate: UIResponder, UIApplicationDelegate {}
UIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(AppDelegate.self))
