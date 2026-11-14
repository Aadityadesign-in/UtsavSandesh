/* =========================================================
   UTSAVSANDESH PUBLIC APP
   ========================================================= */

let supabaseClient = null;
let allPosts = [];
let activeFestival = "";

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", async () => {

  initializeSupabase();

  setupNavigation();

  setupSearch();

  setupFestivalFilters();

  await loadPosts();

});


/* =========================================================
   SUPABASE
   ========================================================= */

function initializeSupabase() {

  if (
    !window.SUPABASE_CONFIG ||
    !window.SUPABASE_CONFIG.url ||
    !window.SUPABASE_CONFIG.key ||
    window.SUPABASE_CONFIG.url.includes("YOUR_")
  ) {
    console.warn(
      "Supabase is not configured. Add credentials in config.js."
    );

    return;
  }

  if (!window.supabase) {
    console.error(
      "Supabase library has not loaded."
    );

    return;
  }

  supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.key
  );
}


/* =========================================================
   LOAD POSTS
   ========================================================= */

async function loadPosts() {

  const loading = $("#loadingState");
  const grid = $("#postsGrid");

  if (!supabaseClient) {

    loading.innerHTML = `
      <p>
        Supabase configuration required.
      </p>
    `;

    return;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("posts")
    .select(`
      id,
      title,
      slug,
      category,
      festival,
      year,
      excerpt,
      content,
      keywords,
      featured,
      published,
      created_at
    `)
    .eq("published", true)
    .order("featured", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    loading.innerHTML = `
      <p>
        Content load नहीं हो सका।
      </p>
    `;

    return;
  }

  allPosts = data || [];

  renderPosts(allPosts);

}


/* =========================================================
   RENDER
   ========================================================= */

function renderPosts(posts) {

  const grid = $("#postsGrid");
  const loading = $("#loadingState");
  const empty = $("#emptyState");
  const count = $("#resultCount");

  loading.classList.add("hidden");

  count.textContent =
    `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;

  if (!posts.length) {

    grid.classList.add("hidden");
    empty.classList.remove("hidden");

    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");

  grid.innerHTML = posts
    .map(createPostCard)
    .join("");
}


/* =========================================================
   POST CARD
   ========================================================= */

function createPostCard(post) {

  const quotes = String(post.content || "")
    .split(/\n+/)
    .map(text => text.trim())
    .filter(Boolean);

  const visibleQuotes = quotes.slice(0, 6);

  const listHTML = visibleQuotes
    .map((quote) => {

      return `
        <li class="quote-item">

          <span class="quote-text">
            ${escapeHTML(quote)}
          </span>

          <button
            class="copy-btn"
            type="button"
            onclick='copyQuote(${JSON.stringify(quote)})'
          >
            Copy
          </button>

        </li>
      `;

    })
    .join("");

  /*
   * Full post text
   */
  const shareText =
    `${post.title}\n\n${quotes.join("\n")}`;

  /*
   * Post detail page
   */
  const postURL =
    `post.html?slug=${encodeURIComponent(post.slug || "")}`;

  /*
   * Correct full URL
   */
  const fullPostURL =
    new URL(
      postURL,
      window.location.href
    ).href;

  /*
   * WhatsApp share
   */
  const whatsappURL =
    `https://wa.me/?text=${encodeURIComponent(
      `${shareText}\n\n${fullPostURL}`
    )}`;

  return `
    <article
      class="post-card"
      data-festival="${escapeHTML(post.festival || "")}"
      data-category="${escapeHTML(post.category || "")}"
    >

      <!-- POST HEADER -->
      <div class="post-meta">

        ${
          post.category
            ? `
              <span class="post-category">
                ${escapeHTML(post.category)}
              </span>
            `
            : ""
        }

        ${
          post.festival
            ? `
              <span class="post-festival">
                ${escapeHTML(post.festival)}
                ${
                  post.year
                    ? ` ${escapeHTML(String(post.year))}`
                    : ""
                }
              </span>
            `
            : ""
        }

      </div>

      <!-- TITLE -->
      <h3 class="post-title">

        <a
          href="${postURL}"
          class="post-title-link"
        >
          ${escapeHTML(post.title)}
        </a>

      </h3>

      <!-- EXCERPT -->
      ${
        post.excerpt
          ? `
            <p class="post-excerpt">
              ${escapeHTML(post.excerpt)}
            </p>
          `
          : ""
      }

      <!-- QUOTES -->
      ${
        visibleQuotes.length
          ? `
            <ul class="quote-list">
              ${listHTML}
            </ul>
          `
          : ""
      }

      <!-- ACTIONS -->
      <div class="post-actions">

        <button
          type="button"
          onclick='copyQuote(${JSON.stringify(
            quotes.join("\n")
          )})'
        >
          📋 Copy All
        </button>

        <a
          class="whatsapp"
          href="${whatsappURL}"
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 WhatsApp
        </a>

        <a
          class="view-post"
          href="${postURL}"
        >
          Read More →
        </a>

      </div>

    </article>
  `;
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

  const input = $("#searchInput");

  if (!input) {
    return;
  }

  input.addEventListener(
    "input",
    debounce(() => {

      const query =
        input.value
          .trim()
          .toLowerCase();

      filterPosts(query);

    }, 150)
  );

}


function filterPosts(query = "") {

  let results = allPosts;

  if (activeFestival) {

    results = results.filter(
      post =>
        String(post.festival)
          .toLowerCase()
          .includes(
            activeFestival.toLowerCase()
          )
    );

  }

  if (query) {

    results = results.filter(post => {

      const searchable = [
        post.title,
        post.category,
        post.festival,
        post.excerpt,
        post.content,
        post.keywords
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);

    });

  }

  renderPosts(results);

}


/* =========================================================
   FESTIVAL FILTER
   ========================================================= */

function setupFestivalFilters() {

  document
    .querySelectorAll("[data-filter]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeFestival =
            button.dataset.filter || "";

          const input =
            $("#searchInput");

          if (input) {
            input.value = "";
          }

          filterPosts();

          const latest =
            $("#latest");

          if (latest) {
            latest.scrollIntoView({
              behavior: "smooth"
            });
          }

        }
      );

    });

}


/* =========================================================
   COPY
   ========================================================= */

async function copyQuote(text) {

  try {

    await navigator.clipboard.writeText(
      text
    );

    showToast("Copied! ✓");

  } catch (error) {

    fallbackCopy(text);

  }

}


function fallbackCopy(text) {

  const textarea =
    document.createElement("textarea");

  textarea.value = text;

  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.select();

  try {
    document.execCommand("copy");
    showToast("Copied! ✓");
  } catch {
    showToast("Copy failed");
  }

  textarea.remove();
}


/* =========================================================
   SHARE WEBSITE
   ========================================================= */

async function shareSite() {

  const shareData = {
    title: "UtsavSandesh",
    text:
      "Hindi Wishes, Quotes & Festival Status",
    url: window.location.href
  };

  if (
    navigator.share
  ) {

    try {

      await navigator.share(
        shareData
      );

    } catch {
      // User cancelled share.
    }

  } else {

    await copyQuote(
      window.location.href
    );

  }
}


/* =========================================================
   MOBILE NAV
   ========================================================= */

function setupNavigation() {

  const button =
    $("#menuBtn");

  const menu =
    $("#mobileMenu");

  if (!button || !menu) {
    return;
  }

  button.addEventListener(
    "click",
    () => {
      menu.classList.toggle(
        "open"
      );
    }
  );

  menu
    .querySelectorAll("a")
    .forEach(link => {

      link.addEventListener(
        "click",
        () => {
          menu.classList.remove(
            "open"
          );
        }
      );

    });

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer;

function showToast(message) {

  const toast =
    $("#toast");

  if (!toast) {
    return;
  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 1800);
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function debounce(
  callback,
  delay
) {

  let timeout;

  return (...args) => {

    clearTimeout(timeout);

    timeout =
      setTimeout(
        () => callback(...args),
        delay
      );

  };
}


/* ================================================
   UTSAVSANDESH WEBSITE HELP ASSISTANT
   No API | No Backend | Hindi + English
================================================ */

(() => {
  if (window.utsavAssistantLoaded) return;
  window.utsavAssistantLoaded = true;

  const toggle = document.getElementById("chatToggle");
  const close = document.getElementById("chatClose");
  const chatWindow = document.getElementById("chatWindow");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");

  if (!toggle || !close || !chatWindow || !form || !input || !messages) {
    return;
  }

  // OPEN / CLOSE
  function openChat() {
    chatWindow.classList.remove("hidden");
    input.focus();
  }

  function closeChat() {
    chatWindow.classList.add("hidden");
  }

  toggle.addEventListener("click", () => {
    chatWindow.classList.contains("hidden")
      ? openChat()
      : closeChat();
  });

  close.addEventListener("click", closeChat);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeChat();
  });

  // MESSAGE UI
  function addMessage(text, type = "bot") {
    const div = document.createElement("div");
    div.className = type === "user" ? "user-msg" : "bot-msg";
    div.textContent = text;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // KNOWLEDGE BASE
  const knowledge = [
    {
      keywords: ["website", "वेबसाइट", "utsavsandesh", "क्या है", "about"],
      answer: `🌸 UtsavSandesh क्या है?

