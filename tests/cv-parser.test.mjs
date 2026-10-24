import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCv, sanitizeCvSkills, reconstructPdfPage} from '../cv-parser.mjs';

const options={now:'2026-10-24T12:00:00'};
const parse=text=>parseCv(text,options).profile;

test('separates inline personal details without copying neighbouring fields',()=>{
 const profile=parse(`Full Name: Nurul Aina Binti Rahman
Age: 36 | Location: Petaling Jaya, Selangor | Current Role: Accounts Executive (9 Years Experience)
Education: Diploma in Accounting
Skills: Financial Reporting, Microsoft Excel, Payroll
Experience Summary: Managed payroll and monthly financial reporting.
Career Interests: Financial analytics`);
 assert.equal(profile.fullName,'Nurul Aina Binti Rahman');
 assert.equal(profile.age,'36');
 assert.equal(profile.location,'Petaling Jaya, Selangor');
 assert.equal(profile.currentRole,'Accounts Executive');
 assert.equal(profile.yearsExperience,'9');
 assert.equal(profile.education,'Diploma in Accounting');
 assert.equal(profile.interests,'Financial analytics');
 assert.equal(profile.skills.length,3);
});

test('preserves cultural names and explicitly labelled lowercase names',()=>{
 assert.equal(parse('Name: alya de silva\nSkills: Rust, Go, Kotlin').fullName,'alya de silva');
 assert.equal(parse('AHMAD bin ALI\nSoftware Engineer\nSkills: Rust, Go, Kotlin').fullName,'AHMAD bin ALI');
 assert.equal(parse('姓名：陈小明\n技能：Python, SQL, Rust').fullName,'陈小明');
});

test('keeps job-related skills from categorized skill sections',()=>{
 const profile=parse(`Alya de Silva
Technical Skills
Programming Languages: Rust, Go, Kotlin
Tools: Notion, Microsoft Excel
English (Fluent)
Certifications
Unrelated certificate`);
 for(const skill of ['Rust','Go','Kotlin','Notion','Microsoft Excel','English'])assert.ok(profile.skills.includes(skill),skill);
 assert.ok(!profile.skills.includes('Unrelated certificate'));
});

test('excludes strengths, attitudes, and experience descriptions from skills',()=>{
 const skills=sanitizeCvSkills([
  'Python, SQL, Tableau',
  'Leadership, Communication, Team Coordination',
  'Fast learner, detail-oriented, hard-working',
  'Managed a team of five and delivered reports on time',
  'Stakeholder engagement'
 ]);
 assert.deepEqual(skills,['Python','SQL','Tableau']);
});

test('CV parsing outputs only recognized job skills, not traits or work-history prose',()=>{
 const profile=parse(`Alya de Silva
Skills
Python, SQL, Tableau
Detail-oriented, positive attitude, team player
Managed reporting for five years`);
 assert.deepEqual(profile.skills,['Python','SQL','Tableau']);
});

test('does not infer skills from duties when there is no explicit skills section',()=>{
 assert.deepEqual(parse('Alya de Silva\nWork Experience\nSoftware Engineer\n2021 - 2024\nBuilt services in Python and SQL.').skills,[]);
});

test('uses the latest employment entry even in chronological CVs',()=>{
 const profile=parse(`Alya de Silva
Work Experience
Junior Engineer
2018 - 2020
Supported operational projects.
Senior Engineer
2021 - Present
Led engineering projects.`);
 assert.equal(profile.currentRole,'Senior Engineer');
});

test('merges overlapping work periods and excludes education dates',()=>{
 const profile=parse(`Alya de Silva
Education
Bachelor of Engineering
2014 - 2018
Work Experience
Engineer
Jan 2020 - Jan 2022
Consultant
Jan 2021 - Jan 2023`);
 assert.equal(profile.yearsExperience,'3');
});

test('understands numeric employment dates and Malay current-date wording',()=>{
 assert.equal(parse('Alya de Silva\nPengalaman Kerja\nEngineer\n01/2020 hingga 01/2023').yearsExperience,'3');
 assert.equal(parse('Alya de Silva\nWork Experience\nEngineer\nJan 2026 - Kini').yearsExperience,'0.8');
});

test('only calculates age from an explicit DOB, not graduation dates',()=>{
 assert.equal(parse('Name: Alya de Silva\nDOB: 14/03/1999').age,'27');
 assert.equal(parse('Name: Alya de Silva\nDOB: 31/02/1999').age,'');
 assert.equal(parse('Alya de Silva\nEducation\nBachelor of Science\n2018 - 2022').age,'');
});

test('keeps the qualification and field of study but removes education dates and campuses',()=>{
 const profile=parse(`Alya de Silva
Education
Bachelor of Information Systems, Example University (Graduated 2026)
Diploma in Accounting, Politeknik Example, 2019 - 2021
Main Campus`);
 assert.equal(profile.education,'Bachelor of Information Systems · Diploma in Accounting');
});

test('can use an explicitly stated objective in the profile summary',()=>{
 assert.equal(parse('Alya de Silva\nSummary\nExperienced engineer. Seeking a role in renewable energy.').interests,'Seeking a role in renewable energy.');
 assert.equal(parse('Alya de Silva\nSummary\nExperienced engineer in renewable energy.').interests,'');
});

test('suggests career interests from a profile and work history when none are stated',()=>{
 const result=parseCv(`Alya de Silva
Current Role: Data Analyst
Summary
Focuses on turning business data into clear reports and insights.
Work Experience
Data Analyst
2022 - Present
Built dashboards and reporting workflows for business teams.`,options);
 assert.equal(result.profile.interests,'Data analysis and reporting');
 assert.ok(result.notes.includes('Career interests were suggested from your profile and work history. Please review and edit them.'));
 assert.equal(result.evidence.interests,'inferred');
});

test('does not infer career interests when the profile has no clear career evidence',()=>{
 assert.equal(parse('Alya de Silva\nSummary\nA dedicated and reliable professional.').interests,'');
});

test('recognizes current study with year-only dates',()=>{
 assert.equal(parse('Alya de Silva\nEducation\nBachelor in Computer Science\n2024 - Present').currentRole,'Computer Science Student');
});

test('does not treat a skills-only document or placeholder as a person',()=>{
 assert.equal(parse('Skills\nPython SQL Rust').fullName,'');
 assert.equal(parse('Full Name: [Enter your answer here]').fullName,'');
 assert.deepEqual(parse('').skills,[]);
});

test('deduplicates aliases without discarding legitimate skills',()=>{
 assert.deepEqual(sanitizeCvSkills(['Excel, Microsoft Excel, Rust, rust, PowerBI, Power BI']),['Microsoft Excel','Rust','Power BI']);
 assert.deepEqual(sanitizeCvSkills(['R, C++, C#']),['R','C++','C#']);
});

test('retains PDF header name candidates and reconstructs readable text',()=>{
 const item=(str,x,y,width=100,font=12)=>({str,width,height:font,transform:[font,0,0,font,x,y]});
 const result=reconstructPdfPage([item('ALYA DE SILVA',10,800,180,24),item('Software Engineer',10,770),item('Skills',10,740),item('Rust, Go, Kotlin',10,720)]);
 assert.equal(parseCv(result.text,{...options,nameCandidates:result.nameCandidates}).profile.fullName,'ALYA DE SILVA');
 assert.ok(result.text.includes('Rust, Go, Kotlin'));
});
