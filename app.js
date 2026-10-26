function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function getPlotlyConfig(extra = {}) {
  const mobile = isMobileViewport();
  return {
    responsive: true,
    displayModeBar: false,
    staticPlot: mobile,
    scrollZoom: false,
    doubleClick: false,
    ...extra
  };
}

function applyChartTouchSafety(containerOrId) {
  const el = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  if (!el) return;
  const mobile = isMobileViewport();
  el.style.touchAction = 'pan-y';
  if (mobile) {
    el.style.pointerEvents = 'none';
    el.setAttribute('data-mobile-static', 'true');
    el.querySelectorAll('svg, .plot-container, .svg-container, .js-plotly-plot').forEach(node => {
      node.style.pointerEvents = 'none';
      node.style.touchAction = 'pan-y';
    });
  } else {
    el.style.pointerEvents = 'auto';
    el.setAttribute('data-mobile-static', 'false');
    el.querySelectorAll('svg, .plot-container, .svg-container, .js-plotly-plot').forEach(node => {
      node.style.pointerEvents = '';
      node.style.touchAction = 'pan-y';
    });
  }
}

function parseValidDate(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(trimmed + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function getActiveDaysCount() {
  const start = document.getElementById('forecast-start-date')?.value;
  const end = document.getElementById('forecast-end-date')?.value;
  if (start && end) {
    const dStart = parseValidDate(start);
    const dEnd = parseValidDate(end);
    if (dStart && dEnd) {
      const diffTime = dEnd.getTime() - dStart.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    }
  }
  return 1;
}

// State management
let state = {
  recipeId: 'jalapeno-cheddar',
  weight: 50.0,
  tasks: Array(15).fill(false), // 15 tasks (1-indexed mapping to 0-14 array indices)
  beefWeight: 50.0,
  beefRatio: 0.70,
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
    description: '100% Beef Sausage made with our standard 70/30 lean-to-fat ratio. Simple, bold, and traditional.',
    stuffedAddInLbs: 5.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 35.0, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 15.0, unit: 'lbs', desc: 'Chilled Beef Fat' },
      { id: 'pepper', label: 'Black Pepper', amount: 2.0, unit: 'cups', gramEq: 181.4, desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Mix lean beef and beef fat thoroughly with Day 1 cure.",
      9: "Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.",
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
      { id: 'jalapenos', label: 'Diced Jalapeños', amount: 8.0, unit: 'cups', desc: 'Fully Drained & Diced' },
      { id: 'cheddar', label: 'Cheddar Cheese', amount: 5.0, unit: 'lbs', desc: 'High-Temp Cubes' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.5, unit: 'cups', gramEq: 136.1, desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
    stuffedAddInLbs: 5.5,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork Trimmings' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Chilled Pork/Beef Fat' },
      { id: 'pepper', label: 'Black Pepper', amount: 1.5, unit: 'cups', gramEq: 136.1, desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
      { id: 'pepper', label: 'Black Pepper', amount: 1.0, unit: 'cups', gramEq: 90.7, desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups for before and after curing (Salsa adds liquid)' },
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
      { id: 'bbq-rub', label: 'Signature BBQ Rub', amount: 1.5, unit: 'cups', gramEq: 340.2, desc: 'Seasoning Station' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
      { id: 'bbq-rub', label: 'Signature BBQ Rub', amount: 1.5, unit: 'cups', gramEq: 340.2, desc: 'Seasoning Station' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
      { id: 'pepper', label: 'Black Pepper', amount: 1.0, unit: 'cups', gramEq: 90.7, desc: 'Coarse Grind' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Binder Agent' },
      { id: 'water', label: 'Ice Cold Water', amount: 10.0, unit: 'cups', desc: 'Split 2x 5.0 cups for before and after curing' },
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
      { id: 'water', label: 'Ice Cold Water', amount: 8.0, unit: 'cups', desc: 'Split 2x 4.0 cups for before and after curing (Birria adds liquid)' },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Cure #1 (Overnight)', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Chop shredded birria meat fine and chill; ensure reduced birria consommé is cold before mixing.",
      9: "Whisk the chilled birria consommé into the first half of ice water with Powdered Milk, garlic, and diced onions.",
      11: "Incorporate the remaining ice water, birria meat, and melty cheese cubes evenly."
    }
  },
  'mexican-chorizo': {
    id: 'mexican-chorizo',
    name: 'Mexican Chorizo',
    icon: '',
    menuSource: 'Custom Formulations',
    description: 'Authentic Mexican Chorizo with dried chiles, robust spices, and a touch of lavender.',
    stuffedAddInLbs: 10.0,
    ingredients: [
      { id: 'lean-meat', label: 'Lean Beef Base', amount: 25.5, unit: 'lbs', desc: 'Beef Trimmings' },
      { id: 'trimmings', label: 'Pork Base', amount: 16.0, unit: 'lbs', desc: 'Pork & Pork Fat' },
      { id: 'hard-fat', label: 'Hard Fat', amount: 8.5, unit: 'lbs', desc: 'Hard Beef Fat' },
      { id: 'ancho-powder', label: 'Ancho Chile Powder', amount: 4.75, unit: 'cups', gramEq: 567, desc: '' },
      { id: 'guajillo-powder', label: 'Guajillo Chile Powder', amount: 2.375, unit: 'cups', gramEq: 283.5, desc: '' },
      { id: 'salt', label: 'Kosher Salt', amount: 1.875, unit: 'cups', gramEq: 408.2, desc: "Morton's" },
      { id: 'paprika', label: 'Smoked Paprika', amount: 2.0, unit: 'cups', gramEq: 226.8, desc: '' },
      { id: 'garlic', label: 'Granulated Garlic', amount: 1.125, unit: 'cups', gramEq: 181.4, desc: '' },
      { id: 'oregano', label: 'Mexican Oregano', amount: 1.625, unit: 'cups', gramEq: 90.7, desc: 'Rubbed' },
      { id: 'cumin', label: 'Ground Cumin', amount: 0.9375, unit: 'cups', gramEq: 79.4, desc: '' },
      { id: 'pepper', label: 'Black Pepper', amount: 0.875, unit: 'cups', gramEq: 79.4, desc: '16-Mesh Coarse' },
      { id: 'lavender', label: 'Dried Lavender', amount: 1.0, unit: 'cups', gramEq: 68.0, desc: 'Whole' },
      { id: 'coriander', label: 'Whole Coriander', amount: 0.5625, unit: 'cups', gramEq: 45.4, desc: 'Whole Seeds' },
      { id: 'cayenne', label: 'Cayenne Pepper', amount: 0.3125, unit: 'cups', gramEq: 34.0, desc: '' },
      { id: 'cinnamon', label: 'Ceylon Cinnamon', amount: 0.125, unit: 'cups', gramEq: 11.3, desc: 'Ground Canela' },
      { id: 'cloves', label: 'Ground Cloves', amount: 0.125, unit: 'cups', gramEq: 11.3, desc: '' },
      { id: 'vinegar', label: 'Apple Cider Vinegar', amount: 2.5, unit: 'cups', desc: 'Acidic Binder' },
      { id: 'milk', label: 'Powdered Milk', amount: 3.0, unit: 'cups', desc: 'Non-Fat Dry Milk Powder' },
      { id: 'water', label: 'Ice Cold Water', amount: 6.0, unit: 'cups', desc: 'Split 2x 3.0 cups for before and after curing (Vinegar adds liquid)' },
      { id: 'curing-salt', label: 'Pink Curing Salt (Day 1)', amount: 60, unit: 'g', desc: 'Prague Powder #1', highlight: true, isGram: true }
    ],
    customSteps: {
      8: "Whisk the first half of prepped ice water with the Apple Cider Vinegar and spices to form a slurry.",
      9: "Mix the Day 1 slurry into the meat block and cure overnight.",
      11: "Whisk Non-Fat Dry Milk Powder into the remaining ice water (Day 2) and incorporate into the emulsion."
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

function formatCups(rawCups) {
  if (rawCups === 0) return { val: '0', unit: 'cups' };
  
  let cups = Math.floor(rawCups);
  let remainderCups = rawCups - cups;
  
  let totalTbsp = remainderCups * 16;
  let tbsp = Math.floor(totalTbsp);
  let remainderTbsp = totalTbsp - tbsp;
  
  let tsp = Math.round(remainderTbsp * 3);
  
  if (tsp >= 3) {
    tbsp += Math.floor(tsp / 3);
    tsp = tsp % 3;
  }
  if (tbsp >= 16) {
    cups += Math.floor(tbsp / 16);
    tbsp = tbsp % 16;
  }

  let parts = [];
  if (cups > 0) parts.push(`${cups} cup${cups > 1 ? 's' : ''}`);
  if (tbsp > 0) parts.push(`${tbsp} tbsp`);
  if (tsp > 0) parts.push(`${tsp} tsp`);
  
  let resultStr = parts.join(' + ');
  if (resultStr === '') resultStr = '0';
  
  return { val: resultStr, unit: '' };
}

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
        let oz = rawAmount * 16;
        if (Math.abs(Math.round(oz) - oz) < 0.01) {
            displayVal = Math.round(oz);
        } else {
            displayVal = oz.toFixed(1);
        }
        displayUnit = 'oz';
      } else if (ing.unit === 'cups' && rawAmount > 0) {
        let formatted = formatCups(rawAmount);
        displayVal = formatted.val;
        displayUnit = formatted.unit;
      } else {
        displayVal = rawAmount.toFixed(2);
      }
    }

    let dynamicDesc = ing.desc;
    if (ing.id === 'water' && rawAmount > 0) {
      const halfRaw = rawAmount / 2;
      dynamicDesc = ing.desc.replace(/Split 2x [0-9.]+ cups/, `Split 2x ${halfRaw.toFixed(1)} cups`);
    }

    if (ing.gramEq) {
      if (dynamicDesc) {
        dynamicDesc += ` — ${Math.round(ing.gramEq * scale)}g`;
      } else {
        dynamicDesc = `${Math.round(ing.gramEq * scale)}g`;
      }
    }

    card.innerHTML = `
      <span class="ing-label">${ing.label}</span>
      <div class="ing-value-box">
        <span class="ing-value">${displayVal}</span>
        <span class="ing-unit">${displayUnit}</span>
      </div>
      <span class="ing-desc">${dynamicDesc}</span>
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

    const setHTML = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Switch between Beef and Standard Base in the Verification text
    if (state.recipeId === 'classic-beef') {
      setHTML('verif-meat-1', `<strong>${formatMeat(35.0 * scale)}</strong> Lean Beef (70%)`);
      setHTML('verif-meat-2', `<strong>${formatMeat(15.0 * scale)}</strong> Beef Fat (30%)`);
      setHTML('verif-meat-3', `<em>(No Pork)</em>`);
    } else {
      setHTML('verif-meat-1', `<strong>${formatMeat(25.5 * scale)}</strong> Beef Trimmings`);
      setHTML('verif-meat-2', `<strong>${formatMeat(16.0 * scale)}</strong> Pork Base`);
      setHTML('verif-meat-3', `<strong>${formatMeat(8.5 * scale)}</strong> Pork/Beef Fat`);
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

    const pepperIng = currentRecipe.ingredients.find(i => i.id === 'pepper');
    const rubIng = currentRecipe.ingredients.find(i => i.id === 'bbq-rub');
    let spiceVerifHtml = '<em>(No Black Pepper)</em>';
    if (pepperAmt > 0) {
      const gStr = pepperIng && pepperIng.gramEq ? ` (${Math.round(pepperIng.gramEq * scale)} g)` : '';
      spiceVerifHtml = `<strong>${formatVerif(pepperAmt, 'cups')}${gStr}</strong> Coarse Black Pepper`;
    } else if (rubIng) {
      const rubAmt = rubIng.amount * scale;
      const gStr = rubIng.gramEq ? ` (${Math.round(rubIng.gramEq * scale)} g)` : '';
      spiceVerifHtml = `<strong>${formatVerif(rubAmt, 'cups')}${gStr}</strong> Signature BBQ Rub`;
    }

    setHTML('verif-cure', cureAmt > 0 ? `<strong>${Math.round(cureAmt)} g</strong> Pink Curing Salt` : `<em>(No Curing Salt)</em>`);
    setHTML('verif-pepper', spiceVerifHtml);
    setHTML('verif-water', waterAmt > 0 ? `<strong>${formatVerif(waterAmt, 'cups')}</strong> Ice Cold Water` : `<em>(No Water)</em>`);
    setHTML('verif-milk', milkAmt > 0 ? `<strong>${formatVerif(milkAmt, 'cups')}</strong> Powdered Milk` : `<em>(No Milk)</em>`);
    
    setText('verif-yield-base', state.weight.toFixed(1));
    setText('verif-yield-total', ((50.0 + currentRecipe.stuffedAddInLbs) * scale).toFixed(1));
    setText('verif-yield-links', Math.round(((50.0 + currentRecipe.stuffedAddInLbs) * scale) * 3.0));
  }

  // Hydrate recipe-specific customSteps (Steps 8, 9, 11) in the Day 2 checklist
  const defaultStepTexts = {
    8: "Strain brine from diced jalapeños; whisk first half of ice water with powdered milk and black pepper.",
    9: "Mix lean beef, pork base, and chilled fat with Day 1 pink curing salt.",
    11: "Fold in remaining ice water, high-temp cheddar cubes, and drained jalapeño dice until tacky."
  };
  [8, 9, 11].forEach(stepNum => {
    const stepDescEl = document.querySelector(`.task-row[data-step="${stepNum}"] .task-content p`);
    if (stepDescEl) {
      stepDescEl.textContent = (currentRecipe.customSteps && currentRecipe.customSteps[stepNum]) || defaultStepTexts[stepNum];
    }
  });

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
      alert(`Live session link copied to clipboard!Share this with anyone to let them track progress.`);
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
  if (obj.beefRatio === undefined) obj.beefRatio = 0.70;
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
  initForecastingControls();
  initEventsCalendar();
  initDesignDebugPanel();
  // Pre-render forecasting data so it's instantly available
  renderPlotlyForecastingChart(getActiveDaysCount());
});

let _lastViewportIsMobile = isMobileViewport();
let _resizeDebounceTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    const nowMobile = isMobileViewport();
    [
      'plotly-meat-sales-chart',
      'plotly-predictive-velocity-chart',
      'plotly-weather-impact-chart',
      'plotly-event-impact-chart',
      'plotly-sellout-chart',
      'plotly-shift-heatmap'
    ].forEach(applyChartTouchSafety);

    if (nowMobile !== _lastViewportIsMobile) {
      _lastViewportIsMobile = nowMobile;
      renderPlotlyForecastingChart(getActiveDaysCount());
      renderPlotlyPredictiveChart();
      renderPlotlyEventChart();
      renderPlotlyWeatherChart();
      renderPlotlyShiftHeatmap();
    }
  }, 150);
});

function switchMainTab(targetTab) {
  if (!targetTab) return;
  const tabBtns = document.querySelectorAll('.app-tab-btn, .mobile-bottom-nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(b => {
    const isMatch = b.getAttribute('data-tab') === targetTab;
    b.classList.toggle('active', isMatch);
    b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
  });

  tabPanes.forEach(pane => {
    pane.classList.remove('active');
    pane.style.display = 'none';
  });

  const activePane = document.getElementById(`tab-${targetTab}`);
  if (activePane) {
    activePane.style.display = 'block';
    activePane.classList.add('active');
    window.scrollTo(0, 0);
  }

  if (targetTab === 'forecasting-analytics') {
    renderPlotlyForecastingChart(getActiveDaysCount());
    if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    renderPlotlyEventChart();
    renderPlotlyWeatherChart();
    renderPlotlyShiftHeatmap();
    [
      'plotly-meat-sales-chart',
      'plotly-predictive-velocity-chart',
      'plotly-weather-impact-chart',
      'plotly-event-impact-chart',
      'plotly-sellout-chart',
      'plotly-shift-heatmap'
    ].forEach(applyChartTouchSafety);
    document.body.classList.add('hide-footer');
    const footer = document.querySelector('.app-footer');
    if (footer) footer.style.display = 'none';
  } else {
    document.body.classList.remove('hide-footer');
    const footer = document.querySelector('.app-footer');
    if (footer) footer.style.display = 'block';
  }
}

// Multi-Tab & POS Analytics Forecasting Module Integration
function initMultiTabNavigation() {
  const tabBtns = document.querySelectorAll('.app-tab-btn, .mobile-bottom-nav-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchMainTab(targetTab);
    });
  });
}

function initDesignDebugPanel() {
  const toggleBtn = document.getElementById('btn-toggle-debug-drawer');
  const drawer = document.getElementById('design-debug-drawer');
  const vpBtns = document.querySelectorAll('.debug-vp-btn');
  const themeBtn = document.getElementById('btn-debug-contrast');
  const copyBtn = document.getElementById('btn-copy-debug-tokens');
  const statusEl = document.getElementById('debug-token-status');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = drawer.hasAttribute('hidden');
      if (isHidden) {
        drawer.removeAttribute('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        drawer.setAttribute('hidden', '');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  let activePreviewWidth = 'fluid';
  vpBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      vpBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = btn.getAttribute('data-vp') || 'fluid';
      activePreviewWidth = w;
      const appShell = document.querySelector('.app-content');
      if (appShell) {
        if (w === 'fluid') {
          appShell.style.maxWidth = '';
          document.body.removeAttribute('data-preview-vp');
        } else {
          appShell.style.maxWidth = `${w}px`;
          document.body.setAttribute('data-preview-vp', w);
        }
      }
      if (statusEl) statusEl.textContent = `Viewport preset: ${w === 'fluid' ? '100% Fluid' : w + 'px'}`;
    });
  });

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isHighContrast = document.body.classList.toggle('pit-high-contrast');
      themeBtn.textContent = isHighContrast ? 'Contrast: Pit Daylight (High)' : 'Contrast: Smokehouse Dark';
      if (statusEl) statusEl.textContent = isHighContrast ? 'High-Contrast Pit Daylight active' : 'Smokehouse Dark active';
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const styles = getComputedStyle(document.documentElement);
      const tokenPayload = {
        version: '2.0.0',
        activeViewportPreset: activePreviewWidth,
        windowInnerWidth: window.innerWidth,
        mobileTouchSafeCharts: isMobileViewport(),
        contrastMode: document.body.classList.contains('pit-high-contrast') ? 'pit-high-contrast' : 'smokehouse-dark',
        breakpoints: { mobileMax: 767, tabletMin: 768, desktopMin: 1280 },
        tokens: {
          bgColor: styles.getPropertyValue('--bg-color').trim() || '#0f0e0e',
          surfaceColor: styles.getPropertyValue('--surface-color').trim() || '#1c1a17',
          accentGold: styles.getPropertyValue('--accent-primary').trim() || '#e69d00',
          accentEmber: styles.getPropertyValue('--accent-secondary').trim() || '#d84315',
          touchTargetMinPx: 48
        }
      };
      const jsonStr = JSON.stringify(tokenPayload, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(() => {
          if (statusEl) statusEl.textContent = 'Copied v2.0.0 JSON tokens to clipboard';
        }).catch(() => {
          if (statusEl) statusEl.textContent = 'Tokens serialized (clipboard unavailable)';
        });
      } else if (statusEl) {
        statusEl.textContent = 'Tokens serialized';
      }
      window.__LAST_COPIED_DESIGN_TOKENS__ = tokenPayload;
    });
  }
}

function initForecastingControls() {
  const dateInput = document.getElementById('forecast-start-date');
  const endDateInput = document.getElementById('forecast-end-date');
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

  // Set default timezone-aware today string in shop operating timezone
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  const today = (window.ShopTime && typeof window.ShopTime.shopDateStr === 'function')
    ? window.ShopTime.shopDateStr()
    : (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];

  if (dateInput && !dateInput.value) {
    dateInput.value = today;
  }
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = today;
  }

  if (dateInput) {
    dateInput.addEventListener('click', function() { if (this.showPicker) this.showPicker(); });
    dateInput.addEventListener('change', (e) => {
      document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
      const startVal = e.target.value;
      if (endDateInput && (!endDateInput.value || endDateInput.value < startVal)) {
        endDateInput.value = startVal;
      }
      handleDateSelectionLookup(startVal);
      renderPlotlyForecastingChart(getActiveDaysCount());
      renderPlotlyPredictiveChart();
    });
  }

  if (endDateInput) {
    endDateInput.addEventListener('click', function() { if (this.showPicker) this.showPicker(); });
    endDateInput.addEventListener('change', (e) => {
      document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
      const endVal = e.target.value;
      if (dateInput && dateInput.value && endVal < dateInput.value) {
        endDateInput.value = dateInput.value;
      }
      renderPlotlyForecastingChart(getActiveDaysCount());
      renderPlotlyPredictiveChart();
    });
  }

  // Subtab switching
  const btnSubtabPredictive = document.getElementById('btn-subtab-predictive');
  const btnSubtabArima = document.getElementById('btn-subtab-arima');
  const btnSubtabWeather = document.getElementById('btn-subtab-weather');
  const btnSubtabEvent = document.getElementById('btn-subtab-event');
  const btnSubtabShift = document.getElementById('btn-subtab-shift');
  const btnSubtabAdvanced = document.getElementById('btn-subtab-advanced');

  const viewPredictive = document.getElementById('subtab-view-predictive');
  const viewArima = document.getElementById('subtab-view-arima');
  const viewWeather = document.getElementById('subtab-view-weather');
  const viewEvent = document.getElementById('subtab-view-event');
  const viewShift = document.getElementById('subtab-view-shift');
  const viewAdvanced = document.getElementById('subtab-view-advanced');

  const allSubtabBtns = [btnSubtabPredictive, btnSubtabArima, btnSubtabWeather, btnSubtabEvent, btnSubtabShift, btnSubtabAdvanced].filter(Boolean);
  const allSubtabViews = [viewPredictive, viewArima, viewWeather, viewEvent, viewShift, viewAdvanced].filter(Boolean);

  function activateSubtab(btn, view) {
    allSubtabBtns.forEach(b => b.classList.remove('active'));
    allSubtabViews.forEach(v => v.style.display = 'none');
    if (btn) btn.classList.add('active');
    if (view) view.style.display = 'block';
  }

  if (btnSubtabPredictive) {
    btnSubtabPredictive.addEventListener('click', () => {
      activateSubtab(btnSubtabPredictive, viewPredictive);
      renderPlotlyPredictiveChart();
    });
  }

  if (btnSubtabArima) {
    btnSubtabArima.addEventListener('click', () => {
      activateSubtab(btnSubtabArima, viewArima);
      renderPlotlyForecastingChart(getActiveDaysCount());
    });
  }

  if (btnSubtabWeather) {
    btnSubtabWeather.addEventListener('click', () => {
      activateSubtab(btnSubtabWeather, viewWeather);
      renderPlotlyWeatherChart();
    });
  }

  if (btnSubtabEvent) {
    btnSubtabEvent.addEventListener('click', () => {
      activateSubtab(btnSubtabEvent, viewEvent);
      renderPlotlyEventChart();
      if (typeof refreshEventsCalendar === 'function') refreshEventsCalendar();
    });
  }

  if (btnSubtabShift) {
    btnSubtabShift.addEventListener('click', () => {
      activateSubtab(btnSubtabShift, viewShift);
      const shiftSelector = document.getElementById('shift-selector');
      renderPlotlyShiftHeatmap(shiftSelector ? shiftSelector.value : 'all');
    });
  }

  if (btnSubtabAdvanced) {
    btnSubtabAdvanced.addEventListener('click', () => {
      activateSubtab(btnSubtabAdvanced, viewAdvanced);
      if (typeof renderAdvancedAnalytics === 'function') renderAdvancedAnalytics();
    });
  }

  const categorySelector = document.getElementById('category-selector');
  if (categorySelector) {
    categorySelector.addEventListener('change', () => {
      renderPlotlyForecastingChart(getActiveDaysCount());
    });
  }

  const shiftSelector = document.getElementById('shift-selector');
  if (shiftSelector) {
    shiftSelector.addEventListener('change', () => {
      renderPlotlyShiftHeatmap(shiftSelector.value);
    });
  }

  function updateSyncStatusTime() {
    const timeElem = document.getElementById('last-updated-time');
    if (!timeElem) return;

    const getPayloadTime = () => {
      if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.dashboard_payload && window.BBQ_PAYLOADS.dashboard_payload.forecast && window.BBQ_PAYLOADS.dashboard_payload.forecast.generated_at) {
        const d = new Date(window.BBQ_PAYLOADS.dashboard_payload.forecast.generated_at);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    const setTimeText = (syncDate) => {
      const payloadDate = getPayloadTime();
      let bestDate = syncDate;
      if (!bestDate || (payloadDate && payloadDate > bestDate)) {
        bestDate = payloadDate;
      }
      if (bestDate && !isNaN(bestDate.getTime())) {
        timeElem.textContent = bestDate.toLocaleString();
      } else {
        timeElem.textContent = new Date().toLocaleTimeString();
      }
    };
    
    if (typeof fetch !== 'function') {
      setTimeText(null);
      return;
    }
    
    fetch('clover_api/analytics/sync_status.json?v=' + Date.now())
      .catch(() => fetch('analytics/sync_status.json?v=' + Date.now()))
      .then(res => res.json())
      .then(data => {
        const syncDate = (data && data.last_synced_at) ? new Date(data.last_synced_at) : null;
        setTimeText(syncDate);
      })
      .catch(() => {
        setTimeText(null);
      });
  }

  const btnRefreshAnalytics = document.getElementById('btn-refresh-analytics');
  if (btnRefreshAnalytics) {
    updateSyncStatusTime();

    let lastRefreshTime = 0;
    btnRefreshAnalytics.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastRefreshTime < 5000) {
        return;
      }
      lastRefreshTime = now;
      const origText = btnRefreshAnalytics.innerHTML;
      btnRefreshAnalytics.innerHTML = '<span class="btn-icon">↻</span><span class="btn-text">Refreshing...</span>';
      
      renderPlotlyForecastingChart(getActiveDaysCount()).then(() => {
        updateSyncStatusTime();
        btnRefreshAnalytics.innerHTML = origText;
      });
      renderPlotlyEventChart();
      renderPlotlyWeatherChart();
    });
  }

  // Operational Horizon Presets
  const btnYesterday = document.getElementById('btn-preset-yesterday');
  const btnToday = document.getElementById('btn-preset-today');
  const btnTomorrow = document.getElementById('btn-preset-tomorrow');
  const btnWeekend = document.getElementById('btn-preset-weekend');
  const btnThursday = document.getElementById('btn-preset-thursday');
  const btnFriday = document.getElementById('btn-preset-friday');
  const btnSaturday = document.getElementById('btn-preset-saturday');
  const btnSunday = document.getElementById('btn-preset-sunday');
  const btn7 = document.getElementById('btn-preset-7');
  const btn14 = document.getElementById('btn-preset-14');

  if (btnYesterday) btnYesterday.addEventListener('click', () => updatePresetHorizon('btn-preset-yesterday', 1, -1));
  if (btnToday) btnToday.addEventListener('click', () => updatePresetHorizon('btn-preset-today', 1, 0));
  if (btnTomorrow) btnTomorrow.addEventListener('click', () => updatePresetHorizon('btn-preset-tomorrow', 1, 1));
  if (btnWeekend) btnWeekend.addEventListener('click', () => updatePresetWeekend());
  if (btnThursday) btnThursday.addEventListener('click', () => updatePresetDay(4, 'btn-preset-thursday'));
  if (btnFriday) btnFriday.addEventListener('click', () => updatePresetDay(5, 'btn-preset-friday'));
  if (btnSaturday) btnSaturday.addEventListener('click', () => updatePresetDay(6, 'btn-preset-saturday'));
  if (btnSunday) btnSunday.addEventListener('click', () => updatePresetDay(0, 'btn-preset-sunday'));
  if (btn7) btn7.addEventListener('click', () => updatePresetHorizon('btn-preset-7', 7, 0));
  if (btn14) btn14.addEventListener('click', () => updatePresetHorizon('btn-preset-14', 14, 0));

  setupTimeTravelControls();
}

function updatePresetHorizon(btnId, days, startOffset = 0) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  const d = new Date();
  if (startOffset !== 0) {
    d.setDate(d.getDate() + startOffset);
  }
  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
  }

  const endD = new Date(d);
  endD.setDate(endD.getDate() + days - 1);
  const endTargetDateStr = (new Date(endD.getTime() - tzOffset)).toISOString().split('T')[0];
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = endTargetDateStr;
  }

  renderPlotlyForecastingChart(days);
  renderPlotlyPredictiveChart();
}

function updatePresetWeekend() {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-preset-weekend');
  if (btn) btn.classList.add('active');

  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  let daysUntilFriday = (5 - day + 7) % 7;
  if (day === 5) daysUntilFriday = 0;
  else if (day === 6) daysUntilFriday = -1;
  else if (day === 0) daysUntilFriday = -2;

  const friDate = new Date();
  friDate.setDate(friDate.getDate() + daysUntilFriday);
  const sunDate = new Date(friDate);
  sunDate.setDate(friDate.getDate() + 2);

  const tzOffset = d.getTimezoneOffset() * 60000;
  const friStr = (new Date(friDate.getTime() - tzOffset)).toISOString().split('T')[0];
  const sunStr = (new Date(sunDate.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = friStr;
    handleDateSelectionLookup(friStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = sunStr;
  }

  renderPlotlyForecastingChart(3);
  renderPlotlyPredictiveChart();
}

function updatePresetDay(targetDayOfWeek, btnId) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  const d = new Date();
  const currentDay = d.getDay();
  let daysAhead = (targetDayOfWeek - currentDay + 7) % 7;
  if (daysAhead === 0) daysAhead = 0;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(targetDate.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = targetDateStr;
  }

  renderPlotlyForecastingChart(1);
  renderPlotlyPredictiveChart();
}

function updatePresetThirdSaturday() {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-preset-saturday');
  if (btn) btn.classList.add('active');

  const d = new Date();
  d.setDate(15);
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  if (d < new Date()) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(15);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() + 1);
    }
  }

  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    handleDateSelectionLookup(targetDateStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = targetDateStr;
  }
  renderPlotlyForecastingChart(1);
  renderPlotlyPredictiveChart();
}



async function renderPlotlyForecastingChart(daysCount = 14) {
  try {
    const chartContainer = document.getElementById('plotly-meat-sales-chart');
    
    const rawStartDate = document.getElementById('forecast-start-date')?.value;
    const parsedStartDate = parseValidDate(rawStartDate);
    const dNow = new Date();
    const tzOffset = dNow.getTimezoneOffset() * 60000;
    const todayStr = (new Date(dNow.getTime() - tzOffset)).toISOString().split('T')[0];
    
    const targetDateInput = parsedStartDate ? rawStartDate.trim() : todayStr;
    const targetDateObj = parseValidDate(targetDateInput) || new Date();
    const dayOfWeekStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDayStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'short' });

    daysCount = Math.max(1, parseInt(daysCount) || 1);

    // Embedded default 14-day forecast data to ensure zero downtime or offline/CORS issues
    const defaultForecastRecords = [
      { date: "2026-08-14", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-15", day_name: "Sat", predicted_revenue: 4554.0, brisket_raw_lbs: 128.9, pork_shoulder_raw_lbs: 75.9, sausage_lbs: 85, tacos_sold: 113, rosebuds_sold: 45, pork_ribs_racks: 7, beef_dino_ribs: 6, recommended_staff: 5, pitmaster_hours: 42.5, is_closed: false },
      { date: "2026-08-16", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-17", day_name: "Mon", predicted_revenue: 0.0, brisket_raw_lbs: 0.0, pork_shoulder_raw_lbs: 0.0, sausage_lbs: 0, tacos_sold: 0, rosebuds_sold: 0, pork_ribs_racks: 0, beef_dino_ribs: 0, recommended_staff: 0, pitmaster_hours: 0.0, is_closed: true },
      { date: "2026-08-18", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0, is_closed: false },
      { date: "2026-08-19", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-20", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-21", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-22", day_name: "Sat", predicted_revenue: 3960.0, brisket_raw_lbs: 112.2, pork_shoulder_raw_lbs: 66.0, sausage_lbs: 74, tacos_sold: 99, rosebuds_sold: 39, pork_ribs_racks: 6, beef_dino_ribs: 5, recommended_staff: 5, pitmaster_hours: 42.5, is_closed: false },
      { date: "2026-08-23", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-24", day_name: "Mon", predicted_revenue: 0.0, brisket_raw_lbs: 0.0, pork_shoulder_raw_lbs: 0.0, sausage_lbs: 0, tacos_sold: 0, rosebuds_sold: 0, pork_ribs_racks: 0, beef_dino_ribs: 0, recommended_staff: 0, pitmaster_hours: 0.0, is_closed: true },
      { date: "2026-08-25", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0, is_closed: false },
      { date: "2026-08-26", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-27", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false }
    ];

    const safeDefaultRecord = (dStr, sDay) => {
      const isMon = sDay === 'Mon';
      return {
        date: dStr,
        day_name: sDay,
        predicted_revenue: isMon ? 0.0 : 2700.0,
        brisket_raw_lbs: isMon ? 0.0 : 80.0,
        pork_shoulder_raw_lbs: isMon ? 0.0 : 50.0,
        sausage_lbs: isMon ? 0.0 : 50.0,
        tacos_sold: isMon ? 0 : 60,
        rosebuds_sold: isMon ? 0 : 25,
        pork_ribs_racks: isMon ? 0 : 4,
        beef_dino_ribs: isMon ? 0 : 3,
        recommended_staff: isMon ? 0 : 4,
        pitmaster_hours: isMon ? 0.0 : 34.0,
        is_historical: false,
        is_closed: isMon
      };
    };

    let dashPayload = null;
    try {
      if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.dashboard_payload) {
        dashPayload = window.BBQ_PAYLOADS.dashboard_payload;
      } else {
        const dashRes = await fetch('clover_api/analytics/dashboard_payload.json?v=' + Date.now());
        if (dashRes.ok) dashPayload = await dashRes.json();
      }
    } catch (e) {
      console.log("Using embedded dashboard dataset fallback:", e);
    }
    
    if (dashPayload && dashPayload.forecast && dashPayload.forecast.generated_at) {
      const pulledStr = window.ShopTime ? window.ShopTime.formatShopTimestamp(dashPayload.forecast.generated_at) : null;
      const lastPulledElem = document.getElementById('data-last-pulled');
      if (pulledStr && lastPulledElem) {
        lastPulledElem.textContent = `Data Last Pulled: ${pulledStr}`;
      }
    }

    let histPayload = null;
    try {
      if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.historical_payload) {
        histPayload = window.BBQ_PAYLOADS.historical_payload;
      } else {
        const histRes = await fetch('clover_api/analytics/historical_payload.json?v=' + Date.now());
        if (histRes.ok) histPayload = await histRes.json();
      }
    } catch (e) {
      console.log("No historical payload found.");
    }

    let records = (dashPayload && dashPayload.forecast && Array.isArray(dashPayload.forecast.forecast_records) && dashPayload.forecast.forecast_records.length > 0)
      ? dashPayload.forecast.forecast_records
      : defaultForecastRecords;
      
    if (histPayload && Array.isArray(histPayload.historical_records) && histPayload.historical_records.length > 0) {
      // Sort and merge historical records with forecast records
      records = [...histPayload.historical_records, ...records];
      records.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      // Remove duplicates by date if any overlap exists
      records = Array.from(new Map(records.map(item => [item.date, item])).values());
    }

    // Helper for special holiday open operations
    const isHolidayOpen = (dateStr) => {
      const rawCal = window.BBQ_PAYLOADS?.calendar_events;
      const events = Array.isArray(rawCal) ? rawCal : (rawCal?.events || []);
      const evt = events.find(e => e.date === dateStr);
      return Boolean(evt && evt.category === 'holiday' && evt.multiplier > 0 && !String(evt.title || '').toLowerCase().includes('closed'));
    };

    // Sanitize records: Guarantee closed non-operating Mondays (and Christmas) have 0 revenue and 0 prep targets
    records = records.map(r => {
      const d = parseValidDate(r.date);
      const isMon = r.day_name === 'Mon' || (d && d.getDay() === 1);
      const isClosedHoliday = r.date && r.date.endsWith('-12-25');
      if ((isMon && !isHolidayOpen(r.date)) || isClosedHoliday) {
        return {
          ...r,
          predicted_revenue: 0.0,
          actual_revenue: (r.actual_revenue !== undefined && r.actual_revenue > 0) ? r.actual_revenue : 0.0,
          brisket_raw_lbs: 0.0,
          pork_shoulder_raw_lbs: 0.0,
          sausage_lbs: 0.0,
          tacos_sold: 0,
          rosebuds_sold: 0,
          pork_ribs_racks: 0,
          beef_dino_ribs: 0,
          recommended_staff: 0,
          pitmaster_hours: 0.0,
          is_closed: true
        };
      }
      return r;
    });

    // Match the active selected date
    let matchedRecord = records.find(r => r.date === targetDateInput);
    const isTargetMonday = (shortDayStr === 'Mon' || targetDateObj.getDay() === 1);
    const isTargetClosedHoliday = targetDateInput.endsWith('-12-25');

    if (!matchedRecord) {
      if ((isTargetMonday && !isHolidayOpen(targetDateInput)) || isTargetClosedHoliday) {
        matchedRecord = safeDefaultRecord(targetDateInput, 'Mon');
      } else {
        // Calculate an average for that day of the week based on history.
        const histDays = records.filter(r => r.day_name === shortDayStr && r.is_historical && !r.is_closed);
      
      if (histDays.length > 0) {
        // Filter out outliers using IQR on predicted_revenue
        const revs = histDays.map(r => r.predicted_revenue || 0).sort((a, b) => a - b);
        const q1 = revs[Math.floor((revs.length / 4))];
        const q3 = revs[Math.ceil((revs.length * (3 / 4))) - 1] || revs[revs.length - 1];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const validDays = histDays.filter(r => (r.predicted_revenue || 0) >= lowerBound && (r.predicted_revenue || 0) <= upperBound);
        const daysToAverage = validDays.length > 0 ? validDays : histDays;
        
        // Calculate averages
        matchedRecord = {
          date: targetDateInput,
          day_name: shortDayStr,
          is_historical: false,
          is_fallback_average: true,
          predicted_revenue: daysToAverage.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0) / daysToAverage.length,
          brisket_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.brisket_raw_lbs || 0), 0) / daysToAverage.length,
          pork_shoulder_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.pork_shoulder_raw_lbs || 0), 0) / daysToAverage.length,
          sausage_lbs: daysToAverage.reduce((sum, r) => sum + (r.sausage_lbs || 0), 0) / daysToAverage.length,
          tacos_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.tacos_sold || 0), 0) / daysToAverage.length),
          rosebuds_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.rosebuds_sold || 0), 0) / daysToAverage.length),
          pork_ribs_racks: daysToAverage.reduce((sum, r) => sum + (r.pork_ribs_racks || 0), 0) / daysToAverage.length,
          beef_dino_ribs: daysToAverage.reduce((sum, r) => sum + (r.beef_dino_ribs || 0), 0) / daysToAverage.length,
          actual_revenue: daysToAverage.reduce((sum, r) => sum + (r.actual_revenue || 0), 0) / daysToAverage.length
        };

        // Factor in live events
        const JAGS_HOME_GAMES = ["2026-09-13", "2026-09-27", "2026-10-18", "2026-11-01", "2026-11-22", "2026-12-06", "2026-12-20"];
        const HARDCODED_HOLIDAYS = ["2026-01-01", "2026-05-25", "2026-07-04", "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-05-31", "2027-07-04", "2027-09-06", "2027-11-25", "2027-12-25"];
        
        let eventMultiplier = 1.0;
        let eventStr = '';
        if (JAGS_HOME_GAMES.includes(targetDateInput)) {
           eventMultiplier = 3.5; 
           eventStr = 'Jaguars Game';
        } else if (HARDCODED_HOLIDAYS.includes(targetDateInput)) {
           eventMultiplier = 0.7;
           eventStr = 'Holiday';
        }

        // Factor in weather
        let weatherMultiplier = 1.0;
        let weatherStr = '';
        try {
           const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=30.3322&longitude=-81.6557&daily=temperature_2m_max,precipitation_sum&timezone=America/New_York&start_date=${targetDateInput}&end_date=${targetDateInput}`);
           if (weatherRes.ok) {
             const weatherData = await weatherRes.json();
             if (weatherData.daily && weatherData.daily.precipitation_sum && weatherData.daily.precipitation_sum[0] > 10.0) {
                 weatherMultiplier = 1.21;
                 weatherStr = 'Heavy Rain';
             } else if (weatherData.daily && weatherData.daily.temperature_2m_max && weatherData.daily.temperature_2m_max[0] > 90.0) {
                 weatherMultiplier = 0.942;
                 weatherStr = 'Extreme Heat';
             }
           }
        } catch (e) {
           // Graceful fallback on network failure
        }

        const totalMultiplier = eventMultiplier * weatherMultiplier;
        if (totalMultiplier !== 1.0) {
            matchedRecord.predicted_revenue *= totalMultiplier;
            matchedRecord.brisket_raw_lbs *= totalMultiplier;
            matchedRecord.pork_shoulder_raw_lbs *= totalMultiplier;
            matchedRecord.sausage_lbs *= totalMultiplier;
            matchedRecord.tacos_sold = Math.round(matchedRecord.tacos_sold * totalMultiplier);
            matchedRecord.rosebuds_sold = Math.round(matchedRecord.rosebuds_sold * totalMultiplier);
            matchedRecord.pork_ribs_racks *= totalMultiplier;
            matchedRecord.beef_dino_ribs *= totalMultiplier;
            matchedRecord.insightSuffix = ` (Adjusted x${totalMultiplier.toFixed(2)} for ${eventStr}${eventStr && weatherStr ? ' and ' : ''}${weatherStr})`;
        }
      } else {
        const found = records.find(r => r.day_name === shortDayStr);
        matchedRecord = found ? { ...found, date: targetDateInput } : (records[0] ? { ...records[0], date: targetDateInput } : safeDefaultRecord(targetDateInput, shortDayStr));
      }
    }
  }
  if (!matchedRecord) {
    matchedRecord = safeDefaultRecord(targetDateInput, shortDayStr);
  }

    const startIndex = records.findIndex(r => r.date === targetDateInput);
    let slicedRecords = [];
    if (startIndex >= 0) {
      slicedRecords = records.slice(startIndex, startIndex + daysCount).map(r => ({ ...r }));
      // Pad with safe averages if we run out of days
      while (slicedRecords.length < daysCount) {
        const lastRec = slicedRecords[slicedRecords.length - 1];
        const lastDate = parseValidDate(lastRec.date) || new Date();
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const sDay = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dStr = (new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const found = records.find(x => x.day_name === sDay);
        const paddedRec = found ? { ...found, date: dStr, day_name: sDay } : safeDefaultRecord(dStr, sDay);
        slicedRecords.push(paddedRec);
      }
    } else {
      const currDate = parseValidDate(targetDateInput) || new Date();
      for (let i = 0; i < daysCount; i++) {
        const stepDate = new Date(currDate);
        stepDate.setDate(stepDate.getDate() + i);
        const dStr = (new Date(stepDate.getTime() - stepDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let r = records.find(x => x.date === dStr);
        if (i === 0 && matchedRecord && matchedRecord.date === dStr) {
           r = matchedRecord;
        } else if (!r) {
           const sDay = stepDate.toLocaleDateString('en-US', { weekday: 'short' });
           const histDays = records.filter(x => x.day_name === sDay && x.is_historical);
           if (histDays.length > 0) {
             r = {
               date: dStr,
               day_name: sDay,
               predicted_revenue: histDays.reduce((sum, x) => sum + (x.predicted_revenue || 0), 0) / histDays.length,
               brisket_raw_lbs: histDays.reduce((sum, x) => sum + (x.brisket_raw_lbs || 0), 0) / histDays.length,
               pork_shoulder_raw_lbs: histDays.reduce((sum, x) => sum + (x.pork_shoulder_raw_lbs || 0), 0) / histDays.length,
               sausage_lbs: histDays.reduce((sum, x) => sum + (x.sausage_lbs || 0), 0) / histDays.length,
               tacos_sold: Math.round(histDays.reduce((sum, x) => sum + (x.tacos_sold || 0), 0) / histDays.length),
               rosebuds_sold: Math.round(histDays.reduce((sum, x) => sum + (x.rosebuds_sold || 0), 0) / histDays.length),
               pork_ribs_racks: histDays.reduce((sum, x) => sum + (x.pork_ribs_racks || 0), 0) / histDays.length,
               beef_dino_ribs: histDays.reduce((sum, x) => sum + (x.beef_dino_ribs || 0), 0) / histDays.length,
               is_historical: false
             };
           } else {
             const found = records.find(x => x.day_name === sDay);
             r = found ? { ...found, date: dStr, day_name: sDay } : safeDefaultRecord(dStr, sDay);
           }
        }
        slicedRecords.push(r ? { ...r } : safeDefaultRecord(dStr, 'Day'));
      }
    }
    if (!slicedRecords || slicedRecords.length === 0) {
      slicedRecords = [matchedRecord];
    }

    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : 'baseline';

    // KPI Cards Logic - Sum if multi-day range provided, otherwise single target date
    const startDateVal = document.getElementById('forecast-start-date')?.value || targetDateInput;
    const endDateVal = document.getElementById('forecast-end-date')?.value || targetDateInput;
    const isRangeSelected = Boolean(startDateVal && endDateVal && (startDateVal !== endDateVal) && daysCount > 1);
    
    // Check if the current single target date is a closed day (e.g. Monday or Christmas).
    // Note: If the user is actively simulating in Time-Travel mode, allow simulation to execute even if today is Monday.
    const isSimActive = Boolean(window.ShopTime && typeof window.ShopTime.isSimulating === 'function' && window.ShopTime.isSimulating());
    const isTargetClosed = Boolean(
      !isRangeSelected && !isSimActive && (
        matchedRecord?.is_closed ||
        (matchedRecord?.day_name === 'Mon' && !isHolidayOpen(matchedRecord.date)) ||
        (targetDateObj.getDay() === 1 && !isHolidayOpen(targetDateInput)) ||
        targetDateInput.endsWith('-12-25') ||
        (matchedRecord?.predicted_revenue !== undefined && matchedRecord.predicted_revenue <= 0 && !matchedRecord.is_historical)
      )
    );

    let bRaw = 0, pRaw = 0, sVal = 0, rVal = 0, drVal = 0, totalTacos = 0, totalRosebuds = 0, totalRev = 0, tVal = 0;
    let totalCogs = 0, totalStaff = 0, totalLaborHours = 0;
    
    function calcCalibratedTurkey(r) {
      if (!r || r.is_closed || r.day_name === 'Mon') return { cooked: 0, raw: 0 };
      const baselines = { 'Tue': 6.2, 'Wed': 7.2, 'Thu': 7.0, 'Fri': 11.5, 'Sat': 12.9, 'Sun': 8.9 };
      const baseCooked = baselines[r.day_name] || 6.0;
      const rev = r.predicted_revenue || 0;
      const benchmark = ['Fri', 'Sat', 'Sun'].includes(r.day_name) ? 3500 : 2800;
      const revMultiplier = rev > 0 ? Math.min(1.10, Math.max(0.90, rev / benchmark)) : 1.0;
      const cookedDemand = baseCooked * revMultiplier;
      const cookedTarget = Math.round(cookedDemand * 1.10 * 10) / 10; // +10% safety buffer
      const rawTarget = Math.round((cookedTarget / 0.70) * 10) / 10;   // 70% nominal yield
      return { cooked: cookedTarget, raw: rawTarget };
    }

    if (isTargetClosed) {
      bRaw = 0; pRaw = 0; sVal = 0; rVal = 0; drVal = 0; totalTacos = 0; totalRosebuds = 0; totalRev = 0; tVal = 0;
      totalCogs = 0; totalStaff = 0; totalLaborHours = 0;
    } else if (isRangeSelected) {
      slicedRecords.forEach(r => {
        const rev = (r.predicted_revenue || 0);
        bRaw += (r.brisket_raw_lbs || 0);
        pRaw += (r.pork_shoulder_raw_lbs || 0);
        sVal += Math.round(r.sausage_lbs || 0);
        rVal += Math.round(r.pork_ribs_racks || 0);
        drVal += Math.round(r.beef_dino_ribs || 0);
        totalTacos += Math.round(r.tacos_sold || 0);
        totalRosebuds += Math.round(r.rosebuds_sold || 0);
        totalRev += Math.round(rev);
        tVal += Math.round(calcCalibratedTurkey(r).cooked);
        
        // Calculate daily staff and hours
        const isClosedDay = r.is_closed || r.day_name === 'Mon';
        const dayStaff = isClosedDay ? 0 : (r.recommended_staff || minMaxStaff(rev));
        const dayHours = isClosedDay ? 0.0 : (r.pitmaster_hours || roundStaffHours(dayStaff));
        totalStaff = Math.max(totalStaff, dayStaff);
        totalLaborHours += dayHours;
        totalCogs += (r.estimated_cogs_usd || Math.round(rev * 0.295));
      });
    } else {
      const targetRecord = slicedRecords[0] || matchedRecord;
      bRaw = targetRecord.brisket_raw_lbs || 0;
      pRaw = targetRecord.pork_shoulder_raw_lbs || 0;
      sVal = Math.round(targetRecord.sausage_lbs || 0);
      rVal = Math.round(targetRecord.pork_ribs_racks || 0);
      drVal = Math.round(targetRecord.beef_dino_ribs || 0);
      totalTacos = Math.round(targetRecord.tacos_sold || 0);
      totalRosebuds = Math.round(targetRecord.rosebuds_sold || 0);
      totalRev = Math.round(targetRecord.predicted_revenue || 0);
      tVal = Math.round(calcCalibratedTurkey(targetRecord).cooked);
      
      const isClosedDay = targetRecord.is_closed || targetRecord.day_name === 'Mon';
      totalStaff = isClosedDay ? 0 : (targetRecord.recommended_staff || minMaxStaff(totalRev));
      totalLaborHours = isClosedDay ? 0.0 : (targetRecord.pitmaster_hours || roundStaffHours(totalStaff));
      totalCogs = targetRecord.estimated_cogs_usd || Math.round(totalRev * 0.295);
    }

    function minMaxStaff(rev) {
      if (!rev || rev <= 0) return 0;
      return Math.min(5, Math.max(2, Math.floor(rev / 1000) + 1));
    }
    function roundStaffHours(staff) {
      return Math.round(staff * 8.5 * 10) / 10;
    }

    const bCooked = Math.round(bRaw * 0.4);
    const pCooked = Math.round(pRaw * 0.44);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    // Operating baseline calculation (Tue-Sun operating days only)
    const openRecords = records.filter(r => !r.is_closed && r.day_name !== 'Mon');
    const baselineRev = openRecords.length ? Math.max(1, Math.round(openRecords.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / openRecords.length)) : 2700;
    const avgBrisketRaw = Math.round(openRecords.reduce((acc, curr) => acc + (curr.brisket_raw_lbs || 0), 0) / (openRecords.length || 1));
    const avgBrisketCooked = Math.round(avgBrisketRaw * 0.4);
    const avgPorkRaw = Math.round(openRecords.reduce((acc, curr) => acc + (curr.pork_shoulder_raw_lbs || 0), 0) / (openRecords.length || 1));
    const avgPorkCooked = Math.round(avgPorkRaw * 0.44);

    const weekdays = records.filter(r => ['Tue', 'Wed', 'Thu'].includes(r.day_name));
    const weekends = records.filter(r => ['Fri', 'Sat', 'Sun'].includes(r.day_name));
    const weekdayAvgRev = weekdays.length ? Math.round(weekdays.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / weekdays.length) : 1600;
    const weekendAvgRev = weekends.length ? Math.round(weekends.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / weekends.length) : 3300;

    const activeOpenDays = isRangeSelected ? (slicedRecords.filter(r => !r.is_closed && r.day_name !== 'Mon').length || 1) : 1;
    const baselineDenominator = isRangeSelected ? baselineRev * activeOpenDays : baselineRev;
    const incrementalRev = totalRev - baselineDenominator;
    const pctDiff = baselineDenominator > 0 ? Math.round((incrementalRev / baselineDenominator) * 100) : 0;
    const pctDisplay = isTargetClosed ? 'Closed' : (totalRev === 0 ? 'Closed' : (pctDiff > 0 ? `+${pctDiff}%` : `${pctDiff}%`));

    let insightStr = '';
    if (isTargetClosed) {
      insightStr = `Closed Today (${matchedRecord.day_name || shortDayStr}, ${slicedRecords[0]?.date || targetDateInput}): Scheduled Monday pit maintenance and wood restocking. Zero retail smoking run; service resumes Tuesday 11:00 AM.`;
    } else if (isRangeSelected) {
      insightStr = `Prep Horizon (${startDateVal} to ${endDateVal}, ${activeOpenDays} operating days): Stage ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked, 40% yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked, 44% yield) [~${totalRaw} lbs raw / ~${totalCooked} lbs cooked]. Includes composed draw for ${totalTacos} Tacos and ${totalRosebuds} Rosebuds.`;
    } else {
      insightStr = `Single-Day Prep (${matchedRecord.day_name || shortDayStr}, ${slicedRecords[0].date}): Stage ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked, 40% yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked, 44% yield) [~${totalRaw} lbs raw / ~${totalCooked} lbs cooked]. Covers composed draw (${totalTacos} Tacos, ${totalRosebuds} Rosebuds) through 9:00 PM close.`;
    }

    if (selectedCat !== 'baseline' && catSelector && !isTargetClosed) {
      const selectedText = catSelector.options[catSelector.selectedIndex]?.text || selectedCat;
      insightStr = `Category Focus (${isRangeSelected ? startDateVal + ' to ' + endDateVal : slicedRecords[0].date}): Isolating "${selectedText}" demand curve to align butcher pulls and smoker capacity.`;
    }

    const insightSpan = document.getElementById('dynamic-insight-string');
    if (insightSpan) {
      insightSpan.textContent = insightStr;
    }

    const bVal = Math.round(bRaw);
    const pVal = Math.round(pRaw);
    const rbVal = totalRosebuds;
    const tacoVal = totalTacos;

    const brisketElem = document.getElementById('kpi-brisket-lbs');
    const porkElem = document.getElementById('kpi-pork-lbs');
    const sausageElem = document.getElementById('kpi-sausage-batches');
    const ribsElem = document.getElementById('kpi-pork-ribs-racks');
    const dinoElem = document.getElementById('kpi-beef-dino-ribs');
    const turkeyElem = document.getElementById('kpi-turkey-lbs');
    const turkeySubElem = document.getElementById('kpi-turkey-sub');
    const rosebudsElem = document.getElementById('kpi-rosebuds');
    const tacosElem = document.getElementById('kpi-tacos');
    const totalCookedElem = document.getElementById('kpi-total-cooked-meat');
    const totalCookedSub = document.getElementById('kpi-total-cooked-sub');

    // Sausage: sVal is in lbs. 1 Batch yields ~60 lbs stuffed weight. 3 links = 1 lb.
    const sausageBatches = Math.ceil(sVal / 60.0) || 0;
    const sausageLinks = sVal * 3;

    const bCasesElem = document.getElementById('kpi-brisket-cases');
    const pCasesElem = document.getElementById('kpi-pork-cases');
    const bCookedElem = document.getElementById('kpi-brisket-cooked');
    const pCookedElem = document.getElementById('kpi-pork-cooked');
    const rCasesElem = document.getElementById('kpi-pork-ribs-cases');
    const drCasesElem = document.getElementById('kpi-beef-dino-ribs-cases');
    const sausageLinksSub = document.getElementById('kpi-sausage-links-sub');

    const laborHoursElem = document.getElementById('kpi-labor-hours');
    const staffCountElem = document.getElementById('kpi-staff-count');
    const cogsUsdElem = document.getElementById('kpi-cogs-usd');
    const aovUsdElem = document.getElementById('kpi-aov-usd');
    const aovSubElem = document.getElementById('kpi-aov-sub');
    const revenueElem = document.getElementById('kpi-projected-revenue');
    const demandLabelElem = document.getElementById('kpi-demand-label');
    const demandPctElem = document.getElementById('kpi-demand-pct');

    // Helper functions for KPI blended live total pills
    const allBlendedPills = [
      'kpi-revenue-blended-sub',
      'kpi-brisket-blended-sub',
      'kpi-pork-blended-sub',
      'kpi-sausage-blended-sub',
      'kpi-pork-ribs-blended-sub',
      'kpi-beef-dino-blended-sub',
      'kpi-turkey-blended-sub',
      'kpi-rosebuds-blended-sub',
      'kpi-tacos-blended-sub',
      'kpi-total-cooked-blended-sub',
      'kpi-velocity-blended-sub',
      'kpi-food-cost-blended-sub',
      'kpi-aov-blended-sub',
      'kpi-labor-blended-sub'
    ];
    function setBlendedPill(id, html) {
      const el = document.getElementById(id);
      if (!el) return;
      if (html) {
        el.innerHTML = html;
        el.style.display = 'block';
      } else {
        el.innerHTML = '';
        el.style.display = 'none';
      }
    }
    function clearAllBlendedPills() {
      allBlendedPills.forEach(id => setBlendedPill(id, ''));
    }

    // Helper functions for KPI Prediction vs. Measured Yield comparison badges
    const allCompareBadges = [
      'kpi-revenue-compare',
      'kpi-brisket-compare',
      'kpi-pork-compare',
      'kpi-sausage-compare',
      'kpi-pork-ribs-compare',
      'kpi-beef-dino-ribs-compare',
      'kpi-turkey-compare',
      'kpi-rosebuds-compare',
      'kpi-tacos-compare',
      'kpi-total-cooked-compare'
    ];
    function setCompareBadge(id, html) {
      const el = document.getElementById(id);
      if (!el) return;
      if (html) {
        el.innerHTML = html;
        el.style.display = 'flex';
      } else {
        el.innerHTML = '';
        el.style.display = 'none';
      }
    }
    function clearAllCompareBadges() {
      allCompareBadges.forEach(id => setCompareBadge(id, ''));
    }

    function buildCompareBadgeHTML(predLabel, predStr, actLabel, actStr, diffNum, diffUnit, diffPct, customTag, plainDesc) {
      let deltaClass = 'pill-match';
      let deltaText = 'Exact Match';
      const sign = (diffNum > 0) ? '+' : '';

      if (customTag) {
        deltaText = customTag.text;
        deltaClass = customTag.className || 'pill-pending';
      } else if (diffPct !== null && diffPct !== undefined) {
        const absPct = Math.abs(diffPct);
        if (absPct < 0.2) {
          deltaClass = 'pill-match';
          deltaText = 'Exact Target (0%)';
        } else if (diffNum > 0) {
          deltaClass = 'pill-pos';
          deltaText = `${sign}${diffNum} ${diffUnit} (${sign}${diffPct}%)`;
        } else {
          deltaClass = 'pill-neg';
          deltaText = `${diffNum} ${diffUnit} (${diffPct}%)`;
        }
      }

      const descHTML = plainDesc ? `<div class="compare-plain-desc">${plainDesc}</div>` : '';

      return `
        <div class="compare-line">
          <span class="compare-lbl">${predLabel}:</span>
          <span class="compare-num num-pred">${predStr}</span>
        </div>
        <div class="compare-line">
          <span class="compare-lbl">${actLabel}:</span>
          <span class="compare-num num-act">${actStr}</span>
        </div>
        <div class="compare-delta-line">
          <span style="color:#94a3b8; font-size:9px; text-transform:uppercase; font-weight:700;">Variance:</span>
          <span class="delta-pill ${deltaClass}">${deltaText}</span>
        </div>
        ${descHTML}
      `;
    }

    // Blended Real-Time POS Turnover computation
    let blendedMetrics = null;
    const effNow = window.ShopTime ? window.ShopTime.getEffectiveNow() : new Date();
    const shopTodayStr = window.ShopTime ? window.ShopTime.shopDateStr(effNow) : '';
    const activeDateForBlended = (!isRangeSelected && targetDateInput) ? targetDateInput : shopTodayStr;

    if (window.ShopTime && !isTargetClosed && (!isRangeSelected || daysCount === 1)) {
      const actualsPayload = window.BBQ_PAYLOADS?.hourly_actuals || null;
      const predictivePayload = window.BBQ_PAYLOADS?.predictive_payload || null;
      
      const dayProfiles = predictivePayload?.day_profiles;
      let hourlyRecs = predictivePayload?.hourly_forecast || [];
      if (dayProfiles) {
        const dObj = parseValidDate(activeDateForBlended);
        if (dObj) {
          const longName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
          const shortName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
          const prof = dayProfiles[longName] || dayProfiles[shortName];
          if (prof && prof.hourly_forecast) hourlyRecs = prof.hourly_forecast;
        }
      }

      if (actualsPayload && hourlyRecs.length > 0) {
        blendedMetrics = window.ShopTime.computeBlendedDayMetrics(actualsPayload, hourlyRecs, effNow, activeDateForBlended);
      }
    }

    const hasBlended = Boolean(blendedMetrics && (blendedMetrics.isToday || blendedMetrics.isPast || (window.ShopTime && window.ShopTime.isSimulating())) && blendedMetrics.summary.actualSalesSoFar > 0);

    const rosebudsSubElem = document.getElementById('kpi-rosebuds-sub');
    const tacosSubElem = document.getElementById('kpi-tacos-sub');

    if (isTargetClosed) {
      clearAllBlendedPills();

      if (brisketElem) brisketElem.textContent = '0';
      if (porkElem) porkElem.textContent = '0';
      if (sausageElem) sausageElem.textContent = '0';
      if (sausageLinksSub) sausageLinksSub.textContent = '(Closed / 0 lbs)';
      if (ribsElem) ribsElem.textContent = '0';
      if (dinoElem) dinoElem.textContent = '0';
      if (turkeyElem) turkeyElem.textContent = '0';
      if (turkeySubElem) turkeySubElem.textContent = '(Closed / 0 lbs)';
      if (rosebudsElem) rosebudsElem.textContent = '0';
      if (rosebudsSubElem) rosebudsSubElem.textContent = '(Closed / 0 units)';
      if (tacosElem) tacosElem.textContent = '0';
      if (tacosSubElem) tacosSubElem.textContent = '(Closed / 0 tacos)';
      if (totalCookedElem) totalCookedElem.textContent = '0';
      if (totalCookedSub) totalCookedSub.textContent = '(Closed / 0 lbs)';

      if (bCasesElem) bCasesElem.textContent = '(Closed / 0 Cases)';
      if (pCasesElem) pCasesElem.textContent = '(Closed / 0 Cases)';
      if (bCookedElem) bCookedElem.textContent = '(0 lbs cooked)';
      if (pCookedElem) pCookedElem.textContent = '(0 lbs cooked)';
      if (rCasesElem) rCasesElem.textContent = '(Closed / 0 Cases)';
      if (drCasesElem) drCasesElem.textContent = '(Closed / 0 Cases)';

      if (laborHoursElem) laborHoursElem.textContent = '0';
      if (staffCountElem) staffCountElem.textContent = '(Closed / 0 Staff)';
      if (cogsUsdElem) cogsUsdElem.textContent = '($0 COGS)';
      if (aovUsdElem) aovUsdElem.textContent = '$0.00';
      if (aovSubElem) aovSubElem.textContent = '(Closed / 0 Orders)';
      if (revenueElem) revenueElem.textContent = '$0 (Closed)';

      // Closed Day Comparison Badges
      setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML('Predicted', '$0', 'Measured', '$0 (Closed)', 0, '$', 0, { text: 'Closed Monday', className: 'pill-closed' }, 'Weekly pit maintenance & smoker sanitization. Zero retail service.'));
      setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs raw briskets pulled • 0 lbs cooked yield slicing'));
      setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs bone-in pork butts • 0 lbs pulled pork prepared'));
      setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML('Predicted', '0 links', 'Measured', '0 links (Closed)', 0, 'links', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 mixer batches • 0 sausage links stuffed'));
      setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML('Predicted', '0 racks', 'Measured', '0 racks (Closed)', 0, 'racks', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 spare rib racks smoked • 0 bones served'));
      setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML('Predicted', '0 ribs', 'Measured', '0 ribs (Closed)', 0, 'ribs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 dino plate ribs • Smoker pits shut down'));
      setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs cooked breast • 0 carved portions prepared'));
      setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML('Predicted', '0 units', 'Measured', '0 units (Closed)', 0, 'units', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 bacon-wrapped burnt end bites prepped'));
      setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML('Predicted', '0 tacos', 'Measured', '0 tacos (Closed)', 0, 'tacos', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 street tacos served • Hot-holding idle'));
      setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Closed Day', className: 'pill-closed' }, 'Total Cooked Yield: 0 lbs across all proteins.'));

      // Render Model Evaluation Banner for Closed Day
      const evalBannerElem = document.getElementById('kpi-model-eval-banner');
      const evalPillElem = document.getElementById('model-eval-status-pill');
      const evalBodyElem = document.getElementById('model-eval-body');
      if (evalBannerElem && evalPillElem && evalBodyElem) {
        evalBannerElem.style.display = 'block';
        evalPillElem.className = 'eval-pill eval-pill-closed';
        evalPillElem.textContent = 'Closed Day';
        evalBodyElem.innerHTML = `
          <div class="model-eval-narrative">
            <strong>Smokehouse Closed (Pit Maintenance Window)</strong>: Mondays are standard scheduled non-operating days reserved for pit cleaning, deep smoker sanitization, and hickory wood restocking. Operating targets, labor shifts, and food cost models are calibrated to zero.
          </div>
        `;
      }
    } else if (hasBlended) {
      const bSum = blendedMetrics.summary;
      const cutH = blendedMetrics.cutoffHour;
      const h12 = cutH === 0 ? 12 : (cutH > 12 ? cutH - 12 : cutH);
      const ampm = cutH >= 12 ? 'PM' : 'AM';
      const pSign = bSum.pacingPct >= 0 ? '+' : '';
      const pColor = bSum.pacingPct >= 0 ? '#34d399' : '#f87171';

      const actSalesSoFar = Math.round(bSum.actualSalesSoFar);
      const remSales = Math.round(bSum.forecastRemaining);
      const blendedTotalRev = Math.round(bSum.blendedTotalRevenue);
      const salesProgress = bSum.forecastFullDay > 0 ? (bSum.forecastToHour / bSum.forecastFullDay) : 0;
      const pacingRatio = bSum.pacingRatio || (bSum.forecastToHour > 0 ? (bSum.actualSalesSoFar / bSum.forecastToHour) : 1.0);

      // 1. Brisket
      const actCookedBrisket = bSum.actualBrisketCooked !== undefined ? bSum.actualBrisketCooked : Math.round(bCooked * salesProgress * pacingRatio * 10) / 10;
      const remCookedBrisket = bSum.remainingBrisketCooked !== undefined ? bSum.remainingBrisketCooked : Math.round(bCooked * (1 - salesProgress) * 10) / 10;
      const blendedCookedBrisket = Math.round((actCookedBrisket + remCookedBrisket) * 10) / 10;
      const blendedRawBrisket = Math.round(blendedCookedBrisket / 0.4);

      if (brisketElem) brisketElem.textContent = blendedRawBrisket;
      if (bCasesElem) bCasesElem.textContent = `(~${blendedRawBrisket} lbs raw / ~${(blendedRawBrisket / 70.0).toFixed(1)} Cases)`;
      if (bCookedElem) bCookedElem.textContent = `(~${Math.round(actCookedBrisket)} lbs actual sold • ~${Math.round(remCookedBrisket)} lbs remaining)`;
      setBlendedPill('kpi-brisket-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actCookedBrisket)} lbs sold so far + ~${Math.round(remCookedBrisket)} lbs needed to close (~${Math.round(blendedCookedBrisket)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actCookedBrisket)} lbs cooked (~${Math.round(actCookedBrisket / 0.4)} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 2. Pork Shoulder
      const actCookedPork = bSum.actualPorkCooked !== undefined ? bSum.actualPorkCooked : Math.round(pCooked * salesProgress * pacingRatio * 10) / 10;
      const remCookedPork = bSum.remainingPorkCooked !== undefined ? bSum.remainingPorkCooked : Math.round(pCooked * (1 - salesProgress) * 10) / 10;
      const blendedCookedPork = Math.round((actCookedPork + remCookedPork) * 10) / 10;
      const blendedRawPork = Math.round(blendedCookedPork / 0.44);

      if (porkElem) porkElem.textContent = blendedRawPork;
      if (pCasesElem) pCasesElem.textContent = `(~${blendedRawPork} lbs raw / ~${(blendedRawPork / 32.0).toFixed(1)} Cases)`;
      if (pCookedElem) pCookedElem.textContent = `(~${Math.round(actCookedPork)} lbs actual sold • ~${Math.round(remCookedPork)} lbs remaining)`;
      setBlendedPill('kpi-pork-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actCookedPork)} lbs sold so far + ~${Math.round(remCookedPork)} lbs needed to close (~${Math.round(blendedCookedPork)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actCookedPork)} lbs cooked (~${Math.round(actCookedPork / 0.44)} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 3. Sausage
      const actSausageLinks = Math.round(sausageLinks * salesProgress * pacingRatio);
      const remSausageLinks = Math.max(0, Math.round(sausageLinks * (1 - salesProgress)));
      const blendedSausageLinks = actSausageLinks + remSausageLinks;
      const actSausageLbs = Math.round(actSausageLinks / 3);
      const blendedSausageLbs = Math.round(blendedSausageLinks / 3);
      const blendedSausageBatches = Math.ceil(blendedSausageLbs / 60.0) || 1;

      if (sausageElem) sausageElem.textContent = blendedSausageBatches;
      if (sausageLinksSub) sausageLinksSub.textContent = `(${actSausageLinks} actual links sold • ${remSausageLinks} remaining)`;
      setBlendedPill('kpi-sausage-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${actSausageLinks} links sold so far + ~${remSausageLinks} needed to close (~${blendedSausageLinks} total links)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actSausageLinks} links sold (~${actSausageLbs} lbs)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 4. Pork Spare Ribs
      const actRibsRacks = Math.round(rVal * salesProgress * pacingRatio);
      const remRibsRacks = Math.max(0, Math.round(rVal * (1 - salesProgress)));
      const blendedRibsRacks = actRibsRacks + remRibsRacks;

      if (ribsElem) ribsElem.textContent = blendedRibsRacks;
      if (rCasesElem) rCasesElem.textContent = `(${actRibsRacks} actual racks sold • ${remRibsRacks} remaining)`;
      setBlendedPill('kpi-pork-ribs-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actRibsRacks} racks sold so far + ${remRibsRacks} needed to close (${blendedRibsRacks} total racks)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actRibsRacks} racks sold (~${(actRibsRacks / 6.0).toFixed(1)} cs)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 5. Beef Dino Ribs
      const actDinoRibs = Math.round(drVal * salesProgress * pacingRatio);
      const remDinoRibs = Math.max(0, Math.round(drVal * (1 - salesProgress)));
      const blendedDinoRibs = actDinoRibs + remDinoRibs;

      if (dinoElem) dinoElem.textContent = blendedDinoRibs;
      if (drCasesElem) drCasesElem.textContent = `(${actDinoRibs} actual ribs sold • ${remDinoRibs} remaining)`;
      setBlendedPill('kpi-beef-dino-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actDinoRibs} ribs sold so far + ${remDinoRibs} needed to close (${blendedDinoRibs} total ribs)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actDinoRibs} ribs sold (~${(blendedDinoRibs / 12.0).toFixed(1)} Cases)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 6. Smoked Turkey
      const actTurkeyCooked = Math.round(tVal * salesProgress * pacingRatio * 10) / 10;
      const remTurkeyCooked = Math.round(tVal * (1 - salesProgress) * 10) / 10;
      const blendedTurkeyCooked = Math.round((actTurkeyCooked + remTurkeyCooked) * 10) / 10;
      const blendedTurkeyRaw = Math.round(blendedTurkeyCooked / 0.70);
      const blendedTurkeyCases = (blendedTurkeyRaw / 20.0).toFixed(1);
      const blendedTurkeyPort = Math.round(blendedTurkeyCooked * 3.2);

      if (turkeyElem) turkeyElem.textContent = Math.round(blendedTurkeyCooked);
      if (turkeySubElem) turkeySubElem.textContent = `(~${Math.round(actTurkeyCooked)} lbs actual • ~${Math.round(remTurkeyCooked)} lbs remaining)`;
      setBlendedPill('kpi-turkey-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actTurkeyCooked)} lbs sold so far + ~${Math.round(remTurkeyCooked)} lbs needed to close (~${Math.round(blendedTurkeyCooked)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actTurkeyCooked)} lbs cooked (~${blendedTurkeyRaw} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 7. Rosebuds
      const actRosebuds = Math.round(rbVal * salesProgress * pacingRatio);
      const remRosebuds = Math.max(0, Math.round(rbVal * (1 - salesProgress)));
      const blendedRosebuds = actRosebuds + remRosebuds;

      if (rosebudsElem) rosebudsElem.textContent = blendedRosebuds;
      if (rosebudsSubElem) rosebudsSubElem.textContent = `(${actRosebuds} actual sold • ${remRosebuds} remaining)`;
      setBlendedPill('kpi-rosebuds-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actRosebuds} bites sold so far + ${remRosebuds} needed to close (${blendedRosebuds} total bites)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actRosebuds} units (~${(actRosebuds * 0.25).toFixed(1)} lbs brisket draw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 8. Tacos
      const actTacos = Math.round(tacoVal * salesProgress * pacingRatio);
      const remTacos = Math.max(0, Math.round(tacoVal * (1 - salesProgress)));
      const blendedTacos = actTacos + remTacos;

      if (tacosElem) tacosElem.textContent = blendedTacos;
      if (tacosSubElem) tacosSubElem.textContent = `(${actTacos} actual sold • ${remTacos} remaining)`;
      setBlendedPill('kpi-tacos-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actTacos} tacos sold so far + ${remTacos} needed to close (${blendedTacos} total tacos)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actTacos} tacos (~${(actTacos * 0.15).toFixed(1)} lbs meat draw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 9. Total Cooked Barbecue
      const actTotalCooked = Math.round(actCookedBrisket + actCookedPork);
      const remTotalCooked = Math.round(remCookedBrisket + remCookedPork);
      const blendedTotalCooked = actTotalCooked + remTotalCooked;

      if (totalCookedElem) totalCookedElem.textContent = blendedTotalCooked;
      if (totalCookedSub) totalCookedSub.textContent = `(~${actTotalCooked} lbs actual sold • ~${remTotalCooked} lbs remaining)`;
      setBlendedPill('kpi-total-cooked-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${actTotalCooked} lbs pulled so far + ~${remTotalCooked} lbs needed to close (~${blendedTotalCooked} lbs total cooked)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actTotalCooked} lbs cooked (~${Math.round(actTotalCooked / 0.4)} lbs raw trim)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 10. Sales Velocity
      const elapsedHours = Math.max(1, cutH >= 11 ? Math.min(cutH - 10, 10) : 1);
      const liveVelocity = (bSum.actualOrdersSoFar / elapsedHours).toFixed(1);
      const targetVelocity = ((bSum.forecastFullDay / 48.5) / 10).toFixed(1);
      const velElem = document.getElementById('kpi-current-velocity');
      const pacingStatusElem = document.getElementById('kpi-pacing-status');

      if (velElem) velElem.textContent = `${liveVelocity} ord/hr`;
      if (pacingStatusElem) {
        pacingStatusElem.textContent = `(${pSign}${bSum.pacingPct}% Pace)`;
        pacingStatusElem.style.color = pColor;
      }
      setBlendedPill('kpi-velocity-blended-sub', `
        <strong>Current Pace</strong>: ${liveVelocity} orders/hr actual pace<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${bSum.actualOrdersSoFar} orders in ${elapsedHours}h (Target: ${targetVelocity} ord/hr)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 11. Estimated Food Cost / COGS
      const blendedCOGS = Math.round(blendedTotalRev * 0.295);
      const actCOGS = Math.round(actSalesSoFar * 0.295);
      const remCOGS = Math.round(remSales * 0.295);
      if (cogsUsdElem) cogsUsdElem.textContent = `(~$${Math.round(actCOGS).toLocaleString()} actual COGS • ~$${Math.round(remCOGS).toLocaleString()} remaining)`;
      setBlendedPill('kpi-food-cost-blended-sub', `
        <strong>Today's Food Cost Finish</strong>: ~$${Math.round(actCOGS).toLocaleString()} actual + ~$${Math.round(remCOGS).toLocaleString()} remaining (~$${Math.round(blendedCOGS).toLocaleString()} total day)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~$${Math.round(actCOGS).toLocaleString()} food cost on $${actSalesSoFar.toLocaleString()} sales</span> • 
        <span style="color:#10b981; font-weight:700;">29.5% Target Met</span>
      `);

      // 12. Average Ticket Revenue
      const liveAOV = bSum.actualOrdersSoFar > 0 ? (actSalesSoFar / bSum.actualOrdersSoFar).toFixed(2) : '48.50';
      if (aovUsdElem) aovUsdElem.textContent = `$${liveAOV}`;
      if (aovSubElem) aovSubElem.textContent = `($${actSalesSoFar.toLocaleString()} actual POS • ${bSum.actualOrdersSoFar} orders)`;
      setBlendedPill('kpi-aov-blended-sub', `
        <strong>Average Ticket So Far</strong>: $${liveAOV} per customer check<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: $${actSalesSoFar.toLocaleString()} POS revenue across ${bSum.actualOrdersSoFar} orders</span> • 
        <span style="color:${pColor}; font-weight:700;">Target: $48.50</span>
      `);

      // 13. Labor Hours
      const actLaborHours = Math.min(totalLaborHours, Math.round(elapsedHours * totalStaff * 10) / 10);
      const remLaborHours = Math.max(0, Math.round((totalLaborHours - actLaborHours) * 10) / 10);
      const blendedLaborHours = Math.round((actLaborHours + remLaborHours) * 10) / 10;
      if (laborHoursElem) laborHoursElem.textContent = totalLaborHours.toFixed(1);
      if (staffCountElem) staffCountElem.textContent = `(~${actLaborHours.toFixed(1)}h actual clocked • ~${remLaborHours.toFixed(1)}h remaining)`;
      setBlendedPill('kpi-labor-blended-sub', `
        <strong>Shift Labor Hours</strong>: ~${actLaborHours.toFixed(1)}h clocked so far + ~${remLaborHours.toFixed(1)}h remaining (${blendedLaborHours.toFixed(1)}h total roster)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actLaborHours.toFixed(1)} pit hours logged across ${totalStaff} crew</span> • 
        <span style="color:#a855f7; font-weight:700;">On Schedule</span>
      `);

      // 14. Revenue Card
      if (revenueElem) revenueElem.textContent = '$' + blendedTotalRev.toLocaleString();
      setBlendedPill('kpi-revenue-blended-sub', `
        <strong>Today's Projected Finish</strong>: $${actSalesSoFar.toLocaleString()} sold so far + $${remSales.toLocaleString()} needed to close<br>
        <span style="color: #cbd5e1;">Actual to ${h12}:00 ${ampm}: $${actSalesSoFar.toLocaleString()} (${bSum.actualOrdersSoFar} orders)</span> • 
        <span style="color: ${pColor}; font-weight: 700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // Real-time vs Target Prediction Comparison Badges with Serving Numbers & Plain English
      const revDiff = Math.round(blendedTotalRev - bSum.forecastFullDay);
      const revPct = bSum.forecastFullDay > 0 ? Math.round((revDiff / bSum.forecastFullDay) * 1000) / 10 : 0;
      const predOrders = Math.round(bSum.forecastFullDay / 48.50);
      const estBlendedOrders = Math.round(blendedTotalRev / 48.50);
      setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML(
        'Predicted Total', '$' + Math.round(bSum.forecastFullDay).toLocaleString(),
        'Measured + Proj', '$' + actSalesSoFar.toLocaleString() + ' sold (~$' + blendedTotalRev.toLocaleString() + ')',
        revDiff, '$', revPct, null,
        `Plain English: Model targeted ~${predOrders} customer orders; currently pacing toward ~${estBlendedOrders} day-end orders ($${actSalesSoFar.toLocaleString()} registered in POS so far).`
      ));

      const bDiff = blendedRawBrisket - bVal;
      const bPct = bVal > 0 ? Math.round((bDiff / bVal) * 1000) / 10 : 0;
      const predBPortions = Math.round(bCooked * 2.3);
      const actBPortions = Math.round(actCookedBrisket * 2.3);
      const estBPortions = Math.round(blendedCookedBrisket * 2.3);
      setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + bVal + ' lbs raw (~' + bCooked + '# ck)',
        'Measured Yield', '~' + Math.round(actCookedBrisket) + '# ck sold (~' + blendedRawBrisket + '# raw)',
        bDiff, 'lbs', bPct, null,
        `Plain English: ~${actBPortions} portions sliced (~${Math.round(actCookedBrisket)} lbs cooked) so far; tracking toward ~${estBPortions} day-end portions (~${blendedRawBrisket} lbs raw prep).`
      ));

      const pDiff = blendedRawPork - pVal;
      const pPct = pVal > 0 ? Math.round((pDiff / pVal) * 1000) / 10 : 0;
      const actPPortions = Math.round(actCookedPork * 2.0);
      const estPPortions = Math.round(blendedCookedPork * 2.0);
      setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + pVal + ' lbs raw (~' + pCooked + '# ck)',
        'Measured Yield', '~' + Math.round(actCookedPork) + '# ck sold (~' + blendedRawPork + '# raw)',
        pDiff, 'lbs', pPct, null,
        `Plain English: ~${actPPortions} pork sandwiches served (~${Math.round(actCookedPork)} lbs cooked) so far; tracking toward ~${estPPortions} day-end sandwiches.`
      ));

      const sDiff = blendedSausageLinks - sausageLinks;
      const sPct = sausageLinks > 0 ? Math.round((sDiff / sausageLinks) * 1000) / 10 : 0;
      setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML(
        'Predicted Total', sausageLinks + ' links (~' + sVal + ' lbs)',
        'Measured Yield', actSausageLinks + ' sold (~' + blendedSausageLinks + ' links)',
        sDiff, 'links', sPct, null,
        `Plain English: ${actSausageLinks} links sold at the counter so far; tracking toward ~${blendedSausageLinks} day-end links (${blendedSausageBatches} mixer batches).`
      ));

      const rDiff = blendedRibsRacks - rVal;
      const rPct = rVal > 0 ? Math.round((rDiff / rVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML(
        'Predicted Total', rVal + ' racks (~' + (rVal / 6.0).toFixed(1) + ' cs)',
        'Measured Yield', actRibsRacks + ' sold (~' + blendedRibsRacks + ' racks)',
        rDiff, 'racks', rPct, null,
        `Plain English: ${actRibsRacks} racks sold (${actRibsRacks * 12} individual bones) so far; tracking toward ~${blendedRibsRacks} day-end racks (~${(blendedRibsRacks / 6.0).toFixed(1)} cases).`
      ));

      const drDiff = blendedDinoRibs - drVal;
      const drPct = drVal > 0 ? Math.round((drDiff / drVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML(
        'Predicted Total', drVal + ' ribs (~' + (drVal / 12.0).toFixed(1) + ' cs)',
        'Measured Yield', actDinoRibs + ' sold (~' + blendedDinoRibs + ' ribs)',
        drDiff, 'ribs', drPct, null,
        `Plain English: ${actDinoRibs} jumbo plate ribs sold so far; tracking toward ~${blendedDinoRibs} day-end ribs.`
      ));

      const tDiff = Math.round(blendedTurkeyCooked - tVal);
      const tPct = tVal > 0 ? Math.round((tDiff / tVal) * 1000) / 10 : 0;
      const actTPortions = Math.round(actTurkeyCooked * 3.2);
      const estTPortions = Math.round(blendedTurkeyCooked * 3.2);
      setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML(
        'Predicted Total', tVal + ' lbs ck (~' + Math.round(tVal / 0.70) + '# raw)',
        'Measured Yield', '~' + Math.round(actTurkeyCooked) + '# sold (~' + Math.round(blendedTurkeyCooked) + '# ck)',
        tDiff, 'lbs', tPct, null,
        `Plain English: ~${actTPortions} carved plates sold so far; tracking toward ~${estTPortions} day-end portions (~${blendedTurkeyRaw} lbs raw prep).`
      ));

      const rbDiff = blendedRosebuds - rbVal;
      const rbPct = rbVal > 0 ? Math.round((rbDiff / rbVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML(
        'Predicted Total', rbVal + ' units',
        'Measured Yield', actRosebuds + ' sold (~' + blendedRosebuds + ' units)',
        rbDiff, 'units', rbPct, null,
        `Plain English: ${actRosebuds} bites sold (~${Math.round(actRosebuds / 4)} orders of 4) so far; tracking toward ~${blendedRosebuds} day-end bites from brisket burnt ends.`
      ));

      const tacoDiff = blendedTacos - tacoVal;
      const tacoPct = tacoVal > 0 ? Math.round((tacoDiff / tacoVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML(
        'Predicted Total', tacoVal + ' tacos',
        'Measured Yield', actTacos + ' sold (~' + blendedTacos + ' tacos)',
        tacoDiff, 'tacos', tacoPct, null,
        `Plain English: ${actTacos} tacos served so far; tracking toward ~${blendedTacos} day-end orders across shift.`
      ));

      const tcDiff = blendedTotalCooked - totalCooked;
      const tcPct = totalCooked > 0 ? Math.round((tcDiff / totalCooked) * 1000) / 10 : 0;
      setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + totalCooked + ' lbs ck (~' + totalRaw + '# raw)',
        'Measured Yield', '~' + actTotalCooked + '# sold (~' + blendedTotalCooked + '# ck)',
        tcDiff, 'lbs', tcPct, null,
        `Plain English: ~${actTotalCooked} lbs cooked barbecue drawn so far; tracking toward ~${blendedTotalCooked} lbs total hot-holding yield.`
      ));

      // Render Model Evaluation Banner for Live Service Day
      const evalBannerElem = document.getElementById('kpi-model-eval-banner');
      const evalPillElem = document.getElementById('model-eval-status-pill');
      const evalBodyElem = document.getElementById('model-eval-body');
      if (evalBannerElem && evalPillElem && evalBodyElem) {
        evalBannerElem.style.display = 'block';
        let statusClass = 'eval-pill-accurate';
        let statusTitle = 'Live Pacing on Track';
        let narrative = `Live service is progressing with <strong>${pSign}${bSum.pacingPct}% pacing</strong> against morning forecast. At ${h12}:00 ${ampm}, POS actuals totaled <strong>$${actSalesSoFar.toLocaleString()}</strong> across ${bSum.actualOrdersSoFar} orders (~$${actCOGS} COGS). The model projects ending the day at <strong>$${blendedTotalRev.toLocaleString()}</strong> (~$${Math.round(blendedCOGS)} total food cost).`;

        if (bSum.pacingPct > 15) {
          statusClass = 'eval-pill-drift';
          statusTitle = 'High-Demand Surge (+Pacing)';
          narrative = `Customer surge detected! Pit turnover is running <strong>+${bSum.pacingPct}% above</strong> baseline projections. Recommend monitoring brisket cutting board reserves to avoid premature sell-out before 9:00 PM closing.`;
        } else if (bSum.pacingPct < -15) {
          statusClass = 'eval-pill-drift';
          statusTitle = 'Midweek Pacing Lull';
          narrative = `Traffic is currently tracking <strong>${bSum.pacingPct}% below</strong> projected baseline. Kitchen staff can slow hot holding meat pulls to protect cooked yield and prevent unnecessary end-of-day waste.`;
        }

        evalPillElem.className = `eval-pill ${statusClass}`;
        evalPillElem.textContent = statusTitle;
        evalBodyElem.innerHTML = `
          <div class="model-eval-grid">
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Actual POS to Date</span>
              <span class="model-eval-stat-val" style="color:#f1c40f;">$${actSalesSoFar.toLocaleString()}</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Projected Day Total</span>
              <span class="model-eval-stat-val" style="color:#38bdf8;">$${blendedTotalRev.toLocaleString()}</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Model Variance Pacing</span>
              <span class="model-eval-stat-val" style="color:${pColor};">${pSign}${bSum.pacingPct}%</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Est. Meat COGS</span>
              <span class="model-eval-stat-val" style="color:#f59e0b;">~$${Math.round(actCOGS)} act / ~$${Math.round(blendedCOGS)} total</span>
            </div>
          </div>
          <div class="model-eval-narrative">
            ${narrative}
          </div>
        `;
      }

    } else {
      clearAllBlendedPills();

      if (brisketElem) brisketElem.textContent = bVal;
      if (porkElem) porkElem.textContent = pVal;
      if (sausageElem) sausageElem.textContent = sausageBatches;
      if (sausageLinksSub) sausageLinksSub.textContent = `(${sausageLinks} links / ${sVal} lbs)`;
      if (ribsElem) ribsElem.textContent = rVal;
      if (dinoElem) dinoElem.textContent = drVal;
      if (turkeyElem) turkeyElem.textContent = tVal;
      const tRaw = Math.round(tVal / 0.70);
      const tCases = (tRaw / 20.0).toFixed(1);
      const tPortions = Math.round(tVal * 3.2);
      if (turkeySubElem) turkeySubElem.textContent = `(~${tRaw} lbs raw / ~${tCases} cs / ~${tPortions} port)`;
      if (rosebudsElem) rosebudsElem.textContent = rbVal;
      if (rosebudsSubElem) rosebudsSubElem.textContent = '(Draws from Brisket)';
      if (tacosElem) tacosElem.textContent = tacoVal;
      if (tacosSubElem) tacosSubElem.textContent = '(Draws from Smoked Inventory)';
      if (totalCookedElem) totalCookedElem.textContent = totalCooked;
      if (totalCookedSub) totalCookedSub.textContent = `(~${totalRaw} lbs raw trim)`;

      if (bCasesElem) bCasesElem.textContent = `(~${(bVal / 70.0).toFixed(1)} Cases / ~${Math.ceil(bVal / 14.0)} Packers)`;
      if (pCasesElem) pCasesElem.textContent = `(~${(pVal / 32.0).toFixed(1)} Cases / ~${Math.ceil(pVal / 8.0)} Butts)`;
      if (bCookedElem) bCookedElem.textContent = `(~ ${Math.round(bVal * 0.4)} lbs cooked)`;
      if (pCookedElem) pCookedElem.textContent = `(~ ${Math.round(pVal * 0.44)} lbs cooked)`;
      if (rCasesElem) rCasesElem.textContent = `(~${(rVal / 6.0).toFixed(1)} Cases / ~${Math.ceil(rVal / 2.0)} Bags)`;
      if (drCasesElem) drCasesElem.textContent = `(~${(drVal / 12.0).toFixed(1)} Cases)`;

      if (laborHoursElem) laborHoursElem.textContent = totalLaborHours.toFixed(1);
      if (staffCountElem) staffCountElem.textContent = `(~${totalStaff} Staff / 8.5h Shift)`;
      if (cogsUsdElem) cogsUsdElem.textContent = `(~$${Math.round(totalCogs).toLocaleString()} COGS)`;
      if (aovUsdElem) aovUsdElem.textContent = '$48.50';
      if (aovSubElem) aovSubElem.textContent = '(Average Order Value)';

      if (revenueElem) revenueElem.textContent = '$' + Math.round(totalRev).toLocaleString();

      // Non-Blended (Historical / Multi-Day Horizon / Future Date) Comparison Badges
      const hasMeasuredActuals = isRangeSelected
        ? slicedRecords.some(r => r && (r.is_historical || (r.actual_revenue !== undefined && r.actual_revenue > 0)))
        : Boolean(matchedRecord && (matchedRecord.is_historical || (matchedRecord.actual_revenue !== undefined && matchedRecord.actual_revenue > 0)));

      if (hasMeasuredActuals) {
        let sumPredRev = 0, sumPredBRaw = 0, sumPredPRaw = 0, sumPredSLbs = 0, sumPredRRacks = 0, sumPredDRibs = 0, sumPredTCooked = 0, sumPredTacos = 0, sumPredRosebuds = 0;
        let sumActRev = 0, sumActBRaw = 0, sumActPRaw = 0, sumActSLbs = 0, sumActRRacks = 0, sumActDRibs = 0, sumActTCooked = 0, sumActTacos = 0, sumActRosebuds = 0;

        const recordsToSum = isRangeSelected ? slicedRecords : [matchedRecord || slicedRecords[0]];
        recordsToSum.forEach(r => {
          if (!r) return;
          // Predicted targets
          sumPredRev += (r.predicted_revenue !== undefined ? r.predicted_revenue : (r.actual_revenue || 0));
          sumPredBRaw += (r.predicted_brisket_raw_lbs !== undefined ? r.predicted_brisket_raw_lbs : (r.brisket_raw_lbs || 0));
          sumPredPRaw += (r.predicted_pork_raw_lbs !== undefined ? r.predicted_pork_raw_lbs : (r.pork_shoulder_raw_lbs || 0));
          sumPredSLbs += (r.predicted_sausage_lbs !== undefined ? r.predicted_sausage_lbs : (r.sausage_lbs || 0));
          sumPredRRacks += (r.predicted_pork_ribs_racks !== undefined ? r.predicted_pork_ribs_racks : (r.pork_ribs_racks || 0));
          sumPredDRibs += (r.predicted_beef_dino_ribs !== undefined ? r.predicted_beef_dino_ribs : (r.beef_dino_ribs || 0));
          sumPredTCooked += (r.predicted_turkey_cooked_lbs !== undefined ? r.predicted_turkey_cooked_lbs : (calcCalibratedTurkey(r).cooked));
          sumPredTacos += (r.predicted_tacos_sold !== undefined ? r.predicted_tacos_sold : (r.tacos_sold || 0));
          sumPredRosebuds += (r.predicted_rosebuds_sold !== undefined ? r.predicted_rosebuds_sold : (r.rosebuds_sold || 0));

          // Actual measured yields
          sumActRev += (r.actual_revenue !== undefined ? r.actual_revenue : (r.predicted_revenue || 0));
          sumActBRaw += (r.actual_brisket_raw_lbs !== undefined ? r.actual_brisket_raw_lbs : (r.brisket_raw_lbs || 0));
          sumActPRaw += (r.actual_pork_shoulder_raw_lbs !== undefined ? r.actual_pork_shoulder_raw_lbs : (r.pork_shoulder_raw_lbs || 0));
          sumActSLbs += (r.actual_sausage_lbs !== undefined ? r.actual_sausage_lbs : (r.sausage_lbs || 0));
          sumActRRacks += (r.actual_pork_ribs_racks !== undefined ? r.actual_pork_ribs_racks : (r.pork_ribs_racks || 0));
          sumActDRibs += (r.actual_beef_dino_ribs !== undefined ? r.actual_beef_dino_ribs : (r.beef_dino_ribs || 0));
          sumActTCooked += (r.actual_turkey_cooked_lbs !== undefined ? r.actual_turkey_cooked_lbs : calcCalibratedTurkey(r).cooked);
          sumActTacos += (r.actual_tacos_sold !== undefined ? r.actual_tacos_sold : (r.tacos_sold || 0));
          sumActRosebuds += (r.actual_rosebuds_sold !== undefined ? r.actual_rosebuds_sold : (r.rosebuds_sold || 0));
        });

        const pRevRound = Math.round(sumPredRev);
        const aRevRound = Math.round(sumActRev);
        const revDiff = aRevRound - pRevRound;
        const revPct = pRevRound > 0 ? Math.round((revDiff / pRevRound) * 1000) / 10 : 0;
        const pOrders = Math.round(pRevRound / 48.50);
        const aOrders = Math.round(aRevRound / 48.50);
        const aFoodCost = Math.round(aRevRound * 0.295);
        const pFoodCost = Math.round(pRevRound * 0.295);

        setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML(
          'Predicted Total', '$' + pRevRound.toLocaleString(),
          'Actual POS Total', '$' + aRevRound.toLocaleString(),
          revDiff, '$', revPct, null,
          `Plain English: Model predicted ${pOrders} customer orders ($${pRevRound.toLocaleString()}) vs ${aOrders} actual register orders ($${aRevRound.toLocaleString()}).`
        ));

        const pBRawRound = Math.round(sumPredBRaw);
        const aBRawRound = Math.round(sumActBRaw);
        const pBCooked = Math.round(pBRawRound * 0.4);
        const aBCooked = Math.round(aBRawRound * 0.4);
        const bDiff = aBRawRound - pBRawRound;
        const bPct = pBRawRound > 0 ? Math.round((bDiff / pBRawRound) * 1000) / 10 : 0;
        const pBPortions = Math.round(pBCooked * 2.3);
        const aBPortions = Math.round(aBCooked * 2.3);
        setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pBRawRound + ' lbs raw (~' + pBCooked + '# ck)',
          'Actual Measured', '~' + aBRawRound + ' lbs raw (~' + aBCooked + '# ck)',
          bDiff, 'lbs', bPct, null,
          `Plain English: Model targeted ~${pBPortions} sliced servings (~${pBRawRound} lbs raw) vs ~${aBPortions} actual portions served (~${aBCooked} lbs cooked).`
        ));

        const pPRawRound = Math.round(sumPredPRaw);
        const aPRawRound = Math.round(sumActPRaw);
        const pPCooked = Math.round(pPRawRound * 0.44);
        const aPCooked = Math.round(aPRawRound * 0.44);
        const pDiff = aPRawRound - pPRawRound;
        const pPct = pPRawRound > 0 ? Math.round((pDiff / pPRawRound) * 1000) / 10 : 0;
        const pPPortions = Math.round(pPCooked * 2.0);
        const aPPortions = Math.round(aPCooked * 2.0);
        setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pPRawRound + ' lbs raw (~' + pPCooked + '# ck)',
          'Actual Measured', '~' + aPRawRound + ' lbs raw (~' + aPCooked + '# ck)',
          pDiff, 'lbs', pPct, null,
          `Plain English: Model targeted ~${pPPortions} pork sandwiches (~${pPRawRound} lbs raw) vs ~${aPPortions} actual sandwiches served (~${aPCooked} lbs cooked).`
        ));

        const pSLinks = Math.round(sumPredSLbs * 3);
        const aSLinks = Math.round(sumActSLbs * 3);
        const sDiff = aSLinks - pSLinks;
        const sPct = pSLinks > 0 ? Math.round((sDiff / pSLinks) * 1000) / 10 : 0;
        setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML(
          'Predicted Target', pSLinks + ' links (~' + Math.round(sumPredSLbs) + ' lbs)',
          'Actual Measured', aSLinks + ' links (~' + Math.round(sumActSLbs) + ' lbs)',
          sDiff, 'links', sPct, null,
          `Plain English: Target ${pSLinks} links (${Math.ceil(pSLinks / 180)} batches) vs ${aSLinks} actual links sold at counter.`
        ));

        const pRRacks = Math.round(sumPredRRacks);
        const aRRacks = Math.round(sumActRRacks);
        const rDiff = aRRacks - pRRacks;
        const rPct = pRRacks > 0 ? Math.round((rDiff / pRRacks) * 1000) / 10 : 0;
        setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML(
          'Predicted Target', pRRacks + ' racks (~' + (pRRacks / 6.0).toFixed(1) + ' cs)',
          'Actual Measured', aRRacks + ' racks (~' + (aRRacks / 6.0).toFixed(1) + ' cs)',
          rDiff, 'racks', rPct, null,
          `Plain English: Target ${pRRacks} racks (~${pRRacks * 12} bones) vs ${aRRacks} actual racks served (~${aRRacks * 12} bones).`
        ));

        const pDRibs = Math.round(sumPredDRibs);
        const aDRibs = Math.round(sumActDRibs);
        const drDiff = aDRibs - pDRibs;
        const drPct = pDRibs > 0 ? Math.round((drDiff / pDRibs) * 1000) / 10 : 0;
        setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML(
          'Predicted Target', pDRibs + ' ribs (~' + (pDRibs / 12.0).toFixed(1) + ' cs)',
          'Actual Measured', aDRibs + ' ribs (~' + (aDRibs / 12.0).toFixed(1) + ' cs)',
          drDiff, 'ribs', drPct, null,
          `Plain English: Target ${pDRibs} dino plate ribs vs ${aDRibs} actual dino ribs sold.`
        ));

        const pTCooked = Math.round(sumPredTCooked);
        const aTCooked = Math.round(sumActTCooked);
        const tDiff = aTCooked - pTCooked;
        const tPct = pTCooked > 0 ? Math.round((tDiff / pTCooked) * 1000) / 10 : 0;
        const pTPortions = Math.round(pTCooked * 3.2);
        const aTPortions = Math.round(aTCooked * 3.2);
        setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML(
          'Predicted Target', pTCooked + ' lbs ck (~' + Math.round(pTCooked / 0.70) + '# raw)',
          'Actual Measured', aTCooked + ' lbs ck (~' + Math.round(aTCooked / 0.70) + '# raw)',
          tDiff, 'lbs', tPct, null,
          `Plain English: Target ~${pTPortions} carved plates (~${pTCooked} lbs cooked) vs ~${aTPortions} actual plates served (~${aTCooked} lbs cooked).`
        ));

        const pTacos = Math.round(sumPredTacos);
        const aTacos = Math.round(sumActTacos);
        const tacoDiff = aTacos - pTacos;
        const tacoPct = pTacos > 0 ? Math.round((tacoDiff / pTacos) * 1000) / 10 : 0;
        setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML(
          'Predicted Target', pTacos + ' tacos',
          'Actual Measured', aTacos + ' tacos',
          tacoDiff, 'tacos', tacoPct, null,
          `Plain English: Target ${pTacos} tacos vs ${aTacos} actual tacos sold across daily service.`
        ));

        const pRosebuds = Math.round(sumPredRosebuds);
        const aRosebuds = Math.round(sumActRosebuds);
        const rbDiff = aRosebuds - pRosebuds;
        const rbPct = pRosebuds > 0 ? Math.round((rbDiff / pRosebuds) * 1000) / 10 : 0;
        setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML(
          'Predicted Target', pRosebuds + ' units',
          'Actual Measured', aRosebuds + ' units',
          rbDiff, 'units', rbPct, null,
          `Plain English: Target ${pRosebuds} bites (~${Math.round(pRosebuds / 4)} orders of 4) vs ${aRosebuds} actual bites sold.`
        ));

        const pTotCooked = pBCooked + pPCooked;
        const aTotCooked = aBCooked + aPCooked;
        const tcDiff = aTotCooked - pTotCooked;
        const tcPct = pTotCooked > 0 ? Math.round((tcDiff / pTotCooked) * 1000) / 10 : 0;
        setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pTotCooked + ' lbs ck (~' + (pBRawRound + pPRawRound) + '# raw)',
          'Actual Measured', '~' + aTotCooked + ' lbs ck (~' + (aBRawRound + aPRawRound) + '# raw)',
          tcDiff, 'lbs', tcPct, null,
          `Plain English: Target ~${pTotCooked} lbs cooked meat yield vs ~${aTotCooked} lbs actual cooked barbecue sliced.`
        ));

        // Render End-of-Day Model Evaluation Banner for Historical Date
        const evalBannerElem = document.getElementById('kpi-model-eval-banner');
        const evalPillElem = document.getElementById('model-eval-status-pill');
        const evalBodyElem = document.getElementById('model-eval-body');
        if (evalBannerElem && evalPillElem && evalBodyElem) {
          evalBannerElem.style.display = 'block';
          const absRevPct = Math.abs(revPct);
          let statusClass = 'eval-pill-accurate';
          let statusText = 'Model Highly Accurate';
          let narrativeVerdict = '';

          if (absRevPct <= 5.0) {
            statusClass = 'eval-pill-accurate';
            statusText = `Model Accurate (${revPct >= 0 ? '+' : ''}${revPct}%)`;
            narrativeVerdict = `The forecasting model closely tracked end-of-day restaurant performance within a <strong>${absRevPct}% variance</strong>. Actual revenue of <strong>$${aRevRound.toLocaleString()}</strong> closely aligned with the predicted target of <strong>$${pRevRound.toLocaleString()}</strong>. Meat yield prep accurately covered all service demand with negligible waste.`;
          } else if (revDiff > 0) {
            statusClass = 'eval-pill-drift';
            statusText = `Under-Projected (+${revPct}%)`;
            narrativeVerdict = `Actual demand exceeded model predictions by <strong>+${revPct}% (+$${revDiff.toLocaleString()})</strong>. This indicates unexpected customer turnout or favorable event/weather surges. Kitchen yields stretched efficiently, maintaining food cost at approximately $${aFoodCost.toLocaleString()} on $${aRevRound.toLocaleString()} sales.`;
          } else {
            statusClass = 'eval-pill-drift';
            statusText = `Over-Projected (${revPct}%)`;
            narrativeVerdict = `Model targets ran <strong>${absRevPct}% above</strong> actual POS sales (-$${Math.abs(revDiff).toLocaleString()}). This variance typically reflects midweek lull patterns or weather dampening. Total actual food cost came in at $${aFoodCost.toLocaleString()} compared to the $${pFoodCost.toLocaleString()} baseline ceiling.`;
          }

          evalPillElem.className = `eval-pill ${statusClass}`;
          evalPillElem.textContent = statusText;
          evalBodyElem.innerHTML = `
            <div class="model-eval-grid">
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Model Predicted Revenue</span>
                <span class="model-eval-stat-val" style="color:#38bdf8;">$${pRevRound.toLocaleString()}</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Actual Measured POS</span>
                <span class="model-eval-stat-val" style="color:#f1c40f;">$${aRevRound.toLocaleString()}</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Total Day Variance</span>
                <span class="model-eval-stat-val" style="color:${revDiff >= 0 ? '#34d399' : '#f87171'};">${revDiff >= 0 ? '+' : ''}${revDiff.toLocaleString()} (${revPct >= 0 ? '+' : ''}${revPct}%)</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Actual Meat Food Cost</span>
                <span class="model-eval-stat-val" style="color:#f59e0b;">$${aFoodCost.toLocaleString()} (29.5%)</span>
              </div>
            </div>
            <div class="model-eval-narrative">
              ${narrativeVerdict}
            </div>
          `;
        }
      } else {
        setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML('Predicted Total', '$' + Math.round(totalRev).toLocaleString(), 'Actual Total', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Target $${Math.round(totalRev).toLocaleString()} sales across service (~${Math.round(totalRev / 48.50)} orders at $48.50 avg check).`));
        setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML('Predicted Target', '~' + bVal + ' lbs raw (~' + bCooked + '# ck)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Pull ~${Math.ceil(bVal / 14.0)} raw packers (~${bVal} lbs) to yield ~${bCooked} lbs sliced brisket (~${Math.round(bCooked * 2.3)} 7-oz servings).`));
        setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML('Predicted Target', '~' + pVal + ' lbs raw (~' + pCooked + '# ck)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Pull ~${Math.ceil(pVal / 8.0)} bone-in butts (~${pVal} lbs raw) to produce ~${pCooked} lbs pulled pork (~${Math.round(pCooked * 2.0)} 8-oz sandwiches).`));
        setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML('Predicted Target', sausageLinks + ' links (~' + sVal + ' lbs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Mix & stuff ${sausageBatches} batches (~${sausageLinks} links, 1/3-lb each).`));
        setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML('Predicted Target', rVal + ' racks (~' + (rVal / 6.0).toFixed(1) + ' cs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ${rVal} whole spare rib racks (~${rVal * 12} individual bones from ~${(rVal / 6.0).toFixed(1)} cases).`));
        setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML('Predicted Target', drVal + ' ribs (~' + (drVal / 12.0).toFixed(1) + ' cs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ${drVal} plate short ribs (~${(drVal / 12.0).toFixed(1)} cases). Pull in small batches to preserve bark.`));
        setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML('Predicted Target', tVal + ' lbs ck (~' + Math.round(tVal / 0.70) + '# raw)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ~${tVal} lbs cooked breast (~${Math.round(tVal / 0.70)} lbs raw prep) yielding ~${Math.round(tVal * 3.2)} 5-oz sliced plates.`));
        setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML('Predicted Target', rbVal + ' units', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Prep ${rbVal} bacon-wrapped brisket bites (~${Math.round(rbVal / 4)} orders of 4). Trims drawn from brisket burnt ends.`));
        setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML('Predicted Target', tacoVal + ' tacos', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Target ${tacoVal} tacos across daily service. Portions pulled from hot-holding brisket and pork bins.`));
        setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML('Predicted Target', '~' + totalCooked + ' lbs ck (~' + totalRaw + '# raw)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Total kitchen yield: ~${totalCooked} lbs hot-holding barbecue ready to carve from ~${totalRaw} lbs raw butcher trim.`));

        // Render Scheduled Horizon Banner
        const evalBannerElem = document.getElementById('kpi-model-eval-banner');
        const evalPillElem = document.getElementById('model-eval-status-pill');
        const evalBodyElem = document.getElementById('model-eval-body');
        if (evalBannerElem && evalPillElem && evalBodyElem) {
          evalBannerElem.style.display = 'block';
          evalPillElem.className = 'eval-pill eval-pill-match';
          evalPillElem.textContent = 'Upcoming Horizon';
          evalBodyElem.innerHTML = `
            <div class="model-eval-narrative">
              <strong>Future Service Operational Horizon</strong>: Scheduled prep projections are generated using MultiMeatForecaster (10% safety buffer). Kitchen prep should order and smoke according to the card targets. Plain-English measured variance audits will populate automatically as Clover POS transactions and scale weigh-ins are registered.
            </div>
          `;
        }
      }
    }

    // Update dynamic baseline trend card
    const baselineTrendElem = document.getElementById('dynamic-baseline-trend');
    if (baselineTrendElem) {
      let comparisonNote = '';
      const revLabel = matchedRecord.is_historical ? 'actual' : 'projected';
      const safeDay = escapeHTML(matchedRecord.day_name || shortDayStr);
      const safeDate = escapeHTML(matchedRecord.date || targetDateInput);
      const safeHorizon = isRangeSelected ? `${escapeHTML(startDateVal)} to ${escapeHTML(endDateVal)}` : `${safeDay}, ${safeDate}`;
      if (isTargetClosed) {
        comparisonNote = `Selected horizon (<strong>${safeDay}, ${safeDate}</strong>): Smokehouse <strong>Closed</strong> (weekly pit maintenance). Revenue and prep targets are 0.`;
      } else if (pctDiff > 0) {
        comparisonNote = `Selected horizon (<strong>${safeHorizon}</strong>): ${revLabel} revenue of <strong>$${totalRev.toLocaleString()}</strong> is <strong>${pctDiff}% above</strong> baseline (+$${Math.round(incrementalRev).toLocaleString()}).`;
      } else if (pctDiff < 0) {
        comparisonNote = `Selected horizon (<strong>${safeHorizon}</strong>): ${revLabel} revenue of <strong>$${totalRev.toLocaleString()}</strong> is <strong>${Math.abs(pctDiff)}% below</strong> baseline (-$${Math.abs(Math.round(incrementalRev)).toLocaleString()}).`;
      } else {
        comparisonNote = `Selected horizon (<strong>${safeHorizon}</strong>): ${revLabel} revenue of <strong>$${totalRev.toLocaleString()}</strong> aligns with operating baseline.`;
      }

      baselineTrendElem.innerHTML = `Operating baseline (Tue–Sun): <strong>$${baselineRev.toLocaleString()}/day</strong> (~${avgBrisketRaw} lbs raw / ~${avgBrisketCooked} lbs cooked brisket; ~${avgPorkRaw} lbs raw / ~${avgPorkCooked} lbs cooked pork). Weekdays (Tue–Thu) average <strong>~$${weekdayAvgRev.toLocaleString()}/day</strong>; weekends (Fri–Sun) average <strong>~$${weekendAvgRev.toLocaleString()}/day</strong>. Mondays closed for pit maintenance. ${comparisonNote}`;
    }

    if (demandPctElem) {
      demandPctElem.textContent = isTargetClosed ? '(Closed Today)' : `(${pctDisplay} vs Baseline)`;
    }
    if (demandLabelElem) {
      if (isTargetClosed) {
        demandLabelElem.textContent = `Smokehouse & Restaurant Closed Today (${matchedRecord.day_name || shortDayStr} Pit Maintenance & Prep). Zero service demand.`;
      } else {
        const surgeLabel = matchedRecord.is_historical ? 'Actual Sales' : (hasBlended ? "Today's Sales Pace" : 'Projected Sales');
        if (pctDiff > 0) {
          demandLabelElem.textContent = `${surgeLabel} Surge of +${pctDiff}% (+$${Math.round(incrementalRev).toLocaleString()}) above the $${baselineRev.toLocaleString()}/day operating baseline pace.`;
        } else if (pctDiff < 0) {
          demandLabelElem.textContent = `${surgeLabel} Drop of -${Math.abs(pctDiff)}% (-$${Math.abs(Math.round(incrementalRev)).toLocaleString()}) below the $${baselineRev.toLocaleString()}/day operating baseline pace.`;
        } else {
          demandLabelElem.textContent = `${surgeLabel} right on pace with the $${baselineRev.toLocaleString()}/day operating baseline.`;
        }
      }
    }

    if (!chartContainer) return;

    if (typeof Plotly !== 'undefined') {
      const dates = slicedRecords.map(r => r.day_name + ', ' + (r.date.length >= 10 ? r.date.substring(5).replace('-', '/') : r.date));
      
      let maxVal = 0;
      slicedRecords.forEach(r => {
          maxVal = Math.max(maxVal, r.brisket_raw_lbs || 0, r.pork_shoulder_raw_lbs || 0, r.sausage_lbs || 0, r.pork_ribs_racks || 0);
      });
      maxVal = maxVal * 1.15; // Give 15% headroom to prevent clipping

      let traces = [];
      let layout = {
        title: "Pit Production Targets: Raw vs. Cooked Yield Projections",
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(20,20,30,0.6)",
        font: { color: "#f8fafc", family: "Outfit, sans-serif" },
        xaxis: { gridcolor: "rgba(255,255,255,0.1)", tickangle: -45, automargin: true },
        yaxis: { title: "Target Volume", gridcolor: "rgba(255,255,255,0.1)", rangemode: "tozero" },
        margin: { l: 60, r: 40, t: 80, b: 80 },
        legend: { orientation: "h", y: -0.4, x: 0 },
        hovermode: "x unified",
        hoverlabel: { bgcolor: "rgba(15, 23, 42, 0.95)", font: { family: "Outfit, sans-serif" } }
      };

      if (selectedCat === 'brisket_lbs') {
        layout.title = "Pit Production Targets: Brisket (Raw vs Cooked Yield)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let bMax = 0;
        slicedRecords.forEach(r => bMax = Math.max(bMax, r.brisket_raw_lbs || 0));
        layout.yaxis.range = [0, Math.max(10, bMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.brisket_raw_lbs || 0),
          type: 'bar', name: 'Raw Brisket', marker: { color: '#e74c3c' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.brisket_raw_lbs || 0) * 0.4),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (40%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'pulled_pork_lbs') {
        layout.title = "Pit Production Targets: Pork Shoulder (Raw vs Cooked Yield)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let pMax = 0;
        slicedRecords.forEach(r => pMax = Math.max(pMax, r.pork_shoulder_raw_lbs || 0));
        layout.yaxis.range = [0, Math.max(10, pMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_shoulder_raw_lbs || 0),
          type: 'bar', name: 'Raw Pork', marker: { color: '#3498db' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.pork_shoulder_raw_lbs || 0) * 0.44),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (44%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'pork_ribs_racks') {
        layout.title = "Pit Production Targets: Pork Spare Ribs (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        let ribMax = 0;
        slicedRecords.forEach(r => ribMax = Math.max(ribMax, (r.pork_ribs_racks || 0) * 5));
        layout.yaxis.range = [0, Math.max(10, ribMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.pork_ribs_racks || 0) * 5),
          type: 'bar', name: 'Raw Weight (5 lbs/rack)', marker: { color: '#9b59b6' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => ((r.pork_ribs_racks || 0) * 5) * 0.6),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (60%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'beef_dino_ribs') {
        layout.title = "Pit Production Targets: Beef Dino Ribs (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        let dinoMax = 0;
        slicedRecords.forEach(r => dinoMax = Math.max(dinoMax, (r.beef_dino_ribs || 0) * 4));
        layout.yaxis.range = [0, Math.max(10, dinoMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.beef_dino_ribs || 0) * 4),
          type: 'bar', name: 'Raw Weight (4 lbs/rack)', marker: { color: '#8e44ad' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => ((r.beef_dino_ribs || 0) * 4) * 0.5),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (50%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'turkey_lbs') {
        layout.title = "Pit Production Targets: Smoked Turkey Breast (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        const getTurkeyData = (r) => {
          if (!r || r.is_closed || r.day_name === 'Mon') return { cooked: 0, raw: 0 };
          const baselines = { 'Tue': 6.2, 'Wed': 7.2, 'Thu': 7.0, 'Fri': 11.5, 'Sat': 12.9, 'Sun': 8.9 };
          const baseCooked = baselines[r.day_name] || 6.0;
          const rev = r.predicted_revenue || 0;
          const benchmark = ['Fri', 'Sat', 'Sun'].includes(r.day_name) ? 3500 : 2800;
          const revMultiplier = rev > 0 ? Math.min(1.10, Math.max(0.90, rev / benchmark)) : 1.0;
          const cookedDemand = baseCooked * revMultiplier;
          const cookedTarget = Math.round(cookedDemand * 1.10 * 10) / 10;
          const rawTarget = Math.round((cookedTarget / 0.70) * 10) / 10;
          return { cooked: cookedTarget, raw: rawTarget };
        };
        let turkeyMax = 0;
        slicedRecords.forEach(r => turkeyMax = Math.max(turkeyMax, getTurkeyData(r).raw));
        layout.yaxis.range = [0, Math.max(10, turkeyMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => getTurkeyData(r).raw),
          type: 'bar', name: 'Raw Turkey Breast (Prep)', marker: { color: '#e67e22' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => getTurkeyData(r).cooked),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Target Yield (70%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'sausage_links') {
        layout.title = "Pit Production Targets: Sausage Links";
        layout.yaxis.title = "Total Links";
        let sausageMax = 0;
        slicedRecords.forEach(r => sausageMax = Math.max(sausageMax, (r.sausage_lbs || 0) * 3));
        layout.yaxis.range = [0, Math.max(10, sausageMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.sausage_lbs || 0) * 3),
          type: 'bar', name: 'Sausage Links', marker: { color: '#f39c12' },
          hovertemplate: "%{y:.0f} Links<extra></extra>"
        });
      } else if (selectedCat === 'rosebuds_sold' || selectedCat === 'tacos_sold') {
        const isTaco = selectedCat === 'tacos_sold';
        layout.title = isTaco ? "Composed Item Demand: Tacos" : "Composed Item Demand: Rosebuds";
        layout.yaxis.title = "Total Units";
        let itemMax = 0;
        slicedRecords.forEach(r => itemMax = Math.max(itemMax, r[selectedCat] || 0));
        layout.yaxis.range = [0, Math.max(10, itemMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r[selectedCat] || 0),
          type: 'bar', name: isTaco ? 'Tacos' : 'Rosebuds', marker: { color: '#2ecc71' },
          hovertemplate: "%{y:.0f} Units<extra></extra>"
        });
      } else {
        layout.title = "Pit Production Targets: Total Core Meats (Raw lbs)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let tMax = 0;
        slicedRecords.forEach(r => tMax = Math.max(tMax, r.brisket_raw_lbs || 0, r.pork_shoulder_raw_lbs || 0, r.sausage_lbs || 0, r.pork_ribs_racks || 0));
        layout.yaxis.range = [0, Math.max(10, tMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.brisket_raw_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Brisket', line: { color: '#e74c3c', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_shoulder_raw_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Pork Shoulder', line: { color: '#3498db', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.sausage_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Sausage', line: { color: '#f1c40f', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_ribs_racks || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Pork Ribs (racks)', line: { color: '#9b59b6', width: 3, dash: 'dot' }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} racks<extra></extra>"
        });
      }
      
      // In-place chart update without destroying container DOM structure
      Plotly.react(chartContainer, traces, layout, getPlotlyConfig());
      applyChartTouchSafety(chartContainer);
    } else if (typeof renderD3ForecastingChart === 'function') {
      renderD3ForecastingChart('plotly-meat-sales-chart', slicedRecords, dashPayload ? dashPayload.anomalies : [], selectedCat);
      applyChartTouchSafety(chartContainer);
    }
  } catch (error) {
    console.error("Dashboard Rendering Error: ", error);
  }
}

function handleDateSelectionLookup(selectedDateStr) {
  if (!selectedDateStr || typeof selectedDateStr !== 'string') return;
  const d = parseValidDate(selectedDateStr);
  if (!d) return;
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', weekday: 'short' });

  const histCard = document.getElementById('historical-reference-card');
  if (!histCard) return;

  const dNow = new Date();
  const tzOffset = dNow.getTimezoneOffset() * 60000;
  const todayStr = (new Date(dNow.getTime() - tzOffset)).toISOString().split('T')[0];
  const isPast = selectedDateStr < todayStr;

  if (isPast) {
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
    } else if (dow === 0) { // Sunday
      if (demandVal) demandVal.textContent = '1.3x (Sunday Family Pack Run)';
      if (eventVal) eventVal.textContent = 'Sunday Smokehouse Service';
      if (weatherVal) weatherVal.textContent = '86°F | Heavy Rain (31.7mm)';
    } else { // Weekday
      if (demandVal) demandVal.textContent = '1.0x (Standard Baseline)';
      if (eventVal) eventVal.textContent = 'Regular Operations';
      if (weatherVal) weatherVal.textContent = '84°F | Normal';
    }
  } else {
    histCard.style.display = 'none';
  }

  if (typeof renderPlotlyPredictiveChart === 'function') {
    renderPlotlyPredictiveChart();
  }
}

async function renderPlotlyShiftHeatmap(shift) {
  const container = document.getElementById('plotly-shift-heatmap');
  if (!container) return;

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
      const res = await fetch('clover_api/analytics/shift_payload.json?v=' + Date.now());
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

window.renderAdvancedAnalytics = function() {
  const payload = window.BBQ_PAYLOADS?.advanced_payload;
  if (!payload) return;

  // 1. Market Basket
  if (payload.market_basket) {
    const basketList = document.getElementById('market-basket-list');
    if (basketList) {
      basketList.innerHTML = payload.market_basket.map(item => `<li><strong>${escapeHTML(item.pair)}</strong>: Bought together ${item.count} times (${item.confidence}% confidence)</li>`).join('');
    }
  }

  // 2. Interaction Modeling
  const interList = document.getElementById('interaction-list');
  if (interList) {
    const im = payload.interaction_modeling || {};
    interList.innerHTML = `
      <li><strong>Normal Day Avg:</strong> $${Number(im.normal || 0).toFixed(2)}</li>
      <li><strong>Jaguars Game (Ideal Weather):</strong> $${Number(im.game_only || 0).toFixed(2)}</li>
      <li><strong>Heavy Rain (No Event):</strong> $${Number(im.rain_only || 0).toFixed(2)}</li>
      <li><strong>Jaguars Game + Heavy Rain:</strong> $${Number(im.game_and_rain || 0).toFixed(2)}</li>
    `;
  }

  // 3. Order Type Segmentation
  const orderTypeList = document.getElementById('order-type-list');
  if (orderTypeList && Array.isArray(payload.order_type_segmentation)) {
    orderTypeList.innerHTML = `<ul>` + payload.order_type_segmentation.map(ot => 
      `<li><strong>${escapeHTML(ot.order_type || 'Unknown')}</strong>: ${ot.order_count || 0} orders, generating $${(ot.total_revenue || 0).toLocaleString()} (avg $${Number(ot.avg_ticket || 0).toFixed(2)}/ticket)</li>`
    ).join('') + `</ul>`;
  }

  // 5. Cannibalization
  const cannList = document.getElementById('cannibalization-list');
  if (cannList) {
    const cann = payload.cannibalization || {};
    cannList.innerHTML = `
      <li><strong>Avg Pork Ribs without Dino Ribs:</strong> ${cann.pork_ribs_avg_without_dino ?? '--'}</li>
      <li><strong>Avg Pork Ribs with Dino Ribs:</strong> ${cann.pork_ribs_avg_with_dino ?? '--'}</li>
      <li><strong>Impact on Pork Ribs:</strong> ${cann.impact_pct ?? 0}%</li>
    `;
  }

  // 6. Payday
  const paydayList = document.getElementById('payday-list');
  if (paydayList) {
    const pe = payload.payday_effect || {};
    paydayList.innerHTML = `
      <li><strong>Normal Avg Ticket:</strong> $${Number(pe.normal_avg_ticket || 0).toFixed(2)}</li>
      <li><strong>Payday Avg Ticket:</strong> $${Number(pe.payday_avg_ticket || 0).toFixed(2)}</li>
    `;
  }

  // 4. Sell-Out Chart
  const selloutChartElem = document.getElementById('plotly-sellout-chart');
  if (selloutChartElem && payload.sell_out_prediction_chart && payload.sell_out_prediction_chart.data) {
    Plotly.newPlot('plotly-sellout-chart', payload.sell_out_prediction_chart.data, payload.sell_out_prediction_chart.layout || {}, getPlotlyConfig());
    applyChartTouchSafety(selloutChartElem);
  } else if (selloutChartElem) {
    selloutChartElem.innerHTML = '<div style="color: #64748b; padding: 40px; text-align: center;">No Sell-Out Data Available</div>';
  }
};


function renderPlotlyNoData(containerId) {
  if (typeof d3 === 'undefined') return;
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '<div style="color: #64748b; padding: 40px; text-align: center;">No Data Available</div>';
}

async function renderPlotlyEventChart() {
  const container = document.getElementById('plotly-event-impact-chart');
  if (!container) return;

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
      const res = await fetch('clover_api/analytics/event_payload.json?v=' + Date.now());
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
      if (typeof Plotly !== 'undefined') {
        Plotly.newPlot('plotly-event-impact-chart', traces, layout, getPlotlyConfig());
        applyChartTouchSafety(container);
      }
      refreshEventsCalendar();
      return;
    }
  } catch (err) {
    console.log('Using embedded event chart dataset');
  }

  if (typeof Plotly !== 'undefined') {
    Plotly.newPlot('plotly-event-impact-chart', defaultEventTraces, defaultEventLayout, getPlotlyConfig());
    applyChartTouchSafety(container);
  }
  refreshEventsCalendar();
}

// Live Events & Multiplier Calendar State Management
const _now = new Date();
let currentCalYear = _now.getFullYear();
let currentCalMonth = _now.getMonth();
let currentCalFilter = 'all';
let selectedCalDate = _now.toISOString().split('T')[0];
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
  if (!container) return;

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
      const res = await fetch('clover_api/analytics/weather_payload.json?v=' + Date.now());
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

      if (typeof Plotly !== 'undefined') {
        Plotly.newPlot('plotly-weather-impact-chart', traces, layout, getPlotlyConfig());
        applyChartTouchSafety(container);
      } else if (typeof d3 !== 'undefined') {
        renderD3GenericChart('plotly-weather-impact-chart', traces, layout.title);
        applyChartTouchSafety(container);
      }
      return;
    }
  } catch (err) {
    console.log('Using embedded weather chart dataset');
  }

  if (typeof Plotly !== 'undefined') {
    Plotly.newPlot('plotly-weather-impact-chart', defaultWeatherTraces, defaultWeatherLayout, getPlotlyConfig());
    applyChartTouchSafety(container);
  }
}

