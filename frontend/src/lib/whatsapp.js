// WhatsApp group invite links per class. Keyed by class id (batch slug). A
// student is shown the "Join our WhatsApp Group" screen once, right after signup,
// with the link for their class. Traditional Yoga shares one group across all
// timings. Kids Yoga has no group, so it (and any class not listed here) skips
// the screen and goes straight to the home page.
const GROUP_LINKS = {
  traditional_yoga: 'https://chat.whatsapp.com/KMAkBeZeFOhDF7OXCgAuxT?s=cl&p=a&ilr=4',
  weight_loss_yoga: 'https://chat.whatsapp.com/GDUTB7korIIJd6WLxyMDvX?s=cl&p=a&ilr=4',
  zumba: 'https://chat.whatsapp.com/DxPvqNy1S7E4CGtC6kUpUZ?s=cl&p=a&ilr=4',
  gymnastics: 'https://chat.whatsapp.com/CtBlPOuDYMV3BiYD5bd2KQ?s=cl&p=a&ilr=4',
  senior_citizens_yoga: 'https://chat.whatsapp.com/Gpg8fGwlhf91mOqGdSnD6S?s=cl&p=a&ilr=4',
  prenatal_yoga: 'https://chat.whatsapp.com/FgJejdWSV3QIu4U3CXUp0P?s=cl&p=a&ilr=4',
  // kids_yoga: intentionally omitted — skip the join screen entirely.
}

/** The WhatsApp group link for a class, or null if that class has no group. */
export function whatsappGroupLink(batch) {
  return GROUP_LINKS[batch] || null
}

// We can't detect an actual WhatsApp join (WhatsApp gives no callback), so
// "joined" means the student has tapped Join Group at least once. We remember it
// per student so the blocking home-screen prompt keeps reappearing until they do,
// then never again. Keyed by student id so a shared device tracks each member.
const joinedKey = (studentId) => `waJoined:${studentId}`

export const hasJoinedWhatsapp = (studentId) =>
  localStorage.getItem(joinedKey(studentId)) === '1'

export const markJoinedWhatsapp = (studentId) =>
  localStorage.setItem(joinedKey(studentId), '1')
