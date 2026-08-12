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

  'classic-beef': {
    id: 'classic-beef',
    name: 'Classic Texas Beef',
    icon: '🥩',
    menuSource: 'Pitmaster Original Signature',
    description: '100% Beef Sausage made with our standard 75/25 lean-to-fat ratio. Simple, bold, and traditional.',
    stuffedAddInLbs: 5.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 37.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 12.5, unit: 'lbs', desc: 'Chilled Beef Fat' },
      { id: 'pepper', label: 'Black Pepper', amount: 2.0, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 4.5, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'salt', label: 'Bulk Kosher Salt (Day 1)', amount: 454, unit: 'g', desc: 'For Overnight Cure', highlight: true, isGram: true },
      { id: 'cure', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Mix lean beef and beef fat thoroughly with Day 1 cure.",
      11: "Fold in powdered milk and ice water until sticky."
    }
  },
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

  // Macro adjustments for slider
  const handleMinus5 = (e) => { e.preventDefault(); adjustWeight(-5); };
  const handleMinus1 = (e) => { e.preventDefault(); adjustWeight(-1); };
  const handlePlus1 = (e) => { e.preventDefault(); adjustWeight(1); };
  const handlePlus5 = (e) => { e.preventDefault(); adjustWeight(5); };

  btnMinus5.addEventListener('click', handleMinus5);
  btnMinus5.addEventListener('touchstart', handleMinus5, {passive: false});
  
  btnMinus1.addEventListener('click', handleMinus1);
  btnMinus1.addEventListener('touchstart', handleMinus1, {passive: false});
  
  btnPlus1.addEventListener('click', handlePlus1);
  btnPlus1.addEventListener('touchstart', handlePlus1, {passive: false});
  
  btnPlus5.addEventListener('click', handlePlus5);
  btnPlus5.addEventListener('touchstart', handlePlus5, {passive: false});

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
  let target = parseFloat(state.weight) + amount;
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



  
  // Dynamic Verification Block updates
  const verifBaseWeight = document.getElementById('verif-base-weight');
  if (verifBaseWeight) {
    verifBaseWeight.textContent = state.weight.toFixed(1);
    
    // Switch between Beef and Standard Base in the Verification text
    if (state.recipeId === 'classic-beef') {
      document.getElementById('verif-meat-1').innerHTML = `<strong>${(37.5 * scale).toFixed(1)} lbs</strong> Lean Beef (75%)`;
      document.getElementById('verif-meat-2').innerHTML = `<strong>${(12.5 * scale).toFixed(1)} lbs</strong> Beef Fat (25%)`;
      document.getElementById('verif-meat-3').innerHTML = `<em>(No Pork)</em>`;
    } else {
      document.getElementById('verif-meat-1').innerHTML = `<strong>${(25.5 * scale).toFixed(1)} lbs</strong> Beef Trimmings`;
      document.getElementById('verif-meat-2').innerHTML = `<strong>${(16.0 * scale).toFixed(1)} lbs</strong> Pork Base`;
      document.getElementById('verif-meat-3').innerHTML = `<strong>${(8.5 * scale).toFixed(1)} lbs</strong> Pork/Beef Fat`;
    }

    document.getElementById('verif-salt').innerHTML = `<strong>${Math.round(454 * scale)} g</strong> Bulk Kosher Salt`;
    document.getElementById('verif-cure').innerHTML = `<strong>${Math.round(60 * scale)} g</strong> Pink Curing Salt`;
    document.getElementById('verif-pepper').innerHTML = `<strong>${(1.5 * scale).toFixed(1)} cups</strong> Coarse Black Pepper`;

    document.getElementById('verif-water').innerHTML = `<strong>${(10.0 * scale).toFixed(1)} cups</strong> Ice Cold Water`;
    document.getElementById('verif-milk').innerHTML = `<strong>${(4.5 * scale).toFixed(1)} cups</strong> Powdered Milk`;
    
    document.getElementById('verif-yield-base').textContent = state.weight.toFixed(1);
    document.getElementById('verif-yield-total').textContent = ((50.0 + currentRecipe.stuffedAddInLbs) * scale).toFixed(1);
    document.getElementById('verif-yield-links').textContent = Math.round(((50.0 + currentRecipe.stuffedAddInLbs) * scale) * 2.6);
  }

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
  obj.weight = parseFloat(obj.weight);
  if (isNaN(obj.weight)) obj.weight = 50.0;
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
        document.querySelector('.app-footer').style.display = 'none';
      } else {
        document.querySelector('.app-footer').style.display = 'block';
      }
    });
  });

  // Date controls & Historical Past Date Lookup
  const dateInput = document.getElementById('forecast-start-date');
  const btnCal = document.getElementById('btn-open-calendar');

  if (btnCal && dateInput) {
    btnCal.addEventListener('click', () => {
      try {
        if (typeof dateInput.showPicker === 'function') {
          dateInput.showPicker();
        } else {
          dateInput.focus();
          dateInput.click();
        }
      } catch (e) {
        dateInput.focus();
      }
    });
  }

  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    ['change', 'input'].forEach(evtType => {
      dateInput.addEventListener(evtType, () => {
        handleDateSelectionLookup(dateInput.value);
        renderPlotlyForecastingChart();
      });
    });
  }



  // Subtab switching
  const btnSubtabArima = document.getElementById('btn-subtab-arima');
  const btnSubtabWeather = document.getElementById('btn-subtab-weather');
  const btnSubtabEvent = document.getElementById('btn-subtab-event');
  
  const viewArima = document.getElementById('subtab-view-arima');
  const viewWeather = document.getElementById('subtab-view-weather');
  const viewEvent = document.getElementById('subtab-view-event');

  const btnSubtabShift = document.getElementById('btn-subtab-shift');
  const viewShift = document.getElementById('subtab-view-shift');

  if (btnSubtabArima && btnSubtabWeather && btnSubtabEvent && btnSubtabShift) {
    btnSubtabArima.addEventListener('click', () => {
      btnSubtabArima.classList.add('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      btnSubtabShift.classList.remove('active');
      if (viewArima) viewArima.style.display = 'block';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      if (viewShift) viewShift.style.display = 'none';
      renderPlotlyForecastingChart();
    });

    btnSubtabWeather.addEventListener('click', () => {
      btnSubtabWeather.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      btnSubtabShift.classList.remove('active');
      if (viewWeather) viewWeather.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      if (viewShift) viewShift.style.display = 'none';
      renderPlotlyWeatherChart();
    });

    btnSubtabEvent.addEventListener('click', () => {
      btnSubtabEvent.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabShift.classList.remove('active');
      if (viewEvent) viewEvent.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewShift) viewShift.style.display = 'none';
      renderPlotlyEventChart();
    });

    btnSubtabShift.addEventListener('click', () => {
      btnSubtabShift.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      if (viewShift) viewShift.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      const shiftSelector = document.getElementById('shift-selector');
      renderPlotlyShiftHeatmap(shiftSelector ? shiftSelector.value : 'all');
    });
  }
  
  const categorySelector = document.getElementById('category-selector');
  if (categorySelector) {
    categorySelector.addEventListener('change', () => {
      renderPlotlyForecastingChart();
    });
  }

  const shiftSelector = document.getElementById('shift-selector');
  if (shiftSelector) {
    shiftSelector.addEventListener('change', () => {
      renderPlotlyShiftHeatmap(shiftSelector.value);
    });
  }


  // Presets
  const btnThu = document.getElementById('btn-preset-thu');
  const btnSun = document.getElementById('btn-preset-sun');
  const btnWed = document.getElementById('btn-preset-wed');
  const btn14 = document.getElementById('btn-preset-14');
  const btnSat = document.getElementById('btn-preset-saturday');

  if (btnThu) btnThu.addEventListener('click', () => updateDeliveryPreset(4, 'btn-preset-thu')); // Thursday
  if (btnSun) btnSun.addEventListener('click', () => updateDeliveryPreset(0, 'btn-preset-sun')); // Sunday
  if (btnWed) btnWed.addEventListener('click', () => updateDeliveryPreset(3, 'btn-preset-wed')); // Wednesday
  if (btn14) btn14.addEventListener('click', () => updatePresetHorizon(14));
  if (btnSat) btnSat.addEventListener('click', () => updatePresetThirdSaturday());
}

