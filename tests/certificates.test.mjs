import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCourses, assertEditable, assertReady, canDownload, assertReview, MAX_FILE_BYTES, ALLOWED_TYPES } from '../server/certificate-rules.mjs';
const courses = [1, 2, 3].map(id => ({id: String(id), title: `Course ${id}`}));
const plan = {id:'test',user_id:'learner',status:'draft',courses};
const files = courses.map((c, i) => ({course_id:c.id,checked:true,sha256:`hash-${i}`}));
test('requires exactly three distinct named courses', () => {
  assert.equal(validateCourses(courses).length,3);
  for (const invalid of [[],courses.slice(0,2),[courses[0],courses[0],courses[2]],[{id:'',title:'X'},...courses.slice(1)]]) {
    assert.throws(() => validateCourses(invalid));
  }
});
test('does not accept partial uploads, missing checks, wrong-course files or duplicate certificates', () => {
  assert.doesNotThrow(() => assertReady(plan,files));
  assert.throws(() => assertReady(plan,files.slice(0,2)));
  assert.throws(() => assertReady(plan,files.map((f,i) => i===0?{...f,checked:false}:f)));
  assert.throws(() => assertReady(plan,files.map((f,i) => i===0?{...f,course_id:'other'}:f)));
  assert.throws(() => assertReady(plan,files.map(f => ({...f,sha256:'same'}))));
});
test('pending and approved evidence is immutable', () => {
  for (const status of ['draft','rejected']) assert.doesNotThrow(() => assertEditable({...plan,status}));
  for (const status of ['pending','approved']) assert.throws(() => assertEditable({...plan,status}));
});
test('only an owner or server-authorized admin can download a certificate', () => {
  assert.equal(canDownload('learner',{user_id:'learner',app_role:'member'}),true);
  assert.equal(canDownload('learner',{user_id:'other',app_role:'member'}),false);
  assert.equal(canDownload('learner',{user_id:'reviewer',app_role:'admin'}),true);
});
test('admin cannot review their own submission, replay a review, or reject without feedback', () => {
  const pending={...plan,status:'pending'};
  const admin={user_id:'reviewer',app_role:'admin'};
  assert.doesNotThrow(() => assertReview(pending,admin,'approved',''));
  assert.throws(() => assertReview(pending,{user_id:'learner',app_role:'admin'},'approved',''));
  assert.throws(() => assertReview(pending,{user_id:'reviewer',app_role:'member'},'approved',''));
  assert.throws(() => assertReview({...pending,status:'approved'},admin,'approved',''));
  assert.throws(() => assertReview(pending,admin,'rejected',' '));
  assert.throws(() => assertReview(pending,admin,'complete',''));
  assert.doesNotThrow(() => assertReview(pending,admin,'rejected','Please include the issuer and course name.'));
});
test('certificate limits exclude scripts and documents other than PDF/images', () => {
  assert.equal(MAX_FILE_BYTES,5242880);
  assert.deepEqual([...ALLOWED_TYPES],['application/pdf','image/png','image/jpeg']);
});
