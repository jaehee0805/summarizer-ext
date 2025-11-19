document.getElementById("summarizeBtn").addEventListener("click", async () => {
  const outputDiv = document.getElementById("output");
  outputDiv.innerText = "Thinking..."; // 1. Give user feedback immediately

  try {
    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Execute a script on that tab to grab the text
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.body.innerText, // Simple way to get visible text
    });

    const apiUrl = "https://my-gemini-proxy-one.vercel.app/api/summarize"; 
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Summarize this text using bullet points and/or tables: " + result })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    outputDiv.innerHTML = marked.parse(data.text);

  } catch (error) {
    // 2. Show error in the UI so you know what happened
    console.error(error);
    outputDiv.innerText = "Error: " + error.message;
  }
});