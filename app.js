// State management
let state = {
  recipeId: 'jalapeno-cheddar',
  weight: 50.0,
  tasks: Array(15).fill(false), // 15 tasks (1-indexed mapping to 0-14 array indices)
  beefWeight: 50.0,
  beefRatio: 0.75,
  lastUpdated: Date.now()
};

// Configuration
const BUCKET_ID = 'mn4q9QfG4q25p2jPswkX9o';
const urlParams = new URLSearchParams(window.location.search);
const sessionName = urlParams.get('session') || 'default-run';

// Recipe Formulations Data Definition (50 lb Batch Ratios)
const RECIPES = {
  'jalapeno-cheddar': {
    id: 'jalapeno-cheddar',
    name: 'Jalapeño Cheddar',
    icon: '🌶️',
    menuSource: 'Pitmaster Original Signature',
    description: 'Classic Texas smoked sausage loaded with high-temp cheddar cubes and fresh diced jalapeños.',
    stuffedAddInLbs: 9.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'jalapenos', label: 'Diced Jalapeños', amount: 3.0, unit: 'cups', desc: 'Fully Drained & Diced' },
      { id: 'cheddar', label: 'Cheddar Cheese', amount: 5.0, unit: 'lbs', desc: 'High-Temp Cubes' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.5, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Thoroughly strain all brine juice out of the pickled/spiced jalapeños, then medium-dice.",
      9: "Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.",
      11: "Incorporate the remaining ice water, high-temp cheddar cheese cubes, and the completely dry jalapeño dice."
    }
  },
  'elote': {
    id: 'elote',
    name: 'The Elote (Street Corn)',
    icon: '🌽',
    menuSource: 'Elote Side Dish & Caesar Salad Prep',
    description: 'Texas BBQ meets Mexican street corn: smoked corn pico, sharp parmesan cheese, fresh cilantro & diced onions.',
    stuffedAddInLbs: 10.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'corn-pico', label: 'Smoked Corn Pico / Elote', amount: 6.25, unit: 'lbs', desc: 'Well-Drained Elote' },
      { id: 'parmesan', label: 'Parmesan Cheese', amount: 2.5, unit: 'lbs', desc: 'Shredded/Grated' },
      { id: 'cilantro', label: 'Chopped Cilantro', amount: 1.5, unit: 'cups', desc: 'Taco Station Chop' },
      { id: 'onion', label: 'Diced Onion', amount: 1.5, unit: 'cups', desc: 'Fine Dice' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.0, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Thoroughly strain liquid from the smoked corn pico/elote; fine-dice onions and chop fresh cilantro.",
      9: "Whisk the first half of prepped ice water with Powdered Milk, black pepper, cilantro, and onions.",
      11: "Incorporate the remaining ice water, parmesan cheese, and well-drained smoked corn pico."
    }
  },
  'salsa-verde': {
    id: 'salsa-verde',
    name: 'The Salsa Verde',
    icon: '🥑',
    menuSource: 'Turkey Bacon Ranch Quesadilla & Quesa Tacos',
    description: 'Zesty sausage blended with house salsa verde liquid binder, melty cheese, cilantro & diced onions.',
    stuffedAddInLbs: 9.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'salsa-verde', label: 'Salsa Verde', amount: 2.5, unit: 'lbs', desc: 'Liquid Binder (House Blend)' },
      { id: 'melty-cheese', label: 'Melty Cheese', amount: 5.0, unit: 'lbs', desc: 'Quesa Blend Cubes' },
      { id: 'cilantro', label: 'Chopped Cilantro', amount: 1.5, unit: 'cups', desc: 'Fresh Taco Chop' },
      { id: 'onion', label: 'Diced Onion', amount: 1.5, unit: 'cups', desc: 'Fine Dice' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups (Salsa adds liquid)' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Chop fresh cilantro and fine-dice onions; measure chilled Salsa Verde liquid binder and melty cheese cubes.",
      9: "Whisk the Salsa Verde liquid binder into the first half of ice water with Powdered Milk, cilantro, and onions.",
      11: "Incorporate the remaining ice water and melty cheese cubes evenly into the grind."
    }
  },
  'sweet-bacon': {
    id: 'sweet-bacon',
    name: 'Sweet Bacon & Cream Cheese',
    icon: '🥓',
    menuSource: 'Rose Buds & Quesadillas Prep',
    description: 'Decadent smoked sausage packed with chilled cream cheese cubes, crispy bacon bits, honey & signature BBQ rub.',
    stuffedAddInLbs: 11.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'cream-cheese', label: 'Cream Cheese', amount: 5.0, unit: 'lbs', desc: 'Chilled & Firm Cubes' },
      { id: 'bacon-bits', label: 'Cooked Bacon Bits', amount: 5.0, unit: 'lbs', desc: 'Crispy Rose Buds Bacon' },
      { id: 'honey', label: 'Honey Drizzle', amount: 1.5, unit: 'cups', desc: 'Binder & Sweetness' },
      { id: 'bbq-rub', label: 'Signature BBQ Rub', amount: 1.5, unit: 'cups', desc: 'Seasoning Station' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Dice cream cheese while semi-frozen so cubes hold shape; chop cooked bacon into uniform bits.",
      9: "Whisk the first half of prepped ice water with Honey, Signature BBQ Rub, and Powdered Milk.",
      11: "Carefully fold in remaining ice water, crispy bacon bits, and chilled firm cream cheese cubes."
    }
  },
  'garlic-parmesan': {
    id: 'garlic-parmesan',
    name: 'Garlic Parmesan',
    icon: '🧄',
    menuSource: 'Caesar Salad & Kitchen Garlic Prep',
    description: 'Savory & aromatic sausage featuring sautéed minced garlic, rich parmesan cheese & signature BBQ rub.',
    stuffedAddInLbs: 8.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'sauteed-garlic', label: 'Sautéed Minced Garlic', amount: 2.0, unit: 'lbs', desc: 'Cooled Sautéed Garlic' },
      { id: 'parmesan', label: 'Parmesan Cheese', amount: 5.0, unit: 'lbs', desc: 'Shredded/Grated' },
      { id: 'bbq-rub', label: 'Signature BBQ Rub', amount: 1.5, unit: 'cups', desc: 'Seasoning Station' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Ensure sautéed minced garlic is completely chilled before mixing to prevent fat melting.",
      9: "Whisk the first half of prepped ice water with Powdered Milk, Signature BBQ Rub, and cooled minced garlic.",
      11: "Incorporate the remaining ice water and the parmesan cheese into the meat paste."
    }
  },
  'farmhouse-cabbage': {
    id: 'farmhouse-cabbage',
    name: 'Farmhouse Cabbage & Bacon',
    icon: '🥬',
    menuSource: 'Sides Station Cabbage & Rose Buds Bacon',
    description: 'Hearty farmhouse-style blend with tender sautéed cabbage, smoky bacon bits & sautéed garlic.',
    stuffedAddInLbs: 13.0,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'sauteed-cabbage', label: 'Sautéed Cabbage', amount: 6.25, unit: 'lbs', desc: 'Well-Drained & Chilled' },
      { id: 'bacon-bits', label: 'Cooked Bacon Bits', amount: 5.0, unit: 'lbs', desc: 'Crispy Bacon Bits' },
      { id: 'sauteed-garlic', label: 'Sautéed Minced Garlic', amount: 1.5, unit: 'lbs', desc: 'Chilled Garlic' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.0, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Thoroughly drain and press all moisture out of sautéed cabbage, then chill along with garlic and bacon bits.",
      9: "Whisk the first half of prepped ice water with Powdered Milk, black pepper, and chilled minced garlic.",
      11: "Incorporate the remaining ice water, cooked bacon bits, and well-drained sautéed cabbage."
    }
  },
  'garlic-birria': {
    id: 'garlic-birria',
    name: 'Garlic Birria & Cheese',
    icon: '🌮',
    menuSource: 'Crispy Quesa Tacos (Birria, Melty Cheese, Onions)',
    description: 'Rich birria meat & reduced consommé, melted cheese, sautéed garlic & diced onions.',
    stuffedAddInLbs: 12.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'birria-meat', label: 'Birria / Consommé', amount: 5.0, unit: 'lbs', desc: 'Shredded Meat & Reduced Consommé' },
      { id: 'melty-cheese', label: 'Melty Cheese', amount: 5.0, unit: 'lbs', desc: 'Quesa Cheese Cubes' },
      { id: 'sauteed-garlic', label: 'Sautéed Minced Garlic', amount: 2.0, unit: 'lbs', desc: 'Chilled Garlic' },
      { id: 'onion', label: 'Diced Onion', amount: 2.0, unit: 'cups', desc: 'Taco Prep Station' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups (Birria adds liquid)' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Chop shredded birria meat fine and chill; ensure reduced birria consommé is cold before mixing.",
      9: "Whisk the chilled birria consommé into the first half of ice water with Powdered Milk, garlic, and diced onions.",
      11: "Incorporate the remaining ice water, birria meat, and melty cheese cubes evenly."
    }
  }
};

