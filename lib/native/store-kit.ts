import { registerPlugin } from '@capacitor/core'

export const TRIP_PASS_PRODUCT_ID = 'com.lulgo.app.trippass'

export interface StoreKitProduct {
  id: string
  displayName: string
  displayPrice: string
  price: string
  description: string
}

export interface StoreKitPurchaseResult {
  success: boolean
  transactionId: string
  productId: string
  jwsRepresentation: string
}

interface StoreKitPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }>
  purchase(options: { productId: string }): Promise<StoreKitPurchaseResult>
}

const StoreKit = registerPlugin<StoreKitPlugin>('StoreKit')

export default StoreKit
