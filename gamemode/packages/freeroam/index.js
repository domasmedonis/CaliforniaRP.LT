const bcrypt = require('bcrypt');
const mysql = require('mysql');
const moment = require('moment-timezone');



const activeDrivers = new Map();
const activeRides = new Map();
const activeCalls = new Map();

const INVENTORY_GIVE_RADIUS = 5.0;
const INVENTORY_ITEM_DEFS = Object.freeze({
    water: {
        name: 'Vanduo',
        description: 'Atkuria 5 gyvybes.',
        icon: 'water',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    burger: {
        name: 'Burgeris',
        description: 'Sotus uzkandis. Atkuria 15 gyvybiu.',
        icon: 'burger',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    bandage: {
        name: 'Bintas',
        description: 'Sustabdote kraujavima ir atkuriate 20 gyvybiu.',
        icon: 'bandage',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    medkit: {
        name: 'Vaistineles rinkinys',
        description: 'Pilnai arba beveik pilnai atstato sveikata.',
        icon: 'medkit',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    cigarettes: {
        name: 'Cigaretes',
        description: 'Pakelis cigareciu po pertraukeles.',
        icon: 'cigarettes',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    beer: {
        name: 'Alus',
        description: 'Atgaivina ir nuima itampa.',
        icon: 'beer',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
});

const INVENTORY_ITEM_ALIASES = Object.freeze({
    water: 'water',
    vanduo: 'water',
    burger: 'burger',
    bandage: 'bandage',
    bintas: 'bandage',
    medkit: 'medkit',
    vaistinele: 'medkit',
    cigarettes: 'cigarettes',
    cigarette: 'cigarettes',
    cig: 'cigarettes',
    cigs: 'cigarettes',
    cigaretes: 'cigarettes',
    beer: 'beer',
    alus: 'beer',
});

const TWITTER_COOLDOWN = 3600000; // 1 hour between posts
const lastTweetTime = new Map();

const DEALERSHIP_POS = new mp.Vector3(-33.9, -1102.07, 26.42);
const DEALERSHIP_DELIVERY_POS = new mp.Vector3(-23.84, -1094.95, 26.67);
const DEALERSHIP_DELIVERY_HEADING = 69.0;
const DEALERSHIP_INTERACT_RADIUS = 8.0;
const DEALERSHIP_PURCHASE_SPAWN_POS = new mp.Vector3(-49.89, -1111.67, 26.44);

const VEHICLE_CATALOG = Object.freeze([
    { key: 'sultan', name: 'Karin Sultan', model: 'sultan', price: 28000 },
    { key: 'blista', name: 'Dinka Blista', model: 'blista', price: 16000 },
    { key: 'prairie', name: 'Bollokan Prairie', model: 'prairie', price: 21000 },
    { key: 'premier', name: 'Declasse Premier', model: 'premier', price: 19000 },
    { key: 'dominator', name: 'Vapid Dominator', model: 'dominator', price: 42000 },
    { key: 'buffalo', name: 'Bravado Buffalo', model: 'buffalo', price: 39000 },
    { key: 'tailgater', name: 'Obey Tailgater', model: 'tailgater', price: 33000 },
    { key: 'asea', name: 'Declasse Asea', model: 'asea', price: 14500 },
]);

const vehicleCatalogByKey = new Map(VEHICLE_CATALOG.map(item => [item.key, item]));

// Visual points for dealership and vehicle lot.
mp.blips.new(225, DEALERSHIP_POS, {
    name: 'Vehicle Dealership',
    color: 3,
    shortRange: true,
    scale: 0.9,
});

mp.markers.new(1, new mp.Vector3(DEALERSHIP_POS.x, DEALERSHIP_POS.y, DEALERSHIP_POS.z - 1.0), 1.2, {
    color: [93, 173, 226, 180],
    visible: true,
    dimension: 0,
});

function isNearPoint(player, point, radius) {
    if (!player || !player.position || !point) return false;
    return getDistanceBetweenPositions(player.position, point) <= radius;
}

function getDistanceBetweenPositions(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;

    const ax = Number(a.x);
    const ay = Number(a.y);
    const az = Number(a.z);
    const bx = Number(b.x);
    const by = Number(b.y);
    const bz = Number(b.z);

    if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) {
        return Number.POSITIVE_INFINITY;
    }

    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function parseVehicleColorIndex(input) {
    const value = parseInt(input, 10);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(160, value));
}

function getSpawnPointNearPlayer(player, distance = 4.5) {
    const heading = Number.isFinite(player.heading) ? player.heading : DEALERSHIP_DELIVERY_HEADING;
    const rad = heading * (Math.PI / 180);
    const offsetX = Math.sin(rad) * distance;
    const offsetY = Math.cos(rad) * distance;

    return {
        position: new mp.Vector3(player.position.x + offsetX, player.position.y + offsetY, player.position.z),
        heading,
    };
}


function makeVehiclePlate(charId, vehicleDbId) {
    const safeChar = Math.max(0, parseInt(charId, 10) || 0).toString().slice(-3);
    const safeVehicle = Math.max(0, parseInt(vehicleDbId, 10) || 0).toString().slice(-3);
    return `CRP${safeChar}${safeVehicle}`.slice(0, 8);
}

function ensureOwnedVehicleState(player) {
    if (!player) return;
    if (!(player.ownedVehicles instanceof Map)) {
        player.ownedVehicles = new Map();
    }
}

function ensureParkLocationState(player) {
    if (!player) return;
    if (!(player.parkLocationsByVehicleId instanceof Map)) {
        player.parkLocationsByVehicleId = new Map();
    }
}

function getParkLocationForVehicle(player, vehicleDbId) {
    ensureParkLocationState(player);
    const id = parseInt(vehicleDbId, 10);
    if (!Number.isFinite(id)) return null;
    return player.parkLocationsByVehicleId.get(id) || null;
}

function getOwnedVehicleRecordByDbId(player, vehicleDbId) {
    ensureOwnedVehicleState(player);
    const id = parseInt(vehicleDbId, 10);
    if (!Number.isFinite(id)) return null;
    return player.ownedVehicles.get(id) || null;
}

function getPlayerOwnedVehicleFromEntity(player, vehicleEntity) {
    if (!player || !vehicleEntity || !vehicleEntity.getVariable) return null;
    const ownedVehicleId = vehicleEntity.getVariable('ownedVehicleId');
    const ownedByCharId = vehicleEntity.getVariable('ownedByCharId');

    // Use loose numeric comparison — getVariable may return string or number.
    if (!ownedVehicleId || !ownedByCharId || Number(ownedByCharId) !== Number(player.charId)) {
        return null;
    }

    return getOwnedVehicleRecordByDbId(player, ownedVehicleId);
}

function getClosestPlayerOwnedVehicle(player, maxDistance = 8.0) {
    if (!player) return null;

    if (player.vehicle) {
        const fromSeatVehicle = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
        if (fromSeatVehicle) return fromSeatVehicle;
    }

    ensureOwnedVehicleState(player);
    let closest = null;
    let closestDistance = maxDistance;

    player.ownedVehicles.forEach((record) => {
        if (!record || !record.entity || !record.entity.handle) return;
        const dist = getDistanceBetweenPositions(player.position, record.entity.position);
        if (dist <= closestDistance) {
            closestDistance = dist;
            closest = record;
        }
    });

    return closest;
}

function getActiveOwnedVehicleRecord(player) {
    if (!player) return null;
    ensureOwnedVehicleState(player);

    for (const record of player.ownedVehicles.values()) {
        if (record && record.entity && record.entity.handle) {
            return record;
        }
    }

    return null;
}

function isPlayerDrivingVehicle(player, vehicle) {
    if (!player || !vehicle || !vehicle.handle) return false;
    // RAGE MP server-side: driver seat is -1. Accept 0 as well for safety.
    // Do NOT use getPedInSeat — it returns a raw ped handle, not the player object.
    return player.vehicle === vehicle && (player.seat === -1 || player.seat === 0);
}

function spawnOwnedVehicleForPlayer(player, record, spawnPos = DEALERSHIP_DELIVERY_POS, spawnHeading = DEALERSHIP_DELIVERY_HEADING, warpDriver = false) {
    if (!player || !record) return null;
    if (record.entity && record.entity.handle) return record.entity;

    const modelHash = record.modelHash || (typeof mp.joaat === 'function' ? mp.joaat(record.model) : record.model);
    const entity = mp.vehicles.new(modelHash, spawnPos, {
        heading: spawnHeading,
        dimension: player.dimension || 0,
    });

    entity.numberPlate = record.plate || makeVehiclePlate(player.charId, record.id);
    entity.primaryColor = parseVehicleColorIndex(record.primaryColor);
    entity.secondaryColor = parseVehicleColorIndex(record.secondaryColor);
    entity.locked = Boolean(record.locked);
    entity.engine = false;
    entity.setVariable('manualEngineOn', 0);
    entity.setVariable('manualLightsOn', 0);
    entity.setVariable('ownedVehicleId', record.id);
    entity.setVariable('ownedByCharId', player.charId);

    record.entity = entity;
    record.parked = 0;

    if (warpDriver) {
        try {
            player.putIntoVehicle(entity, -1);
        } catch (e) {
            // Ignore if warp fails because seat is occupied during race condition.
        }
    }

    return entity;
}

function persistOwnedVehicleState(record) {
    if (!record || !record.id) return;
    db.query(
        'UPDATE player_vehicles SET parked = ?, park_x = ?, park_y = ?, park_z = ?, park_h = ?, locked = ?, primary_color = ?, secondary_color = ? WHERE id = ?',
        [
            record.parked ? 1 : 0,
            record.parkX,
            record.parkY,
            record.parkZ,
            record.parkH,
            record.locked ? 1 : 0,
            parseVehicleColorIndex(record.primaryColor),
            parseVehicleColorIndex(record.secondaryColor),
            record.id,
        ]
    );
}

function parkOwnedVehicle(record, parkPos, parkHeading = DEALERSHIP_DELIVERY_HEADING) {
    if (!record) return;
    if (!parkPos) {
        parkPos = new mp.Vector3(DEALERSHIP_DELIVERY_POS.x, DEALERSHIP_DELIVERY_POS.y, DEALERSHIP_DELIVERY_POS.z);
    }
    record.parked = 1;
    record.parkX = parkPos.x;
    record.parkY = parkPos.y;
    record.parkZ = parkPos.z;
    record.parkH = parkHeading;

    // Destroy blip if it exists.
    if (record.blip) {
        try { record.blip.destroy(); } catch (e) { }
        record.blip = null;
    }

    if (record.entity) {
        try { record.entity.destroy(); } catch (e) { console.error('[VEHICLES] destroy error:', e.message); }
    }

    record.entity = null;
    persistOwnedVehicleState(record);
}

function cleanupReachedVehicleBlipsForPlayer(player, reachDistance = 20.0) {
    if (!player || !player.charId) return;
    ensureOwnedVehicleState(player);

    for (const record of player.ownedVehicles.values()) {
        if (!record || !record.blip || !record.entity || !record.entity.handle) continue;

        const dist = getDistanceBetweenPositions(player.position, record.entity.position);
        if (dist <= reachDistance) {
            try { record.blip.destroy(); } catch (e) { }
            record.blip = null;
        }
    }
}

function ensureVehicleMarkerCleanupTimer(player) {
    if (!player || !player.charId) return;
    if (player.vehicleMarkerTimer) return;

    player.vehicleMarkerTimer = setInterval(() => {
        cleanupReachedVehicleBlipsForPlayer(player, 20.0);
    }, 2000);
}

function cleanupPlayerOwnedVehicles(player, forceParked = true) {
    if (!player || !(player.ownedVehicles instanceof Map)) return;

    player.ownedVehicles.forEach((record) => {
        if (!record) return;
        if (record.entity && record.entity.handle) {
            if (forceParked) {
                const position = record.entity.position || DEALERSHIP_DELIVERY_POS;
                const heading = Number.isFinite(record.entity.heading) ? record.entity.heading : DEALERSHIP_DELIVERY_HEADING;
                record.parked = 1;
                record.parkX = position.x;
                record.parkY = position.y;
                record.parkZ = position.z;
                record.parkH = heading;
            }

            record.entity.destroy();
            record.entity = null;
            persistOwnedVehicleState(record);
            return;
        }

        if (forceParked) {
            record.parked = 1;
            persistOwnedVehicleState(record);
        }
    });
}

function loadOwnedVehiclesForPlayer(player) {
    if (!player || !player.charId) return;
    ensureOwnedVehicleState(player);
    player.ownedVehicles.clear();

    db.query('SELECT * FROM player_vehicles WHERE char_id = ? ORDER BY id ASC', [player.charId], (err, rows) => {
        if (err) {
            console.error('[VEHICLES] Failed to load owned vehicles:', err.message);
            return;
        }

        rows.forEach((row) => {
            const record = {
                id: row.id,
                charId: row.char_id,
                model: row.model,
                modelHash: row.model_hash,
                displayName: row.display_name,
                price: row.price,
                primaryColor: row.primary_color,
                secondaryColor: row.secondary_color,
                parked: row.parked,
                parkX: row.park_x,
                parkY: row.park_y,
                parkZ: row.park_z,
                parkH: row.park_h,
                locked: row.locked,
                plate: row.plate,
                entity: null,
                blip: null,
            };

            player.ownedVehicles.set(record.id, record);
        });

        player.outputChatBox(`!{#7aa164}Jusu transportas ikeltas: ${rows.length}. Naudokite /buypark ir /get.`);
    });
}

function loadParkLocationsForPlayer(player) {
    if (!player || !player.charId) return;
    ensureParkLocationState(player);
    player.parkLocationsByVehicleId.clear();

    db.query('SELECT vehicle_id, park_x, park_y, park_z FROM player_vehicle_park_locations WHERE char_id = ?', [player.charId], (err, rows) => {
        if (err) {
            console.error('[VEHICLES] Failed to load park locations:', err.message);
            return;
        }

        if (!rows || rows.length === 0) return;
        rows.forEach((row) => {
            const vehicleId = Number(row.vehicle_id);
            if (!Number.isFinite(vehicleId)) return;
            player.parkLocationsByVehicleId.set(vehicleId, {
                x: row.park_x,
                y: row.park_y,
                z: row.park_z,
            });
        });
    });
}

function generateInventoryItemId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createInventoryItem(type, quantity = 1, existingId = null) {
    const definition = INVENTORY_ITEM_DEFS[type];
    if (!definition) return null;

    return {
        id: existingId || generateInventoryItemId(),
        type,
        name: definition.name,
        description: definition.description,
        icon: definition.icon || '📦',
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        usable: definition.usable !== false,
        droppable: definition.droppable !== false,
        giveable: definition.giveable !== false,
    };
}

function normalizeInventoryItemType(inputType) {
    if (!inputType || typeof inputType !== 'string') return null;
    const key = inputType.trim().toLowerCase();
    return INVENTORY_ITEM_ALIASES[key] || null;
}

function normalizeInventoryItems(items) {
    if (!Array.isArray(items)) return [];

    const merged = new Map();

    items.forEach((rawItem) => {
        if (!rawItem) return;

        const type = typeof rawItem.type === 'string' ? rawItem.type.toLowerCase() : '';
        const normalized = createInventoryItem(type, rawItem.quantity, rawItem.id);
        if (!normalized) return;

        if (merged.has(normalized.type)) {
            merged.get(normalized.type).quantity += normalized.quantity;
            return;
        }

        merged.set(normalized.type, normalized);
    });

    return Array.from(merged.values());
}

function loadInventory(rawInventory) {
    if (rawInventory === null || rawInventory === undefined || rawInventory === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(rawInventory);
        return normalizeInventoryItems(parsed);
    } catch (error) {
        console.error('[INVENTORY] Failed to parse inventory JSON:', error.message);
        return [];
    }
}

function getInventoryJson(player) {
    return JSON.stringify(Array.isArray(player.inventory) ? player.inventory : []);
}

function persistInventory(player) {
    if (!player || !player.charId) return;

    db.query('UPDATE characters SET inventory = ? WHERE id = ?', [getInventoryJson(player), player.charId], (err) => {
        if (err) {
            console.error('[INVENTORY] Failed to save inventory:', err.message);
        }
    });
}

function sendInventoryUpdate(player, statusText = '', success = true) {
    if (!player) return;
    player.call('updateInventoryUI', [getInventoryJson(player), statusText, success]);
}

function openInventory(player, statusText = '') {
    if (!player || !player.charName) {
        if (player) {
            player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
        }
        return;
    }

    if (!Array.isArray(player.inventory)) {
        player.inventory = [];
    }

    player.call('openInventoryUI', [getInventoryJson(player), statusText]);
}

function formatInventoryAmount(itemName, amount) {
    return `${amount}x ${itemName}`;
}

function getInventoryItemById(player, itemId) {
    if (!player || !Array.isArray(player.inventory)) return null;
    const index = player.inventory.findIndex(item => item && item.id === itemId);
    if (index === -1) return null;
    return {
        index,
        item: player.inventory[index],
    };
}

function addInventoryItem(player, type, amount) {
    if (!player || !Array.isArray(player.inventory)) return null;

    const quantity = Math.max(1, parseInt(amount, 10) || 1);
    const existingItem = player.inventory.find(item => item.type === type);
    if (existingItem) {
        existingItem.quantity += quantity;
        return existingItem;
    }

    const item = createInventoryItem(type, quantity);
    if (item) {
        player.inventory.push(item);
    }
    return item;
}

function removeInventoryItemAmount(player, itemId, amount) {
    const itemEntry = getInventoryItemById(player, itemId);
    if (!itemEntry) return null;

    const quantity = Math.max(1, parseInt(amount, 10) || 1);
    if (itemEntry.item.quantity < quantity) return null;

    itemEntry.item.quantity -= quantity;
    if (itemEntry.item.quantity <= 0) {
        player.inventory.splice(itemEntry.index, 1);
    }

    return itemEntry.item;
}

function broadcastInventoryAction(player, message) {
    if (!player || !player.position || !player.charName) return;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(`!{#f7dc6f}${message}`);
    });
}

function startCall(caller, target) {
    if (!caller || !target || caller.id === target.id) return false;
    if (!caller.charName || !target.charName) return false;
    if (activeCalls.has(caller.id) || activeCalls.has(target.id)) return false;

    const callData = { caller: caller, target: target, status: 'ringing' };
    activeCalls.set(caller.id, callData);
    activeCalls.set(target.id, { caller: caller, target: target, status: 'incoming' });

    caller.outputChatBox(`!{#f7dc6f}Skambinate ${target.charName} (${target.phoneNumber})...`);
    target.outputChatBox(`!{#f7dc6f}Jums skambina ${caller.charName} (${caller.phoneNumber}). Naudokite /answer arba /decline.`);
    target.call('incomingCall', [caller.charName, caller.phoneNumber]);
    return true;
}


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ragemp_mod'
});


db.connect((err) => {
    if (err) {
        console.error('MySQL Connection Failed:', err);
    } else {
        console.log('Connected to MySQL Database!');
        // Ensure Twitter schema exists
        db.query(`CREATE TABLE IF NOT EXISTS twitter_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            char_id INT NOT NULL,
            handle VARCHAR(50) UNIQUE NOT NULL,
            FOREIGN KEY (char_id) REFERENCES characters(id)
        )`, (err) => {
            if (err) console.error('Error creating twitter_accounts table:', err);
            else console.log('Twitter accounts table ready.');
        });
        db.query(`CREATE TABLE IF NOT EXISTS twitter_posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            char_id INT NOT NULL,
            handle VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating twitter_posts table:', err);
            else console.log('Twitter posts table ready.');
        });

        // Clothing system — add column if it didn't exist yet
        db.query('ALTER TABLE characters ADD COLUMN clothes TEXT DEFAULT NULL', (err) => {
            if (err && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('[CLOTHES] Failed to add clothes column:', err.message);
            } else {
                console.log('[CLOTHES] Clothes column ready.');
            }
        });

        db.query('ALTER TABLE characters ADD COLUMN barber TEXT DEFAULT NULL', (err) => {
            if (err && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BARBER] Failed to add barber column:', err.message);
            } else {
                console.log('[BARBER] Barber column ready.');
            }
        });

        db.query('ALTER TABLE characters ADD COLUMN inventory TEXT DEFAULT NULL', (err) => {
            if (err && err.code !== 'ER_DUP_FIELDNAME') {
                console.error('[INVENTORY] Failed to add inventory column:', err.message);
            } else {
                console.log('[INVENTORY] Inventory column ready.');
            }
        });

        db.query(`CREATE TABLE IF NOT EXISTS player_vehicles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            char_id INT NOT NULL,
            model VARCHAR(40) NOT NULL,
            model_hash INT NOT NULL,
            display_name VARCHAR(64) NOT NULL,
            price INT NOT NULL DEFAULT 0,
            primary_color INT NOT NULL DEFAULT 0,
            secondary_color INT NOT NULL DEFAULT 0,
            parked TINYINT(1) NOT NULL DEFAULT 1,
            park_x FLOAT NULL,
            park_y FLOAT NULL,
            park_z FLOAT NULL,
            park_h FLOAT NULL,
            locked TINYINT(1) NOT NULL DEFAULT 0,
            plate VARCHAR(16) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_player_vehicles_char_id (char_id),
            CONSTRAINT fk_player_vehicles_char FOREIGN KEY (char_id) REFERENCES characters(id) ON DELETE CASCADE
        )`, (createErr) => {
            if (createErr) {
                console.error('[VEHICLES] Failed to create player_vehicles table:', createErr.message);
            } else {
                console.log('[VEHICLES] player_vehicles table ready.');
            }
        });

        db.query(`CREATE TABLE IF NOT EXISTS player_vehicle_park_locations (
            vehicle_id INT NOT NULL PRIMARY KEY,
            char_id INT NOT NULL,
            park_x FLOAT NOT NULL,
            park_y FLOAT NOT NULL,
            park_z FLOAT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_player_vehicle_park_char_id (char_id),
            CONSTRAINT fk_player_vehicle_park_char FOREIGN KEY (char_id) REFERENCES characters(id) ON DELETE CASCADE,
            CONSTRAINT fk_player_vehicle_park_vehicle FOREIGN KEY (vehicle_id) REFERENCES player_vehicles(id) ON DELETE CASCADE
        )`, (createErr) => {
            if (createErr) {
                console.error('[VEHICLES] Failed to create player_vehicle_park_locations table:', createErr.message);
            } else {
                console.log('[VEHICLES] player_vehicle_park_locations table ready.');
            }
        });
    }
});

module.exports = db;

// Store player-specific time info
let playerTimeInfo = {};

mp.events.add('playerConnect', (player) => {
    const ip = player.ip;

    db.query('SELECT * FROM bans WHERE ip = ?', [ip], (error, results) => {
        if (error) {
            console.log('[KLAIDA] Įvyko klaida tikrinant žaidėjo IP');
            return;
        }

        if (results.length > 0) {
            const reason = results[0].reason || "Nenurodyta priežastis";
            player.outputChatBox(`[INFO] Jūs esate užblokuotas. Priežastis: ${reason}`);
            player.kick(`[KICK] Jūs buvote užblokuotas. Priežastis: ${reason}`);
        } else {
            console.log(`Žaidėjas (UCP: ${player.name}) prisijungė prie serverio.`);
        }
    });
});

mp.events.add('playerJoin', (player) => {
    player.call('openLoginUI');
    player.call('hideDefaultCashUI');

    if (!playerTimeInfo[player.id]) {
        playerTimeInfo[player.id] = {};
    }

    playerTimeInfo[player.id].interval = setInterval(() => {
        const serverTime = moment().tz('Europe/Vilnius').format('YYYY-MM-DD HH:mm:ss');
        player.call('updateServerTime', [serverTime]);
    }, 1000);

    console.log(`Žaidėjas (UCP: ${player.name}) prisijungė prie serverio.`);
});

mp.events.add('validateLogin', (player, username, password) => {
    db.query('SELECT * FROM players WHERE name = ?', [username], (err, results) => {
        if (err) {
            console.error('[DATABASE ERROR]', err);
            player.call('login:error', ['⚠️ Duomenų bazės klaida! Bandykite vėliau.']);
            return;
        }

        if (results.length === 0) {
            console.log(`[LOGIN FAILED] Username "${username}" not found.`);
            player.call('login:error', ['❌ Vartotojo vardas nerastas!']);
            return;
        }

        const storedPassword = results[0].password;

        bcrypt.compare(password, storedPassword, (err, isMatch) => {
            if (err) {
                console.error('[BCRYPT ERROR]', err);
                player.call('login:error', ['⚠️ Klaida tikrinant slaptažodį. Bandykite dar kartą.']);
                return;
            }

            if (isMatch) {
                console.log(`[LOGIN SUCCESS] User "${username}" logged in.`);
                player.name = username; // UCP username
                player.call('login:success');
                loadCharacterSelection(player);
            } else {
                console.log(`[LOGIN FAILED] Incorrect password for "${username}".`);
                player.call('login:error', ['❌ Neteisingas slaptažodis!']);
            }
        });
    });
});

function loadCharacterSelection(player) {
    db.query('SELECT id, char_name, money, bank_balance, playtime, health FROM characters WHERE ucp_username = ?',
        [player.name], (err, results) => {
            if (err) {
                console.error('[KLAIDA] Veikėjų sąrašas nepakrautas:', err);
                player.outputChatBox('⚠️ Klaida kraunant veikėjus. Susisiekite su administratoriumi.');
                return;
            }

            const characterCount = results.length;
            if (characterCount === 0) {
                player.outputChatBox('!{#f7dc6f}Jūs neturite veikėjų. Sukurkite juos UCP (californiarp.lt/ucp)!');
                return;
            }

            const characters = results.map(row => ({
                id: row.id,
                name: row.char_name,
                money: row.money,
                bankBalance: row.bank_balance,
                playtime: row.playtime,
                playtimeFormatted: Math.floor(row.playtime / 60) + ' val. ' + (row.playtime % 60) + ' min.',
                health: row.health
            }));

            player.call('showCharacterSelectionUI', [JSON.stringify(characters)]);
        });
}

mp.events.add('selectCharacter', (player, charId) => {
    db.query('SELECT * FROM characters WHERE id = ? AND ucp_username = ?', [charId, player.name], (err, results) => {
        if (err || results.length === 0) {
            console.error('[KLAIDA] Veikėjas nerastas:', err);
            player.outputChatBox('⚠️ Klaida pasirenkant veikėją.');
            return;
        }

        const charData = results[0];
        player.charId = charData.id;
        player.charName = charData.char_name;
        player.adminName = charData.admin_name || charData.char_name; // Use admin_name if set, otherwise char_name
        player.health = charData.health;
        player.money = charData.money;
        player.bankBalance = charData.bank_balance;
        player.playtime = charData.playtime;
        const posX = parseFloat(charData.position_x);
        const posY = parseFloat(charData.position_y);
        const posZ = parseFloat(charData.position_z);
        const hasSavedPosition = Number.isFinite(posX) && Number.isFinite(posY) && Number.isFinite(posZ);
        player.position = hasSavedPosition ? new mp.Vector3(posX, posY, posZ) : player.position;
        player.isPMEnabled = charData.is_pm_enabled;
        player.adminLevel = charData.admin_level;
        player.phoneNumber = charData.phone_number;
        player.inventory = loadInventory(charData.inventory);
        if (charData.inventory === null || charData.inventory === undefined || charData.inventory === '') {
            persistInventory(player);
        }

        // Load bank account (now tied to char_name)
        db.query('SELECT * FROM bank_accounts WHERE char_name = ?', [player.charName], (err, bankResults) => {
            if (err) {
                console.error('[KLAIDA] Banko sąskaita nepakrauta:', err);
                player.outputChatBox('⚠️ Klaida kraunant banko duomenis.');
                return;
            }

            if (bankResults.length === 0) {
                db.query('INSERT INTO bank_accounts (char_name, balance) VALUES (?, ?)', [player.charName, 0]);
                player.bankBalance = 0;
            } else {
                player.bankBalance = bankResults[0].balance;
            }
            player.call('updateBankHUD', [player.bankBalance]);
        });

        player.spawn(player.position);

        // Apply saved clothes
        if (charData.clothes) {
            try {
                const savedClothes = JSON.parse(charData.clothes);
                player.outfitData = savedClothes;
                for (const [comp, data] of Object.entries(savedClothes)) {
                    player.setClothes(parseInt(comp), parseInt(data.d) || 0, parseInt(data.t) || 0, 2);
                }
            } catch (e) {
                console.error('[CLOTHES] Failed to apply clothes for', charData.char_name, e.message);
            }
        } else {
            player.outfitData = {};
        }

        const defaultBarber = {
            hairStyle: 0,
            hairColor: 0,
            hairHighlight: 0,
            beardStyle: -1,
            beardOpacity: 10,
        };

        if (charData.barber) {
            try {
                player.barberData = JSON.parse(charData.barber);
            } catch (e) {
                player.barberData = defaultBarber;
            }
        } else {
            player.barberData = defaultBarber;
        }

        player.call('applyBarberAppearance', [JSON.stringify(player.barberData)]);

        player.call('updateMoneyHUD', [player.money]);
        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updatePhoneNumber', [player.phoneNumber]);
        player.outputChatBox(`!{#7aa164}Pasirinkote veikėją: ${charData.char_name}. Sveiki atvykę į CaliforniaRP.LT!`);

        loadCharacterContacts(player);
        loadOwnedVehiclesForPlayer(player);
        loadParkLocationsForPlayer(player);

        if (!player.timer) {
            player.timer = setInterval(() => {
                player.playtime += 1;
                if (player.playtime % 30 === 0) {
                    const paycheckAmount = 1000;
                    player.bankBalance += paycheckAmount;
                    player.call('showPaycheckPopup', [paycheckAmount]);
                    db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
                    db.query('UPDATE characters SET playtime = ? WHERE id = ?', [player.playtime, player.charId]);
                    player.outputChatBox(`!{#229954}Jūsų atlyginimas ($${paycheckAmount}) pervestas į banko sąskaitą.`);
                    player.call('updateBankHUD', [player.bankBalance]);
                }
            }, 60000);
        }

        // Start periodic saving (every 5 minutes)
        if (!player.saveTimer) {
            player.saveTimer = setInterval(() => {
                saveCharacterData(player);
            }, 300000); // 5 minutes
        }

        ensureVehicleMarkerCleanupTimer(player);

        console.log(`[VEIKĖJAS] ${player.name} pasirinko veikėją ${charData.char_name}`);
    });
});


// Ensure loadCharacterContacts sends the update to the client
function loadCharacterContacts(player) {
    if (!player.charId) return;

    db.query('SELECT contact_name, contact_number FROM contacts WHERE char_id = ?', [player.charId], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko įkelti kontaktų:', err);
            return;
        }
        const contacts = results.map(row => ({ name: row.contact_name, number: row.contact_number }));
        player.contacts = contacts;
        console.log(`[DEBUG] Loaded contacts for charId ${player.charId}:`, contacts);

        // Ensure the UI updates even if the phone isn't open yet
        player.call('updateContactsUI', [JSON.stringify(contacts)]);
    });
}

