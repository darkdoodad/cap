// ============================================================
// Collect All Pets! Calculator
// ============================================================

(function () {
    'use strict';

    // ----------------------------------------------------------
    // DATA TABLES
    // ----------------------------------------------------------
    const PICKAXE = {
        Stone: 0, Emerald: 0.1, Sapphire: 0.2, Amethyst: 0.3,
        Topaz: 0.4, Quartz: 0.5, Diamond: 0.75, Ruby: 1.0
    };

    // Lab research point step sizes (value added per point spent)
    const LAB = {
        '1': { clone: 0.0008 },
        '2': { shiny: 0.004 },
        '3': { fuse: 0.01, clone: 0.001 },
        '4': { metallic: 0.005, egg: 0.008, fuse: 0.01, calcify: 0.015 },
        '5': { shiny: 0.008, calcify: 0.02, clone: 0.0012 },
        '6': { metallic: 0.006, egg: 0.01, stones: 0.015, double: 0.002, calcify: 0.025 },
        '7': { egg: 0.012, stones: 0.02, double: 0.003, giant: 0.008, clone: 0.002 },
        '8': { metallic: 0.01, shiny: 0.01, stones: 0.025, double: 0.004, mining: 0.02, giant: 0.01 },
    };

    // ----------------------------------------------------------
    // HELPERS
    // ----------------------------------------------------------
    function num(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        return parseFloat(el.value) || 0;
    }

    function sel(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    function isOn(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.checked;
    }

    function exoticVal(prefix) {
        const el = document.getElementById(`exotic-${prefix}`);
        if (!el || el.value === 'None') return 0;
        return parseFloat(el.value) || 0;
    }

    // ----------------------------------------------------------
    // LAB PROFILES
    // ----------------------------------------------------------
    // Each profile stores a snapshot of every lab-*-* input value. The active
    // profile feeds the calculation; the selected profile is the one shown in
    // the lab cards. All profiles persist together in localStorage.
    const LAB_PROFILES_KEY  = 'cap-calc-lab-profiles-v1';
    const LAB_PROFILE_COUNT = 8;
    let labInputIds      = [];
    let labProfiles      = [];   // LAB_PROFILE_COUNT entries: { [inputId]: value }
    let activeProfileIdx = 0;    // profile used by the calculation
    let selectedProfileIdx = 0;  // profile shown in the cards

    // Lab value for the active profile. When the active profile is the one on
    // screen, read the live input so edits apply instantly; otherwise read the
    // stored snapshot.
    function labValue(id) {
        if (activeProfileIdx === selectedProfileIdx) {
            const el = document.getElementById(id);
            if (el) return parseFloat(el.value) || 0;
        }
        const profile = labProfiles[activeProfileIdx];
        return profile ? (parseFloat(profile[id]) || 0) : 0;
    }

    function labPts(tier, stat) {
        const step = LAB[tier]?.[stat] || 0;
        return labValue(`lab-${tier}-${stat}`) * step;
    }

    // ----------------------------------------------------------
    // MAIN CALCULATION
    // ----------------------------------------------------------
    function recalculate() {
        const action = sel('action');
        const eggSetting  = isOn('eggLuck') ? 1 : 0;
        const fuseSetting = isOn('fuseLuck') ? 1 : 0;

        // === EGG LUCK (additive) ===
        // Permanent: shop, exotic, rune, badge
        const eggPerm = (
            num('shop-egg') / 100 +
            exoticVal('egg') +
            num('rune-egg') / 100 +
            num('badge-egg') / 100
        ) * eggSetting;
        // Dynamic: lab
        const eggLab = (labPts('4', 'egg') + labPts('6', 'egg') + labPts('7', 'egg')) * eggSetting;
        const eggDyn = eggPerm + eggLab;

        // === FUSE LUCK (additive) ===
        const fusePerm = (num('shop-fuse') / 100) * fuseSetting;
        const fuseLab = (labPts('3', 'fuse') + labPts('4', 'fuse')) * fuseSetting;
        const fuseDyn = fusePerm + fuseLab;

        // === CLONE LUCK (additive) ===
        const clonePerm = num('shop-clone') / 100 + exoticVal('clone');
        const cloneLab = labPts('1', 'clone') + labPts('3', 'clone') + labPts('5', 'clone') + labPts('7', 'clone');
        const cloneDyn = clonePerm + cloneLab;

        // === GENERATION SPEED (additive) ===
        const genPerm = num('shop-gen') + exoticVal('gen');
        const genCrank = action === 'Crank' ? 1.5 : 0;
        const genDyn = genPerm + genCrank;

        // === CALCIFY LUCK (additive) ===
        const calcifyPerm = num('shop-calcify') / 100 + exoticVal('calcify');
        const calcifyLab = labPts('4', 'calcify') + labPts('5', 'calcify') + labPts('6', 'calcify');
        const calcifyDyn = calcifyPerm + calcifyLab;

        // === SHINY LUCK (multiplicative) ===
        const shinyGold     = num('shop-shiny') / 1000;
        const shinyAsc      = num('asc-shiny');
        const shinyRune     = num('rune-shiny');
        const shinyBadge    = num('badge-shiny');
        const shinyBadgeG   = num('badge-shinyGiant');
        const expertMult    = isOn('expertLuck') ? (1 + num('petScore') / 10000000) : 1;
        const prismaticMult = isOn('prismaticLuck') ? (1 + num('giantScore') / 10000) : 1;
        // Permanent: shop * asc * rune * badge * expert * prismatic
        const shinyPerm = Math.min(shinyGold * shinyAsc * shinyRune * shinyBadge * shinyBadgeG * expertMult * prismaticMult, 1);
        // Dynamic: perm * lab
        const shinyLab2 = 1 + labPts('2', 'shiny');
        const shinyLab5 = 1 + labPts('5', 'shiny');
        const shinyLab8 = 1 + labPts('8', 'shiny');
        const shinyDyn  = Math.min(shinyPerm * shinyLab2 * shinyLab5 * shinyLab8, 1);
        // Temporary: dyn * boost
        const shinyBoost = isOn('shinyLuck') ? 2 : 1;
        const shinyTemp  = Math.min(shinyDyn * shinyBoost, 1);

        // === METALLIC LUCK (multiplicative) ===
        const metStones = num('shop-metallic') / 100;
        const metAsc    = num('asc-metallic');
        const metRune   = num('rune-metallic');
        const metBadge  = num('badge-metallic');
        // Permanent: shop * asc * rune * badge
        const metPerm = Math.min(metStones * metAsc * metRune * metBadge, 1);
        // Dynamic: perm * lab
        const metLab4 = 1 + labPts('4', 'metallic');
        const metLab6 = 1 + labPts('6', 'metallic');
        const metLab8 = 1 + labPts('8', 'metallic');
        const metDyn  = Math.min(metPerm * metLab4 * metLab6 * metLab8, 1);
        // Temporary: dyn * boost
        const metBoost = isOn('metallicLuck') ? 2 : 1;
        const metTemp  = Math.min(metDyn * metBoost, 1);

        // === STRIKE CHAIN (double → triple → quadra → penta → giant) ===
        // Game rolls sequentially; each chance is cumulative with all prior.

        // Double-Strike
        const doublePerm  = num('shop-double') / 100 + exoticVal('double');
        const doubleLab   = labPts('6', 'double') + labPts('7', 'double') + labPts('8', 'double');
        const doubleOC    = isOn('oc-double') ? 1.4 : 1;
        const doubleDyn   = (doublePerm + doubleLab) * doubleOC;
        const doubleIngot = isOn('ingot-double') ? 0.2 : 0;
        const doubleTemp  = (doublePerm + doubleLab + doubleIngot) * doubleOC;

        // Triple-Strike (chained: double × triple)
        const tripleOC    = isOn('oc-triple') ? 1.6 : 1;
        const tripleIngot = isOn('ingot-triple') ? 0.3 : 0;
        const triplePerm  = doublePerm * (num('shop-triple') / 100);
        const tripleDyn   = doubleDyn  * (num('shop-triple') / 100 * tripleOC);
        const tripleTemp  = doubleTemp * ((num('shop-triple') / 100 + tripleIngot) * tripleOC);

        // Quadra-Strike (chained: … × quadra)
        const quadraOC   = isOn('oc-quadra') ? 1.8 : 1;
        const quadraPerm = triplePerm * (num('shop-quadra') / 100);
        const quadraDyn  = tripleDyn  * (num('shop-quadra') / 100 * quadraOC);
        const quadraTemp = tripleTemp * (num('shop-quadra') / 100 * quadraOC);

        // Penta-Strike (chained: … × penta)
        const pentaOC   = isOn('oc-penta') ? 2.0 : 1;
        const pentaPerm = quadraPerm * (num('shop-penta') / 100);
        const pentaDyn  = quadraDyn  * (num('shop-penta') / 100 * pentaOC);
        const pentaTemp = quadraTemp * (num('shop-penta') / 100 * pentaOC);

        // Giant (chained: … × giant, multiplicative base)
        const giantStones = num('shop-giant') / 100;
        const giantAsc    = num('asc-giant');
        const giantRune   = num('rune-giant');
        const giantBadge  = num('badge-giant');
        const giantBase   = giantStones * giantAsc * giantRune * giantBadge;
        const giantLab7   = 1 + labPts('7', 'giant');
        const giantLab8   = 1 + labPts('8', 'giant');
        const giantOC     = isOn('oc-giant') ? 1.5 : 1;
        const giantPerm   = pentaPerm * giantBase;
        const giantDyn    = pentaDyn  * giantBase * giantLab7 * giantLab8 * giantOC;
        const giantTemp   = pentaTemp * giantBase * giantLab7 * giantLab8 * giantOC;

        // === SHINY GIANT LUCK (Giant Luck * Shiny Luck * Shiny Giant OC) ===
        const shinyGiantOC   = isOn('oc-shinyGiant') ? 1.5 : 1;
        const shinyGiantPerm = Math.min(giantPerm * shinyPerm, 1);
        const shinyGiantDyn  = Math.min(giantDyn * shinyDyn * shinyGiantOC, 1);
        const shinyGiantTemp = Math.min(giantTemp * shinyTemp * shinyGiantOC, 1);

        // === MINING SPEED (additive) ===
        const miningPerm = num('shop-mining') + exoticVal('mining');
        const miningLab  = labPts('8', 'mining');
        const miningDyn  = miningPerm + miningLab;

        // === SHINY STONE LUCK ===
        // Each mined stone has probability p of being shiny, and a shiny stone is
        // worth 1000 normal stones. Expected stones per mine is therefore
        // (1 - p) * 1 + p * 1000 = 1 + p * 999, a permanent multiplier on all
        // stone income.
        const shinyStonePerm  = (num('shop-shinyStone') / 100) * num('asc-shinyStone');
        const shinyStoneMult = 1 + shinyStonePerm * 999;

        // === STONES FROM MINING (additive base * OC mult * shiny stone mult) ===
        const pickaxeVal  = PICKAXE[sel('shop-pickaxe')] || 0;
        const stonesBase  = 1 + pickaxeVal;
        const stonesLab   = labPts('6', 'stones') + labPts('7', 'stones') + labPts('8', 'stones');
        const stonesOC    = isOn('oc-stones') ? 1.5 : 1;
        const stonesIngot = isOn('ingot-stones') ? 1 : 0;
        const stonesPerm  = stonesBase * shinyStoneMult;
        const stonesDyn   = (stonesBase + stonesLab) * stonesOC * shinyStoneMult;
        const stonesTemp  = (stonesBase + stonesLab + stonesIngot) * stonesOC * shinyStoneMult;

        // === PET SCORE LUCK ===
        const petScorePerm = (num('badge-petScore') / 100) * num('asc-petScore');

        // -------------------------------------------------------
        // UPDATE DISPLAY
        // -------------------------------------------------------
        const NA = '---';

        // Egg: perm + dynamic (lab), no temporary
        const eggHasDyn = eggLab > 0;
        setText('stat-egg-perm', fmtPct(eggPerm));
        setText('stat-egg-dyn', eggHasDyn ? fmtPct(eggDyn) : NA);
        setText('stat-egg-temp', NA);

        // Fuse: perm + dynamic (lab), no temporary
        setText('stat-fuse-perm', fmtPct(fusePerm));
        setText('stat-fuse-dyn', fuseLab > 0 ? fmtPct(fuseDyn) : NA);
        setText('stat-fuse-temp', NA);

        // Clone: perm + dynamic (lab), no temporary
        setText('stat-clone-perm', fmtPct(clonePerm));
        setText('stat-clone-dyn', cloneLab > 0 ? fmtPct(cloneDyn) : NA);
        setText('stat-clone-temp', NA);

        // Calcify: perm + dynamic (lab), no temporary
        setText('stat-calcify-perm', fmtPct(calcifyPerm));
        setText('stat-calcify-dyn', calcifyLab > 0 ? fmtPct(calcifyDyn) : NA);
        setText('stat-calcify-temp', NA);

        // Shiny: perm + dynamic (lab) + temporary (boost)
        const shinyHasDyn = shinyLab2 !== 1 || shinyLab5 !== 1 || shinyLab8 !== 1;
        setText('stat-shiny-perm', fmtChance(shinyPerm));
        setText('stat-shiny-dyn', shinyHasDyn ? fmtChance(shinyDyn) : NA);
        setText('stat-shiny-temp', isOn('shinyLuck') ? fmtChance(shinyTemp) : NA);

        // Shiny Giant: Shiny Luck * Shiny Giant OC (dynamic) + temporary (boost)
        const shinyGiantHasDyn = shinyHasDyn || shinyGiantOC !== 1;
        setText('stat-shinyGiant-perm', fmtChance(shinyGiantPerm));
        setText('stat-shinyGiant-dyn', shinyGiantHasDyn ? fmtChance(shinyGiantDyn) : NA);
        setText('stat-shinyGiant-temp', isOn('shinyLuck') ? fmtChance(shinyGiantTemp) : NA);

        // Metallic: perm + dynamic (lab) + temporary (boost)
        const metHasDyn = metLab4 !== 1 || metLab6 !== 1 || metLab8 !== 1;
        setText('stat-metallic-perm', fmtChance(metPerm));
        setText('stat-metallic-dyn', metHasDyn ? fmtChance(metDyn) : NA);
        setText('stat-metallic-temp', isOn('metallicLuck') ? fmtChance(metTemp) : NA);

        // Strike chain display
        const doubleHasDyn = doubleLab > 0 || isOn('oc-double');
        const tripleHasDyn = doubleHasDyn || isOn('oc-triple');
        const quadraHasDyn = tripleHasDyn || isOn('oc-quadra');
        const pentaHasDyn  = quadraHasDyn || isOn('oc-penta');
        const giantHasDyn  = pentaHasDyn || giantLab7 !== 1 || giantLab8 !== 1 || isOn('oc-giant');

        const doubleHasTemp = isOn('ingot-double');
        const tripleHasTemp = doubleHasTemp || isOn('ingot-triple');
        const quadraHasTemp = tripleHasTemp;
        const pentaHasTemp  = quadraHasTemp;
        const giantHasTemp  = pentaHasTemp;

        setText('stat-double-perm', fmtChance(doublePerm));
        setText('stat-double-dyn', doubleHasDyn ? fmtChance(doubleDyn) : NA);
        setText('stat-double-temp', doubleHasTemp ? fmtChance(doubleTemp) : NA);

        setText('stat-triple-perm', fmtChance(triplePerm));
        setText('stat-triple-dyn', tripleHasDyn ? fmtChance(tripleDyn) : NA);
        setText('stat-triple-temp', tripleHasTemp ? fmtChance(tripleTemp) : NA);

        setText('stat-quadra-perm', fmtChance(quadraPerm));
        setText('stat-quadra-dyn', quadraHasDyn ? fmtChance(quadraDyn) : NA);
        setText('stat-quadra-temp', quadraHasTemp ? fmtChance(quadraTemp) : NA);

        setText('stat-penta-perm', fmtChance(pentaPerm));
        setText('stat-penta-dyn', pentaHasDyn ? fmtChance(pentaDyn) : NA);
        setText('stat-penta-temp', pentaHasTemp ? fmtChance(pentaTemp) : NA);

        setText('stat-giant-perm', fmtChance(giantPerm));
        setText('stat-giant-dyn', giantHasDyn ? fmtChance(giantDyn) : NA);
        setText('stat-giant-temp', giantHasTemp ? fmtChance(giantTemp) : NA);

        // Mining: perm + dynamic (lab), no temporary
        setText('stat-mining-perm', `${fmtNumber(miningPerm, 2)}/s`);
        setText('stat-mining-dyn', miningLab > 0 ? `${fmtNumber(miningDyn, 2)}/s` : NA);
        setText('stat-mining-temp', NA);

        // Stones: perm + dynamic (lab+OC) + temporary (ingot)
        const stonesHasDyn = stonesLab > 0 || isOn('oc-stones');
        setText('stat-stones-perm', `${fmtNumber(stonesPerm * 100, 0)}%`);
        setText('stat-stones-dyn', stonesHasDyn ? `${fmtNumber(stonesDyn * 100, 0)}%` : NA);
        setText('stat-stones-temp', isOn('ingot-stones') ? `${fmtNumber(stonesTemp * 100, 0)}%` : NA);

        // Gen: perm + dynamic (crank), no temporary
        setText('stat-gen-perm', `${fmtNumber(genPerm, 2)}/s`);
        setText('stat-gen-dyn', genCrank > 0 ? `${fmtNumber(genDyn, 2)}/s` : NA);
        setText('stat-gen-temp', NA);

        // Shiny Stone: permanent only
        setText('stat-shinyStone-perm', fmtPct(shinyStonePerm));
        setText('stat-shinyStone-dyn', NA);
        setText('stat-shinyStone-temp', NA);

        // Pet Score: permanent only
        setText('stat-petScore-perm', fmtPct(petScorePerm));
        setText('stat-petScore-dyn', NA);
        setText('stat-petScore-temp', NA);
    }

    // ----------------------------------------------------------
    // FORMAT HELPERS
    // ----------------------------------------------------------
    // Locale-aware number formatting honouring the user's regional settings
    // (decimal separator and digit grouping). Trailing zeros are dropped.
    function fmtNumber(n, maxDigits = 0) {
        return n.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
    }

    function fmtPct(v) {
        if (v === 0) return '0%';
        const pct = v * 100;
        if (pct >= 10) return `${fmtNumber(pct, 1)}%`;
        if (pct >= 1)  return `${fmtNumber(pct, 2)}%`;
        if (pct >= 0.01) return `${fmtNumber(pct, 3)}%`;
        return `${fmtNumber(pct, 5)}%`;
    }

    function fmtChance(v) {
        if (v <= 0) return '---';
        if (v >= 1) return `1 in 1 (${fmtNumber(100)}%)`;
        const oneIn = 1 / v;
        const pct = v * 100;
        if (oneIn < 1000) return `1 in ${fmtNumber(oneIn, 2)} (${fmtNumber(pct, 2)}%)`;
        return `1 in ${fmtNum(oneIn)} (${fmtNumber(pct, 4)}%)`;
    }

    function fmtNum(n) {
        if (n >= 1e9) return fmtNumber(n / 1e9, 2) + 'B';
        if (n >= 1e6) return fmtNumber(n / 1e6, 2) + 'M';
        if (n >= 1e3) return fmtNumber(n, 0);
        return fmtNumber(n, 2);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ----------------------------------------------------------
    // SAVE / LOAD STATE (localStorage)
    // ----------------------------------------------------------
    const STORAGE_KEY = 'cap-calc-state-v1';

    function saveState() {
        const state = {};
        document.querySelectorAll('input[type="number"], input[type="hidden"], input[type="checkbox"], select').forEach(el => {
            if (el.id) state[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const state = JSON.parse(saved);
            for (const [id, value] of Object.entries(state)) {
                const el = document.getElementById(id);
                if (!el) continue;
                if (el.type === 'checkbox') {
                    el.checked = !!value;
                } else {
                    el.value = value;
                }
            }
        } catch (e) { /* ignore */ }
    }

    // ----------------------------------------------------------
    // INIT
    // ----------------------------------------------------------
    function init() {
        loadState();

        const handler = () => { recalculate(); saveState(); };

        // Add range sliders to all number inputs that have min/max
        function parseUnitLabel(unitText) {
            return (unitText || '').replace(/^\s*\/\s*/, '').trim();
        }

        function stripMaxFromUnit(unitLabel, maxValue) {
            if (!unitLabel) return '';
            const maxTxt = String(maxValue).trim();

            if (unitLabel.startsWith(`x${maxTxt}`)) return 'x';
            if (unitLabel.startsWith(maxTxt)) return unitLabel.slice(maxTxt.length).trim();

            return unitLabel;
        }

        function updateSliderFill(slider) {
            const min = parseFloat(slider.min) || 0;
            const max = parseFloat(slider.max) || 100;
            const val = parseFloat(slider.value) || 0;
            const pct = ((val - min) / (max - min)) * 100;
            slider.style.setProperty('--fill', pct + '%');

            if (slider._progressLabel) {
                const step = parseFloat(slider.step);
                const hasFraction = !isNaN(step) && step % 1 !== 0;
                const digits = hasFraction ? (step.toString().split('.')[1] || '').length : 0;
                // Locale-aware values shown to the user.
                const valTxt = fmtNumber(val, digits);
                const maxTxt = fmtNumber(max, digits);
                // Canonical '.'-format max, used only to match the static HTML
                // unit label (which is authored with a '.' decimal separator).
                // Number.toString() never emits trailing zeros, so this matches
                // the authored value (e.g. "1.5", "0.002", "25").
                const maxPlain = String(max);
                let leftTxt = valTxt;
                let rightTxt = maxTxt;
                if (slider._unitLabel) {
                    const unitOnly = stripMaxFromUnit(slider._unitLabel, maxPlain);
                    if (unitOnly === 'x') {
                        leftTxt = 'x' + valTxt;
                        rightTxt = 'x' + maxTxt;
                    } else if (unitOnly && unitOnly !== slider._unitLabel) {
                        leftTxt = valTxt + unitOnly;
                        rightTxt = maxTxt + unitOnly;
                    } else {
                        rightTxt = slider._unitLabel;
                    }
                }
                slider._progressLabel.textContent = `${leftTxt}\u00a0/\u00a0${rightTxt}`;
            }
        }
        function checkMaxed(input) {
            const group = input.closest('.input-group');
            if (!group) return;
            const max = parseFloat(input.getAttribute('max'));
            if (isNaN(max)) return;
            group.classList.toggle('maxed', parseFloat(input.value) >= max);
        }
        document.querySelectorAll('input[type="number"]').forEach(numInput => {
            const min = numInput.getAttribute('min');
            const max = numInput.getAttribute('max');
            if (min === null || max === null) return;
            // Lab cards use a popover + card-value display, not inline sliders
            if (numInput.closest('.lab-card')) return;

            const step = numInput.getAttribute('step') || '1';
            const sourceUnit = numInput.nextElementSibling;
            const unitLabel = sourceUnit && sourceUnit.classList.contains('unit') ? parseUnitLabel(sourceUnit.textContent) : '';

            const range = document.createElement('input');
            range.type = 'range';
            range.min = min;
            range.max = max;
            range.step = step;
            range.value = numInput.value;
            range.className = 'slider';
            if (unitLabel) range._unitLabel = unitLabel;

            const sliderWrap = document.createElement('div');
            sliderWrap.className = 'slider-wrapper';
            const sliderProgress = document.createElement('span');
            sliderProgress.className = 'slider-progress';
            range._progressLabel = sliderProgress;

            sliderWrap.appendChild(range);
            sliderWrap.appendChild(sliderProgress);
            updateSliderFill(range);

            // Insert slider before the number input
            numInput.parentNode.insertBefore(sliderWrap, numInput);

            // Wrap number input and unit in an inline container
            const numWrapper = document.createElement('span');
            numWrapper.className = 'num-wrapper';
            numInput.parentNode.insertBefore(numWrapper, numInput);
            numWrapper.appendChild(numInput);
            const unit = numWrapper.nextElementSibling;
            if (unit && unit.classList.contains('unit')) {
                unit.remove();
            }

            // Sync slider → number
            range.addEventListener('input', () => {
                numInput.value = range.value;
                updateSliderFill(range);
                checkMaxed(numInput);
                handler();
            });

            // Sync number → slider
            numInput.addEventListener('input', () => {
                range.value = numInput.value;
                updateSliderFill(range);
                checkMaxed(numInput);
            });

            // Initial maxed check
            checkMaxed(numInput);
        });

        // Wrap inputs without sliders (no max) that have a unit span
        document.querySelectorAll('input[type="number"]').forEach(numInput => {
            if (numInput.closest('.num-wrapper')) return;
            const unit = numInput.nextElementSibling;
            if (unit && unit.classList.contains('unit')) {
                const numWrapper = document.createElement('span');
                numWrapper.className = 'num-wrapper';
                numInput.parentNode.insertBefore(numWrapper, numInput);
                numWrapper.appendChild(numInput);
                numWrapper.appendChild(unit);
            }
        });

        // Wrap toggle + unit pairs in num-wrapper
        document.querySelectorAll('.toggle').forEach(toggle => {
            const unit = toggle.nextElementSibling;
            if (unit && unit.classList.contains('unit')) {
                const numWrapper = document.createElement('span');
                numWrapper.className = 'num-wrapper';
                toggle.parentNode.insertBefore(numWrapper, toggle);
                numWrapper.appendChild(toggle);
                numWrapper.appendChild(unit);
            }
        });

        document.querySelectorAll('input[type="number"], select').forEach(el => {
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        document.querySelectorAll('input[type="checkbox"]').forEach(el => {
            el.addEventListener('change', handler);
            // Toggle maxed class on input-group when checkbox is toggled
            const group = el.closest('.input-group');
            if (group) {
                const sync = () => group.classList.toggle('maxed', el.checked);
                el.addEventListener('change', sync);
                sync();
            }
        });

        // Segmented control
        document.querySelectorAll('.seg-control').forEach(seg => {
            const hidden = seg.previousElementSibling;
            seg.querySelectorAll('.seg-btn').forEach(btn => {
                if (btn.dataset.value === hidden.value) btn.classList.add('active');
                btn.addEventListener('click', () => {
                    const wasActive = btn.classList.contains('active');
                    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
                    if (wasActive) {
                        hidden.value = 'None';
                    } else {
                        btn.classList.add('active');
                        hidden.value = btn.dataset.value;
                    }
                    handler();
                });
            });
        });

        recalculate();

        // --- Main view tabs ---
        const tabBar = document.querySelector('.tab-bar');
        if (tabBar) {
            const tabBtns = Array.from(tabBar.querySelectorAll('.tab-btn'));
            const tabFill = tabBar.querySelector('.tab-fill');
            const total = tabBtns.length || 1;
            tabFill.style.width = (100 / total) + '%';

            function activateTab(tabId) {
                tabBtns.forEach((btn, i) => {
                    const isActive = btn.dataset.tab === tabId;
                    btn.classList.toggle('active', isActive);
                    if (isActive) tabFill.style.left = (i * (100 / total)) + '%';
                });
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === tabId);
                });
            }

            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => activateTab(btn.dataset.tab));
            });
        }

        // --- Flyout sidebar logic ---
        const flyout = document.getElementById('flyout');
        const flyoutContent = document.getElementById('flyout-content');
        const flyoutLabel = document.getElementById('flyout-label');
        const backdrop = document.getElementById('flyout-backdrop');
        const closeBtn = document.getElementById('flyout-close');

        function openFlyout(panelId) {
            // Move the section into flyout
            const section = document.getElementById(panelId);
            if (!section) return;
            // Clear previous content and move section in
            while (flyoutContent.firstChild) {
                // Move children back to main (hidden by CSS)
                document.querySelector('main').appendChild(flyoutContent.firstChild);
            }
            flyoutContent.appendChild(section);
            flyout.classList.add('open');
            backdrop.classList.add('open');
            // Mark active nav button
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            const activeBtn = document.querySelector(`.nav-btn[data-panel="${panelId}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
            if (flyoutLabel) {
                flyoutLabel.textContent = activeBtn
                    ? (activeBtn.getAttribute('aria-label') || activeBtn.title || '')
                    : '';
            }
        }

        function closeFlyout() {
            flyout.classList.remove('open');
            backdrop.classList.remove('open');
            // Move section back to main
            while (flyoutContent.firstChild) {
                document.querySelector('main').appendChild(flyoutContent.firstChild);
            }
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            if (flyoutLabel) flyoutLabel.textContent = '';
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = btn.dataset.panel;
                if (flyout.classList.contains('open') && flyoutContent.querySelector(`#${panelId}`)) {
                    closeFlyout();
                } else {
                    openFlyout(panelId);
                }
            });
        });

        closeBtn.addEventListener('click', closeFlyout);
        backdrop.addEventListener('click', closeFlyout);

        // --- Lab card popover interaction ---
        function updateCardValue(card) {
            const input = card.querySelector('input[type="number"]');
            if (!input) return;
            let valueEl = card.querySelector('.card-value');
            if (!valueEl) {
                valueEl = document.createElement('span');
                valueEl.className = 'card-value';
                card.appendChild(valueEl);
            }
            const val = parseFloat(input.value) || 0;
            const max = input.getAttribute('max');
            valueEl.textContent = max ? `${fmtNumber(val)} / ${fmtNumber(parseFloat(max) || 0)}` : fmtNumber(val);
            if (max && val >= parseFloat(max)) {
                card.classList.add('maxed');
            } else {
                card.classList.remove('maxed');
            }
            updateTierMaxed(card);
        }

        function updateTierMaxed(card) {
            const row = card.closest('.lab-tier');
            if (!row) return;
            const ptsEl = row.querySelector('.tier-pts');
            if (!ptsEl) return;
            const maxPts = parseInt(ptsEl.dataset.max) || 0;
            let sum = 0;
            row.querySelectorAll('.lab-card:not(.empty) input[type="number"]').forEach(inp => {
                sum += parseFloat(inp.value) || 0;
            });
            ptsEl.textContent = `${fmtNumber(sum)} / ${fmtNumber(maxPts)}`;
            row.classList.toggle('maxed', sum >= maxPts);
        }

        // Init static value display on all cards
        document.querySelectorAll('.lab-card:not(.empty)').forEach(card => {
            updateCardValue(card);
        });

        function openCardPopover(card) {
            const input = card.querySelector('input[type="number"]');
            if (!input) return;

            // Close any existing popover
            closeCardPopover();

            const name = card.getAttribute('data-stat') || card.querySelector('.card-name').textContent;
            const min = parseFloat(input.min) || 0;
            const max = input.getAttribute('max');
            const step = parseFloat(input.step) || 1;
            const hasMax = max !== null && max !== '';
            const sourceUnit = input.nextElementSibling;
            const unitLabel = sourceUnit && sourceUnit.classList.contains('unit') ? parseUnitLabel(sourceUnit.textContent) : '';
            const unitOnly = stripMaxFromUnit(unitLabel, max || '');

            // Backdrop
            const bdrop = document.createElement('div');
            bdrop.className = 'card-popover-backdrop';
            document.body.appendChild(bdrop);

            // Popover
            const pop = document.createElement('div');
            pop.className = 'card-popover';
            if (card.classList.contains('maxed')) pop.classList.add('maxed');

            const title = document.createElement('div');
            title.className = 'pop-title';
            title.textContent = name;
            pop.appendChild(title);

            let popInput;
            if (hasMax) {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'pop-slider';
                slider.min = min;
                slider.max = max;
                slider.step = step;
                slider.value = input.value;

                const popSliderWrap = document.createElement('div');
                popSliderWrap.className = 'slider-wrapper';
                const popSliderProgress = document.createElement('span');
                popSliderProgress.className = 'slider-progress';
                slider._progressLabel = popSliderProgress;
                if (unitLabel) slider._unitLabel = unitLabel;

                popSliderWrap.appendChild(slider);
                popSliderWrap.appendChild(popSliderProgress);
                updateSliderFill(slider);
                pop.appendChild(popSliderWrap);

                popInput = document.createElement('input');
                popInput.type = 'number';
                popInput.className = 'pop-input';
                popInput.min = min;
                popInput.max = max;
                popInput.step = step;
                popInput.value = input.value;

                const row = document.createElement('div');
                row.className = 'pop-input-row';
                row.appendChild(popInput);
                const unit = document.createElement('span');
                unit.className = 'pop-unit';
                if (unitOnly) {
                    unit.textContent = `/ ${unitOnly}`;
                    row.appendChild(unit);
                }
                pop.appendChild(row);

                slider.addEventListener('input', () => {
                    popInput.value = slider.value;
                    input.value = slider.value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    updateCardValue(card);
                    updateSliderFill(slider);
                    pop.classList.toggle('maxed', card.classList.contains('maxed'));
                });

                popInput.addEventListener('input', () => {
                    let v = parseFloat(popInput.value) || 0;
                    if (v < min) v = min;
                    if (v > parseFloat(max)) v = parseFloat(max);
                    slider.value = v;
                    input.value = v;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    updateCardValue(card);
                    updateSliderFill(slider);
                    pop.classList.toggle('maxed', card.classList.contains('maxed'));
                });
            } else {
                // Tier VIII - no max, just a number input
                popInput = document.createElement('input');
                popInput.type = 'number';
                popInput.className = 'pop-input';
                popInput.min = min;
                popInput.step = step;
                popInput.value = input.value;

                const row = document.createElement('div');
                row.className = 'pop-input-row';
                row.appendChild(popInput);
                const unit = document.createElement('span');
                unit.className = 'pop-unit';
                unit.textContent = 'pts';
                row.appendChild(unit);
                pop.appendChild(row);

                popInput.addEventListener('input', () => {
                    let v = parseFloat(popInput.value) || 0;
                    if (v < min) v = min;
                    input.value = v;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    updateCardValue(card);
                });
            }

            document.body.appendChild(pop);

            // Position popover near the card
            const rect = card.getBoundingClientRect();
            const popW = pop.offsetWidth;
            const popH = pop.offsetHeight;
            let left = rect.left + rect.width / 2 - popW / 2;
            let top = rect.bottom + 8;
            if (left < 8) left = 8;
            if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
            if (top + popH > window.innerHeight - 8) top = rect.top - popH - 8;
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';

            bdrop.addEventListener('click', closeCardPopover);

            // Focus the input
            popInput.focus();
            popInput.select();
        }

        function closeCardPopover() {
            const bdrop = document.querySelector('.card-popover-backdrop');
            const pop = document.querySelector('.card-popover');
            if (bdrop) bdrop.remove();
            if (pop) pop.remove();
        }

        document.querySelectorAll('.lab-card:not(.empty)').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                openCardPopover(card);
            });
        });

        // --- Lab profiles ---
        labInputIds = Array.from(document.querySelectorAll('.lab-card:not(.empty) input[type="number"]'))
            .map(el => el.id)
            .filter(Boolean);

        function blankLabProfile() {
            const p = {};
            labInputIds.forEach(id => { p[id] = 0; });
            return p;
        }

        function domLabProfile() {
            const p = {};
            labInputIds.forEach(id => {
                const el = document.getElementById(id);
                p[id] = el ? el.value : 0;
            });
            return p;
        }

        function saveLabProfiles() {
            try {
                localStorage.setItem(LAB_PROFILES_KEY, JSON.stringify({
                    profiles: labProfiles,
                    active: activeProfileIdx,
                    selected: selectedProfileIdx
                }));
            } catch (e) { /* ignore */ }
        }

        function loadLabProfiles() {
            let data = null;
            try { data = JSON.parse(localStorage.getItem(LAB_PROFILES_KEY)); } catch (e) { /* ignore */ }
            if (data && Array.isArray(data.profiles) && data.profiles.length) {
                labProfiles = data.profiles.slice(0, LAB_PROFILE_COUNT);
            } else {
                // First run: seed profile 1 from any existing lab values.
                labProfiles = [domLabProfile()];
            }
            while (labProfiles.length < LAB_PROFILE_COUNT) labProfiles.push(blankLabProfile());
            const clamp = (n) => Math.min(Math.max(parseInt(n) || 0, 0), LAB_PROFILE_COUNT - 1);
            activeProfileIdx = clamp(data && data.active);
            selectedProfileIdx = clamp(data && data.selected);
        }

        // Copy the on-screen lab inputs into the selected profile's snapshot.
        function commitSelectedProfile() {
            const p = labProfiles[selectedProfileIdx];
            if (!p) return;
            labInputIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) p[id] = el.value;
            });
        }

        // Load the selected profile's snapshot into the lab inputs/cards.
        function renderLabCardsFromSelected() {
            const p = labProfiles[selectedProfileIdx] || {};
            labInputIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = (p[id] != null ? p[id] : 0);
            });
            document.querySelectorAll('.lab-card:not(.empty)').forEach(card => updateCardValue(card));
        }

        // The profile tab buttons live in the HTML; rendering just updates
        // their state (number vs. tick, selected/active classes).
        const profileTabs = Array.from(document.querySelectorAll('.lab-profile-tab'));

        function renderProfileTabs() {
            profileTabs.forEach((btn, i) => {
                btn.classList.toggle('selected', i === selectedProfileIdx);
                btn.classList.toggle('active-profile', i === activeProfileIdx);
                btn.textContent = (i === activeProfileIdx) ? '\u2714' : String(i + 1);
                btn.title = `Profile ${i + 1}`;
            });
            const activateBtn = document.getElementById('lab-profile-activate');
            if (activateBtn) activateBtn.disabled = (selectedProfileIdx === activeProfileIdx);
        }

        profileTabs.forEach((btn, i) => {
            btn.addEventListener('click', () => selectProfile(i));
        });

        function selectProfile(idx) {
            if (idx === selectedProfileIdx) return;
            commitSelectedProfile();
            selectedProfileIdx = idx;
            renderLabCardsFromSelected();
            renderProfileTabs();
            saveLabProfiles();
            recalculate();
        }

        function activateSelectedProfile() {
            commitSelectedProfile();
            activeProfileIdx = selectedProfileIdx;
            renderProfileTabs();
            saveLabProfiles();
            recalculate();
        }

        function resetSelectedProfile() {
            if (!confirm(`Reset profile ${selectedProfileIdx + 1}? This clears all its lab points.`)) return;
            labProfiles[selectedProfileIdx] = blankLabProfile();
            renderLabCardsFromSelected();
            saveLabProfiles();
            recalculate();
        }

        // Keep the selected profile's snapshot in sync as its cards change.
        labInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const p = labProfiles[selectedProfileIdx];
                if (p) p[id] = el.value;
                saveLabProfiles();
            });
        });

        const labActivateBtn = document.getElementById('lab-profile-activate');
        const labResetBtn = document.getElementById('lab-profile-reset');
        if (labActivateBtn) labActivateBtn.addEventListener('click', activateSelectedProfile);
        if (labResetBtn) labResetBtn.addEventListener('click', resetSelectedProfile);

        loadLabProfiles();
        renderLabCardsFromSelected();
        renderProfileTabs();
        recalculate();

        // --- Align sidebar buttons to stats table rows ---
        function alignSidebar() {
            const btns = document.querySelectorAll('.nav-btn');
            // On mobile the sidebar becomes a horizontal bottom bar; clear any
            // inline positioning so the CSS row layout takes over.
            if (window.matchMedia('(max-width: 48em)').matches) {
                btns.forEach(btn => {
                    btn.style.top = '';
                    btn.style.height = '';
                });
                return;
            }
            const rows = document.querySelectorAll('.stat-table tbody tr');
            btns.forEach((btn, i) => {
                if (i < rows.length) {
                    const rect = rows[i].getBoundingClientRect();
                    btn.style.top = rect.top + 'px';
                    btn.style.height = rect.height + 'px';
                }
            });
        }
        alignSidebar();
        window.addEventListener('scroll', alignSidebar);
        window.addEventListener('resize', alignSidebar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
