document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['summary', 'isLoading', 'selectedModel']);
  const modelSelector = document.getElementById("modelSelector");

  // get choice from user or default to gemini
  const currentModel = data.selectedModel || 'gemini';
  modelSelector.value = currentModel;
  
  // restore UI state
  if (data.isLoading) {
    showLoadingState();
  } else if (data.summary) {
    renderMarkdown(data.summary);
  }
  if (!data.summary) {
    hideCopyButton(); 
  }

  modelSelector.addEventListener('change', (event) => {
    chrome.storage.local.set({ selectedModel: event.target.value });
  });
});



// the main summarize function
document.getElementById("summarizeBtn").addEventListener("click", async () => {
  const outputDiv = document.getElementById("output");
  let modelData;
  let selectedModel;

  try {
    showLoadingState();
    // Save state so if popup closes, we know we are working
    await chrome.storage.local.set({ isLoading: true, summary: "" });

    modelData = await chrome.storage.local.get('selectedModel');
    selectedModel = modelData.selectedModel || 'gemini';
    let apiUrl = "";
    if (selectedModel === 'gemini') {
      apiUrl = "https://my-gemini-proxy-one.vercel.app/api/summarize";
    } else if (selectedModel === 'chatgpt_api') {
      // Assuming a different proxy endpoint for the ChatGPT API
      apiUrl = "https://my-chatgpt-proxy.vercel.app/api/index"; 
    } else {
        throw new Error("Invalid AI model selected.");
    }

    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Execute a script on that tab to grab the text
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageContent
    });

    if (!result || result.length < 50) {
      throw new Error("text length less than 50");
    }

    const MAX_LENGTH = 15000;
    const cleanText = result.length > MAX_LENGTH 
      ? result.substring(0, MAX_LENGTH) + "... [Content Truncated]" 
      : result;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Summarize this text using bullet points and/or tables. Focus on the main insights: " + result })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    let summaryText;
    if (selectedModel === 'gemini') {
        summaryText = data.reply;
    } else if (selectedModel === 'chatgpt_api') {
        summaryText = data.text || data.output || data.message;
    }

    if (!summaryText) {
        summaryText = data.reply || data.text || data.summary || data.content;
    }

    if (!summaryText || typeof summaryText !== 'string') {
        throw new Error("API response is invalid or missing summary text.");
    }

    await chrome.storage.local.set({ isLoading: false, summaryText });
    renderMarkdown(summaryText);

  } catch (error) {
    // 2. Show error in the UI so you know what happened
    console.error(error);
    outputDiv.innerText = "Error: " + error.message;
    await chrome.storage.local.set({ isLoading: false });
    resetButton();
  }
});

// Copy to Clipboard
document.getElementById("copyBtn").addEventListener("click", () => {
  const outputDiv = document.getElementById("output");
  const copyBtn = document.getElementById("copyBtn");
  
  // Get the plain text of the summary
  const textToCopy = outputDiv.innerText;

  navigator.clipboard.writeText(textToCopy).then(() => {
    // Visual Feedback
    const originalText = copyBtn.innerText;
    copyBtn.innerText = "Copied!";
    copyBtn.style.background = "#28a745"; // Green success color
    
    setTimeout(() => {
      copyBtn.innerText = originalText;
      copyBtn.style.background = "#6c757d"; // Revert to grey
    }, 2000);
  });
});

// Helper Functions
function showLoadingState() {
  const btn = document.getElementById("summarizeBtn");
  const outputDiv = document.getElementById("output");
  btn.disabled = true;
  btn.innerText = "Summarizing...";
  outputDiv.innerHTML = '<div class="spinner"></div> Thinking...';
  hideCopyButton();
}

function resetButton() {
  const btn = document.getElementById("summarizeBtn");
  btn.disabled = false;
  btn.innerText = "Summarize Page";
}

function renderMarkdown(text) {
  document.getElementById("output").innerHTML = marked.parse(text);
  resetButton();
  showCopyButton();
}

function extractPageContent() {
  // 1. Attempt to grab the "meat" of the page (Article or Main)
  // If those don't exist, fallback to Body.
  const contentSelector = document.querySelector('article') 
      || document.querySelector('main') 
      || document.body;

  if (!contentSelector) return "";

  // 2. Clone the node so we can mutate it without breaking the user's page
  const clone = contentSelector.cloneNode(true);

  // 3. Define "junk" elements that confuse AI (Navs, Ads, Footers, Scripts)
  const junkTags = [
    'script', 'style', 'noscript', 'iframe', 
    'nav', 'footer', 'header', 'aside', 
    'button', 'form', 'svg'
  ];

  // 4. Remove junk elements from the clone
  junkTags.forEach(tag => {
    const elements = clone.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // 5. Return text, normalizing whitespace (removes giant gaps)
  return clone.innerText
  .replace(/\n+/g, '\n') // Normalize newlines
  .replace(/\s+/g, ' ')  // Normalize spaces
  .trim();
}

function showCopyButton() {
  document.getElementById("copyBtn").style.display = "block";
}

function hideCopyButton() {
  document.getElementById("copyBtn").style.display = "none";
}