UtsavSandesh एक Festival Wishes और Greetings Website है।

यहाँ visitors त्योहारों और खास अवसरों के लिए wishes, quotes और greeting messages खोज सकते हैं।

मुख्य सुविधाएँ:
• Festival Wishes
• Hindi Greetings
• Quotes और Status
• Wishes Copy और Share
• Festival-related content

Website:
https://aadityadesign-in.github.io/UtsavSandesh/`
    },

    {
      keywords: ["wish studio", "wishstudio", "studio", "greeting card"],
      answer: `🎨 Wish Studio

Wish Studio का उद्देश्य personal greeting और wish card बनाने में मदद करना है।

यदि Wish Studio page उपलब्ध है:
1. Wish Studio खोलें।
2. उपलब्ध design/template चुनें।
3. Wish text customize करें।
4. उपलब्ध options से card तैयार करें।
5. Save या Share options इस्तेमाल करें।

कुछ features की availability actual page पर निर्भर करती है।`
    },

    {
      keywords: ["festival", "त्योहार", "festivals", "occasion"],
      answer: `🎉 Festival Wishes

Homepage पर Festival sections या filters का उपयोग करके wishes खोज सकते हैं।

उपलब्ध प्रमुख festivals:
• Navratri
• Dussehra
• Diwali

अधिक festivals का content उपलब्ध होने पर उन्हें भी explore कर सकते हैं।`
    },

    {
      keywords: ["diwali", "दिवाली", "दीपावली"],
      answer: `🪔 Diwali Wishes

Homepage पर Diwali Festival filter चुनें।

आप उपलब्ध wishes पढ़ सकते हैं, Copy कर सकते हैं और Share कर सकते हैं।

शुभ दीपावली!`
    },

    {
      keywords: ["navratri", "नवरात्र"],
      answer: `🙏 Navratri Wishes

Homepage पर Navratri Festival filter चुनकर संबंधित wishes खोजें।

आप अपनी पसंद का message Copy और Share कर सकते हैं।

जय माता दी!`
    },

    {
      keywords: ["dussehra", "दशहरा", "विजयादशमी"],
      answer: `🏹 Dussehra Wishes

Homepage पर Dussehra Festival filter चुनें।

उपलब्ध शुभकामना संदेश पढ़ें और अपने परिवार एवं दोस्तों के साथ Share करें।

विजयादशमी की हार्दिक शुभकामनाएँ!`
    },

    {
      keywords: ["search", "खोज", "ढूंढ", "find"],
      answer: `🔍 Wishes कैसे खोजें?

1. Homepage के Search Box में keyword लिखें।
2. Festival filter चुनें।
3. उपलब्ध wishes देखें।
4. पसंद की wish Copy या Share करें।

उदाहरण: Diwali, Navratri, Dussehra।`
    },

    {
      keywords: ["copy", "कॉपी", "share", "whatsapp", "भेज", "send"],
      answer: `📤 Wish Share कैसे करें?

1. अपनी पसंद की Wish खोलें।
2. Copy button से message Copy करें।
3. WhatsApp Share option उपलब्ध हो तो चुनें।
4. अपने friends और family को भेजें।`
    },

    {
      keywords: ["admin", "पोस्ट", "publish", "upload"],
      answer: `🛠️ Website Admin

Website content को manage करने के लिए authorized Admin setup का उपयोग किया जाता है।

Admin access केवल authorized administrator के लिए है।

Public visitors को admin credentials नहीं देने चाहिए।`
    },

    {
      keywords: ["mobile", "फोन", "responsive", "android"],
      answer: `📱 Mobile Support

UtsavSandesh responsive website है।

Mobile browser में website खोलकर Search, Festival sections और Wishes को explore करें।`
    },

    {
      keywords: ["contact", "संपर्क", "developer", "owner"],
      answer: `📩 Contact

Website के Footer में Contact और WhatsApp options उपलब्ध हैं।

Developer contact:
https://wa.me/919135766040

Website:
https://aadityadesign-in.github.io/UtsavSandesh/`
    },

    {
      keywords: ["privacy", "terms", "disclaimer"],
      answer: `📄 Website Policies

Website के Footer में उपलब्ध links से Privacy Policy, Terms और Disclaimer pages पढ़ सकते हैं।`
    },

    {
      keywords: ["birthday", "जन्मदिन"],
      answer: `🎂 Birthday Wishes

Birthday wishes खोजने के लिए Search Box में Birthday लिखें।

यदि संबंधित wishes website पर उपलब्ध हैं, तो search results में दिखाई देंगी।`
    },

    {
      keywords: ["help", "मदद", "guide", "कैसे काम", "use"],
      answer: `😊 Utsav Assistant Help

मैं इन विषयों पर मदद कर सकता हूँ:

• Website क्या है?
• Wishes कैसे खोजें?
• Wish Studio क्या है?
• Wishes कैसे Copy करें?
• WhatsApp पर Share कैसे करें?
• Festival filters कैसे इस्तेमाल करें?
• Website Admin क्या है?
• Contact कैसे करें?

अपना सवाल लिखें।`
    }
  ];

  // NORMALIZE TEXT
  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // GET RESPONSE
  function getReply(message) {
    const text = normalize(message);

    if (/^(hi|hello|hey|नमस्ते|नमस्कार|हेलो)$/.test(text)) {
      return "नमस्ते! 🙏 UtsavSandesh में आपका स्वागत है। मैं आपकी किस प्रकार मदद कर सकता हूँ?";
    }

    if (/thank|धन्यवाद/.test(text)) {
      return "आपका स्वागत है! 😊 UtsavSandesh इस्तेमाल करने के लिए धन्यवाद।";
    }

    if (/who are you|तुम कौन/.test(text)) {
      return "मैं Utsav Assistant हूँ। मैं UtsavSandesh website के features और wishes इस्तेमाल करने में मदद करता हूँ।";
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const item of knowledge) {
      let score = 0;

      for (const keyword of item.keywords) {
        const key = normalize(keyword);

        if (text === key) {
          score += 5;
        } else if (text.includes(key)) {
          score += 3;
        } else if (key.includes(text) && text.length > 2) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && bestScore >= 2) {
      return bestMatch.answer;
    }

    return `🤔 मुझे आपका सवाल पूरी तरह समझ नहीं आया।

आप इन topics पर पूछ सकते हैं:

🌐 Website क्या है?
🎨 Wish Studio
🔍 Wishes Search
📤 Copy और WhatsApp Share
🎉 Festival Wishes
📱 Mobile Website
📩 Contact

आप अपना सवाल थोड़ा अलग तरीके से लिख सकते हैं।`;
  }

  // SEND MESSAGE
  function sendMessage(message) {
    const clean = message.trim();
    if (!clean) return;

    addMessage(clean, "user");

    const reply = getReply(clean);

    setTimeout(() => addMessage(reply, "bot"), 250);
  }

  form.addEventListener("submit", e => {
    e.preventDefault();

    const message = input.value;
    input.value = "";

    sendMessage(message);
  });

  // QUICK QUESTIONS
  document.querySelectorAll("[data-chat]").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.chat);
    });
  });

})();


