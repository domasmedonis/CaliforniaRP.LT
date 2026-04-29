let bankUI = null;
let dealershipBrowser = null;
let pendingDealershipState = null;
let isDealershipDomReady = false;
let houseBrowser = null;
let pendingHouseState = null;
let isHouseDomReady = false;
let dealershipPreviewVehicle = null;
let dealershipCatalog = [];
let dealershipCam = null;
const DEALERSHIP_PREVIEW_POSITION = new mp.Vector3(-56.58, -1111.95, 26.44);
const DEALERSHIP_PREVIEW_HEADING = 69.0;
let inventoryBrowser = null;
let isInventoryOpen = false;
let lastInventoryRequestAt = 0;
let lastPassengerEnterAttemptAt = 0;
let pendingInventoryState = null;
let isInventoryDomReady = false;
let manualLightsVehicleHandle = 0;
let manualLightsOverrideState = null;
let manualLightsOverrideExpiresAt = 0;
let passengerShuffleActiveUntil = 0;
let passengerShuffleNextAt = 0;
let passengerShuffleAttempts = 0;
let ownedVehicleBlip = null;
const WEAPON_UNARMED_HASH = mp.game.joaat('weapon_unarmed');
const NON_AMMO_WEAPON_HASHES = new Set([
    WEAPON_UNARMED_HASH,
    mp.game.joaat('weapon_knife'),
    mp.game.joaat('weapon_bat'),
]);
let lastAmmoCheckAt = 0;
let lastEmptyWeaponRequestHash = null;
let fallbackChatInputActive = false;

mp.gui.chat.push('Hello World')

globalThis.__isInventoryOpen = false;

function isNativeChatInputActive() {
    try {
        if (mp.game && mp.game.ui && typeof mp.game.ui.isChatInputActive === 'function') {
            return Boolean(mp.game.ui.isChatInputActive());
        }
    } catch (e) {
        // Ignore unavailable native on some client builds.
    }

    return fallbackChatInputActive;
}

function canToggleInventory() {
    return !isLoginUIActive
        && !loginUI
        && !bankUI
        && !clothingUI
        && !barberUI
        && !dealershipBrowser
        && !houseBrowser
        && !browser
        && !paycheckBrowser
        && !isNativeChatInputActive()
        && !globalThis.__isPhoneOpen;
}

function setInventoryUiOpenState(isOpen) {
    isInventoryOpen = isOpen;
    globalThis.__isInventoryOpen = isOpen;
    mp.gui.cursor.show(isOpen, isOpen);
    mp.gui.chat.show(true);
    mp.gui.chat.activate(!isOpen);

    if (mp.game && mp.game.controls && typeof mp.game.controls.disableAllControls === 'function') {
        mp.game.controls.disableAllControls(isOpen);
    }
}

function closeInventoryBrowser() {
    if (inventoryBrowser) {
        inventoryBrowser.destroy();
        inventoryBrowser = null;
    }

    pendingInventoryState = null;
    isInventoryDomReady = false;
    setInventoryUiOpenState(false);
}

function sendInventoryStateToBrowser(functionName, itemsJson, statusText, success) {
    if (!inventoryBrowser) return;
    inventoryBrowser.execute(`${functionName}(${JSON.stringify(itemsJson || '[]')}, ${JSON.stringify(statusText || '')}, ${JSON.stringify(Boolean(success))});`);
}

function applyVehicleLightsOverride(vehicle, isOn) {
    if (!vehicle || !vehicle.handle) return;

    try {
        if (mp.game && mp.game.vehicle && typeof mp.game.vehicle.setVehicleLights === 'function') {
            mp.game.vehicle.setVehicleLights(vehicle.handle, isOn ? 2 : 4);
        }
    } catch (e) {
        // Ignore unavailable native on older client builds.
    }
}

function clearVehicleLightsOverrideByHandle(vehicleHandle) {
    if (!vehicleHandle) return;

    try {
        if (mp.game && mp.game.vehicle && typeof mp.game.vehicle.setVehicleLights === 'function') {
            mp.game.vehicle.setVehicleLights(vehicleHandle, 0);
        }
    } catch (e) {
        // Ignore unavailable native on older client builds.
    }
}

function clearOwnedVehicleBlip() {
    if (!ownedVehicleBlip) return;

    try {
        ownedVehicleBlip.destroy();
    } catch (e) {
        // Ignore blip destroy errors during reconnect or resource reload.
    }

    ownedVehicleBlip = null;
}

function getCurrentWeaponHash(localPlayer) {
    if (!localPlayer || !localPlayer.handle) return 0;

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.getSelectedPedWeapon === 'function') {
            const selected = Number(mp.game.weapon.getSelectedPedWeapon(localPlayer.handle));
            if (Number.isFinite(selected)) {
                return selected;
            }
        }
    } catch (e) {
        // Ignore native failures on client builds missing this native.
    }

    const fallback = Number(localPlayer.weapon);
    return Number.isFinite(fallback) ? fallback : 0;
}

function getTotalAmmoForWeapon(localPlayer, weaponHash) {
    if (!localPlayer || !localPlayer.handle) return null;

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.getAmmoInPedWeapon === 'function') {
            const totalAmmo = Number(mp.game.weapon.getAmmoInPedWeapon(localPlayer.handle, weaponHash));
            if (Number.isFinite(totalAmmo)) {
                return totalAmmo;
            }
        }
    } catch (e) {
        // Ignore native failures on client builds missing this native.
    }

    return null;
}

function forceSwitchToUnarmed(localPlayer, weaponHash) {
    if (!localPlayer || !localPlayer.handle) return;

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.removeWeaponFromPed === 'function') {
            mp.game.weapon.removeWeaponFromPed(localPlayer.handle, weaponHash);
        }
    } catch (e) {
        // Ignore native failures on client builds missing this native.
    }

    try {
        if (mp.game && mp.game.weapon && typeof mp.game.weapon.setCurrentPedWeapon === 'function') {
            mp.game.weapon.setCurrentPedWeapon(localPlayer.handle, WEAPON_UNARMED_HASH, true);
        }
    } catch (e) {
        // Ignore native failures on client builds missing this native.
    }
}

function getAddressHashFromPosition(x, y, z) {
    const xx = Math.floor(Math.abs(Number(x) || 0) * 100);
    const yy = Math.floor(Math.abs(Number(y) || 0) * 100);
    const zz = Math.floor(Math.abs(Number(z) || 0) * 100);
    return ((xx * 73856093) ^ (yy * 19349663) ^ (zz * 83492791)) >>> 0;
}

function getStreetHashesAtCoords(x, y, z) {
    if (!mp.game || !mp.game.pathfind || typeof mp.game.pathfind.getStreetNameAtCoord !== 'function') {
        return null;
    }

    try {
        const result = mp.game.pathfind.getStreetNameAtCoord(Number(x), Number(y), Number(z), 0, 0);
        if (Array.isArray(result) && result.length >= 1) {
            return {
                streetHash: Number(result[0]) || 0,
                crossingHash: Number(result[1]) || 0,
            };
        }

        if (result && typeof result === 'object') {
            return {
                streetHash: Number(result.streetName) || Number(result[0]) || 0,
                crossingHash: Number(result.crossingRoad) || Number(result[1]) || 0,
            };
        }
    } catch (e) {
        // Fallback to null when native call is unavailable on client build.
    }

    return null;
}

