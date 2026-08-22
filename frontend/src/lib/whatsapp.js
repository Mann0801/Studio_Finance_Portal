import { api } from './api'

// The WhatsApp group link now lives on each class (classes.whatsapp_group_url),
// editable by the admin, so students always get the current group. Classes with
// no link (e.g. Kids Yoga) return null and show no prompt.
export const whatsappGroupLink = (cls) => cls?.whatsapp_group_url || null

// We can't detect an actual WhatsApp join (WhatsApp gives no callback), so
// "joined" means the student tapped Join Group at least once, for that class.
// It's persisted on the enrollment row (enrollments.whatsapp_joined) so the
// reminder clears for good across all devices, independently per class. Best
// effort: a failure here just means the reminder shows again later.
export async function markWhatsappJoined(classId) {
  try {
    await api(`/api/me/enrollments/${classId}/whatsapp-joined`, { method: 'POST' })
  } catch {
    /* non-fatal — they still got the link; the reminder will simply persist */
  }
}
