const BOARD_SIZE = 8;
let boardState = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
let score = 0;

const PIECE_SHAPES = [
    { shape: [[1, 1], [1, 1]], bonus: 25 },
    { shape: [[1, 1, 1]], bonus: 15 },
    { shape: [[1], [1], [1]], bonus: 15 },
    { shape: [[1, 0], [1, 0], [1, 1]], bonus: 25 },
    { shape: [[1]], bonus: 10 }
];

let audioCtx = null;
let musicInterval = null;
let isMusicEnabled = true;
let isSfxEnabled = true;
let isVibeEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startAmbientMusic(); 
    }
}

function triggerVibration(ms) {
    if (isVibeEnabled && navigator.vibrate) {
        navigator.vibrate(ms);
    }
}

function playSound(type) {
    if (!audioCtx || !isSfxEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'grab') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.04);
        osc.start(now); osc.stop(now + 0.04);
    } else if (type === 'place') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.setValueAtTime(600, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'blast') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

// FIX: Nueva música ambiental y armónica sin sonidos "tunk tunk" molestos
function startAmbientMusic() {
    if (musicInterval) clearInterval(musicInterval);

    // Notas suaves de sintetizador espacial
    const melody = [329.63, 392.00, 440.00, 523.25, 440.00, 392.00];
    let noteIdx = 0;

    musicInterval = setInterval(() => {
        if (!isMusicEnabled || !audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine'; // Onda ultra-limpia sin percusiones duras
        osc.frequency.setValueAtTime(melody[noteIdx], audioCtx.currentTime);

        gain.gain.setValueAtTime(0.012, audioCtx.currentTime); // Volumen de fondo muy sutil
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.7);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.7);

        noteIdx = (noteIdx + 1) % melody.length;
    }, 700);
}

let activeDrag = null;
let currentAvailablePieces = [];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-start").addEventListener("click", () => {
        initAudio();
        document.getElementById("start-screen").classList.add("hidden");
        resetGame();
    });

    document.getElementById("btn-restart").addEventListener("click", () => {
        document.getElementById("game-over").classList.add("hidden");
        resetGame();
    });

    document.getElementById("btn-settings-toggle").addEventListener("click", () => {
        document.getElementById("settings-panel").classList.toggle("hidden");
    });

    setupToggle("btn-toggle-music", (state) => { isMusicEnabled = state; });
    setupToggle("btn-toggle-sfx", (state) => isSfxEnabled = state);
    setupToggle("btn-toggle-vibe", (state) => isVibeEnabled = state);

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
});

function setupToggle(id, callback) {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
        const isActive = btn.className === "toggle-inactive";
        btn.innerText = isActive ? "SÍ" : "NO";
        btn.className = isActive ? "toggle-active" : "toggle-inactive";
        callback(isActive);
    });
}

function createBoard() {
    const boardElement = document.getElementById("board");
    boardElement.innerHTML = "";
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = r;
            cell.dataset.col = c;
            boardElement.appendChild(cell);
        }
    }
}

// FIX: Generación inteligente de bloques para evitar la muerte injusta por azar
function spawnPieces() {
    const container = document.getElementById("pieces-container");
    container.innerHTML = "";
    currentAvailablePieces = [];
    
    let generatedPieces = [];
    let absoluteSafetyCheck = false;

    // Bucle de control: intenta generar un set de 3 bloques donde al menos UNO entre sí o sí
    while (!absoluteSafetyCheck) {
        generatedPieces = [];
        for (let i = 0; i < 3; i++) {
            const pData = PIECE_SHAPES[Math.floor(Math.random() * PIECE_SHAPES.length)];
            const colorNum = Math.floor(Math.random() * 5);
            generatedPieces.push({ shape: pData.shape, index: i, colorNum, bonus: pData.bonus });
        }

        // Verifica si al menos una de las tres piezas seleccionadas cabe en el tablero actual
        for (let p of generatedPieces) {
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (canPlacePiece(p.shape, r, c)) {
                        absoluteSafetyCheck = true;
                        break;
                    }
                }
                if (absoluteSafetyCheck) break;
            }
            if (absoluteSafetyCheck) break;
        }
    }

    currentAvailablePieces = generatedPieces;

    // Renderizar las piezas seguras en el DOM
    currentAvailablePieces.forEach(pieceData => {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add("piece", "animate-pop");
        pieceElement.style.gridTemplateColumns = `repeat(${pieceData.shape[0].length}, 1fr)`;
        pieceElement.dataset.index = pieceData.index;
        
        pieceData.shape.forEach(row => {
            row.forEach(value => {
                const cell = document.createElement("div");
                cell.classList.add("piece-cell");
                if (value === 1) cell.classList.add(`color-${pieceData.colorNum}`);
                else cell.style.opacity = 0;
                pieceElement.appendChild(cell);
            });
        });
        
        const startDrag = (e) => {
            e.preventDefault();
            playSound('grab');
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            activeDrag = { shape: pieceData.shape, index: pieceData.index, colorClass: `color-${pieceData.colorNum}`, bonus: pieceData.bonus };
            
            const ghost = document.getElementById('drag-ghost');
            ghost.innerHTML = pieceElement.innerHTML;
            ghost.style.gridTemplateColumns = pieceElement.style.gridTemplateColumns;
            ghost.style.display = 'grid';
            
            updateGhostPosition(clientX, clientY);
            pieceElement.style.opacity = '0.15';
        };

        pieceElement.addEventListener('touchstart', startDrag);
        pieceElement.addEventListener('mousedown', startDrag);
        container.appendChild(pieceElement);
    });

    checkGameOver();
}

function updateGhostPosition(x, y) {
    const ghost = document.getElementById('drag-ghost');
    const rect = ghost.getBoundingClientRect();
    ghost.style.left = `${x - (rect.width / 2)}px`;
    ghost.style.top = `${y - 85}px`;
}

