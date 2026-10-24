import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/attached_assets', { recursive: true });
for (const file of ['cv-parser.mjs', 'background.mp4', 'findmycareer-logo.png', 'language-switcher.js', 'language-overrides.js', 'FindMyCareer-Profile-Template.docx']) {
  await copyFile(file, `dist/${file}`);
}
await copyFile('attached_assets/mascot_wave_1792831474286.png', 'dist/attached_assets/mascot_wave_1792831474286.png');