// DOM Elements
const weightSlider = document.getElementById('weight-slider');
const weightVal = document.getElementById('weight-val');
const sessionDisplay = document.getElementById('session-display');
const syncBadge = document.getElementById('sync-badge');
const syncText = document.getElementById('sync-text');

// Recipe Selector elements
const recipePillsContainer = document.getElementById('recipe-pills');
const recipeInfoIcon = document.getElementById('recipe-info-icon');
const recipeInfoTitle = document.getElementById('recipe-info-title');
const recipeMenuTag = document.getElementById('recipe-menu-tag');
const recipeInfoDesc = document.getElementById('recipe-info-desc');

// Ingredients Grid Container
const ingredientsGrid = document.getElementById('ingredients-grid');

// Estimator elements
const estStuffedWeight = document.getElementById('est-stuffed-weight');
const estLinksExpected = document.getElementById('est-links-expected');

// Controls
const btnMinus5 = document.getElementById('btn-minus-5');
const btnMinus1 = document.getElementById('btn-minus-1');
const btnPlus1 = document.getElementById('btn-plus-1');
const btnPlus5 = document.getElementById('btn-plus-5');
const btnReset = document.getElementById('btn-reset');
const btnShare = document.getElementById('btn-share');
const btnShortcut = document.getElementById('btn-shortcut');