function handleMove(e) {
    if (!activeDrag) return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateGhostPosition(clientX, clientY);
}

function handleEnd(e) {
    if (!activeDrag) return;

    const ghost = document.getElementById('drag-ghost');
    const ghostRect = ghost.getBoundingClientRect();
    const targetX = ghostRect.left + (ghostRect.width / (activeDrag.shape[0].length * 2));
    const targetY = ghostRect.top + (ghostRect.height / (activeDrag.shape.length * 2));

    ghost.style.display = 'none';

    const element = document.elementFromPoint(targetX, targetY);
    const cell = element ? element.closest('.cell') : null;

    if (cell) {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        
        if (canPlacePiece(activeDrag.shape, r, c)) {
            triggerVibration(15);
            placePiece(activeDrag.shape, r, c, activeDrag.colorClass, activeDrag.bonus);
            document.querySelector(`.piece[data-index="${activeDrag.index}"]`).remove();
            currentAvailablePieces = currentAvailablePieces.filter(p => p.index !== activeDrag.index);
            
            playSound('place');
            checkLines();
            
            if (document.getElementById("pieces-container").children.length === 0) {
                spawnPieces();
            } else {
                checkGameOver();
            }
        } else {
            returnPiece();
        }
    } else {
        returnPiece();
    }
    activeDrag = null;
}

function returnPiece() {
    const original = document.querySelector(`.piece[data-index="${activeDrag.index}"]`);
    if (original) original.style.opacity = '1';
}

function canPlacePiece(shape, startRow, startCol) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                let targetRow = startRow + r;
                let targetCol = startCol + c;
                if (targetRow >= BOARD_SIZE || targetCol >= BOARD_SIZE || boardState[targetRow][targetCol] === 1) {
                    return false;
                }
            }
        }
    }
    return true;
}

function placePiece(shape, startRow, startCol, colorClass, bonusPoints) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                boardState[startRow + r][startCol + c] = 1;
                const cell = document.querySelector(`[data-row="${startRow + r}"][data-col="${startCol + c}"]`);
                cell.className = `cell filled ${colorClass}`;
            }
        }
    }
    score += bonusPoints;
    document.getElementById("score").innerText = score;
}

// FIX: Rendimiento ultra optimizado de partículas (máximo 4 por bloque, procesado ligero)
function createParticles(element) {
    const rect = element.getBoundingClientRect();
    const container = document.getElementById('particle-container');
    const color = window.getComputedStyle(element).backgroundImage || '#00f5d4';
    
    // Reducido a 4 partículas ligeras para evitar tirones en móviles de gama media/baja
    for (let i = 0; i < 4; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.background = color;
        p.style.left = `${rect.left + rect.width / 2}px`;
        p.style.top = `${rect.top + rect.height / 2}px`;
        
        const angle = (i * Math.PI) / 2 + (Math.random() * 0.4);
        const velocity = Math.random() * 35 + 25;
        p.style.setProperty('--x', `${Math.cos(angle) * velocity}px`);
        p.style.setProperty('--y', `${Math.sin(angle) * velocity}px`);
        
        container.appendChild(p);
        
        // Limpieza ultra rápida e inmediata del DOM
        setTimeout(() => p.remove(), 350);
    }
}

function checkLines() {
    let rowsToRemove = [];
    let colsToRemove = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        if (boardState[r].every(val => val === 1)) rowsToRemove.push(r);
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        let colFilled = true;
        for (let r = 0; r < BOARD_SIZE; r++) {
            if (boardState[r][c] === 0) colFilled = false;
        }
        if (colFilled) colsToRemove.push(c);
    }

    const totalLines = rowsToRemove.length + colsToRemove.length;

    if (totalLines > 0) {
        triggerVibration(50);
        let pointsGained = totalLines * 120;
        
        if (totalLines > 1) {
            pointsGained *= totalLines;
            triggerComboAlert(`¡MEGA COMBO x${totalLines}!\n+${pointsGained}`);
        } else {
            triggerComboAlert(`¡BLAST NEÓN!\n+120`);
        }

        // Ejecutar las partículas usando requestAnimationFrame para garantizar suavidad absoluta
        requestAnimationFrame(() => {
            rowsToRemove.forEach(r => {
                boardState[r] = Array(BOARD_SIZE).fill(0);
                for (let c = 0; c < BOARD_SIZE; c++) {
                    const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    createParticles(cell);
                    cell.className = "cell flash";
                }
            });

            colsToRemove.forEach(c => {
                for (let r = 0; r < BOARD_SIZE; r++) {
                    boardState[r][c] = 0;
                    const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    createParticles(cell);
                    cell.className = "cell flash";
                }
            });
        });

        playSound('blast');
        score += pointsGained;
        document.getElementById("score").innerText = score;
    }
}

function triggerComboAlert(text) {
    const alertBox = document.getElementById("combo-alert");
    alertBox.innerText = text;
    alertBox.classList.add("show");
    setTimeout(() => alertBox.classList.remove("show"), 1000);
}

function checkGameOver() {
    if (currentAvailablePieces.length === 0) return;
    let anyPieceFits = false;

    for (let piece of currentAvailablePieces) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (canPlacePiece(piece.shape, r, c)) { anyPieceFits = true; break; }
            }
            if (anyPieceFits) break;
        }
        if (anyPieceFits) break;
    }

    if (!anyPieceFits) {
        setTimeout(() => {
            document.getElementById("final-score-val").innerText = score;
            document.getElementById("game-over").classList.remove("hidden");
        }, 850);
    }
}

function resetGame() {
    boardState = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    score = 0;
    document.getElementById("score").innerText = score;
    createBoard();
    spawnPieces();
      }
  