function getStreetNameFromHash(streetHash) {
    if (!streetHash) return '';
    if (!mp.game || !mp.game.ui || typeof mp.game.ui.getStreetNameFromHashKey !== 'function') return '';

    try {
        return String(mp.game.ui.getStreetNameFromHashKey(streetHash) || '').trim();
    } catch (e) {
        return '';
    }
}

function buildNativePropertyAddress(x, y, z) {
    const hashes = getStreetHashesAtCoords(x, y, z);
    const primaryStreetName = hashes ? getStreetNameFromHash(hashes.streetHash) : '';
    const crossingStreetName = hashes ? getStreetNameFromHash(hashes.crossingHash) : '';

    let streetName = primaryStreetName;
    if (!streetName && crossingStreetName) {
        streetName = crossingStreetName;
    }
    if (!streetName) {
        streetName = 'San Andreas Avenue';
    }

    const hash = getAddressHashFromPosition(x, y, z);
    const houseNumber = 100 + (hash % 9800);
    return `${houseNumber} ${streetName}`;
}

mp.events.add('resolvePropertyNativeAddress', (propertyIdRaw, xRaw, yRaw, zRaw) => {
    const propertyId = parseInt(propertyIdRaw, 10);
    if (!Number.isFinite(propertyId)) return;

    const x = Number(xRaw) || 0;
    const y = Number(yRaw) || 0;
    const z = Number(zRaw) || 0;
    const address = buildNativePropertyAddress(x, y, z);
    mp.events.callRemote('propertyNativeAddressResolved', propertyId, address);
});

mp.events.add('showOwnedVehicleBlip', (x, y, z, label) => {
    clearOwnedVehicleBlip();

    ownedVehicleBlip = mp.blips.new(227, new mp.Vector3(Number(x), Number(y), Number(z)), {
        name: label || 'Owned Vehicle',
        color: 2,
        scale: 0.8,
        shortRange: false,
    });
});

mp.events.add('clearOwnedVehicleBlip', () => {
    clearOwnedVehicleBlip();
});


mp.events.add('freezePlayer', (freeze) => {
    if (freeze) {
        mp.players.local.freezePosition(true); // Freeze the player's position
    } else {
        mp.players.local.freezePosition(false); // Unfreeze the player's position
    }
});



mp.events.add('hideDefaultCashUI', () => {
    // Disable the default cash HUD display
    mp.game.ui.displayCash(false); // This hides the default cash UI element
});



let playerMoney = 0;

// Receive money update from the server
mp.events.add('updateMoneyHUD', (money) => {
    playerMoney = money;
});

// Render money on the screen
mp.events.add('render', () => {
    mp.game.graphics.drawText(`$${playerMoney}`, [0.95, 0.05], {
        font: 7, // GTA-style font (try 4 or 7 if you want to experiment)
        color: [158, 199, 121, 255], // HEX #27AE60 converted to RGBA
        scale: [0.77, 0.77], // Good size for visibility
        outline: true, // Adds outline for better contrast
        shadow: true // Adds depth with shadow
    });
});


let currentServerTime = "00:00"; // Default time

// Event to receive the server time from the server
mp.events.add('updateServerTime', (serverTime) => {
    // Convert serverTime to Date and format it to HH:mm (hours and minutes only)
    const time = new Date(serverTime);
    const hours = String(time.getHours()).padStart(2, '0'); // Format hours to 2 digits
    const minutes = String(time.getMinutes()).padStart(2, '0'); // Format minutes to 2 digits
    currentServerTime = `${hours}:${minutes}`;
    console.log("Received server time:", currentServerTime); // Log to verify correct time format
});

// Render the time on the screen
mp.events.add('render', () => {
    const timeX = 0.5; // X position (centered)
    const timeY = 0.955; // Y position (bottom of the screen)
    const font = 0; // Basic font
    const scale = 0.45; // Scale (size of text)
    const whiteColor = [255, 255, 255, 255]; // White color for time
    const californiaText = "CaliforniaRP.LT";

    // Display the time part (HH:mm) and CaliforniaRP.LT
    mp.game.graphics.drawText(`${currentServerTime} | ${californiaText}`, [timeX, timeY], {
        font: font,
        color: whiteColor,
        scale: [scale, scale],
        alignment: 1, // Center alignment
        outline: true,
    });
});

mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const vehicle = localPlayer.vehicle;
    if (!vehicle || !vehicle.handle) {
        if (manualLightsVehicleHandle) {
            clearVehicleLightsOverrideByHandle(manualLightsVehicleHandle);
        }

        manualLightsVehicleHandle = 0;
        manualLightsOverrideState = null;
        manualLightsOverrideExpiresAt = 0;
        return;
    }

    const now = Date.now();
    const hasFreshOverride = manualLightsOverrideState !== null && now < manualLightsOverrideExpiresAt;
    const syncedLightsState = Number(vehicle.getVariable('manualLightsOn')) === 1;
    const effectiveLightsState = hasFreshOverride ? manualLightsOverrideState : syncedLightsState;

    manualLightsVehicleHandle = vehicle.handle;
    applyVehicleLightsOverride(vehicle, effectiveLightsState);
});

mp.events.add('render', () => {
    const now = Date.now();
    if (now > passengerShuffleActiveUntil) return;

    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.handle) return;
    if (!localPlayer.vehicle || !localPlayer.vehicle.handle) return;

    const seat = Number(localPlayer.seat);
    if (seat >= 2) {
        passengerShuffleActiveUntil = 0;
        passengerShuffleAttempts = 0;
        return;
    }

    if (seat !== 0 && seat !== 1) return;
    if (now < passengerShuffleNextAt) return;
    if (passengerShuffleAttempts >= 8) {
        passengerShuffleActiveUntil = 0;
        return;
    }

    passengerShuffleAttempts += 1;
    passengerShuffleNextAt = now + 450;

    try {
        if (mp.game && mp.game.ai && typeof mp.game.ai.taskShuffleToNextVehicleSeat === 'function') {
            mp.game.ai.taskShuffleToNextVehicleSeat(localPlayer.handle, localPlayer.vehicle.handle);
        }
    } catch (e) {
        // Ignore shuffle errors on builds where the native is unavailable.
    }
});



let paycheckBrowser = null;

mp.events.add('showPaycheckPopup', (amount) => {
    if (!paycheckBrowser) {
        paycheckBrowser = mp.browsers.new('package://cef/paycheck.html');
    }


    paycheckBrowser.execute(`showPaycheck(${amount})`); // Call the function in HTML
});

mp.keys.bind(0x45, false, function () { // 'E' key
    if (paycheckBrowser) {
        paycheckBrowser.execute(`closePaycheck()`);
        setTimeout(() => {
            paycheckBrowser.destroy();
            paycheckBrowser = null;
        }, 100);
    }
});


