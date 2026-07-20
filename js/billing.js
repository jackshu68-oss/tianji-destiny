/* Membership checkout, entitlement recovery and payment-method UI. */
(function (root) {
  'use strict';

  const TOKEN_KEY = 'tianji_billing_token_v1';
  const state = {
    config: null,
    auth: { authenticated: false, account: null, trial: null },
    orders: [],
    grants: [],
    entitlement: { authenticated: false, active: false, plan: 'free', status: 'inactive' }
  };

  const COPY = {
    zh: {
      loading: '正在检查会员状态…',
      free: '当前为免费版',
      freeDetail: '可使用基础查询，不含详细解读。',
      trial: '1 天免费体验',
      trialDetail: '本次免登录体验已开始。',
      pro: '会员已生效',
      proDetail: '方案：{plan} · 账户：{identity}',
      owner: '站主 · 永久会员',
      ownerDetail: '站主账号已永久开放全部功能，不会产生会员费用。',
      monthly: '月付',
      yearly: '年付',
      ready: '会员购买通道已开放。',
      disabled: '购买通道准备中。',
      signInFirst: '请先登录手机号账户，再选择会员方案。',
      manualReady: '人工核验通道已开放。付款后发送截图并提交交易单号，核对到账后开通。',
      qrPending: '网站收款码尚未配置，请联系人工客服获取当前付款方式。',
      planSelected: '已选择：{plan} · ¥{amount}',
      providerRequired: '请选择微信支付或支付宝。',
      referenceRequired: '请输入付款详情中的交易单号。',
      confirmationRequired: '请确认已经核对收款人和金额。',
      submittingOrder: '正在提交付款核验申请…',
      orderSubmitted: '申请已提交。站主核对到账后会开通会员。',
      pending: '待核对',
      approved: '已开通',
      rejected: '未通过',
      uploadSuccess: '收款码已安全上传到服务器。',
      reviewing: '正在处理会员申请…',
      reviewApproved: '会员申请已批准并写入有效期。',
      reviewRejected: '会员申请已标记为未通过。',
      granting: '正在按手机号开通会员…',
      grantSuccess: '会员已开通并写入账号有效期。',
      buyMonthly: '开通 30 天会员',
      buyYearly: '开通 365 天会员',
      merchantPending: '暂未开放',
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
      freeDetail: 'Basic queries are available without detailed interpretations.',
      trial: '1-day free trial',
      trialDetail: 'Your no-sign-in trial has started.',
      pro: 'Membership active',
      proDetail: 'Plan: {plan} · Account: {identity}',
      owner: 'Owner · permanent membership',
      ownerDetail: 'The owner account has permanent full access and is never charged.',
      monthly: 'Monthly',
      yearly: 'Annual',
      ready: 'Membership purchasing is available.',
      disabled: 'Purchasing is coming soon.',
      signInFirst: 'Sign in with your phone account before choosing a membership.',
      manualReady: 'Manual verification is open. Send the screenshot and submit the transaction reference after payment; access starts after receipt verification.',
      qrPending: 'Website payment codes are not configured. Contact support for the current payment method.',
      planSelected: 'Selected: {plan} · ¥{amount}',
      providerRequired: 'Choose WeChat Pay or Alipay.',
      referenceRequired: 'Enter the transaction reference from the payment details.',
      confirmationRequired: 'Confirm that you checked the recipient and amount.',
      submittingOrder: 'Submitting your payment for verification…',
      orderSubmitted: 'Request submitted. Membership starts after the owner verifies receipt.',
      pending: 'Pending review',
      approved: 'Activated',
      rejected: 'Not approved',
      uploadSuccess: 'The payment code was uploaded securely to the server.',
      reviewing: 'Reviewing membership request…',
      reviewApproved: 'Membership approved and its expiry has been saved.',
      reviewRejected: 'The request was marked as not approved.',
      granting: 'Granting membership to the phone account…',
      grantSuccess: 'Membership was granted and saved to the account.',
      buyMonthly: 'Activate 30-day membership',
      buyYearly: 'Activate 365-day membership',
      merchantPending: 'Coming soon',
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

  function bilingual(zh, en) {
    return language() === 'en' ? en : zh;
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
    state.auth = results[1].auth || state.auth;
    root.dispatchEvent(new CustomEvent('tianji:billing-changed', { detail: snapshot() }));
    return snapshot();
  }

  async function createManualOrder(plan, provider, paymentReference, payerName) {
    const payload = await request('/api/billing/manual/order', {
      method: 'POST', auth: false,
      body: { plan, provider, payment_reference: paymentReference, payer_name: payerName }
    });
    return payload.order;
  }

  async function loadManualOrders() {
    const payload = await request('/api/billing/manual/orders', { auth: false });
    state.orders = payload.orders || [];
    state.grants = payload.grants || [];
    return payload;
  }

  async function reviewManualOrder(orderId, approve, note) {
    return request(`/api/billing/manual/${approve ? 'approve' : 'reject'}`, {
      method: 'POST', auth: false, body: { order_id: orderId, note: note || '' }
    });
  }

  async function grantMembership(phone, plan, note) {
    return request('/api/billing/manual/grant', {
      method: 'POST', auth: false, body: { phone, plan, note: note || '' }
    });
  }

  async function uploadPaymentQr(provider, file) {
    if (!file || !/^image\/(?:jpeg|png)$/.test(file.type) || file.size > 600 * 1024) {
      const error = new Error(bilingual('只支持不超过 600KB 的 JPEG 或 PNG 图片。', 'Use a JPEG or PNG image no larger than 600KB.'));
      error.code = 'INVALID_QR_UPLOAD';
      throw error;
    }
    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',', 2)[1] || '');
      reader.onerror = () => reject(new Error(bilingual('无法读取图片。', 'The image could not be read.')));
      reader.readAsDataURL(file);
    });
    return request('/api/billing/manual/qr/upload', {
      method: 'POST', auth: false, body: { provider, image_base64: imageBase64 }
    });
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
      auth: state.auth,
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
    if (plan === 'owner') return copy('owner');
    return plan === 'yearly' ? copy('currentYearly') : copy('currentMonthly');
  }

  function renderPricing() {
    const rootNode = document.querySelector('[data-billing-root]');
    if (!rootNode) return;
    const config = state.config || { enabled: false, recovery_enabled: false, plans: [] };
    const entitlement = state.entitlement || {};
    const auth = state.auth || {};
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

    if (entitlement.is_owner || entitlement.plan === 'owner') {
      statusTitle.textContent = copy('owner');
      statusDetail.textContent = copy('ownerDetail');
      statusBand.classList.add('is-pro');
      manageButton.hidden = true;
    } else if (entitlement.active) {
      statusTitle.textContent = copy('pro');
      statusDetail.textContent = copy('proDetail', { plan: planDisplay(entitlement.plan), identity: entitlement.phone_hint || entitlement.email_hint || '—' });
      statusBand.classList.add('is-pro');
      manageButton.hidden = !config.recurring;
    } else if (entitlement.plan === 'trial' && entitlement.status === 'trialing') {
      statusTitle.textContent = copy('trial');
      statusDetail.textContent = copy('trialDetail');
      statusBand.classList.remove('is-pro');
      manageButton.hidden = true;
    } else {
      statusTitle.textContent = copy('free');
      statusDetail.textContent = copy('freeDetail');
      statusBand.classList.remove('is-pro');
      manageButton.hidden = true;
    }

    const methods = Array.isArray(config.manual_payment_methods) ? config.manual_payment_methods : [];
    const manualReady = Boolean(auth.authenticated && methods.length);
    merchantState.textContent = entitlement.is_owner
      ? copy('ownerDetail')
      : (!auth.authenticated ? copy('signInFirst') : (manualReady ? copy('manualReady') : copy('qrPending')));
    merchantState.classList.toggle('is-ready', manualReady || Boolean(entitlement.is_owner));
    document.querySelectorAll('[data-plan-checkout]').forEach(button => {
      const plan = button.dataset.planCheckout;
      button.disabled = Boolean(entitlement.is_owner) || !manualReady;
      button.textContent = copy(plan === 'yearly' ? 'buyYearly' : 'buyMonthly');
    });
    if (recoveryPanel) recoveryPanel.hidden = !config.recovery_enabled;

    const loginRequired = document.getElementById('manual-login-required');
    const workspace = document.getElementById('manual-payment-workspace');
    const ownerPanel = document.getElementById('owner-billing-panel');
    if (loginRequired) loginRequired.hidden = Boolean(auth.authenticated);
    if (workspace) workspace.hidden = !auth.authenticated || Boolean(entitlement.is_owner);
    if (ownerPanel) ownerPanel.hidden = !Boolean(entitlement.is_owner);
    document.querySelectorAll('[data-payment-provider]').forEach(button => {
      const available = methods.includes(button.dataset.paymentProvider);
      button.hidden = !available;
      const image = button.querySelector('[data-payment-qr]');
      if (image && available && auth.authenticated) image.src = `/api/billing/manual/qr/${button.dataset.paymentProvider}?v=${Date.now()}`;
      else if (image) image.removeAttribute('src');
    });
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

  function makeNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function orderStatus(status) {
    return copy(status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending'));
  }

  function orderPlan(order) {
    return `${planDisplay(order.plan)} · ¥${order.amount_cny} · ${order.provider === 'wechat' ? bilingual('微信支付', 'WeChat Pay') : bilingual('支付宝', 'Alipay')}`;
  }

  function renderOrderList(container, orders, ownerMode, notice) {
    if (!container) return;
    container.replaceChildren();
    if (!orders.length) {
      container.appendChild(makeNode('p', 'manual-orders-empty', bilingual('暂时没有开通申请。', 'No activation requests yet.')));
      return;
    }
    orders.forEach(order => {
      const row = makeNode('article', `manual-order-row is-${order.status}`);
      const info = makeNode('div', 'manual-order-info');
      const heading = makeNode('div', 'manual-order-heading');
      heading.appendChild(makeNode('strong', '', order.id));
      heading.appendChild(makeNode('span', 'manual-order-status', orderStatus(order.status)));
      info.appendChild(heading);
      info.appendChild(makeNode('p', '', orderPlan(order)));
      info.appendChild(makeNode('small', '', `${ownerMode && order.phone_hint ? `${order.phone_hint} · ` : ''}${bilingual('交易单号', 'Reference')}: ${order.payment_reference}${order.payer_name ? ` · ${order.payer_name}` : ''}`));
      info.appendChild(makeNode('time', '', new Date(order.created * 1000).toLocaleString(isEnglish() ? 'en-CA' : 'zh-CN')));
      row.appendChild(info);
      if (ownerMode && order.status === 'pending') {
        const actions = makeNode('div', 'manual-review-actions');
        const approve = makeNode('button', 'approve', bilingual('确认到账并开通', 'Approve and activate'));
        approve.type = 'button';
        const reject = makeNode('button', 'reject', bilingual('标记未通过', 'Reject'));
        reject.type = 'button';
        const review = async accepted => {
          approve.disabled = true;
          reject.disabled = true;
          setCopiedNotice(notice, 'reviewing', 'loading');
          try {
            await reviewManualOrder(order.id, accepted, '站主人工核验');
            setCopiedNotice(notice, accepted ? 'reviewApproved' : 'reviewRejected', 'success');
            await refresh();
            await refreshOrderLists(notice);
            renderPricing();
          } catch (error) {
            displayError(notice, error);
            approve.disabled = false;
            reject.disabled = false;
          }
        };
        approve.addEventListener('click', () => review(true));
        reject.addEventListener('click', () => review(false));
        actions.append(approve, reject);
        row.appendChild(actions);
      }
      container.appendChild(row);
    });
  }

  function renderGrantList(container, grants) {
    if (!container) return;
    container.replaceChildren();
    if (!grants.length) {
      container.appendChild(makeNode('p', 'manual-orders-empty', bilingual('暂时没有直接开通记录。', 'No direct grants yet.')));
      return;
    }
    grants.forEach(grant => {
      const row = makeNode('article', 'manual-order-row is-approved');
      const info = makeNode('div', 'manual-order-info');
      const heading = makeNode('div', 'manual-order-heading');
      heading.appendChild(makeNode('strong', '', grant.phone_hint || grant.id));
      heading.appendChild(makeNode('span', 'manual-order-status', bilingual('已开通', 'Activated')));
      info.appendChild(heading);
      info.appendChild(makeNode('p', '', `${planDisplay(grant.plan)} · ${bilingual('到期', 'Expires')} ${new Date(grant.new_expires * 1000).toLocaleDateString(isEnglish() ? 'en-CA' : 'zh-CN')}`));
      if (grant.note) info.appendChild(makeNode('small', '', grant.note));
      info.appendChild(makeNode('time', '', new Date(grant.created * 1000).toLocaleString(isEnglish() ? 'en-CA' : 'zh-CN')));
      row.appendChild(info);
      container.appendChild(row);
    });
  }

  async function refreshOrderLists(notice) {
    if (!state.auth || !state.auth.authenticated) return;
    try {
      const payload = await loadManualOrders();
      renderOrderList(document.getElementById('manual-order-list'), payload.owner ? [] : payload.orders, false, notice);
      renderOrderList(document.getElementById('owner-order-list'), payload.owner ? payload.orders : [], true, notice);
      renderGrantList(document.getElementById('owner-grant-list'), payload.owner ? payload.grants || [] : []);
    } catch (error) {
      displayError(notice, error);
    }
  }

  function initPricing() {
    const rootNode = document.querySelector('[data-billing-root]');
    if (!rootNode) return;
    const notice = document.getElementById('billing-notice');
    const manualForm = document.getElementById('manual-order-form');
    const selectedPlanNode = document.getElementById('manual-selected-plan');
    const ownerGrantForm = document.getElementById('owner-grant-form');
    let selectedPlan = '';
    let selectedProvider = '';
    const recoveryEmail = document.getElementById('billing-recovery-email');
    const recoveryCode = document.getElementById('billing-recovery-code');
    const recoveryVerify = document.getElementById('billing-recovery-verify');

    setCopiedNotice(notice, 'loading', 'loading');
    refresh().then(async () => {
      renderPricing();
      setNotice(notice, '', '');
      await refreshOrderLists(notice);
      return handleCheckoutReturn(notice);
    }).catch(error => {
      displayError(notice, error);
      renderPricing();
    });

    document.querySelectorAll('[data-plan-checkout]').forEach(button => {
      button.addEventListener('click', () => {
        if (!state.auth || !state.auth.authenticated) {
          setCopiedNotice(notice, 'signInFirst', 'warning');
          return;
        }
        const methods = state.config && Array.isArray(state.config.manual_payment_methods) ? state.config.manual_payment_methods : [];
        if (!methods.length) {
          setCopiedNotice(notice, 'qrPending', 'warning');
          return;
        }
        selectedPlan = button.dataset.planCheckout;
        manualForm.elements.plan.value = selectedPlan;
        selectedPlanNode.textContent = copy('planSelected', {
          plan: planDisplay(selectedPlan),
          amount: selectedPlan === 'yearly' ? '299' : '39'
        });
        document.getElementById('manual-payment').scrollIntoView({ behavior: 'smooth', block: 'start' });
        manualForm.querySelector('button[type="submit"]').disabled = !selectedProvider;
      });
    });

    document.querySelectorAll('[data-payment-provider]').forEach(button => {
      button.addEventListener('click', () => {
        selectedProvider = button.dataset.paymentProvider;
        manualForm.elements.provider.value = selectedProvider;
        document.querySelectorAll('[data-payment-provider]').forEach(item => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        manualForm.querySelector('button[type="submit"]').disabled = !selectedPlan;
      });
    });

    if (manualForm) manualForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!selectedPlan) {
        setNotice(notice, bilingual('请先选择 30 天或 365 天方案。', 'Choose the 30-day or 365-day plan first.'), 'error');
        return;
      }
      if (!selectedProvider) {
        setCopiedNotice(notice, 'providerRequired', 'error');
        return;
      }
      const reference = manualForm.elements['payment-reference'].value.trim();
      if (reference.length < 6) {
        setCopiedNotice(notice, 'referenceRequired', 'error');
        manualForm.elements['payment-reference'].focus();
        return;
      }
      if (!manualForm.elements.confirm.checked) {
        setCopiedNotice(notice, 'confirmationRequired', 'error');
        manualForm.elements.confirm.focus();
        return;
      }
      const submit = manualForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setCopiedNotice(notice, 'submittingOrder', 'loading');
      try {
        await createManualOrder(selectedPlan, selectedProvider, reference, manualForm.elements['payer-name'].value.trim());
        manualForm.reset();
        selectedPlan = '';
        selectedProvider = '';
        selectedPlanNode.textContent = bilingual('请先在上方选择方案', 'Choose a plan above');
        document.querySelectorAll('[data-payment-provider]').forEach(item => {
          item.classList.remove('active');
          item.setAttribute('aria-pressed', 'false');
        });
        setCopiedNotice(notice, 'orderSubmitted', 'success');
        await refreshOrderLists(notice);
      } catch (error) {
        displayError(notice, error);
      } finally {
        submit.disabled = true;
      }
    });

    document.querySelectorAll('[data-owner-qr]').forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        input.disabled = true;
        setNotice(notice, bilingual('正在安全上传收款码…', 'Uploading the payment code securely…'), 'loading');
        try {
          await uploadPaymentQr(input.dataset.ownerQr, file);
          setCopiedNotice(notice, 'uploadSuccess', 'success');
          await refresh();
          renderPricing();
        } catch (error) {
          displayError(notice, error);
        } finally {
          input.value = '';
          input.disabled = false;
        }
      });
    });

    if (ownerGrantForm) ownerGrantForm.addEventListener('submit', async event => {
      event.preventDefault();
      const phone = ownerGrantForm.elements.phone.value.trim();
      const plan = ownerGrantForm.elements.plan.value;
      if (!/^\+?(?:86)?[\d\s-]{11,18}$/.test(phone)) {
        setNotice(notice, bilingual('请输入客户注册时使用的完整手机号码。', 'Enter the full phone number used for registration.'), 'error');
        ownerGrantForm.elements.phone.focus();
        return;
      }
      const submit = ownerGrantForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setCopiedNotice(notice, 'granting', 'loading');
      try {
        await grantMembership(phone, plan, ownerGrantForm.elements.note.value.trim());
        ownerGrantForm.reset();
        setCopiedNotice(notice, 'grantSuccess', 'success');
        await refreshOrderLists(notice);
      } catch (error) {
        displayError(notice, error);
      } finally {
        submit.disabled = false;
      }
    });

    const manageButton = document.getElementById('billing-manage');
    if (manageButton) manageButton.addEventListener('click', async () => {
      setCopiedNotice(notice, 'managing', 'loading');
      try { await openPortal(); }
      catch (error) { displayError(notice, error); }
    });

    const recoverySend = document.getElementById('billing-recovery-send');
    if (recoverySend) recoverySend.addEventListener('click', async () => {
      try {
        await startRecovery(recoveryEmail.value.trim());
        setCopiedNotice(notice, 'recoverySent', 'success');
        recoveryCode.disabled = false;
        recoveryVerify.disabled = false;
        recoveryCode.focus();
      } catch (error) { displayError(notice, error); }
    });

    if (recoveryVerify) recoveryVerify.addEventListener('click', async () => {
      setCopiedNotice(notice, 'recovering', 'loading');
      try {
        await verifyRecovery(recoveryEmail.value.trim(), recoveryCode.value.trim());
        setCopiedNotice(notice, 'recovered', 'success');
        renderPricing();
      } catch (error) { displayError(notice, error); }
    });

    document.addEventListener('tianji:language-changed', () => {
      renderPricing();
      if (state.auth && state.auth.authenticated) {
        const owner = Boolean(state.entitlement && state.entitlement.is_owner);
        renderOrderList(document.getElementById('manual-order-list'), owner ? [] : state.orders, false, notice);
        renderOrderList(document.getElementById('owner-order-list'), owner ? state.orders : [], true, notice);
        renderGrantList(document.getElementById('owner-grant-list'), owner ? state.grants : []);
      }
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
    createManualOrder,
    loadManualOrders,
    reviewManualOrder,
    grantMembership,
    uploadPaymentQr,
    clearLocalMembership: () => { writeToken(''); state.entitlement = { authenticated: false, active: false, plan: 'free', status: 'inactive' }; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPricing);
    else initPricing();
  }
})(typeof window !== 'undefined' ? window : globalThis);
