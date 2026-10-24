const aliases = {
 fullName:['full name','name','nama','nama penuh'], age:['age','umur'], location:['location','address','alamat','based in','city / preferred work location'],currentRole:['current role','current role / student status','current role / status','job title','position','occupation'],yearsExperience:['years of experience','years experience'],
 skills:['skills','technical skills','key skills','core skills','core competencies','competencies','skills and abilities','skills & abilities','tools','technologies','kemahiran','technical expertise','professional skills','languages','language proficiency'],
 experienceSummary:['experience','work experience','professional experience','employment history','career history','work history','experience summary','work experience / academic projects','projects','academic projects','project experience','internships','pengalaman kerja'],
 education:['education','academic background','qualifications','academic qualifications','pendidikan','educational background'],interests:['interests','career interests','career objective','objective','career goals','professional objective'],summary:['summary','profile','professional summary','personal profile','about me','career profile'],ignore:['references','referees','certifications','certificates','achievements','awards','publications','volunteer experience','contact','contact details','personal details','resume','curriculum vitae','cv']
};
Object.assign(aliases,{
 birthDate:['date of birth','birth date','dob','tarikh lahir','出生日期'],
});
aliases.fullName.push('candidate name','姓名','名字');
aliases.age.push('年龄');
aliases.location.push('residential address','current location','lokasi','alamat kediaman','地址','所在地');
aliases.currentRole.push('professional title','current position','jawatan','jawatan terkini','职位','现任职位');
aliases.yearsExperience.push('total experience','work experience years','tempoh pengalaman','工作年限');
aliases.skills.push('technical competencies','relevant skills','soft skills','computer skills','language skills','kemahiran teknikal','技能','专业技能');
aliases.experienceSummary.push('employment','work & experience','relevant experience','pengalaman','工作经历','工作经验','实习经历');
aliases.education.push('education & qualifications','education & training','学历','教育背景','教育经历');
aliases.interests.push('career aspirations','personal interests','objektif','objektif kerjaya','minat kerjaya','职业目标','求职意向');
aliases.summary.push('about','personal statement','ringkasan','profil peribadi','个人简介','自我介绍');
aliases.ignore.push('additional information','personal information','hobbies','declaration','activities','extracurricular activities','专业证书','获奖经历');
const clean = value => String(value||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').trim();
const keyOf = value => clean(value).toLowerCase().replace(/^[#•\d.\s)–—-]+/,'').replace(/\*/g,'').replace(/\s*\(optional\)/ig,'').replace(/\s+and\s+/g,' & ').replace(/[:：\s]+$/,'').trim();
const headingMap=new Map(Object.entries(aliases).flatMap(([key,values])=>values.map(value=>[keyOf(value),key])));
function heading(line){const key=keyOf(line);return headingMap.get(key)||headingMap.get(key.replace(/ & /g,' and '))||null;}
const jobRE=/\b(?:analyst|engineer|developer|designer|manager|executive|officer|assistant|specialist|consultant|accountant|technician|coordinator|administrator|supervisor|intern|student|graduate|director|nurse|teacher|lecturer|sales|marketing|recruiter|architect|researcher|clerk|founder|cashier|chef|operator|auditor|programmer)\b/i;
const contactRE=/@|https?:|www\.|linkedin|github|\+?\d[\d ()-]{7,}|\b(?:email|phone|mobile|tel|address|contact|location)\s*:/i;
const orgRE=/\b(?:university|universiti|college|school|institute|polytechnic|politeknik|academy|company|corporation|sdn|bhd|inc|ltd|limited|solutions|technologies|enterprise|enterprises|bachelor|master|diploma|degree|certificate|resume|curriculum|vitae|template|profile|summary|experience|education|skills|references|portfolio)\b/i;
const placeRE=/\b(?:kuala lumpur|petaling jaya|shah alam|selangor|penang|pulau pinang|johor(?: bahru)?|melaka|malacca|ipoh|perak|kedah|sabah|sarawak|kuching|kota kinabalu|putrajaya|cyberjaya|negeri sembilan|seremban|pahang|kuantan|terengganu|kelantan|perlis|labuan|singapore|jakarta|bangkok|manila|ho chi minh|hanoi|remote)\b/i;
const skillsCatalog=['Microsoft Excel','Excel','Power BI','PowerBI','Tableau','SQL','MySQL','PostgreSQL','Python','JavaScript','TypeScript','React','Node.js','Java','Rust','Go','Kotlin','C++','C#','HTML','CSS','PHP','R','SPSS','SAS','MATLAB','Pandas','NumPy','TensorFlow','PyTorch','Machine Learning','Data Analysis','Data Analytics','Data Visualization','Data Visualisation','Financial Reporting','Financial Analysis','Accounting','Bookkeeping','Payroll','Invoice Processing','SAP','QuickBooks','Xero','Salesforce','CRM','Customer Service','Project Management','Agile','Scrum','Jira','Figma','Adobe Photoshop','Adobe Illustrator','Canva','Notion','AutoCAD','SolidWorks','AWS','Azure','Google Cloud','Docker','Kubernetes','Git','Linux','Cybersecurity','Digital Marketing','SEO','Google Analytics','Content Writing','Copywriting','Social Media Management','Human Resources','Recruitment','English','Bahasa Melayu','Malay','Mandarin','Tamil','Cantonese','Arabic'];
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const educationInstitutionRE=/\b(?:university|universiti|college|kampus|campus|institute|polytechnic|politeknik|academy|school)\b/i;
function cleanEducationEntries(values){
 return unique((Array.isArray(values)?values:[values]).filter(value=>typeof value==='string').map(value=>{
  let entry=clean(value)
   .replace(/\b(?:expected to graduate|expected graduation|graduation year|class of|graduated)\s*:?\s*.*$/i,' ')
   .replace(/\b(?:19|20)\d{2}\s*(?:[-–—]|to|hingga)\s*(?:(?:19|20)\d{2}|present|current|now|kini|sekarang)\b/gi,' ')
   .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:19|20)\d{2}\b/gi,' ')
   .replace(/\b(?:19|20)\d{2}\b/g,' ');
  if(contactRE.test(entry))return '';
  const parts=entry.split(/\s*[,;|]\s*/);
  const institutionPart=parts.findIndex(part=>educationInstitutionRE.test(part));
  if(institutionPart>=0)entry=parts.slice(0,institutionPart).join(' · ');
  else {
   const institutionIndex=entry.search(educationInstitutionRE);
   if(institutionIndex>=0)entry=entry.slice(0,institutionIndex);
  }
  entry=entry.replace(/\s+(?:at|@)\s*$/i,'').replace(/[|,;·–—\-:]+$/g,'').replace(/^[|,;·–—\-:]+/g,'').trim();
  return entry;
 }).filter(Boolean));
}
const careerInterestThemes=[
 {label:'Software development',role:/\b(?:software engineer|software developer|programmer|web developer|app developer|application developer)\b/i,evidence:/\b(?:software development|programming|web development|app development|application development|coding)\b/i},
 {label:'Data analysis and reporting',role:/\b(?:data analyst|business analyst|business intelligence analyst)\b/i,evidence:/\b(?:data analysis|data analytics|business intelligence|data visualization|data visualisation|reporting analytics)\b/i},
 {label:'Accounting and financial operations',role:/\b(?:accountant|accounting|finance|payroll)\b/i,evidence:/\b(?:accounting|financial reporting|financial analysis|bookkeeping|payroll|reconciliation)\b/i},
 {label:'Human resources and recruitment',role:/\b(?:human resources|hr executive|recruiter|recruitment|talent acquisition)\b/i,evidence:/\b(?:human resources|recruitment|talent acquisition|employee relations|workforce planning)\b/i},
 {label:'Digital marketing and content',role:/\b(?:marketing|content creator|copywriter|seo specialist)\b/i,evidence:/\b(?:digital marketing|content marketing|social media|search engine optimization|\bSEO\b|campaign management|copywriting)\b/i},
 {label:'Design and user experience',role:/\b(?:graphic designer|ui\/ux designer|ux designer|product designer)\b/i,evidence:/\b(?:graphic design|user experience|user interface|ux research|visual design)\b/i},
 {label:'IT systems and cybersecurity',role:/\b(?:it support|systems administrator|network administrator|cybersecurity|cloud engineer)\b/i,evidence:/\b(?:cybersecurity|cloud infrastructure|network administration|systems administration|technical support)\b/i},
 {label:'Engineering and technical operations',role:/\b(?:(?:civil|mechanical|electrical|industrial) engineer|engineering technician)\b/i,evidence:/\b(?:engineering design|computer-aided design|\bCAD\b|manufacturing|quality assurance|maintenance engineering)\b/i},
 {label:'Education and training',role:/\b(?:teacher|lecturer|educator|trainer|instructor)\b/i,evidence:/\b(?:teaching|education|training delivery|curriculum development|learning facilitation)\b/i},
 {label:'Sales and business development',role:/\b(?:sales|business development|account executive)\b/i,evidence:/\b(?:sales|business development|lead generation|client acquisition|account management)\b/i},
 {label:'Customer service and client support',role:/\b(?:customer service|customer support|client support|service representative)\b/i,evidence:/\b(?:customer service|customer support|client support|customer experience)\b/i},
 {label:'Healthcare and patient care',role:/\b(?:nurse|doctor|physician|medical|healthcare|pharmacist)\b/i,evidence:/\b(?:patient care|clinical care|healthcare|medical services)\b/i},
 {label:'Logistics and supply chain',role:/\b(?:logistics|supply chain|procurement|warehouse)\b/i,evidence:/\b(?:logistics|supply chain|inventory management|procurement|warehouse operations)\b/i},
 {label:'Project management and operations',role:/\b(?:project manager|operations manager|operations coordinator)\b/i,evidence:/\b(?:project management|operations management|process improvement|program delivery)\b/i}
];
function inferCareerInterests(currentRole,summary,experience,skills){
 const role=String(currentRole||''),profileText=[...(summary||[]),...(experience||[])].join(' '),skillText=(skills||[]).join(' ');
 const ranked=careerInterestThemes.map((theme,index)=>({theme,index,score:(theme.role.test(role)?4:0)+(theme.evidence.test(profileText)?2:0)+(theme.evidence.test(skillText)?1:0)}))
  .filter(item=>item.score>=2).sort((a,b)=>b.score-a.score||a.index-b.index);
 return ranked.slice(0,2).map(item=>item.theme.label).join(' and ');
}
export function sanitizeCvSkills(values){
 const items=(Array.isArray(values)?values:[values]).filter(value=>typeof value==='string')
  .flatMap(value=>value.replace(/^[^:：]{1,45}[:：]\s*/,'').split(/[,;|•\n]+/))
  .map(value=>clean(value).replace(/^[-–—*▪]+\s*/,'').replace(/\s*(?:\((?:beginner|intermediate|advanced|expert|proficient|fluent|native|basic|professional working proficiency)\)|[-–—:]\s*(?:beginner|intermediate|advanced|expert|proficient|fluent|native|basic))$/i,'').trim())
  .filter(value=>(value.length>1||value==='R')&&value.length<75&&value.split(/\s+/).length<=8&&!heading(value)&&!contactRE.test(value)&&!/\b(?:19|20)\d{2}\b/.test(value)&&!/\d+\s*(?:years?|months?|tahun|bulan)\b/i.test(value)&&!/^\d+(?:[./-]\d+)*$/.test(value)&&!/^(?:responsible|managed|developed|led|built|created|worked|assisted|supported|collaborated|designed)\b/i.test(value));
 const normalized=items.flatMap(item=>{
  const exact=skillsCatalog.find(skill=>skill.toLowerCase()===item.toLowerCase());
  if(exact)return [exact];
  const matches=skillsCatalog.filter(skill=>new RegExp('(?<![\\p{L}\\p{N}])'+escaped(skill)+'(?![\\p{L}\\p{N}])','iu').test(item));
   // Keep only identifiable occupational skills. Unknown phrases often describe
   // experience, personal strengths, or work attitudes rather than a skill.
   return matches;
 });
 let result=unique(normalized);
 if(result.includes('Microsoft Excel'))result=result.filter(skill=>skill!=='Excel');
 if(result.includes('Power BI'))result=result.filter(skill=>skill!=='PowerBI');
 return result;
}
function nameCandidate(value, labelled=false){const line=clean(value).replace(/^(?:dr|mr|mrs|ms|miss|prof)\.?\s+/i,'');const words=line.split(/\s+/);if(/^(?:I|My|We|A dedicated|An experienced|Passionate|Seeking|Experienced|Motivated)\b/i.test(line))return null;if(!labelled&&/[a-z]/.test(line)&&line===line.toLowerCase())return null;if(line.length<2||line.length>90||words.length>10||contactRE.test(line)||(!labelled&&(orgRE.test(line)||jobRE.test(line)||placeRE.test(line)))||heading(line)||/[:;!?=\d]/.test(line)||!/^\p{L}[\p{L}\p{M}\s.'’\-/()]+$/u.test(line))return null;if(words.length<2&&!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(line))return null;return line;}
function unique(values){const seen=new Set();return values.filter(value=>{const key=value.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});}
export function parseCv(source, metadata={}){
  const inlineLabels=Object.values(aliases).flat().map(escaped).sort((a,b)=>b.length-a.length).join('|');
  const text=String(source||'').normalize('NFKC').replace(/\r\n?/g,'\n').replace(/[\u2022\u25cf\u25aa]/g,'•')
   .replace(new RegExp('\\s*[|•]\\s*(?=(?:'+inlineLabels+')\\s*[:：])','giu'),'\n');
 const lines=text.split('\n').map(clean).filter(Boolean);
 const sections={};let current=null;let currentLabel='';const explicit={};const header=[];let foundSection=false;
 for(const line of lines){
  const match=line.match(/^([^:：]{1,60})[:：]\s*(.*)$/);const detected=heading(match?match[1]:line);
   if(detected){current=detected;currentLabel=keyOf(match?match[1]:line);foundSection=true;sections[current]??=[];if(match?.[2]){sections[current].push(match[2]);if(['fullName','age','birthDate','location','currentRole','yearsExperience'].includes(current)){explicit[current]=clean(match[2]);current=null;}}continue;}
  if(!foundSection)header.push(line);
   if(current){sections[current].push(line);if(['fullName','age','birthDate','location','currentRole','yearsExperience'].includes(current)&&!explicit[current]){explicit[current]=line;current=null;}}
 }
 for(const key of Object.keys(explicit))if(/^\[.*\]$/.test(explicit[key]))explicit[key]='';
 for(const key of Object.keys(sections))sections[key]=sections[key].filter(value=>!/^\[Enter your answer here\]$/i.test(clean(value)));
 const emails=unique((text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]));
 const emailParts=(emails[0]?.split('@')[0]||'').toLowerCase().split(/[._-]/).filter(word=>word.length>1);
 const candidates=[];
 const add=(value,score)=>{const valid=nameCandidate(value);if(!valid)return;const tokens=valid.toLowerCase().split(/[\s.'’-]+/);let bonus=emailParts.filter(part=>tokens.includes(part)).length*3;candidates.push({name:valid,score:score+bonus});};
 (metadata.nameCandidates||[]).slice(0,12).forEach((item,i)=>add(typeof item==='string'?item:item.text,18-i*.4));
  (header.length?header:!foundSection?lines.slice(0,12):[]).slice(0,16).forEach((line,index)=>line.split(/\s*[|•]\s*/).forEach(part=>add(part,14-index*.8)));
 candidates.sort((a,b)=>b.score-a.score);
 let fullName=explicit.fullName||candidates[0]?.name||'';
  if(explicit.fullName)fullName=nameCandidate(explicit.fullName,true)||'';
 const experience=sections.experienceSummary||[];const summary=sections.summary||[];const educationLines=sections.education||[];
 // Match a controlled set of skill names only where a skills section or work/summary supports them.
 // Avoid copying every line that follows a CV's skills heading into the form.
 const skillEvidence=(sections.skills||[]).join('\n');
  let skills=sanitizeCvSkills(sections.skills||[]);
 if(skills.some(value=>/^Microsoft Excel$/i.test(value)))skills=skills.filter(value=>!/^Excel$/i.test(value));
 if(skills.some(value=>/^Power BI$/i.test(value)))skills=skills.filter(value=>!/^PowerBI$/i.test(value));
  const identityLines=(header.length?header:!foundSection?lines.slice(0,12):[]).flatMap(line=>line.split(/\s*[|•]\s*/));
 const roleLine=identityLines.find(line=>line!==fullName&&jobRE.test(line)&&!contactRE.test(line)&&!orgRE.test(line)&&line.length<100);
  const roleCandidates=experience.map((line,index)=>({line,index})).filter(({line})=>jobRE.test(line)&&!contactRE.test(line)&&line.length<150&&!/^(?:responsible|managed|developed|led|built|created|worked|assisted|supported|collaborated|designed)\b/i.test(line));
  const roleRecency=({index})=>{const nextIndex=Math.min(...roleCandidates.filter(item=>item.index>index).map(item=>item.index),experience.length);let nearby=experience.slice(index,nextIndex).join(' ');if(!/\b(?:19|20)\d{2}\b/.test(nearby)&&/^\s*(?:\w+\s+)?(?:19|20)\d{2}/.test(experience[index-1]||''))nearby=experience[index-1]+' '+nearby;if(/\b(?:present|current|now|kini|sekarang)\b/i.test(nearby))return 9999;const dates=[...nearby.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m=>Number(m[0]));return dates.length?Math.max(...dates):0;};
  roleCandidates.sort((a,b)=>roleRecency(b)-roleRecency(a)||a.index-b.index);
  const expRole=roleCandidates[0]?.line;
 const educationText=educationLines.join(' · ');
  const activeStudy=/\b20\d{2}\s*[-–—]\s*(?:Present|Current|Now|Kini|Sekarang)\b/i.test(educationText);
 const studyProgram=educationText.match(/\bin\s+([^·|,]+?)(?=\s*\([^)]*\)|\s*[·|,]|$)/i)?.[1]?.trim().replace(/\s+(?:honou?rs?|with|and)\b.*$/i,'');
 const studyRole=activeStudy?`${studyProgram||'Undergraduate'} Student`:'';
 let currentRole=explicit.currentRole||roleLine||expRole||studyRole;
  if(currentRole)currentRole=currentRole.replace(/\s*[|]\s*.*$/,'').replace(/\s+(?:at|@)\s+.*$/i,'').replace(/\s*[-–—,(]?\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?(?:19|20)\d{2}\b.*$/i,'').replace(/\s*\(\d+\s*(?:years?|yrs?).*$/i,'').trim();
  const eduFromBody=lines.find(line=>/\b(?:bachelor|master|diploma|ph\.?d|bsc|msc|beng|mba|degree|ijazah|sijil|spm|stpm|skm)\b/i.test(line)&&line.length<180);
   const education=cleanEducationEntries(educationLines.length?educationLines:[eduFromBody]).join(' · ').slice(0,500);
 let location=explicit.location||identityLines.find(line=>placeRE.test(line)&&!/@|https?:|www\./i.test(line))||'';
 if(location)location=location.replace(/^(?:location|address|based in)\s*[:：]\s*/i,'').trim();
 const ageMatch=text.match(/\b(?:age|umur)\s*[:：]?\s*(\d{1,3})\b/i);
  const now=metadata.now?new Date(metadata.now):new Date();
  const birthText=explicit.birthDate||'';
  let derivedAge='';
  if(birthText){let birth;const numeric=birthText.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/);if(numeric){const [,a,b,c]=numeric;const year=a.length===4?+a:+c,month=+b,day=a.length===4?+c:+a;birth=new Date(year,month-1,day);if(birth.getFullYear()!==year||birth.getMonth()!==month-1||birth.getDate()!==day)birth=null;}else if(/[A-Za-z]/.test(birthText)){const timestamp=Date.parse(birthText);if(Number.isFinite(timestamp))birth=new Date(timestamp);}if(birth){const value=now.getFullYear()-birth.getFullYear()-(now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate())?1:0);if(value>=14&&value<=100)derivedAge=String(value);}}
  const rawAge=explicit.age?.match(/^\d{1,3}\b/)?.[0]||ageMatch?.[1]||derivedAge;
  const age=Number(rawAge)>=14&&Number(rawAge)<=100?rawAge:'';
  const durationMatch=(Object.values(explicit).join(' ')+' '+header.join(' ')+' '+summary.join(' ')+' '+experience.join(' ')).match(/\b(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?|tahun)\s+(?:of\s+)?(?:professional\s+|relevant\s+|work\s+)?(?:experience|pengalaman)\b/i);
 // Merge overlapping employment date ranges rather than adding concurrent jobs twice.
 const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const datePattern=/\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?((?:19|20)\d{2})\s*(?:[-–—]|to|hingga)\s*(?:(Present|Current|Now|Kini|Sekarang)|((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?((?:19|20)\d{2}))/gi;
  const ranges=[];
  for(const rawLine of experience){const line=rawLine.replace(/\b(0?[1-9]|1[0-2])[/.]((?:19|20)\d{2})\b/g,(_,month,year)=>Object.keys(months)[Number(month)-1]+' '+year);for(const m of line.matchAll(datePattern)){const start=Number(m[2])*12+(m[1]?months[m[1].trim().slice(0,3).toLowerCase()]:0);const end=m[3]?now.getFullYear()*12+now.getMonth():Number(m[5])*12+(m[4]?months[m[4].trim().slice(0,3).toLowerCase()]:0);if(end>=start&&end<=now.getFullYear()*12+now.getMonth()+12)ranges.push([start,end]);}}
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 const yearsFromDates=merged.reduce((total,[start,end])=>total+end-start,0)/12;
 const yearsExperience=explicit.yearsExperience?.match(/\d+(?:\.\d+)?/)?.[0]||durationMatch?.[1]||(yearsFromDates>0?String(Math.round(yearsFromDates*10)/10):'');
 const experienceSummary=(experience.length?experience:summary).join('\n').slice(0,2400);
  const objectiveSentence=summary.join(' ').match(/(?:^|[.!?]\s+)([^.!?]*\b(?:seeking|looking for|interested in|aiming to|berminat|mencari peluang)\b[^.!?]*[.!?]?)/i)?.[1]||'';
   const statedInterests=(sections.interests||[]).filter(line=>!/^\[.*\]$/.test(line)).join(' ');
   const inferredInterests=!statedInterests&&!objectiveSentence?inferCareerInterests(currentRole,summary,experience,skills):'';
   const interests=(statedInterests||objectiveSentence||inferredInterests).slice(0,700);
   const notes=[];if(!fullName)notes.push('We could not confidently identify your name.');if(derivedAge&&!explicit.age&&!ageMatch)notes.push('Age was calculated from the date of birth in your CV.');if(yearsExperience&&!explicit.yearsExperience&&!durationMatch)notes.push('Years of experience were estimated from work dates.');if(!explicit.currentRole&&!roleLine&&expRole)notes.push('Your role was taken from your most recent work entry. Please confirm it is current.');if(inferredInterests)notes.push('Career interests were suggested from your profile and work history. Please review and edit them.');if(!skills.length)notes.push('Add the skills you want to include.');
  return {profile:{fullName,age,location,currentRole,yearsExperience,education,skills:skills.slice(0,50),experienceSummary,interests,preferredLearningStyle:''},notes,contact:{email:emails[0]||''},evidence:{name:explicit.fullName?'label':fullName?'header':'missing',interests:statedInterests?'explicit':objectiveSentence?'summary':inferredInterests?'inferred':'missing',experienceEstimated:!!yearsExperience&&!explicit.yearsExperience&&!durationMatch}};
}
export function reconstructPdfPage(items){
 const parts=items.filter(item=>typeof item.str==='string'&&item.str.trim()).map(item=>({text:item.str,x:item.transform[4],y:item.transform[5],font:Math.abs(item.height||item.transform[3]||10),width:item.width||0}));
 const rows=[];
 for(const part of parts.sort((a,b)=>b.y-a.y||a.x-b.x)){let row=rows.find(row=>Math.abs(row.y-part.y)<=Math.max(2,Math.min(part.font,row.font)*.25));if(!row){row={y:part.y,font:part.font,parts:[]};rows.push(row);}row.parts.push(part);row.font=Math.max(row.font,part.font);}
 const lines=rows.sort((a,b)=>b.y-a.y).map(row=>{const sorted=row.parts.sort((a,b)=>a.x-b.x);let value='';for(let i=0;i<sorted.length;i++){const previous=sorted[i-1];const gap=previous?sorted[i].x-(previous.x+previous.width):0;value+=(i?(gap>Math.max(36,row.font*3)?' | ':' '):'')+sorted[i].text;}return {text:clean(value),font:row.font,y:row.y};});
 const nameCandidates=lines.slice(0,18).flatMap(line=>line.text.split(/\s*\|\s*/).map(text=>({text,font:line.font,y:line.y}))).filter(item=>nameCandidate(item.text)).sort((a,b)=>b.font-a.font||b.y-a.y).slice(0,8);
 // Detect a repeated wide gutter before separating columns. Keep spanning header rows above the columns.
 const gaps=[];
 for(const row of rows){const sorted=row.parts.toSorted((a,b)=>a.x-b.x);for(let i=1;i<sorted.length;i++){const end=sorted[i-1].x+sorted[i-1].width;if(sorted[i].x-end>70)gaps.push({left:end,right:sorted[i].x,y:row.y});}}
 let orderedText=lines.map(line=>line.text).join('\n');
 if(gaps.length>=3){const candidates=gaps.map(gap=>(gap.left+gap.right)/2);const cut=candidates.toSorted((a,b)=>a-b)[Math.floor(candidates.length/2)];const repeated=gaps.filter(gap=>gap.left<cut&&gap.right>cut);if(repeated.length>=3){const top=Math.max(...repeated.map(gap=>gap.y));const lower=parts.filter(part=>part.y<=top+2);const crossing=lower.filter(part=>part.x<cut&&part.x+part.width>cut);if(!crossing.length){const render=values=>{const grouped=[];for(const part of values.toSorted((a,b)=>b.y-a.y||a.x-b.x)){let row=grouped.find(row=>Math.abs(row.y-part.y)<3);if(!row){row={y:part.y,parts:[]};grouped.push(row);}row.parts.push(part);}return grouped.map(row=>row.parts.toSorted((a,b)=>a.x-b.x).map(part=>part.text).join(' ')).join('\n');};orderedText=[render(parts.filter(part=>part.y>top+2)),render(lower.filter(part=>part.x<cut)),render(lower.filter(part=>part.x>=cut))].filter(Boolean).join('\n\n');}}}
 return {text:orderedText,nameCandidates};
}
