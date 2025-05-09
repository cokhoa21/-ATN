document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
    const predictBtn = document.getElementById('predictBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveApiBtn = document.getElementById('saveApiBtn');
    const status = document.getElementById('status');
    const apiUrl = document.getElementById('apiUrl');
    const inputData = document.getElementById('inputData');
    const predictionResult = document.getElementById('predictionResult');
    const charCounter = document.getElementById('charCounter');

    // Charger l'URL de l'API sauvegardée
    chrome.storage.local.get(['savedApiUrl'], (data) => {
        if (data.savedApiUrl) {
            apiUrl.value = data.savedApiUrl;
        }
    });

    // Vérifier si nous avons déjà des cookies
    chrome.storage.local.get(['cookieValues'], (data) => {
        if (data.cookieValues && data.cookieValues.length > 0) {
            status.textContent = `${data.cookieValues.length} cookies disponibles`;
            updateInputDataFromCookies(data.cookieValues);
        }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "cookiesExtracted") {
            if (message.error) {
                status.textContent = `Erreur: ${message.error}`;
            } else {
                status.textContent = `${message.count} cookies extraits`;
            }
            chrome.storage.local.get(['cookieValues'], (data) => {
                if (data.cookieValues) {
                    updateInputDataFromCookies(data.cookieValues);
                }
            });
        }
    });

    // Save API URL
    saveApiBtn.addEventListener('click', () => {
        const url = apiUrl.value.trim();
        if (url) {
            chrome.storage.local.set({ savedApiUrl: url }, () => {
                status.textContent = "API URL saved";
                setTimeout(() => {
                    status.textContent = "";
                }, 2000);
            });
        }
    });

    // Extract cookies
    extractBtn.addEventListener('click', () => {
        status.textContent = "Extraction en cours...";

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.url) {
                // Send message to background script to extract cookies
                chrome.runtime.sendMessage({
                    action: "extractCookies",
                    tabUrl: activeTab.url
                });
            } else {
                status.textContent = "Aucun onglet actif trouvé";
            }
        });
    });

    // Update input field with processed cookie data
    function updateInputDataFromCookies(cookieValues) {
        // Process each cookie separately
        const processedResults = cookieValues.map(cookie => {
            // Process single cookie with the algorithm
            const processedData = processSingleCookie(cookie.value);
            // Return the flattened sequence for this cookie along with its name
            return {
                name: cookie.name,
                sequence: processedData.paddedSequence.filter(idx => idx !== 0)
            };
        });

        // Update input field with all processed sequences
        inputData.value = JSON.stringify(processedResults);
        updateCharCounter(processedResults.length);
    }

    // Process single cookie
    function processSingleCookie(cookieValue) {
        // Create a vocabulary of characters
        const allChars = new Set();
        if (typeof cookieValue === 'string') {
            for (let char of cookieValue) {
                allChars.add(char);
            }
        }

        // Create char_to_idx
        const charArray = Array.from(allChars);
        const charToIdx = {};
        charToIdx['<PAD>'] = 0;
        charArray.forEach((char, idx) => {
            charToIdx[char] = idx + 1;
        });

        // Encode character sequence
        const maxlen = 128;
        let sequence = [];
        if (typeof cookieValue === 'string' && cookieValue.length > 0) {
            sequence = cookieValue.split('').map(char => charToIdx[char] || 0);
        }

        // Pad sequence
        let paddedSequence;
        if (sequence.length >= maxlen) {
            paddedSequence = sequence.slice(0, maxlen);
        } else {
            paddedSequence = [...sequence, ...Array(maxlen - sequence.length).fill(0)];
        }

        return {
            charToIdx: charToIdx,
            paddedSequence: paddedSequence
        };
    }

    // Update character counter
    function updateCharCounter(count) {
        charCounter.textContent = `${count} mục`;
    }

    // Monitor changes in input field
    inputData.addEventListener('input', () => {
        const inputValues = inputData.value.trim().split(',').filter(val => val.trim() !== '');
        updateCharCounter(inputValues.length);
    });

    // Clear data
    clearBtn.addEventListener('click', () => {
        inputData.value = '';
        updateCharCounter(0);
        predictionResult.textContent = '';
        chrome.storage.local.remove(['cookieValues'], () => {
            status.textContent = "Data cleared";
            setTimeout(() => {
                status.textContent = "";
            }, 2000);
        });
    });

    // Send data to API for prediction
    predictBtn.addEventListener('click', async () => {
        const url = apiUrl.value.trim();
        if (!url) {
            status.textContent = "API URL not defined";
            return;
        }

        const inputValues = inputData.value.trim();
        if (!inputValues) {
            status.textContent = "No data to process";
            return;
        }

        // Parse the input as array of sequences
        let sequences;
        try {
            sequences = JSON.parse(inputValues);
            if (!Array.isArray(sequences) || sequences.length === 0) {
                throw new Error("Invalid data format");
            }
        } catch (err) {
            status.textContent = "Invalid data format";
            return;
        }

        status.textContent = "Sending to API...";
        predictionResult.textContent = "Waiting for predictions...";

        try {
            // Make predictions for each sequence
            const predictions = await Promise.all(sequences.map(async (cookie, index) => {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ sequence: cookie.sequence })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }

                    const result = await response.json();
                    return {
                        cookieName: cookie.name,
                        prediction: result
                    };
                } catch (error) {
                    return {
                        cookieName: cookie.name,
                        error: error.message
                    };
                }
            }));

            // Format and display results
            const formattedResults = predictions.map(pred => {
                if (pred.error) {
                    return `Cookie "${pred.cookieName}": Error - ${pred.error}`;
                }

                const { predicted_class, probabilities } = pred.prediction;
                const labels = ['very low', 'low', 'average', 'high', 'very high'];

                // Create probability bars
                const probabilityBars = probabilities.map((prob, idx) => {
                    const percentage = (prob * 100).toFixed(1);
                    const barWidth = Math.max(percentage * 2, 1); // Minimum width of 1px
                    return `
                        <div class="probability-row">
                            <span class="label">${labels[idx]}:</span>
                            <div class="progress-bar">
                                <div class="progress" style="width: ${barWidth}%"></div>
                            </div>
                            <span class="percentage">${percentage}%</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="prediction-card">
                        <div class="cookie-header">Cookie: "${pred.cookieName}"</div>
                        <div class="prediction-class">Risk Level: <span class="class-${predicted_class}">${predicted_class}</span></div>
                        <div class="probabilities">
                            ${probabilityBars}
                        </div>
                    </div>
                `;
            }).join('');

            predictionResult.innerHTML = formattedResults;
            status.textContent = "All predictions received";
        } catch (error) {
            status.textContent = `Error: ${error.message}`;
            predictionResult.textContent = "Prediction failed";
        }
    });
});

// Créez un dossier images/ avec des icônes 16x16, 48x48 et 128x128