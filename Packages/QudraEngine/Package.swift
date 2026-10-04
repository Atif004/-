// swift-tools-version:5.9
import PackageDescription

// محرك الحساب مفصول في حزمة مستقلة لا تعتمد على SwiftUI أو Supabase،
// ليمكن اختباره وإعادة استخدامه بمعزل عن واجهة المستخدم.
let package = Package(
    name: "QudraEngine",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "QudraEngine", targets: ["QudraEngine"])
    ],
    targets: [
        .target(name: "QudraEngine"),
        .testTarget(
            name: "QudraEngineTests",
            dependencies: ["QudraEngine"],
            // حالات مشتركة مع محرك الخادم supabase/functions/_shared/engine.ts
            resources: [.copy("Fixtures")]
        )
    ]
)
