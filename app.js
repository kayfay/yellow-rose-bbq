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
const urlParams = new URLSearchParams(window.location.search);
const sessionName = urlParams.get('session') || 'default-run';

// Recipe Formulations Data Definition (50 lb Batch Ratios)
const RECIPES = {

  'classic-beef': {
    id: 'classic-beef',
    name: 'Classic Texas Beef',
    icon: '',
    menuSource: 'Pitmaster Original Signature',
    description: '100% Beef Sausage made with our standard 75/25 lean-to-fat ratio. Simple, bold, and traditional.',
    stuffedAddInLbs: 5.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 37.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 12.5, unit: 'lbs', desc: 'Chilled Beef Fat' },
      { id: 'pepper', label: 'Black Pepper', amount: 2.0, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Thoroughly strain all brine juice out of the pickled/spiced jalapeños, then medium-dice.",
      9: "Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.",
      11: "Incorporate the remaining ice water, high-temp cheddar cheese cubes, and the completely dry jalapeño dice."
    }
  },
  'mild-sausage': {
    id: 'mild-sausage',
    name: 'Mild Sausage',
    icon: '',
    menuSource: 'Pitmaster Original Signature',
    description: 'Classic Texas smoked sausage. Same great flavor as the Jalapeño Cheddar, but without the heat and cheese.',
    stuffedAddInLbs: 0.0,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.5, unit: 'cups', desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.",
      9: "Mix lean meat, pork, and fat with Day 1 cure.",
      11: "Incorporate the remaining ice water until the mixture binds properly."
    }
  },
  'elote': {
    id: 'elote',
    name: 'The Elote (Street Corn)',
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups (Salsa adds liquid)' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups' },
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
    icon: '',
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
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups (Birria adds liquid)' },
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

// Initialize App
function init() {
  window.scrollTo(0, 0);

  // Render recipe pills
  renderRecipePills();

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
  // Quick batch size presets
  const quickBatchBtns = document.querySelectorAll('.quick-batch-btn');
  quickBatchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const bWeight = parseFloat(btn.getAttribute('data-batch'));
      if (!isNaN(bWeight)) {
        state.weight = bWeight;
        state.lastUpdated = Date.now();
        weightSlider.value = bWeight;
        
        quickBatchBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        updateUI();
        saveState();
      }
    });
  });

  // Load state from local storage first (instant responsiveness)
  loadLocalState();
  updateUI();
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

  // Update quick batch buttons active state
  document.querySelectorAll('.quick-batch-btn').forEach(btn => {
    const bWeight = parseFloat(btn.getAttribute('data-batch'));
    if (Math.abs(bWeight - state.weight) < 0.1) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
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
    let displayUnit = ing.unit;
    let rawAmount = ing.amount * scale;

    if (ing.isGram) {
      displayVal = Math.round(rawAmount);
    } else {
      if (ing.unit === 'lbs' && rawAmount < 1.0 && rawAmount > 0) {
        displayVal = (rawAmount * 16).toFixed(1);
        displayUnit = 'oz';
      } else if (ing.unit === 'cups' && rawAmount < 1.0 && rawAmount > 0) {
        displayVal = (rawAmount * 16).toFixed(1);
        displayUnit = 'tbsp';
      } else {
        displayVal = rawAmount.toFixed(2);
      }
    }

    card.innerHTML = `
      <span class="ing-label">${ing.label}</span>
      <div class="ing-value-box">
        <span class="ing-value">${displayVal}</span>
        <span class="ing-unit">${displayUnit}</span>
      </div>
      <span class="ing-desc">${ing.desc}</span>
    `;
    ingredientsGrid.appendChild(card);
  });

  // Link Estimations
  // Total Stuffed Weight = (50 lbs base meat block + add-ins) * scale
  const totalStuffed = (50.0 + currentRecipe.stuffedAddInLbs) * scale;
  estStuffedWeight.textContent = totalStuffed.toFixed(1);
  
  // Total Links: Stuffed Weight * 3.0 (~1/3 lb per link)
  const totalLinks = totalStuffed * 3.0;
  const roundedLinks = Math.round(totalLinks);
  estLinksExpected.textContent = roundedLinks;



  
  // Dynamic Verification Block updates
  const verifBaseWeight = document.getElementById('verif-base-weight');
  if (verifBaseWeight) {
    verifBaseWeight.textContent = state.weight.toFixed(1);
    
    const formatMeat = (lbs) => {
      if (lbs < 1.0 && lbs > 0) return `${(lbs * 16).toFixed(1)} oz`;
      return `${lbs.toFixed(1)} lbs`;
    };

    // Switch between Beef and Standard Base in the Verification text
    if (state.recipeId === 'classic-beef') {
      document.getElementById('verif-meat-1').innerHTML = `<strong>${formatMeat(37.5 * scale)}</strong> Lean Beef (75%)`;
      document.getElementById('verif-meat-2').innerHTML = `<strong>${formatMeat(12.5 * scale)}</strong> Beef Fat (25%)`;
      document.getElementById('verif-meat-3').innerHTML = `<em>(No Pork)</em>`;
    } else {
      document.getElementById('verif-meat-1').innerHTML = `<strong>${formatMeat(25.5 * scale)}</strong> Beef Trimmings`;
      document.getElementById('verif-meat-2').innerHTML = `<strong>${formatMeat(16.0 * scale)}</strong> Pork Base`;
      document.getElementById('verif-meat-3').innerHTML = `<strong>${formatMeat(8.5 * scale)}</strong> Pork/Beef Fat`;
    }

    const getIngAmount = (id) => {
        const ing = currentRecipe.ingredients.find(i => i.id === id || (id === 'curing-salt' && i.id === 'cure'));
        return ing ? ing.amount * scale : 0;
    };

    const cureAmt = getIngAmount('curing-salt');
    const pepperAmt = getIngAmount('pepper');
    const waterAmt = getIngAmount('water');
    const milkAmt = getIngAmount('milk');

    const formatVerif = (amt, unit) => {
      if (unit === 'cups' && amt < 1.0 && amt > 0) return `${(amt * 16).toFixed(1)} tbsp`;
      return `${amt.toFixed(1)} ${unit}`;
    };

    document.getElementById('verif-cure').innerHTML = cureAmt > 0 ? `<strong>${Math.round(cureAmt)} g</strong> Pink Curing Salt` : `<em>(No Curing Salt)</em>`;
    document.getElementById('verif-pepper').innerHTML = pepperAmt > 0 ? `<strong>${formatVerif(pepperAmt, 'cups')}</strong> Coarse Black Pepper` : `<em>(No Black Pepper)</em>`;
    document.getElementById('verif-water').innerHTML = waterAmt > 0 ? `<strong>${formatVerif(waterAmt, 'cups')}</strong> Ice Cold Water` : `<em>(No Water)</em>`;
    document.getElementById('verif-milk').innerHTML = milkAmt > 0 ? `<strong>${formatVerif(milkAmt, 'cups')}</strong> Powdered Milk` : `<em>(No Milk)</em>`;
    
    document.getElementById('verif-yield-base').textContent = state.weight.toFixed(1);
    document.getElementById('verif-yield-total').textContent = ((50.0 + currentRecipe.stuffedAddInLbs) * scale).toFixed(1);
    document.getElementById('verif-yield-links').textContent = Math.round(((50.0 + currentRecipe.stuffedAddInLbs) * scale) / 0.375);
  }

  // Update Task Checkbox states
  const taskRows = document.querySelectorAll('.task-row');
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

