// Haptic feedback wrappers. No-ops on web.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNative } from './index'

export async function tapLight() {
  if (!isNative()) return
  try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
}

export async function tapMedium() {
  if (!isNative()) return
  try { await Haptics.impact({ style: ImpactStyle.Medium }) } catch {}
}

export async function tapHeavy() {
  if (!isNative()) return
  try { await Haptics.impact({ style: ImpactStyle.Heavy }) } catch {}
}

export async function selection() {
  if (!isNative()) return
  try { await Haptics.selectionStart(); await Haptics.selectionEnd() } catch {}
}

export async function notifySuccess() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Success }) } catch {}
}

export async function notifyWarning() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Warning }) } catch {}
}

export async function notifyError() {
  if (!isNative()) return
  try { await Haptics.notification({ type: NotificationType.Error }) } catch {}
}