function updateDeliveryPreset(targetDayNum, btnId) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  const d = new Date();
  while (d.getDay() !== targetDayNum) {
    d.setDate(d.getDate() + 1);
  }

  const targetDateStr = d.toISOString().split('T')[0];
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
  }
  renderPlotlyForecastingChart(3);
}

async function renderPlotlyEventChart() {
  const container = document.getElementById('plotly-event-impact-chart');
  if (!container || typeof Plotly === 'undefined') return;

  try {
    const res = await fetch('clover_api/analytics/event_payload.json');
    if (!res.ok) throw new Error('Failed to load event payload');
    const payload = await res.json();

    const layout = payload.plotly_event_chart.layout;
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
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
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
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

  // For 14-day delivery view, jump to upcoming Saturday peak demand
  const d = new Date();
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  const targetDateStr = d.toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
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
    const res = await fetch('clover_api/analytics/category_payload.json');
    if (!res.ok) throw new Error('Failed to load category payload');
    const payload = await res.json();
    const metrics = payload.forecast_metrics;
    
    const targetDateInput = document.getElementById('forecast-start-date')?.value || new Date().toISOString().split('T')[0];
    const targetDateObj = new Date(targetDateInput + 'T00:00:00');
    const dayOfWeekStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDayStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'short' });

    let idx = 0;
    if (metrics && metrics.future_dates) {
      const matchIdx = metrics.future_dates.findIndex(d => d.includes(targetDateInput));
      if (matchIdx !== -1) {
        idx = matchIdx;
      } else {
        const weekdayIdx = metrics.future_dates.findIndex(d => d.includes(`(${shortDayStr})`));
        if (weekdayIdx !== -1) idx = weekdayIdx;
      }
    }
    
    const getCatVal = (catName) => {
        if (metrics.categories && metrics.categories[catName] && metrics.categories[catName].forecast) {
            return metrics.categories[catName].forecast[idx];
        }
        return 0;
    };

    const bVal = Math.round(getCatVal('brisket_lbs') || 165);
    const pVal = Math.round(getCatVal('pork_lbs') || getCatVal('pulled_pork_lbs') || 85);
    const sVal = Math.round(getCatVal('sausage_links') || 148);
    const rVal = Math.round(getCatVal('pork_ribs_racks') || getCatVal('ribs_racks') || 32);
    const drVal = Math.round(getCatVal('beef_dino_ribs') || 10);
    const tVal = Math.round(getCatVal('turkey_lbs') || 25);
    const rbVal = Math.round(getCatVal('rosebuds') || 30);
    const tacoVal = Math.round(getCatVal('tacos') || 45);

    const brisketElem = document.getElementById('kpi-brisket-lbs');
    const porkElem = document.getElementById('kpi-pork-lbs');
    const sausageElem = document.getElementById('kpi-sausage-links');
    const ribsElem = document.getElementById('kpi-pork-ribs-racks');
    const dinoElem = document.getElementById('kpi-beef-dino-ribs');
    const turkeyElem = document.getElementById('kpi-turkey-lbs');
    const rosebudsElem = document.getElementById('kpi-rosebuds');
    const tacosElem = document.getElementById('kpi-tacos');

    if (brisketElem) brisketElem.textContent = bVal;
    if (porkElem) porkElem.textContent = pVal;
    if (sausageElem) sausageElem.textContent = sVal;
    if (ribsElem) ribsElem.textContent = rVal;
    if (dinoElem) dinoElem.textContent = drVal;
    if (turkeyElem) turkeyElem.textContent = tVal;
    if (rosebudsElem) rosebudsElem.textContent = rbVal;
    if (tacosElem) tacosElem.textContent = tacoVal;
    
    const bCasesElem = document.getElementById('kpi-brisket-cases');
    const pCasesElem = document.getElementById('kpi-pork-cases');
    const sCasesElem = document.getElementById('kpi-sausage-cases');
    const rCasesElem = document.getElementById('kpi-pork-ribs-cases');
    const drCasesElem = document.getElementById('kpi-beef-dino-ribs-cases');

    if (bCasesElem) bCasesElem.textContent = `(~${(bVal / 30.0).toFixed(1)} Cases / ~${Math.ceil(bVal / 15.0)} Packers)`;
    if (pCasesElem) pCasesElem.textContent = `(~${(pVal / 32.0).toFixed(1)} Cases / ~${Math.ceil(pVal / 8.0)} Butts)`;
    if (sCasesElem) sCasesElem.textContent = `(Made from Brisket/Rib Trim)`;
    if (rCasesElem) rCasesElem.textContent = `(~${(rVal / 10.0).toFixed(1)} Cases / ~${Math.ceil(rVal / 2.0)} Bags)`;
    if (drCasesElem) drCasesElem.textContent = `(~${(drVal / 12.0).toFixed(1)} Cases)`;

    const dIdx = (metrics.demand_index && metrics.demand_index[idx]) ? metrics.demand_index[idx] : 1.0;
    const pctDiff = Math.round((dIdx - 1.0) * 100);
    const pctDisplay = pctDiff > 0 ? `+${pctDiff}%` : (pctDiff < 0 ? `${pctDiff}%` : `Baseline`);

    const revenueElem = document.getElementById('kpi-projected-revenue');
    const demandLabelElem = document.getElementById('kpi-demand-label');
    if (revenueElem) revenueElem.textContent = pctDisplay;
    if (demandLabelElem) demandLabelElem.textContent = `Projected ${dayOfWeekStr} Demand (vs. Baseline)`;

    const layout = JSON.parse(JSON.stringify(payload.plotly_baseline_chart.layout));
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
    layout.title = `Forecasted Output (${daysCount}-Day Horizon)`;
    
    const traces = JSON.parse(JSON.stringify(payload.plotly_baseline_chart.data));
    
    // Check if category selector is in use
    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : null;

    if (selectedCat && metrics.categories && metrics.categories[selectedCat]) {
        // Replace trace 1 (Demand Index) with Category Forecast
        const catForecast = metrics.categories[selectedCat].forecast;
        traces[1].y = catForecast;
        traces[1].name = `14-Day Forecast (${selectedCat})`;
        layout.yaxis.title = `Amount (${selectedCat.includes('lbs') ? 'lbs' : 'units'})`;
        layout.yaxis.tickformat = ".0f";
        
        // Hide historical demand index trace because it's a completely different scale
        traces[0].visible = false;
    }

    if (traces.length > 1 && daysCount < 14) {
      traces[1].x = traces[1].x.slice(0, daysCount);
      traces[1].y = traces[1].y.slice(0, daysCount);
    }

    Plotly.newPlot('plotly-meat-sales-chart', traces, layout, { responsive: true, displayModeBar: false });

  } catch (err) {
    console.warn('Falling back to static forecast visualization', err);
  }
}