// Update your existing functions

// Client-Side (main client-side .js file)

// When the bank UI is opened, the history and balance are updated
mp.events.add('openBankUI', (balance, cash, history) => {
    if (bankUI) {
        bankUI.destroy();
        bankUI = null;
    }

    bankUI = mp.browsers.new('package://cef/bankUI.html');

    bankUI.execute(`updateBankBalance(${balance}); updateCash(${cash}); updateTransactionHistory(${JSON.stringify(history)});`);

    mp.gui.cursor.show(true, true);
});

// Event to update the bank balance and cash balance in the UI
mp.events.add('updateBankUI', (balance, cash, history) => {
    if (bankUI) {
        // Update balance and history in the UI
        bankUI.execute(`updateBankBalance(${balance}); updateCash(${cash}); updateTransactionHistory(${JSON.stringify(history)});`);
    }
});

// Event to handle error messages (like invalid amount)
mp.events.add('bankError', (message) => {
    if (bankUI) {
        bankUI.execute(`showBankError('${message}');`);
    }
});

// Event to close the bank UI and hide the cursor
mp.events.add('closeBankUI', () => {
    if (bankUI) {
        bankUI.destroy();
        bankUI = null;
    }

    mp.gui.cursor.show(false, false);
});

function closeDealershipUI() {
    if (dealershipBrowser) {
        dealershipBrowser.destroy();
        dealershipBrowser = null;
    }

    if (dealershipPreviewVehicle) {
        dealershipPreviewVehicle.destroy();
        dealershipPreviewVehicle = null;
    }

    if (dealershipCam) {
        dealershipCam.setActive(false);
        mp.game.cam.renderScriptCams(false, true, 300, true, false);
        dealershipCam.destroy();
        dealershipCam = null;

        try {
            if (typeof mp.game.streaming.clearFocus === 'function') {
                mp.game.streaming.clearFocus();
            }
        } catch (e) {
            // Ignore when native is unavailable on older client build.
        }
    }

    dealershipCatalog = [];

    mp.gui.cursor.show(false, false);
    mp.gui.chat.show(true);
    mp.gui.chat.activate(true);
    pendingDealershipState = null;
    isDealershipDomReady = false;
}

function sendDealershipStateToBrowser(catalogJson, money, bankMoney = 0) {
    if (!dealershipBrowser) return;
    dealershipBrowser.execute(
        `initDealership(${JSON.stringify(catalogJson || '[]')}, ${JSON.stringify(Number(money) || 0)}, ${JSON.stringify(Number(bankMoney) || 0)});`
    );
}

function closeHouseUI() {
    if (houseBrowser) {
        houseBrowser.destroy();
        houseBrowser = null;
    }

    pendingHouseState = null;
    isHouseDomReady = false;
    mp.gui.cursor.show(false, false);
    mp.gui.chat.show(true);
    mp.gui.chat.activate(true);
}

function sendHouseStateToBrowser(functionName, payloadJson, statusText = '', success = true) {
    if (!houseBrowser) return;
    houseBrowser.execute(
        `${functionName}(${JSON.stringify(payloadJson || '{}')}, ${JSON.stringify(statusText || '')}, ${JSON.stringify(Boolean(success))});`
    );
}

function getDealershipPreviewSpawnPoint() {
    return {
        position: new mp.Vector3(
            DEALERSHIP_PREVIEW_POSITION.x,
            DEALERSHIP_PREVIEW_POSITION.y,
            DEALERSHIP_PREVIEW_POSITION.z,
        ),
        heading: DEALERSHIP_PREVIEW_HEADING,
    };
}

function createOrUpdateDealershipCamera(targetPosition, heading) {
    if (!targetPosition) return;

    const h = Number.isFinite(heading) ? heading : 0;
    const rad = (h + 140) * Math.PI / 180;
    const camPos = new mp.Vector3(
        targetPosition.x + Math.sin(rad) * 8.1,
        targetPosition.y + Math.cos(rad) * 8.1,
        targetPosition.z + 2.25
    );

    if (!dealershipCam) {
        dealershipCam = mp.cameras.new('default', camPos, new mp.Vector3(0, 0, 0), 40);
        dealershipCam.setActive(true);
        mp.game.cam.renderScriptCams(true, true, 300, true, false);
    } else {
        dealershipCam.setCoord(camPos.x, camPos.y, camPos.z);
        dealershipCam.setFov(40);
    }

    dealershipCam.pointAtCoord(targetPosition.x, targetPosition.y, targetPosition.z + 0.9);

    try {
        if (typeof mp.game.streaming.setFocusArea === 'function') {
            mp.game.streaming.setFocusArea(targetPosition.x, targetPosition.y, targetPosition.z + 0.9, 0, 0, 0);
        }
    } catch (e) {
        // Ignore when native is unavailable on older client build.
    }
}

function destroyLocalDealershipPreviewVehicle() {
    if (!dealershipPreviewVehicle) return;
    dealershipPreviewVehicle.destroy();
    dealershipPreviewVehicle = null;
}

function applyPreviewVehicleColors(primaryColorRaw, secondaryColorRaw) {
    if (!dealershipPreviewVehicle || !dealershipPreviewVehicle.handle) return;

    const primary = Math.max(0, Math.min(160, parseInt(primaryColorRaw, 10) || 0));
    const secondary = Math.max(0, Math.min(160, parseInt(secondaryColorRaw, 10) || 0));

    try {
        if (typeof dealershipPreviewVehicle.setColours === 'function') {
            dealershipPreviewVehicle.setColours(primary, secondary);
            return;
        }

        dealershipPreviewVehicle.primaryColor = primary;
        dealershipPreviewVehicle.secondaryColor = secondary;
    } catch (e) {
        // Ignore unsupported color natives on specific client builds.
    }
}

function spawnLocalDealershipPreviewVehicle(modelName) {
    if (!modelName) return;

    destroyLocalDealershipPreviewVehicle();

    const spawnData = getDealershipPreviewSpawnPoint();
    createOrUpdateDealershipCamera(spawnData.position, spawnData.heading);

    try {
        dealershipPreviewVehicle = mp.vehicles.new(mp.game.joaat(String(modelName)), spawnData.position, {
            heading: spawnData.heading,
            numberPlate: 'VIEW',
            engine: false,
            lockState: 2,
            dimension: mp.players.local.dimension || 0,
        });

        // Ensure preview never stays below map on different terrain/interiors.
        if (typeof dealershipPreviewVehicle.placeOnGroundProperly === 'function') {
            dealershipPreviewVehicle.placeOnGroundProperly();
        }

        dealershipPreviewVehicle.setDirtLevel(0);
        dealershipPreviewVehicle.setEngineOn(false, false, false);

        if (dealershipCam) {
            const previewPos = dealershipPreviewVehicle.position || spawnData.position;
            createOrUpdateDealershipCamera(previewPos, spawnData.heading);
        }
    } catch (error) {
        dealershipPreviewVehicle = null;
    }
}

