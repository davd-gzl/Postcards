import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Keep the on-device store out of iCloud/Finder backups (privacy-first,
        // local-first: the ONLY backup is the user's explicit JSON export). See
        // excludeWebStoreFromBackup — this is the iOS counterpart to Android's
        // allowBackup="false" + data-extraction rules.
        excludeWebStoreFromBackup()
        return true
    }

    /// The WKWebView store holds the whole journal (IndexedDB) AND the on-device
    /// GitHub sync token (localStorage "postcards-sync-token"). iOS backs up
    /// Library/ to iCloud and to unencrypted Finder/iTunes backups by default, so
    /// without this the token and journal would ride off the device with zero user
    /// action — contradicting the in-app promise that the token stays on this
    /// device only. iOS has no single "no backup" switch (unlike Android), so we
    /// mark the WebView's data containers with NSURLIsExcludedFromBackupKey.
    ///
    /// Best-effort and idempotent: a container that doesn't exist yet is skipped
    /// (re-run on every foreground so it is excluded once WebKit creates it), and
    /// setting the flag again is harmless. Any failure is swallowed — this must
    /// never block launch.
    func excludeWebStoreFromBackup() {
        let fm = FileManager.default
        guard let library = fm.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        // WKWebView persists localStorage/IndexedDB under Library/WebKit; cookies
        // under Library/Cookies. Exclude both if present.
        let containers = ["WebKit", "Cookies"]
        for name in containers {
            var url = library.appendingPathComponent(name, isDirectory: true)
            guard fm.fileExists(atPath: url.path) else { continue }
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? url.setResourceValues(values)
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        // Re-assert the backup exclusion now that WebKit has certainly created its
        // store — closes the first-launch gap when Library/WebKit did not yet exist.
        excludeWebStoreFromBackup()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
