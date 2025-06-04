class HillClimbGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.setupGame();
        this.setupControls();
        this.setupAI();
        this.gameLoop();
    }
    
    setupGame() {
        this.camera = { x: 0, y: 0 };
        this.terrain = this.generateTerrain();
        
        // Find the ground height at starting position and place car on it
        const startGroundHeight = this.getTerrainHeight(100);
        
        this.car = {
            x: 100,
            y: startGroundHeight - 25, // Place car just above ground
            width: 40,
            height: 20,
            vx: 0,
            vy: 0,
            angle: 0,
            angularVelocity: 0,
            onGround: true,
            wheelBase: 35
        };
        
        this.gas = 0;
        this.brake = 0;
        this.maxSpeed = 15;
        this.distance = 0;
        this.crashes = 0;
        this.gameRunning = true;
        this.lastCrashData = null;
    }
    
    setupAI() {
        this.crashHistory = [];
        this.suggestions = [];
        this.lastSuggestionX = -1000;
        this.dangerZones = [];
    }
    
    generateTerrain() {
        const terrain = [];
        let y = 500;
        let amplitude = 50;
        let frequency = 0.02;
        
        // Add more variety to terrain generation
        for (let x = 0; x < 5000; x += 10) {
            // Base terrain with multiple sine waves
            y += Math.sin(x * 0.01) * 15;
            y += Math.sin(x * frequency) * amplitude;
            y += Math.sin(x * frequency * 0.5) * amplitude * 0.5;
            
            // Add random bumps for more natural look
            if (Math.random() < 0.1) {
                y += (Math.random() - 0.5) * 20;
            }
            
            // Create more interesting hills
            if (x % 800 === 0) {
                amplitude = 70;
                frequency = 0.025;
                // Add a steep climb
                for (let i = 0; i < 5; i++) {
                    y -= 10;
                }
            } else if (x % 400 === 0) {
                amplitude = 50;
                frequency = 0.02;
                // Add a gentle slope
                for (let i = 0; i < 3; i++) {
                    y -= 5;
                }
            }
            
            // Keep terrain within bounds
            y = Math.max(300, Math.min(600, y));
            
            terrain.push({ x, y });
        }
        return terrain;
    }
    
    setupControls() {
        const gasBtn = document.getElementById('gasBtn');
        const brakeBtn = document.getElementById('brakeBtn');
        
        // Gas button
        gasBtn.addEventListener('mousedown', () => this.gasPressed = true);
        gasBtn.addEventListener('mouseup', () => this.gasPressed = false);
        gasBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.gasPressed = true; });
        gasBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.gasPressed = false; });
        
        // Brake button
        brakeBtn.addEventListener('mousedown', () => this.brakePressed = true);
        brakeBtn.addEventListener('mouseup', () => this.brakePressed = false);
        brakeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.brakePressed = true; });
        brakeBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.brakePressed = false; });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') this.gasPressed = true;
            if (e.code === 'ArrowDown') this.brakePressed = true;
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') this.gasPressed = false;
            if (e.code === 'ArrowDown') this.brakePressed = false;
        });
    }
    
    updateControls() {
        if (this.gasPressed && this.gas < 100) {
            this.gas = Math.min(100, this.gas + 3);
        } else if (!this.gasPressed && this.gas > 0) {
            this.gas = Math.max(0, this.gas - 5);
        }
        
        if (this.brakePressed && this.brake < 100) {
            this.brake = Math.min(100, this.brake + 3);
        } else if (!this.brakePressed && this.brake > 0) {
            this.brake = Math.max(0, this.brake - 5);
        }
        
        // Update UI bars and labels
        document.getElementById('gasBarFill').style.height = this.gas + '%';
        document.getElementById('brakeBarFill').style.height = this.brake + '%';
        document.getElementById('gasLabel').textContent = `GAS: ${Math.floor(this.gas)}%`;
        document.getElementById('brakeLabel').textContent = `BRAKE: ${Math.floor(this.brake)}%`;
    }
    
    getTerrainHeight(x) {
        // Find the terrain point closest to x
        let closest = this.terrain[0];
        let minDist = Math.abs(x - closest.x);
        
        for (let point of this.terrain) {
            let dist = Math.abs(x - point.x);
            if (dist < minDist) {
                minDist = dist;
                closest = point;
            }
        }
        return closest.y;
    }
    
    updatePhysics() {
        if (!this.gameRunning) return;
        
        // Apply forces based on gas and brake with improved physics
        const gasForce = (this.gas / 100) * 0.8;
        const brakeForce = (this.brake / 100) * 0.6;
        
        // Forward/backward acceleration with terrain slope consideration
        const slope = Math.atan2(
            this.getTerrainHeight(this.car.x + 10) - this.getTerrainHeight(this.car.x - 10),
            20
        );
        
        // Adjust forces based on slope
        const slopeFactor = Math.cos(slope);
        this.car.vx += (gasForce - brakeForce) * slopeFactor;
        
        // Add gravity effect on slopes
        this.car.vx += Math.sin(slope) * 0.2;
        
        // Air resistance and friction
        this.car.vx *= 0.98;
        if (this.car.onGround) {
            this.car.vx *= 0.95; // More friction when on ground
        }
        
        // Gravity with improved vertical movement
        this.car.vy += 0.5;
        
        // Update position
        this.car.x += this.car.vx;
        this.car.y += this.car.vy;
        
        // Improved terrain collision
        const frontWheelX = this.car.x + Math.cos(this.car.angle) * this.car.wheelBase / 2;
        const backWheelX = this.car.x - Math.cos(this.car.angle) * this.car.wheelBase / 2;
        const frontWheelY = this.car.y + Math.sin(this.car.angle) * this.car.wheelBase / 2;
        const backWheelY = this.car.y - Math.sin(this.car.angle) * this.car.wheelBase / 2;
        
        const frontGroundY = this.getTerrainHeight(frontWheelX);
        const backGroundY = this.getTerrainHeight(backWheelX);
        
        // Improved ground detection and response
        if (frontWheelY >= frontGroundY - 10 || backWheelY >= backGroundY - 10) {
            this.car.onGround = true;
            
            // Smoother angle adjustment based on terrain
            const slope = Math.atan2(frontGroundY - backGroundY, this.car.wheelBase);
            this.car.angle = slope * 0.3 + this.car.angle * 0.7;
            
            // Better ground settling
            if (frontWheelY > frontGroundY) {
                this.car.y = frontGroundY - Math.sin(this.car.angle) * this.car.wheelBase / 2;
                this.car.vy = Math.max(-2, this.car.vy * 0.5);
            }
            if (backWheelY > backGroundY) {
                this.car.y = backGroundY + Math.sin(this.car.angle) * this.car.wheelBase / 2;
                this.car.vy = Math.max(-2, this.car.vy * 0.5);
            }
        } else {
            this.car.onGround = false;
        }
        
        // Improved angular physics
        if (!this.car.onGround) {
            this.car.angularVelocity += (gasForce - brakeForce) * 0.05;
        }
        this.car.angle += this.car.angularVelocity;
        this.car.angularVelocity *= 0.95;
        
        // Check for crashes
        this.checkCrashes();
        
        // Update camera with smoother following
        this.camera.x = this.car.x - this.canvas.width / 2;
        this.camera.y = this.car.y - this.canvas.height / 2;
        
        // Update distance
        this.distance = Math.max(this.distance, Math.floor(this.car.x / 10));
        
        // AI suggestions
        this.checkForSuggestions();
    }
    
    checkCrashes() {
        // Check if car is upside down - but only when on ground
        const normalizedAngle = ((this.car.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (this.car.onGround && normalizedAngle > Math.PI * 0.7 && normalizedAngle < Math.PI * 1.3) {
            this.crashCar("Car flipped over!");
            return;
        }
        
        // Check if car hit ground too hard (but not on initial spawn)
        if (this.car.vy > 12 && this.distance > 5 && this.car.onGround) {
            this.crashCar("Hard landing!");
            return;
        }
        
        // Check if car is stuck (very low speed for too long) - only when on ground
        const speed = Math.abs(this.car.vx);
        if (speed < 0.1 && this.car.onGround && this.distance > 10) {
            this.slowSpeedTimer = (this.slowSpeedTimer || 0) + 1;
            if (this.slowSpeedTimer > 240) { // 4 seconds at 60fps
                this.crashCar("Car got stuck!");
                return;
            }
        } else {
            this.slowSpeedTimer = 0;
        }
        
        // Check if car fell off the world (went too far down)
        if (this.car.y > 800) {
            this.crashCar("Car fell into the abyss!");
            return;
        }
    }
    
    crashCar(reason) {
        this.gameRunning = false;
        this.crashes++;
        
        // Record crash data for AI
        this.recordCrash(reason);
        
        // Show game over screen
        document.getElementById('crashReason').textContent = reason;
        document.getElementById('finalDistance').textContent = this.distance;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    recordCrash(reason) {
        const crashData = {
            x: Math.floor(this.car.x / 50) * 50, // Quantize position
            gas: this.gas,
            brake: this.brake,
            angle: this.car.angle,
            speed: Math.abs(this.car.vx),
            reason: reason,
            timestamp: Date.now()
        };
        
        this.crashHistory.push(crashData);
        
        // Create or update danger zone
        this.updateDangerZones(crashData);
        
        // Generate suggestion for this area
        this.generateSuggestion(crashData);
    }
    
    updateDangerZones(crashData) {
        const existingZone = this.dangerZones.find(zone => 
            Math.abs(zone.x - crashData.x) < 100
        );
        
        if (existingZone) {
            existingZone.crashes++;
            existingZone.lastCrash = crashData;
        } else {
            this.dangerZones.push({
                x: crashData.x,
                crashes: 1,
                lastCrash: crashData
            });
        }
    }
    
    generateSuggestion(crashData) {
        let suggestion = "🤖 AI Analysis: ";
        const gasValue = Math.floor(crashData.gas);
        const brakeValue = Math.floor(crashData.brake);
        const position = Math.floor(crashData.x / 10);
        
        if (crashData.reason === "Car flipped over!") {
            if (crashData.gas > 70) {
                suggestion += `You used ${gasValue}% gas at ${position}m - try 30-40% gas instead on steep hills.`;
            } else if (crashData.brake > 70) {
                suggestion += `You used ${brakeValue}% brake at ${position}m - avoid heavy braking on slopes! Try 20-30% brake.`;
            } else if (crashData.speed > 8) {
                suggestion += `Speed was too high (${Math.floor(crashData.speed * 3.6)}km/h) at ${position}m - reduce gas to 25-35%.`;
            } else {
                suggestion += `Flip at ${position}m - try gas:40%, brake:0% for better balance.`;
            }
        } else if (crashData.reason === "Hard landing!") {
            suggestion += `Hard landing at ${position}m (gas:${gasValue}%, brake:${brakeValue}%) - try gas:20-30% before jumps, brake:10-20% for landing.`;
        } else if (crashData.reason === "Car got stuck!") {
            suggestion += `Stuck at ${position}m (gas:${gasValue}%) - use 60-80% gas to maintain momentum uphill.`;
        }
        
        this.suggestions.push({
            x: crashData.x,
            text: suggestion,
            shown: false
        });
    }
    
    checkForSuggestions() {
        if (this.car.x - this.lastSuggestionX < 200) return;
        
        for (let suggestion of this.suggestions) {
            if (!suggestion.shown && Math.abs(this.car.x - suggestion.x) < 150) {
                this.showSuggestion(suggestion.text);
                suggestion.shown = true;
                this.lastSuggestionX = this.car.x;
                break;
            }
        }
        
        // Check for danger zone warnings
        for (let zone of this.dangerZones) {
            if (Math.abs(this.car.x - zone.x) < 200 && Math.abs(this.car.x - zone.x) > 100) {
                document.getElementById('terrainWarning').style.display = 'block';
                setTimeout(() => {
                    document.getElementById('terrainWarning').style.display = 'none';
                }, 3000);
                break;
            }
        }
    }
    
    showSuggestion(text) {
        document.getElementById('suggestionText').textContent = text;
        document.getElementById('aiSuggestion').style.display = 'block';
        
        setTimeout(() => {
            document.getElementById('aiSuggestion').style.display = 'none';
        }, 5000);
    }
    
    render() {
        // Clear canvas with improved background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.6, '#98FB98');
        gradient.addColorStop(1, '#8B4513');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw terrain with improved visuals
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.moveTo(-this.camera.x, this.canvas.height);
        
        for (let point of this.terrain) {
            this.ctx.lineTo(point.x - this.camera.x, point.y - this.camera.y);
        }
        
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw terrain grass line with improved appearance
        this.ctx.strokeStyle = '#228B22';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        for (let i = 0; i < this.terrain.length; i++) {
            const point = this.terrain[i];
            if (i === 0) {
                this.ctx.moveTo(point.x - this.camera.x, point.y - this.camera.y);
            } else {
                this.ctx.lineTo(point.x - this.camera.x, point.y - this.camera.y);
            }
        }
        this.ctx.stroke();
        
        // Draw danger zones with improved visibility
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        for (let zone of this.dangerZones) {
            this.ctx.fillRect(
                zone.x - 50 - this.camera.x,
                0,
                100,
                this.canvas.height
            );
        }
        
        // Draw car with improved visuals
        this.ctx.save();
        this.ctx.translate(this.car.x - this.camera.x, this.car.y - this.camera.y);
        this.ctx.rotate(this.car.angle);
        
        // Car body with gradient
        const carGradient = this.ctx.createLinearGradient(-this.car.width/2, 0, this.car.width/2, 0);
        carGradient.addColorStop(0, '#FF4444');
        carGradient.addColorStop(1, '#FF0000');
        this.ctx.fillStyle = carGradient;
        this.ctx.fillRect(-this.car.width/2, -this.car.height/2, this.car.width, this.car.height);
        
        // Car windows with improved look
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(-this.car.width/2 + 5, -this.car.height/2 + 2, this.car.width - 10, this.car.height - 8);
        
        // Wheels with improved appearance
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(-this.car.wheelBase/2, this.car.height/2, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(this.car.wheelBase/2, this.car.height/2, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
        
        // Update stats
        document.getElementById('distance').textContent = this.distance;
        document.getElementById('speed').textContent = Math.floor(Math.abs(this.car.vx) * 3.6);
        document.getElementById('crashes').textContent = this.crashes;
    }
    
    gameLoop() {
        this.updateControls();
        this.updatePhysics();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Global functions
function closeSuggestion() {
    document.getElementById('aiSuggestion').style.display = 'none';
}

function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    game.setupGame();
}

// Start the game
let game;
window.onload = () => {
    game = new HillClimbGame();
};

// Handle window resize
window.addEventListener('resize', () => {
    game.canvas.width = window.innerWidth;
    game.canvas.height = window.innerHeight;
}); 