// Task rows
const taskRows = document.querySelectorAll('.task-row');

// Beef Calculator elements
const beefCalcWeight = document.getElementById('beef-calc-weight');
const btnRatioPitmaster = document.getElementById('btn-ratio-pitmaster');
const btnRatioLeaner = document.getElementById('btn-ratio-leaner');
const beefCalcLean = document.getElementById('beef-calc-lean');
const beefCalcFat = document.getElementById('beef-calc-fat');
const beefCalcLeanDesc = document.getElementById('beef-calc-lean-desc');
const beefCalcFatDesc = document.getElementById('beef-calc-fat-desc');

// Initialize App
function init() {
  sessionDisplay.textContent = `Session: ${sessionName.toUpperCase()}`;

  // Render recipe pills
  renderRecipePills();

  // Set up task row click events
  taskRows.forEach(row => {
    row.addEventListener('click', () => {
      const stepIndex = parseInt(row.getAttribute('data-step')) - 1;
      state.tasks[stepIndex] = !state.tasks[stepIndex];
      state.lastUpdated = Date.now();
      
      updateUI();
      saveState();
    });
  });

  // Slider change event
  weightSlider.addEventListener('input', (e) => {
    state.weight = parseFloat(e.target.value);
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  });

  // Beef calculator input events
  beefCalcWeight.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) {
      val = 0;
    }
    state.beefWeight = val;
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  });

  btnRatioPitmaster.addEventListener('click', () => {
    state.beefRatio = 0.75;
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  });

  btnRatioLeaner.addEventListener('click', () => {
    state.beefRatio = 0.8;
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  });

  // Macro adjustments for slider
  btnMinus5.addEventListener('click', () => adjustWeight(-5));
  btnMinus1.addEventListener('click', () => adjustWeight(-1));
  btnPlus1.addEventListener('click', () => adjustWeight(1));
  btnPlus5.addEventListener('click', () => adjustWeight(5));

  // Bottom action buttons
  btnReset.addEventListener('click', resetRun);
  btnShortcut.addEventListener('click', triggerShortcut);
  btnShare.addEventListener('click', copyShareLink);

  // Load state from local storage first (instant responsiveness)
  loadLocalState();
  updateUI();

  // Load and subscribe to cloud state
  syncWithCloud();
  setInterval(pollCloudState, 5000);
}