// Function to save character data
function saveCharacterData(player) {
    if (player.charId) {
        const currentPos = player.position;
        const inventoryJson = getInventoryJson(player);
        const hasValidPosition = currentPos
            && Number.isFinite(currentPos.x)
            && Number.isFinite(currentPos.y)
            && Number.isFinite(currentPos.z);

        if (!hasValidPosition) {
            console.warn(`[VEIKEJAS] Invalid position for ${player.charName || player.name}, preserving last saved coordinates.`);
            db.query('UPDATE characters SET playtime = ?, money = ?, bank_balance = ?, health = ?, is_pm_enabled = ?, phone_number = ?, inventory = ? WHERE id = ?',
                [player.playtime || 0, player.money || 0, player.bankBalance || 0, player.health || 100, player.isPMEnabled ? 1 : 0, player.phoneNumber, inventoryJson, player.charId],
                (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko išsaugoti veikėjo duomenų:', err);
                    } else {
                        console.log(`[VEIKĖJAS] ${player.charName} duomenys išsaugoti sėkmingai.`);
                    }
                });
        } else {
            db.query('UPDATE characters SET playtime = ?, money = ?, bank_balance = ?, position_x = ?, position_y = ?, position_z = ?, health = ?, is_pm_enabled = ?, phone_number = ?, inventory = ? WHERE id = ?',
                [player.playtime || 0, player.money || 0, player.bankBalance || 0, currentPos.x, currentPos.y, currentPos.z, player.health || 100, player.isPMEnabled ? 1 : 0, player.phoneNumber, inventoryJson, player.charId],
                (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko išsaugoti veikėjo duomenų:', err);
                    } else {
                        console.log(`[VEIKĖJAS] ${player.charName} duomenys išsaugoti sėkmingai.`);
                    }
                });
        }

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance || 0, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko išsaugoti banko sąskaitos:', err);
            }
        });
    }
}

let isShutdownSaveInProgress = false;

