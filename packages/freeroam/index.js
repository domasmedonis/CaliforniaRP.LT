const bcrypt = require('bcrypt');
const mysql = require('mysql');
const moment = require('moment-timezone');



const activeDrivers = new Map();
const activeRides = new Map();
const activeCalls = new Map();
const pendingRentOffers = new Map();
const vehicleFuelRuntimeState = new Map();
const activeDMVTests = new Map();
const activeEmergencyReports = new Map();
let nextEmergencyReportId = 1;
const POLICE_MDC_WARRANT_STATUS_OPEN = 'open';
const POLICE_MDC_WARRANT_STATUS_CLEARED = 'cleared';

const INVENTORY_GIVE_RADIUS = 5.0;
const DRUG_EFFECT_DELAY_MS = 120000;
const DRUG_VISUAL_EFFECT_DURATION_MS = 300000;
const WEAPON_GIVE_RADIUS = 5.0;
const DEFAULT_WEAPON_AMMO = 120;
const VEHICLE_WEAPON_STASH_LIMIT = 10;
const WEAPON_PACKAGE_LIMIT = 5;
const DMV_PICKUP_POS = new mp.Vector3(-270.86, -693.14, 34.28);
const DMV_INTERACT_RADIUS = 3.2;
const DMV_TEST_FEE = 500;
const DMV_TEST_VEHICLE_MODEL = 'blista';
const DMV_TEST_SPAWN_POS = new mp.Vector3(-315.09, -697.30, 33.03);
const DMV_TEST_SPAWN_HEADING = 160.0;
const DMV_ROUTE_POINTS = Object.freeze([
    { x: -322.50, y: -674.34, z: 32.41 },
    { x: -289.91, y: -660.94, z: 33.25 },
    { x: -193.08, y: -513.48, z: 34.51 },
    { x: -110.51, y: -251.09, z: 44.31 },
    { x: -44.91, y: -125.63, z: 57.51 },
    { x: 35.77, y: -253.21, z: 47.74 },
    { x: -66.57, y: -525.56, z: 40.15 },
    { x: -230.79, y: -669.11, z: 33.26 },
    { x: -322.50, y: -674.34, z: 32.41 },
]);
const DMV_THEORY_ANSWERS = Object.freeze(['a', 'b', 'b', 'a']);
const WEAPON_UNARMED_HASH = typeof mp.joaat === 'function' ? mp.joaat('weapon_unarmed') : 2725352035;
const WEAPON_NAME_TO_MODEL = Object.freeze({
    unarmed: 'weapon_unarmed',
    knife: 'weapon_knife',
    bat: 'weapon_bat',
    pistol: 'weapon_pistol',
    combatpistol: 'weapon_combatpistol',
    appistol: 'weapon_appistol',
    heavypistol: 'weapon_heavypistol',
    vintagepistol: 'weapon_vintagepistol',
    sns: 'weapon_snspistol',
    snspistol: 'weapon_snspistol',
    pistol50: 'weapon_pistol50',
    revolver: 'weapon_revolver',
    microsmg: 'weapon_microsmg',
    smg: 'weapon_smg',
    assaultsmg: 'weapon_assaultsmg',
    minismg: 'weapon_minismg',
    pump: 'weapon_pumpshotgun',
    pumpshotgun: 'weapon_pumpshotgun',
    sawnoff: 'weapon_sawnoffshotgun',
    sawnoffshotgun: 'weapon_sawnoffshotgun',
    carbine: 'weapon_carbinerifle',
    carbinerifle: 'weapon_carbinerifle',
    assaultrifle: 'weapon_assaultrifle',
    bullpuprifle: 'weapon_bullpuprifle',
    marksman: 'weapon_marksmanrifle',
    marksmanrifle: 'weapon_marksmanrifle',
    sniper: 'weapon_sniperrifle',
    sniperrifle: 'weapon_sniperrifle',
});

const WEAPON_HASH_TO_LABEL = Object.freeze({
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_unarmed') : 2725352035]: 'Unarmed',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_knife') : -1716189206]: 'Knife',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_bat') : -1786099057]: 'Bat',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_pistol') : 453432689]: 'Pistol',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_combatpistol') : 1593441988]: 'Combat Pistol',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_appistol') : 584646201]: 'AP Pistol',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_heavypistol') : -771403250]: 'Heavy Pistol',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_snspistol') : -1076751822]: 'SNS Pistol',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_pistol50') : -1716589765]: 'Pistol .50',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_revolver') : -1045183535]: 'Revolver',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_microsmg') : 324215364]: 'Micro SMG',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_smg') : 736523883]: 'SMG',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_assaultsmg') : -270015777]: 'Assault SMG',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_minismg') : -1121678507]: 'Mini SMG',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_pumpshotgun') : 487013001]: 'Pump Shotgun',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_sawnoffshotgun') : 2017895192]: 'Sawed-Off Shotgun',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_carbinerifle') : -2084633992]: 'Carbine Rifle',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_assaultrifle') : -1074790547]: 'Assault Rifle',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_bullpuprifle') : 2132975508]: 'Bullpup Rifle',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_marksmanrifle') : -952879014]: 'Marksman Rifle',
    [typeof mp.joaat === 'function' ? mp.joaat('weapon_sniperrifle') : 100416529]: 'Sniper Rifle',
});

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
    weed: {
        name: 'Zole',
        description: 'Po 2 minuciu pradeda veikti ir sukelia lengva apsvaigima.',
        icon: 'weed',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    cocaine: {
        name: 'Kokainas',
        description: 'Po 2 minuciu pradeda veikti ir sukelia stipru stimuliuojanti efekta.',
        icon: 'cocaine',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    meth: {
        name: 'Metamfetaminas',
        description: 'Po 2 minuciu pradeda veikti ir sukelia intensyvu apsvaigima.',
        icon: 'meth',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    crack: {
        name: 'Krekas',
        description: 'Po 2 minuciu pradeda veikti ir sukelia astria reakcija.',
        icon: 'crack',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    shrooms: {
        name: 'Grybai',
        description: 'Po 2 minuciu pradeda veikti ir sukelia haliucinacini efekta.',
        icon: 'shrooms',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    codeine: {
        name: 'Kodeinas',
        description: 'Po 2 minuciu pradeda veikti ir sukelia raminanti efekta.',
        icon: 'codeine',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    percocet: {
        name: 'Percocet',
        description: 'Po 2 minuciu pradeda veikti ir sukelia raminanti efekta.',
        icon: 'percocet',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    heroin: {
        name: 'Heroinas',
        description: 'Po 2 minuciu pradeda veikti ir sukelia sunku apsvaigima.',
        icon: 'heroin',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    ecstasy: {
        name: 'Ekstazis',
        description: 'Po 2 minuciu pradeda veikti ir sukelia energinga apsvaigima.',
        icon: 'ecstasy',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    lsd: {
        name: 'LSD',
        description: 'Po 2 minuciu pradeda veikti ir sukelia stipru haliucinacini efekta.',
        icon: 'lsd',
        usable: true,
        droppable: true,
        giveable: true,
        consumeOnUse: true,
    },
    simcard: {
        name: 'SIM kortele',
        description: 'Aktyvuoja telefono numeri.',
        icon: 'simcard',
        usable: false,
        droppable: false,
        giveable: false,
        consumeOnUse: true,
    },
    watch: {
        name: 'Watch',
        description: 'Pawnable valuable item.',
        icon: 'watch',
        usable: false,
        droppable: true,
        giveable: true,
        stackable: false,
        pawnItem: true,
        originalPrice: 1200,
    },
    laptop: {
        name: 'Laptop',
        description: 'Pawnable electronic item.',
        icon: 'laptop',
        usable: false,
        droppable: true,
        giveable: true,
        stackable: false,
        pawnItem: true,
        originalPrice: 2500,
    },
    necklace: {
        name: 'Necklace',
        description: 'Pawnable jewelry item.',
        icon: 'necklace',
        usable: false,
        droppable: true,
        giveable: true,
        stackable: false,
        pawnItem: true,
        originalPrice: 1800,
    },
    ring: {
        name: 'Ring',
        description: 'Pawnable jewelry item.',
        icon: 'ring',
        usable: false,
        droppable: true,
        giveable: true,
        stackable: false,
        pawnItem: true,
        originalPrice: 950,
    },
    camera: {
        name: 'Camera',
        description: 'Pawnable electronic item.',
        icon: 'camera',
        usable: false,
        droppable: true,
        giveable: true,
        stackable: false,
        pawnItem: true,
        originalPrice: 1500,
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
    weed: 'weed',
    zole: 'weed',
    cocaine: 'cocaine',
    kokainas: 'cocaine',
    coke: 'cocaine',
    meth: 'meth',
    metamfetaminas: 'meth',
    metamfetamine: 'meth',
    crack: 'crack',
    krekas: 'crack',
    shrooms: 'shrooms',
    grybai: 'shrooms',
    mushrooms: 'shrooms',
    codeine: 'codeine',
    kodeinas: 'codeine',
    percocet: 'percocet',
    heroin: 'heroin',
    heroinas: 'heroin',
    ecstasy: 'ecstasy',
    ekstazis: 'ecstasy',
    lsd: 'lsd',
    sim: 'simcard',
    simcard: 'simcard',
    simkortele: 'simcard',
    sim_kortele: 'simcard',
    watch: 'watch',
    laikrodis: 'watch',
    laptop: 'laptop',
    kompiuteris: 'laptop',
    necklace: 'necklace',
    grandinele: 'necklace',
    ring: 'ring',
    ziedas: 'ring',
    camera: 'camera',
    kamera: 'camera',
});

const DRUG_EFFECT_DEFS = Object.freeze({
    weed: { effect: 'weed' },
    cocaine: { effect: 'cocaine' },
    meth: { effect: 'meth' },
    crack: { effect: 'crack' },
    shrooms: { effect: 'shrooms' },
    codeine: { effect: 'codeine' },
    percocet: { effect: 'percocet' },
    heroin: { effect: 'heroin' },
    ecstasy: { effect: 'ecstasy' },
    lsd: { effect: 'lsd' },
});

const TWITTER_COOLDOWN = 3600000; // 1 hour between posts
const lastTweetTime = new Map();

const DEALERSHIP_POS = new mp.Vector3(-33.9, -1102.07, 26.42);
const DEALERSHIP_DELIVERY_POS = new mp.Vector3(-23.84, -1094.95, 26.67);
const DEALERSHIP_DELIVERY_HEADING = 69.0;
const DEALERSHIP_INTERACT_RADIUS = 8.0;
const DEALERSHIP_PURCHASE_SPAWN_POS = new mp.Vector3(-49.89, -1111.67, 26.44);
const PROPERTY_INTERACT_RADIUS = 3.0;
const PROPERTY_SELL_RADIUS = 10.0;
const PROPERTY_ADDRESS_HINT_RADIUS = 4.0;
const BUSINESS_INTERACT_RADIUS = 3.0;
const BUSINESS_INTERACT_RADIUS_MIN = 1.5;
const BUSINESS_INTERACT_RADIUS_MAX = 25.0;
const BUSINESS_EXIT_RADIUS = 6.0;
const SHOP_REGISTER_INTERACT_RADIUS = 2.5;
const GAS_STATION_REFILL_RADIUS = 12.0;
const VEHICLE_FUEL_MAX = 100;
const VEHICLE_FUEL_MIN_CONSUMPTION = 0.04;
const VEHICLE_FUEL_DISTANCE_MULTIPLIER = 0.16;
const FUEL_PRICE_PER_UNIT = 7;
const FLEECA_OPEN_BANK_RADIUS = 6.0;
const BANK_ACCOUNT_NUMBER_LENGTH = 10;
const PAWN_AUTO_SELL_RATE = 0.30;
const DOWNED_ACCEPTDEATH_DELAY_MS = 120000;
const DEATH_RESPAWN_PENALTY_CASH = 500;
const HOSPITAL_RESPAWN_POS = new mp.Vector3(361.69, -583.99, 28.83);
const HOSPITAL_RESPAWN_HEADING = 70.0;
const DOWNED_RESPAWN_Z_OFFSET = 0.08;
const LOS_SANTOS_SAFE_TELEPORT_POS = new mp.Vector3(215.76, -810.12, 30.73);
const LOS_SANTOS_SAFE_TELEPORT_HEADING = 157.0;
const FACTION_DEFS = Object.freeze({
    pd: Object.freeze({
        key: 'pd',
        label: 'Police Department',
        shortLabel: 'PD',
        leaderRank: 5,
        ranks: Object.freeze([
            null,
            Object.freeze({ defaultName: 'Cadet', salary: 300 }),
            Object.freeze({ defaultName: 'Officer', salary: 450 }),
            Object.freeze({ defaultName: 'Senior Officer', salary: 650 }),
            Object.freeze({ defaultName: 'Sergeant', salary: 850 }),
            Object.freeze({ defaultName: 'Chief', salary: 1100 }),
        ]),
    }),
    md: Object.freeze({
        key: 'md',
        label: 'Medical Department',
        shortLabel: 'MD',
        leaderRank: 5,
        ranks: Object.freeze([
            null,
            Object.freeze({ defaultName: 'Trainee', salary: 280 }),
            Object.freeze({ defaultName: 'Paramedic', salary: 420 }),
            Object.freeze({ defaultName: 'Doctor', salary: 600 }),
            Object.freeze({ defaultName: 'Surgeon', salary: 800 }),
            Object.freeze({ defaultName: 'Director', salary: 1000 }),
        ]),
    }),
});
const factionRankNames = new Map();
const FACTION_INTERACT_RADIUS = 5.0;
const PD_JAIL_POS = new mp.Vector3(458.65, -997.99, 24.91);
const PD_JAIL_HEADING = 90.0;
const PD_JAIL_COMMAND_RADIUS = 10.0;
const PD_JAIL_CELL_RADIUS = 5.5;
const PD_RELEASE_POS = new mp.Vector3(441.13, -981.92, 30.69);
const PD_RELEASE_HEADING = 90.0;
const MD_REVIVE_HEALTH = 60;
const MD_TREAT_AMOUNT = 25;
const POLICE_FINE_MIN_AMOUNT = 1;
const POLICE_FINE_MAX_AMOUNT = 25000;
const POLICE_MDC_HISTORY_LIMIT = 5;
const STATIC_247_SHOP_REGISTERS = Object.freeze([
    { x: 24.47, y: -1347.35, z: 29.5 },
    { x: -46.62, y: -1757.93, z: 29.42 },
    { x: -706.12, y: -913.65, z: 19.22 },
    { x: -1221.92, y: -908.38, z: 12.33 },
    { x: 372.99, y: 328.57, z: 103.57 },
    { x: 1163.96, y: -323.71, z: 69.21 },
    { x: 1134.21, y: -982.39, z: 46.42 },
    { x: 2557.14, y: 382.95, z: 108.62 },
    { x: -3039.16, y: 584.36, z: 7.91 },
    { x: -3242.12, y: 1000.33, z: 12.83 },
    { x: -1820.39, y: 792.85, z: 138.11 },
    { x: 547.65, y: 2669.72, z: 42.16 },
    { x: 1165.3, y: 2709.55, z: 38.16 },
    { x: 2678.23, y: 3279.42, z: 55.24 },
    { x: 1960.13, y: 3741.08, z: 32.34 },
    { x: 1392.63, y: 3604.95, z: 34.98 },
    { x: 1698.1, y: 4924.49, z: 42.06 },
    { x: 1728.89, y: 6414.11, z: 35.04 },
    { x: -1487.59, y: -379.55, z: 40.16 },
    { x: -2966.41, y: 391.62, z: 15.04 },
]);

const GAS_STATION_REFILL_POINTS = Object.freeze([
    { x: 262.10, y: -1259.94, z: 28.43 },
    { x: 49.42, y: 2778.79, z: 58.04 },
    { x: 264.15, y: 2608.77, z: 44.98 },
    { x: 1039.35, y: 2671.78, z: 39.55 },
    { x: 1207.26, y: 2660.18, z: 37.9 },
    { x: 2539.68, y: 2594.19, z: 37.94 },
    { x: 2679.85, y: 3264.77, z: 55.24 },
    { x: 2005.06, y: 3773.89, z: 32.4 },
    { x: 1687.47, y: 4929.53, z: 42.08 },
    { x: 1701.4, y: 6416.06, z: 32.76 },
    { x: 179.86, y: 6602.84, z: 31.86 },
    { x: -94.46, y: 6419.59, z: 31.49 },
    { x: -2554.99, y: 2334.4, z: 33.08 },
    { x: -1800.09, y: 803.53, z: 138.65 },
    { x: -1437.62, y: -276.75, z: 46.21 },
    { x: -2096.24, y: -320.29, z: 13.17 },
    { x: -724.57, y: -935.89, z: 19.21 },
    { x: -526.02, y: -1211.0, z: 18.18 },
    { x: 818.87, y: -1028.37, z: 26.4 },
    { x: 1181.38, y: -330.84, z: 69.32 },
    { x: 620.84, y: 269.1, z: 103.09 },
]);

const BUSINESS_TYPE_DEFS = Object.freeze({
    shop: {
        label: 'Parduotuve',
        blipColor: 2,
        markerColor: [52, 152, 219, 150],
        buyEnabled: true,
        products: [
            { key: 'water', label: 'Vanduo', itemType: 'water', price: 5 },
            { key: 'burger', label: 'Burgeris', itemType: 'burger', price: 12 },
            { key: 'bandage', label: 'Bintas', itemType: 'bandage', price: 25 },
            { key: 'medkit', label: 'Vaistinele', itemType: 'medkit', price: 60 },
            { key: 'simcard', label: 'SIM kortele', itemType: 'simcard', price: 250 },
        ],
    },
    gas_station: {
        label: 'Degaline',
        blipColor: 5,
        markerColor: [241, 196, 15, 150],
        buyEnabled: true,
        products: [
            { key: 'water', label: 'Vanduo', itemType: 'water', price: 6 },
            { key: 'beer', label: 'Alus', itemType: 'beer', price: 9 },
            { key: 'cigarettes', label: 'Cigaretes', itemType: 'cigarettes', price: 15 },
        ],
    },
    restaurant: {
        label: 'Restoranas',
        blipColor: 1,
        markerColor: [231, 76, 60, 150],
        buyEnabled: false,
        products: [],
    },
    pawn_shop: {
        label: 'Lombardas',
        blipColor: 46,
        markerColor: [241, 196, 15, 150],
        buyEnabled: false,
        products: [],
    },
});

const BUSINESS_TYPE_ALIASES = Object.freeze({
    shop: 'shop',
    store: 'shop',
    parduotuve: 'shop',
    gas: 'gas_station',
    gasstation: 'gas_station',
    gas_station: 'gas_station',
    degaline: 'gas_station',
    restaurant: 'restaurant',
    restoranas: 'restaurant',
    pawn: 'pawn_shop',
    pawnshop: 'pawn_shop',
    pawn_shop: 'pawn_shop',
    lombardas: 'pawn_shop',
});

const APROP_INTERIOR_PRESETS = Object.freeze({
    low_end_apartment: { label: 'Low End Apartment', pos: new mp.Vector3(261.4586, -998.8196, -99.00863) },
    medium_end_apartment: { label: 'Medium End Apartment', pos: new mp.Vector3(347.2686, -999.2955, -99.19622) },
    integrity_way_apt_28: { label: '4 Integrity Way, Apt 28', pos: new mp.Vector3(-18.07856, -583.6725, 79.46569) },
    integrity_way_apt_30: { label: '4 Integrity Way, Apt 30', pos: new mp.Vector3(-35.31277, -580.4199, 88.71221) },
    dell_perro_apt_4: { label: 'Dell Perro Heights, Apt 4', pos: new mp.Vector3(-1468.14, -541.815, 73.4442) },
    dell_perro_apt_7: { label: 'Dell Perro Heights, Apt 7', pos: new mp.Vector3(-1477.14, -538.7499, 55.5264) },
    richard_majestic_apt_2: { label: 'Richard Majestic, Apt 2', pos: new mp.Vector3(-915.811, -379.432, 113.6748) },
    tinsel_towers_apt_42: { label: 'Tinsel Towers, Apt 42', pos: new mp.Vector3(-614.86, 40.6783, 97.60007) },
    eclipse_towers_apt_3: { label: 'Eclipse Towers, Apt 3', pos: new mp.Vector3(-773.407, 341.766, 211.397) },
    wild_oats_3655: { label: '3655 Wild Oats Drive', pos: new mp.Vector3(-169.286, 486.4938, 137.4436) },
    north_conker_2044: { label: '2044 North Conker Avenue', pos: new mp.Vector3(340.9412, 437.1798, 149.3925) },
    north_conker_2045: { label: '2045 North Conker Avenue', pos: new mp.Vector3(373.023, 416.105, 145.7006) },
    hillcrest_2862: { label: '2862 Hillcrest Avenue', pos: new mp.Vector3(-676.127, 588.612, 145.1698) },
    hillcrest_2868: { label: '2868 Hillcrest Avenue', pos: new mp.Vector3(-763.107, 615.906, 144.1401) },
    hillcrest_2874: { label: '2874 Hillcrest Avenue', pos: new mp.Vector3(-857.798, 682.563, 152.6529) },
    whispymound_2677: { label: '2677 Whispymound Drive', pos: new mp.Vector3(120.5, 549.952, 184.097) },
    mad_wayne_2133: { label: '2133 Mad Wayne Thunder', pos: new mp.Vector3(-1288.0, 440.748, 97.69459) },
});

const APROP_INTERIOR_PRESET_LIST = Object.freeze([
    { id: 1, key: 'low_end_apartment', label: 'Low End Apartment', pos: new mp.Vector3(261.4586, -998.8196, -99.00863) },
    { id: 2, key: 'medium_end_apartment', label: 'Medium End Apartment', pos: new mp.Vector3(347.2686, -999.2955, -99.19622) },
    { id: 3, key: 'integrity_way_apt_28', label: '4 Integrity Way, Apt 28', pos: new mp.Vector3(-18.07856, -583.6725, 79.46569) },
    { id: 4, key: 'integrity_way_apt_30', label: '4 Integrity Way, Apt 30', pos: new mp.Vector3(-35.31277, -580.4199, 88.71221) },
    { id: 5, key: 'dell_perro_apt_4', label: 'Dell Perro Heights, Apt 4', pos: new mp.Vector3(-1468.14, -541.815, 73.4442) },
    { id: 6, key: 'dell_perro_apt_7', label: 'Dell Perro Heights, Apt 7', pos: new mp.Vector3(-1477.14, -538.7499, 55.5264) },
    { id: 7, key: 'richard_majestic_apt_2', label: 'Richard Majestic, Apt 2', pos: new mp.Vector3(-915.811, -379.432, 113.6748) },
    { id: 8, key: 'tinsel_towers_apt_42', label: 'Tinsel Towers, Apt 42', pos: new mp.Vector3(-614.86, 40.6783, 97.60007) },
    { id: 9, key: 'eclipse_towers_apt_3', label: 'Eclipse Towers, Apt 3', pos: new mp.Vector3(-773.407, 341.766, 211.397) },
    { id: 10, key: 'wild_oats_3655', label: '3655 Wild Oats Drive', pos: new mp.Vector3(-169.286, 486.4938, 137.4436) },
    { id: 11, key: 'north_conker_2044', label: '2044 North Conker Avenue', pos: new mp.Vector3(340.9412, 437.1798, 149.3925) },
    { id: 12, key: 'north_conker_2045', label: '2045 North Conker Avenue', pos: new mp.Vector3(373.023, 416.105, 145.7006) },
    { id: 13, key: 'hillcrest_2862', label: '2862 Hillcrest Avenue', pos: new mp.Vector3(-676.127, 588.612, 145.1698) },
    { id: 14, key: 'hillcrest_2868', label: '2868 Hillcrest Avenue', pos: new mp.Vector3(-763.107, 615.906, 144.1401) },
    { id: 15, key: 'hillcrest_2874', label: '2874 Hillcrest Avenue', pos: new mp.Vector3(-857.798, 682.563, 152.6529) },
    { id: 16, key: 'whispymound_2677', label: '2677 Whispymound Drive', pos: new mp.Vector3(120.5, 549.952, 184.097) },
    { id: 17, key: 'mad_wayne_2133', label: '2133 Mad Wayne Thunder', pos: new mp.Vector3(-1288.0, 440.748, 97.69459) },
]);

const APROP_INTERIOR_PRESETS_BY_ID = new Map(APROP_INTERIOR_PRESET_LIST.map(item => [item.id, item]));
const APROP_INTERIOR_PRESETS_BY_KEY = new Map(APROP_INTERIOR_PRESET_LIST.map(item => [item.key, item]));

function getUniquePropertyDimension(propertyId) {
    const safePropertyId = Math.max(1, parseInt(propertyId, 10) || 1);
    return 90000 + safePropertyId;
}

function getUniqueBusinessDimension(businessId) {
    const safeBusinessId = Math.max(1, parseInt(businessId, 10) || 1);
    return 120000 + safeBusinessId;
}

const propertiesById = new Map();
let propertiesLoaded = false;
const businessesById = new Map();
const businessVisualsById = new Map();
let businessesLoaded = false;

const VEHICLE_CATALOG = Object.freeze([
    { key: 'asea', name: 'Declasse Asea', model: 'asea', price: 14500 },
    { key: 'blista', name: 'Dinka Blista', model: 'blista', price: 16000 },
    { key: 'dilettante', name: 'Karin Dilettante', model: 'dilettante', hash: 0xBC993509, price: 17000 },
    { key: 'premier', name: 'Declasse Premier', model: 'premier', price: 19000 },
    { key: 'prairie', name: 'Bollokan Prairie', model: 'prairie', price: 21000 },
    { key: 'jackal', name: 'Ocelot Jackal', model: 'jackal', hash: 0xDAC67112, price: 26000 },
    { key: 'sultan', name: 'Karin Sultan', model: 'sultan', price: 28000 },
    { key: 'tailgater', name: 'Obey Tailgater', model: 'tailgater', price: 33000 },
    { key: 'oracle', name: 'Ubermacht Oracle', model: 'oracle', hash: 0x506434F6, price: 35000 },
    { key: 'buffalo', name: 'Bravado Buffalo', model: 'buffalo', price: 39000 },
    { key: 'dominator', name: 'Vapid Dominator', model: 'dominator', price: 42000 },
    { key: 'tailgater2', name: 'Obey Tailgater S', model: 'tailgater2', hash: 0xB5D306A4, price: 55000, dlc: 'Los Santos Tuners' },
    { key: 'novak', name: 'Lampadati Novak', model: 'novak', hash: 0x92F5024E, price: 80000 },
    { key: 'baller7', name: 'Gallivanter Baller ST', model: 'baller7', hash: 0x1573422D, price: 95000 },
    { key: 'astron', name: 'Pfister Astron', model: 'astron', hash: 0x258C9364, price: 120000 },
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

mp.blips.new(498, DMV_PICKUP_POS, {
    name: 'DMV',
    color: 3,
    shortRange: true,
    scale: 0.85,
});

mp.markers.new(1, new mp.Vector3(DMV_PICKUP_POS.x, DMV_PICKUP_POS.y, DMV_PICKUP_POS.z - 1.0), 1.15, {
    color: [24, 199, 210, 170],
    visible: true,
    dimension: 0,
});

// Property blips are created per-player for owners only (see showOwnedPropertyBlipForPlayer).

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

function normalizeFactionKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'police' || key === 'lspd') return 'pd';
    if (key === 'medical' || key === 'ems') return 'md';
    return FACTION_DEFS[key] ? key : null;
}

function getFactionDef(factionKey) {
    const key = normalizeFactionKey(factionKey);
    return key ? FACTION_DEFS[key] : null;
}

function getFactionRankConfig(factionKey, rank) {
    const def = getFactionDef(factionKey);
    const level = parseInt(rank, 10);
    if (!def || !Number.isInteger(level) || level < 1 || level >= def.ranks.length) return null;
    return def.ranks[level];
}

function getFactionRankName(factionKey, rank) {
    const key = normalizeFactionKey(factionKey);
    const level = parseInt(rank, 10);
    const config = getFactionRankConfig(key, level);
    if (!key || !config) return 'Civilian';
    return factionRankNames.get(`${key}:${level}`) || config.defaultName;
}

function getFactionSalary(factionKey, rank) {
    const config = getFactionRankConfig(factionKey, rank);
    return config ? Math.max(0, parseInt(config.salary, 10) || 0) : 0;
}

function applyFactionData(player, factionKey, rank, isLeader) {
    const key = normalizeFactionKey(factionKey);
    const def = getFactionDef(key);
    if (!player || !def) {
        if (player) {
            player.factionKey = null;
            player.factionRank = 0;
            player.factionLeader = false;
            player.factionDuty = false;
        }
        return;
    }

    const parsedRank = parseInt(rank, 10);
    const safeRank = Number.isInteger(parsedRank) && parsedRank >= 1 && parsedRank < def.ranks.length ? parsedRank : 1;
    player.factionKey = key;
    player.factionRank = isLeader ? def.leaderRank : safeRank;
    player.factionLeader = Boolean(isLeader);
    player.factionDuty = false;
}

function getPlayerFactionDef(player) {
    return player && player.factionKey ? getFactionDef(player.factionKey) : null;
}

function requireFactionMember(player, factionKey, dutyRequired = false) {
    const def = getFactionDef(factionKey);
    if (!player.charName) {
        player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
        return false;
    }
    if (!def || player.factionKey !== def.key || !player.factionRank) {
        player.outputChatBox(`!{#e74c3c}Turite buti ${def ? def.label : 'faction'} narys.`);
        return false;
    }
    if (dutyRequired && !player.factionDuty) {
        player.outputChatBox('!{#f7dc6f}Pirma turite pradeti darba su /duty.');
        return false;
    }
    return true;
}

function requireFactionLeader(player) {
    if (!player.charName) {
        player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
        return null;
    }

    const def = getPlayerFactionDef(player);
    if (!def || !player.factionLeader) {
        player.outputChatBox('!{#e74c3c}Tik faction leader gali naudoti sia komanda.');
        return null;
    }
    return def;
}

function setFactionRankName(factionKey, rank, rankName, callback) {
    const key = normalizeFactionKey(factionKey);
    const level = parseInt(rank, 10);
    const name = String(rankName || '').trim().replace(/\s+/g, ' ').slice(0, 64);
    if (!key || !getFactionRankConfig(key, level) || name.length < 2) {
        callback(new Error('invalid rank name'));
        return;
    }

    factionRankNames.set(`${key}:${level}`, name);
    db.query(
        'INSERT INTO faction_rank_names (faction_key, rank_level, rank_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rank_name = VALUES(rank_name)',
        [key, level, name],
        callback
    );
}

function loadFactionRankNames() {
    db.query('SELECT faction_key, rank_level, rank_name FROM faction_rank_names', (err, rows) => {
        if (err) {
            console.error('[FACTIONS] Failed to load faction rank names:', err.message);
            return;
        }

        factionRankNames.clear();
        (rows || []).forEach((row) => {
            const key = normalizeFactionKey(row.faction_key);
            const level = parseInt(row.rank_level, 10);
            const name = String(row.rank_name || '').trim();
            if (key && getFactionRankConfig(key, level) && name) {
                factionRankNames.set(`${key}:${level}`, name);
            }
        });
        console.log(`[FACTIONS] Loaded ${factionRankNames.size} rank names.`);
    });
}

function seedFactionRankNames() {
    Object.values(FACTION_DEFS).forEach((def) => {
        def.ranks.forEach((rank, level) => {
            if (!rank) return;
            db.query(
                'INSERT IGNORE INTO faction_rank_names (faction_key, rank_level, rank_name) VALUES (?, ?, ?)',
                [def.key, level, rank.defaultName],
                (err) => {
                    if (err) console.error('[FACTIONS] Failed to seed rank name:', err.message);
                }
            );
        });
    });
    setTimeout(loadFactionRankNames, 750);
}

function updateCharacterFaction(charId, factionKey, rank, isLeader, callback) {
    db.query(
        'UPDATE characters SET faction_key = ?, faction_rank = ?, faction_leader = ? WHERE id = ?',
        [factionKey, rank, isLeader ? 1 : 0, charId],
        callback
    );
}

function sendFactionMessage(factionKey, message) {
    const key = normalizeFactionKey(factionKey);
    if (!key) return 0;
    let count = 0;
    mp.players.toArray().forEach((p) => {
        if (p.charName && p.factionKey === key) {
            p.outputChatBox(message);
            count += 1;
        }
    });
    return count;
}

function sendEmergencyMessage(message) {
    let count = 0;
    mp.players.toArray().forEach((p) => {
        if (p.charName && (p.factionKey === 'pd' || p.factionKey === 'md')) {
            p.outputChatBox(message);
            count += 1;
        }
    });
    return count;
}

function setPlayerCuffed(target, state, officer = null) {
    if (!target) return;
    target.isCuffed = Boolean(state);
    target.cuffedBy = state && officer ? officer.charName : null;
    target.call('setCuffedState', [Boolean(state)]);
}

function releasePlayerFromJail(target, notify = true) {
    if (!target) return;
    if (target.jailTimer) {
        clearTimeout(target.jailTimer);
        delete target.jailTimer;
    }
    target.isJailed = false;
    target.jailedUntil = null;
    target.position = PD_RELEASE_POS;
    target.heading = PD_RELEASE_HEADING;
    target.dimension = 0;
    setPlayerCuffed(target, false);
    if (notify) {
        target.outputChatBox('!{#7aa164}Jus paleistas is sulaikymo kameros.');
    }
}

function isNearPdJailCells(player, radius = PD_JAIL_COMMAND_RADIUS) {
    return player && player.position && getDistanceBetweenPositions(player.position, PD_JAIL_POS) <= radius;
}

function splitCommandText(fullText) {
    return String(fullText || '').trim().split(/\s+/).filter(Boolean);
}

function persistPlayerBankBalance(player) {
    if (!player || !player.charName) return;

    player.call('updateBankHUD', [player.bankBalance || 0]);
    db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance || 0, player.charName], (err) => {
        if (err) {
            console.error('[BANK] Failed to save bank balance:', err.message);
        }
    });
}

function requirePoliceMdcAccess(player) {
    if (!requireFactionMember(player, 'pd', true)) return false;
    if (!player.vehicle) {
        player.outputChatBox('!{#f7dc6f}MDC galite naudoti tik budedami ir sededami automobilyje.');
        return false;
    }
    return true;
}

function formatFactionRoleLabel(factionKey, factionRank) {
    const def = getFactionDef(factionKey);
    if (!def || !factionRank) return 'Civilian';
    return `${def.shortLabel} ${getFactionRankName(def.key, factionRank)}`;
}

function formatMdcTimestamp(value) {
    const stamp = moment(value);
    return stamp.isValid() ? stamp.format('YYYY-MM-DD HH:mm') : 'unknown';
}

function resolveCharacterRecordForPolice(identifier, callback) {
    const trimmed = String(identifier || '').trim();
    if (!trimmed) {
        callback(null, null, null);
        return;
    }

    const onlinePlayer = getPlayerByIDOrName(trimmed);
    if (onlinePlayer && onlinePlayer.charId) {
        callback(null, {
            id: onlinePlayer.charId,
            char_name: onlinePlayer.charName,
            drivers_license: onlinePlayer.hasDriversLicense ? 1 : 0,
            faction_key: onlinePlayer.factionKey || null,
            faction_rank: onlinePlayer.factionRank || 0,
        }, onlinePlayer);
        return;
    }

    const handleRows = (rows) => {
        if (!rows || rows.length === 0) {
            callback(null, null, null);
            return;
        }
        if (rows.length > 1) {
            callback(new Error('ambiguous'));
            return;
        }
        callback(null, rows[0], null);
    };

    if (/^\d+$/.test(trimmed)) {
        db.query('SELECT id, char_name, drivers_license, faction_key, faction_rank FROM characters WHERE id = ? LIMIT 2', [parseInt(trimmed, 10)], (err, rows) => {
            if (err) return callback(err);
            handleRows(rows);
        });
        return;
    }

    db.query('SELECT id, char_name, drivers_license, faction_key, faction_rank FROM characters WHERE LOWER(char_name) = LOWER(?) LIMIT 1', [trimmed], (exactErr, exactRows) => {
        if (exactErr) return callback(exactErr);
        if (exactRows && exactRows.length === 1) {
            handleRows(exactRows);
            return;
        }

        db.query('SELECT id, char_name, drivers_license, faction_key, faction_rank FROM characters WHERE LOWER(char_name) LIKE LOWER(?) ORDER BY char_name ASC LIMIT 2', [`${trimmed}%`], (likeErr, likeRows) => {
            if (likeErr) return callback(likeErr);
            handleRows(likeRows);
        });
    });
}

function showPoliceMdcHelp(player) {
    player.outputChatBox('!{#5dade2}[MDC] /mdc person [ID/vardas], /mdc plate [numeriai]');
    player.outputChatBox('!{#5dade2}[MDC] /mdc warrant [ID/vardas] [priezastis], /mdc warrants [ID/vardas], /mdc clear [warrant ID]');
}

function handlePoliceMdcPersonLookup(player, identifier) {
    resolveCharacterRecordForPolice(identifier, (err, record, onlinePlayer) => {
        if (err) {
            if (err.message === 'ambiguous') return player.outputChatBox('!{#f7dc6f}Rasti keli panasus irasai. Naudokite tikslu ID arba pilna varda.');
            console.error('[MDC] person lookup failed:', err.message);
            return player.outputChatBox('!{#e74c3c}Nepavyko gauti MDC iraso.');
        }
        if (!record) return player.outputChatBox('!{#f7dc6f}Asmuo nerastas.');

        db.query('SELECT COUNT(*) AS totalCount, COALESCE(SUM(amount), 0) AS totalAmount FROM police_fines WHERE char_id = ?', [record.id], (fineErr, fineRows) => {
            if (fineErr) {
                console.error('[MDC] fine summary failed:', fineErr.message);
                return player.outputChatBox('!{#e74c3c}Nepavyko gauti baudu istorijos.');
            }

            db.query(`SELECT id, reason, issued_by_name, created_at FROM police_mdc_warrants WHERE char_id = ? AND status = ? ORDER BY created_at DESC LIMIT ${POLICE_MDC_HISTORY_LIMIT}`, [record.id, POLICE_MDC_WARRANT_STATUS_OPEN], (warrantErr, warrantRows) => {
                if (warrantErr) {
                    console.error('[MDC] warrant lookup failed:', warrantErr.message);
                    return player.outputChatBox('!{#e74c3c}Nepavyko gauti ieskomumo informacijos.');
                }

                const fineSummary = (fineRows && fineRows[0]) || { totalCount: 0, totalAmount: 0 };
                const statusParts = [onlinePlayer ? 'online' : 'offline'];
                if (onlinePlayer && onlinePlayer.isCuffed) statusParts.push('cuffed');
                if (onlinePlayer && onlinePlayer.isJailed) statusParts.push('jailed');
                const roleLabel = formatFactionRoleLabel(record.faction_key, record.faction_rank);
                const licenseLabel = Number(record.drivers_license || 0) === 1 ? 'yes' : 'no';

                player.outputChatBox(`!{#5dade2}[MDC] ${record.char_name} (ID ${record.id}) | ${statusParts.join(', ')} | license: ${licenseLabel}`);
                player.outputChatBox(`!{#d6eaf8}[MDC] Role: ${roleLabel} | fines: ${fineSummary.totalCount} / $${fineSummary.totalAmount || 0} | open warrants: ${warrantRows.length}`);
                if (!warrantRows || warrantRows.length === 0) {
                    player.outputChatBox('!{#d5f5e3}[MDC] Open warrants: none.');
                    return;
                }

                warrantRows.forEach((row) => {
                    player.outputChatBox(`!{#f9e79f}[MDC] W#${row.id} | ${formatMdcTimestamp(row.created_at)} | ${row.issued_by_name}: ${row.reason}`);
                });
            });
        });
    });
}

function handlePoliceMdcPlateLookup(player, plateInput) {
    const normalizedPlate = normalizeVehiclePlateInput(plateInput);
    if (normalizedPlate.length < 3) {
        player.outputChatBox('!{#f7dc6f}Iveskite bent 3 numeriu simbolius.');
        return;
    }

    db.query(`SELECT pv.id, pv.display_name, pv.plate, pv.parked, pv.locked, c.char_name
        FROM player_vehicles pv
        INNER JOIN characters c ON c.id = pv.char_id
        WHERE REPLACE(REPLACE(UPPER(pv.plate), ' ', ''), '-', '') = ?
        LIMIT 1`, [normalizedPlate], (err, rows) => {
        if (err) {
            console.error('[MDC] plate lookup failed:', err.message);
            return player.outputChatBox('!{#e74c3c}Nepavyko gauti transporto iraso.');
        }
        if (!rows || rows.length === 0) return player.outputChatBox('!{#f7dc6f}Transporto priemone nerasta.');

        const row = rows[0];
        const parked = Number(row.parked) === 1 ? 'parked' : 'active';
        const locked = Number(row.locked) === 1 ? 'locked' : 'unlocked';
        player.outputChatBox(`!{#5dade2}[MDC] Plate ${row.plate} | ${row.display_name} | owner: ${row.char_name}`);
        player.outputChatBox(`!{#d6eaf8}[MDC] Vehicle ID ${row.id} | ${parked} | ${locked}`);
    });
}

function handlePoliceMdcWarrantCreate(player, identifier, reasonText) {
    const reason = String(reasonText || '').trim().replace(/\s+/g, ' ').slice(0, 128);
    if (reason.length < 3) {
        player.outputChatBox('!{#f7dc6f}Irasykite warrant priezasti.');
        return;
    }

    resolveCharacterRecordForPolice(identifier, (err, record) => {
        if (err) {
            if (err.message === 'ambiguous') return player.outputChatBox('!{#f7dc6f}Rasti keli panasus irasai. Naudokite tikslu ID arba pilna varda.');
            console.error('[MDC] warrant create failed:', err.message);
            return player.outputChatBox('!{#e74c3c}Nepavyko sukurti warrant.');
        }
        if (!record) return player.outputChatBox('!{#f7dc6f}Asmuo nerastas.');

        db.query('INSERT INTO police_mdc_warrants (char_id, suspect_name, issued_by_char_id, issued_by_name, reason, status) VALUES (?, ?, ?, ?, ?, ?)', [record.id, record.char_name, player.charId || null, player.charName, reason, POLICE_MDC_WARRANT_STATUS_OPEN], (insertErr, result) => {
            if (insertErr) {
                console.error('[MDC] warrant insert failed:', insertErr.message);
                return player.outputChatBox('!{#e74c3c}Nepavyko issaugoti warrant.');
            }
            player.outputChatBox(`!{#7aa164}[MDC] Sukurtas warrant #${result.insertId} asmeniui ${record.char_name}.`);
        });
    });
}

function handlePoliceMdcWarrantList(player, identifier) {
    resolveCharacterRecordForPolice(identifier, (err, record) => {
        if (err) {
            if (err.message === 'ambiguous') return player.outputChatBox('!{#f7dc6f}Rasti keli panasus irasai. Naudokite tikslu ID arba pilna varda.');
            console.error('[MDC] warrant list failed:', err.message);
            return player.outputChatBox('!{#e74c3c}Nepavyko gauti warrant saraso.');
        }
        if (!record) return player.outputChatBox('!{#f7dc6f}Asmuo nerastas.');

        db.query('SELECT id, reason, issued_by_name, created_at FROM police_mdc_warrants WHERE char_id = ? AND status = ? ORDER BY created_at DESC LIMIT 10', [record.id, POLICE_MDC_WARRANT_STATUS_OPEN], (listErr, rows) => {
            if (listErr) {
                console.error('[MDC] warrant list query failed:', listErr.message);
                return player.outputChatBox('!{#e74c3c}Nepavyko gauti warrant saraso.');
            }
            if (!rows || rows.length === 0) return player.outputChatBox(`!{#d5f5e3}[MDC] ${record.char_name} neturi atviru warrant.`);

            player.outputChatBox(`!{#5dade2}[MDC] ${record.char_name} open warrants (${rows.length}):`);
            rows.forEach((row) => {
                player.outputChatBox(`!{#f9e79f}[MDC] W#${row.id} | ${formatMdcTimestamp(row.created_at)} | ${row.issued_by_name}: ${row.reason}`);
            });
        });
    });
}

function handlePoliceMdcWarrantClear(player, warrantIdArg) {
    const warrantId = parseInt(warrantIdArg, 10);
    if (!Number.isInteger(warrantId) || warrantId <= 0) {
        player.outputChatBox('!{#f7dc6f}Naudojimas: /mdc clear [warrant ID]');
        return;
    }

    db.query('SELECT id, suspect_name FROM police_mdc_warrants WHERE id = ? AND status = ? LIMIT 1', [warrantId, POLICE_MDC_WARRANT_STATUS_OPEN], (selectErr, rows) => {
        if (selectErr) {
            console.error('[MDC] warrant select failed:', selectErr.message);
            return player.outputChatBox('!{#e74c3c}Nepavyko rasti warrant.');
        }
        if (!rows || rows.length === 0) return player.outputChatBox('!{#f7dc6f}Atviras warrant nerastas.');

        db.query('UPDATE police_mdc_warrants SET status = ?, cleared_at = NOW(), cleared_by_name = ? WHERE id = ?', [POLICE_MDC_WARRANT_STATUS_CLEARED, player.charName, warrantId], (updateErr) => {
            if (updateErr) {
                console.error('[MDC] warrant clear failed:', updateErr.message);
                return player.outputChatBox('!{#e74c3c}Nepavyko uzdaryti warrant.');
            }
            player.outputChatBox(`!{#7aa164}[MDC] Warrant #${warrantId} uzdarytas (${rows[0].suspect_name}).`);
        });
    });
}

function getFactionOnlineList(factionKey) {
    const key = normalizeFactionKey(factionKey);
    return mp.players.toArray()
        .filter(p => p.charName && p.factionKey === key)
        .map(p => `${p.charName} (${getFactionRankName(p.factionKey, p.factionRank)}${p.factionDuty ? ', duty' : ''})`);
}

function clearDeathState(player, unfreeze = true) {
    if (!player) return;

    if (player.deathStateReminderTimer) {
        clearInterval(player.deathStateReminderTimer);
        delete player.deathStateReminderTimer;
    }

    player.isDowned = false;
    player.downedAt = null;
    player.acceptDeathAvailableAt = null;

    if (unfreeze && player.deathFreezeApplied) {
        player.call('freezePlayer', [false]);
        player.call('setDownedRagdoll', [false]);
        player.frozen = false;
    }

    player.deathFreezeApplied = false;
}

function enterDownedState(player) {
    if (!player || !player.charId || player.isDowned) return;

    cleanupDMVTest(player, true);
    clearPlayerDrugEffectTimers(player);

    const now = Date.now();
    const downedPos = player.position
        ? new mp.Vector3(
            Number(player.position.x) || 0,
            Number(player.position.y) || 0,
            (Number(player.position.z) || 0) + DOWNED_RESPAWN_Z_OFFSET
        )
        : null;
    const downedHeading = Number.isFinite(Number(player.heading)) ? Number(player.heading) : 0;

    // Revive in-place to avoid GTA death black screen while keeping the player downed/frozen.
    if (downedPos) {
        player.spawn(downedPos);
        player.position = downedPos;
        player.heading = downedHeading;
        player.health = 1;
    }

    player.isDowned = true;
    player.downedAt = now;
    player.acceptDeathAvailableAt = now + DOWNED_ACCEPTDEATH_DELAY_MS;
    player.deathFreezeApplied = true;
    player.call('freezePlayer', [true]);
    player.call('setDownedRagdoll', [true]);
    player.frozen = true;

    player.outputChatBox('!{#e74c3c}Esate be samones. Po 2 minuciu galesite naudoti /acceptdeath ir atgimti ligonineje.');

    if (player.deathStateReminderTimer) {
        clearInterval(player.deathStateReminderTimer);
    }

    player.deathStateReminderTimer = setInterval(() => {
        if (!player || !player.charId || !player.isDowned) {
            if (player && player.deathStateReminderTimer) {
                clearInterval(player.deathStateReminderTimer);
                delete player.deathStateReminderTimer;
            }
            return;
        }

        const remainingMs = Math.max(0, Number(player.acceptDeathAvailableAt || 0) - Date.now());
        if (remainingMs <= 0) {
            player.outputChatBox('!{#f7dc6f}Galite naudoti /acceptdeath ir atgimti ligonineje.');
            clearInterval(player.deathStateReminderTimer);
            delete player.deathStateReminderTimer;
            return;
        }

        const seconds = Math.ceil(remainingMs / 1000);
        player.outputChatBox(`!{#f7dc6f}Iki /acceptdeath liko ${seconds} sek.`);
    }, 30000);
}

mp.events.add('playerDamage', (player, healthLoss) => {
    if (!player || !player.charId || player.isDowned) return;

    const currentHealth = Number(player.health);
    const loss = Number(healthLoss);
    if (!Number.isFinite(currentHealth) || !Number.isFinite(loss)) return;

    if ((currentHealth - loss) <= 0) {
        enterDownedState(player);
    }
});

function applyAcceptDeathConsequences(player, options = {}) {
    if (!player) return 0;

    const spawnAtHospital = options.spawnAtHospital !== false;
    const notifyPlayer = options.notifyPlayer !== false;
    const persistNow = options.persistNow !== false;

    const oldMoney = Math.max(0, parseInt(player.money, 10) || 0);
    const newMoney = Math.max(0, oldMoney - DEATH_RESPAWN_PENALTY_CASH);
    const removedMoney = oldMoney - newMoney;

    player.inventory = [];
    player.weaponPackageWeapons = [];
    setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
    player.money = newMoney;
    player.health = 100;

    if (persistNow) {
        persistInventory(player);
        persistWeaponPackage(player);
        persistEquippedWeapon(player);
        persistPlayerMoney(player);
    }

    if (spawnAtHospital) {
        player.spawn(HOSPITAL_RESPAWN_POS);
        player.position = HOSPITAL_RESPAWN_POS;
        player.heading = HOSPITAL_RESPAWN_HEADING;
        player.dimension = 0;
    }

    clearDeathState(player, spawnAtHospital);

    if (notifyPlayer) {
        player.outputChatBox(`!{#f7dc6f}Atsigavote ligonineje. Praradote visus inventory daiktus, ginklu paketa ir $${removedMoney}.`);
    }

    return removedMoney;
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

function normalizeVehiclePlateInput(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getDefaultPropertySettings() {
    return {
        locked: 1,
        rentPerPaycheck: 0,
    };
}

function getLocalizedPropertyName(propertyIdRaw) {
    const propertyId = Math.max(1, parseInt(propertyIdRaw, 10) || 1);
    return `Nuosavybe #${propertyId}`;
}

function shouldLocalizeLegacyPropertyName(nameRaw) {
    const name = String(nameRaw || '').trim();
    if (!name) return true;
    return /^property\s*#\s*\d+$/i.test(name);
}

function isGenericPropertyLabel(nameRaw) {
    const name = String(nameRaw || '').trim();
    if (!name) return true;
    return /^property\s*#\s*\d+$/i.test(name) || /^nuosavyb(?:e|e)\s*#\s*\d+$/i.test(name);
}

const GTA_ADDRESS_STREETS = Object.freeze([
    'Rodeo Drive',
    'Vinewood Blvd',
    'Alta Street',
    'Power Street',
    'Hawick Avenue',
    'Del Perro Fwy',
    'Eclipse Blvd',
    'Marathon Avenue',
    'Occupation Avenue',
    'Strawberry Avenue',
    'Innocence Blvd',
    'Elgin Avenue',
    'Spanish Avenue',
    'Fantastic Place',
    'Palomino Avenue',
    'Mirror Park Blvd',
    'Carcer Way',
    'Banham Canyon Drive',
    'Great Ocean Highway',
    'Route 68',
]);

function getHashFromPosition(pos) {
    if (!pos) return 0;
    const x = Math.floor(Math.abs(Number(pos.x) || 0) * 100);
    const y = Math.floor(Math.abs(Number(pos.y) || 0) * 100);
    const z = Math.floor(Math.abs(Number(pos.z) || 0) * 100);
    return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
}

function getGtaStreetNameByPosition(pos) {
    if (!pos || !GTA_ADDRESS_STREETS.length) return 'San Andreas Avenue';
    const hash = getHashFromPosition(pos);
    return GTA_ADDRESS_STREETS[hash % GTA_ADDRESS_STREETS.length] || 'San Andreas Avenue';
}

function getGtaHouseNumberByPosition(pos) {
    if (!pos) return 1000;
    const hash = getHashFromPosition(pos);
    return 100 + (hash % 9800);
}

function getAutoPropertyAddressFromPosition(pos) {
    const houseNumber = getGtaHouseNumberByPosition(pos);
    const streetName = getGtaStreetNameByPosition(pos);
    return `${houseNumber} ${streetName}`;
}

function sanitizePropertyAddress(addressRaw) {
    const text = String(addressRaw || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.slice(0, 128);
}

function requestNativePropertyAddressResolution(player, property) {
    if (!player || !property || !property.id || !property.entryPos) return;

    const now = Date.now();
    const lastRequestedPropertyId = parseInt(player.lastNativeAddressResolvePropertyId, 10);
    const lastRequestedAt = parseInt(player.lastNativeAddressResolveAt, 10);
    if (Number.isFinite(lastRequestedPropertyId)
        && Number.isFinite(lastRequestedAt)
        && lastRequestedPropertyId === Number(property.id)
        && (now - lastRequestedAt) < 30000) {
        return;
    }

    player.lastNativeAddressResolvePropertyId = Number(property.id);
    player.lastNativeAddressResolveAt = now;
    player.call('resolvePropertyNativeAddress', [
        Number(property.id),
        Number(property.entryPos.x) || 0,
        Number(property.entryPos.y) || 0,
        Number(property.entryPos.z) || 0,
    ]);
}

function getPropertyAddressForDisplay(property) {
    if (!property) return '1000 San Andreas Avenue';

    const storedAddress = sanitizePropertyAddress(property.address);
    if (storedAddress) return storedAddress;

    const position = property.entryPos || property.interiorPos || null;
    return getAutoPropertyAddressFromPosition(position);
}

function parsePropertySettings(rawSettings) {
    const defaults = getDefaultPropertySettings();
    if (rawSettings === null || rawSettings === undefined || rawSettings === '') return defaults;

    try {
        const parsed = JSON.parse(rawSettings);
        return {
            locked: Number(parsed.locked) ? 1 : 0,
            rentPerPaycheck: Math.max(0, parseInt(parsed.rentPerPaycheck, 10) || 0),
        };
    } catch (error) {
        console.error('[HOUSING] Failed to parse property settings JSON:', error.message);
        return defaults;
    }
}

function parsePropertyInventory(rawInventory) {
    if (rawInventory === null || rawInventory === undefined || rawInventory === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(rawInventory);
        return normalizeInventoryItems(parsed);
    } catch (error) {
        console.error('[HOUSING] Failed to parse property inventory JSON:', error.message);
        return [];
    }
}

function getPropertyInventoryJson(property) {
    if (!property || !Array.isArray(property.inventory)) return '[]';
    return JSON.stringify(property.inventory);
}

function getPropertySettingsJson(property) {
    if (!property || !property.settings) return JSON.stringify(getDefaultPropertySettings());
    return JSON.stringify({
        locked: Number(property.settings.locked) ? 1 : 0,
        rentPerPaycheck: Math.max(0, parseInt(property.settings.rentPerPaycheck, 10) || 0),
    });
}

function persistPropertyState(property) {
    if (!property || !property.id) return;
    property.address = getPropertyAddressForDisplay(property);

    db.query(
        'UPDATE server_properties SET owner_char_id = ?, owner_char_name = ?, tenant_char_id = ?, tenant_char_name = ?, inventory = ?, settings = ?, address = ? WHERE id = ?',
        [
            property.ownerCharId || null,
            property.ownerCharName || null,
            property.tenantCharId || null,
            property.tenantCharName || null,
            getPropertyInventoryJson(property),
            getPropertySettingsJson(property),
            property.address,
            property.id,
        ],
        (err) => {
            if (err) {
                console.error('[HOUSING] Failed to persist property state:', err.message);
            }
        }
    );
}

function loadPropertiesFromDatabase() {
    db.query('SELECT * FROM server_properties ORDER BY id ASC', (err, rows) => {
        if (err) {
            console.error('[HOUSING] Failed to load properties:', err.message);
            return;
        }

        propertiesById.clear();

        rows.forEach((row) => {
            const propertyId = Number(row.id);
            const shouldLocalizeName = shouldLocalizeLegacyPropertyName(row.name);
            const localizedName = shouldLocalizeName ? getLocalizedPropertyName(propertyId) : String(row.name || '').trim();
            const generatedAddress = getAutoPropertyAddressFromPosition({ x: row.entry_x, y: row.entry_y, z: row.entry_z });
            const storedAddress = String(row.address || '').trim();
            const resolvedAddress = storedAddress || generatedAddress;

            const property = {
                id: propertyId,
                key: row.property_key,
                name: localizedName,
                address: resolvedAddress,
                price: Math.max(0, parseInt(row.price, 10) || 0),
                entryPos: new mp.Vector3(Number(row.entry_x), Number(row.entry_y), Number(row.entry_z)),
                entryHeading: Number.isFinite(Number(row.entry_h)) ? Number(row.entry_h) : 0,
                interiorPos: new mp.Vector3(Number(row.interior_x), Number(row.interior_y), Number(row.interior_z)),
                interiorHeading: Number.isFinite(Number(row.interior_h)) ? Number(row.interior_h) : 0,
                exitPos: new mp.Vector3(Number(row.interior_x), Number(row.interior_y), Number(row.interior_z)),
                exitHeading: Number.isFinite(Number(row.interior_h)) ? Number(row.interior_h) : 0,
                dimension: Math.max(1, parseInt(row.dimension, 10) || (7000 + Number(row.id))),
                ownerCharId: row.owner_char_id ? Number(row.owner_char_id) : null,
                ownerCharName: row.owner_char_name || null,
                tenantCharId: row.tenant_char_id ? Number(row.tenant_char_id) : null,
                tenantCharName: row.tenant_char_name || null,
                inventory: parsePropertyInventory(row.inventory),
                settings: parsePropertySettings(row.settings),
            };

            if (shouldLocalizeName) {
                db.query('UPDATE server_properties SET name = ? WHERE id = ?', [localizedName, propertyId]);
            }

            if (!storedAddress) {
                db.query('UPDATE server_properties SET address = ? WHERE id = ?', [resolvedAddress, propertyId]);
            }

            propertiesById.set(property.id, property);
        });

        propertiesLoaded = true;
        console.log(`[HOUSING] Loaded ${propertiesById.size} properties.`);
    });
}

function seedAndLoadProperties() {
    if (!PROPERTY_CATALOG.length) {
        loadPropertiesFromDatabase();
        return;
    }

    let pending = PROPERTY_CATALOG.length;
    const done = () => {
        pending -= 1;
        if (pending <= 0) {
            loadPropertiesFromDatabase();
        }
    };

    PROPERTY_CATALOG.forEach((propertyDef) => {
        const settingsJson = JSON.stringify(getDefaultPropertySettings());
        const autoAddress = getAutoPropertyAddressFromPosition(propertyDef.entry);
        db.query(
            'INSERT IGNORE INTO server_properties (property_key, name, address, price, entry_x, entry_y, entry_z, entry_h, interior_x, interior_y, interior_z, interior_h, dimension, inventory, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                propertyDef.key,
                propertyDef.name,
                autoAddress,
                propertyDef.price,
                propertyDef.entry.x,
                propertyDef.entry.y,
                propertyDef.entry.z,
                propertyDef.entry.h,
                propertyDef.interior.x,
                propertyDef.interior.y,
                propertyDef.interior.z,
                propertyDef.interior.h,
                propertyDef.dimension,
                '[]',
                settingsJson,
            ],
            (err) => {
                if (err) {
                    console.error('[HOUSING] Failed to seed property:', propertyDef.key, err.message);
                }
                done();
            }
        );
    });
}

function getPropertyById(propertyIdRaw) {
    const propertyId = parseInt(propertyIdRaw, 10);
    if (!Number.isFinite(propertyId)) return null;
    return propertiesById.get(propertyId) || null;
}

function getNearbyProperty(player, radius = PROPERTY_INTERACT_RADIUS) {
    if (!player || !player.position || Number(player.dimension) !== 0) return null;

    let closest = null;
    let closestDistance = Number(radius);

    propertiesById.forEach((property) => {
        const distance = getDistanceBetweenPositions(player.position, property.entryPos);
        if (distance <= closestDistance) {
            closestDistance = distance;
            closest = property;
        }
    });

    return closest;
}

function getPlayerCurrentProperty(player) {
    if (!player) return null;

    const currentPropertyId = parseInt(player.currentPropertyId, 10);
    if (Number.isFinite(currentPropertyId)) {
        const byId = propertiesById.get(currentPropertyId);
        if (byId) return byId;
    }

    if (Number(player.dimension) <= 0) return null;

    for (const property of propertiesById.values()) {
        if (Number(property.dimension) === Number(player.dimension)) {
            return property;
        }
    }

    return null;
}

function isPropertyOwner(player, property) {
    if (!player || !property || !player.charId) return false;

    const ownerCharId = parseInt(property.ownerCharId, 10);
    const playerCharId = parseInt(player.charId, 10);
    if (!Number.isFinite(ownerCharId) || ownerCharId <= 0) return false;
    if (!Number.isFinite(playerCharId) || playerCharId <= 0) return false;

    return ownerCharId === playerCharId;
}

function isPropertyTenant(player, property) {
    if (!player || !property || !player.charId) return false;

    const tenantCharId = parseInt(property.tenantCharId, 10);
    const playerCharId = parseInt(player.charId, 10);
    if (!Number.isFinite(tenantCharId) || tenantCharId <= 0) return false;
    if (!Number.isFinite(playerCharId) || playerCharId <= 0) return false;

    return tenantCharId === playerCharId;
}

function isPropertyLocked(property) {
    if (!property || !property.settings) return false;
    const raw = property.settings.locked;
    if (raw === true) return true;
    if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        if (normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
    }
    return Number(raw) === 1;
}

function canAccessProperty(player, property) {
    if (!player || !property) return false;
    return isPropertyOwner(player, property) || isPropertyTenant(player, property);
}

function clearTenantFromProperty(property) {
    if (!property) return;
    property.tenantCharId = null;
    property.tenantCharName = null;
}

function setTenantForProperty(property, tenantPlayer) {
    if (!property || !tenantPlayer || !tenantPlayer.charId || !tenantPlayer.charName) return false;

    property.tenantCharId = tenantPlayer.charId;
    property.tenantCharName = tenantPlayer.charName;
    return true;
}

function getOwnedPropertyContext(player) {
    const currentProperty = getPlayerCurrentProperty(player);
    if (currentProperty && isPropertyOwner(player, currentProperty)) {
        return currentProperty;
    }

    const nearbyProperty = getNearbyProperty(player);
    if (nearbyProperty && isPropertyOwner(player, nearbyProperty)) {
        return nearbyProperty;
    }

    return null;
}

function getTenantPropertyContext(player) {
    const currentProperty = getPlayerCurrentProperty(player);
    if (currentProperty && isPropertyTenant(player, currentProperty)) {
        return currentProperty;
    }

    const nearbyProperty = getNearbyProperty(player, 12.0);
    if (nearbyProperty && isPropertyTenant(player, nearbyProperty)) {
        return nearbyProperty;
    }

    return null;
}

function getPropertyRentedByCharId(charId) {
    const safeCharId = parseInt(charId, 10);
    if (!Number.isFinite(safeCharId) || safeCharId <= 0) return null;

    for (const property of propertiesById.values()) {
        if (Number(property.tenantCharId) === safeCharId) {
            return property;
        }
    }

    return null;
}

function getAccessiblePropertyContext(player) {
    const currentProperty = getPlayerCurrentProperty(player);
    if (currentProperty && canAccessProperty(player, currentProperty)) {
        return currentProperty;
    }

    const nearbyProperty = getNearbyProperty(player);
    if (nearbyProperty && canAccessProperty(player, nearbyProperty)) {
        return nearbyProperty;
    }

    return null;
}

function addPropertyInventoryItem(property, type, amount) {
    if (!property) return null;
    if (!Array.isArray(property.inventory)) {
        property.inventory = [];
    }

    const quantity = Math.max(1, parseInt(amount, 10) || 1);
    const existing = property.inventory.find(item => item && item.type === type);
    if (existing) {
        existing.quantity += quantity;
        return existing;
    }

    const created = createInventoryItem(type, quantity);
    if (!created) return null;
    property.inventory.push(created);
    return created;
}

function removePropertyInventoryItemByType(property, type, amount) {
    if (!property || !Array.isArray(property.inventory)) return null;

    const index = property.inventory.findIndex(item => item && item.type === type);
    if (index === -1) return null;

    const entry = property.inventory[index];
    const quantity = Math.max(1, parseInt(amount, 10) || 1);
    if (entry.quantity < quantity) return null;

    entry.quantity -= quantity;
    if (entry.quantity <= 0) {
        property.inventory.splice(index, 1);
    }

    return entry;
}

function getPropertyRentForOwner(charId) {
    const safeCharId = parseInt(charId, 10);
    if (!Number.isFinite(safeCharId)) return 0;

    let total = 0;
    propertiesById.forEach((property) => {
        if (Number(property.ownerCharId) !== safeCharId) return;
        total += Math.max(0, parseInt(property.settings?.rentPerPaycheck, 10) || 0);
    });

    return total;
}

function getPropertyRentChargeLinesForTenant(charId) {
    const safeCharId = parseInt(charId, 10);
    if (!Number.isFinite(safeCharId)) return [];

    const lines = [];
    propertiesById.forEach((property) => {
        if (Number(property.tenantCharId) !== safeCharId) return;
        const rent = Math.max(0, parseInt(property.settings?.rentPerPaycheck, 10) || 0);
        if (rent <= 0) return;
        if (!property.ownerCharId || !property.ownerCharName) return;
        lines.push({ property, rent });
    });

    return lines;
}

function findOnlinePlayerByCharId(charId) {
    const safeCharId = parseInt(charId, 10);
    if (!Number.isFinite(safeCharId)) return null;
    return mp.players.toArray().find(p => Number(p.charId) === safeCharId) || null;
}

function formatPropertyOwner(property) {
    if (!property || !property.ownerCharId) return 'Server';
    return property.ownerCharName || `Char ID ${property.ownerCharId}`;
}

function sendPropertyInfo(player, property) {
    if (!player || !property) return;

    const ownerText = formatPropertyOwner(property);
    const tenantText = property.tenantCharId ? (property.tenantCharName || `Char ID ${property.tenantCharId}`) : 'Nera';
    const lockedText = Number(property.settings?.locked) ? 'Uzrakintas' : 'Atrakintas';
    const rentText = Math.max(0, parseInt(property.settings?.rentPerPaycheck, 10) || 0);

    player.outputChatBox(`!{#85c1e9}Property #${property.id}: ${property.name}`);
    player.outputChatBox(`!{#d6eaf8}Kaina: $${property.price} | Savininkas: ${ownerText}`);
    player.outputChatBox(`!{#d6eaf8}Busena: ${lockedText} | Nuoma per paycheck: $${rentText} | Nuomininkas: ${tenantText}`);
}

function movePlayerIntoProperty(player, property) {
    if (!player || !property) return;

    const targetPos = property.exitPos || property.interiorPos;
    const targetHeading = Number.isFinite(property.exitHeading)
        ? property.exitHeading
        : (Number.isFinite(property.interiorHeading) ? property.interiorHeading : 0);

    player.dimension = property.dimension;
    player.position = targetPos;
    player.heading = targetHeading;
    player.currentPropertyId = property.id;
    player.currentBusinessId = null;
}

function normalizeBusinessType(typeRaw) {
    const key = String(typeRaw || '').trim().toLowerCase();
    return BUSINESS_TYPE_ALIASES[key] || null;
}

function getBusinessTypeDefinition(typeRaw) {
    const type = normalizeBusinessType(typeRaw) || String(typeRaw || '').trim().toLowerCase();
    return BUSINESS_TYPE_DEFS[type] || null;
}

function getBusinessTypeLabel(typeRaw) {
    const definition = getBusinessTypeDefinition(typeRaw);
    return definition ? definition.label : 'Verslas';
}

function sanitizeBusinessName(nameRaw) {
    const name = String(nameRaw || '').replace(/\s+/g, ' ').trim();
    return name.slice(0, 80);
}

function getDefaultBusinessName(typeRaw, businessIdRaw = null) {
    const baseLabel = getBusinessTypeLabel(typeRaw);
    const businessId = parseInt(businessIdRaw, 10);
    if (!Number.isFinite(businessId)) return baseLabel;
    return `${baseLabel} #${businessId}`;
}

function destroyBusinessVisualById(businessIdRaw) {
    const businessId = parseInt(businessIdRaw, 10);
    if (!Number.isFinite(businessId)) return;

    const visuals = businessVisualsById.get(businessId);
    if (!visuals) return;

    if (visuals.blip && typeof visuals.blip.destroy === 'function') {
        try {
            visuals.blip.destroy();
        } catch (error) {
            console.error('[BUSINESS] Failed to destroy blip:', error.message);
        }
    }

    if (visuals.marker && typeof visuals.marker.destroy === 'function') {
        try {
            visuals.marker.destroy();
        } catch (error) {
            console.error('[BUSINESS] Failed to destroy marker:', error.message);
        }
    }

    businessVisualsById.delete(businessId);
}

function clearBusinessVisuals() {
    Array.from(businessVisualsById.keys()).forEach((businessId) => {
        destroyBusinessVisualById(businessId);
    });
}

function refreshBusinessVisual(business) {
    if (!business || !business.id || !business.entryPos) return;

    destroyBusinessVisualById(business.id);

    const typeDef = getBusinessTypeDefinition(business.type) || BUSINESS_TYPE_DEFS.shop;
    const entryPos = new mp.Vector3(business.entryPos.x, business.entryPos.y, business.entryPos.z);
    const blip = mp.blips.new(52, entryPos, {
        name: business.name || getDefaultBusinessName(business.type, business.id),
        color: typeDef.blipColor,
        shortRange: true,
        scale: 0.8,
    });
    const marker = mp.markers.new(1, new mp.Vector3(entryPos.x, entryPos.y, entryPos.z - 1.0), 1.0, {
        color: typeDef.markerColor,
        visible: true,
        dimension: 0,
    });

    businessVisualsById.set(Number(business.id), { blip, marker });
}

function getBusinessAddressForDisplay(business) {
    if (!business) return '1000 San Andreas Avenue';

    const storedAddress = sanitizePropertyAddress(business.address);
    if (storedAddress) return storedAddress;

    return getAutoPropertyAddressFromPosition(business.entryPos || business.interiorPos || null);
}

function sanitizeBusinessInteractRadius(rawRadius) {
    const parsed = Number(rawRadius);
    if (!Number.isFinite(parsed)) return BUSINESS_INTERACT_RADIUS;
    return Math.max(BUSINESS_INTERACT_RADIUS_MIN, Math.min(BUSINESS_INTERACT_RADIUS_MAX, Math.round(parsed * 100) / 100));
}

function getBusinessInteractRadius(business) {
    if (!business) return BUSINESS_INTERACT_RADIUS;
    return sanitizeBusinessInteractRadius(business.interactRadius);
}

function persistBusinessState(business) {
    if (!business || !business.id) return;

    db.query(
        'UPDATE server_businesses SET name = ?, business_type = ?, address = ?, owner_char_id = ?, owner_char_name = ?, bank_balance = ?, entry_x = ?, entry_y = ?, entry_z = ?, entry_h = ?, interior_x = ?, interior_y = ?, interior_z = ?, interior_h = ?, exit_x = ?, exit_y = ?, exit_z = ?, exit_h = ?, dimension = ?, pawn_inventory = ?, interact_radius = ? WHERE id = ?',
        [
            business.name,
            business.type,
            getBusinessAddressForDisplay(business),
            business.ownerCharId || null,
            business.ownerCharName || null,
            Math.max(0, parseInt(business.bankBalance, 10) || 0),
            business.entryPos.x,
            business.entryPos.y,
            business.entryPos.z,
            Number.isFinite(business.entryHeading) ? business.entryHeading : 0,
            business.interiorPos.x,
            business.interiorPos.y,
            business.interiorPos.z,
            Number.isFinite(business.interiorHeading) ? business.interiorHeading : 0,
            business.exitPos.x,
            business.exitPos.y,
            business.exitPos.z,
            Number.isFinite(business.exitHeading) ? business.exitHeading : 0,
            business.dimension,
            getBusinessPawnInventoryJson(business),
            getBusinessInteractRadius(business),
            business.id,
        ],
        (err) => {
            if (err) {
                console.error('[BUSINESS] Failed to persist business state:', err.message);
            }
        }
    );
}

function loadBusinessesFromDatabase() {
    db.query('SELECT * FROM server_businesses ORDER BY id ASC', (err, rows) => {
        if (err) {
            console.error('[BUSINESS] Failed to load businesses:', err.message);
            return;
        }

        businessesById.clear();
        clearBusinessVisuals();

        rows.forEach((row) => {
            const businessId = Number(row.id);
            const normalizedType = normalizeBusinessType(row.business_type) || 'shop';
            const storedName = sanitizeBusinessName(row.name);
            const defaultName = getDefaultBusinessName(normalizedType, businessId);
            const resolvedName = storedName || defaultName;
            const resolvedAddress = sanitizePropertyAddress(row.address)
                || getAutoPropertyAddressFromPosition({ x: row.entry_x, y: row.entry_y, z: row.entry_z });

            const business = {
                id: businessId,
                key: row.business_key,
                name: resolvedName,
                type: normalizedType,
                address: resolvedAddress,
                ownerCharId: row.owner_char_id ? Number(row.owner_char_id) : null,
                ownerCharName: row.owner_char_name || null,
                bankBalance: Math.max(0, parseInt(row.bank_balance, 10) || 0),
                entryPos: new mp.Vector3(Number(row.entry_x), Number(row.entry_y), Number(row.entry_z)),
                entryHeading: Number.isFinite(Number(row.entry_h)) ? Number(row.entry_h) : 0,
                interiorPos: new mp.Vector3(Number(row.interior_x), Number(row.interior_y), Number(row.interior_z)),
                interiorHeading: Number.isFinite(Number(row.interior_h)) ? Number(row.interior_h) : 0,
                exitPos: new mp.Vector3(Number(row.exit_x), Number(row.exit_y), Number(row.exit_z)),
                exitHeading: Number.isFinite(Number(row.exit_h)) ? Number(row.exit_h) : 0,
                dimension: Math.max(1, parseInt(row.dimension, 10) || getUniqueBusinessDimension(businessId)),
                pawnInventory: parseBusinessPawnInventory(row.pawn_inventory),
                interactRadius: sanitizeBusinessInteractRadius(row.interact_radius),
            };

            businessesById.set(business.id, business);
            refreshBusinessVisual(business);

            if (!storedName || storedName !== resolvedName) {
                db.query('UPDATE server_businesses SET name = ? WHERE id = ?', [resolvedName, businessId]);
            }

            if (!sanitizePropertyAddress(row.address)) {
                db.query('UPDATE server_businesses SET address = ? WHERE id = ?', [resolvedAddress, businessId]);
            }

            if (normalizeBusinessType(row.business_type) !== normalizedType) {
                db.query('UPDATE server_businesses SET business_type = ? WHERE id = ?', [normalizedType, businessId]);
            }
        });

        businessesLoaded = true;
        console.log(`[BUSINESS] Loaded ${businessesById.size} businesses.`);
    });
}

function getBusinessById(businessIdRaw) {
    const businessId = parseInt(businessIdRaw, 10);
    if (!Number.isFinite(businessId)) return null;
    return businessesById.get(businessId) || null;
}

function getNearbyBusiness(player, radius = BUSINESS_INTERACT_RADIUS) {
    if (!player || !player.position || Number(player.dimension) !== 0) return null;

    let closest = null;
    let closestDistance = Number(radius);

    businessesById.forEach((business) => {
        const distance = getDistanceBetweenPositions(player.position, business.entryPos);
        if (distance <= closestDistance) {
            closestDistance = distance;
            closest = business;
        }

        function getNearbyBusinessByInteractRadius(player, maxRadius = BUSINESS_INTERACT_RADIUS_MAX) {
            if (!player || !player.position || Number(player.dimension) !== 0) return null;

            const searchRadius = sanitizeBusinessInteractRadius(maxRadius);
            let closest = null;
            let closestDistance = Number.POSITIVE_INFINITY;

            businessesById.forEach((business) => {
                const distance = getDistanceBetweenPositions(player.position, business.entryPos);
                const businessRadius = getBusinessInteractRadius(business);
                if (distance > searchRadius || distance > businessRadius) return;
                if (distance <= closestDistance) {
                    closestDistance = distance;
                    closest = business;
                }
            });

            return closest;
        }
    });

    return closest;
}

function getNearbyStatic247ShopRegister(player, radius = SHOP_REGISTER_INTERACT_RADIUS) {
    if (!player || !player.position || Number(player.dimension) !== 0) return null;

    let closest = null;
    let closestDistance = Number(radius);

    STATIC_247_SHOP_REGISTERS.forEach((registerPos) => {
        const distance = getDistanceBetweenPositions(player.position, registerPos);
        if (distance <= closestDistance) {
            closestDistance = distance;
            closest = registerPos;
        }
    });

    return closest;
}

function sanitizeFuelLevel(rawFuel) {
    const value = Number(rawFuel);
    if (!Number.isFinite(value)) return VEHICLE_FUEL_MAX;
    return Math.max(0, Math.min(VEHICLE_FUEL_MAX, Math.round(value * 100) / 100));
}

function hasPhoneSim(player) {
    if (!player) return false;
    const value = String(player.phoneNumber || '').trim();
    return /^\d{6,15}$/.test(value);
}

function requirePhoneSim(player) {
    if (hasPhoneSim(player)) return true;
    if (player && typeof player.outputChatBox === 'function') {
        player.outputChatBox('!{#e74c3c}Jums reikia SIM korteles. Nusipirkite ja 24/7 su /buy simcard.');
    }
    return false;
}

function generateUniquePhoneNumber(callback, attempt = 0) {
    const maxAttempts = 20;
    if (attempt >= maxAttempts) {
        callback(new Error('Failed to generate unique phone number after max attempts.'), null);
        return;
    }

    const generated = `86${Math.floor(100000 + (Math.random() * 900000))}`;
    db.query('SELECT id FROM characters WHERE phone_number = ? LIMIT 1', [generated], (err, rows) => {
        if (err) {
            callback(err, null);
            return;
        }

        if (rows && rows.length > 0) {
            generateUniquePhoneNumber(callback, attempt + 1);
            return;
        }

        callback(null, generated);
    });
}

function normalizeBankAccountNumber(inputRaw) {
    const digits = String(inputRaw || '').replace(/\D+/g, '');
    if (digits.length !== BANK_ACCOUNT_NUMBER_LENGTH) return null;
    return digits;
}

function generateUniqueBankAccountNumber(callback, attempt = 0) {
    const maxAttempts = 30;
    if (attempt >= maxAttempts) {
        callback(new Error('Failed to generate unique bank account number after max attempts.'), null);
        return;
    }

    const prefix = '47';
    const suffixLength = BANK_ACCOUNT_NUMBER_LENGTH - prefix.length;
    const suffix = Math.floor(Math.random() * (10 ** suffixLength)).toString().padStart(suffixLength, '0');
    const accountNumber = `${prefix}${suffix}`;

    db.query('SELECT char_name FROM bank_accounts WHERE account_number = ? LIMIT 1', [accountNumber], (err, rows) => {
        if (err) {
            callback(err, null);
            return;
        }

        if (rows && rows.length > 0) {
            generateUniqueBankAccountNumber(callback, attempt + 1);
            return;
        }

        callback(null, accountNumber);
    });
}

function isNearGasStation(player, radius = GAS_STATION_REFILL_RADIUS) {
    if (!player || !player.position || Number(player.dimension) !== 0) return false;
    return GAS_STATION_REFILL_POINTS.some((point) => getDistanceBetweenPositions(player.position, point) <= Number(radius));
}

function getPlayerCurrentBusiness(player) {
    if (!player) return null;

    const currentBusinessId = parseInt(player.currentBusinessId, 10);
    if (Number.isFinite(currentBusinessId)) {
        const byId = businessesById.get(currentBusinessId);
        if (byId) return byId;
    }

    if (Number(player.dimension) <= 0) return null;

    for (const business of businessesById.values()) {
        if (Number(business.dimension) === Number(player.dimension)) {
            return business;
        }
    }

    return null;
}

function movePlayerIntoBusiness(player, business) {
    if (!player || !business) return;

    player.dimension = business.dimension;
    player.position = business.interiorPos;
    player.heading = Number.isFinite(business.interiorHeading) ? business.interiorHeading : 0;
    player.currentBusinessId = business.id;
    player.currentPropertyId = null;
}

function movePlayerOutOfBusiness(player, business) {
    if (!player || !business) return;

    player.dimension = 0;
    player.position = business.entryPos;
    player.heading = Number.isFinite(business.entryHeading) ? business.entryHeading : 0;
    player.currentBusinessId = null;
}

function isBusinessOwner(player, business) {
    if (!player || !business || !player.charId) return false;
    return Number(player.charId) === Number(business.ownerCharId);
}

function getOwnedBusinessContext(player) {
    if (!player || !player.charId) return null;

    const currentBusiness = getPlayerCurrentBusiness(player);
    if (currentBusiness && isBusinessOwner(player, currentBusiness)) {
        return currentBusiness;
    }

    const nearbyBusiness = getNearbyBusiness(player, 12.0);
    if (nearbyBusiness && isBusinessOwner(player, nearbyBusiness)) {
        return nearbyBusiness;
    }

    return null;
}

function getClosestEnterTarget(player) {
    const nearbyProperty = propertiesLoaded ? getNearbyProperty(player, PROPERTY_INTERACT_RADIUS) : null;
    const nearbyBusiness = businessesLoaded ? getNearbyBusiness(player, BUSINESS_INTERACT_RADIUS) : null;

    if (!nearbyProperty && !nearbyBusiness) {
        return null;
    }

    if (nearbyProperty && !nearbyBusiness) {
        return { kind: 'property', target: nearbyProperty };
    }

    if (nearbyBusiness && !nearbyProperty) {
        return { kind: 'business', target: nearbyBusiness };
    }

    const propertyDistance = getDistanceBetweenPositions(player.position, nearbyProperty.entryPos);
    const businessDistance = getDistanceBetweenPositions(player.position, nearbyBusiness.entryPos);

    if (businessDistance < propertyDistance) {
        return { kind: 'business', target: nearbyBusiness };
    }

    return { kind: 'property', target: nearbyProperty };
}

function persistPlayerMoney(player) {
    if (!player || !player.charId) return;

    player.call('updateMoneyHUD', [player.money || 0]);
    db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money || 0, player.charId], (err) => {
        if (err) {
            console.error('[MONEY] Failed to save player money:', err.message);
        }
    });
}

function cleanupDMVTest(player, notifyClient = true) {
    if (!player) return;

    const state = activeDMVTests.get(player.id);
    if (state && state.checkTimer) {
        clearInterval(state.checkTimer);
    }

    if (state && state.vehicle) {
        try {
            if (player.vehicle === state.vehicle) {
                player.removeFromVehicle();
            }
        } catch (e) { }

        try {
            state.vehicle.destroy();
        } catch (e) {
            console.error('[DMV] Failed to destroy test vehicle:', e.message);
        }
    }

    activeDMVTests.delete(player.id);
    if (notifyClient) {
        try { player.call('stopDMVRoute'); } catch (e) { }
    }
}

function isPlayerNearDMV(player) {
    return Boolean(player && player.position && Number(player.dimension) === 0
        && getDistanceBetweenPositions(player.position, DMV_PICKUP_POS) <= DMV_INTERACT_RADIUS);
}

function startDMVPracticalTest(player) {
    cleanupDMVTest(player, true);

    const modelHash = typeof mp.joaat === 'function' ? mp.joaat(DMV_TEST_VEHICLE_MODEL) : DMV_TEST_VEHICLE_MODEL;
    const vehicle = mp.vehicles.new(modelHash, DMV_TEST_SPAWN_POS, {
        heading: DMV_TEST_SPAWN_HEADING,
        dimension: player.dimension || 0,
    });

    vehicle.isDMVTestVehicle = true;
    vehicle.numberPlate = `DMV${String(player.id).padStart(3, '0')}`.slice(0, 8);
    vehicle.engine = true;
    vehicle.locked = false;
    try { vehicle.setVariable('isDMVTestVehicle', true); } catch (e) { }
    try { vehicle.setVariable('manualEngineOn', 1); } catch (e) { }
    try { vehicle.setVariable('fuelLevel', 100); } catch (e) { }

    activeDMVTests.set(player.id, {
        phase: 'practical',
        vehicle,
        checkpointIndex: 0,
        startedAt: Date.now(),
    });

    try {
        player.putIntoVehicle(vehicle, 0);
    } catch (e) {
        console.error('[DMV] Failed to put player into test vehicle:', e.message);
    }

    [150, 500, 1100].forEach((delay) => setTimeout(() => {
        try {
            if (vehicle && vehicle.handle) {
                vehicle.engine = true;
                vehicle.setVariable('manualEngineOn', 1);
            }
            if (vehicle && vehicle.handle && (!player.vehicle || player.vehicle !== vehicle || !(player.seat === -1 || player.seat === 0))) {
                player.putIntoVehicle(vehicle, 0);
            }
        } catch (e) { }
    }, delay));

    player.call('startDMVRoute', [JSON.stringify(DMV_ROUTE_POINTS)]);
    player.outputChatBox('!{#85c1e9}DMV praktinis testas pradetas. Vaziuokite per pazymetus checkpointus.');

    const state = activeDMVTests.get(player.id);
    if (state) {
        state.checkTimer = setInterval(() => {
            const currentState = activeDMVTests.get(player.id);
            if (!currentState || currentState.phase !== 'practical') {
                clearInterval(state.checkTimer);
                return;
            }

            if (Date.now() - currentState.startedAt < 8000) return;

            if (player.vehicle !== currentState.vehicle) {
                failDMVPracticalTest(player, 'DMV praktinis testas neislaikytas, nes palikote testo automobili. Norint bandyti vel, reikes moketi is naujo.');
            }
        }, 1500);
    }
}

function failDMVPracticalTest(player, message) {
    cleanupDMVTest(player, true);
    if (player && message) {
        player.outputChatBox(`!{#e74c3c}${message}`);
    }
}

function completeDMVTest(player) {
    player.hasDriversLicense = true;
    db.query('UPDATE characters SET drivers_license = 1 WHERE id = ?', [player.charId], (err) => {
        if (err) {
            console.error('[DMV] Failed to save drivers_license:', err.message);
        }
    });

    cleanupDMVTest(player, true);
    player.outputChatBox('!{#7aa164}Sveikiname! Islaikete DMV testa ir gavote vairuotojo pazymejima.');
}

function getBusinessProductList(business) {
    const definition = business ? getBusinessTypeDefinition(business.type) : null;
    return Array.isArray(definition?.products) ? definition.products : [];
}

function getBusinessProduct(business, productRaw) {
    const normalizedType = normalizeInventoryItemType(productRaw) || String(productRaw || '').trim().toLowerCase();
    return getBusinessProductList(business).find(product => product.key === normalizedType || product.itemType === normalizedType) || null;
}

function getPawnShopBusinessForPlayer(player) {
    const currentBusiness = getPlayerCurrentBusiness(player);
    if (isPawnShopBusiness(currentBusiness)) return currentBusiness;

    const nearbyBusiness = getNearbyBusinessByInteractRadius(player, BUSINESS_INTERACT_RADIUS_MAX);
    if (isPawnShopBusiness(nearbyBusiness)) return nearbyBusiness;

    return null;
}

function isPawnShopBusiness(business) {
    return Boolean(business && normalizeBusinessType(business.type) === 'pawn_shop');
}

function isPawnableInventoryItem(item) {
    if (!item || !item.type) return false;
    const definition = INVENTORY_ITEM_DEFS[item.type];
    return Boolean(definition && definition.pawnItem);
}

function getPawnOriginalPrice(item) {
    if (!item || !item.type) return 0;
    const definition = INVENTORY_ITEM_DEFS[item.type] || {};
    return Math.max(0, parseInt(item.originalPrice ?? definition.originalPrice ?? 0, 10) || 0);
}

function parseBusinessPawnInventory(rawInventory) {
    if (!rawInventory) return [];

    try {
        const parsed = typeof rawInventory === 'string' ? JSON.parse(rawInventory) : rawInventory;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((rawItem) => {
                if (!rawItem) return null;
                const type = normalizeInventoryItemType(rawItem.type) || String(rawItem.type || '').trim().toLowerCase();
                const definition = INVENTORY_ITEM_DEFS[type];
                if (!definition || !definition.pawnItem) return null;

                const originalPrice = Math.max(1, parseInt(rawItem.originalPrice ?? definition.originalPrice ?? 1, 10) || 1);
                const defaultSalePrice = Math.max(1, Math.floor(originalPrice));
                return {
                    stockId: String(rawItem.stockId || generateInventoryItemId()),
                    type,
                    name: sanitizeInventoryItemName(rawItem.name, definition.name),
                    description: rawItem.description || definition.description,
                    icon: definition.icon || 'BOX',
                    originalPrice,
                    buyPrice: Math.max(1, parseInt(rawItem.buyPrice, 10) || Math.floor(originalPrice * PAWN_AUTO_SELL_RATE)),
                    price: Math.max(1, parseInt(rawItem.price, 10) || defaultSalePrice),
                    sellerCharName: rawItem.sellerCharName || '',
                    soldAt: rawItem.soldAt || new Date().toISOString(),
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error('[PAWN] Failed to parse pawn inventory:', error.message);
        return [];
    }
}

function getBusinessPawnInventoryJson(business) {
    return JSON.stringify(Array.isArray(business?.pawnInventory) ? business.pawnInventory : []);
}

function persistBusinessPawnInventory(business) {
    if (!business || !business.id) return;

    db.query('UPDATE server_businesses SET pawn_inventory = ? WHERE id = ?', [getBusinessPawnInventoryJson(business), business.id], (err) => {
        if (err) {
            console.error('[PAWN] Failed to persist pawn inventory:', err.message);
        }
    });
}

function findPawnStockItem(business, stockIdRaw) {
    if (!business || !Array.isArray(business.pawnInventory)) return null;
    const stockId = String(stockIdRaw || '').trim();
    if (!stockId) return null;
    const index = business.pawnInventory.findIndex(item => item && item.stockId === stockId);
    if (index === -1) return null;
    return { index, item: business.pawnInventory[index] };
}

function buildPawnShopPayload(player, business) {
    const stock = (Array.isArray(business?.pawnInventory) ? business.pawnInventory : [])
        .map((item) => ({
            stockId: item.stockId,
            type: item.type,
            name: item.name,
            icon: item.icon || item.type || 'BOX',
            price: Math.max(1, parseInt(item.price, 10) || 1),
            originalPrice: Math.max(1, parseInt(item.originalPrice, 10) || 1),
        }));

    return JSON.stringify({
        businessName: business?.name || 'Lombardas',
        money: Math.max(0, parseInt(player?.money, 10) || 0),
        stock,
    });
}

function openPawnShopForPlayer(player, business, statusText = '', success = true, updateOnly = false) {
    if (!player || !business) return;
    const eventName = updateOnly ? 'updatePawnShopUI' : 'openPawnShopUI';
    player.call(eventName, [buildPawnShopPayload(player, business), statusText, Boolean(success)]);
}

function getPropertyRoleForPlayer(player, property) {
    if (!player || !property) return 'guest';
    if (isPropertyOwner(player, property)) return 'owner';
    if (isPropertyTenant(player, property)) return 'tenant';
    return 'guest';
}

function removeExpiredRentOffer(targetPlayerId, offer) {
    const existing = pendingRentOffers.get(targetPlayerId);
    if (!existing || existing.createdAt !== offer.createdAt) return;
    pendingRentOffers.delete(targetPlayerId);
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

    // Use loose numeric comparison - getVariable may return string or number.
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
    // Do NOT use getPedInSeat - it returns a raw ped handle, not the player object.
    return player.vehicle === vehicle && (player.seat === -1 || player.seat === 0);
}

function isVehicleSeatOccupied(vehicle, seat) {
    if (!vehicle || !vehicle.handle) return false;

    return mp.players.toArray().some(otherPlayer => (
        otherPlayer
        && otherPlayer.vehicle === vehicle
        && Number(otherPlayer.seat) === Number(seat)
    ));
}

function getClosestVehicleForPlayer(player, maxDistance = 6.5) {
    if (!player || !player.position) return null;

    let closestVehicle = null;
    let closestDistance = maxDistance;

    mp.vehicles.forEach((vehicle) => {
        if (!vehicle || !vehicle.handle) return;
        if (Number(vehicle.dimension || 0) !== Number(player.dimension || 0)) return;

        const distanceToVehicle = getDistanceBetweenPositions(player.position, vehicle.position);
        if (distanceToVehicle <= closestDistance) {
            closestDistance = distanceToVehicle;
            closestVehicle = vehicle;
        }
    });

    return closestVehicle;
}

function getVehicleByEntityId(vehicleId) {
    const parsedVehicleId = parseInt(vehicleId, 10);
    if (!Number.isFinite(parsedVehicleId)) return null;

    let foundVehicle = null;
    mp.vehicles.forEach((vehicle) => {
        if (foundVehicle || !vehicle || !vehicle.handle) return;
        if (Number(vehicle.id) === parsedVehicleId) {
            foundVehicle = vehicle;
        }
    });

    return foundVehicle;
}

mp.events.add('requestPassengerSeatEnter', (player, vehicleId, requestedSeat) => {
    if (!player || player.vehicle) return;

    let preferredSeat = parseInt(requestedSeat, 10);
    if (!Number.isFinite(preferredSeat) || preferredSeat < 0 || preferredSeat > 6) {
        preferredSeat = null;
    }

    let vehicle = getVehicleByEntityId(vehicleId);

    if (!vehicle || !vehicle.handle) {
        vehicle = getClosestVehicleForPlayer(player, 6.5);
    }

    if (!vehicle || !vehicle.handle) {
        return;
    }

    const distanceToVehicle = getDistanceBetweenPositions(player.position, vehicle.position);
    if (distanceToVehicle > 6.5) {
        return;
    }

    if (vehicle.locked) {
        player.outputChatBox('!{#e74c3c}Transporto priemone yra uzrakinta.');
        return;
    }

    // Keep preferred seat as a hint only; seat correction runs after entry.

    player.pendingPassengerSeat = preferredSeat;
    player.pendingPassengerSeatVehicleId = Number(vehicle.id);
    player.pendingPassengerSeatAttempts = 0;
});

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
    entity.setVariable('fuelLevel', sanitizeFuelLevel(record.fuel));
    setVehicleWeaponStash(entity, record.weaponInventory || []);

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

function setOwnedVehicleFuel(record, fuelLevel, syncEntity = true) {
    if (!record) return;
    const sanitized = sanitizeFuelLevel(fuelLevel);
    record.fuel = sanitized;

    if (syncEntity && record.entity && record.entity.handle && typeof record.entity.setVariable === 'function') {
        record.entity.setVariable('fuelLevel', sanitized);
    }
}

function persistOwnedVehicleState(record) {
    if (!record || !record.id) return;
    db.query(
        'UPDATE player_vehicles SET parked = ?, park_x = ?, park_y = ?, park_z = ?, park_h = ?, locked = ?, primary_color = ?, secondary_color = ?, fuel = ?, weapon_inventory = ? WHERE id = ?',
        [
            record.parked ? 1 : 0,
            record.parkX,
            record.parkY,
            record.parkZ,
            record.parkH,
            record.locked ? 1 : 0,
            parseVehicleColorIndex(record.primaryColor),
            parseVehicleColorIndex(record.secondaryColor),
            sanitizeFuelLevel(record.fuel),
            getVehicleWeaponInventoryJson(record),
            record.id,
        ]
    );
}

function clearOwnedVehicleBlipForPlayer(player) {
    if (!player || !player.call) return;
    player.call('clearOwnedVehicleBlip');
}

function clearOwnedPropertyBlipForPlayer(player) {
    if (!player || !player.call) return;
    player.call('clearOwnedPropertyBlip');
}

function showOwnedPropertyBlipForPlayer(player, property) {
    if (!player || !player.call || !property || !property.entryPos) return;
    player.call('showOwnedPropertyBlip', [Number(property.id), property.entryPos.x, property.entryPos.y, property.entryPos.z, getLocalizedPropertyName(property.id)]);
}

function ensureOwnedPropertyBlipsForPlayer(player) {
    if (!player || !player.call || !player.charId) return;
    for (const property of propertiesById.values()) {
        if (Number(property.ownerCharId) === Number(player.charId)) {
            showOwnedPropertyBlipForPlayer(player, property);
        }
    }
}

function showOwnedVehicleBlipForPlayer(player, record, position) {
    if (!player || !player.call || !record || !position) return;

    player.call('showOwnedVehicleBlip', [
        position.x,
        position.y,
        position.z,
        `${record.displayName} (${record.id})`,
    ]);
}

function parkOwnedVehicle(record, parkPos, parkHeading = DEALERSHIP_DELIVERY_HEADING, ownerPlayer = null) {
    if (!record) return;
    if (!parkPos) {
        parkPos = new mp.Vector3(DEALERSHIP_DELIVERY_POS.x, DEALERSHIP_DELIVERY_POS.y, DEALERSHIP_DELIVERY_POS.z);
    }
    record.parked = 1;
    record.parkX = parkPos.x;
    record.parkY = parkPos.y;
    record.parkZ = parkPos.z;
    record.parkH = parkHeading;
    clearOwnedVehicleBlipForPlayer(ownerPlayer);
    record.blip = null;

    if (record.entity) {
        record.weaponInventory = getVehicleWeaponStash(record.entity);
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
            clearOwnedVehicleBlipForPlayer(player);
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

    clearOwnedVehicleBlipForPlayer(player);

    player.ownedVehicles.forEach((record) => {
        if (!record) return;
        vehicleFuelRuntimeState.delete(Number(record.id));
        record.blip = null;
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

            record.weaponInventory = getVehicleWeaponStash(record.entity);
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
                fuel: sanitizeFuelLevel(row.fuel),
                parked: row.parked,
                parkX: row.park_x,
                parkY: row.park_y,
                parkZ: row.park_z,
                parkH: row.park_h,
                locked: row.locked,
                plate: row.plate,
                weaponInventory: parseVehicleWeaponInventory(row.weapon_inventory),
                entity: null,
                blip: null,
            };

            if (!Number.isFinite(Number(row.fuel))) {
                db.query('UPDATE player_vehicles SET fuel = ? WHERE id = ?', [record.fuel, record.id]);
            }

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

function sanitizeInventoryItemName(nameRaw, fallback = 'Daiktas') {
    const name = String(nameRaw || '').replace(/\s+/g, ' ').trim();
    return (name || fallback).slice(0, 64);
}

function createInventoryItem(type, quantity = 1, existingId = null, overrides = {}) {
    const definition = INVENTORY_ITEM_DEFS[type];
    if (!definition) return null;

    const itemName = sanitizeInventoryItemName(overrides.name, definition.name);
    const originalPrice = Math.max(0, parseInt(overrides.originalPrice ?? definition.originalPrice ?? 0, 10) || 0);

    return {
        id: existingId || generateInventoryItemId(),
        type,
        name: itemName,
        description: overrides.description || definition.description,
        icon: definition.icon || 'BOX',
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        usable: definition.usable !== false,
        droppable: definition.droppable !== false,
        giveable: definition.giveable !== false,
        stackable: definition.stackable !== false,
        pawnItem: Boolean(definition.pawnItem),
        originalPrice,
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
    const uniqueItems = [];

    items.forEach((rawItem) => {
        if (!rawItem) return;

        const type = typeof rawItem.type === 'string' ? rawItem.type.toLowerCase() : '';
        const normalized = createInventoryItem(type, rawItem.quantity, rawItem.id, {
            name: rawItem.name,
            description: rawItem.description,
            originalPrice: rawItem.originalPrice,
        });
        if (!normalized) return;

        if (!normalized.stackable || normalized.name !== INVENTORY_ITEM_DEFS[normalized.type].name) {
            normalized.quantity = 1;
            uniqueItems.push(normalized);
            return;
        }

        if (merged.has(normalized.type)) {
            merged.get(normalized.type).quantity += normalized.quantity;
            return;
        }

        merged.set(normalized.type, normalized);
    });

    return [...Array.from(merged.values()), ...uniqueItems];
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

function findInventoryItemByToken(player, tokenRaw) {
    if (!player || !Array.isArray(player.inventory)) return null;
    const token = String(tokenRaw || '').trim();
    if (!token) return null;

    const exact = getInventoryItemById(player, token);
    if (exact) return exact;

    const lowered = token.toLowerCase();
    const normalizedType = normalizeInventoryItemType(lowered) || lowered;
    const index = player.inventory.findIndex(item => {
        if (!item) return false;
        return String(item.id || '').endsWith(token)
            || String(item.type || '').toLowerCase() === normalizedType;
    });

    if (index === -1) return null;
    return {
        index,
        item: player.inventory[index],
    };
}

function addInventoryItem(player, type, amount, overrides = {}) {
    if (!player || !Array.isArray(player.inventory)) return null;

    const quantity = Math.max(1, parseInt(amount, 10) || 1);
    const definition = INVENTORY_ITEM_DEFS[type];
    if (!definition) return null;

    const shouldStack = definition.stackable !== false && !overrides.name;
    if (shouldStack) {
        const existingItem = player.inventory.find(item => item.type === type && item.stackable !== false && item.name === definition.name);
        if (!existingItem) {
            const item = createInventoryItem(type, quantity);
            if (item) player.inventory.push(item);
            return item;
        }

        existingItem.quantity += quantity;
        return existingItem;
    }

    let firstItem = null;
    for (let i = 0; i < quantity; i++) {
        const item = createInventoryItem(type, 1, null, overrides);
        if (item) {
            player.inventory.push(item);
            if (!firstItem) firstItem = item;
        }
    }

    return firstItem;
}

function addExistingInventoryItem(player, sourceItem, amount = 1) {
    if (!player || !Array.isArray(player.inventory) || !sourceItem) return null;

    const type = normalizeInventoryItemType(sourceItem.type) || String(sourceItem.type || '').trim().toLowerCase();
    if (!INVENTORY_ITEM_DEFS[type]) return null;

    return addInventoryItem(player, type, amount, {
        name: sourceItem.name,
        description: sourceItem.description,
        originalPrice: sourceItem.originalPrice,
    });
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

function clearPlayerDrugEffectTimers(player) {
    if (!player || !Array.isArray(player.drugEffectTimers)) return;

    player.drugEffectTimers.forEach((timer) => {
        if (!timer) return;
        if (timer.type === 'interval') clearInterval(timer.id);
        else clearTimeout(timer.id);
    });
    player.drugEffectTimers = [];
}

function trackDrugEffectTimer(player, id, type) {
    if (!player) return;
    if (!Array.isArray(player.drugEffectTimers)) player.drugEffectTimers = [];
    player.drugEffectTimers.push({ id, type });
}

function untrackDrugEffectTimer(player, id) {
    if (!player || !Array.isArray(player.drugEffectTimers)) return;
    player.drugEffectTimers = player.drugEffectTimers.filter(timer => timer && timer.id !== id);
}

function startDrugInventoryEffect(player, item) {
    const drugDef = DRUG_EFFECT_DEFS[item.type];
    if (!player || !player.charName || !drugDef) return false;

    const itemName = item.name || INVENTORY_ITEM_DEFS[item.type].name;

    const delayTimer = setTimeout(() => {
        untrackDrugEffectTimer(player, delayTimer);

        if (!player || !player.charName || player.isDowned) return;

        player.outputChatBox(`!{#b58cff}${itemName} pradeda veikti.`);
        player.call('playDrugVisualEffect', [drugDef.effect, itemName, DRUG_VISUAL_EFFECT_DURATION_MS]);
    }, DRUG_EFFECT_DELAY_MS);

    trackDrugEffectTimer(player, delayTimer, 'timeout');
    return true;
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

function getCurrentHoldableWeaponHash(player) {
    if (!player) return null;
    const currentWeapon = Number(player.weapon);
    if (!Number.isFinite(currentWeapon) || currentWeapon === 0) return null;
    if (currentWeapon === WEAPON_UNARMED_HASH) return null;
    return currentWeapon;
}

function resolveWeaponHash(inputWeapon) {
    if (inputWeapon === undefined || inputWeapon === null) return null;

    const raw = String(inputWeapon).trim().toLowerCase();
    if (!raw) return null;

    const numericHash = Number(raw);
    if (Number.isFinite(numericHash) && numericHash !== 0) {
        return Math.trunc(numericHash);
    }

    const normalized = raw.startsWith('weapon_') ? raw.slice(7) : raw;
    const modelName = WEAPON_NAME_TO_MODEL[normalized] || `weapon_${normalized}`;

    if (typeof mp.joaat !== 'function') return null;
    return mp.joaat(modelName);
}

function getWeaponLabel(weaponHash) {
    const hash = Number(weaponHash);
    if (!Number.isFinite(hash)) return 'Unknown Weapon';
    return WEAPON_HASH_TO_LABEL[hash] || `Weapon hash ${hash}`;
}

function sanitizeWeaponHash(weaponHash) {
    const hash = Number(weaponHash);
    if (!Number.isFinite(hash) || hash === 0 || hash === WEAPON_UNARMED_HASH) return null;
    return Math.trunc(hash);
}

function parseVehicleWeaponInventory(rawInventory) {
    if (rawInventory === null || rawInventory === undefined || rawInventory === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(rawInventory);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((entry) => {
                if (!entry) return null;
                const weaponHash = sanitizeWeaponHash(entry.weaponHash);
                if (!weaponHash) return null;
                return {
                    weaponHash,
                    label: getWeaponLabel(weaponHash),
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error('[WEAPONS] Failed to parse vehicle weapon inventory JSON:', error.message);
        return [];
    }
}

function getVehicleWeaponInventoryJson(record) {
    if (!record || !Array.isArray(record.weaponInventory)) return '[]';

    return JSON.stringify(
        record.weaponInventory
            .map((entry) => ({
                weaponHash: sanitizeWeaponHash(entry && entry.weaponHash),
            }))
            .filter(entry => entry.weaponHash)
    );
}

function getVehicleWeaponStash(vehicle) {
    if (!vehicle || !vehicle.getVariable) return [];
    try {
        const raw = vehicle.getVariable('weaponStash');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((entry) => {
                const weaponHash = sanitizeWeaponHash(entry && entry.weaponHash);
                if (!weaponHash) return null;
                return { weaponHash, label: getWeaponLabel(weaponHash) };
            })
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

function setVehicleWeaponStash(vehicle, inventory) {
    if (!vehicle || !vehicle.setVariable) return;
    const json = JSON.stringify(
        (Array.isArray(inventory) ? inventory : [])
            .map((e) => ({ weaponHash: sanitizeWeaponHash(e && e.weaponHash) }))
            .filter((e) => e.weaponHash)
    );
    vehicle.setVariable('weaponStash', json);
}

function persistVehicleWeaponStash(vehicle) {
    if (!vehicle || !vehicle.getVariable) return;
    const ownedVehicleId = vehicle.getVariable('ownedVehicleId');
    if (!ownedVehicleId) return;
    const stash = getVehicleWeaponStash(vehicle);
    const json = JSON.stringify(
        stash.map((e) => ({ weaponHash: sanitizeWeaponHash(e && e.weaponHash) })).filter((e) => e.weaponHash)
    );
    db.query('UPDATE player_vehicles SET weapon_inventory = ? WHERE id = ?', [json, ownedVehicleId], (err) => {
        if (err) console.error('[WEAPONS] Failed to persist vehicle weapon stash:', err.message);
    });
}

function parseWeaponPackage(rawPackage) {
    if (rawPackage === null || rawPackage === undefined || rawPackage === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(rawPackage);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((entry) => {
                const weaponHash = sanitizeWeaponHash(entry && entry.weaponHash);
                if (!weaponHash) return null;
                return {
                    weaponHash,
                    label: getWeaponLabel(weaponHash),
                };
            })
            .filter(Boolean)
            .slice(0, WEAPON_PACKAGE_LIMIT);
    } catch (error) {
        console.error('[WEAPONS] Failed to parse weapon package JSON:', error.message);
        return [];
    }
}

function getWeaponPackageJson(player) {
    if (!player || !Array.isArray(player.weaponPackageWeapons)) return '[]';

    return JSON.stringify(
        player.weaponPackageWeapons
            .map((entry) => ({
                weaponHash: sanitizeWeaponHash(entry && entry.weaponHash),
            }))
            .filter(entry => entry.weaponHash)
            .slice(0, WEAPON_PACKAGE_LIMIT)
    );
}

function persistWeaponPackage(player) {
    if (!player || !player.charId) return;

    db.query('UPDATE characters SET weapon_package = ? WHERE id = ?', [getWeaponPackageJson(player), player.charId], (err) => {
        if (err) {
            console.error('[WEAPONS] Failed to save weapon package:', err.message);
        }
    });
}

function getEquippedWeaponAmmo(player, expectedWeaponHash = null) {
    if (!player) {
        return null;
    }

    const expectedHash = sanitizeWeaponHash(expectedWeaponHash);

    // Prefer client-tracked weapon ammo (most reliable)
    if (Number.isFinite(player.trackedWeaponAmmo)
        && (!expectedHash || Number(player.trackedWeaponHash) === expectedHash)) {
        return player.trackedWeaponAmmo;
    }

    // Fallback: try server API
    const currentWeapon = Number(player.weapon);

    if (!Number.isFinite(currentWeapon) || currentWeapon === 0 || currentWeapon === WEAPON_UNARMED_HASH) {
        return player.currentWeaponAmmo || null;
    }

    try {
        // Try to get current ammo from player API
        if (typeof player.getWeaponAmmo === 'function') {
            const ammo = player.getWeaponAmmo(currentWeapon);
            if (Number.isFinite(ammo)) {
                return ammo;
            }
        }
    } catch (err) {
        console.error('[WEAPONS] Error getting weapon ammo:', err.message);
    }

    // Fallback to saved ammo from DB
    const savedAmmo = player.savedEquippedWeaponAmmo;
    if (Number.isFinite(savedAmmo)) {
        return savedAmmo;
    }

    return null;
}

function persistEquippedWeapon(player) {
    if (!player || !player.charId) return;

    const equippedWeaponHash = sanitizeWeaponHash(getCurrentHoldableWeaponHash(player))
        || sanitizeWeaponHash(player.savedEquippedWeaponHash)
        || null;

    let equippedWeaponAmmo = null;
    if (equippedWeaponHash) {
        const currentAmmo = getEquippedWeaponAmmo(player);
        equippedWeaponAmmo = (Number.isFinite(currentAmmo)) ? currentAmmo : DEFAULT_WEAPON_AMMO;
    }

    player.savedEquippedWeaponHash = equippedWeaponHash;
    player.savedEquippedWeaponAmmo = equippedWeaponAmmo;

    console.log(`[WEAPONS] Persisting weapon hash=${equippedWeaponHash} ammo=${equippedWeaponAmmo} for player ${player.charName}`);

    db.query('UPDATE characters SET equipped_weapon_hash = ?, equipped_weapon_ammo = ? WHERE id = ?',
        [equippedWeaponHash, equippedWeaponAmmo, player.charId], (err) => {
            if (err) {
                console.error('[WEAPONS] Failed to save equipped weapon:', err.message);
            } else {
                console.log(`[WEAPONS] Weapon persisted successfully for ${player.charName}`);
            }
        });
}

function checkAndRemoveEmptyWeapons(player) {
    if (!player || !player.weapon) return;

    const currentWeapon = Number(player.weapon);
    if (!Number.isFinite(currentWeapon) || currentWeapon === 0 || currentWeapon === WEAPON_UNARMED_HASH) return;

    try {
        // In RAGE MP, we need to check if ammo is 0 for the current weapon
        // If getAmmo is available, use it; otherwise the client will handle removal
        if (typeof player.getWeaponAmmo === 'function') {
            const ammo = player.getWeaponAmmo(currentWeapon);
            if (ammo === 0) {
                const weaponLabel = getWeaponLabel(currentWeapon);
                setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
                persistEquippedWeapon(player);
                player.outputChatBox(`!{#e74c3c}${weaponLabel} baigesi kulkos ir buvo panaikintas.`);
            }
        }
    } catch (err) {
        // Silently ignore errors in ammo checks
    }
}

function setSingleWeaponForPlayer(player, weaponHash, ammo = DEFAULT_WEAPON_AMMO) {
    if (!player) return false;

    if (typeof player.removeAllWeapons === 'function') {
        player.removeAllWeapons();
    }

    const targetHash = Number(weaponHash);
    if (!Number.isFinite(targetHash) || targetHash === 0 || targetHash === WEAPON_UNARMED_HASH) {
        player.savedEquippedWeaponHash = null;
        player.savedEquippedWeaponAmmo = null;
        player.currentWeaponAmmo = null;
        player.trackedWeaponHash = null;
        player.trackedWeaponAmmo = null;
        if (typeof player.weapon !== 'undefined') {
            player.weapon = WEAPON_UNARMED_HASH;
        }
        return true;
    }

    if (typeof player.giveWeapon !== 'function') {
        return false;
    }

    const safeAmmo = Math.max(1, parseInt(ammo, 10) || DEFAULT_WEAPON_AMMO);
    player.giveWeapon(targetHash, safeAmmo);
    player.weapon = targetHash;
    player.savedEquippedWeaponHash = sanitizeWeaponHash(targetHash);
    player.savedEquippedWeaponAmmo = safeAmmo;
    player.currentWeaponAmmo = safeAmmo;  // Track current ammo
    player.trackedWeaponHash = targetHash;  // Track weapon hash
    player.trackedWeaponAmmo = safeAmmo;  // Track from server too
    console.log(`[WEAPONS] setSingleWeaponForPlayer: ${targetHash} with ${safeAmmo} ammo`);
    return true;
}


const db = mysql.createPool({
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gtav'
});

function bootstrapDatabase() {
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

    db.query('ALTER TABLE characters ADD COLUMN equipped_weapon_hash INT NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[WEAPONS] Failed to add equipped_weapon_hash column:', err.message);
        } else {
            console.log('[WEAPONS] equipped_weapon_hash column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN weapon_package TEXT NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[WEAPONS] Failed to add weapon_package column:', err.message);
        } else {
            console.log('[WEAPONS] weapon_package column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN equipped_weapon_ammo INT NULL DEFAULT NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[WEAPONS] Failed to add equipped_weapon_ammo column:', err.message);
        } else {
            console.log('[WEAPONS] equipped_weapon_ammo column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN drivers_license TINYINT(1) NOT NULL DEFAULT 0', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[DMV] Failed to add drivers_license column:', err.message);
        } else {
            console.log('[DMV] drivers_license column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN faction_key VARCHAR(16) NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[FACTIONS] Failed to add faction_key column:', err.message);
        } else {
            console.log('[FACTIONS] faction_key column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN faction_rank INT NOT NULL DEFAULT 0', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[FACTIONS] Failed to add faction_rank column:', err.message);
        } else {
            console.log('[FACTIONS] faction_rank column ready.');
        }
    });

    db.query('ALTER TABLE characters ADD COLUMN faction_leader TINYINT(1) NOT NULL DEFAULT 0', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[FACTIONS] Failed to add faction_leader column:', err.message);
        } else {
            console.log('[FACTIONS] faction_leader column ready.');
        }
    });

    db.query(`CREATE TABLE IF NOT EXISTS faction_rank_names (
        faction_key VARCHAR(16) NOT NULL,
        rank_level INT NOT NULL,
        rank_name VARCHAR(64) NOT NULL,
        PRIMARY KEY (faction_key, rank_level)
    )`, (err) => {
        if (err) {
            console.error('[FACTIONS] Failed to create faction_rank_names table:', err.message);
            return;
        }
        console.log('[FACTIONS] faction_rank_names table ready.');
        seedFactionRankNames();
    });

    db.query(`CREATE TABLE IF NOT EXISTS police_fines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        char_id INT NOT NULL,
        suspect_name VARCHAR(64) NOT NULL,
        officer_char_id INT NULL,
        officer_name VARCHAR(64) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        reason VARCHAR(128) NOT NULL,
        paid_from_cash INT NOT NULL DEFAULT 0,
        paid_from_bank INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_police_fines_char_id (char_id),
        CONSTRAINT fk_police_fines_char FOREIGN KEY (char_id) REFERENCES characters(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('[PD] Failed to create police_fines table:', err.message);
        }
    });

    db.query(`CREATE TABLE IF NOT EXISTS police_mdc_warrants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        char_id INT NOT NULL,
        suspect_name VARCHAR(64) NOT NULL,
        issued_by_char_id INT NULL,
        issued_by_name VARCHAR(64) NOT NULL,
        reason VARCHAR(128) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'open',
        cleared_at TIMESTAMP NULL DEFAULT NULL,
        cleared_by_name VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_police_mdc_warrants_char_status (char_id, status),
        CONSTRAINT fk_police_mdc_warrants_char FOREIGN KEY (char_id) REFERENCES characters(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('[PD] Failed to create police_mdc_warrants table:', err.message);
        }
    });

    db.query('ALTER TABLE bans ADD COLUMN ucp_name VARCHAR(64) NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[BANS] Failed to add ucp_name column:', err.message);
        } else {
            console.log('[BANS] ucp_name column ready.');
        }
    });

    db.query('ALTER TABLE bank_accounts ADD COLUMN account_number VARCHAR(16) NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[BANK] Failed to add account_number column:', err.message);
        } else {
            console.log('[BANK] account_number column ready.');
        }
    });

    db.query('ALTER TABLE bank_accounts ADD UNIQUE KEY uq_bank_accounts_account_number (account_number)', (err) => {
        if (err && err.code !== 'ER_DUP_KEYNAME') {
            console.error('[BANK] Failed to add unique index for account_number:', err.message);
        }
    });

    // Fix rows where ammo was stored as 120 default but no weapon is equipped
    db.query('UPDATE characters SET equipped_weapon_ammo = NULL WHERE equipped_weapon_hash IS NULL AND equipped_weapon_ammo IS NOT NULL', (err) => {
        if (err) console.error('[WEAPONS] Failed to clean up orphan ammo values:', err.message);
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
        fuel FLOAT NOT NULL DEFAULT 100,
        locked TINYINT(1) NOT NULL DEFAULT 0,
        plate VARCHAR(16) NOT NULL,
        weapon_inventory TEXT NULL,
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

    db.query('ALTER TABLE player_vehicles ADD COLUMN weapon_inventory TEXT NULL', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[WEAPONS] Failed to add weapon_inventory column:', err.message);
        } else {
            console.log('[WEAPONS] vehicle weapon_inventory column ready.');
        }
    });

    db.query('ALTER TABLE player_vehicles ADD COLUMN fuel FLOAT NOT NULL DEFAULT 100', (err) => {
        if (err && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('[VEHICLES] Failed to add fuel column:', err.message);
        } else {
            console.log('[VEHICLES] fuel column ready.');
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

    db.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        token VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_password_reset_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`, (err) => { if (err) console.error('[DB] create password_reset_tokens failed', err); });

    db.query(`CREATE TABLE IF NOT EXISTS server_properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_key VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(80) NOT NULL,
        address VARCHAR(128) NULL,
        price INT NOT NULL DEFAULT 0,
        entry_x FLOAT NOT NULL,
        entry_y FLOAT NOT NULL,
        entry_z FLOAT NOT NULL,
        entry_h FLOAT NOT NULL DEFAULT 0,
        interior_x FLOAT NOT NULL,
        interior_y FLOAT NOT NULL,
        interior_z FLOAT NOT NULL,
        interior_h FLOAT NOT NULL DEFAULT 0,
        dimension INT NOT NULL,
        owner_char_id INT NULL,
        owner_char_name VARCHAR(64) NULL,
        tenant_char_id INT NULL,
        tenant_char_name VARCHAR(64) NULL,
        inventory TEXT NULL,
        settings TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_server_properties_owner_char_id (owner_char_id),
        INDEX idx_server_properties_tenant_char_id (tenant_char_id)
    )`, (createErr) => {
        if (createErr) {
            console.error('[HOUSING] Failed to create server_properties table:', createErr.message);
            return;
        }

        console.log('[HOUSING] server_properties table ready.');

        db.query('ALTER TABLE server_properties ADD COLUMN tenant_char_id INT NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[HOUSING] Failed to add tenant_char_id column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_properties ADD COLUMN tenant_char_name VARCHAR(64) NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[HOUSING] Failed to add tenant_char_name column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_properties ADD INDEX idx_server_properties_tenant_char_id (tenant_char_id)', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_KEYNAME') {
                console.error('[HOUSING] Failed to add tenant index:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_properties ADD COLUMN address VARCHAR(128) NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[HOUSING] Failed to add address column:', alterErr.message);
            }
        });

        seedAndLoadProperties();
    });

    db.query(`CREATE TABLE IF NOT EXISTS server_businesses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_key VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(80) NOT NULL,
        business_type VARCHAR(32) NOT NULL,
        address VARCHAR(128) NULL,
        owner_char_id INT NULL,
        owner_char_name VARCHAR(64) NULL,
        bank_balance INT NOT NULL DEFAULT 0,
        entry_x FLOAT NOT NULL,
        entry_y FLOAT NOT NULL,
        entry_z FLOAT NOT NULL,
        entry_h FLOAT NOT NULL DEFAULT 0,
        interior_x FLOAT NOT NULL,
        interior_y FLOAT NOT NULL,
        interior_z FLOAT NOT NULL,
        interior_h FLOAT NOT NULL DEFAULT 0,
        exit_x FLOAT NOT NULL,
        exit_y FLOAT NOT NULL,
        exit_z FLOAT NOT NULL,
        exit_h FLOAT NOT NULL DEFAULT 0,
        dimension INT NOT NULL,
        pawn_inventory TEXT NULL,
        interact_radius FLOAT NOT NULL DEFAULT 3.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (createErr) => {
        if (createErr) {
            console.error('[BUSINESS] Failed to create server_businesses table:', createErr.message);
            return;
        }

        console.log('[BUSINESS] server_businesses table ready.');

        db.query('ALTER TABLE server_businesses ADD COLUMN address VARCHAR(128) NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add address column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_businesses ADD COLUMN owner_char_id INT NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add owner_char_id column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_businesses ADD COLUMN owner_char_name VARCHAR(64) NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add owner_char_name column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_businesses ADD COLUMN bank_balance INT NOT NULL DEFAULT 0', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add bank_balance column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_businesses ADD COLUMN pawn_inventory TEXT NULL', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add pawn_inventory column:', alterErr.message);
            }
        });

        db.query('ALTER TABLE server_businesses ADD COLUMN interact_radius FLOAT NOT NULL DEFAULT 3.0', (alterErr) => {
            if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
                console.error('[BUSINESS] Failed to add interact_radius column:', alterErr.message);
            }
        });

        loadBusinessesFromDatabase();
    });

    // Ensure players table has email, email_confirmed, reg_answers columns and tokens table
    db.query('ALTER TABLE players ADD COLUMN email VARCHAR(160) NULL', (err) => { if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('[DB] add email failed', err); });
    db.query('ALTER TABLE players ADD COLUMN email_confirmed TINYINT(1) NOT NULL DEFAULT 0', (err) => { if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('[DB] add email_confirmed failed', err); });
    db.query('ALTER TABLE players ADD COLUMN reg_answers TEXT NULL', (err) => { if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('[DB] add reg_answers failed', err); });
    db.query(`CREATE TABLE IF NOT EXISTS email_confirm_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        token VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_token (token),
        CONSTRAINT fk_email_token_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`, (err) => { if (err) console.error('[DB] create email_confirm_tokens failed', err); });

    // Table for storing pending character creation requests
    db.query(`CREATE TABLE IF NOT EXISTS pending_characters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ucp_username VARCHAR(64) NOT NULL,
        first_name VARCHAR(64) NOT NULL,
        last_name VARCHAR(64) NOT NULL,
        age INT NULL,
        gender VARCHAR(16) NULL,
        bio TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => { if (err) console.error('[DB] create pending_characters failed', err); });

    // Ensure email is unique across accounts (best-effort). Check information_schema
    // for an existing index first to avoid noisy duplicate-key errors.
    db.query("SELECT COUNT(1) AS cnt FROM information_schema.STATISTICS WHERE table_schema = DATABASE() AND table_name = 'players' AND index_name = 'idx_unique_email'", (idxErr, idxRows) => {
        if (idxErr) {
            console.error('[DB] Failed to check existing indexes for players:', idxErr);
            return;
        }
        const exists = Array.isArray(idxRows) && idxRows[0] && Number(idxRows[0].cnt) > 0;
        if (exists) {
            console.log('[DB] Unique index idx_unique_email already exists');
            return;
        }

        db.query('ALTER TABLE players ADD UNIQUE INDEX idx_unique_email (email)', (alterErr) => {
            if (alterErr) {
                // Common reasons: duplicate entries or index name conflicts
                if (alterErr.code === 'ER_DUP_ENTRY' || alterErr.code === 'ER_DUP_KEYNAME' || alterErr.code === 'ER_DUP_FIELDNAME') {
                    console.warn('[DB] Could not add unique index for email - possible existing duplicates or name conflict:', alterErr.message);
                } else {
                    console.error('[DB] add unique index email failed', alterErr);
                }
            } else {
                console.log('[DB] Added unique index idx_unique_email on players(email)');
            }
        });
    });
    // Robust players.id cleanup and AUTO_INCREMENT enforcement
    db.query('SHOW CREATE TABLE players', (showErr, showRows) => {
        if (showErr) {
            if (showErr.code !== 'ER_NO_SUCH_TABLE') console.error('[DB] SHOW CREATE TABLE players failed', showErr);
            return;
        }

        // Delete any invalid rows with id = 0 first (if table exists)
        db.query('DELETE FROM players WHERE id = 0', (delErr) => {
            if (delErr) {
                if (delErr.code !== 'ER_NO_SUCH_TABLE') console.error('[DB] Failed to delete players with id=0', delErr);
            } else {
                console.log('[DB] Removed any players with id=0');
            }

            // Inspect current primary key
            db.query('SHOW INDEX FROM players WHERE Key_name = "PRIMARY"', (idxErr, idxRows) => {
                if (idxErr) {
                    if (idxErr.code !== 'ER_NO_SUCH_TABLE') console.error('[DB] Failed to inspect players primary key', idxErr);
                    return;
                }

                const pkCols = Array.isArray(idxRows) ? idxRows.map(r => r.Column_name) : [];
                const pkIsIdOnly = pkCols.length === 1 && pkCols[0] === 'id';

                if (pkIsIdOnly) {
                    // If PK is already id, just ensure AUTO_INCREMENT attribute
                    db.query('ALTER TABLE players MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT', (modErr) => {
                        if (modErr) {
                            console.error('[DB] Failed to ensure players.id is AUTO_INCREMENT', modErr);
                        } else {
                            console.log('[DB] Ensured players.id is AUTO_INCREMENT');
                        }
                    });
                } else {
                    // Drop existing PK (if any) and recreate on id
                    db.query('ALTER TABLE players DROP PRIMARY KEY', (dropErr) => {
                        if (dropErr) {
                            console.error('[DB] Failed to drop existing primary key on players', dropErr);
                            return;
                        }
                        db.query('ALTER TABLE players MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (id)', (addErr) => {
                            if (addErr) {
                                console.error('[DB] Failed to set players.id as AUTO_INCREMENT PRIMARY KEY', addErr);
                            } else {
                                console.log('[DB] Recreated PRIMARY KEY on players.id and set AUTO_INCREMENT');
                            }
                        });
                    });
                }
            });
        });
    });
}

db.getConnection((err, connection) => {
    if (err) {
        console.error('MySQL Connection Failed:', err);
        return;
    }

    // Endpoint handlers: confirm email and forgot/reset flow via server events
    mp.events.add('confirmEmailToken', (player, token) => {
        if (!token) return player.call('login:error', ['Invalid token']);
        db.query('SELECT player_id FROM email_confirm_tokens WHERE token = ? LIMIT 1', [token], (err, rows) => {
            if (err || !rows || rows.length === 0) return player.call('login:error', ['Nevalidus ar pasibaiges tokenas.']);
            const pid = rows[0].player_id;
            db.query('UPDATE players SET email_confirmed = 1 WHERE id = ?', [pid], (uErr) => {
                if (uErr) return player.call('login:error', ['Nepavyko patvirtinti el. pasto.']);
                db.query('DELETE FROM email_confirm_tokens WHERE player_id = ?', [pid]);
                player.call('login:success');
            });
        });
    });

    mp.events.add('forgotPassword', (player, email) => {
        if (!email) return player.call('forgot:error', ['Prasome ivesti el. pasta.']);
        const normalizedEmail = String(email).trim().toLowerCase();
        db.query('SELECT id FROM players WHERE email = ? LIMIT 1', [normalizedEmail], (err, rows) => {
            if (err || !rows || rows.length === 0) return player.call('forgot:error', ['El. pastas nerastas.']);
            const pid = rows[0].id;
            const code = String(Math.floor(100000 + Math.random() * 900000));
            // remove old tokens for this player
            db.query('DELETE FROM password_reset_tokens WHERE player_id = ?', [pid], (dErr) => { if (dErr) console.error('[RESET] Failed to delete old tokens:', dErr); });
            db.query('INSERT INTO password_reset_tokens (player_id, token, created_at) VALUES (?, ?, NOW())', [pid, code], (tErr) => {
                if (tErr) { console.error('[RESET] token store failed', tErr); return player.call('forgot:error', ['Klaida siunciant el. laiska.']); }
                if (mailTransport) {
                    const mailText = `Jusu slaptazodzio atstatymo kodas: ${code}`;
                    mailTransport.sendMail({
                        from: process.env.SMTP_FROM || 'CaliforniaRP <info@californiarp.lt>',
                        to: normalizedEmail,
                        subject: 'Slaptazodzio atstatymas - kodas',
                        text: mailText,
                        html: `<p>Jusu slaptazodzio atstatymo kodas: <strong>${code}</strong></p>`
                    }, (mailErr) => {
                        if (mailErr) { console.error('[EMAIL] reset send error', mailErr); player.call('forgot:error', ['Klaida siunciant el. laiska.']); return; } else {
                            try { player.call('forgot:sent', ['Patvirtinimo kodas issiustas. Patikrinkite el. pasta.']); } catch (e) { }
                        }
                    });
                } else {
                    try { player.call('forgot:sent', ['Patvirtinimo kodas sugeneruotas (SMTP nepriskirtas).']); } catch (e) { }
                }
            });
        });
    });

    mp.events.add('resetPassword', (player, token, newPassword) => {
        if (!token || !newPassword) return player.call('reset:error', ['Invalid request']);
        db.query('SELECT player_id FROM password_reset_tokens WHERE token = ? LIMIT 1', [String(token).trim()], (err, rows) => {
            if (err || !rows || rows.length === 0) return player.call('reset:error', ['Nevalidus arba pasibaiges kodas.']);
            const pid = rows[0].player_id;
            bcrypt.hash(String(newPassword), 10, (hErr, hash) => {
                if (hErr) return player.call('reset:error', ['Klaida keiciant slaptazodi.']);
                db.query('UPDATE players SET password = ? WHERE id = ?', [hash, pid], (uErr) => {
                    if (uErr) return player.call('reset:error', ['Klaida saugant slaptazodi.']);
                    db.query('DELETE FROM password_reset_tokens WHERE player_id = ?', [pid]);
                    try { player.call('reset:success', ['Slaptazodis pakeistas.']); } catch (e) { }
                });
            });
        });
    });

    // Verify reset code and return associated username for UI display
    mp.events.add('verifyResetCode', (player, code) => {
        if (!code) return player.call('reset:code:error', ['Iveskite koda.']);
        db.query('SELECT player_id FROM password_reset_tokens WHERE token = ? LIMIT 1', [String(code).trim()], (err, rows) => {
            if (err || !rows || rows.length === 0) return player.call('reset:code:error', ['Nevalidus arba pasibaiges kodas.']);
            const pid = rows[0].player_id;
            db.query('SELECT name FROM players WHERE id = ? LIMIT 1', [pid], (nErr, nRows) => {
                if (nErr || !nRows || nRows.length === 0) return player.call('reset:code:error', ['Vartotojas nerastas.']);
                try { player.call('reset:code:ok', [nRows[0].name]); } catch (e) { }
            });
        });
    });

    connection.release();
    bootstrapDatabase();
});

// Verify email by code (sent via email during registration)
mp.events.add('verifyEmailCode', (player, code) => {
    if (!code) return player.call('register:verify:error', ['Iveskite patvirtinimo koda.']);
    const norm = String(code).trim();
    db.query('SELECT player_id FROM email_confirm_tokens WHERE token = ? LIMIT 1', [norm], (err, rows) => {
        if (err || !rows || rows.length === 0) return player.call('register:verify:error', ['Nevalidus arba pasibaiges kodas.']);
        const pid = rows[0].player_id;
        db.query('UPDATE players SET email_confirmed = 1 WHERE id = ?', [pid], (uErr) => {
            if (uErr) { console.error('[EMAIL] Failed to mark email_confirmed:', uErr); return player.call('register:verify:error', ['Klaida. Bandykite veliau.']); }
            db.query('DELETE FROM email_confirm_tokens WHERE player_id = ?', [pid], (dErr) => { if (dErr) console.error('[EMAIL] Failed to delete confirm token:', dErr); });
            try { player.call('register:verify:success', ['El. pastas patvirtintas.']); } catch (e) { }
        });
    });
});

// Resend a verification code to given email if a matching player exists
mp.events.add('resendVerifyCode', (player, email) => {
    if (!email) return player.call('register:verify:error', ['Iveskite el. pasta.']);
    const normalizedEmail = String(email).trim().toLowerCase();
    db.query('SELECT id FROM players WHERE email = ? LIMIT 1', [normalizedEmail], (err, rows) => {
        if (err || !rows || rows.length === 0) return player.call('register:verify:error', ['El. pastas nerastas.']);
        const pid = rows[0].id;
        const code = String(Math.floor(100000 + Math.random() * 900000));
        db.query('DELETE FROM email_confirm_tokens WHERE player_id = ?', [pid], (dErr) => { if (dErr) console.error('[EMAIL] Failed to delete old tokens:', dErr); });
        db.query('INSERT INTO email_confirm_tokens (player_id, token, created_at) VALUES (?, ?, NOW())', [pid, code], (tErr) => {
            if (tErr) { console.error('[EMAIL] Failed to store confirmation token:', tErr); return player.call('register:verify:error', ['Klaida siunciant koda.']); }
            if (mailTransport) {
                const mailText = `Jusu patvirtinimo kodas: ${code}`;
                mailTransport.sendMail({ from: process.env.SMTP_FROM || 'CaliforniaRP <info@californiarp.lt>', to: normalizedEmail, subject: 'Jusu patvirtinimo kodas', text: mailText, html: `<p>Jusu patvirtinimo kodas: <strong>${code}</strong></p>` }, (mailErr) => {
                    if (mailErr) { console.error('[EMAIL] resend send error:', mailErr); return player.call('register:verify:error', ['Klaida siunciant el. laiska.']); }
                    try { player.call('register:verify:success', ['Patvirtinimo kodas issiustas. Patikrinkite el. pasta.']); } catch (e) { }
                });
            } else {
                try { player.call('register:verify:error', ['El. pastas neprieinamas (SMTP nepriskirtas).']); } catch (e) { }
            }
        });
    });
});

module.exports = db;

// Store player-specific time info
let playerTimeInfo = {};

mp.events.add('playerConnect', (player) => {
    const ip = player.ip;

    db.query('SELECT * FROM bans WHERE ip = ?', [ip], (error, results) => {
        if (error) {
            console.log('[KLAIDA] Ivyko klaida tikrinant zaidejo IP');
            return;
        }

        if (results.length > 0) {
            const reason = results[0].reason || "Nenurodyta priezastis";
            player.outputChatBox(`[INFO] Jus esate uzblokuotas. Priezastis: ${reason}`);
            player.kick(`[KICK] Jus buvote uzblokuotas. Priezastis: ${reason}`);
        } else {
            console.log(`Zaidejas (UCP: ${player.name}) prisijunge prie serverio.`);
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

    console.log(`Zaidejas (UCP: ${player.name}) prisijunge prie serverio.`);
});

// Handle client-side weapon ammo updates
mp.events.add('updateWeaponAmmo', (player, weaponHash, ammo) => {
    if (!player || !player.charId) {
        return;
    }

    const hash = Number(weaponHash);
    const ammoNum = Number(ammo);

    if (!Number.isFinite(hash) || !Number.isFinite(ammoNum)) {
        return;
    }

    // Track both weapon and ammo from client (client is authoritative)
    player.trackedWeaponHash = hash;
    player.trackedWeaponAmmo = ammoNum;
    player.currentWeaponAmmo = ammoNum;
});

mp.events.add('weaponShotFired', (player, weaponHash) => {
    if (!player || !player.charId) {
        return;
    }

    const hash = Number(weaponHash);
    if (!Number.isFinite(hash) || hash === 0 || hash === WEAPON_UNARMED_HASH) {
        return;
    }

    const equippedHash = sanitizeWeaponHash(getCurrentHoldableWeaponHash(player))
        || sanitizeWeaponHash(player.savedEquippedWeaponHash)
        || null;

    if (!equippedHash || equippedHash !== hash) {
        return;
    }

    const baseAmmo = Number.isFinite(player.trackedWeaponAmmo)
        ? player.trackedWeaponAmmo
        : (Number.isFinite(player.currentWeaponAmmo)
            ? player.currentWeaponAmmo
            : (Number.isFinite(player.savedEquippedWeaponAmmo) ? player.savedEquippedWeaponAmmo : DEFAULT_WEAPON_AMMO));

    const nextAmmo = Math.max(0, baseAmmo - 1);
    player.trackedWeaponHash = hash;
    player.trackedWeaponAmmo = nextAmmo;
    player.currentWeaponAmmo = nextAmmo;
    player.savedEquippedWeaponAmmo = nextAmmo;
});

mp.events.add('validateLogin', (player, username, password) => {
    db.query('SELECT * FROM players WHERE name = ?', [username], (err, results) => {
        if (err) {
            console.error('[DATABASE ERROR]', err);
            player.call('login:error', [' Duomenu bazes klaida! Bandykite veliau.']);
            return;
        }

        if (results.length === 0) {
            console.log(`[LOGIN FAILED] Username "${username}" not found.`);
            player.call('login:error', [' Vartotojo vardas nerastas!']);
            return;
        }

        const storedPassword = results[0].password;

        db.query('SELECT * FROM bans WHERE ucp_name = ? LIMIT 1', [username], (banError, banResults) => {
            if (banError) {
                console.error('[DATABASE ERROR] Failed to check UCP ban status:', banError);
                player.call('login:error', [' Duomenu bazes klaida! Bandykite veliau.']);
                return;
            }

            if (banResults.length > 0) {
                const reason = banResults[0].reason || 'Nenurodyta priezastis';
                console.log(`[LOGIN BLOCKED] Banned UCP "${username}" attempted to log in.`);
                player.call('login:error', [` Sis UCP yra uzblokuotas. Priezastis: ${reason}`]);
                return;
            }

            bcrypt.compare(password, storedPassword, (err, isMatch) => {
                if (err) {
                    console.error('[BCRYPT ERROR]', err);
                    player.call('login:error', [' Klaida tikrinant slaptazodi. Bandykite dar karta.']);
                    return;
                }

                if (isMatch) {
                    // enforce email confirmation
                    const emailConfirmed = Number(results[0].email_confirmed) === 1;
                    if (!emailConfirmed) {
                        player.call('login:error', [' Paskyra nepatvirtinta. Patikrinkite el. pasta.']);
                        return;
                    }

                    console.log(`[LOGIN SUCCESS] User "${username}" logged in.`);
                    player.name = username; // UCP username
                    player.call('login:success');
                    loadCharacterSelection(player);
                } else {
                    console.log(`[LOGIN FAILED] Incorrect password for "${username}".`);
                    player.call('login:error', [' Neteisingas slaptazodis!']);
                }
            });
        });
    });
});

function loadCharacterSelection(player) {
    db.query('SELECT id, char_name, money, bank_balance, playtime, health, is_approved FROM characters WHERE ucp_username = ?', [player.name], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Veikeju sarasas nepakrautas:', err);
            player.outputChatBox(' Klaida kraunant veikejus. Susisiekite su administratoriumi.');
            return;
        }

        const characterCount = results.length;
        const approvedCharacters = results.filter(row => Number(row.is_approved) === 1).map(row => ({
            id: row.id,
            name: row.char_name,
            money: row.money,
            bankBalance: row.bank_balance,
            playtime: row.playtime,
            playtimeFormatted: Math.floor(row.playtime / 60) + ' val. ' + (row.playtime % 60) + ' min.',
            health: row.health,
            clothes: row.clothes || null,
            barber: row.barber || null
        }));

        if (approvedCharacters.length === 0) {
            player.outputChatBox('!{#e67e22}Neturite patvirtintu veikeju. Prisijungti negalima kol administracija nepatvirtins.');
        }

        // Also include any pending character creation requests for this UCP account
        db.query('SELECT id, first_name, last_name, age, gender, bio, created_at FROM pending_characters WHERE ucp_username = ? ORDER BY created_at DESC', [player.name], (pErr, pRows) => {
            if (pErr) {
                console.error('[KLAIDA] Nepavyko uzkrauti laukianciu veikeju:', pErr);
                pRows = [];
            }

            const pending = (pRows || []).map(row => ({
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                age: row.age,
                gender: row.gender,
                bio: row.bio,
                createdAt: row.created_at
            }));

            const payload = { approved: approvedCharacters, pending };
            player.call('showCharacterSelectionUI', [JSON.stringify(payload)]);
        });
    });
}

mp.events.add('selectCharacter', (player, charId) => {
    db.query('SELECT * FROM characters WHERE id = ? AND ucp_username = ?', [charId, player.name], (err, results) => {
        if (err || results.length === 0) {
            console.error('[KLAIDA] Veikejas nerastas:', err);
            player.outputChatBox('!{#e74c3c}Klaida pasirenkant veikeja.');
            return;
        }

        const charData = results[0];
        const isApproved = Number(charData.is_approved) === 1;
        if (!isApproved) {
            player.outputChatBox('!{#e67e22}Sis veikejas dar nepatvirtintas. Prisijungti negalima.');
            return;
        }

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
        player.hasDriversLicense = Number(charData.drivers_license || 0) === 1;
        applyFactionData(player, charData.faction_key, charData.faction_rank, Number(charData.faction_leader || 0) === 1);
        const normalizedPhoneNumber = String(charData.phone_number || '').trim();
        player.phoneNumber = /^\d{6,15}$/.test(normalizedPhoneNumber) ? normalizedPhoneNumber : null;
        player.inventory = loadInventory(charData.inventory);
        player.weaponPackageWeapons = parseWeaponPackage(charData.weapon_package);
        player.savedEquippedWeaponHash = sanitizeWeaponHash(charData.equipped_weapon_hash);
        player.savedEquippedWeaponAmmo = charData.equipped_weapon_ammo != null ? charData.equipped_weapon_ammo : null;
        if (charData.inventory === null || charData.inventory === undefined || charData.inventory === '') {
            persistInventory(player);
        }

        // Load bank account (now tied to char_name)
        db.query('SELECT * FROM bank_accounts WHERE char_name = ?', [player.charName], (err, bankResults) => {
            if (err) {
                console.error('[KLAIDA] Banko saskaita nepakrauta:', err);
                player.outputChatBox(' Klaida kraunant banko duomenis.');
                return;
            }

            if (bankResults.length === 0) {
                db.query('INSERT INTO bank_accounts (char_name, balance, account_number) VALUES (?, ?, NULL)', [player.charName, 0]);
                player.bankBalance = 0;
                player.bankAccountNumber = null;
            } else {
                player.bankBalance = bankResults[0].balance;
                player.bankAccountNumber = normalizeBankAccountNumber(bankResults[0].account_number);
            }
            player.call('updateBankHUD', [player.bankBalance]);
        });

        player.spawn(player.position);
        clearDeathState(player, true);
        const restoredAmmo = (player.savedEquippedWeaponHash) ? (player.savedEquippedWeaponAmmo ?? DEFAULT_WEAPON_AMMO) : 0;
        setSingleWeaponForPlayer(player, player.savedEquippedWeaponHash || WEAPON_UNARMED_HASH, restoredAmmo);

        // Reset visible clothing components first so a previous character outfit does not leak.
        for (let component = 0; component <= 11; component += 1) {
            try {
                player.setClothes(component, 0, 0, 2);
            } catch (e) {
                // Ignore unavailable component indices for the current model.
            }
        }

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
        player.call('updatePhoneNumber', [player.phoneNumber || '']);
        player.currentPropertyId = null;
        player.currentBusinessId = null;
        player.dimension = 0;
        player.outputChatBox(`!{#7aa164}Pasirinkote veikeja: ${charData.char_name}. Sveiki atvyke i CaliforniaRP.LT!`);

        loadCharacterContacts(player);
        loadOwnedVehiclesForPlayer(player);
        loadParkLocationsForPlayer(player);

        if (!player.timer) {
            player.timer = setInterval(() => {
                player.playtime += 1;
                if (player.playtime % 30 === 0) {
                    const basePaycheckAmount = 1000;
                    const factionPaycheckAmount = player.factionDuty ? getFactionSalary(player.factionKey, player.factionRank) : 0;
                    const paycheckAmount = basePaycheckAmount + factionPaycheckAmount;
                    player.bankBalance += paycheckAmount;
                    let totalChargedRent = 0;
                    const tenantRentLines = getPropertyRentChargeLinesForTenant(player.charId);

                    tenantRentLines.forEach((line) => {
                        const rent = Math.max(0, parseInt(line.rent, 10) || 0);
                        if (rent <= 0) return;

                        const charged = Math.min(player.bankBalance, rent);
                        if (charged <= 0) return;

                        player.bankBalance -= charged;
                        totalChargedRent += charged;

                        const ownerOnline = findOnlinePlayerByCharId(line.property.ownerCharId);
                        if (ownerOnline && ownerOnline.charName && Number(ownerOnline.charId) === Number(line.property.ownerCharId)) {
                            ownerOnline.bankBalance = (ownerOnline.bankBalance || 0) + charged;
                            ownerOnline.call('updateBankHUD', [ownerOnline.bankBalance]);
                            ownerOnline.outputChatBox(`!{#7aa164}Gavote $${charged} nuomos uz ${line.property.name} (nuomininkas: ${player.charName}).`);
                            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [ownerOnline.bankBalance, ownerOnline.charName]);
                        } else if (line.property.ownerCharName) {
                            db.query('UPDATE bank_accounts SET balance = balance + ? WHERE char_name = ?', [charged, line.property.ownerCharName]);
                        }
                    });

                    player.call('showPaycheckPopup', [paycheckAmount]);
                    db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
                    db.query('UPDATE characters SET playtime = ? WHERE id = ?', [player.playtime, player.charId]);
                    player.outputChatBox(`!{#229954}Jusu atlyginimas ($${paycheckAmount}) pervestas i banko saskaita.`);
                    if (factionPaycheckAmount > 0) {
                        const factionDef = getPlayerFactionDef(player);
                        player.outputChatBox(`!{#5dade2}${factionDef.shortLabel} duty priedas: $${factionPaycheckAmount} (${getFactionRankName(player.factionKey, player.factionRank)}).`);
                    }

                    if (tenantRentLines.length > 0) {
                        const totalExpectedRent = tenantRentLines.reduce((sum, line) => sum + (Math.max(0, parseInt(line.rent, 10) || 0)), 0);
                        player.outputChatBox(`!{#f5b041}Nuskaiciuota nuoma: $${totalChargedRent} is $${totalExpectedRent}.`);
                        if (totalChargedRent < totalExpectedRent) {
                            player.outputChatBox('!{#e67e22}Nepakako lesu pilnai nuomai padengti.');
                        }
                    }

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
        ensureOwnedPropertyBlipsForPlayer(player);

        console.log(`[VEIKEJAS] ${player.name} pasirinko veikeja ${charData.char_name}`);
    });
});


// Ensure loadCharacterContacts sends the update to the client
function loadCharacterContacts(player) {
    if (!player.charId) return;

    db.query('SELECT contact_name, contact_number FROM contacts WHERE char_id = ?', [player.charId], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko ikelti kontaktu:', err);
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
        const weaponPackageJson = getWeaponPackageJson(player);
        const equippedWeaponHash = sanitizeWeaponHash(getCurrentHoldableWeaponHash(player))
            || sanitizeWeaponHash(player.savedEquippedWeaponHash)
            || null;
        const equippedWeaponAmmo = equippedWeaponHash
            ? ((getEquippedWeaponAmmo(player, equippedWeaponHash) ?? DEFAULT_WEAPON_AMMO))
            : null;
        player.savedEquippedWeaponHash = equippedWeaponHash;
        player.savedEquippedWeaponAmmo = equippedWeaponAmmo;
        console.log(`[WEAPONS] saveCharacterData for ${player.charName}: weapon=${equippedWeaponHash} ammo=${equippedWeaponAmmo}`);
        const hasValidPosition = currentPos
            && Number.isFinite(currentPos.x)
            && Number.isFinite(currentPos.y)
            && Number.isFinite(currentPos.z);

        if (!hasValidPosition) {
            console.warn(`[VEIKEJAS] Invalid position for ${player.charName || player.name}, preserving last saved coordinates.`);
            db.query('UPDATE characters SET playtime = ?, money = ?, bank_balance = ?, health = ?, is_pm_enabled = ?, phone_number = ?, inventory = ?, weapon_package = ?, equipped_weapon_hash = ?, equipped_weapon_ammo = ? WHERE id = ?',
                [player.playtime || 0, player.money || 0, player.bankBalance || 0, player.health || 100, player.isPMEnabled ? 1 : 0, player.phoneNumber, inventoryJson, weaponPackageJson, equippedWeaponHash, equippedWeaponAmmo, player.charId],
                (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko issaugoti veikejo duomenu:', err);
                    } else {
                        console.log(`[VEIKEJAS] ${player.charName} duomenys issaugoti sekmingai.`);
                    }
                });
        } else {
            db.query('UPDATE characters SET playtime = ?, money = ?, bank_balance = ?, position_x = ?, position_y = ?, position_z = ?, health = ?, is_pm_enabled = ?, phone_number = ?, inventory = ?, weapon_package = ?, equipped_weapon_hash = ?, equipped_weapon_ammo = ? WHERE id = ?',
                [player.playtime || 0, player.money || 0, player.bankBalance || 0, currentPos.x, currentPos.y, currentPos.z, player.health || 100, player.isPMEnabled ? 1 : 0, player.phoneNumber, inventoryJson, weaponPackageJson, equippedWeaponHash, equippedWeaponAmmo, player.charId],
                (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko issaugoti veikejo duomenu:', err);
                    } else {
                        console.log(`[VEIKEJAS] ${player.charName} duomenys issaugoti sekmingai.`);
                    }
                });
        }

        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance || 0, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko issaugoti banko saskaitos:', err);
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

// Check for empty weapons and remove them (weapon ammo runs out)
setInterval(() => {
    mp.players.forEach((player) => {
        if (player && player.charId) {
            checkAndRemoveEmptyWeapons(player);
        }
    });
}, 1000); // Check every 1 second

// Detect downed state when player reaches 0 HP.
setInterval(() => {
    mp.players.forEach((player) => {
        if (!player || !player.charId) return;

        if (player.isDowned) {
            if (Number(player.health) !== 1) {
                player.health = 1;
            }

            if (!player.deathFreezeApplied) {
                player.deathFreezeApplied = true;
                player.call('freezePlayer', [true]);
                player.call('setDownedRagdoll', [true]);
                player.frozen = true;
            }
            return;
        }

        if (!player.isDowned && Number(player.health) <= 0) {
            enterDownedState(player);
        }
    });
}, 500);

// Keep jailed players inside the MRPD holding cell.
setInterval(() => {
    mp.players.forEach((player) => {
        if (!player || !player.charId || !player.isJailed) return;

        const jailExpired = player.jailedUntil && Date.now() >= Number(player.jailedUntil);
        if (jailExpired) {
            releasePlayerFromJail(player, true);
            return;
        }

        const outsideCell = player.dimension !== 0
            || !player.position
            || getDistanceBetweenPositions(player.position, PD_JAIL_POS) > PD_JAIL_CELL_RADIUS;

        if (outsideCell) {
            player.dimension = 0;
            player.position = PD_JAIL_POS;
            player.heading = PD_JAIL_HEADING;
            player.outputChatBox('!{#e74c3c}Negalite pabegti is sulaikymo kameros.');
        }
    });
}, 1000);

// Show property address once when player approaches an entry door.
setInterval(() => {
    mp.players.forEach((player) => {
        if (!player || !player.charId || !player.position) return;

        const nearbyProperty = getNearbyProperty(player, PROPERTY_ADDRESS_HINT_RADIUS);
        if (!nearbyProperty) {
            player.lastPropertyAddressHintId = null;
        } else {
            const nearbyPropertyId = Number(nearbyProperty.id);
            const lastPropertyAddressHintId = parseInt(player.lastPropertyAddressHintId, 10);
            if (!(Number.isFinite(lastPropertyAddressHintId) && lastPropertyAddressHintId === nearbyPropertyId)) {
                player.lastPropertyAddressHintId = nearbyPropertyId;

                const propertyName = getLocalizedPropertyName(nearbyProperty.id);
                const addressText = getPropertyAddressForDisplay(nearbyProperty);
                player.outputChatBox(`!{#f7dc6f}${propertyName} | Adresas: ${addressText}`);

                const rentPrice = Math.max(0, parseInt(nearbyProperty.settings?.rentPerPaycheck, 10) || 0);
                const hasOwner = Number(nearbyProperty.ownerCharId) > 0;
                const isAvailableForRent = hasOwner && !Number(nearbyProperty.tenantCharId) && rentPrice > 0;
                if (isAvailableForRent) {
                    player.outputChatBox(`!{#58d68d}Sis bustas laisvas nuomai: $${rentPrice}/paycheck. Rasykite /rent salia iejimo.`);
                }
            }

            requestNativePropertyAddressResolution(player, nearbyProperty);
        }

        const nearbyBusiness = getNearbyBusiness(player, BUSINESS_INTERACT_RADIUS + 1.0);
        if (!nearbyBusiness) {
            player.lastBusinessNameHintId = null;
            return;
        }

        const nearbyBusinessId = Number(nearbyBusiness.id);
        const lastBusinessNameHintId = parseInt(player.lastBusinessNameHintId, 10);
        if (Number.isFinite(lastBusinessNameHintId) && lastBusinessNameHintId === nearbyBusinessId) {
            return;
        }

        player.lastBusinessNameHintId = nearbyBusinessId;
        player.outputChatBox(`!{#5dade2}Verslas: ${nearbyBusiness.name}. Naudokite /enter.`);
    });
}, 1000);

// Vehicle fuel usage loop for drivers.
setInterval(() => {
    mp.players.forEach((player) => {
        if (!player || !player.charId || !player.vehicle) return;
        if (player.seat !== -1 && player.seat !== 0) return;

        const record = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
        if (!record) return;

        const vehicle = player.vehicle;
        const ownedVehicleId = Number(record.id);
        if (!Number.isFinite(ownedVehicleId)) return;

        const engineOn = Number(vehicle.getVariable('manualEngineOn')) === 1 || Boolean(vehicle.engine);
        if (!engineOn) {
            setOwnedVehicleFuel(record, record.fuel, true);
            vehicleFuelRuntimeState.delete(ownedVehicleId);
            return;
        }

        const now = Date.now();
        const currentPos = vehicle.position;
        const state = vehicleFuelRuntimeState.get(ownedVehicleId) || null;
        const distanceSinceLastTick = state && state.lastPos
            ? getDistanceBetweenPositions(currentPos, state.lastPos)
            : 0;

        const consumeByDistance = Math.max(0, distanceSinceLastTick) * VEHICLE_FUEL_DISTANCE_MULTIPLIER;
        const consumeAmount = VEHICLE_FUEL_MIN_CONSUMPTION + consumeByDistance;
        const currentFuel = sanitizeFuelLevel(record.fuel);
        const nextFuel = sanitizeFuelLevel(currentFuel - consumeAmount);

        setOwnedVehicleFuel(record, nextFuel, true);

        vehicleFuelRuntimeState.set(ownedVehicleId, {
            lastPos: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
            lastUpdateAt: now,
        });

        if (nextFuel <= 0) {
            vehicle.engine = false;
            vehicle.setVariable('manualEngineOn', 0);
            if (!record.outOfFuelWarnedAt || (now - record.outOfFuelWarnedAt) > 12000) {
                record.outOfFuelWarnedAt = now;
                player.outputChatBox('!{#e74c3c}Kuras baigesi. Naudokite /refill degalineje.');
            }
        }

        const shouldPersistFuel = !record.lastFuelPersistAt || (now - record.lastFuelPersistAt) >= 15000;
        if (shouldPersistFuel) {
            record.lastFuelPersistAt = now;
            persistOwnedVehicleState(record);
        }
    });
}, 1000);

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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (shoutMessage.length === 0) {
        player.outputChatBox('Naudojimas: /s <zodis>');
        return;
    }

    const shoutText = shoutMessage.join(' ');
    const message = `* ${player.charName} saukia: ${shoutText}`;

    mp.players.forEachInRange(player.position, 50, (nearbyPlayer) => {
        nearbyPlayer.outputChatBox(message);
    });
});

mp.events.addCommand('low', (player, _, ...whisperMessage) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (whisperMessage.length === 0) {
        player.outputChatBox('Naudojimas: /low <zodis>');
        return;
    }

    const whisperText = whisperMessage.join(' ');
    const whisperColor = "#A0A0A0";
    const message = `!{${whisperColor}}* ${player.charName} snabzda: ${whisperText}`;

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
        if (partner && partner !== player) { // Ensure partner exists and isn't the same player
            partner.outputChatBox(callMessage);
            console.log(`[DEBUG] Call chat to partner: ${player.charName} -> ${partner.charName}: ${text}`);
        }
    }

    console.log(`[DEBUG] Chat: ${player.charName} says "${text}" (on call: ${isOnCall})`);
});

mp.events.addCommand('b', (player, _, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (messageArray.length === 0) {
        player.outputChatBox(`!{#B0C4DE}Naudojimas: /b [zinute] - Nusiusti OOC zinute salia esantiems zaidejams.`);
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
    player.outputChatBox(`KITOS KOMANDOS - /stats, /pay, /bank, /withdraw, /deposit, /openbank, /changechar, /report, /admins`);
    player.outputChatBox(`KITOS KOMANDOS - /togglepm, /time, /barber, /changeclothes, /inv`);
    player.outputChatBox(`TURTAS - /helphouse, /helpvehicle`);
    player.outputChatBox(`!{#ADD8E6}----------------------------`);
    player.outputChatBox(`Ivedus komanda gausite komandos paaiskinima.`);
    player.outputChatBox(`Daugiau informacijos galite rasti musu forume arba /helpme <klausimas>.`);
});

mp.events.addCommand('helphouse', (player) => {
    player.outputChatBox(`BUSTAS - /properties, /buyproperty, /house, /enterhouse, /exithouse`);
    player.outputChatBox(`BUSTAS - /enter (alias), ADMIN: /tpinterior [interiorId]`);
    player.outputChatBox(`BUSTAS - /sellproperty, /setrent, /rent, /houselock, /hlock`);
    player.outputChatBox(`BUSTAS - /houseinv, /hdeposit, /hwithdraw`);
});

mp.events.addCommand('helpvehicle', (player) => {
    player.outputChatBox(`TRANSPORTAS - /buyvehicle, /buypark, /vehicles, /get, /park, /lock`);
    player.outputChatBox(`TRANSPORTAS - /engine, /refill, /sellto [zaidejoId] [kaina]`);
    player.outputChatBox(`TRANSPORTAS - /scrap, /scrapconfirm`);
});

mp.events.addCommand('id', (player, fullText, partialName) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!partialName) {
        player.outputChatBox(`Jusu zaidejo ID: ${player.id}`);
    } else {
        const matchingPlayers = mp.players.toArray().filter(p => p.charName && p.charName.toLowerCase().includes(partialName.toLowerCase()));
        if (matchingPlayers.length === 0) {
            player.outputChatBox(`Nerastas zaidejas "${partialName}".`);
        } else {
            matchingPlayers.forEach(target => {
                player.outputChatBox(`ID: ${target.id} | Vardas: ${target.charName}`);
            });
        }
    }
});

mp.events.addCommand('pm', (player, fullText, targetIdentifier, ...messageArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier || messageArray.length === 0) {
        player.outputChatBox(`Naudojimas: /pm [ID ar dalis vardo] [zinute]`);
        return;
    }

    const message = messageArray.join(" ");
    let target;

    target = getPlayerByIDOrName(targetIdentifier);

    if (!target) {
        player.outputChatBox(`Nerastas zaidejas vardu "${targetIdentifier}".`);
        return;
    }

    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Zaidejas dar nepasirinko veikejo.');
        return;
    }

    if (!target.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Zaidejas siuo metu yra isjunges privacias zinutes.');
        return;
    }

    if (!player.isPMEnabled) {
        player.outputChatBox('!{#E74C3C}Jus isjungete privacias zinutes ir negalite ju siusti.');
        return;
    }

    if (target) {
        target.outputChatBox(`!{#FFFF00}((PM is ${player.charName}: ${message}))`);
        player.outputChatBox(`!{#FFFF00}((PM nusiusta ${target.charName}: ${message}))`);
    } else {
        player.outputChatBox(`Zaidejas "${targetIdentifier}" nerastas.`);
    }
});

mp.events.addCommand('stats', player => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    player.outputChatBox(`!{#f7dc6f}===== Jusu informacija =====`);
    player.outputChatBox(`UCP vartotojo vardas: ${player.name}, Veikejo vardas: ${player.charName}`); // Show UCP username
    player.outputChatBox(`------------------------------------------------------`);
    player.outputChatBox(`Telefono numeris: ${player.phoneNumber || 'Nera'}`);
    player.outputChatBox(`Banko saskaitos numeris: ${player.bankAccountNumber || 'Neatidaryta'}`);
    player.outputChatBox(`Gyvybes: ${player.health}, Zaidimo laikas: ${Math.floor(player.playtime / 60)} val. ${player.playtime % 60} min.`);
    player.outputChatBox(`Grynieji pinigai: $${player.money}, Banko saskaitos balansas: $${player.bankBalance}`);
});

mp.events.addCommand('try', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
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
    'bank', 'withdraw', 'deposit', 'transfer', 'openbank', 'inventory', 'inv',
    'kick', 'freeze', 'goto', 'bring', 'tpls', 'ban', 'heal', 'giveitem', 'giveweapon', 'dropweapon', 'stashweapon', 'takeweapon', 'buildpackage', 'putpackage', 'viewpackage', 'admingiveweapon',
    'helpme', 'accepthelp', 'declinehelp',
    'report', 'acceptreport', 'declinereport',
    'admins', 'setaname', 'changechar', 'coords', 'createtwittertables', 'dmv',
    'setfactionleader', 'faction', 'finvite', 'funinvite', 'frank', 'frankname', 'duty', 'badge', 'panic',
    'cuf', 'cuff', 'uncuff', 'jail', 'unjail', 'fine', 'mdc', 'revive', 'treat', '911', 'respond',
    'properties', 'buyproperty', 'house', 'enterhouse', 'enter', 'exithouse', 'exit', 'buy', 'pawnstock', 'pawnsell', 'pawnbuy', 'pawnprice', 'pawnrename', 'pawnstockrename', 'bizbank', 'bizbankdeposit', 'bizbankwithdraw', 'setbizname', 'sellbiz', 'sellproperty', 'setrent', 'rent', 'houselock', 'hlock', 'houseinv', 'hdeposit', 'hwithdraw', 'aprop', 'abiz', 'tpinterior',
    'ph', 'phone', 'acceptdrive',
    'call', 'answer', 'decline', 'hangup', 'acceptdeath',
    'sharenumber', 'sms',
    'pay', 'togglepm',
    'buyvehicle', 'buypark', 'vehicles', 'park', 'get', 'lock', 'refill', 'scrap', 'scrapconfirm', 'sellto'
]);

mp.events.add('playerCommand', (player, command) => {
    const cmd = command.trim().split(' ')[0].toLowerCase();
    if (!knownCommands.has(cmd)) {
        player.outputChatBox('!{#e74c3c}Si komanda neegzistuoja. Naudokite /help arba /helpme');
    }
});

mp.events.addCommand('setfactionleader', (player, fullText, targetNameOrID, factionArg) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetNameOrID || !factionArg) return sendUsageInstructions(player, 'setfactionleader');

    isAdmin(player, 1, (err, allowed) => {
        if (err || !allowed) return player.outputChatBox('!{#e74c3c}Neturite teisiu naudoti sia komanda.');

        const target = getPlayerByIDOrName(targetNameOrID);
        if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');

        const requested = String(factionArg || '').trim().toLowerCase();
        if (requested === 'none' || requested === 'civilian' || requested === 'off') {
            updateCharacterFaction(target.charId, null, 0, false, (updateErr) => {
                if (updateErr) return player.outputChatBox('!{#e74c3c}Nepavyko nuimti leader statuso.');
                applyFactionData(target, null, 0, false);
                player.outputChatBox(`!{#7aa164}${target.charName} nebera faction leader.`);
                target.outputChatBox('!{#f7dc6f}Jus nebesate faction leader.');
            });
            return;
        }

        const def = getFactionDef(requested);
        if (!def) return player.outputChatBox('!{#f7dc6f}Faction: pd arba md.');

        db.query('UPDATE characters SET faction_leader = 0 WHERE faction_key = ?', [def.key], (clearErr) => {
            if (clearErr) return player.outputChatBox('!{#e74c3c}Nepavyko atlaisvinti seno leader.');

            mp.players.toArray().forEach((p) => {
                if (p.charName && p.factionKey === def.key) p.factionLeader = false;
            });

            updateCharacterFaction(target.charId, def.key, def.leaderRank, true, (updateErr) => {
                if (updateErr) return player.outputChatBox('!{#e74c3c}Nepavyko paskirti leader.');
                applyFactionData(target, def.key, def.leaderRank, true);
                player.outputChatBox(`!{#7aa164}${target.charName} paskirtas ${def.label} leader.`);
                target.outputChatBox(`!{#5dade2}Jus paskirtas ${def.label} leader.`);
            });
        });
    });
});

mp.events.addCommand('faction', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const def = getPlayerFactionDef(player);
    if (!def) return player.outputChatBox('!{#f7dc6f}Jus nesate faction narys.');

    const rankName = getFactionRankName(player.factionKey, player.factionRank);
    const salary = getFactionSalary(player.factionKey, player.factionRank);
    player.outputChatBox(`!{#5dade2}${def.label}: ${rankName} (rank ${player.factionRank}) | salary $${salary}/paycheck | duty: ${player.factionDuty ? 'on' : 'off'}`);
    player.outputChatBox('!{#d6eaf8}Komandos: /duty, /badge, /panic. Leader: /finvite /funinvite /frank /frankname');
    if (def.key === 'pd') player.outputChatBox('!{#d6eaf8}PD: /cuf /uncuff /jail /unjail /fine /mdc /respond');
    if (def.key === 'md') player.outputChatBox('!{#d6eaf8}MD: /revive /treat /respond');

    const online = getFactionOnlineList(def.key);
    player.outputChatBox(`!{#d6eaf8}Online ${def.shortLabel}: ${online.length ? online.join(', ') : 'nieko'}`);
});

mp.events.addCommand('finvite', (player, fullText, targetNameOrID) => {
    const def = requireFactionLeader(player);
    if (!def) return;
    if (!targetNameOrID) return sendUsageInstructions(player, 'finvite');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target.factionKey) return player.outputChatBox('!{#f7dc6f}Zaidejas jau yra faction narys.');

    updateCharacterFaction(target.charId, def.key, 1, false, (err) => {
        if (err) return player.outputChatBox('!{#e74c3c}Nepavyko pakviesti zaidejo.');
        applyFactionData(target, def.key, 1, false);
        player.outputChatBox(`!{#7aa164}${target.charName} priimtas i ${def.label}.`);
        target.outputChatBox(`!{#5dade2}Jus priimtas i ${def.label}. Rank: ${getFactionRankName(def.key, 1)}.`);
    });
});

mp.events.addCommand('funinvite', (player, fullText, targetNameOrID) => {
    const def = requireFactionLeader(player);
    if (!def) return;
    if (!targetNameOrID) return sendUsageInstructions(player, 'funinvite');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target.factionKey !== def.key) return player.outputChatBox('!{#f7dc6f}Zaidejas nera jusu faction narys.');
    if (target.factionLeader) return player.outputChatBox('!{#e74c3c}Negalite ismesti leader.');

    updateCharacterFaction(target.charId, null, 0, false, (err) => {
        if (err) return player.outputChatBox('!{#e74c3c}Nepavyko ismesti zaidejo.');
        applyFactionData(target, null, 0, false);
        setPlayerCuffed(target, false);
        player.outputChatBox(`!{#7aa164}${target.charName} ismestas is ${def.label}.`);
        target.outputChatBox(`!{#f7dc6f}Jus ismestas is ${def.label}.`);
    });
});

mp.events.addCommand('frank', (player, fullText, targetNameOrID, rankArg) => {
    const def = requireFactionLeader(player);
    if (!def) return;
    if (!targetNameOrID || !rankArg) return sendUsageInstructions(player, 'frank');

    const rank = parseInt(rankArg, 10);
    if (!Number.isInteger(rank) || rank < 1 || rank > def.leaderRank) {
        return player.outputChatBox(`!{#f7dc6f}Rank turi buti nuo 1 iki ${def.leaderRank}.`);
    }

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target.factionKey !== def.key) return player.outputChatBox('!{#f7dc6f}Zaidejas nera jusu faction narys.');
    if (target.factionLeader && target !== player) return player.outputChatBox('!{#e74c3c}Kito leader rank nekeiciamas.');

    updateCharacterFaction(target.charId, def.key, rank, target.factionLeader, (err) => {
        if (err) return player.outputChatBox('!{#e74c3c}Nepavyko pakeisti rank.');
        applyFactionData(target, def.key, rank, target.factionLeader);
        player.outputChatBox(`!{#7aa164}${target.charName} rank pakeistas i ${rank} (${getFactionRankName(def.key, rank)}).`);
        target.outputChatBox(`!{#5dade2}Jusu ${def.shortLabel} rank: ${getFactionRankName(def.key, rank)}.`);
    });
});

mp.events.addCommand('frankname', (player, fullText, rankArg, ...nameParts) => {
    const def = requireFactionLeader(player);
    if (!def) return;
    if (!rankArg || nameParts.length === 0) return sendUsageInstructions(player, 'frankname');

    const rank = parseInt(rankArg, 10);
    const rankName = nameParts.join(' ');
    setFactionRankName(def.key, rank, rankName, (err) => {
        if (err) return player.outputChatBox('!{#e74c3c}Nepavyko pakeisti rank pavadinimo.');
        sendFactionMessage(def.key, `!{#5dade2}${def.shortLabel} rank ${rank} dabar vadinasi: ${getFactionRankName(def.key, rank)}.`);
    });
});

mp.events.addCommand('duty', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const def = getPlayerFactionDef(player);
    if (!def) return player.outputChatBox('!{#f7dc6f}Jus nesate faction narys.');

    player.factionDuty = !player.factionDuty;
    player.outputChatBox(`!{#5dade2}${def.shortLabel} duty: ${player.factionDuty ? 'ON' : 'OFF'}.`);
    sendFactionMessage(def.key, `!{#d6eaf8}${player.charName} ${player.factionDuty ? 'pradejo' : 'baige'} darba.`);
});

mp.events.addCommand('badge', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const def = getPlayerFactionDef(player);
    if (!def) return player.outputChatBox('!{#f7dc6f}Jus neturite badge.');
    const text = `${def.label} | ${getFactionRankName(player.factionKey, player.factionRank)} | ${player.charName}`;
    player.outputChatBox(`!{#5dade2}Parodete badge: ${text}`);
    mp.players.toArray().forEach((target) => {
        if (target !== player && target.charName && getDistanceBetweenPositions(player.position, target.position) <= FACTION_INTERACT_RADIUS) {
            target.outputChatBox(`!{#5dade2}${player.charName} parodo badge: ${text}`);
        }
    });
});

mp.events.addCommand('panic', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const def = getPlayerFactionDef(player);
    if (!def) return player.outputChatBox('!{#f7dc6f}Tik PD/MD gali naudoti panic.');
    const pos = player.position || { x: 0, y: 0, z: 0 };
    sendEmergencyMessage(`!{#e74c3c}[PANIC] ${def.shortLabel} ${player.charName}: X ${pos.x.toFixed(1)}, Y ${pos.y.toFixed(1)}, Z ${pos.z.toFixed(1)}.`);
});

function handleCuffCommand(player, fullText, targetNameOrID, forceState = null) {
    if (!requireFactionMember(player, 'pd', true)) return;
    if (!targetNameOrID) return sendUsageInstructions(player, 'cuf');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target === player) return player.outputChatBox('!{#f7dc6f}Negalite surakinti saves.');
    if (getDistanceBetweenPositions(player.position, target.position) > FACTION_INTERACT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Turite buti salia zaidejo.');
    }

    const newState = forceState === null ? !target.isCuffed : Boolean(forceState);
    setPlayerCuffed(target, newState, player);
    player.outputChatBox(`!{#5dade2}${newState ? 'Surakinote' : 'Atrakinote'} ${target.charName}.`);
    target.outputChatBox(`!{#f7dc6f}${player.charName} jus ${newState ? 'surakino' : 'atrakino'}.`);
}

mp.events.addCommand('cuf', (player, fullText, targetNameOrID) => handleCuffCommand(player, fullText, targetNameOrID));
mp.events.addCommand('cuff', (player, fullText, targetNameOrID) => handleCuffCommand(player, fullText, targetNameOrID, true));
mp.events.addCommand('uncuff', (player, fullText, targetNameOrID) => handleCuffCommand(player, fullText, targetNameOrID, false));

mp.events.addCommand('jail', (player, fullText, targetNameOrID, minutesArg, ...reasonParts) => {
    if (!requireFactionMember(player, 'pd', true)) return;
    if (!targetNameOrID || !minutesArg) return sendUsageInstructions(player, 'jail');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (!isNearPdJailCells(player)) {
        return player.outputChatBox('!{#f7dc6f}/jail galima naudoti tik prie PD kameru.');
    }
    if (!isNearPdJailCells(target)) {
        return player.outputChatBox('!{#f7dc6f}Atveskite zaideja prie PD kameru pries /jail.');
    }
    if (getDistanceBetweenPositions(player.position, target.position) > FACTION_INTERACT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Turite buti salia zaidejo.');
    }
    const minutes = Math.max(1, Math.min(60, parseInt(minutesArg, 10) || 0));
    const reason = reasonParts.join(' ').trim() || 'No reason';

    clearDeathState(target, true);
    setPlayerCuffed(target, false);
    target.isJailed = true;
    target.jailedUntil = Date.now() + minutes * 60000;
    target.dimension = 0;
    target.position = PD_JAIL_POS;
    target.heading = PD_JAIL_HEADING;
    if (target.jailTimer) clearTimeout(target.jailTimer);
    target.jailTimer = setTimeout(() => releasePlayerFromJail(target, true), minutes * 60000);

    player.outputChatBox(`!{#5dade2}${target.charName} uzdarytas ${minutes} min. Priezastis: ${reason}`);
    target.outputChatBox(`!{#e74c3c}Jus uzdarytas i PD kamera ${minutes} min. Priezastis: ${reason}`);
});

mp.events.addCommand('unjail', (player, fullText, targetNameOrID) => {
    if (!requireFactionMember(player, 'pd', true)) return;
    if (!targetNameOrID) return player.outputChatBox('!{#f7dc6f}Naudojimas: /unjail [ID arba vardas]');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (!target.isJailed) return player.outputChatBox('!{#f7dc6f}Zaidejas nera PD kameroje.');
    releasePlayerFromJail(target, true);
    player.outputChatBox(`!{#7aa164}${target.charName} paleistas.`);
});

mp.events.addCommand('fine', (player, fullText, targetNameOrID, amountArg, ...reasonParts) => {
    if (!requireFactionMember(player, 'pd', true)) return;
    if (!targetNameOrID || !amountArg || reasonParts.length === 0) return sendUsageInstructions(player, 'fine');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target === player) return player.outputChatBox('!{#f7dc6f}Negalite israsyti baudos sau.');
    if (getDistanceBetweenPositions(player.position, target.position) > FACTION_INTERACT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Turite buti salia zaidejo.');
    }

    const parsedAmount = parseInt(amountArg, 10);
    if (!Number.isInteger(parsedAmount) || parsedAmount < POLICE_FINE_MIN_AMOUNT || parsedAmount > POLICE_FINE_MAX_AMOUNT) {
        return player.outputChatBox(`!{#f7dc6f}Baudos suma turi buti nuo $${POLICE_FINE_MIN_AMOUNT} iki $${POLICE_FINE_MAX_AMOUNT}.`);
    }

    const reason = reasonParts.join(' ').trim().replace(/\s+/g, ' ').slice(0, 128);
    if (reason.length < 3) return player.outputChatBox('!{#f7dc6f}Irasykite baudos priezasti.');

    const currentMoney = Math.max(0, parseInt(target.money, 10) || 0);
    const currentBank = Math.max(0, parseInt(target.bankBalance, 10) || 0);
    if ((currentMoney + currentBank) < parsedAmount) {
        return player.outputChatBox('!{#f7dc6f}Zaidejas neturi pakankamai lesu sios baudos apmokejimui.');
    }

    const paidFromCash = Math.min(currentMoney, parsedAmount);
    const paidFromBank = parsedAmount - paidFromCash;
    target.money = currentMoney - paidFromCash;
    target.bankBalance = currentBank - paidFromBank;
    persistPlayerMoney(target);
    persistPlayerBankBalance(target);

    db.query('INSERT INTO police_fines (char_id, suspect_name, officer_char_id, officer_name, amount, reason, paid_from_cash, paid_from_bank) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [target.charId, target.charName, player.charId || null, player.charName, parsedAmount, reason, paidFromCash, paidFromBank], (err) => {
        if (err) {
            console.error('[PD] Failed to save fine:', err.message);
        }
    });

    player.outputChatBox(`!{#7aa164}Israsete ${target.charName} bauda $${parsedAmount}. Priezastis: ${reason}`);
    target.outputChatBox(`!{#e67e22}${player.charName} israse jums bauda $${parsedAmount}. Priezastis: ${reason}`);
    target.outputChatBox(`!{#f7dc6f}Nuskaityta: cash $${paidFromCash}, bank $${paidFromBank}.`);
});

mp.events.addCommand('mdc', (player, fullText) => {
    if (!requirePoliceMdcAccess(player)) return;

    const args = splitCommandText(fullText);
    const subcommand = String(args.shift() || 'help').toLowerCase();

    if (subcommand === 'help') return showPoliceMdcHelp(player);
    if (subcommand === 'person') {
        if (!args[0]) return showPoliceMdcHelp(player);
        return handlePoliceMdcPersonLookup(player, args[0]);
    }
    if (subcommand === 'plate') {
        if (!args[0]) return showPoliceMdcHelp(player);
        return handlePoliceMdcPlateLookup(player, args[0]);
    }
    if (subcommand === 'warrant') {
        if (args.length < 2) return showPoliceMdcHelp(player);
        return handlePoliceMdcWarrantCreate(player, args.shift(), args.join(' '));
    }
    if (subcommand === 'warrants') {
        if (!args[0]) return showPoliceMdcHelp(player);
        return handlePoliceMdcWarrantList(player, args[0]);
    }
    if (subcommand === 'clear') {
        if (!args[0]) return showPoliceMdcHelp(player);
        return handlePoliceMdcWarrantClear(player, args[0]);
    }

    showPoliceMdcHelp(player);
});

mp.events.addCommand('revive', (player, fullText, targetNameOrID) => {
    if (!requireFactionMember(player, 'md', true)) return;
    if (!targetNameOrID) return sendUsageInstructions(player, 'revive');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (!target.isDowned) return player.outputChatBox('!{#f7dc6f}Zaidejas nera deathstate. Jei naudojo /acceptdeath, revive nebegalimas.');
    if (getDistanceBetweenPositions(player.position, target.position) > FACTION_INTERACT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Turite buti salia paciento.');
    }

    clearDeathState(target, true);
    target.health = MD_REVIVE_HEALTH;
    target.outputChatBox(`!{#7aa164}${player.charName} jus atgaivino. Sveikata: ${MD_REVIVE_HEALTH}.`);
    player.outputChatBox(`!{#7aa164}Atgaivinote ${target.charName}.`);
    db.query('UPDATE characters SET health = ? WHERE id = ?', [target.health, target.charId]);
});

mp.events.addCommand('treat', (player, fullText, targetNameOrID) => {
    if (!requireFactionMember(player, 'md', true)) return;
    if (!targetNameOrID) return player.outputChatBox('!{#f7dc6f}Naudojimas: /treat [ID arba vardas]');

    const target = getPlayerByIDOrName(targetNameOrID);
    if (!target || !target.charName) return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    if (target.isDowned) return player.outputChatBox('!{#f7dc6f}Downed zaidejui naudokite /revive.');
    if (getDistanceBetweenPositions(player.position, target.position) > FACTION_INTERACT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Turite buti salia paciento.');
    }

    target.health = Math.min(100, Math.max(1, parseInt(target.health, 10) || 1) + MD_TREAT_AMOUNT);
    player.outputChatBox(`!{#7aa164}Pagydete ${target.charName}. Sveikata: ${target.health}.`);
    target.outputChatBox(`!{#7aa164}${player.charName} jus pagyde. Sveikata: ${target.health}.`);
    db.query('UPDATE characters SET health = ? WHERE id = ?', [target.health, target.charId]);
});

mp.events.addCommand('911', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const args = splitCommandText(fullText);
    const type = String(args.shift() || '').toLowerCase();
    const message = args.join(' ').trim();
    if (!['pd', 'md', 'both'].includes(type) || message.length < 3) return sendUsageInstructions(player, '911');

    const reportId = nextEmergencyReportId++;
    const pos = player.position || { x: 0, y: 0, z: 0 };
    const report = {
        id: reportId,
        type,
        caller: player,
        callerCharId: player.charId,
        callerName: player.charName,
        message,
        position: { x: pos.x, y: pos.y, z: pos.z },
        createdAt: Date.now(),
        responder: null,
    };
    activeEmergencyReports.set(reportId, report);

    const formatted = `!{#e74c3c}[911 #${reportId}] ${type.toUpperCase()} | ${player.charName}: ${message} | X ${pos.x.toFixed(1)}, Y ${pos.y.toFixed(1)}, Z ${pos.z.toFixed(1)} | /respond ${reportId}`;
    let sent = 0;
    mp.players.toArray().forEach((target) => {
        if (!target.charName) return;
        const matches = type === 'both' || target.factionKey === type;
        if (matches && (target.factionKey === 'pd' || target.factionKey === 'md')) {
            target.outputChatBox(formatted);
            sent += 1;
        }
    });

    player.outputChatBox(`!{#7aa164}911 pranesimas #${reportId} issiustas. Online tarnybos: ${sent}.`);
});

mp.events.addCommand('respond', (player, fullText, reportIdArg) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!player.factionDuty || (player.factionKey !== 'pd' && player.factionKey !== 'md')) {
        return player.outputChatBox('!{#f7dc6f}Tik on-duty PD/MD gali priimti 911.');
    }

    const reportId = parseInt(reportIdArg, 10);
    const report = activeEmergencyReports.get(reportId);
    if (!report) return player.outputChatBox('!{#f7dc6f}911 pranesimas nerastas.');
    if (report.type !== 'both' && report.type !== player.factionKey) return player.outputChatBox('!{#f7dc6f}Sis iskvietimas skirtas kitai tarnybai.');
    if (report.responder) return player.outputChatBox(`!{#f7dc6f}911 #${reportId} jau prieme ${report.responder}.`);

    report.responder = player.charName;
    player.outputChatBox(`!{#7aa164}Priemete 911 #${reportId}: ${report.message}. Vieta X ${report.position.x.toFixed(1)}, Y ${report.position.y.toFixed(1)}.`);
    if (report.caller && report.caller.charName && report.caller.charId === report.callerCharId) {
        report.caller.outputChatBox(`!{#5dade2}911 #${reportId}: ${player.charName} prieme jusu iskvietima.`);
    }

    setTimeout(() => activeEmergencyReports.delete(reportId), 600000);
});

mp.events.addCommand('pay', (player, fullText, targetNameOrID, amountStr) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetNameOrID || !amountStr) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pay [ID arba vardas] [suma]');
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return player.outputChatBox('!{#f7dc6f}Prasome nurodyti galiojancia suma.');
    }

    const targetPlayer = getPlayerByIDOrName(targetNameOrID);
    if (!targetPlayer) {
        return player.outputChatBox('!{#f7dc6f}Zaidejas nerastas!');
    }

    if (!targetPlayer.charName) {
        return player.outputChatBox('!{#e74c3c}Zaidejas dar nepasirinko veikejo.');
    }

    if (player === targetPlayer) {
        return player.outputChatBox('!{#f7dc6f}Negalite pervesti pinigu patys sau!');
    }

    const distance = getDistanceBetweenPositions(player.position, targetPlayer.position);
    if (distance > 5) {
        return player.outputChatBox('!{#f7dc6f}Jus turite buti salia kito zaidejo, kad atliktumete pervedima.');
    }

    if (player.money < amount) {
        return player.outputChatBox('!{#f7dc6f}Jus neturite pakankamai pinigu!');
    }

    player.money -= amount;
    targetPlayer.money += amount;

    player.call('updateMoneyHUD', [player.money]);
    targetPlayer.call('updateMoneyHUD', [targetPlayer.money]);

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#f7dc6f}Ivyko klaida atnaujinant jusu paskyra.');
        }
    });

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [targetPlayer.money, targetPlayer.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#f7dc6f}Ivyko klaida atnaujinant gavejo paskyra.');
            return;
        }
        player.outputChatBox(`!{#f7dc6f}Jus pervedete $${amount} zaidejui ${targetPlayer.charName}.`);
        targetPlayer.outputChatBox(`!{#f7dc6f}Jus gavote $${amount} is zaidejo ${player.charName}.`);
    });
});

mp.events.addCommand('togglepm', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    player.isPMEnabled = !player.isPMEnabled;

    if (player.isPMEnabled) {
        player.outputChatBox('!{#27AE60}Jus ijungete privacias zinutes.');
    } else {
        player.outputChatBox('!{#E74C3C}Jus isjungete privacias zinutes.');
    }

    db.query('UPDATE characters SET is_pm_enabled = ? WHERE char_name = ?', [player.isPMEnabled ? 1 : 0, player.charName], (err) => {
        if (err) {
            console.error(err);
            player.outputChatBox('!{#E74C3C}Ivyko klaida atnaujinant jusu privacias zinutes.');
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
        dlc: entry.dlc || null,
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
    const modelHash = Number.isFinite(Number(selected.hash))
        ? Number(selected.hash)
        : (typeof mp.joaat === 'function' ? mp.joaat(selected.model) : selected.model);

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
                fuel: VEHICLE_FUEL_MAX,
                parked: 0,
                parkX: DEALERSHIP_PURCHASE_SPAWN_POS.x,
                parkY: DEALERSHIP_PURCHASE_SPAWN_POS.y,
                parkZ: DEALERSHIP_PURCHASE_SPAWN_POS.z,
                parkH: DEALERSHIP_DELIVERY_HEADING,
                locked: 0,
                plate,
                weaponInventory: [],
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

    player.outputChatBox('!{#f4d03f}===== Jusu garazas (Asmeninis) =====');

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

    // Match by RAGE MP entity .id - object reference (===) is unreliable across property accesses.
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
        return player.outputChatBox(`!{#e74c3c}Turite buti prie sio transporto parkavimo zonos. Dabar esate ~${Math.round(parkDist)}m nutole.`);
    }

    player.removeFromVehicle();
    parkOwnedVehicle(record, vPos, vHeading, player);
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
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /get [id] - ispawnina jusu transporta. Pavyzdys: /get 1');
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

    clearOwnedVehicleBlipForPlayer(player);
    record.blip = true;
    showOwnedVehicleBlipForPlayer(player, record, spawnPos);

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
        // Compare by RAGE MP entity .id - object reference (===) is unreliable.
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
        player.outputChatBox(`!{#e67e22}Uzrakinote ${record.displayName}.`);
    } else {
        player.outputChatBox(`!{#7aa164}Atrakinote ${record.displayName}.`);
    }
});

mp.events.addCommand('scrap', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte, kad ji supjautytumete.');
    }

    if (player.seat !== -1 && player.seat !== 0) {
        return player.outputChatBox('!{#e74c3c}Turite buti sio transporto vairuotoju.');
    }

    // Get the vehicle record
    const record = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    // Get the vehicle model from catalog to find price
    const catalogEntry = vehicleCatalogByKey.get(record.model);
    if (!catalogEntry) {
        return player.outputChatBox('!{#e74c3c}Sio transporto modelio negalima supjaustyti.');
    }

    // Calculate 40% of the dealership price
    const scrapPrice = Math.floor(catalogEntry.price * 0.4);
    const vehicleDisplayName = record.displayName;
    const vehicleId = record.id;

    // Store pending scrap for confirmation
    player.pendingScrap = {
        vehicleId: vehicleId,
        vehicleDisplayName: vehicleDisplayName,
        scrapPrice: scrapPrice,
        record: record
    };

    player.outputChatBox(`!{#f7dc6f}Ar tikrai norite supjaustyt ${vehicleDisplayName} ir gauti $${scrapPrice}?`);
    player.outputChatBox(`!{#f7dc6f}Patvirtinkite: /scrapconfirm`);
});

mp.events.addCommand('scrapconfirm', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.pendingScrap) {
        return player.outputChatBox('!{#e74c3c}Jus neturite laukiancio supjaustymo.');
    }

    const { vehicleId, vehicleDisplayName, scrapPrice, record } = player.pendingScrap;
    player.pendingScrap = null;

    // Add money to player
    player.money += scrapPrice;

    // Destroy vehicle
    try {
        if (player.vehicle === record.entity) {
            player.removeFromVehicle();
        }
        if (record.entity) record.entity.destroy();
    } catch (e) {
        console.error('[VEHICLES] Scrap error:', e.message);
    }

    // Remove from inventory
    ensureOwnedVehicleState(player);
    player.ownedVehicles.delete(vehicleId);

    db.query('DELETE FROM player_vehicles WHERE id = ?', [vehicleId]);
    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);

    player.call('updateMoneyHUD', [player.money]);
    player.outputChatBox(`!{#7aa164}Supjautete ${vehicleDisplayName} ir gavote $${scrapPrice}.`);
});

mp.events.addCommand('sellto', (player, _, targetIdStr, priceStr) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!targetIdStr || !priceStr) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /sellto [ID] [Kaina]');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte, noredami parduoti.');
    }

    if (player.seat !== -1 && player.seat !== 0) {
        return player.outputChatBox('!{#e74c3c}Turite buti sio transporto vairuotovu.');
    }

    // Get target player
    const targetPlayer = getPlayerByIDOrName(targetIdStr);
    if (!targetPlayer) {
        return player.outputChatBox('!{#e74c3c}Zaidejas nerastas!');
    }

    if (!targetPlayer.charName) {
        return player.outputChatBox('!{#e74c3c}Zaidejas dar nepasirinko veikejo.');
    }

    if (targetPlayer === player) {
        return player.outputChatBox('!{#f7dc6f}Negalite parduoti transporto sau!');
    }

    // Check distance
    const distance = getDistanceBetweenPositions(player.position, targetPlayer.position);
    if (distance > 10) {
        return player.outputChatBox('!{#f7dc6f}Zaidejas yra per toli. Turi buti salia jusu.');
    }

    // Parse price
    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) {
        return player.outputChatBox('!{#f7dc6f}Prasome nurodyti galiojancia kaina (daugiau nei 0).');
    }

    // Get vehicle record
    const record = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    // Check if buyer has enough money
    if (targetPlayer.money < price) {
        return player.outputChatBox(`!{#e74c3c}Zaidejas neturi pakankamai pinigu. Jei turi: $${targetPlayer.money}`);
    }

    // Store data before modifications
    const vehicleDisplayName = record.displayName;
    const vehicleId = record.id;

    // Transfer money
    player.money += price;
    targetPlayer.money -= price;

    // Update vehicle ownership
    record.charId = targetPlayer.charId;

    // Update inventories
    ensureOwnedVehicleState(player);
    ensureOwnedVehicleState(targetPlayer);
    player.ownedVehicles.delete(vehicleId);
    targetPlayer.ownedVehicles.set(vehicleId, record);

    // Remove seller from vehicle and park it
    try {
        player.removeFromVehicle();
    } catch (e) {
        console.error('[VEHICLES] Sellto error:', e.message);
    }
    parkOwnedVehicle(record, undefined, DEALERSHIP_DELIVERY_HEADING, player);
    clearOwnedVehicleBlipForPlayer(targetPlayer);

    // Update database
    db.query('UPDATE player_vehicles SET char_id = ? WHERE id = ?', [targetPlayer.charId, vehicleId]);
    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [targetPlayer.money, targetPlayer.charName]);

    // Update HUDs
    player.call('updateMoneyHUD', [player.money]);
    targetPlayer.call('updateMoneyHUD', [targetPlayer.money]);

    // Notify both players
    player.outputChatBox(`!{#7aa164}Pardavete ${vehicleDisplayName} zaidejui ${targetPlayer.charName} uz $${price}.`);
    targetPlayer.outputChatBox(`!{#7aa164}Nusipirkote ${vehicleDisplayName} is zaidejo ${player.charName} uz $${price}.`);
});

mp.events.addCommand('properties', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!propertiesLoaded) {
        return player.outputChatBox('!{#f7dc6f}Property sistema dar kraunasi. Bandykite po keliu sekundziu.');
    }

    player.outputChatBox('!{#85c1e9}===== Server Properties =====');

    if (propertiesById.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Siuo metu property sarasas tuscias.');
    }

    propertiesById.forEach((property) => {
        const ownerLabel = property.ownerCharId ? formatPropertyOwner(property) : 'Server';
        const rentLabel = Math.max(0, parseInt(property.settings?.rentPerPaycheck, 10) || 0);
        player.outputChatBox(`!{#d6eaf8}[${property.id}] ${property.name} | $${property.price} | Savininkas: ${ownerLabel} | Nuoma: $${rentLabel}`);
    });
});

mp.events.addCommand('buyproperty', (player, _, propertyIdRaw, paymentMethodRaw = 'bank') => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!propertiesLoaded) {
        return player.outputChatBox('!{#f7dc6f}Property sistema dar kraunasi. Bandykite po keliu sekundziu.');
    }

    if (!propertyIdRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /buyproperty [property ID] [cash|bank]');
    }

    const property = getPropertyById(propertyIdRaw);
    if (!property) {
        return player.outputChatBox('!{#e74c3c}Property pagal nurodyta ID nerastas.');
    }

    const nearbyProperty = getNearbyProperty(player, PROPERTY_INTERACT_RADIUS);
    if (!nearbyProperty || nearbyProperty.id !== property.id) {
        return player.outputChatBox('!{#e74c3c}Turite stoveti prie sio property iejimo.');
    }

    if (property.ownerCharId) {
        return player.outputChatBox(`!{#e74c3c}Sis property jau parduotas (${formatPropertyOwner(property)}).`);
    }

    const paymentMethod = String(paymentMethodRaw || 'bank').trim().toLowerCase() === 'cash' ? 'cash' : 'bank';
    const availableFunds = paymentMethod === 'cash' ? (player.money || 0) : (player.bankBalance || 0);

    if (availableFunds < property.price) {
        return player.outputChatBox(`!{#e74c3c}Nepakanka lesu. Truksta $${property.price - availableFunds}.`);
    }

    if (paymentMethod === 'cash') {
        player.money -= property.price;
        player.call('updateMoneyHUD', [player.money]);
        db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);
    } else {
        player.bankBalance -= property.price;
        player.call('updateBankHUD', [player.bankBalance]);
        db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
    }

    property.ownerCharId = player.charId;
    property.ownerCharName = player.charName;
    clearTenantFromProperty(property);
    property.inventory = [];
    property.settings = getDefaultPropertySettings();
    persistPropertyState(property);

    // Show blip to new owner
    showOwnedPropertyBlipForPlayer(player, property);

    player.outputChatBox(`!{#7aa164}Nusipirkote ${property.name} uz $${property.price} (${paymentMethod}).`);
    sendPropertyInfo(player, property);
});

mp.events.addCommand('house', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!propertiesLoaded) {
        return player.outputChatBox('!{#f7dc6f}Property sistema dar kraunasi.');
    }

    const insideProperty = getPlayerCurrentProperty(player);
    if (insideProperty) {
        sendPropertyInfo(player, insideProperty);
        return;
    }

    const nearbyProperty = getNearbyProperty(player, 12.0);
    if (!nearbyProperty) {
        return player.outputChatBox('!{#f7dc6f}Salia nera property. Naudokite /properties.');
    }

    sendPropertyInfo(player, nearbyProperty);
});

mp.events.addCommand('enterhouse', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!propertiesLoaded) {
        return player.outputChatBox('!{#f7dc6f}Property sistema dar kraunasi.');
    }

    if (player.vehicle) {
        return player.outputChatBox('!{#e74c3c}I property vidu su transportu ivaziuoti negalima.');
    }

    if (Number(player.dimension) !== 0) {
        return player.outputChatBox('!{#f7dc6f}Jau esate property viduje. Naudokite /exithouse.');
    }

    const property = getNearbyProperty(player, PROPERTY_INTERACT_RADIUS);
    if (!property) {
        return player.outputChatBox('!{#e74c3c}Nesate prie property iejimo.');
    }

    if (!property.ownerCharId) {
        return player.outputChatBox('!{#f7dc6f}Sis property neparduotas. Naudokite /buyproperty.');
    }

    if (isPropertyLocked(property)) {
        return player.outputChatBox('!{#e74c3c}Property uzrakintas.');
    }

    movePlayerIntoProperty(player, property);

    player.outputChatBox(`!{#7aa164}Iejote i ${property.name}.`);
});

mp.events.addCommand('enter', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!propertiesLoaded && !businessesLoaded) {
        return player.outputChatBox('!{#f7dc6f}Interjeru sistema dar kraunasi.');
    }

    if (player.vehicle) {
        return player.outputChatBox('!{#e74c3c}I vidu su transportu ivaziuoti negalima.');
    }

    if (Number(player.dimension) !== 0) {
        return player.outputChatBox('!{#f7dc6f}Jau esate viduje. Naudokite /exit.');
    }

    const closestTarget = getClosestEnterTarget(player);
    if (!closestTarget) {
        return player.outputChatBox('!{#e74c3c}Nesate prie jokio iejimo.');
    }

    if (closestTarget.kind === 'business') {
        movePlayerIntoBusiness(player, closestTarget.target);
        return player.outputChatBox(`!{#7aa164}Iejote i ${closestTarget.target.name}.`);
    }

    const property = closestTarget.target;

    if (!property.ownerCharId) {
        return player.outputChatBox('!{#f7dc6f}Sis property neparduotas. Naudokite /buyproperty.');
    }

    if (isPropertyLocked(property)) {
        return player.outputChatBox('!{#e74c3c}Property uzrakintas.');
    }

    movePlayerIntoProperty(player, property);
    player.outputChatBox(`!{#7aa164}Iejote i ${property.name}.`);
});

mp.events.addCommand('exithouse', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const property = getPlayerCurrentProperty(player);
    if (!property) {
        return player.outputChatBox('!{#f7dc6f}Nesate jokio property viduje.');
    }

    const exitDistance = getDistanceBetweenPositions(player.position, property.exitPos);
    if (exitDistance > 6.0) {
        return player.outputChatBox('!{#f7dc6f}Prieikite prie isejimo tasko property viduje.');
    }

    player.dimension = 0;
    player.position = property.entryPos;
    player.heading = property.entryHeading;
    player.currentPropertyId = null;
    player.currentBusinessId = null;

    player.outputChatBox(`!{#7aa164}Isejote is ${property.name}.`);
});

mp.events.addCommand('exit', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const property = getPlayerCurrentProperty(player);
    if (property) {
        const exitDistance = getDistanceBetweenPositions(player.position, property.exitPos);
        if (exitDistance > 6.0) {
            return player.outputChatBox('!{#f7dc6f}Prieikite prie isejimo tasko property viduje.');
        }

        player.dimension = 0;
        player.position = property.entryPos;
        player.heading = property.entryHeading;
        player.currentPropertyId = null;
        player.currentBusinessId = null;

        return player.outputChatBox(`!{#7aa164}Isejote is ${property.name}.`);
    }

    const business = getPlayerCurrentBusiness(player);
    if (!business) {
        return player.outputChatBox('!{#f7dc6f}Nesate jokio property ar verslo viduje.');
    }

    const exitDistance = getDistanceBetweenPositions(player.position, business.exitPos);
    if (exitDistance > BUSINESS_EXIT_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Prieikite prie verslo isejimo tasko.');
    }

    movePlayerOutOfBusiness(player, business);
    player.currentPropertyId = null;
    player.outputChatBox(`!{#7aa164}Isejote is ${business.name}.`);
});

mp.events.addCommand('buy', (player, fullText) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const currentBusiness = getPlayerCurrentBusiness(player);
    const nearbyBusiness = currentBusiness ? null : getNearbyBusinessByInteractRadius(player, BUSINESS_INTERACT_RADIUS_MAX);
    const business = currentBusiness || nearbyBusiness;
    const isAt247Register = Boolean(getNearbyStatic247ShopRegister(player));

    let productList = [];
    if (business) {
        const typeDef = getBusinessTypeDefinition(business.type);
        if (!typeDef || !typeDef.buyEnabled) {
            return player.outputChatBox('!{#f7dc6f}Siame versle pirkimas dar neijungtas.');
        }
        productList = getBusinessProductList(business);
    } else if (isAt247Register) {
        productList = Array.isArray(BUSINESS_TYPE_DEFS.shop.products) ? BUSINESS_TYPE_DEFS.shop.products : [];
    } else {
        return player.outputChatBox('!{#f7dc6f}Pirkti galite budami verslo viduje arba prie 24/7 kasos.');
    }

    const args = String(fullText || '').trim().split(/\s+/).filter(Boolean);
    const productRaw = args[0];
    const amount = Math.max(1, parseInt(args[1], 10) || 1);

    if (!productRaw) {
        const offers = productList
            .map(product => `${product.key} ($${product.price})`)
            .join(', ');
        return player.outputChatBox(`!{#f7dc6f}Naudojimas: /buy [item] [kiekis]. Galite pirkti: ${offers}`);
    }

    const normalizedType = normalizeInventoryItemType(productRaw) || String(productRaw || '').trim().toLowerCase();
    const product = productList.find(entry => entry.key === normalizedType || entry.itemType === normalizedType) || null;
    if (!product) {
        const offers = productList
            .map(entry => entry.key)
            .join(', ');
        return player.outputChatBox(`!{#e74c3c}Sioje vietoje neparduodamas sis daiktas. Galimi: ${offers}`);
    }

    const totalPrice = Math.max(1, amount) * product.price;
    if ((player.money || 0) < totalPrice) {
        return player.outputChatBox(`!{#e74c3c}Nepakanka grynuju. Reikia $${totalPrice}, turite $${player.money || 0}.`);
    }

    if (product.itemType === 'simcard') {
        if (hasPhoneSim(player)) {
            return player.outputChatBox('!{#f7dc6f}Jusu telefonas jau turi aktyvia SIM kortele.');
        }

        generateUniquePhoneNumber((error, generatedPhoneNumber) => {
            if (error || !generatedPhoneNumber) {
                console.error('[PHONE] Failed to generate SIM phone number:', error ? error.message : 'unknown');
                player.outputChatBox('!{#e74c3c}Nepavyko aktyvuoti SIM korteles. Bandykite veliau.');
                return;
            }

            db.query('UPDATE characters SET phone_number = ? WHERE id = ?', [generatedPhoneNumber, player.charId], (updateErr) => {
                if (updateErr) {
                    console.error('[PHONE] Failed to persist phone number from SIM purchase:', updateErr.message);
                    player.outputChatBox('!{#e74c3c}Nepavyko issaugoti telefono numerio. Bandykite veliau.');
                    return;
                }

                player.phoneNumber = generatedPhoneNumber;
                player.money -= totalPrice;
                persistPlayerMoney(player);
                player.call('updatePhoneNumber', [generatedPhoneNumber]);

                if (business) {
                    business.bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0) + totalPrice;
                    persistBusinessState(business);
                    player.outputChatBox(`!{#7aa164}Nusipirkote SIM kortele uz $${totalPrice} versle ${business.name}. Jusu numeris: ${generatedPhoneNumber}.`);
                } else {
                    player.outputChatBox(`!{#7aa164}Nusipirkote SIM kortele uz $${totalPrice}. Jusu numeris: ${generatedPhoneNumber}.`);
                }
            });
        });

        return;
    }

    if (!Array.isArray(player.inventory)) {
        player.inventory = [];
    }

    const item = addInventoryItem(player, product.itemType, amount);
    if (!item) {
        return player.outputChatBox('!{#e74c3c}Nepavyko prideti daikto i inventoriu.');
    }

    player.money -= totalPrice;
    persistPlayerMoney(player);
    persistInventory(player);
    if (business) {
        business.bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0) + totalPrice;
        persistBusinessState(business);
    }

    if (business) {
        player.outputChatBox(`!{#7aa164}Nusipirkote ${amount}x ${product.label} uz $${totalPrice} versle ${business.name}.`);
    } else {
        player.outputChatBox(`!{#7aa164}Nusipirkote ${amount}x ${product.label} uz $${totalPrice} prie 24/7 kasos.`);
    }
});

mp.events.addCommand('pawnstock', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const business = getPawnShopBusinessForPlayer(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#f7dc6f}Pawn stock galite perziureti tik lombardo viduje arba prie jo iejimo zonos.');
    }

    openPawnShopForPlayer(player, business, '', true, false);
});

mp.events.addCommand('pawnsell', (player, _, itemId) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!itemId) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pawnsell [inventory item ID]');
    }

    const business = getPawnShopBusinessForPlayer(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#f7dc6f}Daiktus parduoti galite tik lombardo viduje arba prie jo iejimo zonos.');
    }

    if (!business.ownerCharId) {
        return player.outputChatBox('!{#e74c3c}Sis lombardas neturi savininko.');
    }

    const itemEntry = findInventoryItemByToken(player, itemId);
    if (!itemEntry) {
        return sendInventoryUpdate(player, 'Toks daiktas inventoriuje nerastas.', false);
    }

    const item = itemEntry.item;
    if (!isPawnableInventoryItem(item)) {
        return sendInventoryUpdate(player, 'Lombardas sio daikto nesuperka.', false);
    }

    const originalPrice = getPawnOriginalPrice(item);
    const buyPrice = Math.max(1, Math.floor(originalPrice * PAWN_AUTO_SELL_RATE));
    const bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0);
    if (bankBalance < buyPrice) {
        return player.outputChatBox(`!{#e74c3c}Lombardo banke nepakanka lesu. Reikia $${buyPrice}, yra $${bankBalance}.`);
    }

    const stockItem = {
        stockId: generateInventoryItemId(),
        type: item.type,
        name: sanitizeInventoryItemName(item.name, INVENTORY_ITEM_DEFS[item.type].name),
        description: item.description || INVENTORY_ITEM_DEFS[item.type].description,
        icon: item.icon || INVENTORY_ITEM_DEFS[item.type].icon || 'BOX',
        originalPrice,
        buyPrice,
        price: Math.max(1, originalPrice),
        sellerCharName: player.charName,
        soldAt: new Date().toISOString(),
    };

    removeInventoryItemAmount(player, itemId, 1);
    business.pawnInventory = Array.isArray(business.pawnInventory) ? business.pawnInventory : [];
    business.pawnInventory.push(stockItem);
    business.bankBalance = bankBalance - buyPrice;
    player.money = Math.max(0, parseInt(player.money, 10) || 0) + buyPrice;

    persistInventory(player);
    persistPlayerMoney(player);
    persistBusinessState(business);
    sendInventoryUpdate(player, `Pardavete lombardui ${stockItem.name} uz $${buyPrice}.`, true);
    player.outputChatBox(`!{#7aa164}Pardavete ${stockItem.name} lombardui ${business.name} uz $${buyPrice}.`);
});

function buyPawnStockItem(player, stockId, updateUi = false) {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!stockId) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pawnbuy [stockId]');
    }

    const business = getPawnShopBusinessForPlayer(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#f7dc6f}Pawn daiktus pirkti galite tik lombardo viduje arba prie jo iejimo zonos.');
    }

    const stockEntry = findPawnStockItem(business, stockId);
    if (!stockEntry) {
        if (updateUi) openPawnShopForPlayer(player, business, 'Toks daiktas neberastas.', false, true);
        return player.outputChatBox('!{#e74c3c}Toks pawn stock ID nerastas. Naudokite /pawnstock.');
    }

    const stockItem = stockEntry.item;
    const price = Math.max(1, parseInt(stockItem.price, 10) || 1);
    if ((player.money || 0) < price) {
        if (updateUi) openPawnShopForPlayer(player, business, `Nepakanka grynuju. Reikia $${price}.`, false, true);
        return player.outputChatBox(`!{#e74c3c}Nepakanka grynuju. Reikia $${price}, turite $${player.money || 0}.`);
    }

    if (!Array.isArray(player.inventory)) player.inventory = [];
    const addedItem = addExistingInventoryItem(player, stockItem, 1);
    if (!addedItem) {
        if (updateUi) openPawnShopForPlayer(player, business, 'Nepavyko prideti daikto i inventoriu.', false, true);
        return player.outputChatBox('!{#e74c3c}Nepavyko prideti daikto i inventoriu.');
    }

    business.pawnInventory.splice(stockEntry.index, 1);
    player.money -= price;
    business.bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0) + price;

    persistInventory(player);
    persistPlayerMoney(player);
    persistBusinessState(business);
    sendInventoryUpdate(player, `Nusipirkote ${stockItem.name} uz $${price}.`, true);
    player.outputChatBox(`!{#7aa164}Nusipirkote ${stockItem.name} is ${business.name} uz $${price}.`);
    if (updateUi) openPawnShopForPlayer(player, business, `Nusipirkote ${stockItem.name} uz $${price}.`, true, true);
}

mp.events.addCommand('pawnbuy', (player, _, stockId) => {
    buyPawnStockItem(player, stockId, false);
});

mp.events.add('pawnShopBuy', (player, stockId) => {
    buyPawnStockItem(player, stockId, true);
});

mp.events.addCommand('pawnprice', (player, _, stockId, priceRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!stockId || !priceRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pawnprice [stockId] [kaina]');
    }

    const business = getOwnedBusinessContext(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#e74c3c}Kainas keisti galite tik savo lombarde.');
    }

    const stockEntry = findPawnStockItem(business, stockId);
    if (!stockEntry) {
        return player.outputChatBox('!{#e74c3c}Toks pawn stock ID nerastas.');
    }

    const price = parseInt(priceRaw, 10);
    if (!Number.isFinite(price) || price <= 0) {
        return player.outputChatBox('!{#e74c3c}Nurodykite teisinga kaina.');
    }

    stockEntry.item.price = Math.min(price, 100000000);
    persistBusinessPawnInventory(business);
    player.outputChatBox(`!{#7aa164}${stockEntry.item.name} kaina pakeista i $${stockEntry.item.price}.`);
});

mp.events.addCommand('pawnrename', (player, fullText, itemId, ...nameParts) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const business = getOwnedBusinessContext(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#e74c3c}Daiktus pervadinti gali tik lombardo savininkas savo lombarde.');
    }

    const nextName = sanitizeInventoryItemName(nameParts.join(' '), '');
    if (!itemId || !nextName) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pawnrename [inventory item ID] [naujas pavadinimas]');
    }

    const itemEntry = findInventoryItemByToken(player, itemId);
    if (!itemEntry || !isPawnableInventoryItem(itemEntry.item)) {
        return sendInventoryUpdate(player, 'Toks pawn daiktas inventoriuje nerastas.', false);
    }

    itemEntry.item.name = nextName;
    persistInventory(player);
    sendInventoryUpdate(player, `Daiktas pervadintas i: ${nextName}.`, true);
    player.outputChatBox(`!{#7aa164}Daiktas pervadintas i: ${nextName}.`);
});

mp.events.addCommand('pawnstockrename', (player, fullText, stockId, ...nameParts) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const business = getOwnedBusinessContext(player);
    if (!isPawnShopBusiness(business)) {
        return player.outputChatBox('!{#e74c3c}Stock pervadinti galite tik savo lombarde.');
    }

    const nextName = sanitizeInventoryItemName(nameParts.join(' '), '');
    if (!stockId || !nextName) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /pawnstockrename [stockId] [naujas pavadinimas]');
    }

    const stockEntry = findPawnStockItem(business, stockId);
    if (!stockEntry) {
        return player.outputChatBox('!{#e74c3c}Toks pawn stock ID nerastas.');
    }

    stockEntry.item.name = nextName;
    persistBusinessPawnInventory(business);
    player.outputChatBox(`!{#7aa164}Pawn stock pervadintas i: ${nextName}.`);
});

mp.events.addCommand('bizbank', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const business = getOwnedBusinessContext(player);
    if (!business) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo versle arba prie jo iejimo.');
    }

    const bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0);
    player.outputChatBox(`!{#85c1e9}${business.name} bankas: $${bankBalance}.`);
});

mp.events.addCommand('bizbankwithdraw', (player, _, amountRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!amountRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /bizbankwithdraw [suma]');
    }

    const business = getOwnedBusinessContext(player);
    if (!business) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo versle arba prie jo iejimo.');
    }

    const amount = parseInt(amountRaw, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
        return player.outputChatBox('!{#e74c3c}Nurodykite teisinga suma.');
    }

    const bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0);
    if (amount > bankBalance) {
        return player.outputChatBox(`!{#e74c3c}Verslo banke nepakanka lesu. Balansas: $${bankBalance}.`);
    }

    business.bankBalance = bankBalance - amount;
    player.money = Math.max(0, parseInt(player.money, 10) || 0) + amount;

    persistBusinessState(business);
    persistPlayerMoney(player);

    player.outputChatBox(`!{#7aa164}Isiemete $${amount} is ${business.name} banko. Naujas balansas: $${business.bankBalance}.`);
});

mp.events.addCommand('bizbankdeposit', (player, _, amountRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!amountRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /bizbankdeposit [suma]');
    }

    const business = getOwnedBusinessContext(player);
    if (!business) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo versle arba prie jo iejimo.');
    }

    const amount = parseInt(amountRaw, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
        return player.outputChatBox('!{#e74c3c}Nurodykite teisinga suma.');
    }

    const playerMoney = Math.max(0, parseInt(player.money, 10) || 0);
    if (amount > playerMoney) {
        return player.outputChatBox(`!{#e74c3c}Neturite tiek grynuju. Turite $${playerMoney}.`);
    }

    player.money = playerMoney - amount;
    business.bankBalance = Math.max(0, parseInt(business.bankBalance, 10) || 0) + amount;

    persistBusinessState(business);
    persistPlayerMoney(player);

    player.outputChatBox(`!{#7aa164}Idejote $${amount} i ${business.name} banka. Naujas balansas: $${business.bankBalance}.`);
});

mp.events.addCommand('setbizname', (player, fullText) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const business = getOwnedBusinessContext(player);
    if (!business) {
        return player.outputChatBox('!{#e74c3c}Galite pervadinti tik savo versla budami jame arba prie iejimo.');
    }

    const nextName = sanitizeBusinessName(fullText);
    if (!nextName) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /setbizname [naujas pavadinimas]');
    }

    business.name = nextName;
    persistBusinessState(business);
    refreshBusinessVisual(business);

    player.outputChatBox(`!{#7aa164}Verslo pavadinimas pakeistas i: ${business.name}.`);
});

mp.events.addCommand('sellbiz', (player, _, targetIdentifier, priceRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!targetIdentifier || !priceRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /sellbiz [zaidejo ID/vardas] [kaina]');
    }

    const business = getOwnedBusinessContext(player);
    if (!business) {
        return player.outputChatBox('!{#e74c3c}Galite parduoti tik savo versla (budami jame arba prie iejimo).');
    }

    const targetPlayer = getPlayerByIDOrName(targetIdentifier);
    if (!targetPlayer || !targetPlayer.charName || !targetPlayer.charId) {
        return player.outputChatBox('!{#e74c3c}Pirkejas nerastas arba nepasirinko veikejo.');
    }

    if (targetPlayer.id === player.id) {
        return player.outputChatBox('!{#f7dc6f}Negalite parduoti verslo sau.');
    }

    const price = parseInt(priceRaw, 10);
    if (!Number.isFinite(price) || price <= 0) {
        return player.outputChatBox('!{#f7dc6f}Nurodykite teisinga kaina.');
    }

    const distance = getDistanceBetweenPositions(player.position, targetPlayer.position);
    if (distance > PROPERTY_SELL_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Pirkejas turi buti salia jusu.');
    }

    if ((targetPlayer.money || 0) < price) {
        return player.outputChatBox(`!{#e74c3c}Pirkejui truksta grynuju. Turi tik $${targetPlayer.money || 0}.`);
    }

    player.money = Math.max(0, parseInt(player.money, 10) || 0) + price;
    targetPlayer.money = Math.max(0, parseInt(targetPlayer.money, 10) || 0) - price;

    persistPlayerMoney(player);
    persistPlayerMoney(targetPlayer);

    business.ownerCharId = targetPlayer.charId;
    business.ownerCharName = targetPlayer.charName;
    persistBusinessState(business);

    player.outputChatBox(`!{#7aa164}Pardavete versla ${business.name} zaidejui ${targetPlayer.charName} uz $${price}.`);
    targetPlayer.outputChatBox(`!{#7aa164}Nusipirkote versla ${business.name} is ${player.charName} uz $${price}.`);
});

mp.events.addCommand('sellproperty', (player, _, targetIdentifier, priceRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!targetIdentifier || !priceRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /sellproperty [zaidejo ID/vardas] [kaina]');
    }

    const property = getOwnedPropertyContext(player);
    if (!property) {
        return player.outputChatBox('!{#e74c3c}Galite parduoti tik savo property (budami jame arba prie iejimo).');
    }

    const targetPlayer = getPlayerByIDOrName(targetIdentifier);
    if (!targetPlayer || !targetPlayer.charName) {
        return player.outputChatBox('!{#e74c3c}Pirkejas nerastas arba nepasirinko veikejo.');
    }

    if (targetPlayer.id === player.id) {
        return player.outputChatBox('!{#f7dc6f}Negalite parduoti property sau.');
    }

    const price = parseInt(priceRaw, 10);
    if (!Number.isFinite(price) || price <= 0) {
        return player.outputChatBox('!{#f7dc6f}Nurodykite teisinga kaina.');
    }

    const distance = getDistanceBetweenPositions(player.position, targetPlayer.position);
    if (distance > PROPERTY_SELL_RADIUS) {
        return player.outputChatBox('!{#f7dc6f}Pirkejas turi buti salia jusu.');
    }

    if ((targetPlayer.money || 0) < price) {
        return player.outputChatBox(`!{#e74c3c}Pirkejui truksta grynuju. Turi tik $${targetPlayer.money || 0}.`);
    }

    player.money += price;
    targetPlayer.money -= price;

    player.call('updateMoneyHUD', [player.money]);
    targetPlayer.call('updateMoneyHUD', [targetPlayer.money]);
    db.query('UPDATE characters SET money = ? WHERE id = ?', [player.money, player.charId]);
    db.query('UPDATE characters SET money = ? WHERE id = ?', [targetPlayer.money, targetPlayer.charId]);

    property.ownerCharId = targetPlayer.charId;
    property.ownerCharName = targetPlayer.charName;
    clearTenantFromProperty(property);
    property.settings.locked = 1;
    persistPropertyState(property);

    // Update blips: clear for seller, show for buyer
    clearOwnedPropertyBlipForPlayer(player);
    showOwnedPropertyBlipForPlayer(targetPlayer, property);

    player.outputChatBox(`!{#7aa164}Pardavete ${property.name} zaidejui ${targetPlayer.charName} uz $${price}.`);
    targetPlayer.outputChatBox(`!{#7aa164}Nusipirkote ${property.name} is ${player.charName} uz $${price}.`);
});

mp.events.addCommand('setrent', (player, _, amountRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!amountRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /setrent [suma per paycheck]');
    }

    const property = getOwnedPropertyContext(player);
    if (!property) {
        return player.outputChatBox('!{#e74c3c}Nerastas jusu property kontekstas.');
    }

    const amount = Math.max(0, parseInt(amountRaw, 10) || 0);
    if (amount > 100000) {
        return player.outputChatBox('!{#e74c3c}Maksimali nuoma per paycheck yra $100000.');
    }

    property.settings.rentPerPaycheck = amount;
    persistPropertyState(property);
    player.outputChatBox(`!{#7aa164}${property.name} nuoma nustatyta: $${amount} per paycheck.`);
});

function handleHouseLockCommand(player, modeRaw) {
    if (!player.charId || !player.charName) {
        if (player) {
            player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
        }
        return;
    }

    const property = getAccessiblePropertyContext(player);
    if (!property) {
        player.outputChatBox('!{#e74c3c}Nerastas jums priklausantis arba nuomojamas property kontekstas.');
        return;
    }

    const mode = String(modeRaw || '').trim().toLowerCase();
    if (mode === 'on' || mode === '1' || mode === 'lock') {
        property.settings.locked = 1;
    } else if (mode === 'off' || mode === '0' || mode === 'unlock') {
        property.settings.locked = 0;
    } else {
        property.settings.locked = Number(property.settings.locked) ? 0 : 1;
    }

    persistPropertyState(property);
    player.outputChatBox(`!{#7aa164}${property.name}: ${property.settings.locked ? 'uzrakintas' : 'atrakintas'}.`);
}

mp.events.addCommand('houselock', (player, _, modeRaw) => {
    handleHouseLockCommand(player, modeRaw);
});

mp.events.addCommand('hlock', (player, _, modeRaw) => {
    handleHouseLockCommand(player, modeRaw);
});

mp.events.addCommand('houseinv', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const property = getPlayerCurrentProperty(player);
    if (!property || !canAccessProperty(player, property)) {
        return player.outputChatBox('!{#e74c3c}House inventory pasiekiamas tik jusu property viduje.');
    }

    if (!Array.isArray(property.inventory) || property.inventory.length === 0) {
        return player.outputChatBox('!{#f7dc6f}House inventory tuscias.');
    }

    player.outputChatBox(`!{#85c1e9}===== ${property.name} Inventory =====`);
    property.inventory.forEach((item) => {
        if (!item) return;
        player.outputChatBox(`!{#d6eaf8}${item.name} (${item.type}) - ${item.quantity} vnt.`);
    });
});

mp.events.addCommand('hdeposit', (player, _, itemId, amountRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const property = getPlayerCurrentProperty(player);
    if (!property || !canAccessProperty(player, property)) {
        return player.outputChatBox('!{#e74c3c}Daiktus i namus galite deti tik budami savo property viduje.');
    }

    if (!itemId) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /hdeposit [inventory item ID] [kiekis]');
    }

    const amount = Math.max(1, parseInt(amountRaw, 10) || 1);
    const itemEntry = getInventoryItemById(player, itemId);
    if (!itemEntry || !itemEntry.item) {
        return player.outputChatBox('!{#e74c3c}Nerastas toks item jusu inventoriuje.');
    }

    if (itemEntry.item.quantity < amount) {
        return player.outputChatBox('!{#e74c3c}Neturite tiek vienetu.');
    }

    const itemType = itemEntry.item.type;
    const itemName = itemEntry.item.name;
    removeInventoryItemAmount(player, itemId, amount);
    addPropertyInventoryItem(property, itemType, amount);

    persistInventory(player);
    persistPropertyState(property);
    sendInventoryUpdate(player, `Perkelta i namu inventory: ${amount}x ${itemName}.`, true);
    player.outputChatBox(`!{#7aa164}Perkelta i ${property.name} inventory: ${amount}x ${itemName}.`);
});

mp.events.addCommand('hwithdraw', (player, _, itemTypeRaw, amountRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const property = getPlayerCurrentProperty(player);
    if (!property || !canAccessProperty(player, property)) {
        return player.outputChatBox('!{#e74c3c}Daiktus is namu galite paimti tik budami savo property viduje.');
    }

    if (!itemTypeRaw) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /hwithdraw [item type] [kiekis]');
    }

    const itemType = normalizeInventoryItemType(String(itemTypeRaw));
    if (!itemType) {
        return player.outputChatBox('!{#e74c3c}Netinkamas item type.');
    }

    const amount = Math.max(1, parseInt(amountRaw, 10) || 1);
    const existing = Array.isArray(property.inventory)
        ? property.inventory.find(item => item && item.type === itemType)
        : null;

    if (!existing || existing.quantity < amount) {
        return player.outputChatBox('!{#e74c3c}House inventory neturi tiek vienetu sio item.');
    }

    removePropertyInventoryItemByType(property, itemType, amount);
    addInventoryItem(player, itemType, amount);

    persistPropertyState(property);
    persistInventory(player);
    sendInventoryUpdate(player, `Paimta is namu inventory: ${amount}x ${existing.name}.`, true);
    player.outputChatBox(`!{#7aa164}Paimta is ${property.name} inventory: ${amount}x ${existing.name}.`);
});

mp.events.addCommand('rent', (player, _, subRaw, arg2Raw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    const sub = String(subRaw || '').trim().toLowerCase();

    if (sub === 'stop') {
        const ownerProperty = getOwnedPropertyContext(player);
        if (ownerProperty && Number(ownerProperty.tenantCharId) > 0) {
            const oldTenantId = ownerProperty.tenantCharId;
            const oldTenantName = ownerProperty.tenantCharName || `ID ${oldTenantId}`;
            clearTenantFromProperty(ownerProperty);
            persistPropertyState(ownerProperty);

            const tenantOnline = findOnlinePlayerByCharId(oldTenantId);
            if (tenantOnline) {
                tenantOnline.outputChatBox(`!{#e67e22}Jusu nuoma nutraukta: ${ownerProperty.name}.`);
            }

            return player.outputChatBox(`!{#7aa164}Nutraukete nuoma su ${oldTenantName}.`);
        }

        const tenantProperty = getPropertyRentedByCharId(player.charId);
        if (!tenantProperty) {
            return player.outputChatBox('!{#f7dc6f}Jus nesate aktyvus nuomininkas jokiam bustui.');
        }

        const ownerOnline = findOnlinePlayerByCharId(tenantProperty.ownerCharId);
        clearTenantFromProperty(tenantProperty);
        persistPropertyState(tenantProperty);

        player.outputChatBox(`!{#7aa164}Nutraukete nuoma: ${tenantProperty.name}.`);
        if (ownerOnline) {
            ownerOnline.outputChatBox(`!{#e67e22}${player.charName} nutrauke nuoma (${tenantProperty.name}).`);
        }
        return;
    }

    if (sub === 'info') {
        const nearbyProperty = getNearbyProperty(player, PROPERTY_INTERACT_RADIUS);
        if (!nearbyProperty) {
            return player.outputChatBox('!{#f7dc6f}Prieikite prie busto iejimo ir bandykite dar karta.');
        }

        sendPropertyInfo(player, nearbyProperty);
        return;
    }

    if (sub) {
        return player.outputChatBox('!{#f7dc6f}Naudojimas: /rent (prie laisvo busto) | /rent stop | /rent info');
    }

    const property = getNearbyProperty(player, PROPERTY_INTERACT_RADIUS);
    if (!property) {
        return player.outputChatBox('!{#e74c3c}Prieikite arciau busto iejimo, kad galetumete nuomotis.');
    }

    if (!Number(property.ownerCharId) || Number(property.ownerCharId) <= 0) {
        return player.outputChatBox('!{#e74c3c}Sis bustas neturi savininko, jo nuomotis negalima.');
    }

    if (Number(property.ownerCharId) === Number(player.charId)) {
        return player.outputChatBox('!{#f7dc6f}Tai jusu bustas. Nuoma nereikalinga.');
    }

    const rentAmount = Math.max(0, parseInt(property.settings?.rentPerPaycheck, 10) || 0);
    if (rentAmount <= 0) {
        return player.outputChatBox('!{#e74c3c}Sis bustas nesiulomas nuomai.');
    }

    if (Number(property.tenantCharId) > 0 && Number(property.tenantCharId) !== Number(player.charId)) {
        return player.outputChatBox('!{#e74c3c}Sis bustas jau turi kita nuomininka.');
    }

    const existingTenantProperty = getPropertyRentedByCharId(player.charId);
    if (existingTenantProperty && Number(existingTenantProperty.id) !== Number(property.id)) {
        return player.outputChatBox(`!{#e74c3c}Jus jau nuomojates ${existingTenantProperty.name}. Pirmiausia nutraukite /rent stop.`);
    }

    if (Number(property.tenantCharId) === Number(player.charId)) {
        return player.outputChatBox(`!{#f7dc6f}Jus jau nuomojates ${property.name}.`);
    }

    setTenantForProperty(property, player);
    persistPropertyState(property);

    player.outputChatBox(`!{#7aa164}Issinuomojote ${property.name} uz $${rentAmount}/paycheck.`);
    player.outputChatBox('!{#7aa164}Galite naudoti: /houselock (/hlock), /houseinv, /hdeposit, /hwithdraw.');

    const ownerOnline = findOnlinePlayerByCharId(property.ownerCharId);
    if (ownerOnline && ownerOnline.id !== player.id) {
        ownerOnline.outputChatBox(`!{#7aa164}${player.charName} issinuomojo jusu busta ${property.name} uz $${rentAmount}/paycheck.`);
    }
});

mp.events.addCommand('aprop', (player, fullText) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return player.outputChatBox('!{#e74c3c}Neturite teises naudoti sios komandos.');
        }

        const args = String(fullText || '').trim().split(/\s+/).filter(Boolean);
        const action = String(args[0] || '').toLowerCase();

        if (!action) {
            player.outputChatBox('!{#f7dc6f}Naudojimas: /aprop list');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /aprop create [price]');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /aprop select, /aprop setentry [propertyId], /aprop setinterior [interiorId|list], /aprop setexit [propertyId(optional)], /aprop setprice [propertyId] [price]');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /aprop setowner [id] [ID/vardas/none], /aprop delete [id], /aprop tpentry [id], /aprop tpinterior [id], /aprop reload');
            return;
        }

        if (action === 'list') {
            if (propertiesById.size === 0) {
                return player.outputChatBox('!{#f7dc6f}Property sarasas tuscias.');
            }

            player.outputChatBox('!{#85c1e9}===== ADMIN PROPERTY LIST =====');
            propertiesById.forEach((property) => {
                const owner = property.ownerCharName || 'Server';
                const tenant = property.tenantCharName || 'Nera';
                player.outputChatBox(`!{#d6eaf8}#${property.id} ${property.name} | $${property.price} | dim ${property.dimension} | owner ${owner} | tenant ${tenant}`);
            });
            return;
        }

        if (action === 'reload') {
            loadPropertiesFromDatabase();
            return player.outputChatBox('!{#7aa164}Property sarasas perkraunamas is duomenu bazes.');
        }

        if (action === 'create') {
            const rawPrice = parseInt(args[1], 10);
            const price = Math.max(0, rawPrice || 0);

            if (!Number.isFinite(rawPrice)) {
                return player.outputChatBox('!{#e74c3c}Naudojimas: /aprop create [price]');
            }

            const safeName = 'Nuosavybe';
            const key = `custom-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
            const dim = 8000 + Math.floor(Math.random() * 100000);
            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;
            const settingsJson = JSON.stringify(getDefaultPropertySettings());
            const autoAddress = getAutoPropertyAddressFromPosition(pos);

            db.query(
                'INSERT INTO server_properties (property_key, name, address, price, entry_x, entry_y, entry_z, entry_h, interior_x, interior_y, interior_z, interior_h, dimension, inventory, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [key, safeName, autoAddress, price, pos.x, pos.y, pos.z, heading, pos.x, pos.y, pos.z, heading, dim, '[]', settingsJson],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error('[HOUSING] /aprop create failed:', insertErr.message);
                        return player.outputChatBox('!{#e74c3c}Nepavyko sukurti property.');
                    }

                    const property = {
                        id: Number(result.insertId),
                        key,
                        name: getLocalizedPropertyName(result.insertId),
                        address: autoAddress,
                        price,
                        entryPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        entryHeading: heading,
                        interiorPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        interiorHeading: heading,
                        exitPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        exitHeading: heading,
                        dimension: getUniquePropertyDimension(result.insertId),
                        ownerCharId: null,
                        ownerCharName: null,
                        tenantCharId: null,
                        tenantCharName: null,
                        inventory: [],
                        settings: getDefaultPropertySettings(),
                    };

                    propertiesById.set(property.id, property);
                    player.apropSelectedPropertyId = property.id;
                    db.query('UPDATE server_properties SET name = ?, address = ?, dimension = ? WHERE id = ?', [property.name, property.address, property.dimension, property.id]);
                    requestNativePropertyAddressResolution(player, property);
                    player.outputChatBox(`!{#7aa164}Sukurtas property #${property.id}: ${property.name} (dim ${property.dimension}).`);
                    player.outputChatBox('!{#f7dc6f}Patarimas: nustatykite interior su /aprop setinterior [interiorId], tada /tpinterior [interiorId] ir /aprop setexit.');
                }
            );
            return;
        }

        if (action === 'setinterior') {
            const interiorRaw = String(args[1] || '').trim().toLowerCase();
            if (!interiorRaw) {
                return player.outputChatBox('!{#e74c3c}Naudojimas: /aprop setinterior [interiorId|list]');
            }

            if (interiorRaw === 'list') {
                player.outputChatBox('!{#85c1e9}Galimi interior ID:');
                APROP_INTERIOR_PRESET_LIST.forEach((preset) => {
                    player.outputChatBox(`!{#d6eaf8}[${preset.id}] ${preset.label}`);
                });
                return;
            }

            const selectedPropertyId = parseInt(player.apropSelectedPropertyId, 10);
            const property = Number.isFinite(selectedPropertyId)
                ? getPropertyById(selectedPropertyId)
                : null;

            if (!property) {
                return player.outputChatBox('!{#e74c3c}Nera pasirinkto property. Sukurkite su /aprop create [price] arba naudokite /aprop setentry [propertyId].');
            }

            const interiorId = parseInt(interiorRaw, 10);
            let preset = null;

            if (Number.isFinite(interiorId)) {
                preset = APROP_INTERIOR_PRESETS_BY_ID.get(interiorId) || null;
            }

            if (!preset) {
                preset = APROP_INTERIOR_PRESETS_BY_KEY.get(interiorRaw) || null;
            }

            if (!preset) {
                return player.outputChatBox('!{#e74c3c}Nerastas interior ID. Naudokite /aprop setinterior list');
            }

            property.interiorPos = new mp.Vector3(preset.pos.x, preset.pos.y, preset.pos.z);
            property.interiorHeading = 0;
            property.dimension = getUniquePropertyDimension(property.id);

            if (!property.exitPos) {
                property.exitPos = new mp.Vector3(preset.pos.x, preset.pos.y, preset.pos.z);
            }

            db.query(
                'UPDATE server_properties SET interior_x = ?, interior_y = ?, interior_z = ?, interior_h = ?, dimension = ? WHERE id = ?',
                [preset.pos.x, preset.pos.y, preset.pos.z, 0, property.dimension, property.id]
            );

            return player.outputChatBox(`!{#7aa164}Property #${property.id} interior nustatytas: [${preset.id}] ${preset.label}. Dim: ${property.dimension}`);
        }

        if (action === 'select') {
            const property = getNearbyProperty(player, 12.0);
            if (!property) {
                return player.outputChatBox('!{#e74c3c}Salia nerastas property pasirinkimui. Prieikite arciau entry tasko.');
            }

            player.apropSelectedPropertyId = property.id;
            return player.outputChatBox(`!{#7aa164}Pasirinkote property #${property.id}: ${property.name}.`);
        }

        const fallbackSelectedPropertyId = parseInt(player.apropSelectedPropertyId, 10);
        const propertyIdArg = parseInt(args[1], 10);
        const resolvedPropertyId = Number.isFinite(propertyIdArg)
            ? propertyIdArg
            : ((action === 'setexit' && Number.isFinite(fallbackSelectedPropertyId)) ? fallbackSelectedPropertyId : NaN);

        const property = getPropertyById(resolvedPropertyId);
        if (!property) {
            return player.outputChatBox('!{#e74c3c}Nerastas property pagal ID.');
        }

        player.apropSelectedPropertyId = property.id;

        if (action === 'delete') {
            propertiesById.delete(property.id);
            db.query('DELETE FROM server_properties WHERE id = ?', [property.id]);
            return player.outputChatBox(`!{#7aa164}Property #${property.id} istrintas.`);
        }

        if (action === 'setentry') {
            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;
            property.entryPos = new mp.Vector3(pos.x, pos.y, pos.z);
            property.entryHeading = heading;
            property.address = getAutoPropertyAddressFromPosition(pos);
            db.query('UPDATE server_properties SET entry_x = ?, entry_y = ?, entry_z = ?, entry_h = ?, address = ? WHERE id = ?', [pos.x, pos.y, pos.z, heading, property.address, property.id]);
            requestNativePropertyAddressResolution(player, property);
            return player.outputChatBox(`!{#7aa164}Atnaujinote entry taska property #${property.id}.`);
        }

        if (action === 'setexit') {
            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;

            property.exitPos = new mp.Vector3(pos.x, pos.y, pos.z);
            property.exitHeading = heading;
            property.interiorPos = new mp.Vector3(pos.x, pos.y, pos.z);
            property.interiorHeading = heading;

            db.query('UPDATE server_properties SET interior_x = ?, interior_y = ?, interior_z = ?, interior_h = ? WHERE id = ?', [pos.x, pos.y, pos.z, heading, property.id]);
            return player.outputChatBox(`!{#7aa164}Property #${property.id} exit taskas nustatytas interior viduje.`);
        }

        if (action === 'setprice') {
            const nextPrice = Math.max(0, parseInt(args[2], 10) || 0);
            property.price = nextPrice;
            db.query('UPDATE server_properties SET price = ? WHERE id = ?', [nextPrice, property.id]);
            return player.outputChatBox(`!{#7aa164}Property #${property.id} kaina: $${nextPrice}.`);
        }

        if (action === 'setowner') {
            const targetIdentifier = String(args[2] || '').trim();
            if (!targetIdentifier) {
                return player.outputChatBox('!{#e74c3c}Naudojimas: /aprop setowner [id] [ID/vardas/none]');
            }

            if (targetIdentifier.toLowerCase() === 'none') {
                const prevOwnerId = property.ownerCharId;
                property.ownerCharId = null;
                property.ownerCharName = null;
                clearTenantFromProperty(property);
                persistPropertyState(property);
                if (prevOwnerId) {
                    const prevOwnerPlayer = findOnlinePlayerByCharId(prevOwnerId);
                    if (prevOwnerPlayer) clearOwnedPropertyBlipForPlayer(prevOwnerPlayer);
                }
                return player.outputChatBox(`!{#7aa164}Property #${property.id} grazintas serveriui.`);
            }

            const targetPlayer = getPlayerByIDOrName(targetIdentifier);
            if (!targetPlayer || !targetPlayer.charName || !targetPlayer.charId) {
                return player.outputChatBox('!{#e74c3c}Nerastas online zaidejas pagal nurodyta identifikatoriu.');
            }

            const prevOwnerId = property.ownerCharId;
            property.ownerCharId = targetPlayer.charId;
            property.ownerCharName = targetPlayer.charName;
            clearTenantFromProperty(property);
            property.settings.locked = 1;
            persistPropertyState(property);

            if (prevOwnerId) {
                const prevOwnerPlayer = findOnlinePlayerByCharId(prevOwnerId);
                if (prevOwnerPlayer) clearOwnedPropertyBlipForPlayer(prevOwnerPlayer);
            }

            showOwnedPropertyBlipForPlayer(targetPlayer, property);

            targetPlayer.outputChatBox(`!{#7aa164}Administratorius priskyre jums property: ${property.name}.`);
            return player.outputChatBox(`!{#7aa164}Property #${property.id} priskirtas ${targetPlayer.charName}.`);
        }

        if (action === 'tpentry') {
            player.dimension = 0;
            player.position = property.entryPos;
            player.heading = property.entryHeading;
            player.currentPropertyId = null;
            player.currentBusinessId = null;
            return player.outputChatBox(`!{#7aa164}Teleportuota prie property #${property.id} entry.`);
        }

        if (action === 'tpinterior') {
            player.dimension = property.dimension;
            player.position = property.interiorPos;
            player.heading = property.interiorHeading;
            player.currentPropertyId = property.id;
            player.currentBusinessId = null;
            return player.outputChatBox(`!{#7aa164}Teleportuota i property #${property.id} interior.`);
        }

        player.outputChatBox('!{#e74c3c}Nezinomas /aprop veiksmas. Naudokite /aprop be argumentu.');
    });
});

mp.events.addCommand('abiz', (player, fullText) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return player.outputChatBox('!{#e74c3c}Neturite teises naudoti sios komandos.');
        }

        const args = String(fullText || '').trim().split(/\s+/).filter(Boolean);
        const action = String(args[0] || '').toLowerCase();

        if (!action) {
            player.outputChatBox('!{#f7dc6f}Naudojimas: /abiz list, /abiz reload, /abiz select');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /abiz create [shop|gasstation|restaurant|pawnshop] [pavadinimas(optional)]');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /abiz setentry [id], /abiz setinterior [interiorId|list], /abiz setexit [id(optional)], /abiz setradius [id(optional)] [metrai]');
            player.outputChatBox('!{#f7dc6f}Naudojimas: /abiz delete [id], /abiz tpentry [id], /abiz tpinterior [id]');
            return;
        }

        if (action === 'list') {
            if (businessesById.size === 0) {
                return player.outputChatBox('!{#f7dc6f}Verslu sarasas tuscias.');
            }

            player.outputChatBox('!{#85c1e9}===== ADMIN BUSINESS LIST =====');
            businessesById.forEach((business) => {
                player.outputChatBox(`!{#d6eaf8}#${business.id} ${business.name} | ${getBusinessTypeLabel(business.type)} | dim ${business.dimension} | r ${getBusinessInteractRadius(business)}m | ${getBusinessAddressForDisplay(business)}`);
            });
            return;
        }

        if (action === 'reload') {
            loadBusinessesFromDatabase();
            return player.outputChatBox('!{#7aa164}Verslu sarasas perkraunamas is duomenu bazes.');
        }

        if (action === 'select') {
            const business = getNearbyBusiness(player, 12.0);
            if (!business) {
                return player.outputChatBox('!{#e74c3c}Salia nerastas verslas pasirinkimui.');
            }

            player.abizSelectedBusinessId = business.id;
            return player.outputChatBox(`!{#7aa164}Pasirinkote versla #${business.id}: ${business.name}.`);
        }

        if (action === 'create') {
            const type = normalizeBusinessType(args[1]);
            if (!type) {
                return player.outputChatBox('!{#e74c3c}Naudojimas: /abiz create [shop|gasstation|restaurant|pawnshop] [pavadinimas(optional)]');
            }

            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;
            const key = `biz-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
            const rawName = sanitizeBusinessName(args.slice(2).join(' '));
            const initialName = rawName || getBusinessTypeLabel(type);
            const address = getAutoPropertyAddressFromPosition(pos);

            db.query(
                'INSERT INTO server_businesses (business_key, name, business_type, address, owner_char_id, owner_char_name, bank_balance, entry_x, entry_y, entry_z, entry_h, interior_x, interior_y, interior_z, interior_h, exit_x, exit_y, exit_z, exit_h, dimension, interact_radius) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [key, initialName, type, address, player.charId, player.charName, 0, pos.x, pos.y, pos.z, heading, pos.x, pos.y, pos.z, heading, pos.x, pos.y, pos.z, heading, 0, BUSINESS_INTERACT_RADIUS],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error('[BUSINESS] /abiz create failed:', insertErr.message);
                        return player.outputChatBox('!{#e74c3c}Nepavyko sukurti verslo.');
                    }

                    const business = {
                        id: Number(result.insertId),
                        key,
                        name: rawName || getDefaultBusinessName(type, result.insertId),
                        type,
                        address,
                        ownerCharId: player.charId,
                        ownerCharName: player.charName,
                        bankBalance: 0,
                        entryPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        entryHeading: heading,
                        interiorPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        interiorHeading: heading,
                        exitPos: new mp.Vector3(pos.x, pos.y, pos.z),
                        exitHeading: heading,
                        dimension: getUniqueBusinessDimension(result.insertId),
                        pawnInventory: [],
                        interactRadius: BUSINESS_INTERACT_RADIUS,
                    };

                    businessesById.set(business.id, business);
                    player.abizSelectedBusinessId = business.id;
                    refreshBusinessVisual(business);

                    db.query('UPDATE server_businesses SET name = ?, dimension = ?, owner_char_id = ?, owner_char_name = ?, bank_balance = ? WHERE id = ?', [business.name, business.dimension, business.ownerCharId, business.ownerCharName, business.bankBalance, business.id]);

                    player.outputChatBox(`!{#7aa164}Sukurtas verslas #${business.id}: ${business.name} (${getBusinessTypeLabel(type)}).`);
                    player.outputChatBox('!{#f7dc6f}Patarimas: naudokite /abiz setinterior [interiorId], tada /abiz tpinterior [id] ir /abiz setexit.');
                }
            );
            return;
        }

        if (action === 'setinterior') {
            const interiorRaw = String(args[1] || '').trim().toLowerCase();
            if (!interiorRaw) {
                return player.outputChatBox('!{#e74c3c}Naudojimas: /abiz setinterior [interiorId|list]');
            }

            if (interiorRaw === 'list') {
                player.outputChatBox('!{#85c1e9}Galimi interior ID:');
                APROP_INTERIOR_PRESET_LIST.forEach((preset) => {
                    player.outputChatBox(`!{#d6eaf8}[${preset.id}] ${preset.label}`);
                });
                return;
            }

            const selectedBusinessId = parseInt(player.abizSelectedBusinessId, 10);
            const business = Number.isFinite(selectedBusinessId)
                ? getBusinessById(selectedBusinessId)
                : null;

            if (!business) {
                return player.outputChatBox('!{#e74c3c}Nera pasirinkto verslo. Sukurkite su /abiz create arba naudokite /abiz select.');
            }

            const interiorId = parseInt(interiorRaw, 10);
            let preset = null;

            if (Number.isFinite(interiorId)) {
                preset = APROP_INTERIOR_PRESETS_BY_ID.get(interiorId) || null;
            }

            if (!preset) {
                preset = APROP_INTERIOR_PRESETS_BY_KEY.get(interiorRaw) || null;
            }

            if (!preset) {
                return player.outputChatBox('!{#e74c3c}Nerastas interior ID. Naudokite /abiz setinterior list');
            }

            business.interiorPos = new mp.Vector3(preset.pos.x, preset.pos.y, preset.pos.z);
            business.interiorHeading = 0;
            business.exitPos = new mp.Vector3(preset.pos.x, preset.pos.y, preset.pos.z);
            business.exitHeading = 0;
            business.dimension = getUniqueBusinessDimension(business.id);

            db.query(
                'UPDATE server_businesses SET interior_x = ?, interior_y = ?, interior_z = ?, interior_h = ?, exit_x = ?, exit_y = ?, exit_z = ?, exit_h = ?, dimension = ? WHERE id = ?',
                [preset.pos.x, preset.pos.y, preset.pos.z, 0, preset.pos.x, preset.pos.y, preset.pos.z, 0, business.dimension, business.id]
            );

            return player.outputChatBox(`!{#7aa164}Verslo #${business.id} interjeras nustatytas: [${preset.id}] ${preset.label}. Dim: ${business.dimension}`);
        }

        const fallbackSelectedBusinessId = parseInt(player.abizSelectedBusinessId, 10);
        const businessIdArg = parseInt(args[1], 10);
        const selectedAllowed = action === 'setexit' || action === 'setradius';
        const resolvedBusinessId = Number.isFinite(businessIdArg)
            ? businessIdArg
            : ((selectedAllowed && Number.isFinite(fallbackSelectedBusinessId)) ? fallbackSelectedBusinessId : NaN);
        const business = getBusinessById(resolvedBusinessId);

        if (!business) {
            return player.outputChatBox('!{#e74c3c}Nerastas verslas pagal ID.');
        }

        player.abizSelectedBusinessId = business.id;

        if (action === 'delete') {
            businessesById.delete(business.id);
            destroyBusinessVisualById(business.id);
            db.query('DELETE FROM server_businesses WHERE id = ?', [business.id]);
            return player.outputChatBox(`!{#7aa164}Verslas #${business.id} istrintas.`);
        }

        if (action === 'setentry') {
            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;
            business.entryPos = new mp.Vector3(pos.x, pos.y, pos.z);
            business.entryHeading = heading;
            business.address = getAutoPropertyAddressFromPosition(pos);
            db.query('UPDATE server_businesses SET entry_x = ?, entry_y = ?, entry_z = ?, entry_h = ?, address = ? WHERE id = ?', [pos.x, pos.y, pos.z, heading, business.address, business.id]);
            refreshBusinessVisual(business);
            return player.outputChatBox(`!{#7aa164}Atnaujinote iejimo taska verslui #${business.id}.`);
        }

        if (action === 'setexit') {
            const pos = player.position;
            const heading = Number.isFinite(player.heading) ? player.heading : 0;
            business.exitPos = new mp.Vector3(pos.x, pos.y, pos.z);
            business.exitHeading = heading;
            db.query('UPDATE server_businesses SET exit_x = ?, exit_y = ?, exit_z = ?, exit_h = ? WHERE id = ?', [pos.x, pos.y, pos.z, heading, business.id]);
            return player.outputChatBox(`!{#7aa164}Verslo #${business.id} isejimo taskas nustatytas.`);
        }

        if (action === 'setradius') {
            const radiusRaw = Number.isFinite(businessIdArg) ? args[2] : args[1];
            const parsedRadius = Number(radiusRaw);
            if (!Number.isFinite(parsedRadius)) {
                return player.outputChatBox(`!{#e74c3c}Naudojimas: /abiz setradius [id(optional)] [metrai ${BUSINESS_INTERACT_RADIUS_MIN}-${BUSINESS_INTERACT_RADIUS_MAX}]`);
            }

            business.interactRadius = sanitizeBusinessInteractRadius(parsedRadius);
            db.query('UPDATE server_businesses SET interact_radius = ? WHERE id = ?', [business.interactRadius, business.id]);
            return player.outputChatBox(`!{#7aa164}Verslo #${business.id} pirkimo/pawn zona nustatyta i ${business.interactRadius}m.`);
        }

        if (action === 'tpentry') {
            player.dimension = 0;
            player.position = business.entryPos;
            player.heading = business.entryHeading;
            player.currentPropertyId = null;
            player.currentBusinessId = null;
            return player.outputChatBox(`!{#7aa164}Teleportuota prie verslo #${business.id} iejimo.`);
        }

        if (action === 'tpinterior') {
            player.dimension = business.dimension;
            player.position = business.interiorPos;
            player.heading = business.interiorHeading;
            player.currentPropertyId = null;
            player.currentBusinessId = business.id;
            return player.outputChatBox(`!{#7aa164}Teleportuota i verslo #${business.id} interjera.`);
        }

        player.outputChatBox('!{#e74c3c}Nezinomas /abiz veiksmas. Naudokite /abiz be argumentu.');
    });
});

mp.events.addCommand('tpinterior', (player, _, interiorIdRaw) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return player.outputChatBox('!{#e74c3c}Neturite teises naudoti sios komandos.');
        }

        const interiorId = parseInt(interiorIdRaw, 10);
        if (!Number.isFinite(interiorId)) {
            player.outputChatBox('!{#f7dc6f}Naudojimas: /tpinterior [interiorId]');
            APROP_INTERIOR_PRESET_LIST.forEach((preset) => {
                player.outputChatBox(`!{#d6eaf8}[${preset.id}] ${preset.label}`);
            });
            return;
        }

        const preset = APROP_INTERIOR_PRESETS_BY_ID.get(interiorId);
        if (!preset) {
            return player.outputChatBox('!{#e74c3c}Nerastas interior ID. Naudokite /tpinterior be argumento, kad pamatytumete sarasa.');
        }

        player.dimension = 0;
        player.position = preset.pos;
        player.heading = 0;
        player.currentPropertyId = null;
        player.currentBusinessId = null;
        player.outputChatBox(`!{#7aa164}Teleportuota i interior [${preset.id}] ${preset.label}.`);
    });

    mp.events.add('propertyNativeAddressResolved', (player, propertyIdRaw, addressRaw) => {
        if (!player || !player.charId) return;

        const propertyId = parseInt(propertyIdRaw, 10);
        if (!Number.isFinite(propertyId)) return;

        const property = getPropertyById(propertyId);
        if (!property) return;

        const sanitizedAddress = sanitizePropertyAddress(addressRaw);
        if (!sanitizedAddress) return;

        if (String(property.address || '') === sanitizedAddress) return;

        property.address = sanitizedAddress;
        db.query('UPDATE server_properties SET address = ? WHERE id = ?', [sanitizedAddress, property.id], (err) => {
            if (err) {
                console.error('[HOUSING] Failed to save native property address:', err.message);
            }
        });
    });
});

mp.events.addCommand('engine', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte.');
    }

    if (player.seat !== -1 && player.seat !== 0) {
        return player.outputChatBox('!{#e74c3c}Varikli gali valdyti tik vairuotojas.');
    }

    // Check ownership
    const record = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    const currentEngineStateFromVariable = Number(player.vehicle.getVariable('manualEngineOn')) === 1;
    const currentEngineStateFromEntity = Boolean(player.vehicle.engine);
    const currentEngineState = currentEngineStateFromVariable || currentEngineStateFromEntity;

    const nextEngineState = !currentEngineState;
    if (nextEngineState) {
        const fuelLevel = sanitizeFuelLevel(record.fuel);
        if (fuelLevel <= 0) {
            return player.outputChatBox('!{#e74c3c}Bakas tuscias. Naudokite /refill degalineje.');
        }
    }

    player.vehicle.engine = nextEngineState;
    player.vehicle.setVariable('manualEngineOn', nextEngineState ? 1 : 0);

    if (nextEngineState) {
        player.outputChatBox('!{#7aa164}Ijungote varikli.');
    } else {
        player.outputChatBox('!{#e67e22}Isjungote varikli.');
    }
});

mp.events.addCommand('refill', (player) => {
    if (!player.charId || !player.charName) {
        return player.outputChatBox('!{#e74c3c}Pirmiausia pasirinkite veikeja.');
    }

    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti savo transporte.');
    }

    if (player.seat !== -1 && player.seat !== 0) {
        return player.outputChatBox('!{#e74c3c}Pildyti kura gali tik vairuotojas.');
    }

    if (!isNearGasStation(player)) {
        return player.outputChatBox('!{#e74c3c}Turite buti salia degalines koloneles.');
    }

    const record = getPlayerOwnedVehicleFromEntity(player, player.vehicle);
    if (!record) {
        return player.outputChatBox('!{#e74c3c}Sis transportas nepriklauso jums.');
    }

    const currentFuel = sanitizeFuelLevel(record.fuel);
    const missingFuel = Math.max(0, VEHICLE_FUEL_MAX - currentFuel);
    if (missingFuel <= 0.01) {
        return player.outputChatBox('!{#f7dc6f}Bakas jau pilnas.');
    }

    const refillCost = Math.max(1, Math.ceil(missingFuel * FUEL_PRICE_PER_UNIT));
    if ((player.money || 0) < refillCost) {
        return player.outputChatBox(`!{#e74c3c}Nepakanka grynuju. Reikia $${refillCost}.`);
    }

    player.money -= refillCost;
    persistPlayerMoney(player);

    setOwnedVehicleFuel(record, VEHICLE_FUEL_MAX, true);
    persistOwnedVehicleState(record);

    player.outputChatBox(`!{#7aa164}Sekmingai pripildete baka uz $${refillCost}.`);
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

function isNearFleecaBank(player, radius = FLEECA_OPEN_BANK_RADIUS) {
    if (!player || !player.position) return false;
    return FLEECA_BANK_LOCATIONS.some((bankPos) => getDistanceBetweenPositions(player.position, bankPos) <= Number(radius));
}

mp.events.addCommand('openbank', (player) => {
    if (!player.charName || !player.charId) {
        return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    }

    if (!isNearFleecaBank(player)) {
        return player.outputChatBox('!{#e74c3c}Saskaita galima atidaryti tik Fleeca banke.');
    }

    if (normalizeBankAccountNumber(player.bankAccountNumber)) {
        return player.outputChatBox(`!{#f7dc6f}Jusu banko saskaita jau aktyvi: ${player.bankAccountNumber}.`);
    }

    generateUniqueBankAccountNumber((error, accountNumber) => {
        if (error || !accountNumber) {
            console.error('[BANK] Failed to generate account number:', error ? error.message : 'unknown');
            player.outputChatBox('!{#e74c3c}Nepavyko sukurti banko saskaitos numerio. Bandykite veliau.');
            return;
        }

        db.query('UPDATE bank_accounts SET account_number = ? WHERE char_name = ?', [accountNumber, player.charName], (updateErr) => {
            if (updateErr) {
                console.error('[BANK] Failed to save account number:', updateErr.message);
                player.outputChatBox('!{#e74c3c}Nepavyko issaugoti banko saskaitos numerio.');
                return;
            }

            player.bankAccountNumber = accountNumber;
            player.outputChatBox(`!{#7aa164}Banko saskaita atidaryta. Jusu numeris: ${accountNumber}.`);
        });
    });
});

mp.events.addCommand('bank', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate salia banko ar bankomato.');
        return;
    }

    db.query('SELECT transaction_type, amount, date FROM bank_transactions WHERE char_name = ? ORDER BY date DESC LIMIT 5', [player.charName], (err, results) => {
        if (err) return;

        player.call('openBankUI', [player.bankBalance, player.money, player.bankAccountNumber || '', JSON.stringify(results)]);
    });
});

mp.events.add('bankAction', (player, type, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) {
        player.call('bankError', ['Iveskite teisinga suma.']);
        return;
    }

    const refreshAndNotify = (charName, balance, money) => {
        db.query('SELECT transaction_type, amount, date FROM bank_transactions WHERE char_name = ? ORDER BY date DESC LIMIT 10', [charName], (err, results) => {
            const history = err ? [] : results;
            player.call('updateBankUI', [balance, money, player.bankAccountNumber || '', JSON.stringify(history)]);
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
            player.call('bankError', ['Nepakanka lesu saskaitoje.']);
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
            player.call('bankError', ['Neturite pakankamai grynuju pinigu.']);
        }
    }
});

mp.events.addCommand('withdraw', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate salia banko ar bankomato.');
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

        player.outputChatBox(`!{#229954}Jus issigryninote $${amount} is banko.`);
    } else {
        player.outputChatBox("!{#FF0000}Jusu banko saskaitoje nera pakankamai pinigu.");
    }
});

mp.events.addCommand('deposit', (player, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!isNearATMOrBank(player)) {
        player.outputChatBox('!{#e74c3c}Neesate salia banko ar bankomato.');
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

        player.outputChatBox(`!{#229954}Jus inesete $${amount} i banko saskaita.`);
    } else {
        player.outputChatBox("!{#FF0000}Neturite pakankamai grynuju pinigu.");
    }
});

mp.events.addCommand('transfer', (player, fullText, targetAccountNumberRaw, amount) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!normalizeBankAccountNumber(player.bankAccountNumber)) {
        return player.outputChatBox('!{#e74c3c}Neturite aktyvios banko saskaitos. Naudokite /openbank Fleeca banke.');
    }

    amount = parseInt(amount);
    const targetAccountNumber = normalizeBankAccountNumber(targetAccountNumberRaw);
    if (!targetAccountNumber || isNaN(amount) || amount <= 0) return player.outputChatBox('Naudojimas: /transfer [banko_saskaitos_numeris] [suma]');

    if (targetAccountNumber === normalizeBankAccountNumber(player.bankAccountNumber)) {
        return player.outputChatBox('!{#e74c3c}Negalite pervesti i savo saskaita.');
    }

    db.query('SELECT char_name, balance FROM bank_accounts WHERE account_number = ?', [targetAccountNumber], (err, results) => {
        if (err || results.length === 0) {
            return player.outputChatBox('!{#FF0000}Gavejo banko saskaita nerasta.');
        }

        if (player.bankBalance >= amount) {
            player.bankBalance -= amount;
            const targetName = results[0].char_name;
            const targetBalance = results[0].balance + amount;

            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [player.bankBalance, player.charName]);
            db.query('UPDATE bank_accounts SET balance = ? WHERE char_name = ?', [targetBalance, targetName]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_out", ?, NOW())', [player.charName, amount]);
            db.query('INSERT INTO bank_transactions (char_name, transaction_type, amount, date) VALUES (?, "transfer_in", ?, NOW())', [targetName, amount]);

            player.call('updateBankHUD', [player.bankBalance]);
            player.outputChatBox(`!{#229954}Pervedete $${amount} i saskaita ${targetAccountNumber}.`);

            let target = mp.players.toArray().find(p => p.charName === targetName);
            if (target) {
                target.call('updateBankHUD', [targetBalance]);
                target.outputChatBox(`!{#229954}Jus gavote $${amount} i banko saskaita (${targetAccountNumber}).`);
            }
        } else {
            player.outputChatBox('!{#FF0000}Jusu banko saskaitoje nera pakankamai pinigu.');
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
        'kick': "[KICK] Naudojimas: /kick [ID arba vardas] - Ismesti zaideja.",
        'freeze': "[FREEZE] Naudojimas: /freeze [ID arba vardas] - Uzsaldyti zaideja.",
        'heal': "[HEAL] Naudojimas: /heal [ID arba vardas] - Pagydyti zaideja.",
        'goto': "[GOTO] Naudojimas: /goto [ID arba vardas] - Eiti pas zaideja.",
        'bring': "[BRING] Naudojimas: /bring [ID arba vardas] - Atnesti zaideja pas tave.",
        'tpls': "[TPLS] Naudojimas: /tpls - Teleportuotis i Los Santos saugia vieta.",
        'ban': "[BAN] Naudojimas: /ban [ID arba vardas] [Priezastis] - Uzblokuoti zaideja.",
        'buy': "[BUY] Naudojimas: /buy [item] [kiekis] - Pirkti daiktus versle.",
        'pawnstock': "[PAWNSTOCK] Naudojimas: /pawnstock - Parodo lombardo parduodamus daiktus.",
        'pawnsell': "[PAWNSELL] Naudojimas: /pawnsell [inventory ID/type] - Parduoti pawn daikta lombardui uz 30%.",
        'pawnbuy': "[PAWNBUY] Naudojimas: /pawnbuy [stockId] - Pirkti daikta is lombardo.",
        'pawnprice': "[PAWNPRICE] Naudojimas: /pawnprice [stockId] [kaina] - Savininkui pakeisti lombardo prekes kaina.",
        'pawnrename': "[PAWNRENAME] Naudojimas: /pawnrename [inventory ID/type] [pavadinimas] - Pervadinti pawn daikta lombarde.",
        'pawnstockrename': "[PAWNSTOCKRENAME] Naudojimas: /pawnstockrename [stockId] [pavadinimas] - Savininkui pervadinti stock preke.",
        'bizbank': "[BIZBANK] Naudojimas: /bizbank - Parodo jusu verslo banko likuti.",
        'bizbankdeposit': "[BIZBANKDEPOSIT] Naudojimas: /bizbankdeposit [suma] - Ideti grynuosius i verslo banka.",
        'bizbankwithdraw': "[BIZBANKWITHDRAW] Naudojimas: /bizbankwithdraw [suma] - Isimti pinigus is verslo banko.",
        'setbizname': "[SETBIZNAME] Naudojimas: /setbizname [pavadinimas] - Pervadinti savo versla.",
        'sellbiz': "[SELLBIZ] Naudojimas: /sellbiz [zaidejo ID/vardas] [kaina] - Parduoti savo versla.",
        'giveitem': "[GIVEITEM] Naudojimas: /giveitem [ID arba vardas] [item] [kiekis]",
        'giveweapon': "[GIVEWEAPON] Naudojimas: /giveweapon [zaidejo ID salia] - perduoda laikoma ginkla.",
        'dropweapon': "[DROPWEAPON] Naudojimas: /dropweapon - sunaikina dabar laikoma ginkla.",
        'stashweapon': "[STASHWEAPON] Naudojimas: /stashweapon - padeda laikoma ginkla i jusu masina.",
        'takeweapon': "[TAKEWEAPON] Naudojimas: /takeweapon [id] - paima ginkla is masinos pagal saraso nr.",
        'buildpackage': "[BUILDPACKAGE] Naudojimas: /buildpackage - ideda wheel ginkla i paketa (max 5).",
        'putpackage': "[PUTPACKAGE] Naudojimas: /putpackage - perkelia visa paketa i jusu masina.",
        'viewpackage': "[VIEWPACKAGE] Naudojimas: /viewpackage - parodo jusu ginklu paketo turini.",
        'admingiveweapon': "[ADMINGIVEWEAPON] Naudojimas: /admingiveweapon [ID arba vardas] [weapon] [ammo]",
        'setfactionleader': "[SETFACTIONLEADER] Naudojimas: /setfactionleader [ID arba vardas] [pd|md|none]",
        'finvite': "[FINVITE] Naudojimas: /finvite [ID arba vardas] - Pakviesti i jusu faction.",
        'funinvite': "[FUNINVITE] Naudojimas: /funinvite [ID arba vardas] - Ismesti is jusu faction.",
        'frank': "[FRANK] Naudojimas: /frank [ID arba vardas] [rank] - Pakeisti nario rank.",
        'frankname': "[FRANKNAME] Naudojimas: /frankname [rank] [pavadinimas] - Pervadinti rank.",
        'cuf': "[CUF] Naudojimas: /cuf [ID arba vardas] - Surakinti arba atrakinti salia esanti zaideja.",
        'jail': "[JAIL] Naudojimas: /jail [ID arba vardas] [minutes] [reason] - Uzdaryti i PD kamera.",
        'fine': "[FINE] Naudojimas: /fine [ID arba vardas] [suma] [priezastis] - Israsyti bauda salia esanciam zaidejui.",
        'mdc': "[MDC] Naudojimas: /mdc person|plate|warrant|warrants|clear ... - Policijos duomenu bazes komandos.",
        'revive': "[REVIVE] Naudojimas: /revive [ID arba vardas] - Atgaivinti downed zaideja.",
        '911': "[911] Naudojimas: /911 [pd|md|both] [aprasymas] - Issiusti pagalbos pranesima.",
        'respond': "[RESPOND] Naudojimas: /respond [911 ID] - Priimti pagalbos iskvietima.",
    };
    player.outputChatBox(instructions[command] || "Netinkamas komandos pavadinimas.");
}

mp.events.addCommand('dropweapon', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const heldWeaponHash = getCurrentHoldableWeaponHash(player);
    if (!heldWeaponHash) {
        return player.outputChatBox('!{#e74c3c}Siuo metu nelaikote jokio ginklo.');
    }

    const heldWeaponLabel = getWeaponLabel(heldWeaponHash);
    const removed = setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
    if (!removed) {
        return player.outputChatBox('!{#e74c3c}Nepavyko ismesti ginklo.');
    }

    persistEquippedWeapon(player);

    player.outputChatBox(`!{#7aa164}Ismetete ginkla: ${heldWeaponLabel}.`);
});

mp.events.addCommand('buildpackage', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    if (!Array.isArray(player.weaponPackageWeapons)) {
        player.weaponPackageWeapons = [];
    }

    if (player.weaponPackageWeapons.length >= WEAPON_PACKAGE_LIMIT) {
        return player.outputChatBox(`!{#e74c3c}Paketas pilnas (${WEAPON_PACKAGE_LIMIT}/${WEAPON_PACKAGE_LIMIT}).`);
    }

    const wheelWeaponHash = getCurrentHoldableWeaponHash(player) || sanitizeWeaponHash(player.savedEquippedWeaponHash);
    if (!wheelWeaponHash) {
        return player.outputChatBox('!{#e74c3c}Jusu ginklu wheel neturi idedamo ginklo.');
    }

    const weaponLabel = getWeaponLabel(wheelWeaponHash);
    player.weaponPackageWeapons.push({
        weaponHash: wheelWeaponHash,
        label: weaponLabel,
    });

    const removed = setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
    if (!removed) {
        player.weaponPackageWeapons.pop();
        return player.outputChatBox('!{#e74c3c}Nepavyko ideti ginklo i paketa.');
    }

    persistEquippedWeapon(player);
    persistWeaponPackage(player);
    player.outputChatBox(`!{#7aa164}Idejote ${weaponLabel} i paketa (${player.weaponPackageWeapons.length}/${WEAPON_PACKAGE_LIMIT}).`);
});

mp.events.addCommand('putpackage', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti kokiame nors transporte.');
    }

    if (!Array.isArray(player.weaponPackageWeapons) || player.weaponPackageWeapons.length === 0) {
        return player.outputChatBox('!{#e74c3c}Jusu ginklu paketas tuscias. Naudokite /buildpackage.');
    }

    const vehicle = player.vehicle;
    const stash = getVehicleWeaponStash(vehicle);
    const vehicleCount = stash.length;
    const packageCount = player.weaponPackageWeapons.length;

    if (vehicleCount + packageCount > VEHICLE_WEAPON_STASH_LIMIT) {
        return player.outputChatBox(`!{#e74c3c}Nepakanka vietos transporte. Dabar: ${vehicleCount}/${VEHICLE_WEAPON_STASH_LIMIT}, pakete: ${packageCount}.`);
    }

    player.weaponPackageWeapons.forEach((entry) => {
        const weaponHash = sanitizeWeaponHash(entry && entry.weaponHash);
        if (!weaponHash) return;
        stash.push({ weaponHash, label: getWeaponLabel(weaponHash) });
    });

    const movedCount = player.weaponPackageWeapons.length;
    player.weaponPackageWeapons = [];
    setVehicleWeaponStash(vehicle, stash);
    persistVehicleWeaponStash(vehicle);
    persistWeaponPackage(player);
    player.outputChatBox(`!{#7aa164}Perkelete ${movedCount} ginklus i transporto saugykla (${stash.length}/${VEHICLE_WEAPON_STASH_LIMIT}).`);
});

mp.events.addCommand('viewpackage', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    if (!Array.isArray(player.weaponPackageWeapons) || player.weaponPackageWeapons.length === 0) {
        return player.outputChatBox('!{#e74c3c}Jusu ginklu paketas tuscias. Naudokite /buildpackage.');
    }

    player.outputChatBox(`!{#85c1e9}===== Jusu ginklu paketas (${player.weaponPackageWeapons.length}/${WEAPON_PACKAGE_LIMIT}) =====`);
    player.weaponPackageWeapons.forEach((entry, index) => {
        const label = (entry && entry.label) || getWeaponLabel(entry && entry.weaponHash);
        player.outputChatBox(`!{#d6eaf8}[${index + 1}] ${label}`);
    });
});

mp.events.addCommand('stashweapon', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti kokiame nors transporte.');
    }

    const wheelWeaponHash = getCurrentHoldableWeaponHash(player) || sanitizeWeaponHash(player.savedEquippedWeaponHash);
    if (!wheelWeaponHash) {
        return player.outputChatBox('!{#e74c3c}Jusu ginklu wheel neturi padedamo ginklo.');
    }

    const vehicle = player.vehicle;
    const stash = getVehicleWeaponStash(vehicle);

    if (stash.length >= VEHICLE_WEAPON_STASH_LIMIT) {
        return player.outputChatBox(`!{#e74c3c}Sio transporto ginklu saugykla pilna (${VEHICLE_WEAPON_STASH_LIMIT}/${VEHICLE_WEAPON_STASH_LIMIT}).`);
    }

    const weaponLabel = getWeaponLabel(wheelWeaponHash);
    stash.push({ weaponHash: wheelWeaponHash, label: weaponLabel });

    const removed = setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
    if (!removed) {
        stash.pop();
        return player.outputChatBox('!{#e74c3c}Nepavyko padeti ginklo i masina.');
    }

    setVehicleWeaponStash(vehicle, stash);
    persistVehicleWeaponStash(vehicle);
    persistEquippedWeapon(player);

    player.outputChatBox(`!{#7aa164}Padedote ${weaponLabel} i transporta. Slotas: ${stash.length}.`);
});

mp.events.addCommand('takeweapon', (player, _, slotRaw) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!player.vehicle) {
        return player.outputChatBox('!{#e74c3c}Turite buti kokiame nors transporte.');
    }

    if (!slotRaw) {
        return sendUsageInstructions(player, 'takeweapon');
    }

    const currentWeapon = getCurrentHoldableWeaponHash(player);
    if (currentWeapon) {
        return player.outputChatBox('!{#e74c3c}Jau laikote ginkla. Pirma naudokite /dropweapon arba /stashweapon.');
    }

    const vehicle = player.vehicle;
    const stash = getVehicleWeaponStash(vehicle);

    if (stash.length === 0) {
        return player.outputChatBox('!{#e74c3c}Sio transporto ginklu saugykla tuscia.');
    }

    const slot = parseInt(slotRaw, 10);
    if (!Number.isFinite(slot) || slot < 1 || slot > stash.length) {
        return player.outputChatBox(`!{#e74c3c}Neteisingas slot ID. Galimi: 1-${stash.length}.`);
    }

    const entry = stash[slot - 1];
    const weaponHash = sanitizeWeaponHash(entry && entry.weaponHash);
    if (!weaponHash) {
        return player.outputChatBox('!{#e74c3c}Nepavyko paimti ginklo is nurodyto sloto.');
    }

    const gaveWeapon = setSingleWeaponForPlayer(player, weaponHash, DEFAULT_WEAPON_AMMO);
    if (!gaveWeapon) {
        return player.outputChatBox('!{#e74c3c}Nepavyko paimti ginklo is transporto.');
    }

    const [takenEntry] = stash.splice(slot - 1, 1);
    setVehicleWeaponStash(vehicle, stash);
    persistVehicleWeaponStash(vehicle);
    persistEquippedWeapon(player);

    player.outputChatBox(`!{#7aa164}Pasiemete ${takenEntry.label || getWeaponLabel(weaponHash)} is transporto sloto ${slot}.`);
});

mp.events.addCommand('giveweapon', (player, _, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'giveweapon');
    }

    const targetPlayer = getPlayerByIDOrName(String(targetIdentifier).trim());
    if (!targetPlayer || !targetPlayer.charName) {
        return player.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
    }

    if (targetPlayer.id === player.id) {
        return player.outputChatBox('!{#e74c3c}Negalite duoti ginklo patys sau.');
    }

    if (getDistanceBetweenPositions(player.position, targetPlayer.position) > WEAPON_GIVE_RADIUS) {
        return player.outputChatBox('!{#e74c3c}Zaidejas per toli. Prieikite arciau.');
    }

    const targetCurrentWeapon = getCurrentHoldableWeaponHash(targetPlayer);
    if (targetCurrentWeapon) {
        const targetWeaponLabel = getWeaponLabel(targetCurrentWeapon);
        return player.outputChatBox(`!{#e74c3c}Zaidejas jau laiko ${targetWeaponLabel}. Pirma turi atiduoti arba pasideti savo ginkla.`);
    }

    const weaponHash = getCurrentHoldableWeaponHash(player);
    if (!weaponHash) {
        return player.outputChatBox('!{#e74c3c}Turite laikyti ginkla, kad galetumete ji perduoti.');
    }

    const weaponLabel = getWeaponLabel(weaponHash);
    const gaveTarget = setSingleWeaponForPlayer(targetPlayer, weaponHash, DEFAULT_WEAPON_AMMO);
    const removedFromGiver = setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);

    if (!gaveTarget || !removedFromGiver) {
        return player.outputChatBox('!{#e74c3c}Nepavyko perduoti ginklo.');
    }

    persistEquippedWeapon(player);
    persistEquippedWeapon(targetPlayer);

    player.outputChatBox(`!{#7aa164}Perdavete ${weaponLabel} zaidejui ${targetPlayer.charName}.`);
    targetPlayer.outputChatBox(`!{#7aa164}${player.charName} perdave jums ${weaponLabel}.`);
});

mp.events.addCommand('giveitem', (admin, fullText, targetIdentifier, rawItemType, amountStr) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier || !rawItemType) {
        return sendUsageInstructions(admin, 'giveitem');
    }

    isAdmin(admin, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return admin.outputChatBox('!{#e74c3c}Neturite teisiu naudoti sia komanda.');
        }

        const targetPlayer = getPlayerByIDOrName(targetIdentifier);
        if (!targetPlayer || !targetPlayer.charName) {
            return admin.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
        }

        const itemType = normalizeInventoryItemType(rawItemType);
        if (!itemType || !INVENTORY_ITEM_DEFS[itemType]) {
            return admin.outputChatBox('!{#e74c3c}Nezinomas daiktas. Galimi: water, burger, bandage, medkit, cigarettes, beer, weed, cocaine, meth, crack, shrooms, codeine, percocet, heroin, ecstasy, lsd');
        }

        const amount = Math.max(1, parseInt(amountStr, 10) || 1);
        const addedItem = addInventoryItem(targetPlayer, itemType, amount);
        if (!addedItem) {
            return admin.outputChatBox('!{#e74c3c}Nepavyko prideti daikto.');
        }

        persistInventory(targetPlayer);

        const label = formatInventoryAmount(addedItem.name, amount);
        admin.outputChatBox(`!{#7aa164}Pridejote ${label} zaidejui ${targetPlayer.charName}.`);
        targetPlayer.outputChatBox(`!{#7aa164}Administratorius ${admin.charName} dave jums ${label}.`);
        sendInventoryUpdate(targetPlayer, `Gavote ${label}.`, true);
    });
});

mp.events.addCommand('admingiveweapon', (admin, _, targetIdentifier, rawWeapon, ammoStr) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier || !rawWeapon) {
        return sendUsageInstructions(admin, 'admingiveweapon');
    }

    isAdmin(admin, 1, (error, hasPermission) => {
        if (error || !hasPermission) {
            return admin.outputChatBox('!{#e74c3c}Neturite teisiu naudoti sia komanda.');
        }

        const targetPlayer = getPlayerByIDOrName(String(targetIdentifier).trim());
        if (!targetPlayer || !targetPlayer.charName) {
            return admin.outputChatBox('!{#e74c3c}Zaidejas nerastas arba nepasirinko veikejo.');
        }

        const weaponHash = resolveWeaponHash(rawWeapon);
        if (!weaponHash) {
            return admin.outputChatBox('!{#e74c3c}Neteisingas ginklas. Pvz.: pistol, smg, carbine, weapon_pistol.');
        }

        const ammo = Math.max(1, parseInt(ammoStr, 10) || DEFAULT_WEAPON_AMMO);
        const assigned = setSingleWeaponForPlayer(targetPlayer, weaponHash, ammo);
        if (!assigned) {
            return admin.outputChatBox('!{#e74c3c}Nepavyko priskirti ginklo.');
        }

        persistEquippedWeapon(targetPlayer);

        const weaponLabel = getWeaponLabel(weaponHash);
        admin.outputChatBox(`!{#7aa164}Priskyrete ${weaponLabel} (${ammo} ammo) zaidejui ${targetPlayer.charName}.`);
        targetPlayer.outputChatBox(`!{#7aa164}Administratorius ${admin.charName} dave jums ${weaponLabel} (${ammo} ammo).`);
    });
});

mp.events.addCommand('kick', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'kick');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Zaidejas nerastas.");
        target.kick("Buvo ismestas administratoriaus.");
    });
});

mp.events.addCommand('freeze', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'freeze');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Zaidejas nerastas.");

        if (target.frozen) {
            target.call('freezePlayer', [false]);
            target.frozen = false;
            player.outputChatBox(`[INFO] Atsaldete zaideja ${target.charName || target.name}.`);
        } else {
            target.call('freezePlayer', [true]);
            target.frozen = true;
            player.outputChatBox(`[INFO] Uzsaldete zaideja ${target.charName || target.name}.`);
        }
    });
});

mp.events.addCommand('heal', (admin, targetIdentifier) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    isAdmin(admin, 1, (error, hasPermission) => {
        if (error || !hasPermission) return admin.outputChatBox('[KLAIDA] Neturi tam teisiu.');

        const target = targetIdentifier ? getPlayerByIDOrName(targetIdentifier) : admin;
        if (!target || !target.charName) {
            return admin.outputChatBox('[KLAIDA] Zaidejas nerastas.');
        }

        target.health = 100;
        clearDeathState(target, true);

        if (target.charId) {
            db.query('UPDATE characters SET health = ? WHERE id = ?', [100, target.charId]);
        }

        admin.outputChatBox(`!{#7aa164}Pagydete ${target.charName}.`);
        if (target.id !== admin.id) {
            target.outputChatBox(`!{#7aa164}Administratorius ${admin.charName} jus pagyde.`);
        }
    });
});

mp.events.addCommand('goto', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'goto');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Zaidejas nerastas.");
        player.position = target.position;
    });
});

mp.events.addCommand('tpls', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        clearDeathState(player, true);
        player.dimension = 0;
        player.position = LOS_SANTOS_SAFE_TELEPORT_POS;
        player.heading = LOS_SANTOS_SAFE_TELEPORT_HEADING;

        player.outputChatBox('!{#7aa164}Teleportavotes i Los Santos.');
    });
});

mp.events.addCommand('bring', (player, targetIdentifier) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetIdentifier) {
        return sendUsageInstructions(player, 'bring');
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Zaidejas nerastas.");
        target.position = player.position;
    });
});

mp.events.addCommand('ban', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!fullText) {
        return sendUsageInstructions(player, 'ban');
    }

    const args = fullText.split(" ");
    const targetIdentifier = args[0];
    const reason = args.slice(1).join(" ") || "Nenurodyta priezastis";

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        let target = getPlayerByIDOrName(targetIdentifier);
        if (!target) return player.outputChatBox("[KLAIDA] Zaidejas nerastas.");

        const ip = target.ip;
        const ucpName = target.name;

        db.query('INSERT INTO bans (ip, ucp_name, reason, admin) VALUES (?, ?, ?, ?)', [ip, ucpName, reason, player.charName], (error) => {
            if (error) return player.outputChatBox("[KLAIDA] Ivyko klaida bandant uzblokuoti zaideja.");

            target.kick(`Buvo uzblokuotas. Priezastis: ${reason}`);
            player.outputChatBox(`[INFO] Jus uzblokavote zaideja ${target.charName || target.name} (UCP: ${ucpName}, IP: ${ip}). Priezastis: ${reason}`);
            mp.players.broadcast(`[INFO] Zaidejas ${target.charName || target.name} buvo uzblokuotas. Priezastis: ${reason}`);
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
                console.error("Klaida tikrinant admin lygi:", err);
                resolve(0);
            } else {
                resolve(results.length > 0 ? results[0]["admin_level"] : 0);
            }
        });
    });
}

mp.events.addCommand('helpme', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!fullText) {
        player.outputChatBox("[HELP] Naudojimas: /helpme <klausimas>");
        return;
    }

    if (activeHelpRequests.has(player.id)) {
        player.outputChatBox("[HELP] Jus jau pateikete pagalbos prasyma. Palaukite administratoriaus atsakymo.");
        return;
    }

    activeHelpRequests.set(player.id, fullText);

    mp.players.forEach(async (admin) => {
        const adminLevel = await getAdminLevelFromDB(admin);
        if (adminLevel === 1 || adminLevel === 2) {
            admin.outputChatBox(`!{#ADD8E6}[HELP] ${player.charName} (${player.id}): ${fullText} - priimti su /accepthelp ${player.id}`);
        }
    });

    player.outputChatBox("[HELP] Jusu pagalbos prasymas buvo issiustas administratoriams.");
});

mp.events.addCommand('accepthelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jus nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Zaidejas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Sis zaidejas nepateike pagalbos prasymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#7aa164}[HELP] Administratorius ${admin.charName} jums pades.`);
    admin.outputChatBox(`[HELP] Jus priemete ${target.charName || target.name} (${target.id}) pagalbos prasyma.`);
});

mp.events.addCommand('declinehelp', async (admin, playerId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        admin.outputChatBox("[HELP] Jus nesate administratorius.");
        return;
    }

    const target = getPlayerByIDOrName(playerId);
    if (!target) {
        admin.outputChatBox("[HELP] Zaidejas nerastas.");
        return;
    }

    if (!activeHelpRequests.has(target.id)) {
        admin.outputChatBox("[HELP] Sis zaidejas nepateike pagalbos prasymo.");
        return;
    }

    activeHelpRequests.delete(target.id);
    target.outputChatBox(`!{#cd5d3c}[HELP] Administratorius ${admin.charName} atmete jusu pagalbos prasyma.`);
    admin.outputChatBox(`[HELP] Jus atmetete ${target.charName || target.name} (${target.id}) pagalbos prasyma.`);
});

const reports = new Map();

mp.events.addCommand("report", async (player, fullText, targetId, ...reasonArray) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetId || reasonArray.length === 0) {
        return player.outputChatBox("Naudojimas: /report [zaidejo ID] [priezastis]");
    }
    if (reports.has(player.id)) {
        return player.outputChatBox("Jusu reportas jau laukia administratoriu sprendimo.");
    }

    const target = getPlayerByIDOrName(targetId);
    if (!target) {
        return player.outputChatBox("Zaidejas su tokiu ID nerastas.");
    }

    if (!target.charName) {
        return player.outputChatBox("Zaidejas dar nepasirinko veikejo.");
    }

    const reason = reasonArray.join(" ");
    reports.set(player.id, { player, target, reason });

    mp.players.forEach(async (admin) => {
        const adminLvl = await getAdminLevelFromDB(admin);
        if (adminLvl >= 1) {
            admin.outputChatBox(`!{#f0e237}[REPORT] ${player.charName} pranese apie ${target.charName}: ${reason} (ID: ${player.id})`);
            admin.outputChatBox(`!{#f0e237}Norint priimti reporta: /acceptreport ${player.id}`);
            admin.outputChatBox(`!{#f0e237}Norint atmesti reporta: /declinereport ${player.id}`);
        }
    });

    player.outputChatBox("Jusu reportas buvo issiustas administracijai.");
});

mp.events.addCommand("acceptreport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisiu naudoti sia komanda.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox(`!{#7aa164}Jusu report buvo priimtas administratoriaus ${admin.charName}.`);
    mp.players.forEach(async adminPlayer => {
        const adminLevel = await getAdminLevelFromDB(adminPlayer);
        if (adminLevel >= 1) {
            adminPlayer.outputChatBox(`[REPORT] ${admin.charName} prieme ${report.player.charName} reporta pries ${report.target.charName}.`);
        }
    });
});

mp.events.addCommand("declinereport", async (admin, fullText, reportId) => {
    if (!admin.charName) return admin.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const adminLevel = await getAdminLevelFromDB(admin);
    if (adminLevel < 1) {
        return admin.outputChatBox("Neturite teisiu naudoti sia komanda.");
    }
    if (!reportId || !reports.has(parseInt(reportId))) {
        return admin.outputChatBox("Neteisingas reporto ID.");
    }

    const report = reports.get(parseInt(reportId));
    reports.delete(parseInt(reportId));

    report.player.outputChatBox("!{#cd5d3c}Jusu report buvo atmestas administratoriaus.");
    admin.outputChatBox(`[REPORT] Jus atmetete ${report.player.charName} reporta pries ${report.target.charName}.`);
});


// /admins command - List all online admins (level 1 or 2)
mp.events.addCommand('admins', (player) => {
    const onlineAdmins = mp.players.toArray().filter(p => p.adminLevel >= 1 && p.adminLevel <= 2);

    if (onlineAdmins.length === 0) {
        player.outputChatBox('!{#f7dc6f}Siuo metu nera prisijungusiu administratoriu.');
        return;
    }

    player.outputChatBox('!{#f7dc6f}===== Prisijunge Administratoriai =====');
    onlineAdmins.forEach(admin => {
        const adminLevelText = admin.adminLevel === 1 ? 'Administratorius' : 'Vadovybe';
        player.outputChatBox(`[${adminLevelText}] ${admin.adminName} (ID: ${admin.id})`);
    });
    player.outputChatBox('!{#f7dc6f}=====================================');
});

// /setaname command - Set admin name for display in /admins
mp.events.addCommand('setaname', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!fullText) {
        player.outputChatBox('Naudojimas: /setaname [admin vardas]');
        return;
    }

    isAdmin(player, 1, (error, hasPermission) => {
        if (error || !hasPermission) return player.outputChatBox("[KLAIDA] Neturi tam teisiu.");

        const newAdminName = fullText.trim();
        if (newAdminName.length < 3 || newAdminName.length > 20) {
            player.outputChatBox('!{#e74c3c}Admin vardas turi buti nuo 3 iki 20 simboliu.');
            return;
        }

        // Update admin_name in the database
        db.query('UPDATE characters SET admin_name = ? WHERE char_name = ?', [newAdminName, player.charName], (err) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko atnaujinti admin vardo:', err);
                player.outputChatBox('!{#e74c3c}Ivyko klaida keiciant admin varda.');
                return;
            }

            player.adminName = newAdminName;
            player.outputChatBox(`!{#7aa164}Jusu admin vardas nustatytas: ${newAdminName}`);
        });
    });
});

mp.events.addCommand('changechar', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    if (player.isDowned) {
        const now = Date.now();
        const availableAt = Number(player.acceptDeathAvailableAt || 0);
        if (availableAt > now) {
            const secondsLeft = Math.ceil((availableAt - now) / 1000);
            return player.outputChatBox(`!{#e74c3c}Negalite naudoti /changechar mirties busenoje. Liko ${secondsLeft} sek iki /acceptdeath.`);
        }
    }

    // Save current character data
    cleanupDMVTest(player, true);
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
    clearDeathState(player, true);
    clearPlayerDrugEffectTimers(player);
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
    player.hasDriversLicense = false;
    player.contacts = null;
    player.phoneNumber = null;
    player.bankAccountNumber = null;
    player.isPhoneOpen = false;
    player.outfitData = null;
    player.barberData = null;
    player.currentPropertyId = null;
    player.currentBusinessId = null;
    player.dimension = 0;
    pendingRentOffers.delete(player.id);

    for (const [targetId, offer] of pendingRentOffers.entries()) {
        if (offer && Number(offer.ownerPlayerId) === Number(player.id)) {
            pendingRentOffers.delete(targetId);
        }
    }
    player.inventory = null;
    player.weaponPackageWeapons = [];
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
    player.outputChatBox('!{#f7dc6f}Jus atsijungete nuo veikejo. Pasirinkite nauja veikeja.');
    console.log('[DEBUG] Called loadCharacterSelection');
});

mp.events.add('requestOnlineCharacters', (player) => {
    if (!player || !player.charName) return;

    const onlineCharacters = mp.players.toArray()
        .filter((target) => target && target.charName)
        .map((target) => ({
            id: target.id,
            name: target.charName,
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    player.call('showOnlineCharactersUI', [JSON.stringify(onlineCharacters)]);
});

mp.events.addCommand('acceptdeath', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!player.isDowned) {
        return player.outputChatBox('!{#f7dc6f}Siuo metu nesate mirties busenoje.');
    }

    const now = Date.now();
    const availableAt = Number(player.acceptDeathAvailableAt || 0);
    if (availableAt > now) {
        const secondsLeft = Math.ceil((availableAt - now) / 1000);
        return player.outputChatBox(`!{#f7dc6f}Dar negalite priimti mirties. Liko ${secondsLeft} sek.`);
    }

    applyAcceptDeathConsequences(player, {
        spawnAtHospital: true,
        notifyPlayer: true,
        persistNow: true,
    });
});




mp.events.addCommand('coords', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const coords = player.position;
    player.outputChatBox(`Current Coordinates: X: ${coords.x.toFixed(2)}, Y: ${coords.y.toFixed(2)}, Z: ${coords.z.toFixed(2)}`);
});

function openDMVInteraction(player) {
    if (!player || !player.charId || !player.charName) return;
    if (!isPlayerNearDMV(player)) return;

    if (player.hasDriversLicense) {
        return player.outputChatBox('!{#f7dc6f}Jus jau turite vairuotojo pazymejima.');
    }

    if (activeDMVTests.has(player.id)) {
        return player.outputChatBox('!{#f7dc6f}Jusu DMV testas jau vyksta.');
    }

    player.call('openDMVStartUI');
}

function startPaidDMVTheory(player) {
    if (!player || !player.charId || !player.charName) return;
    if (!isPlayerNearDMV(player)) {
        return player.outputChatBox('!{#e74c3c}Turite buti DMV vietoje, kad pradeti testa.');
    }

    if (player.hasDriversLicense) {
        return player.outputChatBox('!{#f7dc6f}Jus jau turite vairuotojo pazymejima.');
    }

    if (activeDMVTests.has(player.id)) {
        return player.outputChatBox('!{#f7dc6f}Jusu DMV testas jau vyksta.');
    }

    const currentMoney = Number(player.money) || 0;
    if (currentMoney < DMV_TEST_FEE) {
        return player.outputChatBox(`!{#e74c3c}DMV testas kainuoja $${DMV_TEST_FEE}. Neturite pakankamai grynuju pinigu.`);
    }

    player.money = currentMoney - DMV_TEST_FEE;
    persistPlayerMoney(player);
    activeDMVTests.set(player.id, {
        phase: 'theory',
        vehicle: null,
        checkpointIndex: 0,
        startedAt: Date.now(),
    });
    player.outputChatBox(`!{#85c1e9}Sumokejote $${DMV_TEST_FEE} uz DMV testa. Neislaikius reikes moketi is naujo.`);
    player.call('openDMVQuizUI');
}

mp.events.add('requestDMVInteraction', (player) => {
    openDMVInteraction(player);
});

mp.events.addCommand('dmv', (player) => {
    openDMVInteraction(player);
});

mp.events.add('startDMVTest', (player) => {
    startPaidDMVTheory(player);
});

mp.events.add('submitDMVTheory', (player, answersJson) => {
    if (!player || !player.charId || !player.charName) return;
    if (!isPlayerNearDMV(player)) {
        cleanupDMVTest(player, true);
        return player.call('dmvTheoryFailed', ['Turite buti DMV vietoje. Testas nutrauktas, mokestis negrazinamas.', true]);
    }

    const state = activeDMVTests.get(player.id);
    if (!state || state.phase !== 'theory') {
        return player.call('dmvTheoryFailed', ['Pradekite DMV testa is naujo ir sumokekite mokesti.', true]);
    }

    let answers = [];
    try {
        answers = JSON.parse(String(answersJson || '[]'));
    } catch (e) {
        answers = [];
    }

    const passed = Array.isArray(answers)
        && answers.length === DMV_THEORY_ANSWERS.length
        && DMV_THEORY_ANSWERS.every((answer, index) => String(answers[index] || '').toLowerCase() === answer);

    if (!passed) {
        cleanupDMVTest(player, true);
        return player.call('dmvTheoryFailed', ['Atsakymai neteisingi. Testas neislaikytas, mokestis negrazinamas.', true]);
    }

    startDMVPracticalTest(player);
});

mp.events.add('cancelDMVTheory', (player) => {
    if (!player || !player.charId) return;

    const state = activeDMVTests.get(player.id);
    if (!state || state.phase !== 'theory') return;

    cleanupDMVTest(player, true);
    player.outputChatBox('!{#f7dc6f}DMV teorijos testas uzdarytas. Norint bandyti vel, reikes moketi is naujo.');
});

mp.events.add('dmvCheckpointReached', (player, checkpointIndexRaw) => {
    if (!player || !player.charId || !player.charName) return;

    const state = activeDMVTests.get(player.id);
    if (!state || !state.vehicle) return;

    const checkpointIndex = parseInt(checkpointIndexRaw, 10);
    if (!Number.isFinite(checkpointIndex) || checkpointIndex !== state.checkpointIndex) return;

    if (player.vehicle !== state.vehicle) {
        return failDMVPracticalTest(player, 'DMV testas nutrauktas, nes palikote testo automobili. Norint bandyti vel, reikes moketi is naujo.');
    }

    const target = DMV_ROUTE_POINTS[state.checkpointIndex];
    const distance = getDistanceBetweenPositions(player.position, target);
    if (distance > 7.5) return;

    state.checkpointIndex += 1;
    if (state.checkpointIndex >= DMV_ROUTE_POINTS.length) {
        completeDMVTest(player);
    } else {
        player.outputChatBox(`!{#85c1e9}DMV checkpoint ${state.checkpointIndex}/${DMV_ROUTE_POINTS.length} pasiektas.`);
    }
});

mp.events.add('playerExitVehicle', (player, vehicle) => {
    if (!player || !vehicle) return;

    const state = activeDMVTests.get(player.id);
    if (!state || state.phase !== 'practical') return;
    if (state.vehicle !== vehicle && Number(state.vehicle?.id) !== Number(vehicle.id)) return;

    failDMVPracticalTest(player, 'DMV praktinis testas neislaikytas, nes islipote is testo automobilio. Norint bandyti vel, reikes moketi is naujo.');
});

mp.events.add('dmvVehicleLeft', (player) => {
    if (!player || !player.charId || !player.charName) return;

    const state = activeDMVTests.get(player.id);
    if (!state || state.phase !== 'practical') return;

    failDMVPracticalTest(player, 'DMV praktinis testas neislaikytas, nes nebesate testo automobilio vairuotojas. Norint bandyti vel, reikes moketi is naujo.');
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

mp.events.add('requestClearEmptyWeapon', (player, weaponHashRaw) => {
    if (!player || !player.charId) return;

    const requestedWeaponHash = sanitizeWeaponHash(weaponHashRaw);
    if (!requestedWeaponHash) return;

    const currentWeaponHash = sanitizeWeaponHash(getCurrentHoldableWeaponHash(player));
    const savedWeaponHash = sanitizeWeaponHash(player.savedEquippedWeaponHash);

    // Reject stale or spoofed requests that don't match what the player actually has.
    if (currentWeaponHash && currentWeaponHash !== requestedWeaponHash) return;
    if (!currentWeaponHash && savedWeaponHash && savedWeaponHash !== requestedWeaponHash) return;
    if (!currentWeaponHash && !savedWeaponHash) return;

    const cleared = setSingleWeaponForPlayer(player, WEAPON_UNARMED_HASH, 0);
    if (!cleared) return;

    persistEquippedWeapon(player);
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

    if (DRUG_EFFECT_DEFS[item.type]) {
        const started = startDrugInventoryEffect(player, item);
        if (!started) {
            return sendInventoryUpdate(player, 'Sio daikto naudoti nepavyko.', false);
        }

        removeInventoryItemAmount(player, itemId, 1);
        persistInventory(player);

        const statusText = `${item.name} suvartota. Poveiki pajusite po 2 minuciu.`;
        player.outputChatBox(`!{#7aa164}${statusText}`);
        return sendInventoryUpdate(player, statusText, true);
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
    addExistingInventoryItem(targetPlayer, item, amount);
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


// ==================== DRIVE / PAVEZEJU SISTEMA (CLEAN & FIXED) ====================

function clearRidePickupBlip(ride) {
    if (!ride || !ride.blip) return;
    try {
        ride.blip.destroy();
    } catch (e) {
        // Ignore stale blip handles.
    }
    ride.blip = null;
}

function openPhone(player) {
    if (!player.charName) {
        return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
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
        player.outputChatBox('!{#cd5d3c}Jus nebesate Drive vairuotojas.');
        player.call('updateDriverStatus', [false]);
    } else {
        if (!player.vehicle) {
            return player.outputChatBox('!{#e74c3c}Jums reikia buti transporto priemoneje!');
        }
        activeDrivers.set(player.id, { player, status: "available" });
        player.outputChatBox('!{#7aa164}Jus tapote Drive vairuotoju!');
        player.call('updateDriverStatus', [true]);
    }
});

// Request ride
mp.events.add('requestRide', (player) => {
    if (!player.charName) return;
    if (activeRides.has(player.id)) {
        return player.outputChatBox('!{#e74c3c}Jus jau turite aktyvia kelione!');
    }

    if (activeDrivers.size === 0) {
        return player.outputChatBox('!{#f7dc6f}Siuo metu nera laisvu vairuotoju.');
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
                data.player.outputChatBox(`!{#f7dc6f}[Drive] ${player.charName} iesko pavezejimo! /acceptdrive ${player.id}`);
            }
        }
    });

    player.outputChatBox('!{#7aa164}Uzklausa issiusta vairuotojams...');
});

// Accept ride command
mp.events.addCommand('acceptdrive', (driver, requesterIdStr) => {
    if (!driver.charName || !activeDrivers.has(driver.id)) {
        return driver.outputChatBox('!{#e74c3c}Jus nesate aktyvus vairuotojas!');
    }

    const reqId = parseInt(requesterIdStr);
    if (!activeRides.has(reqId)) {
        return driver.outputChatBox('!{#f7dc6f}Uzklausa nebegalioja.');
    }

    const ride = activeRides.get(reqId);
    if (ride.driver) {
        return driver.outputChatBox('!{#e74c3c}Sia uzklausa jau prieme kitas vairuotojas.');
    }

    ride.driver = driver;
    activeDrivers.get(driver.id).status = "busy";

    ride.blip = mp.blips.new(1, ride.requester.position, {
        name: `Keleivis: ${ride.requester.charName}`,
        color: 2,
        scale: 1.2
    });

    driver.outputChatBox(`!{#7aa164}Priemete ${ride.requester.charName}! Vaziuokite jo pasiimti.`);
    ride.requester.outputChatBox(`!{#7aa164}Vairuotojas ${driver.charName} prieme jusu uzklausa!`);

    ride.interval = setInterval(() => {
        if (!ride.driver || !ride.requester) {
            clearInterval(ride.interval);
            activeRides.delete(reqId);
            return;
        }
        const dist = getDistanceBetweenPositions(ride.driver.position, ride.requester.position);
        if (dist <= 12) {
            clearInterval(ride.interval);
            clearRidePickupBlip(ride);

            if (activeDrivers.has(ride.driver.id)) {
                activeDrivers.get(ride.driver.id).status = "available";
            }

            activeRides.delete(reqId);
            ride.driver.outputChatBox('!{#7aa164} Jus pasiekete keleivi!');
            ride.requester.outputChatBox('!{#7aa164} Vairuotojas atvyko pas jus!');
        }
    }, 2000);
});

// Tracks ongoing calls: { callerId: { caller, target, status } }

// /call command
mp.events.addCommand('call', (player, fullText) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    const phoneNumber = splitCommandText(fullText)[0];
    if (!phoneNumber) return player.outputChatBox('Naudojimas: /call [telefono numeris]');
    if (phoneNumber === '911') {
        player.outputChatBox('!{#e74c3c}911 operatorius: Kokia pagalba reikalinga?');
        player.outputChatBox('!{#f7dc6f}Naudokite: /911 [pd|md|both] [trumpas aprasymas]');
        player.outputChatBox('!{#d6eaf8}Pvz: /911 pd Mane apiplese prie banko');
        return;
    }
    if (!requirePhoneSim(player)) return;
    if (activeCalls.has(player.id)) return player.outputChatBox('!{#e74c3c}Jus jau esate skambutyje arba laukiate atsakymo.');

    const target = mp.players.toArray().find(p => p.phoneNumber === phoneNumber);
    if (!target || !target.charName) {
        player.call('callFailed', ['Sis telefono numeris nerastas arba zaidejas neprisijunges.']);
        return player.outputChatBox('!{#f7dc6f}Sis telefono numeris nerastas arba zaidejas neprisijunges.');
    }

    if (target.id === player.id) {
        player.call('callFailed', ['Negalite skambinti sau!']);
        return player.outputChatBox('!{#e74c3c}Negalite skambinti sau!');
    }

    if (!startCall(player, target)) {
        player.call('callFailed', ['Skambutis negali buti pradetas.']);
        return player.outputChatBox('!{#e74c3c}Skambutis negali buti pradetas.');
    }
});

// /answer command
mp.events.addCommand('answer', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Siuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    const activeCallData = { caller, target: player, status: 'active' };
    activeCalls.set(player.id, activeCallData);
    activeCalls.set(caller.id, activeCallData);

    player.outputChatBox(`!{#7aa164}Jus priemete skambuti is ${caller.charName}.`);
    caller.outputChatBox(`!{#7aa164}${player.charName} prieme jusu skambuti.`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]); // Update phone UI
    caller.call('callStarted', [player.charName, player.phoneNumber]); // Update caller's phone UI
});

// /decline command
mp.events.addCommand('decline', (player) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    const callRequest = activeCalls.get(player.id);
    if (!callRequest || callRequest.status !== 'incoming') {
        return player.outputChatBox('!{#f7dc6f}Siuo metu jums niekas neskambina.');
    }

    const caller = callRequest.caller;
    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#cd5d3c}Jus atmetete skambuti is ${caller.charName}.`);
    caller.outputChatBox(`!{#cd5d3c}${player.charName} atmete jusu skambuti.`);
    player.call('callEnded');
    caller.call('callEnded');
});

// Handle player disconnect
mp.events.add('playerQuit', (player) => {
    cleanupDMVTest(player, false);
    clearPlayerDrugEffectTimers(player);

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

    if (player.jailTimer) {
        clearTimeout(player.jailTimer);
        delete player.jailTimer;
    }

    const isDownedOnQuit = Boolean(player.isDowned);
    const downedAcceptAvailableAt = Number(player.acceptDeathAvailableAt || 0);
    const shouldAutoAcceptDeathOnQuit = isDownedOnQuit && downedAcceptAvailableAt > Date.now();

    if (shouldAutoAcceptDeathOnQuit) {
        // If player disconnects while downed countdown is active, apply /acceptdeath penalties instantly.
        applyAcceptDeathConsequences(player, {
            spawnAtHospital: false,
            notifyPlayer: false,
            persistNow: false,
        });
        player.position = HOSPITAL_RESPAWN_POS;
        player.heading = HOSPITAL_RESPAWN_HEADING;
        player.dimension = 0;
    } else {
        clearDeathState(player, false);
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
            clearRidePickupBlip(ride);
            activeRides.delete(requesterId);
        }
    }

    // Clean up phone state
    player.contacts = null;
    player.isPhoneOpen = false;
    player.currentPropertyId = null;
    player.currentBusinessId = null;
    pendingRentOffers.delete(player.id);

    for (const [targetId, offer] of pendingRentOffers.entries()) {
        if (offer && Number(offer.ownerPlayerId) === Number(player.id)) {
            pendingRentOffers.delete(targetId);
        }
    }

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
        console.log(`[INFO] Zaidejas ${player.name} atsijunge be pasirinkto veikejo.`);
    }
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
    if (!player || !vehicle || !player.charId) return;

    const pendingPassengerSeatRaw = player.pendingPassengerSeat;
    const pendingPassengerSeat = Number.isFinite(Number(pendingPassengerSeatRaw)) ? Number(pendingPassengerSeatRaw) : null;
    const pendingPassengerVehicleId = Number(player.pendingPassengerSeatVehicleId);
    if (
        pendingPassengerSeat !== null
        && pendingPassengerVehicleId === Number(vehicle.id)
    ) {
        const initialSeat = Number(seat);
        const attemptSeatCorrection = () => {
            if (!player || player.vehicle !== vehicle) {
                delete player.pendingPassengerSeat;
                delete player.pendingPassengerSeatVehicleId;
                delete player.pendingPassengerSeatAttempts;
                return;
            }

            const currentSeat = Number(player.seat);
            const frontPassengerSeats = [0, 1];
            const attempts = Number(player.pendingPassengerSeatAttempts) || 0;
            const seatCandidates = [pendingPassengerSeat, 2, 3, 4, 5, 6, 1, 0]
                .filter((candidate, index, arr) => Number.isFinite(candidate) && candidate >= 0 && arr.indexOf(candidate) === index);

            if (!frontPassengerSeats.includes(currentSeat)) {
                delete player.pendingPassengerSeat;
                delete player.pendingPassengerSeatVehicleId;
                delete player.pendingPassengerSeatAttempts;
                return;
            }

            if (attempts >= seatCandidates.length) {
                delete player.pendingPassengerSeat;
                delete player.pendingPassengerSeatVehicleId;
                delete player.pendingPassengerSeatAttempts;
                return;
            }

            const targetSeat = seatCandidates[attempts];
            if (!Number.isFinite(targetSeat) || targetSeat === currentSeat || isVehicleSeatOccupied(vehicle, targetSeat)) {
                player.pendingPassengerSeatAttempts = attempts + 1;
                setTimeout(attemptSeatCorrection, 120);
                return;
            }

            player.pendingPassengerSeatAttempts = attempts + 1;

            try {
                player.putIntoVehicle(vehicle, targetSeat);
            } catch (e) {
                delete player.pendingPassengerSeat;
                delete player.pendingPassengerSeatVehicleId;
                delete player.pendingPassengerSeatAttempts;
                return;
            }

            setTimeout(attemptSeatCorrection, 120);
        };

        if (initialSeat >= 0) {
            setTimeout(attemptSeatCorrection, 120);
        }
    }

    // Turn off engine when driver enters vehicle
    if ((seat === -1 || seat === 0) && !vehicle.isDMVTestVehicle) {
        // Set immediately
        try {
            vehicle.engine = false;
            vehicle.setVariable('manualEngineOn', 0);
        } catch (e) {
            console.error('[VEHICLES] Error turning off engine:', e.message);
        }

        // Set after 50ms
        setTimeout(() => {
            try {
                vehicle.engine = false;
                vehicle.setVariable('manualEngineOn', 0);
            } catch (e) { }
        }, 50);

        // Set after 150ms to really ensure it sticks
        setTimeout(() => {
            try {
                vehicle.engine = false;
                vehicle.setVariable('manualEngineOn', 0);
            } catch (e) { }
        }, 150);
    }
});



// Server-side
mp.events.add('openPhoneUI', (player, isDriver) => {
    if (!player.charId) {
        player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
        return;
    }
    const contacts = player.contacts || [];
    player.isPhoneOpen = true;
    console.log(`[DEBUG] Sending contacts to client for charId ${player.charId}:`, contacts);
    player.call('loadContacts', [JSON.stringify(contacts), isDriver, player.phoneNumber || 'Nera numerio']);
});

// Add contact to database
mp.events.add('addContact', (player, name, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!/^\d+$/.test(number)) return player.outputChatBox('!{#e74c3c}Numeris turi buti tik skaitmenys!');

    db.query('SELECT COUNT(*) as count FROM contacts WHERE char_id = ?', [player.charId], (err, countResult) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontaktu skaiciaus:', err);
            return player.outputChatBox('!{#e74c3c}Klaida pridedant kontakta.');
        }

        if (countResult[0].count >= 50) {
            return player.outputChatBox('!{#e74c3c}Jusu kontaktu sarasas pilnas!');
        }

        db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, results) => {
            if (err) {
                console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
                return player.outputChatBox('!{#e74c3c}Klaida pridedant kontakta.');
            }

            if (results.length > 0) {
                return player.outputChatBox('!{#e74c3c}Sis numeris jau yra jusu kontaktuose!');
            }

            db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
                [player.charId, name, number], (err) => {
                    if (err) {
                        console.error('[KLAIDA] Nepavyko prideti kontakto:', err);
                        return player.outputChatBox('!{#e74c3c}Klaida pridedant kontakta.');
                    }

                    loadCharacterContacts(player);
                    player.outputChatBox(`!{#7aa164}Pridetas kontaktas: ${name} (${number})`);
                });
        });
    });
});

// Remove contact from database
mp.events.add('removeContact', (player, number) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    db.query('DELETE FROM contacts WHERE char_id = ? AND contact_number = ?', [player.charId, number], (err, result) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko pasalinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida salinant kontakta.');
        }

        if (result.affectedRows === 0) return;

        loadCharacterContacts(player);
        const removedContact = (player.contacts || []).find(c => c.number === number);
        if (removedContact) {
            player.outputChatBox(`!{#cd5d3c}Pasalintas kontaktas: ${removedContact.name}`);
        }
    });
});

// Call contact (unchanged)
mp.events.add('callContact', (player, number) => {
    mp.events.call('call', player, number); // No length restriction needed
});

// Update /sharenumber command
mp.events.addCommand('sharenumber', (player, fullText, targetId, contactName) => {
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!targetId || !contactName) {
        return player.outputChatBox('Naudojimas: /sharenumber [ID] [vardas]');
    }

    const target = mp.players.at(parseInt(targetId));
    if (!target) {
        return player.outputChatBox('!{#e74c3c}Zaidejas nerastas!');
    }
    if (!target.charId) {
        return player.outputChatBox('!{#e74c3c}Zaidejas dar nepasirinko veikejo.');
    }
    if (!requirePhoneSim(player)) return;

    db.query('SELECT * FROM contacts WHERE char_id = ? AND contact_number = ?', [target.charId, player.phoneNumber], (err, results) => {
        if (err) {
            console.error('[KLAIDA] Nepavyko patikrinti kontakto:', err);
            return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
        }

        if (results.length > 0) {
            return player.outputChatBox('!{#e74c3c}Jusu numeris jau yra sio zaidejo kontaktuose!');
        }

        db.query('INSERT INTO contacts (char_id, contact_name, contact_number) VALUES (?, ?, ?)',
            [target.charId, contactName, player.phoneNumber], (err) => {
                if (err) {
                    console.error('[KLAIDA] Nepavyko prideti kontakto:', err);
                    return player.outputChatBox('!{#e74c3c}Klaida dalinantis numeriu.');
                }

                loadCharacterContacts(target);
                player.outputChatBox(`!{#7aa164}Jus pasidalinote savo numeriu su ${target.charName} kaip ${contactName}`);
                target.outputChatBox(`!{#7aa164}${player.charName} pridejo jus i kontaktus kaip ${contactName} (${player.phoneNumber})`);
            });
    });
});

mp.events.add('call', (player, number) => {
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!requirePhoneSim(player)) return;

    const target = mp.players.toArray().find(p => p.phoneNumber === number);
    if (!target) {
        player.outputChatBox('!{#e74c3c}Numeris nepasiekiamas arba neegzistuoja!');
        return;
    }
    if (!target.charName) {
        player.outputChatBox('!{#e74c3c}Sis zaidejas dar nepasirinko veikejo!');
        return;
    }
    if (activeCalls.has(target.id)) {
        player.outputChatBox('!{#e74c3c}Sis numeris siuo metu uzimtas!');
        return;
    }

    if (!startCall(player, target)) {
        player.outputChatBox('!{#e74c3c}Skambutis negali buti pradetas.');
    }
});

mp.events.add('acceptCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nera gaunamo skambucio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.set(player.id, { caller: caller, target: player, status: 'active' });
    activeCalls.set(caller.id, { caller: caller, target: player, status: 'active' });

    player.outputChatBox(`!{#7aa164}Jus priemete skambuti nuo ${caller.charName}!`);
    caller.outputChatBox(`!{#7aa164}${player.charName} prieme jusu skambuti!`);
    player.call('callStarted', [caller.charName, caller.phoneNumber]);
    caller.call('callStarted', [player.charName, player.phoneNumber]);
});

mp.events.add('declineCall', (player) => {
    if (!activeCalls.has(player.id) || activeCalls.get(player.id).status !== 'incoming') {
        player.outputChatBox('!{#e74c3c}Nera gaunamo skambucio!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const caller = callData.caller;

    activeCalls.delete(player.id);
    activeCalls.delete(caller.id);

    player.outputChatBox(`!{#7aa164}Jus atmetete skambuti nuo ${caller.charName}.`);
    caller.outputChatBox(`!{#e74c3c}${player.charName} atmete jusu skambuti.`);
    player.call('callEnded');
    caller.call('callEnded');
});

mp.events.addCommand('hangup', (player) => {
    if (!activeCalls.has(player.id)) {
        player.outputChatBox('!{#e74c3c}Jus nesate skambutyje!');
        return;
    }

    const callData = activeCalls.get(player.id);
    const partner = (callData.caller && callData.caller.id === player.id) ? callData.target : callData.caller;

    activeCalls.delete(player.id);
    if (partner && activeCalls.has(partner.id)) {
        activeCalls.delete(partner.id);
        partner.outputChatBox('!{#e74c3c}Skambutis baigtas kitos puses.');
        partner.call('callEnded');
    }

    player.outputChatBox('!{#7aa164}Jus baigete skambuti.');
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!requirePhoneSim(player)) return;
    if (!targetNumber || messageArray.length === 0) {
        return player.outputChatBox('Naudojimas: /sms [telefono numeris] [zinute]');
    }

    const messageText = messageArray.join(' ');
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Zinute per ilga! Maksimumas 500 simboliu.');
    }

    // Anti-spam check
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug zinuciu! Palaukite minute.');
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
                console.error('[KLAIDA] Nepavyko issaugoti zinutes:', err);
                return player.outputChatBox('!{#e74c3c}Klaida siunciant zinute.');
            }

            player.outputChatBox(`!{#7aa164}Zinute nusiusta -> ${targetNumber}${target ? ` (${target.charName})` : ' (neprisijunges)'}`);

            // Send notification to recipient
            if (target && target !== player) {
                sendMessageNotification(target, player.phoneNumber, player.charName, messageText);
            }
        }
    );
});

// Send message from Phone UI
mp.events.add('sendMessage', (player, recipientNumber, messageText) => {
    console.log(`[DEBUG] Phone UI sendMessage: ${player.charName} -> ${recipientNumber}`);

    if (!player.charName || !player.charId) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!requirePhoneSim(player)) return;
    if (!recipientNumber || !messageText || messageText.trim().length === 0) {
        return player.outputChatBox('!{#e74c3c}Iveskite gaveja ir zinute!');
    }
    if (!/^\d+$/.test(recipientNumber)) {
        return player.outputChatBox('!{#e74c3c}Numeris turi buti tik skaitmenys!');
    }
    if (messageText.length > 500) {
        return player.outputChatBox('!{#e74c3c}Zinute per ilga! (max 500 simboliu)');
    }

    // Anti-spam
    const now = Date.now();
    let cooldown = messageCooldowns.get(player) || { last: 0, count: 0 };
    if (now - cooldown.last > COOLDOWN_PERIOD) {
        cooldown = { last: now, count: 1 };
    } else {
        cooldown.count++;
        if (cooldown.count > MAX_MESSAGES_PER_MINUTE) {
            return player.outputChatBox('!{#e74c3c}Per daug zinuciu! Palaukite minute.');
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
                return player.outputChatBox('!{#e74c3c}Klaida siunciant zinute.');
            }

            player.outputChatBox(`!{#7aa164}Zinute nusiusta -> ${recipientNumber}${target ? ` (${target.charName})` : ''}`);

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
    if (!player.charId) return player.outputChatBox('!{#e74c3c}Pasirinkite veikeja!');
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
        return player.outputChatBox('!{#e74c3c}Leidziami tik raides, skaiciai ir _ !');
    }

    db.query('SELECT * FROM twitter_accounts WHERE handle = ?', [handle], (err, rows) => {
        if (rows.length > 0) {
            return player.outputChatBox('!{#e74c3c}Sis @slapyvardis jau uzimtas!');
        }

        db.query('INSERT INTO twitter_accounts (char_id, handle) VALUES (?, ?)', [player.charId, handle], (err) => {
            if (err) return console.error(err);
            player.outputChatBox(`!{#7aa164}Jusu @${handle} sekmingai uzregistruotas!`);
            player.call('twitterHandleRegistered', [handle]);
        });
    });
});

// Post a tweet
mp.events.add('postTweet', (player, content) => {
    if (!player.charId) return;

    if (content.length > 150) {
        return player.outputChatBox('!{#e74c3c}Skelbimas per ilgas! (max 150 simboliu)');
    }

    const now = Date.now();
    if (lastTweetTime.has(player.id) && now - lastTweetTime.get(player.id) < TWITTER_COOLDOWN) {
        const remaining = Math.ceil((TWITTER_COOLDOWN - (now - lastTweetTime.get(player.id))) / 60000);
        return player.outputChatBox(`!{#e74c3c}Galite skelbti tik karta per valanda. Liko ${remaining} min.`);
    }

    db.query('SELECT handle FROM twitter_accounts WHERE char_id = ?', [player.charId], (err, rows) => {
        if (rows.length === 0) {
            return player.outputChatBox('!{#e74c3c}Pirmiausia uzregistruokite @slapyvardi!');
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');

    // Get balance + last 5 transactions
    db.query(`
        SELECT balance FROM bank_accounts WHERE char_name = ?
    `, [player.charName], (err, balanceRes) => {
        if (err || balanceRes.length === 0) {
            return player.call('loadBankData', [0, player.charName, player.bankAccountNumber || '', '[]']);
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
                player.bankAccountNumber || '',
                JSON.stringify(transactions)
            ]);
        });
    });
});

mp.events.add('bankTransfer', (player, recipientAccountRaw, amountStr) => {
    if (!player.charName) return;
    const senderAccountNumber = normalizeBankAccountNumber(player.bankAccountNumber);
    if (!senderAccountNumber) {
        return player.call('bankTransferResult', [false, 'Neturite aktyvios banko saskaitos. Naudokite /openbank Fleeca banke.']);
    }

    const recipientAccountNumber = normalizeBankAccountNumber(recipientAccountRaw);
    if (!recipientAccountNumber) {
        return player.call('bankTransferResult', [false, 'Neteisingas gavejo banko saskaitos numeris.']);
    }

    if (recipientAccountNumber === senderAccountNumber) {
        return player.call('bankTransferResult', [false, 'Negalite pervesti i savo banko saskaita.']);
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return player.call('bankTransferResult', [false, 'Neteisinga suma!']);
    }

    // Check if sender has enough
    db.query('SELECT balance FROM bank_accounts WHERE char_name = ?', [player.charName], (err, senderRes) => {
        if (err || senderRes.length === 0) {
            console.log('[BANK] bankTransfer failed sender lookup', player.charName, recipientAccountNumber, amount, err);
            return player.call('bankTransferResult', [false, 'Nepakanka lesu saskaitoje!']);
        }
        if (senderRes[0].balance < amount) {
            console.log('[BANK] bankTransfer insufficient balance', player.charName, recipientAccountNumber, amount);
            return player.call('bankTransferResult', [false, 'Nepakanka lesu saskaitoje!']);
        }

        // Check recipient exists
        db.query('SELECT char_name, balance FROM bank_accounts WHERE account_number = ?', [recipientAccountNumber], (err, targetRes) => {
            if (err || targetRes.length === 0) {
                console.log('[BANK] bankTransfer recipient not found', recipientAccountNumber);
                return player.call('bankTransferResult', [false, 'Banko saskaita nerasta']);
            }

            const recipientName = targetRes[0].char_name;

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
            player.call('bankTransferResult', [true, `Sekmingai pervesta $${amount} i ${recipientAccountNumber}`, recipientAccountNumber, amount]);

            // Notify recipient if online
            const targetPlayer = mp.players.toArray().find(p => p.charName === recipientName);
            if (targetPlayer) {
                targetPlayer.bankBalance = newTargetBalance;
                targetPlayer.call('updateBankHUD', [newTargetBalance]);
                targetPlayer.outputChatBox(`!{#229954}Jus gavote $${amount} i banko saskaita ${recipientAccountNumber}.`);
            }
        });
    });
});

// ==================== CLOTHING SYSTEM ====================

const CLOTHING_STORES = [
    { x: -710.2, y: -152.0, z: 37.4 },  // Suburban - Rockford Hills
    { x: 121.6, y: -221.3, z: 54.5 },  // Suburban - Pillbox Hill
    { x: 613.8, y: 2763.1, z: 42.1 },  // Suburban - Paleto Bay
    { x: 75.4, y: -1393.4, z: 29.4 },  // Binco
];

const CLOTHING_STORE_RADIUS = 5.0;

// Blips so players can find the stores on the minimap
CLOTHING_STORES.forEach((pos) => {
    mp.blips.new(73, new mp.Vector3(pos.x, pos.y, pos.z), {
        name: 'Drabuziu parduotuve',
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!isNearClothingStore(player)) {
        return player.outputChatBox('!{#e74c3c}Prasome eiti i drabuziu parduotuve.');
    }

    const currentClothes = player.outfitData || {};
    player.call('openClothingUI', [JSON.stringify(currentClothes)]);
});

// Live preview - apply clothes without saving
mp.events.add('previewClothes', (player, compStr, drawStr, texStr) => {
    const component = parseInt(compStr);
    const drawable = parseInt(drawStr);
    const texture = parseInt(texStr);
    if (isNaN(component) || isNaN(drawable) || isNaN(texture)) return;
    player.setClothes(component, drawable, texture, 2);
});

// Save clothes - persist to DB and keep applied
mp.events.add('saveClothes', (player, clothesJson) => {
    if (!player.charId) return;

    if (player.money < 100) {
        return player.call('clothingError', ['Nepakanka pinigu! Reikia $100.']);
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
            return player.call('clothingError', ['Klaida: neleistinos reiksmes.']);
        }
        player.setClothes(c, dr, tx, 2);
    }

    player.money -= 100;
    player.outfitData = clothes;

    db.query('UPDATE characters SET money = ? WHERE char_name = ?', [player.money, player.charName]);
    db.query('UPDATE characters SET clothes = ? WHERE id = ?', [JSON.stringify(clothes), player.charId], (err) => {
        if (err) {
            console.error('[CLOTHES] Save failed:', err.message);
            player.call('clothingError', ['Klaida issaugant drabuzius.']);
        } else {
            player.call('updateMoneyHUD', [player.money]);
            player.call('clothingSuccess', ['Drabuziai issaugoti! Nuskaiciuota $100.']);
        }
    });
});

// Close UI - revert any un-saved preview changes back to outfitData
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
    if (!player.charName) return player.outputChatBox('!{#e74c3c}Prasome pasirinkti veikeja.');
    if (!isNearBarberShop(player)) {
        return player.outputChatBox('!{#e74c3c}Prasome eiti i kirpykla.');
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
        return player.call('barberError', ['Nepakanka pinigu! Reikia $50.']);
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
            player.call('barberError', ['Nepavyko issaugoti sukuosenos.']);
        } else {
            player.call('applyBarberAppearance', [JSON.stringify(normalized)]);
            player.call('updateMoneyHUD', [player.money]);
            player.call('barberSuccess', ['Isvaizda issaugota. Nuskaiciuota $50.']);
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

// Note: older placeholder handler removed. The real handler below accepts (player, username, email, password, answersJson).

// New handler with email and answers
mp.events.add('register:submit', (player, username, email, password, answersJson) => {
    if (!username || !email || !password) { try { player.call('register:error', ['Iveskite vartotojo varda, el. pasta ir slaptazodi.']); } catch (e) { } return; }
    const normalized = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalized.length < 3 || normalized.length > 64) { try { player.call('register:error', ['Vartotojo vardas turi buti 3-64 simboliu.']); } catch (e) { } return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) { try { player.call('register:error', ['Neteisingas el. pasto formatas.']); } catch (e) { } return; }
    if (String(password).length < 6) { try { player.call('register:error', ['Slaptazodis turi buti bent 6 simboliu.']); } catch (e) { } return; }

    // Parse answers (trusting client for now)
    let answers = [];
    try { answers = JSON.parse(String(answersJson || '[]')); } catch (e) { answers = []; }

    const normalizeRegisterQuizAnswer = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/å¡/g, 's')
        .replace(/å¾/g, 'z')
        .replace(/å«/g, 'u')
        .replace(/å³/g, 'u')
        .replace(/ä—/g, 'e')
        .replace(/ä™/g, 'e')
        .replace(/ä…/g, 'a')
        .replace(/ä¯/g, 'i')
        .replace(/ä/g, 'c');

    // Strict quiz validation: require all answers to match expected answers.
    const CORRECT_QUIZ_ANSWERS = [
        'Ne',
        'Ne',
        'Pranesti administracijai',
        'Ne',
        'Ne'
    ];
    if (!Array.isArray(answers) || answers.length !== CORRECT_QUIZ_ANSWERS.length) {
        try { player.call('register:error', ['Klaida: atsakymai neteisingi.']); } catch (e) { }
        return;
    }

    for (let i = 0; i < CORRECT_QUIZ_ANSWERS.length; i++) {
        const a = normalizeRegisterQuizAnswer(answers[i]);
        const b = normalizeRegisterQuizAnswer(CORRECT_QUIZ_ANSWERS[i]);
        if (a !== b) {
            try { player.call('register:error', ['Klaida: atsakymai neteisingi.']); } catch (e) { }
            return;
        }
    }

    // Check existing username or email
    db.query('SELECT id FROM players WHERE name = ? OR email = ? LIMIT 1', [normalized, normalizedEmail], (err, results) => {
        if (err) {
            console.error('[DATABASE] Failed to check existing player for registration:', err);
            try { player.call('register:error', ['Duomenu bazes klaida. Bandykite veliau.']); } catch (e) { }
            return;
        }
        if (results.length > 0) {
            try { player.call('register:error', ['Vartotojo vardas arba el. pastas jau uzimtas.']); } catch (e) { }
            return;
        }

        bcrypt.hash(String(password), 10, (hashErr, hash) => {
            if (hashErr) { console.error('[BCRYPT] Failed to hash password:', hashErr); try { player.call('register:error', ['Klaida kuriant paskyra. Bandykite veliau.']); } catch (e) { } return; }

            // Insert player with pending email confirmation
            db.query('INSERT INTO players (name, password, email, email_confirmed, reg_answers) VALUES (?, ?, ?, 0, ?)', [normalized, hash, normalizedEmail, JSON.stringify(answers)], (insertErr, insertRes) => {
                if (insertErr) {
                    console.error('[DATABASE] Failed to insert new player:', insertErr);
                    // If a UNIQUE index exists this will return ER_DUP_ENTRY on duplicate email/name.
                    if (insertErr.code === 'ER_DUP_ENTRY') {
                        try { player.call('register:error', ['Vartotojo vardas arba el. pastas jau uzimtas.']); } catch (e) { }
                    } else {
                        try { player.call('register:error', ['Duomenu bazes klaida. Bandykite veliau.']); } catch (e) { }
                    }
                    return;
                }

                const newId = insertRes.insertId;
                // Create a confirmation token
                // Generate a short numeric confirmation code and store it.
                const code = String(Math.floor(100000 + Math.random() * 900000));
                db.query('INSERT INTO email_confirm_tokens (player_id, token, created_at) VALUES (?, ?, NOW())', [newId, code], (tErr) => {
                    if (tErr) console.error('[EMAIL] Failed to store confirmation token:', tErr);
                    // Send confirmation email with numeric code if transport configured
                    if (mailTransport) {
                        const mailText = `Jusu patvirtinimo kodas: ${code}`;
                        mailTransport.sendMail({
                            from: process.env.SMTP_FROM || 'CaliforniaRP <info@californiarp.lt>',
                            to: normalizedEmail,
                            subject: 'Jusu patvirtinimo kodas',
                            text: mailText,
                            html: `<p>Jusu patvirtinimo kodas: <strong>${code}</strong></p>`
                        }, (mailErr) => {
                            if (mailErr) console.error('[EMAIL] send error:', mailErr);
                        });
                    }

                    // Notify client that registration succeeded; awaiting confirmation code
                    const successMsg = 'Registracija sekminga. Patikrinkite el. pasta ir iveskite atsiusta koda.';
                    try { player.call('register:success', [successMsg]); } catch (e) { }
                });
            });
        });
    });
});

// Email transport setup (nodemailer)
let mailTransport = null;
try {
    const nodemailer = require('nodemailer');
    // Use environment variables for SMTP configuration. Set these in your .env or hosting env:
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
    const SMTP_USER = process.env.SMTP_USER || 'info@californiarp.lt';
    const SMTP_PASS = process.env.SMTP_PASS || 'ProjekciukoEmailas123;';
    const SMTP_FROM = process.env.SMTP_FROM || 'CaliforniaRP <info@californiarp.lt>';

    if (SMTP_USER && SMTP_PASS) {
        mailTransport = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });
        console.log('[EMAIL] Mail transport configured using', SMTP_USER);

        // optional quick verify
        mailTransport.verify((vErr, success) => {
            if (vErr) console.warn('[EMAIL] SMTP verify failed', vErr);
            else console.log('[EMAIL] SMTP verify OK');
        });
    } else {
        console.log('[EMAIL] SMTP credentials not provided; email disabled (set SMTP_USER and SMTP_PASS)');
    }
} catch (e) {
    console.warn('[EMAIL] nodemailer not available; email features disabled');
}

// Player requests to create a new character (stores request for admin approval)
mp.events.add('createCharacterRequest', (player, firstName, lastName, age, gender, bio) => {
    if (!firstName || !lastName) return player.call('character:create:error', [JSON.stringify({ message: 'Iveskite varda ir pavarde.' })]);
    const ucp = player.name || '';
    // Prevent multiple pending requests per account
    db.query('SELECT id FROM pending_characters WHERE ucp_username = ? LIMIT 1', [ucp], (checkErr, checkRows) => {
        if (checkErr) {
            console.error('[CHAR] pending check failed', checkErr);
            return player.call('character:create:error', [JSON.stringify({ message: 'Klaida tikrinant esamas paraiskas.' })]);
        }
        if (checkRows && checkRows.length > 0) {
            return player.call('character:create:error', [JSON.stringify({ message: 'Jau turite laukianti veikeja. Palaukite administracijos sprendimo.' })]);
        }

        // proceed to insert
        const f = String(firstName).trim();
        const l = String(lastName).trim();
        const a = Number(age) || null;
        const g = String(gender || '').trim();
        const b = String(bio || '').trim().slice(0, 2000);
        db.query('INSERT INTO pending_characters (ucp_username, first_name, last_name, age, gender, bio) VALUES (?, ?, ?, ?, ?, ?)', [ucp, f, l, a, g, b], (err, result) => {
            if (err) {
                console.error('[CHAR] Failed to create pending character:', err);
                return player.call('character:create:error', [JSON.stringify({ message: 'Klaida siunciant uzklausa.' })]);
            }
            const insertedId = result && result.insertId ? result.insertId : null;
            const createdAt = new Date().toISOString();
            const payload = {
                message: 'Jusu veikejo paraiska issiusta administracijai.',
                id: insertedId,
                firstName: f,
                lastName: l,
                age: a,
                gender: g,
                bio: b,
                createdAt
            };
            try { player.call('character:create:ok', [JSON.stringify(payload)]); } catch (e) { }
            // Notify online admins in chat about new pending request
            const onlinePlayers = mp.players.toArray();
            for (const p of onlinePlayers) {
                isAdmin(p, 1, (admErr, has) => {
                    if (!admErr && has) {
                        try { p.outputChatBox(`!{#f7dc6f}Nauja veikejo paraiska nuo ${ucp}: ${f} ${l} (id:${insertedId})`); } catch (e) { }
                    }
                });
            }
        });
    });
});

// Admin requests list of pending characters
mp.events.add('requestPendingCharacters', (player) => {
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('!{#e74c3c}Neturite teisiu perziureti laukianciu veikeju.');
        db.query('SELECT id, ucp_username, first_name, last_name, age, gender, bio, created_at FROM pending_characters ORDER BY created_at DESC', (qErr, rows) => {
            if (qErr) { console.error('[CHAR] Failed to fetch pending characters:', qErr); return; }
            try { player.call('openPendingCharsUI', [JSON.stringify(rows || [])]); } catch (e) { }
        });
    });
});

// Admin approves pending character: insert into characters and remove pending record
mp.events.add('approveCharacter', (player, pendingId) => {
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('!{#e74c3c}Neturite teisiu patvirtinti veikeju.');
        db.query('SELECT * FROM pending_characters WHERE id = ? LIMIT 1', [pendingId], (sErr, rows) => {
            if (sErr || !rows || rows.length === 0) return player.outputChatBox('!{#e74c3c}Paraiska nerasta.');
            const req = rows[0];
            const charName = `${req.first_name} ${req.last_name}`;

            // Compute a safe next ID and insert
            db.query('SELECT MAX(id) AS maxId FROM characters', (mErr, mRows) => {
                if (mErr) {
                    console.error('[CHAR] Failed to compute next char id:', mErr);
                    return player.outputChatBox('!{#e74c3c}Klaida patvirtinant veikeja.');
                }
                const maxId = (mRows && mRows[0] && mRows[0].maxId) ? Number(mRows[0].maxId) : 0;
                const newIdToUse = maxId + 1;

                db.query('INSERT INTO characters (id, char_name, ucp_username, money, bank_balance, playtime, health, is_approved) VALUES (?, ?, ?, 0, 0, 0, 100, 1)', [newIdToUse, charName, req.ucp_username], (iErr) => {
                    if (iErr) {
                        console.error('[CHAR] Failed to insert approved character:', iErr);
                        return player.outputChatBox('!{#e74c3c}Klaida patvirtinant veikeja.');
                    }

                    // Delete pending request
                    db.query('DELETE FROM pending_characters WHERE id = ?', [pendingId], (dErr) => {
                        if (dErr) console.error('[CHAR] Failed to delete pending:', dErr);
                    });

                    player.outputChatBox(`!{#7aa164}Patvirtintas veikejas #${newIdToUse} - ${charName}`);

                    // Notify the UCP user if online; refresh selection for them (but not the admin who approved)
                    const onlinePlayers = mp.players.toArray();
                    for (const p of onlinePlayers) {
                        try {
                            if (p.name && p.name.toLowerCase() === String(req.ucp_username).toLowerCase()) {
                                const msg = `Jusu veikejo paraiska patvirtinta: ${charName}`;
                                try { p.call('character:accepted', [JSON.stringify({ message: msg, charId: newIdToUse })]); } catch (e) { try { p.outputChatBox(`!{#7aa164}${msg}`); } catch (e2) { } }
                                if (p !== player) {
                                    try { loadCharacterSelection(p); } catch (e) { console.error('[CHAR] failed to refresh selection for user', e); }
                                }
                            }
                        } catch (e) { console.error('[CHAR] notify loop error', e); }
                    }
                });
            });
        });
    });
});

// Admin rejects a pending character
mp.events.add('rejectCharacter', (player, pendingId) => {
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('!{#e74c3c}Neturite teisiu atmesti veikeju.');
        db.query('SELECT * FROM pending_characters WHERE id = ? LIMIT 1', [pendingId], (sErr, rows) => {
            if (sErr || !rows || rows.length === 0) return player.outputChatBox('!{#e74c3c}Paraiska nerasta.');
            const req = rows[0];
            db.query('DELETE FROM pending_characters WHERE id = ?', [pendingId], (dErr) => {
                if (dErr) { console.error('[CHAR] Failed to delete pending on reject:', dErr); return player.outputChatBox('!{#e74c3c}Klaida.'); }

                player.outputChatBox(`!{#f39c12}Atmesta veikejo paraiska #${pendingId} - ${req.first_name} ${req.last_name}`);

                // Notify the UCP user if online; refresh selection for them (but not the admin who rejected)
                const onlinePlayers = mp.players.toArray();
                for (const p of onlinePlayers) {
                    try {
                        if (p.name && p.name.toLowerCase() === String(req.ucp_username).toLowerCase()) {
                            const msg = `Jusu veikejo paraiska atmesta: ${req.first_name} ${req.last_name}`;
                            try { p.call('character:rejected', [JSON.stringify({ message: msg, pendingId: pendingId })]); } catch (e) { try { p.outputChatBox(`!{#f39c12}${msg}`); } catch (e2) { } }
                            if (p !== player) {
                                try { loadCharacterSelection(p); } catch (e) { console.error('[CHAR] failed to refresh selection for user after reject', e); }
                            }
                        }
                    } catch (e) { console.error('[CHAR] notify loop error', e); }
                }
            });
        });
    });
});

// Admin command to open pending characters UI
mp.events.addCommand('pendingchars', (player) => {
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('!{#e74c3c}Neturite teisiu perziureti laukianciu veikeju.');
        db.query('SELECT id, ucp_username, first_name, last_name, age, gender, bio, created_at FROM pending_characters ORDER BY created_at DESC', (qErr, rows) => {
            if (qErr) { console.error('[CHAR] Failed to fetch pending characters:', qErr); return player.outputChatBox('!{#e74c3c}Klaida uzkraunant laukiancius veikejus.'); }
            try { player.call('openPendingCharsUI', [JSON.stringify(rows || [])]); } catch (e) { }
        });
    });
});

// Fallback admin commands to approve/reject by id when UI is not working
mp.events.addCommand('approve', (player, pendingIdRaw) => {
    if (!pendingIdRaw) return player.outputChatBox('Naudojimas: /approve <pendingId>');
    if (!player.charId) return player.outputChatBox('Pirmiausia pasirinkite veikeja.');
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('Neturite teisiu.');
        const pid = Number(pendingIdRaw);
        if (!Number.isFinite(pid)) return player.outputChatBox('Netinkamas ID.');
        // reuse existing approve handler
        mp.events.call('approveCharacter', player, pid);
    });
});

mp.events.addCommand('reject', (player, pendingIdRaw) => {
    if (!pendingIdRaw) return player.outputChatBox('Naudojimas: /reject <pendingId>');
    if (!player.charId) return player.outputChatBox('Pirmiausia pasirinkite veikeja.');
    isAdmin(player, 1, (err, ok) => {
        if (err || !ok) return player.outputChatBox('Neturite teisiu.');
        const pid = Number(pendingIdRaw);
        if (!Number.isFinite(pid)) return player.outputChatBox('Netinkamas ID.');
        mp.events.call('rejectCharacter', player, pid);
    });
});

// Server receives admin UI ready handshake (for diagnostics)
mp.events.add('adminPendingLoadedServer', (player) => {
    try {
        console.log(`[ADMIN UI] admin ${player.name || player.ip || player.id} reported admin panel ready`);
        player.outputChatBox('!{#85c1e9}Admin panelis aktyvus.');
    } catch (e) { console.error(e); }
});
