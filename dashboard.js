
/* =========================================================
   UTSAVSANDESH ADMIN DASHBOARD
   Multiple Admin + Custom Festival + CRUD
   ========================================================= */

let supabaseClient = null;
let editingId = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  initializeSupabase();

  if (!supabaseClient) {
    showLoginMessage("config.js में Supabase Configuration जाँचें।");
    return;
  }

  setupEvents();
  await checkSession();
});

/* =========================================================
   INITIALIZE SUPABASE
   ========================================================= */

function initializeSupabase() {
  const config = window.SUPABASE_CONFIG;

  if (!config?.url || !config?.key || config.url.includes("YOUR_")) {
    return;
  }

  if (!window.supabase) return;

  supabaseClient = window.supabase.createClient(
    config.url,
    config.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {
  $("loginForm")?.addEventListener("submit", login);
  $("logoutBtn")?.addEventListener("click", logout);
  $("postForm")?.addEventListener("submit", savePost);
  $("resetBtn")?.addEventListener("click", resetForm);

  $("festival")?.addEventListener("change", handleFestivalChange);
}

/* =========================================================
   CUSTOM FESTIVAL
   ========================================================= */

function handleFestivalChange() {
  const festival = $("festival");
  const customInput = $("customFestival");

  if (!festival || !customInput) return;

  const isCustom = festival.value === "__custom__";

  customInput.classList.toggle("hidden", !isCustom);
  customInput.required = isCustom;

  if (!isCustom) {
    customInput.value = "";
  } else {
    customInput.focus();
  }
}

function getFestivalValue() {
  const selected = $("festival").value;

  if (selected === "__custom__") {
    return $("customFestival").value.trim();
  }

  return selected;
}

function setFestivalValue(value) {
  const festival = $("festival");
  const customInput = $("customFestival");

  const exists = Array.from(festival.options)
    .some(option => option.value === value);

  if (exists && value !== "__custom__") {
    festival.value = value;
    customInput.value = "";
    customInput.classList.add("hidden");
    customInput.required = false;
  } else {
    festival.value = "__custom__";
    customInput.value = value || "";
    customInput.classList.remove("hidden");
    customInput.required = true;
  }
}

/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showLoginMessage("Session जाँच नहीं हो सकी। दोबारा Login करें।");
    return;
  }

  if (data?.session) {
    const user = data.session.user;
    const isAdmin = await verifyAdmin(user.id);

    if (isAdmin) {
      showDashboard(user);
      await loadAdminPosts();
    } else {
      await supabaseClient.auth.signOut();
      showLoginMessage("इस Account को Admin Access नहीं मिला।");
    }
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

async function login(event) {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    showLoginMessage("Email और Password दोनों भरें।");
    return;
  }

  const button = $("loginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Login हो रहा है...";

  showLoginMessage("Account जाँच रहे हैं...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("invalid login credentials")
      ) {
        showLoginMessage(
          "Email या Password गलत है। Supabase Authentication में Account जाँचें।"
        );
      } else if (error.message.toLowerCase().includes("email not confirmed")) {
        showLoginMessage("पहले Email Confirmation पूरा करें।");
      } else {
        showLoginMessage("Login Error: " + error.message);
      }
      return;
    }

    const isAdmin = await verifyAdmin(data.user.id);

    if (!isAdmin) {
      await supabaseClient.auth.signOut();
      showLoginMessage(
        "Login सफल हुआ, लेकिन Admin Permission नहीं है। Admins Table जाँचें।"
      );
      return;
    }

    showDashboard(data.user);
    showLoginMessage("");
    await loadAdminPosts();

  } catch (error) {
    showLoginMessage("Login Error: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Login";
  }
}

/* =========================================================
   VERIFY ADMIN
   ========================================================= */

async function verifyAdmin(userId) {
  const { data, error } = await supabaseClient
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Admin verification:", error);
    showLoginMessage("Admin Permission जाँच Error: " + error.message);
    return false;
  }

  return Boolean(data);
}

/* =========================================================
   SHOW DASHBOARD
   ========================================================= */