function saveAllOnlineCharacters(reason) {
    if (isShutdownSaveInProgress) return;
    isShutdownSaveInProgress = true;

    try {
        let savedCount = 0;
        mp.players.forEach((player) => {
            if (!player || !player.charId) return;
            saveCharacterData(player);
            savedCount += 1;
        });
        console.log(`[VEIKEJAS] Shutdown save (${reason}): saved ${savedCount} online characters.`);
    } catch (err) {
        console.error('[VEIKEJAS] Shutdown save failed:', err);
    }
}

process.on('SIGINT', () => {
    saveAllOnlineCharacters('SIGINT');
    setTimeout(() => process.exit(0), 1200);
});

process.on('SIGTERM', () => {
    saveAllOnlineCharacters('SIGTERM');
    setTimeout(() => process.exit(0), 1200);
});

process.on('beforeExit', () => {
    saveAllOnlineCharacters('beforeExit');
});

// World time sync
setInterval(() => {
    const currentHour = moment().tz('Europe/Vilnius').hour();
    if (currentHour >= 20 || currentHour < 6) {
        mp.world.time.hour = 0;
        mp.world.time.minute = 0;
    } else {
        mp.world.time.hour = 12;
        mp.world.time.minute = 0;
    }
}, 60000);

// Chat and Commands
const messageColor = "#c2749d";

mp.events.addCommand('me', (player, _, ...action) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (action.length === 0) {
        player.outputChatBox('Naudojimas: /me <veiksmas>');
        return;
    }

    const actionMessage = action.join(' ');
    const message = `!{${messageColor}}* ${player.charName} ${actionMessage}`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('do', (player, _, ...description) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (description.length === 0) {
        player.outputChatBox('Naudojimas: /do <apibudinimas>');
        return;
    }

    const descriptionMessage = description.join(' ');
    const message = `!{${messageColor}}* ${descriptionMessage} ((${player.charName}))`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('s', (player, _, ...shoutMessage) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (shoutMessage.length === 0) {
        player.outputChatBox('Naudojimas: /s <žodis>');
        return;
    }

    const shoutText = shoutMessage.join(' ');
    const message = `* ${player.charName} šaukia: ${shoutText}`;

    mp.players.forEachInRange(player.position, 50, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('low', (player, _, ...whisperMessage) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (whisperMessage.length === 0) {
        player.outputChatBox('Naudojimas: /low <žodis>');
        return;
    }

    const whisperText = whisperMessage.join(' ');
    const whisperColor = "#A0A0A0";
    const message = `!{${whisperColor}}* ${player.charName} šnabžda: ${whisperText}`;

    mp.players.forEachInRange(player.position, 5, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});


mp.events.add('playerChat', (player, text) => {
    if (!player.charName) return;
    if (!text || text.trim().length === 0) return;

    const isOnCall = activeCalls.has(player.id) && activeCalls.get(player.id).status === 'active';
    const proximityPrefix = isOnCall ? '!{#e8dc27}[Skambutis]' : '';
    const proximityMessage = `${proximityPrefix}${player.charName} sako: ${text}`;
    const callMessage = `!{#e8dc27}[Skambutis] ${player.charName}: ${text}`;

    // Send to players in proximity (including the player themselves)
    mp.players.forEachInRange(player.position, 20.0, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(proximityMessage);
    });

    // If on a call, also send to the call partner with [Skambutis] prefix
    if (isOnCall) {
        const callData = activeCalls.get(player.id);
        const partner = (callData.caller === player) ? callData.target : callData.caller;
        if (partner && partner !== player) { // Ensure partner exists and isn’t the same player
            partner.outputChatBox(callMessage);
            console.log(`[DEBUG] Call chat to partner: ${player.charName} -> ${partner.charName}: ${text}`);
        }
    }

    console.log(`[DEBUG] Chat: ${player.charName} says "${text}" (on call: ${isOnCall})`);
});

mp.events.addCommand('b', (player, _, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (messageArray.length === 0) {
        player.outputChatBox(`!{#B0C4DE}Naudojimas: /b [žinutė] - Nusiusti OOC žinutę šalia esantiems žaidėjams.`);
        return;
    }

    const message = messageArray.join(" ");
    const chatMessage = `((${player.charName}: ${message}))`;

    mp.players.forEachInRange(player.position, 10, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(chatMessage);
    });
});

mp.events.addCommand('help', (player) => {
    player.outputChatBox(`!{#ADD8E6}----- Galimos komandos -----`);
    player.outputChatBox(`ROLEPLAY KOMANDOS - /me, /do, /b, /s, /low, /pm, /id, /try`);
    player.outputChatBox(`KITOS KOMANDOS - /stats, /pay, /bank, /withdraw, /deposit`);
    player.outputChatBox(`KITOS KOMANDOS - /togglepm, /time, /barber, /changeclothes, /inv`);
    player.outputChatBox(`KITOS KOMANDOS - /changechar, /report, /admins`);
    player.outputChatBox(`TRANSPORTAS - /buyvehicle, /buypark, /vehicles, /get, /park, /lock`);
    player.outputChatBox(`!{#ADD8E6}----------------------------`);
    player.outputChatBox(`Įvedus komandą gausite komandos paaiškinimą.`);
    player.outputChatBox(`Daugiau informacijos galite rasti mūsų forume arba /helpme <klausimas>.`);
});

mp.events.addCommand('id', (player, fullText, partialName) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!partialName) {
        player.outputChatBox(`Jūsų žaidėjo ID: ${player.id}`);
    } else {
        const matchingPlayers = mp.players.toArray().filter(p => p.charName && p.charName.toLowerCase().includes(partialName.toLowerCase()));
        if (matchingPlayers.length === 0) {
            player.outputChatBox(`Nerastas žaidėjas "${partialName}".`);
        } else {
            matchingPlayers.forEach(target => {
                player.outputChatBox(`ID: ${target.id} | Vardas: ${target.charName}`);
            });
        }
    }
});

mp.events.addCommand('pm', (player, fullText, targetIdentifier, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier || messageArray.length === 0) {
        player.outputChatBox(`Naudojimas: /pm [ID ar dalis vardo] [žinutė]`);
        return;
    }

    const message = messageArray.join(" ");
    let target;

    target = getPlayerByIDOrName(targetIdentifier);

    if (!target) {
        player.outputChatBox(`Nerastas žaidėjas vardu "${targetIdentifier}".`);
        return;
    }

    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
        return;
    }

    if (!target.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Žaidėjas šiuo metu yra išjungęs privačias žinutes.');
        return;
    }

    if (!player.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Jūs išjungėte privačias žinutes ir negalite jų siųsti.');
        return;
    }

    if (target) {
        target.outputChatBox(`!{#FFFF00}((PM iš ${player.charName}: ${message}))`);
        player.outputChatBox(`!{#FFFF00}((PM nusiųsta ${target.charName}: ${message}))`);
    } else {
        player.outputChatBox(`Žaidėjas "${targetIdentifier}" nerastas.`);
    }
});

mp.events.addCommand('stats', player => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    player.outputChatBox(`!{#f7dc6f}===== Jūsų informacija =====`);
    player.outputChatBox(`UCP vartotojo vardas: ${player.name}, Veikėjo vardas: ${player.charName}`); // Show UCP username
    player.outputChatBox(`------------------------------------------------------`);
    player.outputChatBox(`Telefono numeris: ${player.phoneNumber || 'Nėra'}`);
    player.outputChatBox(`Gyvybės: ${player.health}, Žaidimo laikas: ${Math.floor(player.playtime / 60)} val. ${player.playtime % 60} min.`);
    player.outputChatBox(`Grynieji pinigai: $${player.money}, Banko sąskaitos balansas: $${player.bankBalance}`);
});

mp.events.addCommand('try', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox('Naudojimas: /try [veiksmas]');
        return;
    }

    const success = Math.random() < 0.5;
    const outcome = success ? 'pavyko' : 'nepavyko';
    const message = `${player.charName} bando ${fullText} ir jam ${outcome}.`;

    const nearbyPlayers = mp.players.toArray().filter(target => {
        const distance = Math.sqrt(
            Math.pow(player.position.x - target.position.x, 2) +
            Math.pow(player.position.y - target.position.y, 2) +
            Math.pow(player.position.z - target.position.z, 2)
        );
        return distance <= 10;
    });

    nearbyPlayers.forEach(target => {
        target.outputChatBox(`!{#c2749d}${message}`);
    });
});

mp.events.addCommand('time', (player) => {
    const serverTime = moment().tz('Europe/Vilnius').format('YYYY-MM-DD HH:mm:ss');
    player.outputChatBox(`!{#f4f4f4}Dabartinis serverio laikas: ${serverTime}`);
});

const knownCommands = new Set([
    'me', 'do', 's', 'low', 'b', 'help', 'id', 'pm', 'stats', 'try', 'time',
    'bank', 'withdraw', 'deposit', 'transfer', 'inventory', 'inv',
    'kick', 'freeze', 'goto', 'bring', 'ban', 'giveitem',
    'helpme', 'accepthelp', 'declinehelp',
    'report', 'acceptreport', 'declinereport',
    'admins', 'setaname', 'changechar', 'coords', 'createtwittertables',
    'ph', 'phone', 'acceptdrive',
    'call', 'answer', 'decline', 'hangup',
    'sharenumber', 'sms',
    'pay', 'togglepm',
    'buyvehicle', 'buypark', 'vehicles', 'park', 'get', 'lock'
]);

mp.events.add('playerCommand', (player, command) => {
    const cmd = command.trim().split(' ')[0].toLowerCase();
    if (!knownCommands.has(cmd)) {
        player.outputChatBox('!{#e74c3c}Ši komanda neegzistuoja. Naudokite /help arba /helpme');
    }
});

mp.events.addCommand('pay', (player, fullText, targetNameOrID, amountStr) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetNameOrID || !amountStr) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pay [ID arba vardas] [suma]');
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return player.outputChatBox('!{#f7dc6f}Prašome nurodyti galiojančią sumą.');
    }

    const targetPlayer = getPlayerByIDOrName(targetNameOrID);
    if (!targetPlayer) {
        return player.outputChatBox('!{#f7dc6f}Žaidėjas nerastas!');
    }

    if (!targetPlayer.charName) {
        return player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
    }

    if (player === targetPlayer) {
        return player.outputChatBox('!{#f7dc6f}Negalite pervesti pinigų patys sau!');
    }

    const distance = getDistanceBetweenPositions(player.position, targetPlayer.position);
    if (distance > 5) {
        return player.outputChatBox('!{#f7dc6f}Jūs turite būti šalia kito žaidėjo, kad atliktumėte pervedimą.');
    }

    if (player.money < amount) {
        return player.outputChatBox('!{#f7dc6f}Jūs neturite pakankamai pinigų!');
    }

    player.money -= amount;
    targetPlayer.money += amount;

    player.call('updateMoneyHUD', [player.money]);
    targetPlayer.call('updateMoneyHUD', [targetPlayer.money]);

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#f7dc6f}Įvyko klaida atnaujinant jūsų paskyrą.');
        }
    });

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [targetPlayer.money, targetPlayer.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#f7dc6f}Įvyko klaida atnaujinant gavėjo paskyrą.');
            return;
        }
        player.outputChatBox(`!{#f7dc6f}Jūs pervedėte $${amount} žaidėjui ${targetPlayer.charName}.`);
        targetPlayer.outputChatBox(`!{#f7dc6f}Jūs gavote $${amount} iš žaidėjo ${player.charName}.`);
    });
});

mp.events.addCommand('togglepm', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    player.isPMEnabled = !player.isPMEnabled;

    if (player.isPMEnabled) {
        player.outputChatBox('!{#27AE60}Jūs įjungėte privačias žinutes.');
    } else {
        player.outputChatBox('!{#E74C3C}Jūs išjungėte privačias žinutes.');
    }

    db.query('UPDATE characters SET is_pm_enabled = ? WHERE char_name = ?', [player.isPMEnabled ? 1 : 0, player.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#E74C3C}Įvyko klaida atnaujinant jūsų privačias žinutes.');
        }
    });
});

function showVehicleCatalogToPlayer(player) {
    player.outputChatBox('!{#85c1e9}===== Los Santos Dealership =====');
    VEHICLE_CATALOG.forEach((entry, index) => {
        player.outputChatBox(`!{#d6eaf8}[${index + 1}] ${entry.name} (${entry.model}) - $${entry.price}`);
    });
    player.outputChatBox('!{#f7dc6f}Naudojimas: /buyvehicle [katalogo ID] [primaryColor] [secondaryColor] [cash|bank]');
    player.outputChatBox('!{#f7dc6f}Spalvu ribos: 0-160. Pavyzdys: /buyvehicle 1 120 120 bank');
}

function openDealershipUI(player) {
    if (!player || !player.charId || !player.charName) {
        return;
    }

    const catalogPayload = VEHICLE_CATALOG.map((entry, index) => ({
        id: index + 1,
        key: entry.key,
        name: entry.name,
        model: entry.model,
        price: entry.price,
    }));

    player.call('openDealershipUI', [JSON.stringify(catalogPayload), player.money || 0, player.bankBalance || 0]);
}

function cleanupLegacyDealershipPreviewVehicles() {
    try {
        mp.vehicles.forEach((vehicle) => {
            if (!vehicle || !vehicle.handle) return;
            if (vehicle.numberPlate === 'PREVIEW') {
                vehicle.destroy();
            }
        });
    } catch (error) {
        console.error('[VEHICLES] Failed to cleanup legacy preview vehicles:', error.message);
    }
}

function purchaseVehicleForPlayer(player, selected, primaryColorRaw = '0', secondaryColorRaw = '0', viaUi = false, paymentMethodRaw = 'cash') {
    if (!player || !selected) return;

    const paymentMethod = String(paymentMethodRaw || 'cash').trim().toLowerCase() === 'bank' ? 'bank' : 'cash';
    const availableFunds = paymentMethod === 'bank' ? (player.bankBalance || 0) : (player.money || 0);

    if (availableFunds < selected.price) {
        const shortLabel = paymentMethod === 'bank' ? 'banke' : 'grynuju';
        const message = `Nepakanka pinigu (${shortLabel}). Truksta $${selected.price - availableFunds}.`;
        if (viaUi) {
            player.call('dealershipPurchaseResult', [false, message, player.money || 0, player.bankBalance || 0]);
            return;
        }
        player.outputChatBox(`!{#e74c3c}${message}`);
        return;
    }

    const primaryColor = parseVehicleColorIndex(primaryColorRaw);
    const secondaryColor = parseVehicleColorIndex(secondaryColorRaw);
    const modelHash = typeof mp.joaat === 'function' ? mp.joaat(selected.model) : selected.model;

    if (paymentMethod === 'bank') {
        player.bankBalance -= selected.price;
        player.call('updateBankHUD', [player.bankBalance]);
        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
    } else {
        player.money -= selected.price;
        player.call('updateMoneyHUD', [player.money]);
        db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);
    }

    db.query(
        'INSERT INTO player_vehicles (char_id, model, model_hash, display_name, price, primary_color, secondary_color, parked, park_x, park_y, park_z, park_h, locked, plate) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)',
        [
            player.charId,
            selected.model,
            modelHash,
            selected.name,
            selected.price,
            primaryColor,
            secondaryColor,
            DEALERSHIP_PURCHASE_SPAWN_POS.x,
            DEALERSHIP_PURCHASE_SPAWN_POS.y,
            DEALERSHIP_PURCHASE_SPAWN_POS.z,
            DEALERSHIP_DELIVERY_HEADING,
            'TEMP',
        ],
        (insertErr, result) => {
            if (insertErr) {
                console.error('[VEHICLES] Purchase insert failed:', insertErr.message);
                if (paymentMethod === 'bank') {
                    player.bankBalance += selected.price;
                    player.call('updateBankHUD', [player.bankBalance]);
                    db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
                } else {
                    player.money += selected.price;
                    player.call('updateMoneyHUD', [player.money]);
                    db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);
                }

                if (viaUi) {
                    player.call('dealershipPurchaseResult', [false, 'Nepavyko nusipirkti transporto.', player.money || 0, player.bankBalance || 0]);
                    return;
                }

                player.outputChatBox('!{#e74c3c}Nepavyko nusipirkti transporto.');
                return;
            }

            const newVehicleId = result.insertId;
            const plate = makeVehiclePlate(player.charId, newVehicleId);

            db.query('UPDATE player_vehicles SET plate = ? WHERE id = ?', [plate, newVehicleId]);

            const record = {
                id: newVehicleId,
                charId: player.charId,
                model: selected.model,
                modelHash,
                displayName: selected.name,
                price: selected.price,
                primaryColor,
                secondaryColor,
                parked: 0,
                parkX: DEALERSHIP_PURCHASE_SPAWN_POS.x,
                parkY: DEALERSHIP_PURCHASE_SPAWN_POS.y,
                parkZ: DEALERSHIP_PURCHASE_SPAWN_POS.z,
                parkH: DEALERSHIP_DELIVERY_HEADING,
                locked: 0,
                plate,
                entity: null,
                blip: null,
            };

            ensureOwnedVehicleState(player);
            player.ownedVehicles.set(record.id, record);
            spawnOwnedVehicleForPlayer(player, record, DEALERSHIP_PURCHASE_SPAWN_POS, DEALERSHIP_DELIVERY_HEADING, true);

            if (viaUi) {
                player.call('dealershipPurchaseResult', [
                    true,
                    `Nusipirkote ${selected.name} uz $${selected.price} (${paymentMethod === 'bank' ? 'bank' : 'cash'}).`,
                    player.money || 0,
                    player.bankBalance || 0,
                ]);
                player.call('closeDealershipUI');
                player.outputChatBox(`!{#7aa164}Nusipirkote ${selected.name} uz $${selected.price}.`);
                player.outputChatBox(`!{#f7dc6f}Spalvos: primary ${primaryColor}, secondary ${secondaryColor}.`);
                player.outputChatBox('!{#f7dc6f}Naudokite /park bet kur, o veliau /get [id].');
                return;
            }

            player.outputChatBox(`!{#7aa164}Nusipirkote ${selected.name} uz $${selected.price}.`);
            player.outputChatBox(`!{#f7dc6f}Spalvos: primary ${primaryColor}, secondary ${secondaryColor}.`);
            player.outputChatBox('!{#f7dc6f}Naudokite /park bet kur, o veliau /get [id].');
        }
    );
}

