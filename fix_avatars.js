const fs = require('fs');

const filePath = 'c:\\Users\\DELL\\Desktop\\ayo-game\\game.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("let playerAvatar = '';", "let playerAvatar = '🦁';");
content = content.replace("let player2Avatar = '';", "let player2Avatar = '🐘';");
content = content.replace("const AVATAR_OPTIONS = ['', '', '', '', '', ''];", "const AVATAR_OPTIONS = ['🦁', '🐘', '🦅', '🐯', '🦒', '🐆'];");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Avatar values fixed successfully!');