mp.events.add('openDealershipUI', (catalogJson, money, bankMoney) => {
    destroyLocalDealershipPreviewVehicle();

    if (dealershipBrowser) {
        dealershipBrowser.destroy();
        dealershipBrowser = null;
    }

    dealershipBrowser = mp.browsers.new('package://cef/dealershipUI.html');
    dealershipBrowser.active = true;
    isDealershipDomReady = false;
    pendingDealershipState = {
        catalogJson: catalogJson || '[]',
        money: Number(money) || 0,
        bankMoney: Number(bankMoney) || 0,
    };

    try {
        dealershipCatalog = Array.isArray(catalogJson)
            ? catalogJson
            : JSON.parse(catalogJson || '[]');
    } catch (e) {
        dealershipCatalog = [];
    }

    const initialPreviewSpawn = getDealershipPreviewSpawnPoint();
    createOrUpdateDealershipCamera(initialPreviewSpawn.position, initialPreviewSpawn.heading);

    sendDealershipStateToBrowser(pendingDealershipState.catalogJson, pendingDealershipState.money, pendingDealershipState.bankMoney);

    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(true);
    mp.gui.chat.activate(false);

    setTimeout(() => {
        if (!dealershipBrowser || !pendingDealershipState || isDealershipDomReady) return;
        sendDealershipStateToBrowser(pendingDealershipState.catalogJson, pendingDealershipState.money, pendingDealershipState.bankMoney);
        mp.gui.cursor.show(true, true);
        mp.gui.chat.activate(false);
    }, 80);

    setTimeout(() => {
        if (!dealershipBrowser || !pendingDealershipState || isDealershipDomReady) return;
        sendDealershipStateToBrowser(pendingDealershipState.catalogJson, pendingDealershipState.money, pendingDealershipState.bankMoney);
        mp.gui.cursor.show(true, true);
        mp.gui.chat.activate(false);
    }, 320);
});

mp.events.add('closeDealershipUI', () => {
    closeDealershipUI();
});

mp.events.add('dealershipPurchase', (vehicleId, primaryColor, secondaryColor, paymentMethod) => {
    mp.events.callRemote(
        'dealershipBuyVehicle',
        String(vehicleId || ''),
        String(primaryColor || '0'),
        String(secondaryColor || '0'),
        String(paymentMethod || 'cash')
    );
});

mp.events.add('dealershipPreview', (vehicleId) => {
    const id = parseInt(String(vehicleId || ''), 10);
    if (!Number.isFinite(id)) return;

    const selected = dealershipCatalog.find(item => item && item.id === id);
    if (!selected || !selected.model) return;

    spawnLocalDealershipPreviewVehicle(selected.model);
});

mp.events.add('dealershipPreviewColors', (primaryColor, secondaryColor) => {
    applyPreviewVehicleColors(primaryColor, secondaryColor);
});

mp.events.add('dealershipClose', () => {
    closeDealershipUI();
});

mp.events.add('dealershipPurchaseResult', (success, message, currentMoney, currentBankMoney) => {
    if (Number.isFinite(Number(currentMoney))) {
        playerMoney = Number(currentMoney);
    }

    if (dealershipBrowser) {
        dealershipBrowser.execute(
            `setDealershipStatus(${JSON.stringify(Boolean(success))}, ${JSON.stringify(message || '')}, ${JSON.stringify(Number(currentMoney) || 0)}, ${JSON.stringify(Number(currentBankMoney) || 0)});`
        );
    }
});

mp.events.add('openHouseUI', (payloadJson) => {
    if (houseBrowser) {
        houseBrowser.destroy();
        houseBrowser = null;
    }

    houseBrowser = mp.browsers.new('package://cef/houseUI.html');
    houseBrowser.active = true;
    isHouseDomReady = false;
    pendingHouseState = {
        payloadJson: payloadJson || '{}',
        statusText: '',
        success: true,
        functionName: 'initHousePanel',
    };

    mp.gui.cursor.show(true, true);
    mp.gui.chat.show(true);
    mp.gui.chat.activate(false);

    setTimeout(() => {
        if (!houseBrowser || !pendingHouseState || isHouseDomReady) return;
        sendHouseStateToBrowser(
            pendingHouseState.functionName,
            pendingHouseState.payloadJson,
            pendingHouseState.statusText,
            pendingHouseState.success
        );
    }, 300);
});

mp.events.add('updateHouseUI', (payloadJson, statusText = '', success = true) => {
    pendingHouseState = {
        payloadJson: payloadJson || '{}',
        statusText,
        success,
        functionName: isHouseDomReady ? 'updateHousePanel' : 'initHousePanel',
    };

    if (houseBrowser && isHouseDomReady) {
        sendHouseStateToBrowser(pendingHouseState.functionName, payloadJson || '{}', statusText, success);
    }
});

mp.events.add('closeHouseUI', () => {
    closeHouseUI();
});

mp.events.add('houseUiClose', () => {
    closeHouseUI();
});

mp.events.add('houseUiRequestRefresh', () => {
    mp.events.callRemote('houseUiRequestRefresh');
});

mp.events.add('houseUiEnterExit', () => {
    mp.events.callRemote('houseUiEnterExit');
});

mp.events.add('houseUiToggleLock', () => {
    mp.events.callRemote('houseUiToggleLock');
});

mp.events.add('houseUiSetRent', (amountRaw) => {
    mp.events.callRemote('houseUiSetRent', String(amountRaw || '0'));
});

mp.events.add('houseUiOfferRent', (targetIdentifier, amountRaw) => {
    mp.events.callRemote('houseUiOfferRent', String(targetIdentifier || ''), String(amountRaw || '0'));
});

mp.events.add('houseUiStopRent', () => {
    mp.events.callRemote('houseUiStopRent');
});

mp.events.add('applyManualLightsState', (isOn) => {
    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.vehicle || !localPlayer.vehicle.handle) return;

    const vehicle = localPlayer.vehicle;
    manualLightsVehicleHandle = vehicle.handle;
    manualLightsOverrideState = Boolean(isOn);
    manualLightsOverrideExpiresAt = Date.now() + 1200;
    applyVehicleLightsOverride(vehicle, manualLightsOverrideState);
});

mp.events.add('openInventoryUI', (itemsJson, statusText = '') => {
    if (inventoryBrowser) {
        inventoryBrowser.destroy();
        inventoryBrowser = null;
    }

    inventoryBrowser = mp.browsers.new('package://cef/inventoryUI.html');
    inventoryBrowser.active = true;
    isInventoryDomReady = false;
    pendingInventoryState = {
        itemsJson: itemsJson || '[]',
        statusText,
        success: true,
        functionName: 'initInventory',
    };

    // Fallback for clients where browserDomReady can be delayed/missed.
    setTimeout(() => {
        if (!inventoryBrowser || !pendingInventoryState || isInventoryDomReady) return;
        sendInventoryStateToBrowser(
            pendingInventoryState.functionName,
            pendingInventoryState.itemsJson,
            pendingInventoryState.statusText,
            pendingInventoryState.success
        );
    }, 300);

    setInventoryUiOpenState(true);
});

