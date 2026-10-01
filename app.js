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