// ==UserScript==
// @name         AH Mijnlijst Price Per Unit Calculator
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Parse Albert Heijn Cart and calculate price per gram, milliliter or piece.
// @match        https://www.ah.nl/mijnlijst
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Parse the main price element (integer and fractional parts)
    function parsePriceAmount(priceElem) {
        if (!priceElem) return null;
        let intPart = priceElem.querySelector('[class*="price-amount_integer"]')?.textContent;
        let fracPart = priceElem.querySelector('[class*="price-amount_fractional"]')?.textContent;
        if (intPart && fracPart) {
            return parseFloat(intPart.replace(',', '.') + '.' + fracPart.replace(',', '.'));
        } else if (intPart) {
            return parseFloat(intPart.replace(',', '.'));
        }
        return null;
    }

    // Parse promo text like "3 voor 5.00" into { qty, price }
    function parsePromo(promoText) {
        const match = promoText.match(/(\d+)\s*voor\s*([\d.,]+)/i);
        if (match) {
            const qty = parseInt(match[1], 10);
            const price = parseFloat(match[2].replace(',', '.'));
            return { qty, price };
        }
        return null;
    }

    // Parse unit size text (e.g., "250 g", "1 kg", "500 ml", "1 l", "3 stuks")
    // Returns an object with { amount, unit } where unit is normalized to: g, ml, or stuks.
    function parseUnitSize(unitText) {
        // Look for number and unit
        const match = unitText.match(/([\d.,]+)\s*(kg|g|l|ml|stuks?)/i);
        if (match) {
            let amount = parseFloat(match[1].replace(',', '.'));
            let unit = match[2].toLowerCase();

            if (unit === 'kg') {
                // convert kilograms to grams
                amount *= 1000;
                unit = 'g';
            } else if (unit === 'l') {
                // convert liters to milliliters
                amount *= 1000;
                unit = 'ml';
            } else if (unit === 'stuk' || unit === 'stuks') {
                unit = 'stuks';
            }
            return { amount, unit };
        }
        return null;
    }

    // Calculate the effective price per unit (gram, ml, or per stuk) for a given product element
    function calculatePricePerUnit(productElem) {
        // Check for promo text (e.g., "3 voor 5.00")
        const promoElem = productElem.querySelector('[data-testhook="product-smart-shield-label"] .smart-shield-label_text__-3p4J');
        let effectivePrice;
        if (promoElem) {
            const promo = parsePromo(promoElem.textContent.trim());
            if (promo) {
                // Price per product from promo
                effectivePrice = promo.price / promo.qty;
            }
        }

        // Fallback to standard price if no promo was found
        if (effectivePrice === undefined) {
            const priceElem = productElem.querySelector('[data-testhook="price-amount"]');
            effectivePrice = parsePriceAmount(priceElem);
        }

        // Get the unit size text and parse it
        const unitSizeElem = productElem.querySelector('[data-testhook="product-unit-size"]');
        const unitText = unitSizeElem ? unitSizeElem.textContent.trim() : "";
        const unitData = parseUnitSize(unitText);

        if (effectivePrice != null && unitData && unitData.amount) {
            return {
                pricePerUnit: effectivePrice / unitData.amount,
                unit: unitData.unit
            };
        }
        return null;
    }

    // Insert the calculated price per unit into the product display
    function displayPricePerUnit(productElem, calcResult) {
        const display = document.createElement('div');
        display.className = 'price-per-unit-calculated';
        display.style.fontSize = '0.9em';
        display.style.color = '#555';
        display.style.marginTop = '5px';
        display.textContent = `Price per ${calcResult.unit}: €${calcResult.pricePerUnit.toFixed(4)}`;

        // Append the calculated value below the price info if available
        const priceList = productElem.querySelector('.price_list__Yo1Ch');
        if (priceList) {
            priceList.appendChild(display);
        } else {
            productElem.appendChild(display);
        }
    }

    // Process all product items on the page
    function processProducts() {
        const products = document.querySelectorAll('li[data-testhook="myl-lane-product"]');
        products.forEach(productElem => {
            // Avoid re-calculating if already processed
            if (productElem.querySelector('.price-per-unit-calculated')) return;

            const calcResult = calculatePricePerUnit(productElem);
            if (calcResult !== null) {
                displayPricePerUnit(productElem, calcResult);
            }
        });
    }

    // Run the processing once the page loads
    window.addEventListener('load', processProducts);

    // Also observe the DOM in case products are added dynamically
    const observer = new MutationObserver(processProducts);
    observer.observe(document.body, { childList: true, subtree: true });
})();