mp.events.add('updateInventoryUI', (itemsJson, statusText = '', success = true) => {
    pendingInventoryState = {
        itemsJson: itemsJson || '[]',
        statusText,
        success,
        functionName: isInventoryOpen ? 'updateInventory' : 'initInventory',
    };

    if (inventoryBrowser && isInventoryDomReady) {
        sendInventoryStateToBrowser(pendingInventoryState.functionName, itemsJson || '[]', statusText, success);
    }
});

mp.events.add('closeInventoryUI', () => {
    closeInventoryBrowser();
});

mp.events.add('inventoryUseItem', (itemId) => {
    mp.events.callRemote('inventoryUseItem', itemId);
});

mp.events.add('inventoryDropItem', (itemId, amount) => {
    mp.events.callRemote('inventoryDropItem', itemId, amount);
});

mp.events.add('inventoryGiveItem', (itemId, targetIdentifier, amount) => {
    mp.events.callRemote('inventoryGiveItem', itemId, targetIdentifier, amount);
});

mp.events.add('requestInventoryRefresh', () => {
    mp.events.callRemote('requestInventoryRefresh');
});

function canUsePassengerEnterHotkey() {
    return !isLoginUIActive
        && !bankUI
        && !clothingUI
        && !barberUI
        && !dealershipBrowser
        && !houseBrowser
        && !inventoryBrowser
        && !paycheckBrowser
        && !globalThis.__isPhoneOpen
        && !isNativeChatInputActive();
}

function getClosestVehicleInRange(position, maxDistance = 6.0) {
    if (!position || !Number.isFinite(maxDistance)) return null;

    let closestVehicle = null;
    let closestDistance = maxDistance;

    if (!mp.vehicles || typeof mp.vehicles.forEachInStreamRange !== 'function') return null;

    mp.vehicles.forEachInStreamRange((vehicle) => {
        if (!vehicle || !vehicle.handle || !vehicle.position) return;

        const dx = Number(vehicle.position.x) - Number(position.x);
        const dy = Number(vehicle.position.y) - Number(position.y);
        const dz = Number(vehicle.position.z) - Number(position.z);
        const dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));

        if (dist <= closestDistance) {
            closestDistance = dist;
            closestVehicle = vehicle;
        }
    });

    return closestVehicle;
}

function findFreePassengerSeat(vehicle) {
    if (!vehicle || !vehicle.handle) return null;

    // Prefer likely rear seats first across different seat-index schemes.
    // Do not target front seats here; they are fallback-only in correction logic.
    const prioritizedSeats = [2, 3, 4, 5, 6, 1];
    const hasSeatFreeNative = Boolean(
        mp.game
        && mp.game.vehicle
        && typeof mp.game.vehicle.isVehicleSeatFree === 'function'
    );
    const hasPedInSeatNative = Boolean(
        mp.game
        && mp.game.vehicle
        && typeof mp.game.vehicle.getPedInVehicleSeat === 'function'
    );

    for (const seat of prioritizedSeats) {
        try {
            if (hasSeatFreeNative && mp.game.vehicle.isVehicleSeatFree(vehicle.handle, seat)) {
                return seat;
            }

            if (hasPedInSeatNative && !hasSeatFreeNative) {
                const pedInSeat = Number(mp.game.vehicle.getPedInVehicleSeat(vehicle.handle, seat));
                if (!Number.isFinite(pedInSeat) || pedInSeat === 0) {
                    return seat;
                }
            }

            // No safe fallback to front seats for G hotkey.
        } catch (e) {
            // Ignore native errors and continue checking other seats.
        }
    }

    return null;
}

mp.keys.bind(0x47, true, () => {
    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.handle) return;

    const now = Date.now();
    if (now - lastPassengerEnterAttemptAt < 300) return;
    lastPassengerEnterAttemptAt = now;

    if (!canUsePassengerEnterHotkey()) return;
    if (localPlayer.vehicle) return;

    const nearbyVehicle = getClosestVehicleInRange(localPlayer.position, 6.0);
    if (!nearbyVehicle) return;

    const freeSeat = findFreePassengerSeat(nearbyVehicle);
    // Always attempt passenger entry; seat hint is refined by server correction after entry.
    const seatHint = freeSeat === null ? 1 : freeSeat;

    try {
        // Let GTA handle the enter animation and let the server correct the final seat if needed.
        mp.events.callRemote('requestPassengerSeatEnter', nearbyVehicle.id, seatHint);
        localPlayer.taskEnterVehicle(nearbyVehicle.handle, 5000, seatHint, 1.5, 1, 0);
        passengerShuffleActiveUntil = Date.now() + 6500;
        passengerShuffleNextAt = Date.now() + 500;
        passengerShuffleAttempts = 0;
    } catch (e) {
        mp.gui.chat.push('!{#e74c3c}Nepavyko ieiti i transporto priemone kaip keleiviui.');
    }
});

// Fallback chat input tracking for clients where isChatInputActive native is unavailable.
mp.keys.bind(0x54, false, () => {
    fallbackChatInputActive = true;
});

mp.keys.bind(0x0D, false, () => {
    fallbackChatInputActive = false;
});

mp.keys.bind(0x49, true, () => {
    if (isInventoryOpen) {
        closeInventoryBrowser();
        return;
    }

    if (!canToggleInventory()) {
        return;
    }

    const now = Date.now();
    if (now - lastInventoryRequestAt < 120) {
        return;
    }

    lastInventoryRequestAt = now;

    mp.events.callRemote('requestInventoryOpen');

    // Retry once if the first open packet/UI event was dropped.
    setTimeout(() => {
        if (!isInventoryOpen) {
            mp.events.callRemote('requestInventoryOpen');
        }
    }, 260);
});


// Event listener from the bank UI to handle deposit/withdraw actions
mp.events.add('bankAction', (type, amount) => {
    // Validate the amount before passing it to the server
    if (isNaN(amount) || amount <= 0) {
        mp.events.call('bankError', "Įveskite teisingą sumą.");
        return;
    }

    // Trigger server-side event to handle deposit/withdraw
    mp.events.callRemote('bankAction', type, amount);  // Sends data to the server-side
});

// Event listener from the bank UI to handle transfer actions
mp.events.add('bankTransfer', (recipientName, amount) => {
    if (!recipientName || isNaN(amount) || amount <= 0) {
        mp.events.call('bankError', 'Neteisingi pervedimo duomenys.');
        return;
    }

    mp.events.callRemote('bankTransfer', recipientName, amount);
});

// Forward transfer result messages back to bank UI
mp.events.add('bankTransferResult', (success, message) => {
    if (bankUI) {
        bankUI.execute(`onTransferResult(${JSON.stringify(success)}, ${JSON.stringify(message || '')});`);
    }
});

// ==================== CLOTHING SYSTEM ====================
let clothingUI = null;
let clothingCam = null;
let barberUI = null;

