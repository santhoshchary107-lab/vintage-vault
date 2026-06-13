/* --------------------------------------------------------------------------
   THE VINTAGE VAULT — APPLICATION LOGIC & CONTROLLER
   -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Live Base Rates (INR)
  // Gold & Silver per gram, Copper per gram, Gemstones per carat
  const RATES = {
    gold24k: 14908,
    gold22k: 13665,
    gold18k: 11180,
    silver: 270,     // Adjusted to ₹270/g to perfectly match real-time invoice totals
    copper: 0.90,
    moonstone: 400,  // ₹400 per carat
    tanzanite: 8000  // ₹8,000 per carat (Rare Tanzanite)
  };

  // Specific Ornament Database (Real-time prices and settings)
  const ITEMS = {
    gold: {
      ring: { name: "Light Ring / Studs", rate: RATES.gold22k, making: 10, weight: 4, isGemstone: false },
      bangles: { name: "Simple Kada / Bangles", rate: RATES.gold22k, making: 8, weight: 20, isGemstone: false },
      chain: { name: "Basic Chain", rate: RATES.gold22k, making: 12, weight: 15, isGemstone: false },
      necklace: { name: "Heavy Bridal Necklace", rate: RATES.gold22k, making: 20, weight: 50, isGemstone: false }
    },
    silver: {
      ring: { name: "Silver Ring / Toe Rings", rate: RATES.silver, making: 15, weight: 10, isGemstone: false },
      payal: { name: "Silver Payal (Anklets)", rate: RATES.silver, making: 20, weight: 50, isGemstone: false },
      utensils: { name: "Silver Utensils / Puja Items", rate: RATES.silver, making: 10, weight: 250, isGemstone: false }
    },
    copper: {
      bracelet: { name: "Healing Braided Cuff", rate: RATES.copper, making: 25, weight: 20, isGemstone: false },
      pendant: { name: "Antiqued Filigree Pendant", rate: RATES.copper, making: 30, weight: 10, isGemstone: false }
    },
    gemstone: {
      moonstone: { name: "Rainbow Moonstone Cabochon", rate: RATES.moonstone, making: 1500, weight: 10, isGemstone: true },
      tanzanite: { name: "Indigo Tanzanite Cabochon", rate: RATES.tanzanite, making: 3000, weight: 5, isGemstone: true }
    }
  };

  // J.P. Morgan Projections: Growth Multipliers by Year (base 2026 = 1.0)
  const PROJECTIONS = {
    gold: { 2026: 1.0, 2027: 1.18, 2028: 1.35, 2029: 1.50, 2030: 1.65 },
    silver: { 2026: 1.0, 2027: 1.45, 2028: 1.95, 2029: 2.60, 2030: 3.33 },
    copper: { 2026: 1.0, 2027: 1.07, 2028: 1.15, 2029: 1.22, 2030: 1.30 },
    gemstone: { 2026: 1.0, 2027: 1.20, 2028: 1.40, 2029: 1.70, 2030: 2.00 }
  };

  // DOM Elements
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".calc-tab-content");
  
  // Cascading Dropdowns
  const calcCategorySelect = document.getElementById("calc-category");
  const calcItemSelect = document.getElementById("calc-item");
  
  // Inputs
  const calcWeightInput = document.getElementById("calc-weight");
  const calcMakingInput = document.getElementById("calc-making");
  const ratePerGramDisplay = document.getElementById("calc-rate");
  const rateLabelDisplay = document.getElementById("rate-label");
  
  // Input Labels (Grams vs Carats, % vs Flat Fee)
  const weightLabel = document.getElementById("calc-weight-label");
  const makingLabel = document.getElementById("calc-making-label");
  const makingHelperText = document.getElementById("calc-making-helper");
  
  // Billing Summary Display
  const billMetalVal = document.getElementById("bill-metal-val");
  const billMakingVal = document.getElementById("bill-making-val");
  const billSubtotalVal = document.getElementById("bill-subtotal-val");
  const billGstVal = document.getElementById("bill-gst-val");
  const billTotalVal = document.getElementById("bill-total-val");

  // Future Planner Inputs
  const planYearSlider = document.getElementById("plan-year");
  const selectedYearLabel = document.getElementById("selected-year");
  const futureGainDisplay = document.getElementById("future-gain");
  const futurePercentDisplay = document.getElementById("future-percent");
  const futureTotalDisplay = document.getElementById("future-total");

  // Accordions & Mobile Menu
  const accordionItems = document.querySelectorAll(".accordion-item");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const navLinks = document.querySelector(".nav-links");

  // --- INITIALIZATION ---
  initTicker();
  loadCSVData(); // Fetches CSV data dynamically, falls back to local and initializes

  // --- EVENT LISTENERS ---

  // Tab Toggle
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      
      tab.classList.add("active");
      const targetId = tab.dataset.tab;
      document.getElementById(targetId).classList.add("active");
      
      if (targetId === "planner-tab") {
        updatePlanner();
      }
    });
  });

  // Category change triggers item rebuild
  calcCategorySelect.addEventListener("change", populateItems);

  // Item change triggers updates
  calcItemSelect.addEventListener("change", () => {
    const category = calcCategorySelect.value;
    const itemKey = calcItemSelect.value;
    const itemData = ITEMS[category][itemKey];

    if (itemData) {
      calcWeightInput.value = itemData.weight;
      calcMakingInput.value = itemData.making;
      ratePerGramDisplay.value = itemData.rate.toFixed(2);

      // Adjust Form Labels dynamically based on item category
      if (itemData.isGemstone) {
        weightLabel.textContent = "Weight (Carats)";
        makingLabel.textContent = "Setting Charges (Flat Fee in ₹)";
        makingHelperText.textContent = "Avg flat setting fee: ₹1,500 - ₹3,000";
        rateLabelDisplay.textContent = "rate per carat";
        calcMakingInput.step = "50";
        calcMakingInput.max = "10000";
      } else {
        weightLabel.textContent = "Weight (Grams)";
        makingLabel.textContent = "Making Charges (%)";
        makingHelperText.textContent = "Avg: Gold (10-25%), Silver (10-20%)";
        rateLabelDisplay.textContent = "rate per gram";
        calcMakingInput.step = "1";
        calcMakingInput.max = "100";
      }
    }
    updateCalculator();
  });

  calcWeightInput.addEventListener("input", updateCalculator);
  calcMakingInput.addEventListener("input", updateCalculator);
  ratePerGramDisplay.addEventListener("input", updateCalculator);

  // Future Planner Slider Event
  planYearSlider.addEventListener("input", () => {
    selectedYearLabel.textContent = planYearSlider.value;
    updatePlanner();
  });

  // Accordion Toggle
  accordionItems.forEach(item => {
    const title = item.querySelector(".accordion-title");
    title.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      accordionItems.forEach(acc => acc.classList.remove("active"));
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });

  // Mobile Menu Toggle
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      if (navLinks.style.display === "flex") {
        navLinks.style.display = "none";
      } else {
        navLinks.style.display = "flex";
        navLinks.style.flexDirection = "column";
        navLinks.style.position = "absolute";
        navLinks.style.top = "70px";
        navLinks.style.left = "0";
        navLinks.style.right = "0";
        navLinks.style.background = "#0f0a04";
        navLinks.style.padding = "2rem";
        navLinks.style.borderBottom = "1px solid #8B6914";
      }
    });
  }

  // --- CORE FUNCTIONS ---

  function formatINR(number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(number);
  }

  // Dynamic Item Dropdown Builder
  function populateItems() {
    const category = calcCategorySelect.value;
    const catItems = ITEMS[category];

    calcItemSelect.innerHTML = ""; // Clear existing

    Object.keys(catItems).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = catItems[key].name;
      calcItemSelect.appendChild(opt);
    });

    // Trigger change event to load defaults
    calcItemSelect.dispatchEvent(new Event("change"));
  }

  function initTicker() {
    document.getElementById("ticker-gold24").textContent = formatINR(RATES.gold24k) + "/g";
    document.getElementById("ticker-gold22").textContent = formatINR(RATES.gold22k) + "/g";
    document.getElementById("ticker-silver").textContent = formatINR(RATES.silver) + "/g";
    document.getElementById("ticker-copper").textContent = formatINR(RATES.copper * 1000) + "/kg";
    
    document.getElementById("ticker-gold24-dup").textContent = formatINR(RATES.gold24k) + "/g";
    document.getElementById("ticker-gold22-dup").textContent = formatINR(RATES.gold22k) + "/g";
    document.getElementById("ticker-silver-dup").textContent = formatINR(RATES.silver) + "/g";
    document.getElementById("ticker-copper-dup").textContent = formatINR(RATES.copper * 1000) + "/kg";
  }

  function initTable() {
    document.getElementById("table-gold24").textContent = "~" + formatINR(RATES.gold24k) + " / g";
    document.getElementById("table-gold22").textContent = "~" + formatINR(RATES.gold22k) + " / g";
    document.getElementById("table-silver").textContent = "~" + formatINR(RATES.silver) + " / g";
    document.getElementById("table-copper").textContent = "~" + formatINR(RATES.copper) + " / g";
    
    // Set gemstone rates
    document.getElementById("table-moonstone").textContent = "~" + formatINR(RATES.moonstone) + " / carat";
    document.getElementById("table-tanzanite").textContent = "~" + formatINR(RATES.tanzanite) + " / carat";
  }

  let currentTotalCost = 0;
  function updateCalculator() {
    const category = calcCategorySelect.value;
    const itemKey = calcItemSelect.value;
    const itemData = ITEMS[category][itemKey];
    
    if (!itemData) return;

    const weight = parseFloat(calcWeightInput.value) || 0;
    const makingInputVal = parseFloat(calcMakingInput.value) || 0;
    const rate = parseFloat(ratePerGramDisplay.value) || 0;

    // Calculate invoice totals
    const metalCost = rate * weight;
    let makingCharges = 0;

    if (itemData.isGemstone) {
      makingCharges = makingInputVal; // Flat setting fee
    } else {
      makingCharges = (makingInputVal / 100) * metalCost; // Percentage of metal value
    }

    const subtotal = metalCost + makingCharges;
    const gst = 0.03 * subtotal; // 3% standard GST
    const totalCost = subtotal + gst;
    currentTotalCost = totalCost;

    // Display billing summary
    billMetalVal.textContent = formatINR(metalCost);
    billMakingVal.textContent = formatINR(makingCharges);
    billSubtotalVal.textContent = formatINR(subtotal);
    billGstVal.textContent = formatINR(gst);
    billTotalVal.textContent = formatINR(totalCost);

    updatePlanner();
  }

  function updatePlanner() {
    const category = calcCategorySelect.value;
    const itemKey = calcItemSelect.value;
    const itemData = ITEMS[category][itemKey];

    if (!itemData) return;

    const weight = parseFloat(calcWeightInput.value) || 0;
    const year = parseInt(planYearSlider.value);
    
    const multiplier = PROJECTIONS[category][year] || 1;
    const rate = parseFloat(ratePerGramDisplay.value) || 0;
    const projectedRate = rate * multiplier;
    
    // Retained metal/stone weight value in future
    const futureValue = projectedRate * weight;
    const netGain = futureValue - currentTotalCost;
    const roiPercent = currentTotalCost > 0 ? (netGain / currentTotalCost) * 100 : 0;

    futureTotalDisplay.textContent = formatINR(futureValue);
    
    if (netGain >= 0) {
      futureGainDisplay.textContent = "+" + formatINR(netGain);
      futureGainDisplay.style.color = "var(--success-green)";
      futurePercentDisplay.textContent = `+${roiPercent.toFixed(1)}% ROI`;
      futurePercentDisplay.style.backgroundColor = "rgba(142, 200, 50, 0.15)";
      futurePercentDisplay.style.color = "var(--success-green)";
    } else {
      futureGainDisplay.textContent = formatINR(netGain);
      futureGainDisplay.style.color = "var(--danger-red)";
      futurePercentDisplay.textContent = `${roiPercent.toFixed(1)}% ROI`;
      futurePercentDisplay.style.backgroundColor = "rgba(255, 82, 82, 0.15)";
      futurePercentDisplay.style.color = "var(--danger-red)";
    }
  }

  // Bind click action from catalog product cards
  window.loadCalculatorItem = function(category, itemKey, weight, makingVal) {
    // 1. Switch to Billing tab
    tabs[0].click();
    
    // 2. Select category
    calcCategorySelect.value = category;
    
    // 3. Rebuild items list for this category
    populateItems();
    
    // 4. Select item key
    calcItemSelect.value = itemKey;
    
    // 5. Trigger item change to load custom weight/charges
    calcItemSelect.dispatchEvent(new Event("change"));
    
    // 6. Overwrite weight & charges with the product specifications
    calcWeightInput.value = weight;
    calcMakingInput.value = makingVal;
    
    // 7. Recalculate
    updateCalculator();
    
    // 8. Scroll up to the calculator widget
    document.getElementById("pricing-calculator").scrollIntoView({
      behavior: "smooth"
    });
  };

  // --- CSV PARSING, LOADING, & EXPORTS ---

  function parseCSV(text) {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];
    
    // Parse headers
    const headers = lines[0].split(",").map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parser handling quotes
      const values = [];
      let current = "";
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const obj = {};
      headers.forEach((header, index) => {
        let val = values[index];
        if (val === undefined) {
          obj[header] = "";
          return;
        }
        // Clean outer quotes if any
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        
        // Cast types
        if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (!isNaN(val) && val !== "") val = Number(val);
        
        obj[header] = val;
      });
      result.push(obj);
    }
    return result;
  }

  async function loadCSVData() {
    try {
      const response = await fetch("ornaments.csv");
      if (!response.ok) throw new Error("Status: " + response.status);
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      const newItems = {
        gold: {},
        silver: {},
        copper: {},
        gemstone: {}
      };
      
      parsedData.forEach(row => {
        const cat = row.category;
        const key = row.key;
        if (newItems[cat]) {
          const defaultRate = Number(row.base_rate);
          let ratio = 1.0;
          if (cat === "gold") ratio = defaultRate / 13665;
          else if (cat === "silver") ratio = defaultRate / 270;
          else if (cat === "copper") ratio = defaultRate / 0.90;

          newItems[cat][key] = {
            name: row.name,
            rate: defaultRate,
            premiumRatio: ratio,
            making: Number(row.making_charge),
            weight: Number(row.weight),
            isGemstone: row.is_gemstone === true || row.is_gemstone === "true"
          };
        }
      });
      
      // Override the ITEMS global reference values
      for (const k in ITEMS) {
        delete ITEMS[k];
      }
      Object.assign(ITEMS, newItems);
      console.log("Successfully integrated ornaments.csv", ITEMS);
    } catch (err) {
      console.warn("Could not load ornaments.csv, using default items. Details:", err);
    } finally {
      // Re-populate and build tables
      populateItems();
      initTable();
      updateMarketRates(); // Sync customizer and scale card prices
    }
  }

  function downloadCSVFile(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Bind download catalog button
  const downloadCatalogBtn = document.getElementById("download-catalog-csv");
  if (downloadCatalogBtn) {
    downloadCatalogBtn.addEventListener("click", () => {
      let csv = "Category,Key,Name,Default Weight,Making/Setting Charge,Is Gemstone,Base Rate (INR),Est. Total Price (INR)\n";
      Object.keys(ITEMS).forEach(cat => {
        Object.keys(ITEMS[cat]).forEach(key => {
          const item = ITEMS[cat][key];
          
          // Math calculation matching application engine
          const metalCost = item.rate * item.weight;
          const making = item.isGemstone ? item.making : (item.making / 100) * metalCost;
          const total = (metalCost + making) * 1.03;
          
          const row = [
            cat.toUpperCase(),
            key,
            `"${item.name}"`,
            item.weight + (item.isGemstone ? " Carats" : " Grams"),
            item.isGemstone ? `₹${item.making} Flat` : `${item.making}%`,
            item.isGemstone ? "Yes" : "No",
            item.rate.toFixed(2),
            Math.round(total)
          ].join(",");
          csv += row + "\n";
        });
      });
      downloadCSVFile(csv, "vintage_vault_catalog.csv");
    });
  }

  // Bind export receipt button
  const exportInvoiceBtn = document.getElementById("export-invoice-csv");
  if (exportInvoiceBtn) {
    exportInvoiceBtn.addEventListener("click", () => {
      const category = calcCategorySelect.value;
      const itemKey = calcItemSelect.value;
      const itemData = ITEMS[category][itemKey];
      
      if (!itemData) return;
      
      const weight = parseFloat(calcWeightInput.value) || 0;
      const makingInputVal = parseFloat(calcMakingInput.value) || 0;
      
      const metalCost = itemData.rate * weight;
      const makingCharges = itemData.isGemstone ? makingInputVal : (makingInputVal / 100) * metalCost;
      const subtotal = metalCost + makingCharges;
      const gst = 0.03 * subtotal;
      const totalCost = subtotal + gst;
      
      let csv = "Invoice Detail,Value\n";
      csv += `Store Name,"THE VINTAGE VAULT"\n`;
      csv += `Date,"${new Date().toLocaleDateString()}"\n`;
      csv += `Item Category,${category.toUpperCase()}\n`;
      csv += `Item Name,"${itemData.name}"\n`;
      csv += `Unit,${itemData.isGemstone ? "Carats" : "Grams"}\n`;
      csv += `Weight,${weight}\n`;
      csv += `Base Rate per unit,₹${itemData.rate.toFixed(2)}\n`;
      csv += `Metal/Stone Value,₹${metalCost.toFixed(2)}\n`;
      csv += `Making/Setting Charges,${itemData.isGemstone ? "₹" + makingInputVal.toFixed(2) : makingInputVal + "% (₹" + makingCharges.toFixed(2) + ")"}\n`;
      csv += `Subtotal,₹${subtotal.toFixed(2)}\n`;
      csv += `GST (3%),₹${gst.toFixed(2)}\n`;
      csv += `Total Estimated Price,₹${totalCost.toFixed(2)}\n`;
      
      downloadCSVFile(csv, `invoice_${itemKey}_${Date.now()}.csv`);
    });
  }

  // --- CATALOG SEARCH & CATEGORY FILTERING ---
  const searchInput = document.getElementById("catalog-search");
  const filterButtons = document.querySelectorAll(".filter-tag");
  const catalogCards = document.querySelectorAll(".catalog-card");

  function filterCatalog() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const activeFilterBtn = document.querySelector(".filter-tag.active");
    const activeFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : "all";

    catalogCards.forEach(card => {
      const cardCategory = card.dataset.category;
      const title = card.querySelector(".card-title").textContent.toLowerCase();
      const desc = card.querySelector(".card-desc").textContent.toLowerCase();
      const badge = card.querySelector(".card-badge").textContent.toLowerCase();

      const matchesFilter = activeFilter === "all" || cardCategory === activeFilter;
      const matchesSearch = title.includes(query) || desc.includes(query) || badge.includes(query);

      if (matchesFilter && matchesSearch) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterCatalog);
  }

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterCatalog();
    });
  });

  // --- MARKET RATE CUSTOMIZER & PROPORTIONAL MARKUP SCALING ---
  const inputGold24 = document.getElementById("rate-gold24-input");
  const inputGold22 = document.getElementById("rate-gold22-input");
  const inputSilver = document.getElementById("rate-silver-input");
  const inputCopper = document.getElementById("rate-copper-input");
  const btnResetRates = document.getElementById("reset-rates-btn");

  const DEFAULT_MARKET_RATES = {
    gold24k: 14908,
    gold22k: 13665,
    silver: 270,
    copper: 0.90
  };

  function updateMarketRates() {
    const gold24Val = parseFloat(inputGold24 ? inputGold24.value : DEFAULT_MARKET_RATES.gold24k) || DEFAULT_MARKET_RATES.gold24k;
    const gold22Val = parseFloat(inputGold22 ? inputGold22.value : DEFAULT_MARKET_RATES.gold22k) || DEFAULT_MARKET_RATES.gold22k;
    const silverVal = parseFloat(inputSilver ? inputSilver.value : DEFAULT_MARKET_RATES.silver) || DEFAULT_MARKET_RATES.silver;
    const copperVal = parseFloat(inputCopper ? inputCopper.value : (DEFAULT_MARKET_RATES.copper * 1000)) || (DEFAULT_MARKET_RATES.copper * 1000);

    RATES.gold24k = gold24Val;
    RATES.gold22k = gold22Val;
    RATES.silver = silverVal;
    RATES.copper = copperVal / 1000;

    // Proportional scaling
    Object.keys(ITEMS).forEach(cat => {
      Object.keys(ITEMS[cat]).forEach(key => {
        const item = ITEMS[cat][key];
        if (cat === "gold" && item.premiumRatio) {
          item.rate = item.premiumRatio * RATES.gold22k;
        } else if (cat === "silver" && item.premiumRatio) {
          item.rate = item.premiumRatio * RATES.silver;
        } else if (cat === "copper" && item.premiumRatio) {
          item.rate = item.premiumRatio * RATES.copper;
        }
      });
    });

    initTicker();
    initTable();
    updateShowcaseCardPrices();

    // Sync current calculator selected item
    const category = calcCategorySelect.value;
    const itemKey = calcItemSelect.value;
    const itemData = ITEMS[category] ? ITEMS[category][itemKey] : null;
    if (itemData) {
      ratePerGramDisplay.value = itemData.rate.toFixed(2);
      updateCalculator();
    }
  }

  function updateShowcaseCardPrices() {
    const cards = document.querySelectorAll(".catalog-card");
    cards.forEach(card => {
      const category = card.dataset.category;
      const title = card.querySelector(".card-title").textContent.trim();
      
      let matchedItem = null;
      let matchedKey = null;
      if (ITEMS[category]) {
        Object.keys(ITEMS[category]).forEach(key => {
          if (ITEMS[category][key].name.trim() === title) {
            matchedItem = ITEMS[category][key];
            matchedKey = key;
          }
        });
      }

      if (matchedItem) {
        const metalCost = matchedItem.rate * matchedItem.weight;
        const making = matchedItem.isGemstone ? matchedItem.making : (matchedItem.making / 100) * metalCost;
        const total = (metalCost + making) * 1.03;
        
        const priceParagraph = card.querySelector(".card-valuation p");
        if (priceParagraph) {
          priceParagraph.textContent = formatINR(Math.round(total)).replace(".00", "");
        }
        
        // Dynamically update click handler to use latest scaled rate if clicked
        const actionBtn = card.querySelector(".card-action-btn");
        if (actionBtn) {
          actionBtn.setAttribute("onclick", `loadCalculatorItem('${category}', '${matchedKey}', ${matchedItem.weight}, ${matchedItem.making})`);
        }
      }
    });
  }

  if (inputGold24) inputGold24.addEventListener("input", updateMarketRates);
  if (inputGold22) inputGold22.addEventListener("input", updateMarketRates);
  if (inputSilver) inputSilver.addEventListener("input", updateMarketRates);
  if (inputCopper) inputCopper.addEventListener("input", updateMarketRates);

  if (btnResetRates) {
    btnResetRates.addEventListener("click", () => {
      if (inputGold24) inputGold24.value = DEFAULT_MARKET_RATES.gold24k;
      if (inputGold22) inputGold22.value = DEFAULT_MARKET_RATES.gold22k;
      if (inputSilver) inputSilver.value = DEFAULT_MARKET_RATES.silver;
      if (inputCopper) inputCopper.value = DEFAULT_MARKET_RATES.copper * 1000;
      updateMarketRates();
    });
  }
});
