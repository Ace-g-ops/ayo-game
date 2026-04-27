// ==================== GLOBAL VARIABLES ====================
let scene, camera, renderer;
let board, pits = [];
let seeds = [];
let raycaster, mouse;
let currentPlayer = 1;
let scores = { 1: 0, 2: 0 };
let isAnimating = false;
let pitStates = [];
let gameMode = 'multi';
let aiDifficulty = 'medium';
let audioContext = null;
let gameStarted = false;
const WIN_SCORE = 24;
let playerAvatar = '🦁';
let player2Avatar = '🐘';
const AVATAR_OPTIONS = ['🦁', '🐘', '🦅', '🐯', '🦒', '🐆'];

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 2;
const BOARD_DEPTH = 4;
const PIT_RADIUS = 0.6;
const PIT_DEPTH = 0.8;
const SEED_RADIUS = 0.15;

// ==================== SOUND SYSTEM ====================
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'move':
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
        case 'capture':
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'win':
            playMelody();
            return;
        case 'click':
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
    }
}

function playMelody() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(freq, audioContext.currentTime);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.3);
        }, i * 150);
    });
}

// ==================== GET GAME MODE FROM URL ====================
function getGameModeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    return mode === 'single' ? 'single' : 'multi';
}

function getAIDifficulty() {
    const urlParams = new URLSearchParams(window.location.search);
    const difficulty = urlParams.get('difficulty');
    return difficulty || 'medium';
}

function loadAvatars() {
    const urlParams = new URLSearchParams(window.location.search);
    const avatarParam = urlParams.get('avatar');
    
    // Load player avatar from URL or localStorage
    if (avatarParam) {
        playerAvatar = decodeURIComponent(avatarParam);
    } else {
        playerAvatar = localStorage.getItem('ayoAvatar') || '🦁';
    }
    
    // Fallback for corrupted AVATAR_OPTIONS
    const validAvatars = AVATAR_OPTIONS.filter(a => a && a.length > 0);
    const avatarPool = validAvatars.length > 0 ? validAvatars : ['🦁', '🐘', '🦅', '🐯', '🦒', '🐆'];
    
    // Assign random avatar to player 2 in single-player mode
    if (gameMode === 'single') {
        const randomIndex = Math.floor(Math.random() * avatarPool.length);
        player2Avatar = avatarPool[randomIndex];
    } else {
        // In multiplayer, player 2 gets a random avatar different from player 1
        const availableAvatars = avatarPool.filter(a => a !== playerAvatar);
        const randomIndex = Math.floor(Math.random() * availableAvatars.length);
        player2Avatar = availableAvatars[randomIndex] || avatarPool[0];
    }
    
    // Update UI
    updateAvatarDisplay();
}

function updateAvatarDisplay() {
    const avatar1El = document.getElementById('avatar1');
    const avatar2El = document.getElementById('avatar2');
    if (avatar1El) avatar1El.textContent = playerAvatar;
    if (avatar2El) avatar2El.textContent = player2Avatar;
}

function backToMenu() {
    window.location.href = 'index.html';
}

function startGameFromInstructions() {
    gameStarted = true;
    document.getElementById('instructions-modal').style.display = 'none';
}

// ==================== INITIALIZATION ====================
function init() {
    console.log('Initializing Ayo Olopon game...');
    
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js is not loaded!');
        alert('Error: Three.js library failed to load. Please check your internet connection.');
        return;
    }
    
    // Check if game container exists
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        console.error('Game container not found!');
        alert('Error: Game container not found in HTML.');
        return;
    }
    
    try {
        initAudio();
        gameMode = getGameModeFromURL();
        aiDifficulty = getAIDifficulty();
        loadAvatars();
        console.log('Game mode:', gameMode);
        console.log('AI difficulty:', aiDifficulty);
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        updateCameraPosition();
        camera.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        gameContainer.appendChild(renderer.domElement);
        console.log('Renderer created and appended to container');
        
        setupLighting();
        createBoard();
        initializeGameState();
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        window.addEventListener('resize', onWindowResize, false);
        renderer.domElement.addEventListener('pointerdown', onBoardClick, false);
        
        animate();
        console.log('Game initialized successfully!');
        
        // Show instruction screen after initialization
        setTimeout(() => {
            document.getElementById('instructions-modal').style.display = 'block';
        }, 500);
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Error initializing game: ' + error.message);
    }
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

function createBoard() {
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.1 });
    const boardGeometry = new THREE.BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH);
    board = new THREE.Mesh(boardGeometry, woodMaterial);
    board.position.y = -BOARD_HEIGHT / 2;
    board.receiveShadow = true;
    board.castShadow = true;
    scene.add(board);
    createPits(woodMaterial);
}