function showBuyParkState(player) {
    if (!player || !player.charId) return;
    ensureOwnedVehicleState(player);
    ensureParkLocationState(player);

    player.outputChatBox('!{#f4d03f}===== Jusu garažas (Asmeninis) =====');

    if (player.ownedVehicles.size === 0) {
        player.outputChatBox('!{#f7dc6f}Jus dar neturite transporto. Pirkite su /buyvehicle prie dealership.');
        return;
    }

    player.ownedVehicles.forEach((record) => {
        const state = record.entity && record.entity.handle ? 'Isvaziuotas' : 'Pastatytas';
        const hasParkZone = player.parkLocationsByVehicleId.has(record.id) ? 'Zona: TAIP' : 'Zona: NE';
        player.outputChatBox(`!{#f9e79f}ID ${record.id} | ${record.displayName} | ${record.plate} | ${state} | ${hasParkZone}`);
    });

    player.outputChatBox('!{#f7dc6f}1) Sedekite savo transporte ir naudokite /buypark (kaina: $100) tos masinos zonai.');
    player.outputChatBox('!{#f7dc6f}2) Naudokite /get [ID] norint isspawninti butent ta masina jos zonoje.');
    player.outputChatBox('!{#f7dc6f}3) Naudokite /park sededami savo transporte jo paties zonoje.');
}

mp.events.addCommand('buyvehicle', (player, fullText) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!isNearPoint(player, DEALERSHIP_POS, DEALERSHIP_INTERACT_RADIUS)) {
        return player.outputChatBox('!{#e74c3c}Sia komanda galite naudoti tik Los Santos Dealership vietoje.');
    }

    cleanupLegacyDealershipPreviewVehicles();

    const args = String(fullText || '').trim().split(/\s+/).filter(Boolean);
    const vehicleIdRaw = args[0];
    const primaryColorRaw = args[1] || '0';
    const secondaryColorRaw = args[2] || '0';
    const paymentMethodRaw = args[3] || 'cash';

    if (!vehicleIdRaw) {
        openDealershipUI(player);
        return;
    }

    const vehicleIndex = parseInt(vehicleIdRaw, 10);
    if (!Number.isFinite(vehicleIndex) || vehicleIndex < 1 || vehicleIndex > VEHICLE_CATALOG.length) {
        player.outputChatBox('!{#e74c3c}Neteisingas katalogo ID.');
        showVehicleCatalogToPlayer(player);
        return;
    }

    const selected = VEHICLE_CATALOG[vehicleIndex - 1] || vehicleCatalogByKey.get(vehicleIdRaw.toLowerCase());
    if (!selected) {
        return player.outputChatBox('!{#e74c3c}Nerastas transportas pagal nurodyta ID.');
    }

    purchaseVehicleForPlayer(player, selected, primaryColorRaw, secondaryColorRaw, false, paymentMethodRaw);
});

mp.events.add('dealershipBuyVehicle', (player, vehicleIdRaw, primaryColorRaw = '0', secondaryColorRaw = '0', paymentMethodRaw = 'cash') => {
    if (!player.charId || !player.charName) {
        player.call('dealershipPurchaseResult', [false, 'Pirmiausia pasirinkite veikeja.', player.money || 0, player.bankBalance || 0]);
        return;
    }

    if (!isNearPoint(player, DEALERSHIP_POS, DEALERSHIP_INTERACT_RADIUS)) {
        player.call('dealershipPurchaseResult', [false, 'Turite buti prie Los Santos Dealership.', player.money || 0, player.bankBalance || 0]);
        return;
    }

    const raw = String(vehicleIdRaw || '').trim();
    if (!raw) {
        player.call('dealershipPurchaseResult', [false, 'Pasirinkite transporta.', player.money || 0, player.bankBalance || 0]);
        return;
    }

    const vehicleIndex = parseInt(raw, 10);
    let selected = null;

    if (Number.isFinite(vehicleIndex) && vehicleIndex >= 1 && vehicleIndex <= VEHICLE_CATALOG.length) {
        selected = VEHICLE_CATALOG[vehicleIndex - 1];
    }

    if (!selected) {
        selected = vehicleCatalogByKey.get(raw.toLowerCase()) || null;
    }

    if (!selected) {
        player.call('dealershipPurchaseResult', [false, 'Nerastas transportas pagal pasirinkima.', player.money || 0, player.bankBalance || 0]);
        return;
    }

    purchaseVehicleForPlayer(player, selected, primaryColorRaw, secondaryColorRaw, true, paymentMethodRaw);
});

mp.events.add('requestOpenDealershipUI', (player) => {
    if (!player.charId || !player.charName) return;
    if (!isNearPoint(player, DEALERSHIP_POS, DEALERSHIP_INTERACT_RADIUS)) {
        player.outputChatBox('!{#e74c3c}Sia komanda galite naudoti tik Los Santos Dealership vietoje.');
        return;
    }

    cleanupLegacyDealershipPreviewVehicles();
    openDealershipUI(player);
});

mp.events.addCommand('buypark', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte.');
    }

    // Check if player owns the vehicle they're driving.
    ensureOwnedVehicleState(player);
    const vId = player.vehicle.id;
    let record = null;

    // Match by RAGE MP entity .id
    for (const r of player.ownedVehicles.values()) {
        if (r && r.entity && r.entity.id === vId) { record = r; break; }
    }

    // Fallback: scan world vehicles by id
    if (!record) {
        mp.vehicles.forEach((veh) => {
            if (record || !veh || veh.id !== vId) return;
            const charId = veh.getVariable('ownedByCharId');
            if (Number(charId) !== Number(player.charId)) return;
            const dbId = veh.getVariable('ownedVehicleId');
            const r = getOwnedVehicleRecordByDbId(player, dbId);
            if (r) { r.entity = veh; record = r; }
        });
    }

    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    // Check if player has $100
    const BUYPARK_COST = 100;
    if (player.money < BUYPARK_COST) {
        return player.outputChatBox(`!{#e74c3c}Jums reikia ${BUYPARK_COST}$ norint pazymeti parkavimo zona. Jus turite tik $${player.money}.`);
    }

    // Deduct the cost
    player.money -= BUYPARK_COST;
    player.call('updateMoneyHUD', [player.money]);
    db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);

    // Track this location as the selected vehicle's park zone.
    ensureParkLocationState(player);
    const parkLocation = {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
    };
    player.parkLocationsByVehicleId.set(record.id, parkLocation);

    // Save to database.
    db.query(
        'INSERT INTO player_vehicle_park_locations (vehicle_id, char_id, park_x, park_y, park_z) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE park_x = ?, park_y = ?, park_z = ?, char_id = ?',
        [record.id, player.charId, parkLocation.x, parkLocation.y, parkLocation.z, parkLocation.x, parkLocation.y, parkLocation.z, player.charId],
        (err) => {
            if (err) {
                console.error('[VEHICLES] Failed to save park location:', err.message);
                player.outputChatBox('!{#e74c3c}Nepavyko isvaugoti parkavimo zonos.');
                return;
            }
            player.outputChatBox(`!{#7aa164}Sioji vieta pazymeta kaip ${record.displayName} parkavimo zona (-$${BUYPARK_COST}). Naudokite /park tik sioje zonoje.`);
        }
    );

    showBuyParkState(player);
});

mp.events.addCommand('vehicles', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    showBuyParkState(player);
});

mp.events.addCommand('park', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite sedeti savo transporte.');
    }

    ensureOwnedVehicleState(player);
    const vId = player.vehicle.id;
    const vPos = player.vehicle.position;
    const vHeading = Number.isFinite(player.vehicle.heading) ? player.vehicle.heading : DEALERSHIP_DELIVERY_HEADING;

    // Match by RAGE MP entity .id — object reference (===) is unreliable across property accesses.
    let record = null;
    for (const r of player.ownedVehicles.values()) {
        if (r && r.entity && r.entity.id === vId) { record = r; break; }
    }
    // Fallback: scan world vehicles by id.
    if (!record) {
        mp.vehicles.forEach((veh) => {
            if (record || !veh || veh.id !== vId) return;
            const charId = veh.getVariable('ownedByCharId');
            if (Number(charId) !== Number(player.charId)) return;
            const dbId = veh.getVariable('ownedVehicleId');
            const r = getOwnedVehicleRecordByDbId(player, dbId);
            if (r) { r.entity = veh; record = r; }
        });
    }
    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    // Check if player is at this specific vehicle's designated park zone.
    const vehicleParkLocation = getParkLocationForVehicle(player, record.id);
    if (!vehicleParkLocation) {
        return player.outputChatBox(`!{#e74c3c}Siam transportui (${record.id}) dar nepazymeta parkavimo zona. Naudokite /buypark sededami siame transporte.`);
    }
    const parkDist = Math.sqrt(
        Math.pow(player.position.x - vehicleParkLocation.x, 2) +
        Math.pow(player.position.y - vehicleParkLocation.y, 2) +
        Math.pow(player.position.z - vehicleParkLocation.z, 2)
    );
    if (parkDist > 15.0) {
        return player.outputChatBox(`!{#e74c3c}Turite buti prie sio transporto parkavimo zonos. Dabar esate ~${Math.round(parkDist)}m nutolę.`);
    }

    player.removeFromVehicle();
    parkOwnedVehicle(record, vPos, vHeading);
    player.outputChatBox(`!{#7aa164}Transportas ${record.displayName} sekmingai pastatytas.`);
});

mp.events.addCommand('get', (player, _, vehicleDbIdRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    ensureVehicleMarkerCleanupTimer(player);

    ensureOwnedVehicleState(player);
    if (player.ownedVehicles.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Jus neturite nusipirkto transporto.');
    }

    const activeRecord = getActiveOwnedVehicleRecord(player);
    if (activeRecord) {
        return player.outputChatBox(`!{#f7dc6f}Jau turite isvaziuota transporta (ID ${activeRecord.id} - ${activeRecord.displayName}). Naudokite /park.`);
    }

    let record = null;
    if (!vehicleDbIdRaw) {
        showBuyParkState(player);
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /get [id] — ispawnina jusu transporta. Pavyzdys: /get 1');
    } else {
        record = getOwnedVehicleRecordByDbId(player, vehicleDbIdRaw);
    }

    if (!record) {
        return player.outputChatBox('!{#e74c3c}Nerastas jusu transportas pagal nurodyta ID.');
    }

    if (record.entity && record.entity.handle) {
        return player.outputChatBox('!{#f7dc6f}Sis transportas jau isvarytas. Naudokite /park.');
    }

    // Require this selected vehicle to have a dedicated park location.
    const vehicleParkLocation = getParkLocationForVehicle(player, record.id);
    if (!vehicleParkLocation) {
        return player.outputChatBox(`!{#e74c3c}Siam transportui (${record.id}) nera parkavimo zonos. Sedekite siame transporte ir naudokite /buypark.`);
    }

    // Spawn at selected vehicle's marked park location.
    const spawnPos = new mp.Vector3(vehicleParkLocation.x, vehicleParkLocation.y, vehicleParkLocation.z);
    const spawnHeading = DEALERSHIP_DELIVERY_HEADING;

    const entity = spawnOwnedVehicleForPlayer(player, record, spawnPos, spawnHeading, false);
    if (!entity) {
        return player.outputChatBox('!{#e74c3c}Nepavyko isspawninti transporto.');
    }

    entity.engine = false;
    entity.setVariable('manualEngineOn', 0);

    record.parked = 0;
    record.parkX = spawnPos.x;
    record.parkY = spawnPos.y;
    record.parkZ = spawnPos.z;
    record.parkH = spawnHeading;

    // Create a blip for the vehicle on the map.
    if (record.blip) {
        try { record.blip.destroy(); } catch (e) { }
    }
    record.blip = mp.blips.new(227, spawnPos, {
        name: `${record.displayName} (${record.id})`,
        color: 2,
        scale: 0.8,
        shortRange: false,
    });

    persistOwnedVehicleState(record);
    player.outputChatBox(`!{#7aa164}Ispawnote ${record.displayName} parkavimo zonoje. Zinokite ziurekite zemelapyje.`);
});

mp.events.addCommand('lock', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    ensureOwnedVehicleState(player);
    let record = null;

    if (player.vehicle) {
        // Compare by RAGE MP entity .id — object reference (===) is unreliable.
        const vId = player.vehicle.id;
        for (const r of player.ownedVehicles.values()) {
            if (r && r.entity && r.entity.id === vId) { record = r; break; }
        }
        if (!record) {
            mp.vehicles.forEach((veh) => {
                if (record || !veh || veh.id !== vId) return;
                const charId = veh.getVariable('ownedByCharId');
                if (Number(charId) !== Number(player.charId)) return;
                const dbId = veh.getVariable('ownedVehicleId');
                const r = getOwnedVehicleRecordByDbId(player, dbId);
                if (r) { r.entity = veh; record = r; }
            });
        }
        if (!record) {
            return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
        }
    } else {
        // Outside: find closest owned vehicle by iterating records.
        let closestDist = 10.0;
        for (const r of player.ownedVehicles.values()) {
            if (!r || !r.entity) continue;
            try {
                const dist = getDistanceBetweenPositions(player.position, r.entity.position);
                if (dist < closestDist) { closestDist = dist; record = r; }
            } catch (e) { }
        }
        // Fallback: scan all world vehicles owned by this player.
        if (!record) {
            let closestVeh = null;
            let closestVehDist = 10.0;
            mp.vehicles.forEach((veh) => {
                if (!veh) return;
                const charId = veh.getVariable('ownedByCharId');
                if (Number(charId) !== Number(player.charId)) return;
                const dist = getDistanceBetweenPositions(player.position, veh.position);
                if (dist < closestVehDist) { closestVehDist = dist; closestVeh = veh; }
            });
            if (closestVeh) {
                const dbId = closestVeh.getVariable('ownedVehicleId');
                const worldRecord = getOwnedVehicleRecordByDbId(player, dbId);
                if (worldRecord) { worldRecord.entity = closestVeh; record = worldRecord; }
            }
        }
    }

    if (!record || !record.entity) {
        return player.outputChatBox('!{#f7dc6f}Salia nerastas jusu transportas. Ispawninkite ji su /get [id].');
    }

    record.locked = record.locked ? 0 : 1;
    record.entity.locked = Boolean(record.locked);
    persistOwnedVehicleState(record);

    if (record.locked) {
        player.outputChatBox(`!{#e67e22}Užrakinote ${record.displayName}.`);
    } else {
        player.outputChatBox(`!{#7aa164}Atrakinote ${record.displayName}.`);
    }
});

mp.events.addCommand('engine', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte.');
    }

    if (!isPlayerDrivingVehicle(player, player.vehicle)) {
        return player.outputChatBox('!{#e74c3c}Varikli gali valdyti tik vairuotojas.');
    }

    const currentEngineState = Number(player.vehicle.getVariable('manualEngineOn')) === 1;
    const nextEngineState = !currentEngineState;
    player.vehicle.engine = nextEngineState;
    player.vehicle.setVariable('manualEngineOn', nextEngineState ? 1 : 0);

    if (nextEngineState) {
        player.outputChatBox('!{#7aa164}Ijungote varikli.');
    } else {
        player.outputChatBox('!{#e67e22}Isjungote varikli.');
    }
});