function showDashboard(user) {
  $("loginSection").classList.add("hidden");
  $("dashboardSection").classList.remove("hidden");
  $("adminEmail").textContent = user.email || "";
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

/* =========================================================
   SAVE POST
   ========================================================= */

async function savePost(event) {
  event.preventDefault();

  const title = $("title").value.trim();
  const festivalValue = getFestivalValue();

  if (!title) {
    showFormMessage("Title आवश्यक है।");
    return;
  }

  if (!festivalValue) {
    showFormMessage("Festival का नाम लिखें या चुनें।");
    return;
  }

  const content = $("content").value.trim();

  if (!content) {
    showFormMessage("Content आवश्यक है।");
    return;
  }

  const yearValue = $("year").value;

  const postData = {
    title,
    slug: makeSlug(title),
    category: $("category").value,
    festival: festivalValue,
    year: yearValue ? Number(yearValue) : null,
    excerpt: $("excerpt").value.trim(),
    content,
    keywords: $("keywords").value.trim(),
    featured: $("featured").checked,
    published: $("published").checked
  };

  const saveButton = $("saveBtn");

  saveButton.disabled = true;
  saveButton.textContent = editingId ? "Updating..." : "Publishing...";

  try {
    let result;

    if (editingId) {
      result = await supabaseClient
        .from("posts")
        .update(postData)
        .eq("id", editingId);
    } else {
      result = await supabaseClient
        .from("posts")
        .insert(postData);
    }

    if (result.error) {
      showFormMessage("Save Error: " + result.error.message);
      console.error(result.error);
      return;
    }

    showFormMessage(editingId ? "Post Updated ✓" : "Post Published ✓");

    resetForm();
    await loadAdminPosts();

  } catch (error) {
    showFormMessage("Error: " + error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId ? "Update Post" : "Publish Post";
  }
}

/* =========================================================
   LOAD POSTS
   ========================================================= */

async function loadAdminPosts() {
  const { data, error } = await supabaseClient
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    $("adminPosts").innerHTML =
      `<p class="text-red-400">Posts Load Error: ${escapeHTML(error.message)}</p>`;
    return;
  }

  $("postCount").textContent = `${data.length} posts`;
  $("adminPosts").innerHTML = data.map(createAdminPost).join("");
}

/* =========================================================
   POST CARD
   ========================================================= */

function createAdminPost(post) {
  return `
    <article class="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="text-xs text-amber-400">
              ${escapeHTML(post.festival)}
            </span>

            <span class="text-xs text-slate-500">
              ${escapeHTML(post.category)}
            </span>

            <span class="text-xs ${
              post.published ? "text-emerald-400" : "text-red-400"
            }">
              ${post.published ? "Published" : "Draft"}
            </span>
          </div>

          <h3 class="font-bold">${escapeHTML(post.title)}</h3>

          <p class="text-sm text-slate-500 mt-1">
            ${escapeHTML(post.excerpt || "")}
          </p>
        </div>

        <div class="flex gap-2 shrink-0">
          <button
            onclick="editPost('${post.id}')"
            class="px-3 py-2 text-xs rounded-lg bg-white/10"
          >Edit</button>

          <button
            onclick="deletePost('${post.id}')"
            class="px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-300"
          >Delete</button>
        </div>
      </div>
    </article>
  `;
}

/* =========================================================
   EDIT POST
   ========================================================= */

async function editPost(id) {
  const { data, error } = await supabaseClient
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert("Edit Error: " + error.message);
    return;
  }

  editingId = id;

  $("postId").value = id;
  $("title").value = data.title || "";
  $("category").value = data.category || "Wishes";

  setFestivalValue(data.festival || "General");

  $("year").value = data.year || "";
  $("excerpt").value = data.excerpt || "";
  $("content").value = data.content || "";
  $("keywords").value = data.keywords || "";

  $("featured").checked = Boolean(data.featured);
  $("published").checked = Boolean(data.published);

  $("saveBtn").textContent = "Update Post";
  $("formMessage").textContent = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================================
   DELETE POST
   ========================================================= */

async function deletePost(id) {
  if (!confirm("क्या आप यह Post Permanently Delete करना चाहते हैं?")) {
    return;
  }

  const { error } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete Error: " + error.message);
    return;
  }

  await loadAdminPosts();
}

/* =========================================================
   RESET
   ========================================================= */

function resetForm() {
  editingId = null;

  $("postForm").reset();

  $("postId").value = "";
  $("year").value = "2026";
  $("published").checked = true;

  $("festival").value = "Navratri";

  $("customFestival").value = "";
  $("customFestival").classList.add("hidden");
  $("customFestival").required = false;

  $("saveBtn").textContent = "Publish Post";
  $("formMessage").textContent = "";
}

/* =========================================================
   SLUG
   ========================================================= */

function makeSlug(title) {
  const map = {
    "नवरात्रि": "navratri",
    "दशहरा": "dussehra",
    "दीपावली": "diwali",
    "दिवाली": "diwali",
    "शुभकामनाएं": "wishes",
    "शुभकामना": "wish",
    "छठ": "chhath",
    "पूजा": "puja",
    "होली": "holi"
  };

  let value = title;

  Object.entries(map).forEach(([hindi, english]) => {
    value = value.replaceAll(hindi, english);
  });

  value = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || `post-${Date.now()}`;
}

/* =========================================================
   MESSAGES
   ========================================================= */

function showLoginMessage(message) {
  $("loginMessage").textContent = message;
}

function showFormMessage(message) {
  $("formMessage").textContent = message;
}

/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", async () => {
    const emailInput = document.getElementById("email");
    const email = emailInput?.value.trim();

    if (!email) {
      alert("पहले Email दर्ज करो!");
      emailInput?.focus();
      return;
    }

    const confirmed = confirm(
      `${email} पर Password Reset Link भेजें?`
    );

    if (!confirmed) return;

    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = "Sending...";

    try {
      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin +
            window.location.pathname.replace(/admin\.html$/, "reset-password.html")
        });

      if (error) throw error;

      alert("Password Reset Email भेज दिया गया है। Gmail Inbox और Spam चेक करें।");
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      forgotPasswordBtn.disabled = false;
      forgotPasswordBtn.textContent = "Forgot Password?";
    }
  });
}
