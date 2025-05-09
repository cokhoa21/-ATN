// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "extractCookies") {
        const url = message.tabUrl;
        if (!url) {
            console.error("No URL provided for cookie extraction");
            chrome.runtime.sendMessage({
                action: "cookiesExtracted",
                count: 0,
                error: "URL non fournie"
            });
            return true;
        }

        try {
            const domain = new URL(url).hostname;
            console.log(`Extracting cookies for domain: ${domain}`);

            // Use the cookies API to get all cookies for the domain
            chrome.cookies.getAll({ domain: domain }, (cookies) => {
                if (chrome.runtime.lastError) {
                    console.error("Error accessing cookies:", chrome.runtime.lastError);
                    chrome.runtime.sendMessage({
                        action: "cookiesExtracted",
                        count: 0,
                        error: "Erreur d'accès aux cookies: " + chrome.runtime.lastError.message
                    });
                    return;
                }

                if (cookies.length === 0) {
                    console.log("No cookies found for domain:", domain);
                    chrome.runtime.sendMessage({
                        action: "cookiesExtracted",
                        count: 0,
                        error: "Aucun cookie trouvé pour ce domaine"
                    });
                    return;
                }

                // Extract cookie values and names
                const cookieValues = cookies.map(cookie => ({
                    name: cookie.name,
                    value: cookie.value
                }));
                console.log(`Found ${cookieValues.length} cookies for domain: ${domain}`);

                // Store values for later processing
                chrome.storage.local.set({ cookieValues: cookieValues }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error storing cookies:", chrome.runtime.lastError);
                        chrome.runtime.sendMessage({
                            action: "cookiesExtracted",
                            count: 0,
                            error: "Erreur de stockage des cookies: " + chrome.runtime.lastError.message
                        });
                        return;
                    }

                    console.log("Cookie values successfully stored");
                    // Notify popup that data is ready
                    chrome.runtime.sendMessage({
                        action: "cookiesExtracted",
                        count: cookieValues.length
                    });
                });
            });
        } catch (error) {
            console.error("Error extracting cookies:", error);
            chrome.runtime.sendMessage({
                action: "cookiesExtracted",
                count: 0,
                error: "Erreur d'extraction: " + error.message
            });
        }
    }
    return true; // Keep the message channel open for async responses
});