import StoreKit
import Capacitor

/// Capacitor plugin for StoreKit2 In-App Purchase.
/// Exposes getProducts and purchase to the JavaScript layer.
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
    ]

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self) else {
            call.reject("Missing productIds")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: Set(productIds))
                let result = products.map { product in
                    [
                        "id": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice,
                        "price": "\(product.price)",
                        "description": product.description,
                    ] as [String: Any]
                }
                call.resolve(["products": result])
            } catch {
                call.reject("Failed to fetch products")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found", "PRODUCT_NOT_FOUND")
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve([
                            "success": true,
                            "transactionId": "\(transaction.id)",
                            "productId": transaction.productID,
                            "jwsRepresentation": verification.jwsRepresentation,
                        ])
                    case .unverified:
                        call.reject("Transaction unverified", "UNVERIFIED")
                    }
                case .userCancelled:
                    call.reject("Cancelled", "CANCELLED")
                case .pending:
                    call.reject("Pending approval", "PENDING")
                @unknown default:
                    call.reject("Unknown result")
                }
            } catch {
                call.reject("Purchase failed")
            }
        }
    }
}