function saveState() {
  localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
}

// Run init
window.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);
  init();
  initMultiTabNavigation();
  initEventsCalendar();
  // Pre-render forecasting data so it's instantly available
  renderPlotlyForecastingChart(14);
});

// Multi-Tab & POS Analytics Forecasting Module Integration
function initMultiTabNavigation() {
  const tabBtns = document.querySelectorAll('.app-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab) return;

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
        window.scrollTo(0, 0);
      }

      if (targetTab === 'forecasting-analytics') {
        renderPlotlyForecastingChart();
        renderPlotlyEventChart();
        renderPlotlyWeatherChart();
        renderPlotlyShiftHeatmap();
        document.body.classList.add('hide-footer');
        const footer = document.querySelector('.app-footer');
        if (footer) footer.style.display = 'none';
      } else {
        document.body.classList.remove('hide-footer');
        const footer = document.querySelector('.app-footer');
        if (footer) footer.style.display = 'block';
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
      refreshEventsCalendar();
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
      let currentDays = 14;
      const activeBtn = document.querySelector('.forecast-preset-group .preset-btn.active');
      if (activeBtn) {
        if (activeBtn.id === 'btn-preset-sat-order' || activeBtn.id === 'btn-preset-thu-order') {
          currentDays = 2;
        } else if (activeBtn.id === 'btn-preset-mon-order') {
          currentDays = 3;
        }
      }
      renderPlotlyForecastingChart(currentDays);
    });
  }
  
  let lastRefreshTime = 0;
  const btnRefreshAnalytics = document.getElementById('btn-refresh-analytics');
  if (btnRefreshAnalytics) {
    // Set initial time
    const timeElem = document.getElementById('last-updated-time');
    if (timeElem) timeElem.textContent = new Date().toLocaleTimeString();

    btnRefreshAnalytics.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastRefreshTime < 10000) {
        // Rate limit: 10 seconds
        const origText = btnRefreshAnalytics.innerHTML;
        btnRefreshAnalytics.innerHTML = '<span class="btn-text">Please wait...</span>';
        setTimeout(() => { btnRefreshAnalytics.innerHTML = origText; }, 2000);
        return;
      }
      lastRefreshTime = now;
      
      const origText = btnRefreshAnalytics.innerHTML;
      btnRefreshAnalytics.innerHTML = '<span class="btn-icon">↻</span><span class="btn-text">Refreshing...</span>';
      
      let currentDays = 14;
      const activeBtn = document.querySelector('.forecast-preset-group .preset-btn.active');
      if (activeBtn) {
        if (activeBtn.id === 'btn-preset-sat-order' || activeBtn.id === 'btn-preset-thu-order') {
          currentDays = 2;
        } else if (activeBtn.id === 'btn-preset-mon-order') {
          currentDays = 3;
        }
      }
      
      // Trigger all renders
      renderPlotlyForecastingChart(currentDays).then(() => {
        if (timeElem) timeElem.textContent = new Date().toLocaleTimeString();
        btnRefreshAnalytics.innerHTML = origText;
      });
      renderPlotlyEventChart();
      renderPlotlyWeatherChart();
    });
  }

  const shiftSelector = document.getElementById('shift-selector');
  if (shiftSelector) {
    shiftSelector.addEventListener('change', () => {
      renderPlotlyShiftHeatmap(shiftSelector.value);
    });
  }


  // Presets
  const btnSatOrder = document.getElementById('btn-preset-sat-order');
  const btnMonOrder = document.getElementById('btn-preset-mon-order');
  const btnThuOrder = document.getElementById('btn-preset-thu-order');
  const btn14 = document.getElementById('btn-preset-14');
  const btnSat = document.getElementById('btn-preset-saturday');

  if (btnSatOrder) btnSatOrder.addEventListener('click', () => updateDeliveryPreset(0, 'btn-preset-sat-order', 2)); // Delivered Sunday (covers Sun, Mon)
  if (btnMonOrder) btnMonOrder.addEventListener('click', () => updateDeliveryPreset(2, 'btn-preset-mon-order', 3)); // Delivered Tuesday (covers Tue, Wed, Thu)
  if (btnThuOrder) btnThuOrder.addEventListener('click', () => updateDeliveryPreset(5, 'btn-preset-thu-order', 2)); // Delivered Friday (covers Fri, Sat)
  if (btn14) btn14.addEventListener('click', () => updatePresetHorizon(14));
  if (btnSat) btnSat.addEventListener('click', () => updatePresetThirdSaturday());
}