function createPits(woodMaterial) {
    const pitGeometry = new THREE.CylinderGeometry(PIT_RADIUS, PIT_RADIUS, PIT_DEPTH, 32);
    for (let i = 0; i < 6; i++) {
        createPit(4 - i * 1.5, 1, i, pitGeometry, woodMaterial, 1);
    }
    for (let i = 0; i < 6; i++) {
        createPit(-4 + i * 1.5, -1, i + 6, pitGeometry, woodMaterial, 2);
    }
}

function createPit(x, z, index, geometry, material, player) {
    const pit = new THREE.Mesh(geometry, material);
    pit.position.set(x, -PIT_DEPTH / 2, z);
    pit.receiveShadow = true;
    pit.castShadow = true;
    pit.userData = { index: index, player: player, isPit: true };
    scene.add(pit);
    pits.push(pit);
    const rimGeometry = new THREE.TorusGeometry(PIT_RADIUS + 0.1, 0.05, 16, 32);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.5, metalness: 0.2 });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.set(x, 0.02, z);
    rim.rotation.x = Math.PI / 2;
    rim.receiveShadow = true;
    scene.add(rim);
}

function initializeGameState() {
    pitStates = new Array(12).fill(4);
    createAllSeeds();
    scores = { 1: 0, 2: 0 };
    updateScoreDisplay();
    updateTurnIndicator();
}

function createAllSeeds() {
    seeds.forEach(seed => scene.remove(seed));
    seeds = [];
    for (let pitIndex = 0; pitIndex < 12; pitIndex++) {
        for (let i = 0; i < pitStates[pitIndex]; i++) {
            createSeed(pitIndex, i);
        }
    }
}

function createSeed(pitIndex, seedIndex) {
    const seedMaterial = new THREE.MeshStandardMaterial({ color: getSeedColor(pitIndex), roughness: 0.3, metalness: 0.1 });
    const seedGeometry = new THREE.SphereGeometry(SEED_RADIUS, 16, 16);
    const seed = new THREE.Mesh(seedGeometry, seedMaterial);
    seed.position.copy(getSeedPosition(pitIndex, seedIndex));
    seed.castShadow = true;
    seed.receiveShadow = true;
    seed.userData = { pitIndex: pitIndex, seedIndex: seedIndex };
    scene.add(seed);
    seeds.push(seed);
    return seed;
}

function getSeedColor(pitIndex) {
    const colors = [0xD4AF37, 0xFFD700, 0xB8860B, 0xDAA520, 0xF0E68C, 0xBDB76B];
    return colors[pitIndex % colors.length];
}

function getSeedPosition(pitIndex, seedIndex) {
    const pit = pits[pitIndex];
    const angle = (seedIndex / 4) * Math.PI * 2;
    const radius = 0.2 + (seedIndex % 4) * 0.1;
    const x = pit.position.x + Math.cos(angle) * radius * 0.3;
    const z = pit.position.z + Math.sin(angle) * radius * 0.3;
    const y = -PIT_DEPTH / 2 + SEED_RADIUS + 0.05 + (seedIndex % 2) * 0.1;
    return new THREE.Vector3(x, y, z);
}

function updateScoreDisplay() {
    const score1Element = document.getElementById('score1');
    const score2Element = document.getElementById('score2');
    if (score1Element) score1Element.textContent = scores[1];
    if (score2Element) score2Element.textContent = scores[2];
}

function onBoardClick(event) {
    if (isAnimating || !gameStarted) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pits);
    if (intersects.length > 0) {
        const clickedPit = intersects[0].object;
        const pitIndex = clickedPit.userData.index;
        const pitPlayer = clickedPit.userData.player;
        if (pitPlayer === currentPlayer && pitStates[pitIndex] > 0) {
            playSound('click');
            makeMove(pitIndex);
        }
    }
}

function makeMove(pitIndex) {
    isAnimating = true;
    const seedCount = pitStates[pitIndex];
    pitStates[pitIndex] = 0;
    removeSeedsFromPit(pitIndex);
    distributeSeeds(pitIndex, seedCount);
}

function removeSeedsFromPit(pitIndex) {
    seeds = seeds.filter(seed => {
        if (seed.userData.pitIndex === pitIndex) {
            scene.remove(seed);
            return false;
        }
        return true;
    });
}

