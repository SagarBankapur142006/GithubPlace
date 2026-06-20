// Ideora Chrome Extension Content Script (Manifest V3)

// Listen for startValuation action from background worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startValuation") {
    showValuationModal(message.text);
  }
});

function showValuationModal(initialText) {
  // Remove existing modal if any
  const existing = document.getElementById("ideora-valuator-root");
  if (existing) {
    existing.remove();
  }

  // Create root container
  const root = document.createElement("div");
  root.id = "ideora-valuator-root";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.width = "100vw";
  root.style.height = "100vh";
  root.style.zIndex = "2147483647"; // Absolute maximum
  root.style.pointerEvents = "none"; // Let clicks pass through background
  document.body.appendChild(root);

  // Attach Shadow DOM to prevent CSS collision
  const shadow = root.attachShadow({ mode: "open" });

  // Stylesheet
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,900&display=swap');

    .modal-backdrop {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(13, 40, 24, 0.4);
      backdrop-filter: blur(8px);
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .modal-backdrop.active {
      opacity: 1;
    }

    .modal-container {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -45%) scale(0.95);
      width: 90%;
      max-width: 650px;
      max-height: 85vh;
      background: rgba(250, 249, 246, 0.95);
      border: 1px solid rgba(227, 223, 211, 0.8);
      border-radius: 24px;
      box-shadow: 0 30px 70px rgba(13, 40, 24, 0.25);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #141715;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      opacity: 0;
      transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
    }

    .modal-container.active {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }

    /* Header styling */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid rgba(227, 223, 211, 0.6);
      background: rgba(250, 249, 246, 0.5);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-text {
      font-family: 'Playfair Display', serif;
      font-size: 1.6rem;
      font-weight: 900;
      color: #0d2818;
      letter-spacing: -0.5px;
    }

    .logo-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(212, 175, 55, 0.15);
      color: #b5952f;
      padding: 2px 8px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .close-btn {
      background: #ffffff;
      border: 1px solid rgba(227, 223, 211, 0.8);
      color: #5c665e;
      cursor: pointer;
      width: 36px; height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .close-btn:hover {
      background: #0d2818;
      color: #faf9f6;
      transform: rotate(90deg);
    }

    /* Main Body Area */
    .body {
      padding: 2rem;
      overflow-y: auto;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    /* Domain selector */
    .domain-selector-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid rgba(227, 223, 211, 0.6);
    }

    .selector-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #5c665e;
    }

    .select-dropdown {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(227, 223, 211, 0.8);
      background: #faf9f6;
      font-family: inherit;
      font-weight: 600;
      color: #0d2818;
      cursor: pointer;
      outline: none;
      transition: border-color 0.3s;
    }

    .select-dropdown:focus {
      border-color: #d4af37;
    }

    /* Loading Spinner */
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 0;
      flex-grow: 1;
    }

    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(13, 40, 24, 0.1);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 1s infinite linear;
      margin-bottom: 1.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loader-text {
      font-size: 1.1rem;
      color: #0d2818;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-family: 'Playfair Display', serif;
    }

    .loader-subtext {
      font-size: 0.85rem;
      color: #5c665e;
    }

    /* Content Rendering */
    .valuation-results {
      animation: fadeIn 0.4s ease-out forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .project-header {
      margin-bottom: 1.5rem;
    }

    .project-title {
      font-family: 'Playfair Display', serif;
      font-size: 2rem;
      color: #0d2818;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .project-tagline {
      font-size: 1.05rem;
      color: #5c665e;
      line-height: 1.5;
      margin: 0;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      background: #ffffff;
      padding: 1.25rem;
      border-radius: 16px;
      border: 1px solid rgba(227, 223, 211, 0.6);
      box-shadow: 0 4px 20px rgba(13, 40, 24, 0.02);
      display: flex;
      flex-direction: column;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #5c665e;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }

    .stat-value {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0d2818;
      margin: 0;
    }

    .stat-value.gold {
      background: linear-gradient(135deg, #0d2818, #d4af37);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-family: 'Playfair Display', serif;
    }

    /* Detail Grid (Tech, Audience) */
    .details-box {
      background: #ffffff;
      padding: 1.5rem;
      border-radius: 16px;
      border: 1px solid rgba(227, 223, 211, 0.6);
      margin-bottom: 1.5rem;
    }

    .detail-section {
      margin-bottom: 1.2rem;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .detail-heading {
      font-size: 0.8rem;
      font-weight: 700;
      color: #141715;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .tech-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tech-pill {
      background: #faf9f6;
      border: 1px solid rgba(227, 223, 211, 0.8);
      color: #5c665e;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .detail-text {
      font-size: 0.95rem;
      color: #5c665e;
      margin: 0;
      line-height: 1.5;
    }

    /* Expert Analysis Box */
    .analysis-container {
      margin-bottom: 2rem;
    }

    .analysis-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #b5952f;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .analysis-content {
      background: rgba(212, 175, 55, 0.04);
      border-left: 4px solid #d4af37;
      padding: 1.25rem;
      border-radius: 0 12px 12px 0;
      font-size: 0.9rem;
      line-height: 1.6;
      color: #141715;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-line;
    }

    /* Footer Action Area */
    .footer {
      display: flex;
      gap: 12px;
      padding: 1.5rem 2rem;
      border-top: 1px solid rgba(227, 223, 211, 0.6);
      background: rgba(250, 249, 246, 0.5);
    }

    .btn {
      flex: 1;
      padding: 1rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      border: none;
      transition: all 0.3s ease;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: #0d2818;
      color: #faf9f6;
    }

    .btn-primary:hover {
      background: #07170e;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(13, 40, 24, 0.2);
    }

    .btn-secondary {
      background: #ffffff;
      border: 1px solid rgba(227, 223, 211, 0.8);
      color: #0d2818;
    }

    .btn-secondary:hover {
      background: #faf9f6;
      border-color: #d4af37;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(13, 40, 24, 0.1);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(13, 40, 24, 0.25);
    }
  `;
  shadow.appendChild(style);

  // Backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  shadow.appendChild(backdrop);

  // Container
  const container = document.createElement("div");
  container.className = "modal-container";
  shadow.appendChild(container);

  // Render Skeleton UI structure
  container.innerHTML = `
    <div class="header">
      <div class="logo-container">
        <span class="logo-text">Ideora.</span>
        <span class="logo-badge">AI Valuator</span>
      </div>
      <button class="close-btn" id="ideora-close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="body">
      <div class="domain-selector-row">
        <span class="selector-label">Domain Specialization:</span>
        <select class="select-dropdown" id="ideora-domain">
          <option value="general">General Software</option>
          <option value="saas">B2B SaaS / Subscriptions</option>
          <option value="fintech">Fintech & Payments</option>
          <option value="data_analytics">Data Analytics & BI</option>
        </select>
      </div>
      <div id="ideora-content-area" style="flex-grow:1; display:flex; flex-direction:column;"></div>
    </div>
    <div class="footer" id="ideora-footer" style="display:none;">
      <button class="btn btn-secondary" id="ideora-re-evaluate">🔄 Re-Evaluate</button>
      <button class="btn btn-primary" id="ideora-list">✨ List on Ideora</button>
    </div>
  `;

  // Bind close buttons
  const closeAction = () => {
    backdrop.classList.remove("active");
    container.classList.remove("active");
    setTimeout(() => {
      root.remove();
    }, 400);
  };
  backdrop.addEventListener("click", closeAction);
  shadow.getElementById("ideora-close").addEventListener("click", closeAction);

  // Dropdown event listener to re-evaluate
  const domainSelect = shadow.getElementById("ideora-domain");
  domainSelect.addEventListener("change", (e) => {
    performValuation(initialText, e.target.value);
  });

  shadow.getElementById("ideora-re-evaluate").addEventListener("click", () => {
    performValuation(initialText, domainSelect.value);
  });

  // Redirect to Sell Page with prefilled URL if on github
  shadow.getElementById("ideora-list").addEventListener("click", () => {
    let targetUrl = "http://localhost:3000/sell";
    if (window.location.host.includes("github.com")) {
      targetUrl += `?github_url=${encodeURIComponent(window.location.href)}`;
    }
    window.open(targetUrl, "_blank");
  });

  // Trigger initial valuation
  performValuation(initialText, "general");

  // Animations trigger
  setTimeout(() => {
    backdrop.classList.add("active");
    container.classList.add("active");
  }, 10);

  function performValuation(text, domain) {
    const contentArea = shadow.getElementById("ideora-content-area");
    const footer = shadow.getElementById("ideora-footer");

    footer.style.display = "none";
    contentArea.innerHTML = `
      <div class="loader-container">
        <div class="spinner"></div>
        <div class="loader-text">Analyzing Codebase...</div>
        <div class="loader-subtext">Gemini M&A analyst is calculating valuation metrics</div>
      </div>
    `;

    fetch("http://localhost:8000/api/extension/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        readme_text: text,
        domain: domain
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Server error " + res.status);
        return res.json();
      })
      .then(data => {
        const deck = data.pitch_deck;
        const priceFormatted = deck.suggested_price_cents 
          ? "$" + Math.round(deck.suggested_price_cents / 100).toLocaleString() 
          : "$15,000";

        contentArea.innerHTML = `
          <div class="valuation-results">
            <div class="project-header">
              <h3 class="project-title">${deck.title || "Untitled Product"}</h3>
              <p class="project-tagline">${deck.short_description || "AI-generated valuation report."}</p>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-label">Estimated Market Value</span>
                <span class="stat-value gold">${priceFormatted}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">Ideora Growth Score</span>
                <span class="stat-value">${deck.growth_potential_score || 85}/100</span>
              </div>
            </div>

            <div class="details-box">
              <div class="detail-section">
                <span class="detail-heading">Detected Stack</span>
                <div class="tech-pills">
                  ${(deck.tech_stack || ["React", "FastAPI"]).map(t => `<span class="tech-pill">${t}</span>`).join("")}
                </div>
              </div>
              <div class="detail-section">
                <span class="detail-heading">Target Buyer Profile</span>
                <p class="detail-text">${deck.target_audience || "Entrepreneurs looking to enter this space."}</p>
              </div>
            </div>

            <div class="analysis-container">
              <span class="analysis-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                Expert Analyst Verdict
              </span>
              <div class="analysis-content">${deck.expert_analysis || "No analytical notes generated."}</div>
            </div>
          </div>
        `;

        footer.style.display = "flex";
      })
      .catch(err => {
        console.error(err);
        contentArea.innerHTML = `
          <div class="loader-container" style="color: #ef4444; text-align: center; padding: 2rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="loader-text" style="color: #ef4444;">Valuation Failed</div>
            <div class="loader-subtext" style="color: #666; margin-top: 0.5rem;">
              Could not communicate with the Ideora API.<br>Make sure the backend server is running on port 8000.
            </div>
            <button class="btn btn-secondary" id="ideora-retry-error" style="margin-top: 1.5rem; max-width: 200px;">Retry Connect</button>
          </div>
        `;
        shadow.getElementById("ideora-retry-error").addEventListener("click", () => {
          performValuation(text, domain);
        });
      });
  }
}