function createClothingCamera() {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const p = localPlayer.position;
    const heading = localPlayer.getHeading();
    const rad = heading * Math.PI / 180;

    // Use an angled front-side shot to reduce wall clipping when player stands near markers/interiors.
    const forwardX = Math.sin(rad);
    const forwardY = Math.cos(rad);
    const rightRad = rad + Math.PI / 2;
    const rightX = Math.sin(rightRad);
    const rightY = Math.cos(rightRad);

    const camPos = new mp.Vector3(
        p.x + forwardX * 2.8 + rightX * 0.9,
        p.y + forwardY * 2.8 + rightY * 0.9,
        p.z + 1.25
    );

    clothingCam = mp.cameras.new('default', camPos, new mp.Vector3(0, 0, 0), 55);
    clothingCam.pointAtCoord(p.x, p.y, p.z + 0.6);
    clothingCam.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    try {
        if (typeof mp.game.streaming.setFocusArea === 'function') {
            mp.game.streaming.setFocusArea(p.x, p.y, p.z + 0.6, 0, 0, 0);
        }
    } catch (e) {
        // Ignore when native is unavailable on older client build.
    }
}

function destroyClothingCamera() {
    if (!clothingCam) return;
    clothingCam.setActive(false);
    mp.game.cam.renderScriptCams(false, false, 0, true, false);
    clothingCam.destroy();
    clothingCam = null;

    try {
        if (typeof mp.game.streaming.clearFocus === 'function') {
            mp.game.streaming.clearFocus();
        }
    } catch (e) {
        // Ignore when native is unavailable on older client build.
    }
}

function applyBarberData(barber) {
    const localPlayer = mp.players.local;
    if (!localPlayer) return;

    const hairStyle = Math.max(0, parseInt(barber.hairStyle) || 0);
    const hairColor = Math.max(0, parseInt(barber.hairColor) || 0);
    const hairHighlight = Math.max(0, parseInt(barber.hairHighlight) || 0);
    const beardStyle = parseInt(barber.beardStyle);
    const beardOpacity = Math.max(0, Math.min(10, parseInt(barber.beardOpacity) || 0)) / 10;

    try {
        // Prefer RAGE MP player appearance methods.
        if (typeof localPlayer.setComponentVariation === 'function') {
            localPlayer.setComponentVariation(2, hairStyle, 0, 0);
        } else {
            localPlayer.setClothes(2, hairStyle, 0, 0);
        }

        if (typeof localPlayer.setHairColor === 'function') {
            localPlayer.setHairColor(hairColor, hairHighlight);
        }

        if (typeof localPlayer.setHeadOverlay === 'function') {
            if (beardStyle < 0) {
                localPlayer.setHeadOverlay(1, 255, 0.0, 0, 0);
            } else {
                localPlayer.setHeadOverlay(1, beardStyle, beardOpacity, 1, hairColor);
            }
        } else {
            // Native fallback for older client APIs.
            const ped = localPlayer.handle;
            mp.game.ped.setPedComponentVariation(ped, 2, hairStyle, 0, 0);
            mp.game.ped.setPedHairColor(ped, hairColor, hairHighlight);
            if (beardStyle < 0) {
                mp.game.ped.setPedHeadOverlay(ped, 1, 255, 0.0);
            } else {
                mp.game.ped.setPedHeadOverlay(ped, 1, beardStyle, beardOpacity);
                if (typeof mp.game.ped.setPedHeadOverlayColor === 'function') {
                    mp.game.ped.setPedHeadOverlayColor(ped, 1, 1, hairColor, hairHighlight);
                }
            }
        }
    } catch (e) {
        mp.gui.chat.push('[BARBER] Nepavyko pritaikyti isvaizdos. Patikrinkite ped modeli.');
    }
}

mp.events.add('openClothingUI', (clothesJson) => {
    if (clothingUI) {
        clothingUI.destroy();
        clothingUI = null;
    }

    clothingUI = mp.browsers.new('package://cef/clothingUI.html');
    clothingUI.execute(`init(${JSON.stringify(clothesJson)});`);
    mp.gui.cursor.show(true, true);
    createClothingCamera();
});

mp.events.add('closeClothingUIBrowser', () => {
    if (clothingUI) {
        clothingUI.destroy();
        clothingUI = null;
    }
    mp.gui.cursor.show(false, false);
    destroyClothingCamera();
});

// CEF -> server relay events
mp.events.add('previewClothes', (comp, drawable, texture) => {
    mp.events.callRemote('previewClothes', comp, drawable, texture);
});

mp.events.add('requestClothingLimits', (comp, drawable) => {
    if (!clothingUI) return;

    const component = parseInt(comp);
    let selectedDrawable = parseInt(drawable);
    if (isNaN(component)) return;
    if (isNaN(selectedDrawable) || selectedDrawable < 0) selectedDrawable = 0;

    const ped = mp.players.local.handle;

    let drawableCount = 1;
    try {
        if (typeof mp.game.ped.getNumberOfPedDrawableVariations === 'function') {
            drawableCount = mp.game.ped.getNumberOfPedDrawableVariations(ped, component);
        } else if (typeof mp.game.ped.getNumberOfDrawableVariations === 'function') {
            drawableCount = mp.game.ped.getNumberOfDrawableVariations(ped, component);
        }
    } catch (e) {
        drawableCount = 1;
    }

    const maxDrawable = Math.max(0, drawableCount - 1);
    if (selectedDrawable > maxDrawable) selectedDrawable = maxDrawable;

    let textureCount = 1;
    try {
        if (typeof mp.game.ped.getNumberOfPedTextureVariations === 'function') {
            textureCount = mp.game.ped.getNumberOfPedTextureVariations(ped, component, selectedDrawable);
        } else if (typeof mp.game.ped.getNumberOfTextureVariations === 'function') {
            textureCount = mp.game.ped.getNumberOfTextureVariations(ped, component, selectedDrawable);
        }
    } catch (e) {
        textureCount = 1;
    }

    const maxTexture = Math.max(0, textureCount - 1);
    clothingUI.execute(`setClothingLimits(${maxDrawable}, ${maxTexture});`);
});

mp.events.add('saveClothes', (clothesJson) => {
    mp.events.callRemote('saveClothes', clothesJson);
});

mp.events.add('closeClothingUI', () => {
    mp.events.callRemote('closeClothingUI');
});

mp.events.add('clothingSuccess', (msg) => {
    if (clothingUI) clothingUI.execute(`clothingSuccess(${JSON.stringify(msg)});`);
});

mp.events.add('clothingError', (msg) => {
    if (clothingUI) clothingUI.execute(`clothingError(${JSON.stringify(msg)});`);
});

// ==================== BARBER SYSTEM ====================
mp.events.add('openBarberUI', (barberJson) => {
    if (barberUI) {
        barberUI.destroy();
        barberUI = null;
    }

    barberUI = mp.browsers.new('package://cef/barberUI.html');
    barberUI.execute(`init(${JSON.stringify(barberJson)});`);
    mp.gui.cursor.show(true, true);
    createClothingCamera();
});

