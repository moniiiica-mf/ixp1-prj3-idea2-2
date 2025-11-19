// ============================================================================
// TRAPPED IN A DREAM: ROOM 0 — "The Awakening"
// Rusty Lake-inspired 2D Point & Click Narrative Puzzle
// ============================================================================

// --- CONSTANTS ---
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;

// Game states
const STATES = {
    INTRO: 'INTRO',
    ROOM: 'ROOM',
    CLOSEUP: 'CLOSEUP',
    MIRROR_WORLD: 'MIRROR_WORLD',
    ATTIC: 'ATTIC',
    CORRIDOR: 'CORRIDOR',
    BEDROOM: 'BEDROOM',
    ENDING_MIRROR_A: 'ENDING_MIRROR_A',
    ENDING_MIRROR_B: 'ENDING_MIRROR_B',
    ENDING_CAT_A: 'ENDING_CAT_A',
    ENDING_CAT_B: 'ENDING_CAT_B',
    ENDING_DOOR_A: 'ENDING_DOOR_A',
    ENDING_DOOR_B: 'ENDING_DOOR_B',
    FINAL_ENDING: 'FINAL_ENDING'
};

// Item types
const ITEMS = {
    MIRROR_SHARD: 'mirror_shard',
    MATCHBOX: 'matchbox',
    NOTE: 'note',
    LIT_MATCH: 'lit_match'
};

// --- ROOM LAYOUT (pixels) ---
const LAYOUT = {
    mirror: { x: 140, y: 120, w: 280, h: 380 },
    curtain: { x: 40, y: 90, w: 400, h: 450 },
    table: { x: 120, y: 510, w: 240, h: 160 },
    door: { x: (BASE_WIDTH - 220) / 2, y: 180, w: 220, h: 400 },
    bowl: { x: 880, y: 585, w: 100, h: 60 },
    cat: { x: 980, y: 465, w: 180, h: 120 },
    clock: { x: (BASE_WIDTH / 2) - 60, y: 60, w: 120, h: 120 }
};

// Long-press thresholds (feel-first, no text)
const HOLD = { mirror: 1200, door: 900 }; // ms

// Long-press tracking
let _holdStart = null;
function startHold() { _holdStart = performance.now(); }
function endHold() { const t = _holdStart ? performance.now() - _holdStart : 0; _holdStart = null; return t; }

// Atmospheric text helper
function showAtmosphericText(text, duration = 3.0) {
    Game.gameState.atmosphericText = text;
    Game.gameState.atmosphericTextTimer = 0;
    Game.gameState.atmosphericTextDuration = duration;
}

// --- GLOBAL GAME OBJECT ---
const Game = {
    canvas: null,
    ctx: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
    currentState: null,
    scenes: {},
    assets: {},
    time: 0,
    deltaTime: 0,
    lastTime: 0,
    soundEnabled: true,
    firstInteraction: false,

    // Game state tracking
    gameState: {
        loopCount: 0,
        clockTime: '3:33',
        completedEndings: new Set(),
        mirrorCracked: true,
        mirrorRepaired: false,
        curtainPulled: false,
        drawerOpen: false,
        catAwake: false,
        catFed: false,
        bowlWarmed: false,
        doorLit: false,
        bloodDropped: false,
        noteRead: false,
        atmosphericText: null,
        atmosphericTextTimer: 0,
        atmosphericTextDuration: 0
    },

    // Inventory system
    inventory: {
        items: [],
        selectedItem: null,
        maxSlots: 4
    }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
    context: null,
    masterGain: null,
    droneOscillator: null,
    droneGain: null,

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.value = 0.25;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    startDrone() {
        if (!this.context || !Game.soundEnabled) return;
        try {
            if (this.droneOscillator) return;
            this.droneOscillator = this.context.createOscillator();
            this.droneGain = this.context.createGain();
            this.droneOscillator.type = 'sine';
            this.droneOscillator.frequency.value = 55;
            this.droneGain.gain.value = 0.06;
            this.droneOscillator.connect(this.droneGain);
            this.droneGain.connect(this.masterGain);
            this.droneOscillator.start();
        } catch (e) {}
    },

    stopDrone() {
        if (this.droneOscillator) {
            this.droneOscillator.stop();
            this.droneOscillator = null;
        }
    },

    playWhoosh() {
        if (!this.context || !Game.soundEnabled) return;
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.context.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.context.currentTime + 0.4);
            gain.gain.setValueAtTime(0.12, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.context.currentTime + 0.4);
        } catch (e) {}
    },

    playMeow() {
        if (!this.context || !Game.soundEnabled) return;
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(500, this.context.currentTime);
            osc.frequency.linearRampToValueAtTime(350, this.context.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.context.currentTime + 0.25);
        } catch (e) {}
    },

    playTick() {
        if (!this.context || !Game.soundEnabled) return;
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            osc.type = 'square';
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.08, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.context.currentTime + 0.05);
        } catch (e) {}
    },

    playMatchStrike() {
        if (!this.context || !Game.soundEnabled) return;
        try {
            const noise = this.context.createBufferSource();
            const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.3, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = buffer;
            const gain = this.context.createGain();
            gain.gain.setValueAtTime(0.15, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
            noise.connect(gain);
            gain.connect(this.masterGain);
            noise.start();
        } catch (e) {}
    },

    toggleSound() {
        Game.soundEnabled = !Game.soundEnabled;
        const btn = document.getElementById('sound-toggle');
        btn.textContent = Game.soundEnabled ? '🔊' : '🔇';
        if (!Game.soundEnabled) {
            this.stopDrone();
        } else if (Game.currentState === STATES.ROOM) {
            this.startDrone();
        }
    }
};