const whatsNewPopup = document.getElementById("whatsNewPopup");

function closeWhatsNew() {
  whatsNewPopup.classList.remove("show");
}

// 1.5 सेकंड बाद Popup दिखेगा
setTimeout(() => {
  whatsNewPopup.classList.add("show");
}, 1500);


/* UTSAVSANDESH FEEDBACK SYSTEM */

const feedbackClient = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.key
);

let selectedFeedbackRating = 0;

const ratingButtons =
  document.querySelectorAll("#ratingStars button");

ratingButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedFeedbackRating = Number(button.dataset.rating);

    document.getElementById("ratingValue").value =
      selectedFeedbackRating;

    ratingButtons.forEach(star => {
      star.classList.toggle(
        "active",
        Number(star.dataset.rating) <= selectedFeedbackRating
      );
    });
  });
});

// Submit feedback
document.getElementById("feedbackForm")
.addEventListener("submit", async event => {
  event.preventDefault();

  const status = document.getElementById("feedbackStatus");
  const submit = document.getElementById("feedbackSubmit");

  if (selectedFeedbackRating < 1) {
    status.textContent = "⭐ कृपया rating चुनें।";
    return;
  }

  const name = document.getElementById("feedbackName")
    .value.trim();

  const message = document.getElementById("feedbackMessage")
    .value.trim();

  const suggestion = document.getElementById("feedbackSuggestion")
    .value.trim();

  submit.disabled = true;
  status.textContent = "Submitting...";

  const { error } = await feedbackClient
    .from("feedback")
    .insert({
      name: name || "Anonymous",
      rating: selectedFeedbackRating,
      message,
      suggestion: suggestion || null
    });

  submit.disabled = false;

  if (error) {
    console.error(error);
    status.textContent = "Feedback submit नहीं हुआ।";
    return;
  }

  status.textContent = "🎉 Thank you! आपका feedback live हो गया।";

  event.target.reset();
  selectedFeedbackRating = 0;

  ratingButtons.forEach(star => star.classList.remove("active"));

  loadPublicFeedback();
});

