@echo off
chcp 65001 >nul
powershell -Command "(Get-Content 'game.js' -Raw) -replace \"let playerAvatar = ''\", \"let playerAvatar = '🦁'\" -replace \"let player2Avatar = ''\", \"let player2Avatar = '🐘'\" -replace \"const AVATAR_OPTIONS = \['', '', '', '', '', ''\]\", \"const AVATAR_OPTIONS = ['🦁', '🐘', '🦅', '🐯', '🦒', '🐆']\" | Set-Content 'game.js' -NoNewline"
echo Done