// Render recipe selector pills
function renderRecipePills() {
  recipePillsContainer.innerHTML = '';
  Object.keys(RECIPES).forEach(key => {
    const r = RECIPES[key];
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `recipe-pill ${state.recipeId === key ? 'active' : ''}`;
    pill.setAttribute('data-recipe', key);
    pill.innerHTML = `<span class="recipe-pill-icon">${r.icon}</span> <span>${r.name}</span>`;
    
    pill.addEventListener('click', () => {
      state.recipeId = key;
      state.lastUpdated = Date.now();
      updateUI();
      saveState();
    });

    recipePillsContainer.appendChild(pill);
  });
}

// Adjust weight via buttons
function adjustWeight(amount) {
  let target = state.weight + amount;
  if (target < 5) target = 5;
  if (target > 150) target = 150;
  state.weight = target;
  state.lastUpdated = Date.now();
  weightSlider.value = target;
  updateUI();
  saveState();
}

// Update DOM elements based on state
function updateUI() {
  const currentRecipe = RECIPES[state.recipeId] || RECIPES['jalapeno-cheddar'];

  // Update recipe selector pills active state
  document.querySelectorAll('.recipe-pill').forEach(pill => {
    if (pill.getAttribute('data-recipe') === currentRecipe.id) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // Update active recipe info card
  recipeInfoIcon.textContent = currentRecipe.icon;
  recipeInfoTitle.textContent = currentRecipe.name;
  recipeMenuTag.textContent = `📍 Menu Source: ${currentRecipe.menuSource}`;
  recipeInfoDesc.textContent = currentRecipe.description;

  // Update weight values
  weightVal.textContent = state.weight.toFixed(1);
  weightSlider.value = state.weight;

  // Recipe Calculations (Base = 50 lbs)
  const scale = state.weight / 50.0;

  // Render Dynamic Ingredients Grid
  ingredientsGrid.innerHTML = '';
  currentRecipe.ingredients.forEach(ing => {
    const card = document.createElement('div');
    card.className = `ingredient-card ${ing.highlight ? 'highlight-card' : ''}`;
    
    let displayVal;
    if (ing.isGram) {
      displayVal = Math.round(ing.amount * scale);
    } else {
      displayVal = (ing.amount * scale).toFixed(2);
    }

    card.innerHTML = `
      <span class="ing-label">${ing.label}</span>
      <div class="ing-value-box">
        <span class="ing-value">${displayVal}</span>
        <span class="ing-unit">${ing.unit}</span>
      </div>
      <span class="ing-desc">${ing.desc}</span>
    `;
    ingredientsGrid.appendChild(card);
  });

  // Link Estimations
  // Total Stuffed Weight = (50 lbs base meat block + add-ins) * scale
  const totalStuffed = (50.0 + currentRecipe.stuffedAddInLbs) * scale;
  estStuffedWeight.textContent = totalStuffed.toFixed(1);
  
  // Total Links: Stuffed Weight * 2.6 (~1/3 lb per link)
  const totalLinks = totalStuffed * 2.6;
  const roundedLinks = Math.round(totalLinks);
  estLinksExpected.textContent = roundedLinks;

  // Update Custom Task Step Descriptions for steps 8, 9, 11
  taskRows.forEach(row => {
    const stepNum = parseInt(row.getAttribute('data-step'));
    const pTag = row.querySelector('.task-content p');
    if (currentRecipe.customSteps && currentRecipe.customSteps[stepNum] && pTag) {
      pTag.textContent = currentRecipe.customSteps[stepNum];
    }
  });

  // Update Beef Sausage Calculator values
  if (beefCalcWeight && document.activeElement !== beefCalcWeight) {
    beefCalcWeight.value = state.beefWeight;
  }
  
  if (state.beefRatio === 0.75) {
    btnRatioPitmaster.classList.add('active');
    btnRatioLeaner.classList.remove('active');
    beefCalcLeanDesc.textContent = "75% of total batch weight";
    beefCalcFatDesc.textContent = "25% of total batch weight";
  } else {
    btnRatioPitmaster.classList.remove('active');
    btnRatioLeaner.classList.add('active');
    beefCalcLeanDesc.textContent = "80% of total batch weight";
    beefCalcFatDesc.textContent = "20% of total batch weight";
  }
  
  const leanAmount = state.beefWeight * state.beefRatio;
  const fatAmount = state.beefWeight * (1 - state.beefRatio);
  
  beefCalcLean.textContent = leanAmount.toFixed(2);
  beefCalcFat.textContent = fatAmount.toFixed(2);

  // Update Task Checkbox states
  taskRows.forEach(row => {
    const stepIndex = parseInt(row.getAttribute('data-step')) - 1;
    if (state.tasks[stepIndex]) {
      row.classList.add('checked');
    } else {
      row.classList.remove('checked');
    }
  });
}

// Reset Run Function
function resetRun() {
  if (confirm("Are you sure you want to reset all tasks?")) {
    state.tasks = Array(15).fill(false);
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  }
}

// Pitmaster Shortcut Function (Marks steps 1 to 12 complete)
function triggerShortcut() {
  for (let i = 0; i < 12; i++) {
    state.tasks[i] = true;
  }
  state.lastUpdated = Date.now();
  updateUI();
  saveState();
}

// Share status link copier
function copyShareLink() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('session', sessionName);
  
  navigator.clipboard.writeText(currentUrl.toString())
    .then(() => {
      alert(`Live session link copied to clipboard!\nShare this with anyone to let them track progress.`);
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
}

// State Sanitization / Migrations
function sanitizeState(obj) {
  if (!obj.recipeId || !RECIPES[obj.recipeId]) obj.recipeId = 'jalapeno-cheddar';
  if (obj.weight === undefined) obj.weight = 50.0;
  if (obj.beefWeight === undefined) obj.beefWeight = 50.0;
  if (obj.beefRatio === undefined) obj.beefRatio = 0.75;
  if (!Array.isArray(obj.tasks) || obj.tasks.length !== 15) obj.tasks = Array(15).fill(false);
  return obj;
}

// Persistence: Local Storage
function loadLocalState() {
  const local = localStorage.getItem(`sausage_run_${sessionName}`);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (parsed.weight && Array.isArray(parsed.tasks)) {
        state = sanitizeState(parsed);
      }
    } catch (e) {
      console.error("Error parsing local state", e);
    }
  }
}

let saveDebounceTimer;
function saveState() {
  // Save locally instantly
  localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));

  // Debounce saving to cloud to prevent rapid multiple updates
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(uploadStateToCloud, 600);
}