mp.events.addCommand('lights', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte.');
    }

    if (!isPlayerDrivingVehicle(player, player.vehicle)) {
        return player.outputChatBox('!{#e74c3c}Sviesas gali valdyti tik vairuotojas.');
    }

    const currentLightsState = Number(player.vehicle.getVariable('manualLightsOn')) === 1;
    const nextLightsState = !currentLightsState;

    // Store state for sync and apply directly when property exists.
    player.vehicle.setVariable('manualLightsOn', nextLightsState ? 1 : 0);
    if ('lights' in player.vehicle) {
        try { player.vehicle.lights = nextLightsState; } catch (e) { }
    }

    if (nextLightsState) {
        player.outputChatBox('!{#7aa164}Ijungote sviesas.');
    } else {
        player.outputChatBox('!{#e67e22}Isjungote sviesas.');
    }
});

mp.events.add('updateServerTime', () => {
    let vilniusTime = moment().tz("Europe/Vilnius").format("HH:mm");
    mp.players.forEach(player => {
        player.call('updateServerTime', [vilniusTime]);
    });
});

const ATMsAndBanks = [
    // Downtown / Vinewood / Central LS
    { x: -386.733, y: 6045.953, z: 31.501 },
    { x: -284.037, y: 6224.385, z: 31.187 },
    { x: -284.037, y: 6224.385, z: 31.187 },
    { x: -135.165, y: 6365.738, z: 31.101 },
    { x: -110.753, y: 6467.703, z: 31.784 },
    { x: -94.9690, y: 6455.301, z: 31.784 },
    { x: 155.4300, y: 6641.991, z: 31.784 },
    { x: 174.6720, y: 6637.218, z: 31.784 },
    { x: 1703.138, y: 6426.783, z: 32.730 },
    { x: 1735.114, y: 6411.035, z: 35.164 },
    { x: 1702.842, y: 4933.593, z: 42.051 },
    { x: 1967.333, y: 3744.293, z: 32.272 },
    { x: 1821.917, y: 3683.483, z: 34.244 },
    { x: 1174.532, y: 2705.278, z: 38.027 },
    { x: 540.0420, y: 2671.007, z: 42.177 },
    { x: 2564.399, y: 2585.100, z: 38.016 },
    { x: 2558.683, y: 349.6010, z: 108.050 },
    { x: 2558.051, y: 389.4817, z: 108.660 },
    { x: 1077.692, y: -775.796, z: 58.218 },
    { x: 1139.018, y: -469.886, z: 66.789 },
    { x: 1168.975, y: -457.241, z: 66.641 },
    { x: 1153.884, y: -326.540, z: 69.245 },
    { x: 236.4638, y: 217.4718, z: 106.840 },
    { x: 265.0043, y: 212.1717, z: 106.780 },
    { x: -164.568, y: 233.5066, z: 94.919 },
    { x: -1827.04, y: 785.5159, z: 138.020 },
    { x: -1409.39, y: -99.2603, z: 52.473 },
    { x: -1205.35, y: -325.579, z: 37.870 },
    { x: -1215.64, y: -332.231, z: 37.881 },
    { x: -2072.41, y: -316.959, z: 13.345 },
    { x: -2975.72, y: 379.7737, z: 14.992 },
    { x: -2962.60, y: 482.1914, z: 15.762 },
    { x: -2955.70, y: 488.7218, z: 15.486 },
    { x: -3044.22, y: 595.2429, z: 7.595 },
    { x: -3144.13, y: 1127.415, z: 20.868 },
    { x: -3241.10, y: 996.6881, z: 12.500 },
    { x: -3241.11, y: 1009.152, z: 12.877 },
    { x: -1305.40, y: -706.240, z: 25.352 },
    { x: -538.225, y: -854.423, z: 29.234 },
    { x: -711.156, y: -818.958, z: 23.768 },
    { x: -717.614, y: -915.880, z: 19.268 },
    { x: -526.566, y: -1222.90, z: 18.434 },
    { x: -256.831, y: -719.646, z: 33.444 },
    { x: -203.548, y: -861.588, z: 30.205 },
    { x: 112.4102, y: -776.162, z: 31.427 },
    { x: 112.9290, y: -818.710, z: 31.386 },
    { x: 119.9000, y: -883.826, z: 31.191 },
    { x: 149.4551, y: -1038.95, z: 29.366 },
    { x: -846.304, y: -340.402, z: 38.687 },
    { x: -1204.35, y: -324.391, z: 37.877 },
    { x: -1216.27, y: -331.461, z: 37.773 },
    { x: -56.1935, y: -1752.53, z: 29.452 },
    { x: -261.692, y: -2012.64, z: 30.121 },
    { x: -273.001, y: -2025.60, z: 30.197 },
    { x: 314.1870, y: -278.621, z: 54.170 },
    { x: -351.534, y: -49.529, z: 49.042 },
    { x: 24.5890, y: -946.056, z: 29.357 },
    { x: -254.112, y: -692.483, z: 33.616 },
    { x: -1570.197, y: -546.651, z: 34.955 },
    { x: -1415.909, y: -211.825, z: 46.500 },
    { x: -1430.122, y: -211.014, z: 46.500 },
    { x: 33.2320, y: -1347.849, z: 29.497 },
    { x: 129.2160, y: -1292.347, z: 29.269 },
    { x: 287.6450, y: -1282.646, z: 29.659 },
    { x: 289.0120, y: -1256.545, z: 29.440 },
    { x: 295.8390, y: -895.640, z: 29.217 },
    { x: 1686.753, y: 4815.809, z: 42.008 },
    { x: -302.408, y: -829.945, z: 32.417 },
    { x: 5.1340, y: -919.949, z: 29.557 },
];

const ATM_INTERACTION_RADIUS = 4.0;

const FLEECA_BANK_LOCATIONS = [
    { x: 149.82, y: -1040.46, z: 29.37 },   // Legion Square
    { x: 314.19, y: -278.62, z: 54.17 },    // Hawick
    { x: -351.53, y: -49.53, z: 49.04 },    // Burton
    { x: -1212.98, y: -330.84, z: 37.79 },  // Rockford Hills
    { x: -2962.59, y: 482.63, z: 15.70 },   // Great Ocean Hwy
    { x: 1175.06, y: 2706.64, z: 38.09 },   // Harmony
    { x: -112.20, y: 6469.30, z: 31.63 },   // Paleto Bay
];

FLEECA_BANK_LOCATIONS.forEach((pos) => {
    mp.blips.new(108, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: 'Fleeca Bank',
        color: 2,
        scale: 0.8,
        shortRange: true,
    });
});

const BANK_AND_ATM_LOCATIONS = [...ATMsAndBanks, ...FLEECA_BANK_LOCATIONS];

function isNearATMOrBank(player) {
    for (let i = 0; i < BANK_AND_ATM_LOCATIONS.length; i++) {
        const atm = BANK_AND_ATM_LOCATIONS[i];
        const distance = Math.sqrt(
            Math.pow(player.position.x - atm.x, 2) +
            Math.pow(player.position.y - atm.y, 2) +
            Math.pow(player.position.z - atm.z, 2)
        );
        if (distance <= ATM_INTERACTION_RADIUS) {
            return true;
        }
    }
    return false;
}

mp.events.addCommand('bank', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    db.query('SELECT transaction_type, amount, date FROM bank_transactions WHERE char_name = ? ORDER BY date DESC LIMIT 5', [player.charName], (err, results) => {
        if (err) return;

        player.call('openBankUI', [player.bankBalance, player.money, JSON.stringify(results)]);
    });
});

mp.events.add('bankAction', (player, type, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) {
        player.call('bankError', ['Įveskite teisingą sumą.']);
        return;
    }

    const refreshAndNotify = (charName, balance, money) => {
        db.query('SELECT transaction_type, amount, date FROM bank_transactions WHERE char_name = ? ORDER BY date DESC LIMIT 10', [charName], (err, results) => {
            const history = err ? [] : results;
            player.call('updateBankUI', [balance, money, JSON.stringify(history)]);
            player.call('updateMoneyHUD', [money]);
        });
    };

    if (type === 'withdraw') {
        if (player.bankBalance >= amount) {
            player.bankBalance -= amount;
            player.money += amount;
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'withdraw', amount], () => {
                refreshAndNotify(player.charName, player.bankBalance, player.money);
            });
        } else {
            player.call('bankError', ['Nepakanka lėšų sąskaitoje.']);
        }
    } else if (type === 'deposit') {
        if (player.money >= amount) {
            player.money -= amount;
            player.bankBalance += amount;
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'deposit', amount], () => {
                refreshAndNotify(player.charName, player.bankBalance, player.money);
            });
        } else {
            player.call('bankError', ['Neturite pakankamai grynųjų pinigų.']);
        }
    }
});

mp.events.addCommand('withdraw', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /withdraw [suma]");

    if (player.bankBalance >= amount) {
        player.bankBalance -= amount;
        player.money += amount;

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
        db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'withdraw', amount]);

        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updateMoneyHUD', [player.money]);

        player.outputChatBox(`!{#229954}Jūs išsigryninote $${amount} iš banko.`);
    } else {
        player.outputChatBox("!{#FF0000}Jūsų banko sąskaitoje nėra pakankamai pinigų.");
    }
});

mp.events.addCommand('deposit', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate šalia banko ar bankomato.');
        return;
    }

    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /deposit [suma]");

    if (player.money >= amount) {
        player.money -= amount;
        player.bankBalance += amount;

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
        db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
        db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, ?, ?, NOW())', [player.charName, 'deposit', amount]);

        player.call('updateBankHUD', [player.bankBalance]);
        player.call('updateMoneyHUD', [player.money]);

        player.outputChatBox(`!{#229954}Jūs įnešėte $${amount} į banko sąskaitą.`);
    } else {
        player.outputChatBox("!{#FF0000}Neturite pakankamai grynųjų pinigų.");
    }
});

mp.events.addCommand('transfer', (player, fullText, targetName, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    amount = parseInt(amount);
    if (!targetName || isNaN(amount) || amount <= 0) return player.outputChatBox("Naudojimas: /transfer [gavėjo vardas] [suma]");

    db.query('SELECT * FROM bank_accounts WHERE char_name = ?', [targetName], (err, results) => {
        if (err || results.length === 0) {
            return player.outputChatBox("!{#FF0000}Gavėjo sąskaita nerasta.");
        }

        if (player.bankBalance >= amount) {
            player.bankBalance -= amount;
            let targetBalance = results[0].balance + amount;

            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [targetBalance, targetName]);

            player.call('updateBankHUD', [player.bankBalance]);
            player.outputChatBox(`!{#229954}Jūs pervedėte $${amount} žaidėjui ${targetName}.`);

            let target = mp.players.toArray().find(p => p.charName === targetName);
            if (target) {
                target.call('updateBankHUD', [targetBalance]);
                target.outputChatBox(`!{#229954}Jūs gavote $${amount} iš ${player.charName}.`);
            }
        } else {
            player.outputChatBox("!{#FF0000}Jūsų banko sąskaitoje nėra pakankamai pinigų.");
        }
    });
});

// Admin Commands
function getAdminLevel(player, callback) {
    if (!player.charName) return callback(null, 0);
    db.query('SELECT admin_level FROM characters WHERE char_name = ?', [player.charName], (error, results) => {
        if (error) return callback(error, null);
        if (results.length > 0) {
            return callback(null, results[0].admin_level);
        }
        return callback(null, 0);
    });
}

function isAdmin(player, level, callback) {
    getAdminLevel(player, (error, adminLevel) => {
        if (error) return callback(error, false);
        return callback(null, adminLevel >= level);
    });
}

function getPlayerByIDOrName(identifier) {
    if (!identifier) return null;

    const numericId = Number(identifier);
    if (!isNaN(numericId) && Number.isInteger(numericId)) {
        const byId = mp.players.toArray().find(p => p.id === numericId);
        if (byId) return byId;
    }

    const byNameExact = mp.players.toArray().find(p => p.charName && p.charName.toLowerCase() === identifier.toLowerCase());
    if (byNameExact) return byNameExact;

    // Fallback to partial match
    return mp.players.toArray().find(p => p.charName && p.charName.toLowerCase().includes(identifier.toLowerCase()));
}

function sendUsageInstructions(player, command) {
    const instructions = {
        'kick': "[KICK] Naudojimas: /kick [ID arba vardas] - Išmesti žaidėją.",
        'freeze': "[FREEZE] Naudojimas: /freeze [ID arba vardas] - Užšaldyti žaidėją.",
        'goto': "[GOTO] Naudojimas: /goto [ID arba vardas] - Eiti pas žaidėją.",
        'bring': "[BRING] Naudojimas: /bring [ID arba vardas] - Atnešti žaidėją pas tave.",
        'ban': "[BAN] Naudojimas: /ban [ID arba vardas] [Priežastis] - Užblokuoti žaidėją.",
        'giveitem': "[GIVEITEM] Naudojimas: /giveitem [ID arba vardas] [item] [kiekis]",
    };
    player.outputChatBox(instructions[command] || "Netinkamas komandos pavadinimas.");
}

mp.events.addCommand('giveitem', (admin, fullText, targetIdentifier, rawItemType, amountStr) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier || !rawItemType) {
        return sendUsageInstructions(admin, 'giveitem');
    }

    isAdmin(admin, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return admin.outputChatBox('!{#e74c3c}Neturite teisių naudoti šią komandą.');
        }

        const targetPlayer = getPlayerByIDOrName(targetIdentifier);
        if (!targetPlayer || !targetPlayer.charName) {
            return admin.outputChatBox('!{#e74c3c}Žaidėjas nerastas arba nepasirinko veikėjo.');
        }

        const itemType = normalizeInventoryItemType(rawItemType);
        if (!itemType || !INVENTORY_ITEM_DEFS[itemType]) {
            return admin.outputChatBox('!{#e74c3c}Nežinomas daiktas. Galimi: water, burger, bandage, medkit, cigarettes, beer');
        }

        const amount = Math.max(1, parseInt(amountStr, 10) || 1);
        const addedItem = addInventoryItem(targetPlayer, itemType, amount);
        if (!addedItem) {
            return admin.outputChatBox('!{#e74c3c}Nepavyko pridėti daikto.');
        }

        persistInventory(targetPlayer);

        const label = formatInventoryAmount(addedItem.name, amount);
        admin.outputChatBox(`!{#7aa164}Pridėjote ${label} žaidėjui ${targetPlayer.charName}.`);
        targetPlayer.outputChatBox(`!{#7aa164}Administratorius ${admin.charName} davė jums ${label}.`);
        sendInventoryUpdate(targetPlayer, `Gavote ${label}.`, true);
    });
});

mp.events.addCommand('kick', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'kick');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        target.kick("Buvo išmestas administratoriaus.");
    });
});

mp.events.addCommand('freeze', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'freeze');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");

        if (target.frozen) {
            target.call('freezePlayer', [false]);
            target.frozen = false;
            player.outputChatBox(`[INFO] Atšaldėte žaidėją ${target.charName || target.name}.`);
        } else {
            target.call('freezePlayer', [true]);
            target.frozen = true;
            player.outputChatBox(`[INFO] Užšaldėte žaidėją ${target.charName || target.name}.`);
        }
    });
});

mp.events.addCommand('goto', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'goto');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        player.position = target.position;
    });
});

mp.events.addCommand('bring', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'bring');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");
        target.position = player.position;
    });
});

mp.events.addCommand('ban', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        return sendUsageInstructions(player, 'ban');
    }

    const args = fullText.split(" ");
    const targetIdentifier = args[0];
    const reason = args.slice(1).join(" ") || "Nenurodyta priežastis";

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Žaidėjas nerastas.");

        const ip = target.ip;
        db.query('INSERT INTO bans (ip, reason, admin) VALUES (?, ?, ?)', [ip, reason, player.charName], (error) => {
            if (error) return player.outputChatBox("[KLAIDA] Įvyko klaida bandant užblokuoti žaidėją.");

            target.kick(`Buvo užblokuotas. Priežastis: ${reason}`);
            player.outputChatBox(`[INFO] Jūs užblokavote žaidėją ${target.charName || target.name} (IP: ${ip}). Priežastis: ${reason}`);
            mp.players.broadcast(`[INFO] Žaidėjas ${target.charName || target.name} buvo užblokuotas. Priežastis: ${reason}`);
        });
    });
});

const activeHelpRequests = new Map();

async function getAdminLevelFromDB(player) {
    return new Promise((resolve, reject) => {
        if (!player.charName) return resolve(0);
        const query = "SELECT admin_level FROM characters WHERE char_name = ?";
        db.query(query, [player.charName], (err, results) => {
            if (err) {
                console.error("Klaida tikrinant admin lygį:", err);
                resolve(0);
            } else {
                resolve(results.length > 0 ? results[0]["admin_level"] : 0);
            }
        });
    });
}