async function renderPlotlyPredictiveChart() {
  const chartElem = document.getElementById('plotly-predictive-velocity-chart');
  if (!chartElem) return;

  let payload = null;
  try {
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.predictive_payload) {
      payload = window.BBQ_PAYLOADS.predictive_payload;
    } else {
      const res = await fetch('clover_api/analytics/predictive_payload.json?v=' + Date.now());
      if (res.ok) payload = await res.json();
    }
  } catch (e) {
    console.warn('Could not load predictive payload:', e);
  }

  if (!payload || !payload.hourly_forecast) return;

  // Inspect currently active start date and end date
  const startDateInput = document.getElementById('forecast-start-date');
  const endDateInput = document.getElementById('forecast-end-date');
  const startDateVal = startDateInput ? startDateInput.value : '';
  const endDateVal = endDateInput ? endDateInput.value : '';

  let activeForecast = payload.hourly_forecast;
  let activeDirectives = payload.operational_directives;
  let activeKpis = payload.summary_kpis;
  let chartTitle = '24-Hour Real-Time Sales Velocity & Smoked Meat Draw Rate';

  if (payload.day_profiles && startDateVal) {
    const parts = startDateVal.split('-').map(Number);
    const startObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayName = startObj.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDay = startObj.toLocaleDateString('en-US', { weekday: 'short' });

    let daysCount = 1;
    if (endDateVal && endDateVal !== startDateVal) {
      const endParts = endDateVal.split('-').map(Number);
      const endObj = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      daysCount = Math.max(1, Math.round((endObj - startObj) / 86400000) + 1);
    }

    if (daysCount === 1) {
      const profile = payload.day_profiles[dayName] || payload.day_profiles[shortDay] || payload.day_profiles[dayName.toLowerCase()];
      if (profile) {
        activeForecast = profile.hourly_forecast;
        activeDirectives = profile.operational_directives;
        activeKpis = {
          current_sales_velocity: profile.current_sales_velocity,
          pacing_status: profile.pacing_status,
          estimated_food_cost_pct: profile.estimated_food_cost_pct,
          projected_24h_revenue_usd: profile.projected_revenue_usd,
          peak_rush_window: profile.peak_rush_window,
          total_brisket_draw_lbs: profile.total_brisket_draw_lbs,
          total_pork_draw_lbs: profile.total_pork_draw_lbs
        };
        chartTitle = `${dayName} Hourly Sales Velocity & Smoked Meat Draw Rate (${startDateVal})`;
      }
    } else {
      // Multi-day range (e.g. 3-day weekend or custom range, capped at 7 days for readable chart)
      const rangeHours = [];
      let totalRev = 0;
      let totalCogs = 0;
      let totalBrisket = 0;
      let totalPork = 0;
      let maxOrders = 0;
      let peakHourStr = '';

      const renderDays = Math.min(daysCount, 7);
      for (let i = 0; i < renderDays; i++) {
        const curDate = new Date(startObj);
        curDate.setDate(curDate.getDate() + i);
        const curDayName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
        const curShortDay = curDate.toLocaleDateString('en-US', { weekday: 'short' });
        const profile = payload.day_profiles[curDayName] || payload.day_profiles[curShortDay];
        if (profile && profile.hourly_forecast) {
          profile.hourly_forecast.forEach(r => {
            if (r.predicted_orders > maxOrders) {
              maxOrders = r.predicted_orders;
              peakHourStr = `${r.hour_display} (${curShortDay})`;
            }
            totalRev += (r.predicted_revenue || 0);
            totalCogs += (r.estimated_cogs_usd || 0);
            totalBrisket += (r.brisket_cooked_lbs || 0);
            totalPork += (r.pork_cooked_lbs || 0);
            rangeHours.push({
              ...r,
              hour_display: `${r.hour_display} (${curShortDay})`,
              day_name: curShortDay
            });
          });
        }
      }

      if (rangeHours.length > 0) {
        activeForecast = rangeHours;
        const avgFoodCost = totalRev > 0 ? (totalCogs / totalRev * 100).toFixed(1) : '29.5';
        activeKpis = {
          current_sales_velocity: `${maxOrders.toFixed(1)} orders/hr (Peak)`,
          pacing_status: maxOrders >= 10.0 ? 'Heavy Rush Surge' : 'Normal Pacing',
          estimated_food_cost_pct: avgFoodCost,
          projected_24h_revenue_usd: Math.round(totalRev),
          peak_rush_window: peakHourStr,
          total_brisket_draw_lbs: totalBrisket.toFixed(1),
          total_pork_draw_lbs: totalPork.toFixed(1)
        };
        activeDirectives = [
          `Peak Customer Flow: Expected around ${peakHourStr} reaching ~${maxOrders.toFixed(1)} orders/hr across the ${daysCount}-day window.`,
          `Meat Depletion Pacing: Projected cumulative draw of ~${totalBrisket.toFixed(1)} lbs smoked brisket and ~${totalPork.toFixed(1)} lbs pulled pork from hot storage.`,
          `Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.`,
          `Smoker Pacing: Balance smoke pit reload intervals to maintain continuous hot holding capacity.`
        ];
        chartTitle = `${daysCount}-Day Hourly Sales Velocity & Smoked Meat Draw Rate (${startDateVal} to ${endDateVal})`;
      }
    }
  }

  // Hydrate Crucial Top-Shelf KPIs without overwriting live blended POS actuals
  const kpiVelocity = document.getElementById('kpi-current-velocity');
  const kpiPacing = document.getElementById('kpi-pacing-status');
  const kpiFoodCost = document.getElementById('kpi-food-cost-pct');
  const kpiAov = document.getElementById('kpi-aov-usd');
  const kpiAovSub = document.getElementById('kpi-aov-sub');

  const velBlendedPill = document.getElementById('kpi-velocity-blended-sub');
  const hasActiveBlendedKPIs = Boolean(velBlendedPill && velBlendedPill.style.display === 'block' && velBlendedPill.innerHTML.trim() !== '');

  if (activeKpis) {
    if (kpiFoodCost) kpiFoodCost.textContent = `${activeKpis.estimated_food_cost_pct || 29.5}%`;
    if (!hasActiveBlendedKPIs) {
      if (kpiVelocity) kpiVelocity.textContent = activeKpis.current_sales_velocity || '--';
      if (kpiPacing) kpiPacing.textContent = `(${activeKpis.pacing_status || 'Normal'})`;
      if (kpiAov) {
        if (activeKpis.pacing_status === 'Closed' || activeKpis.current_sales_velocity === '0 orders/hr (Closed)') {
          kpiAov.textContent = '$0.00';
          if (kpiAovSub) kpiAovSub.textContent = '(Closed / 0 Orders)';
        } else {
          const aovVal = activeKpis.average_ticket_usd || 48.50;
          kpiAov.textContent = `$${Number(aovVal).toFixed(2)}`;
          if (kpiAovSub) kpiAovSub.textContent = '(Average Order Value)';
        }
      }
    }
  }

  // Hydrate Directives
  const directivesList = document.getElementById('predictive-directives-list');
  if (directivesList && Array.isArray(activeDirectives)) {
    const safeDirectives = activeDirectives.map(d => escapeHTML(d));
    if (activeKpis && activeKpis.recommended_staff !== undefined && activeKpis.pitmaster_hours !== undefined) {
      safeDirectives.push(`Labor &amp; Shift Coverage: Recommended roster of <strong>${escapeHTML(activeKpis.recommended_staff)} crew members</strong> (~${escapeHTML(activeKpis.pitmaster_hours)} total kitchen/pit hours at 8.5h shift) to cover peak throughput.`);
    }
    directivesList.innerHTML = safeDirectives.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('');
  }

  const hours = activeForecast.map(r => r.hour_display ? `${r.hour_display}` : `${r.hour}:00`);
  const orders = activeForecast.map(r => r.predicted_orders);
  const revenue = activeForecast.map(r => r.predicted_revenue);
  const brisketDraw = activeForecast.map(r => r.brisket_cooked_lbs);

  const traces = [
    {
      x: hours,
      y: orders,
      name: 'Order Velocity (Orders/hr)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#3b82f6', width: 3 },
      marker: { size: 6 }
    },
    {
      x: hours,
      y: brisketDraw,
      name: 'Smoked Brisket Draw (lbs/hr)',
      type: 'bar',
      yaxis: 'y2',
      marker: { color: '#e67e22', opacity: 0.7 }
    }
  ];

  // Hourly actuals overlay (single shop-local date, past or today)
  const summaryElem = document.getElementById('hourly-actuals-summary');
  if (summaryElem) { summaryElem.style.display = 'none'; summaryElem.textContent = ''; }
  try {
    const effDate = window.ShopTime ? window.ShopTime.getEffectiveNow() : new Date();
    const pickedDate = startDateVal || (window.ShopTime ? window.ShopTime.shopDateStr(effDate) : '');
    const isSingleDay = !endDateVal || endDateVal === startDateVal || !startDateVal;
    
    let actuals = null;
    let snapshots = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.hourly_actuals) {
      actuals = window.BBQ_PAYLOADS.hourly_actuals;
      snapshots = window.BBQ_PAYLOADS.forecast_snapshots || null;
    } else {
      const aRes = await fetch('clover_api/analytics/hourly_actuals.json?v=' + Date.now());
      if (aRes.ok) actuals = await aRes.json();
      const sRes = await fetch('clover_api/analytics/forecast_snapshots.json?v=' + Date.now());
      if (sRes.ok) snapshots = await sRes.json();
    }

    if (window.ShopTime && pickedDate && isSingleDay && activeForecast.every(r => r.hour !== undefined)) {
      const overlay = window.ShopTime.buildActualsOverlay(actuals, snapshots, pickedDate, activeForecast, effDate);
      if (overlay) {
        if (overlay.baselineOrders) {
          traces.push({
            x: hours, y: overlay.baselineOrders, name: 'Baseline (avg same weekday, reconstructed)',
            type: 'scatter', mode: 'lines', line: { color: '#94a3b8', width: 2, dash: 'dot' }
          });
        }
        if (overlay.snapshotOrders) {
          traces.push({
            x: hours, y: overlay.snapshotOrders, name: 'Forecast as predicted that day',
            type: 'scatter', mode: 'lines', line: { color: '#a78bfa', width: 2, dash: 'dash' }
          });
        }
        if (overlay.hasActuals) {
          traces.push({
            x: hours, y: overlay.actualOrders, name: 'Actual Orders/hr (POS)',
            type: 'scatter', mode: 'lines+markers', connectgaps: false,
            line: { color: '#22c55e', width: 3 }, marker: { size: 7 }
          });
        }
        if (summaryElem) {
          const s = overlay.summary;
          const money = v => '$' + Math.round(v).toLocaleString('en-US');
          if (!overlay.hasActuals) {
            summaryElem.textContent = `No POS records for ${overlay.date}.`;
          } else if (overlay.isToday) {
            summaryElem.textContent = `Today so far (through hour ${overlay.cutoffHour}:00 ET, as of last sync): ${money(s.actualSales)} actual (${s.actualOrders} orders) vs ${money(s.forecastToHour)} forecast to this hour; full-day forecast ${money(s.forecastFullDay)}.`;
          } else {
            summaryElem.textContent = `${overlay.date}: ${money(s.actualSales)} actual (${s.actualOrders} orders) vs ${money(s.forecastFullDay)} forecast total.`;
          }
          summaryElem.style.display = 'block';
        }
      }
    }

    // Hydrate Hourly Rush & Service Turnover Deck
    if (actuals && Array.isArray(activeForecast)) {
      renderHourlyTurnoverDeck(activeForecast, actuals, effDate, isOperatingHoursFiltered);
    }
  } catch (e) {
    console.warn('Hourly actuals overlay unavailable:', e);
  }

  const layout = {
    title: chartTitle,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(20,20,30,0.6)',
    font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 11 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.1)', tickangle: -45 },
    yaxis: { title: 'Order Velocity (Orders/hr)', gridcolor: 'rgba(255,255,255,0.1)' },
    yaxis2: {
      title: 'Cooked Brisket Depleted (lbs/hr)',
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      titlefont: { color: '#e67e22' },
      tickfont: { color: '#e67e22' }
    },
    legend: { orientation: 'h', y: -0.3, x: 0 },
    margin: { l: 50, r: 50, t: 40, b: 90 }
  };

  if (typeof Plotly !== 'undefined') {
    Plotly.newPlot('plotly-predictive-velocity-chart', traces, layout, getPlotlyConfig());
    applyChartTouchSafety(chartElem);
  }
}

