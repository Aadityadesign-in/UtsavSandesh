/* =========================================================
   UTSAVSANDESH ADMIN
   ========================================================= */

let supabaseClient = null;
let editingId = null;

const $ = (id) =>
  document.getElementById(id);

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    initializeSupabase();

    if (!supabaseClient) {
      showLoginMessage(
        "config.js में Supabase credentials डालें।"
      );
      return;
    }

    setupEvents();

    await checkSession();

  }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeSupabase() {

  if (
    !window.SUPABASE_CONFIG ||
    !window.SUPABASE_CONFIG.url ||
    !window.SUPABASE_CONFIG.key ||
    window.SUPABASE_CONFIG.url.includes("YOUR_")
  ) {
    return;
  }

  if (!window.supabase) {
    return;
  }

  supabaseClient =
    window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.key,
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

  $("loginForm")
    ?.addEventListener(
      "submit",
      login
    );

  $("logoutBtn")
    ?.addEventListener(
      "click",
      logout
    );

  $("postForm")
    ?.addEventListener(
      "submit",
      savePost
    );

  $("resetBtn")
    ?.addEventListener(
      "click",
      resetForm
    );

}


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

  const {
    data
  } = await supabaseClient
    .auth
    .getSession();

  if (
    data &&
    data.session
  ) {

    const isAdmin =
      await verifyAdmin(
        data.session.user.id
      );

    if (isAdmin) {

      showDashboard(
        data.session.user
      );

      await loadAdminPosts();

    } else {

      await supabaseClient
        .auth
        .signOut();

      showLoginMessage(
        "इस account को admin access नहीं मिला।"
      );

    }

  }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(event) {

  event.preventDefault();

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  showLoginMessage(
    "Login हो रहा है..."
  );

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .signInWithPassword({
        email,
        password
      });

  if (error) {

    showLoginMessage(
      error.message
    );

    return;
  }

  const isAdmin =
    await verifyAdmin(
      data.user.id
    );

  if (!isAdmin) {

    await supabaseClient
      .auth
      .signOut();

    showLoginMessage(
      "Login successful है, लेकिन admin permission नहीं है।"
    );

    return;
  }

  showDashboard(
    data.user
  );

  await loadAdminPosts();
}


/* =========================================================
   VERIFY ADMIN
   ========================================================= */

async function verifyAdmin(userId) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

  if (error) {

    console.error(error);

    return false;
  }

  return Boolean(data);
}


/* =========================================================
   SHOW DASHBOARD
   ========================================================= */

function showDashboard(user) {

  $("loginSection")
    .classList
    .add("hidden");

  $("dashboardSection")
    .classList
    .remove("hidden");

  $("adminEmail")
    .textContent =
    user.email || "";

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

  await supabaseClient
    .auth
    .signOut();

  location.reload();
}


/* =========================================================
   SAVE POST
   ========================================================= */

async function savePost(event) {

  event.preventDefault();

  const postData = {
    title: $("title").value.trim(),

    slug: makeSlug(
      $("title").value.trim()
    ),

    category: $("category").value,
    festival: $("festival").value,
    year: $("year").value,
    excerpt: $("excerpt").value.trim(),
    content: $("content").value.trim(),
    keywords: $("keywords").value.trim(),

    featured: $("featured").checked,
    published: $("published").checked
  };

  if (!postData.title) {

    showFormMessage(
      "Title required है।"
    );

    return;
  }

  if (!postData.content) {

    showFormMessage(
      "Content required है।"
    );

    return;
  }

  $("saveBtn").disabled = true;

  $("saveBtn").textContent =
    editingId
      ? "Updating..."
      : "Publishing...";

  try {

    let result;

    if (editingId) {

      result =
        await supabaseClient
          .from("posts")
          .update(postData)
          .eq("id", editingId);

    } else {

      result =
        await supabaseClient
          .from("posts")
          .insert(postData);

    }

    if (result.error) {

      console.error(
        "Supabase error:",
        result.error
      );

      showFormMessage(
        result.error.message
      );

      return;
    }

    showFormMessage(
      editingId
        ? "Post updated ✓"
        : "Post published ✓"
    );

    resetForm();

    await loadAdminPosts();

  } catch (error) {

    console.error(
      "Save post error:",
      error
    );

    showFormMessage(
      error.message ||
      "Post save नहीं हो पाया।"
    );

  } finally {

    $("saveBtn").disabled = false;

    $("saveBtn").textContent =
      "Publish Post";
  }
}