mp.events.addCommand('helpme', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox("[HELP] Naudojimas: /helpme <klausimas>");
        return;
    }

    if (activeHelpRequests.has(player.id)) {
        player.outputChatBox("[HELP] Jūs jau pateikėte pagalbos prašymą. Palaukite administratoriaus atsakymo.");
        return;
    }

    activeHelpRequests.set(player.id, fullText);

    mp.players.forEach(async (admin) => {
        const adminLevel = await getAdminLevelFromDB(admin);
        if (adminLevel === 1 || adminLevel === 2) {
            admin.outputChatBox(`!{#ADD8E6}[HELP] ${player.charName} (${player.id}): ${fullText} - priimti su /accepthelp ${player.id}`);
        }
    });

    player.outputChatBox("[HELP] Jūsų pagalbos prašymas buvo išsiųstas administratoriams.");
});

mp.events.addCommand('accepthelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jūs nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Žaidėjas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Šis žaidėjas nepateikė pagalbos prašymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#7aa164}[HELP] Administratorius ${admin.charName} jums padės.`);
    admin.outputChatBox(`[HELP] Jūs priėmėte ${target.charName || target.name} (${target.id}) pagalbos prašymą.`);
});

mp.events.addCommand('declinehelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jūs nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Žaidėjas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Šis žaidėjas nepateikė pagalbos prašymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#cd5d3c}[HELP] Administratorius ${admin.charName} atmetė jūsų pagalbos prašymą.`);
    admin.outputChatBox(`[HELP] Jūs atmetėte ${target.charName || target.name} (${target.id}) pagalbos prašymą.`);
});

const reports = new Map();

mp.events.addCommand("report", async (player, fullText, targetId, ...reasonArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetId || reasonArray.length === 0) {
        return player.outputChatBox("Naudojimas: /report [žaidėjo ID] [priežastis]");
    }
    if (reports.has(player.id)) {
        return player.outputChatBox("Jūsų reportas jau laukia administratorių sprendimo.");
    }

    const target = getPlayerByIDOrName(targetId);
    if (!target) {
        return player.outputChatBox("Žaidėjas su tokiu ID nerastas.");
    }

    if (!target.charName) {
        return player.outputChatBox("Žaidėjas dar nepasirinko veikėjo.");
    }

    const reason = reasonArray.join(" ");
    reports.set(player.id, { player, target, reason });

    mp.players.forEach(async (admin) => {
        const adminLvl = await getAdminLevelFromDB(admin);
        if (adminLvl >= 1) {
            admin.outputChatBox(`!{#f0e237}[REPORT] ${player.charName} pranešė apie ${target.charName}: ${reason} (ID: ${player.id})`);
            admin.outputChatBox(`!{#f0e237}Norint priimti reportą: /acceptreport ${player.id}`);
            admin.outputChatBox(`!{#f0e237}Norint atmesti reportą: /declinereport ${player.id}`);
        }
    });

    player.outputChatBox("Jūsų reportas buvo išsiųstas administracijai.");
});

mp.events.addCommand("acceptreport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisių naudoti šią komandą.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox(`!{#7aa164}Jūsų report buvo priimtas administratoriaus ${admin.charName}.`);
    mp.players.forEach(async adminPlayer => {
        const adminLevel = await getAdminLevelFromDB(adminPlayer);
        if (adminLevel >= 1) {
            adminPlayer.outputChatBox(`[REPORT] ${admin.charName} priėmė ${report.player.charName} reportą prieš ${report.target.charName}.`);
        }
    });
});

mp.events.addCommand("declinereport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisių naudoti šią komandą.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox("!{#cd5d3c}Jūsų report buvo atmestas administratoriaus.");
    admin.outputChatBox(`[REPORT] Jūs atmetėte ${report.player.charName} reportą prieš ${report.target.charName}.`);
});


// /admins command - List all online admins (level 1 or 2)
mp.events.addCommand('admins', (player) => {
    const onlineAdmins = mp.players.toArray().filter(p => p.adminLevel >= 1 && p.adminLevel <= 2);

    if (onlineAdmins.length === 0) {
        player.outputChatBox('!{#f7dc6f}Šiuo metu nėra prisijungusių administratorių.');
        return;
    }

    player.outputChatBox('!{#f7dc6f}===== Prisijungę Administratoriai =====');
    onlineAdmins.forEach(admin => {
        const adminLevelText = admin.adminLevel === 1 ? 'Administratorius' : 'Vadovybė';
        player.outputChatBox(`[${adminLevelText}] ${admin.adminName} (ID: ${admin.id})`);
    });
    player.outputChatBox('!{#f7dc6f}=====================================');
});

// /setaname command - Set admin name for display in /admins
mp.events.addCommand('setaname', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!fullText) {
        player.outputChatBox('Naudojimas: /setaname [admin vardas]');
        return;
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisių.");

        const newAdminName = fullText.trim();
        if (newAdminName.length < 3 || newAdminName.length > 20) {
            player.outputChatBox('!{#e74c3c}Admin vardas turi būti nuo 3 iki 20 simbolių.');
            return;
        }

        // Update admin_name in the database
        db.query('UPDATE characters SET admin_name = ? WHERE char_name = ?', [newAdminName, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko atnaujinti admin vardo:', err);
                player.outputChatBox('!{#e74c3c}Įvyko klaida keičiant admin vardą.');
                return;
            }

            player.adminName = newAdminName;
            player.outputChatBox(`!{#7aa164}Jūsų admin vardas nustatytas: ${newAdminName}`);
        });
    });
});

mp.events.addCommand('changechar', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    // Save current character data
    saveCharacterData(player);
    cleanupPlayerOwnedVehicles(player, true);
    console.log(`[DEBUG] Saved data for ${player.charName}`);

    // Clear timers
    if (player.timer) {
        clearInterval(player.timer);
        delete player.timer;
    }
    if (player.saveTimer) {
        clearInterval(player.saveTimer);
        delete player.saveTimer;
    }
    if (player.vehicleMarkerTimer) {
        clearInterval(player.vehicleMarkerTimer);
        delete player.vehicleMarkerTimer;
    }
    if (playerTimeInfo[player.id] && playerTimeInfo[player.id].interval) {
        clearInterval(playerTimeInfo[player.id].interval);
        delete playerTimeInfo[player.id];
    }
    console.log('[DEBUG] Cleared timers');

    // Reset character-specific data
    player.charId = null;
    player.charName = null;
    player.adminName = null;
    player.health = 100;
    player.money = 0;
    player.bankBalance = 0;
    player.playtime = 0;
    player.isPMEnabled = true;
    player.adminLevel = 0;
    player.contacts = null;
    player.phoneNumber = null;
    player.isPhoneOpen = false;
    player.inventory = null;
    player.ownedVehicles = new Map();
    player.parkLocationsByVehicleId = new Map();

    // Hide HUD elements
    player.call('updateMoneyHUD', [0]);
    player.call('updateBankHUD', [0]);
    player.call('updatePhoneNumber', ['']);
    console.log('[DEBUG] Reset character data and HUD');

    // Hide player and freeze (matches client-side hidePlayerModel)
    player.call('hidePlayerModel');
    console.log('[DEBUG] Called hidePlayerModel');

    // Load character selection UI
    loadCharacterSelection(player);
    player.outputChatBox('!{#f7dc6f}Jūs atsijungėte nuo veikėjo. Pasirinkite naują veikėją.');
    console.log('[DEBUG] Called loadCharacterSelection');
});




mp.events.addCommand('coords', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    const coords = player.position;
    player.outputChatBox(`Current Coordinates: X: ${coords.x.toFixed(2)}, Y: ${coords.y.toFixed(2)}, Z: ${coords.z.toFixed(2)}`);
});

mp.events.addCommand('createtwittertables', (player) => {
    if (!player.charName) return;
    db.query(`CREATE TABLE IF NOT EXISTS twitter_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        char_id INT NOT NULL,
        handle VARCHAR(50) UNIQUE NOT NULL,
        FOREIGN KEY (char_id) REFERENCES characters(id)
    )`, (err) => {
        if (err) console.error('Error creating twitter_accounts table:', err);
        else console.log('Twitter accounts table ready.');
    });
    db.query(`CREATE TABLE IF NOT EXISTS twitter_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        handle VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating twitter_posts table:', err);
        else console.log('Twitter posts table ready.');
    });
    player.outputChatBox('Twitter tables created.');
});





// TAXI and PHONE

// ==================== INVENTORY SYSTEM ====================

mp.events.addCommand('inventory', (player) => openInventory(player));
mp.events.addCommand('inv', (player) => openInventory(player));

mp.events.add('requestInventoryOpen', (player) => {
    openInventory(player);
});

mp.events.add('requestInventoryRefresh', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    sendInventoryUpdate(player, 'Inventorius atnaujintas.', true);
});

mp.events.add('inventoryUseItem', (player, itemId) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const itemEntry = getInventoryItemById(player, itemId);
    if (!itemEntry) {
        return sendInventoryUpdate(player, 'Toks daiktas inventoriuje nerastas.', false);
    }

    const item = itemEntry.item;
    if (!item.usable) {
        return sendInventoryUpdate(player, 'Sio daikto naudoti negalima.', false);
    }

    const currentHealth = Math.max(1, Math.ceil(player.health || 100));
    let nextHealth = currentHealth;
    let statusText = '';

    switch (item.type) {
        case 'water':
            if (currentHealth >= 100) return sendInventoryUpdate(player, 'Jusu gyvybes jau pilnos.', false);
            nextHealth = Math.min(100, currentHealth + 5);
            statusText = 'Isgerete vandens ir atgavote 5 gyvybes.';
            break;
        case 'burger':
            if (currentHealth >= 100) return sendInventoryUpdate(player, 'Jusu gyvybes jau pilnos.', false);
            nextHealth = Math.min(100, currentHealth + 15);
            statusText = 'Suvalgete burgeri ir atgavote 15 gyvybiu.';
            break;
        case 'bandage':
            if (currentHealth >= 100) return sendInventoryUpdate(player, 'Jusu gyvybes jau pilnos.', false);
            nextHealth = Math.min(100, currentHealth + 20);
            statusText = 'Apsivyniojote binta ir atgavote 20 gyvybiu.';
            break;
        case 'medkit':
            if (currentHealth >= 100) return sendInventoryUpdate(player, 'Jusu gyvybes jau pilnos.', false);
            nextHealth = Math.min(100, currentHealth + 45);
            statusText = 'Panaudojote vaistinele ir stipriai atsistate sveikata.';
            break;
        case 'cigarettes':
            nextHealth = currentHealth;
            statusText = 'Uzsirukete cigarete.';
            break;
        case 'beer':
            nextHealth = Math.min(100, currentHealth + 3);
            statusText = 'Isgerete alaus.';
            break;
        default:
            return sendInventoryUpdate(player, 'Sio daikto naudoti negalima.', false);
    }

    player.health = nextHealth;
    removeInventoryItemAmount(player, itemId, 1);
    persistInventory(player);
    broadcastInventoryAction(player, `${player.charName} panaudojo ${item.name}.`);
    player.outputChatBox(`!{#7aa164}${statusText}`);
    sendInventoryUpdate(player, statusText, true);
});

mp.events.add('inventoryDropItem', (player, itemId, amountStr) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const amount = Math.max(1, parseInt(amountStr, 10) || 1);
    const itemEntry = getInventoryItemById(player, itemId);
    if (!itemEntry) {
        return sendInventoryUpdate(player, 'Toks daiktas inventoriuje nerastas.', false);
    }

    const item = itemEntry.item;
    if (!item.droppable) {
        return sendInventoryUpdate(player, 'Sio daikto ismesti negalima.', false);
    }

    if (item.quantity < amount) {
        return sendInventoryUpdate(player, 'Neturite tiek vienetu siam veiksmui.', false);
    }

    const itemName = item.name;
    removeInventoryItemAmount(player, itemId, amount);
    persistInventory(player);

    const statusText = `Ismetete ${formatInventoryAmount(itemName, amount)}.`;
    broadcastInventoryAction(player, `${player.charName} ismete ${formatInventoryAmount(itemName, amount)}.`);
    player.outputChatBox(`!{#cd5d3c}${statusText}`);
    sendInventoryUpdate(player, statusText, true);
});

mp.events.add('inventoryGiveItem', (player, itemId, targetIdentifier, amountStr) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const amount = Math.max(1, parseInt(amountStr, 10) || 1);
    const itemEntry = getInventoryItemById(player, itemId);
    if (!itemEntry) {
        return sendInventoryUpdate(player, 'Toks daiktas inventoriuje nerastas.', false);
    }

    const item = itemEntry.item;
    if (!item.giveable) {
        return sendInventoryUpdate(player, 'Sio daikto perduoti negalima.', false);
    }

    if (item.quantity < amount) {
        return sendInventoryUpdate(player, 'Neturite tiek vienetu siam veiksmui.', false);
    }

    if (!targetIdentifier || !String(targetIdentifier).trim()) {
        return sendInventoryUpdate(player, 'Iveskite gavejo ID arba varda.', false);
    }

    const targetPlayer = getPlayerByIDOrName(String(targetIdentifier).trim());
    if (!targetPlayer || !targetPlayer.charName) {
        return sendInventoryUpdate(player, 'Gavejas nerastas arba nepasirinko veikejo.', false);
    }

    if (targetPlayer.id === player.id) {
        return sendInventoryUpdate(player, 'Negalite perduoti daikto patys sau.', false);
    }

    if (getDistanceBetweenPositions(player.position, targetPlayer.position) > INVENTORY_GIVE_RADIUS) {
        return sendInventoryUpdate(player, 'Turite buti salia kito zaidejo.', false);
    }

    const itemType = item.type;
    const itemName = item.name;

    removeInventoryItemAmount(player, itemId, amount);
    addInventoryItem(targetPlayer, itemType, amount);
    persistInventory(player);
    persistInventory(targetPlayer);

    const amountLabel = formatInventoryAmount(itemName, amount);
    const giverMessage = `Atidavete ${amountLabel} zaidejui ${targetPlayer.charName}.`;
    const receiverMessage = `${player.charName} jums dave ${amountLabel}.`;

    player.outputChatBox(`!{#7aa164}${giverMessage}`);
    targetPlayer.outputChatBox(`!{#7aa164}${receiverMessage}`);
    broadcastInventoryAction(player, `${player.charName} perdave ${amountLabel} zaidejui ${targetPlayer.charName}.`);

    sendInventoryUpdate(player, giverMessage, true);
    sendInventoryUpdate(targetPlayer, receiverMessage, true);
});

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System

// Mobile Phone and Drive App System


mp.events.addCommand('ph', (player) => openPhone(player));
mp.events.addCommand('phone', (player) => openPhone(player));

// Server-side
// ==================== OPEN PHONE FUNCTION (FIXED) ====================


// ==================== DRIVE / PAVEŽĖJŲ SISTEMA (CLEAN & FIXED) ====================

function openPhone(player) {
    if (!player.charName) {
        return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    }

    let callStatus = 'idle';
    let callPartner = null;

    if (activeCalls.has(player.id)) {
        const callData = activeCalls.get(player.id);
        callStatus = callData.status || 'idle';
        callPartner = callData.caller === player
            ? (callData.target ? callData.target.charName : null)
            : (callData.caller ? callData.caller.charName : null);
    }

    const isDriver = activeDrivers.has(player.id);
    const contacts = player.contacts || [];

    console.log(`[PHONE] Opening phone for ${player.charName} | Driver: ${isDriver} | Status: ${callStatus}`);

    player.call('openPhoneUI', [
        isDriver,
        player.phoneNumber || '',
        callStatus,
        callPartner || '',
        JSON.stringify(contacts)
    ]);
}

// Toggle driver status
mp.events.add('toggleDriverStatus', (player) => {
    if (!player.charName) return;

    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
        player.outputChatBox('!{#cd5d3c}Jūs nebesate Drive vairuotojas.');
        player.call('updateDriverStatus', [false]);
    } else {
        if (!player.vehicle) {
            return player.outputChatBox('!{#e74c3c}Jums reikia būti transporto priemonėje!');
        }
        activeDrivers.set(player.id, { player, status: "available" });
        player.outputChatBox('!{#7aa164}Jūs tapote Drive vairuotoju!');
        player.call('updateDriverStatus', [true]);
    }
});