mp.events.add('closeBarberUIBrowser', () => {
    if (barberUI) {
        barberUI.destroy();
        barberUI = null;
    }
    mp.gui.cursor.show(false, false);
    destroyClothingCamera();
});

mp.events.add('browserDomReady', (browserInstance) => {
    if (browserInstance === inventoryBrowser && pendingInventoryState) {
        isInventoryDomReady = true;

        sendInventoryStateToBrowser(
            pendingInventoryState.functionName,
            pendingInventoryState.itemsJson,
            pendingInventoryState.statusText,
            pendingInventoryState.success
        );
        return;
    }

    if (browserInstance === dealershipBrowser && pendingDealershipState) {
        isDealershipDomReady = true;
        sendDealershipStateToBrowser(pendingDealershipState.catalogJson, pendingDealershipState.money, pendingDealershipState.bankMoney);
        return;
    }

    if (browserInstance === houseBrowser && pendingHouseState) {
        isHouseDomReady = true;
        sendHouseStateToBrowser(
            pendingHouseState.functionName,
            pendingHouseState.payloadJson,
            pendingHouseState.statusText,
            pendingHouseState.success
        );
    }
});

mp.events.add('requestBarberLimits', () => {
    if (!barberUI) return;

    const ped = mp.players.local.handle;

    let hairStyles = 1;
    let hairColors = 64;
    let beardStyles = 1;

    try {
        if (typeof mp.game.ped.getNumberOfPedDrawableVariations === 'function') {
            hairStyles = mp.game.ped.getNumberOfPedDrawableVariations(ped, 2);
        } else if (typeof mp.game.ped.getNumberOfDrawableVariations === 'function') {
            hairStyles = mp.game.ped.getNumberOfDrawableVariations(ped, 2);
        }
    } catch (e) {
        hairStyles = 1;
    }

    try {
        if (typeof mp.game.ped.getNumHairColors === 'function') {
            hairColors = mp.game.ped.getNumHairColors();
        }
    } catch (e) {
        hairColors = 64;
    }

    try {
        if (typeof mp.game.ped.getNumHeadOverlayValues === 'function') {
            beardStyles = mp.game.ped.getNumHeadOverlayValues(1);
        }
    } catch (e) {
        beardStyles = 1;
    }

    barberUI.execute(`setBarberLimits(${Math.max(0, hairStyles - 1)}, ${Math.max(0, hairColors - 1)}, ${Math.max(0, beardStyles - 1)});`);
});

mp.events.add('previewBarber', (barberJson) => {
    let barber;
    try {
        barber = JSON.parse(barberJson);
    } catch (e) {
        return;
    }
    applyBarberData(barber);
});

mp.events.add('saveBarber', (barberJson) => {
    mp.events.callRemote('saveBarber', barberJson);
});

mp.events.add('closeBarberUI', () => {
    mp.events.callRemote('closeBarberUI');
});

mp.events.add('barberSuccess', (msg) => {
    if (barberUI) barberUI.execute(`barberSuccess(${JSON.stringify(msg)});`);
});

mp.events.add('barberError', (msg) => {
    if (barberUI) barberUI.execute(`barberError(${JSON.stringify(msg)});`);
});

mp.events.add('applyBarberAppearance', (barberJson) => {
    let barber;
    try {
        barber = JSON.parse(barberJson);
    } catch (e) {
        return;
    }
    applyBarberData(barber);
});


let camera = null;
let loginUI = null;
let cameraPosition = new mp.Vector3(-80, -1525, 300);  // Higher position for the camera (view of Los Santos)
let cameraRotation = new mp.Vector3(-20, 0, 0);  // Looking downward for a good view of the city
let isLoginUIActive = false;

mp.events.add('openLoginUI', () => {
    // Open the login UI
    loginUI = mp.browsers.new("package://cef/loginUI.html");

    // Set login UI flag to true
    isLoginUIActive = true;

    // Disable the chat input (to prevent T or t from opening chat)
    mp.gui.chat.show(false);  // Disable the chat

    // Delay to show the cursor
    setTimeout(() => {
        mp.gui.cursor.show(true, true);  // Ensure cursor is visible when UI opens
    }, 100);

    mp.game.ui.displayRadar(false);

    // Create and activate the camera with a static high position and a downward view
    camera = mp.cameras.new('default', cameraPosition, cameraRotation, 50);  // Static view
    camera.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, true);  // Start rendering the camera
});

// When login is submitted
mp.events.add('login:submit', (username, password) => {
    mp.events.callRemote('validateLogin', username, password);
});

// If login fails, show error and keep cursor visible
mp.events.add('login:failed', (message) => {
    mp.gui.chat.push(message);  // Show the reason in chat
    mp.gui.cursor.show(true, true);  // Keep cursor visible after failure
});

// On successful login, hide UI, reset camera, and allow chat again
mp.events.add('login:success', () => {
    // Hide and destroy login UI browser
    if (loginUI) {
        loginUI.execute(`hideLoginUI();`); // Call the function inside the CEF UI
        setTimeout(() => {
            if (loginUI) {
                loginUI.destroy();
                loginUI = null;
            }
        }, 140);
    }

    // Reset camera to normal game view
    if (camera) {
        camera.setActive(false);  // Deactivate the camera
        mp.game.cam.renderScriptCams(false, false, 0, true, true);  // Return to normal game camera
    }

    // Hide the cursor after login
    mp.gui.cursor.show(false, false);

    mp.game.ui.displayRadar(true);

    // Re-enable the chat system
    mp.gui.chat.show(true);  // Enable chat

    // Allow the chat input again after login success
    isLoginUIActive = false;  // Set UI state to false
});

// Function to hide the cursor from the UI (if needed)
mp.events.add('login:hideCursor', () => {
    mp.gui.cursor.show(false, false);  // Hide the cursor
});

// Show error message in the login UI if login fails
mp.events.add('login:error', (message) => {
    if (loginUI) {
        loginUI.execute(`showErrorMessage("${message}")`);  // Show error inside the UI
    }
});



// client_scripts/character_selection.js
let browser;
let cameraChar;

mp.events.add('showCharacterSelectionUI', (charactersJson) => {
    cameraChar = mp.cameras.new('characterSelectionCam');
    cameraChar.setCoord(150.0, -1000.0, 300.0);
    cameraChar.pointAtCoord(441.0, -978.0, 30.0);
    cameraChar.setFov(70.0);
    cameraChar.setActive(true);
    mp.game.cam.renderScriptCams(true, false, 0, true, false);

    mp.players.local.freezePosition(true);
    mp.players.local.setVisible(false, false);
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    browser = mp.browsers.new('package://cef/character_selection.html');
    browser.execute(`displayCharacters(${charactersJson})`);

    // Disable the chat input (to prevent T or t from opening chat)
    mp.gui.chat.show(false);  // Disable the chat

    // Delay to show the cursor
    setTimeout(() => {
        mp.gui.cursor.show(true, true);  // Ensure cursor is visible when UI opens
    }, 100);
});

