// ============================================================================
// TRAPPED IN A DREAM - 2D Point & Click Horror Experience
// ============================================================================

// --- CONSTANTS ---
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;

// Game states
const STATES = {
    INTRO: 'INTRO',
    ROOM: 'ROOM',
    ENDING_MIRROR: 'ENDING_MIRROR',
    ENDING_CAT: 'ENDING_CAT',
    ENDING_DOOR: 'ENDING_DOOR'
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
    firstInteraction: false
};

// --- AUDIO ENGINE ---
const AudioEngine = {
    context: null,
    sounds: {},
    masterGain: null,
    droneOscillator: null,
    droneGain: null,

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.value = 0.3;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    startDrone() {
        if (!this.context || !Game.soundEnabled) return;

        try {
            if (this.droneOscillator) return; // Already running

            this.droneOscillator = this.context.createOscillator();
            this.droneGain = this.context.createGain();

            this.droneOscillator.type = 'sine';
            this.droneOscillator.frequency.value = 60; // Low rumble
            this.droneGain.gain.value = 0.08;

            this.droneOscillator.connect(this.droneGain);
            this.droneGain.connect(this.masterGain);
            this.droneOscillator.start();
        } catch (e) {
            console.warn('Could not start drone', e);
        }
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
            osc.frequency.setValueAtTime(800, this.context.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, this.context.currentTime + 0.3);

            gain.gain.setValueAtTime(0.15, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.3);
        } catch (e) {
            console.warn('Could not play whoosh', e);
        }
    },

    playMeow() {
        if (!this.context || !Game.soundEnabled) return;

        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, this.context.currentTime);
            osc.frequency.linearRampToValueAtTime(400, this.context.currentTime + 0.15);
            osc.frequency.linearRampToValueAtTime(500, this.context.currentTime + 0.25);

            gain.gain.setValueAtTime(0.2, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.3);
        } catch (e) {
            console.warn('Could not play meow', e);
        }
    },

    playImpact() {
        if (!this.context || !Game.soundEnabled) return;

        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = 'sawtooth';
            osc.frequency.value = 100;

            gain.gain.setValueAtTime(0.3, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.1);
        } catch (e) {
            console.warn('Could not play impact', e);
        }
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
            const gray = Math.random() * 255;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
            data[i + 3] = 15; // Low alpha for subtle effect
        }

        this.grainCtx.putImageData(imageData, 0, 0);
    },

    drawGrain(ctx) {
        // Refresh grain occasionally for animated effect
        this.grainRefreshCounter++;
        if (this.grainRefreshCounter > 3) {
            this.generateGrain();
            this.grainRefreshCounter = 0;
        }

        ctx.globalAlpha = 0.4;
        ctx.drawImage(this.grainCanvas, 0, 0);
        ctx.globalAlpha = 1;
    },

    drawVignette(ctx) {
        const gradient = ctx.createRadialGradient(
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.3,
            BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_HEIGHT * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    },

    whiteFlash(ctx, intensity) {
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
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

    add(id, x, y, width, height, label, onClick) {
        this.areas.push({ id, x, y, width, height, label, onClick });
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
            this.showTooltip(hit.label, mouseX, mouseY);
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
        this.tooltip.style.left = (x * Game.scale + Game.offsetX + 10) + 'px';
        this.tooltip.style.top = (y * Game.scale + Game.offsetY - 30) + 'px';
        this.tooltip.style.display = 'block';
    },

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
};

// --- PARTICLE SYSTEM ---
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = -0.3 - Math.random() * 0.3;
        this.size = 1 + Math.random() * 2;
        this.alpha = 0.3 + Math.random() * 0.3;
        this.time = Math.random() * Math.PI * 2;
        this.speed = 0.5 + Math.random() * 0.5;
    }

    update(dt) {
        this.time += dt * this.speed;
        this.x = this.baseX + Math.sin(this.time) * 8;
        this.y -= this.vy * dt * 60;
        this.baseX += this.vx * dt * 60;
        this.baseY = this.y;

        // Wrap around
        if (this.y < -10) {
            this.y = BASE_HEIGHT + 10;
            this.baseY = this.y;
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(200, 200, 200, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- ASSET GENERATION ---
const Assets = {
    generateMirror() {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // Frame
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(150, 200, 120, 180, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner reflection area
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(150, 200, 100, 160, 0, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.ellipse(140, 180, 60, 80, -0.3, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    generateDoor() {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 350;
        const ctx = canvas.getContext('2d');

        // Door frame
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, 200, 350);

        // Door panels
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 160, 150);
        ctx.strokeRect(20, 180, 160, 150);

        // Door knob
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(160, 200, 8, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    generateCat() {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        // Cat silhouette
        ctx.fillStyle = '#000';

        // Body
        ctx.beginPath();
        ctx.ellipse(75, 60, 50, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.ellipse(110, 40, 25, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(90, 20);
        ctx.lineTo(100, 5);
        ctx.lineTo(105, 25);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(120, 20);
        ctx.lineTo(125, 5);
        ctx.lineTo(130, 25);
        ctx.fill();

        return canvas;
    },

    generateCatEyes(threeEyes = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        const eyeColor = 'rgba(100, 255, 150, 0.9)';

        if (threeEyes) {
            // Left eye
            ctx.fillStyle = eyeColor;
            ctx.beginPath();
            ctx.arc(100, 35, 4, 0, Math.PI * 2);
            ctx.fill();

            // Middle eye
            ctx.beginPath();
            ctx.arc(110, 30, 4, 0, Math.PI * 2);
            ctx.fill();

            // Right eye
            ctx.beginPath();
            ctx.arc(120, 35, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Two eyes (blinking state)
            ctx.fillStyle = eyeColor;
            ctx.fillRect(100, 35, 8, 2);
            ctx.fillRect(115, 35, 8, 2);
        }

        return canvas;
    },

    load() {
        Game.assets.mirror = this.generateMirror();
        Game.assets.door = this.generateDoor();
        Game.assets.cat = this.generateCat();
        Game.assets.catEyesOpen = this.generateCatEyes(true);
        Game.assets.catEyesClosed = this.generateCatEyes(false);
    }
};

// --- SCENE: INTRO ---
const SceneIntro = {
    timer: 0,
    duration: 3.5,
    textFadeIn: 0.5,
    textHold: 2.0,
    textFadeOut: 3.0,

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

        // Eye opening animation (horizontal slit)
        const openProgress = Math.min(this.timer / 2.5, 1);
        const easeOpen = this.easeOutCubic(openProgress);
        const slitHeight = BASE_HEIGHT * easeOpen;

        const topHeight = (BASE_HEIGHT - slitHeight) / 2;

        if (openProgress < 1) {
            // Top eyelid
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, BASE_WIDTH, topHeight);

            // Bottom eyelid
            ctx.fillRect(0, BASE_HEIGHT - topHeight, BASE_WIDTH, topHeight);
        }

        // Scene visible through the slit
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, topHeight, BASE_WIDTH, slitHeight);

        // Text overlay
        let textAlpha = 0;
        if (this.timer < this.textFadeIn) {
            textAlpha = this.timer / this.textFadeIn;
        } else if (this.timer < this.textHold) {
            textAlpha = 1;
        } else if (this.timer < this.textFadeOut) {
            textAlpha = 1 - ((this.timer - this.textHold) / (this.textFadeOut - this.textHold));
        }

        ctx.fillStyle = `rgba(200, 200, 200, ${textAlpha * 0.8})`;
        ctx.font = '18px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Your eyes slowly open… but something feels off.', BASE_WIDTH / 2, BASE_HEIGHT / 2);
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
};

// --- SCENE: ROOM ---
const SceneRoom = {
    particles: [],
    roomCanvas: null,
    mirrorReflectionCanvas: null,
    parallaxOffset: 0,
    catBlinkTimer: 0,
    catBlinkState: true, // true = eyes open
    doorLightPulse: 0,
    mirrorRippleTime: 0,

    enter() {
        // Generate particles
        this.particles = [];
        for (let i = 0; i < 40; i++) {
            this.particles.push(new Particle(
                Math.random() * BASE_WIDTH,
                Math.random() * BASE_HEIGHT
            ));
        }

        // Pre-render room
        this.renderRoomToCanvas();

        // Setup hotspots
        Hotspots.clear();
        Hotspots.add('mirror', 50, 150, 300, 400, 'Look', () => {
            SceneManager.changeState(STATES.ENDING_MIRROR);
        });
        Hotspots.add('cat', 1000, 400, 150, 100, 'Approach', () => {
            SceneManager.changeState(STATES.ENDING_CAT);
        });
        Hotspots.add('door', 500, 200, 200, 350, 'Open', () => {
            SceneManager.changeState(STATES.ENDING_DOOR);
        });

        // Start ambient drone
        AudioEngine.startDrone();

        this.catBlinkTimer = 0;
        this.doorLightPulse = 0;
        this.mirrorRippleTime = 0;
    },

    exit() {
        Hotspots.clear();
        AudioEngine.stopDrone();
    },

    update(dt) {
        // Update particles
        for (let particle of this.particles) {
            particle.update(dt);
        }

        // Parallax based on mouse
        const targetOffset = (Game.mouse.worldX - BASE_WIDTH / 2) * 0.02;
        this.parallaxOffset += (targetOffset - this.parallaxOffset) * 0.05;

        // Cat blink
        this.catBlinkTimer += dt;
        if (this.catBlinkTimer > 3) {
            this.catBlinkState = !this.catBlinkState;
            this.catBlinkTimer = 0;
            if (this.catBlinkState) {
                AudioEngine.playMeow();
            }
        }

        // Door light pulse
        this.doorLightPulse += dt;

        // Mirror ripple
        this.mirrorRippleTime += dt;

        // Update hotspots
        Hotspots.update(Game.mouse.worldX, Game.mouse.worldY);
    },

    draw(ctx) {
        // Background with parallax
        ctx.save();
        ctx.translate(this.parallaxOffset * 0.5, 0);

        // Draw pre-rendered room
        if (this.roomCanvas) {
            ctx.drawImage(this.roomCanvas, 0, 0);
        }

        ctx.restore();

        // Midground with parallax
        ctx.save();
        ctx.translate(this.parallaxOffset, 0);

        // Draw mirror with ripple effect
        this.drawMirror(ctx);

        // Draw door with light
        this.drawDoor(ctx);

        // Draw cat
        this.drawCat(ctx);

        ctx.restore();

        // Foreground: particles (no parallax)
        for (let particle of this.particles) {
            particle.draw(ctx);
        }

        // Post FX
        FX.drawVignette(ctx);
        FX.drawGrain(ctx);
    },

    renderRoomToCanvas() {
        this.roomCanvas = document.createElement('canvas');
        this.roomCanvas.width = BASE_WIDTH;
        this.roomCanvas.height = BASE_HEIGHT;
        const ctx = this.roomCanvas.getContext('2d');

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
        gradient.addColorStop(0, '#0d0d0d');
        gradient.addColorStop(1, '#050505');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Floor
        ctx.fillStyle = '#030303';
        ctx.fillRect(0, BASE_HEIGHT * 0.65, BASE_WIDTH, BASE_HEIGHT * 0.35);

        // Wall cracks (noise pattern)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * BASE_WIDTH;
            const y = Math.random() * BASE_HEIGHT * 0.6;
            const length = 20 + Math.random() * 60;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 20, y + length);
            ctx.stroke();
        }
    },

    drawMirror(ctx) {
        const x = 50;
        const y = 150;

        ctx.save();
        ctx.translate(x, y);

        // Mirror frame
        ctx.drawImage(Game.assets.mirror, 0, 0);

        // Ripple effect
        const rippleIntensity = Math.sin(this.mirrorRippleTime * 2) * 2;

        // Reflection (simplified - just a darker oval)
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.translate(150, 200);
        ctx.scale(1 + rippleIntensity * 0.01, 1);
        ctx.translate(-150, -200);

        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(150, 200, 90, 150, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.restore();
    },

    drawDoor(ctx) {
        const x = 500;
        const y = 200;

        ctx.save();
        ctx.translate(x, y);

        // Light leaking from bottom
        const lightIntensity = 0.3 + Math.sin(this.doorLightPulse * 1.5) * 0.1;
        const gradient = ctx.createLinearGradient(100, 350, 100, 250);
        gradient.addColorStop(0, `rgba(255, 200, 100, ${lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(20, 250, 160, 100);

        // Vertical crack of light
        ctx.fillStyle = `rgba(255, 220, 150, ${lightIntensity * 0.6})`;
        ctx.fillRect(95, 50, 3, 280);

        // Door itself
        ctx.drawImage(Game.assets.door, 0, 0);

        ctx.restore();
    },

    drawCat(ctx) {
        const x = 1000;
        const y = 400;

        ctx.save();
        ctx.translate(x, y);

        // Cat body
        ctx.drawImage(Game.assets.cat, 0, 0);

        // Eyes
        const eyeAsset = this.catBlinkState ? Game.assets.catEyesOpen : Game.assets.catEyesClosed;
        ctx.drawImage(eyeAsset, 0, 0);

        ctx.restore();
    }
};

// --- SCENE: ENDING MIRROR ---
const SceneEndingMirror = {
    timer: 0,
    phase: 'zoom', // 'zoom', 'warp', 'reveal', 'caption'
    zoomScale: 1,
    warpIntensity: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'zoom';
        this.zoomScale = 1;
        this.warpIntensity = 0;
        AudioEngine.playWhoosh();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'zoom') {
            this.zoomScale += dt * 1.5;
            if (this.timer > 1.5) {
                this.phase = 'warp';
                this.timer = 0;
            }
        } else if (this.phase === 'warp') {
            this.warpIntensity = Math.min(this.timer / 1.0, 1);
            if (this.timer > 1.5) {
                this.phase = 'reveal';
                this.timer = 0;
            }
        } else if (this.phase === 'reveal') {
            if (this.timer > 0.5) {
                this.phase = 'caption';
                this.showEndingUI('You never really woke up.');
            }
        }
    },

    draw(ctx) {
        // Draw room in background
        SceneRoom.draw(ctx);

        if (this.phase === 'zoom') {
            // Zoom into mirror
            ctx.save();
            ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
            ctx.scale(this.zoomScale, this.zoomScale);
            ctx.translate(-200, -350);

            ctx.globalAlpha = 0.5;
            ctx.drawImage(Game.assets.mirror, 0, 0);
            ctx.restore();

            FX.blackFade(ctx, Math.min(this.timer / 1.5, 0.5));
        } else if (this.phase === 'warp') {
            // Barrel distortion effect (simplified)
            this.drawWarped(ctx);
        } else if (this.phase === 'reveal') {
            // Quick cut back to room, slightly offset
            ctx.save();
            ctx.translate(5 * Math.sin(this.timer * 50), 0);
            SceneRoom.draw(ctx);
            ctx.restore();

            FX.blackFade(ctx, 0.3);
        }
    },

    drawWarped(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        const intensity = this.warpIntensity * 20;

        for (let i = 0; i < 5; i++) {
            const offset = (5 - i) * intensity;
            const alpha = 0.2 * (1 - i / 5);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
            ctx.scale(1 + offset * 0.01, 1 + offset * 0.01);
            ctx.translate(-BASE_WIDTH / 2, -BASE_HEIGHT / 2);

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

            ctx.restore();
        }
    },

    showEndingUI(caption) {
        if (this.endingOverlay) return;

        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';

        const captionEl = document.createElement('div');
        captionEl.className = 'ending-caption';
        captionEl.textContent = caption;

        const btn = document.createElement('button');
        btn.className = 'try-again-btn';
        btn.textContent = 'Try Again';
        btn.onclick = () => {
            this.hideEndingUI();
            SceneManager.changeState(STATES.ROOM);
        };

        this.endingOverlay.appendChild(captionEl);
        this.endingOverlay.appendChild(btn);
        document.getElementById('game-container').appendChild(this.endingOverlay);
    },

    hideEndingUI() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
            this.endingOverlay = null;
        }
    },

    exit() {
        this.hideEndingUI();
    }
};

// --- SCENE: ENDING CAT ---
const SceneEndingCat = {
    timer: 0,
    phase: 'approach', // 'approach', 'lunge', 'flash', 'fade', 'caption'
    catScale: 1,
    flashCount: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'approach';
        this.catScale = 1;
        this.flashCount = 0;
        AudioEngine.playMeow();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'approach') {
            if (this.timer > 0.8) {
                this.phase = 'lunge';
                this.timer = 0;
                AudioEngine.playImpact();
            }
        } else if (this.phase === 'lunge') {
            this.catScale = 1 + this.easeOutQuad(Math.min(this.timer / 0.5, 1)) * 8;
            if (this.timer > 0.5) {
                this.phase = 'flash';
                this.timer = 0;
            }
        } else if (this.phase === 'flash') {
            if (this.timer > 0.15) {
                this.flashCount++;
                this.timer = 0;
                if (this.flashCount > 3) {
                    this.phase = 'fade';
                    this.timer = 0;
                }
            }
        } else if (this.phase === 'fade') {
            if (this.timer > 1.0) {
                this.phase = 'caption';
                this.showEndingUI('Did that wake you… or just reset the dream?');
            }
        }
    },

    draw(ctx) {
        if (this.phase === 'flash' && this.flashCount % 2 === 1) {
            // Red flash
            ctx.fillStyle = '#300000';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else if (this.phase === 'fade') {
            // Black
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

            // Fade back to room
            const fadeAlpha = Math.min(this.timer / 1.0, 1);
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            SceneRoom.draw(ctx);
            ctx.restore();
        } else if (this.phase === 'caption') {
            SceneRoom.draw(ctx);
            FX.blackFade(ctx, 0.5);
        } else {
            // Draw room
            SceneRoom.draw(ctx);

            if (this.phase === 'lunge') {
                // Draw enlarged cat
                ctx.save();
                ctx.translate(BASE_WIDTH / 2, BASE_HEIGHT / 2);
                ctx.scale(this.catScale, this.catScale);
                ctx.translate(-1075, -450);

                ctx.drawImage(Game.assets.cat, 1000, 400);
                ctx.drawImage(Game.assets.catEyesOpen, 1000, 400);

                ctx.restore();
            }
        }
    },

    easeOutQuad(t) {
        return t * (2 - t);
    },

    showEndingUI(caption) {
        if (this.endingOverlay) return;

        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';

        const captionEl = document.createElement('div');
        captionEl.className = 'ending-caption';
        captionEl.textContent = caption;

        const btn = document.createElement('button');
        btn.className = 'try-again-btn';
        btn.textContent = 'Try Again';
        btn.onclick = () => {
            this.hideEndingUI();
            SceneManager.changeState(STATES.ROOM);
        };

        this.endingOverlay.appendChild(captionEl);
        this.endingOverlay.appendChild(btn);
        document.getElementById('game-container').appendChild(this.endingOverlay);
    },

    hideEndingUI() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
            this.endingOverlay = null;
        }
    },

    exit() {
        this.hideEndingUI();
    }
};

// --- SCENE: ENDING DOOR ---
const SceneEndingDoor = {
    timer: 0,
    phase: 'open', // 'open', 'flood', 'white', 'fade', 'caption'
    doorOpenWidth: 0,
    endingOverlay: null,

    enter() {
        this.timer = 0;
        this.phase = 'open';
        this.doorOpenWidth = 0;
        AudioEngine.playWhoosh();
    },

    update(dt) {
        this.timer += dt;

        if (this.phase === 'open') {
            this.doorOpenWidth = this.easeOutCubic(Math.min(this.timer / 1.5, 1)) * BASE_WIDTH;
            if (this.timer > 1.5) {
                this.phase = 'flood';
                this.timer = 0;
            }
        } else if (this.phase === 'flood') {
            if (this.timer > 0.5) {
                this.phase = 'white';
                this.timer = 0;
            }
        } else if (this.phase === 'white') {
            if (this.timer > 0.7) {
                this.phase = 'fade';
                this.timer = 0;
            }
        } else if (this.phase === 'fade') {
            if (this.timer > 1.0) {
                this.phase = 'caption';
                this.showEndingUI('…But are you really awake?');
            }
        }
    },

    draw(ctx) {
        if (this.phase === 'white') {
            // Pure white
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        } else if (this.phase === 'fade') {
            // Fade from white to gray to room
            const fadeProgress = this.timer / 1.0;
            const grayness = 255 - fadeProgress * 255;
            ctx.fillStyle = `rgb(${grayness}, ${grayness}, ${grayness})`;
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

            if (fadeProgress > 0.5) {
                ctx.save();
                ctx.globalAlpha = (fadeProgress - 0.5) * 2;
                SceneRoom.draw(ctx);
                ctx.restore();
            }
        } else if (this.phase === 'caption') {
            SceneRoom.draw(ctx);
            FX.blackFade(ctx, 0.5);
        } else {
            // Draw room
            SceneRoom.draw(ctx);

            if (this.phase === 'open' || this.phase === 'flood') {
                // Light flooding from right to left
                const gradient = ctx.createLinearGradient(BASE_WIDTH - this.doorOpenWidth, 0, BASE_WIDTH, 0);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                gradient.addColorStop(1, 'rgba(255, 240, 200, 1)');

                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
            }
        }
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    showEndingUI(caption) {
        if (this.endingOverlay) return;

        this.endingOverlay = document.createElement('div');
        this.endingOverlay.className = 'ending-overlay';

        const captionEl = document.createElement('div');
        captionEl.className = 'ending-caption';
        captionEl.textContent = caption;

        const btn = document.createElement('button');
        btn.className = 'try-again-btn';
        btn.textContent = 'Try Again';
        btn.onclick = () => {
            this.hideEndingUI();
            SceneManager.changeState(STATES.ROOM);
        };

        this.endingOverlay.appendChild(captionEl);
        this.endingOverlay.appendChild(btn);
        document.getElementById('game-container').appendChild(this.endingOverlay);
    },

    hideEndingUI() {
        if (this.endingOverlay) {
            this.endingOverlay.remove();
            this.endingOverlay = null;
        }
    },

    exit() {
        this.hideEndingUI();
    }
};

// --- SCENE MANAGER ---
const SceneManager = {
    scenes: {
        [STATES.INTRO]: SceneIntro,
        [STATES.ROOM]: SceneRoom,
        [STATES.ENDING_MIRROR]: SceneEndingMirror,
        [STATES.ENDING_CAT]: SceneEndingCat,
        [STATES.ENDING_DOOR]: SceneEndingDoor
    },

    changeState(newState) {
        // Exit current
        if (Game.currentState && this.scenes[Game.currentState].exit) {
            this.scenes[Game.currentState].exit();
        }

        // Enter new
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

        // Convert to world coordinates
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

    // Touch support
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

    // Sound toggle
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
        // Container is wider - fit to height
        displayHeight = containerHeight;
        displayWidth = displayHeight * ASPECT_RATIO;
    } else {
        // Container is taller - fit to width
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

    // Update
    SceneManager.update(dt);

    // Draw
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

    // Initialize systems
    AudioEngine.init();
    FX.initGrain();
    Assets.load();

    // Setup input
    setupInput();

    // Setup resize
    window.addEventListener('resize', resize);
    resize();

    // Start game
    SceneManager.changeState(STATES.INTRO);
    Game.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// --- START ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
