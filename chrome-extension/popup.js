// Ideora Chrome Extension Popup Script

document.addEventListener("DOMContentLoaded", () => {
  // Tab Elements
  const tabUrl = document.getElementById("tab-url");
  const tabText = document.getElementById("tab-text");
  const sectionUrl = document.getElementById("section-url");
  const sectionText = document.getElementById("section-text");

  // Inputs & Actions
  const githubUrlInput = document.getElementById("github-url");
  const readmeTextInput = document.getElementById("readme-text");
  const domainSelect = document.getElementById("domain-select");
  const btnEvaluate = document.getElementById("btn-evaluate");

  // Views
  const contentArea = document.querySelector(".content");
  const loader = document.getElementById("loader");
  const loaderStatus = document.getElementById("loader-status");
  const errorContainer = document.getElementById("error-container");
  const errorMessage = document.getElementById("error-message");
  const resultsContainer = document.getElementById("results");

  // Result Elements
  const resultTitle = document.getElementById("result-title");
  const resultDesc = document.getElementById("result-desc");
  const resultVal = document.getElementById("result-val");
  const resultScore = document.getElementById("result-score");
  const resultTech = document.getElementById("result-tech");
  const resultAudience = document.getElementById("result-audience");
  const resultVerdict = document.getElementById("result-verdict");
  const btnList = document.getElementById("btn-list");

  let activeTab = "url"; // "url" or "text"

  // Tab Switch logic
  tabUrl.addEventListener("click", () => {
    activeTab = "url";
    tabUrl.classList.add("active");
    tabText.classList.remove("active");
    sectionUrl.classList.remove("hidden");
    sectionText.classList.add("hidden");
  });

  tabText.addEventListener("click", () => {
    activeTab = "text";
    tabText.classList.add("active");
    tabUrl.classList.remove("active");
    sectionText.classList.remove("hidden");
    sectionUrl.classList.add("hidden");
  });

  // Evaluate action handler
  btnEvaluate.addEventListener("click", async () => {
    hide(resultsContainer);
    hide(errorContainer);

    let textToEvaluate = "";
    let githubUrlValue = "";

    const domain = domainSelect.value;

    if (activeTab === "url") {
      const url = githubUrlInput.value.trim();
      if (!url) {
        showError("Please enter a GitHub repository URL.");
        return;
      }

      githubUrlValue = url;

      // Extract owner and repo
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        showError("Invalid GitHub URL. Must be in the format: github.com/owner/repo");
        return;
      }

      const owner = match[1];
      const repo = match[2].replace(/\.git$/, "");

      showLoader("Fetching README from GitHub...");

      try {
        const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
        const res = await fetch(githubApiUrl);
        if (!res.ok) {
          throw new Error("Could not find a README file in this repository.");
        }
        const data = await res.json();
        
        // Decode base64
        const base64Content = data.content.replace(/\s/g, "");
        textToEvaluate = utf8B64Decode(base64Content);
      } catch (err) {
        hide(loader);
        showError(err.message || "Error accessing GitHub repository. Is it private or rate-limited?");
        return;
      }
    } else {
      textToEvaluate = readmeTextInput.value.trim();
      if (!textToEvaluate) {
        showError("Please paste some README text to evaluate.");
        return;
      }
    }

    showLoader("Analyzing codebase using Gemini AI...");

    try {
      const backendUrl = "http://localhost:8000/api/extension/evaluate";
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          readme_text: textToEvaluate,
          domain: domain
        })
      });

      if (!response.ok) {
        throw new Error(`API returned error status ${response.status}`);
      }

      const evalData = await response.json();
      renderResults(evalData.pitch_deck, githubUrlValue);
    } catch (err) {
      hide(loader);
      showError("Could not connect to Ideora valuation backend. Make sure the API is running on localhost:8000.");
    }
  });

  function renderResults(deck, githubUrl) {
    hide(loader);
    hide(contentArea);

    resultTitle.textContent = deck.title || "Curated Project";
    resultDesc.textContent = deck.short_description || "AI-analyzed codebase profile.";

    const price = deck.suggested_price_cents
      ? "$" + Math.round(deck.suggested_price_cents / 100).toLocaleString()
      : "$15,000";
    resultVal.textContent = price;
    resultScore.textContent = `${deck.growth_potential_score || 85}/100`;

    // Render tech stack pills
    resultTech.innerHTML = "";
    const stack = deck.tech_stack || ["React", "FastAPI"];
    stack.forEach(tech => {
      const pill = document.createElement("span");
      pill.className = "tech-pill";
      pill.textContent = tech;
      resultTech.appendChild(pill);
    });

    resultAudience.textContent = deck.target_audience || "Founders looking for high-potential MVP starters.";
    resultVerdict.textContent = deck.expert_analysis || "No verdict rendered.";

    // Configure listing button redirection
    btnList.onclick = () => {
      let targetUrl = "http://localhost:3000/sell";
      if (githubUrl) {
        targetUrl += `?github_url=${encodeURIComponent(githubUrl)}`;
      }
      window.open(targetUrl, "_blank");
    };

    show(resultsContainer);
  }

  // Helpers
  function showLoader(statusText) {
    loaderStatus.textContent = statusText;
    show(loader);
    hide(contentArea);
    hide(resultsContainer);
    hide(errorContainer);
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    show(errorContainer);
  }

  function hide(el) {
    el.classList.add("hidden");
  }

  function show(el) {
    el.classList.remove("hidden");
  }

  // Decodes UTF-8 base64 correctly
  function utf8B64Decode(str) {
    return decodeURIComponent(
      atob(str)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  }
});