let isOperatingHoursFiltered = true;

function renderHourlyTurnoverDeck(activeForecast, actuals, effectiveNow, filterOperatingHours = isOperatingHoursFiltered) {
  const container = document.getElementById('hourly-turnover-deck');
  if (!container) return;

  const effNow = effectiveNow || (window.ShopTime ? window.ShopTime.getEffectiveNow() : new Date());
  
  const startDateInput = document.getElementById('forecast-start-date');
  const targetDateStr = startDateInput && startDateInput.value ? startDateInput.value : (window.ShopTime ? window.ShopTime.shopDateStr(effNow) : '');

  if (!window.ShopTime || typeof window.ShopTime.computeBlendedDayMetrics !== 'function') {
    container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">Turnover metrics engine loading...</div>';
    return;
  }

  const result = window.ShopTime.computeBlendedDayMetrics(actuals, activeForecast, effNow, targetDateStr);
  if (!result || !Array.isArray(result.hourly)) {
    container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">No hourly records available for turnover deck.</div>';
    return;
  }

  const operatingHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const list = filterOperatingHours
    ? result.hourly.filter(h => operatingHours.includes(h.hour))
    : result.hourly;

  if (list.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">No operating hours match current filter.</div>';
    return;
  }

  const html = list.map(item => {
    let cardClass = 'turnover-card card-predicted';
    let badgeHtml = '<span class="turnover-badge badge-predicted">Projected</span>';
    let mainMetricHtml = '';
    let subMetricHtml = '';

    const pRev = Math.round(item.predictedRevenue);
    const pOrders = item.predictedOrders;
    const aRev = Math.round(item.actualSales);
    const aOrders = item.actualOrders;

    if (item.status === 'actual') {
      cardClass = 'turnover-card card-actual';
      badgeHtml = '<span class="turnover-badge badge-actual">POS Actual</span>';
      const vSign = item.varianceSales >= 0 ? '+' : '';
      const vClass = item.varianceSales >= 0 ? 'pill-positive' : 'pill-negative';
      mainMetricHtml = `
        <div class="turnover-metric-main">$${aRev.toLocaleString()}</div>
        <div class="turnover-sub">${aOrders} POS Orders</div>
      `;
      subMetricHtml = `
        <div class="turnover-sub">
          Model: $${pRev.toLocaleString()} (${pOrders} ord)<br>
          <span class="${vClass}">${vSign}$${Math.round(item.varianceSales).toLocaleString()} (${vSign}${item.variancePct}%)</span>
        </div>
      `;
    } else if (item.status === 'live') {
      cardClass = 'turnover-card card-live';
      badgeHtml = '<span class="turnover-badge badge-live">Live Pacing</span>';
      mainMetricHtml = `
        <div class="turnover-metric-main">$${aRev.toLocaleString()}</div>
        <div class="turnover-sub">${aOrders} orders so far</div>
      `;
      subMetricHtml = `
        <div class="turnover-sub">
          Target: $${pRev.toLocaleString()} (${pOrders} ord)<br>
          <span style="color:#fbbf24; font-weight:600;">Current Active Hour</span>
        </div>
      `;
    } else {
      cardClass = 'turnover-card card-predicted';
      badgeHtml = '<span class="turnover-badge badge-predicted">Projected</span>';
      mainMetricHtml = `
        <div class="turnover-metric-main">$${pRev.toLocaleString()}</div>
        <div class="turnover-sub">~${pOrders} projected orders</div>
      `;
      subMetricHtml = `
        <div class="turnover-sub">
          Cooked Meat Draw Target:<br>
          <span style="color:#f59e0b; font-weight:600;">~${item.brisketCookedLbs} lbs Brisket</span> • 
          <span style="color:#cbd5e1;">~${item.porkCookedLbs} lbs Pork</span>
        </div>
      `;
    }

    let rushTag = '';
    if (item.hour === 12 || item.hour === 13) rushTag = ' • Lunch Rush';
    else if (item.hour === 18 || item.hour === 19) rushTag = ' • Dinner Rush';

    return `
      <div class="${cardClass}" data-hour="${item.hour}">
        <div class="turnover-card-header">
          <span class="turnover-hour-title">${item.hourDisplay}${rushTag}</span>
          ${badgeHtml}
        </div>
        ${mainMetricHtml}
        ${subMetricHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function setupTimeTravelControls() {
  const slider = document.getElementById('time-travel-slider');
  const badge = document.getElementById('time-travel-badge');
  const currentLabel = document.getElementById('time-travel-current-label');
  const btnLunch = document.getElementById('sim-btn-lunch');
  const btnRush = document.getElementById('sim-btn-rush');
  const btnPostrush = document.getElementById('sim-btn-postrush');
  const btnReset = document.getElementById('sim-btn-reset');
  const btnOperating = document.getElementById('btn-turnover-operating');
  const btnAll = document.getElementById('btn-turnover-all');

  function updateSimulatorUI() {
    if (!window.ShopTime) return;
    const isSim = window.ShopTime.isSimulating();
    const effNow = window.ShopTime.getEffectiveNow();
    const currentHour = window.ShopTime.shopHour(effNow);
    const dateStr = window.ShopTime.shopDateStr(effNow);

    if (slider) {
      slider.value = currentHour;
    }

    const h12 = currentHour === 0 ? 12 : (currentHour > 12 ? currentHour - 12 : currentHour);
    const ampm = currentHour >= 12 ? 'PM' : 'AM';

    if (badge) {
      if (isSim) {
        badge.className = 'badge-sim-pulse';
        badge.textContent = `⚡ Simulated: ${h12}:00 ${ampm} ET`;
      } else {
        badge.className = 'badge-live-pulse';
        badge.textContent = '● Live America/New_York';
      }
    }

    if (currentLabel) {
      if (isSim) {
        currentLabel.innerHTML = `Simulated Cutoff Hour: <strong>${h12}:00 ${ampm} ET</strong> (${dateStr})`;
      } else {
        currentLabel.innerHTML = `Clock Status: <strong>Live Mode (${h12}:${String(effNow.getMinutes()).padStart(2, '0')} ${ampm} ET)</strong>`;
      }
    }

    if (typeof renderPlotlyForecastingChart === 'function') {
      renderPlotlyForecastingChart(getActiveDaysCount());
    }
    if (typeof renderPlotlyPredictiveChart === 'function') {
      renderPlotlyPredictiveChart();
    }
  }

  function setSimHour(hour) {
    if (!window.ShopTime) return;
    const targetDateInput = document.getElementById('forecast-start-date')?.value;
    const targetDateStr = targetDateInput || window.ShopTime.shopDateStr();
    const simDate = typeof window.ShopTime.createShopInstant === 'function'
      ? window.ShopTime.createShopInstant(targetDateStr, hour)
      : new Date(new Date(targetDateStr + 'T12:00:00').setHours(hour, 0, 0, 0));
    window.ShopTime.setSimulatedNow(simDate);
    updateSimulatorUI();
  }

  if (slider) {
    slider.addEventListener('input', (e) => {
      const h = parseInt(e.target.value, 10);
      setSimHour(h);
    });
  }

  if (btnLunch) btnLunch.addEventListener('click', () => setSimHour(12));
  if (btnRush) btnRush.addEventListener('click', () => setSimHour(19));
  if (btnPostrush) btnPostrush.addEventListener('click', () => setSimHour(20));
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (window.ShopTime) window.ShopTime.clearSimulatedNow();
      updateSimulatorUI();
    });
  }

  if (btnOperating && btnAll) {
    btnOperating.addEventListener('click', () => {
      btnOperating.classList.add('active');
      btnAll.classList.remove('active');
      isOperatingHoursFiltered = true;
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    });
    btnAll.addEventListener('click', () => {
      btnAll.classList.add('active');
      btnOperating.classList.remove('active');
      isOperatingHoursFiltered = false;
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    });
  }

  updateSimulatorUI();
}

// Ensure predictive KPIs hydrate on initial page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof renderPlotlyPredictiveChart === 'function') {
      renderPlotlyPredictiveChart();
    }
  }, 300);
});