function updateDeliveryPreset(targetDayNum, btnId, windowDays = 3) {
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
  renderPlotlyForecastingChart(windowDays);
}

function renderPlotlyNoData(containerId) {
  if (typeof d3 === 'undefined') return;
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '<div style="color: #64748b; padding: 40px; text-align: center;">No Data Available</div>';
}

async function renderPlotlyEventChart() {
  const container = document.getElementById('plotly-event-impact-chart');
  if (!container || typeof d3 === 'undefined') return;

  const defaultEventTraces = [{
    x: ["Normal Day", "State/Federal Holiday", "Jaguars Game Day"],
    y: [1.0, 0.9, 3.5],
    type: "bar",
    marker: { color: ["#7f8c8d", "#e67e22", "#006778"], opacity: 0.9 },
    text: ["1.0x", "0.9x", "3.5x"],
    textposition: "auto"
  }];

  const defaultEventLayout = {
    title: "Demand Surge Multipliers: Local Events vs. Normal Operations",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(20,20,30,0.6)",
    font: { color: "#f8fafc", family: "Inter, system-ui, sans-serif", size: 11 },
    xaxis: { gridcolor: "rgba(255,255,255,0.1)" },
    yaxis: { title: "Demand Multiplier (vs. Normal Day)", gridcolor: "rgba(255,255,255,0.1)" },
    margin: { l: 60, r: 50, t: 50, b: 50 }
  };

  try {
    let payload = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.event_payload) {
      payload = window.BBQ_PAYLOADS.event_payload;
    } else {
      const res = await fetch('clover_api/analytics/event_payload.json');
      if (res.ok) payload = await res.json();
    }
    if (payload) {
      const layout = payload.plotly_event_chart.layout;
      layout.plot_bgcolor = 'rgba(0,0,0,0)';
      layout.paper_bgcolor = 'rgba(0,0,0,0)';
      layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
      if (layout.xaxis) { layout.xaxis.gridcolor = '#334155'; layout.xaxis.zerolinecolor = '#334155'; layout.xaxis.color = '#94a3b8'; }
      if (layout.yaxis) { layout.yaxis.gridcolor = '#334155'; layout.yaxis.zerolinecolor = '#334155'; layout.yaxis.color = '#94a3b8'; }
      const traces = payload.plotly_event_chart.data;
      if (typeof d3 !== 'undefined') {
        renderD3GenericChart('plotly-event-impact-chart', traces, layout.title);
      }
      return;
    }
  } catch (err) {
    console.log('Using embedded event chart dataset');
  }

  if (typeof d3 !== 'undefined') {
    renderD3GenericChart('plotly-event-impact-chart', defaultEventTraces, defaultEventLayout.title);
  }
  refreshEventsCalendar();
}

