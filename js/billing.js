/* Membership checkout, entitlement recovery and payment-method UI. */
(function (root) {
  'use strict';

  const TOKEN_KEY = 'tianji_billing_token_v1';
  const state = {
    config: null,
    entitlement: { authenticated: false, active: false, plan: 'free', status: 'inactive' }
  };

  const COPY = {
    zh: {
      loading: '正在检查会员状态…',
      free: '当前为免费版',
      freeDetail: '基础排盘、本机保存与共享 AI 额度可继续使用。',
      pro: 'Pro 会员已生效',
      proDetail: '方案：{plan} · 会员邮箱：{email}',
      monthly: '月付',
      yearly: '年付',
      ready: 'iOS 版会员将通过 Apple App 内购买开通。',
      disabled: '网页付款已关闭。iOS 版上线后，数字会员仅通过 Apple App 内购买；当前不会收取费用。',
      buyMonthly: '购买 30 天 Pro',
      buyYearly: '购买 365 天 Pro',
      merchantPending: 'iOS 版上线后开放',
      emailRequired: '请先填写用于接收收据和恢复会员的有效邮箱。',
      consentRequired: '请先阅读并同意服务条款、会员购买规则与隐私政策。',
      redirecting: '正在打开 Apple App 内购买…',
      cancelled: '你已取消本次付款，没有产生新订单。',
      claiming: '付款已返回，正在确认订单并领取会员权限…',
      claimed: '订单已确认，Pro 会员已在此装置生效。',
      managing: '正在检查会员有效期…',
      recoverySent: '如该邮箱有有效会员，六位验证码会在几分钟内送达。',
      recovering: '正在恢复会员权限…',
      recovered: '会员权限已恢复到此装置。',
      genericError: '账户服务暂时不可用，请稍后再试。',
      noRecovery: '邮箱恢复服务仍在配置中。',
      noActive: '未找到有效会员。',
      alreadyClaimed: '该付款已领取，请使用邮箱恢复会员权限。',
      currentMonthly: '30 天会员',
      currentYearly: '365 天会员'
    },
    en: {
      loading: 'Checking membership status…',
      free: 'Free plan active',
      freeDetail: 'Core charts, local storage and the shared AI allowance remain available.',
      pro: 'Pro membership active',
      proDetail: 'Plan: {plan} · Member email: {email}',
      monthly: 'Monthly',
      yearly: 'Annual',
      ready: 'Membership on iOS will be available through Apple In-App Purchase.',
      disabled: 'Web checkout is disabled. Digital memberships on iOS will be available only through Apple In-App Purchase, and no payment is collected now.',
      buyMonthly: 'Buy 30 days of Pro',
      buyYearly: 'Buy 365 days of Pro',
      merchantPending: 'Available after the iOS launch',
      emailRequired: 'Enter a valid email for receipts and membership recovery.',
      consentRequired: 'Read and accept the Terms, membership purchase rules and Privacy Policy first.',
      redirecting: 'Opening Apple In-App Purchase…',
      cancelled: 'Payment was cancelled. No new order was created.',
      claiming: 'Payment returned. Confirming the order and activating membership…',
      claimed: 'Order confirmed. Pro is now active on this device.',
      managing: 'Checking membership validity…',
      recoverySent: 'If this email has an active membership, a six-digit code will arrive within a few minutes.',
      recovering: 'Restoring membership…',
      recovered: 'Membership has been restored on this device.',
      genericError: 'The account service is temporarily unavailable. Please try again later.',
      noRecovery: 'Email recovery is still being configured.',
      noActive: 'No active membership was found.',
      alreadyClaimed: 'This purchase was already claimed. Restore membership by email.',
      currentMonthly: '30-day membership',
      currentYearly: '365-day membership'
    }
  };

  function language() {
    return root.TianjiUI && root.TianjiUI.getLanguage() === 'en' ? 'en' : 'zh';
  }

  function copy(key, values) {
    let value = (COPY[language()] || COPY.zh)[key] || key;
    Object.keys(values || {}).forEach(name => { value = value.replace(`{${name}}`, values[name]); });
    return value;
  }

  function readToken() {
    try { return root.localStorage ? root.localStorage.getItem(TOKEN_KEY) || '' : ''; }
    catch (_error) { return ''; }
  }

  function writeToken(token) {
    try {
      if (!root.localStorage) return;
      if (token) root.localStorage.setItem(TOKEN_KEY, token);
      else root.localStorage.removeItem(TOKEN_KEY);
    } catch (_error) { /* The current page can still continue without persistent membership. */ }
  }

  function authHeaders() {
    const token = readToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request(path, options) {
    const settings = options || {};
    const headers = Object.assign({}, settings.auth === false ? {} : authHeaders(), settings.body ? { 'Content-Type': 'application/json' } : {});
    const response = await fetch(path, {
      method: settings.method || 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: settings.body ? JSON.stringify(settings.body) : undefined
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; }
    catch (_error) { payload = {}; }
    if (!response.ok || !payload.ok) {
      const error = new Error(payload.message || copy('genericError'));
      error.code = payload.code || `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function refresh() {
    const results = await Promise.all([
      request('/api/billing/config', { auth: false }),
      request('/api/billing/status')
    ]);
    state.config = results[0];
    state.entitlement = results[1].entitlement || state.entitlement;
    root.dispatchEvent(new CustomEvent('tianji:billing-changed', { detail: snapshot() }));
    return snapshot();
  }

  async function startCheckout(plan, email, paymentMethod) {
    const payload = await request('/api/billing/checkout', {
      method: 'POST', auth: false, body: { plan, email, method: paymentMethod }
    });
    root.location.assign(payload.url);
  }

  async function claimCheckout(sessionId, claim) {
    const payload = await request('/api/billing/claim', {
      method: 'POST', auth: false, body: { session_id: sessionId, claim }
    });
    writeToken(payload.access_token);
    state.entitlement = payload.entitlement;
    return payload;
  }

  async function openPortal() {
    const payload = await request('/api/billing/portal', { method: 'POST', body: {} });
    root.location.assign(payload.url);
  }

  async function startRecovery(email) {
    return request('/api/billing/recovery/start', { method: 'POST', auth: false, body: { email } });
  }

  async function verifyRecovery(email, code) {
    const payload = await request('/api/billing/recovery/verify', { method: 'POST', auth: false, body: { email, code } });
    writeToken(payload.access_token);
    state.entitlement = payload.entitlement;
    return payload;
  }

  function snapshot() {
    return {
      config: state.config,
      entitlement: Object.assign({}, state.entitlement),
      enabled: Boolean(state.config && state.config.enabled),
      isPro: Boolean(state.entitlement && state.entitlement.active)
    };
  }

  function setNotice(node, message, tone, copyKey) {
    if (!node) return;
    node.textContent = message || '';
    node.className = `billing-notice${tone ? ` ${tone}` : ''}`;
    node.dataset.copyKey = copyKey || '';
    node.dataset.noticeTone = tone || '';
  }

  function setCopiedNotice(node, key, tone) {
    setNotice(node, copy(key), tone, key);
  }

  function displayError(node, error) {
    const keys = {
      BILLING_NOT_CONFIGURED: 'disabled',
      CHINA_MERCHANT_PENDING: 'disabled',
      APPLE_IAP_REQUIRED: 'disabled',
      RECOVERY_NOT_CONFIGURED: 'noRecovery',
      INVALID_EMAIL: 'emailRequired',
      NO_ACTIVE_SUBSCRIPTION: 'noActive',
      ALREADY_CLAIMED: 'alreadyClaimed'
    };
    const key = error && keys[error.code];
    if (key) setCopiedNotice(node, key, 'error');
    else if (!error || error instanceof TypeError || !error.code || String(error.code).startsWith('HTTP_')) setCopiedNotice(node, 'genericError', 'error');
    else setNotice(node, error.message || copy('genericError'), 'error');
  }

  function planDisplay(plan) {
    return plan === 'yearly' ? copy('currentYearly') : copy('currentMonthly');
  }

  function renderPricing() {
    const rootNode = document.querySelector('[data-billing-root]');
    if (!rootNode) return;
    const config = state.config || { enabled: false, recovery_enabled: false, plans: [] };
    const entitlement = state.entitlement || {};
    const statusTitle = document.getElementById('billing-status-title');
    const statusDetail = document.getElementById('billing-status-detail');
    const statusBand = document.getElementById('billing-status-band');
    const merchantState = document.getElementById('billing-merchant-state');
    const manageButton = document.getElementById('billing-manage');
    const recoveryPanel = document.getElementById('billing-recovery');
    const plans = new Map((config.plans || []).map(item => [item.id, item]));

    const monthlyPrice = document.querySelector('[data-price="monthly"]');
    const yearlyPrice = document.querySelector('[data-price="yearly"]');
    if (monthlyPrice) monthlyPrice.textContent = (plans.get('monthly') || {}).price || '¥39';
    if (yearlyPrice) yearlyPrice.textContent = (plans.get('yearly') || {}).price || '¥299';

    if (entitlement.active) {
      statusTitle.textContent = copy('pro');
      statusDetail.textContent = copy('proDetail', { plan: planDisplay(entitlement.plan), email: entitlement.email_hint || '—' });
      statusBand.classList.add('is-pro');
      manageButton.hidden = !config.recurring;
    } else {
      statusTitle.textContent = copy('free');
      statusDetail.textContent = copy('freeDetail');
      statusBand.classList.remove('is-pro');
      manageButton.hidden = true;
    }

    merchantState.textContent = config.enabled ? copy('ready') : copy('disabled');
    merchantState.classList.toggle('is-ready', Boolean(config.enabled));
    document.querySelectorAll('[data-plan-checkout]').forEach(button => {
      const plan = button.dataset.planCheckout;
      button.disabled = !config.enabled;
      button.textContent = config.enabled
        ? copy(plan === 'yearly' ? 'buyYearly' : 'buyMonthly')
        : copy('merchantPending');
    });
    recoveryPanel.hidden = !config.recovery_enabled;
  }

  async function handleCheckoutReturn(notice) {
    const parameters = new URLSearchParams(root.location.search);
    if (parameters.get('checkout') === 'cancelled') {
      setCopiedNotice(notice, 'cancelled', 'warning');
      root.history.replaceState({}, '', root.location.pathname);
      return;
    }
    if (parameters.get('checkout') !== 'success') return;
    const sessionId = parameters.get('session_id') || '';
    const claim = parameters.get('claim') || '';
    setCopiedNotice(notice, 'claiming', 'loading');
    try {
      await claimCheckout(sessionId, claim);
      setCopiedNotice(notice, 'claimed', 'success');
      root.history.replaceState({}, '', root.location.pathname);
      renderPricing();
    } catch (error) {
      displayError(notice, error);
    }
  }

  function initPricing() {
    const rootNode = document.querySelector('[data-billing-root]');
    if (!rootNode) return;
    const notice = document.getElementById('billing-notice');
    const emailInput = document.getElementById('billing-email');
    const consentInput = document.getElementById('billing-consent');
    const recoveryEmail = document.getElementById('billing-recovery-email');
    const recoveryCode = document.getElementById('billing-recovery-code');
    const recoveryVerify = document.getElementById('billing-recovery-verify');

    setCopiedNotice(notice, 'loading', 'loading');
    refresh().then(() => {
      renderPricing();
      setNotice(notice, '', '');
      return handleCheckoutReturn(notice);
    }).catch(error => {
      displayError(notice, error);
      renderPricing();
    });

    document.querySelectorAll('[data-plan-checkout]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!state.config || !state.config.enabled || !emailInput || !consentInput) {
          setCopiedNotice(notice, 'disabled', 'warning');
          return;
        }
        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
          setCopiedNotice(notice, 'emailRequired', 'error');
          emailInput.focus();
          return;
        }
        if (!consentInput.checked) {
          setCopiedNotice(notice, 'consentRequired', 'error');
          consentInput.focus();
          return;
        }
        button.disabled = true;
        setCopiedNotice(notice, 'redirecting', 'loading');
        try { await startCheckout(button.dataset.planCheckout, email, 'apple_iap'); }
        catch (error) {
          displayError(notice, error);
          renderPricing();
        }
      });
    });

    document.getElementById('billing-manage').addEventListener('click', async () => {
      setCopiedNotice(notice, 'managing', 'loading');
      try { await openPortal(); }
      catch (error) { displayError(notice, error); }
    });

    document.getElementById('billing-recovery-send').addEventListener('click', async () => {
      try {
        await startRecovery(recoveryEmail.value.trim());
        setCopiedNotice(notice, 'recoverySent', 'success');
        recoveryCode.disabled = false;
        recoveryVerify.disabled = false;
        recoveryCode.focus();
      } catch (error) { displayError(notice, error); }
    });

    recoveryVerify.addEventListener('click', async () => {
      setCopiedNotice(notice, 'recovering', 'loading');
      try {
        await verifyRecovery(recoveryEmail.value.trim(), recoveryCode.value.trim());
        setCopiedNotice(notice, 'recovered', 'success');
        renderPricing();
      } catch (error) { displayError(notice, error); }
    });

    document.addEventListener('tianji:language-changed', () => {
      renderPricing();
      if (notice.dataset.copyKey) setCopiedNotice(notice, notice.dataset.copyKey, notice.dataset.noticeTone);
    });
  }

  root.TianjiBilling = {
    authHeaders,
    refresh,
    snapshot,
    startCheckout,
    claimCheckout,
    openPortal,
    startRecovery,
    verifyRecovery,
    clearLocalMembership: () => { writeToken(''); state.entitlement = { authenticated: false, active: false, plan: 'free', status: 'inactive' }; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPricing);
    else initPricing();
  }
})(typeof window !== 'undefined' ? window : globalThis);