async function distributeSeeds(startPit, seedCount) {
    let currentPit = startPit;
    const seedsToDistribute = [];
    for (let i = 0; i < seedCount; i++) {
        const seedMaterial = new THREE.MeshStandardMaterial({ color: getSeedColor(startPit), roughness: 0.3, metalness: 0.1 });
        const seedGeometry = new THREE.SphereGeometry(SEED_RADIUS, 16, 16);
        const seed = new THREE.Mesh(seedGeometry, seedMaterial);
        seed.position.copy(pits[startPit].position);
        seed.position.y = 1;
        seed.castShadow = true;
        scene.add(seed);
        seedsToDistribute.push(seed);
    }
    for (let i = 0; i < seedCount; i++) {
        currentPit = getNextPit(currentPit);
        if (currentPit === startPit && i < seedCount - 1) {
            currentPit = getNextPit(currentPit);
        }
        await animateSeed(seedsToDistribute[i], currentPit, i);
        pitStates[currentPit]++;
        createSeed(currentPit, pitStates[currentPit] - 1);
    }
    seedsToDistribute.forEach(seed => scene.remove(seed));
    await checkCapture(currentPit);
    checkGameEnd();
    if (!isGameOver()) {
        switchTurn();
    }
    isAnimating = false;
}

function getNextPit(currentPit) {
    if (currentPit < 5) return currentPit + 1;
    if (currentPit === 5) return 11;
    if (currentPit > 6) return currentPit - 1;
    if (currentPit === 6) return 0;
    return currentPit;
}

