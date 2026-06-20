const SUPABASE_URL  = 'https://xmhtxfyaewwerbkoubqk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaHR4ZnlhZXd3ZXJia291YnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MDMwNzcsImV4cCI6MjA5Njk3OTA3N30.IQupFoqMWqHskT2Gv3WM3pz7J8HroWpbdbsA1LDDmXM';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Redirect if already logged in ── */
(async function() {
  try {
    var res = await supabaseClient.auth.getSession();
    if (res.data.session) {
      window.location.href = 'homepage.html';
    }
  } catch(e) { console.error('Session check error:', e); }
})();

/* ── Auth state listener ── */
supabaseClient.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN' && session) {
    window.location.href = 'homepage.html';
  }
});

/* ── Modal helpers ── */
function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  clearErrors();
}
function clearErrors() {
  var els = document.querySelectorAll('.modal-error');
  els.forEach(function(el) { el.style.display = 'none'; el.textContent = ''; });
}
function showError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/* Close modal on backdrop click */
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
    clearErrors();
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.active').forEach(function(m) {
      m.classList.remove('active');
    });
    clearErrors();
  }
});

/* ── Main page buttons ── */
function handleGoogle() {
  alert('Google sign-in is not available yet.');
}

function handleFacebook() {
  supabaseClient.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: 'https://usapweb.netlify.app/homepage.html' }
  }).then(function(res) {
    if (res.error) alert('Facebook sign-in error: ' + res.error.message);
  });
}

function handleCreateAccount() {
  clearErrors();
  switchCreateTab('normal');
  openModal('modal-create');
}

function handleSignIn() {
  clearErrors();
  openModal('modal-signin');
}

/* ── Create account tabs ── */
function switchCreateTab(tab) {
  var isNormal = tab === 'normal';
  document.getElementById('tab-normal').classList.toggle('active', isNormal);
  document.getElementById('tab-guest').classList.toggle('active', !isNormal);
  document.getElementById('create-normal-fields').style.display = isNormal ? 'flex' : 'none';
  document.getElementById('create-normal-fields').style.flexDirection = 'column';
  document.getElementById('create-normal-fields').style.gap = '0';
  document.getElementById('create-guest-fields').style.display = isNormal ? 'none' : 'flex';
  document.getElementById('create-guest-fields').style.flexDirection = 'column';
  document.getElementById('create-guest-fields').style.gap = '0';
  clearErrors();
}

/* ── Submit create account ── */
async function submitCreate() {
  clearErrors();
  var isGuest = document.getElementById('tab-guest').classList.contains('active');

  if (isGuest) {
    var username = document.getElementById('guest-username').value.trim();
    var password = document.getElementById('guest-password').value;
    var confirm  = document.getElementById('guest-confirm').value;
    if (!username) { showError('create-error', 'Please enter a username.'); return; }
    if (!password) { showError('create-error', 'Please enter a password.'); return; }
    if (password.length < 6) { showError('create-error', 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { showError('create-error', 'Passwords do not match.'); return; }
    var fakeEmail = username.toLowerCase().replace(/\s+/g,'_') + '_guest_' + Date.now() + '@anona.local';
    var res = await supabaseClient.auth.signUp({
      email: fakeEmail, password: password,
      options: { data: { username: username, account_type: 'guest' } }
    });
    if (res.error) { showError('create-error', res.error.message); return; }
    closeModal('modal-create');
    window.location.href = 'homepage.html';
  } else {
    var username = document.getElementById('create-username').value.trim();
    var email    = document.getElementById('create-email').value.trim();
    var password = document.getElementById('create-password').value;
    var confirm  = document.getElementById('create-confirm').value;
    if (!username) { showError('create-error', 'Please enter a username.'); return; }
    if (!email)    { showError('create-error', 'Please enter your email.'); return; }
    if (!password) { showError('create-error', 'Please enter a password.'); return; }
    if (password.length < 6) { showError('create-error', 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { showError('create-error', 'Passwords do not match.'); return; }
    var res = await supabaseClient.auth.signUp({
      email: email, password: password,
      options: { data: { username: username, account_type: 'normal' } }
    });
    if (res.error) { showError('create-error', res.error.message); return; }
    closeModal('modal-create');
    alert('Account created! Check your email to confirm your address.');
  }
}

/* ── Submit sign in ── */
async function submitSignIn() {
  clearErrors();
  var email    = document.getElementById('signin-email').value.trim();
  var password = document.getElementById('signin-password').value;
  if (!email)    { showError('signin-error', 'Please enter your email.'); return; }
  if (!password) { showError('signin-error', 'Please enter your password.'); return; }
  var res = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if (res.error) { showError('signin-error', res.error.message); return; }
  window.location.href = 'homepage.html';
}

/* ── Forgot password ── */
async function submitForgotPassword() {
  var email = document.getElementById('signin-email').value.trim();
  if (!email) { showError('signin-error', 'Enter your email above first.'); return; }
  var res = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://usapweb.netlify.app/homepage.html'
  });
  if (res.error) { showError('signin-error', res.error.message); return; }
  alert('Password reset link sent to ' + email);
}
