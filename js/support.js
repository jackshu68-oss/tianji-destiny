/* Support contact helpers for email handoff and WeChat ID copy. */
(function (root) {
  'use strict';

  const SUPPORT_EMAIL = 'jackshu68@gmail.com';
  const SUPPORT_WECHAT = 'JACKSHU16888';

  function isEnglish() {
    return root.TianjiUI && root.TianjiUI.getLanguage() === 'en';
  }

  function phrase(zh, en) {
    return isEnglish() ? en : zh;
  }

  function emailHref() {
    const subject = phrase('道法自然会员开通申请', 'DAOFA membership activation request');
    const body = phrase(
      '请附上付款截图，并填写：\n1. 注册手机号后四位：\n2. 会员方案：\n3. 交易单号：',
      'Please attach the payment screenshot and include:\n1. Last four phone digits:\n2. Membership plan:\n3. Transaction reference:'
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function setCopyState(button, copied) {
    button.textContent = copied ? phrase('已复制微信号', 'WeChat ID copied') : phrase('复制微信号', 'Copy WeChat ID');
  }

  async function copyWechat(button) {
    try {
      if (navigator.clipboard && root.isSecureContext) await navigator.clipboard.writeText(SUPPORT_WECHAT);
      else {
        const input = document.createElement('textarea');
        input.value = SUPPORT_WECHAT;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopyState(button, true);
      root.setTimeout(() => setCopyState(button, false), 2200);
    } catch (_error) {
      button.textContent = phrase(`请手动复制 ${SUPPORT_WECHAT}`, `Copy manually: ${SUPPORT_WECHAT}`);
    }
  }

  function refresh() {
    document.querySelectorAll('[data-support-email]').forEach(link => { link.href = emailHref(); });
    document.querySelectorAll('[data-copy-support-wechat]').forEach(button => setCopyState(button, false));
  }

  function init() {
    refresh();
    document.querySelectorAll('[data-copy-support-wechat]').forEach(button => {
      button.addEventListener('click', () => copyWechat(button));
    });
    document.addEventListener('tianji:language-changed', refresh);
  }

  root.TianjiSupport = { email: SUPPORT_EMAIL, wechat: SUPPORT_WECHAT, emailHref };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