// Sync Status styling utility
function setSyncStatus(status, text) {
  syncBadge.className = `sync-badge ${status}`;
  syncText.textContent = text;
}

// Cloud REST API URLs
const cloudUrl = `https://kvdb.io/${BUCKET_ID}/sausage-state-${sessionName}`;

// Cloud sync routines
function uploadStateToCloud() {
  setSyncStatus('syncing', 'Syncing...');
  
  fetch(cloudUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(state)
  })
  .then(res => {
    if (!res.ok) throw new Error('Network error');
    setSyncStatus('live', 'Live');
  })
  .catch(err => {
    console.warn('Sync failed, offline mode active:', err);
    setSyncStatus('offline', 'Offline');
  });
}

function syncWithCloud() {
  setSyncStatus('syncing', 'Connecting...');
  
  fetch(cloudUrl)
    .then(res => {
      if (res.status === 404) {
        // No remote data yet, push our current state
        uploadStateToCloud();
        return null;
      }
      if (!res.ok) throw new Error('Fetch failed');
      return res.json();
    })
    .then(remoteState => {
      if (remoteState && remoteState.lastUpdated) {
        // If remote state is newer or we don't have local differences, apply it
        if (remoteState.lastUpdated > (state.lastUpdated || 0)) {
          state = sanitizeState(remoteState);
          updateUI();
          localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
        }
      }
      setSyncStatus('live', 'Live');
    })
    .catch(err => {
      console.warn('Could not contact sync backend, operating offline:', err);
      setSyncStatus('offline', 'Offline');
    });
}

function pollCloudState() {
  fetch(cloudUrl)
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then(remoteState => {
      if (remoteState && remoteState.lastUpdated) {
        // Only update if remote state has a newer timestamp
        if (remoteState.lastUpdated > state.lastUpdated) {
          state = sanitizeState(remoteState);
          updateUI();
          localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
        }
      }
      setSyncStatus('live', 'Live');
    })
    .catch(() => {
      setSyncStatus('offline', 'Offline');
    });
}

// Run init
window.addEventListener('DOMContentLoaded', () => {
  init();
  initMultiTabNavigation();
});