// Live Events & Multiplier Calendar State Management
let currentCalYear = 2026;
let currentCalMonth = 7; // August (0-indexed)
let currentCalFilter = 'all';
let selectedCalDate = '2026-08-22';
let calInitialized = false;

function refreshEventsCalendar() {
  if (typeof renderMonthEventsCalendar === 'function') {
    renderMonthEventsCalendar(
      'live-events-calendar-grid',
      currentCalYear,
      currentCalMonth,
      currentCalFilter,
      (dateStr, evt) => {
        selectedCalDate = dateStr;
        showCalendarDateDrawer(dateStr, evt);
      },
      selectedCalDate
    );
  }
}

function showCalendarDateDrawer(dateStr, evt) {
  const drawer = document.getElementById('calendar-selected-drawer');
  if (!drawer) return;
  drawer.style.display = 'flex';

  const dateObj = new Date(dateStr + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const dateSpan = document.getElementById('drawer-date-str');
  const badgeSpan = document.getElementById('drawer-mult-badge');
  const titleP = document.getElementById('drawer-event-title');
  const noteP = document.getElementById('drawer-event-note');

  if (dateSpan) dateSpan.textContent = formattedDate;
  if (badgeSpan) badgeSpan.textContent = `${evt.multiplier || 1.0}x Demand Multiplier`;
  if (titleP) titleP.textContent = `${evt.icon || '🔥'} ${evt.title}`;
  if (noteP) noteP.textContent = evt.note || "Standard operational pace.";

  const applyBtn = document.getElementById('drawer-apply-btn');
  if (applyBtn) {
    applyBtn.onclick = () => {
      const dateInput = document.getElementById('forecast-start-date');
      if (dateInput) {
        dateInput.value = dateStr;
      }
      handleDateSelectionLookup(dateStr);
      renderPlotlyForecastingChart(14);

      // Scroll to KPI targets smoothly
      const targetCard = document.querySelector('.forecasting-kpi-grid');
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
  }
}

function initEventsCalendar() {
  if (calInitialized) return;
  calInitialized = true;

  const btnPrev = document.getElementById('cal-btn-prev');
  const btnNext = document.getElementById('cal-btn-next');
  const btnToday = document.getElementById('cal-btn-today');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      currentCalMonth--;
      if (currentCalMonth < 0) {
        currentCalMonth = 11;
        currentCalYear--;
      }
      refreshEventsCalendar();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentCalMonth++;
      if (currentCalMonth > 11) {
        currentCalMonth = 0;
        currentCalYear++;
      }
      refreshEventsCalendar();
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const now = new Date();
      currentCalYear = now.getFullYear();
      currentCalMonth = now.getMonth();
      refreshEventsCalendar();
    });
  }

  const filterBtns = document.querySelectorAll('.cal-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCalFilter = btn.getAttribute('data-filter') || 'all';
      refreshEventsCalendar();
    });
  });

  refreshEventsCalendar();
}

