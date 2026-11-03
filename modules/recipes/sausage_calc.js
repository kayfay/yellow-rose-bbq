/**
 * Yellow Rose BBQ — Sausage Formulation & Mobile Kitchen Prep Module
 * Manages all 10 custom 50 lb sausage formulations, batch weight scaling,
 * 3.0 links/lb yield math, interactive Day 1 / Day 2 mobile kitchen checklist,
 * and localStorage persistence.
 */
(function (global) {
  'use strict';

  global.BBQModules = global.BBQModules || {};

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
  const urlParams = new URLSearchParams(global.location ? global.location.search : '');
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
        8: 'Mix lean beef and beef fat thoroughly with Day 1 cure.',
        9: 'Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.',
        11: 'Fold in powdered milk and ice water until sticky.'
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
        8: 'Thoroughly strain all brine juice out of the pickled/spiced jalapeños, then medium-dice.',
        9: 'Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.',
        11: 'Incorporate the remaining ice water, high-temp cheddar cheese cubes, and the completely dry jalapeño dice.'
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
        8: 'Whisk the first half of prepped ice water with Powdered Milk and Coarse Black Pepper.',
        9: 'Mix lean meat, pork, and fat with Day 1 cure.',
        11: 'Incorporate the remaining ice water until the mixture binds properly.'
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
        8: 'Thoroughly strain liquid from the smoked corn pico/elote; fine-dice onions and chop fresh cilantro.',
        9: 'Whisk the first half of prepped ice water with Powdered Milk, black pepper, cilantro, and onions.',
        11: 'Incorporate the remaining ice water, parmesan cheese, and well-drained smoked corn pico.'
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
        8: 'Chop fresh cilantro and fine-dice onions; measure chilled Salsa Verde liquid binder and melty cheese cubes.',
        9: 'Whisk the Salsa Verde liquid binder into the first half of ice water with Powdered Milk, cilantro, and onions.',
        11: 'Incorporate the remaining ice water and melty cheese cubes evenly into the grind.'
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
        8: 'Dice cream cheese while semi-frozen so cubes hold shape; chop cooked bacon into uniform bits.',
        9: 'Whisk the first half of prepped ice water with Honey, Signature BBQ Rub, and Powdered Milk.',
        11: 'Carefully fold in remaining ice water, crispy bacon bits, and chilled firm cream cheese cubes.'
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
        8: 'Ensure sautéed minced garlic is completely chilled before mixing to prevent fat melting.',
        9: 'Whisk the first half of prepped ice water with Powdered Milk, Signature BBQ Rub, and cooled minced garlic.',
        11: 'Incorporate the remaining ice water and the parmesan cheese into the meat paste.'
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
        8: 'Thoroughly drain and press all moisture out of sautéed cabbage, then chill along with garlic and bacon bits.',
        9: 'Whisk the first half of prepped ice water with Powdered Milk, black pepper, and chilled minced garlic.',
        11: 'Incorporate the remaining ice water, cooked bacon bits, and well-drained sautéed cabbage.'
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
        8: 'Chop shredded birria meat fine and chill; ensure reduced birria consommé is cold before mixing.',
        9: 'Whisk the chilled birria consommé into the first half of ice water with Powdered Milk, garlic, and diced onions.',
        11: 'Incorporate the remaining ice water, birria meat, and melty cheese cubes evenly.'
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
        8: 'Whisk the first half of prepped ice water with the Apple Cider Vinegar and spices to form a slurry.',
        9: 'Mix the Day 1 slurry into the meat block and cure overnight.',
        11: 'Whisk Non-Fat Dry Milk Powder into the remaining ice water (Day 2) and incorporate into the emulsion.'
      }
    }
  };

  function formatCups(rawCups) {
    if (rawCups === 0) return { val: '0', unit: 'cups' };
    let cups = Math.floor(rawCups);
    const remainderCups = rawCups - cups;
    const totalTbsp = remainderCups * 16;
    let tbsp = Math.floor(totalTbsp);
    const remainderTbsp = totalTbsp - tbsp;
    let tsp = Math.round(remainderTbsp * 3);

    if (tsp >= 3) {
      tbsp += Math.floor(tsp / 3);
      tsp = tsp % 3;
    }
    if (tbsp >= 16) {
      cups += Math.floor(tbsp / 16);
      tbsp = tbsp % 16;
    }

    const parts = [];
    if (cups > 0) parts.push(`${cups} cup${cups > 1 ? 's' : ''}`);
    if (tbsp > 0) parts.push(`${tbsp} tbsp`);
    if (tsp > 0) parts.push(`${tsp} tsp`);

    let resultStr = parts.join(' + ');
    if (resultStr === '') resultStr = '0';
    return { val: resultStr, unit: '' };
  }

  function sanitizeState(obj) {
    if (!obj.recipeId || !RECIPES[obj.recipeId]) obj.recipeId = 'jalapeno-cheddar';
    if (obj.weight === undefined) obj.weight = 50.0;
    obj.weight = parseFloat(obj.weight);
    if (isNaN(obj.weight)) obj.weight = 50.0;
    if (obj.beefWeight === undefined) obj.beefWeight = 50.0;
    if (obj.beefRatio === undefined) obj.beefRatio = 0.70;
    if (!Array.isArray(obj.tasks) || obj.tasks.length < 15) {
      obj.tasks = Array(15).fill(false);
    }
    return obj;
  }

  function loadLocalState() {
    try {
      const local = localStorage.getItem(`sausage_run_${sessionName}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.weight && Array.isArray(parsed.tasks)) {
          state = sanitizeState(parsed);
        }
      }
    } catch (e) {
      console.error('Error parsing local state', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
    } catch (_e) {
      // Ignore storage quota errors in private browsing
    }
  }

  function renderRecipePills() {
    const recipePillsContainer = document.getElementById('recipe-pills');
    if (!recipePillsContainer) return;
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

  function adjustWeight(amount) {
    const weightSlider = document.getElementById('weight-slider');
    let target = parseFloat(state.weight) + amount;
    if (target < 5) target = 5;
    if (target > 150) target = 150;
    state.weight = target;
    state.lastUpdated = Date.now();
    if (weightSlider) weightSlider.value = target;
    updateUI();
    saveState();
  }

  function updateUI() {
    const currentRecipe = RECIPES[state.recipeId] || RECIPES['jalapeno-cheddar'];
    const weightSlider = document.getElementById('weight-slider');
    const weightVal = document.getElementById('weight-val');
    const recipeInfoIcon = document.getElementById('recipe-info-icon');
    const recipeInfoTitle = document.getElementById('recipe-info-title');
    const recipeMenuTag = document.getElementById('recipe-menu-tag');
    const recipeInfoDesc = document.getElementById('recipe-info-desc');
    const ingredientsGrid = document.getElementById('ingredients-grid');
    const estStuffedWeight = document.getElementById('est-stuffed-weight');
    const estLinksExpected = document.getElementById('est-links-expected');

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
    if (recipeInfoIcon) recipeInfoIcon.textContent = currentRecipe.icon;
    if (recipeInfoTitle) recipeInfoTitle.textContent = currentRecipe.name;
    if (recipeMenuTag) recipeMenuTag.textContent = `Menu Source: ${currentRecipe.menuSource}`;
    if (recipeInfoDesc) recipeInfoDesc.textContent = currentRecipe.description;

    // Update weight values
    if (weightVal) weightVal.textContent = state.weight.toFixed(1);
    if (weightSlider) weightSlider.value = state.weight;

    // Recipe Calculations (Base = 50 lbs)
    const scale = state.weight / 50.0;

    // Render Dynamic Ingredients Grid
    if (ingredientsGrid) {
      ingredientsGrid.innerHTML = '';
      currentRecipe.ingredients.forEach(ing => {
        const card = document.createElement('div');
        card.className = `ingredient-card ${ing.highlight ? 'highlight-card' : ''}`;

        let displayVal;
        let displayUnit = ing.unit;
        const rawAmount = ing.amount * scale;

        if (ing.isGram) {
          displayVal = Math.round(rawAmount);
        } else if (ing.unit === 'lbs' && rawAmount < 1.0 && rawAmount > 0) {
          const oz = rawAmount * 16;
          displayVal = Math.abs(Math.round(oz) - oz) < 0.01 ? Math.round(oz) : oz.toFixed(1);
          displayUnit = 'oz';
        } else if (ing.unit === 'cups' && rawAmount > 0) {
          const formatted = formatCups(rawAmount);
          displayVal = formatted.val;
          displayUnit = formatted.unit;
        } else {
          displayVal = rawAmount.toFixed(2);
        }

        let dynamicDesc = ing.desc;
        if (ing.id === 'water' && rawAmount > 0) {
          const halfRaw = rawAmount / 2;
          dynamicDesc = ing.desc.replace(/Split 2x [0-9.]+ cups/, `Split 2x ${halfRaw.toFixed(1)} cups`);
        }

        if (ing.gramEq) {
          const gramVal = `${Math.round(ing.gramEq * scale)}g`;
          dynamicDesc = dynamicDesc ? `${dynamicDesc} — ${gramVal}` : gramVal;
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
    }

    // Link Estimations: Total Stuffed Weight = (50 lbs base meat block + add-ins) * scale
    const totalStuffed = (50.0 + currentRecipe.stuffedAddInLbs) * scale;
    if (estStuffedWeight) estStuffedWeight.textContent = totalStuffed.toFixed(1);

    // Total Links: Stuffed Weight * 3.0 (~1/3 lb per link)
    const roundedLinks = Math.round(totalStuffed * 3.0);
    if (estLinksExpected) estLinksExpected.textContent = roundedLinks;

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

      if (state.recipeId === 'classic-beef') {
        setHTML('verif-meat-1', `<strong>${formatMeat(35.0 * scale)}</strong> Lean Beef (70%)`);
        setHTML('verif-meat-2', `<strong>${formatMeat(15.0 * scale)}</strong> Beef Fat (30%)`);
        setHTML('verif-meat-3', '<em>(No Pork)</em>');
      } else {
        setHTML('verif-meat-1', `<strong>${formatMeat(25.5 * scale)}</strong> Beef Trimmings`);
        setHTML('verif-meat-2', `<strong>${formatMeat(16.0 * scale)}</strong> Pork Base`);
        setHTML('verif-meat-3', `<strong>${formatMeat(8.5 * scale)}</strong> Pork/Beef Fat`);
      }

      const getIngAmount = (id) => {
        const ing = currentRecipe.ingredients.find(i => i.id === id);
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

      setHTML('verif-cure', cureAmt > 0 ? `<strong>${Math.round(cureAmt)} g</strong> Pink Curing Salt` : '<em>(No Curing Salt)</em>');
      setHTML('verif-pepper', spiceVerifHtml);
      setHTML('verif-water', waterAmt > 0 ? `<strong>${formatVerif(waterAmt, 'cups')}</strong> Ice Cold Water` : '<em>(No Water)</em>');
      setHTML('verif-milk', milkAmt > 0 ? `<strong>${formatVerif(milkAmt, 'cups')}</strong> Powdered Milk` : '<em>(No Milk)</em>');

      setText('verif-yield-base', state.weight.toFixed(1));
      setText('verif-yield-total', ((50.0 + currentRecipe.stuffedAddInLbs) * scale).toFixed(1));
      setText('verif-yield-links', Math.round(((50.0 + currentRecipe.stuffedAddInLbs) * scale) * 3.0));
    }

    // Hydrate recipe-specific customSteps (Steps 8, 9, 11) in the Day 2 checklist
    const defaultStepTexts = {
      8: 'Strain brine from diced jalapeños; whisk first half of ice water with powdered milk and black pepper.',
      9: 'Mix lean beef, pork base, and chilled fat with Day 1 pink curing salt.',
      11: 'Fold in remaining ice water, high-temp cheddar cubes, and drained jalapeño dice until tacky.'
    };
    [8, 9, 11].forEach(stepNum => {
      const stepDescEl = document.querySelector(`.task-row[data-step="${stepNum}"] .task-content p`);
      if (stepDescEl) {
        stepDescEl.textContent = (currentRecipe.customSteps && currentRecipe.customSteps[stepNum]) || defaultStepTexts[stepNum];
      }
    });

    // Update Task Checkbox states & completion progress
    const taskRows = document.querySelectorAll('.task-row');
    let completedCount = 0;
    taskRows.forEach(row => {
      const stepIndex = parseInt(row.getAttribute('data-step'), 10) - 1;
      const isDone = Boolean(state.tasks[stepIndex]);
      if (isDone) {
        row.classList.add('checked');
        row.setAttribute('aria-checked', 'true');
        completedCount++;
      } else {
        row.classList.remove('checked');
        row.setAttribute('aria-checked', 'false');
      }
    });

    const progressBadge = document.getElementById('sausage-checklist-progress');
    if (progressBadge) {
      progressBadge.textContent = `${completedCount} / 15 Steps Complete`;
    }
  }

  function resetRun() {
    if (confirm('Are you sure you want to reset all tasks?')) {
      state.tasks = Array(15).fill(false);
      state.lastUpdated = Date.now();
      updateUI();
      saveState();
    }
  }

  function triggerShortcut() {
    for (let i = 0; i < 12; i++) {
      state.tasks[i] = true;
    }
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  }

  function copyShareLink() {
    const currentUrl = new URL(global.location.href);
    currentUrl.searchParams.set('session', sessionName);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentUrl.toString())
        .then(() => {
          alert('Live session link copied to clipboard! Share this with anyone to let them track progress.');
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    }
  }

  function init() {
    global.scrollTo(0, 0);
    renderRecipePills();

    const weightSlider = document.getElementById('weight-slider');
    const btnMinus5 = document.getElementById('btn-minus-5');
    const btnMinus1 = document.getElementById('btn-minus-1');
    const btnPlus1 = document.getElementById('btn-plus-1');
    const btnPlus5 = document.getElementById('btn-plus-5');

    if (weightSlider) {
      weightSlider.addEventListener('input', (e) => {
        state.weight = parseFloat(e.target.value);
        state.lastUpdated = Date.now();
        updateUI();
        saveState();
      });
    }

    const handleMinus5 = (e) => { e.preventDefault(); adjustWeight(-5); };
    const handleMinus1 = (e) => { e.preventDefault(); adjustWeight(-1); };
    const handlePlus1 = (e) => { e.preventDefault(); adjustWeight(1); };
    const handlePlus5 = (e) => { e.preventDefault(); adjustWeight(5); };

    if (btnMinus5) {
      btnMinus5.addEventListener('click', handleMinus5);
      btnMinus5.addEventListener('touchstart', handleMinus5, { passive: false });
    }
    if (btnMinus1) {
      btnMinus1.addEventListener('click', handleMinus1);
      btnMinus1.addEventListener('touchstart', handleMinus1, { passive: false });
    }
    if (btnPlus1) {
      btnPlus1.addEventListener('click', handlePlus1);
      btnPlus1.addEventListener('touchstart', handlePlus1, { passive: false });
    }
    if (btnPlus5) {
      btnPlus5.addEventListener('click', handlePlus5);
      btnPlus5.addEventListener('touchstart', handlePlus5, { passive: false });
    }

    // Quick batch size presets
    const quickBatchBtns = document.querySelectorAll('.quick-batch-btn');
    quickBatchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const bWeight = parseFloat(btn.getAttribute('data-batch'));
        if (!isNaN(bWeight)) {
          state.weight = bWeight;
          state.lastUpdated = Date.now();
          if (weightSlider) weightSlider.value = bWeight;
          quickBatchBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateUI();
          saveState();
        }
      });
    });

    // Interactive touch-safe checklist rows for mobile kitchen workers
    document.querySelectorAll('.task-row').forEach(row => {
      row.setAttribute('role', 'checkbox');
      row.setAttribute('tabindex', '0');
      const toggleRow = () => {
        const stepNum = parseInt(row.getAttribute('data-step'), 10);
        if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= 15) {
          state.tasks[stepNum - 1] = !state.tasks[stepNum - 1];
          state.lastUpdated = Date.now();
          updateUI();
          saveState();
        }
      };
      row.addEventListener('click', toggleRow);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleRow();
        }
      });
    });

    // Optional kitchen checklist action buttons
    const btnShortcut = document.getElementById('btn-sausage-shortcut');
    const btnReset = document.getElementById('btn-sausage-reset');
    if (btnShortcut) btnShortcut.addEventListener('click', triggerShortcut);
    if (btnReset) btnReset.addEventListener('click', resetRun);

    loadLocalState();
    updateUI();
  }

  // Expose on global and BBQModules.recipes
  global.RECIPES = RECIPES;
  global.init = init;
  global.renderRecipePills = renderRecipePills;
  global.adjustWeight = adjustWeight;
  global.formatCups = formatCups;
  global.updateUI = updateUI;
  global.resetRun = resetRun;
  global.triggerShortcut = triggerShortcut;
  global.copyShareLink = copyShareLink;
  global.sanitizeState = sanitizeState;
  global.loadLocalState = loadLocalState;
  global.saveState = saveState;

  global.BBQModules.recipes = {
    RECIPES,
    getState: () => state,
    init,
    renderRecipePills,
    adjustWeight,
    formatCups,
    updateUI,
    resetRun,
    triggerShortcut,
    copyShareLink,
    sanitizeState,
    loadLocalState,
    saveState
  };
})(typeof window !== 'undefined' ? window : globalThis);