// Multi-Tab & POS Analytics Forecasting Module Integration
function initMultiTabNavigation() {
  const tabBtns = document.querySelectorAll('.app-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
      });

      btn.classList.add('active');
      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) {
        activePane.style.display = 'block';
        activePane.classList.add('active');
      }

      if (targetTab === 'forecasting-analytics') {
        renderPlotlyForecastingChart();
      }
    });
  });

  // Date controls & Historical Past Date Lookup
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.addEventListener('change', () => {
      handleDateSelectionLookup(dateInput.value);
      renderPlotlyForecastingChart();
    });
  }

function handleDateSelectionLookup(selectedDateStr) {
  const histCard = document.getElementById('historical-reference-card');
  if (!histCard) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastOrToday = selectedDateStr <= todayStr;

  if (isPastOrToday) {
    histCard.style.display = 'block';
    
    const d = new Date(selectedDateStr);
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' });
    const dow = d.getDay(); // 0=Sun, 6=Sat

    const dateLabel = document.getElementById('hist-date-label');
    const demandVal = document.getElementById('hist-demand-val');
    const weatherVal = document.getElementById('hist-weather-val');
    const eventVal = document.getElementById('hist-event-val');

    if (dateLabel) dateLabel.textContent = dateFormatted;

    // Determine Day Demand & Event Status for historical reference
    if (dow === 6) { // Saturday
      if (demandVal) demandVal.textContent = '1.8x (Peak Saturday Surge)';
      if (eventVal) eventVal.textContent = 'Jaguars Stadium Game Day';
      if (weatherVal) weatherVal.textContent = '86°F | Clear & Sunny';
    } else if (dow === 5) { // Friday
      if (demandVal) demandVal.textContent = '1.4x (High Friday Run)';
      if (eventVal) eventVal.textContent = 'Weekend Launch';
      if (weatherVal) weatherVal.textContent = '82°F | Mild';
    } else { // Weekday
      if (demandVal) demandVal.textContent = '1.0x (Standard Baseline)';
      if (eventVal) eventVal.textContent = 'Regular Operations';
      if (weatherVal) weatherVal.textContent = '84°F | Normal';
    }
  } else {
    histCard.style.display = 'none';
  }
}

  // Subtab switching
  const btnSubtabArima = document.getElementById('btn-subtab-arima');
  const btnSubtabWeather = document.getElementById('btn-subtab-weather');
  const btnSubtabEvent = document.getElementById('btn-subtab-event');
  
  const viewArima = document.getElementById('subtab-view-arima');
  const viewWeather = document.getElementById('subtab-view-weather');
  const viewEvent = document.getElementById('subtab-view-event');

  if (btnSubtabArima && btnSubtabWeather && btnSubtabEvent) {
    btnSubtabArima.addEventListener('click', () => {
      btnSubtabArima.classList.add('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      if (viewArima) viewArima.style.display = 'block';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      renderPlotlyForecastingChart();
    });

    btnSubtabWeather.addEventListener('click', () => {
      btnSubtabWeather.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      if (viewWeather) viewWeather.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      renderPlotlyWeatherChart();
    });

    btnSubtabEvent.addEventListener('click', () => {
      btnSubtabEvent.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      if (viewEvent) viewEvent.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      renderPlotlyEventChart();
    });
  }

  // Presets
  const btn3 = document.getElementById('btn-preset-3');
  const btn14 = document.getElementById('btn-preset-14');
  const btn7 = document.getElementById('btn-preset-7');
  const btnSat = document.getElementById('btn-preset-saturday');

  if (btn3) btn3.addEventListener('click', () => updatePresetHorizon(3));
  if (btn14) btn14.addEventListener('click', () => updatePresetHorizon(14));
  if (btn7) btn7.addEventListener('click', () => updatePresetHorizon(7));
  if (btnSat) btnSat.addEventListener('click', () => updatePresetThirdSaturday());
}

async function renderPlotlyEventChart() {
  const container = document.getElementById('plotly-event-impact-chart');
  if (!container || typeof Plotly === 'undefined') return;

  try {
    const res = await fetch('clover_api/analytics/event_payload.json');
    if (!res.ok) throw new Error('Failed to load event payload');
    const payload = await res.json();

    const layout = payload.plotly_event_chart.layout;
    const traces = payload.plotly_event_chart.data;
    Plotly.newPlot('plotly-event-impact-chart', traces, layout, { responsive: true, displayModeBar: false });
  } catch (err) {
    console.warn('Could not load event chart payload', err);
  }
}