// --- INVENTORY SYSTEM ---
const Inventory = {
    add(itemId) {
        if (Game.inventory.items.length >= Game.inventory.maxSlots) {
            console.warn('Inventory full');
            return false;
        }
        Game.inventory.items.push(itemId);
        this.render();
        return true;
    },

    remove(itemId) {
        const index = Game.inventory.items.indexOf(itemId);
        if (index > -1) {
            Game.inventory.items.splice(index, 1);
            if (Game.inventory.selectedItem === itemId) {
                Game.inventory.selectedItem = null;
            }
            this.render();
            return true;
        }
        return false;
    },

    has(itemId) {
        return Game.inventory.items.includes(itemId);
    },

    select(itemId) {
        Game.inventory.selectedItem = itemId;
        this.render();
    },

    deselect() {
        Game.inventory.selectedItem = null;
        this.render();
    },

    render() {
        const slots = document.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.classList.remove('has-item', 'selected');

            const itemId = Game.inventory.items[index];
            if (itemId) {
                slot.classList.add('has-item');

                if (itemId === Game.inventory.selectedItem) {
                    slot.classList.add('selected');
                }

                const img = document.createElement('canvas');
                img.width = 50;
                img.height = 50;
                img.className = 'inventory-item';
                const ctx = img.getContext('2d');

                // Draw item icon
                this.drawItemIcon(ctx, itemId);

                slot.appendChild(img);

                const label = document.createElement('div');
                label.className = 'item-label';
                label.textContent = this.getItemName(itemId);
                slot.appendChild(label);
            }
        });
    },

    drawItemIcon(ctx, itemId) {
        ctx.clearRect(0, 0, 50, 50);

        switch(itemId) {
            case ITEMS.MIRROR_SHARD:
                // Glass shard
                ctx.strokeStyle = '#c0c0c0';
                ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(15, 35);
                ctx.lineTo(25, 10);
                ctx.lineTo(35, 35);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Blood stain
                if (Game.gameState.bloodDropped) {
                    ctx.fillStyle = '#8b0000';
                    ctx.beginPath();
                    ctx.arc(30, 28, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case ITEMS.MATCHBOX:
                // Matchbox
                ctx.fillStyle = '#4a3428';
                ctx.fillRect(10, 15, 30, 20);
                ctx.strokeStyle = '#2a1810';
                ctx.strokeRect(10, 15, 30, 20);
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(12, 17, 26, 16);
                break;

            case ITEMS.NOTE:
                // Folded paper
                ctx.fillStyle = '#e8dcc0';
                ctx.fillRect(8, 10, 34, 30);
                ctx.strokeStyle = '#8c7a5e';
                ctx.strokeRect(8, 10, 34, 30);
                ctx.beginPath();
                ctx.moveTo(8, 25);
                ctx.lineTo(42, 25);
                ctx.stroke();
                break;

            case ITEMS.LIT_MATCH:
                // Burning match
                ctx.strokeStyle = '#4a3428';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(25, 40);
                ctx.lineTo(25, 15);
                ctx.stroke();
                // Flame
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.ellipse(25, 12, 4, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.ellipse(25, 13, 2, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    },

    getItemName(itemId) {
        switch(itemId) {
            case ITEMS.MIRROR_SHARD: return 'Shard';
            case ITEMS.MATCHBOX: return 'Matchbox';
            case ITEMS.NOTE: return 'Note';
            case ITEMS.LIT_MATCH: return 'Match';
            default: return '';
        }
    },

    setupEvents() {
        const slots = document.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            slot.addEventListener('click', () => {
                const itemId = Game.inventory.items[index];
                if (itemId) {
                    // Special handling for note - read it instead of selecting
                    if (itemId === ITEMS.NOTE) {
                        this.readNote();
                        return;
                    }

                    if (Game.inventory.selectedItem === itemId) {
                        this.deselect();
                    } else {
                        this.select(itemId);
                    }
                }
            });
        });
    },

    readNote() {
        Game.gameState.noteRead = true;
        AudioEngine.playTick();

        // Create note modal overlay
        const noteOverlay = document.createElement('div');
        noteOverlay.className = 'note-overlay';
        noteOverlay.innerHTML = `
            <div class="note-paper">
                <div class="note-lines">
                    <div class="note-line"></div>
                    <div class="note-line"></div>
                    <div class="note-line"></div>
                    <div class="note-line"></div>
                    <div class="note-line"></div>
                </div>
                <div class="note-text">
                    Three paths.<br>
                    Three eyes.<br>
                    Three thirty-three.<br><br>
                    The loop only breaks when<br>
                    all paths are walked.
                </div>
                <button class="note-close-btn">Close</button>
            </div>
        `;
        document.getElementById('game-container').appendChild(noteOverlay);

        // Close button handler
        noteOverlay.querySelector('.note-close-btn').onclick = () => {
            noteOverlay.remove();
        };

        // Click overlay to close
        noteOverlay.onclick = (e) => {
            if (e.target === noteOverlay) {
                noteOverlay.remove();
            }
        };
    }
};

// --- FX UTILITIES ---
const FX = {
    grainCanvas: null,
    grainCtx: null,
    grainRefreshCounter: 0,

    initGrain() {
        this.grainCanvas = document.createElement('canvas');
        this.grainCanvas.width = BASE_WIDTH;
        this.grainCanvas.height = BASE_HEIGHT;
        this.grainCtx = this.grainCanvas.getContext('2d');
        this.generateGrain();
    },

    generateGrain() {
        const imageData = this.grainCtx.createImageData(BASE_WIDTH, BASE_HEIGHT);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.random() * 80;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
            data[i + 3] = 20;
        }
        this.grainCtx.putImageData(imageData, 0, 0);
    },

    drawGrain(ctx) {
        this.grainRefreshCounter++;
        if (this.grainRefreshCounter > 4) {
            this.generateGrain();
            this.grainRefreshCounter = 0;
        }
        ctx.globalAlpha = 0.2;
        ctx.drawImage(this.grainCanvas, 0, 0);
        ctx.globalAlpha = 1;
    },

    drawVignette(ctx) {
        const gradient = ctx.createRadialGradient(
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.3,
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    },

    whiteFlash(ctx, intensity) {
        ctx.fillStyle = `rgba(255, 250, 240, ${intensity})`;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    },

    blackFade(ctx, intensity) {
        ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    }
};

// --- HOTSPOT SYSTEM ---
const Hotspots = {
    areas: [],
    hoveredId: null,
    tooltip: null,

    add(id, x, y, width, height, label, onClick, canUseItem = false) {
        this.areas.push({ id, x, y, width, height, label, onClick, canUseItem });
    },

    clear() {
        this.areas = [];
        this.hoveredId = null;
        this.hideTooltip();
    },

    hitTest(x, y) {
        for (let area of this.areas) {
            if (x >= area.x && x <= area.x + area.width &&
                y >= area.y && y <= area.y + area.height) {
                return area;
            }
        }
        return null;
    },

    update(mouseX, mouseY) {
        const hit = this.hitTest(mouseX, mouseY);

        if (hit) {
            this.hoveredId = hit.id;
            Game.canvas.classList.add('hover-hotspot');

            let tooltipText = hit.label;
            if (Game.inventory.selectedItem && hit.canUseItem) {
                tooltipText = `Use ${Inventory.getItemName(Game.inventory.selectedItem)}`;
            }

            this.showTooltip(tooltipText, mouseX, mouseY);
        } else {
            this.hoveredId = null;
            Game.canvas.classList.remove('hover-hotspot');
            this.hideTooltip();
        }
    },

    click(mouseX, mouseY) {
        const hit = this.hitTest(mouseX, mouseY);
        if (hit && hit.onClick) {
            hit.onClick();
            if (!Game.firstInteraction) {
                Game.firstInteraction = true;
                document.getElementById('instruction-hint').classList.add('hidden');
            }
        }
    },

    showTooltip(text, x, y) {
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'tooltip';
            document.body.appendChild(this.tooltip);
        }
        this.tooltip.textContent = text;
        this.tooltip.style.left = (x * Game.scale + Game.offsetX + 15) + 'px';
        this.tooltip.style.top = (y * Game.scale + Game.offsetY - 35) + 'px';
        this.tooltip.style.display = 'block';
    },

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
};

// --- ASSETS GENERATION ---
const Assets = {
    generateCharacter() {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');

        // Silhouette of person sitting
        ctx.fillStyle = '#1a1410';

        // Head
        ctx.beginPath();
        ctx.arc(60, 40, 25, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        ctx.fillRect(52, 60, 16, 15);

        // Torso
        ctx.beginPath();
        ctx.ellipse(60, 105, 35, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        ctx.beginPath();
        ctx.ellipse(30, 100, 12, 35, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(90, 100, 12, 35, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Legs (seated)
        ctx.fillRect(40, 140, 15, 40);
        ctx.fillRect(65, 140, 15, 40);

        // Simple face features
        ctx.fillStyle = '#3d3226';
        ctx.beginPath();
        ctx.arc(52, 38, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(68, 38, 3, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    generateMirror(cracked = true) {
        const canvas = document.createElement('canvas');
        canvas.width = 280;
        canvas.height = 380;
        const ctx = canvas.getContext('2d');

        // Ornate frame
        ctx.fillStyle = '#2a1810';
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(140, 190, 130, 175, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner frame detail
        ctx.strokeStyle = '#3d3226';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(140, 190, 115, 160, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Mirror surface
        ctx.fillStyle = '#0f0f0f';
        ctx.beginPath();
        ctx.ellipse(140, 190, 100, 145, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle reflection
        ctx.fillStyle = 'rgba(60, 60, 70, 0.2)';
        ctx.beginPath();
        ctx.ellipse(110, 160, 50, 70, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Crack if not repaired
        if (cracked) {
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(140, 60);
            ctx.lineTo(145, 150);
            ctx.lineTo(135, 250);
            ctx.lineTo(140, 320);
            ctx.stroke();

            // Crack branches
            ctx.beginPath();
            ctx.moveTo(145, 150);
            ctx.lineTo(170, 140);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(135, 250);
            ctx.lineTo(110, 260);
            ctx.stroke();
        }

        return canvas;
    },

    generateCurtain(pulled = false) {
        const canvas = document.createElement('canvas');
        canvas.width = pulled ? 100 : 400;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2d1f15';

        if (pulled) {
            // Pulled to side
            ctx.fillRect(0, 0, 100, 450);
            for (let i = 0; i < 7; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#2d1f15' : '#1d0f05';
                ctx.fillRect(i * 14, 0, 14, 450);
            }
        } else {
            // Hanging with folds - wider to completely cover mirror
            for (let i = 0; i < 27; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#2d1f15' : '#1d0f05';
                ctx.fillRect(i * 15, 0, 15, 450);
            }
        }

        return canvas;
    },

    generateTable(open = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        // Top + apron
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(0, 0, 240, 28);
        ctx.fillStyle = '#2f2014';
        ctx.fillRect(0, 28, 240, 22);

        // Legs (grounding)
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(20, 50, 14, 110);
        ctx.fillRect(206, 50, 14, 110);

        // Drawer
        if (!open) {
            ctx.fillStyle = '#2b1c12';
            ctx.fillRect(60, 35, 120, 36);
            ctx.strokeStyle = '#1a1008';
            ctx.strokeRect(60, 35, 120, 36);
            ctx.fillStyle = '#6b533e';
            ctx.beginPath();
            ctx.arc(120, 53, 5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Open: show cavity and items hint
            ctx.fillStyle = '#1b130d';
            ctx.fillRect(60, 35, 120, 60);
            ctx.strokeStyle = '#1a1008';
            ctx.strokeRect(60, 35, 120, 60);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(62, 85, 116, 10); // drawer front dropped
        }

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(120, 155, 110, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    generateBowl(warmed = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');

        // Bowl
        ctx.fillStyle = '#4a4a4a';
        ctx.beginPath();
        ctx.ellipse(50, 45, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.ellipse(50, 40, 38, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Warm glow if heated
        if (warmed) {
            ctx.fillStyle = 'rgba(255, 140, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(50, 40, 45, 20, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        return canvas;
    },

    generateCat(awake = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        // Realistic side-profile cat
        ctx.fillStyle = '#0b0b0b';

        // Body
        ctx.beginPath();
        ctx.ellipse(90, 78, 70, 40, 0, 0, Math.PI * 2);
        ctx.fill();

        // Back leg
        ctx.beginPath();
        ctx.ellipse(55, 105, 22, 14, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Chest/neck
        ctx.beginPath();
        ctx.ellipse(128, 78, 30, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.ellipse(150, 60, 24, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ear 1
        ctx.beginPath();
        ctx.moveTo(160, 39);
        ctx.lineTo(170, 55);
        ctx.lineTo(152, 50);
        ctx.closePath();
        ctx.fill();

        // Ear 2
        ctx.beginPath();
        ctx.moveTo(142, 40);
        ctx.lineTo(150, 52);
        ctx.lineTo(136, 50);
        ctx.closePath();
        ctx.fill();

        // Tail
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0b0b0b';
        ctx.beginPath();
        ctx.moveTo(30, 85);
        ctx.quadraticCurveTo(10, 60, 32, 45);
        ctx.stroke();

        // Eyes (sleeping = narrow slits, awake = 3 glowing)
        if (!awake) {
            ctx.strokeStyle = '#272727';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(142, 60);
            ctx.lineTo(148, 60);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(155, 60);
            ctx.lineTo(161, 60);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#64ff80';
            // Three glowing eyes
            [[145, 57], [155, 57], [150, 52]].forEach(p => {
                ctx.beginPath();
                ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        return canvas;
    },

    generateDoor(lightIntensity = 0.3) {
        const canvas = document.createElement('canvas');
        canvas.width = 220;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // Door frame
        ctx.fillStyle = '#1a1008';
        ctx.fillRect(0, 0, 220, 400);

        // Left door panel (slightly open - pulled to left)
        ctx.fillStyle = '#2d1f15';
        ctx.fillRect(10, 15, 90, 370);

        // Left panel details
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 30, 70, 150);
        ctx.strokeRect(20, 200, 70, 150);

        // Right door panel (stays in frame)
        ctx.fillStyle = '#2d1f15';
        ctx.fillRect(115, 15, 90, 370);

        // Right panel details
        ctx.strokeRect(125, 30, 70, 150);
        ctx.strokeRect(125, 200, 70, 150);

        // Door knob on left door
        ctx.fillStyle = '#4a3428';
        ctx.beginPath();
        ctx.arc(85, 220, 8, 0, Math.PI * 2);
        ctx.fill();

        // Gap between doors (slightly open) - just darkness
        const gapX = 100;
        const gapWidth = 15;
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(gapX, 15, gapWidth, 370);

        return canvas;
    },

    generateClock(time = '3:33') {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        // Clock face
        ctx.fillStyle = '#e8dcc0';
        ctx.beginPath();
        ctx.arc(60, 60, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#3d2817';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Hour marks
        ctx.fillStyle = '#1a1008';
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 - 90) * Math.PI / 180;
            const x = 60 + Math.cos(angle) * 40;
            const y = 60 + Math.sin(angle) * 40;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Parse time
        const [hours, minutes] = time.split(':').map(Number);

        // Hour hand
        const hourAngle = ((hours % 12) * 30 + minutes * 0.5 - 90) * Math.PI / 180;
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.lineTo(60 + Math.cos(hourAngle) * 25, 60 + Math.sin(hourAngle) * 25);
        ctx.stroke();

        // Minute hand
        const minuteAngle = (minutes * 6 - 90) * Math.PI / 180;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.lineTo(60 + Math.cos(minuteAngle) * 35, 60 + Math.sin(minuteAngle) * 35);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#1a1008';
        ctx.beginPath();
        ctx.arc(60, 60, 5, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    load() {
        Game.assets.character = this.generateCharacter();
        Game.assets.mirror = this.generateMirror(Game.gameState.mirrorCracked);
        Game.assets.curtainClosed = this.generateCurtain(false);
        Game.assets.curtainOpen = this.generateCurtain(true);
        Game.assets.tableClosed = this.generateTable(false);
        Game.assets.tableOpen = this.generateTable(true);
        Game.assets.table = Game.assets.tableClosed;
        Game.assets.bowl = this.generateBowl(false);
        Game.assets.bowlWarmed = this.generateBowl(true);
        Game.assets.catSleeping = this.generateCat(false);
        Game.assets.catAwake = this.generateCat(true);
        Game.assets.door = this.generateDoor(0.3);
        Game.assets.clock = this.generateClock(Game.gameState.clockTime);
    }
};

// --- SCENE: INTRO ---
const SceneIntro = {
    timer: 0,
    duration: 4.0,
    textFadeIn: 0.8,
    textHold: 2.5,
    textFadeOut: 3.5,

    enter() {
        this.timer = 0;
    },

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) {
            SceneManager.changeState(STATES.ROOM);
        }
    },

    draw(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Eye opening
        const openProgress = Math.min(this.timer / 3.0, 1);
        const easeOpen = this.easeOutCubic(openProgress);
        const slitHeight = BASE_HEIGHT * easeOpen;
        const topHeight = (BASE_HEIGHT - slitHeight) / 2;

        if (openProgress < 1) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, BASE_WIDTH, topHeight);
            ctx.fillRect(0, BASE_HEIGHT - topHeight, BASE_WIDTH, topHeight);
        }

        // Scene through slit
        ctx.fillStyle = '#1a1410';
        ctx.fillRect(0, topHeight, BASE_WIDTH, slitHeight);

        // Text
        let textAlpha = 0;
        if (this.timer < this.textFadeIn) {
            textAlpha = this.timer / this.textFadeIn;
        } else if (this.timer < this.textHold) {
            textAlpha = 1;
        } else if (this.timer < this.textFadeOut) {
            textAlpha = 1 - ((this.timer - this.textHold) / (this.textFadeOut - this.textHold));
        }

        ctx.fillStyle = `rgba(212, 197, 169, ${textAlpha * 0.9})`;
        ctx.font = 'italic 18px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('Your eyes open.', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 30);
        ctx.fillText('The room greets you.', BASE_WIDTH / 2, BASE_HEIGHT / 2);
        ctx.fillText('Again.', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 30);
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
};

// --- SCENE: ROOM ---
const SceneRoom = {
    doorLightPulse: 0,
    curtainSway: 0,
    mirrorRipple: 0,
    catEyeFollow: { x: 0, y: 0 },
    clockTick: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.doorLightPulse = 0;
        this.curtainSway = 0;
        this.mirrorRipple = 0;
        this.catEyeFollow = { x: 0, y: 0 };
        this.clockTick = 0;

        // Update clock display
        const clockDisplay = document.getElementById('clock-time');
        if (clockDisplay) {
            clockDisplay.textContent = Game.gameState.clockTime;
        }

        // Show atmospheric text based on loop count and endings
        const endingCount = Game.gameState.completedEndings.size;
        setTimeout(() => {
            if (Game.gameState.loopCount === 0) {
                showAtmosphericText('The room waits. It knows you. You know it.', 4.0);
            } else if (endingCount === 1) {
                showAtmosphericText('You tried one path. The room brought you back.', 3.5);
            } else if (endingCount === 2) {
                showAtmosphericText('Two endings, same result. The room is patient.', 3.5);
            } else if (endingCount >= 3) {
                showAtmosphericText('All paths explored. All paths returned you here.', 4.0);
            } else {
                showAtmosphericText('Again? Or have you never left?', 3.5);
            }
        }, 500);
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Mirror (press & hold to "press palm")
        Hotspots.add('mirror', LAYOUT.mirror.x, LAYOUT.mirror.y, LAYOUT.mirror.w, LAYOUT.mirror.h,
            Game.gameState.mirrorRepaired ? 'Touch (hold to press palm)' : (Game.gameState.curtainPulled ? 'Inspect' : '(Covered)'),
            () => this.handleMirror(),
            true
        );

        // Curtain first — reveals mirror + shard
        if (!Game.gameState.curtainPulled) {
            Hotspots.add('curtain', LAYOUT.curtain.x, LAYOUT.curtain.y, LAYOUT.curtain.w, LAYOUT.curtain.h,
                'Pull curtain', () => this.handleCurtain());
        }

        // Drawer (toggle open/close, items live inside)
        Hotspots.add('drawer', LAYOUT.table.x + 60, LAYOUT.table.y + 35, 120, Game.gameState.drawerOpen ? 60 : 36,
            Game.gameState.drawerOpen ? 'Close drawer' : 'Open drawer',
            () => this.handleDrawer()
        );

        // Bowl
        Hotspots.add('bowl', LAYOUT.bowl.x, LAYOUT.bowl.y, LAYOUT.bowl.w, LAYOUT.bowl.h,
            'Bowl', () => this.handleBowl(), true);

        // Cat (visible from start; lunge vs soothe)
        Hotspots.add('cat', LAYOUT.cat.x, LAYOUT.cat.y, LAYOUT.cat.w, LAYOUT.cat.h,
            Game.gameState.catAwake ? 'Call' : 'Pet', () => this.handleCat(), true);

        // Door (center)
        Hotspots.add('door', LAYOUT.door.x, LAYOUT.door.y, LAYOUT.door.w, LAYOUT.door.h,
            'Door', () => this.handleDoor(), true);

        // Clock (for atmosphere)
        Hotspots.add('clock', LAYOUT.clock.x, LAYOUT.clock.y, LAYOUT.clock.w, LAYOUT.clock.h,
            'Clock', () => this.handleClock());
    },

    handleMirror() {
        if (!Game.gameState.curtainPulled) {
            showAtmosphericText('Something hangs in front of it.', 2.0);
            return;
        }

        // Use shard to repair mirror
        if (Game.inventory.selectedItem === ITEMS.MIRROR_SHARD && !Game.gameState.mirrorRepaired) {
            Game.gameState.mirrorRepaired = true;
            Game.assets.mirror = Assets.generateMirror(false);
            AudioEngine.playWhoosh();
            Inventory.deselect();
            showAtmosphericText('The shard fits perfectly. The crack heals. Your reflection watches.', 3.5);
            setTimeout(() => this.setupHotspots(), 500);
            return;
        }

        // Mirror is repaired - can trigger ending
        if (Game.gameState.mirrorRepaired) {
            // Short tap = "close eyes" ending
            Game.gameState.completedEndings.add('mirror_b');
            SceneManager.changeState(STATES.ENDING_MIRROR_B);
        } else {
            // Mirror is cracked
            showAtmosphericText('The mirror is cracked. Your reflection is broken.', 2.5);
        }
    },

    handleCurtain() {
        Game.gameState.curtainPulled = true;
        AudioEngine.playWhoosh();

        if (!Inventory.has(ITEMS.MIRROR_SHARD)) {
            Inventory.add(ITEMS.MIRROR_SHARD);
            Game.gameState.bloodDropped = true; // tiny cut as you pull shard
            Inventory.render();
            showAtmosphericText('A shard falls. A drop of blood follows.', 2.5);
        } else {
            showAtmosphericText('The mirror stares back, cracked and waiting.', 2.5);
        }

        this.setupHotspots();
    },

    handleDrawer() {
        Game.gameState.drawerOpen = !Game.gameState.drawerOpen;
        AudioEngine.playTick();

        if (Game.gameState.drawerOpen) {
            if (!Inventory.has(ITEMS.MATCHBOX)) {
                Inventory.add(ITEMS.MATCHBOX);
                showAtmosphericText('Matches and a note. Left for you? Or by you?', 3.0);
            }
            if (!Inventory.has(ITEMS.NOTE)) Inventory.add(ITEMS.NOTE);
        }

        this.setupHotspots();
    },

    handleBowl() {
        const it = Game.inventory.selectedItem;

        if (it === ITEMS.MATCHBOX && !Game.gameState.bowlWarmed) {
            Game.gameState.bowlWarmed = true;
            Game.assets.bowl = Assets.generateBowl(true);
            AudioEngine.playMatchStrike();
            Inventory.remove(ITEMS.MATCHBOX);
            Inventory.add(ITEMS.LIT_MATCH);
            Inventory.deselect();
            showAtmosphericText('The match ignites. Warmth spreads. Something stirs in the corner.', 3.0);
        } else if (it === ITEMS.LIT_MATCH && Game.gameState.bowlWarmed) {
            showAtmosphericText('The flame already burns here.', 2.0);
        } else if (!it) {
            showAtmosphericText('An empty bowl. Cold metal.', 2.0);
        }
    },

    handleCat() {
        // If cat is sleeping and you haven't warmed the bowl
        if (!Game.gameState.catAwake && !Game.gameState.bowlWarmed) {
            showAtmosphericText('The cat sleeps soundly. It won\'t wake to touch alone.', 2.5);
            AudioEngine.playMeow();
            return;
        }

        // Bowl is warmed, cat wakes up
        if (Game.gameState.bowlWarmed && !Game.gameState.catAwake) {
            Game.gameState.catAwake = true;
            Game.assets.catSleeping = Assets.generateCat(false);
            Game.assets.catAwake = Assets.generateCat(true);
            showAtmosphericText('Three eyes open. The cat sees you now.', 3.0);
            AudioEngine.playMeow();
            this.setupHotspots();
            return;
        }

        // Cat is awake - now you can trigger endings
        if (Game.gameState.catAwake) {
            if (Game.inventory.selectedItem === ITEMS.LIT_MATCH) {
                // Soothe with warmth → peaceful ending
                Game.gameState.completedEndings.add('cat_b');
                SceneManager.changeState(STATES.ENDING_CAT_B);
            } else {
                // Touch the three-eyed cat → scary ending
                Game.gameState.completedEndings.add('cat_a');
                SceneManager.changeState(STATES.ENDING_CAT_A);
            }
        }
    },

    handleDoor() {
        // Try to use lit match on door
        if (Game.inventory.selectedItem === ITEMS.LIT_MATCH && !Game.gameState.doorLit) {
            Game.gameState.doorLit = true;
            Game.assets.door = Assets.generateDoor(0.7);
            AudioEngine.playTick();
            Inventory.deselect();
            showAtmosphericText('You hold the flame near the gap. The darkness beyond shifts.', 3.0);
            setTimeout(() => this.setupHotspots(), 500);
            return;
        }

        // Door is prepared - can trigger ending
        if (Game.gameState.doorLit) {
            // Quick tap = false awakening
            Game.gameState.completedEndings.add('door_a');
            SceneManager.changeState(STATES.ENDING_DOOR_A);
        } else {
            // Door not ready yet
            showAtmosphericText('The door is locked. Or maybe you\'re afraid to try.', 2.5);
            AudioEngine.playTick();
        }
    },

    handleClock() {
        const messages = [
            'The hands haven\'t moved. They never move.',
            'Time is frozen at 3:33. Or maybe you are.',
            'The clock ticks, but the time stays the same.',
            'You wonder how long you\'ve been here.'
        ];
        const msg = messages[Game.gameState.loopCount % messages.length];
        showAtmosphericText(msg, 3.0);
        AudioEngine.playTick();
    },

    update(dt) {
        this.doorLightPulse += dt;
        this.curtainSway += dt;
        this.clockTick += dt;

        // Mirror ripple when hovering
        const mirrorHovered = Hotspots.hoveredId === 'mirror';
        if (mirrorHovered && Game.gameState.curtainPulled) {
            this.mirrorRipple += dt * 4;
        } else {
            this.mirrorRipple = Math.max(0, this.mirrorRipple - dt * 2);
        }

        // Cat eyes follow mouse smoothly
        if (Game.gameState.catAwake) {
            const catCenterX = LAYOUT.cat.x + LAYOUT.cat.w / 2;
            const catCenterY = LAYOUT.cat.y + LAYOUT.cat.h / 2;
            const targetX = (Game.mouse.worldX - catCenterX) * 0.02;
            const targetY = (Game.mouse.worldY - catCenterY) * 0.02;

            // Smooth interpolation
            this.catEyeFollow.x += (targetX - this.catEyeFollow.x) * 0.05;
            this.catEyeFollow.y += (targetY - this.catEyeFollow.y) * 0.05;
        }

        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);

        // Update atmospheric text timer
        if (Game.gameState.atmosphericText) {
            Game.gameState.atmosphericTextTimer += dt;
            if (Game.gameState.atmosphericTextTimer >= Game.gameState.atmosphericTextDuration) {
                Game.gameState.atmosphericText = null;
            }
        }
    },

    draw(ctx) {
        // WALL
        const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        bgGradient.addColorStop(0, '#4a3d32');
        bgGradient.addColorStop(0.65, '#3a2d22');
        bgGradient.addColorStop(1, '#2a1d12');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // FLOOR boards
        ctx.fillStyle = '#2d2318';
        ctx.fillRect(0, BASE_HEIGHT * 0.7, BASE_WIDTH, BASE_HEIGHT * 0.3);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = i % 2 ? '#2a2016' : '#30261b';
            ctx.fillRect(i * 64, BASE_HEIGHT * 0.7, 64, BASE_HEIGHT * 0.3);
        }

        // --- BACK WALL OBJECTS ---
        // Centered door + clock above
        ctx.drawImage(Game.assets.door, LAYOUT.door.x, LAYOUT.door.y);
        ctx.drawImage(Game.assets.clock, LAYOUT.clock.x, LAYOUT.clock.y);

        // Mirror behind curtain (left) - add ripple effect when hovered
        ctx.save();
        if (this.mirrorRipple > 0 && Game.gameState.curtainPulled) {
            // Subtle ripple distortion
            ctx.translate(Math.sin(this.mirrorRipple * 3) * 1.5, Math.cos(this.mirrorRipple * 2) * 1);
        }
        ctx.drawImage(Game.assets.mirror, LAYOUT.mirror.x, LAYOUT.mirror.y);

        // Mirror surface glow when hovered
        if (this.mirrorRipple > 0 && Game.gameState.curtainPulled) {
            const rippleIntensity = Math.sin(this.mirrorRipple * 2) * 0.1 + 0.1;
            ctx.fillStyle = `rgba(100, 150, 200, ${rippleIntensity})`;
            ctx.beginPath();
            ctx.ellipse(LAYOUT.mirror.x + LAYOUT.mirror.w/2, LAYOUT.mirror.y + LAYOUT.mirror.h/2,
                        100, 145, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Curtain ON TOP of mirror - add subtle sway when not pulled
        ctx.save();
        const curtain = Game.gameState.curtainPulled ? Game.assets.curtainOpen : Game.assets.curtainClosed;
        if (!Game.gameState.curtainPulled) {
            // Subtle sway animation
            const swayAmount = Math.sin(this.curtainSway * 0.8) * 2;
            ctx.translate(swayAmount, 0);
        }
        ctx.drawImage(curtain, LAYOUT.curtain.x, LAYOUT.curtain.y);
        ctx.restore();

        // Table under mirror (grounded)
        Game.assets.table = Game.gameState.drawerOpen ? Game.assets.tableOpen : Game.assets.tableClosed;
        ctx.drawImage(Game.assets.table, LAYOUT.table.x, LAYOUT.table.y);

        // Add subtle glow hint to drawer handle when closed (moved to right where handle is)
        if (!Game.gameState.drawerOpen) {
            const drawerHintAlpha = 0.15 + Math.sin(this.clockTick * 2) * 0.08;
            const glowGradient = ctx.createRadialGradient(
                LAYOUT.table.x + 70, LAYOUT.table.y + 40, 0,
                LAYOUT.table.x + 70, LAYOUT.table.y + 40, 12
            );
            glowGradient.addColorStop(0, `rgba(212, 197, 169, ${drawerHintAlpha})`);
            glowGradient.addColorStop(1, 'rgba(212, 197, 169, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(LAYOUT.table.x + 70, LAYOUT.table.y + 40, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Bowl (right)
        const bowl = Game.gameState.bowlWarmed ? Game.assets.bowlWarmed : Game.assets.bowl;
        ctx.drawImage(bowl, LAYOUT.bowl.x, LAYOUT.bowl.y);

        // Add glow to bowl when matchbox is selected (hint to strike it)
        if (Game.inventory.selectedItem === ITEMS.MATCHBOX && !Game.gameState.bowlWarmed) {
            const glowAlpha = 0.2 + Math.sin(this.clockTick * 3) * 0.1;
            ctx.strokeStyle = `rgba(255, 140, 0, ${glowAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(LAYOUT.bowl.x + LAYOUT.bowl.w / 2, LAYOUT.bowl.y + LAYOUT.bowl.h / 2,
                       LAYOUT.bowl.w / 2 + 5, LAYOUT.bowl.h / 2 + 5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // CAT in foreground
        const cat = Game.gameState.catAwake ? Game.assets.catAwake : Game.assets.catSleeping;
        ctx.drawImage(cat, LAYOUT.cat.x, LAYOUT.cat.y);

        // If cat is awake, draw eyes that follow cursor
        if (Game.gameState.catAwake) {
            const eyePositions = [
                [LAYOUT.cat.x + 145, LAYOUT.cat.y + 57],
                [LAYOUT.cat.x + 155, LAYOUT.cat.y + 57],
                [LAYOUT.cat.x + 150, LAYOUT.cat.y + 52]
            ];

            ctx.fillStyle = '#64ff80';
            eyePositions.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x + this.catEyeFollow.x, y + this.catEyeFollow.y, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            // Add glow effect around eyes
            eyePositions.forEach(([x, y]) => {
                const glowGradient = ctx.createRadialGradient(
                    x + this.catEyeFollow.x, y + this.catEyeFollow.y, 0,
                    x + this.catEyeFollow.x, y + this.catEyeFollow.y, 8
                );
                glowGradient.addColorStop(0, 'rgba(100, 255, 128, 0.4)');
                glowGradient.addColorStop(1, 'rgba(100, 255, 128, 0)');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(x + this.catEyeFollow.x, y + this.catEyeFollow.y, 8, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Floating dust particles for atmosphere
        const t = Game.time;
        ctx.save();
        for (let i = 0; i < 15; i++) {
            const x = ((i * 123 + t * 20) % BASE_WIDTH);
            const y = ((i * 456 + t * 15) % BASE_HEIGHT);
            const size = 1 + (i % 3);
            const alpha = 0.05 + 0.03 * Math.sin(t + i);
            ctx.fillStyle = `rgba(212, 197, 169, ${alpha})`;
            ctx.fillRect(x, y, size, size);
        }
        ctx.restore();

        // Effects
        FX.drawVignette(ctx);
        FX.drawGrain(ctx);

        // Atmospheric text overlay
        if (Game.gameState.atmosphericText) {
            const fadeIn = 0.6;
            const fadeOut = 0.8;
            const timer = Game.gameState.atmosphericTextTimer;
            const duration = Game.gameState.atmosphericTextDuration;

            let alpha = 1;
            if (timer < fadeIn) {
                alpha = timer / fadeIn;
            } else if (timer > duration - fadeOut) {
                alpha = (duration - timer) / fadeOut;
            }

            ctx.save();
            ctx.fillStyle = `rgba(212, 197, 169, ${alpha * 0.9})`;
            ctx.font = 'italic 16px "Courier New"';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(Game.gameState.atmosphericText, BASE_WIDTH / 2, BASE_HEIGHT - 80);
            ctx.restore();
        }
    }
};

// --- SCENE: MIRROR WORLD ---
const SceneMirrorWorld = {
    doorLightPulse: 0,
    mirrorOutlineGlow: 0,
    flashingBack: false,
    flashTimer: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.doorLightPulse = 0;
        this.mirrorOutlineGlow = 0;
        this.flashingBack = false;
        this.flashTimer = 0;

        // Show atmospheric text
        setTimeout(() => {
            showAtmosphericText('Everything is familiar. Everything is wrong. The room breathes backwards.', 4.5);
        }, 500);
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Curtain on far right (no mirror behind)
        const curtainX = BASE_WIDTH - LAYOUT.curtain.x - LAYOUT.curtain.w;
        Hotspots.add('curtain-mirror', curtainX, LAYOUT.curtain.y, LAYOUT.curtain.w, LAYOUT.curtain.h,
            'Curtain', () => this.handleCurtainMirror());

        // Invisible mirror outline on LEFT side (same position as Room 0, but in flipped world)
        Hotspots.add('mirror-outline', LAYOUT.mirror.x, LAYOUT.mirror.y, LAYOUT.mirror.w, LAYOUT.mirror.h,
            'Something familiar...', () => this.handleMirrorOutline());

        // Door (light on opposite side)
        Hotspots.add('door-mirror', LAYOUT.door.x, LAYOUT.door.y, LAYOUT.door.w, LAYOUT.door.h,
            'Door', () => this.handleDoorMirror());

        // Clock (backwards)
        Hotspots.add('clock-mirror', LAYOUT.clock.x, LAYOUT.clock.y, LAYOUT.clock.w, LAYOUT.clock.h,
            'Clock', () => this.handleClockMirror());
    },

    handleCurtainMirror() {
        showAtmosphericText('The curtain hangs still. There\'s nothing behind it. There never was.', 3.0);
        AudioEngine.playWhoosh();
    },

    handleMirrorOutline() {
        showAtmosphericText('An outline on the wall. A ghost of glass. It pulls at you.', 3.5);
        AudioEngine.playWhoosh();

        // Flash after 1 second to hint, then pull back after 3 seconds total
        this.flashingBack = true;
        const self = this;
        setTimeout(function() {
            self.returnToRoom();
        }, 3000);
    },

    handleDoorMirror() {
        showAtmosphericText('The door is closed. Light seeps from the wrong side.', 2.5);
        AudioEngine.playTick();
    },

    handleClockMirror() {
        showAtmosphericText('The clock reads 3:34. The second hand ticks backwards.', 3.0);
        AudioEngine.playTick();
    },

    returnToRoom() {
        this.incrementLoop();
        SceneManager.changeState(STATES.ROOM);
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);
        this.resetRoomState();
        this.checkFinalEnding();
    },

    resetRoomState() {
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    update(dt) {
        this.doorLightPulse += dt;
        this.mirrorOutlineGlow += dt;

        if (this.flashingBack) {
            this.flashTimer += dt;
        }

        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);

        // Update atmospheric text timer
        if (Game.gameState.atmosphericText) {
            Game.gameState.atmosphericTextTimer += dt;
            if (Game.gameState.atmosphericTextTimer >= Game.gameState.atmosphericTextDuration) {
                Game.gameState.atmosphericText = null;
            }
        }
    },

    draw(ctx) {
        // Flip everything horizontally and use cooler color palette
        ctx.save();
        ctx.translate(BASE_WIDTH, 0);
        ctx.scale(-1, 1);

        // WALL with cooler tones (blue/green tint)
        const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        bgGradient.addColorStop(0, '#324a46');
        bgGradient.addColorStop(0.65, '#223a36');
        bgGradient.addColorStop(1, '#122a26');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // FLOOR boards with cooler tones
        ctx.fillStyle = '#1d2e2a';
        ctx.fillRect(0, BASE_HEIGHT * 0.7, BASE_WIDTH, BASE_HEIGHT * 0.3);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = i % 2 ? '#1a2a26' : '#203028';
            ctx.fillRect(i * 64, BASE_HEIGHT * 0.7, 64, BASE_HEIGHT * 0.3);
        }

        // Door (centered, closed)
        ctx.fillStyle = '#1a1008';
        ctx.fillRect(LAYOUT.door.x, LAYOUT.door.y, LAYOUT.door.w, LAYOUT.door.h);

        // Door panels (both closed)
        ctx.fillStyle = '#2d1f15';
        ctx.fillRect(LAYOUT.door.x + 10, LAYOUT.door.y + 15, 90, 370);
        ctx.fillRect(LAYOUT.door.x + 115, LAYOUT.door.y + 15, 90, 370);

        // Panel details
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3;
        ctx.strokeRect(LAYOUT.door.x + 20, LAYOUT.door.y + 30, 70, 150);
        ctx.strokeRect(LAYOUT.door.x + 20, LAYOUT.door.y + 200, 70, 150);
        ctx.strokeRect(LAYOUT.door.x + 125, LAYOUT.door.y + 30, 70, 150);
        ctx.strokeRect(LAYOUT.door.x + 125, LAYOUT.door.y + 200, 70, 150);

        // Clock (3:34, backwards second hand)
        const clockCanvas = document.createElement('canvas');
        clockCanvas.width = 120;
        clockCanvas.height = 120;
        const clockCtx = clockCanvas.getContext('2d');

        // Clock face
        clockCtx.fillStyle = '#d8e8e0';
        clockCtx.beginPath();
        clockCtx.arc(60, 60, 50, 0, Math.PI * 2);
        clockCtx.fill();
        clockCtx.strokeStyle = '#3d4847';
        clockCtx.lineWidth = 4;
        clockCtx.stroke();

        // Hour marks
        clockCtx.fillStyle = '#1a2028';
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 - 90) * Math.PI / 180;
            const x = 60 + Math.cos(angle) * 40;
            const y = 60 + Math.sin(angle) * 40;
            clockCtx.beginPath();
            clockCtx.arc(x, y, 3, 0, Math.PI * 2);
            clockCtx.fill();
        }

        // Hour hand (3:34)
        const hourAngle = ((3 % 12) * 30 + 34 * 0.5 - 90) * Math.PI / 180;
        clockCtx.strokeStyle = '#1a2028';
        clockCtx.lineWidth = 5;
        clockCtx.beginPath();
        clockCtx.moveTo(60, 60);
        clockCtx.lineTo(60 + Math.cos(hourAngle) * 25, 60 + Math.sin(hourAngle) * 25);
        clockCtx.stroke();

        // Minute hand (34)
        const minuteAngle = (34 * 6 - 90) * Math.PI / 180;
        clockCtx.lineWidth = 3;
        clockCtx.beginPath();
        clockCtx.moveTo(60, 60);
        clockCtx.lineTo(60 + Math.cos(minuteAngle) * 35, 60 + Math.sin(minuteAngle) * 35);
        clockCtx.stroke();

        // Center dot
        clockCtx.fillStyle = '#1a2028';
        clockCtx.beginPath();
        clockCtx.arc(60, 60, 5, 0, Math.PI * 2);
        clockCtx.fill();

        ctx.drawImage(clockCanvas, LAYOUT.clock.x, LAYOUT.clock.y);

        // Curtain on far right (no mirror)
        ctx.drawImage(Game.assets.curtainClosed, LAYOUT.curtain.x, LAYOUT.curtain.y);

        ctx.restore(); // End flip

        // Mirror outline on LEFT side (outside the flip, so it appears on actual left)
        let glowIntensity = 0.1 + Math.sin(this.mirrorOutlineGlow) * 0.05;

        // Add flash effect when pulling back (after 1 second)
        if (this.flashingBack && this.flashTimer > 1.0) {
            const flashPulse = Math.sin((this.flashTimer - 1.0) * 8) * 0.3 + 0.3;
            glowIntensity += flashPulse;
        }

        ctx.strokeStyle = `rgba(100, 255, 180, ${Math.min(glowIntensity, 0.8)})`;
        ctx.lineWidth = 2 + (this.flashingBack && this.flashTimer > 1.0 ? 2 : 0);
        ctx.beginPath();
        ctx.ellipse(LAYOUT.mirror.x + LAYOUT.mirror.w/2, LAYOUT.mirror.y + LAYOUT.mirror.h/2,
                    LAYOUT.mirror.w/2 - 10, LAYOUT.mirror.h/2 - 10, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Add glow when flashing
        if (this.flashingBack && this.flashTimer > 1.0) {
            ctx.fillStyle = `rgba(100, 255, 180, ${Math.sin((this.flashTimer - 1.0) * 8) * 0.1 + 0.05})`;
            ctx.beginPath();
            ctx.ellipse(LAYOUT.mirror.x + LAYOUT.mirror.w/2, LAYOUT.mirror.y + LAYOUT.mirror.h/2,
                        LAYOUT.mirror.w/2 - 10, LAYOUT.mirror.h/2 - 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Effects
        FX.drawVignette(ctx);
        FX.drawGrain(ctx);

        // Atmospheric text overlay
        if (Game.gameState.atmosphericText) {
            const fadeIn = 0.6;
            const fadeOut = 0.8;
            const timer = Game.gameState.atmosphericTextTimer;
            const duration = Game.gameState.atmosphericTextDuration;

            let alpha = 1;
            if (timer < fadeIn) {
                alpha = timer / fadeIn;
            } else if (timer > duration - fadeOut) {
                alpha = (duration - timer) / fadeOut;
            }

            ctx.save();
            ctx.fillStyle = `rgba(100, 255, 180, ${alpha * 0.9})`;
            ctx.font = 'italic 16px "Courier New"';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(Game.gameState.atmosphericText, BASE_WIDTH / 2, BASE_HEIGHT - 80);
            ctx.restore();
        }
    }
};

// --- SCENE: CAT ATTIC ---
const SceneAttic = {
    cabinetShake: 0,
    portraitRotation: 0,
    moonPulse: 0,
    flashingBack: false,
    flashTimer: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.cabinetShake = 0;
        this.portraitRotation = 0;
        this.moonPulse = 0;
        this.flashingBack = false;
        this.flashTimer = 0;

        // Show atmospheric text
        setTimeout(() => {
            showAtmosphericText('The attic smells of dust and something else. Something watching.', 4.0);
        }, 500);
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Three-eyed cat on chair
        Hotspots.add('attic-cat', 200, 400, 180, 150,
            'Cat', () => this.handleAtticCat());

        // Box of hair on table
        Hotspots.add('hair-box', 500, 480, 120, 100,
            'Box', () => this.handleHairBox());

        // Shaking cabinet
        Hotspots.add('cabinet', 850, 350, 200, 280,
            'Cabinet', () => this.handleCabinet());

        // Portrait with wrong eyes
        Hotspots.add('portrait', 100, 120, 150, 200,
            'Portrait', () => this.handlePortrait());

        // Window with three-eyed moon
        Hotspots.add('window', 950, 80, 200, 180,
            'Window', () => this.handleWindow());
    },

    handleAtticCat() {
        showAtmosphericText('The cat sits perfectly still. Its three eyes follow you. It doesn\'t blink.', 3.5);
        AudioEngine.playMeow();
    },

    handleHairBox() {
        showAtmosphericText('A wooden box. Filled with hair. Different colors. Different lengths. All carefully arranged.', 4.0);
        AudioEngine.playTick();
    },

    handleCabinet() {
        showAtmosphericText('The cabinet trembles. Something inside wants out. You don\'t open it.', 3.5);
        AudioEngine.playWhoosh();
    },

    handlePortrait() {
        showAtmosphericText('A portrait of someone. They have the wrong number of eyes. They blink when you look away.', 4.5);
        AudioEngine.playTick();

        // Flash after 1 second to hint, then pull back after 4 seconds total
        this.flashingBack = true;
        const self = this;
        setTimeout(function() {
            self.returnToRoom();
        }, 4000);
    },

    handleWindow() {
        showAtmosphericText('The moon has three eyes. It sees everything. It always has.', 3.5);
        AudioEngine.playTick();
    },

    returnToRoom() {
        this.incrementLoop();
        SceneManager.changeState(STATES.ROOM);
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);
        this.resetRoomState();
        this.checkFinalEnding();
    },

    resetRoomState() {
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    update(dt) {
        this.cabinetShake += dt;
        this.portraitRotation += dt;
        this.moonPulse += dt;

        if (this.flashingBack) {
            this.flashTimer += dt;
        }

        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);

        // Update atmospheric text timer
        if (Game.gameState.atmosphericText) {
            Game.gameState.atmosphericTextTimer += dt;
            if (Game.gameState.atmosphericTextTimer >= Game.gameState.atmosphericTextDuration) {
                Game.gameState.atmosphericText = null;
            }
        }
    },

    draw(ctx) {
        // Dark attic atmosphere
        const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        bgGradient.addColorStop(0, '#2a2218');
        bgGradient.addColorStop(0.65, '#1a1208');
        bgGradient.addColorStop(1, '#0a0804');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Wooden floor (attic boards)
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(0, BASE_HEIGHT * 0.65, BASE_WIDTH, BASE_HEIGHT * 0.35);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = i % 2 ? '#3a2515' : '#402a19';
            ctx.fillRect(i * 64, BASE_HEIGHT * 0.65, 64, BASE_HEIGHT * 0.35);
        }

        // Window with cracked glass (top right)
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(950, 80, 200, 180);
        ctx.strokeStyle = '#4a3428';
        ctx.lineWidth = 8;
        ctx.strokeRect(950, 80, 200, 180);

        // Window panes
        ctx.strokeStyle = '#2a1810';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(1050, 80);
        ctx.lineTo(1050, 260);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(950, 170);
        ctx.lineTo(1150, 170);
        ctx.stroke();

        // Crack in window
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(980, 100);
        ctx.lineTo(1000, 130);
        ctx.lineTo(990, 160);
        ctx.stroke();

        // Three-eyed moon
        ctx.fillStyle = `rgba(200, 200, 210, ${0.8 + Math.sin(this.moonPulse) * 0.2})`;
        ctx.beginPath();
        ctx.arc(1050, 140, 30, 0, Math.PI * 2);
        ctx.fill();

        // Moon's three eyes
        ctx.fillStyle = '#1a1a1a';
        [[1045, 135], [1055, 135], [1050, 145]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Portrait on wall (left)
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(100, 120, 150, 200);
        ctx.strokeStyle = '#4a3428';
        ctx.lineWidth = 6;
        ctx.strokeRect(100, 120, 150, 200);

        // Portrait face (wrong number of eyes - rotates slightly)
        ctx.save();
        ctx.translate(175, 220);
        ctx.rotate(Math.sin(this.portraitRotation * 0.3) * 0.05);

        ctx.fillStyle = '#d4c5a9';
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();

        // Four eyes arranged in a diamond (blink independently)
        const eyePositions = [[-15, -10], [15, -10], [-15, 10], [15, 10]];
        ctx.fillStyle = '#1a1a1a';
        eyePositions.forEach(([dx, dy], idx) => {
            if (Math.sin(this.portraitRotation * 0.5 + idx) > 0.7) {
                // Blinking
                ctx.fillRect(dx - 3, dy, 6, 2);
            } else {
                ctx.beginPath();
                ctx.arc(dx, dy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();

        // Add flash effect to portrait when pulling back (after 1 second)
        if (this.flashingBack && this.flashTimer > 1.0) {
            ctx.strokeStyle = `rgba(212, 197, 169, ${Math.sin((this.flashTimer - 1.0) * 8) * 0.4 + 0.3})`;
            ctx.lineWidth = 4 + Math.sin((this.flashTimer - 1.0) * 8) * 2;
            ctx.strokeRect(100, 120, 150, 200);

            // Add inner glow
            ctx.fillStyle = `rgba(212, 197, 169, ${Math.sin((this.flashTimer - 1.0) * 8) * 0.1 + 0.05})`;
            ctx.fillRect(100, 120, 150, 200);
        }

        // Shaking cabinet
        const shakeX = 850 + Math.sin(this.cabinetShake * 8) * 3;
        const shakeY = 350 + Math.cos(this.cabinetShake * 12) * 2;

        ctx.fillStyle = '#2a1810';
        ctx.fillRect(shakeX, shakeY, 200, 280);
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3;
        ctx.strokeRect(shakeX, shakeY, 200, 280);

        // Cabinet doors
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 2;
        ctx.strokeRect(shakeX + 10, shakeY + 10, 85, 260);
        ctx.strokeRect(shakeX + 105, shakeY + 10, 85, 260);

        // Cabinet handles
        ctx.fillStyle = '#6b533e';
        ctx.beginPath();
        ctx.arc(shakeX + 70, shakeY + 140, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(shakeX + 130, shakeY + 140, 5, 0, Math.PI * 2);
        ctx.fill();

        // Table with box of hair
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(450, 530, 220, 140);

        // Table legs
        ctx.fillRect(460, 580, 12, 90);
        ctx.fillRect(648, 580, 12, 90);

        // Box on table
        ctx.fillStyle = '#4a3428';
        ctx.fillRect(500, 480, 120, 100);
        ctx.strokeStyle = '#2a1810';
        ctx.lineWidth = 2;
        ctx.strokeRect(500, 480, 120, 100);

        // Hair strands visible from box
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.moveTo(510 + i * 8, 490);
            ctx.lineTo(505 + i * 8, 520 + Math.sin(i) * 10);
            ctx.stroke();
        }

        // Three-eyed cat on chair (foreground)
        // Chair
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(200, 500, 180, 50);
        ctx.fillRect(210, 420, 15, 80);
        ctx.fillRect(355, 420, 15, 80);

        // Cat body (same as before but three eyes)
        ctx.fillStyle = '#0b0b0b';

        // Body
        ctx.beginPath();
        ctx.ellipse(290, 478, 70, 40, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.ellipse(350, 460, 24, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(360, 439);
        ctx.lineTo(370, 455);
        ctx.lineTo(352, 450);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(342, 440);
        ctx.lineTo(350, 452);
        ctx.lineTo(336, 450);
        ctx.closePath();
        ctx.fill();

        // Three glowing eyes (arranged in triangle)
        ctx.fillStyle = '#64ff80';
        [[345, 457], [355, 457], [350, 450]].forEach(p => {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Tail
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0b0b0b';
        ctx.beginPath();
        ctx.moveTo(230, 485);
        ctx.quadraticCurveTo(210, 460, 232, 445);
        ctx.stroke();

        // Effects
        FX.drawVignette(ctx);
        FX.drawGrain(ctx);

        // Atmospheric text overlay
        if (Game.gameState.atmosphericText) {
            const fadeIn = 0.6;
            const fadeOut = 0.8;
            const timer = Game.gameState.atmosphericTextTimer;
            const duration = Game.gameState.atmosphericTextDuration;

            let alpha = 1;
            if (timer < fadeIn) {
                alpha = timer / fadeIn;
            } else if (timer > duration - fadeOut) {
                alpha = (duration - timer) / fadeOut;
            }

            ctx.save();
            ctx.fillStyle = `rgba(212, 197, 169, ${alpha * 0.9})`;
            ctx.font = 'italic 16px "Courier New"';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(Game.gameState.atmosphericText, BASE_WIDTH / 2, BASE_HEIGHT - 80);
            ctx.restore();
        }
    }
};

// --- SCENE: CORRIDOR ---
const SceneCorridor = {
    scrollProgress: 0,
    portraitFeatures: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.scrollProgress = 0;
        this.portraitFeatures = 0;

        // Show atmospheric text
        setTimeout(() => {
            showAtmosphericText('A white corridor stretches endlessly. Portraits watch you walk. They weren\'t watching before.', 5.0);
        }, 500);
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Portraits (2 on left, 2 on right)
        // Left portraits
        Hotspots.add('portrait-0', 80, 180, 120, 180,
            'Portrait', () => this.handlePortrait(0));
        Hotspots.add('portrait-1', 260, 180, 120, 180,
            'Portrait', () => this.handlePortrait(1));

        // Right portraits
        Hotspots.add('portrait-2', 900, 180, 120, 180,
            'Portrait', () => this.handlePortrait(2));
        Hotspots.add('portrait-3', 1080, 180, 120, 180,
            'Portrait', () => this.handlePortrait(3));

        // Window (on top of door)
        Hotspots.add('corridor-window', (BASE_WIDTH / 2) - 100, 80, 200, 140,
            'Window', () => this.handleWindow());

        // Door to bedroom (centered, below window)
        Hotspots.add('bedroom-door', (BASE_WIDTH / 2) - 90, 320, 180, 330,
            'Door', () => this.handleBedroomDoor());
    },

    handlePortrait(index) {
        this.portraitFeatures++;

        const messages = [
            'The portrait is blank. No face. No eyes. Nothing.',
            'A face begins to form. Eyes, nose, mouth. All familiar.',
            'The portrait looks like someone you know. Or knew. Or will know.',
            'The eyes in the portrait blink. They see you seeing them.'
        ];

        const msgIndex = Math.min(this.portraitFeatures, messages.length - 1);
        showAtmosphericText(messages[msgIndex], 3.5);
        AudioEngine.playTick();
    },

    handleWindow() {
        showAtmosphericText('A window. It shows Room 0. But you\'re not there. The room is empty. Waiting.', 4.0);
        AudioEngine.playWhoosh();
    },

    handleBedroomDoor() {
        showAtmosphericText('A door at the end. It feels different. More real. Less dream.', 3.0);
        AudioEngine.playTick();

        // Transition to bedroom after a moment
        setTimeout(() => {
            SceneManager.changeState(STATES.BEDROOM);
        }, 2500);
    },

    update(dt) {
        this.scrollProgress += dt;
        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);

        // Update atmospheric text timer
        if (Game.gameState.atmosphericText) {
            Game.gameState.atmosphericTextTimer += dt;
            if (Game.gameState.atmosphericTextTimer >= Game.gameState.atmosphericTextDuration) {
                Game.gameState.atmosphericText = null;
            }
        }
    },

    draw(ctx) {
        // White corridor
        ctx.fillStyle = '#f5f0e8';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Floor (wooden)
        ctx.fillStyle = '#d4c5a9';
        ctx.fillRect(0, BASE_HEIGHT * 0.65, BASE_WIDTH, BASE_HEIGHT * 0.35);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = i % 2 ? '#d0c0a0' : '#d8caa8';
            ctx.fillRect(i * 64, BASE_HEIGHT * 0.65, 64, BASE_HEIGHT * 0.35);
        }

        // Perspective lines
        ctx.strokeStyle = '#c0b0a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, BASE_HEIGHT * 0.65);
        ctx.lineTo(BASE_WIDTH, BASE_HEIGHT * 0.65);
        ctx.stroke();

        // Doors on both sides (simple rectangles)
        for (let i = 0; i < 6; i++) {
            // Left doors
            ctx.fillStyle = '#8c7a5e';
            ctx.fillRect(20, 250 + i * 120, 80, 150);
            ctx.strokeStyle = '#5a4a38';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 250 + i * 120, 80, 150);

            // Right doors
            ctx.fillRect(BASE_WIDTH - 100, 250 + i * 120, 80, 150);
            ctx.strokeRect(BASE_WIDTH - 100, 250 + i * 120, 80, 150);
        }

        // Portraits (2 on left, 2 on right)
        const portraitPositions = [80, 260, 900, 1080];
        for (let i = 0; i < 4; i++) {
            const x = portraitPositions[i];
            const y = 180;

            // Frame
            ctx.fillStyle = '#2a1810';
            ctx.fillRect(x, y, 120, 180);
            ctx.strokeStyle = '#4a3428';
            ctx.lineWidth = 6;
            ctx.strokeRect(x, y, 120, 180);

            // Portrait content (gets more detailed with portraitFeatures)
            ctx.fillStyle = '#e8dcc0';
            ctx.fillRect(x + 10, y + 10, 100, 160);

            if (this.portraitFeatures > i) {
                // Face appears
                ctx.fillStyle = '#d4c5a9';
                ctx.beginPath();
                ctx.arc(x + 60, y + 80, 30, 0, Math.PI * 2);
                ctx.fill();

                if (this.portraitFeatures > i + 1) {
                    // Eyes appear
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath();
                    ctx.arc(x + 50, y + 75, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x + 70, y + 75, 3, 0, Math.PI * 2);
                    ctx.fill();

                    if (this.portraitFeatures > i + 2) {
                        // Mouth appears
                        ctx.strokeStyle = '#1a1a1a';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(x + 60, y + 90, 10, 0, Math.PI);
                        ctx.stroke();
                    }
                }
            }
        }

        // Window (on top of door, centered)
        const winX = (BASE_WIDTH / 2) - 100;
        const winY = 80;
        ctx.fillStyle = '#1a1410';
        ctx.fillRect(winX, winY, 200, 140);
        ctx.strokeStyle = '#4a3428';
        ctx.lineWidth = 8;
        ctx.strokeRect(winX, winY, 200, 140);

        // Vague silhouette of Room 0 in window
        ctx.fillStyle = 'rgba(61, 50, 38, 0.3)';
        ctx.fillRect(winX + 20, winY + 60, 160, 60);

        // Door (centered, below window)
        const doorX = (BASE_WIDTH / 2) - 90;
        ctx.fillStyle = '#8c7a5e';
        ctx.fillRect(doorX, 320, 180, 330);
        ctx.strokeStyle = '#5a4a38';
        ctx.lineWidth = 4;
        ctx.strokeRect(doorX, 320, 180, 330);

        // Door panels
        ctx.strokeStyle = '#4a3428';
        ctx.lineWidth = 2;
        ctx.strokeRect(doorX + 10, 340, 70, 130);
        ctx.strokeRect(doorX + 10, 490, 70, 130);
        ctx.strokeRect(doorX + 105, 340, 70, 130);
        ctx.strokeRect(doorX + 105, 490, 70, 130);

        // Door handle
        ctx.fillStyle = '#6b533e';
        ctx.beginPath();
        ctx.arc(doorX + 140, 485, 6, 0, Math.PI * 2);
        ctx.fill();

        // Subtle vignette
        FX.drawVignette(ctx);

        // Atmospheric text overlay
        if (Game.gameState.atmosphericText) {
            const fadeIn = 0.6;
            const fadeOut = 0.8;
            const timer = Game.gameState.atmosphericTextTimer;
            const duration = Game.gameState.atmosphericTextDuration;

            let alpha = 1;
            if (timer < fadeIn) {
                alpha = timer / fadeIn;
            } else if (timer > duration - fadeOut) {
                alpha = (duration - timer) / fadeOut;
            }

            ctx.save();
            ctx.fillStyle = `rgba(61, 50, 38, ${alpha * 0.9})`;
            ctx.font = 'italic 16px "Courier New"';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(Game.gameState.atmosphericText, BASE_WIDTH / 2, BASE_HEIGHT - 80);
            ctx.restore();
        }
    }
};

// --- SCENE: BEDROOM ---
const SceneBedroom = {
    clockPulse: 0,
    flashingBack: false,
    flashTimer: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.clockPulse = 0;
        this.flashingBack = false;
        this.flashTimer = 0;

        // Show atmospheric text
        setTimeout(() => {
            showAtmosphericText('A bedroom. Normal. Too normal. The colors are wrong. The dream is fading.', 4.5);
        }, 500);
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Bed (moved higher to not cover subtitles)
        Hotspots.add('bed', 300, 350, 400, 250,
            'Bed', () => this.handleBed());

        // Bedside table with lamp (moved higher)
        Hotspots.add('bedside-table', 750, 420, 120, 140,
            'Lamp', () => this.handleLamp());

        // Wardrobe (moved higher to same height as bed)
        Hotspots.add('wardrobe', 100, 350, 180, 230,
            'Wardrobe', () => this.handleWardrobe());

        // Window with curtains
        Hotspots.add('bedroom-window', 950, 150, 220, 240,
            'Window', () => this.handleBedroomWindow());

        // TV/black mirror
        Hotspots.add('tv', 450, 80, 280, 180,
            'Screen', () => this.handleTV());
    },

    handleBed() {
        showAtmosphericText('The bed looks soft. Inviting. If you lie down, will you wake up? Or will you sleep deeper?', 4.5);
        AudioEngine.playWhoosh();

        // Flash after 1 second to hint, then pull back after 4 seconds total
        this.flashingBack = true;
        const self = this;
        setTimeout(function() {
            self.returnToRoom();
        }, 4000);
    },

    handleLamp() {
        showAtmosphericText('A digital clock on the bedside table. It reads 3:33.', 2.5);
        AudioEngine.playTick();
    },

    handleWardrobe() {
        showAtmosphericText('A wardrobe. Closed. You don\'t want to see what clothes are inside.', 3.0);
        AudioEngine.playTick();
    },

    handleBedroomWindow() {
        showAtmosphericText('Bland curtains. Outside is... nothing. Just gray. The world hasn\'t loaded yet.', 3.5);
        AudioEngine.playWhoosh();
    },

    handleTV() {
        showAtmosphericText('A black screen. Your silhouette reflects back. Behind you, Room 0. Always Room 0.', 4.0);
        AudioEngine.playTick();
    },

    returnToRoom() {
        this.incrementLoop();
        SceneManager.changeState(STATES.ROOM);
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);
        this.resetRoomState();
        this.checkFinalEnding();
    },

    resetRoomState() {
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    update(dt) {
        this.clockPulse += dt;

        if (this.flashingBack) {
            this.flashTimer += dt;
        }

        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);

        // Update atmospheric text timer
        if (Game.gameState.atmosphericText) {
            Game.gameState.atmosphericTextTimer += dt;
            if (Game.gameState.atmosphericTextTimer >= Game.gameState.atmosphericTextDuration) {
                Game.gameState.atmosphericText = null;
            }
        }
    },

    draw(ctx) {
        // Less sepia, more natural bedroom colors
        const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        bgGradient.addColorStop(0, '#8a9aa8');
        bgGradient.addColorStop(0.65, '#7a8a98');
        bgGradient.addColorStop(1, '#6a7a88');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Floor (carpet)
        ctx.fillStyle = '#9a8a7a';
        ctx.fillRect(0, BASE_HEIGHT * 0.7, BASE_WIDTH, BASE_HEIGHT * 0.3);

        // Wardrobe (at same height as bed to not cover subtitles)
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(100, 350, 180, 230);
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 4;
        ctx.strokeRect(100, 350, 180, 230);

        // Wardrobe doors
        ctx.strokeStyle = '#2a1a0a';
        ctx.lineWidth = 2;
        ctx.strokeRect(110, 365, 75, 200);
        ctx.strokeRect(195, 365, 75, 200);

        // Window with curtains
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(950, 150, 220, 240);
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = 6;
        ctx.strokeRect(950, 150, 220, 240);

        // Gray outside (nothing loaded)
        ctx.fillStyle = '#888888';
        ctx.fillRect(960, 160, 200, 220);

        // Curtains (bland beige)
        ctx.fillStyle = '#c8b8a8';
        ctx.fillRect(940, 140, 40, 260);
        ctx.fillRect(1180, 140, 40, 260);

        // TV / Black mirror surface
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(450, 80, 280, 180);
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 8;
        ctx.strokeRect(450, 80, 280, 180);

        // Vague reflection of Room 0 in TV
        ctx.fillStyle = 'rgba(61, 50, 38, 0.15)';
        ctx.fillRect(470, 100, 240, 140);

        // Bed (large, inviting) - moved higher to not cover subtitles
        ctx.fillStyle = '#e8d8c8';
        ctx.fillRect(300, 350, 400, 250);
        ctx.fillStyle = '#d8c8b8';
        ctx.fillRect(300, 350, 400, 80); // Pillow area

        // Bed frame
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(290, 580, 420, 20);

        // Add flash effect to bed when pulling back (after 1 second)
        if (this.flashingBack && this.flashTimer > 1.0) {
            ctx.strokeStyle = `rgba(232, 216, 200, ${Math.sin((this.flashTimer - 1.0) * 8) * 0.4 + 0.3})`;
            ctx.lineWidth = 4 + Math.sin((this.flashTimer - 1.0) * 8) * 2;
            ctx.strokeRect(300, 350, 400, 250);

            // Add inner glow
            ctx.fillStyle = `rgba(232, 216, 200, ${Math.sin((this.flashTimer - 1.0) * 8) * 0.1 + 0.05})`;
            ctx.fillRect(300, 350, 400, 250);
        }

        // Bedside table (at same height as bed to not cover subtitles)
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(750, 420, 120, 140);

        // Table legs
        ctx.fillRect(760, 540, 12, 60);
        ctx.fillRect(848, 540, 12, 60);

        // Lamp on table
        ctx.fillStyle = '#8a7a6a';
        ctx.fillRect(785, 390, 50, 30);
        ctx.fillStyle = '#ffeaa0';
        ctx.beginPath();
        ctx.arc(810, 380, 12, 0, Math.PI * 2);
        ctx.fill();

        // Digital clock on table (3:33)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(770, 450, 80, 30);
        ctx.fillStyle = `rgba(255, 50, 50, ${0.8 + Math.sin(this.clockPulse * 2) * 0.2})`;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('3:33', 810, 470);

        // Lighter vignette
        const gradient = ctx.createRadialGradient(
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.3,
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Atmospheric text overlay
        if (Game.gameState.atmosphericText) {
            const fadeIn = 0.6;
            const fadeOut = 0.8;
            const timer = Game.gameState.atmosphericTextTimer;
            const duration = Game.gameState.atmosphericTextDuration;

            let alpha = 1;
            if (timer < fadeIn) {
                alpha = timer / fadeIn;
            } else if (timer > duration - fadeOut) {
                alpha = (duration - timer) / fadeOut;
            }

            ctx.save();
            ctx.fillStyle = `rgba(40, 40, 40, ${alpha * 0.9})`;
            ctx.font = 'italic 16px "Courier New"';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(Game.gameState.atmosphericText, BASE_WIDTH / 2, BASE_HEIGHT - 80);
            ctx.restore();
        }
    }
};

// --- ENDING SCENES ---
const SceneEndingMirrorA = {
    timer: 0,
    phase: 'zoom',
    zoomScale: 1,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'zoom';
        this.zoomScale = 1;
        AudioEngine.playWhoosh();
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'zoom') {
            this.zoomScale += dt * 2;
            if (this.timer > 2.0) {
                this.phase = 'reveal';
                this.timer = 0;
            }
        } else if (this.phase === 'reveal') {
            if (this.timer > 1.0) {
                this.phase = 'caption';
                this.showEnding();
            }
        }
    },

    draw(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        if (this.phase === 'zoom') {
            ctx.save();
            ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
            ctx.scale(this.zoomScale, this.zoomScale);
            ctx.translate(-200, -310);
            ctx.drawImage(Game.assets.mirror, 0, 0);
            ctx.restore();
        } else if (this.phase === 'reveal') {
            // Glitched room
            ctx.save();
            ctx.translate(8 * Math.sin(this.timer * 30), 0);
            SceneRoom.draw(ctx);
            ctx.restore();
        }

        FX.blackFade(ctx, 0.4);
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                You press your palm to the glass and step through—<br><br>
                Into another you, in another dream.<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Enter</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            SceneManager.changeState(STATES.MIRROR_WORLD);
        };
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);

        // Reset room state for new loop
        this.resetRoomState();

        this.checkFinalEnding();
    },

    resetRoomState() {
        // Reset room interactions but keep progression
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;

        // Clear inventory
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();

        // Regenerate assets to reset states
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            // All endings seen - trigger final
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneEndingMirrorB = {
    timer: 0,
    phase: 'fade',
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'fade';
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'fade' && this.timer > 2.0) {
            this.phase = 'caption';
            this.showEnding();
        }
    },

    draw(ctx) {
        SceneRoom.draw(ctx);
        FX.blackFade(ctx, Math.min(this.timer / 2.0, 0.7));
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                You close your eyes before the mirror.<br><br>
                Darkness. Peace. Then—<br>
                You open them. The clock still reads 3:33.<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Wake</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            this.incrementLoop();
            SceneManager.changeState(STATES.ROOM);
        };
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);

        // Reset room state for new loop
        this.resetRoomState();

        this.checkFinalEnding();
    },

    resetRoomState() {
        // Reset room interactions but keep progression
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;

        // Clear inventory
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();

        // Regenerate assets to reset states
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            // All endings seen - trigger final
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneEndingCatA = {
    timer: 0,
    phase: 'lunge',
    catScale: 1,
    flashCount: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'lunge';
        this.catScale = 1;
        this.flashCount = 0;
        AudioEngine.playMeow();
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'lunge') {
            this.catScale = 1 + this.easeOutQuad(Math.min(this.timer / 0.6, 1)) * 10;
            if (this.timer > 0.6) {
                this.phase = 'flash';
                this.timer = 0;
            }
        } else if (this.phase === 'flash') {
            if (this.timer > 0.15) {
                this.flashCount++;
                this.timer = 0;
                if (this.flashCount > 4) {
                    this.phase = 'caption';
                    this.showEnding();
                }
            }
        }
    },

    draw(ctx) {
        if (this.phase === 'flash' && this.flashCount % 2 === 1) {
            ctx.fillStyle = '#4a0000';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else if (this.phase === 'lunge') {
            SceneRoom.draw(ctx);

            ctx.save();
            ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
            ctx.scale(this.catScale, this.catScale);
            ctx.translate(-1050, -545);
            ctx.drawImage(Game.assets.catAwake, 980, 500);
            ctx.restore();
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        }
    },

    easeOutQuad(t) {
        return t * (2 - t);
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                Three glowing eyes lock onto yours.<br><br>
                The cat lunges. Three scratches bloom across your face.<br>
                Pain floods through you—<br><br>
                You wake. Or do you?<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Wake</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            SceneManager.changeState(STATES.ATTIC);
        };
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneEndingCatB = {
    timer: 0,
    phase: 'warmth',
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'warmth';
        AudioEngine.playMatchStrike();
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'warmth' && this.timer > 2.5) {
            this.phase = 'caption';
            this.showEnding();
        }
    },

    draw(ctx) {
        SceneRoom.draw(ctx);

        // Warm glow
        const intensity = 0.3 + Math.sin(this.timer * 3) * 0.1;
        const gradient = ctx.createRadialGradient(900, 600, 50, 900, 600, 300);
        gradient.addColorStop(0, `rgba(255, 140, 0, ${intensity})`);
        gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                You offer the flame. The cat's three eyes soften.<br><br>
                Warmth passes between you. Understanding.<br>
                The creature curls beside you, purring.<br><br>
                For a moment, the dream is peaceful.<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Wake</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            this.incrementLoop();
            SceneManager.changeState(STATES.ROOM);
        };
    },

    incrementLoop() {
        Game.gameState.loopCount++;
        const [hours, minutes] = Game.gameState.clockTime.split(':').map(Number);
        const newMinutes = minutes + 1;
        Game.gameState.clockTime = `${hours}:${newMinutes.toString().padStart(2, '0')}`;
        Game.assets.clock = Assets.generateClock(Game.gameState.clockTime);

        // Reset room state for new loop
        this.resetRoomState();

        this.checkFinalEnding();
    },

    resetRoomState() {
        // Reset room interactions but keep progression
        Game.gameState.mirrorCracked = true;
        Game.gameState.mirrorRepaired = false;
        Game.gameState.curtainPulled = false;
        Game.gameState.drawerOpen = false;
        Game.gameState.catAwake = false;
        Game.gameState.catFed = false;
        Game.gameState.bowlWarmed = false;
        Game.gameState.doorLit = false;
        Game.gameState.bloodDropped = false;
        Game.gameState.atmosphericText = null;
        Game.gameState.atmosphericTextTimer = 0;

        // Clear inventory
        Game.inventory.items = [];
        Game.inventory.selectedItem = null;
        Inventory.render();

        // Regenerate assets to reset states
        Assets.load();
    },

    checkFinalEnding() {
        if (Game.gameState.completedEndings.size >= 3) {
            // All endings seen - trigger final
            setTimeout(() => {
                SceneManager.changeState(STATES.FINAL_ENDING);
            }, 1000);
        }
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneEndingDoorA = {
    timer: 0,
    phase: 'flood',
    floodWidth: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'flood';
        this.floodWidth = 0;
        AudioEngine.playWhoosh();
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'flood') {
            this.floodWidth = this.easeOutCubic(Math.min(this.timer / 1.8, 1)) * BASE_WIDTH;
            if (this.timer > 1.8) {
                this.phase = 'white';
                this.timer = 0;
            }
        } else if (this.phase === 'white' && this.timer > 1.0) {
            this.phase = 'caption';
            this.showEnding();
        }
    },

    draw(ctx) {
        if (this.phase === 'white') {
            ctx.fillStyle = '#fffaf0';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else {
            SceneRoom.draw(ctx);

            if (this.phase === 'flood') {
                const gradient = ctx.createLinearGradient(BASE_WIDTH - this.floodWidth, 0, BASE_WIDTH, 0);
                gradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
                gradient.addColorStop(1, 'rgba(255, 250, 240, 1)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
            }
        }
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                You push through the door, eager for escape—<br><br>
                Into another place.<br>
                Familiar. Wrong.<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Continue</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            SceneManager.changeState(STATES.CORRIDOR);
        };
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneEndingDoorB = {
    timer: 0,
    phase: 'flood',
    floodWidth: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'flood';
        this.floodWidth = 0;
        AudioEngine.playWhoosh();
        AudioEngine.stopDrone();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'flood') {
            this.floodWidth = this.easeOutCubic(Math.min(this.timer / 2.5, 1)) * BASE_WIDTH;
            if (this.timer > 2.5) {
                this.phase = 'white';
                this.timer = 0;
            }
        } else if (this.phase === 'white') {
            if (this.timer > 1.2) {
                this.phase = 'fade';
                this.timer = 0;
            }
        } else if (this.phase === 'fade') {
            if (this.timer > 1.5) {
                this.phase = 'caption';
                this.showEnding();
            }
        }
    },

    draw(ctx) {
        if (this.phase === 'white') {
            ctx.fillStyle = '#fffaf0';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else if (this.phase === 'fade') {
            const grayness = 255 - (this.timer / 1.5) * 155;
            ctx.fillStyle = `rgb(${grayness}, ${grayness - 10}, ${grayness - 20})`;
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else {
            SceneRoom.draw(ctx);

            if (this.phase === 'flood') {
                const gradient = ctx.createLinearGradient(BASE_WIDTH - this.floodWidth, 0, BASE_WIDTH, 0);
                gradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
                gradient.addColorStop(1, 'rgba(255, 250, 240, 1)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
            }
        }
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        const endingNum = Game.gameState.completedEndings.size;
        const totalNeeded = 3;
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">
                You wait at the door.<br>
                Patient. Still.<br><br>
                The darkness beyond the gap watches back.<br>
                Time stretches.<br><br>
                When you finally step through—<br>
                You're already somewhere else.<br><br>
                <span style="font-size: 14px; opacity: 0.7;">Path ${endingNum} of ${totalNeeded} discovered</span>
            </div>
            <button class="try-again-btn" id="ending-return">Wake</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-return').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            SceneEndingMirrorA.prototype.incrementLoop.call(this);
            SceneManager.changeState(STATES.ROOM);
        };
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

const SceneFinalEnding = {
    timer: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        AudioEngine.stopDrone();
        setTimeout(() => this.showEnding(), 1500);
    },

    update(dt) {
        this.timer += dt;
    },

    draw(ctx) {
        // Dark room, mirror reflection smiles
        SceneRoom.draw(ctx);

        // Very dark overlay
        FX.blackFade(ctx, 0.85);

        // Eyes in the mirror glow
        const pulse = 0.5 + Math.sin(this.timer * 2) * 0.3;
        ctx.fillStyle = `rgba(100, 255, 180, ${pulse})`;
        ctx.beginPath();
        ctx.arc(180, 280, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(220, 280, 4, 0, Math.PI * 2);
        ctx.fill();
    },

    showEnding() {
        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';
        this.endingOverlay.innerHTML = `
            <div class="ending-caption" style="font-size: 18px; line-height: 2;">
                Three paths walked.<br>
                Mirror. Cat. Door.<br><br>
                Each one brought you back to 3:33.<br>
                Each awakening another layer of sleep.<br><br>
                But now you understand—<br><br>
                The room wasn't trapping you.<br>
                <span style="font-size: 20px; opacity: 0.9;">You were always the room.</span><br><br>
                The dreamer. The dream. The door between.<br><br>
                <span style="font-size: 16px; opacity: 0.7; font-style: normal;">Perhaps now you can truly wake.</span>
            </div>
            <button class="try-again-btn" id="ending-restart">Begin Again</button>
        `;
        document.getElementById('game-container').appendChild(this.endingOverlay);

        document.getElementById('ending-restart').onclick = () => {
            this.endingOverlay.remove();
            this.endingOverlay = null;
            // Reset game
            Game.gameState = {
                loopCount: 0,
                clockTime: '3:33',
                completedEndings: new Set(),
                mirrorCracked: true,
                mirrorRepaired: false,
                curtainPulled: false,
                drawerOpen: false,
                catAwake: false,
                catFed: false,
                bowlWarmed: false,
                doorLit: false,
                bloodDropped: false,
                noteRead: false
            };
            Game.inventory.items = [];
            Game.inventory.selectedItem = null;
            Inventory.render();
            Assets.load();
            SceneManager.changeState(STATES.INTRO);
        };
    },

    exit() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
        }
    }
};

// --- SCENE MANAGER ---
const SceneManager = {
    scenes: {
        [STATES.INTRO]: SceneIntro,
        [STATES.ROOM]: SceneRoom,
        [STATES.MIRROR_WORLD]: SceneMirrorWorld,
        [STATES.ATTIC]: SceneAttic,
        [STATES.CORRIDOR]: SceneCorridor,
        [STATES.BEDROOM]: SceneBedroom,
        [STATES.ENDING_MIRROR_A]: SceneEndingMirrorA,
        [STATES.ENDING_MIRROR_B]: SceneEndingMirrorB,
        [STATES.ENDING_CAT_A]: SceneEndingCatA,
        [STATES.ENDING_CAT_B]: SceneEndingCatB,
        [STATES.ENDING_DOOR_A]: SceneEndingDoorA,
        [STATES.ENDING_DOOR_B]: SceneEndingDoorB,
        [STATES.FINAL_ENDING]: SceneFinalEnding
    },

    changeState(newState) {
        if (Game.currentState && this.scenes[Game.currentState].exit) {
            this.scenes[Game.currentState].exit();
        }

        Game.currentState = newState;
        if (this.scenes[newState].enter) {
            this.scenes[newState].enter();
        }
    },

    update(dt) {
        if (Game.currentState && this.scenes[Game.currentState].update) {
            this.scenes[Game.currentState].update(dt);
        }
    },

    draw(ctx) {
        if (Game.currentState && this.scenes[Game.currentState].draw) {
            this.scenes[Game.currentState].draw(ctx);
        }
    }
};

// --- INPUT ---
function setupInput() {
    const canvas = Game.canvas;

    function updateMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        Game.mouse.x = e.clientX - rect.left;
        Game.mouse.y = e.clientY - rect.top;
        Game.mouse.worldX = (Game.mouse.x - Game.offsetX) / Game.scale;
        Game.mouse.worldY = (Game.mouse.y - Game.offsetY) / Game.scale;
    }

    canvas.addEventListener('mousemove', (e) => {
        updateMousePos(e);
    });

    canvas.addEventListener('mousedown', (e) => {
        updateMousePos(e);
        Game.mouse.down = true;
        startHold();
        Hotspots.click(Game.mouse.worldX, Game.mouse.worldY);
    });

    canvas.addEventListener('mouseup', () => {
        Game.mouse.down = false;
        const held = endHold();

        // Mirror long-press to step through (no words)
        if (Hotspots.hoveredId === 'mirror' && Game.gameState.mirrorRepaired && held > HOLD.mirror) {
            Game.gameState.completedEndings.add('mirror_a');
            SceneManager.changeState(STATES.ENDING_MIRROR_A);
        }

        // Door long-press to "wait with it" ending
        if (Hotspots.hoveredId === 'door' && Game.gameState.doorLit && held > HOLD.door) {
            Game.gameState.completedEndings.add('door_b');
            SceneManager.changeState(STATES.ENDING_DOOR_B);
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        Game.mouse.x = touch.clientX - rect.left;
        Game.mouse.y = touch.clientY - rect.top;
        Game.mouse.worldX = (Game.mouse.x - Game.offsetX) / Game.scale;
        Game.mouse.worldY = (Game.mouse.y - Game.offsetY) / Game.scale;
        Hotspots.click(Game.mouse.worldX, Game.mouse.worldY);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        Game.mouse.x = touch.clientX - rect.left;
        Game.mouse.y = touch.clientY - rect.top;
        Game.mouse.worldX = (Game.mouse.x - Game.offsetX) / Game.scale;
        Game.mouse.worldY = (Game.mouse.y - Game.offsetY) / Game.scale;
    });

    document.getElementById('sound-toggle').addEventListener('click', () => {
        AudioEngine.toggleSound();
    });
}

// --- RESIZE ---
function resize() {
    const container = document.getElementById('game-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth, displayHeight;

    if (containerAspect > ASPECT_RATIO) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * ASPECT_RATIO;
    } else {
        displayWidth = containerWidth;
        displayHeight = displayWidth / ASPECT_RATIO;
    }

    Game.canvas.style.width = displayWidth + 'px';
    Game.canvas.style.height = displayHeight + 'px';

    Game.scale = displayWidth / BASE_WIDTH;
    Game.offsetX = (containerWidth - displayWidth) / 2;
    Game.offsetY = (containerHeight - displayHeight) / 2;
}

// --- GAME LOOP ---
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - Game.lastTime) / 1000, 0.1);
    Game.lastTime = timestamp;
    Game.time += dt;

    SceneManager.update(dt);

    Game.ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    SceneManager.draw(Game.ctx);

    requestAnimationFrame(gameLoop);
}

// --- INIT ---
function init() {
    Game.canvas = document.getElementById('game-canvas');
    Game.canvas.width = BASE_WIDTH;
    Game.canvas.height = BASE_HEIGHT;
    Game.ctx = Game.canvas.getContext('2d');

    // Add clock time display to HTML
    const clockDisplay = document.createElement('div');
    clockDisplay.id = 'clock-time';
    clockDisplay.textContent = Game.gameState.clockTime;
    document.getElementById('game-container').appendChild(clockDisplay);

    AudioEngine.init();
    FX.initGrain();
    Assets.load();
    Inventory.setupEvents();
    Inventory.render();

    setupInput();

    window.addEventListener('resize', resize);
    resize();

    SceneManager.changeState(STATES.INTRO);
    Game.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
