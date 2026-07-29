// Money formatting helper. Class metadata is now dynamic — see lib/classes.js.
export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`