async function renderPlotlyWeatherChart() {
  const container = document.getElementById('plotly-weather-impact-chart');
  if (!container || typeof d3 === 'undefined') return;

  const defaultWeatherTraces = [
    {
      x: ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"],
      y: [86, 88, 91, 89, 87, 85, 88],
      name: "Max Temp (°F)",
      type: "scatter",
      mode: "lines+markers",
      line: { color: "#e67e22", width: 3 }
    },
    {
      x: ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"],
      y: [0, 12.5, 0, 4.2, 0, 0, 8.0],
      name: "Precipitation (mm)",
      type: "bar",
      yaxis: "y2",
      marker: { color: "#3498db" }
    }
  ];

  const defaultWeatherLayout = {
    title: "Weather Exogenous Factors (Temperature & Precipitation)",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(20,20,30,0.6)",
    font: { color: "#f8fafc", family: "Inter, system-ui, sans-serif", size: 11 },
    xaxis: { gridcolor: "rgba(255,255,255,0.1)", tickangle: 45 },
    yaxis: { title: "Temperature (°F)", gridcolor: "rgba(255,255,255,0.1)" },
    yaxis2: { title: "Precipitation (mm)", overlaying: "y", side: "right", showgrid: false, titlefont: { color: "#3498db" }, tickfont: { color: "#3498db" } },
    legend: { orientation: "h", y: -0.25, x: 0 },
    margin: { l: 60, r: 60, t: 50, b: 80 }
  };

  try {
    let payload = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.weather_payload) {
      payload = window.BBQ_PAYLOADS.weather_payload;
    } else {
      const res = await fetch('clover_api/analytics/weather_payload.json');
      if (res.ok) payload = await res.json();
    }
    if (payload) {
      const layout = payload.plotly_weather_chart.layout;
      layout.plot_bgcolor = 'rgba(0,0,0,0)';
      layout.paper_bgcolor = 'rgba(0,0,0,0)';
      layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
      if (layout.xaxis) { layout.xaxis.gridcolor = '#334155'; layout.xaxis.zerolinecolor = '#334155'; layout.xaxis.color = '#94a3b8'; }
      if (layout.yaxis) { layout.yaxis.gridcolor = '#334155'; layout.yaxis.zerolinecolor = '#334155'; layout.yaxis.color = '#94a3b8'; }
      const traces = payload.plotly_weather_chart.data;
      if (typeof d3 !== 'undefined') {
        renderD3GenericChart('plotly-weather-impact-chart', traces, layout.title);
      }
      return;
    }
  } catch (err) {
    console.log('Using embedded weather chart dataset');
  }

  if (typeof d3 !== 'undefined') {
    renderD3GenericChart('plotly-weather-impact-chart', defaultWeatherTraces, defaultWeatherLayout.title);
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
  try {
    const chartContainer = document.getElementById('plotly-meat-sales-chart');
    
    const targetDateInput = document.getElementById('forecast-start-date')?.value || new Date().toISOString().split('T')[0];
    const targetDateObj = new Date(targetDateInput + 'T00:00:00');
    const dayOfWeekStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDayStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'short' });

    // Embedded default 14-day forecast data to ensure zero downtime or offline/CORS issues
    const defaultForecastRecords = [
      { date: "2026-08-14", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0 },
      { date: "2026-08-15", day_name: "Sat", predicted_revenue: 4554.0, brisket_raw_lbs: 128.9, pork_shoulder_raw_lbs: 75.9, sausage_lbs: 85, tacos_sold: 113, rosebuds_sold: 45, pork_ribs_racks: 7, beef_dino_ribs: 6, recommended_staff: 5, pitmaster_hours: 42.5 },
      { date: "2026-08-16", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0 },
      { date: "2026-08-17", day_name: "Mon", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0 },
      { date: "2026-08-18", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0 },
      { date: "2026-08-19", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5 },
      { date: "2026-08-20", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5 },
      { date: "2026-08-21", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0 },
      { date: "2026-08-22", day_name: "Sat", predicted_revenue: 3960.0, brisket_raw_lbs: 112.2, pork_shoulder_raw_lbs: 66.0, sausage_lbs: 74, tacos_sold: 99, rosebuds_sold: 39, pork_ribs_racks: 6, beef_dino_ribs: 5, recommended_staff: 5, pitmaster_hours: 42.5 },
      { date: "2026-08-23", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0 },
      { date: "2026-08-24", day_name: "Mon", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0 },
      { date: "2026-08-25", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0 },
      { date: "2026-08-26", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5 },
      { date: "2026-08-27", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5 }
    ];

    let dashPayload = null;
    try {
      if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.dashboard_payload) {
        dashPayload = window.BBQ_PAYLOADS.dashboard_payload;
      } else {
        const dashRes = await fetch('clover_api/analytics/dashboard_payload.json');
        if (dashRes.ok) dashPayload = await dashRes.json();
      }
    } catch (e) {
      console.log("Using embedded dashboard dataset fallback:", e);
    }

    let histPayload = null;
    try {
      const histRes = await fetch('clover_api/analytics/historical_payload.json');
      if (histRes.ok) histPayload = await histRes.json();
    } catch (e) {
      console.log("No historical payload found.");
    }

    let records = (dashPayload && dashPayload.forecast && dashPayload.forecast.forecast_records) 
      ? dashPayload.forecast.forecast_records 
      : defaultForecastRecords;
      
      if (histPayload && histPayload.historical_records) {
      // Sort and merge historical records with forecast records
      records = [...histPayload.historical_records, ...records];
      records.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Remove duplicates by date if any overlap exists
      records = Array.from(new Map(records.map(item => [item.date, item])).values());
    }

    // Match the active selected date
    let matchedRecord = records.find(r => r.date === targetDateInput);
    if (!matchedRecord) {
      matchedRecord = records.find(r => r.day_name === shortDayStr) || records[0];
    }

    const startIndex = records.findIndex(r => r.date === targetDateInput);
    const validStartIndex = startIndex >= 0 ? startIndex : 0;
    const slicedRecords = records.slice(validStartIndex, validStartIndex + daysCount);

    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : 'baseline';

    const bRaw = matchedRecord.brisket_raw_lbs || 0;
    const bCooked = Math.round(bRaw * 0.4);
    const pRaw = matchedRecord.pork_shoulder_raw_lbs || 0;
    const pCooked = Math.round(pRaw * 0.4);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    let insightStr = '';
    if (matchedRecord.is_historical) {
      insightStr = `Historical Record for ${matchedRecord.day_name} (${matchedRecord.date}): The pit moved ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Actual verified line items sold included ${matchedRecord.tacos_sold} Tacos and ${matchedRecord.rosebuds_sold} Rosebuds, driving $${matchedRecord.actual_revenue.toLocaleString()} in gross revenue.`;
    } else {
      insightStr = `The forecast for ${matchedRecord.day_name} (${matchedRecord.date}) dictates prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Because brisket and pork lose ~60% of their weight during the long smoke, and composed items like Tacos (${matchedRecord.tacos_sold} projected) and Rosebuds (${matchedRecord.rosebuds_sold} projected) pull directly from this yield, prepping these exact amounts mathematically ensures we hit our target sell-out time right at 9:00 PM closing.`;
    }
    
    if (matchedRecord.day_name === 'Mon') {
      insightStr += ` Note: The physical storefront is closed on Mondays, so any projected revenue and prep targets are driven entirely by scheduled online orders and catering pickups.`;
    }
    
    if (selectedCat !== 'baseline' && catSelector) {
      const selectedText = catSelector.options[catSelector.selectedIndex].text;
      insightStr = `Isolated Analysis: The forecast model dictates carefully tracking "${selectedText}" volumes independently to isolate its specific peak demand windows. Ensure procurement aligns with these exact projections to minimize waste and optimize pit capacity.`;
    }

    const insightSpan = document.getElementById('dynamic-insight-string');
    if (insightSpan) {
      insightSpan.textContent = insightStr;
    }

    // Populate Key Meat & Revenue Targets with Exact Model Projections for the selected day
    const bVal = Math.round(matchedRecord.brisket_raw_lbs || 0);
    const pVal = Math.round(matchedRecord.pork_shoulder_raw_lbs || 0);
    const sVal = Math.round(matchedRecord.sausage_lbs || 0);
    const rVal = Math.round(matchedRecord.pork_ribs_racks || 0);
    const drVal = Math.round(matchedRecord.beef_dino_ribs || 0);
    const tVal = Math.round((matchedRecord.predicted_revenue || 2000) * 0.008 + 10);
    const rbVal = Math.round(matchedRecord.rosebuds_sold || 0);
    const tacoVal = Math.round(matchedRecord.tacos_sold || 0);
    const predRev = Math.round(matchedRecord.predicted_revenue || 0);


    const brisketElem = document.getElementById('kpi-brisket-lbs');
    const porkElem = document.getElementById('kpi-pork-lbs');
    const sausageElem = document.getElementById('kpi-sausage-batches');
    const ribsElem = document.getElementById('kpi-pork-ribs-racks');
    const dinoElem = document.getElementById('kpi-beef-dino-ribs');
    const turkeyElem = document.getElementById('kpi-turkey-lbs');
    const rosebudsElem = document.getElementById('kpi-rosebuds');
    const tacosElem = document.getElementById('kpi-tacos');

    if (brisketElem) brisketElem.textContent = bVal;
    if (porkElem) porkElem.textContent = pVal;
    
    // Sausage: sVal is in lbs. 1 Batch yields ~60 lbs stuffed weight. 3 links = 1 lb.
    const sausageBatches = Math.ceil(sVal / 60.0);
    const sausageLinks = sVal * 3;
    if (sausageElem) sausageElem.textContent = sausageBatches;
    const sausageLinksSub = document.getElementById('kpi-sausage-links-sub');
    if (sausageLinksSub) sausageLinksSub.textContent = `(${sausageLinks} links / ${sVal} lbs)`;
    
    if (ribsElem) ribsElem.textContent = rVal;
    if (dinoElem) dinoElem.textContent = drVal;
    if (turkeyElem) turkeyElem.textContent = tVal;
    if (rosebudsElem) rosebudsElem.textContent = rbVal;
    if (tacosElem) tacosElem.textContent = tacoVal;

    const bCasesElem = document.getElementById('kpi-brisket-cases');
    const pCasesElem = document.getElementById('kpi-pork-cases');
    const bCookedElem = document.getElementById('kpi-brisket-cooked');
    const pCookedElem = document.getElementById('kpi-pork-cooked');
    const rCasesElem = document.getElementById('kpi-pork-ribs-cases');
    const drCasesElem = document.getElementById('kpi-beef-dino-ribs-cases');

    if (bCasesElem) bCasesElem.textContent = `(~${(bVal / 70.0).toFixed(1)} Cases / ~${Math.ceil(bVal / 14.0)} Packers)`;
    if (pCasesElem) pCasesElem.textContent = `(~${(pVal / 32.0).toFixed(1)} Cases / ~${Math.ceil(pVal / 8.0)} Butts)`;
    if (bCookedElem) bCookedElem.textContent = `(~ ${Math.round(bVal * 0.4)} lbs cooked)`;
    if (pCookedElem) pCookedElem.textContent = `(~ ${Math.round(pVal * 0.4)} lbs cooked)`;
    if (rCasesElem) rCasesElem.textContent = `(~${(rVal / 6.0).toFixed(1)} Cases / ~${Math.ceil(rVal / 2.0)} Bags)`;
    if (drCasesElem) drCasesElem.textContent = `(~${(drVal / 12.0).toFixed(1)} Cases)`;

    const baselineRev = Math.round(records.reduce((acc, curr) => acc + curr.predicted_revenue, 0) / records.length);
    const avgBrisketRaw = Math.round(records.reduce((acc, curr) => acc + (curr.brisket_raw_lbs || 0), 0) / records.length);
    const avgBrisketCooked = Math.round(avgBrisketRaw * 0.4);
    const avgPorkRaw = Math.round(records.reduce((acc, curr) => acc + (curr.pork_shoulder_raw_lbs || 0), 0) / records.length);
    const avgPorkCooked = Math.round(avgPorkRaw * 0.4);

    const weekdays = records.filter(r => ['Tue', 'Wed', 'Thu'].includes(r.day_name));
    const weekends = records.filter(r => ['Fri', 'Sat', 'Sun'].includes(r.day_name));
    const weekdayAvgRev = weekdays.length ? Math.round(weekdays.reduce((acc, curr) => acc + curr.predicted_revenue, 0) / weekdays.length) : 1600;
    const weekendAvgRev = weekends.length ? Math.round(weekends.reduce((acc, curr) => acc + curr.predicted_revenue, 0) / weekends.length) : 3300;

    const incrementalRev = predRev - baselineRev;
    const pctDiff = Math.round((incrementalRev / baselineRev) * 100);
    const sign = pctDiff > 0 ? '+' : '';
    const pctDisplay = `${sign}${pctDiff}% (Total: $${predRev.toLocaleString()})`;

    // Update dynamic baseline trend card
    const baselineTrendElem = document.getElementById('dynamic-baseline-trend');
    if (baselineTrendElem) {
      let comparisonNote = '';
      const revLabel = matchedRecord.is_historical ? 'actual' : 'projected';
      if (pctDiff > 0) {
        comparisonNote = `For your selected date (<strong>${matchedRecord.day_name}, ${matchedRecord.date}</strong>), ${revLabel} revenue of <strong>$${predRev.toLocaleString()}</strong> is <strong>${pctDiff}% above</strong> the daily average baseline (+$${Math.round(incrementalRev).toLocaleString()} incremental demand).`;
      } else if (pctDiff < 0) {
        comparisonNote = `For your selected date (<strong>${matchedRecord.day_name}, ${matchedRecord.date}</strong>), ${revLabel} revenue of <strong>$${predRev.toLocaleString()}</strong> is <strong>${Math.abs(pctDiff)}% below</strong> the daily average baseline (-$${Math.abs(Math.round(incrementalRev)).toLocaleString()}), typical for mid-week operations.`;
      } else {
        comparisonNote = `For your selected date (<strong>${matchedRecord.day_name}, ${matchedRecord.date}</strong>), ${revLabel} revenue of <strong>$${predRev.toLocaleString()}</strong> directly matches the 14-day daily baseline average.`;
      }

      baselineTrendElem.innerHTML = `Our model establishes a 14-day rolling average baseline of <strong>$${baselineRev.toLocaleString()}/day</strong> (~${avgBrisketRaw} lbs raw / ~${avgBrisketCooked} lbs cooked brisket; ~${avgPorkRaw} lbs raw / ~${avgPorkCooked} lbs cooked pork). Normal weekdays (Tue–Thu) baseline at <strong>~$${weekdayAvgRev.toLocaleString()}/day</strong>, while peak weekend runs (Fri–Sun) baseline at <strong>~$${weekendAvgRev.toLocaleString()}/day</strong>. ${comparisonNote}`;
    }

    const revenueElem = document.getElementById('kpi-projected-revenue');
    const demandLabelElem = document.getElementById('kpi-demand-label');
    if (revenueElem) revenueElem.textContent = pctDisplay;
    if (demandLabelElem) {
      const surgeLabel = matchedRecord.is_historical ? 'Actual Sales' : 'Projected Sales';
      if (pctDiff > 0) {
        demandLabelElem.textContent = `${surgeLabel} Surge of +${pctDiff}% (+$${Math.round(incrementalRev).toLocaleString()}) above the $${baselineRev.toLocaleString()}/day average baseline pace.`;
      } else if (pctDiff < 0) {
        demandLabelElem.textContent = `${surgeLabel} Drop of -${Math.abs(pctDiff)}% (-$${Math.abs(Math.round(incrementalRev)).toLocaleString()}) below the $${baselineRev.toLocaleString()}/day average baseline pace.`;
      } else {
        demandLabelElem.textContent = `${surgeLabel} right on pace with the $${baselineRev.toLocaleString()}/day average baseline.`;
      }
    }


    const dates = slicedRecords.map(r => `${r.date} (${r.day_name})`);
    const brisketData = slicedRecords.map(r => r.brisket_raw_lbs || 0);
    const porkData = slicedRecords.map(r => r.pork_shoulder_raw_lbs || 0);
    const sausageData = slicedRecords.map(r => r.sausage_lbs || 0);
    const tacosData = slicedRecords.map(r => r.tacos_sold || 0);
    const rosebudsData = slicedRecords.map(r => r.rosebuds_sold || 0);
    const porkRibsData = slicedRecords.map(r => r.pork_ribs_racks || 0);
    const beefRibsData = slicedRecords.map(r => r.beef_dino_ribs || 0);

    if (!chartContainer || typeof d3 === 'undefined') return;

    // (catSelector already handled above)

    // Use our custom D3 charting implementation
    renderD3ForecastingChart('plotly-meat-sales-chart', slicedRecords, dashPayload ? dashPayload.anomalies : [], selectedCat);
  } catch (error) {
    console.error("Dashboard Rendering Error: ", error);
    const chartContainer = document.getElementById('plotly-meat-sales-chart');
    if (chartContainer) {
      chartContainer.innerHTML = `<div style="color:red; background:white; padding:20px; border:2px solid red;">
        <h3>FATAL ERROR IN RENDER</h3>
        <pre style="white-space:pre-wrap;">${error.stack || error.message || String(error)}</pre>
      </div>`;
    }
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

async function renderPlotlyShiftHeatmap(shift) {
  const container = document.getElementById('plotly-shift-heatmap');
  if (!container || typeof d3 === 'undefined') return;

  if (!shift) {
    const shiftSelector = document.getElementById('shift-selector');
    shift = shiftSelector ? shiftSelector.value : 'all';
  }

  const hours = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const defaultZ = days.map((d, dIdx) => {
    return hours.map((_, h) => {
      if (h < 10 || h > 21) return 0;
      if (d === "Saturday") return h === 12 || h === 18 ? 4.5 : (h >= 11 && h <= 20 ? 3.0 : 1.0);
      if (d === "Friday") return h === 12 || h === 18 ? 3.5 : (h >= 11 && h <= 20 ? 2.5 : 0.8);
      if (d === "Sunday") return h >= 11 && h <= 15 ? 2.8 : 0.5;
      if (d === "Monday") return 0; // closed
      return h >= 11 && h <= 14 ? 1.8 : (h >= 17 && h <= 20 ? 1.4 : 0.4);
    });
  });

  const defaultShiftLayout = {
    title: "Historical & Predicted Hourly Sales Demand Heatmap",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(20,20,30,0.6)",
    font: { color: "#f8fafc", family: "Inter, system-ui, sans-serif", size: 10 },
    xaxis: { title: "Time of Day (24-Hour Pit Operating Window)", gridcolor: "#334155", color: "#94a3b8" },
    yaxis: { gridcolor: "#334155", color: "#94a3b8" },
    margin: { l: 80, r: 40, t: 50, b: 50 }
  };

  try {
    let payload = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.shift_payload) {
      payload = window.BBQ_PAYLOADS.shift_payload;
    } else {
      const res = await fetch('clover_api/analytics/shift_payload.json');
      if (res.ok) payload = await res.json();
    }
    if (payload) {
      const layout = payload.plotly_heatmap.layout;
      layout.plot_bgcolor = 'rgba(0,0,0,0)';
      layout.paper_bgcolor = 'rgba(0,0,0,0)';
      layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
      if (layout.xaxis) { layout.xaxis.gridcolor = '#334155'; layout.xaxis.zerolinecolor = '#334155'; layout.xaxis.color = '#94a3b8'; }
      if (layout.yaxis) { layout.yaxis.gridcolor = '#334155'; layout.yaxis.zerolinecolor = '#334155'; layout.yaxis.color = '#94a3b8'; }
      const traces = payload.plotly_heatmap.data;
      if(traces && traces.length > 0) {
        traces[0].colorscale = 'YlOrBr';
      }
      
      if (typeof d3 !== 'undefined') {
        renderD3GenericChart('plotly-shift-heatmap', traces, layout.title, true, shift);
      }
      return;
    }
  } catch (err) {
    console.log('Using embedded shift heatmap dataset');
  }

  const defaultShiftTraces = [{
    x: hours,
    y: days,
    z: defaultZ,
    type: "heatmap",
    colorscale: "YlOrBr",
    colorbar: { title: "Relative Rush Density" }
  }];

  if (typeof d3 !== 'undefined') {
    renderD3GenericChart('plotly-shift-heatmap', defaultShiftTraces, defaultShiftLayout.title, true, shift);
  }
}