// Request ride
mp.events.add('requestRide', (player) => {
    if (!player.charName) return;
    if (activeRides.has(player.id)) {
        return player.outputChatBox('!{#e74c3c}Jūs jau turite aktyvią kelionę!');
    }

    if (activeDrivers.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu nėra laisvų vairuotojų.');
    }

    activeRides.set(player.id, {
        requester: player,
        driver: null,
        blip: null,
        interval: null
    });

    activeDrivers.forEach((data) => {
        if (data.status === "available") {
            const dist = getDistanceBetweenPositions(player.position, data.player.position);
            if (dist < 700) {
                data.player.outputChatBox(`!{#f7dc6f}[Drive] ${player.charName} ieško pavežėjimo! /acceptdrive ${player.id}`);
            }
        }
    });

    player.outputChatBox('!{#7aa164}Užklausa išsiųsta vairuotojams...');
});

// Accept ride command
mp.events.addCommand('acceptdrive', (driver, requesterIdStr) => {
    if (!driver.charName || !activeDrivers.has(driver.id)) {
        return driver.outputChatBox('!{#e74c3c}Jūs nesate aktyvus vairuotojas!');
    }

    const reqId = parseInt(requesterIdStr);
    if (!activeRides.has(reqId)) {
        return driver.outputChatBox('!{#f7dc6f}Užklausa nebegalioja.');
    }

    const ride = activeRides.get(reqId);
    if (ride.driver) {
        return driver.outputChatBox('!{#e74c3c}Šią užklausą jau priėmė kitas vairuotojas.');
    }

    ride.driver = driver;
    activeDrivers.get(driver.id).status = "busy";

    ride.blip = mp.blips.new(1, ride.requester.position, {
        name: `Keleivis: ${ride.requester.charName}`,
        color: 2,
        scale: 1.2
    });

    driver.outputChatBox(`!{#7aa164}Priėmėte ${ride.requester.charName}! Važiuokite jo pasiimti.`);
    ride.requester.outputChatBox(`!{#7aa164}Vairuotojas ${driver.charName} priėmė jūsų užklausą!`);

    ride.interval = setInterval(() => {
        if (!ride.driver || !ride.requester) {
            clearInterval(ride.interval);
            return;
        }
        const dist = getDistanceBetweenPositions(ride.driver.position, ride.requester.position);
        if (dist <= 12) {
            clearInterval(ride.interval);
            ride.driver.outputChatBox('!{#7aa164}✅ Jūs pasiekėte keleivį!');
            ride.requester.outputChatBox('!{#7aa164}✅ Vairuotojas atvyko pas jus!');
        }
    }, 2000);
});

// Tracks ongoing calls: { callerId: { caller, target, status } }

// /call command
mp.events.addCommand('call', (player, phoneNumber) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!phoneNumber) return player.outputChatBox('Naudojimas: /call [telefono numeris]');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio.');
    if (activeCalls.has(player.id)) return player.outputChatBox('!{#e74c3c}Jūs jau esate skambutyje arba laukiate atsakymo.');

    const target = mp.players.toArray().find(p => p.phoneNumber === phoneNumber);
    if (!target || !target.charName) {
        player.call('callFailed', 'Šis telefono numeris nerastas arba žaidėjas neprisijungęs.');
        return player.outputChatBox('!{#f7dc6f}Šis telefono numeris nerastas arba žaidėjas neprisijungęs.');
    }

    if (target.id === player.id) {
        player.call('callFailed', 'Negalite skambinti sau!');
        return player.outputChatBox('!{#e74c3c}Negalite skambinti sau!');
    }

    if (!startCall(player, target)) {
        player.call('callFailed', 'Skambutis negali būti pradėtas.');
        return player.outputChatBox('!{#e74c3c}Skambutis negali būti pradėtas.');
    }
});

// /answer command
mp.events.addCommand('answer', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    const activeCallData = { caller, target: player, status: 'active' };
    activeCalls.set(player.id, activeCallData);
    activeCalls.set(caller.id, activeCallData);

    player.outputChatBox(`!{#7aa164}Jūs priėmėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#7aa164}${player.charName} priėmė jūsų skambutį.`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]); // Update phone UI
    caller.call('callStarted', [player.charName, player.phoneNumber]); // Update caller's phone UI
});

// /decline command
mp.events.addCommand('decline', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Šiuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#cd5d3c}Jūs atmetėte skambutį iš ${caller.charName}.`);
    caller.outputChatBox(`!{#cd5d3c}${player.charName} atmetė jūsų skambutį.`);
    player.call('callEnded');
    caller.call('callEnded');
});

// Handle player disconnect
mp.events.add('playerQuit', (player) => {
    // Character timers
    if (player.timer) {
        clearInterval(player.timer);
        delete player.timer;
    }

    if (player.saveTimer) {
        clearInterval(player.saveTimer);
        delete player.saveTimer;
    }

    if (player.vehicleMarkerTimer) {
        clearInterval(player.vehicleMarkerTimer);
        delete player.vehicleMarkerTimer;
    }

    if (playerTimeInfo[player.id] && playerTimeInfo[player.id].interval) {
        clearInterval(playerTimeInfo[player.id].interval);
        delete playerTimeInfo[player.id];
    }

    // Save current character state
    saveCharacterData(player);
    cleanupPlayerOwnedVehicles(player, true);

    // Clean up driver/ride state
    if (activeDrivers.has(player.id)) {
        activeDrivers.delete(player.id);
    }

    for (const [requesterId, ride] of activeRides.entries()) {
        if (!ride) continue;
        if ((ride.requester && ride.requester.id === player.id) || (ride.driver && ride.driver.id === player.id)) {
            if (ride.interval) clearInterval(ride.interval);
            if (ride.blip) ride.blip.destroy();
            activeRides.delete(requesterId);
        }
    }

    // Clean up phone state
    player.contacts = null;
    player.isPhoneOpen = false;

    // Handle active calls
    if (activeCalls.has(player.id)) {
        const callData = activeCalls.get(player.id);
        const partner = (callData.caller && callData.caller.id === player.id) ? callData.target : callData.caller;

        if (partner) {
            try {
                partner.call('callEnded');
            } catch (e) {
                // Ignore partner call failures during disconnect/shutdown.
            }
            activeCalls.delete(partner.id);
        }

        activeCalls.delete(player.id);
    }

    // Notify if player had a ringing incoming call not found by key
    const ringingIncoming = Array.from(activeCalls.values()).find(c => c.target && c.target.id === player.id && c.status === 'ringing');
    if (ringingIncoming && ringingIncoming.caller) {
        try {
            ringingIncoming.caller.call('callEnded');
        } catch (e) {
            // Ignore caller call failures during disconnect/shutdown.
        }
        activeCalls.delete(ringingIncoming.caller.id);
    }

    if (!player.charId) {
        console.log(`[INFO] Žaidėjas ${player.name} atsijungė be pasirinkto veikėjo.`);
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (!player || !vehicle || !player.charId) return;

    const record = getPlayerOwnedVehicleFromEntity(player, vehicle);
    if (!record || !record.blip) return;

    try { record.blip.destroy(); } catch (e) { }
    record.blip = null;
});

mp.events.add('callFromUI', (player, phoneNumber) => {
    if (!/^\d+$/.test(phoneNumber)) {
        player.call('callFailed', 'Numeris turi būti tik skaitmenys!');
        return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    }
    mp.events.call('call', player, phoneNumber);
});



// Server-side
mp.events.add('openPhoneUI', (player, isDriver) => {
    if (!player.charId) {
        player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
        return;
    }
    const contacts = player.contacts || [];
    player.isPhoneOpen = true;
    console.log(`[DEBUG] Sending contacts to client for charId ${player.charId}:`, contacts);
    player.call('loadContacts', [JSON.stringify(contacts), isDriver, player.phoneNumber || 'Nėra numerio']);
});

// Add contact to database
mp.events.add('addContact', (player, name, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!/^\d+$/.test(number)) return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');

    db.query('SELECT COUNT(*) as count FROM contacts WHERE char_id = ?', [player.charId], (err, countResult) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontaktų skaičiaus:', err);
            return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
        }

        if (countResult[0].count >= 50) {
            return player.outputChatBox('!{#e74c3c}Jūsų kontaktų sąrašas pilnas!');
        }

        db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, results) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
                return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
            }

            if (results.length > 0) {
                return player.outputChatBox('!{#e74c3c}Šis numeris jau yra jūsų kontaktuose!');
            }

            db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
                [player.charId, name, number], (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko pridėti kontakto:', err);
                        return player.outputChatBox('!{#e74c3c}Klaida pridedant kontaktą.');
                    }

                    loadCharacterContacts(player);
                    player.outputChatBox(`!{#7aa164}Pridėtas kontaktas: ${name} (${number})`);
                });
        });
    });
});

// Remove contact from database
mp.events.add('removeContact', (player, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    db.query('DELETE FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, result) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko pašalinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida šalinant kontaktą.');
        }

        if (result.affectedRows === 0) return;

        loadCharacterContacts(player);
        const removedContact = (player.contacts || []).find(c => c.number === number);
        if (removedContact) {
            player.outputChatBox(`!{#cd5d3c}Pašalintas kontaktas: ${removedContact.name}`);
        }
    });
});

// Call contact (unchanged)
mp.events.add('callContact', (player, number) => {
    mp.events.call('call', player, number); // No length restriction needed
});

// Update /sharenumber command
mp.events.addCommand('sharenumber', (player, fullText, targetId, contactName) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!targetId || !contactName) {
        return player.outputChatBox('Naudojimas: /sharenumber [ID] [vardas]');
    }

    const target = mp.players.at(parseInt(targetId));
    if (!target) {
        return player.outputChatBox('!{#e74c3c}Žaidėjas nerastas!');
    }
    if (!target.charId) {
        return player.outputChatBox('!{#e74c3c}Žaidėjas dar nepasirinko veikėjo.');
    }
    if (!player.phoneNumber) {
        return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    }

    db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [target.charId, player.phoneNumber], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
        }

        if (results.length > 0) {
            return player.outputChatBox('!{#e74c3c}Jūsų numeris jau yra šio žaidėjo kontaktuose!');
        }

        db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
            [target.charId, contactName, player.phoneNumber], (err) => {
                if (err) {
                    console.error('[KLAIDA] Nepavyko pridėti kontakto:', err);
                    return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
                }

                loadCharacterContacts(target);
                player.outputChatBox(`!{#7aa164}Jūs pasidalinote savo numeriu su ${target.charName} kaip ${contactName}`);
                target.outputChatBox(`!{#7aa164}${player.charName} pridėjo jus į kontaktus kaip ${contactName} (${player.phoneNumber})`);
            });
    });
});

mp.events.add('call', (player, number) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');

    const target = mp.players.toArray().find(p => p.phoneNumber === number);
    if (!target) {
        player.outputChatBox('!{#e74c3c}Numeris nepasiekiamas arba neegzistuoja!');
        return;
    }
    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Šis žaidėjas dar nepasirinko veikėjo!');
        return;
    }
    if (activeCalls.has(target.id)) {
        player.outputChatBox('!{#e74c3c}Šis numeris šiuo metu užimtas!');
        return;
    }

    if (!startCall(player, target)) {
        player.outputChatBox('!{#e74c3c}Skambutis negali būti pradėtas.');
    }
});

mp.events.add('acceptCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nėra gaunamo skambučio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.set(player.id, { caller: caller, target: player, status: 'active' });
    activeCalls.set(caller.id, { caller: caller, target: player, status: 'active' });

    player.outputChatBox(`!{#7aa164}Jūs priėmėte skambutį nuo ${caller.charName}!`);
    caller.outputChatBox(`!{#7aa164}${player.charName} priėmė jūsų skambutį!`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]);
    caller.call('callStarted', [player.charName, player.phoneNumber]);
});

mp.events.add('declineCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nėra gaunamo skambučio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#7aa164}Jūs atmetėte skambutį nuo ${caller.charName}.`);
    caller.outputChatBox(`!{#e74c3c}${player.charName} atmetė jūsų skambutį.`);
    player.call('callEnded');
    caller.call('callEnded');
});

mp.events.addCommand('hangup', (player) => {
    if (!activeCalls.has(player.id)) {
        player.outputChatBox('!{#e74c3c}Jūs nesate skambutyje!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const partner = (callData.caller && callData.caller.id === player.id) ? callData.target : callData.caller;

    activeCalls.delete(player.id);
    if (partner && activeCalls.has(partner.id)) {
        activeCalls.delete(partner.id);
        partner.outputChatBox('!{#e74c3c}Skambutis baigtas kitos pusės.');
        partner.call('callEnded');
    }

    player.outputChatBox('!{#7aa164}Jūs baigėte skambutį.');
    player.call('callEnded');
    console.log(`[DEBUG] Call ended by ${player.charName}`);
});






// Send a message from the phone UI
// Send a message from the phone UI
// ==================== SMS / MESSAGES SYSTEM ====================

const messageCooldowns = new Map(); // Anti-spam protection
const MAX_MESSAGES_PER_MINUTE = 30;
const COOLDOWN_PERIOD = 60000;


// Helper: Send notification when someone receives a message (Phone popup only)
function sendMessageNotification(recipient, senderNumber, senderName, messageText) {
    if (!recipient || !recipient.phoneNumber) return;

    // Trigger the nice notification popup on the phone (even if closed)
    recipient.call('newMessageNotification', [senderNumber, senderName, messageText]);

    // Refresh messages/conversations if phone is open
    if (recipient.isPhoneOpen) {
        loadConversationsForPlayer(recipient);
        loadMessagesForPlayer(recipient, senderNumber);
    }
}

// /sms command (from chat)
mp.events.addCommand('sms', (player, fullText, targetNumber, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!targetNumber || messageArray.length === 0) {
        return player.outputChatBox('Naudojimas: /sms [telefono numeris] [žinutė]');
    }

    const messageText = messageArray.join(' ');
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Žinutė per ilga! Maksimumas 500 simbolių.');
    }

    // Anti-spam check
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug žinučių! Palaukite minutę.');
        }
    }
    messageCooldowns.set(player, cooldown);

    const target = mp.players.toArray().find(p => p.phoneNumber === targetNumber);

    // Save message to database
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, targetNumber, messageText],
        (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko išsaugoti žinutės:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }

            player.outputChatBox(`!{#7aa164}Žinutė nusiųsta → ${targetNumber}${target ? ` (${target.charName})` : ' (neprisijungęs)'}`);

            // Send notification to recipient
            if (target && target !== player) {
                sendMessageNotification(target, player.phoneNumber, player.charName, messageText);
            }
        }
    );
});

// Send message from Phone UI
mp.events.add('sendMessage', (player, recipientNumber, messageText) => {
    console.log(`[DEBUG] Phone UI sendMessage: ${player.charName} → ${recipientNumber}`);

    if (!player.charName || !player.charId) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!player.phoneNumber) return player.outputChatBox('!{#e74c3c}Jūs neturite telefono numerio!');
    if (!recipientNumber || !messageText || messageText.trim().length === 0) {
        return player.outputChatBox('!{#e74c3c}Įveskite gavėją ir žinutę!');
    }
    if (!/^\d+$/.test(recipientNumber)) {
        return player.outputChatBox('!{#e74c3c}Numeris turi būti tik skaitmenys!');
    }
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Žinutė per ilga! (max 500 simbolių)');
    }

    // Anti-spam
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug žinučių! Palaukite minutę.');
        }
    }
    messageCooldowns.set(player, cooldown);

    const target = mp.players.toArray().find(p => p.phoneNumber === recipientNumber);

    // Save to database
    db.query(
        'INSERT INTO messages (char_id, sender_number, recipient_number, message_text) VALUES (?, ?, ?, ?)',
        [player.charId, player.phoneNumber, recipientNumber, messageText],
        (err) => {
            if (err) {
                console.error('[KLAIDA] Failed to save UI message:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunčiant žinutę.');
            }

            player.outputChatBox(`!{#7aa164}Žinutė nusiųsta → ${recipientNumber}${target ? ` (${target.charName})` : ''}`);

            // Notify the recipient
            if (target && target !== player) {
                sendMessageNotification(target, player.phoneNumber, player.charName, messageText);
            }

            // Refresh sender's own UI
            loadMessagesForPlayer(player, recipientNumber);
            loadConversationsForPlayer(player);
        }
    );
});

// Load messages for specific conversation
function loadMessagesForPlayer(player, otherNumber) {
    if (!player.charId || !player.phoneNumber) return;

    db.query(
        `SELECT sender_number, recipient_number, message_text, timestamp 
         FROM messages 
         WHERE (sender_number = ? AND recipient_number = ?) 
            OR (sender_number = ? AND recipient_number = ?) 
         ORDER BY timestamp ASC`,
        [player.phoneNumber, otherNumber, otherNumber, player.phoneNumber],
        (err, results) => {
            if (err) return console.error('[KLAIDA] Load messages error:', err);

            const messages = results.map(row => ({
                sender: row.sender_number,
                text: row.message_text,
                timestamp: row.timestamp.toISOString()
            }));

            player.call('updateMessagesUI', [otherNumber, JSON.stringify(messages)]);
        }
    );
}

