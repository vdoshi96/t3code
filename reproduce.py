#!/usr/bin/env python3
import plistlib
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

# Compiles the supplied production editor unchanged; only the Expo bridge is stubbed.
source, udid, label = sys.argv[1:]
root = Path(__file__).resolve().parent
output = root / ("build-" + label)
app = output / "ScrollProbe.app"
app.mkdir(parents=True, exist_ok=True)
sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
flags = ["-target", "arm64-apple-ios17.0-simulator", "-sdk", sdk]
subprocess.run(["xcrun", "swiftc", *flags, "-emit-library", "-emit-module", "-module-name", "ExpoModulesCore",
                str(root / "ExpoModulesCore.swift"), "-emit-module-path", str(output / "ExpoModulesCore.swiftmodule"),
                "-Xlinker", "-install_name", "-Xlinker", "@rpath/libExpoModulesCore.dylib",
                "-o", str(app / "libExpoModulesCore.dylib")], check=True)
shutil.copyfile(root / "probe.swift", output / "main.swift")
subprocess.run(["xcrun", "swiftc", *flags, "-module-name", "ScrollProbe", "-I", str(output), "-L", str(app),
                "-lExpoModulesCore", "-Xlinker", "-rpath", "-Xlinker", "@executable_path",
                str(Path(source).resolve()), str(output / "main.swift"), "-o", str(app / "ScrollProbe")], check=True)
info = {
    "CFBundleIdentifier": "dev.t3code.composer-scroll-probe",
    "CFBundleExecutable": "ScrollProbe", "CFBundleName": "Composer Scroll Probe",
    "CFBundlePackageType": "APPL", "CFBundleVersion": "1", "CFBundleShortVersionString": "1.0",
    "LSRequiresIPhoneOS": True, "UILaunchScreen": {},
    "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"],
    "UIApplicationSceneManifest": {"UIApplicationSupportsMultipleScenes": False,
        "UISceneConfigurations": {"UIWindowSceneSessionRoleApplication": [{
            "UISceneConfigurationName": "Default", "UISceneDelegateClassName": "ScrollProbe.SceneDelegate"}]}}
}
(app / "Info.plist").write_bytes(plistlib.dumps(info))
subprocess.run(["codesign", "--force", "--sign", "-", str(app)], check=True)
subprocess.run(["xcrun", "simctl", "terminate", udid, info["CFBundleIdentifier"]], check=False, capture_output=True)
subprocess.run(["xcrun", "simctl", "install", udid, str(app)], check=True)
container = Path(subprocess.check_output(["xcrun", "simctl", "get_app_container", udid, info["CFBundleIdentifier"], "data"], text=True).strip())
result = container / "Documents/results.txt"
result.unlink(missing_ok=True)
recorder = subprocess.Popen(["xcrun", "simctl", "io", udid, "recordVideo", "--codec=h264", "--force", str(root / (label + ".mp4"))], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
captured = set()
stages = {"Refocused and expanded": "reopen", "Controlled insertion": "insertion", "Native typing": "typing"}
try:
    subprocess.run(["xcrun", "simctl", "launch", udid, info["CFBundleIdentifier"], label], check=True)
    for _ in range(125):
        logs = result.read_text() if result.exists() else ""
        for stage, name in stages.items():
            if stage in logs and stage not in captured:
                subprocess.run(["xcrun", "simctl", "io", udid, "screenshot", str(root / (label + "-" + name + ".png"))], check=True, capture_output=True)
                captured.add(stage)
        if len(captured) == len(stages):
            break
        time.sleep(0.2)
    if len(captured) != len(stages):
        raise RuntimeError("Native probe did not finish all stages")
    logs = result.read_text()
    (root / (label + "-results.txt")).write_text(logs)
    print(logs)
finally:
    recorder.send_signal(signal.SIGINT)
    recorder.communicate(timeout=10)