async function renderPlotlyWeatherChart() {
  const container = document.getElementById('plotly-weather-impact-chart');
  if (!container || typeof Plotly === 'undefined') return;

  try {
    const res = await fetch('clover_api/analytics/weather_payload.json');
    if (!res.ok) throw new Error('Failed to load weather payload');
    const payload = await res.json();

    const layout = payload.plotly_weather_chart.layout;
    const traces = payload.plotly_weather_chart.data;
    Plotly.newPlot('plotly-weather-impact-chart', traces, layout, { responsive: true, displayModeBar: false });
  } catch (err) {
    console.warn('Could not load weather chart payload', err);
  }
}

function updatePresetHorizon(days) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`btn-preset-${days}`);
  if (btn) btn.classList.add('active');

  // Update date input to today if set to horizon
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    handleDateSelectionLookup(today);
  }
  renderPlotlyForecastingChart(days);
}

function updatePresetThirdSaturday() {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-preset-saturday');
  if (btn) btn.classList.add('active');
  
  // Calculate next 3rd Saturday (15th-21st of current/next month)
  const d = new Date();
  d.setDate(15);
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  // If next 3rd Saturday is already past this month, move to next month
  if (d < new Date()) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(15);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() + 1);
    }
  }

  const targetDateStr = d.toISOString().split('T')[0];
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
  }
  renderPlotlyForecastingChart(14);
}