async function animateSeed(seed, targetPit, index) {
    const startPosition = seed.position.clone();
    const targetPosition = pits[targetPit].position.clone();
    targetPosition.y = 1 + index * 0.3;
    const duration = 300;
    const startTime = Date.now();
    return new Promise(resolve => {
        function animate() {
            const progress = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            seed.position.lerpVectors(startPosition, targetPosition, eased);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        animate();
    });
}

async function checkCapture(pitIndex) {
    const pitPlayer = pits[pitIndex].userData.player;
    if (pitPlayer !== currentPlayer && (pitStates[pitIndex] === 2 || pitStates[pitIndex] === 3)) {
        await animateCapture(pitIndex);
        scores[currentPlayer] += pitStates[pitIndex];
        pitStates[pitIndex] = 0;
        removeSeedsFromPit(pitIndex);
        updateScoreDisplay();
        let prevPit = getPreviousPit(pitIndex);
        while (pits[prevPit].userData.player !== currentPlayer && (pitStates[prevPit] === 2 || pitStates[prevPit] === 3)) {
            await animateCapture(prevPit);
            scores[currentPlayer] += pitStates[prevPit];
            pitStates[prevPit] = 0;
            removeSeedsFromPit(prevPit);
            updateScoreDisplay();
            prevPit = getPreviousPit(prevPit);
            if (prevPit === pitIndex) break;
        }
    }
}

function getPreviousPit(currentPit) {
    if (currentPit > 0 && currentPit < 6) return currentPit - 1;
    if (currentPit === 0) return 6;
    if (currentPit < 11 && currentPit >= 6) return currentPit + 1;
    if (currentPit === 11) return 5;
    return currentPit;
}

async function animateCapture(pitIndex) {
    const pitSeeds = seeds.filter(s => s.userData.pitIndex === pitIndex);
    playSound('capture');
    const duration = 300;
    const startTime = Date.now();
    return new Promise(resolve => {
        function animate() {
            const progress = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            pitSeeds.forEach(seed => {
                seed.position.y += eased * 0.5;
                seed.position.x += eased * (currentPlayer === 1 ? 0.5 : -0.5);
            });
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        animate();
    });
}

function aiMove() {
    if (isAnimating || isGameOver()) return;
    
    const aiPits = [6, 7, 8, 9, 10, 11];
    const validPits = aiPits.filter(pit => pitStates[pit] > 0);
    
    if (validPits.length === 0) return;
    
    let selectedPit;
    
    switch (aiDifficulty) {
        case 'easy':
            // Random move
            selectedPit = validPits[Math.floor(Math.random() * validPits.length)];
            break;
        case 'medium':
            // Prefer captures with some randomness
            selectedPit = getBestMove(validPits, false);
            break;
        case 'hard':
            // Strongest move evaluation
            selectedPit = getBestMove(validPits, true);
            break;
        default:
            selectedPit = validPits[0];
    }
    
    makeMove(selectedPit);
}

function getBestMove(validPits, useStrongEvaluation) {
    let bestPit = validPits[0];
    let bestScore = -Infinity;
    
    for (const pit of validPits) {
        const score = useStrongEvaluation ? evaluateMoveHard(pit) : evaluateMove(pit);
        if (score > bestScore) {
            bestScore = score;
            bestPit = pit;
        }
    }
    
    return bestPit;
}

function evaluateMoveHard(pitIndex) {
    // Strong evaluation: consider captures, landing position, and future potential
    let score = pitStates[pitIndex] * 2;
    
    const seeds = pitStates[pitIndex];
    let currentPit = pitIndex;
    
    // Simulate the move
    for (let i = 0; i < seeds; i++) {
        currentPit = getNextPit(currentPit);
        if (currentPit === pitIndex && i < seeds - 1) {
            currentPit = getNextPit(currentPit);
        }
    }
    
    // Check if we can capture
    const landingSeeds = pitStates[currentPit];
    if (landingSeeds === 2 || landingSeeds === 3) {
        const pitPlayer = pits[currentPit].userData.player;
        if (pitPlayer !== 2) {
            score += 10; // Big bonus for capture
        }
    }
    
    // Prefer landing on opponent's side
    if (pits[currentPit].userData.player !== 2) {
        score += 5;
    }
    
    return score;
}

function evaluateMove(pitIndex) {
    // Simple evaluation: prioritize pits that can land on opponent's side with 2-3 seeds
    let score = pitStates[pitIndex]; // Base score from seed count
    
    // Add randomness for variety
    score += Math.random() * 2;
    
    // Prefer pits that can capture
    const seeds = pitStates[pitIndex];
    let currentPit = pitIndex;
    for (let i = 0; i < seeds; i++) {
        currentPit = getNextPit(currentPit);
        if (currentPit === pitIndex && i < seeds - 1) {
            currentPit = getNextPit(currentPit);
        }
    }
    
    // Check if landing on opponent's side
    const pitPlayer = pits[currentPit].userData.player;
    if (pitPlayer !== 2) {
        score += 3; // Prefer landing on player's side
    }
    
    return score;
}

// ==================== TURN MANAGEMENT ====================
function switchTurn() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTurnIndicator();
    
    // If single player mode and it's player 2's turn, trigger AI
    if (gameMode === 'single' && currentPlayer === 2 && !isGameOver()) {
        setTimeout(() => aiMove(), 1000);
    }
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (gameMode === 'single') {
        indicator.textContent = currentPlayer === 1 ? "Your Turn" : "AI Thinking...";
    } else {
        indicator.textContent = `Player ${currentPlayer}'s Turn`;
    }
    indicator.className = `player${currentPlayer}`;
}

// ==================== GAME END ====================
function checkGameEnd() {
    // Check for score target win condition (first to 24 points)
    if (scores[1] >= WIN_SCORE || scores[2] >= WIN_SCORE) {
        showGameOver();
        return;
    }
    
    // Game ends when one player has no seeds on their side
    const player1Seeds = pitStates.slice(0, 6).reduce((a, b) => a + b, 0);
    const player2Seeds = pitStates.slice(6, 12).reduce((a, b) => a + b, 0);
    
    if (player1Seeds === 0 || player2Seeds === 0) {
        // Remaining seeds go to the opponent
        if (player1Seeds === 0) {
            scores[2] += player2Seeds;
        } else {
            scores[1] += player1Seeds;
        }
        
        showGameOver();
    }
}

function isGameOver() {
    const player1Seeds = pitStates.slice(0, 6).reduce((a, b) => a + b, 0);
    const player2Seeds = pitStates.slice(6, 12).reduce((a, b) => a + b, 0);
    return player1Seeds === 0 || player2Seeds === 0 || scores[1] >= WIN_SCORE || scores[2] >= WIN_SCORE;
}

function showGameOver() {
    const gameOverModal = document.getElementById('game-over');
    const winnerText = document.getElementById('winner-text');
    const finalScore = document.getElementById('final-score');
    
    if (scores[1] > scores[2]) {
        winnerText.textContent = gameMode === 'single' ? 'You Win!' : 'Player 1 Wins!';
        playSound('win');
    } else if (scores[2] > scores[1]) {
        winnerText.textContent = gameMode === 'single' ? 'AI Wins!' : 'Player 2 Wins!';
    } else {
        winnerText.textContent = "It's a Tie!";
        playSound('win');
    }
    
    finalScore.textContent = `Final Score: ${scores[1]} - ${scores[2]}`;
    gameOverModal.style.display = 'block';
}

function resetGame() {
    // Hide game over modal
    document.getElementById('game-over').style.display = 'none';
    
    // Reset game state
    gameStarted = false;
    currentPlayer = 1;
    loadAvatars();
    initializeGameState();
    
    // Show instruction screen again
    document.getElementById('instructions-modal').style.display = 'block';
}

// ==================== RESPONSIVE HANDLING ====================
function updateCameraPosition() {
    const isMobile = window.innerWidth <= 768;
    const isLandscape = window.innerWidth > window.innerHeight;
    
    if (isMobile && isLandscape) {
        camera.position.set(0, 6, 7);
    } else {
        camera.position.set(0, 8, 8);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCameraPosition();
}

// ==================== ANIMATION LOOP ====================
function animate() {
    requestAnimationFrame(animate);
    
    // Subtle board rotation for visual interest
    if (board) {
        board.rotation.y = Math.sin(Date.now() * 0.0001) * 0.02;
    }
    
    renderer.render(scene, camera);
}

// ==================== START GAME ====================
window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting game initialization...');
    init();
});

// Fallback: if DOMContentLoaded already fired, init immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already loaded, initializing immediately...');
    init();
}