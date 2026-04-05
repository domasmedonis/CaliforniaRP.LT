let bankUI = null;
let dealershipBrowser = null;
let pendingDealershipState = null;
let isDealershipDomReady = false;
let dealershipPreviewVehicle = null;
let dealershipCatalog = [];
let dealershipCam = null;
const DEALERSHIP_PREVIEW_POSITION = new mp.Vector3(-56.58, -1111.95, 26.44);
const DEALERSHIP_PREVIEW_HEADING = 69.0;
let inventoryBrowser = null;
let isInventoryOpen = false;
let lastInventoryRequestAt = 0;
let pendingInventoryState = null;
let isInventoryDomReady = false;
let isChatInputActive = false;

mp.gui.chat.push('Hello World')

globalThis.__isInventoryOpen = false;

function canToggleInventory() {
    return !isLoginUIActive
        && !loginUI
        && !bankUI
        && !clothingUI
        && !barberUI
        && !dealershipBrowser
        && !browser
        && !paycheckBrowser
        && !isChatInputActive
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

// Prevent inventory opening while chat input is active (T key flow).
mp.keys.bind(0x54, true, () => {
    if (isLoginUIActive || isInventoryOpen || globalThis.__isPhoneOpen) {
        isChatInputActive = false;
        return;
    }

    isChatInputActive = true;
});

mp.keys.bind(0x0D, true, () => {
    isChatInputActive = false;
});

mp.keys.bind(0x1B, true, () => {
    isChatInputActive = false;

    if (dealershipBrowser) {
        closeDealershipUI();
        return;
    }

    if (isInventoryOpen) {
        closeInventoryBrowser();
    }
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
    if (cameraChar) {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
        cameraChar.destroy();
        mp.gui.chat.show(true);
        mp.gui.cursor.show(false, false);  // Hide the cursor
    }

    inventoryBrowser = null;
    dealershipBrowser = null;
    dealershipCatalog = [];
    pendingDealershipState = null;
    isDealershipDomReady = false;
    pendingInventoryState = null;
    isInventoryDomReady = false;
    setInventoryUiOpenState(false);
});

// Simple speedometer for vehicle driving.
mp.events.add('render', () => {
    if (dealershipBrowser) {
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