/* =========================================================
   LOAD ADMIN POSTS
   ========================================================= */

async function loadAdminPosts() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("posts")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    return;
  }


  $("postCount")
    .textContent =
    `${data.length} posts`;


  $("adminPosts")
    .innerHTML =
    data
      .map(
        createAdminPost
      )
      .join("");

}


/* =========================================================
   ADMIN CARD
   ========================================================= */

function createAdminPost(post) {

  return `
    <article
      class="bg-white/5 border border-white/10 rounded-2xl p-5"
    >

      <div class="flex items-start justify-between gap-4">

        <div>

          <div class="flex gap-2 mb-2">

            <span class="text-xs text-amber-400">
              ${escapeHTML(post.festival)}
            </span>

            <span class="text-xs text-slate-500">
              ${escapeHTML(post.category)}
            </span>

            ${
              post.published
                ? `
                  <span class="text-xs text-emerald-400">
                    Published
                  </span>
                `
                : `
                  <span class="text-xs text-red-400">
                    Draft
                  </span>
                `
            }

          </div>

          <h3 class="font-bold">
            ${escapeHTML(post.title)}
          </h3>

          <p class="text-sm text-slate-500 mt-1">
            ${escapeHTML(
              post.excerpt || ""
            )}
          </p>

        </div>


        <div class="flex gap-2">

          <button
            onclick="editPost('${post.id}')"
            class="px-3 py-2 text-xs rounded-lg bg-white/10"
          >
            Edit
          </button>

          <button
            onclick="deletePost('${post.id}')"
            class="px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-300"
          >
            Delete
          </button>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   EDIT
   ========================================================= */

async function editPost(id) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();


  if (error) {

    alert(
      error.message
    );

    return;
  }


  editingId = id;

  $("postId").value = id;

  $("title").value =
    data.title || "";

  $("category").value =
    data.category || "Wishes";

  $("festival").value =
    data.festival || "General";

  $("year").value =
    data.year || "";

  $("excerpt").value =
    data.excerpt || "";

  $("content").value =
    data.content || "";

  $("keywords").value =
    data.keywords || "";

  $("featured").checked =
    Boolean(data.featured);

  $("published").checked =
    Boolean(data.published);


  $("saveBtn")
    .textContent =
    "Update Post";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =========================================================
   DELETE
   ========================================================= */

async function deletePost(id) {

  const confirmed =
    confirm(
      "क्या आप यह post permanently delete करना चाहते हैं?"
    );

  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("posts")
      .delete()
      .eq("id", id);


  if (error) {

    alert(
      error.message
    );

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

  $("year").value =
    "2026";

  $("published").checked =
    true;

  $("saveBtn")
    .textContent =
    "Publish Post";

}


/* =========================================================
   SLUG
   ========================================================= */

function makeSlug(title) {

  const transliterationMap = {
    "नवरात्रि": "navratri",
    "दशहरा": "dussehra",
    "दीपावली": "diwali",
    "दिवाली": "diwali",
    "शुभकामनाएं": "wishes",
    "शुभकामना": "wish"
  };

  let value = title;

  Object.entries(
    transliterationMap
  ).forEach(
    ([hindi, english]) => {

      value =
        value.replaceAll(
          hindi,
          english
        );

    }
  );

  value =
    value
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return value ||
    `post-${Date.now()}`;
}


/* =========================================================
   MESSAGES
   ========================================================= */

function showLoginMessage(
  message
) {

  $("loginMessage")
    .textContent =
    message;
}


function showFormMessage(
  message
) {

  $("formMessage")
    .textContent =
    message;
}


/* =========================================================
   ESCAPE
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}