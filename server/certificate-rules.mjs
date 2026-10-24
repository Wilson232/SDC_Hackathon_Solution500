export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
export function validateCourses(input) {
  if (!Array.isArray(input) || input.length !== 3) throw new Error('Exactly three courses are required.');
  const courses = input.map(c => ({
    id: String(c?.id || '').trim().slice(0, 120),
    title: String(c?.title || '').trim().slice(0, 250),
    skillCovered: String(c?.skillCovered || c?.title || '').trim().slice(0, 250),
  }));
  if (courses.some(c => !c.id || !c.title) || new Set(courses.map(c => c.id)).size !== 3) {
    throw new Error('Three distinct, named courses are required.');
  }
  return courses;
}
export function assertEditable(plan) {
  if (!['draft', 'rejected'].includes(plan.status)) throw new Error('Submitted or approved certificates cannot be changed.');
}
export function assertReady(plan, certificates) {
  const courses = validateCourses(plan.courses);
  if (certificates.length !== 3 || courses.some(c => !certificates.some(f => f.course_id === c.id && f.checked))) {
    throw new Error('Upload a certificate and check the box for all three courses first.');
  }
  if (new Set(certificates.map(f => f.sha256)).size !== 3) throw new Error('Use a separate certificate for each course.');
}
export function canDownload(ownerId, viewer) {
  return ownerId === viewer.user_id || viewer.app_role === 'admin';
}
export function assertReview(plan, reviewer, decision, note) {
  if (reviewer.app_role !== 'admin') throw new Error('Admin access required.');
  if (plan.user_id === reviewer.user_id) throw new Error('You cannot review your own certificates.');
  if (plan.status !== 'pending') throw new Error('This submission is no longer pending.');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Choose approve or reject.');
  if (decision === 'rejected' && !String(note || '').trim()) throw new Error('Explain which certificates need correction.');
}