mp.events.add('hidePlayerModel', () => {
    mp.players.local.setVisible(false, false); // Hide the PED
    mp.players.local.freezePosition(true); // Freeze to prevent movement
});


mp.events.add('selectCharacter', (charId) => {
    mp.events.callRemote('selectCharacter', charId);
    if (browser) {
        browser.destroy();
        browser = null;
    }
    if (cameraChar) {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        cameraChar.setActive(false);
        cameraChar.destroy();
        cameraChar = null;
        mp.game.ui.displayHud(true);
        mp.game.ui.displayRadar(true);
    }

    mp.players.local.freezePosition(false);
    mp.players.local.setVisible(true, true);

    mp.gui.chat.show(true);
    mp.gui.cursor.show(false, false);  // Hide the cursor
});



mp.events.add('playerQuit', () => {
    if (browser) browser.destroy();
    if (dealershipBrowser) dealershipBrowser.destroy();
    destroyLocalDealershipPreviewVehicle();
    if (dealershipCam) {
        dealershipCam.setActive(false);
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        dealershipCam.destroy();
        dealershipCam = null;

        try {
            if (typeof mp.game.streaming.clearFocus === 'function') {
                mp.game.streaming.clearFocus();
            }
        } catch (e) {
            // Ignore when native is unavailable on older client build.
        }
    }
    if (inventoryBrowser) inventoryBrowser.destroy();
    if (houseBrowser) houseBrowser.destroy();
    if (cameraChar) {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        cameraChar.destroy();
        mp.gui.chat.show(true);
        mp.gui.cursor.show(false, false);  // Hide the cursor
    }

    inventoryBrowser = null;
    houseBrowser = null;
    dealershipBrowser = null;
    dealershipCatalog = [];
    pendingDealershipState = null;
    isDealershipDomReady = false;
    pendingInventoryState = null;
    isInventoryDomReady = false;
    pendingHouseState = null;
    isHouseDomReady = false;
    setInventoryUiOpenState(false);
    lastAmmoCheckAt = 0;
    lastEmptyWeaponRequestHash = null;
});

// Simple speedometer for vehicle driving.
mp.events.add('render', () => {
    if (dealershipBrowser || houseBrowser) {
        mp.gui.cursor.show(true, true);
        mp.gui.chat.activate(false);
    }

    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.vehicle) return;

    const vehicle = localPlayer.vehicle;
    let speedMs = 0;

    if (typeof vehicle.getSpeed === 'function') {
        speedMs = vehicle.getSpeed();
    } else if (vehicle.handle) {
        speedMs = mp.game.entity.getEntitySpeed(vehicle.handle);
    }

    const speedKmh = Math.max(0, Math.round(speedMs * 3.6));
    const text = `${speedKmh} km/h`;

    mp.game.graphics.drawText(text, [0.9, 0.87], {
        font: 4,
        color: [255, 255, 255, 235],
        scale: [0.55, 0.55],
        outline: true,
        shadow: true,
        alignment: 2,
    });
});

// Fuel Gauge Display
mp.events.add('render', () => {
    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.vehicle) return;

    const vehicle = localPlayer.vehicle;
    const fuel = vehicle.getVariable('vehicleFuel') || 0;
    const maxFuel = 100;
    const fuelPercent = Math.max(0, Math.min(100, (fuel / maxFuel) * 100));

    // Position: below the speedometer on the right side
    const gaugeX = 0.9;
    const gaugeY = 0.93;

    // Determine color based on fuel level
    let fuelColor = [52, 199, 89, 255]; // Green (normal)
    if (fuelPercent < 30) {
        fuelColor = [240, 93, 101, 255]; // Red (critical)
    } else if (fuelPercent < 50) {
        fuelColor = [255, 159, 64, 255]; // Orange (warning)
    }

    // Draw fuel label
    mp.game.graphics.drawText('Fuel', [gaugeX, gaugeY - 0.035], {
        font: 4,
        color: [255, 255, 255, 200],
        scale: [0.35, 0.35],
        outline: true,
        alignment: 2,
    });

    // Draw fuel bar background (dark rectangle)
    mp.game.graphics.drawRect(gaugeX - 0.025, gaugeY, 0.055, 0.018, 0, 0, 0, 100);

    // Draw fuel bar fill (colored rectangle based on fuel percentage)
    const fillWidth = 0.055 * (fuelPercent / 100);
    mp.game.graphics.drawRect(
        gaugeX - 0.025 + (fillWidth / 2),
        gaugeY,
        fillWidth,
        0.018,
        fuelColor[0],
        fuelColor[1],
        fuelColor[2],
        fuelColor[3]
    );

    // Draw fuel bar outline (white border)
    mp.game.graphics.drawRect(gaugeX - 0.025, gaugeY, 0.055, 0.018, 255, 255, 255, 0);

    // Draw fuel percentage text
    mp.game.graphics.drawText(`${Math.round(fuelPercent)}%`, [gaugeX + 0.035, gaugeY - 0.005], {
        font: 4,
        color: fuelColor,
        scale: [0.32, 0.32],
        outline: true,
        alignment: 0,
    });

    // Draw fuel liters text (small)
    mp.game.graphics.drawText(`${Math.round(fuel)}L`, [gaugeX + 0.035, gaugeY + 0.008], {
        font: 4,
        color: [200, 200, 200, 200],
        scale: [0.25, 0.25],
        outline: true,
        alignment: 0,
    });
});

mp.events.add('render', () => {
    const now = Date.now();
    if (now - lastAmmoCheckAt < 220) return;
    lastAmmoCheckAt = now;

    const localPlayer = mp.players.local;
    if (!localPlayer || !localPlayer.handle) return;

    const weaponHash = Number(getCurrentWeaponHash(localPlayer));
    if (!Number.isFinite(weaponHash) || weaponHash === 0 || weaponHash === WEAPON_UNARMED_HASH) {
        lastEmptyWeaponRequestHash = null;
        return;
    }

    if (NON_AMMO_WEAPON_HASHES.has(weaponHash)) {
        lastEmptyWeaponRequestHash = null;
        return;
    }

    const totalAmmo = getTotalAmmoForWeapon(localPlayer, weaponHash);
    if (!Number.isFinite(totalAmmo)) return;

    if (totalAmmo > 0) {
        if (lastEmptyWeaponRequestHash === weaponHash) {
            lastEmptyWeaponRequestHash = null;
        }
        return;
    }

    if (lastEmptyWeaponRequestHash === weaponHash) return;

    lastEmptyWeaponRequestHash = weaponHash;
    forceSwitchToUnarmed(localPlayer, weaponHash);
    mp.events.callRemote('requestClearEmptyWeapon', String(weaponHash));
});


// Handle Esc key for closing custom UIs (dealership, inventory) only
// Let RAGE MP handle chat natively
mp.keys.bind(0x1B, true, () => {
    fallbackChatInputActive = false;

    if (dealershipBrowser) {
        closeDealershipUI();
    }

    if (isInventoryOpen) {
        closeInventoryBrowser();
    }
});

