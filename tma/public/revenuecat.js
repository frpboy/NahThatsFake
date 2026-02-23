
import { Purchases } from '@revenuecat/purchases-js';

const RC_API_KEY = 'test_OmMjTQzTbdOnzhCeKPAtUGkZqOD'; // Your Public API Key
const RC_ENTITLEMENT = 'Nah Thats Fake Pro'; // Your Entitlement ID

// Initialize RevenueCat
export function configureRevenueCat(appUserID) {
  Purchases.configure({
    apiKey: RC_API_KEY,
    appUserID: appUserID || undefined, // Optional: Link to your user ID
    observerMode: false, // Let RevenueCat handle transactions
  });
}

// Login User
export async function loginRevenueCat(appUserID) {
  try {
    if (!appUserID) return null;
    const { customerInfo } = await Purchases.logIn(appUserID);
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat Login Error:', error);
    throw error;
  }
}

// Logout User
export async function logoutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('RevenueCat Logout Error:', error);
  }
}

// Check Pro Status
export async function isPro() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
  } catch (error) {
    console.error('Check Entitlement Error:', error);
    return false;
  }
}

// Get Offerings (Products)
export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || offerings.all?.['default']; // Use 'default' or 'current'
  } catch (error) {
    console.error('Get Offerings Error:', error);
    throw error;
  }
}

// Purchase Package
export async function purchasePackage(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error) {
    if (error.userCancelled) {
      console.warn('User cancelled purchase');
      return null;
    }
    console.error('Purchase Error:', error);
    throw error;
  }
}

// Restore Purchases
export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Restore Purchases Error:', error);
    throw error;
  }
}

// Get Customer Info
export async function getCustomerInfo() {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Get Customer Info Error:', error);
    return null;
  }
}