function handleDateSelectionLookup(selectedDateStr) {
  const d = new Date(selectedDateStr + 'T00:00:00');
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' });



  const histCard = document.getElementById('historical-reference-card');
  if (!histCard) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastOrToday = selectedDateStr <= todayStr;

  if (isPastOrToday) {
    histCard.style.display = 'block';
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

async function renderPlotlyShiftHeatmap(shift = 'all') {
  const container = document.getElementById('plotly-shift-heatmap');
  if (!container || typeof Plotly === 'undefined') return;

  try {
    const res = await fetch('clover_api/analytics/shift_payload.json');
    if (!res.ok) throw new Error('Failed to load shift payload');
    const payload = await res.json();

    const layout = payload.plotly_heatmap.layout;
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
    const traces = payload.plotly_heatmap.data;
    if(traces && traces.length > 0) {
      traces[0].colorscale = 'YlOrBr';
    }
    
    // Zoom into hours based on shift
    if (shift === 'prep') {
        layout.xaxis.range = [3.5, 13.5]; // 4 AM to 1 PM
    } else if (shift === 'lunch') {
        layout.xaxis.range = [9.5, 16.5]; // 10 AM to 4 PM
    } else if (shift === 'dinner') {
        layout.xaxis.range = [15.5, 22.5]; // 4 PM to 10 PM
    } else if (shift === 'custom') {
        // Boss custom shift question
        layout.xaxis.range = [0, 23];
    } else {
        layout.xaxis.autorange = true;
    }

    Plotly.newPlot('plotly-shift-heatmap', traces, layout, { responsive: true, displayModeBar: false });
  } catch (err) {
    console.warn('Could not load shift heatmap payload', err);
  }
}
