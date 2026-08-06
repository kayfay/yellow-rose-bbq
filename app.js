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
window.addEventListener('DOMContentLoaded', init);