async function renderPlotlyForecastingChart(daysCount = 14) {
  const chartContainer = document.getElementById('plotly-meat-sales-chart');
  if (!chartContainer || typeof Plotly === 'undefined') return;

  try {
    const res = await fetch('clover_api/analytics/arima_payload.json');
    if (!res.ok) throw new Error('Failed to load ARIMA payload');
    const payload = await res.json();
    
    // Slicing metrics for horizon (7 vs 14 days)
    const metrics = payload.forecast_metrics;
    const targetDateInput = document.getElementById('forecast-start-date')?.value;
    
    let idx = 0;
    if (targetDateInput) {
      const matchIdx = metrics.future_dates.findIndex(d => d.includes(targetDateInput));
      if (matchIdx !== -1) idx = matchIdx;
      else {
        const peakSatIdx = metrics.future_dates.findIndex(d => d.includes('Sat'));
        if (peakSatIdx !== -1) idx = peakSatIdx;
      }
    }
    
    const brisketElem = document.getElementById('kpi-brisket-lbs');
    const porkElem = document.getElementById('kpi-pork-lbs');
    const sausageElem = document.getElementById('kpi-sausage-links');
    const ribsElem = document.getElementById('kpi-ribs-racks');
    const staffElem = document.getElementById('kpi-staff-count');
    const hoursElem = document.getElementById('kpi-staff-hours');

    const bVal = metrics.brisket_lbs[idx] || 165;
    const pVal = metrics.pork_lbs[idx] || 85;
    const sVal = metrics.sausage_links[idx] || 148;
    const rVal = (metrics.ribs_racks && metrics.ribs_racks[idx]) ? metrics.ribs_racks[idx] : 32;

    if (brisketElem) brisketElem.textContent = bVal;
    if (porkElem) porkElem.textContent = pVal;
    if (sausageElem) sausageElem.textContent = sVal;
    if (ribsElem) ribsElem.textContent = rVal;
    
    // Case pack conversions (~30 lbs brisket/case, ~32 lbs pork/case, 50 links/case, 10 racks/case)
    const bCasesElem = document.getElementById('kpi-brisket-cases');
    const pCasesElem = document.getElementById('kpi-pork-cases');
    const sCasesElem = document.getElementById('kpi-sausage-cases');
    const rCasesElem = document.getElementById('kpi-ribs-cases');

    if (bCasesElem) bCasesElem.textContent = `(~${(bVal / 30.0).toFixed(1)} Cases)`;
    if (pCasesElem) pCasesElem.textContent = `(~${(pVal / 32.0).toFixed(1)} Cases)`;
    if (sCasesElem) sCasesElem.textContent = `(~${(sVal / 50.0).toFixed(1)} Cases)`;
    if (rCasesElem) rCasesElem.textContent = `(~${(rVal / 10.0).toFixed(1)} Cases)`;

    if (staffElem) staffElem.textContent = 3;
    if (hoursElem) hoursElem.textContent = (3 * 9.0).toFixed(1);
    
    const dIdx = (metrics.demand_index && metrics.demand_index[idx]) ? metrics.demand_index[idx] : 1.8;
    const revenueElem = document.getElementById('kpi-projected-revenue');
    if (revenueElem) revenueElem.textContent = dIdx.toFixed(1) + 'x';

    // Wood Cordage Estimation (Post Oak Logs & Face Cords)
    const woodLogsElem = document.getElementById('kpi-wood-logs');
    const woodCordsElem = document.getElementById('kpi-wood-cords');
    const splitLogs = Math.round(20 + (dIdx * 8));
    const faceCords = (splitLogs * 0.05).toFixed(1);

    if (woodLogsElem) woodLogsElem.textContent = splitLogs;
    if (woodCordsElem) woodCordsElem.textContent = `~${faceCords} Face Cords / 24-hr Active Smoke`;

    // Render Plotly chart with dynamic horizon slice
    const layout = JSON.parse(JSON.stringify(payload.plotly_baseline_chart.layout));
    layout.title = `Baseline Demand Forecasting Model (${daysCount}-Day Horizon, 1.0 = Average)`;
    
    const traces = JSON.parse(JSON.stringify(payload.plotly_baseline_chart.data));
    if (traces.length > 1 && daysCount < 14) {
      traces[1].x = traces[1].x.slice(0, daysCount);
      traces[1].y = traces[1].y.slice(0, daysCount);
    }

    Plotly.newPlot('plotly-meat-sales-chart', traces, layout, { responsive: true, displayModeBar: false });

  } catch (err) {
    console.warn('Falling back to static forecast visualization', err);
    // Fallback static chart (Original logic)
    const startDateVal = document.getElementById('forecast-start-date')?.value || new Date().toISOString().split('T')[0];
    const startDate = new Date(startDateVal);

    const dates = [];
    const brisketData = [];
    const porkData = [];
    const sausageData = [];

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
      dates.push(dayStr);

      const dow = d.getDay(); 
      const multiplier = { 0: 1.4, 1: 0.8, 2: 0.8, 3: 0.9, 4: 1.1, 5: 1.6, 6: 2.2 }[dow];
      
      let rev = 1800.0 * multiplier;
      if (dow === 6 && d.getDate() >= 15 && d.getDate() <= 21) rev *= 1.15;

      brisketData.push(Math.round((rev * 0.35) / 32.0 / 0.55));
      porkData.push(Math.round((rev * 0.25) / 24.0 / 0.50));
      sausageData.push(Math.round((rev * 0.20) / 8.0));
    }

    const traces = [
      { x: dates, y: brisketData, name: 'Raw Brisket Prep (lbs)', type: 'bar', marker: { color: '#c0392b' } },
      { x: dates, y: porkData, name: 'Pork Shoulder Prep (lbs)', type: 'bar', marker: { color: '#e67e22' } },
      { x: dates, y: sausageData, name: 'Sausage Links Needed', type: 'scatter', mode: 'lines+markers', yaxis: 'y2', line: { color: '#f1c40f', width: 3 }, marker: { size: 8 } }
    ];

    const layout = {
      title: { text: `Projected Meat & Sausage Production (Static)`, font: { color: '#f0803c', size: 16 } },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(22,27,34,0.8)',
      font: { color: '#c9d1d9', family: 'Outfit, sans-serif' },
      xaxis: { gridcolor: 'rgba(255,255,255,0.08)' },
      yaxis: { title: 'Raw Meat Weight (lbs)', gridcolor: 'rgba(255,255,255,0.08)' },
      yaxis2: { title: 'Sausage Links', overlaying: 'y', side: 'right', showgrid: false, titlefont: { color: '#f1c40f' }, tickfont: { color: '#f1c40f' } },
      legend: { orientation: 'h', y: -0.25 }, margin: { l: 50, r: 50, t: 60, b: 60 }
    };
    Plotly.newPlot('plotly-meat-sales-chart', traces, layout, { responsive: true, displayModeBar: false });
  }
}