// Load list of conversations
function loadConversationsForPlayer(player) {
    if (!player.charId || !player.phoneNumber) return;

    db.query(
        `SELECT DISTINCT 
            CASE WHEN sender_number = ? THEN recipient_number ELSE sender_number END AS contact_number 
         FROM messages 
         WHERE sender_number = ? OR recipient_number = ?`,
        [player.phoneNumber, player.phoneNumber, player.phoneNumber],
        (err, results) => {
            if (err) return console.error('[KLAIDA] Load conversations error:', err);

            const promises = results.map(row => {
                return new Promise(resolve => {
                    const number = row.contact_number;
                    db.query(
                        `SELECT sender_number, message_text, timestamp 
                         FROM messages 
                         WHERE (sender_number = ? AND recipient_number = ?) 
                            OR (sender_number = ? AND recipient_number = ?) 
                         ORDER BY timestamp DESC LIMIT 1`,
                        [player.phoneNumber, number, number, player.phoneNumber],
                        (err, msg) => {
                            if (err || !msg.length) return resolve(null);

                            const contactName = (player.contacts || []).find(c => c.number === number)?.name || number;

                            resolve({
                                number: number,
                                contactName: contactName,
                                lastMessage: msg[0].message_text,
                                timestamp: msg[0].timestamp.toISOString()
                            });
                        }
                    );
                });
            });

            Promise.all(promises).then(conversations => {
                const validConversations = conversations.filter(c => c !== null)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                player.call('updateConversationsUI', [JSON.stringify(validConversations)]);
            });
        }
    );
}

// Open Messages App
mp.events.add('openMessagesApp', (player) => {
    if (!player.charId) return;
    loadConversationsForPlayer(player);
});

mp.events.add('openConversation', (player, number) => {
    if (!player.charId) return;
    if (!/^\d+$/.test(number)) return;
    loadMessagesForPlayer(player, number);
});


// Request data when player opens Twitter app
mp.events.add('requestTwitterData', (player) => {
    console.log(`[TWITTER] requestTwitterData called for playerId=${player.id}, charId=${player.charId}`);

    const sendData = (handle) => {
        db.query(`
            SELECT t.handle, t.content, t.timestamp 
            FROM twitter_posts t 
            ORDER BY t.timestamp DESC LIMIT 10
        `, (err, tweets) => {
            if (err) {
                console.error('[TWITTER] Error fetching tweets:', err);
            }
            const tweetsJson = (!err && tweets) ? JSON.stringify(tweets) : '[]';
            console.log(`[TWITTER] send loadTwitterData handle=${handle || ''} tweetsCount=${(tweets && tweets.length) || 0}`);
            player.call('loadTwitterData', [handle || '', tweetsJson]);
        });
    };

    if (!player.charId) {
        console.log('[TWITTER] No charId, returning empty twitter data');
        sendData(null);
        return;
    }

    db.query('SELECT handle FROM twitter_accounts WHERE char_id = ?', [player.charId], (err, rows) => {
        if (err) {
            console.error('[TWITTER] Error fetching handle:', err);
            sendData(null);
            return;
        }
        const handle = (rows && rows.length > 0) ? rows[0].handle : null;
        sendData(handle);
    });
});

// Register unique handle
mp.events.add('registerTwitterHandle', (player, handle) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Pasirinkite veikėją!');
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
        return player.outputChatBox('!{#e74c3c}Leidžiami tik raidės, skaičiai ir _ !');
    }

    db.query('SELECT * FROM twitter_accounts WHERE handle = ?', [handle], (err, rows) => {
        if (rows.length > 0) {
            return player.outputChatBox('!{#e74c3c}Šis @slapyvardis jau užimtas!');
        }

        db.query('INSERT INTO twitter_accounts (char_id, handle) VALUES (?, ?)', [player.charId, handle], (err) => {
            if (err) return console.error(err);
            player.outputChatBox(`!{#7aa164}Jūsų @${handle} sėkmingai užregistruotas!`);
            player.call('twitterHandleRegistered', [handle]);
        });
    });
});

// Post a tweet
mp.events.add('postTweet', (player, content) => {
    if (!player.charId) return;

    if (content.length > 150) {
        return player.outputChatBox('!{#e74c3c}Skelbimas per ilgas! (max 150 simbolių)');
    }

    const now = Date.now();
    if (lastTweetTime.has(player.id) && now - lastTweetTime.get(player.id) < TWITTER_COOLDOWN) {
        const remaining = Math.ceil((TWITTER_COOLDOWN - (now - lastTweetTime.get(player.id))) / 60000);
        return player.outputChatBox(`!{#e74c3c}Galite skelbti tik kartą per valandą. Liko ${remaining} min.`);
    }

    db.query('SELECT handle FROM twitter_accounts WHERE char_id = ?', [player.charId], (err, rows) => {
        if (rows.length === 0) {
            return player.outputChatBox('!{#e74c3c}Pirmiausia užregistruokite @slapyvardį!');
        }

        const handle = rows[0].handle;

        // Check count, delete oldest if >=10
        db.query('SELECT COUNT(*) as count FROM twitter_posts', (err, results) => {
            if (err) return console.error(err);
            if (results[0].count >= 10) {
                db.query('DELETE FROM twitter_posts ORDER BY timestamp ASC LIMIT 1', (err) => {
                    if (err) return console.error(err);
                    insertTweet();
                });
            } else {
                insertTweet();
            }

            function insertTweet() {
                db.query('INSERT INTO twitter_posts (char_id, handle, content) VALUES (?, ?, ?)',
                    [player.charId, handle, content], (err) => {
                        if (err) return console.error(err);

                        lastTweetTime.set(player.id, now);
                        player.outputChatBox('!{#7aa164}Skelbimas paskelbtas visiems!');
                        player.call('twitterStatusUpdate', ['Skelbimas paskelbtas!', '#2ecc71']);

                        // Refresh feed for EVERYONE who has phone open
                        mp.players.forEach(p => {
                            if (p.isPhoneOpen) {
                                mp.events.call('requestTwitterData', p); // re-send fresh feed
                            }
                        });
                    });
            }
        });
    });
});


// ====================== MOBILE BANKING APP ======================

mp.events.add('openBankApp', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');

    // Get balance + last 5 transactions
    db.query(`
        SELECT balance FROM bank_accounts WHERE char_name = ?
    `, [player.charName], (err, balanceRes) => {
        if (err || balanceRes.length === 0) {
            return player.call('loadBankData', [0, player.charName, '[]']);
        }

        const balance = balanceRes[0].balance;

        db.query(`
            SELECT transaction_type, amount, date 
            FROM bank_transactions 
            WHERE char_name = ? 
            ORDER BY date DESC LIMIT 5
        `, [player.charName], (err, txRes) => {
            const transactions = txRes.map(t => ({
                type: t.transaction_type,
                amount: t.amount,
                date: t.date
            }));

            player.call('loadBankData', [
                balance,
                player.charName,
                JSON.stringify(transactions)
            ]);
        });
    });
});

mp.events.add('bankTransfer', (player, recipientName, amountStr) => {
    if (!player.charName) return;

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return player.call('bankTransferResult', [false, 'Neteisinga suma!']);
    }

    // Check if sender has enough
    db.query('SELECT balance FROM bank_accounts WHERE char_name = ?', [player.charName], (err, senderRes) => {
        if (err || senderRes.length === 0) {
            console.log('[BANK] bankTransfer failed sender lookup', player.charName, recipientName, amount, err);
            return player.call('bankTransferResult', [false, 'Nepakanka lėšų sąskaitoje!']);
        }
        if (senderRes[0].balance < amount) {
            console.log('[BANK] bankTransfer insufficient balance', player.charName, recipientName, amount);
            return player.call('bankTransferResult', [false, 'Nepakanka lėšų sąskaitoje!']);
        }

        // Check recipient exists
        db.query('SELECT balance FROM bank_accounts WHERE char_name = ?', [recipientName], (err, targetRes) => {
            if (err || targetRes.length === 0) {
                console.log('[BANK] bankTransfer recipient not found', recipientName);
                return player.call('bankTransferResult', [false, 'Banko sąskaita negalima']);
            }

            // Only allow transfers to players who are currently online
            const recipientPlayer = mp.players.toArray().find(p => p.charName === recipientName);
            if (!recipientPlayer) {
                console.log('[BANK] bankTransfer recipient offline', recipientName);
                return player.call('bankTransferResult', [false, 'Banko sąskaita negalima']);
            }

            const newSenderBalance = senderRes[0].balance - amount;
            const newTargetBalance = targetRes[0].balance + amount;

            // Update both accounts
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [newSenderBalance, player.charName]);
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [newTargetBalance, recipientName]);

            // Log transactions
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_out", ?, NOW())', [player.charName, amount]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_in", ?, NOW())', [recipientName, amount]);

            // Notify sender
            player.bankBalance = newSenderBalance;
            player.call('updateBankHUD', [newSenderBalance]);
            player.call('bankTransferResult', [true, `Sėkmingai pervesta $${amount} žaidėjui ${recipientName}`, recipientName, amount]);

            // Notify recipient if online
            const targetPlayer = mp.players.toArray().find(p => p.charName === recipientName);
            if (targetPlayer) {
                targetPlayer.bankBalance = newTargetBalance;
                targetPlayer.call('updateBankHUD', [newTargetBalance]);
                targetPlayer.outputChatBox(`!{#229954}Jūs gavote $${amount} iš ${player.charName} per mobilųjį banką.`);
            }
        });
    });
});

// ==================== CLOTHING SYSTEM ====================

const CLOTHING_STORES = [
    { x: -710.2, y: -152.0, z: 37.4 },  // Suburban – Rockford Hills
    { x: 121.6, y: -221.3, z: 54.5 },  // Suburban – Pillbox Hill
    { x: 613.8, y: 2763.1, z: 42.1 },  // Suburban – Paleto Bay
    { x: 75.4, y: -1393.4, z: 29.4 },  // Binco
];

const CLOTHING_STORE_RADIUS = 5.0;

// Blips so players can find the stores on the minimap
CLOTHING_STORES.forEach((pos) => {
    mp.blips.new(73, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: 'Drabužių parduotuvė',
        color: 47,
        scale: 0.85,
        shortRange: true,
    });
});

function isNearClothingStore(player) {
    const p = player.position;
    return CLOTHING_STORES.some(store => {
        const dx = p.x - store.x;
        const dy = p.y - store.y;
        const dz = p.z - store.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= CLOTHING_STORE_RADIUS;
    });
}

mp.events.addCommand('changeclothes', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearClothingStore(player)) {
        return player.outputChatBox('!{#e74c3c}Prašome eiti į drabužių parduotuvę.');
    }

    const currentClothes = player.outfitData || {};
    player.call('openClothingUI', [JSON.stringify(currentClothes)]);
});

// Live preview – apply clothes without saving
mp.events.add('previewClothes', (player, compStr, drawStr, texStr) => {
    const component = parseInt(compStr);
    const drawable = parseInt(drawStr);
    const texture = parseInt(texStr);
    if (isNaN(component) || isNaN(drawable) || isNaN(texture)) return;
    player.setClothes(component, drawable, texture, 2);
});

// Save clothes – persist to DB and keep applied
mp.events.add('saveClothes', (player, clothesJson) => {
    if (!player.charId) return;

    if (player.money < 100) {
        return player.call('clothingError', ['Nepakanka pinigų! Reikia $100.']);
    }

    let clothes;
    try { clothes = JSON.parse(clothesJson); }
    catch { return player.call('clothingError', ['Klaida: neteisingas formatas.']); }

    // Validate: only allow known component IDs, sane numeric values
    const ALLOWED = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const [comp, data] of Object.entries(clothes)) {
        const c = parseInt(comp);
        const dr = parseInt(data.d);
        const tx = parseInt(data.t);
        if (!ALLOWED.has(c) || isNaN(dr) || isNaN(tx) || dr < 0 || tx < 0 || dr > 999 || tx > 99) {
            return player.call('clothingError', ['Klaida: neleistinos reikšmės.']);
        }
        player.setClothes(c, dr, tx, 2);
    }

    player.money -= 100;
    player.outfitData = clothes;

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
    db.query('UPDATE characters SET clothes = ? WHERE id = ?', [JSON.stringify(clothes), player.charId], (err) => {
        if (err) {
            console.error('[CLOTHES] Save failed:', err.message);
            player.call('clothingError', ['Klaida išsaugant drabužius.']);
        } else {
            player.call('updateMoneyHUD', [player.money]);
            player.call('clothingSuccess', ['Drabužiai išsaugoti! Nuskaičiuota $100.']);
        }
    });
});

// Close UI – revert any un-saved preview changes back to outfitData
mp.events.add('closeClothingUI', (player) => {
    if (player.outfitData) {
        for (const [comp, data] of Object.entries(player.outfitData)) {
            player.setClothes(parseInt(comp), parseInt(data.d) || 0, parseInt(data.t) || 0, 2);
        }
    }
    player.call('closeClothingUIBrowser');
});

// ==================== BARBER SYSTEM ====================

const BARBER_SHOPS = [
    { x: -814.3, y: -183.8, z: 37.6 },
    { x: 137.0, y: -1708.7, z: 29.3 },
    { x: -1282.2, y: -1116.8, z: 6.0 },
    { x: 1932.4, y: 3729.1, z: 32.8 },
    { x: 1212.7, y: -472.8, z: 66.2 },
    { x: -33.2, y: -152.6, z: 57.1 },
    { x: -278.1, y: 6228.5, z: 31.7 },
];

const BARBER_SHOP_RADIUS = 5.0;

BARBER_SHOPS.forEach((pos) => {
    mp.blips.new(71, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: 'Kirpykla',
        color: 47,
        scale: 0.75,
        shortRange: true,
    });
});

function isNearBarberShop(player) {
    const p = player.position;
    return BARBER_SHOPS.some(store => {
        const dx = p.x - store.x;
        const dy = p.y - store.y;
        const dz = p.z - store.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= BARBER_SHOP_RADIUS;
    });
}

mp.events.addCommand('barber', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prašome pasirinkti veikėją.');
    if (!isNearBarberShop(player)) {
        return player.outputChatBox('!{#e74c3c}Prašome eiti į kirpyklą.');
    }

    const current = player.barberData || {
        hairStyle: 0,
        hairColor: 0,
        hairHighlight: 0,
        beardStyle: -1,
        beardOpacity: 10,
    };

    player.call('openBarberUI', [JSON.stringify(current)]);
});

mp.events.add('saveBarber', (player, barberJson) => {
    if (!player.charId) return;
    if (!isNearBarberShop(player)) {
        return player.call('barberError', ['Kirpykla per toli.']);
    }
    if (player.money < 50) {
        return player.call('barberError', ['Nepakanka pinigų! Reikia $50.']);
    }

    let barber;
    try {
        barber = JSON.parse(barberJson);
    } catch (e) {
        return player.call('barberError', ['Neteisingi barber duomenys.']);
    }

    const normalized = {
        hairStyle: Math.max(0, parseInt(barber.hairStyle) || 0),
        hairColor: Math.max(0, parseInt(barber.hairColor) || 0),
        hairHighlight: Math.max(0, parseInt(barber.hairHighlight) || 0),
        beardStyle: parseInt(barber.beardStyle),
        beardOpacity: Math.max(0, Math.min(10, parseInt(barber.beardOpacity) || 0)),
    };

    if (isNaN(normalized.beardStyle)) normalized.beardStyle = -1;

    player.money -= 50;
    player.barberData = normalized;

    db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);
    db.query('UPDATE characters SET barber = ? WHERE id = ?', [JSON.stringify(normalized), player.charId], (err) => {
        if (err) {
            console.error('[BARBER] Save failed:', err.message);
            player.call('barberError', ['Nepavyko išsaugoti šukuosenos.']);
        } else {
            player.call('applyBarberAppearance', [JSON.stringify(normalized)]);
            player.call('updateMoneyHUD', [player.money]);
            player.call('barberSuccess', ['Išvaizda išsaugota. Nuskaičiuota $50.']);
        }
    });
});

mp.events.add('closeBarberUI', (player) => {
    const current = player.barberData || {
        hairStyle: 0,
        hairColor: 0,
        hairHighlight: 0,
        beardStyle: -1,
        beardOpacity: 10,
    };

    // Revert unsaved preview values.
    player.call('applyBarberAppearance', [JSON.stringify(current)]);
    player.call('closeBarberUIBrowser');
});