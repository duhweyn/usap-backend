const SUPABASE_URL  = 'https://xmhtxfyaewwerbkoubqk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaHR4ZnlhZXd3ZXJia291YnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MDMwNzcsImV4cCI6MjA5Njk3OTA3N30.IQupFoqMWqHskT2Gv3WM3pz7J8HroWpbdbsA1LDDmXM';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
var skipAutoRedirect = false;

/* ── Redirect if already logged in ── */
(async function() {
  try {
    var res = await supabaseClient.auth.getSession();
    if (res.data.session) window.location.href = 'homepage.html';
  } catch(e) { console.error('Session check:', e); }
})();

supabaseClient.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN' && session && !skipAutoRedirect) {
    window.location.href = 'homepage.html';
  }
});

/* ── Modal helpers ── */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); clearErrors(); }
function closeAll() { document.querySelectorAll('.modal-backdrop.active').forEach(function(m){ m.classList.remove('active'); }); clearErrors(); }

function clearErrors() {
  document.querySelectorAll('.modal-error').forEach(function(el){ el.style.display='none'; el.textContent=''; });
}
function showError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-backdrop')) closeAll();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAll();
});

/* ── DOB display update ── */
function updateDob(type) {
  if (type === 'month') {
    var sel = document.getElementById('dob-month');
    var txt = sel.options[sel.selectedIndex].text;
    document.getElementById('dob-month-val').textContent = sel.value ? txt : 'Month';
  } else if (type === 'day') {
    var v = document.getElementById('dob-day').value;
    document.getElementById('dob-day-val').textContent = v ? parseInt(v) : '0';
  } else {
    var v = document.getElementById('dob-year').value;
    document.getElementById('dob-year-val').textContent = v || '0000';
  }
}

/* ── Main page buttons ── */
function handleGoogle() { alert('Google sign-in is not available yet.'); }

function handleFacebook() {
  supabaseClient.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: 'https://usapweb.netlify.app/homepage.html' }
  }).then(function(res) {
    if (res.error) alert('Facebook sign-in error: ' + res.error.message);
  });
}

function handleCreateAccount() {
  closeAll();
  openModal('modal-ca1');
}

function handleSignIn() {
  closeAll();
  openModal('modal-signin');
}

/* ── Create Account flow ── */
function openNormalFlow() {
  closeAll();
  openModal('modal-ca2');
}

function openGuestModal() {
  closeAll();
  openModal('modal-guest');
}

function switchToNormal() {
  closeAll();
  openModal('modal-ca1');
}

/* Step 2: username + email + DOB → Next */
function submitCA2() {
  clearErrors();
  var username = document.getElementById('ca2-username').value.trim();
  var email    = document.getElementById('ca2-email').value.trim();
  var month    = document.getElementById('dob-month').value;
  var day      = document.getElementById('dob-day').value;
  var year     = document.getElementById('dob-year').value;
  if (!username) { showError('ca2-error', 'Please enter a username.'); return; }
  if (!email)    { showError('ca2-error', 'Please enter your email.'); return; }
  if (!month || !day || !year) { showError('ca2-error', 'Please complete your date of birth.'); return; }
  closeAll();
  openModal('modal-ca3');
}

/* Step 3: password → submit */
async function submitCA3() {
  clearErrors();
  var username = document.getElementById('ca2-username').value.trim();
  var email    = document.getElementById('ca2-email').value.trim();
  var month    = document.getElementById('dob-month').value;
  var day      = document.getElementById('dob-day').value;
  var year     = document.getElementById('dob-year').value;
  var password = document.getElementById('ca3-password').value;
  var confirm  = document.getElementById('ca3-confirm').value;
  if (!password)           { showError('ca3-error', 'Please enter a password.'); return; }
  if (password.length < 6) { showError('ca3-error', 'Password must be at least 6 characters.'); return; }
  if (password !== confirm) { showError('ca3-error', 'Passwords do not match.'); return; }
  skipAutoRedirect = true;
  var res = await supabaseClient.auth.signUp({
    email: email, password: password,
    options: { data: { username: username, date_of_birth: year+'-'+month+'-'+day, account_type: 'normal' } }
  });
  if (res.error) { skipAutoRedirect = false; showError('ca3-error', res.error.message); return; }
  closeAll();
  openModal('modal-pfp');
}

/* Guest account */
async function submitGuest() {
  clearErrors();
  var username = document.getElementById('guest-username').value.trim();
  var password = document.getElementById('guest-password').value;
  if (!username)           { showError('guest-error', 'Please enter a username.'); return; }
  if (!password)           { showError('guest-error', 'Please enter a password.'); return; }
  if (password.length < 6) { showError('guest-error', 'Password must be at least 6 characters.'); return; }
  var fakeEmail = username.toLowerCase().replace(/\s+/g,'_') + '_guest_' + Date.now() + '@anona.local';
  skipAutoRedirect = true;
  var res = await supabaseClient.auth.signUp({
    email: fakeEmail, password: password,
    options: { data: { username: username, account_type: 'guest' } }
  });
  if (res.error) { skipAutoRedirect = false; showError('guest-error', res.error.message); return; }
  closeAll();
  openModal('modal-pfp');
}

/* Sign in */
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

/* Forgot password */
async function submitForgotPassword() {
  var email = document.getElementById('signin-email').value.trim();
  if (!email) { showError('signin-error', 'Enter your email above first.'); return; }
  var res = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://usapweb.netlify.app/homepage.html'
  });
  if (res.error) { showError('signin-error', res.error.message); return; }
  alert('Password reset link sent to ' + email);
}

function previewPfp(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('pfp-preview').src = e.target.result;
    document.getElementById('pfp-preview').style.display = 'block';
    document.getElementById('pfp-camera-icon').style.display = 'none';
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitPfp() {
  var input = document.getElementById('pfp-input');
  if (input.files && input.files[0]) {
    var res = await supabaseClient.auth.getSession();
    if (res.data.session) {
      var uid = res.data.session.user.id;
      var file = input.files[0];
      var ext = file.name.split('.').pop();
      var path = uid + '/avatar.' + ext;
      await supabaseClient.storage.from('avatars').upload(path, file, { upsert: true });
      var pub = supabaseClient.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      localStorage.setItem('avatar_' + uid, pub);
    }
  }
  window.location.href = 'homepage.html';
}

function skipPfp() {
  window.location.href = 'homepage.html';
}