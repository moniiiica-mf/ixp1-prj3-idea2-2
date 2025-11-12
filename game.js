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
        drawerOpened: false,
        catAwake: false,
        catFed: false,
        bowlWarmed: false,
        doorLit: false,
        bloodDropped: false,
        noteRead: false
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
                    if (Game.inventory.selectedItem === itemId) {
                        this.deselect();
                    } else {
                        this.select(itemId);
                    }
                }
            });
        });
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
        canvas.width = pulled ? 80 : 150;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2d1f15';

        if (pulled) {
            // Pulled to side
            ctx.fillRect(0, 0, 80, 450);
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#2d1f15' : '#1d0f05';
                ctx.fillRect(i * 16, 0, 16, 450);
            }
        } else {
            // Hanging with folds
            for (let i = 0; i < 10; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#2d1f15' : '#1d0f05';
                ctx.fillRect(i * 15, 0, 15, 450);
            }
        }

        return canvas;
    },

    generateTable() {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');

        // Table top
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(0, 0, 200, 30);
        ctx.strokeStyle = '#2a1810';
        ctx.strokeRect(0, 0, 200, 30);

        // Drawer
        ctx.fillStyle = '#2d1f15';
        ctx.fillRect(40, 40, 120, 50);
        ctx.strokeStyle = '#1a1008';
        ctx.strokeRect(40, 40, 120, 50);

        // Drawer handle
        ctx.fillStyle = '#4a3428';
        ctx.fillRect(90, 60, 20, 8);

        // Table legs
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(20, 100, 15, 50);
        ctx.fillRect(165, 100, 15, 50);

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
        canvas.width = 140;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');

        // Cat body (curled)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(70, 55, 50, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(95, 40, 22, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(80, 25);
        ctx.lineTo(85, 10);
        ctx.lineTo(90, 28);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(100, 25);
        ctx.lineTo(105, 10);
        ctx.lineTo(110, 28);
        ctx.fill();

        // Eyes
        if (awake) {
            ctx.fillStyle = '#64ff80';
            // Three eyes
            ctx.beginPath();
            ctx.arc(88, 38, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(96, 35, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(104, 38, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tail
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(30, 50);
        ctx.quadraticCurveTo(20, 30, 35, 25);
        ctx.lineWidth = 8;
        ctx.stroke();

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

        // Door panels
        ctx.fillStyle = '#2d1f15';
        ctx.fillRect(15, 15, 190, 370);

        // Panel details
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = 3;
        ctx.strokeRect(30, 30, 160, 150);
        ctx.strokeRect(30, 200, 160, 150);

        // Door knob
        ctx.fillStyle = '#4a3428';
        ctx.beginPath();
        ctx.arc(175, 220, 10, 0, Math.PI * 2);
        ctx.fill();

        // Light from bottom
        const gradient = ctx.createLinearGradient(110, 400, 110, 300);
        gradient.addColorStop(0, `rgba(255, 220, 150, ${lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(20, 300, 180, 100);

        // Light from crack
        if (lightIntensity > 0.4) {
            ctx.fillStyle = `rgba(255, 240, 200, ${lightIntensity * 0.8})`;
            ctx.fillRect(107, 50, 6, 300);
        }

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
        Game.assets.table = this.generateTable();
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
        ctx.font = 'italic 20px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('Your eyes open.', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 15);
        ctx.fillText('The room opens back.', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 15);
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
};

// --- SCENE: ROOM ---
const SceneRoom = {
    doorLightPulse: 0,

    enter() {
        this.setupHotspots();
        AudioEngine.startDrone();
        this.doorLightPulse = 0;

        // Update clock display
        const clockDisplay = document.getElementById('clock-time');
        if (clockDisplay) {
            clockDisplay.textContent = Game.gameState.clockTime;
        }
    },

    exit() {
        Hotspots.clear();
    },

    setupHotspots() {
        Hotspots.clear();

        // Mirror
        Hotspots.add('mirror', 60, 120, 280, 380,
            Game.gameState.mirrorRepaired ? 'Touch mirror' : 'Look at mirror',
            () => this.handleMirror(),
            true
        );

        // Curtain
        if (!Game.gameState.curtainPulled) {
            Hotspots.add('curtain', 10, 100, 150, 450, 'Pull curtain', () => this.handleCurtain());
        }

        // Table drawer
        Hotspots.add('drawer', 400, 540, 200, 100,
            Game.gameState.drawerOpened ? 'Open drawer' : 'Open drawer',
            () => this.handleDrawer()
        );

        // Bowl
        Hotspots.add('bowl', 850, 580, 100, 60, 'Examine bowl', () => this.handleBowl(), true);

        // Cat
        Hotspots.add('cat', 980, 500, 140, 90,
            Game.gameState.catAwake ? 'Call cat' : 'Watch cat',
            () => this.handleCat(),
            true
        );

        // Door
        Hotspots.add('door', 1030, 180, 220, 400, 'Approach door', () => this.handleDoor(), true);
    },

    handleMirror() {
        if (Game.inventory.selectedItem === ITEMS.MIRROR_SHARD && !Game.gameState.mirrorRepaired) {
            // Repair mirror with shard
            Game.gameState.mirrorRepaired = true;
            Game.assets.mirror = Assets.generateMirror(false);
            AudioEngine.playWhoosh();
            Inventory.deselect();

            // Check if can step through
            setTimeout(() => {
                this.setupHotspots();
            }, 500);
        } else if (Game.gameState.mirrorRepaired) {
            // Can step through or close eyes
            this.showMirrorChoice();
        }
    },

    showMirrorChoice() {
        // Show choice overlay
        const overlay = document.createElement('div');
        overlay.className = 'ending-overlay';
        overlay.innerHTML = `
            <div class="ending-caption">The mirror ripples like water. You can see another version of the room beyond it.</div>
            <button class="try-again-btn" id="mirror-through">Step through</button>
            <button class="try-again-btn" id="mirror-stay" style="margin-left: 20px;">Close your eyes</button>
        `;
        document.getElementById('game-container').appendChild(overlay);

        document.getElementById('mirror-through').onclick = () => {
            overlay.remove();
            Game.gameState.completedEndings.add('mirror_a');
            SceneManager.changeState(STATES.ENDING_MIRROR_A);
        };

        document.getElementById('mirror-stay').onclick = () => {
            overlay.remove();
            Game.gameState.completedEndings.add('mirror_b');
            SceneManager.changeState(STATES.ENDING_MIRROR_B);
        };
    },

    handleCurtain() {
        Game.gameState.curtainPulled = true;
        AudioEngine.playWhoosh();

        // Find shard
        if (!Inventory.has(ITEMS.MIRROR_SHARD)) {
            Inventory.add(ITEMS.MIRROR_SHARD);

            // Show message
            const msg = document.createElement('div');
            msg.className = 'caption-text';
            msg.textContent = 'A sharp mirror shard. It cuts your hand.';
            msg.style.opacity = '0';
            document.getElementById('game-container').appendChild(msg);

            setTimeout(() => {
                msg.style.transition = 'opacity 0.5s';
                msg.style.opacity = '1';
                setTimeout(() => {
                    msg.style.opacity = '0';
                    setTimeout(() => msg.remove(), 500);
                }, 2000);
            }, 100);
        }

        this.setupHotspots();
    },

    handleDrawer() {
        if (!Game.gameState.drawerOpened) {
            Game.gameState.drawerOpened = true;
            AudioEngine.playWhoosh();

            // Add matchbox and note
            if (!Inventory.has(ITEMS.MATCHBOX)) {
                Inventory.add(ITEMS.MATCHBOX);
            }
            if (!Inventory.has(ITEMS.NOTE)) {
                Inventory.add(ITEMS.NOTE);
            }
        } else if (Game.inventory.selectedItem === ITEMS.NOTE) {
            // Read note
            this.showNote();
        }
    },

    showNote() {
        const overlay = document.createElement('div');
        overlay.className = 'ending-overlay';
        overlay.innerHTML = `
            <div class="ending-caption" style="font-size: 14px; line-height: 2;">
                <div style="background: #e8dcc0; color: #2a1810; padding: 40px; border: 2px solid #8c7a5e; max-width: 400px;">
                    Some hungers can only be calmed by warmth.<br><br>
                    Keys are made of light.<br>
                    But doors don't always open outward.
                </div>
            </div>
            <button class="try-again-btn" id="close-note">Close</button>
        `;
        document.getElementById('game-container').appendChild(overlay);

        document.getElementById('close-note').onclick = () => {
            overlay.remove();
        };

        Game.gameState.noteRead = true;
    },

    handleBowl() {
        const selectedItem = Game.inventory.selectedItem;

        if (selectedItem === ITEMS.MIRROR_SHARD && !Game.gameState.bloodDropped) {
            // Drop blood in bowl
            Game.gameState.bloodDropped = true;
            AudioEngine.playWhoosh();
            Inventory.render(); // Update shard appearance

            const msg = document.createElement('div');
            msg.className = 'caption-text';
            msg.textContent = 'A single drop of blood falls into the bowl.';
            msg.style.opacity = '0';
            document.getElementById('game-container').appendChild(msg);

            setTimeout(() => {
                msg.style.transition = 'opacity 0.5s';
                msg.style.opacity = '1';
                setTimeout(() => {
                    msg.style.opacity = '0';
                    setTimeout(() => msg.remove(), 500);
                }, 2000);
            }, 100);

            Inventory.deselect();
        } else if (selectedItem === ITEMS.MATCHBOX && !Game.gameState.bowlWarmed) {
            // Strike match near bowl
            Game.gameState.bowlWarmed = true;
            Game.assets.bowl = Assets.generateBowl(true);
            AudioEngine.playMatchStrike();

            // Convert to lit match
            Inventory.remove(ITEMS.MATCHBOX);
            Inventory.add(ITEMS.LIT_MATCH);
            Inventory.deselect();
        }
    },

    handleCat() {
        if (!Game.gameState.catAwake && Game.gameState.bowlWarmed) {
            // Wake cat
            Game.gameState.catAwake = true;
            AudioEngine.playMeow();
            this.setupHotspots();
        } else if (Game.gameState.catAwake) {
            // Cat interaction
            this.showCatChoice();
        }
    },

    showCatChoice() {
        const overlay = document.createElement('div');
        overlay.className = 'ending-overlay';
        overlay.innerHTML = `
            <div class="ending-caption">The cat's three eyes fix on you. It begins to move.</div>
            <button class="try-again-btn" id="cat-call">Call it closer</button>
            <button class="try-again-btn" id="cat-warmth" style="margin-left: 20px;">Light another match</button>
        `;
        document.getElementById('game-container').appendChild(overlay);

        document.getElementById('cat-call').onclick = () => {
            overlay.remove();
            Game.gameState.completedEndings.add('cat_a');
            SceneManager.changeState(STATES.ENDING_CAT_A);
        };

        document.getElementById('cat-warmth').onclick = () => {
            overlay.remove();
            Game.gameState.completedEndings.add('cat_b');
            SceneManager.changeState(STATES.ENDING_CAT_B);
        };
    },

    handleDoor() {
        const selectedItem = Game.inventory.selectedItem;

        if (selectedItem === ITEMS.LIT_MATCH && !Game.gameState.doorLit) {
            // Light the door seam
            Game.gameState.doorLit = true;
            AudioEngine.playTick();
            Game.assets.door = Assets.generateDoor(0.7);
            Inventory.deselect();

            setTimeout(() => {
                this.setupHotspots();
            }, 500);
        } else if (Game.gameState.doorLit) {
            // Can open door
            this.showDoorChoice();
        }
    },

    showDoorChoice() {
        AudioEngine.playTick();

        const overlay = document.createElement('div');
        overlay.className = 'ending-overlay';
        overlay.innerHTML = `
            <div class="ending-caption">The door handle feels warm. Light seeps through the growing crack.</div>
            <button class="try-again-btn" id="door-open">Open now</button>
            <button class="try-again-btn" id="door-wait" style="margin-left: 20px;">Wait for the tick</button>
        `;
        document.getElementById('game-container').appendChild(overlay);

        document.getElementById('door-open').onclick = () => {
            overlay.remove();
            Game.gameState.completedEndings.add('door_a');
            SceneManager.changeState(STATES.ENDING_DOOR_A);
        };

        document.getElementById('door-wait').onclick = () => {
            overlay.remove();
            // Wait for tick
            setTimeout(() => {
                AudioEngine.playTick();
                Game.gameState.completedEndings.add('door_b');
                SceneManager.changeState(STATES.ENDING_DOOR_B);
            }, 1000);
        };
    },

    update(dt) {
        this.doorLightPulse += dt;
        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);
    },

    draw(ctx) {
        // Background (brighter)
        const bgGradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        bgGradient.addColorStop(0, '#4a3d32');
        bgGradient.addColorStop(0.65, '#3a2d22');
        bgGradient.addColorStop(1, '#2a1d12');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Floor (brighter)
        ctx.fillStyle = '#2d2318';
        ctx.fillRect(0, BASE_HEIGHT * 0.7, BASE_WIDTH, BASE_HEIGHT * 0.3);

        // Wall texture (cracks)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 15; i++) {
            const x = Math.sin(i * 123.45) * 400 + 640;
            const y = Math.sin(i * 234.56) * 200 + 300;
            const length = 30 + Math.sin(i * 345.67) * 50;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.sin(i) * 15, y + length);
            ctx.stroke();
        }

        // Curtain
        const curtain = Game.gameState.curtainPulled ? Game.assets.curtainOpen : Game.assets.curtainClosed;
        ctx.drawImage(curtain, 10, 100);

        // Mirror
        ctx.drawImage(Game.assets.mirror, 60, 120);

        // Table
        ctx.drawImage(Game.assets.table, 400, 520);

        // Bowl
        const bowl = Game.gameState.bowlWarmed ? Game.assets.bowlWarmed : Game.assets.bowl;
        ctx.drawImage(bowl, 850, 580);

        // Cat
        const cat = Game.gameState.catAwake ? Game.assets.catAwake : Game.assets.catSleeping;
        ctx.drawImage(cat, 980, 500);

        // Door
        ctx.drawImage(Game.assets.door, 1030, 180);

        // Clock above door
        ctx.drawImage(Game.assets.clock, 1075, 60);

        // Character (player silhouette in lower left)
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.drawImage(Game.assets.character, 180, 520);
        ctx.restore();

        // Effects
        FX.drawVignette(ctx);
        FX.drawGrain(ctx);
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">You never really woke up.</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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

        this.checkFinalEnding();
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">Awake, but time stayed.</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">Reset or relief?</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">Fear made room for you.</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">…But are you really awake?</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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
        this.endingOverlay.innerHTML = `
            <div class="ending-caption">Freedom, if you don't look closely.</div>
            <button class="try-again-btn" id="ending-return">Continue</button>
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
            <div class="ending-caption" style="font-size: 22px;">
                The room sleeps.<br><br>
                You are the dream now.
            </div>
            <button class="try-again-btn" id="ending-restart">Restart</button>
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
                drawerOpened: false,
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
        Hotspots.click(Game.mouse.worldX, Game.mouse.worldY);
    });

    canvas.addEventListener('mouseup', () => {
        Game.mouse.down = false;
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