// Load public feedback
async function loadPublicFeedback() {
  const reviewsBox = document.getElementById("feedbackReviews");

  const { data, error } = await feedbackClient
    .from("feedback")
    .select("id,name,rating,message,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    reviewsBox.textContent = "Reviews load नहीं हो सके।";
    console.error(error);
    return;
  }

  const reviews = data || [];

  const average = reviews.length
    ? reviews.reduce((sum, item) => sum + item.rating, 0)
      / reviews.length
    : 0;

  document.getElementById("avgRating").textContent =
    average.toFixed(1);

  document.getElementById("totalReviews").textContent =
    reviews.length;

  reviewsBox.replaceChildren();

  if (!reviews.length) {
    reviewsBox.textContent = "अभी पहला review आप लिख सकते हैं!";
    return;
  }

  reviews.forEach(item => {
    const card = document.createElement("article");
    card.className = "feedback-review";

    const top = document.createElement("div");
    top.className = "feedback-review-top";

    const name = document.createElement("span");
    name.className = "feedback-review-name";
    name.textContent = item.name || "Anonymous";

    const stars = document.createElement("span");
    stars.className = "feedback-review-stars";
    stars.textContent = "★".repeat(item.rating);

    top.append(name, stars);

    const message = document.createElement("p");
    message.className = "feedback-review-message";
    message.textContent = item.message;

    const date = document.createElement("div");
    date.className = "feedback-review-date";
    date.textContent = new Date(item.created_at)
      .toLocaleDateString("en-IN");

    card.append(top, message, date);
    reviewsBox.append(card);
  });
}

loadPublicFeedback();
