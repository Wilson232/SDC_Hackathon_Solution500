// Optional development-only integration smoke check. Never bypasses application authentication.
import { spawn } from 'node:child_process';
import { clerkClient } from '@clerk/express';
import { pool } from '../server/db.mjs';
import { deleteFile } from '../server/storage.mjs';
if (process.env.NODE_ENV === 'production' || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('This check requires the development Clerk instance.');
}
let user, reviewer, chrome, ws;
const report = {};
try {
  const email = `certificate-check-${Date.now()}+clerk_test@example.com`;
  user = await clerkClient.users.createUser({ emailAddress: [email], skipPasswordRequirement: true, firstName: 'Certificate', lastName: 'Tester' });
  const ticket = await clerkClient.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 120 });
  chrome = spawn('/repl/tools/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--remote-debugging-port=9231', `--user-data-dir=/tmp/fmc-certificate-${Date.now()}`, 'about:blank'], { stdio: 'ignore' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let target;
  for (let i = 0; i < 40; i++) {
    try { target = await fetch('http://127.0.0.1:9231/json/new?about:blank', { method: 'PUT' }).then(r => r.json()); break; }
    catch { await wait(200); }
  }
  if (!target) throw new Error('Browser did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 1;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data), p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = seq++; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('Browser script failed: ' + r.exceptionDetails.text);
    return r.result?.value;
  };
  const waitFor = async (predicate, description) => {
    for (let i = 0; i < 80; i++) { if (await predicate()) return; await wait(200); }
    throw new Error('Timed out: ' + description);
  };
  const openPlan = async (careerKey) => {
    await evaluate("sessionStorage.setItem('findmycareer.page','pathway');location.reload();true");
    await waitFor(() => evaluate('Boolean(document.querySelector("#plan-role"))'), 'pathway navigation');
    await evaluate(`(()=>{const select=document.querySelector('#plan-role');select.value=${JSON.stringify(careerKey)};select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    await waitFor(() => evaluate("document.querySelectorAll('.cert-workflow input[type=checkbox]').length===3"), 'certificate cards');
  };
  const switchUser = async targetUser => {
    try { await evaluate('window.Clerk.signOut()'); } catch { /* Sign-out can navigate. */ }
    await waitFor(() => evaluate('Boolean(window.Clerk?.loaded && window.Clerk.client && !window.Clerk.user)'), 'signed-out SDK');
    const nextTicket = await clerkClient.signInTokens.createSignInToken({ userId: targetUser.id, expiresInSeconds: 120 });
    await evaluate(`(async()=>{const result=await window.Clerk.client.signIn.create({strategy:'ticket',ticket:${JSON.stringify(nextTicket.token)}});await window.Clerk.setActive({session:result.createdSessionId});return true;})()`);
    await waitFor(() => evaluate(`fetch('/api/me').then(r=>r.json()).then(a=>a.id===${JSON.stringify(targetUser.id)})`), 'new authenticated identity');
  };
  const uploadImage = async (courseId, variant) => evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=350;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,350,100);ctx.fillStyle='black';ctx.fillText('TEST - NOT A CERTIFICATE: '+${JSON.stringify(variant)},10,50);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const form=new FormData();form.append('file',blob,'test-certificate.png');const r=await fetch('/api/certificate-plans/${report.planId}/courses/'+encodeURIComponent(${JSON.stringify(courseId)})+'/certificate',{method:'PUT',body:form});const body=await r.json();return {status:r.status,plan:body,error:body.error}})()`);
  const planStatus = async () => (await pool.query('SELECT status FROM certificate_plans WHERE id=$1',[report.planId])).rows[0]?.status;
  const confirmUnchecked = async () => {
    for (let index=0;index<3;index++) {
      await evaluate(`(()=>{const input=document.querySelectorAll('.cert-workflow input[type=checkbox]')[${index}];if(!input.checked)input.click();return true;})()`);
      await waitFor(async()=>Boolean((await pool.query('SELECT checked FROM certificate_files WHERE plan_id=$1 AND course_id=$2',[report.planId,report.courseIds[index]])).rows[0]?.checked),'evidence checkbox saved');
      await waitFor(()=>evaluate("!document.querySelector('.cert-check__busy')"),'checkbox save UI');
    }
  };
  const submitViaUI = async () => {
    await evaluate("window.confirm=()=>true;Array.from(document.querySelectorAll('.cert-workflow button')).find(b=>b.textContent.trim()==='Submit certificates').click();true");
    await waitFor(async()=>await planStatus()==='pending','submitted for review');
  };
  await call('Page.enable'); await call('Runtime.enable');
  await call('Page.navigate', { url: `https://${process.env.REPLIT_DEV_DOMAIN}/?lang=en` });
  let ready = false;
  for (let i = 0; i < 60; i++) { await wait(300); ready = await evaluate('Boolean(window.Clerk?.loaded && window.Clerk.client)'); if (ready) break; }
  if (!ready) throw new Error('Clerk browser SDK not ready');
  // Short-lived sign-in ticket remains only in process/browser memory and is never logged.
  await evaluate(`(async()=>{const result=await window.Clerk.client.signIn.create({strategy:'ticket',ticket:${JSON.stringify(ticket.token)}});await window.Clerk.setActive({session:result.createdSessionId});return result.status;})()`);
  let me;
  for (let i = 0; i < 40; i++) {
    await wait(250);
    me = await evaluate("fetch('/api/me').then(async r=>({status:r.status,data:await r.json()}))");
    if (me.status === 200) break;
  }
  if (me.status !== 200) throw new Error('Signed-in API failed with status ' + me.status);
  report.realSignIn = me.status; report.initialAdmin = me.data.isAdmin;
  const saved = { profileData: { fullName: 'Certificate Tester', age: '', location: 'KL', currentRole: 'Data Analyst', yearsExperience: '3', education: 'Bachelor of Analytics', skills: ['SQL', 'Excel', 'Power BI'], experienceSummary: 'Build dashboards and data reports for business teams.', interests: 'Data analysis and reporting', preferredLearningStyle: '' }, isManuallyVerified: true, radarData: null, matchedRoles: null, completedModules: {} };
  await evaluate(`localStorage.setItem('findmycareer.accountData.'+${JSON.stringify(email)},${JSON.stringify(JSON.stringify(saved))});sessionStorage.setItem('findmycareer.page','pathway');location.reload();true`);
  let hasPlan = false;
  for (let i = 0; i < 60; i++) { await wait(250); hasPlan = await evaluate('Boolean(document.querySelector("#plan-role"))'); if (hasPlan) break; }
  if (!hasPlan) throw new Error('Pathway screen did not render');
  await evaluate(`(()=>{const select=document.querySelector('#plan-role');select.value=Array.from(select.options).find(o=>o.value).value;select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  let checks = [];
  for (let i = 0; i < 50; i++) { await wait(200); checks = await evaluate(`Array.from(document.querySelectorAll('.cert-workflow input[type="checkbox"]')).map(i=>({disabled:i.disabled,checked:i.checked}))`); if (checks.length === 3) break; }
  if (checks.length !== 3 || checks.some(c => !c.disabled || c.checked)) {
    console.log('Pathway diagnostic', await evaluate(`({selected:document.querySelector('#plan-role')?.value,workflow:document.querySelector('.cert-workflow')?.innerText?.slice(0,650),checkboxes:Array.from(document.querySelectorAll('main input[type=checkbox]')).map(i=>({disabled:i.disabled,checked:i.checked}))})`));
    throw new Error('Missing-upload checkbox guard failed');
  }
  report.courseCheckboxes = checks.length; report.allDisabledWithoutFile = true;
  const plan = (await pool.query('SELECT id,courses FROM certificate_plans WHERE user_id=$1', [user.id])).rows[0];
  if (!plan) throw new Error('Server plan not persisted');
  const prefix = `/api/certificate-plans/${plan.id}/courses/${encodeURIComponent(plan.courses[0].id)}`;
  report.planId=plan.id;report.courseIds=plan.courses.map(c=>c.id);
  report.checkedWithoutUpload = await evaluate(`fetch('${prefix}/checked',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({checked:true})}).then(r=>r.status)`);
  report.memberAdminAccess = await evaluate("fetch('/api/admin/submissions').then(r=>r.status)");
  report.invalidUpload = await evaluate(`(async()=>{const form=new FormData();form.append('file',new File(['not a real certificate'],'fake.pdf',{type:'application/pdf'}));return (await fetch('${prefix}/certificate',{method:'PUT',body:form})).status})()`);
  const initialUpload=await uploadImage(report.courseIds[0],'one');
  report.storageUpload={status:initialUpload.status,error:initialUpload.error};
  if(initialUpload.status!==200)throw new Error('Live upload unavailable: '+(initialUpload.error||initialUpload.status));
  const fileId=initialUpload.plan.certificates[0].id;
  report.download=await evaluate(`fetch('/api/certificates/${fileId}/download').then(async r=>({status:r.status,type:r.headers.get('Content-Type'),attachment:r.headers.get('Content-Disposition')?.startsWith('attachment'),magic:Array.from(new Uint8Array(await r.arrayBuffer()).slice(0,4))}))`);
  if(report.download.status!==200||JSON.stringify(report.download.magic)!=='[137,80,78,71]')throw new Error('Private download did not return the original PNG bytes');
  if (report.checkedWithoutUpload !== 400 || report.memberAdminAccess !== 403 || report.invalidUpload !== 400) throw new Error('API guard check failed');
  report.submitHidden = await evaluate(`!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Submit certificates')`);
  if (!report.submitHidden) throw new Error('Submit must remain hidden until all three uploads are confirmed');
  await openPlan(plan.careerKey || (await pool.query('SELECT career_key FROM certificate_plans WHERE id=$1',[plan.id])).rows[0].career_key);
  report.onlyUploadedCourseEnabled=await evaluate("Array.from(document.querySelectorAll('.cert-workflow input[type=checkbox]')).map(i=>i.disabled)");
  if(JSON.stringify(report.onlyUploadedCourseEnabled)!=='[false,true,true]')throw new Error('A certificate enabled the wrong course checkbox');
  report.duplicateUpload=(await uploadImage(report.courseIds[1],'one')).status;
  if(report.duplicateUpload!==400)throw new Error('Duplicate certificate accepted');
  for(let i=1;i<3;i++){const uploaded=await uploadImage(report.courseIds[i],`course-${i}`);if(uploaded.status!==200)throw new Error('Course upload failed');}
  const careerKey=(await pool.query('SELECT career_key FROM certificate_plans WHERE id=$1',[plan.id])).rows[0].career_key;
  await openPlan(careerKey);
  await confirmUnchecked();
  await submitViaUI();
  report.pendingImmutable=await evaluate(`fetch('${prefix}/checked',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"checked":false}'}).then(r=>r.status)`);
  if(report.pendingImmutable!==400)throw new Error('Pending evidence was editable');
  await openPlan(careerKey);
  report.pendingScreen=await evaluate("document.querySelector('.cert-workflow').innerText.includes('Your evidence is with our review team')");
  await pool.query("UPDATE app_accounts SET app_role='admin' WHERE user_id=$1",[user.id]);
  report.selfReview=await evaluate(`fetch('/api/admin/submissions/${plan.id}/review',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"decision":"approved","note":""}'}).then(r=>r.status)`);
  await pool.query("UPDATE app_accounts SET app_role='member' WHERE user_id=$1",[user.id]);
  if(report.selfReview!==400)throw new Error('Self-review was allowed');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  report.mobileNoOverflow = await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1');
  await call('Emulation.clearDeviceMetricsOverride');
  reviewer=await clerkClient.users.createUser({emailAddress:[`certificate-reviewer-${Date.now()}+clerk_test@example.com`],skipPasswordRequirement:true,firstName:'Test',lastName:'Reviewer'});
  await switchUser(reviewer);
  report.otherUserPlan=await evaluate(`fetch('/api/certificate-plans/${plan.id}').then(r=>r.status)`);
  report.otherUserDownload=await evaluate(`fetch('/api/certificates/${fileId}/download').then(r=>r.status)`);
  if(report.otherUserPlan!==404||report.otherUserDownload!==404)throw new Error('Another member could access private evidence');
  await pool.query("UPDATE app_accounts SET app_role='admin' WHERE user_id=$1", [reviewer.id]);
  await evaluate("sessionStorage.setItem('findmycareer.page','admin');location.reload();true");
  let adminVisible = false;
  for (let i = 0; i < 40; i++) { await wait(250); adminVisible = await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Certificate reviews')`); if (adminVisible) break; }
  if (!adminVisible) throw new Error('Admin review navigation missing');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Certificate reviews').click();true`);
  await wait(800);
  report.adminScreen = await evaluate(`document.body.innerText.includes('Certificate review')`);
  report.adminApi = await evaluate("fetch('/api/admin/submissions').then(r=>r.status)");
  report.adminDownload=await evaluate(`fetch('/api/certificates/${fileId}/download').then(r=>r.status)`);
  report.emptyRejection=await evaluate(`fetch('/api/admin/submissions/${plan.id}/review',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"decision":"rejected","note":""}'}).then(r=>r.status)`);
  if(report.emptyRejection!==400||report.adminDownload!==200)throw new Error('Reviewer access/feedback guard failed');
  await evaluate(`document.getElementById('admin-review-note-${plan.id}').focus();true`);
  const feedback = 'TEST ONLY: Please replace the first course certificate. <img src=x onerror=alert(1)>';
  await call('Input.insertText',{text:feedback});
  await evaluate(`document.querySelector('.cert-admin-card button.cert-button--reject').click();true`);
  await waitFor(async()=>await planStatus()==='rejected','reviewer requested changes');
  await switchUser(user);await openPlan(careerKey);
  report.rejectionVisible=await evaluate("document.querySelector('.cert-workflow').innerText.includes('Please replace the first course certificate.')");
  await evaluate(`localStorage.removeItem('findmycareer.accountData.'+${JSON.stringify(email)});sessionStorage.setItem('findmycareer.page','home');location.reload();true`);
  let noticeVisible = false;
  for (let i = 0; i < 50; i++) {
    await wait(250);
    noticeVisible = await evaluate(`Boolean(document.querySelector('.cert-notification--rejected'))`);
    if (noticeVisible) break;
  }
  if (!noticeVisible) throw new Error('Unread decision was not displayed after sign-in');
  report.notificationFeedbackSafe = await evaluate(`document.querySelector('.cert-notification__note')?.textContent===${JSON.stringify(feedback)} && !document.querySelector('.cert-notification__note img')`);
  if (!report.notificationFeedbackSafe) throw new Error('Notification feedback did not render safely');
  await evaluate(`document.querySelector('.cert-notification__plan-link').click();true`);
  let directPlanVisible = false;
  for (let i = 0; i < 40; i++) {
    await wait(200);
    directPlanVisible = await evaluate(`Boolean(document.querySelector('.cert-workflow .cert-status--rejected'))`);
    if (directPlanVisible) break;
  }
  if (!directPlanVisible) throw new Error('Notification link failed without local CV data');
  report.directPlanWithoutLocalProfile = directPlanVisible;
  report.directPlanId = await evaluate(`new URLSearchParams(location.search).get('certificatePlan')===${JSON.stringify(plan.id)}`);
  await evaluate('location.reload();true');
  let linkedReload = false;
  for (let i = 0; i < 40; i++) {
    await wait(200);
    linkedReload = await evaluate(`Boolean(document.querySelector('.cert-workflow .cert-status--rejected'))`);
    if (linkedReload) break;
  }
  if (!linkedReload) throw new Error('Direct plan link failed on reload');
  report.directPlanReload = linkedReload;
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  report.notificationMobileNoOverflow = await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1');
  await call('Emulation.clearDeviceMetricsOverride');
  await evaluate(`document.querySelector('.cert-notification__read-button').click();true`);
  let markedRead = false;
  for (let i = 0; i < 30; i++) {
    await wait(150);
    markedRead = await evaluate(`!document.querySelector('.cert-notification')`);
    if (markedRead) break;
  }
  if (!markedRead) throw new Error('Mark as read did not update the visible inbox');
  report.notificationMarkRead = markedRead;
  report.readDidNotChangeDecision = (await pool.query('SELECT status FROM certificate_plans WHERE id=$1', [plan.id])).rows[0].status === 'rejected';
  report.readDidNotChangePersona = (await pool.query('SELECT persona FROM app_accounts WHERE user_id=$1', [user.id])).rows[0].persona === me.data.persona;
  // Restore the synthetic local profile for the original resubmission/award checks.
  await evaluate(`localStorage.setItem('findmycareer.accountData.'+${JSON.stringify(email)},${JSON.stringify(JSON.stringify(saved))});location.href='/?lang=en';true`);
  await waitFor(()=>evaluate('Boolean(window.Clerk?.loaded && document.querySelector(".cert-notifications"))'),'learner app after notification check');
  const replaced=await uploadImage(report.courseIds[0],'corrected');
  if(replaced.status!==200||replaced.plan.certificates.find(c=>c.courseId===report.courseIds[0]).checked)throw new Error('Replacing a certificate did not clear its confirmation');
  report.oldFileRemoved=await evaluate(`fetch('/api/certificates/${fileId}/download').then(r=>r.status)`);
  await openPlan(careerKey);await confirmUnchecked();await submitViaUI();
  await switchUser(reviewer);
  await evaluate("sessionStorage.setItem('findmycareer.page','admin');location.reload();true");
  await waitFor(()=>evaluate(`Boolean(document.getElementById('admin-attestation-${plan.id}'))`),'reviewer decision controls');
  report.approvalRequiresAttestation=await evaluate("document.querySelector('.cert-review-actions .cert-button--primary').disabled");
  await evaluate(`document.getElementById('admin-attestation-${plan.id}').click();true`);
  await waitFor(()=>evaluate("!document.querySelector('.cert-review-actions .cert-button--primary').disabled"),'reviewer attestation');
  await evaluate("document.querySelector('.cert-review-actions .cert-button--primary').click();true");
  await waitFor(async()=>await planStatus()==='approved','reviewer approved submission');
  report.repeatReview=await evaluate(`fetch('/api/admin/submissions/${plan.id}/review',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"decision":"approved","note":""}'}).then(r=>r.status)`);
  await switchUser(user);await openPlan(careerKey);
  report.completionBadge=await evaluate("document.querySelector('.cert-workflow').innerText.includes('Course finished — ')");
  const awarded=await evaluate("fetch('/api/me').then(r=>r.json())");
  report.awards=awarded.awards.length;report.personaUnchanged=awarded.persona===me.data.persona;
  report.approvedImmutable=await evaluate(`fetch('${prefix}/checked',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"checked":false}'}).then(r=>r.status)`);
  if(!report.rejectionVisible||!report.completionBadge||report.awards!==1||!report.personaUnchanged||report.approvedImmutable!==400||report.repeatReview!==400)throw new Error('Review or career-award regression');
  delete report.planId;delete report.courseIds;
  console.log(JSON.stringify(report));
} catch (error) {
  // Do not log provider responses, headers, ticket contents or session values.
  console.error('Certificate browser check failed:', error?.message || 'Unknown error');
  process.exitCode = 1;
} finally {
  try { ws?.close(); chrome?.kill('SIGTERM'); } catch {}
  for (const testUser of [user,reviewer].filter(Boolean)) {
    try {
      const plans = (await pool.query('SELECT id FROM certificate_plans WHERE user_id=$1', [testUser.id])).rows;
      for (const plan of plans) {
        const files = (await pool.query('SELECT object_key FROM certificate_files WHERE plan_id=$1', [plan.id])).rows;
        for (const file of files) await deleteFile(file.object_key);
        await pool.query('DELETE FROM certificate_notifications WHERE plan_id=$1', [plan.id]);
        await pool.query('DELETE FROM certificate_reviews WHERE plan_id=$1', [plan.id]);
        await pool.query('DELETE FROM career_awards WHERE plan_id=$1', [plan.id]);
        await pool.query('DELETE FROM certificate_plans WHERE id=$1', [plan.id]);
      }
      await pool.query('DELETE FROM app_accounts WHERE user_id=$1', [testUser.id]);
      await clerkClient.users.deleteUser(testUser.id);
    } catch { console.error('Synthetic test-account cleanup failed'); }
  }
  await pool.end();
}
