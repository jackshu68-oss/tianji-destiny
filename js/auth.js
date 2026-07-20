/* Same-origin phone authentication. Session tokens stay in HttpOnly cookies. */
(function (root) {
  'use strict';

  let accountState = { authenticated: false, account: null, trial: null, sms_enabled: false };
  let expiryTimer = 0;

  function isEnglish() {
    return root.TianjiUI && root.TianjiUI.getLanguage() === 'en';
  }

  function copy(chinese, english) {
    return isEnglish() ? english : chinese;
  }

  async function request(path, options) {
    const settings = options || {};
    const response = await fetch(path, {
      method: settings.method || 'GET',
      headers: settings.body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'same-origin',
      cache: 'no-store',
      body: settings.body ? JSON.stringify(settings.body) : undefined
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; }
    catch (_error) { payload = {}; }
    if (!response.ok || !payload.ok) {
      const error = new Error(payload.message || copy('账户服务暂时不可用。', 'The account service is temporarily unavailable.'));
      error.code = payload.code || `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function status() {
    const payload = await request('/api/auth/status');
    accountState = payload;
    applyAccessState(payload);
    root.dispatchEvent(new CustomEvent('tianji:auth-changed', { detail: payload }));
    return payload;
  }

  async function startTrial() {
    const payload = await request('/api/auth/trial/start', { method: 'POST', body: {} });
    accountState = Object.assign({}, accountState, payload);
    applyAccessState(accountState);
    root.dispatchEvent(new CustomEvent('tianji:auth-changed', { detail: accountState }));
    return accountState;
  }

  async function ensureTrialAccess() {
    if (accountState.authenticated || (accountState.trial && accountState.trial.active)) return accountState;
    try { return await startTrial(); }
    catch (error) {
      if (error.code === 'AUTH_REQUIRED') showExpiredGate();
      throw error;
    }
  }

  function startOtp(phone, purpose) {
    return request('/api/auth/otp/start', { method: 'POST', body: { phone, purpose } });
  }

  async function register(phone, code, password) {
    const payload = await request('/api/auth/register', { method: 'POST', body: { phone, code, password } });
    await status();
    return payload;
  }

  async function login(phone, password) {
    const payload = await request('/api/auth/login', { method: 'POST', body: { phone, password } });
    await status();
    return payload;
  }

  async function resetPassword(phone, code, password) {
    const payload = await request('/api/auth/password/reset', { method: 'POST', body: { phone, code, password } });
    await status();
    return payload;
  }

  async function logout() {
    await request('/api/auth/logout', { method: 'POST', body: {} });
    await status();
  }

  function safeNext() {
    const value = new URLSearchParams(root.location.search).get('next') || '../';
    try {
      const url = new URL(value, root.location.href);
      return url.origin === root.location.origin ? `${url.pathname}${url.search}${url.hash}` : '../';
    } catch (_error) { return '../'; }
  }

  function setNotice(node, message, tone) {
    node.textContent = message || '';
    node.className = `auth-notice${tone ? ` ${tone}` : ''}`;
  }

  function accessGate() {
    let gate = document.getElementById('auth-access-gate');
    if (gate) return gate;
    gate = document.createElement('section');
    gate.id = 'auth-access-gate';
    gate.className = 'auth-access-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = '<div class="auth-access-gate-panel"><span class="auth-access-kicker"></span><h2></h2><p></p><div class="auth-access-actions"><a data-access-login></a><a data-access-register></a></div><small></small></div>';
    document.body.appendChild(gate);
    return gate;
  }

  function showExpiredGate() {
    if (document.querySelector('[data-auth-page]')) return;
    const gate = accessGate();
    const next = encodeURIComponent(`${root.location.pathname}${root.location.search}${root.location.hash}`);
    gate.querySelector('.auth-access-kicker').textContent = copy('1 天体验已结束', '1-DAY TRIAL ENDED');
    gate.querySelector('h2').textContent = copy('登录后继续使用', 'Sign in to continue');
    gate.querySelector('p').textContent = copy(
      '注册后仍可长期使用基础查询；完整报告、AI 详解和综合分析需要会员。',
      'Basic queries remain available after registration. Complete reports, AI interpretation and integrated analysis require membership.'
    );
    const login = gate.querySelector('[data-access-login]');
    login.textContent = copy('手机号登录', 'Phone sign-in');
    login.href = `/account/?mode=login&next=${next}`;
    const register = gate.querySelector('[data-access-register]');
    register.textContent = copy('注册账号', 'Create account');
    register.href = `/account/?mode=register&next=${next}`;
    gate.querySelector('small').textContent = copy(
      '注册只在首次验证或找回密码时发送短信，以后使用手机号和密码登录。',
      'SMS is only used for first verification or password recovery. Future sign-ins use your phone number and password.'
    );
    gate.hidden = false;
    document.body.classList.add('auth-access-locked');
  }

  function hideExpiredGate() {
    const gate = document.getElementById('auth-access-gate');
    if (gate) gate.hidden = true;
    document.body.classList.remove('auth-access-locked');
  }

  function applyAccessState(payload) {
    if (typeof document === 'undefined' || document.querySelector('[data-auth-page]')) return;
    root.clearTimeout(expiryTimer);
    const trial = payload && payload.trial;
    if (payload && payload.authenticated) {
      hideExpiredGate();
      return;
    }
    if (trial && trial.started && !trial.active) {
      showExpiredGate();
      return;
    }
    hideExpiredGate();
    if (trial && trial.active && trial.expires) {
      const delay = Math.max(1000, Math.min(2147480000, Number(trial.expires) * 1000 - Date.now() + 1000));
      expiryTimer = root.setTimeout(() => status().catch(() => {}), delay);
    }
  }

  function samePassword(form) {
    const password = form.querySelector('[name="password"]').value;
    const confirmation = form.querySelector('[name="confirm-password"]').value;
    if (password !== confirmation) throw new Error(copy('两次输入的密码不一致。', 'The passwords do not match.'));
    return password;
  }

  function setFormBusy(form, busy) {
    form.querySelectorAll('button, input').forEach(node => { node.disabled = Boolean(busy); });
  }

  function initAccountPage() {
    const page = document.querySelector('[data-auth-page]');
    if (!page) return;
    const tabs = Array.from(page.querySelectorAll('[data-auth-mode]'));
    const forms = Array.from(page.querySelectorAll('[data-auth-form]'));
    const notice = document.getElementById('auth-notice');
    const signedIn = document.getElementById('auth-signed-in');
    const signedOut = document.getElementById('auth-signed-out');
    const accountPhone = document.getElementById('auth-account-phone');
    const accountPlan = document.getElementById('auth-account-plan');
    const logoutButton = document.getElementById('auth-logout');

    function selectMode(mode) {
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
      forms.forEach(form => { form.hidden = form.dataset.authForm !== mode; });
      setNotice(notice, '', '');
    }

    tabs.forEach(tab => tab.addEventListener('click', () => selectMode(tab.dataset.authMode)));
    const initialMode = new URLSearchParams(root.location.search).get('mode');
    selectMode(['login', 'register', 'recover'].includes(initialMode) ? initialMode : 'login');

    page.querySelectorAll('[data-send-otp]').forEach(button => {
      button.addEventListener('click', async () => {
        const form = button.closest('form');
        const phone = form.querySelector('[name="phone"]').value.trim();
        button.disabled = true;
        setNotice(notice, copy('正在发送验证码…', 'Sending verification code...'), 'loading');
        try {
          const payload = await startOtp(phone, button.dataset.sendOtp);
          setNotice(notice, payload.message || copy('验证码已发送。', 'Verification code sent.'), 'success');
          form.querySelector('[name="code"]').focus();
          let remaining = 60;
          button.textContent = `${remaining}s`;
          const timer = root.setInterval(() => {
            remaining -= 1;
            button.textContent = remaining > 0 ? `${remaining}s` : copy('发送验证码', 'Send code');
            if (remaining <= 0) {
              root.clearInterval(timer);
              button.disabled = false;
            }
          }, 1000);
        } catch (error) {
          setNotice(notice, error.message, 'error');
          button.disabled = false;
        }
      });
    });

    const loginForm = page.querySelector('[data-auth-form="login"]');
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      setFormBusy(loginForm, true);
      setNotice(notice, copy('正在登录…', 'Signing in...'), 'loading');
      try {
        await login(loginForm.elements.phone.value.trim(), loginForm.elements.password.value);
        setNotice(notice, copy('登录成功。', 'Signed in.'), 'success');
        root.location.assign(safeNext());
      } catch (error) {
        setNotice(notice, error.message, 'error');
        setFormBusy(loginForm, false);
      }
    });

    const registerForm = page.querySelector('[data-auth-form="register"]');
    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      setFormBusy(registerForm, true);
      setNotice(notice, copy('正在创建账户…', 'Creating your account...'), 'loading');
      try {
        const password = samePassword(registerForm);
        await register(registerForm.elements.phone.value.trim(), registerForm.elements.code.value.trim(), password);
        setNotice(notice, copy('注册成功。', 'Account created.'), 'success');
        root.location.assign(safeNext());
      } catch (error) {
        setNotice(notice, error.message, 'error');
        setFormBusy(registerForm, false);
      }
    });

    const recoverForm = page.querySelector('[data-auth-form="recover"]');
    recoverForm.addEventListener('submit', async event => {
      event.preventDefault();
      setFormBusy(recoverForm, true);
      setNotice(notice, copy('正在重设密码…', 'Resetting your password...'), 'loading');
      try {
        const password = samePassword(recoverForm);
        await resetPassword(recoverForm.elements.phone.value.trim(), recoverForm.elements.code.value.trim(), password);
        setNotice(notice, copy('密码已重设并登录。', 'Password reset. You are now signed in.'), 'success');
        root.location.assign(safeNext());
      } catch (error) {
        setNotice(notice, error.message, 'error');
        setFormBusy(recoverForm, false);
      }
    });

    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        await logout();
        signedIn.hidden = true;
        signedOut.hidden = false;
        selectMode('login');
      } catch (error) { setNotice(notice, error.message, 'error'); }
      finally { logoutButton.disabled = false; }
    });

    setNotice(notice, copy('正在检查登录状态…', 'Checking sign-in status...'), 'loading');
    status().then(payload => {
      setNotice(notice, '', '');
      signedIn.hidden = !payload.authenticated;
      signedOut.hidden = payload.authenticated;
      if (payload.authenticated && payload.account) {
        accountPhone.textContent = payload.account.phone_hint || '';
        accountPlan.textContent = payload.account.is_owner
          ? copy('站主 · 永久会员', 'Owner · permanent membership')
          : (payload.account.active
            ? (payload.account.plan === 'yearly' ? copy('365 天会员', '365-day membership') : copy('30 天会员', '30-day membership'))
            : copy('免费版', 'Free'));
      }
    }).catch(error => setNotice(notice, error.message, 'error'));

    document.addEventListener('tianji:language-changed', () => {
      const selected = tabs.find(tab => tab.classList.contains('active'));
      if (selected) selectMode(selected.dataset.authMode);
    });
  }

  function initGlobalAccess() {
    if (document.querySelector('[data-auth-page]')) return;
    status().catch(() => {});
    document.addEventListener('tianji:language-changed', () => applyAccessState(accountState));
  }

  root.TianjiAuth = {
    status, startTrial, ensureTrialAccess, startOtp, register, login, resetPassword, logout,
    snapshot: () => accountState,
    showExpiredGate
  };
  if (typeof document !== 'undefined') {
    const init = () => { initAccountPage(); initGlobalAccess(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
